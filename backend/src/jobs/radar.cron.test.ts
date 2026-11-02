jest.mock('../database/prisma', () => ({
  prisma: {
    procurementNotice: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../services/pncp.service', () => ({
  buscarContratacoesPNCP: jest.fn(),
  PncpServiceError: class PncpServiceError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
      super(message);
      this.name = 'PncpServiceError';
    }
  },
}));

import { prisma } from '../database/prisma';
import { buscarContratacoesPNCP } from '../services/pncp.service';
import { fetchWithBackoff, syncPncpLast24Hours } from './radar.cron';

const buscarContratacoesMock = buscarContratacoesPNCP as jest.Mock;
const upsertMock = prisma.procurementNotice.upsert as jest.Mock;

describe('radar.cron - fetchWithBackoff & syncPncpLast24Hours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchWithBackoff', () => {
    test('retorna com sucesso na primeira tentativa', async () => {
      const fn = jest.fn().mockResolvedValue({ data: ['item1'] });
      const result = await fetchWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 });

      expect(result).toEqual({ data: ['item1'] });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('reintenta com sucesso após erro 429 (rate limited)', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ statusCode: 429, code: 'PNCP_RATE_LIMITED', message: 'Too Many Requests' })
        .mockResolvedValueOnce({ data: ['sucesso-apos-429'] });

      const result = await fetchWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 });

      expect(result).toEqual({ data: ['sucesso-apos-429'] });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('reintenta com sucesso após erro 504 / PNCP_TIMEOUT', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ statusCode: 504, code: 'PNCP_TIMEOUT', message: 'Gateway Timeout' })
        .mockResolvedValueOnce({ data: ['recuperado-timeout'] });

      const result = await fetchWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 });

      expect(result).toEqual({ data: ['recuperado-timeout'] });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('não reintenta quando recebe erro 400 (INVALID_FILTER)', async () => {
      const fn = jest.fn().mockRejectedValue({ statusCode: 400, code: 'INVALID_FILTER', message: 'Bad filter' });

      await expect(
        fetchWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('lança erro após esgotar o número máximo de retentativas', async () => {
      const fn = jest.fn().mockRejectedValue({ statusCode: 502, code: 'PNCP_UNAVAILABLE', message: 'Bad Gateway' });

      await expect(
        fetchWithBackoff(fn, { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 20 })
      ).rejects.toMatchObject({ statusCode: 502 });

      expect(fn).toHaveBeenCalledTimes(3); // 1 tentativa inicial + 2 retentativas
    });
  });

  describe('syncPncpLast24Hours (Paginação Completa)', () => {
    test('percorre múltiplas páginas sequencialmente até o encerramento', async () => {
      // Página 1: 50 itens de pregão eletrônico, totalRegistros = 75
      const page1Items = Array.from({ length: 50 }, (_, i) => ({
        numeroControlePNCP: `11111111000100-1-00000${i}/2026`,
        objeto: `Objeto Item ${i}`,
        valorTotalEstimado: 1000 + i,
      }));

      // Página 2: 25 itens restantes
      const page2Items = Array.from({ length: 25 }, (_, i) => ({
        numeroControlePNCP: `11111111000100-1-0000${50 + i}/2026`,
        objeto: `Objeto Item ${50 + i}`,
        valorTotalEstimado: 2000 + i,
      }));

      // Responde duas páginas para pregão eletrônico (código oficial 6); demais modalidades sem resultados.
      buscarContratacoesMock.mockImplementation((params) => {
        if (params.codigoModalidadeContratacao === 6) {
          if (params.pagina === 1) {
            return Promise.resolve({
              data: page1Items,
              totalRegistros: 75,
              pagina: 1,
              tamanhoPagina: 50,
            });
          }
          if (params.pagina === 2) {
            return Promise.resolve({
              data: page2Items,
              totalRegistros: 75,
              pagina: 2,
              tamanhoPagina: 50,
            });
          }
        }
        // Modalidade 8 (dispensa) retorna vazio
        return Promise.resolve({
          data: [],
          totalRegistros: 0,
          pagina: 1,
          tamanhoPagina: 50,
        });
      });

      upsertMock.mockResolvedValue({});

      const stats = await syncPncpLast24Hours();

      expect(stats.totalEncontrados).toBe(75);
      expect(stats.upsertados).toBe(75);
      expect(stats.erros).toBe(0);

      // Verificou página 1 e página 2 para modalidade 6
      expect(buscarContratacoesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          codigoModalidadeContratacao: 6,
          pagina: 1,
          tamanhoPagina: 50,
        })
      );
      expect(buscarContratacoesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          codigoModalidadeContratacao: 6,
          pagina: 2,
          tamanhoPagina: 50,
        })
      );
      expect(buscarContratacoesMock).toHaveBeenCalledWith(
        expect.objectContaining({ codigoModalidadeContratacao: 4 }),
      );
      expect(buscarContratacoesMock).toHaveBeenCalledWith(
        expect.objectContaining({ codigoModalidadeContratacao: 8 }),
      );
      expect(buscarContratacoesMock).toHaveBeenCalledWith(
        expect.objectContaining({ codigoModalidadeContratacao: 12 }),
      );
    });
  });
});
