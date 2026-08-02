import { AiGroundingService, AI_GROUNDING_BLOCKED_MESSAGE } from './ai-grounding.service';

function serviceWith(overrides: Record<string, any> = {}) {
  const client = {
    aiRun: {
      create: jest.fn(async ({ data }) => ({ id: 'run-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'run-1', ...data })),
      ...(overrides.aiRun ?? {}),
    },
    aiRetrievalSession: {
      create: jest.fn(async ({ data }) => ({ id: 'retrieval-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'retrieval-1', ...data })),
      ...(overrides.aiRetrievalSession ?? {}),
    },
    aiCitation: {
      createMany: jest.fn(async ({ data }) => ({ count: data.length })),
      ...(overrides.aiCitation ?? {}),
    },
    legalAnalysis: {
      create: jest.fn(async ({ data }) => ({ id: 'analysis-1', ...data })),
      ...(overrides.legalAnalysis ?? {}),
    },
    draftEvidence: {
      createMany: jest.fn(async ({ data }) => ({ count: data.length })),
      ...(overrides.draftEvidence ?? {}),
    },
    procurementNotice: {
      findMany: jest.fn(async () => [notice()]),
      ...(overrides.procurementNotice ?? {}),
    },
    documentChunk: {
      findMany: jest.fn(async () => [chunk()]),
      ...(overrides.documentChunk ?? {}),
    },
    legalRule: {
      findMany: jest.fn(async () => [rule()]),
      ...(overrides.legalRule ?? {}),
    },
    auditEvent: {
      create: jest.fn(),
      ...(overrides.auditEvent ?? {}),
    },
  };

  const audit = {
    addAuditEvent: jest.fn(async (input) => ({ id: 'audit-1', ...input })),
    ...(overrides.audit ?? {}),
  };
  const provider = jest.fn(async () => ({ content: 'Resposta ancorada nas fontes recuperadas.', provider: 'openai' }));

  return {
    service: new AiGroundingService(client, overrides.provider ?? provider),
    client,
    audit,
    provider: overrides.provider ?? provider,
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
    object: 'Contratacao de servicos de limpeza predial',
    uf: 'SP',
    municipality: 'Sao Paulo',
    estimatedValue: 250000,
    status: 'open',
    url: 'https://pncp.gov.br/notice-1',
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date('2026-06-10T12:00:00Z'),
    closingAt: new Date('2026-06-11T12:00:00Z'),
    classification: { risk: 'medium' },
    metadata: { origin: 'pipeline' },
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-02T12:00:00Z'),
    ...overrides,
  };
}

function chunk(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    tenantId: null,
    sourceType: 'procurement_notice',
    sourceId: 'notice-1',
    chunkIndex: 0,
    content: 'O edital exige habilitacao juridica, regularidade fiscal e proposta comercial objetiva.',
    tokenCount: 32,
    metadata: { section: 'habilitacao' },
    createdAt: new Date('2026-06-01T12:00:00Z'),
    ...overrides,
  };
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    tenantId: null,
    code: 'missing_objective_criteria',
    name: 'Ausencia de criterios objetivos',
    description: 'Identifica ausencia de criterio objetivo nos textos analisados.',
    severity: 'medium',
    category: 'judgment',
    legalBasis: { references: ['Lei 14.133/2021'] },
    version: 'legal_precheck_v1.0.0',
    criteria: { type: 'missing_text_pattern' },
    alertMessage: 'Ponto de atencao sobre criterio objetivo.',
    recommendation: 'Conferir criterio de julgamento no edital e anexos.',
    ...overrides,
  };
}

describe('AiGroundingService', () => {
  test('responde com grounding valido e retorna citations, ids, regras e confidence', async () => {
    const { service, client, audit, provider } = serviceWith();

    const result = await service.runLex({
      pergunta: 'Quais pontos de atencao do edital?',
      noticeId: 'notice-1',
      purpose: 'lex_test',
    }, context);

    expect(result.blocked).toBe(false);
    expect(result.content).toContain('Resposta ancorada');
    expect(result.aiRunId).toBe('run-1');
    expect(result.retrievalSessionId).toBe('retrieval-1');
    expect(result.sourceIds).toEqual(['notice-1']);
    expect(result.chunkIds).toEqual(['chunk-1']);
    expect(result.ruleCodes).toEqual(['missing_objective_criteria']);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.limitations).toEqual(expect.arrayContaining([
      'Resposta limitada as fontes recuperadas do banco de dados do EXPERTISE.',
    ]));
    expect(result.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'notice-1', chunkId: 'chunk-1', citationType: 'chunk' }),
      expect.objectContaining({ sourceType: 'legal_rule', ruleCode: 'missing_objective_criteria' }),
    ]));
    expect(provider).toHaveBeenCalledTimes(1);
    expect(client.aiRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'started', purpose: 'lex_test' }),
    }));
    expect(client.aiRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed', sourceIds: ['notice-1'], chunkIds: ['chunk-1'] }),
    }));
    expect(client.auditEvent.create.mock.calls.some((call: any[]) => call[0].data?.action === 'ai_run_started')).toBe(true);
    expect(client.auditEvent.create.mock.calls.some((call: any[]) => call[0].data?.action === 'ai_run_completed')).toBe(true);
  });

  test('bloqueia resposta sem fontes e nao chama provedor', async () => {
    const { service, client, audit, provider } = serviceWith({
      procurementNotice: { findMany: jest.fn(async () => []) },
      documentChunk: { findMany: jest.fn(async () => []) },
    });

    const result = await service.runLex({
      pergunta: 'Analise edital inexistente',
      noticeId: 'notice-inexistente',
    }, context);

    expect(result.blocked).toBe(true);
    expect(result.content).toBe(AI_GROUNDING_BLOCKED_MESSAGE);
    expect(result.sourceIds).toEqual([]);
    expect(result.chunkIds).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(provider).not.toHaveBeenCalled();
    expect(client.aiRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'blocked', failureReason: expect.stringContaining('missing_sources') }),
    }));
    expect(client.auditEvent.create.mock.calls.some((call: any[]) => call[0].data?.action === 'ai_missing_sources')).toBe(true);
    expect(client.auditEvent.create.mock.calls.some((call: any[]) => call[0].data?.action === 'ai_grounding_blocked')).toBe(true);
  });

  test('bloqueia resposta quando fonte existe mas nao ha chunks', async () => {
    const { service, client, provider } = serviceWith({
      documentChunk: { findMany: jest.fn(async () => []) },
    });

    const result = await service.runLex({
      pergunta: 'Resuma o edital',
      noticeId: 'notice-1',
    }, context);

    expect(result.blocked).toBe(true);
    expect(result.content).toBe(AI_GROUNDING_BLOCKED_MESSAGE);
    expect(result.sourceIds).toEqual(['notice-1']);
    expect(result.chunkIds).toEqual([]);
    expect(provider).not.toHaveBeenCalled();
    expect(client.aiRetrievalSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'blocked', sourcesFound: 1, chunksFound: 0 }),
    }));
  });

  test('persiste retrieval, citations, legal analysis e draft evidence', async () => {
    const { service, client } = serviceWith();

    const result = await service.runLex({
      pergunta: 'Quais exigencias de habilitacao?',
      noticeId: 'notice-1',
    }, context);

    expect(result.legalAnalysisId).toBe('analysis-1');
    expect(client.aiRetrievalSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ aiRunId: 'run-1', status: 'running', retrievalMode: 'postgres_text' }),
    }));
    expect(client.aiRetrievalSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'completed',
        sourceIds: ['notice-1'],
        chunkIds: ['chunk-1'],
        ruleCodes: ['missing_objective_criteria'],
      }),
    }));
    expect(client.aiCitation.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ aiRunId: 'run-1', retrievalSessionId: 'retrieval-1', chunkId: 'chunk-1' }),
      ]),
    }));
    expect(client.legalAnalysis.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        aiRunId: 'run-1',
        procurementNoticeId: 'notice-1',
        sourceIds: ['notice-1'],
        chunkIds: ['chunk-1'],
        ruleCodes: ['missing_objective_criteria'],
      }),
    }));
    expect(client.draftEvidence.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ aiRunId: 'run-1', legalAnalysisId: 'analysis-1', chunkId: 'chunk-1' }),
      ]),
    }));
  });

  test('bloqueia fallback livre quando nao ha chunks nem regras suficientes', async () => {
    const { service, client, provider } = serviceWith({
      procurementNotice: { findMany: jest.fn(async () => [notice()]) },
      documentChunk: { findMany: jest.fn(async () => []) },
      legalRule: { findMany: jest.fn(async () => []) },
    });

    const result = await service.runLex({
      pergunta: 'Pode responder com conhecimento geral?',
      noticeId: 'notice-1',
    }, context);

    expect(result.blocked).toBe(true);
    expect(result.content).toBe(AI_GROUNDING_BLOCKED_MESSAGE);
    expect(provider).not.toHaveBeenCalled();
    expect(client.aiRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'blocked',
        failureReason: expect.stringContaining('missing_chunks'),
      }),
    }));
  });
});




