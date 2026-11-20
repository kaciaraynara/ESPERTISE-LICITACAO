import type { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { asaasService, AsaasConfigError, AsaasWebhookAuthError } from '../services/asaas.service';
import { getPlanDefinition, getPlanLimits, normalizePlanId, type PlanId } from '../services/plans/plan.constants';
import { EXPERTISE_FISCAL_ADDON } from '../config/plan-features';

type AsaasPlanId = Extract<PlanId, 'basic' | 'pro' | 'master'>;
type BillingCycle = 'MONTHLY' | 'YEARLY';

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
const ANUAL_MULTIPLIER = 9.6; // 12 meses com 20% de desconto no anual
const TRIAL_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

function resolvePlanKey(input?: string | null): AsaasPlanId | null {
  const key = String(input || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ALIAS_PLANOS[key] || null;
}

function resolveCycle(input?: string | null): BillingCycle {
  const raw = String(input || '').trim().toUpperCase();
  return raw === 'YEARLY' || raw === 'ANUAL' ? 'YEARLY' : 'MONTHLY';
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
        const valorMensal = definition.valorMensalCentavos / 100;
        const valorAnualCentavos = Math.round(definition.valorMensalCentavos * ANUAL_MULTIPLIER);
        return {
          id: definition.id,
          nome: definition.nome,
          descricao: definition.descricao,
          valor: valorMensal,
          valorCentavos: definition.valorMensalCentavos,
          valorAnual: valorAnualCentavos / 100,
          valorAnualCentavos,
          descontoAnualPercent: 20,
          destaque: definition.id === 'pro',
          features: definition.features,
          limites: getPlanLimits(planId),
          asaasConfigurado: configured,
        };
      }),
      addons: [
        {
          id: EXPERTISE_FISCAL_ADDON.slug,
          nome: EXPERTISE_FISCAL_ADDON.nome,
          descricao: EXPERTISE_FISCAL_ADDON.descricao,
          valor: EXPERTISE_FISCAL_ADDON.priceCents / 100,
          valorCentavos: EXPERTISE_FISCAL_ADDON.priceCents,
          valorAnual: Math.round(EXPERTISE_FISCAL_ADDON.priceCents * ANUAL_MULTIPLIER) / 100,
          valorAnualCentavos: Math.round(EXPERTISE_FISCAL_ADDON.priceCents * ANUAL_MULTIPLIER),
          descontoAnualPercent: 20,
          features: EXPERTISE_FISCAL_ADDON.features,
          asaasConfigurado: configured,
        },
      ],
    });
  }

  async minhaAssinatura(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Não autenticado' });
    const now = new Date();

    const [sub, dbUser, activeAddons] = await Promise.all([
      prisma.subscription.findFirst({
        where: { userId: req.user.id, categoria: 'plataforma' },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { trialEndsAt: true, createdAt: true },
      }),
      prisma.companyAddonSubscription.findMany({
        where: {
          company: { userId: req.user.id },
          status: { in: ['ACTIVE', 'TRIAL'] },
        },
        select: { addonSlug: true, status: true, expiresAt: true },
      }),
    ]);

    const addonsAtivos = activeAddons
      .filter((a) => !a.expiresAt || new Date(a.expiresAt) > now)
      .map((a) => a.addonSlug);
    const addonFeatures = addonsAtivos.includes('expertise_fiscal') ? [...EXPERTISE_FISCAL_ADDON.features] : [];

    const effectiveTrialEndsAt =
      dbUser?.trialEndsAt ??
      (dbUser?.createdAt ? new Date(new Date(dbUser.createdAt).getTime() + TRIAL_DAYS_MS) : null);
    const isUserTrialActive = Boolean(effectiveTrialEndsAt && new Date(effectiveTrialEndsAt) > now);

    if (!sub) {
      if (isUserTrialActive && effectiveTrialEndsAt) {
        const masterDef = getPlanDefinition('master');
        return res.json({
          success: true,
          data: {
            plano: 'master',
            nome: 'Master (Teste 10 Dias)',
            features: Array.from(new Set([...masterDef.features, ...addonFeatures])),
            addonsAtivos,
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
          features: addonFeatures,
          addonsAtivos,
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
        features: Array.from(new Set([...getPlanDefinition(plano).features, ...addonFeatures])),
        addonsAtivos,
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
    const fim = new Date(now.getTime() + TRIAL_DAYS_MS);
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
        const isYearly = String(sub.asaasPlanCode || '').includes('YEARLY');
        const now = new Date();
        const nextEnd = new Date(now.getTime() + (isYearly ? 366 : 31) * 24 * 60 * 60 * 1000);
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

    const rawPlano = String(req.body?.plano || '').trim().toLowerCase();
    const isFiscalAddon = rawPlano === 'expertise_fiscal' || rawPlano === 'expertise_fiscal_addon';
    const resolved = isFiscalAddon ? null : resolvePlanKey(rawPlano);
    const ciclo = resolveCycle(req.body?.ciclo || req.body?.cycle);
    const rawBilling = String(req.body?.billingType || req.body?.formaPagamento || 'PIX').trim().toUpperCase();
    const billingType: 'PIX' | 'CREDIT_CARD' = rawBilling === 'CREDIT_CARD' || rawBilling === 'CARTAO' ? 'CREDIT_CARD' : 'PIX';

    if (!isFiscalAddon && !resolved) {
      return res.status(400).json({ success: false, message: 'Plano inválido. Use basic, pro, master ou expertise_fiscal.' });
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
      prisma.company.findFirst({ where: { userId: req.user.id }, select: { id: true, tenantId: true, cnpj: true, razaoSocial: true } }),
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

    const appUrl = (process.env.FRONTEND_URL || 'https://expertise-licitatoria.vercel.app').trim().replace(/\/+$/, '');
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const pendingPeriodEnd = new Date(now.getTime() + TRIAL_DAYS_MS);

    try {
      const customer = await asaasService.findOrCreateCustomer({
        name: company?.razaoSocial || user.nome || user.email,
        email: user.email,
        cpfCnpj: cpfCnpjRaw,
        phone: user.telefone || undefined,
      });

      if (isFiscalAddon) {
        const valor =
          ciclo === 'YEARLY'
            ? Math.round(EXPERTISE_FISCAL_ADDON.priceCents * ANUAL_MULTIPLIER) / 100
            : EXPERTISE_FISCAL_ADDON.priceCents / 100;
        const companyId = company?.id || '';
        const extRef = `addon:${req.user.id}:${companyId}:expertise_fiscal:${ciclo}`;

        const subAsaas = await asaasService.createSubscription({
          customer: customer.id,
          value: valor,
          cycle: ciclo,
          billingType,
          description: `Add-on Expertise Fiscal (${ciclo === 'YEARLY' ? 'Anual 20% OFF' : 'Mensal'})`,
          externalReference: extRef,
          nextDueDate: todayIso,
          successUrl: `${appUrl}/fornecedor/planos?status=sucesso&addon=expertise_fiscal`,
        });

        const checkoutUrl = await asaasService.getFirstPaymentUrl(subAsaas.id);
        if (!subAsaas?.id || !checkoutUrl) {
          return res.status(502).json({ success: false, message: 'Não foi possível gerar o link do Add-on Fiscal no Asaas.' });
        }

        return res.json({
          success: true,
          data: { url: checkoutUrl, subscriptionId: subAsaas.id, plano: 'expertise_fiscal', ciclo },
        });
      }

      const definition = getPlanDefinition(resolved!);
      const valor =
        ciclo === 'YEARLY'
          ? Math.round(definition.valorMensalCentavos * ANUAL_MULTIPLIER) / 100
          : definition.valorMensalCentavos / 100;

      const subAsaas = await asaasService.createSubscription({
        customer: customer.id,
        value: valor,
        cycle: ciclo,
          billingType,
        description: `Expertise Licitatória — ${definition.nome} (${ciclo === 'YEARLY' ? 'Anual 20% OFF' : 'Mensal'})`,
        externalReference: `${req.user.id}:${resolved}:${ciclo}`,
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
          pendingPlanId: resolved!,
          pendingPlanAt: now,
          asaasCustomerId: customer.id,
          asaasSubscriptionId: subAsaas.id,
          asaasPlanCode: `${resolved}:${ciclo}`,
        },
        update: {
          email: user.email,
          pendingPlanId: resolved!,
          pendingPlanAt: now,
          asaasCustomerId: customer.id,
          asaasSubscriptionId: subAsaas.id,
          asaasPlanCode: `${resolved}:${ciclo}`,
        },
      });

      return res.json({
        success: true,
        data: { url: checkoutUrl, subscriptionId: subAsaas.id, plano: resolved, ciclo },
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
      const now = new Date();

      if (externalRef.startsWith('addon:')) {
        const [, refUserId, refCompanyId, addonSlug, refCiclo] = externalRef.split(':');
        const targetCompany = refCompanyId
          ? await prisma.company.findUnique({ where: { id: refCompanyId }, select: { id: true, tenantId: true } })
          : await prisma.company.findFirst({ where: { userId: refUserId }, select: { id: true, tenantId: true } });

        if (targetCompany) {
          const isYearly = refCiclo === 'YEARLY';
          const expiresAt = new Date(now.getTime() + (isYearly ? 366 : 31) * 24 * 60 * 60 * 1000);
          if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)) {
            await prisma.companyAddonSubscription.upsert({
              where: { companyId_addonSlug: { companyId: targetCompany.id, addonSlug: addonSlug || 'expertise_fiscal' } },
              create: {
                tenantId: targetCompany.tenantId,
                companyId: targetCompany.id,
                addonSlug: addonSlug || 'expertise_fiscal',
                status: 'ACTIVE',
                priceCents: EXPERTISE_FISCAL_ADDON.priceCents,
                activatedAt: now,
                expiresAt,
              },
              update: { status: 'ACTIVE', activatedAt: now, expiresAt },
            });
          } else if (['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'PAYMENT_REFUNDED'].includes(event)) {
            await prisma.companyAddonSubscription.updateMany({
              where: { companyId: targetCompany.id, addonSlug: addonSlug || 'expertise_fiscal' },
              data: { status: 'CANCELED' },
            });
          }
        }
        return res.status(200).json({ received: true, event, addon: true });
      }

      if (!asaasSubId && !externalRef) {
        return res.status(200).json({ received: true, ignored: true });
      }

      const sub = asaasSubId
        ? await prisma.subscription.findFirst({ where: { asaasSubscriptionId: asaasSubId } })
        : null;

      if (!sub) {
        return res.status(200).json({ received: true, subscriptionNotFound: true });
      }

      if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)) {
        const targetPlan = resolvePlanKey(sub.pendingPlanId || sub.plano) || 'pro';
        const isYearly = String(sub.asaasPlanCode || externalRef).includes('YEARLY');
        const nextEnd = new Date(now.getTime() + (isYearly ? 366 : 31) * 24 * 60 * 60 * 1000);
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
