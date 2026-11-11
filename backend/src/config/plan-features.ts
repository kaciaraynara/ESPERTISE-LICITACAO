/**
 * FONTE ÚNICA DA VERDADE (Single Source of Truth) — Planos Comerciais Expertise Licitações
 *
 * Centraliza os limites numéricos e as permissões de funcionalidades (features)
 * dos três planos comerciais da plataforma:
 *   1. Básico   (5 CNPJs, 15 propostas/mês)
 *   2. Avançado (10 CNPJs, 50 propostas/mês — inclui tudo do Básico + extras)
 *   3. Master   (20 CNPJs, propostas ilimitadas — inclui tudo do Avançado + exclusivos)
 */

export type CommercialPlanKey = 'BASICO' | 'AVANCADO' | 'MASTER';
export type LegacyPlanTypeKey = 'BASIC' | 'MEDIUM' | 'MASTER';
export type PlanSlugKey = 'free' | 'basic' | 'avancado' | 'pro' | 'master';

/**
 * 1. Funcionalidades do Plano Básico
 */
export const BASIC_PLAN_FEATURES = [
  'radar_editais',
  'resumo_edital_basico',
  'precheck_juridico',
  'fabrica_propostas',
  'catalogo_produtos',
  'cofre_documentos',
  'habilitacao',
  'certidoes',
  'prazos_alertas',
  'crm_kanban',
  'dispensa_eletronica',
  'academia_licitante',
  'gestao_contratual',
  'credenciamento',
  'credenciamento_srp_consulta',
  'calculadora_custos_basica',
  // Aliases técnicos legados das rotas
  'notices.basic_summary',
  'notices.legal_precheck',
  'proposal.factory',
] as const;

/**
 * 2. Funcionalidades adicionais do Plano Avançado
 * (O Plano Avançado herda 100% do BASIC_PLAN_FEATURES + estas funcionalidades)
 */
export const ADVANCED_EXTRA_FEATURES = [
  'radar_erros_edital',
  'resumo_edital_completo',
  'score_oportunidade',
  'estrategia_proposta',
  'precificacao_estrategica',
  'analise_viabilidade',
  'impugnacao_edital',
  'recursos_administrativos',
  'historico_concorrentes',
  'robo_lances',
  'srp_carona',
  'lex_ia_avancada',
  'gestao_contratual_financeira',
  'calculadora_custos_avancada',
  'relatorios_estrategicos',
  'alertas_vencimento_contrato',
  // Aliases técnicos legados das rotas
  'notices.full_summary',
  'notices.opportunity_score',
  'proposal.strategy',
  'pricing.strategy',
  'impugnation.simple',
  'reports.strategic',
  'notices.error_radar',
  'lex.advanced',
  'bid.robot',
] as const;

export const ADVANCED_PLAN_FEATURES = [
  ...BASIC_PLAN_FEATURES,
  ...ADVANCED_EXTRA_FEATURES,
] as const;

/**
 * 3. Funcionalidades exclusivas do Plano Master
 * (O Plano Master herda 100% do ADVANCED_PLAN_FEATURES + estas funcionalidades exclusivas)
 */
export const MASTER_EXCLUSIVE_FEATURES = [
  'malha_fina_qsa',
  'gestao_garantias',
  'painel_financeiro_consolidado',
  'gestao_contratual_pos_vitoria',
  'robo_lances_ampliado',
  'automacao_propostas',
  'robo_reajuste',
  'assistente_repactuacao',
  'assistente_reequilibrio',
  'revisao_assistida_contratos',
  'franquia_apoio_juridico',
  'inteligencia_concorrentes',
  'auditoria_anticartel',
  // Aliases técnicos legados das rotas
  'investigation.cartel_signals',
  'investigation.competitor_intelligence',
  'catalog.full',
] as const;

export const MASTER_PLAN_FEATURES = [
  ...ADVANCED_PLAN_FEATURES,
  ...MASTER_EXCLUSIVE_FEATURES,
] as const;

export const ALL_PLAN_FEATURES = MASTER_PLAN_FEATURES;

export type PlanFeatureName = (typeof ALL_PLAN_FEATURES)[number];

