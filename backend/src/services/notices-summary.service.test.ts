import { NoticesSearchService } from './notices-search.service';

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
    service: new NoticesSearchService(client),
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

function completeNotice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notice-1',
    tenantId: null,
    source: 'pncp',
    externalId: 'PNCP-001',
    noticeNumber: 'PE 001/2026',
    modality: 'Pregao eletronico',
    buyerName: 'Prefeitura de Teste',
    buyerDocument: '00000000000100',
    object: 'Contratacao de servico de limpeza predial com fornecimento de materiais',
    uf: 'SP',
    municipality: 'Sao Paulo',
    estimatedValue: 250000,
    status: 'open',
    url: 'https://pncp.gov.br/notice-1',
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date(Date.now() + 2 * 86400000),
    closingAt: new Date(Date.now() + 3 * 86400000),
    classification: { segment: 'limpeza' },
    metadata: { origin: 'pipeline' },
    rawPayload: {
      termoReferencia: 'Contrato social, regularidade fiscal e proposta comercial serao exigidos.',
      token: 'secret',
    },
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
    content: [
      'Habilitacao juridica com contrato social.',
      'Regularidade fiscal com certidao e FGTS.',
      'Qualificacao tecnica por atestado de capacidade.',
      'Proposta comercial e declaracoes obrigatorias.',
    ].join(' '),
    tokenCount: 48,
    metadata: { section: 'habilitacao', token: 'secret' },
    createdAt: new Date('2026-06-01T12:00:00Z'),
    embedding: [1, 2, 3],
    ...overrides,
  };
}

