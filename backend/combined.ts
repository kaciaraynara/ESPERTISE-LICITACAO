import { NoticesErrorRadarService } from './notices-error-radar.service';
import { NoticesSearchService, type NoticesUserContext } from './notices-search.service';
import { prisma } from '../database/prisma';

type EmpresaRecord = any;

type OpportunityLevel = 'baixa' | 'media' | 'alta';

interface OpportunityScoreResult {
  noticeId: string;
  generatedAt: string;
  score: number;
  nivel: OpportunityLevel;
  motivos: string[];
  riscos: string[];
  recomendacao: string;
  empresa: {
    id: string | null;
    razaoSocial: string | null;
    cnpj: string | null;
  };
  edital: {
    id: string;
    objeto: string | null;
    modalidade: string | null;
    uf: string | null;
    municipio: string | null;
    valorEstimado: number | null;
  };
  detalhes: {
    compatibilidadeNicho: number;
    compatibilidadeRegiao: number;
    compatibilidadeValor: number;
    prazo: number;
    riscoEdital: number;
  };
}

export class NoticesOpportunityScoreService {
  constructor(
    private readonly notices = new NoticesSearchService(),
    private readonly errorRadar = new NoticesErrorRadarService(),
  ) {}


  async scoreNotice(
    noticeId: string,
    input: unknown = {},
    context: NoticesUserContext = {},
  ): Promise<OpportunityScoreResult | null> {
    const notice = await this.notices.getNoticeById(noticeId, {}, context);

    if (!notice) {
      return null;
    }

    const userId = context.user?.id ?? null;
    const empresa = userId ? await this.resolveEmpresa(userId, input) : null;

    const radar = await this.errorRadar
      .analyzeNotice(noticeId, context)
      .catch(() => null);

    const motivos: string[] = [];
    const riscos: string[] = [];

    const compatibilidadeNicho = calcularCompatibilidadeNicho(notice, empresa, motivos);
    const compatibilidadeRegiao = calcularCompatibilidadeRegiao(notice, empresa, motivos);
    const compatibilidadeValor = calcularCompatibilidadeValor(notice, empresa, motivos, riscos);
    const prazo = calcularPontuacaoPrazo(notice, motivos, riscos);
    const riscoEdital = calcularRiscoEdital(radar, riscos);

    const rawScore =
      20 +
      compatibilidadeNicho +
      compatibilidadeRegiao +
      compatibilidadeValor +
      prazo -
      riscoEdital;

    const score = clamp(Math.round(rawScore), 0, 100);
    const nivel = score >= 75 ? 'alta' : score >= 50 ? 'media' : 'baixa';

    if (!empresa) {
      riscos.push('Nenhuma empresa foi informada ou localizada para personalizar totalmente a análise.');
    }

    if (motivos.length === 0) {
      motivos.push('O edital possui dados mínimos para análise inicial de oportunidade.');
    }

    return {
      noticeId,
      generatedAt: new Date().toISOString(),
      score,
      nivel,
      motivos: Array.from(new Set(motivos)),
      riscos: Array.from(new Set(riscos)),
      recomendacao: montarRecomendacao(nivel, riscos),
      empresa: {
        id: empresa?.id ?? null,
        razaoSocial: empresa?.razao_social ?? null,
        cnpj: empresa?.cnpj ?? null,
      },
      edital: {
        id: String((notice as any).id),
        objeto: pickText(notice, ['object', 'objeto', 'title', 'titulo']),
        modalidade: pickText(notice, ['modality', 'modalidade']),
        uf: pickText(notice, ['uf']),
        municipio: pickText(notice, ['municipality', 'municipio']),
        valorEstimado: pickNumber(notice, ['estimatedValue', 'valorEstimado', 'valor_estimado', 'value', 'valor']),
      },
      detalhes: {
        compatibilidadeNicho,
        compatibilidadeRegiao,
        compatibilidadeValor,
        prazo,
        riscoEdital,
      },
    };
  }

  private async resolveEmpresa(userId: string, input: unknown) {
    const empresaId = readInputString(input, ['empresa_id', 'empresaId', 'company_id', 'companyId']);

    let company = null;
    if (empresaId) {
      company = await prisma.company.findFirst({ where: { id: empresaId, userId } });
    } else {
      company = await prisma.company.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    }

    if (!company) return null;

    return {
      id: company.id,
      cnpj: company.cnpj,
      razao_social: company.razaoSocial,
      uf: company.uf,
      nicho: company.nicho,
      palavras_chave: company.palavrasChave,
      cnae_principal: company.cnaePrincipal,
      regioes: company.regioes,
      valor_min: company.valorMin ? Number(company.valorMin) : null,
      valor_max: company.valorMax ? Number(company.valorMax) : null,
    };
  }
}

