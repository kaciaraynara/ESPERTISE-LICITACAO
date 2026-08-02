import { NoticesSearchService } from './notices-search.service';

function serviceWith(clientOverrides: any = {}, auditOverrides: any = {}, rbacOverrides: any = {}) {
  const client = {
    ...clientOverrides,
    procurementNotice: {
      findMany: jest.fn(async () => []),
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
  const rbac = {
    hasPermission: jest.fn(async () => false),
    ...rbacOverrides,
  };

  return {
    service: new NoticesSearchService(client, rbac as any),
    client,
    audit,
    rbac,
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
    object: 'Contratacao de servico de limpeza predial',
    uf: 'SP',
    municipality: 'Sao Paulo',
    estimatedValue: 100000,
    status: 'open',
    url: 'https://pncp.gov.br/notice-1',
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date('2026-06-10T12:00:00Z'),
    closingAt: new Date('2026-06-11T12:00:00Z'),
    classification: { difficulty: 'medium' },
    metadata: { origin: 'pipeline', token: 'secret' },
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-02T12:00:00Z'),
    ...overrides,
  };
}

describe('NoticesSearchService', () => {
  test('busca por palavra-chave usando PostgreSQL/Prisma e registra auditoria', async () => {
    const { service, client, audit } = serviceWith({
      procurementNotice: {
        findMany: jest.fn(async () => [notice()]),
      },
    });

    const result = await service.search({ q: 'limpeza', limit: '10' }, context);
    const args = client.procurementNotice.findMany.mock.calls[0][0];

    expect(args).toMatchObject({
      take: 11,
      skip: 0,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    expect(args.where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({
        OR: expect.arrayContaining([
          { object: { contains: 'limpeza', mode: 'insensitive' } },
        ]),
      }),
    ]));
    expect(result.search).toMatchObject({ engine: 'postgres', mode: 'postgres_text' });
    expect(result.data[0]).toMatchObject({ id: 'notice-1', object: 'Contratacao de servico de limpeza predial' });
    expect((result.data[0] as any).metadata).toMatchObject({ token: '[redacted]' });
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
      scope: 'notices',
      action: 'NOTICE_SEARCH_EXECUTED',
      outcome: 'success',
      userId: 'user-1',
    })}));
  });

  test('filtra por fonte', async () => {
    const { service, client } = serviceWith();

    await service.search({ source: 'pncp' }, context);

    expect(client.procurementNotice.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      { source: 'pncp' },
    ]));
  });

  test('filtra por UF normalizada', async () => {
    const { service, client } = serviceWith();

    await service.search({ uf: 'sp' }, context);

    expect(client.procurementNotice.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      { uf: 'SP' },
    ]));
  });

  test('filtra por modalidade', async () => {
    const { service, client } = serviceWith();

    await service.search({ modality: 'pregao' }, context);

    expect(client.procurementNotice.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      { modality: { contains: 'pregao', mode: 'insensitive' } },
    ]));
  });

  test('aplica paginacao obrigatoria com hasMore', async () => {
    const { service } = serviceWith({
      procurementNotice: {
        findMany: jest.fn(async () => [
          notice({ id: 'notice-1' }),
          notice({ id: 'notice-2' }),
        ]),
      },
    });

    const result = await service.search({ limit: 1, offset: 2 }, context);

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({
      limit: 1,
      offset: 2,
      hasMore: true,
      nextOffset: 3,
    });
  });

  test('recupera detalhe por id sem retornar rawPayload por padrao', async () => {
    const { service, client, audit } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => notice()),
      },
    });

    const result = await service.getNoticeById('notice-1', {}, context);
    const args = client.procurementNotice.findFirst.mock.calls[0][0];

    expect(args.where.AND).toEqual(expect.arrayContaining([{ id: 'notice-1' }]));
    expect(args.select.rawPayload).toBeUndefined();
    expect(result).toMatchObject({ id: 'notice-1', rawPayloadIncluded: false });
    expect((result as any).rawPayload).toBeUndefined();
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
      action: 'NOTICE_VIEWED',
      entityType: 'procurement_notice',
      entityId: 'notice-1',
    })}));
  });

  test('lista chunks por id sem expor embedding', async () => {
    const { service, client } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => ({ id: 'notice-1', source: 'pncp' })),
      },
      documentChunk: {
        findMany: jest.fn(async () => [{
          id: 'chunk-1',
          tenantId: null,
          sourceType: 'procurement_notice',
          sourceId: 'notice-1',
          chunkIndex: 0,
          content: 'Resumo do edital',
          tokenCount: 12,
          metadata: { section: 'objeto' },
          createdAt: new Date('2026-06-01T12:00:00Z'),
          embedding: [1, 2, 3],
        }]),
      },
    });

    const result = await service.listChunks('notice-1', { limit: 10 }, context);
    const args = client.documentChunk.findMany.mock.calls[0][0];

    expect(args.where.AND).toEqual(expect.arrayContaining([
      { sourceType: 'procurement_notice', sourceId: 'notice-1' },
    ]));
    expect(result?.data[0]).toMatchObject({ id: 'chunk-1', content: 'Resumo do edital' });
    expect((result?.data[0] as any).embedding).toBeUndefined();
  });

  test('nega rawPayload para usuario comum e audita tentativa', async () => {
    const { service, client, audit, rbac } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => notice()),
      },
    });

    const result = await service.getNoticeById('notice-1', { includeRaw: 'true' }, context);
    const args = client.procurementNotice.findFirst.mock.calls[0][0];

    expect(rbac.hasPermission).toHaveBeenCalledWith('user-1', 'data_platform:admin', null);
    expect(args.select.rawPayload).toBeUndefined();
    expect((result as any).rawPayload).toBeUndefined();
    expect(result).toMatchObject({ rawPayloadIncluded: false });
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
      action: 'NOTICE_RAW_PAYLOAD_DENIED',
      outcome: 'failure',
      entityId: 'notice-1',
    })}));
  });

  test('permite rawPayload para admin e sanitiza conteudo retornado', async () => {
    const { service, client } = serviceWith({
      procurementNotice: {
        findFirst: jest.fn(async () => notice({
          rawPayload: {
            numeroControlePNCP: 'PNCP-001',
            token: 'secret',
          },
        })),
      },
    });

    const result = await service.getNoticeById('notice-1', { includeRaw: true }, {
      ...context,
      user: { ...context.user, isAdmin: true },
    });
    const args = client.procurementNotice.findFirst.mock.calls[0][0];

    expect(args.select.rawPayload).toBe(true);
    expect(result).toMatchObject({
      rawPayloadIncluded: true,
      rawPayload: {
        numeroControlePNCP: 'PNCP-001',
        token: '[redacted]',
      },
    });
  });
});


