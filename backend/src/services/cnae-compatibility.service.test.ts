import { evaluateNoticeViability, filtrarAvaliacoesAderentes } from './cnae-compatibility.service';

describe('cnae-compatibility.service', () => {
  const docsOk = {
    carregado: true,
    documentosCofre: 5,
    certidoesValidas: 5,
    certidoesPendentes: 0,
  };

  const clothingCompany = {
    cnaePrincipal: '4781-4/00 - Comércio varejista de artigos do vestuário e acessórios',
    cnaesSecundarios: ['1412-6/01 - Confecção de peças do vestuário'],
    palavrasChave: ['uniformes', 'camisas'],
    uf: 'CE',
    porte: 'ME/EPP',
  };

  const engineeringCompany = {
    cnaePrincipal: '4120-4/00 - Construção de edifícios',
    cnaesSecundarios: ['4211-1/01 - Construção de rodovias e ferrovias'],
    palavrasChave: ['obra', 'reforma', 'pavimentação'],
    uf: 'SP',
    porte: 'EPP',
  };

  test('Loja de Roupas pontua alto em edital de uniformes e bloqueia lavadora de roupas e insumos hospitalares', () => {
    const futuro = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const matchUniformes = evaluateNoticeViability(
      {
        object: 'Aquisição de uniformes escolares e camisetas para a rede municipal',
        uf: 'CE',
        estimatedValue: 65000,
        closingAt: futuro,
      },
      clothingCompany,
      docsOk,
    );
    expect(matchUniformes.cnaeCompativel).toBe(true);
    expect(matchUniformes.nivel).toBe('PRONTO');
    expect(matchUniformes.pontuacao).toBeGreaterThanOrEqual(70);

    const lavadora = evaluateNoticeViability(
      {
        object: 'Aquisição de máquina de lavar e lavadora de roupa industrial',
        uf: 'CE',
        estimatedValue: 50000,
        closingAt: futuro,
      },
      clothingCompany,
      docsOk,
    );
    expect(lavadora.cnaeCompativel).toBe(false);
    expect(lavadora.nivel).toBe('FORA');
    expect(lavadora.pontuacao).toBeLessThanOrEqual(15);

    const hospitalar = evaluateNoticeViability(
      {
        object: 'Aquisição de insumos hospitalares e medicamentos para pronto socorro',
        uf: 'CE',
        estimatedValue: 40000,
        closingAt: futuro,
      },
      clothingCompany,
      docsOk,
    );
    expect(hospitalar.cnaeCompativel).toBe(false);
    expect(hospitalar.nivel).toBe('FORA');
    expect(hospitalar.pontuacao).toBeLessThanOrEqual(15);
  });

  test('Engenharia Civil pontua alto em obra/reforma e bloqueia alimentação/merenda', () => {
    const futuro = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);

    const matchObra = evaluateNoticeViability(
      {
        object: 'Contratação de empresa de engenharia para reforma e manutenção predial de escola',
        uf: 'SP',
        estimatedValue: 250000,
        closingAt: futuro,
      },
      engineeringCompany,
      docsOk,
    );
    expect(matchObra.cnaeCompativel).toBe(true);
    expect(matchObra.nivel).toBe('PRONTO');
    expect(matchObra.pontuacao).toBeGreaterThanOrEqual(70);

    const merenda = evaluateNoticeViability(
      {
        object: 'Aquisição de gêneros alimentícios para merenda escolar',
        uf: 'SP',
        estimatedValue: 75000,
        closingAt: futuro,
      },
      engineeringCompany,
      docsOk,
    );
    expect(merenda.cnaeCompativel).toBe(false);
    expect(merenda.nivel).toBe('FORA');
    expect(merenda.pontuacao).toBeLessThanOrEqual(15);
  });

  test('filtrarAvaliacoesAderentes nunca mistura editais com cnaeCompativel=false ou bloqueadoPorTermoNegativo=true na lista principal', () => {
    const futuro = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const amostraPequena = [
      evaluateNoticeViability({ object: 'Aquisição de uniformes e fardamento escolar', uf: 'CE', estimatedValue: 50000, closingAt: futuro }, clothingCompany, docsOk),
      evaluateNoticeViability({ object: 'Aquisição de lavadora de roupas industrial', uf: 'CE', estimatedValue: 30000, closingAt: futuro }, clothingCompany, docsOk),
      evaluateNoticeViability({ object: 'Aquisição de insumos hospitalares e medicamentos', uf: 'CE', estimatedValue: 40000, closingAt: futuro }, clothingCompany, docsOk),
    ];

    const { aderentes, foraDoPerfil } = filtrarAvaliacoesAderentes(amostraPequena);
    expect(aderentes).toHaveLength(1);
    expect(aderentes[0].cnaeCompativel).toBe(true);
    expect(aderentes[0].bloqueadoPorTermoNegativo).toBe(false);
    expect(foraDoPerfil).toHaveLength(2);
    expect(aderentes.some((a) => a.cnaeCompativel === false || a.bloqueadoPorTermoNegativo === true)).toBe(false);
  });
});
