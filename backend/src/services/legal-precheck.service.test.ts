import { LegalPrecheckService } from './legal-precheck.service';

function serviceWith(clientOverrides: any = {}, auditOverrides: any = {}) {
  const client = {
    procurementNotice: {
      findFirst: jest.fn(async () => null),
      ...(clientOverrides.procurementNotice ?? {}),
    },
    documentChunk: {
      findMany: jest.fn(async () => []),
      ...(clientOverrides.documentChunk ?? {}),
    },
    legalRule: {
      findMany: jest.fn(async () => []),
      ...(clientOverrides.legalRule ?? {}),
    },
    auditEvent: {
      create: jest.fn(),
      ...(clientOverrides.auditEvent ?? {}),
    },
  };
  const audit = {
    addAuditEvent: jest.fn(async (input) => ({ id: 'audit-1', ...input })),
    ...auditOverrides,
  };

  return {
    service: new LegalPrecheckService(client),
    client,
    audit,
  };
}

const context = {
  tenantId: null,
  user: {
    id: 'user-1',
    email: 'user@expertise.test',
    role: 'fornecedor',
    isAdmin: false,
    permissions: [],
  },
  requestId: 'req-1',
  ip: '127.0.0.1',
  userAgent: 'jest',
};

function notice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notice-1',
    tenantId: null,
    source: 'pncp',
    externalId: 'PNCP-001',
    noticeNumber: 'PE 001/2026',
    modality: 'Pregao eletronico',
    buyerName: 'Prefeitura de Teste',
    buyerDocument: '00000000000100',
    object: 'Contratacao de servicos continuados de limpeza predial com materiais e equipe dedicada',
    uf: 'SP',
    municipality: 'Sao Paulo',
    estimatedValue: 250000,
    status: 'open',
    url: 'https://pncp.gov.br/notice-1',
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date(Date.now() + 10 * 86400000),
    closingAt: new Date(Date.now() + 12 * 86400000),
    rawPayload: {
      observacao: 'Criterio de julgamento menor preco por item.',
      token: 'secret',
    },
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-02T12:00:00Z'),
    ...overrides,
  };
}

function chunk(content: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    tenantId: null,
    sourceType: 'procurement_notice',
    sourceId: 'notice-1',
    chunkIndex: 0,
    content,
    tokenCount: 40,
    metadata: { section: 'edital', token: 'secret' },
    createdAt: new Date('2026-06-01T12:00:00Z'),
    embedding: [1, 2, 3],
    ...overrides,
  };
}

function persistedRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    tenantId: null,
    code: 'specific_brand_reference',
    name: 'Mencao a marca especifica',
    description: 'Identifica mencoes a marca, fabricante ou modelo que merecem revisao.',
    severity: 'high',
    category: 'specification',
    legalBasis: { references: ['Lei 14.133/2021'] },
    version: 'legal_precheck_v1.0.0',
    active: true,
    workflowStatus: 'active',
    criteria: { type: 'text_pattern', patterns: ['marca dell'] },
    alertMessage: 'Possivel risco: indicio de mencao a marca.',
    recommendation: 'Recomendacao de revisao: verificar equivalentes.',
    metadata: { system: true },
    createdAt: new Date('2026-06-05T12:00:00Z'),
    updatedAt: new Date('2026-06-05T12:00:00Z'),
    ...overrides,
  };
}

const safeChunk = chunk(
  [
    'O criterio de julgamento sera menor preco.',
    'A habilitacao juridica, regularidade fiscal e proposta comercial estao descritas objetivamente.',
    'Serao aceitos produtos equivalentes que atendam as especificacoes tecnicas.',
  ].join(' '),
);

