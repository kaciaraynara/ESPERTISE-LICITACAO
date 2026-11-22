export type RadarObjectType = 'BENS' | 'SERVICOS' | 'OBRAS';
export type RadarSortOrder = 'recentes' | 'encerramento' | 'maior_valor' | 'menor_valor' | 'relevancia';

export interface RadarSqlQueryInput {
  ufs?: string[];
  uf?: string;
  q?: string;
  palavras?: string[];
  orgao?: string;
  fonte?: string;
  apenasAbertos?: boolean;
  baixaProcura?: boolean;
  srp?: boolean;
  modalidade?: string | number;
  dataPublicacao?: string;
  dataInicial?: string;
  dataFinal?: string;
  valorMin?: number;
  valorMax?: number;
  buyerCnpjFilter?: string;
  tipoObjeto?: string;
  incluirSemClassificacao?: boolean;
  ordenarPor?: RadarSortOrder;
  profileKeywords?: string[];
  profileUfs?: string[];
}

export interface BuiltRadarSqlQuery {
  baseWhereSql: string;
  baseParams: unknown[];
  fullWhereSql: string;
  orderBySql: string;
  listParams: unknown[];
  hasObjectTypeFilter: boolean;
  selectedObjectTypes: RadarObjectType[];
  includeUnclassified: boolean;
}

const VALID_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export function parseUfs(ufRaw?: string | string[]): string[] {
  const parts = Array.isArray(ufRaw)
    ? ufRaw
    : typeof ufRaw === 'string'
      ? ufRaw.split(/[,;\s]+/)
      : [];

  const seen = new Set<string>();
  for (const item of parts) {
    const clean = String(item || '').trim().toUpperCase();
    if (!clean || clean === 'TODOS' || clean === 'TODAS' || clean === 'BR') continue;
    if (VALID_UFS.has(clean)) {
      seen.add(clean);
    }
  }
  return Array.from(seen);
}

export function parsePalavras(raw?: string | string[]): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;]+/)
      : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const clean = String(item || '').trim();
    if (!clean || clean.length < 2) continue;
    const key = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
    if (result.length >= 20) break;
  }
  return result;
}

export function parseTipoObjeto(raw?: string | string[]): RadarObjectType[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;\s]+/)
      : [];

  const seen = new Set<RadarObjectType>();
  for (const item of items) {
    const norm = String(item || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
    if (!norm || norm === 'TODOS' || norm === 'TODAS') continue;
    if (norm === 'BENS' || norm === 'BEM') seen.add('BENS');
    else if (norm === 'SERVICOS' || norm === 'SERVICO') seen.add('SERVICOS');
    else if (norm === 'OBRAS' || norm === 'OBRA') seen.add('OBRAS');
  }
  return Array.from(seen);
}

export function normalizeSourceValues(fonte?: string): string[] | null {
  const raw = String(fonte || '').trim();
  if (!raw) return null;
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!norm || norm === 'todas' || norm === 'todos') return null;
  if (norm === 'pncp') return ['PNCP', 'pncp'];
  if (norm === 'comprasgov' || norm === 'compras_gov' || norm === 'compras.gov.br') {
    return ['ComprasGov', 'compras_gov', 'comprasgov'];
  }
  if (norm === 'querido_diario' || norm === 'queridodiario' || norm === 'diario_oficial' || norm === 'diarios_oficiais') {
    return ['querido_diario', 'QueridoDiario', 'QUERIDO_DIARIO'];
  }
  if (norm === 'portal_transparencia' || norm === 'transparencia') {
    return ['portal_transparencia', 'PortalTransparencia', 'TRANSPARENCIA'];
  }
  return [raw];
}

export function normalizeModalityFilter(rawMod?: string | number): { isSrp: boolean; term: string | null } {
  if (rawMod === undefined || rawMod === null) {
    return { isSrp: false, term: null };
  }
  const rawStr = String(rawMod).trim();
  if (!rawStr) return { isSrp: false, term: null };

  const normalized = rawStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized === 'todos' || normalized === 'todas') {
    return { isSrp: false, term: null };
  }
  if (normalized === 'srp' || normalized.includes('registro de precos')) {
    return { isSrp: true, term: null };
  }
  if (normalized.includes('pregao') || rawStr === '6') {
    return { isSrp: false, term: 'Pregão' };
  }
  if (normalized.includes('concorrencia') || rawStr === '4' || rawStr === '5' || rawStr === '7') {
    return { isSrp: false, term: 'Concorrência' };
  }
  if (normalized.includes('credenciamento') || rawStr === '12') {
    return { isSrp: false, term: 'Credenciamento' };
  }
  if (normalized.includes('dispensa') || rawStr === '8') {
    return { isSrp: false, term: 'Dispensa' };
  }
  if (normalized.includes('inexigibilidade') || rawStr === '9') {
    return { isSrp: false, term: 'Inexigibilidade' };
  }
  if (normalized.includes('leilao') || rawStr === '1') {
    return { isSrp: false, term: 'Leilão' };
  }
  if (normalized.includes('concurso') || rawStr === '2') {
    return { isSrp: false, term: 'Concurso' };
  }
  if (normalized.includes('dialogo') || rawStr === '14') {
    return { isSrp: false, term: 'Diálogo Competitivo' };
  }
  if (normalized.includes('pre-qualificacao') || normalized.includes('prequalificacao') || rawStr === '13') {
    return { isSrp: false, term: 'Pré-Qualificação' };
  }
  if (normalized.includes('pmi') || normalized.includes('manifestacao de interesse') || rawStr === '15') {
    return { isSrp: false, term: 'Manifestação de Interesse' };
  }
  if (normalized.includes('registro cadastral') || rawStr === '16') {
    return { isSrp: false, term: 'Registro Cadastral' };
  }

  return { isSrp: false, term: rawStr };
}

