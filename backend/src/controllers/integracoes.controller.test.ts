jest.mock('../database/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

import axios from 'axios';
import { prisma } from '../database/prisma';
import { IntegracoesController } from './integracoes.controller';

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('IntegracoesController (Etapa 3)', () => {
  const originalEnv = { ...process.env };
  const queryRawMock = (prisma as any).$queryRawUnsafe as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.PORTAL_TRANSPARENCIA_TOKEN;
    delete process.env.PORTAL_TRANSPARENCIA_KEY;
    delete process.env.TRANSPARENCIA_API_KEY;
    delete process.env.TRANSPARENCIA_TOKEN;
    delete process.env.CGU_API_KEY;
    delete process.env.TRANSPARENCIA_API_TOKEN;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('health() envia User-Agent e published_since no Querido Diário e mapeia fallback/403/503 com honestidade', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockImplementation(async (url: string, config?: any) => {
      if (url.includes('modulo-contratacoes')) {
        return { status: 403, data: {} } as any;
      }
      if (url.includes('pncp.gov.br')) {
        expect(config?.headers?.['User-Agent']).toBe('EXPERTISE-SaaS/1.0');
        return { status: 200, data: { data: [] } } as any;
      }
      if (url.includes('/gazettes')) {
        expect(url).toContain('published_since=');
        expect(config?.headers?.['User-Agent']).toBe('EXPERTISE-SaaS/1.0');
        const err: any = new Error('timeout of 10000ms exceeded');
        err.code = 'ECONNABORTED';
        throw err;
      }
      if (url.includes('/cities')) {
        return { status: 200, data: { cities: [] } } as any;
      }
      if (url.includes('brasilapi.com.br')) {
        const err: any = new Error('Service Unavailable');
        err.code = 'ERR_BAD_RESPONSE';
        throw err;
      }
      return { status: 200, data: {} } as any;
    });

    const controller = new IntegracoesController();
    const res = makeRes();

    await controller.health({} as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const byId = Object.fromEntries((res.body.data as any[]).map((x) => [x.id, x]));

    expect(byId.PNCP).toMatchObject({ ok: true, mensagem: 'Operante' });
    expect(byId['COMPRAS.GOV']).toMatchObject({ ok: false, mensagem: 'HTTP 403' });
    expect(byId['CATMAT / CATSER']).toMatchObject({ ok: true, mensagem: 'Operante' });
    expect(byId['TCU (APF / INIDÔNEOS)']).toMatchObject({ ok: true, mensagem: 'Operante' });
    expect(byId['BANCO CENTRAL (SGS)']).toMatchObject({ ok: true, mensagem: 'Operante' });
    expect(byId['QUERIDO DIÁRIO']).toMatchObject({
      ok: true,
      mensagem: 'Operante (índice de diários com resposta lenta)',
    });
    expect(byId['RECEITA / CNPJ']).toMatchObject({ ok: false, mensagem: 'ERR_BAD_RESPONSE' });
    expect(byId['TRANSPARÊNCIA (CGU)']).toMatchObject({ ok: false, mensagem: 'Chave não configurada' });
    expect(getSpy).toHaveBeenCalled();
  });

  test('consultarSicaf() retorna 400 para CNPJ invalido', async () => {
    const controller = new IntegracoesController();
    const res = makeRes();
    await controller.consultarSicaf({ params: { cnpj: '123' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'CNPJ_INVALID' });
  });

  test('indicesEconomicos() retorna IPCA, IGP-M e SELIC calculados do BCB SGS', async () => {
    jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
      if (url.includes('433')) {
        return { status: 200, data: [{ data: '01/10/2026', valor: '0.50' }] } as any;
      }
      if (url.includes('189')) {
        return { status: 200, data: [{ data: '01/10/2026', valor: '0.40' }] } as any;
      }
      if (url.includes('432')) {
        return { status: 200, data: [{ data: '01/11/2026', valor: '11.25' }] } as any;
      }
      return { status: 404, data: [] } as any;
    });

    const controller = new IntegracoesController();
    const res = makeRes();
    await controller.indicesEconomicos({} as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.selic.metaAnual).toBe(11.25);
    expect(res.body.data.ipca.acumulado12m).toBe(0.5);
  });

  test('health() reporta Timeout (>10s) no Querido Diário quando gazettes e cities falham', async () => {
    jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/gazettes') || url.includes('/cities')) {
        const err: any = new Error('timeout of 10000ms exceeded');
        err.code = 'ECONNABORTED';
        throw err;
      }
      return { status: 200, data: {} } as any;
    });

    const controller = new IntegracoesController();
    const res = makeRes();
    await controller.health({} as any, res);

    const qd = (res.body.data as any[]).find((x) => x.id === 'QUERIDO DIÁRIO');
    expect(qd).toMatchObject({ ok: false, mensagem: 'Timeout (>10s)' });
  });

  test('telemetria() agrega resumo por fonte, cursores de varredura e jobs recentes', async () => {
    queryRawMock
      .mockResolvedValueOnce([
        {
          source: 'PNCP',
          total: 40000,
          abertos: 18000,
          novos_24h: 1200,
          ultima_publicacao: '2026-11-22T14:00:00.000Z',
          ultima_atualizacao: '2026-11-22T15:00:00.000Z',
        },
        {
          source: 'querido_diario',
          total: 180,
          abertos: 180,
          novos_24h: 35,
          ultima_publicacao: '2026-11-22T12:00:00.000Z',
          ultima_atualizacao: '2026-11-22T14:30:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          source: 'PNCP',
          cursor_key: 'proposta_sweep_mod_6',
          cursor_value: { modalidadeCodigo: 6, progressPct: 45, nextPage: 20, totalPages: 44 },
          last_synced_at: '2026-11-22T15:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'job-1',
          source: 'PNCP',
          connector: 'syncPncpPropostasAbertas',
          status: 'completed',
          records_seen: 500,
          records_accepted: 495,
          records_failed: 5,
          error_message: null,
          finished_at: '2026-11-22T15:00:00.000Z',
        },
      ]);

    const controller = new IntegracoesController();
    const res = makeRes();

    await controller.telemetria({} as any, res);

    expect(queryRawMock).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        resumo: {
          totalEditais: 40180,
          totalAbertos: 18180,
          novos24h: 1235,
          ultimaSincronizacao: '2026-11-22T15:00:00.000Z',
        },
        fontes: [
          {
            source: 'PNCP',
            total: 40000,
            abertos: 18000,
            novos24h: 1200,
            ultimaPublicacao: '2026-11-22T14:00:00.000Z',
            ultimaAtualizacao: '2026-11-22T15:00:00.000Z',
          },
          {
            source: 'querido_diario',
            total: 180,
            abertos: 180,
            novos24h: 35,
            ultimaPublicacao: '2026-11-22T12:00:00.000Z',
            ultimaAtualizacao: '2026-11-22T14:30:00.000Z',
          },
        ],
        cursores: [
          {
            source: 'PNCP',
            cursorKey: 'proposta_sweep_mod_6',
            cursorValue: { modalidadeCodigo: 6, progressPct: 45, nextPage: 20, totalPages: 44 },
            lastSyncedAt: '2026-11-22T15:00:00.000Z',
          },
        ],
        jobs: [
          {
            id: 'job-1',
            source: 'PNCP',
            connector: 'syncPncpPropostasAbertas',
            status: 'completed',
            recordsSeen: 500,
            recordsAccepted: 495,
            recordsFailed: 5,
            errorMessage: null,
            finishedAt: '2026-11-22T15:00:00.000Z',
          },
        ],
      },
    });
  });
});
