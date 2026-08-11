import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../src/server'; // Aponta para o server.ts onde o app é exportado

describe('API Integration Tests - Health & Validation', () => {
  it('Deve retornar 200 no health check com o header X-Request-ID presente', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('Deve rejeitar requisição sem autenticação ou payload inválido nas propostas', async () => {
    const response = await request(app)
      .post('/api/v1/propostas')
      .send({});

    expect([401, 400]).toContain(response.status);
    expect(response.body.success).toBe(false);
    expect(response.body.requestId).toBeDefined();
  });
});