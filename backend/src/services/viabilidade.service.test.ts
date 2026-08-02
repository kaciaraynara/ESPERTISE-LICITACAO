import { calcularViabilidade } from './viabilidade.service';

describe('viabilidade.service', () => {
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
