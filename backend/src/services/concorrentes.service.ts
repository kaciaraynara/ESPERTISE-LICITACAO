import axios from 'axios';
import { prisma } from '../database/prisma';
import { consultarComprasGovContratos } from './intelligence.service';

type FonteDossie = 'pncp' | 'portal_transparencia' | 'comprasgov';
type FonteStatus = 'success' | 'partial' | 'failed';
type FailureReason = 'timeout' | 'network' | 'http' | 'unknown';

export interface ContratoConcorrente {
  id: string;
  fonte: FonteDossie;
  numeroContrato: string | null;
  numeroControlePncp: string | null;
  objeto: string | null;
  orgao: string | null;
  cnpjOrgao: string | null;
  modalidade: string | null;
  categoria: string | null;
  valor: number;
  dataAssinatura: string | null;
  dataPublicacao: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  situacao: string | null;
  url: string | null;
}

export interface EstatisticasConcorrente {
  totalContratos: number;
  valorTotalContratado: number;
  ticketMedio: number;
  maiorContrato: number;
  orgaosContratantes: number;
  porAno: Record<string, number>;
  porModalidade: Record<string, number>;
  porOrgao: Array<{ orgao: string; total: number; valorTotal: number }>;
}

export interface FonteConsultaDossie {
  fonte: FonteDossie;
  status: FonteStatus;
  totalRegistros: number;
  message?: string;
  failureReason?: FailureReason;
  statusCode?: number;
}

export interface DossieConcorrente {
  cnpj: string;
  periodo: {
    dataInicial: string;
    dataFinal: string;
  };
  valorTotalVencido: number;
  estatisticas: EstatisticasConcorrente;
  historico: ContratoConcorrente[];
  contratos: ContratoConcorrente[];
  fontes: FonteConsultaDossie[];
  geradoEm: string;
}

interface SourceResult {
  fonte: FonteDossie;
  status: FonteStatus;
  contratos: ContratoConcorrente[];
  message?: string;
  failureReason?: FailureReason;
  statusCode?: number;
}

const DEFAULT_YEARS_BACK = 1;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 5;

const pncpConsultaApi = axios.create({
  baseURL: process.env.PNCP_CONSULTA_BASE_URL || 'https://pncp.gov.br/api/consulta/v1',
  timeout: getNumberEnv('PNCP_DOSSIE_TIMEOUT', 10000),
  headers: {
    Accept: 'application/json',
    'User-Agent': 'Expertise-SaaS/2.0',
  },
});

export class ConcorrentesService {
  async gerarDossie(cnpj: string, userId: string): Promise<DossieConcorrente> {
    const cnpjLimpo = normalizeCnpj(cnpj);

    if (!cnpjLimpo) {
      throw new Error('INVALID_CNPJ');
    }

    const periodo = buildPeriod();
    const [pncpResult, transparenciaResult, comprasGovResult] = await Promise.all([
      this.consultarPncp(cnpjLimpo, periodo),
      this.consultarPortalTransparencia(cnpjLimpo, userId),
      this.consultarComprasGov(cnpjLimpo),
    ]);

    const contratos = dedupeContratos([
      ...pncpResult.contratos,
      ...transparenciaResult.contratos,
      ...comprasGovResult.contratos,
    ]);
    const estatisticas = buildEstatisticas(contratos);
    const historico = contratos
      .sort((a, b) => compareNullableDates(b.dataAssinatura ?? b.dataPublicacao, a.dataAssinatura ?? a.dataPublicacao))
      .slice(0, getNumberEnv('CONCORRENTES_DOSSIE_MAX_ITEMS', 100));

    return {
      cnpj: cnpjLimpo,
      periodo,
      valorTotalVencido: estatisticas.valorTotalContratado,
      estatisticas,
      historico,
      contratos: historico,
      fontes: [pncpResult, transparenciaResult, comprasGovResult].map((result) => ({
        fonte: result.fonte,
        status: result.status,
        totalRegistros: result.contratos.length,
        message: result.message,
        failureReason: result.failureReason,
        statusCode: result.statusCode,
      })),
      geradoEm: new Date().toISOString(),
    };
  }