function calcularCompatibilidadeNicho(notice: any, empresa: EmpresaRecord | null, motivos: string[]) {
  if (!empresa) return 5;

  const objeto = [
    pickText(notice, ['object', 'objeto', 'title', 'titulo']),
    pickText(notice, ['description', 'descricao']),
  ].filter(Boolean).join(' ').toLowerCase();

  const termosEmpresa = [
    ...(empresa.nicho ?? []),
    ...(empresa.palavras_chave ?? []),
    empresa.cnae_principal,
  ]
    .filter((item: any): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.toLowerCase().trim());

  if (termosEmpresa.length === 0) {
    return 8;
  }

  const matches = termosEmpresa.filter((termo) => objeto.includes(termo));

  if (matches.length >= 2) {
    motivos.push('Objeto do edital possui forte compatibilidade com nichos ou palavras-chave da empresa.');
    return 25;
  }

  if (matches.length === 1) {
    motivos.push('Objeto do edital possui compatibilidade parcial com o perfil da empresa.');
    return 18;
  }

  return 6;
}

function calcularCompatibilidadeRegiao(notice: any, empresa: EmpresaRecord | null, motivos: string[]) {
  if (!empresa) return 5;

  const uf = pickText(notice, ['uf'])?.toUpperCase();
  const municipio = normalizeText(pickText(notice, ['municipality', 'municipio']));
  const regioes = (empresa.regioes ?? []).map((item: any) => normalizeText(item));

  if (uf && empresa.uf?.toUpperCase() === uf) {
    motivos.push('Edital está localizado na mesma UF da empresa.');
    return 15;
  }

  if (municipio && regioes.some((regiao: any) => municipio.includes(regiao) || regiao.includes(municipio))) {
    motivos.push('Município ou região do edital aparece nas regiões de interesse da empresa.');
    return 15;
  }

  if (regioes.length > 0 && uf && regioes.some((regiao: any) => regiao.includes(uf.toLowerCase()))) {
    motivos.push('UF do edital aparece nas regiões de interesse da empresa.');
    return 12;
  }

  return 5;
}

function calcularCompatibilidadeValor(
  notice: any,
  empresa: EmpresaRecord | null,
  motivos: string[],
  riscos: string[],
) {
  const valor = pickNumber(notice, ['estimatedValue', 'valorEstimado', 'valor_estimado', 'value', 'valor']);

  if (!valor || valor <= 0) {
    riscos.push('Valor estimado não identificado, dificultando análise de margem e viabilidade.');
    return 4;
  }

  if (!empresa) return 8;

  const min = empresa.valor_min;
  const max = empresa.valor_max;

  if (typeof min === 'number' && valor < min) {
    riscos.push('Valor estimado abaixo da faixa mínima de interesse da empresa.');
    return 4;
  }

  if (typeof max === 'number' && valor > max) {
    riscos.push('Valor estimado acima da faixa máxima configurada pela empresa.');
    return 6;
  }

  if (typeof min === 'number' || typeof max === 'number') {
    motivos.push('Valor estimado está dentro da faixa de interesse configurada pela empresa.');
    return 18;
  }

  motivos.push('Valor estimado identificado para análise inicial de viabilidade.');
  return 12;
}

function calcularPontuacaoPrazo(notice: any, motivos: string[], riscos: string[]) {
  const publishedAt = pickDate(notice, ['publishedAt', 'published_at', 'dataPublicacao', 'data_publicacao']);
  const openingAt = pickDate(notice, ['openingAt', 'opening_at', 'dataAbertura', 'data_abertura', 'closingAt', 'closing_at']);

  const days = daysBetween(publishedAt, openingAt);

  if (days === null) {
    riscos.push('Datas de publicação e abertura/encerramento não foram identificadas para análise de prazo.');
    return 5;
  }

  if (days <= 3) {
    riscos.push('Prazo possivelmente curto para análise documental e montagem de proposta.');
    return 2;
  }

  if (days <= 7) {
    motivos.push('Prazo existente, mas exige organização rápida para participação.');
    return 8;
  }

  motivos.push('Prazo adequado para análise do edital e preparação da proposta.');
  return 15;
}

