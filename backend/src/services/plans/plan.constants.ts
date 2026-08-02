export const PLAN_IDS = ['free', 'basic', 'pro', 'master'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const ALL_PLAN_FEATURES = [
  'notices.basic_summary',
  'notices.full_summary',
  'notices.legal_precheck',
  'notices.error_radar',
  'notices.opportunity_score',
  'proposal.factory',
  'proposal.strategy',
  'pricing.strategy',
  'impugnation.simple',
  'investigation.cartel_signals',
  'investigation.competitor_intelligence',
  'catalog.full',
  'reports.strategic',
  'lex.advanced',
  'bid.robot',
] as const;

export type PlanFeature = (typeof ALL_PLAN_FEATURES)[number];

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
    nome: 'Básico',
    descricao: 'Para licitantes que estão começando a organizar a rotina de participação.',
    valorMensalCentavos: 6999,
    maxCompanies: 1,
    maxUsers: 2,
    maxMonitoredNotices: 10,
    maxNullityAnalysesMonth: 3,
    maxProposalsMonth: 5,
    features: [
      'notices.basic_summary',
      'notices.legal_precheck',
      'notices.error_radar',
      'proposal.factory',
    ],
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    descricao: 'Para licitantes recorrentes que precisam analisar, precificar e disputar melhor.',
    valorMensalCentavos: 14999,
    maxCompanies: 5,
    maxUsers: 5,
    maxMonitoredNotices: 50,
    maxNullityAnalysesMonth: 30,
    maxProposalsMonth: 30,
    features: [
      'notices.basic_summary',
      'notices.full_summary',
      'notices.legal_precheck',
      'notices.error_radar',
      'notices.opportunity_score',
      'proposal.factory',
      'proposal.strategy',
      'pricing.strategy',
      'impugnation.simple',
      'reports.strategic',
    ],
  },
  master: {
    id: 'master',
    nome: 'Master',
    descricao: 'Para licitantes estratégicos com investigação, inteligência avançada e operação em equipe.',
    valorMensalCentavos: 24999,
    maxCompanies: 10,
    maxUsers: 10,
    maxMonitoredNotices: 200,
    maxNullityAnalysesMonth: 100,
    // O contrato comercial recebido não define um teto mensal de propostas
    // para o Master. `null` evita publicar um limite inventado.
    maxProposalsMonth: null,
    features: [
      'notices.basic_summary',
      'notices.full_summary',
      'notices.legal_precheck',
      'notices.error_radar',
      'notices.opportunity_score',
      'proposal.factory',
      'proposal.strategy',
      'pricing.strategy',
      'impugnation.simple',
      'investigation.cartel_signals',
      'investigation.competitor_intelligence',
      'catalog.full',
      'reports.strategic',
      'lex.advanced',
      'bid.robot',
    ],
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