  private async consultarComprasGov(cnpj: string): Promise<SourceResult> {
    try {
      const lista = await consultarComprasGovContratos(cnpj);
      const contratos: ContratoConcorrente[] = lista.map((item) => ({
        id: `comprasgov:${item.id}`,
        fonte: 'comprasgov',
        numeroContrato: item.id,
        numeroControlePncp: null,
        objeto: item.objeto,
        orgao: item.orgao,
        cnpjOrgao: null,
        modalidade: item.modalidade,
        categoria: null,
        valor: roundMoney(Number(item.valor || 0)),
        dataAssinatura: normalizeDateString(item.dataAssinatura),
        dataPublicacao: normalizeDateString(item.dataAssinatura),
        vigenciaInicio: null,
        vigenciaFim: null,
        situacao: 'Homologado (Compras.gov)',
        url: null,
      }));
      return {
        fonte: 'comprasgov',
        status: 'success',
        contratos,
      };
    } catch (error) {
      const failure = classifyExternalError(error);
      return {
        fonte: 'comprasgov',
        status: 'failed',
        contratos: [],
        message: 'Falha ao consultar resultados homologados no Compras.gov.br.',
        failureReason: failure.reason,
        statusCode: failure.statusCode,
      };
    }
  }

  private async consultarPncp(cnpj: string, periodo: DossieConcorrente['periodo']): Promise<SourceResult> {
    const pageSize = getNumberEnv('PNCP_DOSSIE_PAGE_SIZE', DEFAULT_PAGE_SIZE);
    const maxPages = getNumberEnv('PNCP_DOSSIE_MAX_PAGES', DEFAULT_MAX_PAGES);
    const contratos: ContratoConcorrente[] = [];

    try {
      for (let pagina = 1; pagina <= maxPages; pagina += 1) {
        const actualPageSize = Math.max(10, pageSize);
        const { data } = await pncpConsultaApi.get('/contratos', {
          params: {
            dataInicial: periodo.dataInicial,
            dataFinal: periodo.dataFinal,
            pagina,
            tamanhoPagina: actualPageSize,
            niFornecedor: cnpj,
          },
        });

        const items = extractArray(data);
        contratos.push(
          ...items
            .filter((item) => onlyDigits(readString(item, 'niFornecedor', 'cnpjFornecedor')) === cnpj)
            .map((item) => mapPncpContrato(item, cnpj)),
        );

        if (items.length < actualPageSize) {
          break;
        }
      }

      return {
        fonte: 'pncp',
        status: 'success',
        contratos,
      };
    } catch (error) {
      const failure = classifyExternalError(error);

      console.warn(JSON.stringify({
        event: 'CONCORRENTE_DOSSIE_PNCP_FAILED',
        cnpj,
        failureReason: failure.reason,
        statusCode: failure.statusCode,
        error: failure.message,
        timestamp: new Date().toISOString(),
      }));

      return {
        fonte: 'pncp',
        status: contratos.length > 0 ? 'partial' : 'failed',
        contratos,
        message: failure.reason === 'timeout'
          ? 'Tempo limite excedido ao consultar contratos no PNCP.'
          : 'Falha ao consultar contratos no PNCP.',
        failureReason: failure.reason,
        statusCode: failure.statusCode,
      };
    }
  }

  private async consultarPortalTransparencia(cnpj: string, userId: string): Promise<SourceResult> {
    const maxPages = getNumberEnv('TRANSPARENCIA_DOSSIE_MAX_PAGES', 3);
    const contratos: ContratoConcorrente[] = [];

    try {
      const { transparenciaApi } = await import('./transparencia/transparencia-api.service');

      for (let pagina = 1; pagina <= maxPages; pagina += 1) {
        const response = await transparenciaApi.consultarContratos(userId, { cnpj, pagina });

        if (!response.success) {
          return {
            fonte: 'portal_transparencia',
            status: contratos.length > 0 ? 'partial' : 'failed',
            contratos,
            message: 'Portal da Transparência indisponível para contratos.',
          };
        }

        const items = extractArray(response.data);
        contratos.push(...items.map((item) => mapTransparenciaContrato(item, cnpj)));

        if (items.length === 0) {
          break;
        }
      }

      return {
        fonte: 'portal_transparencia',
        status: 'success',
        contratos,
      };
    } catch (error) {
      const failure = classifyExternalError(error);

      console.warn(JSON.stringify({
        event: 'CONCORRENTE_DOSSIE_TRANSPARENCIA_FAILED',
        cnpj,
        failureReason: failure.reason,
        statusCode: failure.statusCode,
        error: failure.message,
        timestamp: new Date().toISOString(),
      }));

      return {
        fonte: 'portal_transparencia',
        status: contratos.length > 0 ? 'partial' : 'failed',
        contratos,
        message: failure.reason === 'timeout'
          ? 'Tempo limite excedido ao consultar contratos no Portal da Transparência.'
          : 'Falha ao consultar contratos no Portal da Transparência.',
        failureReason: failure.reason,
        statusCode: failure.statusCode,
      };
    }
  }
}

