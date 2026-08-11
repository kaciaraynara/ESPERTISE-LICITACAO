import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from './auth.middleware';
import { requireRole } from './role.middleware';

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
