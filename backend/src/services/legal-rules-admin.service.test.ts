import { LegalRulesAdminService, LegalRuleValidationError } from './legal-rules-admin.service';

function serviceWith(clientOverrides: any = {}, auditOverrides: any = {}) {
  const client = {
    legalRule: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(),
      update: jest.fn(),
      ...(clientOverrides.legalRule ?? {}),
    },
    auditEvent: {
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      ...(clientOverrides.auditEvent ?? {}),
    },
  };
  const audit = {
    addAuditEvent: jest.fn(async (input) => ({ id: 'audit-1', ...input })),
    ...auditOverrides,
  };

  return {
    service: new LegalRulesAdminService(client),
    client,
    audit,
  };
}

const context = {
  user: { id: 'admin-1', email: 'admin@expertise.test', role: 'fornecedor' },
  requestId: 'req-1',
  ip: '127.0.0.1',
  userAgent: 'jest',
};

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    tenantId: null,
    code: 'specific_brand_reference',
    name: 'Mencao a marca especifica',
    description: 'Identifica mencoes a marca.',
    severity: 'high',
    category: 'specification',
    legalBasis: { references: ['Lei 14.133/2021'] },
    version: 'legal_precheck_v1.0.0',
    active: true,
    workflowStatus: 'active',
    createdById: 'creator-1',
    submittedById: null,
    approvedById: null,
    rejectedById: null,
    activatedById: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    activatedAt: null,
    criteria: { type: 'text_pattern', patterns: ['marca'] },
    alertMessage: 'Possivel risco: indicio de mencao a marca.',
    recommendation: 'Recomendacao de revisao: verificar equivalentes.',
    metadata: { owner: 'legal', token: 'secret' },
    createdAt: new Date('2026-06-05T12:00:00Z'),
    updatedAt: new Date('2026-06-05T12:00:00Z'),
    ...overrides,
  };
}

const validInput = {
  code: 'territorial_requirement',
  name: 'Exigencia territorial suspeita',
  description: 'Identifica mencoes territoriais.',
  severity: 'high',
  category: 'restriction',
  legalBasis: { references: ['Lei 14.133/2021'] },
  version: 'legal_precheck_v1.0.0',
  criteria: { type: 'text_pattern', patterns: ['sede no municipio'] },
  alertMessage: 'Possivel risco: indicio de exigencia territorial.',
  recommendation: 'Recomendacao de revisao: avaliar justificativa objetiva.',
  metadata: { owner: 'legal' },
};

