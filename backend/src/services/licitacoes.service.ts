import {
  FiltrosBusca,
  LicitacaoPNCP,
  LicitacaoRadarPNCP,
  RadarFacets,
  ResultadoConsultaPNCP,
  ResultadoRadarPNCP,
} from '../interfaces/pncp.interface';
import {
  buscarContratacaoPNCP,
  buscarContratacoesPNCP,
  buscarItensPNCP,
  buildPncpDownloadUrl,
  parsePncpControlNumber,
  parsePncpDateToIso,
} from './pncp.service';
import { buscarPropostasAbertasComprasGov } from './comprasgov.service';
import {
  getTenantRadarProfile,
  keywordsForCnae,
  type TenantRadarProfile,
} from './cnae-to-keywords.service';
import {
  buildRadarSqlQuery,
  normalizeModalityFilter,
  normalizeSourceValues,
  parseDateBoundary,
  parsePalavras,
  parseTipoObjeto,
  parseUfs,
  type RadarSortOrder,
} from './radar-query-builder.service';

const AUTOMATIC_RADAR_KEYWORD_LIMIT = 20;
const PNCP_MODALITIES = [4, 6, 8, 12] as const;

// Cache curto do Radar ao vivo: evita repetir a mesma consulta pesada ao PNCP
// para cada usuário/aba e protege a fonte pública em picos de acesso.
const LIVE_RADAR_CACHE_TTL_MS = 45_000;
const LIVE_RADAR_CACHE_MAX = 200;
const liveRadarCache = new Map<string, { expiresAt: number; value: any }>();

