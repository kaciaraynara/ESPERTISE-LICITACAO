describe('licitacoes.service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('retorna vazio honesto quando o PNCP nao traz resultados', async () => {
    jest.doMock('./pncp.service', () => ({
      buscarContratacoesPNCP: jest.fn().mockResolvedValue({
        data: [],
        totalRegistros: 0,
        pagina: 1,
        tamanhoPagina: 20,
      }),
    }));

    const { listarLicitacoes } = require('./licitacoes.service');
    const result = await listarLicitacoes({
      palavrasChave: 'software',
      pagina: 1,
      tamanhoPagina: 20,
    });

    expect(result.data).toHaveLength(0);
    expect(result).toMatchObject({
      totalRegistros: 0,
      pagina: 1,
      tamanhoPagina: 20,
    });
  });

  test('normaliza dados reais vindos do PNCP', async () => {
    jest.doMock('./pncp.service', () => ({
      buscarContratacoesPNCP: jest.fn().mockResolvedValue({
        data: [{
          numeroControlePNCP: 'PNCP-001',
          objeto: 'Contratacao de software',
          orgaoEntidade: { razaoSocial: 'Prefeitura Teste', cnpj: '11222333000181' },
          unidadeOrgao: {
            nomeUnidade: 'Secretaria de Tecnologia',
            ufSigla: 'SP',
            municipioNome: 'Sao Paulo',
          },
          processo: '123/2026',
          numeroCompra: '45',
          valorTotalEstimado: 1000,
          dataPublicacaoPncp: '2026-05-01',
          dataAberturaProposta: '2026-05-10',
          dataEncerramentoProposta: '2026-05-20',
          modalidadeId: 6,
          modalidadeNome: 'Pregao',
          modoDisputaNome: 'Aberto',
          situacaoCompraNome: 'Publicada',
          linkSistemaOrigem: 'https://pncp.example/1',
        }],
        totalRegistros: 1,
        pagina: 1,
        tamanhoPagina: 10,
      }),
    }));

    const { listarLicitacoes } = require('./licitacoes.service');
    const result = await listarLicitacoes({ palavrasChave: 'software', pagina: 1, tamanhoPagina: 10 });

    expect(result.totalRegistros).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'PNCP-001',
      numeroControlePNCP: 'PNCP-001',
      objeto: 'Contratacao de software',
      orgao: 'Prefeitura Teste',
      cnpjOrgao: '11222333000181',
      unidade: 'Secretaria de Tecnologia',
      uf: 'SP',
      municipio: 'Sao Paulo',
      processo: '123/2026',
      numeroCompra: '45',
      modalidadeId: 6,
      modoDisputa: 'Aberto',
      valorEstimado: 1000,
      dataEncerramento: '2026-05-20',
      link: 'https://pncp.example/1',
      fonte: 'PNCP',
    });
  });

  test('consulta uma contratação específica sem varrer uma página arbitrária', async () => {
    const buscarContratacaoPNCP = jest.fn().mockResolvedValue({
      numeroControlePNCP: '11222333000181-1-000045/2026',
      objeto: 'Contratação oficial',
      orgaoEntidade: { razaoSocial: 'Órgão público', cnpj: '11222333000181' },
      unidadeOrgao: { ufSigla: 'CE', municipioNome: 'Fortaleza' },
    });
    jest.doMock('./pncp.service', () => ({
      buscarContratacaoPNCP,
      buscarContratacoesPNCP: jest.fn(),
    }));

    const { buscarLicitacaoPorNumeroControle } = require('./licitacoes.service');
    const result = await buscarLicitacaoPorNumeroControle(
      '11222333000181-1-000045/2026',
    );

    expect(buscarContratacaoPNCP).toHaveBeenCalledWith(
      '11222333000181-1-000045/2026',
    );
    expect(result).toMatchObject({
      numeroControlePNCP: '11222333000181-1-000045/2026',
      objeto: 'Contratação oficial',
      fonte: 'PNCP',
    });
  });
});
