import axios from 'axios';

type FonteDossie = 'pncp' | 'portal_transparencia';
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

const DEFAULT_YEARS_BACK = 5;
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
    const [pncpResult, transparenciaResult] = await Promise.all([
      this.consultarPncp(cnpjLimpo, periodo),
      this.consultarPortalTransparencia(cnpjLimpo, userId),
    ]);

    const contratos = dedupeContratos([
      ...pncpResult.contratos,
      ...transparenciaResult.contratos,
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
      fontes: [pncpResult, transparenciaResult].map((result) => ({
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
