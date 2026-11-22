import { PrecificacaoController } from './precificacao.controller';

function mockResponse() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('PrecificacaoController.calcularMargens', () => {
  const controller = new PrecificacaoController();

  it('inclui os custos fixos detalhados no preço e devolve o breakdown', async () => {
    const req: any = {
      body: {
        custoProdutoServico: 1000,
        impostosPercentual: 10,
        custoOperacionalPercentual: 5,
        margemDesejadaPercentual: 20,
        custosIndiretosDetalhados: {
          prolabore: 100,
          funcionarios: 200,
          viagemEstadias: 0,
          fabricacao: 0,
          manutencaoSoftware: 0,
          dinheiroEmpresa: 0,
          despesasAdministrativas: 0,
        },
      },
    };
    const res = mockResponse();

    await controller.calcularMargens(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.custoOperacionalVal).toBe(50);
    expect(res.body.data.custosIndiretosFixos).toBe(300);
    expect(res.body.data.custosIndiretosValor).toBe(350);
    expect(res.body.data.custoBase).toBe(1350);
    // 1350 / (1 - 0,10 - 0,20) = 1928.5714...
    expect(res.body.data.precoSugerido).toBe(1928.57);
    expect(res.body.data.custosIndiretosDetalhados).toEqual(
      expect.objectContaining({ prolabore: 100, funcionarios: 200 }),
    );
  });

  it('rejeita custo detalhado negativo', async () => {
    const req: any = {
      body: {
        custoProdutoServico: 1000,
        impostosPercentual: 10,
        custoOperacionalPercentual: 5,
        margemDesejadaPercentual: 20,
        custosIndiretosDetalhados: { prolabore: -1 },
      },
    };
    const res = mockResponse();

    await controller.calcularMargens(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_CUSTO_DETALHADO');
  });

  it('rejeita impostos + margem maiores ou iguais a 100%', async () => {
    const req: any = {
      body: {
        custoProdutoServico: 1000,
        impostosPercentual: 60,
        custoOperacionalPercentual: 5,
        margemDesejadaPercentual: 40,
      },
    };
    const res = mockResponse();

    await controller.calcularMargens(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_COMBINACAO_IMPOSTOS_MARGEM');
  });

  it('mantém o cálculo anterior quando não há custos detalhados', async () => {
    const req: any = {
      body: {
        custoProdutoServico: 1000,
        impostosPercentual: 10,
        custoOperacionalPercentual: 5,
        margemDesejadaPercentual: 20,
      },
    };
    const res = mockResponse();

    await controller.calcularMargens(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.custosIndiretosFixos).toBe(0);
    expect(res.body.data.custoBase).toBe(1050);
    expect(res.body.data.precoSugerido).toBe(1500);
  });
});
