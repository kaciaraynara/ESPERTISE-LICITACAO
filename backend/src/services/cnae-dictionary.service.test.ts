import { expandirTermosCnae } from './cnae-dictionary.service';

describe('cnae-dictionary.service (Etapa 5 — matching por prefixo sem falso positivo)', () => {
  test('expande todos os 10 CNAEs de referência para seus segmentos corretos sem colisão cruzada', () => {
    const vestuario = expandirTermosCnae('1412601');
    expect(vestuario).toEqual(expect.arrayContaining(['vestuario', 'uniforme', 'fardamento']));
    expect(vestuario).not.toContain('transporte');

    const software = expandirTermosCnae('6201501');
    expect(software).toEqual(expect.arrayContaining(['software', 'sistema', 'tecnologia']));
    expect(software).not.toContain('medicamento');

    const obras = expandirTermosCnae('4120400');
    expect(obras).toEqual(expect.arrayContaining(['obra', 'engenharia', 'reforma', 'construcao']));

    const limpeza = expandirTermosCnae('8121400');
    expect(limpeza).toEqual(expect.arrayContaining(['limpeza', 'higiene', 'conservacao']));

    // Caso crítico: "4645101" contém "45", mas NÃO pode casar grupo Transporte (prefixo "45")
    const hospitalar = expandirTermosCnae('4645101');
    expect(hospitalar).toEqual(expect.arrayContaining(['medicamento', 'hospitalar', 'medico', 'cirurgico']));
    expect(hospitalar).not.toContain('transporte');
    expect(hospitalar).not.toContain('locacao de veiculo');

    const alimentos = expandirTermosCnae('4639701');
    expect(alimentos).toEqual(expect.arrayContaining(['alimento', 'alimenticio', 'merenda']));

    const moveis = expandirTermosCnae('4649404');
    expect(moveis).toEqual(expect.arrayContaining(['mobiliario', 'cadeira', 'mesa']));
    expect(moveis).not.toContain('detergente');

    const papelaria = expandirTermosCnae('4647801');
    expect(papelaria).toEqual(expect.arrayContaining(['papelaria', 'expediente', 'material escolar']));

    const eletrica = expandirTermosCnae('4321500');
    expect(eletrica).toEqual(expect.arrayContaining(['eletrica', 'iluminacao', 'instalacao']));

    const transporte = expandirTermosCnae('4930202');
    expect(transporte).toEqual(expect.arrayContaining(['transporte', 'frete', 'logistica']));
  });

  test('suporta código CNAE formatado com descrição completa sem falsos matches de substring', () => {
    const termos = expandirTermosCnae('4645-1/01 - Comércio atacadista de instrumentos e materiais para uso médico, cirúrgico, hospitalar');
    expect(termos).toEqual(expect.arrayContaining(['hospitalar', 'medico', 'cirurgico']));
    expect(termos).not.toContain('transporte');
  });
});
