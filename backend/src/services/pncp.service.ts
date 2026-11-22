import axios from 'axios';

import {
  FiltrosBusca,
  LicitacaoPNCP,
  ResultadoConsultaPNCP,
} from '@interfaces/pncp.interface';

export type { FiltrosBusca, LicitacaoPNCP, ResultadoConsultaPNCP };

const DEFAULT_PNCP_BASE_URL = 'https://pncp.gov.br/api/consulta/v1';
const DEFAULT_PNCP_API_V1_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const DEFAULT_MODALIDADE = 6; // 6 = Pregão Eletrônico (Lei 14.133/2021)
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const PNCP_CHUNK_SIZE = 50;
const DEFAULT_TIMEOUT_MS = 20_000;
const PNCP_TIME_ZONE = 'America/Sao_Paulo';

export type PncpErrorCode =
  | 'PNCP_RATE_LIMITED'
  | 'PNCP_TIMEOUT'
  | 'PNCP_UNAVAILABLE'
  | 'PNCP_NOT_FOUND'
  | 'PNCP_INVALID_RESPONSE'
  | 'INVALID_FILTER';

export class PncpServiceError extends Error {
  constructor(
    public readonly code: PncpErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PncpServiceError';
  }
}

function record(value: unknown): Record<string, any> {
  return value !== null && typeof value === 'object'
    ? value as Record<string, any>
    : {};
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * REGRA DE OURO (NO_DATA != ZERO): Ausência ou valor <= 0 retorna undefined/null, NUNCA zero!
 */
function optionalPositiveMoney(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Normaliza datas do PNCP para ISO com timezone correto de Brasília (-03:00).
 * - Se raw for YYYY-MM-DD, retorna ${raw}T12:00:00-03:00.
 * - Se raw for timestamp ISO sem offset, retorna ${raw}-03:00.
 */
export function normalizePncpIsoDate(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? undefined : raw.toISOString();
    }
    return undefined;
  }
  const str = raw.trim();
  if (!str) return undefined;

  // Se já possui indicador de fuso (Z ou +/-HH:MM)
  if (/([+-]\d{2}:\d{2}|Z)$/.test(str)) {
    return str;
  }

  // Se for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T12:00:00-03:00`;
  }

  // Se for timestamp ISO sem offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
    return `${str}-03:00`;
  }

  // Se for YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const day = str.slice(6, 8);
    return `${y}-${m}-${day}T12:00:00-03:00`;
  }

  return str;
}

/**
 * REGRA DE OURO (FUSO AMERICA/SAO_PAULO): Datas sem timezone do PNCP são convertidas com -03:00.
 */
