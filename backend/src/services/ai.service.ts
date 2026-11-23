import axios from 'axios';
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

export const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

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

  const orgaoMatch = promptText.match(/(?:Órgão(?:\s+Licitante)?|ÓRGÃO):\s*([^\n|]+)/i);
  const objetoMatch = promptText.match(/(?:Objeto(?:\s+da\s+Contratação)?|OBJETO(?:\s+DA\s+CONTRATAÇÃO)?):\s*([^\n]+)/i);
  const modalidadeMatch = promptText.match(/(?:Modalidade|MODALIDADE):\s*([^\n|]+)/i) || promptText.match(/(PREGÃO ELETRÔNICO|CONCORRÊNCIA ELETRÔNICA|DISPENSA ELETRÔNICA|CREDENCIAMENTO)\s*(?:Nº\s*[\d/]+)?/i);
  const valorMatch = promptText.match(/(?:Valor(?:\s+Total|\s+Estimado|\s+Global)?(?:\s+Estimado|\s+Total)?|VALOR\s+ESTIMADO(?:\s+TOTAL|\s+GLOBAL)?):\s*(R\$\s*[\d.,]+|[^\n]+)/i);
  const sessaoMatch = promptText.match(/(?:Data\s+da\s+Sessão(?:\s+Pública)?|DATA\s+DA\s+SESSÃO(?:\s+PÚBLICA)?|Abertura(?:\s+de\s+Propostas)?):\s*([^\n]+)/i);

  const orgao = orgaoMatch ? orgaoMatch[1].trim() : 'Órgão Público Licitante';
  const objeto = objetoMatch ? objetoMatch[1].trim() : 'Contratação pública regida pela Lei Federal nº 14.133/2021';
  const modalidade = modalidadeMatch ? modalidadeMatch[1].trim() : 'Pregão Eletrônico (Lei Federal nº 14.133/2021)';
  const valor = valorMatch ? valorMatch[1].trim() : 'Conforme planilha de itens do Termo de Referência';
  const sessao = sessaoMatch ? sessaoMatch[1].trim() : 'Conforme cronograma oficial publicado no portal';

  const alertasDetectados: string[] = [];
  if (/iso\s*\d+|cmmi/i.test(promptText)) {
    alertasDetectados.push(
      'Alerta de Cláusula Restritiva (Certificação ISO / CMMI na Habilitação): O texto menciona exigência de certificação ISO ou CMMI na fase de habilitação/entrega de propostas. Conforme jurisprudência consolidada do TCU (Acórdão 1214/2013-Plenário e Acórdão 1085/2011-Plenário) e Art. 67 da Lei 14.133/2021, certificações de qualidade não constam no rol taxativo de habilitação e só podem ser pontuadas como técnica ou exigidas na execução contratual quando devidamente justificadas. Cabe Impugnação ao Edital (Art. 164).',
    );
  }
  if (/(?:atestado|capacidade\s+t[eé]cnica)[\s\S]{0,120}(?:60%|70%|75%|80%|90%|100%)/i.test(promptText)) {
    alertasDetectados.push(
      'Alerta de Quantitativo Abusivo em Atestado Técnico (> 50%): O Art. 67, § 2º da Lei 14.133/2021 e a Súmula 263 do TCU vedam exigir atestados com quantitativos superiores a 50% das parcelas de maior relevância e valor significativo (>= 4% do valor total). Cabe Impugnação imediata.',
    );
  }
  if (/visita\s+t[eé]cnica\s+obrigat[oó]ria|vistoria\s+obrigat[oó]ria/i.test(promptText)) {
    alertasDetectados.push(
      'Alerta sobre Vistoria Prévia (Art. 63, §§ 2º e 3º da Lei 14.133/2021): O edital deve sempre assegurar ao licitante o direito de substituir a vistoria presencial por declaração formal assinada pelo responsável técnico acerca do conhecimento das condições locais.',
    );
  }
  if (alertasDetectados.length === 0) {
    alertasDetectados.push(
      'Atestados de Capacidade Técnica (Art. 67, §§ 1º e 2º da Lei 14.133/2021 e Súmula 263/TCU): Confira se as exigências de atestados respeitam o teto máximo de 50% dos quantitativos apenas nas parcelas de maior relevância (>= 4% do valor estimado).',
      'Exequibilidade e Diligência Obrigatória (Art. 59, §§ 2º e 4º da Lei 14.133/2021 e Súmula 262/TCU): Qualquer presunção de inexequibilidade é relativa, sendo obrigatório ao Pregoeiro abrir diligência para comprovação da estrutura de custos antes de desclassificar.',
      'Formalismo Moderado na Habilitação (Art. 64 da Lei 14.133/2021 e Acórdão 1211/2021-TCU-Plenário): Documentos que atestem condição preexistente à abertura da sessão devem ser admitidos em diligência complementar.',
    );
  }

  return [
    '1. DADOS FUNDAMENTAIS E ENQUADRAMENTO DO EDITAL',
    `• Órgão Promotor: ${orgao}`,
    `• Modalidade e Regime: ${modalidade} (Lei Federal nº 14.133/2021)`,
    `• Objeto da Contratação: ${objeto}`,
    `• Valor Estimado de Referência: ${valor}`,
    `• Data da Sessão Pública: ${sessao}`,
    '',
    '2. CRONOGRAMA E PRAZOS FATAIS (LEI 14.133/2021)',
    '• Impugnação e Esclarecimentos (Art. 164): Protocolo em até 3 (três) dias úteis antes da data de abertura do certame, com resposta obrigatória do órgão em até 3 dias úteis.',
    '• Fase Recursal Unificada (Art. 165, I e § 4º): Manifestação imediata de intenção de recurso após o julgamento/habilitação e prazo de 3 (três) dias úteis para razões recursais e 3 (três) dias úteis para contrarrazões, com efeito suspensivo automático (Art. 168).',
    '• Envio da Proposta Readequada (IN SEGES 73/2022): Prazo mínimo de 2 (duas) horas após convocação no chat de negociação (Art. 61), prorrogável mediante solicitação fundamentada antes do vencimento.',
    '',
    '3. AUDITORIA DE CLÁUSULAS E PONTOS DE ATENÇÃO JURÍDICA',
    ...alertasDetectados.map((a) => `• ${a}`),
    '',
    '4. REQUISITOS DE HABILITAÇÃO (ARTS. 62 A 70 DA LEI 14.133/2021)',
    '• Habilitação Jurídica (Art. 66): Contrato Social ou Estatuto consolidado, Cartão CNPJ ativo com CNAE compatível e documento do representante legal.',
    '• Regularidade Fiscal, Social e Trabalhista (Art. 68): CND Federal Conjunta (RFB/PGFN), CRF do FGTS, CNDT Trabalhista, CND Estadual e CND Municipal.',
    '• Qualificação Econômico-Financeira (Art. 69): Balanço Patrimonial, Índices de Liquidez (LG, SG e LC >= 1,0 conforme Súmula 289/TCU) e Certidão Negativa de Falência.',
    '• Qualificação Técnica (Art. 67): Atestados de Capacidade Técnica compatíveis em características e quantidades com o objeto.',
    '',
    '5. PRÓXIMOS PASSOS RECOMENDADOS PARA VENCER',
    '• Passo 1: Caso exista cláusula restritiva apontada acima, clique em Montar Peça de Impugnação para gerar o documento em PDF Timbrado.',
    '• Passo 2: Acesse Gerar Proposta para carregar todos os itens do edital, responder ao Questionário Estratégico, baixar a Planilha Excel e emitir a Carta-Proposta com Anexo de Ficha Técnica.',
  ].join('\n');
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
    throw new MissingApiKeyError();
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
      const streamTask = (async () => {
        if (apiKey.trim().startsWith('AQ.')) {
          const restResp = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            { contents: [{ parts: [{ text: fullPrompt }] }] },
            { headers: { 'x-goog-api-key': apiKey.trim() }, timeout: timeoutMs },
          );
          const text = String(restResp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
          if (text) await onChunk(text);
          return text;
        }
        const model = genAI.getGenerativeModel({ model: modelName });
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
      console.warn(`[AI Service] Falha no modelo ${modelName}:`, (error as any)?.message || error);
      console.warn(`[AI Service] Modelo Gemini ${modelName} indisponível. Tentando o próximo modelo estável.`);
    }
  }

  const errorCode = getProviderErrorCode(lastError);
  console.error('[AI Service] Todos os modelos Gemini falharam.', { code: errorCode });
  if (lastError instanceof AiTimeoutError) {
    throw lastError;
  }
  throw new ProviderUnavailableError(
    `O provedor de IA falhou ao processar sua solicitação (${errorCode}). Tente novamente em instantes.`,
  );
}

/**
 * Chamada compatível que utiliza internamente o método nativo de streaming do Gemini.
 */
export async function chatWithProvider(
  messages: GroundingAIMessage[],
  options?: ChatProviderOptions,
): Promise<{ content: string; provider: string }> {
  return streamChatWithProvider(messages, options?.onChunk ?? (() => { }), options);
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
