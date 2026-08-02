import axios from 'axios';
import { prisma } from '../database/prisma';
import crypto from 'crypto';

const DEFAULT_COMPRASGOV_BASE = 'https://dadosabertos.compras.gov.br';
const DEFAULT_TIMEOUT_MS = 25000;

function resolveAxiosErrorSummary(error: any) {
  return error?.message || error?.code || error?.cause?.code || 'Erro sem detalhe retornado pelo provedor';
}

export function getComprasGovBaseUrl() {
  const configuredBase = process.env.COMPRASGOV_BASE_URL?.trim();

  if (!configuredBase) {
    return DEFAULT_COMPRASGOV_BASE;
  }

  const normalizedBase = configuredBase.replace(/\/+$/, '');

  if (normalizedBase.includes('compras.gov.br') && !normalizedBase.includes('dados.gov.br')) {
    return DEFAULT_COMPRASGOV_BASE;
  }

  return normalizedBase;
}

function getComprasGovTimeout() {
  const configuredTimeout = Number(process.env.COMPRASGOV_TIMEOUT);

  if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(configuredTimeout, 120000);
}

const BASE = getComprasGovBaseUrl();

const client = axios.create({
  baseURL: BASE,
  timeout: getComprasGovTimeout(),
  headers: { Accept: 'application/json' },
});

export interface PregaoHistorico {
  id_uasg: string;
  numero_pregao: string;
  objeto: string;
  data_resultado: string;
  valor_homologado: number;
  valor_estimado: number;
  desconto_pct: number;
  fornecedor_vencedor: string;
  cnpj_vencedor: string;
  uf: string;
}

export interface ItemContratado {
  id_item: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  unidade: string;
  codigo: string;
}

export interface LicitacaoComprasGov {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  uasg: string | null;
  uf: string | null;
  valor_estimado?: number;
  valor_homologado?: number;
  data_abertura?: string;
  data_encerramento?: string;
  modalidade?: string;
  situacao?: string;
  link?: string;
}

