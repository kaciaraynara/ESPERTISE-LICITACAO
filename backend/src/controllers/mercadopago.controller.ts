import { Request, Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { getPlanDefinition, getPlanLimits, normalizePlanId, type PlanId } from '../services/plans/plan.constants';
import { mercadoPagoService } from '../services/mercadopago.service';
import { isProduction } from '../config/env';

type MercadoPagoPlanId = Extract<PlanId, 'basic' | 'pro' | 'master'>;

const EXPERTISE_FISCAL_ADDON_VALOR = 99.99;
const GRACE_PERIOD_MS = 10 * 24 * 60 * 60 * 1000;

function getMercadoPagoPlanConfig(planId: MercadoPagoPlanId) {
  const definition = getPlanDefinition(planId);
  const envKeys: Record<MercadoPagoPlanId, string[]> = {
    basic: ['MP_PLAN_BASIC', 'MP_PLAN_STARTER'],
    pro: ['MP_PLAN_PRO'],
    master: ['MP_PLAN_MASTER', 'MP_PLAN_ENTERPRISE'],
  };
  const preapprovalPlanId = envKeys[planId]
    .map((key) => process.env[key])
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim() || '';

  return {
    preapprovalPlanId,
    nome: definition.nome,
    valor: definition.valorMensalCentavos / 100,
  };
}

const ALIAS_PLANOS: Record<string, MercadoPagoPlanId> = {
  basic: 'basic',
  basico: 'basic',
  básico: 'basic',
  starter: 'basic',
  essencial: 'basic',

  pro: 'pro',
  profissional: 'pro',
  premium: 'pro',
  avancado: 'pro',
  avançado: 'pro',

  master: 'master',
  enterprise: 'master',
};

function resolvePlanKey(input?: string | null): MercadoPagoPlanId | null {
  const normalized = normalizePlanId(input);
  if (normalized === 'basic' || normalized === 'pro' || normalized === 'master') {
    return normalized;
  }

  const alias = String(input || '').trim().toLowerCase();
  return ALIAS_PLANOS[alias] ?? null;
}

function getPlanType(planId: PlanId): 'BASIC' | 'MEDIUM' | 'MASTER' {
  if (planId === 'master') return 'MASTER';
  if (planId === 'pro') return 'MEDIUM';
  return 'BASIC';
}

function asSingleString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }

  return null;
}

function parseRequiredDate(value: unknown, field: string): Date {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw new Error(`MP_${field.toUpperCase()}_INVALID`);
  }
  return parsed;
}

function assertExpectedPlanConfiguration(
  planId: MercadoPagoPlanId,
  preapproval: any,
  expectedAmount?: number,
) {
  const planConfig = getMercadoPagoPlanConfig(planId);
  const returnedPlanId = asSingleString(preapproval?.preapproval_plan_id);

  if (planConfig.preapprovalPlanId && returnedPlanId && returnedPlanId !== planConfig.preapprovalPlanId) {
    throw new Error('MP_PLAN_MISMATCH');
  }

  const targetAmount = expectedAmount ?? planConfig.valor;
  const amount = Number(preapproval?.auto_recurring?.transaction_amount);
  const currency = asSingleString(preapproval?.auto_recurring?.currency_id);
  if (!Number.isFinite(amount) || Math.abs(amount - targetAmount) > 0.01 || currency !== 'BRL') {
    throw new Error('MP_PLAN_AMOUNT_MISMATCH');
  }
}

function hasConfirmedCharge(preapproval: any, expectedAmount: number) {
  const quantity = Number(preapproval?.summarized?.charged_quantity);
  const chargedAmount = Number(preapproval?.summarized?.charged_amount);
  return Number.isFinite(quantity)
    && quantity > 0
    && Number.isFinite(chargedAmount)
    && chargedAmount + 0.01 >= expectedAmount;
}

