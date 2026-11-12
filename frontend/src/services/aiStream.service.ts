import { BASE_URL } from './api';
import { useAuthStore } from '@store/auth.store';

export interface StreamEventPayload {
  chunk?: string;
  done?: boolean;
  fullText?: string;
  provider?: string;
  error?: string;
  [key: string]: any;
}

export interface StreamChatParams {
  endpoint?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  pergunta?: string;
  contexto?: string;
  contextoEdital?: string;
  noticeId?: string;
  licitacaoId?: string;
  edital_id?: string;
  texto_edital?: string;
  providedDocumentText?: string;
  extraBody?: Record<string, any>;
  onChunk: (chunk: string, accumulated: string) => void;
  onDone?: (fullText: string, metadata?: StreamEventPayload) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Consome endpoints de streaming da IA (LEX) utilizando Server-Sent Events (SSE) via Fetch API e ReadableStream.
 * Permite apresentar as palavras em tempo real na interface, eliminando a percepção de lentidão.
 */
export async function streamAiChat(params: StreamChatParams): Promise<{ fullText: string; metadata?: StreamEventPayload }> {
  const {
    endpoint = '/lex/chat',
    messages,
    pergunta,
    contexto,
    contextoEdital,
    noticeId,
    licitacaoId,
    edital_id,
    texto_edital,
    providedDocumentText,
    extraBody = {},
    onChunk,
    onDone,
    onError,
    signal,
  } = params;

  const resolvedUrl = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Recupera token de autenticação atual
  const token =
    useAuthStore.getState().accessToken ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('access_token')
      : null);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestBody = {
    stream: true,
    ...(messages ? { messages } : {}),
    ...(pergunta ? { pergunta } : {}),
    ...(contexto ? { contexto } : {}),
    ...(contextoEdital ? { contextoEdital } : {}),
    ...(noticeId ? { noticeId } : {}),
    ...(licitacaoId ? { licitacaoId } : {}),
    ...(edital_id ? { edital_id } : {}),
    ...(texto_edital ? { texto_edital } : {}),
    ...(providedDocumentText ? { providedDocumentText } : {}),
    ...extraBody,
  };

  const response = await fetch(resolvedUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    let errorMessage = `Não foi possível concluir a análise (código ${response.status}).`;
    try {
      const errData = await response.json();
      errorMessage = errData.message || errorMessage;
    } catch {
      // Ignora erro de parse caso a resposta não seja JSON
    }
    const err = new Error(errorMessage);
    onError?.(err);
    throw err;
  }

  if (!response.body) {
    throw new Error('Nenhum fluxo de resposta recebido da central de IA.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let metadata: StreamEventPayload | undefined;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Guarda a última linha que pode estar incompleta
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) {
          // Linha vazia ou comentário keep-alive SSE
          continue;
        }

        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();

          if (jsonStr === '[DONE]') {
            // Fim do stream enviado pelo servidor
            continue;
          }

          let data: StreamEventPayload;
          try {
            data = JSON.parse(jsonStr);
          } catch (e: any) {
            // Dados não JSON (ex: raw text fallback)
            if (jsonStr && jsonStr !== '[DONE]') {
              accumulatedText += jsonStr;
              onChunk(jsonStr, accumulatedText);
            }
            continue;
          }

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.chunk) {
            accumulatedText += data.chunk;
            onChunk(data.chunk, accumulatedText);
          }

          if (data.done) {
            metadata = data;
            if (data.fullText && !accumulatedText) {
              accumulatedText = data.fullText;
            }
          }
        }
      }
    }

    // Processa resíduo do buffer se houver
    if (buffer.trim().startsWith('data:')) {
      const remaining = buffer.trim().slice(5).trim();
      if (remaining && remaining !== '[DONE]') {
        try {
          const data: StreamEventPayload = JSON.parse(remaining);
          if (data.chunk) {
            accumulatedText += data.chunk;
            onChunk(data.chunk, accumulatedText);
          }
        } catch {
          // Ignora
        }
      }
    }

    onDone?.(accumulatedText, metadata);
    return { fullText: accumulatedText, metadata };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('Consulta ao LEX interrompida pelo usuário.');
      return { fullText: accumulatedText, metadata };
    }
    onError?.(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