export interface PlanLimitsConfig {
  /** Limite máximo de CNPJs (empresas) permitidos na conta */
  maxCnpjs: number;
  /** Alias para compatibilidade com serviços que leem maxCompanies */
  maxCompanies: number;
  /** Limite mensal de propostas (Infinity no plano Master) */
  maxProposals: number;
  /** Alias para compatibilidade com middlewares que leem maxMonthlyProposals */
  maxMonthlyProposals: number;
  /** Limite mensal de análises jurídicas/viabilidade */
  maxAnalyses: number;
  /** Alias para compatibilidade com middlewares que leem maxMonthlyAnalyses */
  maxMonthlyAnalyses: number;
  /** Limite de editais monitorados simultaneamente */
  maxMonitoredNotices: number;
  /** Limite de usuários na equipe */
  maxUsers: number;
}

export interface PlanConfiguration {
  id: CommercialPlanKey;
  slug: 'basic' | 'pro' | 'master';
  prismaPlanType: LegacyPlanTypeKey;
  nome: string;
  descricao: string;
  valorMensalCentavos: number;
  limits: PlanLimitsConfig;
  features: readonly PlanFeatureName[];
}

/**
 * Objeto central de configuração dos Planos Comerciais (Ordem Crescente: Básico -> Avançado -> Master)
 */
export const PLAN_FEATURES_CONFIG: Record<CommercialPlanKey, PlanConfiguration> = {
  BASICO: {
    id: 'BASICO',
    slug: 'basic',
    prismaPlanType: 'BASIC',
    nome: 'Plano Básico',
    descricao: 'Para licitantes iniciando a operação estruturada com até 5 CNPJs e 15 propostas mensais.',
    valorMensalCentavos: 9999,
    limits: {
      maxCnpjs: 5,
      maxCompanies: 5,
      maxProposals: 15,
      maxMonthlyProposals: 15,
      maxAnalyses: 50,
      maxMonthlyAnalyses: 50,
      maxMonitoredNotices: 15,
      maxUsers: 2,
    },
    features: BASIC_PLAN_FEATURES,
  },

  AVANCADO: {
    id: 'AVANCADO',
    slug: 'pro',
    prismaPlanType: 'MEDIUM',
    nome: 'Plano Avançado',
    descricao: 'Para licitantes recorrentes com até 10 CNPJs, 50 propostas mensais e precificação estratégica.',
    valorMensalCentavos: 19999,
    limits: {
      maxCnpjs: 10,
      maxCompanies: 10,
      maxProposals: 50,
      maxMonthlyProposals: 50,
      maxAnalyses: 150,
      maxMonthlyAnalyses: 150,
      maxMonitoredNotices: 50,
      maxUsers: 5,
    },
    features: ADVANCED_PLAN_FEATURES,
  },

  MASTER: {
    id: 'MASTER',
    slug: 'master',
    prismaPlanType: 'MASTER',
    nome: 'Plano Master',
    descricao: 'Operação completa de alta performance com até 20 CNPJs, propostas ilimitadas, Malha Fina QSA, Robô de Reajuste e Assistente de Repactuação.',
    valorMensalCentavos: 49999,
    limits: {
      maxCnpjs: 20,
      maxCompanies: 20,
      maxProposals: Infinity,
      maxMonthlyProposals: Infinity,
      maxAnalyses: Infinity,
      maxMonthlyAnalyses: Infinity,
      maxMonitoredNotices: 200,
      maxUsers: 10,
    },
    features: MASTER_PLAN_FEATURES,
  },
} as const;

/**
 * 4. Add-on Oficial de Inteligência Tributária: EXPERTISE FISCAL (+R$ 99,99/mês)
 * Pode ser contratado como complemento por qualquer assinante (Básico, Avançado ou Master).
 */
export interface AddonConfiguration {
  slug: string;
  nome: string;
  descricao: string;
  priceCents: number;
  features: readonly string[];
}

export const EXPERTISE_FISCAL_ADDON: AddonConfiguration = {
  slug: 'expertise_fiscal',
  nome: 'Expertise Fiscal',
  descricao: 'Inteligência tributária avançada para licitantes: auditoria de retenções IN 1.234/12, INSS 11%/CPRB, segregação monofásica e simulador Reforma Tributária (CBS/IBS LC 214/2025).',
  priceCents: 9999, // R$ 99,99/mês
  features: [
    'expertise_fiscal.retencoes_in1234',
    'expertise_fiscal.retencao_inss_cprb',
    'expertise_fiscal.segregacao_monofasica',
    'expertise_fiscal.reforma_tributaria_cbs_ibs',
    'expertise_fiscal.reequilibrio_tributario',
    'expertise_fiscal.livro_razao_contratual',
    'expertise_fiscal.recuperacao_creditos',
  ] as const,
};