describe('LegalPrecheckService', () => {
  test('retorna edital sem risco quando nenhuma regra encontra alerta', async () => {
    const { service } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: { findMany: jest.fn(async () => [safeChunk]) },
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result).toMatchObject({
      notice: {
        id: 'notice-1',
        source: 'pncp',
        modality: 'Pregao eletronico',
      },
      severity: 'none',
      alerts: [],
    });
    expect((result as any).rawPayload).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/fraude|ilegalidade/i);
  });

  test('detecta edital com prazo curto', async () => {
    const { service } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => notice({
          openingAt: new Date(Date.now() + 86400000),
          closingAt: new Date(Date.now() + 2 * 86400000),
        })),
      },
      documentChunk: { findMany: jest.fn(async () => [safeChunk]) },
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleCode: 'short_deadline',
        severity: 'medium',
      }),
    ]));
  });

  test('detecta mencao a marca e retorna evidencia textual sanitizada', async () => {
    const { service } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: {
        findMany: jest.fn(async () => [
          chunk('O equipamento devera ser notebook marca Dell, modelo equivalente ao especificado, com garantia minima.'),
        ]),
      },
    });

    const result = await service.analyzeNotice('notice-1', context);
    const alert = result?.alerts.find((item: any) => item.ruleCode === 'specific_brand_reference') as any;

    expect(alert).toMatchObject({
      severity: 'high',
      category: 'specification',
    });
    expect(alert.evidence[0]).toMatchObject({
      type: 'chunk_text',
      chunkId: 'chunk-1',
      metadata: {
        section: 'edital',
        token: '[redacted]',
      },
    });
    expect(alert.evidence[0].excerpt).toContain('marca Dell');
    expect(alert.evidence[0].embedding).toBeUndefined();
  });

  test('detecta exigencia territorial', async () => {
    const { service } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: {
        findMany: jest.fn(async () => [
          chunk('A contratada devera comprovar escritorio e sede no municipio para atendimento presencial.'),
        ]),
      },
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleCode: 'territorial_requirement',
        severity: 'high',
      }),
    ]));
  });

  test('audita edital inexistente e retorna null', async () => {
    const { service, client } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => null) },
    });

    const result = await service.analyzeNotice('missing-notice', context);

    expect(result).toBeNull();
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'legal_precheck',
        action: 'legal_precheck_notice_not_found',
        outcome: 'failure',
        entityId: 'missing-notice',
        entityType: 'procurement_notice',
      })
    }));
  });

  test('retorna ruleset versionado e regras aplicadas', async () => {
    const { service } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: { findMany: jest.fn(async () => [safeChunk]) },
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.ruleset).toMatchObject({
      version: 'legal_precheck_v1.0.0',
      source: 'default',
      rulesApplied: 9,
    });
    expect(result?.appliedRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'specific_brand_reference',
        version: 'legal_precheck_v1.0.0',
        criteria: expect.any(Object),
      }),
    ]));
  });

  test('regra draft persistida nao entra no precheck', async () => {
    const { service } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: {
        findMany: jest.fn(async () => [
          chunk('O equipamento devera ser marca Dell, sem equivalencia indicada.'),
        ]),
      },
      legalRule: {
        findMany: jest.fn(async () => [
          persistedRule({ active: true, workflowStatus: 'draft' }),
        ]),
      },
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.ruleset).toMatchObject({ source: 'database', rulesApplied: 0 });
    expect(result?.alerts).toEqual([]);
  });

  test('regra active persistida entra no precheck', async () => {
    const { service } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: {
        findMany: jest.fn(async () => [
          chunk('O equipamento devera ser marca Dell, sem equivalencia indicada.'),
        ]),
      },
      legalRule: {
        findMany: jest.fn(async () => [
          persistedRule({ active: true, workflowStatus: 'active' }),
        ]),
      },
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.ruleset).toMatchObject({ source: 'database', rulesApplied: 1 });
    expect(result?.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleCode: 'specific_brand_reference' }),
    ]));
  });

  test('registra auditoria de visualizacao do precheck', async () => {
    const { service, client } = serviceWith({
      procurementNotice: { findFirst: jest.fn(async () => notice()) },
      documentChunk: { findMany: jest.fn(async () => [safeChunk]) },
    });

    await service.analyzeNotice('notice-1', context);

    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'legal_precheck',
        action: 'legal_precheck_viewed',
        outcome: 'success',
        entityId: 'notice-1',
        entityType: 'procurement_notice',
      })
    }));
  });
});
