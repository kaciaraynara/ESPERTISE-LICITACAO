jest.mock('../database/prisma', () => ({
  prisma: {
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    catalogItem: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../database/prisma';
import {
  calcularViabilidade,
  calcularViabilidadeAutentica,
  obterAliquotaRegimeTributario,
  ALIQUOTAS_REGIME_TRIBUTARIO,
} from './viabilidade.service';

const findCompanyFirstMock = prisma.company.findFirst as jest.Mock;
const findCatalogManyMock = prisma.catalogItem.findMany as jest.Mock;

describe('viabilidade.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calcularViabilidade (cálculo puro)', () => {
    test('calcula margem real por subtracao sequencial', () => {
      const resultado = calcularViabilidade({
        precoLance: 1000,
        custoProduto: 500,
        percentualImpostos: 10,
        custoLogistico: 100,
        taxasAdministrativas: 50,
      });

      expect(resultado.precoLance).toBe(1000);
      expect(resultado.custoProduto).toBe(500);
      expect(resultado.impostosValor).toBe(100);
      expect(resultado.etapas.map((etapa) => etapa.saldo)).toEqual([500, 400, 300, 250]);
      expect(resultado.margemLucroRealValor).toBe(250);
      expect(resultado.margemLucroRealPercentual).toBe(25);
      expect(resultado.margemSaudavel).toBe(true);
    });

    test('classifica margem abaixo de 10 como nao saudavel', () => {
      const resultado = calcularViabilidade({
        precoLance: 1000,
        custoProduto: 700,
        percentualImpostos: 15,
        custoLogistico: 80,
        taxasAdministrativas: 20,
      });

      expect(resultado.margemLucroRealValor).toBe(50);
      expect(resultado.margemLucroRealPercentual).toBe(5);
      expect(resultado.margemSaudavel).toBe(false);
    });

    test('rejeita preco de lance invalido', () => {
      expect(() => calcularViabilidade({
        precoLance: 0,
        custoProduto: 1000,
        percentualImpostos: 12,
        custoLogistico: 80,
        taxasAdministrativas: 50,
      })).toThrow('INVALID_PRECO_LANCE');
    });

    test('rejeita percentual de impostos invalido', () => {
      expect(() => calcularViabilidade({
        precoLance: 1000,
        custoProduto: 1000,
        percentualImpostos: 120,
        custoLogistico: 80,
        taxasAdministrativas: 50,
      })).toThrow('INVALID_PERCENTUAL_IMPOSTOS');
    });
  });

  describe('Regime Tributário', () => {
    test('retorna alíquotas oficiais conforme regime informado', () => {
      expect(obterAliquotaRegimeTributario('MEI')).toBe(0.0);
      expect(obterAliquotaRegimeTributario('SIMPLES_NACIONAL')).toBe(8.5);
      expect(obterAliquotaRegimeTributario('LUCRO_PRESUMIDO')).toBe(13.65);
      expect(obterAliquotaRegimeTributario('LUCRO_REAL')).toBe(18.25);
      expect(obterAliquotaRegimeTributario(null)).toBe(8.5); // Default Simples
    });
  });

  describe('calcularViabilidadeAutentica (cruzamento com Catálogo e Regime)', () => {
    test('cruza custos autênticos do Catálogo de Produtos e alíquota do Lucro Presumido', async () => {
      findCompanyFirstMock.mockResolvedValue({
        id: 'company-1',
        razaoSocial: 'Fornecedor Beta LTDA',
      });

      findCatalogManyMock.mockResolvedValue([
        {
          id: 'item-1',
          sku: 'SKU-CADERNO-01',
          nome: 'Caderno Universitário 200 Fls',
          custoBase: 12.50,
          precoMinimoLicitacao: 18.00,
        },
      ]);

      const resultado = await calcularViabilidadeAutentica({
        companyId: 'company-1',
        catalogItemId: 'item-1',
        estimativaEdital: 50.00,
        precoLance: 40.00,
        regimeTributario: 'LUCRO_PRESUMIDO',
        custoLogistico: 2.00,
        taxasAdministrativas: 1.00,
      });

      expect(resultado.origemCustoProduto).toBe('CATALOGO_PRODUTOS');
      expect(resultado.custoProdutoTotal).toBe(12.50);
      expect(resultado.aliquotaImpostosUtilizada).toBe(13.65);
      expect(resultado.regimeTributarioUtilizado).toBe('LUCRO_PRESUMIDO');
      expect(resultado.itensCatalogoUtilizados).toHaveLength(1);
      expect(resultado.itensCatalogoUtilizados[0].sku).toBe('SKU-CADERNO-01');

      // Verifica que não foi aplicado nenhum multiplicador 65% arbitrário
      expect(resultado.viabilidade.custoProduto).toBe(12.50);
      expect(resultado.classificacao).toBe('VIÁVEL (ALTA VIABILIDADE)');
    });

    test('classifica como INVIÁVEL quando o preço mínimo sustentável supera a estimativa do edital', async () => {
      findCompanyFirstMock.mockResolvedValue({
        id: 'company-2',
        razaoSocial: 'Indústria Pesada S/A',
      });

      findCatalogManyMock.mockResolvedValue([
        {
          id: 'item-heavy',
          sku: 'SKU-GERADOR',
          nome: 'Gerador 500kVA',
          custoBase: 80000.00,
          precoMinimoLicitacao: 95000.00,
        },
      ]);

      const resultado = await calcularViabilidadeAutentica({
        companyId: 'company-2',
        catalogItemId: 'item-heavy',
        estimativaEdital: 70000.00, // Edital com teto menor que o custo de fabricação
        regimeTributario: 'LUCRO_REAL',
      });

      expect(resultado.origemCustoProduto).toBe('CATALOGO_PRODUTOS');
      expect(resultado.classificacao).toBe('INVIÁVEL');
      expect(resultado.scorePercentual).toBeLessThan(50);
    });
  });
});
