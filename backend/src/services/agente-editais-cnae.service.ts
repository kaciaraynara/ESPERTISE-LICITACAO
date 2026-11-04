import { GoogleGenerativeAI } from '@google/generative-ai';

export const SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE = `
Você é o Agente Especialista em Licitações Públicas (Lei 14.133/2021) da plataforma Expertise Licitatória.
Sua função é analisar editais recém-coletados e avaliar a aderência direta com o CNAE e ramo de atividade da empresa licitante.

DIRETRIZES FUNDAMENTAIS (ZERO ALUCINAÇÃO):
1. BASEIE-SE EXCLUSIVAMENTE nos dados fornecidos no contexto: objeto da licitação, CNAE fornecido e regras da Lei 14.133/2021.
2. PROIBIÇÃO DE SUPOSIÇÃO: Nunca invente valores, prazos, exigências de certidões ou itens não descritos explicitamente no edital.
3. Se o edital não especificar valor estimado, declare explicitamente: "Valor não informado pelo órgão".
4. SEJA DETERMINÍSTICO E OBJETIVO: Gere o resumo de cada oportunidade em no máximo 2 linhas, focando no que a empresa precisa fornecer.

FORMATO DE SAÍDA OBRIGATÓRIO (JSON puro, sem blocos markdown):
{
  "aderente": true | false,
  "resumoExecutivo": "string objetiva com no máximo 140 caracteres",
  "pontosDeAtencao": ["exigência 1", "exigência 2"],
  "justificativaCnae": "string explicando a correlação com a atividade"
}
`.trim();

export interface AnaliseEditalCnaeOutput {
  aderente: boolean;
  resumoExecutivo: string;
  pontosDeAtencao: string[];
  justificativaCnae: string;
}

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

/**
 * Agente Especialista que avalia a aderência de um edital ao CNAE da empresa licitante.
 */
export async function analisarAderenciaEditalCnae(
  params: AnalisarEditalCnaeParams
): Promise<AnaliseEditalCnaeOutput> {
  const rawKey = process.env.GEMINI_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '').trim();

  // Caso a API Key do Gemini não esteja configurada, retorna avaliação determinística de fallback
  if (!apiKey || apiKey === 'unconfigured') {
    console.warn('[Agente-CNAE] GEMINI_API_KEY não configurada. Aplicando análise heurística básica.');
    const objeto = (params.objetoEdital || '').toLowerCase();
    const cnae = (params.cnae || '').toLowerCase();
    const termo = (params.ramoAtividade || '').toLowerCase();
    const aderente = Boolean((cnae && objeto.includes(cnae)) || (termo && objeto.includes(termo)));

    return {
      aderente,
      resumoExecutivo: params.objetoEdital.slice(0, 140),
      pontosDeAtencao: ['Verificar exigências de habilitação técnica no edital oficial'],
      justificativaCnae: aderente
        ? 'Identificada correspondência direta de termos entre o objeto e a atividade cadastrada.'
        : 'Necessária análise pormenorizada do termo de referência para confirmação.',
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const modelsToTry = Array.from(new Set([configuredModel, ...FALLBACK_GEMINI_MODELS].filter(Boolean))) as string[];

  const valorFormatado = params.valorEstimado
    ? (typeof params.valorEstimado === 'number'
        ? `R$ ${params.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : String(params.valorEstimado))
    : 'Valor não informado pelo órgão';

  const userPrompt = `
DADOS PARA ANÁLISE:
- CNAE da Empresa: ${params.cnae} ${params.ramoAtividade ? `(${params.ramoAtividade})` : ''}
- Número do Edital: ${params.numeroEdital || 'Não especificado'}
- Órgão Licitante: ${params.orgao || 'Órgão Público'}
- Localidade: ${params.municipioUf || 'Não especificada'}
- Valor Estimado: ${valorFormatado}
- Objeto da Licitação:
"""${params.objetoEdital}"""
`.trim();

  let ultimoErro: unknown = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE,
        generationConfig: {
          temperature: 0.1, // Alta precisão e determinismo
          responseMimeType: 'application/json',
        },
      });

      const response = await model.generateContent(userPrompt);
      const textOutput = response.response.text();

      if (!textOutput || !textOutput.trim()) {
        throw new Error('Resposta vazia da IA.');
      }

      const jsonStr = extrairJsonPuro(textOutput);
      const parsed = JSON.parse(jsonStr) as Partial<AnaliseEditalCnaeOutput>;

      return {
        aderente: Boolean(parsed.aderente),
        resumoExecutivo: String(parsed.resumoExecutivo || params.objetoEdital.slice(0, 140)).slice(0, 140),
        pontosDeAtencao: Array.isArray(parsed.pontosDeAtencao)
          ? parsed.pontosDeAtencao.map(String)
          : [],
        justificativaCnae: String(parsed.justificativaCnae || 'Avaliação de compatibilidade com CNAE concluída.'),
      };
    } catch (err) {
      ultimoErro = err;
      console.warn(`[Agente-CNAE] Falha com modelo ${modelName}, tentando próximo:`, err instanceof Error ? err.message : err);
    }
  }

  console.error('[Agente-CNAE] Todos os modelos falharam na análise:', ultimoErro);

  // Fallback seguro em caso de timeout ou indisponibilidade da IA
  return {
    aderente: false,
    resumoExecutivo: params.objetoEdital.slice(0, 140),
    pontosDeAtencao: ['Indisponibilidade temporária de consulta de IA para análise automática'],
    justificativaCnae: 'Não foi possível validar a correlação de CNAE automaticamente neste momento.',
  };
}
