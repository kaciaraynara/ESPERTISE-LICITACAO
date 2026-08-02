import {
  ReceitaFederalServiceError,
  ReceitaService,
  type ReceitaEmpresaQsa,
} from './receita.service';

function empresa(cnpj: string): ReceitaEmpresaQsa {
  return {
    fonte: 'brasilapi-cnpj',
    cnpj,
    razaoSocial: `Empresa ${cnpj}`,
    nomeFantasia: null,
    situacaoCadastral: 'ATIVA',
    naturezaJuridica: 'Sociedade Empresária Limitada',
    municipio: 'Fortaleza',
    uf: 'CE',
    qsa: [],
    consultadoEm: new Date('2026-06-16T12:00:00.000Z').toISOString(),
  } as ReceitaEmpresaQsa;
}

describe('ReceitaService - consulta resiliente em lote', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.RECEITA_CNPJ_CONCURRENCY;
  });

  test('preserva sucessos quando uma consulta falha', async () => {
    const service = new ReceitaService({} as any);

    jest.spyOn(service, 'consultarQsaPorCnpj')
      .mockResolvedValueOnce(empresa('11222333000181'))
      .mockRejectedValueOnce(
        new ReceitaFederalServiceError(
          'RECEITA_TIMEOUT',
          'Tempo limite excedido.',
          504,
        ),
      );

    const resultado = await service.consultarQsaEmLoteDetalhado([
      '11.222.333/0001-81',
      '22.333.444/0001-72',
    ]);

    expect(resultado).toMatchObject({
      totalSolicitado: 2,
      totalSucesso: 1,
      totalFalhas: 1,
      conclusiva: false,
    });

    expect(resultado.empresas).toHaveLength(1);
    expect(resultado.empresas[0].cnpj).toBe('11222333000181');

    expect(resultado.falhas).toEqual([
      expect.objectContaining({
        cnpj: '22333444000172',
        code: 'RECEITA_TIMEOUT',
        statusCode: 504,
      }),
    ]);
  });

  test('retorna análise conclusiva quando todas as consultas têm sucesso', async () => {
    const service = new ReceitaService({} as any);

    jest.spyOn(service, 'consultarQsaPorCnpj')
      .mockResolvedValueOnce(empresa('11222333000181'))
      .mockResolvedValueOnce(empresa('22333444000172'));

    const resultado = await service.consultarQsaEmLoteDetalhado([
      '11222333000181',
      '22333444000172',
    ]);

    expect(resultado).toMatchObject({
      totalSolicitado: 2,
      totalSucesso: 2,
      totalFalhas: 0,
      conclusiva: true,
    });

    expect(resultado.falhas).toEqual([]);
  });

  test('remove CNPJs duplicados antes das consultas', async () => {
    const service = new ReceitaService({} as any);
    const consultar = jest
      .spyOn(service, 'consultarQsaPorCnpj')
      .mockResolvedValue(empresa('11222333000181'));

    const resultado = await service.consultarQsaEmLoteDetalhado([
      '11222333000181',
      '11.222.333/0001-81',
    ]);

    expect(resultado.totalSolicitado).toBe(1);
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  test('respeita o limite configurado de concorrência', async () => {
    process.env.RECEITA_CNPJ_CONCURRENCY = '2';

    const service = new ReceitaService({} as any);
    let ativas = 0;
    let maximoSimultaneo = 0;

    jest.spyOn(service, 'consultarQsaPorCnpj').mockImplementation(async (cnpj) => {
      ativas += 1;
      maximoSimultaneo = Math.max(maximoSimultaneo, ativas);

      await new Promise((resolve) => setTimeout(resolve, 15));

      ativas -= 1;
      return empresa(cnpj.replace(/\D/g, ''));
    });

    await service.consultarQsaEmLoteDetalhado([
      '11222333000181',
      '22333444000172',
      '33444555000163',
      '44555666000154',
    ]);

    expect(maximoSimultaneo).toBeLessThanOrEqual(2);
  });

  test('mantém compatibilidade do método antigo e lança a primeira falha', async () => {
    const service = new ReceitaService({} as any);

    jest.spyOn(service, 'consultarQsaEmLoteDetalhado').mockResolvedValue({
      empresas: [empresa('11222333000181')],
      falhas: [{
        cnpj: '22333444000172',
        code: 'RECEITA_INDISPONIVEL',
        message: 'Fonte indisponível.',
        statusCode: 502,
      }],
      totalSolicitado: 2,
      totalSucesso: 1,
      totalFalhas: 1,
      conclusiva: false,
    });

    await expect(
      service.consultarQsaEmLote([
        '11222333000181',
        '22333444000172',
      ]),
    ).rejects.toMatchObject({
      code: 'RECEITA_INDISPONIVEL',
      statusCode: 502,
    });
  });
});