export function buildEstatisticas(contratos: ContratoConcorrente[]): EstatisticasConcorrente {
  const valorTotalContratado = roundMoney(contratos.reduce((acc, contrato) => acc + contrato.valor, 0));
  const maiorContrato = roundMoney(contratos.reduce((acc, contrato) => Math.max(acc, contrato.valor), 0));
  const orgaos = new Map<string, { total: number; valorTotal: number }>();
  const porAno: Record<string, number> = {};
  const porModalidade: Record<string, number> = {};

  for (const contrato of contratos) {
    const orgao = contrato.orgao || 'Órgão não informado';
    const current = orgaos.get(orgao) ?? { total: 0, valorTotal: 0 };
    orgaos.set(orgao, {
      total: current.total + 1,
      valorTotal: roundMoney(current.valorTotal + contrato.valor),
    });

    const ano = extractYear(contrato.dataAssinatura ?? contrato.dataPublicacao) ?? 'Não informado';
    porAno[ano] = (porAno[ano] ?? 0) + 1;

    const modalidade = contrato.modalidade || 'Não informada';
    porModalidade[modalidade] = (porModalidade[modalidade] ?? 0) + 1;
  }

  return {
    totalContratos: contratos.length,
    valorTotalContratado,
    ticketMedio: contratos.length > 0 ? roundMoney(valorTotalContratado / contratos.length) : 0,
    maiorContrato,
    orgaosContratantes: orgaos.size,
    porAno,
    porModalidade,
    porOrgao: [...orgaos.entries()]
      .map(([orgao, stats]) => ({ orgao, total: stats.total, valorTotal: roundMoney(stats.valorTotal) }))
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .slice(0, 10),
  };
}

function buildPeriod() {
  const today = new Date();
  const start = new Date(today);
  start.setFullYear(today.getFullYear() - getNumberEnv('CONCORRENTES_DOSSIE_YEARS_BACK', DEFAULT_YEARS_BACK));

  return {
    dataInicial: formatDateCompact(start),
    dataFinal: formatDateCompact(today),
  };
}

function mapPncpContrato(raw: Record<string, unknown>, cnpj: string): ContratoConcorrente {
  const orgao = readObject(raw, 'orgaoEntidade');
  const categoria = readObject(raw, 'categoriaProcesso');
  const modalidade = readObject(raw, 'modalidade');

  return {
    id: `pncp:${readString(raw, 'numeroControlePncpCompra', 'numeroControlePNCPCompra', 'numeroControlePncp') ?? readString(raw, 'numeroContratoEmpenho') ?? cryptoSafeId(raw)}`,
    fonte: 'pncp',
    numeroContrato: readString(raw, 'numeroContratoEmpenho', 'numeroContrato', 'numero'),
    numeroControlePncp: readString(raw, 'numeroControlePncpCompra', 'numeroControlePNCPCompra', 'numeroControlePncp'),
    objeto: readString(raw, 'objetoContrato', 'objeto', 'descricao'),
    orgao: readString(orgao, 'razaoSocial', 'razao_social') ?? readString(raw, 'orgao', 'nomeOrgao'),
    cnpjOrgao: onlyDigits(readString(orgao, 'cnpj') ?? ''),
    modalidade: readString(modalidade, 'nome') ?? readString(raw, 'modalidadeNome', 'modalidade'),
    categoria: readString(categoria, 'nome') ?? readString(raw, 'categoria'),
    valor: readNumber(raw, 'valorGlobal', 'valorInicial', 'valorContrato', 'valor') ?? 0,
    dataAssinatura: normalizeDateString(readString(raw, 'dataAssinatura')),
    dataPublicacao: normalizeDateString(readString(raw, 'dataPublicacaoPncp', 'dataPublicacao')),
    vigenciaInicio: normalizeDateString(readString(raw, 'dataVigenciaInicio')),
    vigenciaFim: normalizeDateString(readString(raw, 'dataVigenciaFim')),
    situacao: readString(raw, 'situacaoContrato', 'situacao') ?? null,
    url: buildPncpContratoUrl(raw) ?? null,
  };
}

