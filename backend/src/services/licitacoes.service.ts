import {
  FiltrosBusca,
  LicitacaoPNCP,
  LicitacaoRadarPNCP,
  ResultadoRadarPNCP,
} from '../interfaces/pncp.interface';
import {
  buscarContratacaoPNCP,
  buscarContratacoesPNCP,
  buildPncpDownloadUrl,
} from './pncp.service';
import {
  getTenantRadarProfile,
  keywordsForCnae,
  type TenantRadarProfile,
} from './cnae-to-keywords.service';

const AUTOMATIC_RADAR_KEYWORD_LIMIT = 20;
const PNCP_MODALITIES = [4, 6, 8, 12] as const;

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

function getAutomaticSearchTerms(
  filters: FiltrosBusca,
  profile: TenantRadarProfile | null,
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

  const cnaeTerms = expandCnaeFilterTerms(filters.cnae);

  if (requested || cnaeTerms.length > 0) {
    return Array.from(new Set([
      ...(requested ? [requested] : []),
      ...cnaeTerms,
    ]));
  }

  return profile?.keywords.slice(0, AUTOMATIC_RADAR_KEYWORD_LIMIT) ?? [];
}

function extractPncpAuditParams(
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
  const valorTotalEstimado = nullableNumber(item.valorTotalEstimado);
  const dataEncerramentoProposta = nullableString(item.dataEncerramentoProposta);
  const dataAberturaProposta = nullableString(item.dataAberturaProposta);

  // Extrair com precisão os dois marcos temporais retornados pelo PNCP
  const dataLimiteProposta = dataEncerramentoProposta;
  const dataSessaoDisputa = dataAberturaProposta || dataEncerramentoProposta;

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
    dataPublicacao: nullableString(item.dataPublicacaoPncp),
    data_publicacao: nullableString(item.dataPublicacaoPncp),
    dataAbertura: dataAberturaProposta,
    data_abertura: dataAberturaProposta,
    dataEncerramentoProposta,
    dataEncerramento: dataEncerramentoProposta,
    data_encerramento: dataEncerramentoProposta,
    dataLimiteProposta,
    dataSessaoDisputa,
    link: nullableString(item.linkSistemaOrigem) || nullableString(item.linkEditalPNCP) || urlOficialPncp,
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
export async function consultarRadarPncpTempoReal(
  filtros: FiltrosBusca = {},
): Promise<ResultadoRadarPNCP & {
  totalPaginas: number;
  perfilRadar: { cnaes: string[]; palavras_chave: string[] } | null;
  aviso?: string;
}> {
  const { prisma } = require('../database/prisma');
  const page = filtros.pagina ? Math.max(1, Number(filtros.pagina)) : 1;
  const size = filtros.tamanhoPagina ? Math.max(10, Math.min(50, Number(filtros.tamanhoPagina))) : 20;

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

  const rawUf = typeof filtros.uf === 'string' ? filtros.uf.trim().toUpperCase() : undefined;
  const uf = rawUf && rawUf !== 'TODOS' && rawUf !== 'TODAS' ? rawUf : undefined;

  // REGRA PNCP: Nunca enviar 'cnae' como parâmetro de query para a API do PNCP.
  const resultadoPncp = await buscarContratacoesPNCP({
    endpoint: 'proposta',
    pagina: page,
    tamanhoPagina: size,
    ...(uf ? { uf } : {}),
    ...(filtros.dataFinal ? { dataFinal: filtros.dataFinal } : {}),
    ...(!isAllModalities && rawMod ? { codigoModalidadeContratacao: rawMod } : {}),
    ...(filtros.cnpj ? { cnpj: filtros.cnpj } : {}),
    ...(palavraChave ? { palavraChave } : {}),
  });

  const rawItems = (resultadoPncp.data || []).filter((item) =>
    item.numeroControlePNCP
    && (!isSrpFilter || item.srp === true),
  );

  const normalizedItems = rawItems.map(normalizarLicitacaoPNCP);

  // Persistência assíncrona não bloqueante para suportar abertura de detalhes/CRM/propostas
  try {
    const noticeRepo = process.env.DATABASE_URL ? prisma?.procurementNotice : null;
    if (typeof noticeRepo?.upsert === 'function' && normalizedItems.length > 0) {
      Promise.allSettled(
        normalizedItems.map(async (normalizado) => {
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

  const totalRegistros = isSrpFilter
    ? normalizedItems.length
    : (resultadoPncp.totalRegistros ?? normalizedItems.length);

  return {
    data: normalizedItems,
    totalRegistros,
    pagina: page,
    tamanhoPagina: size,
    totalPaginas: Math.max(1, Math.ceil(totalRegistros / size)),
    perfilRadar: null,
    aviso: normalizedItems.length === 0
      ? 'Nenhuma contratação encontrada diretamente no PNCP para estes filtros.'
      : undefined,
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
  aviso?: string;
}> {
  if (
    filtros.tempoReal === true
    || filtros.tempoReal === 'true'
    || filtros.endpoint === 'proposta'
  ) {
    return consultarRadarPncpTempoReal(filtros);
  }

  const { prisma } = require('../database/prisma');

  const page = filtros.pagina ? Math.max(1, Number(filtros.pagina)) : 1;
  const size = filtros.tamanhoPagina ? Math.max(1, Number(filtros.tamanhoPagina)) : 20;
  const tenantRadarProfile = tenantId ? await getTenantRadarProfile(tenantId) : null;

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

  const searchTerms = getAutomaticSearchTerms(effectiveFilters, tenantRadarProfile);
  let avisoRadar: string | undefined;

  const and: any[] = [];

  if (buyerCnpjFilter) {
    and.push({
      OR: [
        { buyerDocument: { contains: buyerCnpjFilter, mode: 'insensitive' } },
        { externalId: { contains: buyerCnpjFilter, mode: 'insensitive' } },
      ],
    });
  }

  if (filtros.uf && filtros.uf.trim().toUpperCase() !== 'TODOS') {
    const ufVal = filtros.uf.trim().toUpperCase();
    and.push({
      OR: [
        { uf: { equals: ufVal, mode: 'insensitive' } },
        { uf: { contains: ufVal, mode: 'insensitive' } },
      ],
    });
  }

  if (filtros.srp === true || filtros.srp === 'true') {
    and.push({ srp: true });
  }

  const rawMod = filtros.modalidade ?? filtros.codigoModalidadeContratacao;
  if (rawMod && String(rawMod).trim().toLowerCase() !== 'todos') {
    const rawStr = String(rawMod).trim();
    const normalized = rawStr
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalized === 'srp' || normalized.includes('registro de precos')) {
      and.push({ srp: true });
    } else {
      let modTerm = rawStr;
      if (normalized.includes('pregao') || rawStr === '6') {
        modTerm = 'Pregão';
      } else if (normalized.includes('concorrencia') || rawStr === '4' || rawStr === '5' || rawStr === '7') {
        modTerm = 'Concorrência';
      } else if (normalized.includes('credenciamento') || rawStr === '12') {
        modTerm = 'Credenciamento';
      } else if (normalized.includes('dispensa') || rawStr === '8') {
        modTerm = 'Dispensa';
      } else if (normalized.includes('inexigibilidade') || rawStr === '9') {
        modTerm = 'Inexigibilidade';
      } else if (normalized.includes('leilao') || rawStr === '1') {
        modTerm = 'Leilão';
      } else if (normalized.includes('concurso') || rawStr === '2') {
        modTerm = 'Concurso';
      } else if (normalized.includes('dialogo') || rawStr === '14') {
        modTerm = 'Diálogo Competitivo';
      } else if (normalized.includes('pre-qualificacao') || normalized.includes('prequalificacao') || rawStr === '13') {
        modTerm = 'Pré-Qualificação';
      } else if (normalized.includes('pmi') || normalized.includes('manifestacao de interesse') || rawStr === '15') {
        modTerm = 'Manifestação de Interesse';
      } else if (normalized.includes('registro cadastral') || rawStr === '16') {
        modTerm = 'Registro Cadastral';
      }

      and.push({
        modality: { contains: modTerm, mode: 'insensitive' },
      });
    }
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
    if (filtros.dataInicial && filtros.dataInicial.length === 8) {
      const y = filtros.dataInicial.substring(0, 4);
      const m = filtros.dataInicial.substring(4, 6);
      const d = filtros.dataInicial.substring(6, 8);
      publishedAt.gte = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    }
    if (filtros.dataFinal && filtros.dataFinal.length === 8) {
      const y = filtros.dataFinal.substring(0, 4);
      const m = filtros.dataFinal.substring(4, 6);
      const d = filtros.dataFinal.substring(6, 8);
      publishedAt.lte = new Date(`${y}-${m}-${d}T23:59:59.999Z`);
    }
    if (Object.keys(publishedAt).length > 0) {
      and.push({ publishedAt });
    }
  }

  const where: any = and.length > 0 ? { AND: and } : {};

  let count = 0;
  let rows: any[] = [];

  if (typeof prisma.$transaction === 'function') {
    const res = await prisma.$transaction([
      prisma.procurementNotice.count({ where }),
      prisma.procurementNotice.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: { publishedAt: 'desc' },
      }),
    ]);
    count = typeof res?.[0] === 'number' ? res[0] : 0;
    rows = Array.isArray(res?.[1]) ? res[1] : [];
  } else {
    count = await prisma.procurementNotice.count({ where });
    rows = await prisma.procurementNotice.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { publishedAt: 'desc' },
    });
  }

  const companyProfile = tenantRadarProfile
    ? {
      cnaeKeywords: tenantRadarProfile.keywords,
      uf: tenantRadarProfile.uf,
      valorMin: undefined,
      valorMax: undefined,
    }
    : null;

  function calcularScoreItem(r: any, profile: typeof companyProfile) {
    if (!profile || profile.cnaeKeywords.length === 0) {
      let base = 70;
      if (r.estimatedValue) base += 10;
      if (r.openingAt) base += 5;
      return { pontuacao: Math.min(base, 95), nivel: base >= 75 ? 'alta' : 'media' };
    }

    const objLower = (r.object || '').toLowerCase();
    const matches = profile.cnaeKeywords.filter(kw => objLower.includes(kw));

    let scoreNicho = 15;
    if (matches.length >= 3) scoreNicho = 55;
    else if (matches.length === 2) scoreNicho = 45;
    else if (matches.length === 1) scoreNicho = 35;

    let scoreRegiao = 10;
    if (profile.uf && r.uf && profile.uf.toUpperCase() === r.uf.toUpperCase()) {
      scoreRegiao = 25;
    }

    let scoreValor = 15;
    const val = r.estimatedValue ? Number(r.estimatedValue) : 0;
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

  return {
    data: rows.map((r: any) => {
      const numControle = r.externalId || r.numeroControlePncp || r.noticeNumber || '';
      const downloadUrl = resolvePncpDownloadUrl(numControle, r.url, null) || r.url || '';
      const portalUrl = downloadUrl || r.url || '';
      const auditParams = extractPncpAuditParams(numControle, r.buyerDocument, null, null);
      const urlOficialPncp = auditParams?.urlOficialPncp || r.url || 'https://pncp.gov.br/app/editais';

      return {
        id: r.id,
        databaseId: r.id,
        numeroControlePNCP: numControle || r.id,
        orgao: r.buyerName || '',
        cnpjOrgao: r.buyerDocument || '',
        anoCompra: auditParams?.anoCompra,
        sequencialCompra: auditParams?.sequencialCompra,
        urlOficial: urlOficialPncp,
        urlOficialPncp,
        unidade: '',
        uf: r.uf || '',
        municipio: r.municipality || '',
        objeto: r.object || '',
        processo: r.noticeNumber || '',
        numeroCompra: r.noticeNumber || '',
        numeroEdital: r.noticeNumber || numControle || r.id,
        modalidade: r.modality || '',
        modalidadeId: null,
        modoDisputa: r.modoDisputa || '',
        criterioJulgamento: r.judgmentCriterion || (r.rawPayload as any)?.criterioJulgamentoNome || (r.rawPayload as any)?.tipoJulgamentoNome || null,
        situacao: r.status || '',
        valorEstimado: r.estimatedValue ? Number(r.estimatedValue) : null,
        valor_estimado: r.estimatedValue ? Number(r.estimatedValue) : null,
        dataPublicacao: safeFormatDate(r.publishedAt),
        data_publicacao: safeFormatDate(r.publishedAt),
        dataAbertura: safeFormatDate(r.openingAt),
        data_abertura: safeFormatDate(r.openingAt),
        dataEncerramento: safeFormatDate(r.closingAt),
        data_encerramento: safeFormatDate(r.closingAt),
        dataLimiteProposta: safeFormatDate(r.closingAt),
        dataSessaoDisputa: safeFormatDate(r.openingAt) || safeFormatDate(r.closingAt),
        link: portalUrl || urlOficialPncp,
        linkSistemaOrigem: portalUrl || urlOficialPncp,
        documento_url: downloadUrl,
        linkDownloadEdital: downloadUrl,
        srp: Boolean(r.srp),
        fonte: r.source || 'PNCP',
        score: calcularScoreItem(r, companyProfile),
      };
    }),
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
    aviso: avisoRadar,
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

  const resultados = await Promise.all(modalidades.map((modalidade) =>
    buscarContratacoesPNCP({
      codigoModalidadeContratacao: modalidade,
      dataInicial: filtros.dataInicial,
      dataFinal: filtros.dataFinal,
      uf: filtros.uf,
      ...(buyerCnpjForPncp ? { cnpj: buyerCnpjForPncp } : {}),
      palavraChave,
      pagina: filtros.pagina ?? 1,
      tamanhoPagina: filtros.tamanhoPagina ?? 50,
      endpoint: filtros.endpoint || 'publicacao',
    }),
  ));

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

      try {
        const upserted = await prisma.procurementNotice.upsert({
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
            url: normalizado.link,
            srp: Boolean(normalizado.srp),
            publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : new Date(),
            openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
            closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
          },
          update: {
            estimatedValue: normalizado.valorEstimado,
            status: normalizado.situacao || 'Publicada',
            url: normalizado.link,
            srp: Boolean(normalizado.srp),
            closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
          },
        });

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
    return {
      id: localNotice.id,
      databaseId: localNotice.id,
      numeroControlePNCP: localNotice.externalId || localNotice.noticeNumber || localNotice.id,
      orgao: localNotice.buyerName || '',
      cnpjOrgao: localNotice.buyerDocument || '',
      unidade: '',
      uf: localNotice.uf || '',
      municipio: localNotice.municipality || '',
      objeto: localNotice.object || '',
      processo: localNotice.noticeNumber || '',
      numeroCompra: localNotice.noticeNumber || '',
      modalidade: localNotice.modality || '',
      modalidadeId: null,
      modoDisputa: '',
      situacao: localNotice.status || '',
      valorEstimado: localNotice.estimatedValue ? Number(localNotice.estimatedValue) : null,
      valor_estimado: localNotice.estimatedValue ? Number(localNotice.estimatedValue) : null,
      dataPublicacao: localNotice.publishedAt ? localNotice.publishedAt.toISOString() : null,
      data_publicacao: localNotice.publishedAt ? localNotice.publishedAt.toISOString() : null,
      dataAbertura: localNotice.openingAt ? localNotice.openingAt.toISOString() : null,
      data_abertura: localNotice.openingAt ? localNotice.openingAt.toISOString() : null,
      dataEncerramento: localNotice.closingAt ? localNotice.closingAt.toISOString() : null,
      data_encerramento: localNotice.closingAt ? localNotice.closingAt.toISOString() : null,
      link: localNotice.url || '',
      fonte: localNotice.source || 'PNCP',
    };
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
        url: normalizado.link,
        publishedAt: normalizado.dataPublicacao ? new Date(normalizado.dataPublicacao) : null,
        openingAt: normalizado.dataAbertura ? new Date(normalizado.dataAbertura) : null,
        closingAt: normalizado.dataEncerramento ? new Date(normalizado.dataEncerramento) : null,
      },
      update: {
        estimatedValue: normalizado.valorEstimado,
        status: normalizado.situacao,
        url: normalizado.link,
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

  return normalizado;
}

export async function buscarLicitacaoPorNumeroControle(
  numeroControlePNCP: string,
  options?: BuscarLicitacaoOptions,
): Promise<LicitacaoRadarPNCP> {
  return buscarLicitacaoPorIdOuControle(numeroControlePNCP, options);
}
