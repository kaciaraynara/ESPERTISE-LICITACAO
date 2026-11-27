import { keywordsForCnae } from './cnae-to-keywords.service';

export type NivelViabilidade = 'PRONTO' | 'ATENCAO' | 'FORA';

export interface CompanyCnaeProfile {
  cnaePrincipal?: string | null;
  cnaesSecundarios?: string[] | null;
  palavrasChave?: string[] | null;
  nicho?: string[] | null;
  uf?: string | null;
  porte?: string | null;
}

export interface CnaeCompatibilityResult {
  cnaeCompativel: boolean;
  bloqueadoPorTermoNegativo: boolean;
  termoBloqueador?: string;
  termosEncontrados: string[];
  mensagemCnae: string;
}

export interface NoticeViabilityResult extends CnaeCompatibilityResult {
  nivel: NivelViabilidade;
  pontuacao: number;
  motivosPositivos: string[];
  alertas: string[];
}

interface SegmentRule {
  id: string;
  cnaePrefixes: RegExp;
  cnaeTextTriggers: string[];
  positiveTerms: string[];
  negativeBlockers: string[];
}

const SEGMENT_RULES: SegmentRule[] = [
  {
    id: 'vestuario',
    cnaePrefixes: /^(13|14|15|4641|4642|4781|4782)/,
    cnaeTextTriggers: ['vestuario', 'roupa', 'confeccao', 'uniforme', 'calcado', 'textil', 'tecido'],
    positiveTerms: [
      'vestuario', 'uniforme', 'uniformes', 'fardamento', 'roupa', 'roupas',
      'calcado', 'calcados', 'textil', 'tecido', 'confeccao', 'camisa', 'camiseta',
      'calca', 'jaleco', 'agasalho', 'bota', 'botina', 'tenis', 'meia', 'avental',
      'enxoval', 'toalha', 'lencol', 'epitecido', 'bone',
    ],
    negativeBlockers: [
      'lavadora de roupa', 'maquina de lavar', 'centrifuga de roupa', 'centrifuga de roupas', 'tanquinho', 'secadora industrial', 'calandra', 'passadeira', 'eletrodomestico',
      'insumo hospitalar', 'insumos hospitalares', 'medicamento', 'medicamentos',
      'seringa', 'cateter', 'cirurgico', 'cirurgica', 'odontologico', 'laboratorial',
      'pavimentacao', 'asfalto', 'rede de esgoto', 'esgotamento sanitario', 'terraplenagem',
      'merenda escolar', 'genero alimenticio', 'generos alimenticios', 'combustivel',
      'licenca de software', 'desenvolvimento de software',
    ],
  },
  {
    id: 'engenharia',
    cnaePrefixes: /^(41|42|43|711)/,
    cnaeTextTriggers: ['engenharia', 'construcao', 'obra', 'edificacao', 'arquitetura', 'reforma', 'pavimentacao'],
    positiveTerms: [
      'obra', 'obras', 'construcao', 'engenharia', 'reforma', 'pavimentacao',
      'drenagem', 'edificacao', 'manutencao predial', 'saneamento', 'esgoto',
      'terraplenagem', 'arquitetura', 'projeto basico', 'projeto executivo',
      'infraestrutura', 'impermeabilizacao', 'instalacao eletrica', 'estrutura metalica',
      'alvenaria', 'pintura predial', 'asfaltica',
    ],
    negativeBlockers: [
      'genero alimenticio', 'generos alimenticios', 'merenda escolar', 'fornecimento de refeicao',
      'coffee break', 'cesta basica', 'medicamento', 'medicamentos', 'insumos hospitalares',
      'vestuario', 'uniformes escolares', 'fardamento', 'papelaria', 'cartucho de toner',
    ],
  },
  {
    id: 'ti_software',
    cnaePrefixes: /^(582|62|63|4651|4751|9511)/,
    cnaeTextTriggers: ['software', 'informatica', 'tecnologia da informacao', 'sistemas', 'computacao', 'processamento de dados'],
    positiveTerms: [
      'software', 'sistema', 'sistemas', 'tecnologia', 'informatica', 'computador',
      'computadores', 'notebook', 'servidor', 'servidores', 'rede de dados', 'nuvem',
      'cloud', 'suporte tecnico', 'licenca', 'licenciamento', 'desenvolvimento',
      'banco de dados', 'datacenter', 'ciberseguranca', 'impressora', 'periferico',
      'saas', 'erp', 'aplicativo',
    ],
    negativeBlockers: [
      'rede de esgoto', 'esgotamento sanitario', 'pavimentacao', 'asfalto', 'terraplenagem',
      'obra civil', 'merenda escolar', 'genero alimenticio', 'generos alimenticios',
      'medicamento', 'medicamentos', 'lavadora de roupa', 'vestuario', 'fardamento',
    ],
  },
  {
    id: 'alimentos',
    cnaePrefixes: /^(10|11|463|472|56)/,
    cnaeTextTriggers: ['alimento', 'alimenticio', 'alimentacao', 'merenda', 'refeicao', 'restaurante', 'padaria', 'hortifruti'],
    positiveTerms: [
      'alimento', 'alimentos', 'alimenticio', 'alimenticios', 'alimentacao', 'merenda',
      'refeicao', 'refeicoes', 'hortifruti', 'carne', 'leite', 'pao', 'cafe',
      'coffee break', 'cesta basica', 'cestas basicas', 'bebida', 'agua mineral',
      'acucar', 'arroz', 'feijao', 'nutricao',
    ],
    negativeBlockers: [
      'engenharia', 'obra civil', 'pavimentacao', 'asfaltica', 'rede de esgoto',
      'software', 'licenciamento de sistema', 'medicamento', 'medicamentos',
      'insumos hospitalares', 'vestuario', 'fardamento',
    ],
  },
  {
    id: 'saude_medicamentos',
    cnaePrefixes: /^(21|4644|4645|4664|4771|4773|86)/,
    cnaeTextTriggers: ['medicamento', 'farmaceutic', 'hospitalar', 'saude', 'medico', 'odontologico', 'laboratorial'],
    positiveTerms: [
      'medicamento', 'medicamentos', 'hospitalar', 'hospitalares', 'medico', 'medicos',
      'odontologico', 'laboratorial', 'enfermagem', 'insumo hospitalar', 'farmaceutico',
      'reagente', 'seringa', 'curativo', 'equipamento medico', 'material hospitalar',
      'vacina', 'diagnostico', 'hemodialise',
    ],
    negativeBlockers: [
      'pavimentacao', 'asfalto', 'obra civil', 'terraplenagem', 'rede de esgoto',
      'merenda escolar', 'genero alimenticio', 'vestuario', 'fardamento',
      'licenca de software',
    ],
  },
];