/**
 * Verifica se a empresa possui assinatura ativa do Add-on (ex: expertise_fiscal).
 */
export function hasCompanyAddon(
  companyAddons: Array<{ addonSlug: string; status: string; expiresAt?: Date | string | null }> | null | undefined,
  addonSlug: string = 'expertise_fiscal'
): boolean {
  if (!companyAddons || !Array.isArray(companyAddons)) return false;
  const now = new Date();
  return companyAddons.some((addon) => {
    if (addon.addonSlug !== addonSlug) return false;
    if (addon.status !== 'ACTIVE' && addon.status !== 'TRIAL') return false;
    if (addon.expiresAt && new Date(addon.expiresAt) < now) return false;
    return true;
  });
}

/**
 * Exportação indexada também pelos nomes comerciais, Prisma Enum (BASIC, MEDIUM, MASTER)
 * e slugs legados (basic, avancado, pro, master) para facilitar consumo direto em qualquer camada.
 */
export const PLAN_FEATURES = {
  BASICO: PLAN_FEATURES_CONFIG.BASICO,
  AVANCADO: PLAN_FEATURES_CONFIG.AVANCADO,
  MASTER: PLAN_FEATURES_CONFIG.MASTER,
  // Aliases Prisma PlanType
  BASIC: PLAN_FEATURES_CONFIG.BASICO,
  MEDIUM: PLAN_FEATURES_CONFIG.AVANCADO,
  // Aliases slugs
  basic: PLAN_FEATURES_CONFIG.BASICO,
  avancado: PLAN_FEATURES_CONFIG.AVANCADO,
  pro: PLAN_FEATURES_CONFIG.AVANCADO,
  master: PLAN_FEATURES_CONFIG.MASTER,
} as const;

/**
 * Normaliza qualquer string de plano (ex: 'basic', 'basico', 'avancado', 'medium', 'pro', 'master', 'enterprise')
 * para a chave comercial oficial ('BASICO' | 'AVANCADO' | 'MASTER').
 */
export function resolveCommercialPlanKey(rawPlan?: string | null): CommercialPlanKey {
  if (!rawPlan) return 'BASICO';
  const normalized = String(rawPlan)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'master' || normalized === 'enterprise') {
    return 'MASTER';
  }

  if (
    normalized === 'avancado' ||
    normalized === 'medium' ||
    normalized === 'medio' ||
    normalized === 'pro' ||
    normalized === 'profissional' ||
    normalized === 'professional' ||
    normalized === 'premium'
  ) {
    return 'AVANCADO';
  }

  return 'BASICO';
}

/**
 * Retorna a configuração completa (limites e features) de um plano.
 */
export function getCommercialPlanConfig(rawPlan?: string | null): PlanConfiguration {
  const key = resolveCommercialPlanKey(rawPlan);
  return PLAN_FEATURES_CONFIG[key];
}

/**
 * Verifica se um determinado plano possui acesso a uma funcionalidade específica.
 */
export function hasCommercialPlanFeature(
  rawPlan: string | null | undefined,
  feature: PlanFeatureName | string,
): boolean {
  const config = getCommercialPlanConfig(rawPlan);
  return (config.features as readonly string[]).includes(feature);
}

/**
 * Descobre qual é o menor plano comercial (BASICO, AVANCADO ou MASTER) que inclui a funcionalidade exigida.
 */
export function getMinimumCommercialPlanForFeature(
  feature: PlanFeatureName | string,
): PlanConfiguration | null {
  const order: CommercialPlanKey[] = ['BASICO', 'AVANCADO', 'MASTER'];
  for (const key of order) {
    if ((PLAN_FEATURES_CONFIG[key].features as readonly string[]).includes(feature)) {
      return PLAN_FEATURES_CONFIG[key];
    }
  }
  return null;
}

export default PLAN_FEATURES_CONFIG;
