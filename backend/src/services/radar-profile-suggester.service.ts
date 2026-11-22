import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../database/prisma';
import { expandirTermosCnae } from './cnae-dictionary.service';
import { keywordsForCnae } from './cnae-to-keywords.service';
import {
  buildRadarSqlQuery,
  parsePalavras,
  parseTipoObjeto,
  parseUfs,
  type RadarObjectType,
} from './radar-query-builder.service';

export interface RadarRamoDefinition {
  id: string;
  label: string;
  gatilhos: string[];
  palavras: string[];
  tiposObjeto: RadarObjectType[];
}

export const RADAR_RAMOS_CATALOG: RadarRamoDefinition[] = [
  {
    id: 'vestuario_uniformes',
    label: 'Vestuário, uniformes e têxteis',
    gatilhos: ['vestuario', 'uniforme', 'fardamento', 'roupa', 'confeccao', 'camiseta', 'jaleco', 'calcado', 'enxoval', 'tecido', 'epi'],
    palavras: ['uniformes', 'vestuário', 'fardamento', 'confecção', 'calçados', 'enxoval'],
    tiposObjeto: ['BENS'],
  },
  {
    id: 'ti_software',
    label: 'Software, sistemas e licenças',
    gatilhos: ['software', 'sistema', 'licenca', 'informatica', 'tecnologia', 'dados', 'nuvem', 'ti', 'suporte', 'computador', 'notebook'],
    palavras: ['software', 'sistema de gestão', 'licença de software', 'informática', 'computadores', 'suporte técnico'],
    tiposObjeto: ['SERVICOS', 'BENS'],
  },
  {
    id: 'engenharia_obras',
    label: 'Obras, reformas e engenharia',
    gatilhos: ['obra', 'reforma', 'construcao', 'engenharia', 'pavimentacao', 'drenagem', 'edificacao', 'infraestrutura', 'predial'],
    palavras: ['obra', 'reforma', 'construção', 'engenharia', 'pavimentação', 'manutenção predial'],
    tiposObjeto: ['OBRAS'],
  },
  {
    id: 'saude_hospitalar',
    label: 'Saúde, medicamentos e hospitalar',
    gatilhos: ['saude', 'hospitalar', 'medicamento', 'odonto', 'odontologico', 'laboratorio', 'medico', 'enfermagem', 'diagnostico'],
    palavras: ['medicamentos', 'material hospitalar', 'equipamentos médicos', 'odontológico', 'laboratorial'],
    tiposObjeto: ['BENS', 'SERVICOS'],
  },
  {
    id: 'alimentos_merenda',
    label: 'Alimentos, merenda e cestas básicas',
    gatilhos: ['alimento', 'alimenticio', 'merenda', 'refeicao', 'cesta', 'bebida', 'hortifruti', 'carne', 'panificacao'],
    palavras: ['gêneros alimentícios', 'merenda escolar', 'alimentação', 'cesta básica', 'refeições'],
    tiposObjeto: ['BENS'],
  },
  {
    id: 'limpeza_conservacao',
    label: 'Limpeza, higiene e conservação',
    gatilhos: ['limpeza', 'higiene', 'conservacao', 'asseio', 'zeladoria', 'descartaveis', 'saneantes', 'dedetizacao'],
    palavras: ['limpeza predial', 'material de limpeza', 'higiene', 'conservação', 'descartáveis'],
    tiposObjeto: ['SERVICOS', 'BENS'],
  },
  {
    id: 'papelaria_mobiliario',
    label: 'Papelaria, expediente e mobiliário',
    gatilhos: ['papelaria', 'expediente', 'material escolar', 'kit escolar', 'escritorio', 'mobiliario', 'movel', 'moveis', 'cadeira', 'mesa', 'grafica'],
    palavras: ['material de expediente', 'papelaria', 'mobiliário', 'material escolar', 'impressão gráfica'],
    tiposObjeto: ['BENS'],
  },
  {
    id: 'transporte_veiculos',
    label: 'Veículos, transporte, peças e combustível',
    gatilhos: ['transporte', 'transporte escolar', 'veiculo', 'locacao de veiculo', 'combustivel', 'frete', 'automotivo', 'pecas automotivas', 'pneu', 'frota'],
    palavras: ['veículos', 'locação de veículos', 'combustível', 'peças automotivas', 'pneus', 'transporte'],
    tiposObjeto: ['BENS', 'SERVICOS'],
  },
  {
    id: 'seguranca_vigilancia',
    label: 'Segurança, vigilância e monitoramento',
    gatilhos: ['seguranca', 'vigilancia', 'portaria', 'cftv', 'alarme', 'monitoramento', 'controle de acesso'],
    palavras: ['vigilância', 'monitoramento eletrônico', 'portaria', 'cftv', 'segurança patrimonial'],
    tiposObjeto: ['SERVICOS'],
  },
  {
    id: 'energia_eletrica',
    label: 'Elétrica, iluminação pública e energia solar',
    gatilhos: ['eletrica', 'iluminacao publica', 'lampada led', 'energia solar', 'fotovoltaica', 'gerador', 'subestacao', 'cabo eletrico'],
    palavras: ['material elétrico', 'iluminação pública', 'energia solar', 'lâmpadas led', 'gerador'],
    tiposObjeto: ['BENS', 'OBRAS'],
  },
  {
    id: 'comunicacao_eventos',
    label: 'Eventos, som, iluminação e comunicação',
    gatilhos: ['evento', 'eventos', 'palco', 'sonorizacao', 'buffet', 'publicidade', 'comunicacao', 'tenda', 'graderio'],
    palavras: ['organização de eventos', 'locação de som', 'estrutura de eventos', 'buffet', 'publicidade'],
    tiposObjeto: ['SERVICOS'],
  },
  {
    id: 'consultoria_gestao',
    label: 'Consultoria, contabilidade e capacitação',
    gatilhos: ['consultoria', 'assessoria', 'auditoria', 'contabilidade', 'treinamento', 'capacitacao', 'juridica', 'pericia'],
    palavras: ['consultoria', 'assessoria técnica', 'auditoria', 'treinamento', 'capacitação'],
    tiposObjeto: ['SERVICOS'],
  },
  {
    id: 'manutencao_climatizacao',
    label: 'Climatização, refrigeração e manutenção técnica',
    gatilhos: ['ar condicionado', 'climatizacao', 'refrigeracao', 'elevador', 'manutencao preventiva', 'calibracao'],
    palavras: ['ar condicionado', 'climatização', 'manutenção preventiva', 'refrigeração', 'instalação'],
    tiposObjeto: ['SERVICOS', 'BENS'],
  },
  {
    id: 'agro_maquinas',
    label: 'Agronegócio, máquinas e ferramentas',
    gatilhos: ['agricola', 'trator', 'implemento', 'semente', 'fertilizante', 'ferramenta', 'maquina pesada', 'rocadeira'],
    palavras: ['equipamentos agrícolas', 'tratores', 'ferramentas', 'máquinas', 'insumos agrícolas'],
    tiposObjeto: ['BENS'],
  },
];