const STOPWORDS = new Set([
  'para', 'como', 'mais', 'pelo', 'pela', 'comercio', 'servicos', 'servico',
  'varejista', 'atacadista', 'fabricacao', 'manutencao', 'geral', 'outros',
  'outras', 'atividade', 'atividades', 'empresa', 'ltda', 'eireli', 'cnpj',
  'artigos', 'produtos', 'materiais', 'equipamentos', 'fornecimento', 'aquisicao',
]);

export function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function containsWholeTerm(textNorm: string, termNorm: string): boolean {
  if (!termNorm || termNorm.length < 3) return false;
  const escaped = termNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(textNorm);
}

export function buildCompanyCnaeTerms(company: CompanyCnaeProfile): {
  cnaes: string[];
  positiveTerms: string[];
  negativeBlockers: string[];
} {
  const cnaes = [
    String(company.cnaePrincipal || '').trim(),
    ...(Array.isArray(company.cnaesSecundarios) ? company.cnaesSecundarios : []),
  ]
    .map((c) => String(c || '').trim())
    .filter(Boolean);

  const positive = new Set<string>();
  const negative = new Set<string>();
  const matchedSegments = new Set<string>();

  for (const cnae of cnaes) {
    const digits = cnae.replace(/\D/g, '');
    const textNorm = normalizeText(cnae);

    for (const rule of SEGMENT_RULES) {
      const prefixHit = Boolean(digits && rule.cnaePrefixes.test(digits));
      const textHit = rule.cnaeTextTriggers.some((t) => textNorm.includes(t));
      if (prefixHit || textHit) {
        matchedSegments.add(rule.id);
        rule.positiveTerms.forEach((t) => positive.add(normalizeText(t)));
        rule.negativeBlockers.forEach((b) => negative.add(normalizeText(b)));
      }
    }

    for (const kw of keywordsForCnae(cnae)) {
      const norm = normalizeText(kw);
      if (norm.length >= 4 && !STOPWORDS.has(norm)) {
        positive.add(norm);
      }
    }

    textNorm
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !STOPWORDS.has(w))
      .forEach((w) => positive.add(w));
  }

  for (const rawTerm of [...(company.palavrasChave || []), ...(company.nicho || [])]) {
    const norm = normalizeText(rawTerm);
    if (norm.length >= 3 && !STOPWORDS.has(norm)) {
      positive.add(norm);
    }
  }

  // Se uma empresa multi-CNAE tiver termos positivos explícitos de outro segmento,
  // não bloqueia termos que ela própria marcou como positivos.
  for (const pos of positive) {
    negative.delete(pos);
  }

  return {
    cnaes,
    positiveTerms: Array.from(positive),
    negativeBlockers: Array.from(negative),
  };
}

