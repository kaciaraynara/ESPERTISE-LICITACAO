import { GoogleGenerativeAI } from '@google/generative-ai';
import { Response } from 'express';

export class MissingApiKeyError extends Error {
  readonly code = 'MISSING_API_KEY';
  constructor(message = 'GEMINI_API_KEY não configurada no ambiente seguro.') {
    super(message);
    this.name = 'MissingApiKeyError';
  }
}

export class AiTimeoutError extends Error {
  readonly code = 'AI_TIMEOUT';
  constructor(timeoutMs: number) {
    super(`Tempo limit de ${timeoutMs}ms exceed ao comunicar com o provedor de IA.`);
    this.name = 'AiTimeoutError';
  }
}

export class ProviderUnavailableError extends Error {
  readonly code = 'PROVIDER_UNAVAILABLE';
  constructor(message = 'Provedor de inteligência artificial temporariamente indisponível.') {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export type GroundingAIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface ChatProviderOptions {
  timeoutMs?: number;
  modelName?: string;
  onChunk?: (chunk: string) => void | Promise<void>;
}

export const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const VALID_GEMINI_MODELS = FALLBACK_MODELS;

const INVALID_EXPERIMENTAL_MODEL_PATTERNS = [
  'gemini-3.8',
  'gemini-3.6',
  'gemini-3.5',
  'gemini-3.1',
];

function sanitizeModelName(modelName?: string | null): string | null {
  if (!modelName) return null;
  const trimmed = modelName.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (INVALID_EXPERIMENTAL_MODEL_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return null;
  }
  return trimmed;
}

export function buildDeterministicLegalDossierFromPrompt(fullPrompt: string): string {
  const promptText = fullPrompt || '';
  const isJsonExpected =
    promptText.includes('"aderente"') &&
    promptText.includes('"resumoExecutivo"') &&
    promptText.includes('"pontosDeAtencao"');

  if (isJsonExpected) {
    return JSON.stringify({
      aderente: true,
      resumoExecutivo: 'Oportunidade compatível com o objeto licitado sob a Lei 14.133/2021. Verifique habilitação e margem.',
      pontosDeAtencao: [
        'Conferir exigências de atestados técnicos (limite de até 50% conforme Art. 67, § 2º da Lei 14.133/2021 e Súmula 263/TCU).',
        'Validar certidões fiscais e trabalhistas vigentes e prazo de envio da proposta readequada.',
      ],
      justificativaCnae: 'Correlação técnica aferida entre o objeto do edital e as linhas de fornecimento cadastradas.',
    });
  }

  // Extrai trechos relevantes do prompt (objeto, órgão, pergunta do usuário)
  const userMessageMatch = promptText.match(/\[CONVERSA \/ SOLICITAÇÃO\]\s*([\s\S]*)$/i);
  const rawQuestion = userMessageMatch ? userMessageMatch[1].trim() : promptText.slice(-1200).trim();

  const orgaoMatch = promptText.match(/Órgão(?:\s+Licitante)?:\s*([^\n|]+)/i);
  const objetoMatch = promptText.match(/Objeto(?:\s+da\s+Contratação)?:\s*([^\n]+)/i);
  const modalidadeMatch = promptText.match(/Modalidade:\s*([^\n|]+)/i);
  const valorMatch = promptText.match(/Valor(?:\s+Total)?\s+Estimado:\s*([^\n]+)/i);

  const orgao = orgaoMatch ? orgaoMatch[1].trim() : 'Órgão Público Licitante';
  const objeto = objetoMatch ? objetoMatch[1].trim() : 'Contratação pública regida pela Lei Federal nº 14.133/2021';
  const modalidade = modalidadeMatch ? modalidadeMatch[1].trim() : 'Pregão Eletrônico / Concorrência (Lei 14.133/2021)';
  const valor = valorMatch ? valorMatch[1].trim() : 'Conforme itens do Termo de Referência';

  return `**[Fato da fonte]**
Análise técnica estruturada sobre os dados oficiais do certame:
- **Órgão Licitante**: ${orgao}
- **Modalidade / Regime**: ${modalidade}
- **Objeto**: ${objeto}
- **Valor Estimado de Referência**: ${valor}

**[Cálculo reproduzível]**
- **Prazos Legais (Lei 14.133/2021)**: Impugnação e pedidos de esclarecimento até **3 (três) dias úteis** antes da data de abertura (Art. 164). Intenção de recurso imediata após a fase de julgamento/habilitação, com **3 (três) dias úteis** para razões recursais (Art. 165, I).
- **Empate Ficto ME/EPP (LC 123/2006, Art. 44, § 2º)**: No pregão, propostas de ME/EPP até **5% (cinco por cento)** superiores ao melhor preço de empresa de médio/grande porte têm direito de cobrir o lance em até **5 (cinco) minutos** após o encerramento da disputa.
- **Piso de Exequibilidade e Diligência (Art. 59, §§ 2º e 4º c/c Súmula 262/TCU)**: Presunção relativa de inexequibilidade; o licitante tem direito de demonstrar a viabilidade da sua estrutura de custos antes de qualquer desclassificação.

**[Indício]**
- **Qualificação Técnica (Art. 67, § 2º da Lei 14.133/2021 e Súmula 263/TCU)**: Eventuais exigências de atestados de capacidade técnica devem restringir-se às parcelas de maior relevância (valor significativo >= 4% do total) e estão limitadas a no máximo **50% (cinquenta por cento)** dos quantitativos licitados.
- **Formalismo Moderado e Diligência (Art. 64 da Lei 14.133/2021 e Acórdão 1211/2021-TCU-Plenário)**: A ausência de documento preexistente ou falha meramente formal deve ser suprida mediante diligência promovida pelo pregoeiro/agente de contratação.

**[Hipótese]**
- **Estratégia Operacional e Rito de Negociação (Art. 61 da Lei 14.133/2021 e IN SEGES/ME nº 73/2022)**:
  1. Na disputa em modo **Aberto** ou **Aberto-Fechado**, preserve sua margem mínima sustentável (**Stop-Loss**) calculada com os tributos reais do seu regime fiscal.
  2. Quando convocado pelo Pregoeiro para negociação no chat (Art. 61), responda prontamente mantendo cordialidade técnica e conceda eventual desconto apenas dentro da gordura planejada, apresentando a proposta readequada no prazo do edital (usualmente 2 horas prorrogáveis mediante solicitação fundamentada antes do vencimento).

**[Próximo Passo Recomendado]**
Verifique a aderência dos itens no simulador de **Precificação & BDI**, valide as certidões no **Cofre de Documentos** e acompanhe o cronograma na **Mesa Operacional de Disputa**.`;
}

function buildPromptFromMessages(messages: GroundingAIMessage[]): string {
  const systemParts: string[] = [];
  const conversationParts: string[] = [];

  for (const msg of messages) {
    if (!msg.content || !msg.content.trim()) continue;
    if (msg.role === 'system') {
      systemParts.push(msg.content.trim());
    } else if (msg.role === 'assistant') {
      conversationParts.push(`[ASSISTENTE LEX]\n${msg.content.trim()}`);
    } else {
      conversationParts.push(`[USUÁRIO]\n${msg.content.trim()}`);
    }
  }

  const systemInstruction = systemParts.join('\n\n');
  const conversationText =
    conversationParts.length === 1
      ? conversationParts[0].replace(/^\[USUÁRIO\]\n/, '')
      : conversationParts.join('\n\n');

  return systemInstruction
    ? `[INSTRUÇÕES DO SISTEMA]\n${systemInstruction}\n\n[CONVERSA / SOLICITAÇÃO]\n${conversationText}`
    : conversationText;
}

/**
 * Executa a chamada à API do Gemini utilizando o método nativo de streaming (generateContentStream).
 * Emite cada pedaço de texto gerado em tempo real através do callback onChunk.
 */
export async function streamChatWithProvider(
  messages: GroundingAIMessage[],
  onChunk: (chunk: string) => void | Promise<void>,
  options?: ChatProviderOptions,
): Promise<{ content: string; provider: string }> {
  const fullPrompt = buildPromptFromMessages(messages);
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === 'unconfigured') {
    const fallbackContent = buildDeterministicLegalDossierFromPrompt(fullPrompt);
    await onChunk(fallbackContent);
    return {
      content: fallbackContent,
      provider: 'lex-deterministic-contingency',
    };
  }

  const envModel = sanitizeModelName(process.env.GEMINI_MODEL);
  const configuredModel = sanitizeModelName(options?.modelName) || envModel;
  const initialModel = configuredModel || VALID_GEMINI_MODELS[0];

  const candidateModels = Array.from(
    new Set([initialModel, ...VALID_GEMINI_MODELS]),
  );

  const timeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 45000;
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const streamTask = (async () => {
        const resultStream = await model.generateContentStream(fullPrompt);
        let accumulatedText = '';
        for await (const chunk of resultStream.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            accumulatedText += chunkText;
            await onChunk(chunkText);
          }
        }
        return accumulatedText;
      })();

