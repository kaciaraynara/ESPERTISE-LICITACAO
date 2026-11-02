import { LexIntent } from '../types/lex.types';

export interface LexClassifiedIntent {
  intent: LexIntent;
  confidence: number;
  requiresCalculation: boolean;
  calculationType?: 'prazo_impugnacao' | 'prazo_recurso' | 'bdi';
  requiresNoticeContext: boolean;
  keywords: string[];
}

export class LexIntentService {
  static classify(question: string): LexClassifiedIntent {
    const text = (question || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!text || text.length < 5) {
      return {
        intent: 'INSUFICIENTE_OU_FORA_DE_ESCOPO',
        confidence: 0.9,
        requiresCalculation: false,
        requiresNoticeContext: false,
        keywords: [],
      };
    }

    // 1. Cálculos de Prazos ou Valores
    const hasImpugnacaoPrazo = (
      (text.includes('prazo') || text.includes('quando') || text.includes('tempo') || text.includes('ate que dia')) &&
      (text.includes('impugna') || text.includes('impugnacao') || text.includes('esclarecimento'))
    );

    if (hasImpugnacaoPrazo) {
      return {
        intent: 'CALCULO_PRAZO_VALOR',
        confidence: 0.95,
        requiresCalculation: true,
        calculationType: 'prazo_impugnacao',
        requiresNoticeContext: true,
        keywords: ['prazo', 'impugnacao', 'esclarecimento', 'artigo 164', 'dias uteis'],
      };
    }

    const hasRecursoPrazo = (
      (text.includes('prazo') || text.includes('quando') || text.includes('tempo')) &&
      (text.includes('recurso') || text.includes('contra-razoes') || text.includes('intencao de recurso'))
    );

    if (hasRecursoPrazo) {
      return {
        intent: 'CALCULO_PRAZO_VALOR',
        confidence: 0.95,
        requiresCalculation: true,
        calculationType: 'prazo_recurso',
        requiresNoticeContext: true,
        keywords: ['prazo', 'recurso', 'razoes', 'artigo 165'],
      };
    }

    const hasBdiOuCalculo = (
      text.includes('calcular bdi') ||
      text.includes('calculo do bdi') ||
      text.includes('formula do bdi') ||
      text.includes('planilha de custos')
    );

    if (hasBdiOuCalculo) {
      return {
        intent: 'CALCULO_PRAZO_VALOR',
        confidence: 0.95,
        requiresCalculation: true,
        calculationType: 'bdi',
        requiresNoticeContext: false,
        keywords: ['bdi', 'calculo', 'tcu', 'planilha de custos'],
      };
    }

    // 2. Análise Concorrencial / Sócios / Conluio
    const hasConcorrencial = (
      text.includes('socio') ||
      text.includes('socios em comum') ||
      text.includes('concorrente') ||
      text.includes('parentesco') ||
      text.includes('mesmo endereco') ||
      text.includes('mesmo ip') ||
      text.includes('cartel') ||
      text.includes('conluio')
    );

    if (hasConcorrencial) {
      return {
        intent: 'ANALISE_CONCORRENCIAL',
        confidence: 0.88,
        requiresCalculation: false,
        requiresNoticeContext: true,
        keywords: ['quadro societario', 'concorrentes', 'sobreposicao', 'indicio'],
      };
    }

    // 3. Riscos de Impugnação e Recursos
    const hasImpugnacaoOuRecurso = (
      text.includes('impugna') ||
      text.includes('recurso') ||
      text.includes('clausula restritiva') ||
      text.includes('direcionamento') ||
      text.includes('anular edital') ||
      text.includes('desclassificacao')
    );

    if (hasImpugnacaoOuRecurso) {
      return {
        intent: 'RISCO_IMPUGNACAO_RECURSO',
        confidence: 0.85,
        requiresCalculation: false,
        requiresNoticeContext: true,
        keywords: ['impugnacao', 'recurso', 'restritividade', 'risco'],
      };
    }

    // 4. Habilitação e Documentação
    const hasHabilitacao = (
      text.includes('habilitacao') ||
      text.includes('certidao') ||
      text.includes('atestado') ||
      text.includes('qualificacao tecnica') ||
      text.includes('balanco') ||
      text.includes('patrimonio liquido') ||
      text.includes('sicaf')
    );

    if (hasHabilitacao) {
      return {
        intent: 'ANALISE_HABILITACAO',
        confidence: 0.85,
        requiresCalculation: false,
        requiresNoticeContext: true,
        keywords: ['habilitacao', 'documentos', 'artigo 62', 'qualificacao'],
      };
    }

    // 5. Esclarecimento de Edital
    const hasEdital = (
      text.includes('edital') ||
      text.includes('objeto') ||
      text.includes('valor estimado') ||
      text.includes('anexo') ||
      text.includes('termo de referencia') ||
      text.includes('pregao') ||
      text.includes('concorrencia') ||
      text.includes('lote') ||
      text.includes('item')
    );

    if (hasEdital) {
      return {
        intent: 'ESCLARECIMENTO_EDITAL',
        confidence: 0.8,
        requiresCalculation: false,
        requiresNoticeContext: true,
        keywords: ['edital', 'objeto', 'exigencias', 'itens'],
      };
    }

    // 6. Geral / Normativa
    const hasNormativa = (
      text.includes('lei 14.133') ||
      text.includes('14133') ||
      text.includes('tcu') ||
      text.includes('sumula') ||
      text.includes('acordao') ||
      text.includes('dispensa') ||
      text.includes('inexigibilidade') ||
      text.includes('contrato administrativo')
    );

    if (hasNormativa) {
      return {
        intent: 'GERAL_NORMATIVA',
        confidence: 0.75,
        requiresCalculation: false,
        requiresNoticeContext: false,
        keywords: ['lei 14.133/2021', 'doutrina', 'jurisprudencia tcu'],
      };
    }

    return {
      intent: 'GERAL_NORMATIVA',
      confidence: 0.6,
      requiresCalculation: false,
      requiresNoticeContext: false,
      keywords: ['licitacao', 'direito publico'],
    };
  }
}
