export type TipoGarantia = 'PROPOSTA' | 'EXECUCAO_CONTRATUAL';

export type ModalidadeGarantia =
  | 'SEGURO_GARANTIA'
  | 'FIANCA_BANCARIA'
  | 'CAUCAO_DINHEIRO'
  | 'TITULO_PUBLICO';

export type StatusGarantia = 'ATIVA' | 'EMITIDA' | 'BAIXADA' | 'VENCIDA' | 'COTACAO';

export interface GarantiaItem {
  id: string;
  companyId: string;
  empresaNome?: string;
  tipo: TipoGarantia | string;
  modalidade: ModalidadeGarantia | string;
  instituicaoEmissora?: string | null;
  numeroApolice?: string | null;
  valor: number;
  percentual?: number | null;
  dataEmissao?: string | null;
  dataVencimento: string;
  status: StatusGarantia | string;
  documentoUrl?: string | null;
  observacoes?: string | null;
  createdAt: string;
}

export interface GuaranteesSummary {
  totalGarantias: number;
  ativasCount: number;
  totalValorGarantido: number;
  totalCaucaoDinheiroRetido: number;
  totalSeguroGarantia: number;
  totalFiancaBancaria: number;
  vencendo30dCount: number;
}

export interface GuaranteesResponse {
  summary: GuaranteesSummary;
  items: GarantiaItem[];
}

export interface CreateGuaranteePayload {
  tipo: TipoGarantia;
  modalidade: ModalidadeGarantia;
  instituicaoEmissora: string;
  numeroApolice?: string;
  valor: number;
  percentual?: number;
  dataEmissao?: string;
  dataVencimento: string;
  observacoes?: string;
}

export interface CriticalCertificateAlert {
  id: string;
  tipo: string;
  dataValidade: string;
  diasRestantes: number;
  isExpired: boolean;
  status: string;
}

export interface CertificateAlertsResponse {
  hasCriticalAlert: boolean;
  totalCriticas: number;
  alerts: CriticalCertificateAlert[];
}
