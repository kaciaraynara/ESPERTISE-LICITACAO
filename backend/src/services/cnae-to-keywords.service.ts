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
