export interface FiltrosBusca {
  palavraChave?: string;
  palavrasChave?: string;
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