describe('LegalRulesAdminService', () => {
  test('lista regras com filtros e paginacao', async () => {
    const { service, client } = serviceWith({
      legalRule: {
        findMany: jest.fn(async () => [rule(), rule({ id: 'rule-2' })]),
      },
    });

    const result = await service.listRules({
      code: 'brand',
      category: 'specification',
      severity: 'high',
      active: 'true',
      version: 'legal_precheck_v1.0.0',
      limit: 1,
      offset: 0,
    });

    expect(client.legalRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        code: { contains: 'brand', mode: 'insensitive' },
        category: 'specification',
        severity: 'high',
        active: true,
        version: 'legal_precheck_v1.0.0',
      }),
      take: 2,
      skip: 0,
    }));
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ limit: 1, offset: 0, hasMore: true });
    expect((result.data[0] as any).metadata).toMatchObject({ owner: 'legal', token: '[redacted]' });
  });

  test('cria regra valida e registra auditoria', async () => {
    const { service, client, audit } = serviceWith({
      legalRule: {
        create: jest.fn(async ({ data }) => rule({ id: 'rule-created', ...data })),
      },
    });

    const result = await service.createRule(validInput, context);

    expect(client.legalRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'territorial_requirement',
        severity: 'high',
        active: false,
        workflowStatus: 'draft',
        createdById: 'admin-1',
      }),
    });
    expect(result).toMatchObject({ id: 'rule-created', code: 'territorial_requirement', workflowStatus: 'draft', active: false });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'legal_rules_admin',
        action: 'legal_rule_created',
        outcome: 'success',
        userId: 'admin-1',
        entityType: 'legal_rule',
        entityId: 'rule-created',
      }),
    });
  });

  test('bloqueia regra invalida', async () => {
    const { service, client } = serviceWith();

    await expect(service.createRule({
      ...validInput,
      severity: 'critical',
    }, context)).rejects.toBeInstanceOf(LegalRuleValidationError);
    expect(client.legalRule.create).not.toHaveBeenCalled();
  });

  test('bloqueia metadata perigosa', async () => {
    const { service } = serviceWith();

    await expect(service.createRule({
      ...validInput,
      metadata: { token: 'secret' },
    }, context)).rejects.toThrow(/metadata contem campo nao permitido/);
  });

  test('atualiza regra e audita campos alterados', async () => {
    const { service, client, audit } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'draft' })),
        update: jest.fn(async ({ data }) => rule({ ...data, updatedAt: new Date('2026-06-06T12:00:00Z') })),
      },
    });

    const result = await service.updateRule('rule-1', {
      name: 'Mencao a marca revisada',
      metadata: { reviewer: 'legal-team' },
    }, context);

    expect(client.legalRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: expect.objectContaining({
        name: 'Mencao a marca revisada',
        metadata: { reviewer: 'legal-team' },
      }),
    });
    expect(result).toMatchObject({ name: 'Mencao a marca revisada' });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'legal_rule_updated',
        entityId: 'rule-1',
      }),
    });
  });

  test('desativa regra ativa', async () => {
    const { service, client, audit } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule()),
        update: jest.fn(async ({ data }) => rule({ ...data })),
      },
    });

    const deactivated = await service.deactivateRule('rule-1', context);

    expect(deactivated).toMatchObject({ active: false, workflowStatus: 'inactive' });
    expect(client.legalRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { active: false, workflowStatus: 'inactive' },
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'legal_rule_deactivated' }),
    });
  });

  test('cria nova versao sem apagar versao antiga', async () => {
    const previous = rule();
    const { service, client, audit } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => previous),
        create: jest.fn(async ({ data }) => rule({ id: 'rule-2', ...data })),
      },
    });

    const result = await service.createNewVersion('rule-1', {
      version: 'legal_precheck_v1.1.0',
      alertMessage: 'Ponto de atencao revisado.',
    }, context);

    expect(client.legalRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: previous.code,
        version: 'legal_precheck_v1.1.0',
        alertMessage: 'Ponto de atencao revisado.',
        active: false,
        workflowStatus: 'draft',
        createdById: 'admin-1',
      }),
    });
    expect(client.legalRule.update).not.toHaveBeenCalled();
    expect(result.previous).toMatchObject({ id: 'rule-1', version: 'legal_precheck_v1.0.0' });
    expect(result.current).toMatchObject({ id: 'rule-2', version: 'legal_precheck_v1.1.0' });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'legal_rule_versioned',
        entityId: 'rule-2',
      }),
    });
  });

  test('envia draft para revisao e registra auditoria', async () => {
    const { service, client, audit } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'draft' })),
        update: jest.fn(async ({ data }) => rule({ ...data })),
      },
    });

    const result = await service.submitReview('rule-1', context);

    expect(result).toMatchObject({ workflowStatus: 'under_review', active: false, submittedById: 'admin-1' });
    expect(client.legalRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: expect.objectContaining({
        active: false,
        workflowStatus: 'under_review',
        submittedById: 'admin-1',
        submittedAt: expect.any(Date),
      }),
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'legal_rule_submitted_review' }),
    });
  });

  test('aprova regra under_review com revisor diferente', async () => {
    const reviewerContext = { ...context, user: { id: 'reviewer-1', email: 'reviewer@expertise.test', role: 'advogado' } };
    const { service, client } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'under_review', createdById: 'admin-1' })),
        update: jest.fn(async ({ data }) => rule({ ...data })),
      },
    });

    const result = await service.approveRule('rule-1', reviewerContext);

    expect(result).toMatchObject({ workflowStatus: 'approved', active: false, approvedById: 'reviewer-1' });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'legal_rule_approved' }),
    });
  });

  test('bloqueia aprovacao da propria regra', async () => {
    const { service } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'under_review', createdById: 'admin-1' })),
      },
    });

    await expect(service.approveRule('rule-1', context)).rejects.toThrow(/nao pode aprovar/);
  });

  test('bloqueia ativacao sem approved', async () => {
    const { service, client } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'under_review' })),
      },
    });

    await expect(service.activateApprovedRule('rule-1', context)).rejects.toThrow(/approved/);
    expect(client.legalRule.update).not.toHaveBeenCalled();
  });

  test('ativa regra aprovada e audita publicacao', async () => {
    const { service, client } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'approved' })),
        update: jest.fn(async ({ data }) => rule({ ...data })),
      },
    });

    const result = await service.activateApprovedRule('rule-1', context);

    expect(result).toMatchObject({ active: true, workflowStatus: 'active', activatedById: 'admin-1' });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'legal_rule_activated_approved' }),
    });
  });

  test('rejeita regra under_review e audita motivo', async () => {
    const { service, client } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'under_review' })),
        update: jest.fn(async ({ data }) => rule({ ...data })),
      },
    });

    const result = await service.rejectRule('rule-1', { reason: 'Ajustar base legal.' }, context);

    expect(result).toMatchObject({ active: false, workflowStatus: 'rejected', rejectedById: 'admin-1' });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'legal_rule_rejected',
        metadata: expect.objectContaining({ reason: 'Ajustar base legal.' }),
      }),
    });
  });

  test('edicao de rejected volta para draft', async () => {
    const { service, client } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule({ active: false, workflowStatus: 'rejected' })),
        update: jest.fn(async ({ data }) => rule({ ...data })),
      },
    });

    const result = await service.updateRule('rule-1', { recommendation: 'Revisar justificativa.' }, context);

    expect(result).toMatchObject({ workflowStatus: 'draft', active: false });
    expect(client.legalRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: expect.objectContaining({ workflowStatus: 'draft', active: false }),
    });
  });

  test('diff compara campos juridicos entre versoes', async () => {
    const { service, client } = serviceWith({
      legalRule: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(rule({ id: 'rule-1', criteria: { type: 'text_pattern', patterns: ['marca'] } }))
          .mockResolvedValueOnce(rule({ id: 'rule-2', version: 'legal_precheck_v1.1.0', severity: 'medium', criteria: { type: 'text_pattern', patterns: ['modelo'] } })),
      },
    });

    const result = await service.diff('rule-1', 'rule-2', context);

    expect(result.summary.changedFields).toBeGreaterThan(0);
    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'criteria', changed: true }),
      expect.objectContaining({ field: 'severity', changed: true }),
    ]));
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'legal_rule_diff_viewed' }),
    });
  });

  test('history retorna eventos auditados', async () => {
    const { service, client, audit } = serviceWith({
      legalRule: {
        findFirst: jest.fn(async () => rule()),
      },
      auditEvent: {
        findMany: jest.fn(async () => [{
          id: 'audit-1',
          userId: 'admin-1',
          action: 'legal_rule_created',
          outcome: 'success',
          entityType: 'legal_rule',
          entityId: 'rule-1',
          metadata: { token: 'secret', version: 'legal_precheck_v1.0.0' },
          createdAt: new Date('2026-06-05T13:00:00Z'),
        }]),
      },
    });

    const result = await service.history('rule-1', context);

    expect(client.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { scope: 'legal_rules_admin', entityId: 'rule-1' },
    }));
    expect(result.events[0]).toMatchObject({
      action: 'legal_rule_created',
      metadata: { token: '[redacted]', version: 'legal_precheck_v1.0.0' },
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'legal_rule_history_viewed' }),
    });
  });
});


