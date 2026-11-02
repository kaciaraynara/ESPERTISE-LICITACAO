export const FORNECEDOR_PREFIX = '/fornecedor';

export const FORNECEDOR_ROUTES = {
  dashboard: `${FORNECEDOR_PREFIX}/dashboard`,
  // As 16 Ferramentas Principais da Plataforma (Arte Oficial)
  radar: `${FORNECEDOR_PREFIX}/radar`,
  radar_nulidades: `${FORNECEDOR_PREFIX}/radar-nulidades`,
  leitor_editais: `${FORNECEDOR_PREFIX}/leitor-editais`,
  impugnacao: `${FORNECEDOR_PREFIX}/impugnacao`,
  score_viabilidade: `${FORNECEDOR_PREFIX}/score-viabilidade`,
  robo_lances: `${FORNECEDOR_PREFIX}/robo-lances`,
  pregao_eletronico: `${FORNECEDOR_PREFIX}/pregao-eletronico`,
  concorrencia: `${FORNECEDOR_PREFIX}/concorrencia`,
  credenciamento: `${FORNECEDOR_PREFIX}/credenciamento`,
  dispensa_eletronica: `${FORNECEDOR_PREFIX}/dispensa-eletronica`,
  recursos: `${FORNECEDOR_PREFIX}/recursos`,
  habilitacao: `${FORNECEDOR_PREFIX}/habilitacao`,
  cofre: `${FORNECEDOR_PREFIX}/cofre`,
  certidoes: `${FORNECEDOR_PREFIX}/certidoes`,
  srp: `${FORNECEDOR_PREFIX}/srp`,
  academia: `${FORNECEDOR_PREFIX}/academia`,
  propostas: `${FORNECEDOR_PREFIX}/propostas`,
  sicaf_credenciamento: `${FORNECEDOR_PREFIX}/sicaf-credenciamento`,
  lex: `${FORNECEDOR_PREFIX}/lex`,

  // Sub-rotas e Aliases Operacionais
  proposta_detalhe: `${FORNECEDOR_PREFIX}/propostas/:id`,
  catalogo: `${FORNECEDOR_PREFIX}/catalogo`,
  documentos: `${FORNECEDOR_PREFIX}/documentos`,
  prazos_alertas: `${FORNECEDOR_PREFIX}/prazos`,
  gestao_contratual: `${FORNECEDOR_PREFIX}/contratos`,
  score_oportunidades: `${FORNECEDOR_PREFIX}/score-oportunidades`,
  srp_carona: `${FORNECEDOR_PREFIX}/srp-carona`,
  editais_monitorados: `${FORNECEDOR_PREFIX}/editais-monitorados`,
  analise_oportunidade: `${FORNECEDOR_PREFIX}/analise-oportunidade`,
  estrategia_disputa: `${FORNECEDOR_PREFIX}/estrategia-disputa`,
  historico_concorrentes: `${FORNECEDOR_PREFIX}/historico-concorrentes`,
  analise_viabilidade: `${FORNECEDOR_PREFIX}/analise-viabilidade`,
  precificacao_estrategica: `${FORNECEDOR_PREFIX}/precificacao`,
  investigacao_concorrencial: `${FORNECEDOR_PREFIX}/investigacao`,
  relatorios_estrategicos: `${FORNECEDOR_PREFIX}/relatorios`,
  planos: `${FORNECEDOR_PREFIX}/planos`,
  configuracoes: `${FORNECEDOR_PREFIX}/configuracoes`,
  empresa: `${FORNECEDOR_PREFIX}/empresa`,
  integracoes: `${FORNECEDOR_PREFIX}/integracoes`,
  disputas: `${FORNECEDOR_PREFIX}/disputas`,
  crm: `${FORNECEDOR_PREFIX}/disputas`,
  licitacao_detalhe: `${FORNECEDOR_PREFIX}/licitacao/:id`,
  licitacoes_detalhe_alias: `${FORNECEDOR_PREFIX}/licitacoes/:id`,
} as const;

export const LEGACY_FORNECEDOR_ROUTES = {
  cofre: `${FORNECEDOR_PREFIX}/cofre`,
} as const;

export function resolveAuthenticatedHome(_role?: string | null) {
  return FORNECEDOR_ROUTES.dashboard;
}