function mapTransparenciaContrato(raw: Record<string, unknown>, cnpj: string): ContratoConcorrente {
  const fornecedorCnpj = onlyDigits(readString(raw, 'cnpjFornecedor', 'cpfCnpjFornecedor', 'cpfCnpj') ?? '');
  const orgao = readObject(raw, 'orgao') ?? readObject(raw, 'unidadeGestora') ?? readObject(raw, 'orgaoSuperior');

  return {
    id: `portal_transparencia:${readString(raw, 'id', 'codigoContrato', 'numero') ?? cryptoSafeId(raw)}`,
    fonte: 'portal_transparencia',
    numeroContrato: readString(raw, 'numero', 'numeroContrato', 'codigoContrato'),
    numeroControlePncp: readString(raw, 'numeroControlePncp', 'numeroControlePNCP'),
    objeto: readString(raw, 'objeto', 'descricaoObjeto', 'descricao'),
    orgao: readString(orgao, 'nome', 'descricao') ?? readString(raw, 'nomeOrgao', 'orgao'),
    cnpjOrgao: onlyDigits(readString(orgao, 'cnpj') ?? ''),
    modalidade: readString(raw, 'modalidade', 'modalidadeLicitacao'),
    categoria: readString(raw, 'categoria', 'tipoContrato'),
    valor: readNumber(raw, 'valor', 'valorContrato', 'valorInicialCompra', 'valorGlobal') ?? 0,
    dataAssinatura: normalizeDateString(readString(raw, 'dataAssinatura', 'dataInicioVigencia')),
    dataPublicacao: normalizeDateString(readString(raw, 'dataPublicacao')),
    vigenciaInicio: normalizeDateString(readString(raw, 'dataInicioVigencia', 'vigenciaInicio')),
    vigenciaFim: normalizeDateString(readString(raw, 'dataFimVigencia', 'vigenciaFim')),
    situacao: readString(raw, 'situacao', 'situacaoContrato'),
    url: readString(raw, 'link', 'url'),
  };
}

function dedupeContratos(contratos: ContratoConcorrente[]) {
  const map = new Map<string, ContratoConcorrente>();

  for (const contrato of contratos) {
    const key = [
      contrato.numeroControlePncp,
      contrato.numeroContrato,
      contrato.orgao,
      contrato.valor,
      contrato.dataAssinatura,
    ].filter(Boolean).join('|') || contrato.id;

    if (!map.has(key)) {
      map.set(key, contrato);
    }
  }

  return [...map.values()];
}

function normalizeCnpj(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 14 ? digits : null;
}

function extractArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) {
    if (Array.isArray(value.data)) return value.data.filter(isRecord);
    if (Array.isArray(value.items)) return value.items.filter(isRecord);
    if (Array.isArray(value.resultado)) return value.resultado.filter(isRecord);
    if (Array.isArray(value.content)) return value.content.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readObject(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return isRecord(value) ? value : undefined;
}

function readString(source: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return roundMoney(value);
    if (typeof value === 'string') {
      const normalized = value.includes(',')
        ? value.replace(/\./g, '').replace(',', '.')
        : value;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return roundMoney(parsed);
    }
  }
  return null;
}

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeDateString(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    return `${year}-${month}-${day}`;
  }

  return value;
}

function extractYear(value: string | null) {
  return value?.match(/^(\d{4})/)?.[1] ?? null;
}

function compareNullableDates(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

function buildPncpContratoUrl(raw: Record<string, unknown>) {
  const cnpjOrgao = onlyDigits(readString(readObject(raw, 'orgaoEntidade'), 'cnpj') ?? '');
  const ano = readString(raw, 'anoContrato');
  const sequencial = readString(raw, 'sequencialContrato');

  if (cnpjOrgao && ano && sequencial) {
    return `https://pncp.gov.br/app/contratos/${cnpjOrgao}/${ano}/${sequencial}`;
  }

  return readString(raw, 'link', 'url');
}

function cryptoSafeId(raw: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(raw).slice(0, 256)).toString('base64url').slice(0, 32);
}

