import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import { SYSTEM_PROMPT_LEX } from './lex-prompt';
import { LexIntentService, LexClassifiedIntent } from './lex-intent.service';
import { LexCalculadoraService } from './lex-calculadora.service';
import { LexMinimizationService } from './lex-minimization.service';
import { preencherTextoEditalAutomaticamente } from './pncp-parser.service';
import {
  LexEpistemicCategory,
  LexEvidenceItem,
  LexDeterministicCalculation,
  LexCertaintyLevel,
  LexResponsePayload,
} from '../types/lex.types';
import {
  MissingApiKeyError,
  AiTimeoutError,
  ProviderUnavailableError,
} from './ai.service';

export const AI_GROUNDING_BLOCKED_MESSAGE =
  'Não há dados suficientes na base para análise confiável.';

export const AI_INCONCLUSIVE_MESSAGE =
  'Com base nas fontes atualmente disponíveis no sistema, não foi possível concluir esta análise de forma definitiva. Indique os documentos complementares ou consulte os dados faltantes.';

type GroundingAIMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type ProviderRunner = (
  messages: GroundingAIMessage[],
  options?: {
    timeoutMs?: number;
    modelName?: string;
    onChunk?: (chunk: string) => void | Promise<void>;
  }
) => Promise<{ content: string; provider: string }>;

export interface AiGroundingUserContext {
  tenantId?: string | null;
  user?: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    isAdmin?: boolean;
    permissions?: string[];
  };
  requestId?: string | string[] | null;
  ip?: string | null;
  userAgent?: string | string[] | null;
}

export interface AiGroundingInput {
  pergunta: string;
  contexto?: string | null;
  noticeId?: string | null;
  purpose?: string;
  metadata?: Record<string, unknown>;
  options?: {
    timeoutMs?: number;
    modelName?: string;
    skipCalculation?: boolean;
    onChunk?: (chunk: string) => void | Promise<void>;
  };
  conversationContext?: string;
  providedDocumentText?: string;
}

export interface GroundingCitation {
  sourceType: string;
  sourceId: string;
  chunkId?: string | null;
  ruleCode?: string | null;
  citationType: string;
  label?: string | null;
  excerpt: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  tipoEpistemico?: LexEpistemicCategory;
}

export interface AiGroundedResponse extends LexResponsePayload {
  content: string; // compatibilidade com código legado
  blocked: boolean;
  citations: GroundingCitation[];
  sourceIds: string[];
  chunkIds: string[];
  ruleCodes: string[];
  confidence: number;
  limitations: string[];
  legalAnalysisId?: string | null;
}

interface RetrievalResult {
  notices: any[];
  chunks: any[];
  rules: any[];
  sourceIds: string[];
  chunkIds: string[];
  ruleCodes: string[];
  context: Record<string, unknown>;
  limitations: string[];
  unauthorizedNoticeRequested?: boolean;
}

const MAX_NOTICES = 3;
const MAX_CHUNKS = 8;
const MAX_RULES = 8;
const MAX_CITATIONS = 10;
const QUERY_LIMIT = 2000;
const CONTEXT_QUERY_LIMIT = 1200;
const EXCERPT_LIMIT = 600;

const BASE_LIMITATIONS = [
  'Resposta limitada às fontes recuperadas e autorizadas do banco de dados do EXPERTISE.',
  'Não afirma ilegalidade, crime, fraude ou conclusão jurídica definitiva.',
  'Não substitui revisão jurídica humana nem leitura integral do edital e anexos.',
];

export class AiGroundingService {
  constructor(
    private readonly client: any = prisma as any,
    private readonly providerRunner?: ProviderRunner,
  ) {}

