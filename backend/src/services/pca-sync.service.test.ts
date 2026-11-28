jest.mock('../database/prisma', () => ({
  prisma: {
    procurementNotice: {
      findMany: jest.fn(),
    },
    annualProcurementPlan: {
      upsert: jest.fn(),
    },
    annualProcurementPlanItem: {
      count: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import axios from 'axios';
import { prisma } from '../database/prisma';
import { classificarJanelaTaticaPca, queryPcaFromDb, syncPcaRecentDays } from './pca-sync.service';

describe('pca-sync.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.procurementNotice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.annualProcurementPlan.upsert as jest.Mock).mockResolvedValue({ id: 'plan-uuid-1' });
    (prisma as any).annualProcurementPlanItem.upsert.mockResolvedValue({ id: 'item-uuid-1' });
    (prisma as any).annualProcurementPlanItem.count.mockResolvedValue(600);
    (prisma as any).annualProcurementPlanItem.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('syncPcaRecentDays pagina corretamente além da página 1 com dataInicio < dataFim', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockImplementation(async (url: string, config?: any) => {
      if (url.endsWith('/pca/atualizacao')) {
        const pg = config?.params?.pagina;
        expect(config?.params?.tamanhoPagina).toBe(50);
        expect(String(config?.params?.dataInicio) < String(config?.params?.dataFim)).toBe(true);
        if (pg === 1) {
          return {
            status: 200,
            data: {
              paginasRestantes: 1,
              totalPaginas: 2,
              data: [
                {
                  idPcaPncp: '00000000000191-0-000001/2026',
                  anoPca: 2026,
                  orgaoEntidadeCnpj: '00000000000191',
                  orgaoEntidadeRazaoSocial: 'PREFEITURA DE FORTALEZA CE',
                  itens: [{ numeroItem: 1, descricaoItem: 'UNIFORME ESCOLAR', valorTotal: 10000 }],
                },
              ],
            },
          } as any;
        }
        return {
          status: 200,
          data: {
            paginasRestantes: 0,
            totalPaginas: 2,
            data: [
              {
                idPcaPncp: '00000000000191-0-000001/2026',
                anoPca: 2026,
                orgaoEntidadeCnpj: '00000000000191',
                orgaoEntidadeRazaoSocial: 'PREFEITURA DE FORTALEZA CE',
                itens: [{ numeroItem: 2, descricaoItem: 'LICENCA SOFTWARE GESTAO', valorTotal: 25000 }],
              },
            ],
          },
        } as any;
      }
      return { status: 204, data: {} } as any;
    });

    const result = await syncPcaRecentDays({ daysBack: 1, maxPagesPerDay: 3, maxCatalogPagesPerClass: 0 });

    expect(result.fetched).toBe(2);
    expect(result.persisted).toBe(2);
    expect(getSpy).toHaveBeenCalledWith(
      expect.stringContaining('/pca/atualizacao'),
      expect.objectContaining({ params: expect.objectContaining({ pagina: 2, tamanhoPagina: 50 }) }),
    );
    expect((prisma as any).annualProcurementPlanItem.upsert).toHaveBeenCalledTimes(2);
  });

  test('classificarJanelaTaticaPca rotula corretamente datas passadas, imediatas, estratégicas e planejamento', () => {
    const baseNow = new Date('2026-11-22T12:00:00Z').getTime();

    const passada = classificarJanelaTaticaPca('2026-10-01T12:00:00Z', baseNow);
    expect(passada.janelaTatica).toBe('PREVISTA_ANTERIOR');
    expect(passada.diasAtePrevisao).toBeLessThan(0);
    expect(passada.insightEstrategico).toContain('já transcorrida');

    const imediata = classificarJanelaTaticaPca('2026-12-10T12:00:00Z', baseNow);
    expect(imediata.janelaTatica).toBe('IMEDIATA');

    const estrategica = classificarJanelaTaticaPca('2027-01-15T12:00:00Z', baseNow);
    expect(estrategica.janelaTatica).toBe('ESTRATEGICA');

    const futuro = classificarJanelaTaticaPca('2027-06-01T12:00:00Z', baseNow);
    expect(futuro.janelaTatica).toBe('PLANEJAMENTO');

    const semData = classificarJanelaTaticaPca(null, baseNow);
    expect(semData.janelaTatica).toBe('PLANEJAMENTO');
    expect(semData.diasAtePrevisao).toBeNull();
  });

  test('queryPcaFromDb aplica filtro de ano, UF e CNAE, classifica janela tática e dispara backfill não-bloqueante', async () => {
    const itemRepo = (prisma as any).annualProcurementPlanItem;
    itemRepo.count
      .mockResolvedValueOnce(20) // totalInDb inicial
      .mockResolvedValueOnce(1); // count(where)

    const passado = new Date(Date.now() - 20 * 86400000);
    itemRepo.findMany.mockResolvedValueOnce([
      {
        id: 'pca-item-1',
        pncpId: '07954605000160-0-000001/2026',
        year: 2026,
        buyerName: 'PREFEITURA MUNICIPAL DE FORTALEZA',
        buyerDocument: '07954605000160',
        uf: 'CE',
        municipality: 'Fortaleza',
        category: 'Material',
        description: 'UNIFORME ESCOLAR E FARDAMENTO',
        desiredDate: passado,
        estimatedValue: 50000,
        linkPcaPncp: 'https://pncp.gov.br/app/pca/07954605000160/2026/1',
        publishedAt: null,
        updatedAt: new Date('2026-11-22T12:00:00Z'),
      },
    ]);

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ status: 204, data: {} } as any);

    const res = await queryPcaFromDb({
      anoPca: 2026,
      uf: 'CE',
      cnae: '1412601',
      pagina: 1,
      tamanhoPagina: 10,
    });

    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({
      anoPca: 2026,
      uf: 'CE',
      descricaoItem: 'UNIFORME ESCOLAR E FARDAMENTO',
      janelaTatica: 'PREVISTA_ANTERIOR',
    });

    const whereArg = itemRepo.findMany.mock.calls[0][0].where;
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        { year: 2026 },
        { uf: { equals: 'CE', mode: 'insensitive' } },
      ]),
    );
    expect(getSpy).toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 20));
  });

  test('syncPcaRecentDays rotaciona múltiplas classes e pagina catálogo oficial para 2026 e 2027', async () => {
    const classesVisitadas = new Set<number>();
    const anosVisitados = new Set<number>();

    const getSpy = jest.spyOn(axios, 'get').mockImplementation(async (url: string, config?: any) => {
      if (url.endsWith('/pca/')) {
        const ano = Number(config?.params?.anoPca);
        const cls = Number(config?.params?.codigoClassificacaoSuperior);
        const pg = Number(config?.params?.pagina);
        anosVisitados.add(ano);
        classesVisitadas.add(cls);
        if (pg === 1 && (cls === 1 || cls === 2)) {
          return {
            status: 200,
            data: {
              paginasRestantes: 1,
              totalPaginas: 2,
              data: [
                {
                  idPcaPncp: `00000000000191-0-00000${cls}/${ano}`,
                  anoPca: ano,
                  orgaoEntidadeCnpj: '00000000000191',
                  orgaoEntidadeRazaoSocial: 'ORGAO FEDERAL TESTE',
                  itens: [{ numeroItem: 1, descricaoItem: `ITEM CLASSE ${cls} ANO ${ano}`, valorTotal: 15000 }],
                },
              ],
            },
          } as any;
        }
        return { status: 204, data: {} } as any;
      }
      return { status: 204, data: {} } as any;
    });

    const result = await syncPcaRecentDays({ daysBack: 1, maxPagesPerDay: 1, maxCatalogPagesPerClass: 3 });

    expect(anosVisitados.has(2026)).toBe(true);
    expect(anosVisitados.has(2027)).toBe(true);
    expect(classesVisitadas.size).toBeGreaterThanOrEqual(10);
    expect(result.persisted).toBeGreaterThanOrEqual(4);
    expect(getSpy).toHaveBeenCalledWith(
      expect.stringContaining('/pca/'),
      expect.objectContaining({ params: expect.objectContaining({ anoPca: 2027, tamanhoPagina: 50 }) }),
    );
  });
});
