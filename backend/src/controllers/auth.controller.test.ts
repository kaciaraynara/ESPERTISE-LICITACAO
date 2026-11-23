import request from 'supertest';
import express from 'express';
import { AuthController } from './auth.controller';

const app = express();
app.use(express.json());

const authController = new AuthController();
app.post('/auth/register', authController.register.bind(authController));
app.post('/auth/login', authController.login.bind(authController));
app.post('/auth/refresh', authController.refresh.bind(authController));

jest.mock('../database/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    }
  };
});
jest.mock('../services/auth-operations.service', () => ({
  authOperationsService: {
    registerUser: jest.fn().mockResolvedValue({
      publicUser: { id: '1', email: 'test@example.com', role: 'fornecedor' },
      tokens: { accessToken: 'acc', refreshToken: 'ref', accessExpiresAt: new Date(), refreshExpiresAt: new Date() }
    }),
    loginUser: jest.fn().mockResolvedValue({
      publicUser: { id: '1', email: 'test@example.com', role: 'fornecedor' },
      tokens: { accessToken: 'acc', refreshToken: 'ref', accessExpiresAt: new Date(), refreshExpiresAt: new Date() }
    })
  }
}));

jest.mock('../services/auth.service', () => ({
  logAuthEvent: jest.fn(),
  normalizeAuthEmail: jest.fn((e) => e)
}));

describe('AuthController', () => {
  it('should register a user', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test@example.com',
      senha: 'Password123!',
      nome: 'Test',
      telefone: '12345678910',
      cnpj: '12345678901234',
      razao_social: 'Test LTDA',
      aceite_lgpd: true
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('acc');
  });

  it('should login a user', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'test@example.com',
      senha: 'Password123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('acc');
  });

  it('should anonymize PII and clear refresh tokens on deleteUserAccount (LGPD)', async () => {
    const { AuthOperationsService } = jest.requireActual('../services/auth-operations.service');
    const { prisma } = require('../database/prisma');
    const mockTxUserUpdate = jest.fn().mockResolvedValue({});
    const mockTxRefreshDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    prisma.$transaction = jest.fn(async (cb: any) =>
      cb({
        user: { update: mockTxUserUpdate },
        refreshToken: { deleteMany: mockTxRefreshDeleteMany },
      }),
    );

    const realService = new AuthOperationsService();
    await realService.deleteUserAccount('user-lgpd-1');

    expect(mockTxUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-lgpd-1' },
        data: expect.objectContaining({
          email: 'anon-user-lgpd-1@privacy.invalid',
          emailNormalized: 'anon-user-lgpd-1@privacy.invalid',
          nome: null,
          telefone: null,
          deletedAt: expect.any(Date),
          anonymizedAt: expect.any(Date),
        }),
      }),
    );
    expect(mockTxRefreshDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user-lgpd-1' } });
  });
});
