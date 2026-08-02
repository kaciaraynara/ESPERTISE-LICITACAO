import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import type { RbacActionContext } from './rbac.service';

interface PaginationInput {
  limit?: number;
  offset?: number;
}

interface ListLegalRulesInput extends PaginationInput {
  code?: string;
  category?: string;
  severity?: string;
  active?: boolean | string | null;
  workflowStatus?: string;
  version?: string;
}

interface LegalRuleMutationInput {
  code?: string;
  name?: string;
  description?: string;
  severity?: string;
  category?: string;
  legalBasis?: Record<string, unknown> | null;
  version?: string;
  active?: boolean | string | null;
  criteria?: Record<string, unknown> | null;
  alertMessage?: string;
  recommendation?: string;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
}

interface RejectLegalRuleInput {
  reason?: string;
}

export class LegalRuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegalRuleValidationError';
  }
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const VALID_SEVERITIES = new Set(['low', 'medium', 'high']);
const WORKFLOW_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REJECTED: 'rejected',
} as const;
const VALID_WORKFLOW_STATUSES = new Set<string>(Object.values(WORKFLOW_STATUS));
const DIFF_FIELDS = ['criteria', 'severity', 'alertMessage', 'recommendation', 'legalBasis', 'metadata'] as const;
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|cnpj|email|ip|useragent|user_agent|ua|session|refresh)/i;
const DANGEROUS_METADATA_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|cnpj|email|ip|useragent|user_agent|ua|session|refresh|__proto__|constructor|prototype)/i;

export class LegalRulesAdminService {
  constructor(
    private readonly client: any = prisma as any,
  ) {}

  async listRules(input: ListLegalRulesInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.legalRule.findMany({
      where: buildListWhere(input),
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      skip: pagination.offset,
      take: pagination.limit + 1,
    });

    return paginate(rows.map(mapRule), pagination);
  }

  async getRule(id: string) {
    const ruleId = requiredString(id, 'id', 120);
    const rule = await this.client.legalRule.findFirst({ where: { id: ruleId } });
    return rule ? mapRule(rule) : null;
  }

  async createRule(input: LegalRuleMutationInput, context: RbacActionContext = {}) {
    const payload = {
      ...validateCreateInput(input),
      active: false,
      workflowStatus: WORKFLOW_STATUS.DRAFT,
      createdById: normalizeNullableString(context.user?.id, 120),
    };
    const rule = await this.client.legalRule.create({ data: payload });

    await this.auditLegalRuleAction('legal_rule_created', 'success', context, {
      code: rule.code,
      version: rule.version,
      category: rule.category,
      severity: rule.severity,
      workflowStatus: rule.workflowStatus,
    }, rule.id);

    return mapRule(rule);
  }

  async updateRule(id: string, input: LegalRuleMutationInput, context: RbacActionContext = {}) {
    const ruleId = requiredString(id, 'id', 120);
    const existing = await this.client.legalRule.findFirst({ where: { id: ruleId } });
    if (!existing) throw new LegalRuleValidationError('Regra juridica nao encontrada.');
    assertEditableWorkflow(existing);

    const data = validateUpdateInput(input);
    if (!Object.keys(data).length) {
      throw new LegalRuleValidationError('Nenhum campo valido para atualizar.');
    }
    if (resolveWorkflowStatus(existing) === WORKFLOW_STATUS.REJECTED) {
      data.workflowStatus = WORKFLOW_STATUS.DRAFT;
      data.active = false;
    }

    const updated = await this.client.legalRule.update({
      where: { id: ruleId },
      data,
    });

    await this.auditLegalRuleAction('legal_rule_updated', 'success', context, {
      code: updated.code,
      version: updated.version,
      changedFields: Object.keys(data),
      workflowStatus: updated.workflowStatus,
    }, ruleId);

    return mapRule(updated);
  }

  async activateRule(id: string, context: RbacActionContext = {}) {
    return this.activateApprovedInternal(id, context, 'legal_rule_activated');
  }

  async deactivateRule(id: string, context: RbacActionContext = {}) {
    return this.setActive(id, false, 'legal_rule_deactivated', context);
  }

