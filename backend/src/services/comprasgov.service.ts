import axios from 'axios';
import { prisma } from '../database/prisma';
import crypto from 'crypto';
import { recordIngestionJob, saveIngestionCursor } from './ingestion-cursor.service';

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
  municipio?: string | null;
  cnpj_orgao?: string | null;
  valor_estimado?: number;
  valor_homologado?: number;
  data_publicacao?: string;
  data_abertura?: string;
  data_encerramento?: string;
  modalidade?: string;
  situacao?: string;
  link?: string;
  processo?: string;
  modo_disputa?: string;
  srp?: boolean;
  amparo_legal?: string;
  prazo_minimo_dias_uteis?: number;
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
  tamanhoPagina?: number;
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
    municipio:
      item.unidadeOrgaoMunicipioNome
      || item.no_municipio
      || item.municipio
      || null,
    cnpj_orgao: item.orgaoEntidadeCnpj
      ? String(item.orgaoEntidadeCnpj).replace(/\D/g, '')
      : null,
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
    data_publicacao:
      item.dataPublicacaoPncp
      || item.dataInclusaoPncp
      || item.dt_publicacao
      || undefined,
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
    processo: item.processo || item.numeroProcesso || item.num_processo || undefined,
    modo_disputa: item.modoDisputaNome || item.modoDisputa || undefined,
    srp: typeof item.srp === 'boolean' ? item.srp : undefined,
    amparo_legal: item.amparoLegal || 'Lei 14.133/2021',
    prazo_minimo_dias_uteis: item.prazoMinimoDiasUteis || (
      (item.modalidadeNome || item.modalidade || '').toLowerCase().includes('pregao') ? 8 : 10
    ),
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