function normalizarBusca(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Semáforo global para chamadas ao PNCP. O cache + single-flight evita
// repetição para filtros iguais; o semáforo protege a fonte pública quando
// muitos filtros distintos chegam ao mesmo tempo (picos de acesso).
const PNCP_MAX_CONCORRENTE = Math.max(1, Number(process.env.PNCP_MAX_CONCORRENTE || 4));
let pncpEmAndamento = 0;
const pncpFila: Array<() => void> = [];

async function comLimitePncp<T>(tarefa: () => Promise<T>): Promise<T> {
  if (pncpEmAndamento >= PNCP_MAX_CONCORRENTE) {
    await new Promise<void>((resolve) => pncpFila.push(resolve));
  }
  pncpEmAndamento += 1;
  try {
    return await tarefa();
  } finally {
    pncpEmAndamento -= 1;
    const proximo = pncpFila.shift();
    if (proximo) proximo();
  }
}

function resolvePncpDownloadUrl(
  numeroControlePNCP: string | null | undefined,
  linkSistemaOrigem?: string | null,
  linkEditalPNCP?: string | null,
): string | null {
  if (typeof buildPncpDownloadUrl === 'function') {
    return buildPncpDownloadUrl(numeroControlePNCP, linkSistemaOrigem, linkEditalPNCP);
  }
  const cleanControl = typeof numeroControlePNCP === 'string' ? numeroControlePNCP.trim().replace(/^pncp-/i, '') : '';
  const match = cleanControl.match(/^(\d{14})(?:-\d+)?-(\d+)[/-](\d{4})$/);
  if (match) {
    const [, cnpj, sequencial, ano] = match;
    return `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${Number(sequencial)}/arquivos/1`;
  }
  if (typeof linkEditalPNCP === 'string' && linkEditalPNCP.trim() && linkEditalPNCP.includes('/arquivos/')) {
    return linkEditalPNCP.trim();
  }
  if (typeof linkSistemaOrigem === 'string' && linkSistemaOrigem.trim()) {
    return linkSistemaOrigem.trim();
  }
  return null;
}

function expandCnaeFilterTerms(cnaeRaw?: string | null): string[] {
  const cnae = (cnaeRaw || '').trim();
  if (!cnae) return [];
  if (typeof keywordsForCnae === 'function') {
    const mapped = keywordsForCnae(cnae);
    if (mapped.length > 0) return mapped;
  }
  return cnae
    .replace(/^\s*\d[\d./\-\s]*/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class NoticePersistenceError extends Error {
  public readonly code = 'NOTICE_PERSISTENCE_FAILED';
  public readonly isPersistenceError = true;
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'NoticePersistenceError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const PT_ACCENT_VARIANTS: Record<string, string[]> = {
  vestuario: ['vestuario', 'vestuário'],
  pregao: ['pregao', 'pregão'],
  calcado: ['calcado', 'calçado'],
  calcados: ['calcados', 'calçados'],
  confeccao: ['confeccao', 'confecção'],
  confeccoes: ['confeccoes', 'confecções'],
  informatica: ['informatica', 'informática'],
  servico: ['servico', 'serviço'],
  servicos: ['servicos', 'serviços'],
  medico: ['medico', 'médico'],
  medicos: ['medicos', 'médicos'],
  alimentacao: ['alimentacao', 'alimentação'],
  alimenticio: ['alimenticio', 'alimentício'],
  alimenticios: ['alimenticios', 'alimentícios'],
  construcao: ['construcao', 'construção'],
  edificios: ['edificios', 'edifícios'],
  saude: ['saude', 'saúde'],
  educacao: ['educacao', 'educação'],
  veiculo: ['veiculo', 'veículo'],
  veiculos: ['veiculos', 'veículos'],
  mobiliario: ['mobiliario', 'mobiliário'],
  escritorio: ['escritorio', 'escritório'],
  manutencao: ['manutencao', 'manutenção'],
  peca: ['peca', 'peça'],
  pecas: ['pecas', 'peças'],
  eletronico: ['eletronico', 'eletrônico'],
  eletrica: ['eletrica', 'elétrica'],
  hidraulica: ['hidraulica', 'hidráulica'],
  mecanica: ['mecanica', 'mecânica'],
  quimico: ['quimico', 'químico'],
  logistica: ['logistica', 'logística'],
  farmacia: ['farmacia', 'farmácia'],
  lixeira: ['lixeira'],
};

function expandAccentVariants(term: string): string[] {
  const clean = term.trim();
  if (!clean) return [];
  const norm = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const variants = new Set<string>([clean]);
  if (norm && norm !== clean.toLowerCase()) {
    variants.add(norm);
  }
  const dictHits = PT_ACCENT_VARIANTS[norm];
  if (dictHits) {
    for (const v of dictHits) variants.add(v);
  }
  return Array.from(variants);
}

function getAutomaticSearchTerms(
  filters: FiltrosBusca,
  _profile: TenantRadarProfile | null,
): string[] {
  const requested = (
    filters.palavraChave
    || filters.palavrasChave
    || filters.busca
    || filters.search
    || filters.q
    || filters.termo
    || ''
  ).trim();

  const hasExplicitCnae = Boolean(filters.cnae && String(filters.cnae).trim().length > 0);
  const cnaeTerms = hasExplicitCnae ? expandCnaeFilterTerms(filters.cnae).slice(0, 5) : [];

  if (requested || cnaeTerms.length > 0) {
    const base = Array.from(new Set([
      ...(requested ? [requested] : []),
      ...cnaeTerms,
    ]));
    return Array.from(new Set(base.flatMap(expandAccentVariants)));
  }

  // Quando usuário NÃO digitar palavra-chave e NÃO ativar explicitamente filtro de CNAE,
  // retornar [] para evitar 20 termos que geram 60 ILIKE forçando Full Table Scan.
  return [];
}

interface LicitacoesCacheEntry<T> {
  value: T;
  expiresAt: number;
}

const tenantRadarProfileCache = new Map<string, LicitacoesCacheEntry<TenantRadarProfile | null>>();
const paginationCountCache = new Map<string, LicitacoesCacheEntry<number>>();
const radarFacetsCache = new Map<string, LicitacoesCacheEntry<RadarFacets>>();

function setLicitacoesCache<T>(cache: Map<string, LicitacoesCacheEntry<T>>, key: string, value: T, ttlMs = 60_000) {
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= now) {
        cache.delete(k);
      }
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function getCachedTenantRadarProfile(tenantId: string): Promise<TenantRadarProfile | null> {
  const now = Date.now();
  const cached = tenantRadarProfileCache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  try {
    const profile = await getTenantRadarProfile(tenantId);
    setLicitacoesCache(tenantRadarProfileCache, tenantId, profile, 60_000);
    return profile;
  } catch {
    return null;
  }
}

const PROCUREMENT_NOTICE_ENXUTO_SELECT = {
  id: true,
  externalId: true,
  numeroControlePncp: true,
  noticeNumber: true,
  url: true,
  buyerDocument: true,
  buyerName: true,
  estimatedValue: true,
  publishedAt: true,
  openingAt: true,
  closingAt: true,
  uf: true,
  municipality: true,
  object: true,
  modality: true,
  modoDisputa: true,
  judgmentCriterion: true,
  status: true,
  srp: true,
  source: true,
} as const;

export function extractPncpAuditParams(
  numeroControlePNCP?: string | null,
  cnpjOrgao?: string | null,
  anoCompra?: number | string | null,
  sequencialCompra?: number | string | null,
): { cnpj: string; anoCompra: number; sequencialCompra: number; urlOficialPncp: string } | null {
  const cleanControl = String(numeroControlePNCP || '').trim().replace(/^pncp-/i, '');
  const match = cleanControl.match(/^(\d{14})(?:-\d+)?-(\d+)[/-](\d{4})$/);
  if (match) {
    const [, cnpj, seq, ano] = match;
    const anoNum = Number(ano);
    const seqNum = Number(seq);
    return {
      cnpj,
      anoCompra: anoNum,
      sequencialCompra: seqNum,
      urlOficialPncp: `https://pncp.gov.br/app/editais/${cnpj}/${anoNum}/${seqNum}`,
    };
  }

  const match2 = cleanControl.match(/^(\d{14})[/-](\d{4})[/-](\d+)$/);
  if (match2) {
    const [, cnpj, ano, seq] = match2;
    const anoNum = Number(ano);
    const seqNum = Number(seq);
    return {
      cnpj,
      anoCompra: anoNum,
      sequencialCompra: seqNum,
      urlOficialPncp: `https://pncp.gov.br/app/editais/${cnpj}/${anoNum}/${seqNum}`,
    };
  }

  const rawCnpj = String(cnpjOrgao || '').replace(/\D/g, '');
  const rawAno = Number(anoCompra);
  const rawSeq = Number(sequencialCompra);
  if (rawCnpj.length === 14 && Number.isFinite(rawAno) && rawAno > 1990 && Number.isFinite(rawSeq) && rawSeq > 0) {
    return {
      cnpj: rawCnpj,
      anoCompra: rawAno,
      sequencialCompra: rawSeq,
      urlOficialPncp: `https://pncp.gov.br/app/editais/${rawCnpj}/${rawAno}/${rawSeq}`,
    };
  }

  return null;
}

function getPncpModality(
  value: FiltrosBusca['modalidade'] | FiltrosBusca['codigoModalidadeContratacao'],
): number {
  if (value === undefined || value === null || value === '') {
    return 6;
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('dispensa')) return 8;
  if (normalized.includes('inexigibilidade')) return 9;
  if (normalized.includes('concorrencia')) return 4;
  if (normalized.includes('leilao')) return 1;
  if (normalized.includes('concurso')) return 2;
  if (normalized.includes('dialogo')) return 14;
  if (normalized.includes('credenciamento')) return 12;
  if (normalized.includes('pre-qualificacao') || normalized.includes('prequalificacao')) return 13;
  if (normalized.includes('pmi') || normalized.includes('manifestacao de interesse')) return 15;
  if (normalized.includes('registro cadastral')) return 16;
  if (normalized.includes('pregao')) return 6;

  return 6;
}

export function getPncpModalities(
  value: FiltrosBusca['modalidade'] | FiltrosBusca['codigoModalidadeContratacao'],
): number[] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'todos') {
    return [...PNCP_MODALITIES];
  }

  return [getPncpModality(value)];
}

export function normalizarLicitacaoPNCP(
  item: LicitacaoPNCP,
): LicitacaoRadarPNCP {
  const numeroControlePNCP = item.numeroControlePNCP.trim();
  const downloadUrl = resolvePncpDownloadUrl(
    numeroControlePNCP,
    item.linkSistemaOrigem,
    item.linkEditalPNCP,
  );
  const cnpjOrgao = nullableString(item.orgaoEntidade?.cnpj) ?? nullableString((item as any).cnpjOrgao);
  const auditParams = extractPncpAuditParams(
    numeroControlePNCP,
    cnpjOrgao,
    (item as any).anoCompra,
    (item as any).sequencialCompra,
  );
  const urlOficialPncp = auditParams?.urlOficialPncp
    || nullableString(item.linkEditalPNCP)
    || nullableString(item.linkSistemaOrigem)
    || 'https://pncp.gov.br/app/editais';

  const nomeOrgao = nullableString(item.orgaoEntidade?.razaoSocial) ?? nullableString((item as any).nomeOrgao) ?? '';
  const objetoCompra = nullableString((item as any).objetoCompra) ?? nullableString(item.objeto) ?? '';
  const modalidadeNome = nullableString(item.modalidadeNome) ?? nullableString((item as any).nomeModalidade);
  const rawVal = nullableNumber(item.valorTotalEstimado);
  const valorTotalEstimado = rawVal != null && rawVal > 0 ? rawVal : null;
  const safeDateToIso = (d: any) => {
    if (typeof parsePncpDateToIso === 'function') return parsePncpDateToIso(d);
    return d || null;
  };
  const dataEncerramentoProposta = safeDateToIso(item.dataEncerramentoProposta);
  const dataAberturaProposta = safeDateToIso(item.dataAberturaProposta);
  const dataPublicacao = safeDateToIso(item.dataPublicacaoPncp);

  // No PNCP: dataAberturaProposta = início de acolhimento de propostas
  // dataEncerramentoProposta = encerramento/fim de recebimento de propostas
  // Regra de veracidade: NUNCA exibir uma data de disputa anterior à data de encerramento de envio
  const dataLimiteProposta = dataEncerramentoProposta;
  let dataSessaoDisputa: string | null = null;
  if (dataAberturaProposta && dataEncerramentoProposta) {
    const dIni = new Date(dataAberturaProposta).getTime();
    const dFim = new Date(dataEncerramentoProposta).getTime();
    dataSessaoDisputa = dIni > dFim ? dataAberturaProposta : dataEncerramentoProposta;
  } else {
    dataSessaoDisputa = dataEncerramentoProposta || dataAberturaProposta;
  }

  return {
    id: numeroControlePNCP,
    databaseId: null,
    numeroControlePNCP,
    nomeOrgao,
    orgao: nomeOrgao,
    cnpjOrgao,
    anoCompra: auditParams?.anoCompra ?? nullableNumber((item as any).anoCompra) ?? undefined,
    sequencialCompra: auditParams?.sequencialCompra ?? nullableNumber((item as any).sequencialCompra) ?? undefined,
    urlOficial: urlOficialPncp,
    urlOficialPncp,
    unidade: nullableString(item.unidadeOrgao?.nomeUnidade),
    uf: nullableString(item.unidadeOrgao?.ufSigla),
    municipio: nullableString(item.unidadeOrgao?.municipioNome),
    objetoCompra,
    objeto: objetoCompra,
    informacaoComplementar: nullableString(item.informacaoComplementar),
    processo: nullableString(item.processo),
    numeroCompra: nullableString(item.numeroCompra),
    numeroEdital: nullableString(item.numeroCompra) || nullableString(item.processo) || numeroControlePNCP,
    nomeModalidade: modalidadeNome,
    modalidadeNome,
    modalidade: modalidadeNome,
    modalidadeId: nullableNumber(item.modalidadeId),
    modoDisputa: nullableString(item.modoDisputaNome),
    criterioJulgamento: nullableString((item as any).criterioJulgamentoNome) || nullableString((item as any).tipoJulgamentoNome) || null,
    situacao: nullableString(item.situacaoCompraNome),
    valorTotalEstimado,
    valorEstimado: valorTotalEstimado,
    valor_estimado: valorTotalEstimado,
    dataPublicacao,
    data_publicacao: dataPublicacao,
    dataAbertura: dataAberturaProposta,
    data_abertura: dataAberturaProposta,
    dataAberturaProposta,
    dataEncerramentoProposta,
    dataInicioRecebimento: dataAberturaProposta,
    dataFimRecebimento: dataEncerramentoProposta,
    dataEncerramento: dataEncerramentoProposta,
    data_encerramento: dataEncerramentoProposta,
    dataLimiteProposta,
    dataSessaoDisputa,
    link: urlOficialPncp || nullableString(item.linkSistemaOrigem) || nullableString(item.linkEditalPNCP),
    linkSistemaOrigem: nullableString(item.linkSistemaOrigem),
    documento_url: downloadUrl,
    linkDownloadEdital: downloadUrl,
    srp: item.srp,
    fonte: 'PNCP',
  } as LicitacaoRadarPNCP;
}

/**
 * Consulta diretamente o endpoint oficial https://pncp.gov.br/api/consulta/v1/contratacoes/proposta
 * em tempo real, sem travar por CNAE local ou mocks.
 */
type RadarLiveResult = ResultadoRadarPNCP & {
  totalPaginas: number;
  perfilRadar: { cnaes: string[]; palavras_chave: string[] } | null;
  aviso?: string;
};

const liveRadarInflight = new Map<string, Promise<RadarLiveResult>>();

function buildLiveRadarCacheKey(filtros: FiltrosBusca): string {
  const page = filtros.pagina ? Math.max(1, Number(filtros.pagina)) : 1;
  const size = filtros.tamanhoPagina ? Math.max(10, Math.min(2000, Number(filtros.tamanhoPagina))) : 50;
  return JSON.stringify({
    pagina: page,
    tamanho: size,
    uf: filtros.uf ?? '',
    modalidade: filtros.modalidade ?? filtros.codigoModalidadeContratacao ?? '',
    srp: Boolean(filtros.srp),
    baixaProcura: Boolean(filtros.baixaProcura),
    orgao: filtros.orgao ?? '',
    dataFinal: filtros.dataFinal ?? '',
    termo: (filtros as any).palavraChave ?? (filtros as any).q ?? (filtros as any).termo ?? '',
  });
}

/**
 * Radar ao vivo com cache curto e single-flight.
 *
 * Milhares de usuários podem abrir o Radar ao mesmo tempo com os mesmos
 * filtros. Sem single-flight, todos disparariam a mesma consulta pesada ao
 * PNCP antes do cache ser preenchido. A promessa em andamento é compartilhada
 * e o resultado fica em cache por 45 segundos.
 */
export async function consultarRadarPncpTempoReal(
  filtros: FiltrosBusca = {},
): Promise<RadarLiveResult> {
  const cacheKey = buildLiveRadarCacheKey(filtros);
  const cached = liveRadarCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const running = liveRadarInflight.get(cacheKey);
  if (running) {
    return running;
  }

  const task = executarConsultaRadarPncpTempoReal(filtros)
    .then((value) => {
      liveRadarCache.set(cacheKey, {
        expiresAt: Date.now() + LIVE_RADAR_CACHE_TTL_MS,
        value,
      });
      if (liveRadarCache.size > LIVE_RADAR_CACHE_MAX) {
        const oldest = liveRadarCache.keys().next().value;
        if (oldest) liveRadarCache.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      liveRadarInflight.delete(cacheKey);
    });

  liveRadarInflight.set(cacheKey, task);
  return task;
}

async function executarConsultaRadarPncpTempoReal(
  filtros: FiltrosBusca = {},
): Promise<RadarLiveResult> {
  const { prisma } = require('../database/prisma');
  const page = filtros.pagina ? Math.max(1, Number(filtros.pagina)) : 1;
  const size = filtros.tamanhoPagina ? Math.max(10, Math.min(2000, Number(filtros.tamanhoPagina))) : 50;

  const rawMod = filtros.codigoModalidadeContratacao ?? filtros.modalidade;
  const normalizedMod = String(rawMod ?? '').trim().toLowerCase();
  const isAllModalities =
    !normalizedMod
    || normalizedMod === 'todos'
    || normalizedMod === 'todas'
    || normalizedMod === 'todas as contratacoes'
    || normalizedMod === 'todas as contratações'
    || normalizedMod === 'srp'
    || normalizedMod.includes('registro de precos')
    || normalizedMod.includes('registro de preços');

  const isSrpFilter =
    filtros.srp === true
    || filtros.srp === 'true'
    || normalizedMod === 'srp'
    || normalizedMod.includes('registro de precos')
    || normalizedMod.includes('registro de preços');

  const palavraChave = (
    filtros.palavraChave
    || filtros.palavrasChave
    || filtros.busca
    || filtros.search
    || filtros.q
    || filtros.termo
  )?.trim() || undefined;

  const orgaoFiltro = String(filtros.orgao ?? '').trim();
  const baixaProcuraAtivo = filtros.baixaProcura === true || filtros.baixaProcura === 'true';

  const rawUf = typeof filtros.uf === 'string' ? filtros.uf.trim().toUpperCase() : undefined;
  const uf = rawUf && rawUf !== 'TODOS' && rawUf !== 'TODAS' ? rawUf : undefined;
  const temFiltroLocal = Boolean(palavraChave || orgaoFiltro || baixaProcuraAtivo);

  let resultadoPncp: ResultadoConsultaPNCP;
  let usouComprasAbertas = false;
  let pncpIndisponivel = false;

  const mapearComprasGov = (c: any) => {
    const ctrlId = String(c.numeroControlePNCP || c.id || c.numero_pregao || '').trim();
    const encerramento = c.dataEncerramentoProposta
      ?? c.data_encerramento
      ?? c.dataEncerramento;
    const abertura = c.dataAberturaProposta
      ?? c.data_abertura
      ?? c.dataAbertura
      ?? c.dataPublicacao
      ?? encerramento;

    return {
      numeroControlePNCP: ctrlId,
      objeto: String(c.objeto || 'Objeto não informado'),
      modalidadeNome: String(c.modalidade || 'Pregão Eletrônico'),
      orgaoEntidade: {
        razaoSocial: String(c.orgao || c.orgaoNome || 'Órgão Público'),
        cnpj: String(c.cnpj_orgao || c.cnpjOrgao || ''),
      },
      unidadeOrgao: {
        ufSigla: String(c.uf || ''),
        municipioNome: String(c.municipio || ''),
      },
      valorTotalEstimado: c.valor_estimado != null
        ? Number(c.valor_estimado)
        : (c.valorEstimado != null ? Number(c.valorEstimado) : undefined),
      dataPublicacaoPncp: String(c.data_publicacao || c.dataPublicacao || abertura || new Date().toISOString()),
      dataAberturaProposta: String(abertura || new Date().toISOString()),
      dataEncerramentoProposta: encerramento ? String(encerramento) : undefined,
      situacaoCompraNome: String(c.situacao || 'Divulgada no Compras.gov.br'),
      linkEditalPNCP: c.link || c.linkEdital || c.url || undefined,
      srp: Boolean(c.srp),
    };
  };

  try {
    // REGRA PNCP: Nunca enviar 'cnae' como parâmetro de query para a API do PNCP.
    // O Compras.gov.br só é consultado quando o PNCP não entrega nenhuma
    // proposta aberta: evita dobrar o tráfego em cada abertura do Radar.
    const [pncpRes] = await Promise.allSettled([
      comLimitePncp(() => buscarContratacoesPNCP({
        endpoint: filtros.endpoint === 'publicacao' ? 'publicacao' : 'proposta',
        fast: true,
        pagina: page,
        tamanhoPagina: Math.min(100, size),
        ...(uf ? { uf } : {}),
        ...(palavraChave ? { palavraChave } : {}),
        ...(filtros.dataFinal ? { dataFinal: filtros.dataFinal } : {}),
        ...(!isAllModalities && rawMod ? { codigoModalidadeContratacao: rawMod } : {}),
      })),
    ]);

    const pncpValue = pncpRes.status === 'fulfilled' ? pncpRes.value : null;
    if (pncpRes.status === 'rejected') {
      pncpIndisponivel = true;
    }
    resultadoPncp = pncpValue && Array.isArray(pncpValue.data)
      ? pncpValue
      : { data: [], totalRegistros: 0, pagina: page, tamanhoPagina: size };

    // O endpoint de contratações do Compras.gov.br ordena pelas publicações
    // mais antigas. A página 1 costuma vir inteira vencida, então buscamos as
    // últimas páginas e mantemos apenas propostas com encerramento futuro.
    const temPropostaAberta = (resultadoPncp.data || []).some((item: any) => {
      const encerramento = item.dataEncerramentoProposta ?? item.dataEncerramento;
      const data = encerramento ? new Date(encerramento).getTime() : Number.NaN;
      return Number.isFinite(data) && data > Date.now();
    });

    if (!temPropostaAberta && (pncpIndisponivel || !temFiltroLocal)) {
      const abertas = await buscarPropostasAbertasComprasGov({
        uf,
        modalidade: !isAllModalities ? rawMod : undefined,
        maxPaginas: 6,
      }).catch(() => ({ data: [], total: 0 }));

      if (abertas.data.length > 0) {
        const seen = new Set((resultadoPncp.data || []).map((x: any) => String(x.numeroControlePNCP || '')));
        const extras = abertas.data
          .map((c: any) => mapearComprasGov(c))
          .filter((item) => item.numeroControlePNCP.length > 0 && !seen.has(item.numeroControlePNCP));

        if (extras.length > 0) {
          resultadoPncp.data = [...(resultadoPncp.data || []), ...extras];
          resultadoPncp.totalRegistros = extras.length;
          usouComprasAbertas = true;
        }
      }
    }
  } catch (apiError: any) {
    // PNCP pode responder 429 (limite de requisições) ou ficar indisponível.
    // Failsafe: tenta propostas abertas no Compras.gov.br e, depois, o cache
    // local. Nunca devolve 500 para o Radar por indisponibilidade de fonte.
    pncpIndisponivel = true;
    try {
      const abertas = await buscarPropostasAbertasComprasGov({
        uf,
        modalidade: !isAllModalities ? rawMod : undefined,
        maxPaginas: 6,
      }).catch(() => ({ data: [], total: 0 }));

      if (abertas.data.length > 0) {
        resultadoPncp = {
          data: abertas.data.map((c: any) => mapearComprasGov(c)),
          totalRegistros: abertas.data.length,
          pagina: page,
          tamanhoPagina: size,
        };
        usouComprasAbertas = true;
      } else {
        resultadoPncp = { data: [], totalRegistros: 0, pagina: page, tamanhoPagina: size };
      }
    } catch {
      resultadoPncp = { data: [], totalRegistros: 0, pagina: page, tamanhoPagina: size };
    }

    // Fallback secundário: cache do banco local (Prisma).
    try {
      const noticeRepo = process.env.DATABASE_URL ? prisma?.procurementNotice : null;
      if (noticeRepo) {
        const cached = await noticeRepo.findMany({
          where: {
            OR: [
              { closingAt: { gte: new Date() } },
              { closingAt: null },
            ],
            ...(uf ? { uf: { equals: uf, mode: 'insensitive' } } : {}),
            ...(palavraChave ? { object: { contains: palavraChave, mode: 'insensitive' } } : {}),
          },
          orderBy: [
            { publishedAt: 'desc' },
          ],
          take: size,
          skip: (page - 1) * size,
        });

        if (cached && cached.length > 0) {
          const cachedItems: LicitacaoRadarPNCP[] = cached.map((c: any) => {
            const numControle = c.numeroControlePncp || (c.dedupeKey ? c.dedupeKey.replace(/^pncp-/, '') : c.externalId || '');
            const parsedAudit = extractPncpAuditParams(numControle, c.buyerDocument);
            const anoNum = parsedAudit?.anoCompra ?? (c.publishedAt ? new Date(c.publishedAt).getFullYear() : 2026);
            const seqNum = parsedAudit?.sequencialCompra ?? 1;
            const urlOficialPncp = parsedAudit?.urlOficialPncp || c.url || 'https://pncp.gov.br/app/editais';
            const downloadUrl = (parsedAudit && parsedAudit.cnpj)
              ? `https://pncp.gov.br/api/pncp/v1/orgaos/${parsedAudit.cnpj}/compras/${Number(anoNum)}/${Number(seqNum)}/arquivos/1`
              : null;
            const val = c.estimatedValue ? Number(c.estimatedValue) : null;
            const openStr = c.openingAt ? new Date(c.openingAt).toISOString() : null;
            const closeStr = c.closingAt ? new Date(c.closingAt).toISOString() : null;

            return {
              id: numControle || c.id,
              databaseId: c.id,
              numeroControlePNCP: numControle,
              nomeOrgao: c.buyerName || 'Órgão Público',
              orgao: c.buyerName || 'Órgão Público',
              cnpjOrgao: c.buyerDocument,
              anoCompra: anoNum,
              sequencialCompra: seqNum,
              urlOficial: urlOficialPncp,
              urlOficialPncp,
              unidade: null,
              uf: c.uf,
              municipio: c.municipality,
              objetoCompra: c.object || '',
              objeto: c.object || '',
              informacaoComplementar: null,
              processo: c.processoAdministrativo || c.noticeNumber,
              numeroCompra: c.noticeNumber,
              numeroEdital: c.noticeNumber || numControle,
              nomeModalidade: c.modality || 'Pregão Eletrônico',
              modalidadeNome: c.modality || 'Pregão Eletrônico',
              modalidade: c.modality || 'Pregão Eletrônico',
              modalidadeId: 6,
              modoDisputa: c.modoDisputa,
              criterioJulgamento: c.judgmentCriterion,
              situacao: c.status || 'Publicada',
              valorTotalEstimado: val,
              valorEstimado: val,
              valor_estimado: val,
              dataPublicacao: c.publishedAt ? new Date(c.publishedAt).toISOString() : null,
              data_publicacao: c.publishedAt ? new Date(c.publishedAt).toISOString() : null,
              dataAbertura: openStr,
              data_abertura: openStr,
              dataAberturaProposta: openStr,
              dataEncerramentoProposta: closeStr,
              dataEncerramento: closeStr,
              data_encerramento: closeStr,
              dataInicioRecebimento: openStr,
              dataFimRecebimento: closeStr,
              dataLimiteProposta: closeStr,
              dataSessaoDisputa: closeStr || openStr,
              link: urlOficialPncp,
              linkSistemaOrigem: null,
              documento_url: downloadUrl,
              linkDownloadEdital: downloadUrl,
              srp: Boolean(c.srp),
              fonte: 'PNCP',
            } as LicitacaoRadarPNCP;
          });

          return {
            data: cachedItems,
            totalRegistros: cachedItems.length,
            pagina: page,
            tamanhoPagina: size,
            totalPaginas: 1,
            perfilRadar: null,
            aviso: 'PNCP temporariamente lento. Exibindo editais recentes em cache local.',
          };
        }
      }
    } catch {
      // Ignora erro no banco local e segue com o fallback do Compras.gov.br
      // ou com a lista vazia + aviso explícito.
    }
  }

  const rawItems = (resultadoPncp.data || []).filter((item: LicitacaoPNCP) => {
    if (!item.numeroControlePNCP) return false;
    if (isSrpFilter && item.srp !== true) return false;
    if (filtros.orgao?.trim()) {
      const targetOrgao = String(filtros.orgao).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const itemOrgao = String(item.orgaoEntidade?.razaoSocial || item.nomeOrgao || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!itemOrgao.includes(targetOrgao)) return false;
    }
    return true;
  });

  const normalizedItems = rawItems.map(normalizarLicitacaoPNCP);

  // 1. FILTRO DE VERACIDADE DIÁRIA (ZERO EDITAIS ATRASADOS/VENCIDOS):
  const now = new Date();
  const termoNormalizado = normalizarBusca(palavraChave);
  const tokensBusca = termoNormalizado.split(' ').filter((token) => token.length >= 2);

  const validItems = normalizedItems.filter((item: LicitacaoRadarPNCP) => {
    const encStr = item.dataEncerramentoProposta || item.dataLimiteProposta || item.dataEncerramento;
    if (!encStr) return filtros.endpoint === 'publicacao';
    const encDate = new Date(encStr);
    return !isNaN(encDate.getTime()) && encDate > now;
  }).filter((item: LicitacaoRadarPNCP) => {
    if (uf && normalizarBusca(item.uf || '') !== normalizarBusca(uf)) return false;
    if (orgaoFiltro) {
      const orgaoItem = normalizarBusca(`${item.orgao || ''} ${item.nomeOrgao || ''}`);
      if (!orgaoItem.includes(normalizarBusca(orgaoFiltro))) return false;
    }
    if (baixaProcuraAtivo) {
      const valor = Number(item.valorTotalEstimado ?? item.valorEstimado ?? 0);
      const modalidade = normalizarBusca(`${item.modalidadeNome || ''} ${item.modalidade || ''}`);
      const menorPorte = valor > 0
        ? valor <= 80000
        : (modalidade.includes('dispensa') || modalidade.includes('credenciamento'));
      if (!menorPorte) return false;
    }
    if (tokensBusca.length === 0) return true;
    const alvo = normalizarBusca(`${item.objeto} ${item.orgao} ${item.numeroControlePNCP}`);
    return tokensBusca.every((token) => alvo.includes(token));
  });

  // 2. ORDENAÇÃO RIGOROSA: data de publicação/abertura mais recente (2026 no topo)
  validItems.sort((a: LicitacaoRadarPNCP, b: LicitacaoRadarPNCP) => {
    const timeA = new Date(a.dataPublicacao || a.dataAbertura || a.dataAberturaProposta || 0).getTime();
    const timeB = new Date(b.dataPublicacao || b.dataAbertura || b.dataAberturaProposta || 0).getTime();
    return timeB - timeA;
  });

  // Persistência assíncrona não bloqueante para suportar abertura de detalhes/CRM/propostas
  try {
    const noticeRepo = process.env.DATABASE_URL ? prisma?.procurementNotice : null;
    if (typeof noticeRepo?.upsert === 'function' && validItems.length > 0) {
      Promise.allSettled(
        validItems.map(async (normalizado: LicitacaoRadarPNCP) => {
          const upserted = await noticeRepo.upsert({
            where: { dedupeKey: `pncp-${normalizado.numeroControlePNCP}` },
            create: {
              source: 'PNCP',
              externalId: normalizado.numeroControlePNCP,
              dedupeKey: `pncp-${normalizado.numeroControlePNCP}`,
              contentHash: normalizado.numeroControlePNCP,
              noticeNumber: normalizado.processo || normalizado.numeroCompra || normalizado.numeroControlePNCP,
              modality: normalizado.modalidade || 'Pregão Eletrônico',
              buyerName: normalizado.orgao || 'Órgão Público',
              buyerDocument: normalizado.cnpjOrgao,
              object: normalizado.objeto || 'Objeto não especificado',
              uf: normalizado.uf || '',
              municipality: normalizado.municipio || '',
              estimatedValue: normalizado.valorEstimado,
              status: normalizado.situacao || 'Publicada',
              url: normalizado.urlOficialPncp || normalizado.link,
              srp: Boolean(normalizado.srp),
              publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : new Date(),
              openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
              closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
            },
            update: {
              estimatedValue: normalizado.valorEstimado,
              status: normalizado.situacao || 'Publicada',
              url: normalizado.urlOficialPncp || normalizado.link,
              srp: Boolean(normalizado.srp),
              openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
              closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
            },
          });
          normalizado.databaseId = upserted?.id ?? null;
        }),
      ).catch(() => { });
    }
  } catch {
    // Segue sem bloqueio caso o banco local não esteja configurado no ambiente
  }

  // O total exposto deve corresponder exatamente aos itens retornados.
  // O total bruto do PNCP inclui editais já encerrados e não pode ser usado
  // como se fosse a quantidade de oportunidades abertas exibidas.
  const totalRegistros = validItems.length;

  return {
    data: validItems,
    totalRegistros,
    pagina: page,
    tamanhoPagina: size,
    totalPaginas: Math.max(1, Math.ceil(totalRegistros / size)),
    perfilRadar: null,
    aviso: validItems.length > 0
      ? (usouComprasAbertas
        ? (pncpIndisponivel
          ? 'PNCP indisponível no momento. Exibindo propostas abertas do Compras.gov.br.'
          : 'PNCP não retornou propostas abertas para estes filtros. Exibindo propostas abertas do Compras.gov.br.')
        : undefined)
      : (pncpIndisponivel
        ? 'Não foi possível consultar o PNCP agora (limite de requisições ou indisponibilidade). Tente novamente em alguns instantes.'
        : 'Nenhuma contratação aberta encontrada agora para estes filtros. Tente atualizar em alguns minutos.'),
  };
}

/**
 * Lê apenas registros PNCP persistidos; a atualização ao vivo é acionada pela rota de sincronização.
 */
export async function listarLicitacoes(
  filtros: FiltrosBusca = {},
  userId?: string,
  tenantId?: string,
): Promise<ResultadoRadarPNCP & {
  totalPaginas: number;
  perfilRadar: { cnaes: string[]; palavras_chave: string[] } | null;
  facets?: RadarFacets;
  tempoBuscaMs?: number;
  aviso?: string;
}> {
  if (
    filtros.tempoReal === true
    || filtros.tempoReal === 'true'
  ) {
    return consultarRadarPncpTempoReal(filtros);
  }

  const { prisma } = require('../database/prisma');
  const t0 = Date.now();

  const page = filtros.pagina ? Math.max(1, Number(filtros.pagina)) : 1;
  const size = filtros.tamanhoPagina ? Math.max(1, Math.min(200, Number(filtros.tamanhoPagina))) : 100;
  const tenantRadarProfile = tenantId ? await getCachedTenantRadarProfile(tenantId) : null;

  let effectiveFilters: FiltrosBusca = { ...filtros };
  let buyerCnpjFilter: string | undefined;

  if (filtros.cnpj && filtros.cnpj.trim()) {
    const rawCnpj = filtros.cnpj.trim();
    const cnpjDigits = rawCnpj.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const companyMatch = typeof prisma?.company?.findFirst === 'function'
      ? await prisma.company
        .findFirst({
          where: {
            OR: [
              { cnpj: rawCnpj },
              ...(cnpjDigits ? [{ cnpj: cnpjDigits }] : []),
            ],
          },
          select: {
            cnaePrincipal: true,
            palavrasChave: true,
            nicho: true,
            uf: true,
          },
        })
        .catch(() => null)
      : null;

    if (companyMatch) {
      if (!effectiveFilters.cnae && companyMatch.cnaePrincipal) {
        effectiveFilters.cnae = companyMatch.cnaePrincipal;
      }
    } else if (cnpjDigits.length >= 8) {
      buyerCnpjFilter = cnpjDigits;
    }
  }

  const ufsFilter = Array.from(new Set([
    ...parseUfs(filtros.ufs),
    ...parseUfs(filtros.uf),
  ]));
  const sourcesFilter = normalizeSourceValues(filtros.fonte);
  const isApenasAbertos = filtros.apenasAbertos === true || filtros.apenasAbertos === 'true';
  const isBaixaProcura = filtros.baixaProcura === true || filtros.baixaProcura === 'true';
  const isSrpFilter = filtros.srp === true || filtros.srp === 'true';
  const selectedTypes = parseTipoObjeto(filtros.tipoObjeto);
  const includeUnclassified = filtros.incluirSemClassificacao === undefined
    ? true
    : (filtros.incluirSemClassificacao === true || filtros.incluirSemClassificacao === 'true');
  const sortOrder: RadarSortOrder = (
    ['recentes', 'encerramento', 'maior_valor', 'menor_valor', 'relevancia'] as const
  ).includes(filtros.ordenarPor as any)
    ? (filtros.ordenarPor as RadarSortOrder)
    : 'recentes';

  const explicitQuery = String(
    filtros.q
    || filtros.termo
    || filtros.busca
    || filtros.search
    || filtros.palavraChave
    || filtros.palavrasChave
    || '',
  ).trim();
  const explicitPalavras = parsePalavras(filtros.palavras);
  const hasExplicitCnae = Boolean(effectiveFilters.cnae && String(effectiveFilters.cnae).trim().length > 0);
  const cnaeTerms = hasExplicitCnae ? expandCnaeFilterTerms(effectiveFilters.cnae).slice(0, 6) : [];
  const profilePalavrasForSql = Array.from(new Set([...explicitPalavras, ...cnaeTerms]));

  const companyProfile = tenantRadarProfile
    ? {
      cnaeKeywords: tenantRadarProfile.keywords,
      uf: tenantRadarProfile.uf,
      valorMin: undefined,
      valorMax: undefined,
    }
    : null;

  function calcularScoreItem(rObj: string | null | undefined, rUf: string | null | undefined, rEstVal: number | null, rOpenAt: Date | string | null | undefined, profile: typeof companyProfile) {
    if (!profile || profile.cnaeKeywords.length === 0) {
      let base = 70;
      const rawValNum = rEstVal ?? 0;
      if (rawValNum > 0) base += 10;
      else base += 5;
      if (rOpenAt) base += 5;
      return { pontuacao: Math.min(base, 95), nivel: base >= 75 ? 'alta' : 'media' };
    }

    const objLower = (rObj || '').toLowerCase();
    const matches = profile.cnaeKeywords.filter((kw) => objLower.includes(kw));

    let scoreNicho = 15;
    if (matches.length >= 3) scoreNicho = 55;
    else if (matches.length === 2) scoreNicho = 45;
    else if (matches.length === 1) scoreNicho = 35;

    let scoreRegiao = 10;
    if (profile.uf && rUf && profile.uf.toUpperCase() === rUf.toUpperCase()) {
      scoreRegiao = 25;
    }

    let scoreValor = 15;
    const val = rEstVal ?? 0;
    if (val > 0) {
      if (profile.valorMin && val < profile.valorMin) scoreValor = 5;
      else if (profile.valorMax && val > profile.valorMax) scoreValor = 10;
      else scoreValor = 20;
    }

    const totalScore = Math.min(100, Math.max(10, scoreNicho + scoreRegiao + scoreValor));
    const nivel = totalScore >= 75 ? 'alta' : totalScore >= 50 ? 'media' : 'baixa';
    return { pontuacao: totalScore, nivel };
  }

  const safeFormatDate = (val: unknown): string | null => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };

  const mapNoticeRowToRadarItem = (r: any) => {
    const extId = r.externalId ?? r.external_id ?? '';
    const ctrlPncp = r.numeroControlePncp ?? r.numero_controle_pncp ?? '';
    const noticeNum = r.noticeNumber ?? r.notice_number ?? '';
    const buyerDoc = r.buyerDocument ?? r.buyer_document ?? '';
    const buyerNm = r.buyerName ?? r.buyer_name ?? '';
    const rawEstVal = r.estimatedValue ?? r.estimated_value;
    const rawEst = rawEstVal != null ? Number(rawEstVal) : null;
    const valorEstimado = rawEst != null && rawEst > 0 ? rawEst : null;
    const pubDate = safeFormatDate(r.publishedAt ?? r.published_at);
    const openDate = safeFormatDate(r.openingAt ?? r.opening_at);
    const closeDate = safeFormatDate(r.closingAt ?? r.closing_at);
    const numControle = extId || ctrlPncp || noticeNum || '';
    const downloadUrl = resolvePncpDownloadUrl(numControle, r.url, null) || r.url || '';
    const portalUrl = downloadUrl || r.url || '';
    const auditParams = extractPncpAuditParams(numControle, buyerDoc, null, null);
    const urlOficialPncp = auditParams?.urlOficialPncp || r.url || 'https://pncp.gov.br/app/editais';
    const obj = r.object || '';
    const modoDisp = r.modoDisputa ?? r.modo_disputa ?? '';
    const judgCrit = r.judgmentCriterion ?? r.judgment_criterion ?? (r.rawPayload as any)?.criterioJulgamentoNome ?? (r.rawPayload as any)?.tipoJulgamentoNome ?? null;
    const tipoObjeto = r.objectType ?? r.object_type ?? null;

    return {
      id: r.id,
      databaseId: r.id,
      numeroControlePNCP: numControle || r.id,
      orgao: buyerNm,
      cnpjOrgao: buyerDoc,
      anoCompra: auditParams?.anoCompra,
      sequencialCompra: auditParams?.sequencialCompra,
      urlOficial: urlOficialPncp,
      urlOficialPncp,
      unidade: '',
      uf: r.uf || '',
      municipio: r.municipality || '',
      objeto: obj,
      processo: noticeNum,
      numeroCompra: noticeNum,
      numeroEdital: noticeNum || numControle || r.id,
      modalidade: r.modality || '',
      modalidadeId: null,
      modoDisputa: modoDisp,
      criterioJulgamento: judgCrit,
      situacao: r.status || '',
      valorTotalEstimado: valorEstimado,
      valorEstimado,
      valor_estimado: valorEstimado,
      dataPublicacao: pubDate,
      data_publicacao: pubDate,
      dataAbertura: openDate,
      data_abertura: openDate,
      dataAberturaProposta: openDate,
      dataInicioRecebimento: openDate,
      dataEncerramento: closeDate,
      data_encerramento: closeDate,
      dataEncerramentoProposta: closeDate,
      dataFimRecebimento: closeDate,
      dataLimiteProposta: closeDate,
      dataSessaoDisputa: openDate || closeDate,
      link: portalUrl || urlOficialPncp,
      linkSistemaOrigem: portalUrl || urlOficialPncp,
      documento_url: downloadUrl,
      linkDownloadEdital: downloadUrl,
      srp: Boolean(r.srp),
      fonte: r.source || 'PNCP',
      tipoObjeto,
      score: calcularScoreItem(obj, r.uf, valorEstimado, openDate, companyProfile),
    };
  };

  if (typeof prisma?.$queryRawUnsafe === 'function') {
    const built = buildRadarSqlQuery({
      ufs: ufsFilter,
      q: explicitQuery || undefined,
      palavras: profilePalavrasForSql,
      orgao: filtros.orgao,
      fonte: filtros.fonte,
      apenasAbertos: isApenasAbertos,
      baixaProcura: isBaixaProcura,
      srp: isSrpFilter,
      modalidade: filtros.modalidade ?? filtros.codigoModalidadeContratacao,
      dataPublicacao: filtros.dataPublicacao,
      dataInicial: filtros.dataInicial,
      dataFinal: filtros.dataFinal,
      valorMin: filtros.valorMin !== undefined ? Number(filtros.valorMin) : undefined,
      valorMax: filtros.valorMax !== undefined ? Number(filtros.valorMax) : undefined,
      buyerCnpjFilter,
      tipoObjeto: filtros.tipoObjeto,
      incluirSemClassificacao: includeUnclassified,
      ordenarPor: sortOrder,
      profileKeywords: tenantRadarProfile?.keywords,
      profileUfs: tenantRadarProfile?.uf ? [tenantRadarProfile.uf] : [],
    });

    const facetsCacheKey = JSON.stringify({ where: built.baseWhereSql, params: built.baseParams });
    const cachedFacetEntry = radarFacetsCache.get(facetsCacheKey);
    const isFacetCached = Boolean(cachedFacetEntry && cachedFacetEntry.expiresAt > Date.now());

    const facetsSql = `
      SELECT
        count(*)::int AS todas,
        count(*) FILTER (WHERE object_type = 'BENS')::int AS bens,
        count(*) FILTER (WHERE object_type = 'SERVICOS')::int AS servicos,
        count(*) FILTER (WHERE object_type = 'OBRAS')::int AS obras,
        count(*) FILTER (WHERE object_type IS NULL)::int AS sem_classificacao,
        count(*) FILTER (WHERE published_at >= NOW() - INTERVAL '24 hours')::int AS novas_24h,
        count(*) FILTER (WHERE closing_at > NOW() AND closing_at <= NOW() + INTERVAL '48 hours')::int AS encerrando_48h,
        count(*) FILTER (WHERE closing_at > NOW() AND closing_at <= NOW() + INTERVAL '5 days')::int AS encerrando_5_dias
      FROM procurement_notices
      WHERE ${built.baseWhereSql}
    `;

    const limitPlaceholder = `$${built.listParams.length + 1}`;
    const offsetPlaceholder = `$${built.listParams.length + 2}`;
    const rowsSql = `
      SELECT
        id, external_id, numero_controle_pncp, notice_number, url,
        buyer_document, buyer_name, estimated_value, published_at,
        opening_at, closing_at, uf, municipality, object, modality,
        modo_disputa, judgment_criterion, status, srp, source, object_type
      FROM procurement_notices
      WHERE ${built.fullWhereSql}
      ORDER BY ${built.orderBySql}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const facetsPromise: Promise<RadarFacets> = isFacetCached
      ? Promise.resolve(cachedFacetEntry!.value)
      : (prisma.$queryRawUnsafe(facetsSql, ...built.baseParams) as Promise<any[]>).then((resRows) => {
          const f = resRows?.[0] || {};
          const computed: RadarFacets = {
            todas: Number(f.todas ?? 0),
            bens: Number(f.bens ?? 0),
            servicos: Number(f.servicos ?? 0),
            obras: Number(f.obras ?? 0),
            semClassificacao: Number(f.sem_classificacao ?? 0),
            novas24h: Number(f.novas_24h ?? 0),
            encerrando48h: Number(f.encerrando_48h ?? 0),
            encerrando5Dias: Number(f.encerrando_5_dias ?? 0),
          };
          setLicitacoesCache(radarFacetsCache, facetsCacheKey, computed, 20_000);
          return computed;
        });

    const rowsPromise = prisma.$queryRawUnsafe(
      rowsSql,
      ...built.listParams,
      size,
      (page - 1) * size,
    ) as Promise<any[]>;

    const [facets, rawRows] = await Promise.all([facetsPromise, rowsPromise]);

    let count = facets.todas;
    if (built.hasObjectTypeFilter) {
      count =
        (built.selectedObjectTypes.includes('BENS') ? facets.bens : 0)
        + (built.selectedObjectTypes.includes('SERVICOS') ? facets.servicos : 0)
        + (built.selectedObjectTypes.includes('OBRAS') ? facets.obras : 0)
        + (built.includeUnclassified ? facets.semClassificacao : 0);
    }

    return {
      data: (Array.isArray(rawRows) ? rawRows : []).map(mapNoticeRowToRadarItem),
      totalRegistros: count,
      pagina: page,
      tamanhoPagina: size,
      totalPaginas: Math.ceil(count / size) || 1,
      perfilRadar: tenantRadarProfile
        ? {
          cnaes: tenantRadarProfile.cnaes,
          palavras_chave: tenantRadarProfile.keywords,
        }
        : null,
      facets,
      tempoBuscaMs: Date.now() - t0,
    };
  }

  // Fallback Prisma (utilizado em suítes unitárias com Prisma mockado sem $queryRawUnsafe)
  const searchTerms = Array.from(new Set([
    ...getAutomaticSearchTerms(effectiveFilters, tenantRadarProfile),
    ...explicitPalavras.flatMap(expandAccentVariants),
  ]));
  const and: any[] = [];

  if (buyerCnpjFilter) {
    and.push({
      OR: [
        { buyerDocument: { contains: buyerCnpjFilter, mode: 'insensitive' } },
        { externalId: { contains: buyerCnpjFilter, mode: 'insensitive' } },
      ],
    });
  }

  if (ufsFilter.length === 1) {
    and.push({
      OR: [
        { uf: { equals: ufsFilter[0], mode: 'insensitive' } },
        { uf: { contains: ufsFilter[0], mode: 'insensitive' } },
      ],
    });
  } else if (ufsFilter.length > 1) {
    and.push({ uf: { in: ufsFilter } });
  }

  if (filtros.orgao && filtros.orgao.trim()) {
    and.push({
      buyerName: { contains: filtros.orgao.trim(), mode: 'insensitive' },
    });
  }

  if (sourcesFilter) {
    and.push({ source: { in: sourcesFilter } });
  }

  if (isApenasAbertos) {
    const now = new Date();
    const qdCutoff = new Date(Date.now() - 15 * 86_400_000);
    const credCutoff = new Date(Date.now() - 60 * 86_400_000);
    and.push({
      NOT: {
        OR: [
          { status: { contains: 'Suspens', mode: 'insensitive' } },
          { status: { contains: 'Revogad', mode: 'insensitive' } },
          { status: { contains: 'Anulad', mode: 'insensitive' } },
          { status: { contains: 'Cancelad', mode: 'insensitive' } },
          { status: { contains: 'Encerrad', mode: 'insensitive' } },
          { status: { contains: 'Homologad', mode: 'insensitive' } },
        ],
      },
    });
    and.push({
      OR: [
        { closingAt: { gt: now } },
        { AND: [{ closingAt: null }, { source: 'querido_diario' }, { publishedAt: { gte: qdCutoff } }] },
        { AND: [{ closingAt: null }, { modality: { contains: 'Credenciamento', mode: 'insensitive' } }, { publishedAt: { gte: credCutoff } }] },
      ],
    });
  }

  if (filtros.dataPublicacao && filtros.dataPublicacao.trim()) {
    const dt = parseDateBoundary(filtros.dataPublicacao, false);
    if (dt) {
      and.push({ publishedAt: { gte: dt } });
    }
  }

  if (isSrpFilter) {
    and.push({ srp: true });
  }
  if (isBaixaProcura) {
    and.push({
      OR: [
        { modality: { contains: 'Dispensa', mode: 'insensitive' } },
        { modality: { contains: 'Credenciamento', mode: 'insensitive' } },
        { estimatedValue: { lte: 80000, gt: 0 } },
      ],
    });
    and.push({
      AND: [
        { NOT: { object: { contains: 'obra de engenharia', mode: 'insensitive' } } },
        { NOT: { object: { contains: 'concessão', mode: 'insensitive' } } },
        { NOT: { object: { contains: 'parceria público-privada', mode: 'insensitive' } } },
      ],
    });
  }

  if (typeof filtros.valorMin === 'number' && Number.isFinite(filtros.valorMin) && filtros.valorMin > 0) {
    and.push({ estimatedValue: { gte: filtros.valorMin } });
  }
  if (typeof filtros.valorMax === 'number' && Number.isFinite(filtros.valorMax) && filtros.valorMax > 0) {
    and.push({ estimatedValue: { lte: filtros.valorMax } });
  }

  if (selectedTypes.length > 0) {
    if (includeUnclassified) {
      and.push({ OR: [{ objectType: { in: selectedTypes } }, { objectType: null }] });
    } else {
      and.push({ objectType: { in: selectedTypes } });
    }
  }

  const modFilter = normalizeModalityFilter(filtros.modalidade ?? filtros.codigoModalidadeContratacao);
  if (modFilter.isSrp) {
    and.push({ srp: true });
  } else if (modFilter.term) {
    and.push({
      modality: { contains: modFilter.term, mode: 'insensitive' },
    });
  }

  if (searchTerms.length > 0) {
    and.push({
      OR: searchTerms.flatMap((term) => [
        { object: { contains: term, mode: 'insensitive' } },
        { buyerName: { contains: term, mode: 'insensitive' } },
        { noticeNumber: { contains: term, mode: 'insensitive' } },
      ]),
    });
  }

  if (filtros.dataInicial || filtros.dataFinal) {
    const publishedAt: any = {};
    const iniDt = parseDateBoundary(filtros.dataInicial, false);
    const fimDt = parseDateBoundary(filtros.dataFinal, true);
    if (iniDt) publishedAt.gte = iniDt;
    if (fimDt) publishedAt.lte = fimDt;
    if (Object.keys(publishedAt).length > 0) {
      and.push({ publishedAt });
    }
  }

  const where: any = and.length > 0 ? { AND: and } : {};
  let prismaOrderBy: any = { publishedAt: { sort: 'desc', nulls: 'last' } };
  if (sortOrder === 'maior_valor') prismaOrderBy = { estimatedValue: { sort: 'desc', nulls: 'last' } };
  else if (sortOrder === 'menor_valor') prismaOrderBy = { estimatedValue: { sort: 'asc', nulls: 'last' } };
  else if (sortOrder === 'encerramento') prismaOrderBy = { closingAt: { sort: 'asc', nulls: 'last' } };

  let count = 0;
  let rows: any[] = [];

  const whereCacheKey = JSON.stringify({ where, orderBy: sortOrder });
  const cachedCountEntry = paginationCountCache.get(whereCacheKey);
  const isCountCached = Boolean(cachedCountEntry && cachedCountEntry.expiresAt > Date.now());

  if (isCountCached) {
    count = cachedCountEntry!.value;
    rows = await prisma.procurementNotice.findMany({
      where,
      select: PROCUREMENT_NOTICE_ENXUTO_SELECT,
      skip: (page - 1) * size,
      take: size,
      orderBy: prismaOrderBy,
    });
  } else {
    if (typeof prisma.$transaction === 'function') {
      const res = await prisma.$transaction([
        prisma.procurementNotice.count({ where }),
        prisma.procurementNotice.findMany({
          where,
          select: PROCUREMENT_NOTICE_ENXUTO_SELECT,
          skip: (page - 1) * size,
          take: size,
          orderBy: prismaOrderBy,
        }),
      ]);
      count = typeof res?.[0] === 'number' ? res[0] : 0;
      rows = Array.isArray(res?.[1]) ? res[1] : [];
    } else {
      count = await prisma.procurementNotice.count({ where });
      rows = await prisma.procurementNotice.findMany({
        where,
        select: PROCUREMENT_NOTICE_ENXUTO_SELECT,
        skip: (page - 1) * size,
        take: size,
        orderBy: prismaOrderBy,
      });
    }
    setLicitacoesCache(paginationCountCache, whereCacheKey, count, 60_000);
  }

  return {
    data: rows.map(mapNoticeRowToRadarItem),
    totalRegistros: count,
    pagina: page,
    tamanhoPagina: size,
    totalPaginas: Math.ceil(count / size) || 1,
    perfilRadar: tenantRadarProfile
      ? {
        cnaes: tenantRadarProfile.cnaes,
        palavras_chave: tenantRadarProfile.keywords,
      }
      : null,
    tempoBuscaMs: Date.now() - t0,
  };
}

export async function sincronizarLicitacoesPNCP(
  filtros: FiltrosBusca = {},
): Promise<{ totalSincronizados: number; items: LicitacaoRadarPNCP[] }> {
  const { prisma } = require('../database/prisma');

  const modalidadeSelecionada = filtros.codigoModalidadeContratacao ?? filtros.modalidade;
  const modalidades = getPncpModalities(modalidadeSelecionada);
  const explicitKeyword = (
    filtros.palavraChave
    || filtros.palavrasChave
    || filtros.busca
    || filtros.search
    || filtros.q
    || filtros.termo
  )?.trim();
  const cnaeTerms = expandCnaeFilterTerms(filtros.cnae);
  const palavraChave = explicitKeyword || (cnaeTerms.length > 0 ? cnaeTerms[0] : undefined);

  let buyerCnpjForPncp: string | undefined;
  if (filtros.cnpj && filtros.cnpj.trim()) {
    const rawCnpj = filtros.cnpj.trim();
    const digits = rawCnpj.replace(/\D/g, '');
    const companyMatch = typeof prisma?.company?.findFirst === 'function'
      ? await prisma.company
        .findFirst({
          where: {
            OR: [
              { cnpj: rawCnpj },
              ...(digits ? [{ cnpj: digits }] : []),
            ],
          },
          select: { id: true },
        })
        .catch(() => null)
      : null;
    if (!companyMatch && digits.length === 14) {
      buyerCnpjForPncp = digits;
    }
  }

  const paginasSync = filtros.pagina ? [filtros.pagina] : [1];
  const resultados = await Promise.all(
    modalidades.flatMap((modalidade) =>
      paginasSync.map((pag) =>
        buscarContratacoesPNCP({
          codigoModalidadeContratacao: modalidade,
          dataInicial: filtros.dataInicial,
          dataFinal: filtros.dataFinal,
          uf: filtros.uf,
          ...(buyerCnpjForPncp ? { cnpj: buyerCnpjForPncp } : {}),
          palavraChave,
          pagina: pag,
          tamanhoPagina: filtros.tamanhoPagina ?? 100,
          endpoint: filtros.endpoint || 'proposta',
        }).catch(() => ({ data: [], totalRegistros: 0, pagina: pag, tamanhoPagina: 100 }))
      )
    )
  );

  const rawItems = resultados.flatMap((resultado) => resultado.data || []);
  const sincronizados: LicitacaoRadarPNCP[] = [];

  const itensElegiveis = rawItems.filter((item) =>
    item.numeroControlePNCP
    && (!(filtros.srp === true || filtros.srp === 'true') || item.srp),
  );
  const persistConcurrency = 10;

  for (let offset = 0; offset < itensElegiveis.length; offset += persistConcurrency) {
    const batch = itensElegiveis.slice(offset, offset + persistConcurrency);
    const persistedBatch = await Promise.all(batch.map(async (item) => {
      const normalizado = normalizarLicitacaoPNCP(item);
      const ctrl = normalizado.numeroControlePNCP.trim();
      const isPncpControl = /^\d{14}-\d+-\d+\/\d{4}$/.test(ctrl);
      const updatePayload = {
        buyerName: normalizado.orgao || 'Órgão Público',
        buyerDocument: normalizado.cnpjOrgao,
        object: normalizado.objeto || 'Objeto não especificado',
        estimatedValue: normalizado.valorEstimado,
        status: normalizado.situacao || 'Publicada',
        url: normalizado.urlOficialPncp || normalizado.link,
        srp: Boolean(normalizado.srp),
        publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : undefined,
        openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
        closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
      };

      try {
        let upserted: any;
        try {
          upserted = await prisma.procurementNotice.upsert({
            where: { dedupeKey: `pncp-${ctrl}` },
            create: {
              source: 'PNCP',
              externalId: ctrl,
              ...(isPncpControl ? { numeroControlePncp: ctrl } : {}),
              dedupeKey: `pncp-${ctrl}`,
              contentHash: ctrl,
              noticeNumber: normalizado.processo || normalizado.numeroCompra || ctrl,
              modality: normalizado.modalidade || 'Pregão Eletrônico',
              buyerName: normalizado.orgao || 'Órgão Público',
              buyerDocument: normalizado.cnpjOrgao,
              object: normalizado.objeto || 'Objeto não especificado',
              uf: normalizado.uf || '',
              municipality: normalizado.municipio || '',
              estimatedValue: normalizado.valorEstimado,
              status: normalizado.situacao || 'Publicada',
              url: normalizado.link,
              srp: Boolean(normalizado.srp),
              publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : new Date(),
              openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
              closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
            },
            update: updatePayload,
          });
        } catch (upsertConflictErr: any) {
          if (upsertConflictErr?.code === 'P2002' && typeof prisma.procurementNotice.findFirst === 'function') {
            const existing = await prisma.procurementNotice.findFirst({
              where: {
                OR: [
                  ...(isPncpControl ? [{ numeroControlePncp: ctrl }] : []),
                  { externalId: ctrl },
                ],
              },
              select: { id: true },
            });
            if (!existing?.id) throw upsertConflictErr;
            upserted = await prisma.procurementNotice.update({
              where: { id: existing.id },
              data: updatePayload,
            });
          } else {
            throw upsertConflictErr;
          }
        }

        normalizado.id = upserted.id;
        normalizado.databaseId = upserted.id;
        return normalizado;
      } catch (upsertErr) {
        console.error(`[sincronizarLicitacoesPNCP] Erro ao persistir edital ${normalizado.numeroControlePNCP}:`, upsertErr);
        throw new NoticePersistenceError(
          `Falha ao persistir o edital "${normalizado.numeroControlePNCP}" no banco de dados local.`,
          upsertErr,
        );
      }
    }));

    sincronizados.push(...persistedBatch);
  }

  return {
    totalSincronizados: sincronizados.length,
    items: sincronizados,
  };
}

export interface BuscarLicitacaoOptions {
  requirePersistence?: boolean;
}

export async function buscarLicitacaoPorIdOuControle(
  identificador: string,
  options: BuscarLicitacaoOptions = {},
): Promise<LicitacaoRadarPNCP> {
  const { prisma } = require('../database/prisma');
  const cleanId = (identificador || '').trim();

  if (!cleanId) {
    throw new Error('Identificador da licitação não informado');
  }

  // 1. Tenta buscar no banco de dados local por UUID id, externalId ou dedupeKey
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  const whereConditions: any[] = [
    { externalId: cleanId },
    { dedupeKey: `pncp-${cleanId}` },
    { dedupeKey: cleanId },
  ];
  if (isUuid) {
    whereConditions.unshift({ id: cleanId });
  }

  const localNotice = await prisma.procurementNotice.findFirst({
    where: { OR: whereConditions },
  });

  if (localNotice) {
    const rawEst = localNotice.estimatedValue ? Number(localNotice.estimatedValue) : null;
    const valorEstimado = rawEst != null && rawEst > 0 ? rawEst : null;
    const numControle = localNotice.externalId || localNotice.noticeNumber || localNotice.id;
    const auditParams = extractPncpAuditParams(numControle, localNotice.buyerDocument, null, null);
    const urlOficialPncp = auditParams?.urlOficialPncp || localNotice.url || 'https://pncp.gov.br/app/editais';
    const downloadUrl = resolvePncpDownloadUrl(numControle, localNotice.url, null) || localNotice.url || '';
    const pubDate = localNotice.publishedAt ? localNotice.publishedAt.toISOString() : null;
    const openDate = localNotice.openingAt ? localNotice.openingAt.toISOString() : null;
    const closeDate = localNotice.closingAt ? localNotice.closingAt.toISOString() : null;

    const itemLocal: LicitacaoRadarPNCP = {
      id: localNotice.id,
      databaseId: localNotice.id,
      numeroControlePNCP: numControle,
      orgao: localNotice.buyerName || '',
      cnpjOrgao: localNotice.buyerDocument || '',
      anoCompra: auditParams?.anoCompra,
      sequencialCompra: auditParams?.sequencialCompra,
      urlOficial: urlOficialPncp,
      urlOficialPncp,
      unidade: '',
      uf: localNotice.uf || '',
      municipio: localNotice.municipality || '',
      objeto: localNotice.object || '',
      processo: localNotice.noticeNumber || '',
      numeroCompra: localNotice.noticeNumber || '',
      numeroEdital: localNotice.noticeNumber || numControle || localNotice.id,
      modalidade: localNotice.modality || '',
      modalidadeId: null,
      modoDisputa: '',
      situacao: localNotice.status || '',
      valorEstimado,
      valor_estimado: valorEstimado,
      valorTotalEstimado: valorEstimado,
      dataPublicacao: pubDate,
      data_publicacao: pubDate,
      dataPublicacaoPncp: pubDate,
      dataAbertura: openDate,
      data_abertura: openDate,
      dataAberturaProposta: openDate,
      dataInicioRecebimento: openDate,
      dataEncerramento: closeDate,
      data_encerramento: closeDate,
      dataEncerramentoProposta: closeDate,
      dataFimRecebimento: closeDate,
      dataLimiteProposta: closeDate,
      dataSessaoDisputa: openDate || closeDate,
      link: urlOficialPncp,
      linkSistemaOrigem: localNotice.url || urlOficialPncp,
      documento_url: downloadUrl,
      linkDownloadEdital: downloadUrl,
      srp: Boolean(localNotice.srp),
      fonte: localNotice.source || 'PNCP',
    };

    if (itemLocal.valorEstimado === null || itemLocal.valorEstimado <= 0) {
      try {
        const parsed = parsePncpControlNumber(itemLocal.numeroControlePNCP);
        const itens = parsed
          ? await buscarItensPNCP(parsed.cnpj, parsed.ano, parsed.sequencial)
          : await buscarItensPNCP(itemLocal.numeroControlePNCP);

        if (Array.isArray(itens) && itens.length > 0) {
          let soma = 0;
          let hasItemComValor = false;
          for (const it of itens) {
            const v = it.valorTotal ?? (Number(it.quantidade || 0) * Number(it.valorUnitarioEstimado || 0));
            const numV = Number(v);
            if (Number.isFinite(numV) && numV > 0) {
              soma += numV;
              hasItemComValor = true;
            }
          }
          if (hasItemComValor && soma > 0) {
            const finalVal = Number(soma.toFixed(2));
            itemLocal.valorEstimado = finalVal;
            itemLocal.valor_estimado = finalVal;
            itemLocal.valorTotalEstimado = finalVal;

            if (itemLocal.databaseId) {
              prisma.procurementNotice.update({
                where: { id: itemLocal.databaseId },
                data: { estimatedValue: finalVal },
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Falha não impeditiva na busca complementar de itens
      }
    }

    return itemLocal;
  }

  // 2. Se não estiver no banco, consulta a API oficial do PNCP
  const dadosPncp = await buscarContratacaoPNCP(cleanId);
  const normalizado = normalizarLicitacaoPNCP(dadosPncp);

  // 3. Persiste no banco de dados local para que possa ser salvo no CRM e reutilizado
  try {
    const upserted = await prisma.procurementNotice.upsert({
      where: { dedupeKey: `pncp-${normalizado.numeroControlePNCP}` },
      create: {
        source: 'PNCP',
        externalId: normalizado.numeroControlePNCP,
        dedupeKey: `pncp-${normalizado.numeroControlePNCP}`,
        contentHash: normalizado.numeroControlePNCP,
        noticeNumber: normalizado.processo || normalizado.numeroCompra || normalizado.numeroControlePNCP,
        modality: normalizado.modalidade,
        buyerName: normalizado.orgao,
        buyerDocument: normalizado.cnpjOrgao,
        object: normalizado.objeto,
        uf: normalizado.uf,
        municipality: normalizado.municipio,
        estimatedValue: normalizado.valorEstimado,
        status: normalizado.situacao,
        url: normalizado.urlOficialPncp || normalizado.link,
        publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : null,
        openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
        closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
      },
      update: {
        buyerName: normalizado.orgao,
        buyerDocument: normalizado.cnpjOrgao,
        object: normalizado.objeto,
        estimatedValue: normalizado.valorEstimado,
        status: normalizado.situacao,
        url: normalizado.urlOficialPncp || normalizado.link,
        publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : undefined,
        openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
        closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
      },
    });
    normalizado.id = upserted.id;
    normalizado.databaseId = upserted.id;
  } catch (persistErr) {
    console.error('[buscarLicitacaoPorIdOuControle] Falha ao persistir edital no cache local:', persistErr);
    if (options.requirePersistence !== false) {
      throw new NoticePersistenceError(
        `Falha ao persistir o edital "${normalizado.numeroControlePNCP}" no banco de dados local.`,
        persistErr,
      );
    }
  }

  // 4. Quando o edital estiver com valorEstimado === null ou <= 0, consulte automaticamente buscarItensPNCP e calcule a soma real
  if (normalizado.valorEstimado === null || normalizado.valorEstimado <= 0) {
    try {
      const parsed = parsePncpControlNumber(normalizado.numeroControlePNCP);
      const itens = parsed
        ? await buscarItensPNCP(parsed.cnpj, parsed.ano, parsed.sequencial)
        : await buscarItensPNCP(normalizado.numeroControlePNCP);

      if (Array.isArray(itens) && itens.length > 0) {
        let soma = 0;
        let hasItemComValor = false;
        for (const it of itens) {
          const v = it.valorTotal ?? (Number(it.quantidade || 0) * Number(it.valorUnitarioEstimado || 0));
          const numV = Number(v);
          if (Number.isFinite(numV) && numV > 0) {
            soma += numV;
            hasItemComValor = true;
          }
        }
        if (hasItemComValor && soma > 0) {
          const finalVal = Number(soma.toFixed(2));
          normalizado.valorEstimado = finalVal;
          normalizado.valor_estimado = finalVal;
          normalizado.valorTotalEstimado = finalVal;

          if (normalizado.databaseId) {
            prisma.procurementNotice.update({
              where: { id: normalizado.databaseId },
              data: { estimatedValue: finalVal },
            }).catch(() => {});
          }
        }
      }
    } catch {
      // Falha não impeditiva na busca complementar de itens
    }
  }

  return normalizado;
}

export async function buscarLicitacaoPorNumeroControle(
  numeroControlePNCP: string,
  options?: BuscarLicitacaoOptions,
): Promise<LicitacaoRadarPNCP> {
  return buscarLicitacaoPorIdOuControle(numeroControlePNCP, options);
}