  async createNewVersion(id: string, input: LegalRuleMutationInput = {}, context: RbacActionContext = {}) {
    const ruleId = requiredString(id, 'id', 120);
    const existing = await this.client.legalRule.findFirst({ where: { id: ruleId } });
    if (!existing) throw new LegalRuleValidationError('Regra juridica nao encontrada.');

    const nextVersion = requiredString(input.version, 'version', 80);
    if (nextVersion === existing.version) {
      throw new LegalRuleValidationError('Nova versao deve ser diferente da versao anterior.');
    }

    const override = validateUpdateInput({ ...input, version: nextVersion });
    const created = await this.client.legalRule.create({
      data: {
        tenantId: existing.tenantId ?? null,
        createdById: normalizeNullableString(context.user?.id, 120),
        name: existing.name,
        description: existing.description,
        severity: existing.severity,
        category: existing.category,
        legalBasis: existing.legalBasis,
        criteria: existing.criteria,
        alertMessage: existing.alertMessage,
        recommendation: existing.recommendation,
        metadata: existing.metadata ?? undefined,
        ...override,
        code: existing.code,
        version: nextVersion,
        active: false,
        workflowStatus: WORKFLOW_STATUS.DRAFT,
      },
    });

    await this.auditLegalRuleAction('legal_rule_versioned', 'success', context, {
      code: existing.code,
      previousRuleId: existing.id,
      previousVersion: existing.version,
      newVersion: created.version,
      workflowStatus: created.workflowStatus,
    }, created.id);

    return {
      previous: mapRule(existing),
      current: mapRule(created),
    };
  }

  async auditAccessDenied(context: RbacActionContext = {}) {
    await this.auditLegalRuleAction('legal_rule_access_denied', 'failure', context, {
      permission: 'legal:admin',
    }, null);
  }

  async submitReview(id: string, context: RbacActionContext = {}) {
    const rule = await this.requireRule(id);
    const status = resolveWorkflowStatus(rule);
    if (status !== WORKFLOW_STATUS.DRAFT && status !== WORKFLOW_STATUS.REJECTED) {
      throw new LegalRuleValidationError('Apenas regras em draft ou rejected podem ser enviadas para revisao.');
    }

    const updated = await this.client.legalRule.update({
      where: { id: rule.id },
      data: {
        active: false,
        workflowStatus: WORKFLOW_STATUS.UNDER_REVIEW,
        submittedById: normalizeNullableString(context.user?.id, 120),
        submittedAt: new Date(),
      },
    });

    await this.auditLegalRuleAction('legal_rule_submitted_review', 'success', context, {
      code: updated.code,
      version: updated.version,
      workflowStatus: updated.workflowStatus,
    }, updated.id);

    return mapRule(updated);
  }

  async approveRule(id: string, context: RbacActionContext = {}) {
    const rule = await this.requireRule(id);
    if (resolveWorkflowStatus(rule) !== WORKFLOW_STATUS.UNDER_REVIEW) {
      throw new LegalRuleValidationError('Apenas regras under_review podem ser aprovadas.');
    }
    const actorId = normalizeNullableString(context.user?.id, 120);
    if (rule.createdById && actorId && rule.createdById === actorId) {
      throw new LegalRuleValidationError('Criador da regra nao pode aprovar a propria regra.');
    }

    const updated = await this.client.legalRule.update({
      where: { id: rule.id },
      data: {
        active: false,
        workflowStatus: WORKFLOW_STATUS.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
      },
    });

    await this.auditLegalRuleAction('legal_rule_approved', 'success', context, {
      code: updated.code,
      version: updated.version,
      workflowStatus: updated.workflowStatus,
    }, updated.id);

    return mapRule(updated);
  }