const STOPWORDS_PT = new Set([
  'para', 'como', 'mais', 'com', 'sem', 'por', 'das', 'dos', 'uma', 'uns', 'umas',
  'nas', 'nos', 'que', 'ser', 'sao', 'sua', 'seu', 'suas', 'seus', 'empresa',
  'venda', 'vendo', 'vendas', 'presto', 'prestacao', 'servico', 'servicos',
  'fornecimento', 'forneco', 'material', 'materiais', 'equipamento', 'equipamentos',
  'produto', 'produtos', 'comercio', 'varejista', 'atacadista', 'geral', 'ltda',
  'sobre', 'todo', 'toda', 'entre', 'outros', 'outras', 'area', 'setor',
]);

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesTrigger(textNorm: string, trigger: string): boolean {
  const esc = escapeRegex(trigger.trim());
  if (!esc) return false;
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:s|es)?(?:$|[^a-z0-9])`).test(textNorm);
}

export interface EstimativaPerfilRadar {
  abertasAgora: number;
  ultimos30Dias: number;
  estimativaPorDia: number;
}

export async function estimarPerfilRadar(input: {
  palavras?: string[];
  tiposObjeto?: string[];
  incluirSemClassificacao?: boolean;
  ufs?: string[];
}): Promise<EstimativaPerfilRadar> {
  if (typeof (prisma as any)?.$queryRawUnsafe !== 'function') {
    return { abertasAgora: 0, ultimos30Dias: 0, estimativaPorDia: 0 };
  }

  const palavras = parsePalavras(input.palavras || []);
  const tipos = parseTipoObjeto(input.tiposObjeto || []);
  const ufs = parseUfs(input.ufs || []);
  const incluirSemClassificacao = input.incluirSemClassificacao !== false;

  const built = buildRadarSqlQuery({
    palavras,
    tipoObjeto: tipos.join(','),
    incluirSemClassificacao,
    ufs,
    apenasAbertos: true,
  });

  try {
    const sql = `
      SELECT
        count(*)::int AS abertas_agora,
        count(*) FILTER (WHERE published_at >= NOW() - INTERVAL '30 days')::int AS ultimos_30_dias
      FROM procurement_notices
      WHERE ${built.fullWhereSql}
    `;
    const rows: any[] = await (prisma as any).$queryRawUnsafe(sql, ...built.listParams);
    const row = rows?.[0] || {};
    const abertasAgora = Number(row.abertas_agora ?? 0);
    const ultimos30Dias = Number(row.ultimos_30_dias ?? 0);
    const estimativaPorDia = ultimos30Dias > 0 ? Math.max(1, Math.round(ultimos30Dias / 30)) : 0;
    return { abertasAgora, ultimos30Dias, estimativaPorDia };
  } catch {
    return { abertasAgora: 0, ultimos30Dias: 0, estimativaPorDia: 0 };
  }
}

export async function sugerirPerfilRadar(input: {
  descricao?: string;
  cnae?: string;
  ramos?: string[];
  ufs?: string[];
}) {
  const descricao = String(input.descricao || '').trim();
  const cnae = String(input.cnae || '').trim();
  const inputRamos = Array.isArray(input.ramos) ? input.ramos.map((r) => String(r).trim()).filter(Boolean) : [];
  const ufs = parseUfs(input.ufs || []);

  const combinedNorm = normalizeText(`${descricao} ${cnae} ${inputRamos.join(' ')}`);

  const ramosMap = new Map<string, string>();
  const palavrasSet = new Map<string, string>();
  const tiposSet = new Set<RadarObjectType>();

  const addPalavra = (raw: string) => {
    const clean = raw.trim();
    if (!clean || clean.length < 3) return;
    const key = normalizeText(clean);
    if (!key || STOPWORDS_PT.has(key)) return;
    if (!palavrasSet.has(key) && palavrasSet.size < 12) {
      palavrasSet.set(key, clean);
    }
  };

  for (const ramoDef of RADAR_RAMOS_CATALOG) {
    const matchByIdOrLabel = inputRamos.some(
      (r) => normalizeText(r) === normalizeText(ramoDef.id) || normalizeText(r) === normalizeText(ramoDef.label),
    );
    const matchByTrigger = ramoDef.gatilhos.some((g) => matchesTrigger(combinedNorm, g));
    if (matchByIdOrLabel || matchByTrigger) {
      ramosMap.set(ramoDef.id, ramoDef.label);
      ramoDef.palavras.forEach(addPalavra);
      ramoDef.tiposObjeto.forEach((t) => tiposSet.add(t));
    }
  }

  for (const rLabel of inputRamos) {
    const found = RADAR_RAMOS_CATALOG.find(
      (cat) => normalizeText(cat.id) === normalizeText(rLabel) || normalizeText(cat.label) === normalizeText(rLabel),
    );
    if (!found) {
      ramosMap.set(normalizeText(rLabel), rLabel);
    }
  }

  if (cnae) {
    expandirTermosCnae(cnae).forEach(addPalavra);
    keywordsForCnae(cnae).forEach(addPalavra);
  }

  if (descricao) {
    const tokens = normalizeText(descricao)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS_PT.has(t));
    tokens.slice(0, 6).forEach(addPalavra);
  }

  let usedAi = false;
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (descricao && geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = [
        'Você é especialista em licitações públicas brasileiras (PNCP / Lei 14.133/2021).',
        'A partir da descrição da empresa abaixo, sugira termos práticos usados em objetos de editais.',
        `Descrição: "${descricao.slice(0, 350)}"`,
        cnae ? `CNAE informado: "${cnae.slice(0, 150)}"` : '',
        'Retorne EXCLUSIVAMENTE JSON válido neste formato sem markdown:',
        '{"palavras":["termo 1","termo 2","termo 3"],"tiposObjeto":["BENS","SERVICOS"]}',
        'Regras: máximo 5 palavras-chave em português; tiposObjeto apenas entre BENS, SERVICOS e OBRAS.',
      ]
        .filter(Boolean)
        .join('\n');

      const aiRes: any = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GEMINI_SUGGESTER_TIMEOUT')), 3500)),
      ]);
      const rawText = String(aiRes?.response?.text?.() || '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed?.palavras)) {
          parsed.palavras.slice(0, 6).forEach((p: unknown) => {
            if (typeof p === 'string') addPalavra(p);
          });
          usedAi = true;
        }
        if (Array.isArray(parsed?.tiposObjeto)) {
          parseTipoObjeto(parsed.tiposObjeto).forEach((t) => tiposSet.add(t));
          usedAi = true;
        }
      }
    } catch {
      // Fallback determinístico silencioso quando Gemini estiver lento ou indisponível
    }
  }

  if (tiposSet.size === 0) {
    if (/\b(obra|obras|reforma|construcao|pavimentacao|engenharia)\b/.test(combinedNorm)) {
      tiposSet.add('OBRAS');
    } else if (/\b(prestacao|servico|servicos|locacao|limpeza|vigilancia|consultoria|software|manutencao)\b/.test(combinedNorm)) {
      tiposSet.add('SERVICOS');
    } else {
      tiposSet.add('BENS');
      tiposSet.add('SERVICOS');
    }
  }

  const ramos = Array.from(ramosMap.values());
  const palavras = Array.from(palavrasSet.values());
  const tiposObjeto = Array.from(tiposSet.values());
  const incluirSemClassificacao = true;

  const estimativa = await estimarPerfilRadar({
    palavras,
    tiposObjeto,
    incluirSemClassificacao,
    ufs,
  });

  return {
    ramos,
    palavras,
    tiposObjeto,
    incluirSemClassificacao,
    ufs,
    estimativa,
    origem: usedAi ? 'ia+regras' : 'regras',
  };
}
