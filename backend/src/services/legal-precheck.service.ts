import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import type { NoticesUserContext } from './notices-search.service';

const RULESET_VERSION = 'legal_precheck_v1.0.0';
const MAX_CHUNKS = 12;
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|email|ip|useragent|user_agent|ua|session|refresh)/i;

type RuleSeverity = 'low' | 'medium' | 'high';

interface LegalRuleDefinition {
  code: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  category: string;
  legalBasis: Record<string, unknown>;
  version: string;
  active: boolean;
  criteria: Record<string, unknown>;
  alertMessage: string;
  recommendation: string;
}

interface RuleMatch {
  rule: LegalRuleDefinition;
  explanation: string;
  evidence: Array<Record<string, unknown>>;
}

const DEFAULT_RULES: LegalRuleDefinition[] = [
  {
    code: 'short_deadline',
    name: 'Prazo curto para preparacao',
    description: 'Identifica quando a data de abertura ou encerramento esta muito proxima.',
    severity: 'medium',
    category: 'deadline',
    legalBasis: {
      references: ['Lei 14.133/2021 - planejamento, publicidade e competitividade'],
      note: 'Referencia geral para revisao operacional, sem conclusao juridica automatica.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: { type: 'deadline_days', thresholdDays: 3 },
    alertMessage: 'Ponto de atencao: prazo curto pode reduzir a margem operacional para preparar documentos e proposta.',
    recommendation: 'Recomendacao de revisao: conferir imediatamente prazos, documentos obrigatorios e viabilidade de participacao.',
  },
  {
    code: 'missing_estimated_value',
    name: 'Ausencia de valor estimado',
    description: 'Identifica editais sem valor estimado nos dados estruturados.',
    severity: 'medium',
    category: 'structured_data',
    legalBasis: {
      references: ['Lei 14.133/2021 - planejamento e transparencia da contratacao'],
      note: 'A ausencia em dados estruturados pode depender de validacao no inteiro teor.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: { type: 'field_missing', field: 'estimatedValue' },
    alertMessage: 'Ponto de atencao: valor estimado ausente nos dados estruturados.',
    recommendation: 'Recomendacao de revisao: verificar o edital completo e anexos antes de precificar.',
  },
  {
    code: 'unclear_object',
    name: 'Ausencia de objeto claro',
    description: 'Identifica objeto ausente, vazio ou excessivamente generico.',
    severity: 'medium',
    category: 'structured_data',
    legalBasis: {
      references: ['Lei 14.133/2021 - definicao do objeto e julgamento objetivo'],
      note: 'Regra preliminar baseada em clareza minima do objeto.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: { type: 'object_clarity', minLength: 20 },
    alertMessage: 'Possivel risco operacional: objeto ausente ou pouco claro nos dados analisados.',
    recommendation: 'Recomendacao de revisao: validar escopo, especificacoes e anexos antes de decidir participar.',
  },
  {
    code: 'missing_modality',
    name: 'Ausencia de modalidade',
    description: 'Identifica quando a modalidade nao esta disponivel nos dados estruturados.',
    severity: 'low',
    category: 'structured_data',
    legalBasis: {
      references: ['Lei 14.133/2021 - modalidades e rito de contratacao'],
      note: 'Ausencia em dados estruturados nao implica conclusao juridica.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: { type: 'field_missing', field: 'modality' },
    alertMessage: 'Ponto de atencao: modalidade ausente nos dados estruturados.',
    recommendation: 'Recomendacao de revisao: conferir a modalidade no edital completo e no portal de origem.',
  },
  {
    code: 'territorial_requirement',
    name: 'Exigencia territorial suspeita',
    description: 'Identifica mencoes que podem indicar exigencia de sede, filial ou estrutura local.',
    severity: 'high',
    category: 'restriction',
    legalBasis: {
      references: ['Lei 14.133/2021 - competitividade, isonomia e requisitos de habilitacao'],
      note: 'Apenas indicio para revisao; contexto e justificativa do edital devem ser avaliados.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: {
      type: 'text_pattern',
      patterns: [
        'sede no municipio',
        'sede local',
        'domicilio no municipio',
        'empresa estabelecida em',
        'comprovar escritorio',
        'filial no municipio',
        'instalada no municipio',
      ],
    },
    alertMessage: 'Possivel risco: indicio de exigencia territorial que pode restringir competidores.',
    recommendation: 'Recomendacao de revisao: avaliar se ha justificativa objetiva e proporcional para a exigencia.',
  },
  {
    code: 'specific_brand_reference',
    name: 'Mencao a marca especifica',
    description: 'Identifica mencoes a marca, fabricante ou modelo que merecem revisao.',
    severity: 'high',
    category: 'specification',
    legalBasis: {
      references: ['Lei 14.133/2021 - especificacao do objeto e padronizacao quando justificada'],
      note: 'Mencao a marca pode ter justificativas; esta regra apenas sinaliza revisao.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: {
      type: 'text_pattern',
      patterns: ['marca especifica', 'marca ', 'fabricante ', 'modelo ', 'dell', 'hp', 'lenovo', 'apple', 'samsung'],
    },
    alertMessage: 'Possivel risco: indicio de mencao a marca, fabricante ou modelo especifico.',
    recommendation: 'Recomendacao de revisao: verificar se a especificacao aceita equivalentes ou apresenta justificativa tecnica.',
  },
  {
    code: 'excessive_generic_documents',
    name: 'Exigencia documental generica excessiva',
    description: 'Identifica expressoes amplas sobre documentos adicionais ou indeterminados.',
    severity: 'medium',
    category: 'documentation',
    legalBasis: {
      references: ['Lei 14.133/2021 - habilitacao e julgamento objetivo'],
      note: 'Regra preliminar para localizar excesso ou indefinicao documental.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: {
      type: 'text_pattern',
      patterns: [
        'quaisquer documentos',
        'todos os documentos que julgar necessario',
        'documentos complementares a qualquer tempo',
        'demais documentos necessarios',
        'documentacao adicional sem limitacao',
      ],
    },
    alertMessage: 'Ponto de atencao: exigencia documental aparenta ser ampla ou pouco delimitada.',
    recommendation: 'Recomendacao de revisao: conferir se os documentos exigidos sao objetivos, proporcionais e previamente definidos.',
  },
  {
    code: 'missing_objective_criteria',
    name: 'Ausencia de criterios objetivos',
    description: 'Identifica quando os chunks nao mencionam criterio de julgamento objetivo conhecido.',
    severity: 'medium',
    category: 'judgment',
    legalBasis: {
      references: ['Lei 14.133/2021 - julgamento objetivo'],
      note: 'Pode ser ausencia nos chunks analisados, nao no edital completo.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: {
      type: 'missing_text_pattern',
      patterns: ['criterio de julgamento', 'menor preco', 'maior desconto', 'tecnica e preco', 'melhor tecnica', 'maior retorno economico'],
    },
    alertMessage: 'Ponto de atencao: criterio objetivo de julgamento nao foi localizado nos textos analisados.',
    recommendation: 'Recomendacao de revisao: localizar no edital o criterio de julgamento e os parametros de classificacao.',
  },
  {
    code: 'low_documental_completeness',
    name: 'Baixa completude documental',
    description: 'Identifica baixa completude dos dados e chunks para uma revisao preliminar confiavel.',
    severity: 'low',
    category: 'data_quality',
    legalBasis: {
      references: ['Boas praticas de auditoria e rastreabilidade documental'],
      note: 'Regra de qualidade da base analisada, sem conclusao sobre o edital.',
    },
    version: RULESET_VERSION,
    active: true,
    criteria: { type: 'completeness_below', threshold: 70 },
    alertMessage: 'Ponto de atencao: base documental analisada esta incompleta.',
    recommendation: 'Recomendacao de revisao: obter o edital integral e anexos antes de concluir a analise.',
  },
];

export class LegalPrecheckService {
  constructor(
    private readonly client: any = prisma as any,
  ) {}

  async analyzeNotice(noticeId: string, context: NoticesUserContext = {}) {
    const id = requiredId(noticeId);

    try {
      const notice = await this.client.procurementNotice.findFirst({
        where: {
          AND: [
            tenantVisibilityWhere(context.tenantId),
            { id },
          ],
        },
        select: noticeSelect(),
      });

      if (!notice) {
        await this.auditLegalPrecheck('legal_precheck_notice_not_found', 'failure', context, {
          reason: 'notice_not_found',
        }, id);
        return null;
      }

      const chunks = await this.client.documentChunk.findMany({
        where: {
          AND: [
            tenantVisibilityWhere(context.tenantId),
            {
              sourceType: 'procurement_notice',
              sourceId: id,
            },
          ],
        },
        orderBy: { chunkIndex: 'asc' },
        take: MAX_CHUNKS,
        select: {
          id: true,
          tenantId: true,
          sourceType: true,
          sourceId: true,
          chunkIndex: true,
          content: true,
          tokenCount: true,
          metadata: true,
          createdAt: true,
        },
      });

      const ruleset = await this.loadActiveRules(context.tenantId);
      const analysis = buildLegalPrecheck(notice, chunks, ruleset.rules, ruleset.source);

      await this.auditLegalPrecheck('legal_precheck_viewed', 'success', context, {
        source: notice.source,
        alerts: analysis.alerts.map((alert: any) => alert.ruleCode),
        severity: analysis.severity,
        rulesetVersion: analysis.ruleset.version,
        rulesApplied: analysis.ruleset.rulesApplied,
      }, id);

      return analysis;
    } catch (error: any) {
      await this.auditLegalPrecheck('legal_precheck_failed', 'failure', context, {
        reason: safeString(error?.message, 300) ?? 'legal_precheck_failed',
      }, id);
      throw error;
    }
  }

  private async loadActiveRules(tenantId?: string | null): Promise<{ rules: LegalRuleDefinition[]; source: string }> {
    if (!this.client.legalRule?.findMany) return { rules: DEFAULT_RULES, source: 'default' };

    try {
      const normalizedTenantId = normalizeNullableString(tenantId, 120);
      const rows = await this.client.legalRule.findMany({
        where: normalizedTenantId
          ? { active: true, workflowStatus: 'active', OR: [{ tenantId: null }, { tenantId: normalizedTenantId }] }
          : { active: true, workflowStatus: 'active', tenantId: null },
        orderBy: [{ category: 'asc' }, { code: 'asc' }, { version: 'desc' }],
      });
      const rules = rows.map(mapPersistedRule).filter(Boolean) as LegalRuleDefinition[];
      return rules.length ? { rules, source: 'database' } : { rules: DEFAULT_RULES, source: 'default' };
    } catch {
      return { rules: DEFAULT_RULES, source: 'default' };
    }
  }

  private async auditLegalPrecheck(
    action: string,
    outcome: string,
    context: NoticesUserContext,
    metadata: Record<string, unknown>,
    noticeId: string,
  ) {
    if (this.client.auditEvent) {
      await this.client.auditEvent.create({
      data: {
        userId: normalizeNullableString(context.user?.id, 80),
        scope: 'legal_precheck',
        action,
        outcome,
        entityType: 'procurement_notice',
        entityId: normalizeNullableString(noticeId, 120),
        requestId: normalizeHeader(context.requestId),
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: normalizeHeader(context.userAgent) ? hashAuditValue(normalizeHeader(context.userAgent) as string) : null,
        emailHash: context.user?.email ? hashAuditValue(context.user.email) : null,
        metadata: sanitizeMetadataObject({
          actorRole: context.user?.role ?? null,
          tenantId: normalizeNullableString(context.tenantId, 120),
          ...metadata,
        }) as any,
      }
    });
    }
  }
}

function buildLegalPrecheck(notice: any, chunks: any[], rules: LegalRuleDefinition[], rulesSource: string) {
  const activeRules = rules.filter((rule) => rule.active);
  const combinedText = buildCombinedText(notice, chunks);
  const completeness = calculateCompleteness(notice, chunks);
  const context = { combinedText, normalizedText: normalizeText(combinedText), completeness };
  const matches = activeRules
    .map((rule) => applyRule(rule, notice, chunks, context))
    .filter(Boolean) as RuleMatch[];

  return {
    notice: mapNoticeReference(notice),
    ruleset: {
      version: resolveRulesetVersion(activeRules),
      source: rulesSource,
      rulesApplied: activeRules.length,
    },
    appliedRules: activeRules.map(mapRuleForResponse),
    alerts: matches.map(mapAlert),
    severity: aggregateSeverity(matches.map((match) => match.rule.severity)),
    limitations: [
      'Analise preliminar por regras deterministicas e textos disponiveis.',
      'Resultado depende da qualidade dos campos estruturados e dos chunks existentes.',
      'Nao substitui revisao juridica humana nem leitura integral do edital e anexos.',
      'Nao gera impugnacao, recurso ou conclusao definitiva.',
    ],
    generatedAt: new Date().toISOString(),
  };
}

function applyRule(
  rule: LegalRuleDefinition,
  notice: any,
  chunks: any[],
  context: { combinedText: string; normalizedText: string; completeness: ReturnType<typeof calculateCompleteness> },
): RuleMatch | null {
  const criteria = rule.criteria ?? {};
  const type = safeString(criteria.type, 80);

  if (type === 'deadline_days') {
    const thresholdDays = numberValue(criteria.thresholdDays) ?? 3;
    const deadline = nearestDeadline(notice);
    if (!deadline || deadline.daysRemaining < 0 || deadline.daysRemaining > thresholdDays) return null;
    return {
      rule,
      explanation: `Possivel risco operacional: prazo restante de ${deadline.daysRemaining} dia(s) ate ${deadline.date}.`,
      evidence: [{ type: 'structured_field', field: 'openingAt/closingAt', value: deadline.date, daysRemaining: deadline.daysRemaining }],
    };
  }

  if (type === 'field_missing') {
    const field = safeString(criteria.field, 80);
    if (!field || hasFieldValue(notice, field)) return null;
    return {
      rule,
      explanation: `Ponto de atencao: campo estruturado ${field} ausente ou vazio.`,
      evidence: [{ type: 'structured_field', field, value: null }],
    };
  }

  if (type === 'object_clarity') {
    const minLength = numberValue(criteria.minLength) ?? 20;
    const object = safeString(notice.object, 2000) ?? '';
    if (object.length >= minLength && !isGenericObject(object)) return null;
    return {
      rule,
      explanation: 'Ponto de atencao: objeto ausente, curto ou generico para uma avaliacao preliminar segura.',
      evidence: [{ type: 'structured_field', field: 'object', excerpt: object.slice(0, 300) || null }],
    };
  }

  if (type === 'text_pattern') {
    const patterns = stringArray(criteria.patterns);
    const evidence = findTextEvidence(chunks, patterns);
    if (!evidence.length && !patterns.some((pattern) => context.normalizedText.includes(normalizeText(pattern)))) return null;
    return {
      rule,
      explanation: 'Indicio localizado por padrao textual em campos ou chunks analisados.',
      evidence,
    };
  }

  if (type === 'missing_text_pattern') {
    const patterns = stringArray(criteria.patterns);
    const found = patterns.some((pattern) => context.normalizedText.includes(normalizeText(pattern)));
    if (found) return null;
    return {
      rule,
      explanation: 'Ponto de atencao: os termos esperados nao foram localizados nos textos analisados.',
      evidence: chunks.length
        ? [{ type: 'text_absence', searchedPatterns: patterns.slice(0, 10), chunksAnalyzed: chunks.length }]
        : [{ type: 'text_absence', searchedPatterns: patterns.slice(0, 10), chunksAnalyzed: 0 }],
    };
  }

  if (type === 'completeness_below') {
    const threshold = numberValue(criteria.threshold) ?? 70;
    if (context.completeness.score >= threshold) return null;
    return {
      rule,
      explanation: `Ponto de atencao: completude ${context.completeness.score}/100 abaixo do limite ${threshold}.`,
      evidence: [{ type: 'completeness', score: context.completeness.score, missingFields: context.completeness.missingFields }],
    };
  }

  return null;
}

function mapAlert(match: RuleMatch) {
  return {
    ruleCode: match.rule.code,
    ruleName: match.rule.name,
    severity: match.rule.severity,
    category: match.rule.category,
    message: match.rule.alertMessage,
    explanation: match.explanation,
    recommendation: match.rule.recommendation,
    legalBasis: sanitizeMetadata(match.rule.legalBasis),
    evidence: match.evidence.map((item) => sanitizeMetadata(item)),
    version: match.rule.version,
  };
}

function mapRuleForResponse(rule: LegalRuleDefinition) {
  return {
    code: rule.code,
    name: rule.name,
    description: rule.description,
    severity: rule.severity,
    category: rule.category,
    legalBasis: sanitizeMetadata(rule.legalBasis),
    version: rule.version,
    active: rule.active,
    criteria: sanitizeMetadata(rule.criteria),
    alertMessage: rule.alertMessage,
    recommendation: rule.recommendation,
  };
}

function mapPersistedRule(row: any): LegalRuleDefinition | null {
  const code = safeString(row.code, 120);
  const name = safeString(row.name, 200);
  const description = safeString(row.description, 1000);
  const severity = normalizeSeverity(row.severity);
  const category = safeString(row.category, 120);
  const version = safeString(row.version, 80);
  const alertMessage = safeString(row.alertMessage, 1000);
  const recommendation = safeString(row.recommendation, 1000);
  const workflowStatus = safeString(row.workflowStatus, 40);
  if (!code || !name || !description || !severity || !category || !version || !alertMessage || !recommendation) return null;

  return {
    code,
    name,
    description,
    severity,
    category,
    legalBasis: isPlainObject(row.legalBasis) ? row.legalBasis : {},
    version,
    active: row.active !== false && (!workflowStatus || workflowStatus === 'active'),
    criteria: isPlainObject(row.criteria) ? row.criteria : {},
    alertMessage,
    recommendation,
  };
}

function noticeSelect() {
  return {
    id: true,
    tenantId: true,
    source: true,
    externalId: true,
    noticeNumber: true,
    modality: true,
    buyerName: true,
    buyerDocument: true,
    object: true,
    uf: true,
    municipality: true,
    estimatedValue: true,
    status: true,
    url: true,
    publishedAt: true,
    openingAt: true,
    closingAt: true,
    rawPayload: true,
    createdAt: true,
    updatedAt: true,
  };
}

function mapNoticeReference(notice: any) {
  return {
    id: notice.id,
    externalId: notice.externalId ?? null,
    noticeNumber: notice.noticeNumber ?? null,
    source: notice.source,
    agency: notice.buyerName ?? null,
    uf: notice.uf ?? null,
    municipality: notice.municipality ?? null,
    modality: notice.modality ?? null,
    status: notice.status ?? null,
    object: safeString(notice.object, 2000) ?? null,
    estimatedValue: decimalToNumber(notice.estimatedValue),
    url: notice.url ?? null,
    importantDates: {
      publishedAt: toIso(notice.publishedAt),
      openingAt: toIso(notice.openingAt),
      closingAt: toIso(notice.closingAt),
    },
  };
}

function buildCombinedText(notice: any, chunks: any[]) {
  return [
    notice.noticeNumber,
    notice.source,
    notice.buyerName,
    notice.object,
    notice.uf,
    notice.municipality,
    notice.modality,
    notice.status,
    ...chunks.map((chunk) => chunk.content),
    ...extractRawPayloadText(notice.rawPayload),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .slice(0, 60000);
}

function extractRawPayloadText(value: unknown, depth = 0): string[] {
  if (value === null || value === undefined || depth > 3) return [];
  if (Array.isArray(value)) return value.slice(0, 30).flatMap((item) => extractRawPayloadText(item, depth + 1));
  if (typeof value === 'string') return [value.slice(0, 1000)];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>)
    .filter(([key, entryValue]) => !SENSITIVE_KEY_PATTERN.test(key) && entryValue !== undefined)
    .slice(0, 50)
    .flatMap(([, entryValue]) => extractRawPayloadText(entryValue, depth + 1));
}

function findTextEvidence(chunks: any[], patterns: string[]) {
  const evidence: Array<Record<string, unknown>> = [];

  for (const chunk of chunks) {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    const normalizedContent = normalizeText(content);
    const matchedPattern = patterns.find((pattern) => normalizedContent.includes(normalizeText(pattern)));
    if (!matchedPattern) continue;

    evidence.push({
      type: 'chunk_text',
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      matchedPattern,
      excerpt: excerptAround(content, matchedPattern),
      metadata: sanitizeMetadata(chunk.metadata),
    });
    if (evidence.length >= 3) break;
  }

  return evidence;
}

function excerptAround(content: string, pattern: string) {
  const normalizedContent = normalizeText(content);
  const normalizedPattern = normalizeText(pattern);
  const index = normalizedContent.indexOf(normalizedPattern);
  if (index < 0) return content.slice(0, 500);
  const start = Math.max(0, index - 180);
  const end = Math.min(content.length, index + normalizedPattern.length + 220);
  return content.slice(start, end);
}

function nearestDeadline(notice: any) {
  const candidates = [notice.closingAt, notice.openingAt]
    .map((value) => {
      const iso = toIso(value);
      if (!iso) return null;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    })
    .filter(Boolean) as Date[];

  if (!candidates.length) return null;

  const now = Date.now();
  const closest = candidates.sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    date: closest.toISOString(),
    daysRemaining: Math.ceil((closest.getTime() - now) / 86400000),
  };
}

function calculateCompleteness(notice: any, chunks: any[]) {
  const fields = [
    { key: 'source', weight: 8, present: Boolean(safeString(notice.source, 80)) },
    { key: 'agency', weight: 12, present: Boolean(safeString(notice.buyerName, 160)) },
    { key: 'uf', weight: 7, present: Boolean(safeString(notice.uf, 2)) },
    { key: 'municipality', weight: 7, present: Boolean(safeString(notice.municipality, 120)) },
    { key: 'modality', weight: 10, present: Boolean(safeString(notice.modality, 120)) },
    { key: 'status', weight: 6, present: Boolean(safeString(notice.status, 80)) },
    { key: 'object', weight: 16, present: Boolean(safeString(notice.object, 2000)) },
    { key: 'estimatedValue', weight: 10, present: decimalToNumber(notice.estimatedValue) !== null },
    { key: 'publishedAt', weight: 6, present: Boolean(toIso(notice.publishedAt)) },
    { key: 'deadline', weight: 8, present: Boolean(toIso(notice.openingAt) || toIso(notice.closingAt)) },
    { key: 'chunks', weight: 10, present: chunks.length > 0 },
  ];
  const score = fields.reduce((total, field) => total + (field.present ? field.weight : 0), 0);

  return {
    score,
    missingFields: fields.filter((field) => !field.present).map((field) => field.key),
  };
}

function hasFieldValue(notice: any, field: string) {
  if (field === 'estimatedValue') return decimalToNumber(notice.estimatedValue) !== null;
  if (field === 'modality') return Boolean(safeString(notice.modality, 120));
  if (field === 'object') return Boolean(safeString(notice.object, 2000));
  return notice[field] !== null && notice[field] !== undefined && notice[field] !== '';
}

function isGenericObject(value: string) {
  const normalized = normalizeText(value).trim();
  return ['contratacao', 'aquisicao', 'servicos', 'fornecimento'].includes(normalized);
}

function resolveRulesetVersion(rules: LegalRuleDefinition[]) {
  const versions = [...new Set(rules.map((rule) => rule.version).filter(Boolean))];
  return versions.length === 1 ? versions[0] : versions.join(',');
}

function aggregateSeverity(severities: RuleSeverity[]) {
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  if (severities.includes('low')) return 'low';
  return 'none';
}

function tenantVisibilityWhere(tenantId?: string | null) {
  const normalizedTenantId = normalizeNullableString(tenantId, 120);
  if (!normalizedTenantId) return { tenantId: null };
  return { OR: [{ tenantId: null }, { tenantId: normalizedTenantId }] };
}

function requiredId(value: unknown) {
  const normalized = safeString(value, 120);
  if (!normalized) throw new Error('id do edital e obrigatorio.');
  return normalized;
}

function safeString(value: unknown, max = 120) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function normalizeNullableString(value: unknown, max = 120) {
  return safeString(value, max) ?? null;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => safeString(item, 200)).filter(Boolean) as string[]
    : [];
}

function normalizeSeverity(value: unknown): RuleSeverity | null {
  const normalized = safeString(value, 20);
  return normalized === 'low' || normalized === 'medium' || normalized === 'high' ? normalized : null;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.slice(0, 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value).slice(0, 1000);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .slice(0, 80)
      .map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeMetadata(entryValue, depth + 1),
      ]),
  );
}

function sanitizeMetadataObject(value: Record<string, unknown>) {
  const sanitized = sanitizeMetadata(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {};
  return sanitized as Record<string, unknown>;
}

function normalizeHeader(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function hashAuditValue(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