export function extractNoticeSearchableText(notice: {
  object?: string | null;
  objeto?: string | null;
  objetoCompra?: string | null;
  items?: Array<{ description?: string | null; descricao?: string | null; descricaoCompleta?: string | null }> | null;
  extractedItems?: Array<{ descricao?: string | null; description?: string | null }> | null;
  extractedTextSnippet?: string | null;
}): string {
  const parts: string[] = [
    String(notice.object || notice.objeto || notice.objetoCompra || ''),
  ];

  const allItems = [...(notice.items || []), ...(notice.extractedItems || [])];
  for (const it of allItems.slice(0, 40)) {
    const desc = it?.description || (it as any)?.descricao || (it as any)?.descricaoCompleta;
    if (desc) parts.push(String(desc));
  }

  if (notice.extractedTextSnippet) {
    parts.push(String(notice.extractedTextSnippet).slice(0, 4000));
  }

  return normalizeText(parts.join(' '));
}

export function evaluateCnaeCompatibility(
  company: CompanyCnaeProfile,
  searchableTextNorm: string,
): CnaeCompatibilityResult {
  const { cnaes, positiveTerms, negativeBlockers } = buildCompanyCnaeTerms(company);

  if (cnaes.length === 0 && positiveTerms.length === 0) {
    return {
      cnaeCompativel: false,
      bloqueadoPorTermoNegativo: false,
      termosEncontrados: [],
      mensagemCnae: 'Cadastre o CNAE principal ou palavras-chave da empresa para validar aderência.',
    };
  }

  const blockerFound = negativeBlockers.find((neg) => containsWholeTerm(searchableTextNorm, neg));
  if (blockerFound) {
    return {
      cnaeCompativel: false,
      bloqueadoPorTermoNegativo: true,
      termoBloqueador: blockerFound,
      termosEncontrados: [],
      mensagemCnae: `Fora do escopo do CNAE (${company.cnaePrincipal || cnaes[0] || 'empresa'}): edital contém termo incompatível ("${blockerFound}").`,
    };
  }

  const termosEncontrados = positiveTerms.filter((t) => containsWholeTerm(searchableTextNorm, t));
  const cnaeCompativel = termosEncontrados.length > 0;

  return {
    cnaeCompativel,
    bloqueadoPorTermoNegativo: false,
    termosEncontrados,
    mensagemCnae: cnaeCompativel
      ? `Compatível com a atividade econômica (${company.cnaePrincipal || cnaes[0] || 'segmento cadastrado'}): ${termosEncontrados.slice(0, 3).join(', ')}.`
      : `Objeto e itens do edital não correspondem aos CNAEs cadastrados (${cnaes.join(', ') || 'não informado'}).`,
  };
}

