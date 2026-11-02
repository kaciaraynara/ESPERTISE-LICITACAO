import {
  ALL_PLAN_FEATURES as CONFIG_ALL_PLAN_FEATURES,
  PLAN_FEATURES_CONFIG,
  type PlanFeatureName,
} from '../../config/plan-features';

export const PLAN_IDS = ['free', 'basic', 'pro', 'master'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const ALL_PLAN_FEATURES = CONFIG_ALL_PLAN_FEATURES;

export type PlanFeature = PlanFeatureName;

export interface PlanDefinition {
  id: PlanId;
  nome: string;
  descricao: string;
  valorMensalCentavos: number;
  maxCompanies: number;
  maxUsers: number;
  maxMonitoredNotices: number;
  maxNullityAnalysesMonth: number;
  maxProposalsMonth: number | null;
  features: readonly PlanFeature[];
}

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    nome: 'Sem assinatura',
    descricao: 'Conta sem plano ativo, com acesso restrito.',
    valorMensalCentavos: 0,
    maxCompanies: 0,
    maxUsers: 1,
    maxMonitoredNotices: 0,
    maxNullityAnalysesMonth: 0,
    maxProposalsMonth: 0,
    features: [],
  },
  basic: {
    id: 'basic',
    nome: PLAN_FEATURES_CONFIG.BASICO.nome,
    descricao: PLAN_FEATURES_CONFIG.BASICO.descricao,
    valorMensalCentavos: PLAN_FEATURES_CONFIG.BASICO.valorMensalCentavos,
    maxCompanies: PLAN_FEATURES_CONFIG.BASICO.limits.maxCnpjs,
    maxUsers: PLAN_FEATURES_CONFIG.BASICO.limits.maxUsers,
    maxMonitoredNotices: PLAN_FEATURES_CONFIG.BASICO.limits.maxMonitoredNotices,
    maxNullityAnalysesMonth: PLAN_FEATURES_CONFIG.BASICO.limits.maxAnalyses,
    maxProposalsMonth: PLAN_FEATURES_CONFIG.BASICO.limits.maxProposals,
    features: PLAN_FEATURES_CONFIG.BASICO.features,
  },
  pro: {
    id: 'pro',
    nome: PLAN_FEATURES_CONFIG.AVANCADO.nome,
    descricao: PLAN_FEATURES_CONFIG.AVANCADO.descricao,
    valorMensalCentavos: PLAN_FEATURES_CONFIG.AVANCADO.valorMensalCentavos,
    maxCompanies: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxCnpjs,
    maxUsers: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxUsers,
    maxMonitoredNotices: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxMonitoredNotices,
    maxNullityAnalysesMonth: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxAnalyses,
    maxProposalsMonth: PLAN_FEATURES_CONFIG.AVANCADO.limits.maxProposals,
    features: PLAN_FEATURES_CONFIG.AVANCADO.features,
  },
  master: {
    id: 'master',
    nome: PLAN_FEATURES_CONFIG.MASTER.nome,
    descricao: PLAN_FEATURES_CONFIG.MASTER.descricao,
    valorMensalCentavos: PLAN_FEATURES_CONFIG.MASTER.valorMensalCentavos,
    maxCompanies: PLAN_FEATURES_CONFIG.MASTER.limits.maxCnpjs,
    maxUsers: PLAN_FEATURES_CONFIG.MASTER.limits.maxUsers,
    maxMonitoredNotices: PLAN_FEATURES_CONFIG.MASTER.limits.maxMonitoredNotices,
    maxNullityAnalysesMonth: 100,
    maxProposalsMonth: null,
    features: PLAN_FEATURES_CONFIG.MASTER.features,
  },
};

export const PLAN_FEATURES: Record<PlanId, readonly PlanFeature[]> = {
  free: PLAN_DEFINITIONS.free.features,
  basic: PLAN_DEFINITIONS.basic.features,
  pro: PLAN_DEFINITIONS.pro.features,
  master: PLAN_DEFINITIONS.master.features,
};

export const PLAN_LIMITS = {
  free: pickLimits(PLAN_DEFINITIONS.free),
  basic: pickLimits(PLAN_DEFINITIONS.basic),
  pro: pickLimits(PLAN_DEFINITIONS.pro),
  master: pickLimits(PLAN_DEFINITIONS.master),
} as const;

export function normalizePlanId(plan?: string | null): PlanId {
  const normalized = String(plan || 'free').trim().toLowerCase();

  const aliases: Record<string, PlanId> = {
    gratuito: 'free',
    gratis: 'free',
    starter: 'basic',
    basico: 'basic',
    básico: 'basic',
    avancado: 'pro',
    avançado: 'pro',
    medium: 'pro',
    medio: 'pro',
    médio: 'pro',
    profissional: 'pro',
    premium: 'pro',
    enterprise: 'master',
  };

  if (isPlanId(normalized)) {
    return normalized;
  }

  return aliases[normalized] ?? 'free';
}

export function isPlanId(plan: string): plan is PlanId {
  return (PLAN_IDS as readonly string[]).includes(plan);
}

export function planHasFeature(plan: string | null | undefined, feature: PlanFeature): boolean {
  const planId = normalizePlanId(plan);
  return PLAN_FEATURES[planId].includes(feature);
}

export const hasPlanFeature = planHasFeature;
export const canUseFeature = planHasFeature;

export function getPlanDefinition(plan?: string | null): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlanId(plan)];
}

export function getPlanLimits(plan?: string | null) {
  return PLAN_LIMITS[normalizePlanId(plan)];
}

export function getMinimumPlanForFeature(feature: PlanFeature): PlanId | null {
  for (const planId of PLAN_IDS) {
    if (PLAN_FEATURES[planId].includes(feature)) {
      return planId;
    }
  }

  return null;
}

function pickLimits(plan: PlanDefinition) {
  return {
    maxCompanies: plan.maxCompanies,
    maxUsers: plan.maxUsers,
    maxMonitoredNotices: plan.maxMonitoredNotices,
    maxNullityAnalysesMonth: plan.maxNullityAnalysesMonth,
    maxProposalsMonth: plan.maxProposalsMonth,
  };
}
