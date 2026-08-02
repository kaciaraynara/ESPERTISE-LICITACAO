import axios from 'axios';

import {
  FiltrosBusca,
  LicitacaoPNCP,
  ResultadoConsultaPNCP,
} from '@interfaces/pncp.interface';

export type { FiltrosBusca, LicitacaoPNCP, ResultadoConsultaPNCP };

const DEFAULT_PNCP_BASE_URL = 'https://pncp.gov.br/api/consulta/v1';
const DEFAULT_MODALIDADE = 6;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TIMEOUT_MS = 20_000;

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

export function mapPncpItem(rawValue: unknown): LicitacaoPNCP {
  const raw = record(rawValue);
  const orgao = record(raw.orgaoEntidade ?? raw.orgao_entidade);
  const unidade = record(raw.unidadeOrgao ?? raw.unidade_orgao);

  return {
    numeroControlePNCP: firstString(
      raw.numeroControlePNCP,
      raw.numero_controle_pncp,
    ) ?? '',
    orgaoEntidade: {
      razaoSocial: firstString(orgao.razaoSocial, orgao.razaosocial),
      cnpj: firstString(orgao.cnpj),
    },
    unidadeOrgao: {
      ufSigla: firstString(unidade.ufSigla, unidade.uf),
      municipioNome: firstString(unidade.municipioNome, unidade.municipio),
      nomeUnidade: firstString(unidade.nomeUnidade),
    },
    objeto: firstString(raw.objetoCompra, raw.objeto),
    processo: firstString(raw.processo),
    numeroCompra: firstString(raw.numeroCompra),
    valorTotalEstimado: optionalNumber(raw.valorTotalEstimado),
    dataPublicacaoPncp: firstString(raw.dataPublicacaoPncp),
    dataAberturaProposta: firstString(raw.dataAberturaProposta),
    dataEncerramentoProposta: firstString(raw.dataEncerramentoProposta),
    modalidadeId: optionalNumber(raw.modalidadeId),
    modalidadeNome: firstString(raw.modalidadeNome),
    modoDisputaNome: firstString(raw.modoDisputaNome),
    situacaoCompraId: optionalNumber(raw.situacaoCompraId),
    situacaoCompraNome: firstString(raw.situacaoCompraNome),
    usuarioNome: firstString(raw.usuarioNome),
    linkSistemaOrigem: firstString(raw.linkSistemaOrigem),
    linkEditalPNCP: firstString(raw.linkEditalPNCP),
    srp: typeof raw.srp === 'boolean' ? raw.srp : undefined,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
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

  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      'O filtro UF deve conter exatamente duas letras.',
      400,
    );
  }

  return uf;
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

  const tokens = normalizeSearchText(keyword)
    .split(' ')
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    return items;
  }

  return items.filter((item) => {
    const searchable = normalizeSearchText([
      item.objeto,
      item.orgaoEntidade?.razaoSocial,
      item.unidadeOrgao?.nomeUnidade,
      item.unidadeOrgao?.municipioNome,
      item.processo,
      item.numeroCompra,
    ].filter(Boolean).join(' '));

    return tokens.every((token) => searchable.includes(token));
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

  throw new PncpServiceError(
    'PNCP_INVALID_RESPONSE',
    'O PNCP retornou uma resposta em formato inesperado.',
    503,
  );
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
  const tamanhoPagina = positiveInteger(
    filtros.tamanhoPagina,
    'tamanhoPagina',
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const modalidade = positiveInteger(
    filtros.codigoModalidadeContratacao ?? filtros.modalidade,
    'codigoModalidadeContratacao',
    DEFAULT_MODALIDADE,
    100,
  );
  const dataInicial = normalizeDate(
    filtros.dataInicial ?? filtros.dataInicio,
    'dataInicial',
  );
  const dataFinal = normalizeDate(
    filtros.dataFinal ?? filtros.dataFim,
    'dataFinal',
  ) ?? formatDate(addDays(new Date(), 30));
  const uf = normalizeUf(filtros.uf);
  const keyword = normalizeKeyword(
    filtros.palavraChave ?? filtros.palavrasChave,
  );

  const baseUrl = (
    process.env.PNCP_BASE_URL || DEFAULT_PNCP_BASE_URL
  ).replace(/\/+$/, '');

  try {
    const response = await axios.get(
      `${baseUrl}/contratacoes/proposta`,
      {
        params: {
          ...(dataInicial ? { dataInicial } : {}),
          dataFinal,
          codigoModalidadeContratacao: modalidade,
          ...(uf ? { uf } : {}),
          pagina,
          tamanhoPagina,
        },
        timeout: timeoutMs(),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EXPERTISE-SaaS/1.0',
        },
      },
    );

    const mapped = readRawItems(response.data)
      .map(mapPncpItem)
      .filter((item) => item.numeroControlePNCP.length > 0);
    const filtered = filterByKeyword(mapped, keyword);

    return {
      data: filtered,
      totalRegistros: keyword ? null : readTotalRecords(response.data),
      pagina,
      tamanhoPagina,
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
  const match = numeroControlePNCP
    .trim()
    .match(/^(\d{14})-1-(\d{6})\/(\d{4})$/);

  if (!match) {
    throw new PncpServiceError(
      'INVALID_FILTER',
      'O número de controle PNCP da contratação é inválido.',
      400,
    );
  }

  const [, cnpj, sequencialText, ano] = match;
  const sequencial = Number(sequencialText);
  const baseUrl = (
    process.env.PNCP_BASE_URL || DEFAULT_PNCP_BASE_URL
  ).replace(/\/+$/, '');

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
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new PncpServiceError(
        'PNCP_NOT_FOUND',
        'Contratação não encontrada no PNCP.',
        404,
      );
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