export function parseDateBoundary(raw?: string, endOfDay = false): Date | null {
  const clean = String(raw || '').trim();
  if (!clean) return null;
  const isoDate = /^\d{8}$/.test(clean)
    ? `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
    : clean.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const dt = new Date(`${isoDate}${suffix}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function buildRadarSqlQuery(input: RadarSqlQueryInput): BuiltRadarSqlQuery {
  const params: unknown[] = [];
  const addParam = (val: unknown): string => {
    params.push(val);
    return `$${params.length}`;
  };

  const baseConditions: string[] = [];

  if (input.buyerCnpjFilter && input.buyerCnpjFilter.trim()) {
    const pLike = addParam(`%${input.buyerCnpjFilter.trim()}%`);
    baseConditions.push(`(buyer_document ILIKE ${pLike} OR external_id ILIKE ${pLike})`);
  }

  const ufs = Array.from(new Set([
    ...parseUfs(input.ufs),
    ...parseUfs(input.uf),
  ]));
  if (ufs.length > 0) {
    const pUf = addParam(ufs);
    baseConditions.push(`uf = ANY(${pUf}::text[])`);
  }

  const sources = normalizeSourceValues(input.fonte);
  if (sources && sources.length > 0) {
    const pSrc = addParam(sources);
    baseConditions.push(`source = ANY(${pSrc}::text[])`);
  }

  if (input.apenasAbertos === true) {
    baseConditions.push(
      `NOT (COALESCE(status, '') ~* '(suspens|revogad|anulad|cancelad|encerrad|desert|fracassad|homologad)')`,
    );
    baseConditions.push(
      `(closing_at > NOW() OR (source = 'querido_diario' AND closing_at IS NULL AND published_at >= NOW() - INTERVAL '15 days') OR (modality ILIKE '%Credenciamento%' AND closing_at IS NULL AND published_at >= NOW() - INTERVAL '60 days'))`,
    );
  }

  if (input.baixaProcura === true) {
    baseConditions.push(
      `((estimated_value > 0 AND estimated_value <= 80000) OR (estimated_value IS NULL AND (modality ILIKE '%Dispensa%' OR modality ILIKE '%Credenciamento%')))`,
    );
    baseConditions.push(`COALESCE(object_type, '') <> 'OBRAS'`);
    baseConditions.push(`object NOT ILIKE '%obra de engenharia%'`);
    baseConditions.push(`object NOT ILIKE '%concessão%'`);
    baseConditions.push(`object NOT ILIKE '%parceria público-privada%'`);
  }

  if (typeof input.valorMin === 'number' && Number.isFinite(input.valorMin) && input.valorMin > 0) {
    baseConditions.push(`estimated_value >= ${addParam(input.valorMin)}`);
  }
  if (typeof input.valorMax === 'number' && Number.isFinite(input.valorMax) && input.valorMax > 0) {
    baseConditions.push(`estimated_value <= ${addParam(input.valorMax)}`);
  }

  if (input.orgao && input.orgao.trim()) {
    baseConditions.push(`buyer_name ILIKE ${addParam(`%${input.orgao.trim()}%`)}`);
  }

  const pubDt = parseDateBoundary(input.dataPublicacao, false);
  if (pubDt) {
    baseConditions.push(`published_at >= ${addParam(pubDt.toISOString())}::timestamptz`);
  }
  const iniDt = parseDateBoundary(input.dataInicial, false);
  if (iniDt) {
    baseConditions.push(`published_at >= ${addParam(iniDt.toISOString())}::timestamptz`);
  }
  const fimDt = parseDateBoundary(input.dataFinal, true);
  if (fimDt) {
    baseConditions.push(`published_at <= ${addParam(fimDt.toISOString())}::timestamptz`);
  }

  const modFilter = normalizeModalityFilter(input.modalidade);
  if (input.srp === true || modFilter.isSrp) {
    baseConditions.push(`srp = true`);
  } else if (modFilter.term) {
    baseConditions.push(`modality ILIKE ${addParam(`%${modFilter.term}%`)}`);
  }

  let qTsQueryExpr: string | null = null;
  const qTrim = String(input.q || '').trim();
  if (qTrim) {
    const pQ = addParam(qTrim);
    qTsQueryExpr = `plainto_tsquery('portuguese', public.immutable_unaccent(${pQ}))`;
    const isCodeOrCnpj = /\d{2,}[\/.-]\d{2,}|\d{8,}/.test(qTrim);
    if (isCodeOrCnpj) {
      const pLike = addParam(`%${qTrim}%`);
      const digits = qTrim.replace(/\D/g, '');
      const docExpr = digits.length >= 8 ? ` OR buyer_document ILIKE ${addParam(`%${digits}%`)}` : '';
      baseConditions.push(
        `(notice_number ILIKE ${pLike} OR external_id ILIKE ${pLike}${docExpr} OR search_vector @@ ${qTsQueryExpr})`,
      );
    } else {
      baseConditions.push(`search_vector @@ ${qTsQueryExpr}`);
    }
  }

  let palavrasTsQueryExpr: string | null = null;
  const palavras = parsePalavras(input.palavras);
  if (palavras.length > 0) {
    const tsParts = palavras.map((term) => {
      const pT = addParam(term);
      return `plainto_tsquery('portuguese', public.immutable_unaccent(${pT}))`;
    });
    palavrasTsQueryExpr = tsParts.length === 1 ? tsParts[0] : `(${tsParts.join(' || ')})`;
    baseConditions.push(`search_vector @@ ${palavrasTsQueryExpr}`);
  }

  const baseWhereSql = baseConditions.length > 0 ? baseConditions.join(' AND ') : 'TRUE';
  const baseParams = params.slice();

  const fullConditions = [...baseConditions];
  const selectedObjectTypes = parseTipoObjeto(input.tipoObjeto);
  const hasObjectTypeFilter = selectedObjectTypes.length > 0;
  const includeUnclassified = input.incluirSemClassificacao === true;

  if (hasObjectTypeFilter) {
    const pTypes = addParam(selectedObjectTypes);
    if (includeUnclassified) {
      fullConditions.push(`(object_type = ANY(${pTypes}::text[]) OR object_type IS NULL)`);
    } else {
      fullConditions.push(`object_type = ANY(${pTypes}::text[])`);
    }
  }

  const fullWhereSql = fullConditions.length > 0 ? fullConditions.join(' AND ') : 'TRUE';

  const sortMode: RadarSortOrder = input.ordenarPor || 'recentes';
  let orderBySql = 'published_at DESC NULLS LAST, id DESC';

  if (sortMode === 'encerramento') {
    orderBySql =
      'CASE WHEN closing_at > NOW() THEN 0 ELSE 1 END ASC, closing_at ASC NULLS LAST, published_at DESC NULLS LAST, id DESC';
  } else if (sortMode === 'maior_valor') {
    orderBySql = 'estimated_value DESC NULLS LAST, published_at DESC NULLS LAST, id DESC';
  } else if (sortMode === 'menor_valor') {
    orderBySql =
      'CASE WHEN estimated_value > 0 THEN 0 ELSE 1 END ASC, estimated_value ASC NULLS LAST, published_at DESC NULLS LAST, id DESC';
  } else if (sortMode === 'relevancia') {
    let rankTsExpr: string | null = qTsQueryExpr || palavrasTsQueryExpr;
    if (!rankTsExpr && Array.isArray(input.profileKeywords) && input.profileKeywords.length > 0) {
      const kws = parsePalavras(input.profileKeywords).slice(0, 8);
      if (kws.length > 0) {
        const kwParts = kws.map(
          (kw) => `plainto_tsquery('portuguese', public.immutable_unaccent(${addParam(kw)}))`,
        );
        rankTsExpr = kwParts.length === 1 ? kwParts[0] : `(${kwParts.join(' || ')})`;
      }
    }

    const profUfs = parseUfs(input.profileUfs);
    const rankTerms: string[] = [];
    if (rankTsExpr) {
      rankTerms.push(`ts_rank_cd(search_vector, ${rankTsExpr}) * 50`);
    }
    if (profUfs.length > 0) {
      rankTerms.push(`CASE WHEN uf = ANY(${addParam(profUfs)}::text[]) THEN 20 ELSE 0 END`);
    }
    rankTerms.push(
      `CASE WHEN published_at >= NOW() - INTERVAL '3 days' THEN 10 WHEN published_at >= NOW() - INTERVAL '7 days' THEN 5 ELSE 0 END`,
    );

    orderBySql = `(${rankTerms.join(' + ')}) DESC, published_at DESC NULLS LAST, id DESC`;
  }

  return {
    baseWhereSql,
    baseParams,
    fullWhereSql,
    orderBySql,
    listParams: params,
    hasObjectTypeFilter,
    selectedObjectTypes,
    includeUnclassified,
  };
}