export function parsePncpDateToIso(dateStr: string | null | undefined): string | null {
  const normalized = normalizePncpIsoDate(dateStr);
  if (!normalized) return null;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function parsePncpControlNumber(numeroControlePNCP: string | null | undefined): {
  cnpj: string;
  ano: string;
  sequencial: number;
} | null {
  if (!numeroControlePNCP || typeof numeroControlePNCP !== 'string') {
    return null;
  }
  const clean = numeroControlePNCP.trim().replace(/^pncp-/i, '');
  // Formato oficial: CNPJ-1-SEQUENCIAL/ANO ou CNPJ-1-SEQUENCIAL-ANO ou CNPJ-SEQUENCIAL/ANO
  const match1 = clean.match(/^(\d{14})(?:-\d+)?-(\d+)[/-](\d{4})$/);
  if (match1) {
    const [, cnpj, sequencial, ano] = match1;
    return { cnpj, ano, sequencial: Number(sequencial) };
  }
  // Formato alternativo: CNPJ/ANO/SEQUENCIAL ou CNPJ-ANO-SEQUENCIAL
  const match2 = clean.match(/^(\d{14})[/-](\d{4})[/-](\d+)$/);
  if (match2) {
    const [, cnpj, ano, sequencial] = match2;
    return { cnpj, ano, sequencial: Number(sequencial) };
  }
  return null;
}

export function mapPncpItem(rawValue: unknown): LicitacaoPNCP {
  const raw = record(rawValue);
  const orgao = record(raw.orgaoEntidade ?? raw.orgao_entidade);
  const unidade = record(raw.unidadeOrgao ?? raw.unidade_orgao);

  const numControle = firstString(
    raw.numeroControlePNCP,
    raw.numero_controle_pncp,
  ) ?? '';

  const parsedControl = parsePncpControlNumber(numControle);
  const cnpj = firstString(orgao.cnpj)?.replace(/\D/g, '') || parsedControl?.cnpj;
  const ano = optionalNumber(raw.anoCompra ?? raw.ano) || (parsedControl?.ano ? Number(parsedControl.ano) : undefined);
  const sequencial = optionalNumber(raw.sequencialCompra ?? raw.sequencial) || parsedControl?.sequencial;

  const linkEditalOficial = (cnpj && ano && sequencial)
    ? `https://pncp.gov.br/app/editais/${cnpj}/${Number(ano)}/${Number(sequencial)}`
    : (firstString(raw.linkEditalPNCP) ?? undefined);

  const razaoSocialOrgao = firstString(orgao.razaoSocial, orgao.razaosocial, raw.nomeOrgao);
  const cnpjOrgaoRaw = firstString(orgao.cnpj, raw.cnpjOrgao);
  const objetoTexto = firstString(raw.objetoCompra, raw.objeto);
  const modalidadeTexto = firstString(raw.modalidadeNome, raw.nomeModalidade);

  const rawValorNum = optionalNumber(raw.valorTotalEstimado ?? raw.valorEstimado);
  const valorTotalEstimado = (rawValorNum !== undefined && rawValorNum > 0) ? rawValorNum : undefined;

  return {
    numeroControlePNCP: numControle,
    anoCompra: ano,
    sequencialCompra: sequencial,
    nomeOrgao: razaoSocialOrgao,
    cnpjOrgao: cnpjOrgaoRaw,
    orgaoEntidade: {
      razaoSocial: razaoSocialOrgao,
      cnpj: cnpjOrgaoRaw,
    },
    unidadeOrgao: {
      ufSigla: firstString(unidade.ufSigla, unidade.uf),
      municipioNome: firstString(unidade.municipioNome, unidade.municipio),
      nomeUnidade: firstString(unidade.nomeUnidade),
    },
    objeto: objetoTexto,
    objetoCompra: objetoTexto,
    informacaoComplementar: firstString(raw.informacaoComplementar, raw.informacao_complementar),
    processo: firstString(raw.processo),
    numeroCompra: firstString(raw.numeroCompra),
    valorTotalEstimado,
    dataPublicacaoPncp: normalizePncpIsoDate(raw.dataPublicacaoPncp),
    dataAberturaProposta: normalizePncpIsoDate(raw.dataAberturaProposta),
    dataEncerramentoProposta: normalizePncpIsoDate(raw.dataEncerramentoProposta),
    dataInicioRecebimento: normalizePncpIsoDate(raw.dataAberturaProposta),
    dataFimRecebimento: normalizePncpIsoDate(raw.dataEncerramentoProposta),
    modalidadeId: optionalNumber(raw.modalidadeId),
    modalidadeNome: modalidadeTexto,
    nomeModalidade: modalidadeTexto,
    modoDisputaNome: firstString(raw.modoDisputaNome),
    situacaoCompraId: optionalNumber(raw.situacaoCompraId),
    situacaoCompraNome: firstString(raw.situacaoCompraNome),
    usuarioNome: firstString(raw.usuarioNome),
    linkSistemaOrigem: firstString(raw.linkSistemaOrigem),
    linkEditalPNCP: linkEditalOficial,
    srp: typeof raw.srp === 'boolean' ? raw.srp : undefined,
  };
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PNCP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}`;
}

function addDays(dateValue: string, days: number): string {
  const year = Number(dateValue.slice(0, 4));
  const month = Number(dateValue.slice(4, 6));
  const day = Number(dateValue.slice(6, 8));
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, '0'),
    String(result.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function normalizeDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new PncpServiceError(
      'INVALID_FILTER',
      `O filtro ${field} deve ser uma data válida.`,
      400,
    );
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);

  if (!match) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      `O filtro ${field} deve usar o formato AAAAMMDD ou AAAA-MM-DD.`,
      400,
    );
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      `O filtro ${field} contém uma data inválida.`,
      400,
    );
  }

  return `${yearText}${monthText}${dayText}`;
}

function positiveInteger(
  value: unknown,
  field: string,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      `O filtro ${field} deve ser um número inteiro entre 1 e ${maximum}.`,
      400,
    );
  }

  return parsed;
}

function normalizeUf(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new PncpServiceError(
      'INVALID_FILTER',
      'O filtro UF deve conter uma sigla válida.',
      400,
    );
  }

  const uf = value.trim().toUpperCase();
  if (
    !uf
    || uf === 'TODOS'
    || uf === 'TODAS'
    || uf === 'TODAS AS UFS'
    || uf === 'TODAS AS CONTRATACOES'
    || uf === 'TODAS AS CONTRATAÇÕES'
  ) {
    return undefined;
  }

  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      'O filtro UF deve conter exatamente duas letras.',
      400,
    );
  }

  return uf;
}

function resolveOptionalModalityCode(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 1 && value <= 100) {
      return value;
    }
    return undefined;
  }

  const raw = String(value).trim();
  if (!raw) {
    return undefined;
  }

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    normalized === 'todos'
    || normalized === 'todas'
    || normalized === 'todas as contratacoes'
    || normalized === 'srp'
    || normalized.includes('registro de precos')
  ) {
    return undefined;
  }

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 100) {
    return numeric;
  }

  if (normalized.includes('pregao')) return 6;
  if (normalized.includes('concorrencia')) return 4;
  if (normalized.includes('dispensa')) return 8;
  if (normalized.includes('inexigibilidade')) return 9;
  if (normalized.includes('leilao')) return 1;
  if (normalized.includes('concurso')) return 3;
  if (normalized.includes('dialogo')) return 2;
  if (normalized.includes('credenciamento')) return 12;
  if (normalized.includes('pre-qualificacao') || normalized.includes('prequalificacao')) return 13;
  if (normalized.includes('pmi') || normalized.includes('manifestacao de interesse')) return 15;
  if (normalized.includes('registro cadastral')) return 16;

  return undefined;
}

function normalizeKeyword(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (
    typeof value !== 'string'
    || value.length > 120
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      'A palavra-chave informada é inválida.',
      400,
    );
  }

  return value.trim() || undefined;
}

function normalizeCnpj(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const digits = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (digits.length === 14 && !/^([A-Z0-9])\1{13}$/.test(digits)) {
    return digits;
  }
  return undefined;
}

export function buildPncpDownloadUrl(
  numeroControlePNCP: string | null | undefined,
  linkSistemaOrigem?: string | null,
  linkEditalPNCP?: string | null,
): string | null {
  const parsed = parsePncpControlNumber(numeroControlePNCP);
  if (parsed) {
    return `https://pncp.gov.br/api/pncp/v1/orgaos/${parsed.cnpj}/compras/${parsed.ano}/${parsed.sequencial}/arquivos/1`;
  }

  if (typeof linkEditalPNCP === 'string' && linkEditalPNCP.trim()) {
    const trimmed = linkEditalPNCP.trim();
    if (trimmed.includes('/arquivos/') || !trimmed.includes('/app/editais/')) {
      return trimmed;
    }
  }

  if (typeof linkSistemaOrigem === 'string' && linkSistemaOrigem.trim()) {
    return linkSistemaOrigem.trim();
  }

  return null;
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function filterByKeyword(
  items: LicitacaoPNCP[],
  keyword: string | undefined,
): LicitacaoPNCP[] {
  if (!keyword) {
    return items;
  }

  const normalizedTerm = normalizeSearchText(keyword);
  const tokens = normalizedTerm
    .split(' ')
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    return items;
  }

  return items.filter((item) => {
    const objetoText = normalizeSearchText(item.objetoCompra ?? item.objeto);
    const infoComplementarText = normalizeSearchText(item.informacaoComplementar);
    const combinedPrimary = `${objetoText} ${infoComplementarText}`.trim();

    if (
      objetoText.includes(normalizedTerm)
      || infoComplementarText.includes(normalizedTerm)
      || tokens.every((token) => combinedPrimary.includes(token))
    ) {
      return true;
    }

    const fallbackSearchable = normalizeSearchText([
      item.objetoCompra,
      item.objeto,
      item.informacaoComplementar,
      item.orgaoEntidade?.razaoSocial,
      item.unidadeOrgao?.nomeUnidade,
      item.unidadeOrgao?.municipioNome,
      item.processo,
      item.numeroCompra,
    ].filter(Boolean).join(' '));

    return tokens.every((token) => fallbackSearchable.includes(token));
  });
}

