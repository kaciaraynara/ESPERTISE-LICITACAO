import { Request, Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import {
  InvalidWebhookSignatureError,
  Invoice,
  MercadoPagoConfig,
  PreApproval,
  WebhookSignatureValidator,
} from 'mercadopago';
import { getPlanDefinition, getPlanLimits, normalizePlanId, type PlanId } from '../services/plans/plan.constants';
import { isProduction } from '../config/env';

type MercadoPagoPlanId = Extract<PlanId, 'basic' | 'pro' | 'master'>;

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

  master: 'master',
  enterprise: 'master',
  avancado: 'master',
  avançado: 'master',
};

let _mpClient: MercadoPagoConfig | null = null;

function getMpClient() {
  if (!_mpClient) {
    const token = process.env.MP_ACCESS_TOKEN;

    if (!token) {
      throw new Error('MP_ACCESS_TOKEN nao configurado');
    }

    _mpClient = new MercadoPagoConfig({ accessToken: token });
  }

  return _mpClient;
}

function resolvePlanKey(input?: string | null): MercadoPagoPlanId | null {
  const normalized = normalizePlanId(input);
  if (normalized === 'basic' || normalized === 'pro' || normalized === 'master') {
    return normalized;
  }

  const alias = String(input || '').trim().toLowerCase();
  return ALIAS_PLANOS[alias] ?? null;
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
) {
  const planConfig = getMercadoPagoPlanConfig(planId);
  if (!planConfig.preapprovalPlanId) {
    throw new Error('MP_PLAN_NOT_CONFIGURED');
  }

  const returnedPlanId = asSingleString(preapproval?.preapproval_plan_id);
  if (returnedPlanId && returnedPlanId !== planConfig.preapprovalPlanId) {
    throw new Error('MP_PLAN_MISMATCH');
  }

  const amount = Number(preapproval?.auto_recurring?.transaction_amount);
  const currency = asSingleString(preapproval?.auto_recurring?.currency_id);
  if (!Number.isFinite(amount) || amount !== planConfig.valor || currency !== 'BRL') {
    throw new Error('MP_PLAN_AMOUNT_MISMATCH');
  }
}

function hasConfirmedCharge(preapproval: any, expectedAmount: number) {
  const quantity = Number(preapproval?.summarized?.charged_quantity);
  const chargedAmount = Number(preapproval?.summarized?.charged_amount);
  return Number.isFinite(quantity)
    && quantity > 0
    && Number.isFinite(chargedAmount)
    && chargedAmount >= expectedAmount;
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
          limites: getPlanLimits(planId),
          mercadoPagoConfigurado: Boolean(
            getMercadoPagoPlanConfig(planId).preapprovalPlanId,
          ),
        };
      }),
    });
  }

  async minhaAssinatura(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const sub = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        categoria: 'plataforma',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!sub) {
      return res.json({
        success: true,
        data: {
          plano: normalizePlanId(req.user.plano),
          status: 'none',
          ativa: false,
        },
      });
    }

    const plano = normalizePlanId(sub.plano);

    return res.json({
      success: true,
      data: {
        plano,
        nome: getPlanDefinition(plano).nome,
        status: sub.status,
        ativa: ['active', 'trialing'].includes(sub.status),
        mp_preapproval_id: sub.mpPreapprovalId,
        periodo_fim: sub.periodoFim.toISOString(),
      },
    });
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
    const backUrl = asSingleString(process.env.MP_BACK_URL);

    if (!planConfig.preapprovalPlanId) {
      return res.status(503).json({
        success: false,
        message: `Plano ${planConfig.nome} ainda não está configurado no Mercado Pago.`,
      });
    }
    if (!backUrl) {
      return res.status(503).json({
        success: false,
        message: 'A URL de retorno do Mercado Pago ainda não está configurada.',
      });
    }

    try {
      const client = getMpClient();
      const preapproval = new PreApproval(client);

      const response = await preapproval.create({
        body: {
          preapproval_plan_id: planConfig.preapprovalPlanId,
          payer_email: req.user.email,
          external_reference: `${req.user.id}:${resolved}`,
          back_url: backUrl,
          reason: `Assinatura EXPERTISE ${planConfig.nome}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: planConfig.valor,
            currency_id: 'BRL',
          },
        },
      });

      const url = (response as any).init_point
        || (!isProduction() ? (response as any).sandbox_init_point : null);

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
        },
      });
    } catch (error: any) {
      console.error('[MercadoPago] Erro ao criar checkout:', error.message);
      const configurationError = /^MP_ACCESS_TOKEN/.test(
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
      WebhookSignatureValidator.validate({
        xSignature,
        xRequestId,
        dataId,
        secret,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
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

      const client = getMpClient();
      let preapprovalId = dataId;
      let confirmedInvoice: any = null;

      if (type === 'subscription_authorized_payment') {
        confirmedInvoice = await new Invoice(client).get({ id: dataId });
        if (
          confirmedInvoice?.payment?.status !== 'approved'
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

      const signatureInfo: any = await new PreApproval(client).get({ id: preapprovalId });
      const externalReference = asSingleString(signatureInfo.external_reference);
      if (!externalReference) {
        throw new Error('MP_EXTERNAL_REFERENCE_MISSING');
      }

      const [userId, rawPlanId, ...unexpectedParts] = externalReference.split(':');
      const planId = resolvePlanKey(rawPlanId);
      if (!userId || !planId || unexpectedParts.length > 0) {
        throw new Error('MP_EXTERNAL_REFERENCE_INVALID');
      }

      assertExpectedPlanConfiguration(planId, signatureInfo);
      const planConfig = getMercadoPagoPlanConfig(planId);

      if (confirmedInvoice) {
        const invoiceAmount = Number(confirmedInvoice.transaction_amount);
        const invoiceCurrency = asSingleString(confirmedInvoice.currency_id);
        if (
          !Number.isFinite(invoiceAmount)
          || invoiceAmount !== planConfig.valor
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
        || hasConfirmedCharge(signatureInfo, planConfig.valor);
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
        const effectivePlan = isActive ? planId : 'free';

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { plano: effectivePlan },
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
              mpPlanId: planConfig.preapprovalPlanId,
              periodoInicio,
              periodoFim,
            },
            update: {
              plano: planId,
              status: subscriptionStatus,
              mpPreapprovalId: signatureInfo.id,
              mpPayerId: signatureInfo.payer_id?.toString(),
              mpPlanId: planConfig.preapprovalPlanId,
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
