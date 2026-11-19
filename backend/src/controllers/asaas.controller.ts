import type { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { asaasService, AsaasConfigError, AsaasWebhookAuthError } from '../services/asaas.service';
import { getPlanDefinition, getPlanLimits, normalizePlanId, type PlanId } from '../services/plans/plan.constants';

type AsaasPlanId = Extract<PlanId, 'basic' | 'pro' | 'master'>;

const ALIAS_PLANOS: Record<string, AsaasPlanId> = {
  basic: 'basic',
  basico: 'basic',
  starter: 'basic',
  pro: 'pro',
  avancado: 'pro',
  master: 'master',
  enterprise: 'master',
  corporativo: 'master',
};

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

function resolvePlanKey(input?: string | null): AsaasPlanId | null {
  const key = String(input || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ALIAS_PLANOS[key] || null;
}

function toPrismaPlanType(planId: AsaasPlanId): any {
  if (planId === 'basic') return 'STARTER';
  if (planId === 'pro') return 'PRO';
  return 'ENTERPRISE';
}

export class AsaasController {
  async listPlanos(_req: Request, res: Response) {
    const planIds: AsaasPlanId[] = ['basic', 'pro', 'master'];
    const configured = asaasService.isConfigured();

    return res.json({
      success: true,
      data: planIds.map((planId) => {
        const definition = getPlanDefinition(planId);
        return {
          id: definition.id,
          nome: definition.nome,
          descricao: definition.descricao,
          valor: definition.valorMensalCentavos / 100,
          valorCentavos: definition.valorMensalCentavos,
          destaque: definition.id === 'pro',
          features: definition.features,
          limites: getPlanLimits(planId),
          asaasConfigurado: configured,
        };
      }),
    });
  }

  async minhaAssinatura(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Não autenticado' });
    const now = new Date();

    const [sub, dbUser] = await Promise.all([
      prisma.subscription.findFirst({
        where: { userId: req.user.id, categoria: 'plataforma' },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { trialEndsAt: true, createdAt: true },
      }),
    ]);

    const effectiveTrialEndsAt =
      dbUser?.trialEndsAt ??
      (dbUser?.createdAt ? new Date(new Date(dbUser.createdAt).getTime() + 15 * 24 * 60 * 60 * 1000) : null);
    const isUserTrialActive = Boolean(effectiveTrialEndsAt && new Date(effectiveTrialEndsAt) > now);

    if (!sub) {
      if (isUserTrialActive && effectiveTrialEndsAt) {
        const masterDef = getPlanDefinition('master');
        return res.json({
          success: true,
          data: {
            plano: 'master',
            nome: 'Master (Trial 15 Dias)',
            features: masterDef.features,
            status: 'trialing',
            ativa: true,
            isTrialActive: true,
            trialEndsAt: new Date(effectiveTrialEndsAt).toISOString(),
            diasRestantes: Math.max(1, Math.ceil((new Date(effectiveTrialEndsAt).getTime() - Date.now()) / 86400000)),
            gateway: null,
            pendingPlanId: null,
            pendingPlanAt: null,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          plano: 'free',
          features: [],
          status: 'none',
          ativa: false,
          isTrialActive: false,
          gateway: null,
          pendingPlanId: null,
          pendingPlanAt: null,
        },
      });
    }

    const fimComCarencia = sub.periodoFim ? new Date(new Date(sub.periodoFim).getTime() + GRACE_PERIOD_MS) : null;
    const isExpired = fimComCarencia ? fimComCarencia < now : false;
    const isAtiva = ['active', 'trialing', 'past_due'].includes(sub.status) && !isExpired;
    const isTrialActive = isAtiva && (sub.status === 'trialing' || isUserTrialActive);
    const plano = isAtiva ? normalizePlanId(sub.plano) : (isUserTrialActive ? 'master' : 'free');

    return res.json({
      success: true,
      data: {
        plano,
        nome: getPlanDefinition(plano).nome,
        features: getPlanDefinition(plano).features,
        status: isExpired ? (sub.status === 'trialing' ? 'expired_trial' : 'expired') : sub.status,
        ativa: isAtiva || isUserTrialActive,
        isTrialActive,
        trialEndsAt: isTrialActive ? (sub.periodoFim?.toISOString() ?? dbUser?.trialEndsAt?.toISOString() ?? null) : null,
        gateway: isAtiva && sub.asaasSubscriptionId ? 'asaas' : null,
        asaasSubscriptionId: sub.asaasSubscriptionId,
        periodo_fim: sub.periodoFim?.toISOString() ?? dbUser?.trialEndsAt?.toISOString() ?? null,
        pendingPlanId: sub.pendingPlanId,
        pendingPlanAt: sub.pendingPlanAt?.toISOString() ?? null,
      },
    });
  }

  async ativarTrial(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Não autenticado' });
    const existing = await prisma.subscription.findFirst({
      where: { userId: req.user.id, categoria: 'plataforma' },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Período de teste já utilizado para esta conta.' });
    }
    const now = new Date();
    const fim = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        userId: req.user.id,
        email: req.user.email || '',
        plano: 'master',
        planType: toPrismaPlanType('master'),
        categoria: 'plataforma',
        status: 'trialing',
        periodoInicio: now,
        periodoFim: fim,
      },
    });
    return res.json({ success: true, data: { plano: 'master', trialEndsAt: fim.toISOString() } });
  }

  async reconciliarAssinatura(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Não autenticado' });
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user.id, categoria: 'plataforma' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!sub?.asaasSubscriptionId) {
      return res.json({ success: true, data: { synced: false, status: sub?.status || 'none' } });
    }
    try {
      const payments = await asaasService.getSubscriptionPayments(sub.asaasSubscriptionId);
      const paid = payments.some((p: any) => ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(String(p.status)));
      if (paid) {
        const targetPlan = resolvePlanKey(sub.pendingPlanId || sub.plano) || 'pro';
        const now = new Date();
        const nextEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            plano: targetPlan,
            planType: toPrismaPlanType(targetPlan),
            status: 'active',
            periodoInicio: now,
            periodoFim: nextEnd,
            pendingPlanId: null,
            pendingPlanAt: null,
          },
        });
        await prisma.user.update({
          where: { id: req.user.id },
          data: { plano: targetPlan, planType: toPrismaPlanType(targetPlan) },
        });
        return res.json({ success: true, data: { synced: true, status: 'active', plano: targetPlan } });
      }
      return res.json({ success: true, data: { synced: true, status: sub.status } });
    } catch (err: any) {
      return res.status(502).json({ success: false, message: err?.message || 'Erro ao reconciliar com Asaas' });
    }
  }

  async criarCheckout(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Não autenticado' });
    const resolved = resolvePlanKey(typeof req.body?.plano === 'string' ? req.body.plano : '');
    if (!resolved) {
      return res.status(400).json({ success: false, message: 'Plano inválido. Use basic, pro ou master.' });
    }

    if (!asaasService.isConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'ASAAS_NOT_CONFIGURED',
        message: 'Integração com o Asaas não configurada no servidor (ASAAS_API_KEY).',
      });
    }

    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, nome: true, telefone: true } }),
      prisma.company.findFirst({ where: { userId: req.user.id }, select: { cnpj: true, razaoSocial: true } }),
    ]);

    if (!user?.email) {
      return res.status(400).json({ success: false, message: 'Usuário sem e-mail cadastrado.' });
    }

    const cpfCnpjRaw = String(req.body?.cpfCnpj || company?.cnpj || '').replace(/\D/g, '');
    if (cpfCnpjRaw.length !== 11 && cpfCnpjRaw.length !== 14) {
      return res.status(400).json({
        success: false,
        code: 'CPF_CNPJ_REQUIRED',
        message: 'Cadastre o CNPJ da sua empresa em Minha Empresa (ou informe CPF/CNPJ) para gerar a assinatura no Asaas.',
      });
    }

    const definition = getPlanDefinition(resolved);
    const appUrl = (process.env.FRONTEND_URL || 'https://expertise-licitatoria.vercel.app').trim().replace(/\/+$/, '');
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const pendingPeriodEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    try {
      const customer = await asaasService.findOrCreateCustomer({
        name: company?.razaoSocial || user.nome || user.email,
        email: user.email,
        cpfCnpj: cpfCnpjRaw,
        phone: user.telefone || undefined,
      });

      const subAsaas = await asaasService.createSubscription({
        customer: customer.id,
        value: definition.valorMensalCentavos / 100,
        description: `Expertise Licitatória — ${definition.nome}`,
        externalReference: `${req.user.id}:${resolved}`,
        nextDueDate: todayIso,
        successUrl: `${appUrl}/fornecedor/planos?status=sucesso`,
      });

      const checkoutUrl = await asaasService.getFirstPaymentUrl(subAsaas.id);
      if (!subAsaas?.id || !checkoutUrl) {
        return res.status(502).json({
          success: false,
          code: 'ASAAS_CHECKOUT_INVALID',
          message: 'Não foi possível gerar o link de pagamento no Asaas.',
        });
      }

      await prisma.subscription.upsert({
        where: { userId_categoria: { userId: req.user.id, categoria: 'plataforma' } },
        create: {
          userId: req.user.id,
          email: user.email,
          plano: 'free',
          planType: null,
          categoria: 'plataforma',
          status: 'trialing',
          periodoInicio: now,
          periodoFim: pendingPeriodEnd,
          pendingPlanId: resolved,
          pendingPlanAt: now,
          asaasCustomerId: customer.id,
          asaasSubscriptionId: subAsaas.id,
          asaasPlanCode: resolved,
        },
        update: {
          email: user.email,
          pendingPlanId: resolved,
          pendingPlanAt: now,
          asaasCustomerId: customer.id,
          asaasSubscriptionId: subAsaas.id,
          asaasPlanCode: resolved,
        },
      });

      return res.json({
        success: true,
        data: {
          url: checkoutUrl,
          subscriptionId: subAsaas.id,
          plano: resolved,
        },
      });
    } catch (error: any) {
      console.error('[Asaas] Erro ao criar checkout:', error?.response?.data || error.message);
      const isCfg = error instanceof AsaasConfigError;
      return res.status(isCfg ? 503 : 502).json({
        success: false,
        code: isCfg ? 'ASAAS_NOT_CONFIGURED' : 'ASAAS_UNAVAILABLE',
        message: isCfg
          ? 'Integração com o Asaas não configurada no servidor.'
          : 'Não foi possível iniciar a assinatura no Asaas no momento.',
      });
    }
  }

  async webhook(req: Request, res: Response) {
    try {
      asaasService.validateWebhookToken(req.headers['asaas-access-token']);
      const event = String(req.body?.event || '');
      const payment = req.body?.payment || {};
      const subscriptionObj = req.body?.subscription || {};
      const asaasSubId = String(payment.subscription || subscriptionObj.id || '').trim();
      const externalRef = String(payment.externalReference || subscriptionObj.externalReference || '').trim();

      if (!asaasSubId && !externalRef) {
        return res.status(200).json({ received: true, ignored: true });
      }

      const sub = asaasSubId
        ? await prisma.subscription.findFirst({ where: { asaasSubscriptionId: asaasSubId } })
        : null;

      if (!sub) {
        return res.status(200).json({ received: true, subscriptionNotFound: true });
      }

      const now = new Date();
      if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)) {
        const targetPlan = resolvePlanKey(sub.pendingPlanId || sub.plano) || 'pro';
        const nextEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            plano: targetPlan,
            planType: toPrismaPlanType(targetPlan),
            status: 'active',
            periodoInicio: now,
            periodoFim: nextEnd,
            pendingPlanId: null,
            pendingPlanAt: null,
          },
        });
        await prisma.user.update({
          where: { id: sub.userId },
          data: { plano: targetPlan, planType: toPrismaPlanType(targetPlan) },
        });
      } else if (event === 'PAYMENT_OVERDUE') {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
      } else if (['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'PAYMENT_REFUNDED'].includes(event)) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'canceled' } });
      }

      return res.status(200).json({ received: true, event });
    } catch (error: any) {
      if (error instanceof AsaasWebhookAuthError) {
        return res.status(401).json({ success: false, message: error.message });
      }
      console.error('[Asaas] Erro no webhook:', error?.message || error);
      return res.status(500).json({ success: false, message: 'Erro ao processar webhook Asaas.' });
    }
  }
}
