jest.mock('../database/prisma', () => ({
  prisma: {
    procurementItem: {
      findMany: jest.fn(),
    },
  },
}));

import axios from 'axios';
import { prisma } from '../database/prisma';
import {
  calcularEstatisticasPrecos,
  pesquisarReferenciaPrecos,
} from './catmat-catser.service';

describe('catmat-catser.service (Etapa 6)', () => {
  const findManyMock = (prisma as any).procurementItem.findMany as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('calcularEstatisticasPrecos calcula minimo, mediana, media e maximo ignorando valores invalidos', () => {
    expect(calcularEstatisticasPrecos([0, -10, NaN, 100, 300, 200, 400])).toEqual({
      minimo: 100,
      mediana: 250,
      media: 250,
      maximo: 400,
    });
    expect(calcularEstatisticasPrecos([])).toEqual({
      minimo: 0,
      mediana: 0,
      media: 0,
      maximo: 0,
    });
  });

  test('pesquisarReferenciaPrecos usa tipo=ITEM&codigo no 1_consultarMaterial e combina CATSER + PNCP', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockImplementation(async (url: string, config?: any) => {
      if (url.includes('/modulo-material/4_consultarItemMaterial')) {
        return {
          status: 200,
          data: {
            resultado: [
              { codigoItem: 460949, descricaoItem: 'COMPUTADOR PORTATIL', nomeGrupo: 'INFORMATICA' },
            ],
          },
        } as any;
      }
      if (url.includes('/modulo-pesquisa-preco/1_consultarMaterial')) {
        expect(config?.params).toMatchObject({ tipo: 'ITEM', codigo: 460949 });
        return { status: 200, data: { resultado: [] } } as any;
      }
      if (url.includes('/modulo-pesquisa-preco/2_consultarMaterialDetalhe')) {
        return {
          status: 200,
          data: {
            resultado: [
              { idCompra: 'C-1', descricaoItem: 'NOTEBOOK 16GB', precoUnitario: 4200, nomeUasg: 'MEC', estado: 'DF' },
            ],
          },
        } as any;
      }
      if (url.includes('/modulo-servico/6_consultarItemServico')) {
        return { status: 200, data: { resultado: [] } } as any;
      }
      if (url.includes('/modulo-pesquisa-preco/3_consultarServico')) {
        return { status: 200, data: { resultado: [] } } as any;
      }
      return { status: 404, data: {} } as any;
    });

    findManyMock.mockResolvedValueOnce([
      {
        id: 'pncp-1',
        description: 'COMPUTADOR DE MESA',
        unit: 'UN',
        quantity: 2,
        estimatedUnitValue: 3800,
        procurementNotice: {
          buyerName: 'Prefeitura Teste',
          uf: 'SP',
          modality: 'Pregão',
          externalId: '001/2026',
          publishedAt: '2026-11-20T10:00:00.000Z',
        },
      },
    ]);

    const res = await pesquisarReferenciaPrecos({
      termo: 'COMPUTADOR',
      codigo: '460949',
      tipo: 'MATERIAL',
    });

    expect(getSpy).toHaveBeenCalled();
    expect(res.totalAmostras).toBe(2);
    expect(res.estatisticas).toEqual({
      minimo: 3800,
      mediana: 4000,
      media: 4000,
      maximo: 4200,
    });
    expect(res.itensCatalogoOficial[0]).toMatchObject({
      codigo: '460949',
      tipo: 'MATERIAL',
    });
  });
});
