// ─── Auth ─────────────────────────────────────────────────────────────────────
export type PlanoUsuario = 'free' | 'basic' | 'pro' | 'premium' | 'starter' | 'profissional' | 'enterprise';

export interface User {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  plano: PlanoUsuario;
  email_verificado: boolean;
  ultimo_acesso: string | null;
  created_at: string;
  role?: 'fornecedor' | 'advogado' | 'contador';
  oab_numero?: string | null;
  oab_uf?: string | null;
  crc_numero?: string | null;
  crc_uf?: string | null;
}

export type NivelScore = 'alto' | 'medio' | 'baixo';
export type StatusLicitacao = 'aberta' | 'encerrada' | 'suspensa' | 'anulada';

export interface ScoreCriterios {
  nicho: number; valor: number; prazo: number;
  orgao: number; completude: number; historico: number;
}

export interface Score {
  pontuacao: number;
  nivel: NivelScore;
  criterios: ScoreCriterios;
}

export type StatusJuridicoEdital = 'seguro' | 'alerta' | 'vicio';

export interface VicioJuridico {
  erro: string;
  base_legal: string;
  risco: 'desclassificacao' | 'nulidade' | 'outro';
  acao_sugerida: string;
}

export interface ChecklistHabilitacaoItem {
  documento: string;
  possui: boolean;
  observacao?: string;
}

/** Snapshot retornado em `inteligencia_json` (espelha o DTO analítico do backend). */
export interface AuditoriaInteligencia {
  vicios?: VicioJuridico[];
  checklist_habilitacao?: ChecklistHabilitacaoItem[];
  citacoes_lei_14133?: string[];
  justificativa_recomendacao?: string;
}

export interface Auditoria {
  id: string;
  resumo: string;
  riscos: string[];
  inconformidades: string[];
  competencia: string | null;
  finalidade: string | null;
  forma: string | null;
  motivo: string | null;
  objeto_detalhado: string | null;
  recomendacao: 'participar' | 'avaliar' | 'evitar';
  tokens_utilizados?: number | null;
  status_juridico?: StatusJuridicoEdital | null;
  inteligencia_json?: AuditoriaInteligencia | null;
  created_at: string;
}

export interface Licitacao {
  id: string; numero_controle_pncp: string | null;
  objeto: string; orgao: string; orgao_cnpj: string | null;
  uf: string | null; municipio: string | null;
  valor_estimado: number | null; data_abertura: string;
  data_encerramento: string | null; modalidade: string | null;
  status: StatusLicitacao; link: string | null; link_edital: string | null;
  fonte: string; score: Score | null; auditoria?: Auditoria | null;
  created_at: string;
}

export interface Empresa {
  id: string; user_id: string; cnpj: string;
  razao_social: string; nome_fantasia: string | null;
  nicho: string[]; palavras_chave: string[];
  valor_min: number | null; valor_max: number | null;
  regioes: string[]; orgaos_preferidos: string[];
  orgaos_bloqueados: string[]; created_at: string;
}

export type TipoNotificacao =
  | 'nova_oportunidade'
  | 'score_alto'
  | 'prazo_proximo'
  | 'licitacao_encerrada'
  | 'sistema'
  | 'empresa_configurada';

export interface Notificacao {
  id: string; tipo: TipoNotificacao; titulo: string;
  mensagem: string; canal: string;
  status: 'pendente' | 'enviada' | 'falha';
  enviada_em: string | null; licitacao_id: string | null; created_at: string;
  lida?: boolean; link?: string | null;
}

export interface Assinatura {
  id: string; plano: PlanoUsuario;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  periodo_inicio: string; periodo_fim: string; cancelar_ao_fim: boolean;
}

export interface ApiResponse<T> {
  success: boolean; message: string; data: T;
}

export interface PaginatedResponse<T> {
  success: boolean; message: string; data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number; };
}

export interface LicitacaoFiltros {
  busca?: string; uf?: string; orgao?: string;
  valorMin?: number; valorMax?: number;
  dataAbertura?: string; pagina?: number; limite?: number;
}

export type NivelRiscoFraude = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface SocioFraude {
  nome: string;
  documentoMascarado: string | null;
}

export interface EmpresaVinculoFraude {
  cnpj: string;
  razaoSocial: string;
  qualificacao: string | null;
  dataEntradaSociedade: string | null;
}

export interface VinculoSocietarioFraude {
  socio: SocioFraude;
  empresas: EmpresaVinculoFraude[];
  totalEmpresas: number;
  severidade: NivelRiscoFraude;
}

export interface ResumoMalhaFina {
  totalConcorrentes: number;
  empresasComQsa: number;
  empresasSemQsa: number;
  totalSociosAnalisados: number;
  totalVinculosSocietarios: number;
}

export interface EmpresaMalhaFina {
  cnpj: string;
  razaoSocial: string;
  totalSocios: number;
}

export interface MalhaFinaLicitacao {
  titulo: string;
  licitacaoId: string | null;
  fonte: string;
  risco: NivelRiscoFraude;
  possuiSociosEmComum: boolean;
  resumo: ResumoMalhaFina;
  empresas: EmpresaMalhaFina[];
  vinculosSocietarios: VinculoSocietarioFraude[];
  recomendacoes: string[];
  geradoEm: string;
}

export interface DadosFraudePeca {
  risco: NivelRiscoFraude;
  possuiSociosEmComum?: boolean;
  resumo?: Pick<ResumoMalhaFina, 'totalConcorrentes' | 'totalVinculosSocietarios'>;
  vinculosSocietarios?: Array<{
    socio: SocioFraude;
    empresas: EmpresaVinculoFraude[];
    totalEmpresas?: number;
  }>;
}

export interface FornecedorMarketplace {
  id: string;
  ownerUserId: string | null;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnaePrincipal: string;
  ramoAtividade: string;
  regiaoAtendimento: string[];
  municipio: string | null;
  uf: string | null;
  notaReputacao: number;
  selosConformidade: string[];
  custoReferencia: number | null;
  unidadeCusto: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FornecedorMarketplaceListResponse {
  success: boolean;
  data: FornecedorMarketplace[];
  meta: {
    total: number;
    filters: {
      busca?: string;
      cnae?: string;
      regiao?: string;
      uf?: string;
      limit?: number;
    };
  };
}

export interface FornecedorCustoImportado {
  fornecedorId: string;
  razaoSocial: string;
  cnpj: string;
  custoReferencia: number;
  unidadeCusto: string | null;
}

export interface RadarLicitacao {
  id: string;
  numeroControlePNCP: string;
  orgao: string;
  cnpjOrgao: string | null;
  unidade: string | null;
  uf: string | null;
  municipio: string | null;
  objeto: string;
  processo: string | null;
  numeroCompra: string | null;
  modalidade: string | null;
  modalidadeId: number | null;
  modoDisputa: string | null;
  situacao: string | null;
  valorEstimado: number | null;
  dataPublicacao: string | null;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  link: string | null;
  fonte: 'PNCP';
}

export interface RadarLicitacoesFiltros {
  dataFinal: string;
  codigoModalidadeContratacao?: number;
  uf?: string;
  palavraChave?: string;
  pagina: number;
  tamanhoPagina: number;
}

export interface RadarLicitacoesResponse {
  success: true;
  data: RadarLicitacao[];
  meta: {
    fonte: 'PNCP';
    pagina: number;
    tamanhoPagina: number;
    totalRegistros: number | null;
    atualizadoEm: string;
  };
}
