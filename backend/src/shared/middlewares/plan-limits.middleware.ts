import { Response, NextFunction } from 'express';
import { PlanType } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AuthRequest } from './auth.middleware';
import {
  PLAN_FEATURES_CONFIG,
  getCommercialPlanConfig,
  getMinimumCommercialPlanForFeature,
  hasCommercialPlanFeature,
  type PlanFeatureName,
} from '../../config/plan-features';

export interface PlanLimits {
  maxCnpjs: number;
  maxMonthlyAnalyses: number;
  maxMonthlyProposals: number;
  features: readonly string[];
}

/**
 * Matriz de limites contratuais por plano (Básico, Avançado/Médio e Master)
 * Derivada diretamente da fonte única da verdade em src/config/plan-features.ts
 */
export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  BASIC: {
    maxCnpjs: PLAN_FEATURES_CONFIG.BASICO.limits.maxCnpjs,
    maxMonthlyAnalyses: PLAN_FEATURES_CONFIG.BASICO.limits.maxMonthlyAnalyses,
    maxMonthlyProposals: PLAN_FEATURES_CONFIG.BASICO.limits.maxMonthlyProposals,
    features: PLAN_FEATURES_CONFIG.BASICO.features,
  },
  MEDIUM: {
    maxCnpjs: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxCnpjs,
    maxMonthlyAnalyses: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxMonthlyAnalyses,
    maxMonthlyProposals: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxMonthlyProposals,
    features: PLAN_FEATURES_CONFIG.AVANCADO.features,
  },
  MASTER: {
    maxCnpjs: PLAN_FEATURES_CONFIG.MASTER.limits.maxCnpjs,
    maxMonthlyAnalyses: PLAN_FEATURES_CONFIG.MASTER.limits.maxMonthlyAnalyses,
    maxMonthlyProposals: PLAN_FEATURES_CONFIG.MASTER.limits.maxMonthlyProposals,
    features: PLAN_FEATURES_CONFIG.MASTER.features,
  },
};

/**
 * Normaliza qualquer nomenclatura legada de plano para o Enum oficial PlanType
 */
export function normalizePlanType(rawPlan?: string | null): PlanType {
  if (!rawPlan) return PlanType.BASIC;
  const p = rawPlan
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (p === 'MASTER' || p === 'ENTERPRISE') return PlanType.MASTER;
  if (
    p === 'MEDIUM' ||
    p === 'MEDIO' ||
    p === 'AVANCADO' ||
    p === 'PRO' ||
    p === 'PROFESSIONAL' ||
    p === 'PROFISSIONAL'
  ) {
    return PlanType.MEDIUM;
  }
  return PlanType.BASIC;
}

export type TrackedResource = 'analyses' | 'proposals' | 'cnpjs';

/**
 * Middleware que intercepta rotas de Análise, Propostas e CNPJs
 * validando se o consumo mensal do usuário ultrapassou a franquia do plano contratado.
 */
export function requirePlanLimit(resource: TrackedResource) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || (req as any).userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Usuário não autenticado.',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tenantId: true,
          planType: true,
          plano: true,
          trialEndsAt: true,
          createdAt: true,
          monthlyAnalysesUsed: true,
          monthlyProposalsUsed: true,
          subscriptions: {
            where: {
              categoria: 'plataforma',
              status: { in: ['active', 'trialing'] },
            },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { plano: true, periodoFim: true },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não localizado no sistema.',
        });
      }

      const now = new Date();
      const effectiveTrialEndsAt =
        user.trialEndsAt ??
        (user.createdAt
          ? new Date(new Date(user.createdAt).getTime() + 15 * 24 * 60 * 60 * 1000)
          : null);
      const isTrialActive = Boolean(effectiveTrialEndsAt && new Date(effectiveTrialEndsAt) > now);

      const activeSubscription = user.subscriptions[0];
      const hasActiveSubscription =
        isTrialActive ||
        Boolean(
          activeSubscription &&
          (!activeSubscription.periodoFim || activeSubscription.periodoFim >= now),
        );

      if (!hasActiveSubscription) {
        return res.status(403).json({
          success: false,
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'Assine um plano para utilizar esta ferramenta.',
          details: { resource, currentPlan: 'free' },
        });
      }

      const planType = isTrialActive
        ? PlanType.MASTER
        : normalizePlanType(activeSubscription?.plano);
      const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.BASIC;

      if (resource === 'analyses') {
        if (Number.isFinite(limits.maxMonthlyAnalyses) && user.monthlyAnalysesUsed >= limits.maxMonthlyAnalyses) {
          return res.status(403).json({
            success: false,
            message: 'Limite do plano atingido. Faça upgrade para continuar.',
            code: 'PLAN_LIMIT_REACHED',
            details: {
              resource: 'analyses',
              planType,
              used: user.monthlyAnalysesUsed,
              limit: limits.maxMonthlyAnalyses,
            },
          });
        }
      } else if (resource === 'proposals') {
        if (Number.isFinite(limits.maxMonthlyProposals) && user.monthlyProposalsUsed >= limits.maxMonthlyProposals) {
          return res.status(403).json({
            success: false,
            message: 'Limite do plano atingido. Faça upgrade para continuar.',
            code: 'PLAN_LIMIT_REACHED',
            details: {
              resource: 'proposals',
              planType,
              used: user.monthlyProposalsUsed,
              limit: limits.maxMonthlyProposals,
            },
          });
        }
      } else if (resource === 'cnpjs') {
        const currentCnpjs = await prisma.company.count({
          where: { tenantId: user.tenantId },
        });
        if (Number.isFinite(limits.maxCnpjs) && currentCnpjs >= limits.maxCnpjs) {
          return res.status(403).json({
            success: false,
            message: `Você atingiu o limite de ${limits.maxCnpjs} empresas do seu plano. Faça upgrade para cadastrar novos CNPJs.`,
            code: 'COMPANY_LIMIT_REACHED',
            details: {
              resource: 'cnpjs',
              planType,
              used: currentCnpjs,
              limit: limits.maxCnpjs,
            },
          });
        }
      }

      return next();
    } catch (error) {
      console.error('[PlanLimitsMiddleware] Erro ao validar limites de plano:', error);
      return next(error);
    }
  };
}

