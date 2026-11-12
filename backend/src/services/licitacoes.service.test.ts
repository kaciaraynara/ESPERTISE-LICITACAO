describe('licitacoes.service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('retorna vazio honesto quando o PNCP nao traz resultados', async () => {
    jest.doMock('../database/prisma', () => ({
      prisma: {
        $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
        procurementNotice: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
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

  test('filtra a listagem do banco usando palavras derivadas do CNAE do tenant', async () => {
    const mockCount = jest.fn().mockResolvedValue(0);
    const mockFindMany = jest.fn().mockResolvedValue([]);
    const mockUpsert = jest.fn().mockResolvedValue({ id: 'notice-1' });
    const searchPncp = jest.fn().mockResolvedValue({
      data: [{
        numeroControlePNCP: 'PNCP-OBRA-1',
        objeto: 'Obra de reforma de escola',
        orgaoEntidade: { razaoSocial: 'Prefeitura' },
        unidadeOrgao: { ufSigla: 'SP' },
      }],
      totalRegistros: 1,
      pagina: 1,
      tamanhoPagina: 50,
    });

    jest.doMock('../database/prisma', () => ({
      prisma: {
        $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
        procurementNotice: {
          count: mockCount,
          findMany: mockFindMany,
          upsert: mockUpsert,
        },
      },
    }));
    jest.doMock('./cnae-to-keywords.service', () => ({
      getTenantRadarProfile: jest.fn().mockResolvedValue({
        cnaes: ['4120-4/00 - Construção de edifícios'],
        keywords: ['obra', 'construção', 'engenharia'],
        uf: 'SP',
      }),
      keywordsForCnae: jest.fn().mockReturnValue(['obra', 'construção', 'engenharia']),
    }));
    jest.doMock('./pncp.service', () => ({
      buscarContratacaoPNCP: jest.fn(),
      buscarContratacoesPNCP: searchPncp,
    }));

    const { listarLicitacoes } = require('./licitacoes.service');
    const result = await listarLicitacoes(
      { modalidade: 'Dispensa Eletrônica', cnae: '4120-4/00 - Construção de edifícios' },
      'user-1',
      'tenant-1',
    );

    expect(searchPncp).not.toHaveBeenCalled();
    const searchFilters = mockFindMany.mock.calls[0][0].where.AND.find(
      (filter: { OR?: Array<Record<string, { contains?: string }>> }) => Array.isArray(filter.OR),
    );
    expect(searchFilters.OR).toEqual(expect.arrayContaining([
      expect.objectContaining({ object: expect.objectContaining({ contains: 'obra' }) }),
      expect.objectContaining({ object: expect.objectContaining({ contains: 'construção' }) }),
      expect.objectContaining({ object: expect.objectContaining({ contains: 'engenharia' }) }),
    ]));
    expect(result.perfilRadar).toEqual({
      cnaes: ['4120-4/00 - Construção de edifícios'],
      palavras_chave: ['obra', 'construção', 'engenharia'],
    });
  });

  it('retorna busca enxuta sem termos de busca automáticos quando usuário não passa palavra-chave nem CNAE', async () => {
    jest.resetModules();
    const mockFindMany = jest.fn().mockResolvedValue([]);
    const mockCount = jest.fn().mockResolvedValue(0);

    jest.doMock('../database/prisma', () => ({
      prisma: {
        $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
        procurementNotice: {
          count: mockCount,
          findMany: mockFindMany,
        },
      },
    }));
    jest.doMock('./cnae-to-keywords.service', () => ({
      getTenantRadarProfile: jest.fn().mockResolvedValue({
        cnaes: ['4120-4/00 - Construção de edifícios'],
        keywords: ['obra', 'construção', 'engenharia'],
        uf: 'SP',
      }),
    }));

    const { listarLicitacoes } = require('./licitacoes.service');
    await listarLicitacoes({ modalidade: 'Dispensa Eletrônica' }, 'user-1', 'tenant-1');

    const searchFilters = mockFindMany.mock.calls[0][0].where?.AND?.find(
      (filter: { OR?: Array<Record<string, { contains?: string }>> }) => Array.isArray(filter.OR),
    );
    expect(searchFilters).toBeUndefined();
  });

  test('a listagem local nao dispara consultas PNCP implicitamente', async () => {
    const mockCount = jest.fn().mockResolvedValue(0);
    const mockFindMany = jest.fn().mockResolvedValue([]);
    const searchPncp = jest.fn();

    jest.doMock('../database/prisma', () => ({
      prisma: {
        $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
        procurementNotice: {
          count: mockCount,
          findMany: mockFindMany,
        },
      },
    }));
    jest.doMock('./cnae-to-keywords.service', () => ({
      getTenantRadarProfile: jest.fn().mockResolvedValue({
        cnaes: ['4120-4/00 - Construção de edifícios'],
        keywords: ['obra'],
        uf: 'SP',
      }),
    }));
    jest.doMock('./pncp.service', () => ({
      buscarContratacaoPNCP: jest.fn(),
      buscarContratacoesPNCP: searchPncp,
    }));

    const { listarLicitacoes } = require('./licitacoes.service');
    const result = await listarLicitacoes({}, 'user-1', 'tenant-1');

    expect(searchPncp).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(0);
  });

  test('aplica a condição SRP na consulta local', async () => {
    const mockCount = jest.fn().mockResolvedValue(0);
    const mockFindMany = jest.fn().mockResolvedValue([]);

    jest.doMock('../database/prisma', () => ({
      prisma: {
        $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
        procurementNotice: {
          count: mockCount,
          findMany: mockFindMany,
        },
      },
    }));

    const { listarLicitacoes } = require('./licitacoes.service');
    await listarLicitacoes({ srp: true });

    expect(mockFindMany.mock.calls[0][0].where.AND)
      .toContainEqual({ srp: true });
  });

  test('sincroniza ao vivo as quatro modalidades e persiste apenas editais SRP quando solicitado', async () => {
    const searchPncp = jest.fn((filters: { codigoModalidadeContratacao: number }) => Promise.resolve({
      data: [{
        numeroControlePNCP: `11223344556677-1-00000${filters.codigoModalidadeContratacao}/2026`,
        objetoCompra: 'Aquisição de equipamentos',
        modalidadeId: filters.codigoModalidadeContratacao,
        modalidadeNome: 'Pregão Eletrônico',
        srp: filters.codigoModalidadeContratacao === 6,
      }],
      totalRegistros: 1,
      pagina: 1,
      tamanhoPagina: 50,
    }));
    const mockUpsert = jest.fn().mockResolvedValue({ id: 'notice-srp' });

    jest.doMock('../database/prisma', () => ({
      prisma: {
        procurementNotice: {
          upsert: mockUpsert,
        },
      },
    }));
    jest.doMock('./pncp.service', () => ({
      buscarContratacaoPNCP: jest.fn(),
      buscarContratacoesPNCP: searchPncp,
    }));

    const { sincronizarLicitacoesPNCP } = require('./licitacoes.service');
    const result = await sincronizarLicitacoesPNCP({ srp: true });

    expect(searchPncp.mock.calls.map(([filters]) => filters.codigoModalidadeContratacao))
      .toEqual([4, 6, 8, 12]);
    expect(result.totalSincronizados).toBe(1);
    expect(result.items[0].srp).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0].create.srp).toBe(true);
  });

  test('normaliza dados reais vindos do PNCP', () => {
    const { normalizarLicitacaoPNCP } = require('./licitacoes.service');
    const result = normalizarLicitacaoPNCP({
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
    });

    expect(result).toMatchObject({
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
    });
  });

  test('consulta uma contratação específica, normaliza e persiste no banco com sucesso', async () => {
    const buscarContratacaoPNCP = jest.fn().mockResolvedValue({
      numeroControlePNCP: '11222333000181-1-000045/2026',
      objeto: 'Contratação oficial',
      orgaoEntidade: { razaoSocial: 'Órgão público', cnpj: '11222333000181' },
      unidadeOrgao: { ufSigla: 'CE', municipioNome: 'Fortaleza' },
    });
    const mockUpsert = jest.fn().mockResolvedValue({
      id: 'uuid-notice-persistido-1',
    });
    jest.doMock('../database/prisma', () => ({
      prisma: {
        procurementNotice: {
          findFirst: jest.fn().mockResolvedValue(null),
          upsert: mockUpsert,
        },
      },
    }));
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
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'pncp-11222333000181-1-000045/2026' },
      }),
    );
    expect(result).toMatchObject({
      id: 'uuid-notice-persistido-1',
      databaseId: 'uuid-notice-persistido-1',
      numeroControlePNCP: '11222333000181-1-000045/2026',
      objeto: 'Contratação oficial',
      fonte: 'PNCP',
    });
  });

  test('lança NoticePersistenceError quando a persistência no banco falha e requirePersistence !== false', async () => {
    const buscarContratacaoPNCP = jest.fn().mockResolvedValue({
      numeroControlePNCP: '11222333000181-1-000045/2026',
      objeto: 'Contratação oficial',
      orgaoEntidade: { razaoSocial: 'Órgão público', cnpj: '11222333000181' },
      unidadeOrgao: { ufSigla: 'CE', municipioNome: 'Fortaleza' },
    });
    const mockUpsert = jest.fn().mockRejectedValue(new Error('Database timeout'));
    jest.doMock('../database/prisma', () => ({
      prisma: {
        procurementNotice: {
          findFirst: jest.fn().mockResolvedValue(null),
          upsert: mockUpsert,
        },
      },
    }));
    jest.doMock('./pncp.service', () => ({
      buscarContratacaoPNCP,
      buscarContratacoesPNCP: jest.fn(),
    }));

    const { buscarLicitacaoPorNumeroControle, NoticePersistenceError } = require('./licitacoes.service');

    await expect(
      buscarLicitacaoPorNumeroControle('11222333000181-1-000045/2026'),
    ).rejects.toThrow(NoticePersistenceError);
  });

  test('retorna edital já existente no banco de dados local sem chamar o PNCP', async () => {
    const buscarContratacaoPNCP = jest.fn();
    const existingDbNotice = {
      id: 'uuid-local-existente-999',
      externalId: '11222333000181-1-000045/2026',
      noticeNumber: 'PE 045/2026',
      buyerName: 'Prefeitura Municipal',
      buyerDocument: '11222333000181',
      object: 'Fornecimento de merenda',
      modality: 'Pregão Eletrônico',
      uf: 'CE',
      municipality: 'Fortaleza',
      estimatedValue: 50000,
      status: 'Aberta',
      url: 'https://pncp.gov.br/app/editais/11222333000181-1-000045/2026',
      source: 'PNCP',
      publishedAt: new Date('2026-06-01T10:00:00Z'),
      openingAt: new Date('2026-06-15T09:00:00Z'),
      closingAt: new Date('2026-06-15T18:00:00Z'),
    };

    jest.doMock('../database/prisma', () => ({
      prisma: {
        procurementNotice: {
          findFirst: jest.fn().mockResolvedValue(existingDbNotice),
          upsert: jest.fn(),
        },
      },
    }));
    jest.doMock('./pncp.service', () => ({
      buscarContratacaoPNCP,
    }));

    const { buscarLicitacaoPorNumeroControle } = require('./licitacoes.service');
    const result = await buscarLicitacaoPorNumeroControle('11222333000181-1-000045/2026');

    expect(buscarContratacaoPNCP).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'uuid-local-existente-999',
      databaseId: 'uuid-local-existente-999',
      numeroControlePNCP: '11222333000181-1-000045/2026',
      objeto: 'Fornecimento de merenda',
      orgao: 'Prefeitura Municipal',
    });
  });
});
