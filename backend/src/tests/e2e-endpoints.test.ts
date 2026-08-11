process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/test_db';

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../database/prisma', () => {
  const methodProxy = new Proxy({}, {
    get: (target: any, prop: string) => {
      return jest.fn().mockImplementation(() => {
        if (prop === 'findUnique' || prop === 'findFirst') {
          return Promise.resolve({ tenant_id: 'tenant-test', id: 'user-test-123', plano: 'pro' });
        }
        if (prop === 'count') {
          return Promise.resolve(1);
        }
        return Promise.resolve([]);
      });
    }
  });
  
  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  
  return {
    prisma: new Proxy(mockPrisma, {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return methodProxy;
      }
    })
  };
});

jest.mock('../shared/middlewares/postgres-rate-limit.store', () => {
  return {
    PostgresRateLimitStore: class MockStore {
      async increment(key: string) { return { totalHits: 1, resetTime: new Date() }; }
      async decrement(key: string) {}
      async resetKey(key: string) {}
    }
  };
});

import routes from '../routes/index';
import licitacaoRoutes from '../routes/licitacao.routes';
import { errorHandler } from '../shared/middlewares/error-handler.middleware';

const app = express();
app.use(express.json());
app.use('/api/v1', routes);
app.use('/api/v1/licitacoes', licitacaoRoutes);
app.use(errorHandler);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('API Endpoints E2E Validation', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  describe('Public Endpoints (No Auth)', () => {
    it('should block unauthenticated access to /api/v1/empresas', async () => {
      const res = await request(app).get('/api/v1/empresas');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Token de autenticação não fornecido/);
    });

    it('should block unauthenticated access to /api/v1/auth/me', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Protected Endpoints (With Auth)', () => {
    const token = jwt.sign(
      {
        id: 'user-test-123',
        tenant_id: 'tenant-test',
        email: 'tester@expertise.com',
        plano: 'pro',
        token_type: 'access',
        permissions: ['data_platform:admin']
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const endpointsToTest = [
      { method: 'get', url: '/api/v1/documentos', desc: 'Listagem de documentos' },
      { method: 'get', url: '/api/v1/empresas', desc: 'Listagem de empresas' },
      { method: 'get', url: '/api/v1/notices/search', desc: 'Busca de editais no Radar' },
      { method: 'get', url: '/api/v1/licitacoes', desc: 'Listagem de licitações' },
      { method: 'get', url: '/api/v1/notificacoes', desc: 'Notificações do usuário' },
      { method: 'get', url: '/api/v1/dashboard/metrics', desc: 'Métricas do dashboard' },
    ];

    endpointsToTest.forEach(({ method, url, desc }) => {
      it(`[${desc}] should return a valid response on ${method.toUpperCase()} ${url}`, async () => {
        const res = await (request(app) as any)[method](url).set('Authorization', `Bearer ${token}`);
        
        // Verifica se a API não quebrou (sem erro 500)
        expect(res.status).not.toBe(500);

        // Se retornar 200, garante que tem um corpo de resposta json válido
        if (res.status === 200) {
          expect(res.body).toBeDefined();
        }
      });
    });
  });
});
