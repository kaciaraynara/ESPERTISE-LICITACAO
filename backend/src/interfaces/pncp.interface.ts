export interface FiltrosBusca {
  palavraChave?: string;
  palavrasChave?: string;
  busca?: string;
  search?: string;
  q?: string;
  termo?: string;
  cnpj?: string;
  cnae?: string;
  uf?: string;
  municipio?: string;
  dataInicial?: string;
  dataFinal?: string;
  dataInicio?: string;
  dataFim?: string;
  codigoModalidadeContratacao?: number | string;
  modalidade?: number | string;
  pagina?: number | string;
  tamanhoPagina?: number | string;
  valorMin?: number;
  valorMax?: number;
  srp?: boolean | string;
  endpoint?: 'publicacao' | 'proposta';
}

export interface LicitacaoPNCP {
  numeroControlePNCP: string;
  orgaoEntidade?: {
    razaoSocial?: string;
    cnpj?: string;
  };
  unidadeOrgao?: {
    ufSigla?: string;
    municipioNome?: string;
    nomeUnidade?: string;
  };
  objeto?: string;
  processo?: string;
  numeroCompra?: string;
  valorTotalEstimado?: number;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  modalidadeId?: number;
  modalidadeNome?: string;
  modoDisputaNome?: string;
  situacaoCompraId?: number;
  situacaoCompraNome?: string;
  usuarioNome?: string;
  linkSistemaOrigem?: string;
  linkEditalPNCP?: string;
  srp?: boolean;
}

export interface LicitacaoRadarPNCP {
  id: string;
  databaseId?: string | null;
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
  criterioJulgamento?: string | null;
  situacao: string | null;
  valorEstimado: number | null;
  valor_estimado?: number | null;
  dataPublicacao: string | null;
  data_publicacao?: string | null;
  dataAbertura: string | null;
  data_abertura?: string | null;
  dataEncerramento: string | null;
  data_encerramento?: string | null;
  link: string | null;
  linkSistemaOrigem?: string | null;
  documento_url?: string | null;
  linkDownloadEdital?: string | null;
  numeroEdital?: string | null;
  srp?: boolean;
  fonte: 'PNCP';
}

export interface ResultadoConsultaPNCP {
  data: LicitacaoPNCP[];
  totalRegistros: number | null;
  pagina: number;
  tamanhoPagina: number;
}

export interface ResultadoRadarPNCP {
  data: LicitacaoRadarPNCP[];
  totalRegistros: number | null;
  pagina: number;
  tamanhoPagina: number;
}