  async rejectRule(id: string, input: RejectLegalRuleInput = {}, context: RbacActionContext = {}) {
    const rule = await this.requireRule(id);
    if (resolveWorkflowStatus(rule) !== WORKFLOW_STATUS.UNDER_REVIEW) {
      throw new LegalRuleValidationError('Apenas regras under_review podem ser rejeitadas.');
    }

    const updated = await this.client.legalRule.update({
      where: { id: rule.id },
      data: {
        active: false,
        workflowStatus: WORKFLOW_STATUS.REJECTED,
        rejectedById: normalizeNullableString(context.user?.id, 120),
        rejectedAt: new Date(),
      },
    });

    await this.auditLegalRuleAction('legal_rule_rejected', 'success', context, {
      code: updated.code,
      version: updated.version,
      workflowStatus: updated.workflowStatus,
      reason: safeString(input.reason, 500) ?? null,
    }, updated.id);

    return mapRule(updated);
  }

  async activateApprovedRule(id: string, context: RbacActionContext = {}) {
    return this.activateApprovedInternal(id, context, 'legal_rule_activated_approved');
  }

  async history(id: string, context: RbacActionContext = {}) {
    const rule = await this.requireRule(id);
    const events = this.client.auditEvent?.findMany
      ? await this.client.auditEvent.findMany({
        where: {
          scope: 'legal_rules_admin',
          entityId: rule.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      : [];

    await this.auditLegalRuleAction('legal_rule_history_viewed', 'success', context, {
      code: rule.code,
      version: rule.version,
      events: events.length,
    }, rule.id);

    return {
      rule: mapRule(rule),
      events: events.map(mapHistoryEvent),
    };
  }

  async diff(id: string, compareId: string, context: RbacActionContext = {}) {
    const base = await this.requireRule(id);
    const compare = await this.requireRule(compareId);
    const fields = DIFF_FIELDS.map((field) => {
      const from = sanitizeMetadata(base[field]);
      const to = sanitizeMetadata(compare[field]);
      return {
        field,
        changed: !stableEqual(from, to),
        from,
        to,
      };
    });

    await this.auditLegalRuleAction('legal_rule_diff_viewed', 'success', context, {
      code: base.code,
      version: base.version,
      compareRuleId: compare.id,
      compareVersion: compare.version,
      changedFields: fields.filter((field) => field.changed).map((field) => field.field),
    }, base.id);

    return {
      base: mapRuleReference(base),
      compare: mapRuleReference(compare),
      fields,
      summary: {
        changedFields: fields.filter((field) => field.changed).length,
      },
    };
  }

  private async requireRule(id: string) {
    const ruleId = requiredString(id, 'id', 120);
    const rule = await this.client.legalRule.findFirst({ where: { id: ruleId } });
    if (!rule) throw new LegalRuleValidationError('Regra juridica nao encontrada.');
    return rule;
  }

  private async activateApprovedInternal(id: string, context: RbacActionContext, action: string) {
    const rule = await this.requireRule(id);
    if (resolveWorkflowStatus(rule) !== WORKFLOW_STATUS.APPROVED) {
      throw new LegalRuleValidationError('Regra precisa estar approved antes de ser ativada.');
    }

    const updated = await this.client.legalRule.update({
      where: { id: rule.id },
      data: {
        active: true,
        workflowStatus: WORKFLOW_STATUS.ACTIVE,
        activatedById: normalizeNullableString(context.user?.id, 120),
        activatedAt: new Date(),
      },
    });

    await this.auditLegalRuleAction(action, 'success', context, {
      code: updated.code,
      version: updated.version,
      active: true,
      workflowStatus: updated.workflowStatus,
    }, updated.id);

    return mapRule(updated);
  }

  private async setActive(id: string, active: boolean, action: string, context: RbacActionContext) {
    const ruleId = requiredString(id, 'id', 120);
    const existing = await this.client.legalRule.findFirst({ where: { id: ruleId } });
    if (!existing) throw new LegalRuleValidationError('Regra juridica nao encontrada.');

    const updated = await this.client.legalRule.update({
      where: { id: ruleId },
      data: { active, workflowStatus: active ? WORKFLOW_STATUS.ACTIVE : WORKFLOW_STATUS.INACTIVE },
    });

    await this.auditLegalRuleAction(action, 'success', context, {
      code: updated.code,
      version: updated.version,
      active,
    }, ruleId);

    return mapRule(updated);
  }

  private async auditLegalRuleAction(
    action: string,
    outcome: string,
    context: RbacActionContext,
    metadata: Record<string, unknown>,
    ruleId: string | null,
  ) {
    await this.client.auditEvent.create({
      data: {
        userId: context.user?.id ?? null,
        scope: 'legal_rules_admin',
        action,
        outcome,
        entityType: 'legal_rule',
        entityId: ruleId,
        requestId: normalizeHeader(context.requestId),
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: normalizeHeader(context.userAgent) ? hashAuditValue(normalizeHeader(context.userAgent) as string) : null,
        emailHash: context.user?.email ? hashAuditValue(context.user.email) : null,
        metadata: sanitizeMetadataObject({
          actorRole: context.user?.role ?? null,
          ...metadata,
        }) as any,
      }
    });
  }
}

function validateCreateInput(input: LegalRuleMutationInput) {
  return {
    tenantId: normalizeNullableString(input.tenantId, 120),
    code: requiredKey(input.code, 'code'),
    name: requiredString(input.name, 'name', 200),
    description: requiredString(input.description, 'description', 1000),
    severity: requiredSeverity(input.severity),
    category: requiredString(input.category, 'category', 120),
    legalBasis: requiredPlainObject(input.legalBasis, 'legalBasis'),
    version: requiredString(input.version, 'version', 80),
    active: false,
    criteria: requiredPlainObject(input.criteria, 'criteria'),
    alertMessage: requiredString(input.alertMessage, 'alertMessage', 1000),
    recommendation: requiredString(input.recommendation, 'recommendation', 1000),
    metadata: validateAndSanitizeMetadata(input.metadata),
  };
}

function validateUpdateInput(input: LegalRuleMutationInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = requiredString(input.name, 'name', 200);
  if (input.description !== undefined) data.description = requiredString(input.description, 'description', 1000);
  if (input.severity !== undefined) data.severity = requiredSeverity(input.severity);
  if (input.category !== undefined) data.category = requiredString(input.category, 'category', 120);
  if (input.legalBasis !== undefined) data.legalBasis = requiredPlainObject(input.legalBasis, 'legalBasis');
  if (input.criteria !== undefined) data.criteria = requiredPlainObject(input.criteria, 'criteria');
  if (input.alertMessage !== undefined) data.alertMessage = requiredString(input.alertMessage, 'alertMessage', 1000);
  if (input.recommendation !== undefined) data.recommendation = requiredString(input.recommendation, 'recommendation', 1000);
  if (input.metadata !== undefined) data.metadata = validateAndSanitizeMetadata(input.metadata);
  if (input.version !== undefined) data.version = requiredString(input.version, 'version', 80);
  return data;
}

function buildListWhere(input: ListLegalRulesInput) {
  return compact({
    code: input.code ? { contains: safeString(input.code, 120), mode: 'insensitive' } : undefined,
    category: safeString(input.category, 120),
    severity: normalizeSeverity(input.severity),
    active: booleanValue(input.active),
    workflowStatus: normalizeWorkflowStatus(input.workflowStatus),
    version: safeString(input.version, 80),
  });
}

function mapRule(rule: any) {
  return {
    id: rule.id,
    tenantId: rule.tenantId ?? null,
    code: rule.code,
    name: rule.name,
    description: rule.description,
    severity: rule.severity,
    category: rule.category,
    legalBasis: sanitizeMetadata(rule.legalBasis),
    version: rule.version,
    active: Boolean(rule.active),
    workflowStatus: resolveWorkflowStatus(rule),
    createdById: rule.createdById ?? null,
    submittedById: rule.submittedById ?? null,
    approvedById: rule.approvedById ?? null,
    rejectedById: rule.rejectedById ?? null,
    activatedById: rule.activatedById ?? null,
    submittedAt: toIso(rule.submittedAt),
    approvedAt: toIso(rule.approvedAt),
    rejectedAt: toIso(rule.rejectedAt),
    activatedAt: toIso(rule.activatedAt),
    criteria: sanitizeMetadata(rule.criteria),
    alertMessage: rule.alertMessage,
    recommendation: rule.recommendation,
    metadata: sanitizeMetadata(rule.metadata),
    createdAt: toIso(rule.createdAt),
    updatedAt: toIso(rule.updatedAt),
  };
}

function mapRuleReference(rule: any) {
  return {
    id: rule.id,
    code: rule.code,
    version: rule.version,
    workflowStatus: resolveWorkflowStatus(rule),
    active: Boolean(rule.active),
  };
}

function mapHistoryEvent(event: any) {
  return {
    id: event.id,
    userId: event.userId ?? null,
    action: event.action,
    outcome: event.outcome,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    metadata: sanitizeMetadata(event.metadata),
    createdAt: toIso(event.createdAt),
  };
}

function normalizePagination(input: PaginationInput) {
  const limit = Math.max(1, Math.min(numberValue(input.limit) ?? DEFAULT_LIMIT, MAX_LIMIT));
  const offset = Math.max(0, numberValue(input.offset) ?? 0);
  return { limit, offset };
}

function paginate<T>(rows: T[], pagination: { limit: number; offset: number }) {
  const hasMore = rows.length > pagination.limit;
  return {
    data: rows.slice(0, pagination.limit),
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      nextOffset: hasMore ? pagination.offset + pagination.limit : null,
      hasMore,
    },
  };
}

function requiredKey(value: unknown, field: string) {
  const normalized = safeString(value, 120);
  if (!normalized || !/^[a-z0-9:_-]+$/i.test(normalized)) {
    throw new LegalRuleValidationError(`${field} invalido.`);
  }
  return normalized;
}

function requiredString(value: unknown, field: string, max = 120) {
  const normalized = safeString(value, max);
  if (!normalized) throw new LegalRuleValidationError(`${field} e obrigatorio.`);
  return normalized;
}

function requiredSeverity(value: unknown) {
  const normalized = normalizeSeverity(value);
  if (!normalized) throw new LegalRuleValidationError('severity invalida.');
  return normalized;
}

function normalizeSeverity(value: unknown) {
  const normalized = safeString(value, 20);
  return normalized && VALID_SEVERITIES.has(normalized) ? normalized : undefined;
}

function normalizeWorkflowStatus(value: unknown) {
  const normalized = safeString(value, 40);
  return normalized && VALID_WORKFLOW_STATUSES.has(normalized) ? normalized : undefined;
}

function resolveWorkflowStatus(rule: any) {
  return normalizeWorkflowStatus(rule?.workflowStatus) ?? (rule?.active === false ? WORKFLOW_STATUS.INACTIVE : WORKFLOW_STATUS.ACTIVE);
}

function assertEditableWorkflow(rule: any) {
  const status = resolveWorkflowStatus(rule);
  if (status !== WORKFLOW_STATUS.DRAFT && status !== WORKFLOW_STATUS.REJECTED) {
    throw new LegalRuleValidationError('Apenas regras draft ou rejected podem ser editadas.');
  }
}

function requiredPlainObject(value: unknown, field: string) {
  if (!isPlainObject(value)) throw new LegalRuleValidationError(`${field} precisa ser objeto JSON.`);
  return sanitizeMetadataObject(value);
}

function validateAndSanitizeMetadata(value: unknown) {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) throw new LegalRuleValidationError('metadata precisa ser objeto JSON.');
  assertNoDangerousMetadataKeys(value);
  return sanitizeMetadataObject(value);
}

function assertNoDangerousMetadataKeys(value: Record<string, unknown>, depth = 0) {
  if (depth > 4) return;
  for (const [key, entryValue] of Object.entries(value)) {
    if (DANGEROUS_METADATA_KEY_PATTERN.test(key)) {
      throw new LegalRuleValidationError(`metadata contem campo nao permitido: ${key}`);
    }
    if (isPlainObject(entryValue)) assertNoDangerousMetadataKeys(entryValue, depth + 1);
  }
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

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return undefined;
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
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

function stableEqual(left: unknown, right: unknown) {
  return JSON.stringify(stableSort(left)) === JSON.stringify(stableSort(right));
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, stableSort(entryValue)]),
  );
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
