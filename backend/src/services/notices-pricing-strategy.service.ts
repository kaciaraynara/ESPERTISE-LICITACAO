import { calcularViabilidade } from './viabilidade.service';
import { NoticesOpportunityScoreService } from './notices-opportunity-score.service';
import { NoticesProposalStrategyService } from './notices-proposal-strategy.service';
import { NoticesSearchService, type NoticesUserContext } from './notices-search.service';

type PricingPosition = 'conservadora' | 'competitiva' | 'agressiva';

interface PricingStrategyResult {
  noticeId: string;
  generatedAt: string;
  valorEstimado: number | null;
  custoTotalEstimado: number;
  margemDesejadaPercentual: number;
  precoMinimoSaudavel: number;
  precoSugerido: number;
  precoMaximoRecomendado: number | null;
  posicao: PricingPosition;
  viabilidade: ReturnType<typeof calcularViabilidade>;
  score: {
    valor: number;
    nivel: string;
  };
  estrategiaProposta: string;
  alertas: string[];
  recomendacoes: string[];
  observacao: string;
}

interface PricingInput {
  empresa_id?: string;
  empresaId?: string;
  custo_produto?: number;
  custoProduto?: number;
  percentual_impostos?: number;
  percentualImpostos?: number;
  custo_logistico?: number;
  custoLogistico?: number;
  taxas_administrativas?: number;
  taxasAdministrativas?: number;
  margem_desejada_percentual?: number;
  margemDesejadaPercentual?: number;
}

export class NoticesPricingStrategyService {
  constructor(
    private readonly notices = new NoticesSearchService(),
    private readonly opportunityScore = new NoticesOpportunityScoreService(),
    private readonly proposalStrategy = new NoticesProposalStrategyService(),
  ) {}

  async buildPricingStrategy(
    noticeId: string,
    input: PricingInput = {},
    context: NoticesUserContext = {},
  ): Promise<PricingStrategyResult | null> {
    const notice = await this.notices.getNoticeById(noticeId, {}, context);

    if (!notice) {
      return null;
    }

    const score = await this.opportunityScore.scoreNotice(noticeId, input, context);
    const strategy = await this.proposalStrategy.buildStrategy(noticeId, input, context);

    if (!score || !strategy) {
      return null;
    }

    const valorEstimado = pickNumber(notice, [
      'estimatedValue',
      'valorEstimado',
      'valor_estimado',
      'value',
      'valor',
    ]);

    const inputRecord = input as Record<string, unknown>;

    const custoProdutoRaw = readNumber(inputRecord, ['custo_produto', 'custoProduto']);
    const percentualImpostosRaw = readNumber(inputRecord, ['percentual_impostos', 'percentualImpostos']);
    const custoLogisticoRaw = readNumber(inputRecord, ['custo_logistico', 'custoLogistico']);
    const taxasAdministrativasRaw = readNumber(inputRecord, ['taxas_administrativas', 'taxasAdministrativas']);
    const margemDesejadaPercentualRaw = readNumber(inputRecord, [
      'margem_desejada_percentual',
      'margemDesejadaPercentual',
    ]) ?? 15;

    validateInput(
      custoProdutoRaw,
      percentualImpostosRaw,
      custoLogisticoRaw,
      taxasAdministrativasRaw,
      margemDesejadaPercentualRaw,
    );

    const custoProduto = custoProdutoRaw as number;
    const percentualImpostos = percentualImpostosRaw as number;
    const custoLogistico = custoLogisticoRaw as number;
    const taxasAdministrativas = taxasAdministrativasRaw as number;
    const margemDesejadaPercentual = margemDesejadaPercentualRaw as number;

    const custoTotalEstimado = roundMoney(
      custoProduto + custoLogistico + taxasAdministrativas,
    );

    const precoMinimoSaudavel = calcularPrecoMinimoSaudavel({
      custoProduto,
      custoLogistico,
      taxasAdministrativas,
      percentualImpostos,
      margemDesejadaPercentual,
    });

    const posicao = definirPosicao(strategy.estrategia, score.score, strategy.riscos.length);
    const precoSugerido = calcularPrecoSugerido(precoMinimoSaudavel, valorEstimado, posicao);
    const precoMaximoRecomendado = valorEstimado ? roundMoney(valorEstimado * 0.98) : null;

    const viabilidade = calcularViabilidade({
      precoLance: precoSugerido,
      custoProduto,
      percentualImpostos,
      custoLogistico,
      taxasAdministrativas,
    });

    const alertas = montarAlertas({
      precoSugerido,
      precoMinimoSaudavel,
      valorEstimado,
      margemReal: viabilidade.margemLucroRealPercentual,
      margemDesejadaPercentual,
      riscos: strategy.riscos,
    });

    return {
      noticeId,
      generatedAt: new Date().toISOString(),
      valorEstimado,
      custoTotalEstimado,
      margemDesejadaPercentual,
      precoMinimoSaudavel,
      precoSugerido,
      precoMaximoRecomendado,
      posicao,
      viabilidade,
      score: {
        valor: score.score,
        nivel: score.nivel,
      },
      estrategiaProposta: strategy.estrategia,
      alertas,
      recomendacoes: montarRecomendacoes(posicao, alertas, strategy.riscos),
      observacao:
        'Esta precificação é uma simulação estratégica inicial. Não substitui análise contábil, fiscal, tributária, operacional ou validação comercial antes do envio do lance.',
    };
  }
}