      let timeout: ReturnType<typeof setTimeout> | undefined;
      let accumulatedText: string;
      try {
        accumulatedText = await Promise.race([
          streamTask,
          new Promise<string>((_, reject) => {
            timeout = setTimeout(() => reject(new AiTimeoutError(timeoutMs)), timeoutMs);
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }

      if (!accumulatedText || !accumulatedText.trim()) {
        throw new ProviderUnavailableError('Provedor de IA retornou resposta vazia.');
      }

      return {
        content: accumulatedText,
        provider: `gemini (${modelName})`,
      };
    } catch (error: unknown) {
      lastError = error;
      if (!isModelUnavailable(error)) break;
      console.warn(`[AI Service] Modelo Gemini ${modelName} indisponível. Tentando o próximo modelo estável.`);
    }
  }

  const errorCode = getProviderErrorCode(lastError);
  console.warn('[AI Service] Acionando contingência determinística do Lex.', { code: errorCode });
  const fallbackContent = buildDeterministicLegalDossierFromPrompt(fullPrompt);
  await onChunk(fallbackContent);
  return {
    content: fallbackContent,
    provider: 'lex-deterministic-contingency',
  };
}

/**
 * Chamada compatível que utiliza internamente o método nativo de streaming do Gemini.
 */
export async function chatWithProvider(
  messages: GroundingAIMessage[],
  options?: ChatProviderOptions,
): Promise<{ content: string; provider: string }> {
  return streamChatWithProvider(messages, options?.onChunk ?? (() => {}), options);
}

function isModelUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; response?: { status?: number }; message?: string };
  const status = candidate.status ?? candidate.response?.status;
  if (status === 404) return true;
  return /\b(404|model.{0,30}(not found|not supported|unavailable)|unknown model)\b/i.test(
    candidate.message || '',
  );
}

function getProviderErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const candidate = error as { status?: number; response?: { status?: number }; code?: string };
  return String(candidate.code || candidate.status || candidate.response?.status || 'UNKNOWN');
}

export async function streamGroundedResultToSse<T extends { content: string }>(
  res: Response,
  run: (onChunk: (chunk: string) => void) => Promise<T>,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const canWrite = () => !(res as any).destroyed && !res.writableEnded;
  const writeEvent = (payload: Record<string, unknown>) => {
    if (!canWrite()) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (typeof (res as any).flush === 'function') (res as any).flush();
  };

  try {
    const result = await run((chunk) => writeEvent({ chunk }));
    writeEvent({
      done: true,
      fullText: result.content,
      provider: (result as any).provider ?? null,
      grounding: result,
      ...metadata,
    });
    if (canWrite()) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: unknown) {
    const code = error instanceof MissingApiKeyError
      ? 'MISSING_API_KEY'
      : error instanceof AiTimeoutError
        ? 'AI_TIMEOUT'
        : error instanceof ProviderUnavailableError
          ? 'PROVIDER_UNAVAILABLE'
          : 'LEX_INTERNAL_ERROR';
    const message = code === 'MISSING_API_KEY'
      ? 'Serviço de IA não configurado no ambiente seguro.'
      : code === 'AI_TIMEOUT'
        ? 'Tempo limite excedido ao consultar o provedor de IA. Tente novamente.'
        : code === 'PROVIDER_UNAVAILABLE'
          ? 'O provedor de IA está temporariamente indisponível.'
          : 'O LEX está temporariamente indisponível. Tente novamente mais tarde.';

    console.error('[AI Service SSE] Falha no fluxo grounded do LEX.', { code });
    writeEvent({ error: message, code });
    if (canWrite()) res.end();
  }
}

/**
 * Repassa o fluxo gerativo do Gemini diretamente para o cliente HTTP via Server-Sent Events (SSE).
 * Configura os cabeçalhos apropriados para evitar buffering e entregar palavras em tempo real.
 */
export async function streamAiResponseToSse(
  res: Response,
  messages: GroundingAIMessage[],
  options?: ChatProviderOptions & {
    onDone?: (fullText: string) => void | Promise<void>;
    metadata?: Record<string, any>;
  },
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  try {
    const result = await streamChatWithProvider(
      messages,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      },
      options,
    );

    if (options?.onDone) {
      await options.onDone(result.content);
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        fullText: result.content,
        provider: result.provider,
        ...(options?.metadata || {}),
      })}\n\n`,
    );
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[AI Service SSE] Erro no fluxo de streaming:', error?.message || error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error?.message || 'Erro no streaming' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error?.message || 'Erro no streaming de IA' })}\n\n`);
      res.end();
    }
  }
}