function formatDateCompact(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getNumberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function classifyExternalError(error: unknown): {
  reason: FailureReason;
  message: string;
  statusCode?: number;
} {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;

    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return { reason: 'timeout', message: error.message, statusCode };
    }

    if (statusCode) {
      return { reason: 'http', message: error.message, statusCode };
    }

    return { reason: 'network', message: error.message };
  }

  return {
    reason: 'unknown',
    message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  };
}

export interface ContratoMercadoItem {
  id: string;
  fonte: 'pncp' | 'comprasgov';
  orgao: string;
  cnpjOrgao: string | null;
  numeroContrato: string | null;
  numeroControlePncp: string | null;
  objeto: string;
  dataAssinatura: string | null;
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorHomologado: number;
  valorEstimado: number | null;
  descontoPercentual: number | null;
  statusDesconto: string;
  urlOficial: string | null;
}

export interface FornecedorDominanteItem {
  cnpj: string;
  razaoSocial: string;
  totalVitorias: number;
  valorAcumulado: number;
  ticketMedio: number;
  descontoMedioReal: number | null;
  amostrasComDesconto: number;
}

export interface MercadoOrgaoResultado {
  filtro: {
    orgao: string | null;
    cnpjOrgao: string | null;
    objeto: string | null;
    cnae: string | null;
  };
  contratosMercado: ContratoMercadoItem[];
  rankingDominante: FornecedorDominanteItem[];
  descontosDisponiveisCount: number;
  descontoMedioMercado: number | null;
  geradoEm: string;
}

/**
 * Calcula o desconto real exclusivamente quando valorEstimado > 0 e valorHomologado > 0 existem na fonte oficial.
 */
export function calcularDescontoReal(
  valorEstimado?: number | null,
  valorHomologado?: number | null,
): { descontoPercentual: number | null; statusDesconto: string } {
  const est = Number(valorEstimado);
  const hom = Number(valorHomologado);
  if (!Number.isFinite(est) || est <= 0 || !Number.isFinite(hom) || hom <= 0) {
    return { descontoPercentual: null, statusDesconto: 'Valor estimado não divulgado' };
  }
  const pct = Math.round((((est - hom) / est) * 100) * 100) / 100;
  return {
    descontoPercentual: pct,
    statusDesconto: pct >= 0 ? `${pct.toFixed(2)}% abaixo do estimado` : `${Math.abs(pct).toFixed(2)}% acima do estimado`,
  };
}

/**
 * Agrupa contratos reais por fornecedor vencedor para montar o ranking dominante do órgão/segmento.
 */
export function buildRankingDominante(contratos: ContratoMercadoItem[]): FornecedorDominanteItem[] {
  const mapa = new Map<
    string,
    {
      cnpj: string;
      razaoSocial: string;
      totalVitorias: number;
      valorAcumulado: number;
      descontos: number[];
    }
  >();

  for (const c of contratos) {
    const cnpj = onlyDigits(c.fornecedorCnpj);
    const key = cnpj || c.fornecedorNome.toUpperCase();
    const entry = mapa.get(key) ?? {
      cnpj: cnpj || 'Não informado',
      razaoSocial: c.fornecedorNome || 'Fornecedor Vencedor',
      totalVitorias: 0,
      valorAcumulado: 0,
      descontos: [],
    };
    entry.totalVitorias += 1;
    entry.valorAcumulado = roundMoney(entry.valorAcumulado + (Number(c.valorHomologado) || 0));
    if (c.descontoPercentual !== null && Number.isFinite(c.descontoPercentual)) {
      entry.descontos.push(c.descontoPercentual);
    }
    mapa.set(key, entry);
  }

  return Array.from(mapa.values())
    .map((e) => ({
      cnpj: e.cnpj,
      razaoSocial: e.razaoSocial,
      totalVitorias: e.totalVitorias,
      valorAcumulado: e.valorAcumulado,
      ticketMedio: e.totalVitorias > 0 ? roundMoney(e.valorAcumulado / e.totalVitorias) : 0,
      descontoMedioReal:
        e.descontos.length > 0
          ? Math.round((e.descontos.reduce((s, d) => s + d, 0) / e.descontos.length) * 100) / 100
          : null,
      amostrasComDesconto: e.descontos.length,
    }))
    .sort((a, b) => b.totalVitorias - a.totalVitorias || b.valorAcumulado - a.valorAcumulado);
}

