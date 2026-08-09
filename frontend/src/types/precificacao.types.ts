export interface ComposicaoCustos {
  custoProdutoServico: number; // Custo de aquisição ou produção
  impostosPercentual: number;   // Ex: Simples (8.5%), Lucro Presumido (14.25%)
  custoOperacionalPercentual: number; // Frete, equipe, logística
  margemDesejadaPercentual: number;  // Margem de Lucro Alvo
}

export interface CalculoPrecoResultado {
  custoTotalFormatado: number;
  impostoValor: number;
  custoOperacionalValor: number;
  lucroEstimadoValor: number;
  precoSugeridoVenda: number;
  precoMinimoBreakeven: number; // Preço no limite de margem zero
}

export interface EstrategiaLances {
  lanceMaximoEdital: number;
  lanceInicialSugerido: number;
  degrauDecrementoMinimo: number; // Ex: R$ 50,00 por lance
  lanceMinimoSeguranca: number;  // Preço teto do robô de lances
}