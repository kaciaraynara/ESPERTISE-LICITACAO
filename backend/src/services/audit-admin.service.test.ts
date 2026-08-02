import { AuditAdminService, sanitizeAuditMetadata } from './audit-admin.service';

function serviceWith(client: any) {
  return new AuditAdminService(client);
}

describe('AuditAdminService', () => {
  test('lista eventos com filtros, paginacao e metadata sanitizada', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'audit-1',
        userId: 'user-1',
        scope: 'data_platform_admin',
        action: 'RUN_PNCP_INGESTION',
        outcome: 'success',
        entityType: null,
        entityId: null,
        requestId: 'req-1',
        metadata: {
          token: 'secret',
          nested: { ip: '127.0.0.1', safe: 'ok' },
        },
        createdAt: new Date('2026-06-05T12:00:00Z'),
      },
      {
        id: 'audit-2',
        userId: 'user-1',
        scope: 'data_platform_admin',
        action: 'REQUEUE_FAILED_TASKS',
        outcome: 'success',
        entityType: null,
        entityId: null,
        requestId: 'req-2',
        metadata: {},
        createdAt: new Date('2026-06-05T12:01:00Z'),
      },
    ]);
    const service = serviceWith({ auditEvent: { findMany } });

    const result = await service.listEvents({
      scope: 'data_platform_admin',
      action: 'RUN_PNCP_INGESTION',
      outcome: 'success',
      userId: 'user-1',
      entity: 'job-1',
      from: '2026-06-05T00:00:00Z',
      to: '2026-06-06T00:00:00Z',
      limit: 1,
      offset: 0,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        scope: 'data_platform_admin',
        action: 'RUN_PNCP_INGESTION',
        outcome: 'success',
        userId: 'user-1',
        OR: [{ entityType: 'job-1' }, { entityId: 'job-1' }],
      }),
      take: 2,
      select: expect.not.objectContaining({
        ipHash: true,
        emailHash: true,
        userAgentHash: true,
      }),
    }));
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ limit: 1, offset: 0, hasMore: true, nextOffset: 1 });
    expect((result.data[0] as any).metadata).toMatchObject({
      token: '[redacted]',
      nested: { ip: '[redacted]', safe: 'ok' },
    });
    expect(result.data[0]).not.toHaveProperty('ipHash');
    expect(result.data[0]).not.toHaveProperty('emailHash');
    expect(result.data[0]).not.toHaveProperty('userAgentHash');
  });

  test('sanitiza metadata sensivel de forma recursiva', () => {
    expect(sanitizeAuditMetadata({
      authorization: 'bearer secret',
      safe: 'ok',
      nested: { email: 'admin@expertise.test', count: 1 },
    })).toEqual({
      authorization: '[redacted]',
      safe: 'ok',
      nested: { email: '[redacted]', count: 1 },
    });
  });

  test('metricas agregam scope, outcome, acoes administrativas, falhas e periodo', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([{ scope: 'rbac_admin', _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ outcome: 'failure', _count: { _all: 1 } }]);
    const count = jest.fn(async () => 3);
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{
        id: 'audit-1',
        userId: 'admin-1',
        scope: 'rbac_admin',
        action: 'RBAC_ASSIGN_ROLE',
        outcome: 'success',
        entityType: 'user_role',
        entityId: 'assignment-1',
        requestId: 'req-1',
        metadata: { token: 'secret' },
        createdAt: new Date('2026-06-05T12:00:00Z'),
      }])
      .mockResolvedValueOnce([{
        id: 'audit-2',
        userId: 'user-1',
        scope: 'audit_admin',
        action: 'AUTHORIZATION_FAILED',
        outcome: 'failure',
        entityType: 'permission',
        entityId: 'audit:read',
        requestId: 'req-2',
        metadata: { permission: 'audit:read' },
        createdAt: new Date('2026-06-05T13:00:00Z'),
      }])
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-06-05T13:00:00Z') },
        { createdAt: new Date('2026-06-05T14:00:00Z') },
        { createdAt: new Date('2026-06-06T14:00:00Z') },
      ]);
    const service = serviceWith({ auditEvent: { groupBy, count, findMany } });

    const result = await service.getMetrics({ from: '2026-06-05T00:00:00Z' });

    expect(result.eventsByScope).toEqual([{ scope: 'rbac_admin', count: 2 }]);
    expect(result.eventsByOutcome).toEqual([{ outcome: 'failure', count: 1 }]);
    expect(result.recentAdminActions[0]).toMatchObject({ action: 'RBAC_ASSIGN_ROLE' });
    expect(result.authorizationFailures).toMatchObject({ count: 3 });
    expect(result.eventsByPeriod).toEqual([
      { period: '2026-06-05', count: 2 },
      { period: '2026-06-06', count: 1 },
    ]);
  });
});
