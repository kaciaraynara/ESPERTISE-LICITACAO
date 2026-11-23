jest.mock('./intelligence.service', () => ({
  consultarComprasGovContratos: jest.fn(),
}));

import { buildEstatisticas, ConcorrentesService, ContratoConcorrente } from './concorrentes.service';
import { consultarComprasGovContratos } from './intelligence.service';

describe('concorrentes.service', () => {
  test('agrega estatisticas do historico de contratos', () => {
    const contratos: ContratoConcorrente[] = [
      {
        id: '1',
        fonte: 'pncp',
        numeroContrato: '001/2026',
        numeroControlePncp: 'PNCP-1',
        objeto: 'Servico A',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        modalidade: 'Pregao',
        categoria: 'Servicos',
        valor: 1000,
        dataAssinatura: '2026-01-10',
        dataPublicacao: '2026-01-11',
        vigenciaInicio: null,
        vigenciaFim: null,
        situacao: null,
        url: null,
      },
      {
        id: '2',
        fonte: 'portal_transparencia',
        numeroContrato: '002/2026',
        numeroControlePncp: 'PNCP-2',
        objeto: 'Servico B',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        modalidade: 'Dispensa',
        categoria: 'Servicos',
        valor: 500,
        dataAssinatura: '2026-02-10',
        dataPublicacao: '2026-02-11',
        vigenciaInicio: null,
        vigenciaFim: null,
        situacao: null,
        url: null,
      },
    ];

    const stats = buildEstatisticas(contratos);

    expect(stats.totalContratos).toBe(2);
    expect(stats.valorTotalContratado).toBe(1500);
    expect(stats.ticketMedio).toBe(750);
    expect(stats.orgaosContratantes).toBe(1);
    expect(stats.porAno).toEqual({ '2026': 2 });
    expect(stats.porModalidade).toEqual({ Pregao: 1, Dispensa: 1 });
    expect(stats.porOrgao[0]).toEqual({ orgao: 'Prefeitura A', total: 2, valorTotal: 1500 });
  });

  test('gerarDossie agrega contratos do Compras.gov mesmo quando PNCP falha', async () => {
    (consultarComprasGovContratos as jest.Mock).mockResolvedValueOnce([
      {
        id: 'CG-100',
        orgao: 'Ministério da Saúde',
        objeto: 'Fornecimento Hospitalar',
        valor: 12500,
        dataAssinatura: '2026-08-01',
        modalidade: 'Pregão Eletrônico',
      },
    ]);

    const service = new ConcorrentesService();
    jest.spyOn(service as any, 'consultarPncp').mockResolvedValueOnce({
      fonte: 'pncp',
      status: 'failed',
      contratos: [],
      message: 'Timeout',
    });
    jest.spyOn(service as any, 'consultarPortalTransparencia').mockResolvedValueOnce({
      fonte: 'portal_transparencia',
      status: 'failed',
      contratos: [],
      message: 'Indisponível',
    });

    const dossie = await service.gerarDossie('00.000.000/0001-91', 'user-1');

    expect(dossie.contratos).toHaveLength(1);
    expect(dossie.contratos[0]).toMatchObject({
      fonte: 'comprasgov',
      orgao: 'Ministério da Saúde',
      valor: 12500,
    });
    expect(dossie.fontes.find((f) => f.fonte === 'comprasgov')?.status).toBe('success');
  });
});
