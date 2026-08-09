export type ModalidadeLicitacao = 'PREGAO_ELETRONICO' | 'CONCORRENCIA' | 'DISPENSA_ELETRONICA' | 'DIALOGO_COMPETITIVO';
export type FonteOrigem = 'PNCP' | 'COMPRASNET' | 'TCE_SP' | 'BEC_SP' | 'LICITACOES_E';

export interface EditalRadar {
  id: string;
  numeroProcesso: string; // Ex: "048/2024"
  orgaoComprador: string; // Ex: "Hospital das Clínicas da USP"
  uf: string; // Ex: "SP"
  cidade: string; // Ex: "São Paulo"
  modalidade: ModalidadeLicitacao;
  objeto: string;
  valorEstimado: number;
  dataAbertura: string; // ISO String
  dataPublicacao: string;
  fonte: FonteOrigem;
  matchScore: number; // 0 a 100 (% de compatibilidade com a empresa)
  relevanciaAI: 'ALTA' | 'MEDIA' | 'BAIXA';
  tags: string[];
  salvoNoCofre: boolean;
  linkOriginalUrl: string;
}

export interface FiltrosRadar {
  buscaGlobal: string;
  uf: string;
  modalidade: string;
  valorMinimo?: number;
  valorMaximo?: number;
  fonte: string;
  somenteMatchAlto: boolean;
}

export interface MetricasRadar {
  totalOportunidadesHoje: number;
  valorTotalMapeado: number;
  editaisCompativeisMatch: number;
  novosHoje: number;
}