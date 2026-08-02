const consultarQsaEmLoteDetalhado = jest.fn();

jest.mock('../services/receita.service', () => {
  const actual = jest.requireActual('../services/receita.service');

  return {
    ...actual,
    ReceitaService: jest.fn().mockImplementation(() => ({
      consultarQsaEmLoteDetalhado,
    })),
  };
});

jest.mock('../services/concorrentes.service', () => ({
  ConcorrentesService: jest.fn().mockImplementation(() => ({
    gerarDossie: jest.fn(),
  })),
}));

import { ConcorrentesController } from './concorrentes.controller';

function responseMock() {
  const res: any = {
    statusCode: 200,
    payload: undefined,
  };

  res.status = jest.fn((statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  });

  res.json = jest.fn((payload: unknown) => {
    res.payload = payload;
    return res;
  });

  return res;
}

describe('ConcorrentesController - malha fina resiliente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('marca como inconclusiva e impede risco baixo quando há falha parcial', async () => {
    consultarQsaEmLoteDetalhado.mockResolvedValue({
      empresas: [{
        fonte: 'brasilapi-cnpj',
        cnpj: '11222333000181',
        razaoSocial: 'Empresa Consultada Ltda.',
        nomeFantasia: null,
        situacaoCadastral: 'ATIVA',
        municipio: 'Fortaleza',
        uf: 'CE',
        qsa: [{
          nome: 'Sócio Único',
          documentoMascarado: '***123***',
          qualificacao: 'Sócio-Administrador',
          dataEntradaSociedade: null,
        }],
        consultadoEm: '2026-06-16T12:00:00.000Z',
      }],
      falhas: [{
        cnpj: '22333444000172',
        code: 'RECEITA_TIMEOUT',
        message: 'Tempo limite excedido.',
        statusCode: 504,
      }],
      totalSolicitado: 2,
      totalSucesso: 1,
      totalFalhas: 1,
      conclusiva: false,
    });

    const req: any = {
      user: { id: 'user-1' },
      body: {
        cnpjs: [
          '11222333000181',
          '22333444000172',
        ],
      },
    };

    const res = responseMock();
    const controller = new ConcorrentesController();

    await controller.malhaFina(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        statusAnalise: 'INCONCLUSIVA',
        conclusiva: false,
        risco: 'MEDIO',
        resumo: {
          totalSolicitado: 2,
          totalConsultasComSucesso: 1,
          totalConsultasComFalha: 1,
        },
        consultasComFalha: [{
          cnpj: '22333444000172',
          status: 'FALHA',
          code: 'RECEITA_TIMEOUT',
        }],
      },
    });

    expect(res.payload.data.recomendacoes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('inconclusiva'),
        expect.stringContaining('Não interprete a ausência de vínculo'),
      ]),
    );
  });

  test('rejeita mais de vinte CNPJs', async () => {
    const req: any = {
      user: { id: 'user-1' },
      body: {
        cnpjs: Array.from(
          { length: 21 },
          (_, index) => `${String(index + 1).padStart(12, '0')}01`,
        ),
      },
    };

    const res = responseMock();
    const controller = new ConcorrentesController();

    await controller.malhaFina(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      message: 'Dados inválidos para investigação de concorrentes.',
    });

    expect(consultarQsaEmLoteDetalhado).not.toHaveBeenCalled();
  });
});
