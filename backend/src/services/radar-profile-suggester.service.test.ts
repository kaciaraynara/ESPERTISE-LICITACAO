jest.mock('../database/prisma', () => ({
  prisma: {},
}));

import { RADAR_RAMOS_CATALOG, estimarPerfilRadar, sugerirPerfilRadar } from './radar-profile-suggester.service';

describe('radar-profile-suggester.service', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  test('expõe catálogo completo de ramos licitatórios', () => {
    expect(RADAR_RAMOS_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  test('sugere ramos, palavras e tipos de objeto determinísticos para vestuário, software, obras e limpeza', async () => {
    const vestuario = await sugerirPerfilRadar({
      descricao: 'Vendemos uniformes escolares e fardamento no Ceará',
      ufs: ['CE'],
    });
    expect(vestuario.ramos).toContain('Vestuário, uniformes e têxteis');
    expect(vestuario.palavras).toEqual(expect.arrayContaining(['uniformes', 'vestuário', 'fardamento']));
    expect(vestuario.tiposObjeto).toEqual(['BENS']);
    expect(vestuario.ufs).toEqual(['CE']);

    const ti = await sugerirPerfilRadar({
      descricao: 'Software de gestão pública e licenças em nuvem',
    });
    expect(ti.ramos).toContain('Software, sistemas e licenças');
    expect(ti.tiposObjeto).toEqual(expect.arrayContaining(['SERVICOS']));

    const obras = await sugerirPerfilRadar({
      descricao: 'Execução de obras de pavimentação e reforma de escolas',
    });
    expect(obras.ramos).toContain('Obras, reformas e engenharia');
    expect(obras.tiposObjeto).toContain('OBRAS');

    const limpeza = await sugerirPerfilRadar({
      descricao: 'Limpeza predial e conservação com insumos de higiene',
    });
    expect(limpeza.ramos).toContain('Limpeza, higiene e conservação');
  });

  test('calcula estimativaPorDia a partir dos últimos 30 dias via $queryRawUnsafe quando disponível', async () => {
    const { prisma } = require('../database/prisma');
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValueOnce([
      { abertas_agora: 42, ultimos_30_dias: 240 },
    ]);

    const est = await estimarPerfilRadar({
      palavras: ['software'],
      tiposObjeto: ['BENS'],
      ufs: ['CE'],
    });

    expect(est).toEqual({
      abertasAgora: 42,
      ultimos30Dias: 240,
      estimativaPorDia: 8,
    });
  });
});