function timeoutMs(): number {
  const configured = Number(process.env.PNCP_TIMEOUT);

  if (!Number.isFinite(configured)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(60_000, Math.max(1_000, configured));
}

function readRawItems(payload: unknown): unknown[] {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const response = record(payload);

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  return [];
}

function readTotalRecords(payload: unknown): number | null {
  const response = record(payload);
  const total = optionalNumber(response.totalRegistros ?? response.total);
  return total !== undefined ? total : null;
}

function mapAxiosError(error: unknown): PncpServiceError {
  if (!axios.isAxiosError(error)) {
    return new PncpServiceError(
      'PNCP_UNAVAILABLE',
      'Não foi possível consultar a fonte oficial do PNCP.',
      503,
    );
  }

  if (error.response?.status === 404 || error.response?.status === 422) {
    return new PncpServiceError(
      'PNCP_NOT_FOUND',
      'Edital não encontrado na fonte oficial do PNCP.',
      404,
    );
  }

  if (error.response?.status === 429) {
    return new PncpServiceError(
      'PNCP_RATE_LIMITED',
      'Fonte oficial temporariamente limitada. Tente novamente em alguns minutos.',
      429,
    );
  }

  if (
    error.response?.status === 408
    || error.response?.status === 504
    || error.code === 'ECONNABORTED'
    || error.code === 'ETIMEDOUT'
    || /timeout/i.test(error.message)
  ) {
    return new PncpServiceError(
      'PNCP_TIMEOUT',
      'O PNCP demorou para responder. Tente novamente em instantes.',
      504,
    );
  }

  return new PncpServiceError(
    'PNCP_UNAVAILABLE',
    'A fonte oficial do PNCP está temporariamente indisponível.',
    503,
  );
}

const propostaTotalPagesCache = new Map<string, { total: number; expiresAt: number }>();

function getCachedPropostaTotal(key: string): number | null {
  if (process.env.NODE_ENV === 'test') return null;
  const hit = propostaTotalPagesCache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    if (hit) propostaTotalPagesCache.delete(key);
    return null;
  }
  return hit.total;
}

function setCachedPropostaTotal(key: string, total: number): void {
  if (process.env.NODE_ENV === 'test' || !Number.isFinite(total) || total <= 0) return;
  if (propostaTotalPagesCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of propostaTotalPagesCache.entries()) {
      if (v.expiresAt <= now) propostaTotalPagesCache.delete(k);
    }
  }
  propostaTotalPagesCache.set(key, { total, expiresAt: Date.now() + 3 * 60 * 1000 });
}

/**
 * Executa exatamente uma consulta manual ao endpoint oficial. Este caminho não
 * acessa Prisma, cache, arquivos locais, workers ou rotinas de persistência.
 */