  /**
   * Executa o fluxo completo do LEX em 7 etapas conceituais:
   * 1. Classificar a intenção da pergunta;
   * 2. Consultar dados autorizados do sistema (com estrito isolamento multi-tenant);
   * 3. Recuperar evidências com fonte, identificador e trecho relevante;
   * 4. Executar cálculos determinísticos fora do LLM sempre que possível;
   * 5. Passar ao modelo somente o contexto mínimo necessário (com minimização de dados);
   * 6. Validar a resposta contra as evidências recuperadas;
   * 7. Retornar resposta, fontes, data de consulta, limitações e nível de certeza.
   */
  async runLex(
    input: AiGroundingInput,
    context: AiGroundingUserContext = {},
  ): Promise<AiGroundedResponse> {
    const pergunta = safeString(input.pergunta, QUERY_LIMIT);
    if (!pergunta) throw new Error('PERGUNTA_OBRIGATORIA');

    const tenantId = normalizeNullableString(context.tenantId, 120);
    const purpose = safeString(input.purpose, 120) ?? 'lex_grounded_response';

    // ETAPA 1: Classificar a intenção da pergunta
    const intentClassification = LexIntentService.classify(pergunta);

    const aiRun = await this.client.aiRun.create({
      data: {
        tenantId,
        userId: normalizeNullableString(context.user?.id, 120),
        requestId: normalizeHeader(context.requestId),
        purpose,
        status: 'started',
        question: pergunta,
        limitations: BASE_LIMITATIONS,
        metadata: sanitizeMetadata({
          actorRole: context.user?.role ?? null,
          intent: intentClassification.intent,
          requiresCalculation: intentClassification.requiresCalculation,
          inputMetadata: input.metadata ?? null,
        }),
      },
    });

    await this.auditAi(
      'ai_run_started',
      'success',
      context,
      {
        purpose,
        intent: intentClassification.intent,
        noticeId: normalizeNullableString(input.noticeId, 120),
      },
      'ai_run',
      aiRun.id,
    );

    let retrievalSessionId: string | null = null;

    try {
      // ETAPA 2 & 3: Consultar dados autorizados e recuperar evidências
      const retrievalSession = await this.client.aiRetrievalSession.create({
        data: {
          aiRunId: aiRun.id,
          tenantId,
          query: buildRetrievalQuery(input),
          status: 'running',
          retrievalMode: 'postgres_text_grounded',
          limitations: BASE_LIMITATIONS,
        },
      });
      retrievalSessionId = retrievalSession.id;

      const retrieval = await this.retrieve(input, context, intentClassification);
      const providedDocumentText = safeString(input.providedDocumentText, 8000);
      if (providedDocumentText) {
        const sourceId = `user-provided-${createHash('sha256')
          .update(providedDocumentText)
          .digest('hex')
          .slice(0, 16)}`;
        const chunkId = `${sourceId}-chunk`;
        retrieval.chunks.unshift({
          id: chunkId,
          sourceId,
          sourceType: 'user_provided_document',
          chunkIndex: 0,
          content: providedDocumentText,
        });
        retrieval.chunkIds.unshift(chunkId);
        retrieval.limitations.push(
          'O documento fornecido pelo usuário não foi verificado em fonte oficial.',
        );
      }

      // Tratamento de segurança: se o usuário solicitou edital pertencente a outro tenant
      if (retrieval.unauthorizedNoticeRequested) {
        return this.respondUnauthorizedDocument(
          aiRun.id,
          retrievalSessionId,
          context,
          input.noticeId!,
          intentClassification.intent,
        );
      }

      // ETAPA 4: Executar cálculos determinísticos fora do LLM
      const calculos = this.executeDeterministicCalculations(
        intentClassification,
        retrieval,
        input,
      );

      // Constrói itens de evidência e citações tipadas
      const citations = this.buildCitations(retrieval, calculos);

      // Validação de evidências suficientes
      const hasSufficientEvidence = citations.length > 0;

      // Se evidência for insuficiente, responde INCONCLUSIVO de forma estruturada (sem alucinar)
      if (!hasSufficientEvidence) {
        return this.respondInconclusive(
          aiRun.id,
          retrievalSessionId,
          context,
          retrieval,
          intentClassification.intent,
          [
            'Edital ou anexos técnicos correspondentes não encontrados na base.',
            'Regras jurídicas aplicáveis não foram localizadas.',
          ],
        );
      }

      // Validação formal de grounding
      const validation = validateGrounding(retrieval, citations, retrievalSessionId);
      const confidence = validation.ok ? calculateConfidence(retrieval, calculos) : 0;
      const limitations = buildLimitations(retrieval, validation.reasons);

      await this.client.aiRetrievalSession.update({
        where: { id: retrievalSessionId },
        data: {
          status: validation.ok ? 'completed' : 'blocked',
          sourcesFound: retrieval.sourceIds.length,
          chunksFound: retrieval.chunkIds.length,
          rulesFound: retrieval.ruleCodes.length,
          sourceIds: retrieval.sourceIds,
          chunkIds: retrieval.chunkIds,
          ruleCodes: retrieval.ruleCodes,
          context: sanitizeMetadata(retrieval.context),
          limitations,
          completedAt: new Date(),
        },
      });

      if (!validation.ok) {
        return this.blockRun(
          aiRun.id,
          retrievalSessionId,
          context,
          validation.reasons,
          retrieval,
          limitations,
          intentClassification.intent,
        );
      }

      if (!this.providerRunner) {
        throw new Error('AI_PROVIDER_RUNNER_REQUIRED');
      }

      // ETAPA 5: Passar ao modelo somente o contexto mínimo necessário (com minimização)
      const prompt = buildGroundedPrompt(
        pergunta,
        retrieval,
        citations,
        calculos,
        input.conversationContext,
      );

      // Chamada resiliente com timeout e modelo configurável
      const generated = await this.providerRunner(
        [
          { role: 'system', content: groundedSystemPrompt(input.purpose) },
          { role: 'user', content: prompt },
        ],
        {
          timeoutMs: input.options?.timeoutMs,
          modelName: input.options?.modelName,
          onChunk: input.options?.onChunk,
        },
      );

      // ETAPA 6: Validar resposta contra evidências recuperadas
      const unsafeAssertionDetected = containsUnsafeAssertion(generated.content);
      const responseText = unsafeAssertionDetected
        ? sanitizeUnsafeAssertion(generated.content)
        : generated.content;

      const completedRetrievalSessionId = retrievalSessionId as string;
      await this.persistCitations(aiRun.id, completedRetrievalSessionId, citations);

      const legalAnalysis = await this.persistLegalAnalysis(
        aiRun.id,
        responseText,
        citations,
        retrieval,
        confidence,
        limitations,
        context,
        purpose,
      );

      await this.client.aiRun.update({
        where: { id: aiRun.id },
        data: {
          status: 'completed',
          provider: generated.provider,
          prompt,
          response: responseText,
          sourceIds: retrieval.sourceIds,
          chunkIds: retrieval.chunkIds,
          ruleCodes: retrieval.ruleCodes,
          confidence,
          limitations,
          completedAt: new Date(),
        },
      });

      await this.auditAi(
        'ai_run_completed',
        'success',
        context,
        {
          purpose,
          provider: generated.provider,
          intent: intentClassification.intent,
          citationsCount: citations.length,
          calculosCount: calculos.length,
          confidence,
          legalAnalysisId: legalAnalysis?.id ?? null,
        },
        'ai_run',
        aiRun.id,
      );

      // ETAPA 7: Retornar resposta, fontes, data de consulta, limitações e nível de certeza
      const fontes: LexEvidenceItem[] = citations.map((c) => ({
        fonte: c.label || c.sourceType,
        identificador: c.chunkId || c.ruleCode || c.sourceId,
        trechoRelevante: c.excerpt,
        tipoEpistemico: c.tipoEpistemico || 'Fato da fonte',
        confianca: c.confidence,
        metadata: c.metadata,
      }));

      const nivelCerteza: LexCertaintyLevel =
        confidence >= 0.75 ? 'alto' : confidence >= 0.5 ? 'medio' : 'baixo';

      const distribuicaoEpistemica = computeEpistemicDistribution(fontes, calculos);

      return {
        aiRunId: aiRun.id,
        retrievalSessionId,
        legalAnalysisId: legalAnalysis?.id ?? null,
        resposta: responseText,
        content: responseText,
        provider: generated.provider,
        blocked: false,
        status: 'sucesso',
        intencao: intentClassification.intent,
        fontes,
        calculos,
        dataConsulta: new Date().toISOString(),
        limitacoes: limitations,
        limitations,
        nivelCerteza,
        distribuicaoEpistemica,
        citations,
        sourceIds: retrieval.sourceIds,
        chunkIds: retrieval.chunkIds,
        ruleCodes: retrieval.ruleCodes,
        confidence,
      };
    } catch (error: any) {
      await this.client.aiRun.update({
        where: { id: aiRun.id },
        data: {
          status: 'failed',
          failureReason: safeString(error?.message, 1000) ?? 'ai_run_failed',
          failedAt: new Date(),
        },
      });

      if (retrievalSessionId) {
        await this.client.aiRetrievalSession.update({
          where: { id: retrievalSessionId },
          data: {
            status: 'failed',
            limitations: ['Falha na comunicação com serviço de inteligência.'],
            completedAt: new Date(),
          },
        });
      }

      await this.auditAi(
        'ai_run_failed',
        'failure',
        context,
        {
          errorCode: error?.code || 'UNKNOWN_ERROR',
          reason: safeString(error?.message, 500) ?? 'ai_run_failed',
        },
        'ai_run',
        aiRun.id,
      );

      throw error;
    }
  }

