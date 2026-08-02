export interface CalculoViabilidadeInput {
  precoLance: number;
  custoProduto: number;
  percentualImpostos: number;
  custoLogistico: number;
  taxasAdministrativas: number;
}

export interface EtapaViabilidade {
  ordem: number;
  descricao: string;
  valorSubtraido: number;
  saldo: number;
}

export interface CalculoViabilidadeResultado {
  baseCalculo: number;
  precoLance: number;
  custoProduto: number;
  impostosValor: number;
  custoLogistico: number;
  taxasAdministrativas: number;
  margemLucroRealValor: number;
  margemLucroRealPercentual: number;
  margemSaudavel: boolean;
  etapas: EtapaViabilidade[];
}

export function calcularViabilidade(input: CalculoViabilidadeInput): CalculoViabilidadeResultado {
  validatePositive(input.precoLance, 'INVALID_PRECO_LANCE');
  validateNonNegative(input.custoProduto, 'INVALID_CUSTO_PRODUTO');
  validatePercent(input.percentualImpostos);
  validateNonNegative(input.custoLogistico, 'INVALID_CUSTO_LOGISTICO');
  validateNonNegative(input.taxasAdministrativas, 'INVALID_TAXAS_ADMINISTRATIVAS');

  const baseCalculo = roundMoney(input.precoLance);
  const custoProduto = roundMoney(input.custoProduto);
  const impostosValor = roundMoney(baseCalculo * (input.percentualImpostos / 100));
  const saldoAposProduto = roundMoney(baseCalculo - custoProduto);
  const saldoAposImpostos = roundMoney(saldoAposProduto - impostosValor);
  const saldoAposLogistica = roundMoney(saldoAposImpostos - input.custoLogistico);
  const margemLucroRealValor = roundMoney(saldoAposLogistica - input.taxasAdministrativas);
  const margemLucroRealPercentual = roundPercent((margemLucroRealValor / baseCalculo) * 100);

  return {
    baseCalculo,
    precoLance: baseCalculo,
    custoProduto,
    impostosValor,
    custoLogistico: roundMoney(input.custoLogistico),
    taxasAdministrativas: roundMoney(input.taxasAdministrativas),
    margemLucroRealValor,
    margemLucroRealPercentual,
    margemSaudavel: margemLucroRealPercentual >= 10,
    etapas: [
      {
        ordem: 1,
        descricao: 'Subtracao do custo do produto',
        valorSubtraido: custoProduto,
        saldo: saldoAposProduto,
      },
      {
        ordem: 2,
        descricao: 'Subtração dos impostos sobre o valor base',
        valorSubtraido: impostosValor,
        saldo: saldoAposImpostos,
      },
      {
        ordem: 3,
        descricao: 'Subtração do custo logístico',
        valorSubtraido: roundMoney(input.custoLogistico),
        saldo: saldoAposLogistica,
      },
      {
        ordem: 4,
        descricao: 'Subtração das taxas administrativas',
        valorSubtraido: roundMoney(input.taxasAdministrativas),
        saldo: margemLucroRealValor,
      },
    ],
  };
}

function validatePositive(value: number, errorCode: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(errorCode);
  }
}

function validateNonNegative(value: number, errorCode: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(errorCode);
  }
}

function validatePercent(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('INVALID_PERCENTUAL_IMPOSTOS');
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