export async function buscarContratacoesPNCP(
  filtros: FiltrosBusca = {},
): Promise<ResultadoConsultaPNCP> {
  const pagina = positiveInteger(
    filtros.pagina,
    'pagina',
    DEFAULT_PAGE,
    100_000,
  );
  const rawTamanho = positiveInteger(
    filtros.tamanhoPagina,
    'tamanhoPagina',
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const uf = normalizeUf(filtros.uf);
  const isPropostaEndpoint = filtros.endpoint === 'proposta';
  const isAtualizacaoEndpoint = filtros.endpoint === 'atualizacao';
  const deveBuscarEmParalelo = filtros.fast ? false : rawTamanho > 50;
  const tamanhoPorChamada = deveBuscarEmParalelo ? 50 : Math.min(50, Math.max(10, rawTamanho));

  const userModInput = filtros.codigoModalidadeContratacao ?? filtros.modalidade;
  const userModChoice = resolveOptionalModalityCode(userModInput);
  const modalidade = isPropostaEndpoint
    ? userModChoice
    : positiveInteger(
        userModChoice ?? userModInput,
        'codigoModalidadeContratacao',
        DEFAULT_MODALIDADE,
        100,
      );

  const hojeStr = formatDate(new Date());
  const dataInicialPadrao = addDays(hojeStr, -15);
  const dataFinalPropostaPadrao = addDays(hojeStr, 30); // +30 dias YYYYMMDD

  const explicitDataInicial = normalizeDate(
    filtros.dataInicial ?? filtros.dataInicio,
    'dataInicial',
  );
  const dataInicial = isPropostaEndpoint
    ? undefined
    : (explicitDataInicial ?? dataInicialPadrao);

  let rawDataFinal = normalizeDate(
    filtros.dataFinal ?? filtros.dataFim,
    'dataFinal',
  ) ?? (isPropostaEndpoint ? dataFinalPropostaPadrao : hojeStr);

  // Para /contratacoes/publicacao e /contratacoes/atualizacao, garante que dataFinal não seja no futuro.
  if (!isPropostaEndpoint && rawDataFinal > hojeStr) {
    rawDataFinal = hojeStr;
  }
  const dataFinal = rawDataFinal;

  const cnpj = normalizeCnpj(filtros.cnpj);
  const keyword = normalizeKeyword(
    filtros.palavraChave
    ?? filtros.palavrasChave
    ?? filtros.busca
    ?? filtros.search
    ?? filtros.q
    ?? filtros.termo,
  );

  const rawBaseUrl = (
    process.env.PNCP_CONSULTA_BASE_URL || process.env.PNCP_BASE_URL || DEFAULT_PNCP_BASE_URL
  ).replace(/\/+$/, '');
  const baseUrl = rawBaseUrl.includes('/api/pncp/v1')
    ? rawBaseUrl.replace('/api/pncp/v1', '/api/consulta/v1')
    : rawBaseUrl;

  const endpoint = isPropostaEndpoint
    ? '/contratacoes/proposta'
    : isAtualizacaoEndpoint
      ? '/contratacoes/atualizacao'
      : '/contratacoes/publicacao';

  // REGRA PNCP: Nunca enviar 'cnae' como parâmetro de query para a API do PNCP.
  const baseRequestParams: Record<string, string | number> = {
    ...(dataInicial ? { dataInicial } : {}),
    dataFinal,
    ...(modalidade !== undefined ? { codigoModalidadeContratacao: modalidade } : {}),
    ...(uf ? { uf } : {}),
    ...(cnpj ? { cnpj } : {}),
  };

  const executarRequisicao = async (pg: number, size: number) => {
    try {
      const response = await axios.get(
        `${baseUrl}${endpoint}`,
        {
          params: {
            ...baseRequestParams,
            pagina: pg,
            tamanhoPagina: size,
          },
          timeout: timeoutMs(),
          headers: {
            Accept: 'application/json',
            'User-Agent': 'EXPERTISE-SaaS/1.0',
          },
        },
      );
      if (response.status === 204 || !response.data) {
        return { items: [], total: 0 };
      }
      return {
        items: readRawItems(response.data),
        total: readTotalRecords(response.data),
      };
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 204 || err.response?.status === 404)) {
        return { items: [], total: 0 };
      }
      throw err;
    }
  };

  try {
    let rawCombinedItems: unknown[] = [];
    let totalOficial: number | null = null;

    if (isPropostaEndpoint && !cnpj && !filtros.ordemOriginal && !filtros.fast) {
      const cacheKey = `${modalidade ?? 'all'}|${uf ?? 'all'}|${dataFinal}|${tamanhoPorChamada}`;
      const cachedTotal = getCachedPropostaTotal(cacheKey);
      let probe: { items: unknown[]; total: number | null } | null = null;

      if (cachedTotal === null) {
        probe = await executarRequisicao(1, tamanhoPorChamada);
        totalOficial = probe.total;
        if (totalOficial !== null && totalOficial > 0) {
          setCachedPropostaTotal(cacheKey, totalOficial);
        }
      } else {
        totalOficial = cachedTotal;
      }

      const totalPages = totalOficial ? Math.max(1, Math.ceil(totalOficial / tamanhoPorChamada)) : 1;

      if (totalPages <= 1 && probe) {
        rawCombinedItems = probe.items;
      } else if (deveBuscarEmParalelo) {
        const revPage1 = totalPages - (pagina - 1) * 2;
        const revPage2 = revPage1 - 1;
        if (revPage1 >= 1) {
          const getPg = (pg: number) =>
            pg === 1 && probe ? Promise.resolve(probe) : executarRequisicao(pg, tamanhoPorChamada);
          if (revPage2 >= 1) {
            const [res1, res2] = await Promise.all([getPg(revPage1), getPg(revPage2)]);
            rawCombinedItems = [...res1.items, ...res2.items];
            totalOficial = totalOficial ?? res1.total ?? res2.total;
          } else {
            const res1 = await getPg(revPage1);
            rawCombinedItems = res1.items;
            totalOficial = totalOficial ?? res1.total;
          }
        }
      } else {
        const revPage = totalPages - (pagina - 1);
        if (revPage >= 1) {
          const res = revPage === 1 && probe
            ? probe
            : await executarRequisicao(revPage, tamanhoPorChamada);
          rawCombinedItems = res.items;
          totalOficial = totalOficial ?? res.total;
        }
      }
    } else if (deveBuscarEmParalelo) {
      const subPage1 = (pagina - 1) * 2 + 1;
      const subPage2 = (pagina - 1) * 2 + 2;

      const [res1, res2] = await Promise.all([
        executarRequisicao(subPage1, 50),
        executarRequisicao(subPage2, 50),
      ]);

      rawCombinedItems = [...res1.items, ...res2.items];
      totalOficial = res1.total ?? res2.total;
    } else {
      const res = await executarRequisicao(pagina, tamanhoPorChamada);
      rawCombinedItems = res.items;
      totalOficial = res.total;
    }

    if (rawCombinedItems.length === 0) {
      return {
        data: [],
        totalRegistros: 0,
        pagina,
        tamanhoPagina: deveBuscarEmParalelo ? 100 : tamanhoPorChamada,
      };
    }

    const mapped = rawCombinedItems
      .map(mapPncpItem)
      .filter((item) => item.numeroControlePNCP.length > 0);

    // Deduplicação estrita por numeroControlePNCP
    const seenControls = new Set<string>();
    const deduplicated = mapped.filter((item) => {
      if (seenControls.has(item.numeroControlePNCP)) return false;
      seenControls.add(item.numeroControlePNCP);
      return true;
    });

    const now = new Date();
    // 1. FILTRO DE VERACIDADE DIÁRIA (ZERO EDITAIS ATRASADOS/VENCIDOS):
    // Descarte qualquer edital onde new Date(item.dataEncerramentoProposta) <= new Date()
    // Em varreduras de sincronização (/publicacao e /atualizacao com incluirEncerrados=true),
    // preserva toda a página para não interromper a paginação prematuramente.
    const openItems = filtros.incluirEncerrados
      ? deduplicated
      : deduplicated.filter((item) => {
          if (!item.dataEncerramentoProposta) return !isPropostaEndpoint;
          const closing = new Date(item.dataEncerramentoProposta);
          if (isNaN(closing.getTime())) return !isPropostaEndpoint;
          return closing > now;
        });

    // 2. ORDENAÇÃO RIGOROSA: data de publicação/abertura mais recente garantindo 2026 no topo
    openItems.sort((a, b) => {
      const timeA = new Date(a.dataPublicacaoPncp || a.dataAberturaProposta || 0).getTime();
      const timeB = new Date(b.dataPublicacaoPncp || b.dataAberturaProposta || 0).getTime();
      return timeB - timeA;
    });

    const filteredByKeyword = filterByKeyword(openItems, keyword);
    const filtered = cnpj
      ? filteredByKeyword.filter((item) => {
        const itemCnpj = String(item.orgaoEntidade?.cnpj ?? '').replace(/\D/g, '');
        return !itemCnpj || itemCnpj === cnpj;
      })
      : filteredByKeyword;

    return {
      data: filtered,
      totalRegistros: (keyword || cnpj) ? filtered.length : (totalOficial ?? filtered.length),
      pagina,
      tamanhoPagina: deveBuscarEmParalelo ? 100 : tamanhoPorChamada,
    };
  } catch (error) {
    if (error instanceof PncpServiceError) {
      throw error;
    }

    throw mapAxiosError(error);
  }
}