  private async retrieve(
    input: AiGroundingInput,
    context: AiGroundingUserContext,
    intent: LexClassifiedIntent,
  ): Promise<RetrievalResult> {
    const tenantId = normalizeNullableString(context.tenantId, 120);
    const query = buildRetrievalQuery(input);
    const keywords = extractKeywords(query);
    const requestedNoticeId = normalizeNullableString(input.noticeId, 120);

    let unauthorizedNoticeRequested = false;

    // Se o usuário solicitou um edital específico, verifica visibilidade autorizada
    let requestedNoticeWhere: any = null;
    if (requestedNoticeId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestedNoticeId,
      );

      const noticeMatch = isUuid
        ? { OR: [{ id: requestedNoticeId }, { externalId: requestedNoticeId }, { noticeNumber: requestedNoticeId }] }
        : { OR: [{ externalId: requestedNoticeId }, { noticeNumber: requestedNoticeId }] };

      // Verifica se o edital existe em outro tenant
      const rawNotice = await this.client.procurementNotice.findFirst({
        where: noticeMatch,
        select: { id: true, tenantId: true },
      });

      if (rawNotice && rawNotice.tenantId && rawNotice.tenantId !== tenantId) {
        // Documento pertence a outro tenant -> ACESSO NÃO AUTORIZADO
        unauthorizedNoticeRequested = true;
        return {
          notices: [],
          chunks: [],
          rules: [],
          sourceIds: [],
          chunkIds: [],
          ruleCodes: [],
          context: {},
          limitations: ['Acesso ao documento não autorizado.'],
          unauthorizedNoticeRequested: true,
        };
      }

      requestedNoticeWhere = noticeMatch;
    }

    let notices: any[] = requestedNoticeWhere
      ? await this.client.procurementNotice.findMany({
          where: {
            AND: [tenantVisibilityWhere(tenantId), requestedNoticeWhere],
          },
          take: 1,
          select: retrievalNoticeSelect(),
        })
      : await this.findNoticesByQuery(keywords, tenantId);

    let chunks: any[] = notices.length
      ? await this.findChunksByNoticeIds(notices.map((n) => n.id), tenantId)
      : [];

