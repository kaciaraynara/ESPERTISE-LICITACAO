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
  tempoReal?: boolean | string;
}

export interface LicitacaoPNCP {
  numeroControlePNCP: string;
  anoCompra?: number;
  sequencialCompra?: number;
  nomeOrgao?: string;
  cnpjOrgao?: string;
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
  objetoCompra?: string;
  informacaoComplementar?: string;
  processo?: string;
  numeroCompra?: string;
  valorTotalEstimado?: number;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  dataInicioRecebimento?: string | null;
  dataFimRecebimento?: string | null;
  modalidadeId?: number;
  modalidadeNome?: string;
  nomeModalidade?: string;
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
  anoCompra?: number;
  sequencialCompra?: number;
  nomeOrgao?: string;
  orgao: string;
  cnpjOrgao: string | null;
  unidade: string | null;
  uf: string | null;
  municipio: string | null;
  objetoCompra?: string;
  objeto: string;
  informacaoComplementar?: string | null;
  processo: string | null;
  numeroCompra: string | null;
  nomeModalidade?: string | null;
  modalidadeNome?: string | null;
  modalidade: string | null;
  modalidadeId: number | null;
  modoDisputa: string | null;
  criterioJulgamento?: string | null;
  situacao: string | null;
  valorTotalEstimado?: number | null;
  valorEstimado: number | null;
  valor_estimado?: number | null;
  dataPublicacao: string | null;
  data_publicacao?: string | null;
  dataAbertura: string | null;
  data_abertura?: string | null;
  dataAberturaProposta?: string | null;
  dataEncerramentoProposta?: string | null;
  dataInicioRecebimento?: string | null;
  dataFimRecebimento?: string | null;
  dataEncerramento: string | null;
  data_encerramento?: string | null;
  dataLimiteProposta?: string | null;
  dataSessaoDisputa?: string | null;
  link: string | null;
  linkSistemaOrigem?: string | null;
  documento_url?: string | null;
  linkDownloadEdital?: string | null;
  urlOficial?: string;
  urlOficialPncp?: string;
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
