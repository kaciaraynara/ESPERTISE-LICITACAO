import { createHash } from 'crypto';
import type { DataEntityType, NormalizedDataRecord, RawDataRecord } from './types';
import { assertSafeDataSource } from './source-registry';

const TITLE_KEYS = [
  'title',
  'titulo',
  'objeto',
  'ementa',
  'razaoSocial',
  'razao_social',
  'nome',
  'name',
];

const TEXT_KEYS = [
  'bodyText',
  'body_text',
  'texto',
  'conteudo',
  'descricao',
  'description',
  'summary',
  'resumo',
  'ementa',
  'objeto',
  'decisionText',
  'decision_text',
];

const RISK_TERMS = [
  'marca exclusiva',
  'visita tecnica obrigatoria',
  'atestados excessivos',
  'prazo inexequivel',
  'restricao competitiva',
  'direcionamento',
  'sobrepreco',
  'inexequivel',
  'exigencia abusiva',
];

export class DataNormalizationService {
  normalize(record: RawDataRecord): NormalizedDataRecord {
    assertSafeDataSource(record.source);

    if (!record.payload || typeof record.payload !== 'object') {
      throw new Error('Payload invalido para normalizacao.');
    }

    const canonicalPayload = stableStringify(record.payload);
    const contentHash = sha256(canonicalPayload);
    const externalId = normalizeNullableString(record.externalId ?? readFirstString(record.payload, ['id', 'externalId', 'external_id', 'numeroControlePNCP']));
    const title = readFirstString(record.payload, TITLE_KEYS) ?? buildFallbackTitle(record.entityType, externalId);
    const text = buildText(record.payload, title);
    const dedupeKey = buildDedupeKey({
      tenantId: record.tenantId ?? null,
      source: record.source,
      entityType: record.entityType,
      externalId,
      contentHash,
    });

    return {
      tenantId: record.tenantId ?? null,
      source: record.source,
      entityType: record.entityType,
      externalId,
      dedupeKey,
      contentHash,
      title,
      text,
      fields: extractSearchableFields(record.entityType, record.payload),
      classification: classifyRecord(record.entityType, `${title}\n${text}`),
      metadata: {
        fetchedAt: record.fetchedAt,
        traceId: record.traceId ?? null,
        payloadHash: contentHash,
      },
      rawPayload: record.payload,
    };
  }
}

export function buildDedupeKey(input: {
  tenantId: string | null;
  source: string;
  entityType: DataEntityType;
  externalId: string | null;
  contentHash: string;
}) {
  const tenant = input.tenantId?.trim() || 'global';
  const identity = input.externalId?.trim()
    ? `${input.externalId.trim()}|${input.contentHash}`
    : input.contentHash;
  return sha256([tenant, input.source, input.entityType, identity].join('|'));
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function readFirstString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function buildText(payload: Record<string, unknown>, title: string) {
  const parts = new Set<string>();
  parts.add(title);

  for (const key of TEXT_KEYS) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) parts.add(value.trim());
  }

  return [...parts].join('\n\n').trim();
}

function buildFallbackTitle(entityType: DataEntityType, externalId: string | null) {
  return `${entityType}:${externalId ?? 'sem-identificador'}`;
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractSearchableFields(entityType: DataEntityType, payload: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    entityType,
    uf: readFirstString(payload, ['uf', 'ufSigla']),
    municipality: readFirstString(payload, ['municipio', 'municipality', 'municipioNome']),
    sourceDate: readFirstString(payload, ['dataPublicacao', 'publishedAt', 'decisionDate', 'data_abertura']),
  };

  if (entityType === 'procurement_notice') {
    base.modality = readFirstString(payload, ['modalidade', 'modalidadeNome', 'modality']);
    base.estimatedValue = payload.valorEstimado ?? payload.valorTotalEstimado ?? payload.estimatedValue ?? null;
    base.noticeNumber = readFirstString(payload, ['numero', 'numeroCompra', 'numeroControlePNCP', 'numero_controle_pncp']);
    base.buyerName = readFirstString(payload, ['orgao', 'buyerName', 'razaoSocialOrgao', 'orgaoRazaoSocial']);
    base.buyerDocument = readFirstString(payload, ['cnpjOrgao', 'buyerDocument', 'orgaoCnpj']);
    base.status = readFirstString(payload, ['situacao', 'situacaoCompraNome', 'status']);
    base.url = readFirstString(payload, ['link', 'linkSistemaOrigem', 'linkEditalPNCP', 'url']);
    base.openingAt = readFirstString(payload, ['dataAbertura', 'dataAberturaProposta', 'data_abertura']);
    base.closingAt = readFirstString(payload, ['dataEncerramento', 'dataEncerramentoProposta', 'data_encerramento']);
    base.publishedAt = readFirstString(payload, ['dataPublicacao', 'dataPublicacaoPncp', 'publishedAt']);
  }

  if (entityType === 'company' || entityType === 'supplier') {
    base.cnpj = readFirstString(payload, ['cnpj', 'documento', 'document']);
    base.mainCnae = readFirstString(payload, ['cnaePrincipal', 'cnae_principal', 'mainCnae']);
  }

  return Object.fromEntries(Object.entries(base).filter(([, value]) => value !== null && value !== undefined));
}

function classifyRecord(entityType: DataEntityType, text: string) {
  const lower = text.toLowerCase();
  const matchedRiskTerms = RISK_TERMS.filter((term) => lower.includes(term));
  const hasDeadlineSignal = /\bprazo\b|\bdata de abertura\b|\bencerramento\b/.test(lower);
  const hasLegalSignal = /\blei 14\.133\b|\btcu\b|\bimpugnacao\b|\brecurso\b/.test(lower);

  return {
    entityType,
    riskLevel: matchedRiskTerms.length >= 2 ? 'high' : matchedRiskTerms.length === 1 ? 'medium' : 'low',
    matchedRiskTerms,
    hasDeadlineSignal,
    hasLegalSignal,
    classificationVersion: 'data-platform-foundation-v1',
  };
}