/**
 * Incrementa o contador de uso do recurso para o usuário após a ação com sucesso
 */
export async function incrementPlanUsage(
  userId: string,
  resource: TrackedResource,
  amount = 1,
) {
  try {
    if (resource === 'analyses') {
      return await prisma.user.update({
        where: { id: userId },
        data: { monthlyAnalysesUsed: { increment: amount } },
      });
    }

    if (resource === 'proposals') {
      return await prisma.user.update({
        where: { id: userId },
        data: { monthlyProposalsUsed: { increment: amount } },
      });
    }

    if (resource === 'cnpjs') {
      return await prisma.user.update({
        where: { id: userId },
        data: { cnpjsRegistered: { increment: amount } },
      });
    }
  } catch (error) {
    console.error(`[PlanLimits] Erro ao incrementar recurso ${resource} para ${userId}:`, error);
  }
}

/**
 * Middleware validador de funcionalidades por plano comercial (Básico, Avançado e Master).
 *
 * Lógica:
 * 1. Qual funcionalidade esta página/rota exige? (requiredFeature)
 * 2. O plano atual do usuário tem essa funcionalidade na lista dele (plan-features.ts)?
 * 3. Se SIM -> deixa passar (next()).
 * 4. Se NÃO -> bloqueia o acesso imediatamente com HTTP 403 e informa que o recurso exige upgrade.
 */
export function requirePlanFeatureAccess(requiredFeature: PlanFeatureName | string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || (req as any).userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Usuário não autenticado.',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          planType: true,
          plano: true,
          trialEndsAt: true,
          createdAt: true,
          subscriptions: {
            where: {
              categoria: 'plataforma',
              status: { in: ['active', 'trialing'] },
            },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { plano: true, status: true, periodoFim: true },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não localizado no sistema.',
        });
      }

      const now = new Date();
      const effectiveTrialEndsAt =
        user.trialEndsAt ??
        (user.createdAt
          ? new Date(new Date(user.createdAt).getTime() + 15 * 24 * 60 * 60 * 1000)
          : null);
      const isTrialActive = Boolean(effectiveTrialEndsAt && new Date(effectiveTrialEndsAt) > now);

      const activeSub = user.subscriptions?.[0];
      const subValid =
        activeSub && (!activeSub.periodoFim || new Date(activeSub.periodoFim) >= now);

      const currentPlan = isTrialActive ? 'master' : (subValid ? activeSub.plano : 'free');
      const currentPlanConfig =
        currentPlan === 'free' ? null : getCommercialPlanConfig(currentPlan);

      if (currentPlanConfig && hasCommercialPlanFeature(currentPlanConfig.id, requiredFeature)) {
        return next();
      }

      const minimumPlan = getMinimumCommercialPlanForFeature(requiredFeature);
      const requiredPlanLabel = minimumPlan?.nome || 'Plano Master';

      return res.status(403).json({
        success: false,
        code: 'FEATURE_NOT_IN_PLAN',
        message: `Este recurso exige upgrade para o ${requiredPlanLabel}. Faça upgrade para continuar.`,
        details: {
          feature: requiredFeature,
          currentPlan: currentPlanConfig?.id ?? 'free',
          requiredPlan: minimumPlan?.id ?? 'MASTER',
        },
      });
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Middleware que bloqueia rotas exclusivas do plano MASTER (ex: Malha Fina QSA, Robô de Reajuste, Assistente de Repactuação)
 */
export const requireMasterPlan = requirePlanFeatureAccess('malha_fina_qsa');