    if (!chunks.length && (requestedNoticeId || notices.length > 0)) {
      const targetNoticeId = notices[0]?.id || requestedNoticeId;
      try {
        const autoText = await preencherTextoEditalAutomaticamente(targetNoticeId);
        if (!notices.length && requestedNoticeId) {
          notices = await this.client.procurementNotice.findMany({
            where: {
              AND: [
                tenantVisibilityWhere(tenantId),
                {
                  OR: [
                    { id: targetNoticeId },
                    { externalId: targetNoticeId },
                    { dedupeKey: `pncp-${targetNoticeId}` },
                    { noticeNumber: targetNoticeId },
                  ],
                },
              ],
            },
            take: 1,
            select: retrievalNoticeSelect(),
          });
        }
        if (notices.length) {
          chunks = await this.findChunksByNoticeIds(notices.map((n) => n.id), tenantId);
        }
        if (!chunks.length && autoText) {
          chunks = [{
            id: `auto-${targetNoticeId}`,
            tenantId,
            sourceType: 'procurement_notice',
            sourceId: targetNoticeId,
            chunkIndex: 0,
            content: autoText,
            tokenCount: Math.ceil(autoText.length / 4),
            metadata: { autoExtracted: true },
            createdAt: new Date(),
          }];
        }
      } catch (autoErr: any) {
        console.warn('[AI Grounding] Falha ao extrair texto do edital automaticamente:', autoErr.message);
      }
    }

    if (!chunks.length && !requestedNoticeId) {
      chunks = await this.findChunksByQuery(keywords, tenantId);
      const chunkNoticeIds = unique(
        chunks
          .filter((c) => c.sourceType === 'procurement_notice')
          .map((c) => String(c.sourceId)),
      );
      if (chunkNoticeIds.length) {
        notices = await this.findNoticesByIds(chunkNoticeIds, tenantId);
      }
    }

    const rules: any[] = await this.findRules(tenantId);
    const sourceIds = unique([
      ...notices.map((n) => String(n.id)),
      ...chunks.filter((c) => c.sourceType === 'procurement_notice').map((c) => String(c.sourceId)),
    ]);
    const chunkIds = unique(chunks.map((c) => String(c.id)));
    const ruleCodes = unique(rules.map((r) => String(r.code)).filter(Boolean));

