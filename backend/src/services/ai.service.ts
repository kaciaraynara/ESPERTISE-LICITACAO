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

const VALID_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];

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
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'unconfigured') {
    throw new MissingApiKeyError();
  }

  const configuredModel = options?.modelName || process.env.GEMINI_MODEL?.trim();
  const initialModel = configuredModel || VALID_GEMINI_MODELS[0];

  const candidateModels = Array.from(
    new Set([initialModel, ...VALID_GEMINI_MODELS]),
  );

  const timeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 45000;
  const genAI = new GoogleGenerativeAI(apiKey);
  const fullPrompt = buildPromptFromMessages(messages);

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
      if (error instanceof AiTimeoutError) {
        throw error;
      }
      lastError = error;
      if (!isModelUnavailable(error)) break;
      console.warn(`[AI Service] Modelo Gemini ${modelName} indisponível. Tentando o próximo modelo estável.`);
    }
  }

  const errorCode = getProviderErrorCode(lastError);
  console.error('[AI Service] Falha ao comunicar com o Gemini.', { code: errorCode });
  throw new ProviderUnavailableError();
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