interface BuscaComprasGovInput {
  descricao?: string;
  codigoCatmat?: string;
  uf?: string;
  valorMin?: number;
  valorMax?: number;
  modalidade?: string | number;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value?: string | null) {
  return normalizeText(value)
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function extractCollection(raw: any): any[] {
  const candidates = [
    raw,
    raw?.items,
    raw?.result,
    raw?.results,
    raw?.resultado,
    raw?._embedded?.pregoes,
    raw?._embedded?.licitacoes,
    raw?.pregoes,
    raw?.licitacoes,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function resolveTotal(raw: any, fallbackLength: number) {
  const total = Number(raw?.total ?? raw?.count ?? raw?.totalRegistros ?? fallbackLength);
  return Number.isFinite(total) ? total : fallbackLength;
}

function applyLocalFilters(items: LicitacaoComprasGov[], params: BuscaComprasGovInput) {
  let filtered = [...items];

  if (params.descricao?.trim()) {
    const descricaoTokens = tokenize(params.descricao);
    filtered = filtered.filter((item) =>
      descricaoTokens.some((token) => normalizeText(item.objeto).includes(token)),
    );
  }

  if (params.uf) {
    const uf = params.uf.toUpperCase();
    filtered = filtered.filter((item) => (item.uf || '').toUpperCase() === uf);
  }

  if (params.valorMin) {
    filtered = filtered.filter((item) => (item.valor_estimado || 0) >= params.valorMin!);
  }

  if (params.valorMax) {
    filtered = filtered.filter((item) => !item.valor_estimado || item.valor_estimado <= params.valorMax!);
  }

  if (
    params.modalidade
    && !Number.isFinite(Number(params.modalidade))
  ) {
    const modalidade = normalizeText(String(params.modalidade));

    filtered = filtered.filter((item) =>
      normalizeText(item.modalidade).includes(modalidade),
    );
  }

  return filtered;
}

function normalizePregao(item: any): LicitacaoComprasGov {
  const uasg = String(
    item.unidadeOrgaoCodigoUnidade
      || item.co_uasg
      || item.uasg
      || item.id_uasg
      || item.codigo_uasg
      || '',
  );

  const numero = String(
    item.numeroCompra
      || item.numero
      || item.nu_pregao
      || item.numero_pregao
      || item.nr_pregao
      || '',
  );

  const id = String(
    item.numeroControlePNCP
      || item.idCompra
      || item.id_compra
      || item.id
      || item.identificador
      || item.numero_licitacao
      || [uasg, numero].filter(Boolean).join('-')
      || `${Date.now()}-${Math.random()}`,
  );

  const orgao =
    item.orgaoEntidadeRazaoSocial
    || item.unidadeOrgaoNomeUnidade
    || item.no_orgao
    || item.no_ausg
    || item.orgao
    || item.nome_orgao
    || item.nm_orgao
    || (uasg ? `UASG ${uasg}` : 'Compras.gov');

  const link =
    item.linkSistemaOrigem
    || item.link
    || item.url
    || item.href
    || undefined;

  return {
    id,
    numero,
    objeto:
      item.objetoCompra
      || item.tx_objeto
      || item.objeto
      || item.ds_objeto
      || '',
    orgao,
    uasg: uasg || null,
    uf:
      item.unidadeOrgaoUfSigla
      || item.uf_uasg
      || item.uf
      || null,
    valor_estimado:
      Number(
        item.valorTotalEstimado
        ?? item.vl_estimado_total
        ?? item.valorEstimadoTotal
        ?? item.valor_estimado_total
        ?? item.valor_estimado
        ?? 0,
      ) || undefined,
    valor_homologado:
      Number(
        item.valorTotalHomologado
        ?? item.vl_homologado_total
        ?? item.valorHomologadoTotal
        ?? item.valor_homologado_total
        ?? item.valor_homologado
        ?? 0,
      ) || undefined,
    data_abertura:
      item.dataAberturaPropostaPncp
      || item.dt_inicio_proposta
      || item.data_abertura_proposta
      || item.data_abertura
      || undefined,
    data_encerramento:
      item.dataEncerramentoPropostaPncp
      || item.dt_fim_proposta
      || item.dt_encerramento
      || item.data_entrega_proposta
      || item.data_resultado
      || undefined,
    modalidade:
      item.modalidadeNome
      || item.ds_tipo_pregao_compra
      || item.ds_tipo_pregao
      || item.modalidade
      || 'Não informada',
    situacao:
      item.situacaoCompraNomePncp
      || item.ds_situacao_pregao
      || item.situacao_aviso
      || item.situacao
      || 'Publicada',
    link,
  };
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatApiDate(value: unknown, fallback: Date) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return fallback.toISOString().slice(0, 10);
}

function resolvePageSize() {
  const configured = Number(
    process.env.COMPRASGOV_TAMANHO_PAGINA ?? 20,
  );

  if (!Number.isFinite(configured)) {
    return 20;
  }

  return Math.min(100, Math.max(10, configured));
}

function buildContratacoesParams(params: BuscaComprasGovInput) {
  const hoje = new Date();

  return {
    pagina: Math.max(1, Number(params.pagina ?? 1)),
    tamanhoPagina: resolvePageSize(),
    dataPublicacaoPncpInicial: formatApiDate(
      params.dataInicio,
      addDays(hoje, -30),
    ),
    dataPublicacaoPncpFinal: formatApiDate(
      params.dataFim,
      hoje,
    ),
    codigoModalidade:
      Number(params.modalidade)
      || Number(process.env.COMPRASGOV_MODALIDADE_PADRAO)
      || 6,
    unidadeOrgaoUfSigla: params.uf?.toUpperCase(),
    contratacaoExcluida: false,
  };
}

function buildPregoesLegadosParams(params: BuscaComprasGovInput) {
  const hoje = new Date();

  return {
    pagina: Math.max(1, Number(params.pagina ?? 1)),
    tamanhoPagina: resolvePageSize(),
    dt_data_edital_inicial: formatApiDate(
      params.dataInicio,
      addDays(hoje, -365),
    ),
    dt_data_edital_final: formatApiDate(
      params.dataFim,
      hoje,
    ),
    pertence14133: false,
  };
}

export async function buscarLicitacoesComprasGov(params: BuscaComprasGovInput): Promise<{
  data: LicitacaoComprasGov[];
  total: number;
}> {
  const attempts = [
    {
      endpoint:
        '/modulo-contratacoes/1_consultarContratacoes_PNCP_14133',
      params: buildContratacoesParams(params),
    },
    {
      endpoint: '/modulo-legado/3_consultarPregoes',
      params: buildPregoesLegadosParams(params),
    },
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const response = await client.get(attempt.endpoint, { params: attempt.params });
      const raw = response.data;
      const items = applyLocalFilters(
        extractCollection(raw).map(normalizePregao),
        params,
      );

      if (items.length > 0) {
        // Assynchronously save items to local database
        persistComprasGovNotices(items).catch(err => {
          console.error('[ComprasGov] Erro ao persistir editais:', err);
        });

        return {
          data: items,
          total: resolveTotal(raw, items.length),
        };
      }
    } catch (error: any) {
      console.error(`[ComprasGov] Falha em ${attempt.endpoint}:`, resolveAxiosErrorSummary(error));
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { data: [], total: 0 };
}

export async function buscarHistoricoPregoes(params: {
  descricao?: string;
  codigoCatmat?: string;
  uf?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
}): Promise<PregaoHistorico[]> {
  try {
    const resultado = await buscarLicitacoesComprasGov({
      descricao: params.descricao || params.codigoCatmat,
      codigoCatmat: params.codigoCatmat,
      uf: params.uf,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      pagina: params.pagina,
    });

    return resultado.data.map((item) => {
      const valorEstimado = item.valor_estimado || 0;
      const valorHomologado = item.valor_homologado || valorEstimado;

      return {
        id_uasg: item.uasg || '',
        numero_pregao: item.numero,
        objeto: item.objeto,
        data_resultado: item.data_encerramento || item.data_abertura || '',
        valor_homologado: valorHomologado,
        valor_estimado: valorEstimado,
        desconto_pct: valorEstimado > 0
          ? Math.round(((valorEstimado - valorHomologado) / valorEstimado) * 100)
          : 0,
        fornecedor_vencedor: '',
        cnpj_vencedor: '',
        uf: item.uf || '',
      };
    });
  } catch (error) {
    console.error('[ComprasGov] Erro ao buscar histórico:', (error as Error).message);
    return [];
  }
}

async function persistComprasGovNotices(items: LicitacaoComprasGov[]) {
  for (const item of items) {
    if (!item.id) continue;
    const dedupeKey = `COMPRASGOV:${item.id}`;
    const hash = crypto.createHash('md5').update(JSON.stringify(item)).digest('hex');
    
    await prisma.procurementNotice.upsert({
      where: { dedupeKey },
      create: {
        source: 'ComprasGov',
        externalId: item.id,
        dedupeKey,
        contentHash: hash,
        noticeNumber: item.numero,
        modality: item.modalidade || 'Não informada',
        buyerName: item.orgao,
        buyerDocument: null,
        object: item.objeto || 'Não informado',
        uf: item.uf,
        municipality: null,
        estimatedValue: item.valor_estimado,
        status: item.situacao,
        url: item.link,
        publishedAt: item.data_abertura ? new Date(item.data_abertura) : null,
        openingAt: item.data_abertura ? new Date(item.data_abertura) : null,
        closingAt: item.data_encerramento ? new Date(item.data_encerramento) : null,
        rawPayload: item as any,
      },
      update: {
        contentHash: hash,
        status: item.situacao,
        estimatedValue: item.valor_estimado,
        closingAt: item.data_encerramento ? new Date(item.data_encerramento) : null,
        rawPayload: item as any,
      }
    });
  }
}

export class ComprasGovService {
  public async execute(filters: BuscaComprasGovInput): Promise<{ items: LicitacaoComprasGov[]; total: number }> {
    const result = await buscarLicitacoesComprasGov(filters);

    return {
      items: result.data,
      total: result.total,
    };
  }
}

export async function buscarItensCatmat(codigo: string): Promise<ItemContratado[]> {
  try {
    const { data } = await client.get('/materiais/doc/materiais.json', {
      params: { codigo },
    });

    const items = Array.isArray(data) ? data : (data?.items || []);

    return items.map((item: any) => ({
      id_item: item.id_item || 0,
      descricao: item.descricao || '',
      quantidade: Number(item.quantidade || 0),
      valor_unitario: Number(item.valor_unitario || 0),
      unidade: item.unidade || 'UN',
      codigo: item.codigo || codigo,
    }));
  } catch {
    return [];
  }
}

export function calcularPrecoReferencia(historico: PregaoHistorico[]): {
  media: number;
  mediana: number;
  minimo: number;
  maximo: number;
  descontoPctMedio: number;
  precoSugerido: number;
} {
  if (historico.length === 0) {
    return {
      media: 0,
      mediana: 0,
      minimo: 0,
      maximo: 0,
      descontoPctMedio: 0,
      precoSugerido: 0,
    };
  }

  const valores = historico
    .map((item) => item.valor_homologado)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const media = valores.reduce((sum, value) => sum + value, 0) / valores.length;
  const mediana = valores[Math.floor(valores.length / 2)];
  const minimo = valores[0];
  const maximo = valores[valores.length - 1];
  const descontoPctMedio = historico.reduce((sum, item) => sum + item.desconto_pct, 0) / historico.length;
  const precoSugerido = Math.round(mediana * 0.92);

  return { media, mediana, minimo, maximo, descontoPctMedio, precoSugerido };
}