export async function buscarContratacaoPNCP(
  numeroControlePNCP: string,
): Promise<LicitacaoPNCP> {
  const parsed = parsePncpControlNumber(numeroControlePNCP);

  if (!parsed) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      'O número de controle PNCP da contratação é inválido.',
      400,
    );
  }

  const { cnpj, sequencial, ano } = parsed;
  const rawBaseUrl = (
    process.env.PNCP_CONSULTA_BASE_URL || process.env.PNCP_BASE_URL || DEFAULT_PNCP_BASE_URL
  ).replace(/\/+$/, '');
  const baseUrl = rawBaseUrl.includes('/api/pncp/v1')
    ? rawBaseUrl.replace('/api/pncp/v1', '/api/consulta/v1')
    : rawBaseUrl;

  try {
    const response = await axios.get(
      `${baseUrl}/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
      {
        timeout: timeoutMs(),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EXPERTISE-SaaS/1.0',
        },
      },
    );

    const item = mapPncpItem(response.data);
    if (!item.numeroControlePNCP) {
      throw new PncpServiceError(
        'PNCP_INVALID_RESPONSE',
        'O PNCP retornou uma contratação sem identificador.',
        503,
      );
    }

    return item;
  } catch (error) {
    if (error instanceof PncpServiceError) {
      throw error;
    }
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 422)) {
      throw new PncpServiceError(
        'PNCP_NOT_FOUND',
        'Contratação não encontrada na fonte oficial do PNCP.',
        404,
      );
    }
    throw mapAxiosError(error);
  }
}

export async function buscarItensPNCP(
  cnpjOrControl: string,
  ano?: string | number,
  sequencial?: string | number,
): Promise<any[]> {
  let cleanCnpj = '';
  let cleanAno = '';
  let cleanSeq = '';

  if (!ano || !sequencial) {
    const parsed = parsePncpControlNumber(cnpjOrControl);
    if (parsed) {
      cleanCnpj = parsed.cnpj;
      cleanAno = String(parsed.ano);
      cleanSeq = String(parsed.sequencial);
    } else {
      throw new PncpServiceError(
        'INVALID_FILTER',
        'Identificador PNCP inválido para consulta de itens.',
        400,
      );
    }
  } else {
    cleanCnpj = String(cnpjOrControl).replace(/\D/g, '');
    cleanAno = String(ano);
    cleanSeq = String(sequencial);
  }

  const baseUrl = (process.env.PNCP_API_BASE_URL || DEFAULT_PNCP_API_V1_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/itens`;

  try {
    const response = await axios.get(url, {
      timeout: timeoutMs(),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EXPERTISE-SaaS/1.0',
      },
    });

    const items = readRawItems(response.data);
    return items.map((it: any) => ({
      numeroItem: it.numeroItem ?? it.item ?? it.itemNumero ?? 1,
      descricao: it.descricao ?? it.especificacao ?? it.descricaoItem ?? it.objeto ?? 'Item da contratação',
      quantidade: Number(it.quantidade ?? it.quantidadeHomologada ?? 1),
      valorUnitarioEstimado: Number(it.valorUnitarioEstimado ?? it.valorEstimado ?? it.precoUnitario ?? 0),
      valorTotal: Number(it.valorTotal ?? it.valorEstimadoTotal ?? ((Number(it.quantidade) || 1) * (Number(it.valorUnitarioEstimado) || 0))),
      unidadeMedida: it.unidadeMedida ?? it.siglaUnidadeMedida ?? 'UN',
      situacaoCompraItemNome: it.situacaoCompraItemNome ?? it.situacaoItemNome ?? 'Ativo',
    }));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw mapAxiosError(error);
  }
}