export class MercadoPagoController {
  async listPlanos(req: Request, res: Response) {
    const planIds: MercadoPagoPlanId[] = ['basic', 'pro', 'master'];

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
          mercadoPagoConfigurado: Boolean(process.env.MP_ACCESS_TOKEN?.trim()),
        };
      }),
    });
  }

  async minhaAssinatura(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const now = new Date();

    const [sub, dbUser] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          userId: req.user.id,
          categoria: 'plataforma',
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { trialEndsAt: true, createdAt: true },
      }),
    ]);

    const effectiveTrialEndsAt =
      dbUser?.trialEndsAt ??
      (dbUser?.createdAt
        ? new Date(new Date(dbUser.createdAt).getTime() + 15 * 24 * 60 * 60 * 1000)
        : null);
    const isUserTrialActive = Boolean(effectiveTrialEndsAt && new Date(effectiveTrialEndsAt) > now);

    if (!sub) {
      if (isUserTrialActive && effectiveTrialEndsAt) {
        const trialEndsAt = effectiveTrialEndsAt;
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
            trialEndsAt: new Date(trialEndsAt).toISOString(),
            diasRestantes: Math.max(1, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
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

    const fimComCarencia = sub.periodoFim
      ? new Date(new Date(sub.periodoFim).getTime() + GRACE_PERIOD_MS)
      : null;
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
        gateway: isAtiva && sub.mpPreapprovalId ? 'mercado_pago' : null,
        mp_preapproval_id: sub.mpPreapprovalId,
        periodo_fim: sub.periodoFim?.toISOString() ?? dbUser?.trialEndsAt?.toISOString() ?? null,
        pendingPlanId: sub.pendingPlanId,
        pendingPlanAt: sub.pendingPlanAt?.toISOString() ?? null,
      },
    });
  }

  async ativarTrial(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const userId = req.user.id;

    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        categoria: 'plataforma',
      },
    });

    if (existingSubscription) {
      return res.status(409).json({
        success: false,
        code: 'TRIAL_ALREADY_USED',
        message: 'Esta conta já utilizou o período de testes ou possui assinatura registrada.',
      });
    }

    const userCompany = await prisma.company.findFirst({
      where: { userId },
      select: { cnpj: true },
    });

    if (userCompany?.cnpj) {
      const companySubscriptions = await prisma.subscription.findFirst({
        where: {
          categoria: 'plataforma',
          user: {
            companies: {
              some: {
                cnpj: userCompany.cnpj,
              },
            },
          },
        },
      });

      if (companySubscriptions) {
        return res.status(409).json({
          success: false,
          code: 'TRIAL_CNPJ_ALREADY_USED',
          message: 'O CNPJ desta empresa já usufruiu do período de testes gratuito.',
        });
      }
    }

    const now = new Date();
    const TRIAL_DURATION_DAYS = 7;
    const periodoFim = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { plano: 'pro', planType: 'MEDIUM' },
      });

      await tx.subscription.create({
        data: {
          userId,
          email: req.user!.email,
          plano: 'pro',
          categoria: 'plataforma',
          status: 'trialing',
          periodoInicio: now,
          periodoFim,
        },
      });
    });

    return res.status(201).json({
      success: true,
      data: {
        plano: 'pro',
        status: 'trialing',
        dias: TRIAL_DURATION_DAYS,
        periodoInicio: now.toISOString(),
        periodoFim: periodoFim.toISOString(),
      },
    });
  }

  async reconciliarAssinatura(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const sub = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        categoria: 'plataforma',
      },
    });

    if (!sub || !sub.mpPreapprovalId) {
      return res.status(404).json({
        success: false,
        code: 'NO_ACTIVE_MP_SUBSCRIPTION',
        message: 'Nenhuma assinatura do Mercado Pago encontrada para reconciliação.',
      });
    }

    try {
      const signatureInfo: any = await mercadoPagoService.getSubscription(sub.mpPreapprovalId);

      const mpStatus = asSingleString(signatureInfo.status);
      const planConfig = getMercadoPagoPlanConfig(resolvePlanKey(sub.plano) || 'pro');
      const paymentConfirmed = hasConfirmedCharge(signatureInfo, planConfig.valor);

      const isActive = mpStatus === 'authorized' && paymentConfirmed;
      const isCanceled = mpStatus === 'cancelled';
      const isPastDue = mpStatus === 'paused';

      const newStatus = isActive ? 'active' : isCanceled ? 'canceled' : isPastDue ? 'past_due' : sub.status;
      const fimBase = sub.periodoFim ? new Date(sub.periodoFim).getTime() : Date.now();
      const dentroCarencia = Date.now() <= fimBase + GRACE_PERIOD_MS;
      const effectivePlan: PlanId = isActive || (isPastDue && dentroCarencia)
        ? normalizePlanId(sub.plano)
        : 'free';

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: req.user!.id },
          data: { plano: effectivePlan, planType: getPlanType(effectivePlan) },
        });

        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: newStatus as any,
            periodoFim: signatureInfo.next_payment_date ? new Date(signatureInfo.next_payment_date) : sub.periodoFim,
          },
        });
      });

      return res.json({
        success: true,
        data: {
          reconciliado: true,
          status: newStatus,
          plano: effectivePlan,
        },
      });
    } catch (error: any) {
      console.error('[MercadoPago] Erro na reconciliação:', error.message);
      return res.status(502).json({
        success: false,
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Não foi possível consultar o Mercado Pago para reconciliar a assinatura.',
      });
    }
  }

  async criarCheckoutAutenticado(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const resolved = resolvePlanKey(req.body.plano);

    if (!resolved) {
      return res.status(400).json({ success: false, message: 'Plano inválido' });
    }

    const planConfig = getMercadoPagoPlanConfig(resolved);
    const configuredBackUrl = asSingleString(process.env.MP_BACK_URL);
    const fallbackOrigin = asSingleString(process.env.FRONTEND_URL) || 'https://expertiselicitatoria.com.br';
    const effectiveBackUrl = configuredBackUrl || `${fallbackOrigin}/fornecedor/planos`;

    try {
      const backUrl = new URL(effectiveBackUrl);
      backUrl.searchParams.set('status', 'success');

      const includeAddonFiscal = Boolean(
        req.body?.incluirExpertiseFiscal || req.body?.addon === 'expertise_fiscal',
      );
      const valorFinalMensal = Number(
        (planConfig.valor + (includeAddonFiscal ? EXPERTISE_FISCAL_ADDON_VALOR : 0)).toFixed(2),
      );
      const externalRef = includeAddonFiscal
        ? `${req.user.id}:${resolved}:expertise_fiscal`
        : `${req.user.id}:${resolved}`;

      const subscriptionPayload: any = {
        payer_email: req.user.email,
        external_reference: externalRef,
        back_url: backUrl.toString(),
        reason: includeAddonFiscal
          ? `Assinatura EXPERTISE ${planConfig.nome} + Add-on Expertise Fiscal`
          : `Assinatura EXPERTISE ${planConfig.nome}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valorFinalMensal,
          currency_id: 'BRL',
        },
      };

      if (planConfig.preapprovalPlanId && !includeAddonFiscal) {
        subscriptionPayload.preapproval_plan_id = planConfig.preapprovalPlanId;
      }

      const response = await mercadoPagoService.createSubscription(subscriptionPayload);

      const checkout = response as unknown as {
        init_point?: string;
        sandbox_init_point?: string;
      };
      const url = checkout.init_point
        || (!isProduction() ? checkout.sandbox_init_point : null);

      if (!url) {
        return res.status(502).json({
          success: false,
          message: 'Mercado Pago não retornou URL de checkout.',
        });
      }

      return res.json({
        success: true,
        data: {
          url,
          plano: resolved,
          valorMensal: valorFinalMensal,
        },
      });
    } catch (error: any) {
      console.error('[MercadoPago] Erro ao criar checkout:', error.message);
      const configurationError = /^(MP_ACCESS_TOKEN|Invalid URL)/.test(
        String(error?.message ?? ''),
      );

      return res.status(configurationError ? 503 : 502).json({
        success: false,
        code: configurationError
          ? 'MERCADO_PAGO_NOT_CONFIGURED'
          : 'MERCADO_PAGO_UNAVAILABLE',
        message: configurationError
          ? 'Mercado Pago não configurado.'
          : 'Falha ao conectar com Mercado Pago.',
      });
    }
  }

  async criarCheckout(req: AuthRequest, res: Response) {
    return this.criarCheckoutAutenticado(req, res);
  }

  async webhook(req: Request, res: Response) {
    const secret = asSingleString(process.env.MP_WEBHOOK_SECRET);
    if (!secret) {
      return res.status(503).json({
        success: false,
        message: 'Webhook do Mercado Pago não configurado.',
      });
    }

    const xSignature = asSingleString(req.headers['x-signature']);
    const xRequestId = asSingleString(req.headers['x-request-id']);
    const queryDataId = asSingleString(req.query['data.id']);
    const bodyDataId = asSingleString(req.body?.data?.id);
    const dataId = queryDataId || bodyDataId;

    if (!xSignature || !xRequestId || !dataId) {
      return res.status(400).json({
        success: false,
        message: 'Notificação do Mercado Pago incompleta.',
      });
    }

    try {
      mercadoPagoService.validateWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
        secret,
      });
    } catch (error) {
      if (mercadoPagoService.isInvalidWebhookSignature(error)) {
        return res.status(401).json({
          success: false,
          message: 'Assinatura do webhook inválida.',
        });
      }

      console.error('[MercadoPago] Falha ao validar assinatura:', error);
      return res.status(401).json({
        success: false,
        message: 'Não foi possível validar a origem da notificação.',
      });
    }

    const type = asSingleString(req.body?.type);
    const eventId = asSingleString(req.body?.id) || xRequestId;
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Tipo da notificação não informado.',
      });
    }

    const event = await prisma.mercadoPagoWebhookEvent.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        type,
        status: 'processing',
      },
      update: {
        attempts: { increment: 1 },
      },
    });

    if (event.status === 'processed') {
      return res.status(200).send('OK');
    }

    try {
      if (
        type !== 'subscription_preapproval'
        && type !== 'subscription_authorized_payment'
      ) {
        await prisma.mercadoPagoWebhookEvent.update({
          where: { id: eventId },
          data: {
            status: 'processed',
            processedAt: new Date(),
            lastError: null,
          },
        });
        return res.status(200).send('OK');
      }

      let preapprovalId = dataId;
      let confirmedInvoice: any = null;

      if (type === 'subscription_authorized_payment') {
        confirmedInvoice = await mercadoPagoService.getAuthorizedPayment(dataId);
        const paymentStatus = confirmedInvoice?.payment?.status;

        if (paymentStatus === 'refunded' || paymentStatus === 'charged_back') {
          preapprovalId = asSingleString(confirmedInvoice.preapproval_id) || '';
          if (preapprovalId) {
            const sub = await prisma.subscription.findFirst({
              where: { mpPreapprovalId: preapprovalId, categoria: 'plataforma' },
            });
            if (sub) {
              await prisma.$transaction(async (tx) => {
                await tx.user.update({
                  where: { id: sub.userId },
                  data: { plano: 'free', planType: 'BASIC' },
                });
                await tx.subscription.update({
                  where: { id: sub.id },
                  data: { status: 'canceled' },
                });
              });
            }
          }

          await prisma.mercadoPagoWebhookEvent.update({
            where: { id: eventId },
            data: {
              status: 'processed',
              processedAt: new Date(),
              lastError: null,
            },
          });
          return res.status(200).send('OK');
        }

        if (
          paymentStatus !== 'approved'
          || confirmedInvoice?.status !== 'processed'
        ) {
          await prisma.mercadoPagoWebhookEvent.update({
            where: { id: eventId },
            data: {
              status: 'processed',
              processedAt: new Date(),
              lastError: null,
            },
          });
          return res.status(200).send('OK');
        }
        preapprovalId = asSingleString(confirmedInvoice.preapproval_id) || '';
        if (!preapprovalId) {
          throw new Error('MP_PREAPPROVAL_ID_MISSING');
        }
      }

      const signatureInfo: any = await mercadoPagoService.getSubscription(preapprovalId);
      const externalReference = asSingleString(signatureInfo.external_reference);
      if (!externalReference) {
        throw new Error('MP_EXTERNAL_REFERENCE_MISSING');
      }

      const [userId, rawPlanId, addonPart, ...unexpectedParts] = externalReference.split(':');
      const planId = resolvePlanKey(rawPlanId);
      const hasFiscalAddon = addonPart === 'expertise_fiscal';
      if (!userId || !planId || (addonPart && !hasFiscalAddon) || unexpectedParts.length > 0) {
        throw new Error('MP_EXTERNAL_REFERENCE_INVALID');
      }

      const planConfig = getMercadoPagoPlanConfig(planId);
      const expectedValor = Number(
        (planConfig.valor + (hasFiscalAddon ? EXPERTISE_FISCAL_ADDON_VALOR : 0)).toFixed(2),
      );
      assertExpectedPlanConfiguration(planId, signatureInfo, expectedValor);

      if (confirmedInvoice) {
        const invoiceAmount = Number(confirmedInvoice.transaction_amount);
        const invoiceCurrency = asSingleString(confirmedInvoice.currency_id);
        if (
          !Number.isFinite(invoiceAmount)
          || Math.abs(invoiceAmount - expectedValor) > 0.01
          || invoiceCurrency !== 'BRL'
        ) {
          throw new Error('MP_INVOICE_AMOUNT_MISMATCH');
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (!user) {
        throw new Error('MP_USER_NOT_FOUND');
      }

      const mercadoPagoStatus = asSingleString(signatureInfo.status);
      const paymentConfirmed = Boolean(confirmedInvoice)
        || hasConfirmedCharge(signatureInfo, expectedValor);
      const isActive = mercadoPagoStatus === 'authorized' && paymentConfirmed;
      const isCanceled = mercadoPagoStatus === 'cancelled';
      const isPastDue = mercadoPagoStatus === 'paused';

      if (isActive || isCanceled || isPastDue) {
        const periodoInicio = parseRequiredDate(
          signatureInfo.date_created,
          'period_start',
        );
        const periodoFim = isActive
          ? parseRequiredDate(signatureInfo.next_payment_date, 'period_end')
          : parseRequiredDate(
              signatureInfo.last_modified || signatureInfo.date_created,
              'period_end',
            );
        const subscriptionStatus = isActive
          ? 'active'
          : isCanceled
            ? 'canceled'
            : 'past_due';
        const effectivePlan = isActive || isPastDue ? planId : 'free';

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { plano: effectivePlan, planType: getPlanType(effectivePlan) },
          });

          await tx.subscription.upsert({
            where: {
              userId_categoria: {
                userId,
                categoria: 'plataforma',
              },
            },
            create: {
              userId,
              email: user.email,
              plano: planId,
              status: subscriptionStatus,
              mpPreapprovalId: signatureInfo.id,
              mpPayerId: signatureInfo.payer_id?.toString(),
              mpPlanId: planConfig.preapprovalPlanId || null,
              periodoInicio,
              periodoFim,
            },
            update: {
              plano: planId,
              status: subscriptionStatus,
              mpPreapprovalId: signatureInfo.id,
              mpPayerId: signatureInfo.payer_id?.toString(),
              mpPlanId: planConfig.preapprovalPlanId || null,
              periodoInicio,
              periodoFim,
            },
          });
        });
      }

      await prisma.mercadoPagoWebhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'processed',
          processedAt: new Date(),
          lastError: null,
        },
      });

      return res.status(200).send('OK');
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[MercadoPago] Erro ao processar webhook:', message);

      await prisma.mercadoPagoWebhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'failed',
          lastError: message.slice(0, 500),
        },
      }).catch((eventError) => {
        console.error('[MercadoPago] Falha ao registrar erro do webhook:', eventError);
      });

      const configurationError = /^MP_(ACCESS_TOKEN|PLAN_NOT_CONFIGURED)/.test(message);
      return res.status(configurationError ? 503 : 502).json({
        success: false,
        message: configurationError
          ? 'Integração do Mercado Pago não configurada.'
          : 'Não foi possível confirmar a assinatura com o Mercado Pago.',
      });
    }
  }
}