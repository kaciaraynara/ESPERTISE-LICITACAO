import { proposalService } from './proposal.service';

describe('proposalService.calcularPrecificacao', () => {
  const base = {
    custoDireto: 100,
    tributosPercentual: 10,
    valorReferenciaEdital: 500,
  };

  it('marca sinal vermelho quando o preço ofertado é igual ao custo base', () => {
    const resultado = proposalService.calcularPrecificacao({ ...base, precoOfertado: 110 });

    expect(resultado.custoBase).toBe(110);
    expect(resultado.precoMinimo).toBe(121);
    expect(resultado.statusExequibilidade).toBe('Risco de Inexequibilidade (Sinal Vermelho)');
  });

  it('marca sinal amarelo quando o preço está acima do custo, mas abaixo do piso de 10%', () => {
    const resultado = proposalService.calcularPrecificacao({ ...base, precoOfertado: 115 });

    expect(resultado.statusExequibilidade).toBe('Margem abaixo do mínimo recomendado (Sinal Amarelo)');
  });

  it('marca sinal verde somente a partir do preço mínimo calculado', () => {
    const resultado = proposalService.calcularPrecificacao({ ...base, precoOfertado: 121 });

    expect(resultado.statusExequibilidade).toBe('Exequível (Sinal Verde)');
  });

  it('não substitui o preço não informado pelo valor do edital', () => {
    const resultado = proposalService.calcularPrecificacao(base);

    expect(resultado.precoOfertado).toBeNull();
    expect(resultado.statusExequibilidade).toBe('Preço não informado (Sinal Amarelo)');
  });

  it('limita alíquotas inválidas à faixa de 0 a 100 por cento', () => {
    const resultado = proposalService.calcularPrecificacao({
      ...base,
      tributosPercentual: 250,
      precoOfertado: 210,
    });

    expect(resultado.custoBase).toBe(200);
    expect(resultado.precoMinimo).toBe(220);
    expect(resultado.statusExequibilidade).toBe('Margem abaixo do mínimo recomendado (Sinal Amarelo)');
  });
});
