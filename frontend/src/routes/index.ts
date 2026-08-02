export const FORNECEDOR_PREFIX = '/fornecedor';

export const FORNECEDOR_ROUTES = {
  dashboard: `${FORNECEDOR_PREFIX}/dashboard`,
  academia: `${FORNECEDOR_PREFIX}/academia`,
  radar: `${FORNECEDOR_PREFIX}/radar`,
  score_oportunidades: `${FORNECEDOR_PREFIX}/score-oportunidades`,
  radar_nulidades: `${FORNECEDOR_PREFIX}/radar-nulidades`,
  srp_carona: `${FORNECEDOR_PREFIX}/srp-carona`,
  editais_monitorados: `${FORNECEDOR_PREFIX}/editais-monitorados`,
  analise_oportunidade: `${FORNECEDOR_PREFIX}/analise-oportunidade`,
  estrategia_disputa: `${FORNECEDOR_PREFIX}/estrategia-disputa`,
  precificacao_estrategica: `${FORNECEDOR_PREFIX}/precificacao`,
  propostas: `${FORNECEDOR_PREFIX}/propostas`,
  catalogo: `${FORNECEDOR_PREFIX}/catalogo`,
  documentos: `${FORNECEDOR_PREFIX}/documentos`,
  prazos_alertas: `${FORNECEDOR_PREFIX}/prazos`,
  lex: `${FORNECEDOR_PREFIX}/lex`,
  investigacao_concorrencial: `${FORNECEDOR_PREFIX}/investigacao`,
  relatorios_estrategicos: `${FORNECEDOR_PREFIX}/relatorios`,
  robo_lances: `${FORNECEDOR_PREFIX}/robo-lances`,
  planos: `${FORNECEDOR_PREFIX}/planos`,
  configuracoes: `${FORNECEDOR_PREFIX}/configuracoes`,
  licitacao_detalhe: `${FORNECEDOR_PREFIX}/licitacao/:id`,
} as const;

export const LEGACY_FORNECEDOR_ROUTES = {
  cofre: `${FORNECEDOR_PREFIX}/cofre`,
} as const;

export function resolveAuthenticatedHome(_role?: string | null) {
  return FORNECEDOR_ROUTES.dashboard;
}
