import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

jest.setTimeout(30000);

function mockReq(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return { body, headers } as any;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockImplementation((payload) => {
    res.body = payload;
    return res;
  });
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

function getCookieValue(res: any, name: string) {
  const call = res.cookie.mock.calls.find(([cookieName]: [string]) => cookieName === name);
  return call?.[1] as string | undefined;
}

describe('AuthController', () => {
  afterAll(async () => {
    const { disconnectPrisma } = require('../database/prisma');
    await disconnectPrisma();
  });

  beforeEach(async () => {
    jest.resetModules();
    process.env.DATABASE_URL = '';
    process.env.ENABLE_JSON_FALLBACK = 'true';
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'expertise-auth-'));
    process.env.APP_DATA_FILE = path.join(dir, 'app-state.json');
    const mockUsers: any[] = [];
    const mockRefreshTokens: any[] = [];
    jest.doMock('../database/prisma', () => {
      const database: any = {
        user: {
          create: jest.fn(async (args: any) => {
            const user = {
              id: String(mockUsers.length + 1),
              createdAt: new Date(),
              updatedAt: new Date(),
              emailVerificado: false,
              deletedAt: null,
              ...args.data,
            };
            mockUsers.push(user);
            return user;
          }),
          findUnique: jest.fn(async (args: any) => {
            if (args.where.id) {
              return mockUsers.find((user) => user.id === args.where.id) || null;
            }
            if (args.where.emailNormalized) {
              return mockUsers.find(
                (user) => user.emailNormalized === args.where.emailNormalized,
              ) || null;
            }
            return null;
          }),
          update: jest.fn(async (args: any) => {
            const index = mockUsers.findIndex((user) => user.id === args.where.id);
            if (index !== -1) {
              mockUsers[index] = { ...mockUsers[index], ...args.data };
            }
            return mockUsers[index];
          }),
        },
        refreshToken: {
          create: jest.fn(async (args: any) => {
            const row = {
              id: `refresh-${mockRefreshTokens.length + 1}`,
              createdAt: new Date(),
              lastUsedAt: new Date(),
              ...args.data,
            };
            mockRefreshTokens.push(row);
            return row;
          }),
          findUnique: jest.fn(async (args: any) => {
            const key = args.where.userId_tokenHash;
            return mockRefreshTokens.find(
              (token) => token.userId === key.userId && token.tokenHash === key.tokenHash,
            ) || null;
          }),
          deleteMany: jest.fn(async (args: any) => {
            const before = mockRefreshTokens.length;
            const where = args.where ?? {};
            const matches = (token: any) => {
              if (Array.isArray(where.OR)) {
                return where.OR.some((condition: any) =>
                  condition.userId === token.userId
                  || (condition.expiresAt?.lte && token.expiresAt <= condition.expiresAt.lte));
              }
              if (where.id && token.id !== where.id) return false;
              if (where.userId && token.userId !== where.userId) return false;
              if (where.tokenHash && token.tokenHash !== where.tokenHash) return false;
              return true;
            };
            const remaining = mockRefreshTokens.filter((token) => !matches(token));
            mockRefreshTokens.splice(0, mockRefreshTokens.length, ...remaining);
            return { count: before - remaining.length };
          }),
        },
        auditEvent: {
          create: jest.fn(async (args: any) => args.data),
        },
        tenant: {
          create: jest.fn(async (args: any) => ({
            id: `tenant-${mockUsers.length + 1}`,
            ...args.data,
          })),
        },
        company: {
          create: jest.fn(async (args: any) => ({
            id: `company-${mockUsers.length}`,
            ...args.data,
          })),
        },
        notification: {
          create: jest.fn(async (args: any) => args.data),
        },
        subscription: {
          findFirst: jest.fn(async () => null),
        },
      };
      database.$transaction = jest.fn(async (callback: any) => callback(database));

      return {
        prisma: database,
        getPrismaClient: () => database,
        disconnectPrisma: jest.fn(),
      };
    });
    jest.doMock('../services/cnpj.service', () => ({
      consultarCnpjOficial: jest.fn(async (cnpj: string) => ({
        cnpj: String(cnpj).replace(/\D/g, ''),
        razao_social: 'Maria Tecnologia LTDA',
        nome_fantasia: 'Maria Tecnologia',
        cnae_principal: '6201-5/01',
        municipio: 'Fortaleza',
        uf: 'CE',
        status: 'ATIVA',
      })),
    }));
  });

  async function registerFornecedor(controller: any, overrides: Record<string, unknown> = {}) {
    const registerRes = mockRes();
    await controller.register(mockReq({
      nome: 'Maria Silva',
      cnpj: '11222333000181',
      razao_social: 'Maria Tecnologia LTDA',
      email: 'maria@teste.com',
      senha: 'Senha123',
      aceite_lgpd: true,
      role: 'fornecedor',
      ...overrides,
    }), registerRes);
    return registerRes;
  }

  test('registra, autentica e renova refresh token persistido', async () => {
    const { AuthController, REFRESH_COOKIE_NAME } = require('./auth.controller');
    const controller = new AuthController();
    const registerRes = await registerFornecedor(controller);

    expect(registerRes.status).toHaveBeenCalledWith(201);
    expect(registerRes.body.data.user.email).toBe('maria@teste.com');
    expect(registerRes.body.data.refreshToken).toBeUndefined();
    expect(getCookieValue(registerRes, REFRESH_COOKIE_NAME)).toBeTruthy();

    const loginRes = mockRes();
    await controller.login(mockReq({ email: 'maria@teste.com', senha: 'Senha123' }), loginRes);

    expect(loginRes.body.data.accessToken).toBeTruthy();

    const refreshToken = getCookieValue(loginRes, REFRESH_COOKIE_NAME);
    const refreshRes = mockRes();
    await controller.refresh(mockReq({}, { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` }), refreshRes);

    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
    expect(refreshRes.body.data.refreshToken).toBeUndefined();
  });

  test('bloqueia cadastro duplicado com email case-insensitive', async () => {
    const { AuthController } = require('./auth.controller');
    const controller = new AuthController();

    const first = await registerFornecedor(controller, { email: 'Maria@Teste.com' });
    expect(first.status).toHaveBeenCalledWith(201);
    expect(first.body.data.user.email).toBe('maria@teste.com');

    const duplicated = await registerFornecedor(controller, { email: '  maria@teste.com  ' });
    expect(duplicated.status).toHaveBeenCalledWith(409);
    expect(duplicated.body.message).toBe('Já existe uma conta com este email.');
  });

  test('login aceita email com caixa diferente e espacos', async () => {
    const { AuthController } = require('./auth.controller');
    const controller = new AuthController();

    await registerFornecedor(controller, { email: 'Case@Teste.com' });

    const loginRes = mockRes();
    await controller.login(mockReq({ email: '  case@teste.com ', senha: 'Senha123' }), loginRes);

    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.email).toBe('case@teste.com');
    expect(loginRes.body.data.accessToken).toBeTruthy();
  });

  test('login invalido retorna mensagem amigavel sem stack trace', async () => {
    const { AuthController } = require('./auth.controller');
    const controller = new AuthController();

    await registerFornecedor(controller);

    const wrongPassword = mockRes();
    await controller.login(mockReq({ email: 'maria@teste.com', senha: 'SenhaErrada123' }), wrongPassword);

    expect(wrongPassword.status).toHaveBeenCalledWith(401);
    expect(wrongPassword.body).toEqual({ success: false, message: 'Email ou senha incorretos.' });
    expect(JSON.stringify(wrongPassword.body)).not.toContain('stack');

    const unknownUser = mockRes();
    await controller.login(mockReq({ email: 'ninguem@teste.com', senha: 'Senha123' }), unknownUser);

    expect(unknownUser.status).toHaveBeenCalledWith(401);
    expect(unknownUser.body).toEqual({ success: false, message: 'Email ou senha incorretos.' });
  });

  test('logout revoga refresh token e sessao expirada nao renova', async () => {
    const { AuthController, REFRESH_COOKIE_NAME } = require('./auth.controller');
    const controller = new AuthController();

    await registerFornecedor(controller);

    const loginRes = mockRes();
    await controller.login(mockReq({ email: 'maria@teste.com', senha: 'Senha123' }), loginRes);
    const refreshToken = getCookieValue(loginRes, REFRESH_COOKIE_NAME);
    expect(refreshToken).toBeTruthy();

    const logoutRes = mockRes();
    await controller.logout(mockReq({}, { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` }), logoutRes);

    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.clearCookie).toHaveBeenCalled();

    const refreshRes = mockRes();
    await controller.refresh(mockReq({}, { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` }), refreshRes);

    expect(refreshRes.status).toHaveBeenCalledWith(401);
    expect(refreshRes.body.message).toBe('Refresh token inválido ou expirado.');
  });

  test('refresh token invalido limpa cookies', async () => {
    const { AuthController } = require('./auth.controller');
    const controller = new AuthController();
    const refreshRes = mockRes();

    await controller.refresh(mockReq({ refreshToken: 'token-invalido' }), refreshRes);

    expect(refreshRes.status).toHaveBeenCalledWith(401);
    expect(refreshRes.clearCookie).toHaveBeenCalled();
    expect(refreshRes.body.message).toBe('Refresh token inválido ou expirado.');
  });

  test('falha com 503 quando o CNPJ nao pode ser validado oficialmente', async () => {
    const cnpjService = require('../services/cnpj.service');
    cnpjService.consultarCnpjOficial.mockRejectedValueOnce(new Error('offline'));
    const { AuthController } = require('./auth.controller');
    const controller = new AuthController();

    const registerRes = await registerFornecedor(controller);

    expect(registerRes.status).toHaveBeenCalledWith(503);
    expect(registerRes.body).toEqual({
      success: false,
      code: 'CNPJ_SERVICE_UNAVAILABLE',
      message: 'Não foi possível validar o CNPJ na fonte oficial. Tente novamente em instantes.',
    });
  });

  test('cria um tenant exclusivo para cada nova conta', async () => {
    const { AuthController } = require('./auth.controller');
    const { prisma } = require('../database/prisma');
    const controller = new AuthController();

    await registerFornecedor(controller);
    await registerFornecedor(controller, {
      email: 'segunda@teste.com',
      cnpj: '99888777000166',
    });

    expect(prisma.tenant.create).toHaveBeenCalledTimes(2);
    const tenantIds = prisma.user.create.mock.calls.map(
      ([args]: [any]) => args.data.tenantId,
    );
    expect(new Set(tenantIds).size).toBe(2);
    expect(prisma.company.create.mock.calls[0][0].data.tenantId).toBe(tenantIds[0]);
    expect(prisma.company.create.mock.calls[1][0].data.tenantId).toBe(tenantIds[1]);
  });

  test('cadastro publico nao permite criar perfil privilegiado', async () => {
    const { AuthController } = require('./auth.controller');
    const { prisma } = require('../database/prisma');
    const controller = new AuthController();

    const response = await registerFornecedor(controller, {
      role: 'advogado',
      oab_numero: '12345',
      oab_uf: 'CE',
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});