export async function buscarArquivosPNCP(
  cnpjOrControl: string,
  ano?: string | number,
  sequencial?: string | number,
): Promise<any[]> {
  let cleanCnpj = '';
  let cleanAno = '';
  let cleanSeq = '';

  if (!ano || !sequencial) {
    const parsed = parsePncpControlNumber(cnpjOrControl);
    if (parsed) {
      cleanCnpj = parsed.cnpj;
      cleanAno = String(parsed.ano);
      cleanSeq = String(parsed.sequencial);
    } else {
      throw new PncpServiceError(
        'INVALID_FILTER',
        'Identificador PNCP inválido para consulta de arquivos.',
        400,
      );
    }
  } else {
    cleanCnpj = String(cnpjOrControl).replace(/\D/g, '');
    cleanAno = String(ano);
    cleanSeq = String(sequencial);
  }

  const baseUrl = (process.env.PNCP_API_BASE_URL || DEFAULT_PNCP_API_V1_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos`;

  try {
    const response = await axios.get(url, {
      timeout: timeoutMs(),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EXPERTISE-SaaS/1.0',
      },
    });

    return readRawItems(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw mapAxiosError(error);
  }
}

export class PncpService {
  public async execute(
    filters: FiltrosBusca,
  ): Promise<{ items: LicitacaoPNCP[]; total: number }> {
    const result = await buscarContratacoesPNCP(filters);

    return {
      items: result.data,
      total: result.totalRegistros ?? result.data.length,
    };
  }
}

export interface PcaOportunidade {
  idPcaPncp: string;
  anoPca: number;
  orgaoNome: string;
  cnpjOrgao: string;
  uf: string;
  municipio: string;
  dataPublicacao: string | null;
  dataAtualizacao: string | null;
  dataDesejada: string | null;
  diasAtePrevisao: number | null;
  janelaTatica: 'IMEDIATA' | 'ESTRATEGICA' | 'PLANEJAMENTO';
  categoria: string;
  classificacaoSuperiorNome?: string | null;
  unidadeRequisitante?: string | null;
  descricaoItem: string;
  valorTotalEstimado: number;
  linkPcaPncp: string;
  insightEstrategico: string;
}

const UF_STATE_PATTERNS: Array<{ pattern: RegExp; uf: string }> = [
  { pattern: /\bmato grosso do sul\b/, uf: 'MS' },
  { pattern: /\bmato grosso\b/, uf: 'MT' },
  { pattern: /\brio grande do norte\b/, uf: 'RN' },
  { pattern: /\brio grande do sul\b/, uf: 'RS' },
  { pattern: /\brio de janeiro\b|\bniteroi\b/, uf: 'RJ' },
  { pattern: /\bsao paulo\b|\bcampinas\b|\bguarulhos\b|\bpiracicaba\b|\bsorocaba\b|\bribeirao preto\b/, uf: 'SP' },
  { pattern: /\bminas gerais\b|\bbelo horizonte\b|\buberlandia\b|\bjuiz de fora\b|\bdores do indaia\b/, uf: 'MG' },
  { pattern: /\bdistrito federal\b|\bbrasilia\b/, uf: 'DF' },
  { pattern: /\bespirito santo\b|\bvitoria\b|\bvila velha\b/, uf: 'ES' },
  { pattern: /\bsanta catarina\b|\bflorianopolis\b|\bjoinville\b|\bblumenau\b|\bchapeco\b/, uf: 'SC' },
  { pattern: /\bparana\b|\bcuritiba\b|\blondrina\b|\bmaringa\b/, uf: 'PR' },
  { pattern: /\bparaiba\b|\bjoao pessoa\b|\bcampina grande\b/, uf: 'PB' },
  { pattern: /\bpernambuco\b|\brecife\b|\bcaruaru\b|\bpetrolina\b/, uf: 'PE' },
  { pattern: /\bceara\b|\bfortaleza\b|\bsobral\b|\bjuazeiro do norte\b/, uf: 'CE' },
  { pattern: /\bbahia\b|\bsalvador\b|\bfeira de santana\b|\bvitoria da conquista\b/, uf: 'BA' },
  { pattern: /\bgoias\b|\bgoiania\b|\banapolis\b/, uf: 'GO' },
  { pattern: /\bmaranhao\b|\bsao luis\b|\bimperatriz\b/, uf: 'MA' },
  { pattern: /\bpiaui\b|\bteresina\b/, uf: 'PI' },
  { pattern: /\balagoas\b|\bmaceio\b/, uf: 'AL' },
  { pattern: /\bsergipe\b|\baracaju\b/, uf: 'SE' },
  { pattern: /\bamazonas\b|\bmanaus\b/, uf: 'AM' },
  { pattern: /\bpara\b|\bbelem\b|\bsantarem\b/, uf: 'PA' },
  { pattern: /\brondonia\b|\bporto velho\b/, uf: 'RO' },
  { pattern: /\broraima\b|\bboa vista\b/, uf: 'RR' },
  { pattern: /\bamapa\b|\bmacapa\b/, uf: 'AP' },
  { pattern: /\bacre\b|\brio branco\b/, uf: 'AC' },
  { pattern: /\btocantins\b|\bpalmas\b/, uf: 'TO' },
];

const VALID_UFS_SET = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

function inferirUfPca(rawText: string): string {
  const sigMatch = rawText.match(/(?:^|[\s\-\/,])([A-Z]{2})(?:$|[\s\-\/,)])/);
  if (sigMatch && VALID_UFS_SET.has(sigMatch[1])) {
    return sigMatch[1];
  }
  const normalized = normalizeSearchText(rawText);
  for (const entry of UF_STATE_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.uf;
    }
  }
  return '';
}

function resolvePcaTokens(palavraChave?: string, cnae?: string): { tokens: string[]; matchAny: boolean } {
  const rawCnae = String(cnae || '').trim();
  const rawQuery = String(palavraChave || '').trim();
  const looksLikeNumericCnae = /^[\d./-]+$/.test(rawQuery) && rawQuery.replace(/\D/g, '').length >= 4;

  if (rawCnae || looksLikeNumericCnae) {
    try {
      const { keywordsForCnae } = require('./cnae-to-keywords.service');
      const expanded: string[] = keywordsForCnae(rawCnae || rawQuery) || [];
      const textTokens = rawQuery && !looksLikeNumericCnae
        ? normalizeSearchText(rawQuery).split(/\s+/).filter((t) => t.length >= 3)
        : [];
      const merged = Array.from(new Set([
        ...textTokens,
        ...expanded.map((k: string) => normalizeSearchText(k)).filter((t: string) => t.length >= 3),
      ]));
      if (merged.length > 0) {
        return { tokens: merged.slice(0, 12), matchAny: !textTokens.length };
      }
    } catch {
      // Fallback para tokenização padrão abaixo
    }
  }

  if (!rawQuery) {
    return { tokens: [], matchAny: false };
  }

  return {
    tokens: normalizeSearchText(rawQuery).split(/\s+/).filter((t) => t.length >= 2),
    matchAny: false,
  };
}

let pcaPoolCache: {
  items: PcaOportunidade[];
  fonteTotalPncp: number;
  expiresAt: number;
} | null = null;
let pcaPoolInFlight: Promise<{ items: PcaOportunidade[]; fonteTotalPncp: number }> | null = null;

async function fetchPcaPoolFromPncp(baseUrl: string): Promise<{ items: PcaOportunidade[]; fonteTotalPncp: number }> {
  const hoje = new Date();
  const dataFim = formatDate(hoje);
  const dataInicio1D = addDays(dataFim, -1);
  const dataInicio2D = addDays(dataFim, -2);
  const pageSize = 50;

  const fetchAtualizacaoPage = async (inicio: string, pg: number, tMs = 15_000) => {
    const { data } = await axios.get(`${baseUrl}/pca/atualizacao`, {
      params: { dataInicio: inicio, dataFim, pagina: pg, tamanhoPagina: pageSize },
      timeout: Math.min(timeoutMs(), tMs),
      headers: { Accept: 'application/json', 'User-Agent': 'EXPERTISE-SaaS/1.0' },
    });
    return {
      registros: Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []),
      totalRegistros: Number(data?.totalRegistros || 0),
    };
  };

  // Busca rápida de 1 dia (páginas 1..5 = até 250 itens em ~2s) e complementa com página 1 de -2 dias
  const [pgs1D, extra2D] = await Promise.all([
    Promise.allSettled([1, 2, 3, 4, 5].map((pg) => fetchAtualizacaoPage(dataInicio1D, pg, 12_000))),
    fetchAtualizacaoPage(dataInicio2D, 1, 12_000).catch(() => ({ registros: [], totalRegistros: 0 })),
  ]);

  const rawRegs: any[] = [];
  let fonteTotalPncp = Number(extra2D.totalRegistros || 0);

  for (const res of pgs1D) {
    if (res.status === 'fulfilled') {
      rawRegs.push(...res.value.registros);
      if (!fonteTotalPncp && res.value.totalRegistros > 0) {
        fonteTotalPncp = res.value.totalRegistros;
      }
    }
  }
  if (extra2D.registros.length > 0) {
    rawRegs.push(...extra2D.registros);
  }

  // Enriquecimento de UF/Município em lote a partir da base local por CNPJ do órgão
  const cnpjsUnicos = Array.from(
    new Set(
      rawRegs
        .map((r) => String(r?.orgaoEntidadeCnpj || r?.orgaoEntidade?.cnpj || r?.cnpjOrgao || '').replace(/\D/g, ''))
        .filter((c) => c.length === 14),
    ),
  );

  const localGeoMap = new Map<string, { uf: string; municipality: string }>();
  if (cnpjsUnicos.length > 0 && process.env.DATABASE_URL) {
    try {
      const { prisma } = require('../database/prisma');
      const matches = await prisma.procurementNotice.findMany({
        where: { buyerDocument: { in: cnpjsUnicos }, uf: { not: null } },
        select: { buyerDocument: true, uf: true, municipality: true },
        distinct: ['buyerDocument'],
      });
      for (const m of matches) {
        if (m.buyerDocument && m.uf) {
          localGeoMap.set(String(m.buyerDocument), {
            uf: String(m.uf).toUpperCase(),
            municipality: String(m.municipality || '').trim(),
          });
        }
      }
    } catch {
      // Segue com inferência pelo nome do órgão caso banco não esteja acessível
    }
  }

  const seenItemKeys = new Set<string>();
  const lista: PcaOportunidade[] = [];

  for (const reg of rawRegs) {
    const orgao = reg?.orgaoEntidade || {};
    const unidade = reg?.unidadeOrgao || {};
    const orgaoNome = String(
      reg?.orgaoEntidadeRazaoSocial
      || orgao.razaoSocial
      || reg?.nomeUnidade
      || reg?.nomeOrgao
      || 'Órgão Público',
    ).trim();
    const cnpjOrgao = String(reg?.orgaoEntidadeCnpj || orgao.cnpj || reg?.cnpjOrgao || '').replace(/\D/g, '');
    const anoPca = Number(reg?.anoPca || hoje.getFullYear());
    const idPca = String(reg?.idPcaPncp || reg?.numeroControlePncp || `${cnpjOrgao}-${anoPca}`);
    const parsedPcaControl = idPca.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
    const linkPcaPncp = parsedPcaControl
      ? `https://pncp.gov.br/app/pca/${parsedPcaControl[1]}/${parsedPcaControl[3]}/${Number(parsedPcaControl[2])}`
      : 'https://pncp.gov.br/app/pca';

    const geoLocal = cnpjOrgao ? localGeoMap.get(cnpjOrgao) : undefined;
    const rawUf = String(unidade.ufSigla || reg?.uf || geoLocal?.uf || '').toUpperCase();
    const ufInferida = rawUf || inferirUfPca(`${orgaoNome} ${reg?.nomeUnidade || ''}`);
    const municipio = String(unidade.municipioNome || reg?.nomeUnidade || geoLocal?.municipality || '').trim();

    const itens = Array.isArray(reg?.itens) && reg.itens.length > 0 ? reg.itens : [reg];
    for (const it of itens) {
      const numeroItem = it?.numeroItem ?? '';
      const dedupeItemKey = `${idPca}:${numeroItem}:${String(it?.descricaoItem || it?.pdmDescricao || '').slice(0, 60)}`;
      if (seenItemKeys.has(dedupeItemKey)) continue;
      seenItemKeys.add(dedupeItemKey);

      const rawDescricao = String(
        it?.descricaoItem
        || it?.pdmDescricao
        || it?.classificacaoSuperiorNome
        || it?.descricao
        || reg?.tituloPca
        || reg?.nomeUnidade
        || 'Contratação prevista no PCA',
      )
        .replace(/^DESCRI[CÇ][AÃ]O:\s*/i, '')
        .trim();

      const categoria = String(
        it?.categoriaItemPcaNome
        || it?.nomeClassificacaoCatalogo
        || reg?.categoriaItemPcaNome
        || 'Geral',
      ).trim();

      const valor = Number(
        it?.valorTotal
        ?? it?.valorTotalEstimado
        ?? it?.valorOrcamentoExercicio
        ?? reg?.valorTotalEstimado
        ?? 0,
      );

      const dataDesRaw = it?.dataDesejada || reg?.dataDesejada || null;
      const dataDesejada = dataDesRaw ? normalizePncpIsoDate(dataDesRaw) : null;
      const diasAtePrevisao = dataDesejada
        ? Math.ceil((new Date(dataDesejada).getTime() - Date.now()) / 86400000)
        : null;
      const janelaTatica: 'IMEDIATA' | 'ESTRATEGICA' | 'PLANEJAMENTO' =
        diasAtePrevisao !== null && diasAtePrevisao <= 30
          ? 'IMEDIATA'
          : diasAtePrevisao !== null && diasAtePrevisao <= 90
            ? 'ESTRATEGICA'
            : 'PLANEJAMENTO';

      const insightEstrategico =
        janelaTatica === 'IMEDIATA'
          ? 'Janela crítica (<=30 dias): o edital pode sair a qualquer momento. Feche cotações com fornecedores e valide certidões no Cofre agora.'
          : janelaTatica === 'ESTRATEGICA'
            ? 'Janela ideal de preparação (31 a 90 dias): antecipe atestados técnicos, estude contratações anteriores do órgão e monte sua planilha base.'
            : 'Planejamento antecipado (>90 dias): monitore o órgão no Radar para ser avisado assim que o Termo de Referência for publicado.';

      const ufItem = ufInferida || inferirUfPca(String(it?.unidadeRequisitante || ''));

      lista.push({
        idPcaPncp: idPca,
        anoPca,
        orgaoNome,
        cnpjOrgao,
        uf: ufItem,
        municipio,
        dataPublicacao: normalizePncpIsoDate(reg?.dataPublicacaoPNCP || reg?.dataPublicacaoPncp || reg?.dataPublicacao) || null,
        dataAtualizacao: normalizePncpIsoDate(reg?.dataAtualizacaoGlobalPCA || reg?.dataAtualizacaoGlobal || reg?.dataAtualizacao) || null,
        dataDesejada: dataDesejada ?? null,
        diasAtePrevisao,
        janelaTatica,
        categoria,
        classificacaoSuperiorNome: it?.classificacaoSuperiorNome || null,
        unidadeRequisitante: it?.unidadeRequisitante || reg?.nomeUnidade || null,
        descricaoItem: rawDescricao,
        valorTotalEstimado: Number.isFinite(valor) ? valor : 0,
        linkPcaPncp,
        insightEstrategico,
      });
    }
  }

  return {
    items: lista,
    fonteTotalPncp: fonteTotalPncp || lista.length,
  };
}