describe('Notices summary', () => {
  test('gera resumo com dados completos sem expor rawPayload', async () => {
    const { service, client, audit } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => completeNotice()),
      },
      documentChunk: {
        findMany: jest.fn(async () => [chunk(), chunk({ id: 'chunk-2', chunkIndex: 1, content: 'Balanco patrimonial e indices contabeis.' })]),
      },
    });

    const result = await service.getNoticeSummary('notice-1', context);
    const noticeArgs = client.procurementNotice.findFirst.mock.calls[0][0];

    expect(noticeArgs.select.rawPayload).toBe(true);
    expect(result).toMatchObject({
      id: 'notice-1',
      identification: {
        externalId: 'PNCP-001',
        noticeNumber: 'PE 001/2026',
      },
      source: 'pncp',
      agency: 'Prefeitura de Teste',
      uf: 'SP',
      municipality: 'Sao Paulo',
      modality: 'Pregao eletronico',
      estimatedValue: 250000,
      completeness: {
        score: 100,
        level: 'high',
      },
    });
    expect((result as any).rawPayload).toBeUndefined();
    expect(result?.requirements.documentsFound.map((item: any) => item.code)).toEqual(expect.arrayContaining([
      'legal_qualification',
      'fiscal_regularidade',
      'technical_qualification',
      'commercial_proposal',
      'mandatory_declarations',
    ]));
    expect(result?.keywords.length).toBeGreaterThan(0);
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'notices',
        action: 'NOTICE_SUMMARY_VIEWED',
        outcome: 'success',
        entityId: 'notice-1',
      })
    }));
  });

  test('gera resumo com dados incompletos, alertas simples e completude baixa', async () => {
    const { service } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => completeNotice({
          buyerName: null,
          object: '',
          uf: null,
          municipality: null,
          modality: null,
          status: null,
          estimatedValue: null,
          publishedAt: null,
          openingAt: null,
          closingAt: null,
          rawPayload: {},
        })),
      },
      documentChunk: {
        findMany: jest.fn(async () => []),
      },
    });

    const result = await service.getNoticeSummary('notice-1', context);
    const alertCodes = result?.alerts.map((alert: any) => alert.code);

    expect(result?.completeness.level).toBe('low');
    expect(result?.completeness.score).toBeLessThan(30);
    expect(result?.completeness.missingFields.map((field: any) => field.key)).toEqual(expect.arrayContaining([
      'agency',
      'object',
      'estimatedValue',
      'chunks',
      'modality',
    ]));
    expect(alertCodes).toEqual(expect.arrayContaining([
      'missing_estimated_value',
      'missing_object',
      'no_chunks',
      'insufficient_documentation',
      'missing_modality',
    ]));
  });

  test('audita edital inexistente e retorna null', async () => {
    const { service, client, audit } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => null),
      },
    });

    const result = await service.getNoticeSummary('missing-notice', context);

    expect(result).toBeNull();
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'NOTICE_SUMMARY_NOT_FOUND',
        outcome: 'failure',
        entityId: 'missing-notice',
      })
    }));
  });

  test('retorna checklist inicial deterministico', async () => {
    const { service } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => completeNotice()),
      },
      documentChunk: {
        findMany: jest.fn(async () => [chunk()]),
      },
    });

    const result = await service.getNoticeSummary('notice-1', context);

    expect(result?.checklist).toHaveLength(6);
    expect(result?.checklist.map((item: any) => item.code)).toEqual([
      'legal_qualification',
      'fiscal_regularidade',
      'economic_financial',
      'technical_qualification',
      'commercial_proposal',
      'mandatory_declarations',
    ]);
    expect(result?.checklist.find((item: any) => item.code === 'legal_qualification')).toMatchObject({
      status: 'found',
    });
  });

  test('alerta prazo curto sem criar analise juridica profunda', async () => {
    const { service } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => completeNotice({
          closingAt: new Date(Date.now() + 86400000),
        })),
      },
      documentChunk: {
        findMany: jest.fn(async () => [chunk()]),
      },
    });

    const result = await service.getNoticeSummary('notice-1', context);

    expect(result?.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'short_deadline',
        level: 'attention',
      }),
    ]));
    expect(JSON.stringify(result)).not.toMatch(/irregularidade|ilegalidade|vicio/i);
  });

  test('sanitiza chunks utilizados e nao retorna embeddings', async () => {
    const { service } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => completeNotice()),
      },
      documentChunk: {
        findMany: jest.fn(async () => [chunk()]),
      },
    });

    const result = await service.getNoticeSummary('notice-1', context);
    const usedChunk = result?.chunksUsed.items[0] as any;

    expect(usedChunk).toMatchObject({
      id: 'chunk-1',
      chunkIndex: 0,
      metadata: {
        section: 'habilitacao',
        token: '[redacted]',
      },
    });
    expect(usedChunk.excerpt).toContain('Habilitacao juridica');
    expect(usedChunk.embedding).toBeUndefined();
  });
  test('gera resumo basico sem consultar chunks ou expor analises avancadas', async () => {
    const { service, client, audit } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => completeNotice()),
      },
    });

    const result = await service.getNoticeBasicSummary('notice-1', context);
    const query = client.procurementNotice.findFirst.mock.calls[0][0];

    expect(query.select.rawPayload).toBeUndefined();
    expect(client.documentChunk.findMany).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      id: 'notice-1',
      identification: {
        externalId: 'PNCP-001',
        noticeNumber: 'PE 001/2026',
      },
      source: 'pncp',
      agency: 'Prefeitura de Teste',
      modality: 'Pregao eletronico',
      status: 'open',
      estimatedValue: 250000,
      method: 'basic_projection_v1',
    });

    expect((result as any).keywords).toBeUndefined();
    expect((result as any).requirements).toBeUndefined();
    expect((result as any).alerts).toBeUndefined();
    expect((result as any).checklist).toBeUndefined();
    expect((result as any).chunksUsed).toBeUndefined();
    expect((result as any).completeness).toBeUndefined();

    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'NOTICE_BASIC_SUMMARY_VIEWED',
        outcome: 'success',
        entityId: 'notice-1',
      })
    }));
  });

  test('audita resumo basico de edital inexistente', async () => {
    const { service, client, audit } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => null),
      },
    });

    const result = await service.getNoticeBasicSummary('missing-notice', context);

    expect(result).toBeNull();
    expect(client.documentChunk.findMany).not.toHaveBeenCalled();
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'NOTICE_BASIC_SUMMARY_NOT_FOUND',
        outcome: 'failure',
        entityId: 'missing-notice',
      })
    }));
  });

});