function calcularPrecoMinimoSaudavel(input: {
  custoProduto: number;
  custoLogistico: number;
  taxasAdministrativas: number;
  percentualImpostos: number;
  margemDesejadaPercentual: number;
}) {
  const custosFixos = input.custoProduto + input.custoLogistico + input.taxasAdministrativas;
  const percentualTotal = input.percentualImpostos + input.margemDesejadaPercentual;

  if (percentualTotal >= 95) {
    throw new Error('INVALID_MARGEM_DESEJADA_PERCENTUAL');
  }

  return roundMoney(custosFixos / (1 - percentualTotal / 100));
}

function definirPosicao(estrategia: string, score: number, totalRiscos: number): PricingPosition {
  if (estrategia === 'agressiva' && score >= 80 && totalRiscos <= 1) {
    return 'agressiva';
  }

  if (estrategia === 'conservadora' || score < 55 || totalRiscos >= 3) {
    return 'conservadora';
  }

  return 'competitiva';
}

function calcularPrecoSugerido(
  precoMinimoSaudavel: number,
  valorEstimado: number | null,
  posicao: PricingPosition,
) {
  if (!valorEstimado || valorEstimado <= 0) {
    return precoMinimoSaudavel;
  }

  const fatorPorPosicao: Record<PricingPosition, number> = {
    agressiva: 0.88,
    competitiva: 0.93,
    conservadora: 0.97,
  };

  const tetoEstrategico = valorEstimado * fatorPorPosicao[posicao];

  return roundMoney(Math.max(precoMinimoSaudavel, tetoEstrategico));
}

function montarAlertas(input: {
  precoSugerido: number;
  precoMinimoSaudavel: number;
  valorEstimado: number | null;
  margemReal: number;
  margemDesejadaPercentual: number;
  riscos: string[];
}) {
  const alertas: string[] = [];

  if (input.valorEstimado && input.precoSugerido > input.valorEstimado) {
    alertas.push('Preço sugerido ficou acima do valor estimado do edital.');
  }

  if (input.precoSugerido <= input.precoMinimoSaudavel) {
    alertas.push('Preço sugerido está no limite mínimo saudável calculado.');
  }

  if (input.margemReal < input.margemDesejadaPercentual) {
    alertas.push('Margem real ficou abaixo da margem desejada.');
  }

  if (input.margemReal < 10) {
    alertas.push('Margem real abaixo de 10%, considerada sensível para execução.');
  }

  if (input.riscos.length > 0) {
    alertas.push('Existem riscos estratégicos que devem ser revisados antes do lance.');
  }

  return Array.from(new Set(alertas));
}

function montarRecomendacoes(posicao: PricingPosition, alertas: string[], riscos: string[]) {
  const recomendacoes: string[] = [];

  if (posicao === 'agressiva') {
    recomendacoes.push('Usar preço competitivo para aumentar chance de classificação, sem ultrapassar o limite mínimo saudável.');
  }

  if (posicao === 'competitiva') {
    recomendacoes.push('Buscar equilíbrio entre competitividade, margem e segurança operacional.');
  }

  if (posicao === 'conservadora') {
    recomendacoes.push('Preservar margem e evitar lance muito baixo enquanto houver riscos relevantes.');
  }

  if (alertas.length > 0) {
    recomendacoes.push('Revisar alertas financeiros antes de confirmar a proposta.');
  }

  if (riscos.length > 0) {
    recomendacoes.push('Cruzar a precificação com o Radar de Erros e a Proposta Estratégica.');
  }

  recomendacoes.push('Validar impostos, custos logísticos, taxas e margem com contador ou responsável financeiro.');

  return Array.from(new Set(recomendacoes));
}

function validateInput(
  custoProduto: number | null,
  percentualImpostos: number | null,
  custoLogistico: number | null,
  taxasAdministrativas: number | null,
  margemDesejadaPercentual: number | null,
) {
  if (!Number.isFinite(custoProduto) || Number(custoProduto) < 0) {
    throw new Error('INVALID_CUSTO_PRODUTO');
  }

  if (!Number.isFinite(percentualImpostos) || Number(percentualImpostos) < 0 || Number(percentualImpostos) > 100) {
    throw new Error('INVALID_PERCENTUAL_IMPOSTOS');
  }

  if (!Number.isFinite(custoLogistico) || Number(custoLogistico) < 0) {
    throw new Error('INVALID_CUSTO_LOGISTICO');
  }

  if (!Number.isFinite(taxasAdministrativas) || Number(taxasAdministrativas) < 0) {
    throw new Error('INVALID_TAXAS_ADMINISTRATIVAS');
  }

  if (!Number.isFinite(margemDesejadaPercentual) || Number(margemDesejadaPercentual) < 0 || Number(margemDesejadaPercentual) >= 95) {
    throw new Error('INVALID_MARGEM_DESEJADA_PERCENTUAL');
  }
}

function readNumber(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function pickNumber(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