function parseComprasGovDate(raw?: string | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    normalized = `${trimmed}T12:00:00-03:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
    normalized = `${trimmed}-03:00`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Converte nomes ou códigos PNCP para o codigoModalidade real do SIASG no Compras.gov.br:
 * SIASG 3 = Concorrência (PNCP 4) | SIASG 5 = Pregão (PNCP 6)
 * SIASG 6 = Dispensa (PNCP 8)     | SIASG 7 = Inexigibilidade (PNCP 9)
 */
export function resolveComprasGovSiasgModality(modalidade?: string | number): number {
  if (modalidade === undefined || modalidade === null || String(modalidade).trim() === '') {
    const envRaw = Number(process.env.COMPRASGOV_MODALIDADE_PADRAO);
    if (envRaw === 3 || envRaw === 5 || envRaw === 7) return envRaw;
    return 5;
  }

  if (typeof modalidade === 'number' || /^\d+$/.test(String(modalidade).trim())) {
    const num = Number(modalidade);
    if (num === 3 || num === 5 || num === 6 || num === 7) return num;
    if (num === 4) return 3;
    if (num === 8) return 6;
    if (num === 9) return 7;
    return 5;
  }

  const norm = String(modalidade)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (norm.includes('pregao')) return 5;
  if (norm.includes('dispensa')) return 6;
  if (norm.includes('concorrencia')) return 3;
  if (norm.includes('inexigibilidade')) return 7;
  return 5;
}

function resolvePageSize(overrideSize?: number) {
  const configured = Number(
    overrideSize ?? process.env.COMPRASGOV_TAMANHO_PAGINA ?? 50,
  );

  if (!Number.isFinite(configured)) {
    return 50;
  }

  return Math.min(500, Math.max(10, configured));
}

function buildContratacoesParams(params: BuscaComprasGovInput) {
  const hoje = new Date();

  return {
    pagina: Math.max(1, Number(params.pagina ?? 1)),
    tamanhoPagina: resolvePageSize(params.tamanhoPagina),
    dataPublicacaoPncpInicial: formatApiDate(
      params.dataInicio,
      addDays(hoje, -30),
    ),
    dataPublicacaoPncpFinal: formatApiDate(
      params.dataFim,
      hoje,
    ),
    codigoModalidade: resolveComprasGovSiasgModality(params.modalidade),
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

/**
 * Busca propostas com encerramento futuro no Compras.gov.br.
 *
 * O endpoint de contratações filtra por data de publicação e devolve os
 * registros mais antigos primeiro. Para achar propostas abertas, é preciso
 * olhar as últimas páginas da janela (publicações mais recentes) e filtrar
 * pelo encerramento. É o fallback confiável quando o PNCP não responde.
 *
 * Resultado fica em cache curto (60s) para não sobrecarregar a fonte pública
 * quando muitos usuários abrem o Radar ao mesmo tempo.
 */
let cachePropostasAbertas: {
  key: string;
  expiresAt: number;
  data: LicitacaoComprasGov[];
  total: number;
} | null = null;

export async function buscarPropostasAbertasComprasGov(params: {
  uf?: string;
  modalidade?: string | number;
  maxPaginas?: number;
} = {}): Promise<{ data: LicitacaoComprasGov[]; total: number }> {
  const key = `${params.uf || 'BR'}:${params.modalidade || '6'}:${params.maxPaginas || 6}`;
  if (cachePropostasAbertas && cachePropostasAbertas.key === key && cachePropostasAbertas.expiresAt > Date.now()) {
    return { data: cachePropostasAbertas.data, total: cachePropostasAbertas.total };
  }

  const endpoint = '/modulo-contratacoes/1_consultarContratacoes_PNCP_14133';
  const baseParams = buildContratacoesParams({
    uf: params.uf,
    modalidade: params.modalidade,
  } as BuscaComprasGovInput);

  const probe = await client.get(endpoint, { params: { ...baseParams, pagina: 1 } });
  const totalPaginas = Math.max(1, Number((probe.data as any)?.totalPaginas || 1));
  const maxPaginas = Math.max(1, Math.min(10, Number(params.maxPaginas || 6)));
  const paginas: number[] = [];

  for (let offset = 0; offset < maxPaginas; offset += 1) {
    const pagina = totalPaginas - offset;
    if (pagina >= 1) paginas.push(pagina);
  }

  const respostas = await Promise.all(
    paginas.map((pagina) =>
      client
        .get(endpoint, { params: { ...baseParams, pagina } })
        .catch(() => null),
    ),
  );

  const agora = Date.now();
  const vistos = new Set<string>();
  const abertos: LicitacaoComprasGov[] = [];

  for (const resposta of respostas) {
    if (!resposta) continue;

    for (const item of extractCollection(resposta.data).map(normalizePregao)) {
      const encerramento = item.data_encerramento
        ? new Date(item.data_encerramento).getTime()
        : Number.NaN;

      if (!Number.isFinite(encerramento) || encerramento <= agora) continue;
      if (!item.id || vistos.has(item.id)) continue;

      vistos.add(item.id);
      abertos.push(item);
    }
  }

  if (abertos.length > 0) {
    persistComprasGovNotices(abertos).catch((err) => {
      console.error('[ComprasGov] Erro ao persistir propostas abertas:', err);
    });
  }

  cachePropostasAbertas = {
    key,
    expiresAt: Date.now() + 60_000,
    data: abertos,
    total: abertos.length,
  };

  return { data: abertos, total: abertos.length };
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

async function persistComprasGovNotices(items: LicitacaoComprasGov[]): Promise<number> {
  let persisted = 0;
  const now = new Date();

  for (const item of items) {
    if (!item.id) continue;
    try {
      const ctrl = item.id.trim();
      const isPncpControl = /^\d{14}-\d+-\d+\/\d{4}$/.test(ctrl);
      const dedupeKey = isPncpControl ? `pncp-${ctrl}` : `COMPRASGOV:${ctrl}`;
      const hash = crypto.createHash('md5').update(JSON.stringify(item)).digest('hex');

      const parsedPublished = parseComprasGovDate(item.data_publicacao);
      const parsedOpening = parseComprasGovDate(item.data_abertura);
      const parsedClosing = parseComprasGovDate(item.data_encerramento);

      // Nunca persistir publishedAt no futuro (o radar ordena por publishedAt DESC)
      let validPublishedAt: Date = now;
      if (parsedPublished && parsedPublished <= now) {
        validPublishedAt = parsedPublished;
      } else if (parsedOpening && parsedOpening <= now) {
        validPublishedAt = parsedOpening;
      }

      const validOpeningAt = parsedOpening && !isNaN(parsedOpening.getTime()) ? parsedOpening : null;
      const validClosingAt = parsedClosing && !isNaN(parsedClosing.getTime()) ? parsedClosing : null;

      const updateFields = {
        contentHash: hash,
        modality: item.modalidade || undefined,
        status: item.situacao,
        estimatedValue: item.valor_estimado,
        buyerDocument: item.cnpj_orgao || undefined,
        municipality: item.municipio || undefined,
        srp: Boolean(item.srp),
        publishedAt: validPublishedAt,
        openingAt: validOpeningAt,
        closingAt: validClosingAt,
        rawPayload: item as any,
      };

      try {
        await prisma.procurementNotice.upsert({
          where: { dedupeKey },
          create: {
            source: 'ComprasGov',
            externalId: ctrl,
            ...(isPncpControl ? { numeroControlePncp: ctrl } : {}),
            dedupeKey,
            contentHash: hash,
            noticeNumber: item.numero || ctrl,
            processoAdministrativo: item.processo || null,
            modality: item.modalidade || 'Não informada',
            modoDisputa: item.modo_disputa || null,
            srp: Boolean(item.srp),
            buyerName: item.orgao,
            buyerDocument: item.cnpj_orgao || null,
            object: item.objeto || 'Não informado',
            uf: item.uf,
            municipality: item.municipio || null,
            estimatedValue: item.valor_estimado,
            status: item.situacao,
            url: item.link || (isPncpControl ? undefined : null),
            publishedAt: validPublishedAt,
            openingAt: validOpeningAt,
            closingAt: validClosingAt,
            rawPayload: item as any,
          },
          update: updateFields,
        });
        persisted += 1;
      } catch (upsertErr: any) {
        if (upsertErr?.code === 'P2002') {
          const existing = await prisma.procurementNotice.findFirst({
            where: {
              OR: [
                ...(isPncpControl ? [{ numeroControlePncp: ctrl }] : []),
                { externalId: ctrl },
              ],
            },
            select: { id: true },
          });
          if (existing?.id) {
            await prisma.procurementNotice.update({
              where: { id: existing.id },
              data: updateFields,
            });
            persisted += 1;
          }
        } else {
          throw upsertErr;
        }
      }
    } catch (err: any) {
      if (err?.code !== 'P2002') {
        console.warn(`[ComprasGov] Aviso ao persistir ${item.id}:`, err?.message || err);
      }
    }
  }
  return persisted;
}

export async function syncComprasGovRecentes(options: { daysBack?: number; maxPages?: number } = {}): Promise<{
  fonte: 'ComprasGov';
  persisted: number;
  byModality: Record<number, number>;
}> {
  const startedAt = new Date();
  const daysBack = options.daysBack ?? 7;
  const maxPages = Math.max(1, options.maxPages ?? 3);
  const hoje = new Date();
  const inicio = addDays(hoje, -daysBack);
  // SIASG codigoModalidade reais na API Compras.gov.br:
  // 5 = Pregão Eletrônico | 6 = Dispensa | 3 = Concorrência | 7 = Inexigibilidade
  const modalidades = [5, 6, 3, 7];
  const pageSize = 500;
  let persisted = 0;
  let failed = 0;
  const byModality: Record<number, number> = {};

  for (const modalidade of modalidades) {
    let modPersisted = 0;
    try {
      const baseParams = {
        tamanhoPagina: pageSize,
        dataPublicacaoPncpInicial: formatApiDate(undefined, inicio),
        dataPublicacaoPncpFinal: formatApiDate(undefined, hoje),
        codigoModalidade: modalidade,
        contratacaoExcluida: false,
      };

      const firstRes = await client.get('/modulo-contratacoes/1_consultarContratacoes_PNCP_14133', {
        params: { ...baseParams, pagina: 1 },
      });
      const firstRaw = firstRes.data;
      const totalPaginas = Math.max(1, Number(firstRaw?.totalPaginas || 1));
      const firstItems = extractCollection(firstRaw).map(normalizePregao);

      if (firstItems.length === 0) {
        byModality[modalidade] = 0;
        continue;
      }

      if (totalPaginas === 1) {
        modPersisted += await persistComprasGovNotices(firstItems);
      } else {
        // Compras.gov.br ordena em ordem cronológica crescente; varre das últimas páginas para capturar D0/D-1 primeiro.
        const stopPage = Math.max(1, totalPaginas - maxPages + 1);
        for (let pagina = totalPaginas; pagina >= stopPage; pagina--) {
          if (pagina === 1) {
            modPersisted += await persistComprasGovNotices(firstItems);
          } else {
            const pageRes = await client.get('/modulo-contratacoes/1_consultarContratacoes_PNCP_14133', {
              params: { ...baseParams, pagina },
            });
            const pageItems = extractCollection(pageRes.data).map(normalizePregao);
            if (pageItems.length > 0) {
              modPersisted += await persistComprasGovNotices(pageItems);
            }
          }
        }
      }
    } catch (err: any) {
      failed += 1;
      console.warn(`[ComprasGov Sync] Modalidade SIASG ${modalidade}:`, resolveAxiosErrorSummary(err));
    }
    byModality[modalidade] = modPersisted;
    persisted += modPersisted;
  }

  await saveIngestionCursor('ComprasGov', 'contratacoes_recentes', {
    daysBack,
    maxPages,
    persisted,
    byModality,
  });
  await recordIngestionJob({
    source: 'ComprasGov',
    connector: 'syncComprasGovRecentes',
    status: failed > 0 && persisted === 0 ? 'failed' : failed > 0 ? 'partial' : 'completed',
    recordsSeen: persisted,
    recordsAccepted: persisted,
    recordsFailed: failed,
    startedAt,
    metadata: { daysBack, maxPages, byModality },
  });

  console.info(`[ComprasGov Sync] Sincronizados ${persisted} editais recentes (últimos ${daysBack} dias).`, byModality);
  return { fonte: 'ComprasGov', persisted, byModality };
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
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (valores.length === 0) {
    return {
      media: 0,
      mediana: 0,
      minimo: 0,
      maximo: 0,
      descontoPctMedio: 0,
      precoSugerido: 0,
    };
  }

  const media = valores.reduce((sum, value) => sum + value, 0) / valores.length;
  const mediana = valores[Math.floor(valores.length / 2)];
  const minimo = valores[0];
  const maximo = valores[valores.length - 1];
  const descontoPctMedio = historico.reduce((sum, item) => sum + item.desconto_pct, 0) / historico.length;
  const precoSugerido = Math.round(mediana * 0.92);

  return { media, mediana, minimo, maximo, descontoPctMedio, precoSugerido };
}