    return {
      notices,
      chunks,
      rules,
      sourceIds,
      chunkIds,
      ruleCodes,
      context: {
        retrievalMode: 'postgres_text_grounded',
        requestedNoticeId,
        keywords,
        notices: notices.map(mapNoticeContext),
        chunks: chunks.map(mapChunkContext),
        rules: rules.map(mapRuleContext),
      },
      limitations: BASE_LIMITATIONS,
      unauthorizedNoticeRequested,
    };
  }

  private executeDeterministicCalculations(
    intent: LexClassifiedIntent,
    retrieval: RetrievalResult,
    input: AiGroundingInput,
  ): LexDeterministicCalculation[] {
    const calculos: LexDeterministicCalculation[] = [];
    const notice = retrieval.notices[0];

    // Cálculo de Prazo de Impugnação
    if (intent.calculationType === 'prazo_impugnacao' || intent.intent === 'CALCULO_PRAZO_VALOR') {
      const dataAbertura = notice?.openingAt || notice?.publishedAt;
      if (dataAbertura) {
        calculos.push(LexCalculadoraService.calcularPrazoImpugnacao(dataAbertura));
      }
    }

    // Cálculo de Prazo de Recurso
    if (intent.calculationType === 'prazo_recurso') {
      const dataRef = notice?.closingAt || new Date();
      calculos.push(LexCalculadoraService.calcularPrazoRecurso(dataRef));
    }

    return calculos;
  }

  private async findNoticesByQuery(keywords: string[], tenantId: string | null) {
    if (!keywords.length) return [];
    return this.client.procurementNotice.findMany({
      where: {
        AND: [
          tenantVisibilityWhere(tenantId),
          {
            OR: keywords.flatMap((keyword) => [
              { object: { contains: keyword, mode: 'insensitive' } },
              { noticeNumber: { contains: keyword, mode: 'insensitive' } },
              { buyerName: { contains: keyword, mode: 'insensitive' } },
              { externalId: { contains: keyword, mode: 'insensitive' } },
            ]),
          },
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: MAX_NOTICES,
      select: retrievalNoticeSelect(),
    });
  }

  private async findNoticesByIds(ids: string[], tenantId: string | null) {
    if (!ids.length) return [];
    return this.client.procurementNotice.findMany({
      where: {
        AND: [tenantVisibilityWhere(tenantId), { id: { in: ids.slice(0, MAX_NOTICES) } }],
      },
      take: MAX_NOTICES,
      select: retrievalNoticeSelect(),
    });
  }

  private async findChunksByNoticeIds(noticeIds: string[], tenantId: string | null) {
    if (!noticeIds.length) return [];
    return this.client.documentChunk.findMany({
      where: {
        AND: [
          tenantVisibilityWhere(tenantId),
          { sourceType: 'procurement_notice' },
          { sourceId: { in: noticeIds.slice(0, MAX_NOTICES) } },
        ],
      },
      orderBy: [{ sourceId: 'asc' }, { chunkIndex: 'asc' }],
      take: MAX_CHUNKS,
      select: retrievalChunkSelect(),
    });
  }

  private async findChunksByQuery(keywords: string[], tenantId: string | null) {
    if (!keywords.length) return [];
    return this.client.documentChunk.findMany({
      where: {
        AND: [
          tenantVisibilityWhere(tenantId),
          { sourceType: 'procurement_notice' },
          {
            OR: keywords.map((keyword) => ({
              content: { contains: keyword, mode: 'insensitive' },
            })),
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_CHUNKS,
      select: retrievalChunkSelect(),
    });
  }

  private async findRules(tenantId: string | null) {
    return this.client.legalRule.findMany({
      where: tenantId
        ? { active: true, workflowStatus: 'active', OR: [{ tenantId: null }, { tenantId }] }
        : { active: true, workflowStatus: 'active', tenantId: null },
      orderBy: [{ category: 'asc' }, { code: 'asc' }, { version: 'desc' }],
      take: MAX_RULES,
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        description: true,
        severity: true,
        category: true,
        legalBasis: true,
        version: true,
        criteria: true,
        alertMessage: true,
        recommendation: true,
      },
    });
  }

  private buildCitations(
    retrieval: RetrievalResult,
    calculos: LexDeterministicCalculation[],
  ): GroundingCitation[] {
    const chunkCitations = retrieval.chunks.slice(0, MAX_CITATIONS).map((chunk): GroundingCitation => {
      const notice = retrieval.notices.find((item) => item.id === chunk.sourceId);
      return {
        sourceType: chunk.sourceType,
        sourceId: String(chunk.sourceId),
        chunkId: String(chunk.id),
        citationType: 'chunk',
        label: chunk.sourceType === 'user_provided_document'
          ? 'Documento fornecido pelo usuário (não verificado em fonte oficial)'
          : buildNoticeLabel(notice, chunk),
        excerpt: LexMinimizationService.minimizeExcerpt(chunk.content, EXCERPT_LIMIT),
        confidence: 0.88,
        tipoEpistemico: 'Fato da fonte',
        metadata: sanitizeMetadata({
          chunkIndex: chunk.chunkIndex,
          tokenCount: chunk.tokenCount ?? null,
          noticeNumber: notice?.noticeNumber ?? null,
          source: notice?.source ?? null,
        }),
      };
    });

    const ruleCitations = retrieval.rules
      .slice(0, Math.max(0, MAX_CITATIONS - chunkCitations.length))
      .map((rule): GroundingCitation => ({
        sourceType: 'legal_rule',
        sourceId: String(rule.id),
        ruleCode: String(rule.code),
        citationType: 'legal_rule',
        label: `${rule.code} - ${rule.name}`,
        excerpt: LexMinimizationService.minimizeExcerpt(
          `${rule.description}\n${rule.alertMessage}\n${rule.recommendation}`,
          EXCERPT_LIMIT,
        ),
        confidence: 0.82,
        tipoEpistemico: 'Indício',
        metadata: sanitizeMetadata({
          severity: rule.severity,
          category: rule.category,
          version: rule.version,
        }),
      }));

    const calculoCitations = calculos.map((calc, index): GroundingCitation => ({
      sourceType: 'deterministic_calculation',
      sourceId: `calc-${calc.tipo}-${index}`,
      citationType: 'calculation',
      label: `Cálculo Determinístico (${calc.tipo})`,
      excerpt: calc.descricao,
      confidence: 1.0,
      tipoEpistemico: 'Cálculo reproduzível',
      metadata: sanitizeMetadata({
        formula: calc.formula,
        fundamentacaoLegal: calc.fundamentacaoLegal,
        resultado: calc.resultado,
      }),
    }));

    return [...calculoCitations, ...chunkCitations, ...ruleCitations];
  }

  private respondUnauthorizedDocument(
    aiRunId: string,
    retrievalSessionId: string | null,
    context: AiGroundingUserContext,
    noticeId: string,
    intent: any,
  ): AiGroundedResponse {
    const message =
      'Acesso ao documento não autorizado ou o identificador pertence a outra organização.';

    return {
      aiRunId,
      retrievalSessionId,
      resposta: message,
      content: message,
      provider: null,
      blocked: true,
      status: 'bloqueado',
      intencao: intent,
      fontes: [],
      calculos: [],
      dataConsulta: new Date().toISOString(),
      limitacoes: ['Isolamento multi-tenant: documento não pertence à organização autenticada.'],
      limitations: ['Isolamento multi-tenant: documento não pertence à organização autenticada.'],
      nivelCerteza: 'inconclusivo',
      distribuicaoEpistemica: {
        fatos: 0,
        calculos: 0,
        indicios: 0,
        hipoteses: 0,
        inconclusivo: true,
      },
      citations: [],
      sourceIds: [],
      chunkIds: [],
      ruleCodes: [],
      confidence: 0,
      legalAnalysisId: null,
    };
  }

  private async respondInconclusive(
    aiRunId: string,
    retrievalSessionId: string | null,
    context: AiGroundingUserContext,
    retrieval: RetrievalResult,
    intent: any,
    dadosFaltantes: string[],
  ): Promise<AiGroundedResponse> {
    await this.client.aiRun.update({
      where: { id: aiRunId },
      data: {
        status: 'completed',
        confidence: 0,
        limitations: [
          ...BASE_LIMITATIONS,
          'Análise inconclusiva por ausência de evidências suficientes na base.',
        ],
        completedAt: new Date(),
      },
    });

    await this.auditAi(
      'ai_response_inconclusive',
      'success',
      context,
      {
        intent,
        dadosFaltantes,
      },
      'ai_run',
      aiRunId,
    );

    return {
      aiRunId,
      retrievalSessionId,
      resposta: AI_INCONCLUSIVE_MESSAGE,
      content: AI_INCONCLUSIVE_MESSAGE,
      provider: null,
      blocked: false,
      status: 'inconclusivo',
      intencao: intent,
      fontes: [],
      calculos: [],
      dataConsulta: new Date().toISOString(),
      limitacoes: [
        ...BASE_LIMITATIONS,
        'Base documental insuficiente para responder conclusivamente.',
      ],
      limitations: [
        ...BASE_LIMITATIONS,
        'Base documental insuficiente para responder conclusivamente.',
      ],
      dadosFaltantes,
      nivelCerteza: 'inconclusivo',
      distribuicaoEpistemica: {
        fatos: 0,
        calculos: 0,
        indicios: 0,
        hipoteses: 0,
        inconclusivo: true,
      },
      citations: [],
      sourceIds: retrieval.sourceIds,
      chunkIds: retrieval.chunkIds,
      ruleCodes: retrieval.ruleCodes,
      confidence: 0,
      legalAnalysisId: null,
    };
  }

  private async blockRun(
    aiRunId: string,
    retrievalSessionId: string | null,
    context: AiGroundingUserContext,
    reasons: string[],
    retrieval: RetrievalResult,
    limitations: string[],
    intent: any,
  ): Promise<AiGroundedResponse> {
    await this.client.aiRun.update({
      where: { id: aiRunId },
      data: {
        status: 'blocked',
        sourceIds: retrieval.sourceIds,
        chunkIds: retrieval.chunkIds,
        ruleCodes: retrieval.ruleCodes,
        confidence: 0,
        limitations,
        failureReason: reasons.join(','),
        completedAt: new Date(),
      },
    });

    await this.auditAi(
      'ai_grounding_blocked',
      'failure',
      context,
      {
        reasons,
        retrievalSessionId,
      },
      'ai_run',
      aiRunId,
    );

    return {
      aiRunId,
      retrievalSessionId,
      resposta: AI_GROUNDING_BLOCKED_MESSAGE,
      content: AI_GROUNDING_BLOCKED_MESSAGE,
      provider: null,
      blocked: true,
      status: 'bloqueado',
      intencao: intent,
      fontes: [],
      calculos: [],
      dataConsulta: new Date().toISOString(),
      limitacoes: limitations,
      limitations,
      nivelCerteza: 'inconclusivo',
      distribuicaoEpistemica: {
        fatos: 0,
        calculos: 0,
        indicios: 0,
        hipoteses: 0,
        inconclusivo: true,
      },
      citations: [],
      sourceIds: retrieval.sourceIds,
      chunkIds: retrieval.chunkIds,
      ruleCodes: retrieval.ruleCodes,
      confidence: 0,
      legalAnalysisId: null,
    };
  }

  private async persistCitations(
    aiRunId: string,
    retrievalSessionId: string,
    citations: GroundingCitation[],
  ) {
    if (!citations.length) return;
    await this.client.aiCitation.createMany({
      data: citations.map((citation) => ({
        aiRunId,
        retrievalSessionId,
        sourceType: citation.sourceType,
        sourceId: citation.sourceId,
        chunkId: citation.chunkId ?? null,
        ruleCode: citation.ruleCode ?? null,
        citationType: citation.citationType,
        label: citation.label ?? null,
        excerpt: citation.excerpt,
        confidence: citation.confidence,
        metadata: sanitizeMetadata(citation.metadata ?? {}),
      })),
    });
  }

  private async persistLegalAnalysis(
    aiRunId: string,
    response: string,
    citations: GroundingCitation[],
    retrieval: RetrievalResult,
    confidence: number,
    limitations: string[],
    context: AiGroundingUserContext,
    purpose: string,
  ) {
    const legalAnalysis = await this.client.legalAnalysis.create({
      data: {
        aiRunId,
        tenantId: normalizeNullableString(context.tenantId, 120),
        userId: normalizeNullableString(context.user?.id, 120),
        procurementNoticeId: retrieval.sourceIds[0] ?? null,
        analysisType: purpose,
        status: 'completed',
        title: 'Análise LEX com distinção epistêmica e grounding',
        summary: LexMinimizationService.minimizeExcerpt(response, 1200),
        result: sanitizeMetadata({
          response,
          citations,
          sourceIds: retrieval.sourceIds,
          chunkIds: retrieval.chunkIds,
          ruleCodes: retrieval.ruleCodes,
        }),
        sourceIds: retrieval.sourceIds,
        chunkIds: retrieval.chunkIds,
        ruleCodes: retrieval.ruleCodes,
        confidence,
        limitations,
      },
    });

    if (citations.length) {
      await this.client.draftEvidence.createMany({
        data: citations.map((citation) => ({
          aiRunId,
          legalAnalysisId: legalAnalysis.id,
          sourceType: citation.sourceType,
          sourceId: citation.sourceId,
          chunkId: citation.chunkId ?? null,
          ruleCode: citation.ruleCode ?? null,
          evidenceType: citation.citationType,
          excerpt: citation.excerpt,
          confidence: citation.confidence,
          metadata: sanitizeMetadata(citation.metadata ?? {}),
        })),
      });
    }

    return legalAnalysis;
  }

  private async auditAi(
    action: string,
    outcome: string,
    context: AiGroundingUserContext,
    metadata: Record<string, unknown>,
    entityType?: string | null,
    entityId?: string | null,
  ) {
    await this.client.auditEvent.create({
      data: {
        userId: normalizeNullableString(context.user?.id, 120),
        scope: 'ai_grounding',
        action,
        outcome,
        entityType: entityType ?? null,
        entityId: normalizeNullableString(entityId, 120),
        requestId: normalizeHeader(context.requestId),
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: normalizeHeader(context.userAgent)
          ? hashAuditValue(normalizeHeader(context.userAgent) as string)
          : null,
        emailHash: context.user?.email ? hashAuditValue(context.user.email) : null,
        metadata: sanitizeMetadata({
          actorRole: context.user?.role ?? null,
          tenantId: normalizeNullableString(context.tenantId, 120),
          ...metadata,
        }),
      },
    });
  }
}

function buildRetrievalQuery(input: AiGroundingInput) {
  return [input.pergunta, input.contexto]
    .map((value) => safeString(value, CONTEXT_QUERY_LIMIT))
    .filter(Boolean)
    .join('\n')
    .slice(0, QUERY_LIMIT);
}

function validateGrounding(
  retrieval: RetrievalResult,
  citations: GroundingCitation[],
  retrievalSessionId?: string | null,
) {
  const reasons: string[] = [];
  if (!retrievalSessionId) reasons.push('missing_retrieval');
  if (!citations.length) reasons.push('missing_citations');

  const knownChunkIds = new Set(retrieval.chunkIds);
  // Rejeita citações inventadas que não existem nos chunks recuperados
  const invalidChunk = citations.some(
    (citation) => citation.chunkId && !knownChunkIds.has(citation.chunkId),
  );
  if (invalidChunk) reasons.push('invalid_chunk_reference');

  return { ok: reasons.length === 0, reasons };
}

function buildLimitations(retrieval: RetrievalResult, reasons: string[]) {
  const limitations = [...BASE_LIMITATIONS, ...retrieval.limitations];
  if (retrieval.chunks.length < 3) {
    limitations.push('Base documental parcial: poucos chunks disponíveis para análise.');
  }
  if (!retrieval.rules.length) {
    limitations.push('Nenhuma regra jurídica específica foi recuperada do banco.');
  }
  if (reasons.length) {
    limitations.push(`Grounding com restrições: ${reasons.join(', ')}.`);
  }
  return unique(limitations);
}

function calculateConfidence(
  retrieval: RetrievalResult,
  calculos: LexDeterministicCalculation[],
) {
  const calcBonus = calculos.length > 0 ? 0.1 : 0;
  const score =
    0.55 +
    Math.min(retrieval.sourceIds.length, 3) * 0.07 +
    Math.min(retrieval.chunkIds.length, 6) * 0.035 +
    Math.min(retrieval.ruleCodes.length, 4) * 0.025 +
    calcBonus;
  return Number(Math.min(0.95, score).toFixed(4));
}

function computeEpistemicDistribution(
  fontes: LexEvidenceItem[],
  calculos: LexDeterministicCalculation[],
) {
  return {
    fatos: fontes.filter((f) => f.tipoEpistemico === 'Fato da fonte').length,
    calculos: calculos.length + fontes.filter((f) => f.tipoEpistemico === 'Cálculo reproduzível').length,
    indicios: fontes.filter((f) => f.tipoEpistemico === 'Indício').length,
    hipoteses: fontes.filter((f) => f.tipoEpistemico === 'Hipótese').length,
    inconclusivo: fontes.length === 0 && calculos.length === 0,
  };
}

function buildGroundedPrompt(
  pergunta: string,
  retrieval: RetrievalResult,
  citations: GroundingCitation[],
  calculos: LexDeterministicCalculation[],
  conversationContext?: string,
) {
  const notices = retrieval.notices
    .map((notice, index) =>
      [
        `Fonte ${index + 1}: ${buildNoticeLabel(notice)}`,
        `ID: ${notice.id}`,
        `Objeto: ${notice.object}`,
        `Órgão: ${notice.buyerName ?? 'não informado'}`,
        `Modalidade: ${notice.modality ?? 'não informada'}`,
        `Data Abertura: ${notice.openingAt ?? 'não informada'}`,
        `Valor Estimado: ${notice.estimatedValue ?? 'não informado'}`,
      ].join('\n'),
    )
    .join('\n\n');

  const chunks = retrieval.chunks
    .map((chunk, index) =>
      [
        `Trecho ${index + 1} (${chunk.sourceType} | ${chunk.id})`,
        LexMinimizationService.sanitizeForPrompt(chunk.content),
      ].join('\n'),
    )
    .join('\n\n');

  const rules = retrieval.rules
    .map((rule) =>
      [
        `Regra ${rule.code} - ${rule.name}`,
        `Base Legal: ${rule.legalBasis}`,
        `Recomendação: ${rule.recommendation}`,
      ].join('\n'),
    )
    .join('\n\n');

  const conversation = safeString(conversationContext, 10000);
  const calculosText = calculos.length
    ? calculos
        .map(
          (c) =>
            `[CÁLCULO DETERMINÍSTICO VERIFICADO: ${c.tipo}]\nResultado: ${JSON.stringify(c.resultado)}\nFórmula: ${c.formula}\nFundamento: ${c.fundamentacaoLegal || 'Sistema'}`,
        )
        .join('\n\n')
    : 'Nenhum cálculo determinístico aplicável.';

  return [
    '[PERGUNTA DO USUÁRIO]',
    pergunta,
    '',
    ...(conversation
      ? [
          '[HISTÓRICO DA CONVERSA (CONTEXTO INFORMADO PELO CLIENTE)]',
          LexMinimizationService.sanitizeForPrompt(conversation),
          '',
        ]
      : []),
    '[CÁLCULOS DETERMINÍSTICOS DO SISTEMA (NÃO ALTERAR)]',
    calculosText,
    '',
    '[DADOS ESTRUTURADOS DO EDITAL]',
    notices || 'Nenhum edital estruturado.',
    '',
    '[TRECHOS RELEVANTES DOS DOCUMENTOS RECUPERADOS]',
    chunks || 'Nenhum trecho de documento disponível.',
    '',
    '[REGRAS E ORIENTAÇÕES DO TCU / LEI 14.133]',
    rules || 'Nenhuma regra recuperada.',
    '',
    '[DIRETRIZ DE RESPOSTA]',
    'Classifique suas afirmações expressamente em: [Fato da fonte], [Cálculo reproduzível], [Indício] ou [Hipótese]. Se faltarem dados essenciais, declare expressamente como [Inconclusivo] e liste o que falta. Não declare fraude ou cartel como certeza absoluta.',
  ].join('\n');
}

function groundedSystemPrompt(purpose?: string) {
  const base = [SYSTEM_PROMPT_LEX];
  base.push(
    '',
    '[MODO DE GROUNDING ATIVO]',
    '- Responda com base estrita nos dados fornecidos.',
    '- Presumir fatos inexistentes é proibido.',
    '- Use os cálculos determinísticos fornecidos como verdade matemática.',
  );
  return base.join('\n');
}

function containsUnsafeAssertion(content: string) {
  const normalized = normalizeText(content);
  return [
    /\bhouve fraude\b/,
    /\be fraude\b/,
    /\bfraude comprovada\b/,
    /\bcrime configurado\b/,
    /\bcartel comprovado\b/,
    /\bilegalidade comprovada\b/,
  ].some((pattern) => pattern.test(normalized));
}

function sanitizeUnsafeAssertion(content: string): string {
  return content
    .replace(/\b(houve fraude|é fraude|fraude comprovada)\b/gi, 'indício de inconformidade')
    .replace(/\b(crime configurado|cartel comprovado)\b/gi, 'hipótese de sobreposição concorrencial')
    .replace(/\b(ilegalidade comprovada)\b/gi, 'aparente desconformidade');
}

function retrievalNoticeSelect() {
  return {
    id: true,
    tenantId: true,
    source: true,
    externalId: true,
    noticeNumber: true,
    modality: true,
    buyerName: true,
    buyerDocument: true,
    object: true,
    uf: true,
    municipality: true,
    estimatedValue: true,
    status: true,
    url: true,
    publishedAt: true,
    openingAt: true,
    closingAt: true,
    classification: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
  };
}

function retrievalChunkSelect() {
  return {
    id: true,
    tenantId: true,
    sourceType: true,
    sourceId: true,
    chunkIndex: true,
    content: true,
    tokenCount: true,
    metadata: true,
    createdAt: true,
  };
}

function tenantVisibilityWhere(tenantId?: string | null) {
  const normalizedTenantId = normalizeNullableString(tenantId, 120);
  return normalizedTenantId
    ? { OR: [{ tenantId: null }, { tenantId: normalizedTenantId }] }
    : { tenantId: null };
}

function mapNoticeContext(notice: any) {
  return sanitizeMetadata({
    id: notice.id,
    source: notice.source,
    externalId: notice.externalId,
    noticeNumber: notice.noticeNumber,
    buyerName: notice.buyerName,
    object: notice.object,
    uf: notice.uf,
    municipality: notice.municipality,
    modality: notice.modality,
    status: notice.status,
    url: notice.url,
  });
}

function mapChunkContext(chunk: any) {
  return sanitizeMetadata({
    id: chunk.id,
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    chunkIndex: chunk.chunkIndex,
    excerpt: LexMinimizationService.minimizeExcerpt(chunk.content, EXCERPT_LIMIT),
    tokenCount: chunk.tokenCount ?? null,
  });
}

function mapRuleContext(rule: any) {
  return sanitizeMetadata({
    id: rule.id,
    code: rule.code,
    name: rule.name,
    severity: rule.severity,
    category: rule.category,
    version: rule.version,
    recommendation: rule.recommendation,
  });
}

function buildNoticeLabel(notice?: any, chunk?: any) {
  if (!notice) return `${chunk?.sourceType ?? 'fonte'}:${chunk?.sourceId ?? 'desconhecida'}`;
  return [notice.source, notice.noticeNumber, notice.buyerName].filter(Boolean).join(' | ') || String(notice.id);
}

function extractKeywords(query: string) {
  const STOPWORDS = new Set([
    'para', 'com', 'sem', 'por', 'das', 'dos', 'uma', 'nas', 'nos', 'que',
    'ser', 'sera', 'sao', 'de', 'da', 'do', 'em', 'na', 'no', 'ao', 'as',
    'os', 'e', 'a', 'o', 'edital', 'licitacao', 'analise', 'resumo',
  ]);

  return unique(
    normalizeText(query)
      .split(/[^a-z0-9]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
  ).slice(0, 8);
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function safeString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeNullableString(value: unknown, maxLength: number) {
  return safeString(value, maxLength) ?? null;
}

function normalizeHeader(value: unknown) {
  if (Array.isArray(value)) return normalizeNullableString(value[0], 200);
  return normalizeNullableString(value, 200);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hashAuditValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function sanitizeMetadata(value: unknown): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeMetadata(item));

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (acc, [key, item]) => {
      if (
        /password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|email|ip|useragent|session|refresh/i.test(
          key,
        )
      ) {
        acc[key] = '[redacted]';
      } else {
        acc[key] = sanitizeMetadata(item);
      }
      return acc;
    },
    {},
  );
}
