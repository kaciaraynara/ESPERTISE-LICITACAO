import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../database/prisma';

const CNAE_DIVISION_KEYWORDS: Array<{
  min: number;
  max: number;
  keywords: string[];
}> = [
  { min: 1, max: 3, keywords: ['agricultura', 'pecuária', 'alimentos', 'silvicultura', 'pesca'] },
  { min: 5, max: 9, keywords: ['mineração', 'extração mineral', 'pedras', 'areia'] },
  { min: 10, max: 12, keywords: ['alimentos', 'bebidas', 'refeição', 'produtos alimentícios'] },
  { min: 13, max: 15, keywords: ['uniformes', 'vestuário', 'calçados', 'têxteis'] },
  { min: 16, max: 18, keywords: ['móveis', 'madeira', 'papel', 'impressão', 'gráfica'] },
  { min: 19, max: 23, keywords: ['combustíveis', 'produtos químicos', 'plásticos', 'materiais de construção'] },
  { min: 24, max: 30, keywords: ['máquinas', 'equipamentos', 'veículos', 'peças', 'estruturas metálicas'] },
  { min: 31, max: 33, keywords: ['móveis', 'equipamentos', 'manutenção', 'reparos'] },
  { min: 35, max: 35, keywords: ['energia', 'instalações elétricas', 'geração elétrica'] },
  { min: 36, max: 39, keywords: ['água', 'saneamento', 'resíduos', 'reciclagem', 'limpeza urbana'] },
  { min: 41, max: 43, keywords: ['obra', 'construção', 'engenharia', 'reforma', 'manutenção predial'] },
  { min: 45, max: 47, keywords: ['materiais', 'equipamentos', 'suprimentos', 'fornecimento'] },
  { min: 49, max: 53, keywords: ['transporte', 'logística', 'frete', 'armazenagem', 'entrega'] },
  { min: 55, max: 56, keywords: ['alimentação', 'refeições', 'hospedagem', 'serviços de alimentação'] },
  { min: 58, max: 63, keywords: ['software', 'tecnologia', 'sistemas', 'informática', 'telecomunicações'] },
  { min: 64, max: 66, keywords: ['serviços financeiros', 'seguros', 'consultoria financeira'] },
  { min: 68, max: 68, keywords: ['imóveis', 'locação', 'administração imobiliária'] },
  { min: 69, max: 75, keywords: ['consultoria', 'serviços técnicos', 'engenharia', 'arquitetura', 'serviços profissionais'] },
  { min: 77, max: 82, keywords: ['limpeza', 'vigilância', 'segurança', 'terceirização', 'serviços administrativos'] },
  { min: 85, max: 85, keywords: ['educação', 'ensino', 'capacitação', 'treinamento'] },
  { min: 86, max: 88, keywords: ['saúde', 'serviços médicos', 'serviços hospitalares', 'assistência social'] },
  { min: 90, max: 93, keywords: ['cultura', 'eventos', 'esportes', 'recreação'] },
  { min: 94, max: 96, keywords: ['serviços pessoais', 'manutenção', 'reparos'] },
];

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'e', 'para', 'com', 'sem', 'ou',
  'a', 'o', 'as', 'os', 'comercio', 'servicos', 'atacadista', 'varejista',
  'fabricacao', 'atividade', 'principal',
]);

export interface TenantRadarProfile {
  cnaes: string[];
  keywords: string[];
  uf?: string;
}

function extractDivision(cnae: string): number | null {
  const normalized = cnae.trim();
  const code = normalized.match(/^\D*(\d{2})\s*[-.]?\s*\d/);
  if (code) {
    return Number(code[1]);
  }

  const description = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const descriptionMatch = CNAE_DIVISION_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => description.includes(
      keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    )),
  );
  return descriptionMatch?.min ?? null;
}

export function keywordsForCnae(cnae: string | null | undefined): string[] {
  if (!cnae?.trim()) {
    return [];
  }

  const division = extractDivision(cnae);
  const mapping = division === null
    ? undefined
    : CNAE_DIVISION_KEYWORDS.find(({ min, max }) => division >= min && division <= max);
  const descriptionTerms = cnae
    .replace(/^\s*\d[\d./\-\s]*/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3 && !STOPWORDS.has(term));

  return [...new Set([...(mapping?.keywords ?? []), ...descriptionTerms])];
}

export async function getTenantRadarProfile(tenantId: string): Promise<TenantRadarProfile> {
  const companies = await prisma.company.findMany({
    where: { tenantId },
    select: {
      cnaePrincipal: true,
      palavrasChave: true,
      nicho: true,
      uf: true,
    },
  });

  const cnaes = [...new Set(
    companies.map((company) => company.cnaePrincipal?.trim()).filter((value): value is string => Boolean(value)),
  )];
  const cnaeKeywords = cnaes.flatMap(keywordsForCnae);
  const configuredKeywords = companies.flatMap((company) => [
    ...company.palavrasChave,
    ...company.nicho,
  ]);
  const keywords = [...new Set(
    [...cnaeKeywords, ...configuredKeywords]
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean),
  )];
  const uf = companies.find((company) => company.uf?.trim())?.uf?.trim().toUpperCase();

  return { cnaes, keywords, uf };
}


