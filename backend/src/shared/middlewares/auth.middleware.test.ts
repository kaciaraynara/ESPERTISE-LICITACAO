import jwt from 'jsonwebtoken';
import {
  authMiddleware,
  AuthRequest,
  companyContextMiddleware,
  invalidateCompanyContextCache,
} from './auth.middleware';
import { requireRole } from './role.middleware';
import { prisma } from '../../database/prisma';

jest.mock('../../database/prisma', () => ({
  prisma: {
    company: {
      findFirst: jest.fn(),
    },
  },
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function sign(payload: Record<string, unknown>) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '15m' });
}

describe('authMiddleware', () => {
  test('aceita access token em cookie HttpOnly', () => {
    const token = sign({
      id: 'user-1',
      tenant_id: 'tenant-1',
      email: 'user@test.com',
      plano: 'pro',
      token_type: 'access',
      role: 'fornecedor',
    });
    const req = { headers: { cookie: `expertise_access_token=${token}` } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.id).toBe('user-1');
    expect(req.user?.tenantId).toBe('tenant-1');
  });

  test('recusa refresh token em rota protegida', () => {
    const token = sign({
      id: 'user-1',
      tenant_id: 'tenant-1',
      email: 'user@test.com',
      plano: 'pro',
      token_type: 'refresh',
    });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = mockRes();

    authMiddleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireRole', () => {
  test('bloqueia usuario com role insuficiente', () => {
    const req = {
      user: {
        id: '1',
        tenantId: 'tenant-1',
        email: 'a@b.com',
        plano: 'free',
        role: 'invalid_role' as any,
      },
    } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    requireRole('fornecedor')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('companyContextMiddleware (cache + anti-IDOR)', () => {
  const mockFindFirst = prisma.company.findFirst as jest.Mock;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCompanyContextCache();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    invalidateCompanyContextCache();
  });

  test('reutiliza cache multi-tenant e preserva bloqueio 403 anti-IDOR', async () => {
    process.env.NODE_ENV = 'production';
    mockFindFirst.mockResolvedValueOnce({ id: 'comp-ok' });

    const req1 = {
      headers: { 'x-company-id': 'comp-ok' },
      query: {},
      user: { id: 'u1', tenantId: 't1', email: 'u1@test.com', plano: 'pro' },
    } as unknown as AuthRequest;
    const next1 = jest.fn();
    await companyContextMiddleware(req1, mockRes(), next1);
    expect(next1).toHaveBeenCalledTimes(1);
    expect(req1.companyId).toBe('comp-ok');

    // Segunda chamada usa cache (0 queries adicionais)
    const req2 = {
      headers: { 'x-company-id': 'comp-ok' },
      query: {},
      user: { id: 'u1', tenantId: 't1', email: 'u1@test.com', plano: 'pro' },
    } as unknown as AuthRequest;
    const next2 = jest.fn();
    await companyContextMiddleware(req2, mockRes(), next2);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(req2.companyId).toBe('comp-ok');
    expect(mockFindFirst).toHaveBeenCalledTimes(1);

    // Tentativa IDOR de outro usuário para comp-ok é bloqueada com 403
    mockFindFirst.mockResolvedValueOnce(null);
    const reqIdor = {
      headers: { 'x-company-id': 'comp-ok' },
      query: {},
      user: { id: 'u-attacker', tenantId: 't-attacker', email: 'att@test.com', plano: 'pro' },
    } as unknown as AuthRequest;
    const resIdor = mockRes();
    const nextIdor = jest.fn();
    await companyContextMiddleware(reqIdor, resIdor, nextIdor);
    expect(nextIdor).not.toHaveBeenCalled();
    expect(resIdor.status).toHaveBeenCalledWith(403);
  });
});
