import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE } from './lex-prompt';

export { SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE };

export interface AnalisarAderenciaInput {
  objetoEdital: string;
  cnaeCodigo: string;
  cnaeDescricao?: string;
}

export interface AnaliseResultado {
  aderente: boolean;
  resumoExecutivo: string;
  pontosDeAtencao: string[];
  justificativaCnae: string;
}

export type AnaliseEditalCnaeOutput = AnaliseResultado;

export interface AnalisarEditalCnaeParams {
  cnae: string;
  ramoAtividade?: string | null;
  objetoEdital: string;
  orgao?: string | null;
  valorEstimado?: number | string | null;
  numeroEdital?: string | null;
  municipioUf?: string | null;
}

const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/**
 * Remove blocos de formatação markdown (```json ... ```) caso o modelo os inclua.
 */
function extrairJsonPuro(texto: string): string {
  let limpo = texto.trim();
  if (limpo.startsWith('```')) {
    limpo = limpo.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return limpo;
}

export interface ChamarLlmParams {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
}

/**
 * Executa a chamada à LLM com Guardrail, temperatura controlada e retorno JSON estrito.
 */
export async function chamarLlmComGuardrail(params: ChamarLlmParams): Promise<string> {
  const rawKey = process.env.GEMINI_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '').trim();

  if (!apiKey || apiKey === 'unconfigured') {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const modelsToTry = Array.from(new Set([configuredModel, ...FALLBACK_GEMINI_MODELS].filter(Boolean))) as string[];

  let ultimoErro: unknown = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: params.systemPrompt,
        generationConfig: {
          temperature: params.temperature ?? 0.1, // Determinismo máximo (0.1)
          responseMimeType: 'application/json',
        },
      });

      const response = await model.generateContent(params.userMessage);
      const textOutput = response.response.text();

      if (!textOutput || !textOutput.trim()) {
        throw new Error('Resposta vazia da IA.');
      }

      const jsonStr = extrairJsonPuro(textOutput);
      // Valida sintaxe antes de retornar
      JSON.parse(jsonStr);
      return jsonStr;
    } catch (err) {
      ultimoErro = err;
      console.warn(`[Guardrail-LLM] Falha com modelo ${modelName}:`, err instanceof Error ? err.message : err);
    }
  }

  throw ultimoErro || new Error('TODOS_MODELOS_FALHARAM');
}

/**
 * Avalia se uma empresa com determinado CNAE pode fornecer ou executar o objeto descrito conforme a Lei 14.133/2021.
 * Retorna exclusivamente o JSON estruturado.
 */
export async function analisarEditalParaCnae(input: AnalisarAderenciaInput): Promise<AnaliseResultado> {
  const userMessage = `
DADOS PARA ANÁLISE:
- CNAE da Empresa: ${input.cnaeCodigo} ${input.cnaeDescricao ? `(${input.cnaeDescricao})` : ''}
- Objeto do Edital: ${input.objetoEdital}

Avalie se uma empresa com esse CNAE pode fornecer ou executar o objeto descrito conforme a Lei 14.133/2021.
Retorne exclusivamente o JSON estruturado.
`;

  try {
    // Chamada à API da LLM com temperature baixa (0.1 ou 0.2) para evitar alucinações
    const response = await chamarLlmComGuardrail({
      systemPrompt: SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE,
      userMessage,
      temperature: 0.1, // Determinismo máximo
    });

    const parsed: AnaliseResultado = JSON.parse(response);
    return {
      aderente: Boolean(parsed.aderente),
      resumoExecutivo: String(parsed.resumoExecutivo || input.objetoEdital.slice(0, 120)).slice(0, 140),
      pontosDeAtencao: Array.isArray(parsed.pontosDeAtencao) ? parsed.pontosDeAtencao.map(String) : [],
      justificativaCnae: String(parsed.justificativaCnae || ''),
    };
  } catch (error) {
    console.warn('[Agente-CNAE] Fallback determinístico ativado:', error instanceof Error ? error.message : error);
    // Fallback determinístico caso a IA falhe: não inventa dados
    return {
      aderente: false,
      resumoExecutivo: input.objetoEdital.slice(0, 120),
      pontosDeAtencao: ['Verificar edital original no portal convocador'],
      justificativaCnae: 'Análise automática indisponível no momento',
    };
  }
}

/**
 * Versão compatível com a rotina de cron / radar (com suporte a órgão, valor estimado e número de edital)
 */
export async function analisarAderenciaEditalCnae(
  params: AnalisarEditalCnaeParams
): Promise<AnaliseEditalCnaeOutput> {
  const valorFormatado = params.valorEstimado
    ? (typeof params.valorEstimado === 'number'
        ? `R$ ${params.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : String(params.valorEstimado))
    : 'Valor não informado pelo órgão';

  const userMessage = `
DADOS PARA ANÁLISE:
- CNAE da Empresa: ${params.cnae} ${params.ramoAtividade ? `(${params.ramoAtividade})` : ''}
- Número do Edital: ${params.numeroEdital || 'Não especificado'}
- Órgão Licitante: ${params.orgao || 'Órgão Público'}
- Localidade: ${params.municipioUf || 'Não especificada'}
- Valor Estimado: ${valorFormatado}
- Objeto do Edital: ${params.objetoEdital}

Avalie se uma empresa com esse CNAE pode fornecer ou executar o objeto descrito conforme a Lei 14.133/2021.
Retorne exclusivamente o JSON estruturado.
`;

  try {
    const response = await chamarLlmComGuardrail({
      systemPrompt: SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE,
      userMessage,
      temperature: 0.1,
    });

    const parsed = JSON.parse(response) as Partial<AnaliseEditalCnaeOutput>;
    return {
      aderente: Boolean(parsed.aderente),
      resumoExecutivo: String(parsed.resumoExecutivo || params.objetoEdital.slice(0, 120)).slice(0, 140),
      pontosDeAtencao: Array.isArray(parsed.pontosDeAtencao) ? parsed.pontosDeAtencao.map(String) : [],
      justificativaCnae: String(parsed.justificativaCnae || ''),
    };
  } catch (error) {
    console.warn('[Agente-CNAE] Fallback determinístico ativado:', error instanceof Error ? error.message : error);
    return {
      aderente: false,
      resumoExecutivo: params.objetoEdital.slice(0, 120),
      pontosDeAtencao: ['Verificar edital original no portal convocador'],
      justificativaCnae: 'Análise automática indisponível no momento',
    };
  }
}
