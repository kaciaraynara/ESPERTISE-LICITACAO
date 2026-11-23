jest.mock('../database/prisma', () => ({
  prisma: {
    procurementNotice: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    company: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    dataSourceCursor: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    dataIngestionJob: {
      create: jest.fn(),
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
import {
  MODALIDADES_PNCP,
  UFS_BRASIL,
  fetchWithBackoff,
  syncPncpLast24Hours,
  syncPncpPropostasAbertas,
  runDailyOpportunityAlertsScan,
} from './radar.cron';

const buscarContratacoesMock = buscarContratacoesPNCP as jest.Mock;
const upsertMock = prisma.procurementNotice.upsert as jest.Mock;
const cursorFindFirstMock = (prisma as any).dataSourceCursor.findFirst as jest.Mock;
const cursorUpsertMock = (prisma as any).dataSourceCursor.upsert as jest.Mock;
const ingestionJobCreateMock = (prisma as any).dataIngestionJob.create as jest.Mock;

describe('radar.cron - fetchWithBackoff, syncPncpLast24Hours & Etapa 3 Cursors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cursorFindFirstMock.mockResolvedValue(null);
    cursorUpsertMock.mockResolvedValue({});
    ingestionJobCreateMock.mockResolvedValue({});
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
      const page1Items = Array.from({ length: 50 }, (_, i) => ({
        numeroControlePNCP: `11111111000100-1-00000${i}/2026`,
        objeto: `Objeto Item ${i}`,
        valorTotalEstimado: 1000 + i,
      }));

      const page2Items = Array.from({ length: 25 }, (_, i) => ({
        numeroControlePNCP: `11111111000100-1-0000${50 + i}/2026`,
        objeto: `Objeto Item ${50 + i}`,
        valorTotalEstimado: 2000 + i,
      }));

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
      expect(cursorUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_tenantId_cursorKey: {
              source: 'PNCP',
              tenantId: 'global',
              cursorKey: 'publicacao_diaria',
            },
          },
        }),
      );
      expect(ingestionJobCreateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Etapa 3 - MODALIDADES_PNCP & syncPncpPropostasAbertas (Cursor & Rotação UF)', () => {
    test('MODALIDADES_PNCP contempla todas as 12 modalidades ativas', () => {
      const codes = MODALIDADES_PNCP.map((m) => m.codigo);
      expect(codes).toEqual([6, 8, 4, 12, 7, 5, 1, 13, 11, 10, 3, 9]);
      expect(UFS_BRASIL).toHaveLength(27);
    });

    test('Dispensa (8) rotaciona UFs por cursor e persiste proposta_sweep_mod_8_uf + Pregão (6) reinicia para página 1 com 100%', async () => {
      cursorFindFirstMock.mockImplementation(async ({ where }: any) => {
        if (where?.cursorKey === 'proposta_sweep_mod_8_uf') {
          return { cursorValue: { nextUfIndex: 25 }, lastSyncedAt: null };
        }
        if (where?.cursorKey === 'proposta_sweep_mod_6') {
          return { cursorValue: { nextPage: 4 }, lastSyncedAt: null };
        }
        return null;
      });

      buscarContratacoesMock.mockImplementation(async (params: any) => {
        if (params.codigoModalidadeContratacao === 8) {
          return {
            data: [{ numeroControlePNCP: `88888888000100-1-000001/2026-${params.uf}`, objeto: `Dispensa ${params.uf}` }],
            totalRegistros: 1,
          };
        }
        if (params.codigoModalidadeContratacao === 6) {
          return {
            data: Array.from({ length: params.pagina === 4 ? 10 : 50 }, (_, i) => ({
              numeroControlePNCP: `66666666000100-1-${params.pagina}00${i}/2026`,
              objeto: `Pregão pág ${params.pagina}`,
            })),
            totalRegistros: 160, // ceil(160 / 50) = 4 páginas
          };
        }
        return { data: [], totalRegistros: 0 };
      });

      upsertMock.mockResolvedValue({});

      const res = await syncPncpPropostasAbertas(4, {
        modalities: [
          { codigo: 8, nome: 'Dispensa de Licitação' },
          { codigo: 6, nome: 'Pregão Eletrônico' },
        ],
        dispensaUfCount: 4, // index 25 (SE), 26 (TO), 0 (AC), 1 (AL) -> nextUfIndex = 2
      });

      expect(res.modalidadesProcessadas).toBe(2);
      expect(res.erros).toBe(0);

      // Verifica rotação circular das 4 UFs a partir de SE (25)
      expect(cursorUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_tenantId_cursorKey: {
              source: 'PNCP',
              tenantId: 'global',
              cursorKey: 'proposta_sweep_mod_8_uf',
            },
          },
          create: expect.objectContaining({
            cursorValue: expect.objectContaining({
              modalidadeCodigo: 8,
              nextUfIndex: 2,
              lastUfs: ['SE', 'TO', 'AC', 'AL'],
              totalUfs: 27,
            }),
          }),
        }),
      );

      // Verifica wrap de página do Pregão (6) ao atingir a última página (4/4)
      expect(cursorUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_tenantId_cursorKey: {
              source: 'PNCP',
              tenantId: 'global',
              cursorKey: 'proposta_sweep_mod_6',
            },
          },
          create: expect.objectContaining({
            cursorValue: expect.objectContaining({
              modalidadeCodigo: 6,
              nextPage: 1,
              lastPageRead: 4,
              totalPages: 4,
              progressPct: 100,
              lastFullSweepAt: expect.any(String),
            }),
          }),
        }),
      );

      expect(ingestionJobCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'PNCP',
            connector: 'syncPncpPropostasAbertas',
            status: 'completed',
          }),
        }),
      );
    });
  });

  describe('runDailyOpportunityAlertsScan (06:00)', () => {
    test('cruza editais com empresas ativas e cria notificações no banco', async () => {
      buscarContratacoesMock.mockResolvedValue({
        data: [],
        totalRegistros: 0,
      });

      (prisma.company.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'company-1',
          userId: 'user-uuid-1',
          razaoSocial: 'Empresa Alpha Tech',
          cnaePrincipal: '6201-5/01 - Desenvolvimento de software',
          palavrasChave: ['software', 'sistema'],
          uf: 'SP',
        },
      ]);

      (prisma.procurementNotice.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'notice-tech-1',
          noticeNumber: '123/2026',
          buyerName: 'Prefeitura de SP',
          object: 'Contratação de licença de software e desenvolvimento de sistemas',
          uf: 'SP',
          estimatedValue: 50000,
        },
        {
          id: 'notice-food-2',
          noticeNumber: '456/2026',
          buyerName: 'Hospital RJ',
          object: 'Fornecimento de merenda escolar e alimentos',
          uf: 'RJ',
          estimatedValue: 30000,
        },
      ]);

      (prisma.notification.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });

      const res = await runDailyOpportunityAlertsScan();

      expect(res.empresasNotificadas).toBe(1);
      expect(res.totalNotificacoes).toBe(1);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid-1',
          tipo: 'nova_oportunidade',
          titulo: 'Novas Oportunidades Abertas no seu Segmento',
          canal: 'painel',
          status: 'enviada',
        }),
      });
    });
  });
});