export async function buscarPcasPNCP(filtros: {
  anoPca?: number;
  uf?: string;
  palavraChave?: string;
  cnae?: string;
  pagina?: number;
  tamanhoPagina?: number;
  forceRefresh?: boolean;
} = {}): Promise<{
  items: PcaOportunidade[];
  total: number;
  totalPaginas: number;
  pagina: number;
  tamanhoPagina: number;
  fonteTotalPncp: number;
}> {
  const pagina = Math.max(1, Number(filtros.pagina || 1));
  const tamanhoPagina = Math.min(50, Math.max(10, Number(filtros.tamanhoPagina || 20)));
  const rawBaseUrl = (process.env.PNCP_CONSULTA_BASE_URL || process.env.PNCP_BASE_URL || DEFAULT_PNCP_BASE_URL).replace(/\/+$/, '');
  const baseUrl = rawBaseUrl.includes('/api/pncp/v1') ? rawBaseUrl.replace('/api/pncp/v1', '/api/consulta/v1') : rawBaseUrl;

  const shouldUseCache = process.env.NODE_ENV !== 'test' && !filtros.forceRefresh;
  let pool: { items: PcaOportunidade[]; fonteTotalPncp: number };

  if (shouldUseCache && pcaPoolCache && pcaPoolCache.expiresAt > Date.now() && pcaPoolCache.items.length > 0) {
    pool = { items: pcaPoolCache.items, fonteTotalPncp: pcaPoolCache.fonteTotalPncp };
  } else {
    if (!pcaPoolInFlight) {
      pcaPoolInFlight = fetchPcaPoolFromPncp(baseUrl).finally(() => {
        pcaPoolInFlight = null;
      });
    }
    pool = await pcaPoolInFlight;
    if (process.env.NODE_ENV !== 'test' && pool.items.length > 0) {
      pcaPoolCache = { ...pool, expiresAt: Date.now() + 15 * 60 * 1000 };
    }
  }

  const { tokens, matchAny } = resolvePcaTokens(filtros.palavraChave, filtros.cnae);
  const ufFiltro = filtros.uf ? filtros.uf.trim().toUpperCase() : '';

  const filtrados = pool.items.filter((item) => {
    if (filtros.anoPca && item.anoPca !== Number(filtros.anoPca)) return false;
    if (ufFiltro && ufFiltro !== 'TODOS' && ufFiltro !== 'TODAS' && item.uf !== ufFiltro) return false;
    if (tokens.length > 0) {
      const alvo = normalizeSearchText(
        `${item.descricaoItem} ${item.categoria} ${item.classificacaoSuperiorNome || ''} ${item.orgaoNome} ${item.unidadeRequisitante || ''}`,
      );
      const matched = matchAny
        ? tokens.some((tk) => alvo.includes(tk))
        : tokens.every((tk) => alvo.includes(tk));
      if (!matched) return false;
    }
    return true;
  });

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));
  const offset = (pagina - 1) * tamanhoPagina;
  const pagedItems = filtrados.slice(offset, offset + tamanhoPagina);

  return {
    items: pagedItems,
    total,
    totalPaginas,
    pagina,
    tamanhoPagina,
    fonteTotalPncp: pool.fonteTotalPncp,
  };
}