// Re-export do Agente Especialista de Editais e CNAE (Lei 14.133/2021)
export {
  analisarEditalParaCnae,
  AnalisarAderenciaInput,
  AnaliseResultado,
  SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE,
} from './agente-editais-cnae.service';


// ============================================================================
// INTELIGÊNCIA SEMÂNTICA: AVALIAÇÃO DE COMPATIBILIDADE DE EDITAIS COM CNAE
// (Diretriz Zero Alucinação / Lei 14.133/2021)
// ============================================================================

export const SYSTEM_PROMPT_COMPATIBILIDADE_CNAE = `
Você é o Analisador de Compatibilidade de Licitações da Expertise Licitatória.
Compare o objeto do edital fornecido com as atividades permitidas pelo código de CNAE informado.
PROIBIÇÕES:
- Não invente itens não descritos no edital.
- Se o edital não tiver valor estimado, declare 'Não informado'.
- Responda EXCLUSIVAMENTE em formato JSON:
{
  "aderente": boolean,
  "resumoObjeto": string (máximo 120 caracteres),
  "justificativa": string
}
`.trim();

export interface CompatibilidadeEditalCnaeInput {
  objetoEdital: string;
  cnaeCodigo: string;
  razaoSocial?: string;
  valorEstimado?: number | string | null;
}

export interface CompatibilidadeEditalCnaeOutput {
  aderente: boolean;
  resumoObjeto: string;
  justificativa: string;
}

const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

function sanitizarSaidaJson(raw: string): string {
  let limpo = raw.trim();
  if (limpo.startsWith('```')) {
    limpo = limpo.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return limpo;
}

/**
 * Avalia se o edital capturado é aderente ao CNAE de uma empresa (Zero Alucinação).
 * Executa a LLM com temperature: 0.1 e formatação JSON estrita.
 */
export async function avaliarCompatibilidadeCnae(
  params: CompatibilidadeEditalCnaeInput
): Promise<CompatibilidadeEditalCnaeOutput> {
  // 1 & 2. Validação rigorosa dos parâmetros de entrada
  const objeto = (params.objetoEdital || '').trim();
  const cnae = (params.cnaeCodigo || '').trim();

  if (!objeto || !cnae) {
    console.warn('[Compatibilidade-CNAE] Parâmetros obrigatórios ausentes (objeto ou CNAE).');
    return {
      aderente: false,
      resumoObjeto: objeto.slice(0, 120) || 'Objeto não informado',
      justificativa: 'Objeto do edital ou código de CNAE não foram fornecidos.',
    };
  }

  const rawKey = process.env.GEMINI_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '').trim();

  // Caso chave da API não esteja presente, aplica fallback seguro sem derrubar o fluxo
  if (!apiKey || apiKey === 'unconfigured') {
    console.warn('[Compatibilidade-CNAE] GEMINI_API_KEY não configurada. Aplicando fallback determinístico.');
    return {
      aderente: false,
      resumoObjeto: objeto.slice(0, 120),
      justificativa: 'Validação automática de inteligência temporariamente indisponível.',
    };
  }

  const valorFormatado = params.valorEstimado
    ? (typeof params.valorEstimado === 'number'
        ? `R$ ${params.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : String(params.valorEstimado))
    : 'Não informado';

  const userPrompt = `
DADOS PARA ANÁLISE:
- CNAE da Empresa: ${cnae} ${params.razaoSocial ? `(${params.razaoSocial})` : ''}
- Valor Estimado: ${valorFormatado}
- Objeto do Edital:
"""${objeto}"""
`.trim();

  const genAI = new GoogleGenerativeAI(apiKey);
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const modelsToTry = Array.from(new Set([configuredModel, ...FALLBACK_GEMINI_MODELS].filter(Boolean))) as string[];

  let ultimoErro: unknown = null;

  // 3. Chamada da LLM com failover multi-modelo e temperatura 0.1
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT_COMPATIBILIDADE_CNAE,
        generationConfig: {
          temperature: 0.1, // Determinismo máximo
          responseMimeType: 'application/json',
        },
      });

      const response = await model.generateContent(userPrompt);
      const textOutput = response.response.text();

      if (!textOutput || !textOutput.trim()) {
        throw new Error('Resposta vazia da IA.');
      }

      // 4. Parse seguro do JSON retornado
      const jsonStr = sanitizarSaidaJson(textOutput);
      const parsed = JSON.parse(jsonStr) as Partial<CompatibilidadeEditalCnaeOutput>;

      return {
        aderente: Boolean(parsed.aderente),
        resumoObjeto: String(parsed.resumoObjeto || objeto.slice(0, 120)).slice(0, 120),
        justificativa: String(parsed.justificativa || 'Análise de compatibilidade de CNAE concluída.'),
      };
    } catch (err) {
      ultimoErro = err;
      console.warn(`[Compatibilidade-CNAE] Tentativa com modelo ${modelName} falhou:`, err instanceof Error ? err.message : err);
    }
  }

  // 5. Fallback determinístico seguro em caso de indisponibilidade ou erro de parse
  console.error('[Compatibilidade-CNAE] Falha em todos os modelos de IA:', ultimoErro);
  return {
    aderente: false,
    resumoObjeto: objeto.slice(0, 120),
    justificativa: 'Validação automática indisponível no momento.',
  };
}

export const avaliarCompatibilidadeEditalCnae = avaliarCompatibilidadeCnae;
