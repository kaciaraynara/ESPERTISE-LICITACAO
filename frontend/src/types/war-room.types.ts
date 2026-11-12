/**
 * Tipos TypeScript da Disputa ao Vivo, Simulação Tributária e WebSocket (Frontend)
 * Perfeitamente alinhados com o backend para consistência integral.
 */

export interface SimulateBdiInput {
  custoInsumos: number;
  despesasOperacionais?: number;
  margemLucroDesejada?: number;
  margemMinimaStopLoss?: number;
  bidAmount?: number;
}

export interface AliquotasIvaDual {
  cbsPercentual: number; // 11.3%
  ibsPercentual: number; // 0.1%
  ivaDualTotalPercentual: number; // 11.4%
}

export interface SplitPaymentCalculado {
  retencaoCbs: number;
  retencaoIbs: number;
  totalRetidoFonte: number;
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
  itemNumero?: number;
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
  itemNumero?: number;
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
  itemNumero?: number;
  bid_amount: number;
  stop_loss_minimo: number;
  margem_calculada: number;
  timestamp: string;
}

export interface GenerateProposalPayload {
  format: 'docx' | 'xlsx';
  companyId?: string;
  pregaoId?: string;
  noticeId?: string;
  orgao?: string;
  objeto?: string;
  custoInsumos: number;
  despesasOperacionais?: number;
  margemLucroDesejada?: number;
  margemMinimaStopLoss?: number;
  bidAmount?: number;
  validadeDias?: number;
}

