/**
 * Definições de Tipos para o Motor Financeiro, Simulação Tributária e WebSocket da Sala de Guerra
 */

export interface SimulateBdiInput {
  custoInsumos: number; // Custos diretos com materiais, mão de obra e insumos
  despesasOperacionais?: number; // Despesas operacionais/indiretas (valor absoluto ou padrão 5%)
  margemLucroDesejada?: number; // Margem de lucro pretendida (%)
  margemMinimaStopLoss?: number; // Margem de segurança inegociável / Stop-Loss (%)
  bidAmount?: number; // Lance proposto a ser testado
}

export interface AliquotasIvaDual {
  cbsPercentual: number; // 11.3%
  ibsPercentual: number; // 0.1%
  ivaDualTotalPercentual: number; // 11.4%
}

export interface SplitPaymentCalculado {
  retencaoCbs: number; // Retenção automática de CBS na fonte
  retencaoIbs: number; // Retenção automática de IBS na fonte
  totalRetidoFonte: number; // Total retido pelo órgão público (Split Payment)
}

export interface SimulateBdiResult {
  custoInsumos: number;
  despesasOperacionais: number;
  custoTotal: number;
  aliquotas: AliquotasIvaDual;
  splitPayment: SplitPaymentCalculado;
  precoSugeridoVenda: number;
  precoMinimoStopLoss: number;
  bidSimulado: number;
  receitaLiquidaAposSplit: number;
  lucroLiquido: number;
  margemLiquidaPercentual: number;
  violaStopLoss: boolean;
  statusMargem: 'SEGURA' | 'ALERTA' | 'PREJUIZO';
  mensagemAuditoria: string;
}

export interface PlaceBidPayload {
  pregaoId: string;
  bid_amount: number;
  custoInsumos: number;
  despesasOperacionais?: number;
  margemMinimaPercentual?: number;
  stop_loss_minimo?: number;
  licitanteNome?: string;
  observacao?: string;
}

export interface BidRecord {
  id: string;
  pregaoId: string;
  bid_amount: number;
  licitanteNome: string;
  isOwnBid: boolean;
  timestamp: string;
  splitPaymentRetido: number;
  receitaLiquida: number;
  lucroLiquido: number;
  margemLiquida: number;
  status: 'CONFIRMADO' | 'OPONENTE' | 'LIDERANDO';
}

export interface SocketBidError {
  statusCode: 403;
  error: 'Forbidden';
  code: 'STOP_LOSS_VIOLATION';
  message: string;
  bid_amount: number;
  stop_loss_minimo: number;
  margem_calculada: number;
  timestamp: string;
}

