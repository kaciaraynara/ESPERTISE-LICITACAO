import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

describe('auth audit log', () => {
  let warnSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.resetModules();
    process.env.DATABASE_URL = '';
    process.env.ENABLE_JSON_FALLBACK = 'true';
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'expertise-audit-'));
    process.env.APP_DATA_FILE = path.join(dir, 'app-state.json');
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  test('logAuthEvent should correctly hash PII data', async () => {
    const mockAuditEvents: any[] = [];
    const auditClient = {
      auditEvent: {
        create: jest.fn(async (args: any) => {
          mockAuditEvents.push(args.data);
          return args.data;
        }),
      },
    };
    jest.doMock('../database/prisma', () => ({
      prisma: auditClient,
      getPrismaClient: () => auditClient,
    }));
    const { logAuthEvent } = require('./auth.service');

    await logAuthEvent('LOGIN_FAILED', {
      email: '  Maria@Teste.com ',
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0 ExpertiseTest',
      reason: 'password_mismatch',
      requestId: 'req-audit-1',
      role: 'fornecedor',
    });

    const event = mockAuditEvents[0];

    expect(event.scope).toBe('auth');
    expect(event.action).toBe('LOGIN_FAILED');
    expect(event.outcome).toBe('failure');
    expect(event.requestId).toBe('req-audit-1');
    expect(event.metadata).toEqual({ role: 'fornecedor', reason: 'password_mismatch' });
    expect(event.emailHash).toHaveLength(64);
    expect(event.ipHash ?? event.ip_hash).toHaveLength(64);
    expect(event.userAgentHash ?? event.user_agent_hash).toHaveLength(64);

    const serialized = JSON.stringify(mockAuditEvents);
    expect(serialized).not.toContain('Maria@Teste.com');
    expect(serialized).not.toContain('maria@teste.com');
    expect(serialized).not.toContain('203.0.113.10');
    expect(serialized).not.toContain('Mozilla/5.0 ExpertiseTest');
  });
});