export function evaluateNoticeViability(
  notice: {
    object?: string | null;
    uf?: string | null;
    estimatedValue?: number | null;
    closingAt?: Date | string | null;
    openingAt?: Date | string | null;
    items?: Array<{ description?: string | null }> | null;
    extractedItems?: Array<{ descricao?: string | null }> | null;
    extractedTextSnippet?: string | null;
  },
  company: CompanyCnaeProfile,
  docsStats: {
    carregado: boolean;
    documentosCofre: number;
    certidoesValidas: number;
    certidoesPendentes: number;
  },
): NoticeViabilityResult {
  const searchableTextNorm = extractNoticeSearchableText(notice);
  const compat = evaluateCnaeCompatibility(company, searchableTextNorm);

  const motivosPositivos: string[] = [];
  const alertas: string[] = [];

  const valor = notice.estimatedValue != null && Number(notice.estimatedValue) > 0 ? Number(notice.estimatedValue) : null;
  const rawDate = notice.closingAt || notice.openingAt || null;
  let diasRestantes: number | null = null;
  if (rawDate) {
    const ms = new Date(rawDate).getTime();
    if (!Number.isNaN(ms)) {
      diasRestantes = Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
    }
  }

  // Trava eliminatória: fora do CNAE ou termo bloqueador nunca pontua > 15% e nunca vira PRONTO/ATENCAO
  if (!compat.cnaeCompativel || compat.bloqueadoPorTermoNegativo) {
    alertas.push(compat.mensagemCnae);
    const capScore = compat.bloqueadoPorTermoNegativo ? 0 : 10;
    return {
      ...compat,
      nivel: 'FORA',
      pontuacao: capScore,
      motivosPositivos,
      alertas,
    };
  }

  // Somente editais com aderência real ao CNAE somam pontos de viabilidade (> 50%)
  let pontuacao = 50;
  motivosPositivos.push(`Aderente ao CNAE (${compat.termosEncontrados.slice(0, 3).join(', ')})`);

  const temPendenciaDoc =
    docsStats.certidoesPendentes > 0 ||
    (docsStats.carregado && docsStats.documentosCofre === 0 && docsStats.certidoesValidas === 0);

  if (!docsStats.carregado) {
    pontuacao += 10;
  } else if (docsStats.certidoesPendentes > 0) {
    alertas.push(`${docsStats.certidoesPendentes} certidão(ões) pendente(s)`);
  } else if (docsStats.documentosCofre === 0 && docsStats.certidoesValidas === 0) {
    pontuacao += 5;
    alertas.push('Anexe documentos no Cofre para confirmar habilitação');
  } else {
    pontuacao += 20;
    motivosPositivos.push('Documentação e certidões em dia');
  }

  if (diasRestantes !== null) {
    if (diasRestantes >= 5) {
      pontuacao += 15;
      motivosPositivos.push(`Prazo estratégico (${diasRestantes} dias restantes)`);
    } else if (diasRestantes >= 2) {
      pontuacao += 8;
      alertas.push(`Prazo curto (${diasRestantes} dias restantes)`);
    } else if (diasRestantes >= 0) {
      alertas.push('Encerramento iminente');
    } else {
      pontuacao = 15;
      alertas.push('Prazo encerrado');
    }
  }

  const ufEmpresa = String(company.uf || '').trim().toUpperCase();
  const ufEdital = String(notice.uf || '').trim().toUpperCase();
  if (ufEmpresa && ufEdital === ufEmpresa) {
    pontuacao += 10;
    motivosPositivos.push(`Sede no mesmo Estado (${ufEmpresa})`);
  } else if (ufEdital) {
    motivosPositivos.push(`Abrangência em ${ufEdital}`);
  }

  if (valor !== null && valor <= 80000) {
    pontuacao += 5;
    motivosPositivos.push('Faixa exclusiva ME/EPP (até R$ 80 mil)');
  }

  const finalScore = Math.max(0, Math.min(100, pontuacao));
  const prazoValido = diasRestantes === null || diasRestantes >= 0;

  let nivel: NivelViabilidade = 'FORA';
  if (prazoValido) {
    nivel = !temPendenciaDoc && (diasRestantes === null || diasRestantes >= 3) && finalScore >= 65
      ? 'PRONTO'
      : 'ATENCAO';
  }

  return {
    ...compat,
    nivel,
    pontuacao: finalScore,
    motivosPositivos,
    alertas,
  };
}