function calcularRiscoEdital(radar: any, riscos: string[]) {
  const issues = Array.isArray(radar?.issues) ? radar.issues : [];

  const high = issues.filter((issue: any) => issue.severity === 'high').length;
  const medium = issues.filter((issue: any) => issue.severity === 'medium').length;

  if (high > 0) {
    riscos.push(`Radar de erros encontrou ${high} ponto(s) de atenção de severidade alta.`);
  }

  if (medium > 0) {
    riscos.push(`Radar de erros encontrou ${medium} ponto(s) de atenção de severidade média.`);
  }

  return Math.min(30, high * 10 + medium * 5);
}

function montarRecomendacao(nivel: OpportunityLevel, riscos: string[]) {
  if (nivel === 'alta' && riscos.length === 0) {
    return 'Oportunidade recomendada para participação, mantendo conferência documental e validação comercial.';
  }

  if (nivel === 'alta') {
    return 'Oportunidade interessante, mas recomenda-se revisar os riscos apontados antes de enviar proposta.';
  }

  if (nivel === 'media') {
    return 'Oportunidade com potencial moderado. Avaliar documentação, margem e riscos antes de decidir participar.';
  }

  return 'Oportunidade de baixa aderência no momento. Recomenda-se participar apenas se houver estratégia comercial clara.';
}

function readInputString(input: unknown, keys: string[]) {
  if (!input || typeof input !== 'object') return null;

  const record = input as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
  }

  return null;
}

function pickText(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickNumber(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function pickDate(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];

    if (!value) continue;

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function daysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
export interface LicitacaoScoreInput {
  objeto: string;
  dataAberturaProposta?: Date | string | null;
  valorEstimado?: number | null;
  exclusivoMEEPP?: boolean;
}

export interface PerfilFornecedorInput {
  cnaeKeywords: string[];
  isMEEPP: boolean;
}

export interface ScoreResult {
  score: number;
  classificacao: 'ALTA' | 'MEDIA' | 'BAIXA';
  justificativa: string[];
}

export function calcularScoreOportunidade(
  licitacao: LicitacaoScoreInput,
  perfil: PerfilFornecedorInput
): ScoreResult {
  let score = 0;
  const justificativa: string[] = [];

  // 1. Aderência de Objeto ao CNAE/Atividade (Até 50 pontos)
  const objetoLower = (licitacao.objeto || '').toLowerCase();
  const termosEncontrados = perfil.cnaeKeywords.filter((kw) =>
    objetoLower.includes(kw.toLowerCase())
  );

  if (termosEncontrados.length > 0) {
    const pontosMatch = Math.min(50, termosEncontrados.length * 25);
    score += pontosMatch;
    justificativa.push(`Alta compatibilidade de objeto com palavras-chave (${termosEncontrados.join(', ')}).`);
  } else {
    justificativa.push('Baixa correspondência direta com os CNAEs cadastrados.');
  }

  // 2. Prazo Restante para Submissão de Proposta (Até 30 pontos)
  if (licitacao.dataAberturaProposta) {
    const hoje = new Date().getTime();
    const dataAbertura = new Date(licitacao.dataAberturaProposta).getTime();
    const diasRestantes = Math.ceil((dataAbertura - hoje) / (1000 * 60 * 60 * 24));

    if (diasRestantes >= 5) {
      score += 30;
      justificativa.push(`Prazo confortável para elaboração (${diasRestantes} dias).`);
    } else if (diasRestantes >= 2) {
      score += 15;
      justificativa.push(`Prazo moderado para elaboração (${diasRestantes} dias).`);
    } else if (diasRestantes > 0) {
      score += 5;
      justificativa.push('Prazo crítico para envio de propostas.');
    } else {
      justificativa.push('Sessão pública em andamento ou encerrada.');
    }
  }

  // 3. Vantagem Competitiva ME/EPP (Até 20 pontos)
  if (licitacao.exclusivoMEEPP && perfil.isMEEPP) {
    score += 20;
    justificativa.push('Edital exclusivo para ME/EPP com reserva de cota.');
  } else if (!licitacao.exclusivoMEEPP) {
    score += 10;
    justificativa.push('Ampla concorrência.');
  }

  const scoreFinal = Math.min(100, Math.max(0, score));

  let classificacao: 'ALTA' | 'MEDIA' | 'BAIXA' = 'BAIXA';
  if (scoreFinal >= 70) classificacao = 'ALTA';
  else if (scoreFinal >= 40) classificacao = 'MEDIA';

  return {
    score: scoreFinal,
    classificacao,
    justificativa,
  };
}