export async function investigarMercadoPorOrgaoOuObjeto(params: {
  orgao?: string;
  cnpjOrgao?: string;
  objeto?: string;
  cnae?: string;
}): Promise<MercadoOrgaoResultado> {
  const orgaoInput = String(params.orgao || '').trim();
  let cnpjOrgao = onlyDigits(params.cnpjOrgao || '');
  if (cnpjOrgao.length !== 14 && /^\d{14}$/.test(onlyDigits(orgaoInput))) {
    cnpjOrgao = onlyDigits(orgaoInput);
  }
  const objetoInput = String(params.objeto || '').trim();
  const cnaeInput = String(params.cnae || '').trim();

  // 1. Resolve CNPJ do órgão e editais com valor estimado no PostgreSQL
  const noticeWhere: any[] = [];
  if (cnpjOrgao.length === 14) {
    noticeWhere.push({ buyerDocument: cnpjOrgao });
  } else if (orgaoInput.length >= 3) {
    noticeWhere.push({ buyerName: { contains: orgaoInput, mode: 'insensitive' } });
  }
  if (objetoInput.length >= 3) {
    noticeWhere.push({ object: { contains: objetoInput, mode: 'insensitive' } });
  }

  const editaisRelacionados = noticeWhere.length > 0
    ? await prisma.procurementNotice
        .findMany({
          where: { AND: noticeWhere },
          orderBy: { publishedAt: 'desc' },
          take: 40,
          select: {
            id: true,
            numeroControlePncp: true,
            externalId: true,
            buyerName: true,
            buyerDocument: true,
            object: true,
            estimatedValue: true,
            url: true,
          },
        })
        .catch(() => [])
    : [];

  if (cnpjOrgao.length !== 14) {
    const foundBuyer = editaisRelacionados.find((e) => onlyDigits(e.buyerDocument || '').length === 14);
    if (foundBuyer?.buyerDocument) {
      cnpjOrgao = onlyDigits(foundBuyer.buyerDocument);
    }
  }

  const estimativasPorPncp = new Map<string, number>();
  const estimativasPorObjeto = new Map<string, number>();
  for (const ed of editaisRelacionados) {
    const val = Number(ed.estimatedValue || 0);
    if (val > 0) {
      if (ed.numeroControlePncp) estimativasPorPncp.set(ed.numeroControlePncp, val);
      if (ed.externalId) estimativasPorPncp.set(ed.externalId, val);
      if (ed.object) estimativasPorObjeto.set(ed.object.toLowerCase().slice(0, 60), val);
    }
  }

  const contratosMercado: ContratoMercadoItem[] = [];
  const hoje = new Date();
  const inicio = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000);
  const fmtIso = (d: Date) => d.toISOString().slice(0, 10);
  const fmtPncp = (d: Date) => fmtIso(d).replace(/-/g, '');

  // 2. Consulta Compras.gov.br (itens homologados PNCP 14.133) + PNCP Contratos
  const tasks: Array<Promise<void>> = [];

  if (cnpjOrgao.length === 14) {
    tasks.push(
      axios
        .get(
          `https://dadosabertos.compras.gov.br/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133`,
          {
            params: {
              pagina: 1,
              tamanhoPagina: 30,
              dataResultadoPncpInicial: fmtIso(inicio),
              dataResultadoPncpFinal: fmtIso(hoje),
              orgaoEntidadeCnpj: cnpjOrgao,
            },
            timeout: 9000,
          },
        )
        .then((res) => {
          const lista = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
          for (const c of lista) {
            const desc = String(c.descricaoItem || c.nomeMaterialOuServico || c.objetoCompra || 'Item homologado').trim();
            if (objetoInput.length >= 3 && !desc.toLowerCase().includes(objetoInput.toLowerCase())) continue;
            const pncpCtrl = String(c.numeroControlePNCPCompra || '').trim() || null;
            const valorHomologado = Number(c.valorTotalHomologado || c.valorUnitarioHomologado || 0);
            const valorEstDireto = Number(c.valorTotalEstimado || c.valorUnitarioEstimado || 0);
            const valorEstimado =
              valorEstDireto > 0
                ? valorEstDireto
                : (pncpCtrl ? estimativasPorPncp.get(pncpCtrl) : undefined) ??
                  estimativasPorObjeto.get(desc.toLowerCase().slice(0, 60)) ??
                  null;
            const descCalc = calcularDescontoReal(valorEstimado, valorHomologado);
            const fornCnpj = onlyDigits(String(c.niFornecedor || ''));
            if (!fornCnpj && !c.nomeRazaoSocialFornecedor) continue;

            contratosMercado.push({
              id: String(c.idCompra || pncpCtrl || `cg-${contratosMercado.length}`),
              fonte: 'comprasgov',
              orgao: String(c.orgaoEntidadeRazaoSocial || editaisRelacionados[0]?.buyerName || `Órgão ${cnpjOrgao}`),
              cnpjOrgao,
              numeroContrato: c.numeroControlePNCPCompra || null,
              numeroControlePncp: pncpCtrl,
              objeto: desc,
              dataAssinatura: c.dataResultado || c.dataResultadoPncp || null,
              fornecedorNome: String(c.nomeRazaoSocialFornecedor || `Empresa ${fornCnpj}`).trim(),
              fornecedorCnpj: fornCnpj,
              valorHomologado: roundMoney(valorHomologado),
              valorEstimado: valorEstimado ? roundMoney(valorEstimado) : null,
              descontoPercentual: descCalc.descontoPercentual,
              statusDesconto: descCalc.statusDesconto,
              urlOficial: pncpCtrl ? `https://pncp.gov.br/app/editais?q=${encodeURIComponent(pncpCtrl)}` : null,
            });
          }
        })
        .catch(() => undefined),
    );

    tasks.push(
      pncpConsultaApi
        .get('/contratos', {
          params: {
            dataInicial: fmtPncp(inicio),
            dataFinal: fmtPncp(hoje),
            pagina: 1,
            tamanhoPagina: 25,
            cnpjOrgao,
          },
        })
        .then((res) => {
          const lista = Array.isArray(res.data?.data) ? res.data.data : [];
          for (const raw of lista) {
            const obj = String(raw.objetoContrato || raw.objeto || 'Contrato Público').trim();
            if (objetoInput.length >= 3 && !obj.toLowerCase().includes(objetoInput.toLowerCase())) continue;
            const pncpCtrl = String(raw.numeroControlePncpCompra || raw.numeroControlePNCP || '').trim() || null;
            const valorHomologado = Number(raw.valorGlobal || raw.valorInicial || 0);
            const valorEstimado =
              (pncpCtrl ? estimativasPorPncp.get(pncpCtrl) : undefined) ??
              estimativasPorObjeto.get(obj.toLowerCase().slice(0, 60)) ??
              null;
            const descCalc = calcularDescontoReal(valorEstimado, valorHomologado);
            const fornCnpj = onlyDigits(String(raw.niFornecedor || ''));

            contratosMercado.push({
              id: String(raw.numeroControlePncp || raw.id || `pncp-${contratosMercado.length}`),
              fonte: 'pncp',
              orgao: String(raw.orgaoEntidade?.razaoSocial || editaisRelacionados[0]?.buyerName || `Órgão ${cnpjOrgao}`),
              cnpjOrgao,
              numeroContrato: raw.numeroContratoEmpenho || raw.numeroContrato || null,
              numeroControlePncp: pncpCtrl,
              objeto: obj,
              dataAssinatura: raw.dataAssinatura || raw.dataPublicacaoPncp || null,
              fornecedorNome: String(raw.nomeRazaoSocialFornecedor || `Empresa ${fornCnpj || 'Vencedora'}`).trim(),
              fornecedorCnpj: fornCnpj,
              valorHomologado: roundMoney(valorHomologado),
              valorEstimado: valorEstimado ? roundMoney(valorEstimado) : null,
              descontoPercentual: descCalc.descontoPercentual,
              statusDesconto: descCalc.statusDesconto,
              urlOficial: buildPncpContratoUrl(raw),
            });
          }
        })
        .catch(() => undefined),
    );
  }

  await Promise.allSettled(tasks);

  const rankingDominante = buildRankingDominante(contratosMercado);
  const comDesconto = contratosMercado.filter((c) => c.descontoPercentual !== null);
  const descontoMedioMercado =
    comDesconto.length > 0
      ? Math.round((comDesconto.reduce((s, c) => s + Number(c.descontoPercentual), 0) / comDesconto.length) * 100) / 100
      : null;

  return {
    contratosMercado: contratosMercado.slice(0, 50),
    rankingDominante: rankingDominante.slice(0, 20),
    descontosDisponiveisCount: comDesconto.length,
    descontoMedioMercado,
    filtro: {
      orgao: orgaoInput || null,
      cnpjOrgao: cnpjOrgao || null,
      objeto: objetoInput || null,
      cnae: cnaeInput || null,
    },
    geradoEm: new Date().toISOString(),
  };
}

