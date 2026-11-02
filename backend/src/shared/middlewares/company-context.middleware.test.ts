import jwt from 'jsonwebtoken';
import {
  AuthRequest,
  authMiddleware,
  companyContextMiddleware,
  resolveAuthorizedCompany,
} from './auth.middleware';
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

function authenticatedRequest(headers: Record<string, string> = {}) {
  const token = sign({
    id: 'user-1',
    tenant_id: 'tenant-1',
    email: 'user@test.com',
    plano: 'basic',
    company_id: 'company-1',
    token_type: 'access',
  });

  return {
    headers: { authorization: `Bearer ${token}`, ...headers },
    body: {},
    query: {},
    params: {},
  } as AuthRequest;
}

describe('companyContextMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('valida a empresa ativa com userId e tenantId antes de continuar', async () => {
    (prisma.company.findFirst as jest.Mock).mockResolvedValue({ id: 'company-1' });
    const req = authenticatedRequest({ 'x-company-id': 'company-1' });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, jest.fn());
    await companyContextMiddleware(req, res, next);

    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { id: 'company-1', userId: 'user-1', tenantId: 'tenant-1' },
    });
    expect(req.companyId).toBe('company-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejeita empresa não pertencente ao usuário, sem selecionar outra como fallback', async () => {
    (prisma.company.findFirst as jest.Mock).mockResolvedValue(null);
    const req = authenticatedRequest({ 'x-company-id': 'company-other' });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, jest.fn());
    await companyContextMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'COMPANY_ACCESS_DENIED',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejeita IDs de empresa conflitantes na seleção ativa e no payload', async () => {
    const req = authenticatedRequest({ 'x-company-id': 'company-1' });
    req.body = { companyId: 'company-2' };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, jest.fn());
    await companyContextMiddleware(req, res, next);

    expect(prisma.company.findFirst).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'COMPANY_CONTEXT_MISMATCH',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('não troca silenciosamente para a empresa principal quando o ID preferido é inválido', async () => {
    (prisma.company.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(resolveAuthorizedCompany('user-1', 'company-other')).resolves.toBeNull();

    expect(prisma.company.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { id: 'company-other', userId: 'user-1' },
    });
  });
});
