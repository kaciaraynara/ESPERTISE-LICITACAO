process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/test_db';

import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

// Mock do Prisma para responder com sucesso
jest.mock('../database/prisma', () => {
  const methodProxy = new Proxy({}, {
    get: (_target: any, prop: string) => {
      return jest.fn().mockImplementation(() => {
        if (prop === 'findUnique' || prop === 'findFirst') {
          return Promise.resolve({
            id: 'user-test-123',
            tenantId: 'tenant-test',
            plano: 'pro',
            role: 'fornecedor',
            cnpj: '00.000.000/0001-91',
          });
        }
        if (prop === 'count') {
          return Promise.resolve(0);
        }
        if (prop === 'findMany') {
          return Promise.resolve([
            {
              id: 'cert-1',
              nome: 'CND Federal',
              status: 'VALIDA',
              validade: new Date(Date.now() + 86400000).toISOString(),
            },
          ]);
        }
        return Promise.resolve([]);
      });
    },
  });

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    company: methodProxy,
    user: methodProxy,
    companyCertificate: methodProxy,
  };

  return {
    prisma: new Proxy(mockPrisma, {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return methodProxy;
      },
    }),
  };
});

// Mock do servico de certidoes
jest.mock('../services/certidoes.service', () => ({
  certidoesService: {
    listarCertidoes: jest.fn().mockResolvedValue([
      {
        id: 'cert-1',
        nome: 'Certidão Negativa de Débitos Federais',
        status: 'VALIDA',
      },
    ]),
  },
  CertidaoArquivoIndisponivelError: class extends Error {},
}));

import routes from '../routes/index';
import authRoutes from '../routes/auth.routes';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_minimum_32_characters_xx';

function createMockResponse(onFinished?: () => void) {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      if (onFinished) onFinished();
      return this;
    },
    send(data: any) {
      this.body = data;
      if (onFinished) onFinished();
      return this;
    },
    end() {
      if (onFinished) onFinished();
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    getHeader(key: string) {
      return this.headers[key.toLowerCase()];
    },
    removeHeader(key: string) {
      delete this.headers[key.toLowerCase()];
      return this;
    },
  };
  return res;
}

describe('Isolamento Estrito de Rate Limit e Proteção de Rotas Internas (/api/certidoes)', () => {
  const token = jwt.sign(
    {
      id: 'user-test-123',
      tenant_id: 'tenant-test',
      email: 'fornecedor@expertise.com',
      plano: 'pro',
      role: 'fornecedor',
      token_type: 'access',
      permissions: ['certidoes:read'],
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  it('deve garantir que routes/index.ts NÃO possui rateLimit registrado no escopo global', () => {
    const hasGlobalRateLimit = routes.stack.some(
      (layer: any) =>
        layer.name === 'rateLimit' ||
        layer.handle?.name === 'rateLimit' ||
        layer.name === 'adminLoginLimiter',
    );
    expect(hasGlobalRateLimit).toBe(false);
  });

  it('deve garantir que authRoutes NÃO possui rateLimit registrado globalmente em todas as rotas', () => {
    // router.use(authRateLimit) aplicaria no topo da stack do authRouter.
    // Com o isolamento estrito, o authRateLimit não existe no router-level
    const hasAuthRouterLevelRateLimit = (authRoutes as any).stack.some(
      (layer: any) =>
        !layer.route &&
        (layer.name === 'rateLimit' || layer.handle?.name === 'rateLimit'),
    );
    expect(hasAuthRouterLevelRateLimit).toBe(false);

    // Verifica que POST /login possui o rate limiter acoplado especificamente
    const loginRouteLayer = (authRoutes as any).stack.find(
      (layer: any) => layer.route && layer.route.path === '/login',
    );
    expect(loginRouteLayer).toBeDefined();
    expect((loginRouteLayer as any)?.route?.methods?.post).toBe(true);

    // /login possui rate limiter + handler (2 middlewares), enquanto /register possui apenas 1 middleware
    const registerRouteLayer = (authRoutes as any).stack.find(
      (layer: any) => layer.route && layer.route.path === '/register',
    );
    expect((loginRouteLayer as any)?.route?.stack?.length).toBeGreaterThan(
      (registerRouteLayer as any)?.route?.stack?.length,
    );
  });

  it('deve executar 50 requisições GET consecutivas para /certidoes sem NUNCA retornar erro 429', async () => {
    const totalRequests = 50;
    const results: number[] = [];

    for (let i = 0; i < totalRequests; i++) {
      await new Promise<void>((resolve) => {
        const mockReq: any = {
          method: 'GET',
          url: '/certidoes',
          originalUrl: '/api/v1/certidoes',
          baseUrl: '/api/v1',
          path: '/certidoes',
          headers: {
            authorization: `Bearer ${token}`,
            host: 'localhost:3001',
          },
          query: {},
          params: {},
          body: {},
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        };

        const mockRes = createMockResponse(() => {
          results.push(mockRes.statusCode);
          expect(mockRes.statusCode).not.toBe(429);
          if (mockRes.body) {
            expect(mockRes.body.code).not.toBe('USER_RATE_LIMIT_EXCEEDED');
            expect(mockRes.body.code).not.toBe('TOO_MANY_REQUESTS');
            expect(mockRes.body.code).not.toBe('AUTH_RATE_LIMIT_EXCEEDED');
          }
          resolve();
        });

        (routes as any).handle(mockReq, mockRes, (err?: any) => {
          if (err) {
            mockRes.status(500).json({ error: err.message });
          } else {
            resolve();
          }
        });
      });
    }

    // Nenhuma das 50 requisições pode ter sido bloqueada por limite de requisições
    const erro429Count = results.filter((code) => code === 429).length;
    expect(erro429Count).toBe(0);
    expect(results.length).toBe(totalRequests);
  }, 15000);
});
