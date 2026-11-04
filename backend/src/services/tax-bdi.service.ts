import {
  SimulateBdiInput,
  SimulateBdiResult,
  AliquotasIvaDual,
  SplitPaymentCalculado,
} from '../types/war-room.types';

// Alíquotas constitucionais do IVA Dual (Reforma Tributária - EC 132/2023)
export const ALIQUOTAS_IVA_DUAL: AliquotasIvaDual = {
  cbsPercentual: 11.3, // Contribuição sobre Bens e Serviços (União)
  ibsPercentual: 0.1,  // Imposto sobre Bens e Serviços (Estados e Municípios)
  ivaDualTotalPercentual: 11.4, // Total de tributação na liquidação
};

/**
 * Arredonda valores monetários para duas casas decimais com precisão bancária.
 */
function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Motor Financeiro de Simulação BDI & Split Payment
 * Determina o lucro líquido e o piso inviolável de lances (Stop-Loss).
 */
export function calcularSimulacaoBdi(input: SimulateBdiInput): SimulateBdiResult {
  const custoInsumos = Math.max(0, Number(input.custoInsumos) || 0);

  // Se despesas operacionais não forem passadas, adota 5% dos insumos como padrão
  const despesasOperacionais =
    input.despesasOperacionais !== undefined
      ? Math.max(0, Number(input.despesasOperacionais))
      : roundCurrency(custoInsumos * 0.05);

  const custoTotal = roundCurrency(custoInsumos + despesasOperacionais);

  // Margem pretendida (default: 15%) e margem mínima de segurança (Stop-Loss, default: 5%)
  const margemLucroDesejada = input.margemLucroDesejada !== undefined ? Number(input.margemLucroDesejada) : 15;
  const margemMinimaStopLoss = input.margemMinimaStopLoss !== undefined ? Number(input.margemMinimaStopLoss) : 5;

  const taxaIvaDual = ALIQUOTAS_IVA_DUAL.ivaDualTotalPercentual / 100; // 0.114
  const taxaMargemDesejada = margemLucroDesejada / 100;
  const taxaMargemMinima = margemMinimaStopLoss / 100;

  // Preço de venda sugerido para atingir a margem desejada:
  // Preco = CustoTotal / (1 - (Tributos + MargemDesejada))
  const divisorSugerido = 1 - (taxaIvaDual + taxaMargemDesejada);
  const precoSugeridoVenda =
    divisorSugerido > 0 ? roundCurrency(custoTotal / divisorSugerido) : roundCurrency(custoTotal * 1.35);

  // Preço Mínimo Inviolável (Stop-Loss):
  // Menor valor aceitável que ainda garante a margem de segurança mínima
  const divisorStopLoss = 1 - (taxaIvaDual + taxaMargemMinima);
  const precoMinimoStopLoss =
    divisorStopLoss > 0 ? roundCurrency(custoTotal / divisorStopLoss) : roundCurrency(custoTotal * 1.15);

  // Valor a ser avaliado (o lance proposto ou o preço sugerido por padrão)
  const bidSimulado = input.bidAmount !== undefined && input.bidAmount > 0
    ? roundCurrency(Number(input.bidAmount))
    : precoSugeridoVenda;

  // Mecanismo de Split Payment:
  // Retenção imediata pelo ente público no ato da liquidação financeira
  const retencaoCbs = roundCurrency(bidSimulado * (ALIQUOTAS_IVA_DUAL.cbsPercentual / 100));
  const retencaoIbs = roundCurrency(bidSimulado * (ALIQUOTAS_IVA_DUAL.ibsPercentual / 100));
  const totalRetidoFonte = roundCurrency(retencaoCbs + retencaoIbs);

  const splitPayment: SplitPaymentCalculado = {
    retencaoCbs,
    retencaoIbs,
    totalRetidoFonte,
  };

  // Receita líquida recebida na conta da empresa após o Split Payment
  const receitaLiquidaAposSplit = roundCurrency(bidSimulado - totalRetidoFonte);

  // Lucro líquido real da operação
  const lucroLiquido = roundCurrency(receitaLiquidaAposSplit - custoTotal);

  // Margem líquida percentual sobre o valor bruto do lance
  const margemLiquidaPercentual =
    bidSimulado > 0 ? roundCurrency((lucroLiquido / bidSimulado) * 100) : 0;

  // Violação de Stop-Loss ocorre se o lance for inferior ao piso ou se a margem for menor que o limite
  const violaStopLoss = bidSimulado < precoMinimoStopLoss || margemLiquidaPercentual < margemMinimaStopLoss;

  let statusMargem: SimulateBdiResult['statusMargem'] = 'SEGURA';
  let mensagemAuditoria = 'Margem operacional e tributária dentro dos parâmetros seguros da empresa.';

  if (lucroLiquido <= 0) {
    statusMargem = 'PREJUIZO';
    mensagemAuditoria = 'CRÍTICO: O lance resulta em prejuízo financeiro após a retenção do Split Payment.';
  } else if (violaStopLoss) {
    statusMargem = 'ALERTA';
    mensagemAuditoria = `ATENÇÃO: O lance viola a margem mínima de segurança (${margemMinimaStopLoss}%). Stop-Loss ativo em R$ ${precoMinimoStopLoss.toFixed(2)}.`;
  }

  return {
    custoInsumos,
    despesasOperacionais,
    custoTotal,
    aliquotas: ALIQUOTAS_IVA_DUAL,
    splitPayment,
    precoSugeridoVenda,
    precoMinimoStopLoss,
    bidSimulado,
    receitaLiquidaAposSplit,
    lucroLiquido,
    margemLiquidaPercentual,
    violaStopLoss,
    statusMargem,
    mensagemAuditoria,
  };
}