export interface ParticipanteExtraidoAta {
  cnpj: string;
  cnpjFormatado: string;
  razaoSocial: string | null;
}

/**
 * Valida os 2 dígitos verificadores de um CNPJ (Módulo 11 oficial da Receita Federal).
 */
export function validarCnpjDigitos(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigit(digits.slice(0, 12), w1);
  if (d1 !== Number(digits[12])) return false;
  const d2 = calcDigit(digits.slice(0, 13), w2);
  return d2 === Number(digits[13]);
}

function formatarCnpjMask(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function limparRazaoSocialCandidata(raw: string): string | null {
  const cleaned = raw
    .replace(/^\s*\d+\s*[-–—.)]+\s*/, '')
    .replace(/\b(CNPJ|CPF|LICITANTE|FORNECEDOR|RAZ[ÃA]O SOCIAL|PROPONENTE|VENCEDOR(?:A)?|ITEM|LOTE|VALOR)\b[:\s-]*/gi, ' ')
    .replace(/^\s*EMPRESA\s*:\s*/i, '')
    .replace(/^[\s\-–—:|/.,;()]+|[\s\-–—:|/,;()]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 4 || cleaned.length > 120) return null;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/.test(cleaned)) return null;
  if (/^\d+([.,]\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Extrai CNPJs válidos (14 dígitos + dígito verificador) de texto de Ata de Sessão / Termo de Julgamento,
 * removendo duplicidades e o CNPJ da própria empresa usuária quando informado.
 */
export function extrairCnpjsDeTextoAta(
  texto: string,
  ownCnpj?: string | null,
): ParticipanteExtraidoAta[] {
  const source = String(texto || '');
  if (!source.trim()) return [];

  const ownNormalized = String(ownCnpj || '').replace(/\D/g, '');
  const regex = /(?<!\d)(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})(?!\d)/g;
  const seen = new Map<string, ParticipanteExtraidoAta>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    const rawMatch = match[0];
    const digits = rawMatch.replace(/\D/g, '');
    if (!validarCnpjDigitos(digits)) continue;
    if (ownNormalized.length === 14 && digits === ownNormalized) continue;

    if (seen.has(digits)) continue;

    // Tenta extrair Razão Social na mesma linha (antes ou depois do CNPJ)
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const nextNewline = source.indexOf('\n', match.index + rawMatch.length);
    const lineEnd = nextNewline === -1 ? source.length : nextNewline;
    const before = source.slice(lineStart, match.index);
    const after = source.slice(match.index + rawMatch.length, lineEnd);

    let razaoSocial =
      limparRazaoSocialCandidata(after) ??
      limparRazaoSocialCandidata(before);

    if (!razaoSocial && lineStart > 1) {
      const prevLineStart = source.lastIndexOf('\n', lineStart - 2) + 1;
      const prevLine = source.slice(prevLineStart, lineStart - 1);
      if (/raz[ãa]o\s+social|fornecedor|licitante|empresa/i.test(prevLine)) {
        razaoSocial = limparRazaoSocialCandidata(prevLine);
      }
    }

    seen.set(digits, {
      cnpj: digits,
      cnpjFormatado: formatarCnpjMask(digits),
      razaoSocial,
    });
  }

  return Array.from(seen.values());
}

/**
 * Extrai texto de um buffer PDF usando pdf-parse com compatibilidade CJS/ESM.
 */
export async function extrairTextoPdfBuffer(buf: Buffer): Promise<{ text: string; numPages: number }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParseModule: any = require('pdf-parse');
  const pdfFn = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default || pdfParseModule;
  const data = await pdfFn(buf);
  return {
    text: String(data?.text || '').trim(),
    numPages: Number(data?.numpages || 1),
  };
}
