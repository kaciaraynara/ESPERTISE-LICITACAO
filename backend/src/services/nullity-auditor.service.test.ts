import { auditEditalNullities } from './nullity-auditor.service';

describe('nullity-auditor.service', () => {
  test('não gera falso positivo de marca/modelo para ANEXO IV - MODELO DE DECLARAÇÃO (caso Município de Juruaia)', () => {
    const textoJuruaia = `
[Página 1 de PRC_193_26_PREGAO_105_26_CAIXAS_DE_BOMBOM.pdf]
PREGÃO ELETRÔNICO Nº 105/2026 - MUNICÍPIO DE JURUAIA/MG
Objeto: Aquisição de caixas de bombom para eventos escolares.

[Página 2 de PRC_193_26_PREGAO_105_26_CAIXAS_DE_BOMBOM.pdf]
ANEXO IV - MODELO DE DECLARAÇÃO DE CUMPRIMENTO DE COTA DE APRENDIZAGEM
Declaramos, para os devidos fins, que a empresa cumpre a cota de aprendizagem prevista em lei.
`;

    const vicios = auditEditalNullities(textoJuruaia);
    expect(vicios).toHaveLength(0);
  });

  test('detecta exigência real de marca específica sem "ou equivalente" com página, cláusula e análise especialista', () => {
    const textoViciado = `
[Página 7 de Edital_Equipamentos.pdf]
4. ESPECIFICAÇÕES TÉCNICAS DO OBJETO
4.2.1 O fornecedor deverá cotar exclusivamente da marca AlphaTech Pro, vedada a substituição de marca sob pena de desclassificação.
`;

    const vicios = auditEditalNullities(textoViciado);
    expect(vicios).toHaveLength(1);
    expect(vicios[0].id).toBe('vicio-direcionamento-marca');
    expect(vicios[0].arquivoOrigem).toBe('Edital_Equipamentos.pdf');
    expect(vicios[0].pagina).toBe(7);
    expect(vicios[0].clausula).toBe('4.2.1');
    expect(vicios[0].trechoLiteral).toContain('exclusivamente da marca AlphaTech Pro');
    expect(vicios[0].explicacaoSimples.length).toBeGreaterThan(120);
  });

  test('detecta aglutinação em Lote Único / Preço Global sem justificativa técnica (Súmula 247 TCU)', () => {
    const textoLoteUnico = `
[Página 5 de Edital_Servicos_TI.pdf]
5. DO CRITÉRIO DE JULGAMENTO
5.1 A presente contratação terá julgamento pelo critério de menor preço global em lote único, reunindo os itens de fornecimento de equipamentos, licenciamento de software e suporte técnico.
`;

    const vicios = auditEditalNullities(textoLoteUnico);
    const vicio = vicios.find((v) => v.id === 'vicio-lote-unico-indivisivel');
    expect(vicio).toBeDefined();
    expect(vicio?.gravidade).toBe('MEDIO');
    expect(vicio?.arquivoOrigem).toBe('Edital_Servicos_TI.pdf');
    expect(vicio?.pagina).toBe(5);
    expect(vicio?.clausula).toBe('5.1');
    expect(vicio?.fundamentoLegal).toContain('247');
    expect(vicio?.explicacaoSimples.length).toBeGreaterThan(120);
  });

  test('não dispara vicio-lote-unico-indivisivel quando há justificativa técnica expressa de indivisibilidade', () => {
    const textoJustificado = `
[Página 6 de Edital_Integrado.pdf]
5.2 O julgamento será por lote único em razão da justificativa técnica de integração sistêmica e indivisibilidade do objeto, sob pena de perda comprovada de economia de escala e inviabilidade técnica do parcelamento dos itens.
`;

    const vicios = auditEditalNullities(textoJustificado);
    expect(vicios.some((v) => v.id === 'vicio-lote-unico-indivisivel')).toBe(false);
  });

  test('detecta exigência ilegal de vínculo empregatício prévio do responsável técnico (CTPS / quadro permanente)', () => {
    const textoVinculo = `
[Página 14 de Edital_Engenharia.pdf]
9.4 QUALIFICAÇÃO TÉCNICA
9.4.2 Para fins de habilitação, a licitante deverá comprovar que o responsável técnico pertence ao quadro permanente na data da sessão pública, mediante apresentação obrigatória de CTPS assinada ou ficha de registro de empregado.
`;

    const vicios = auditEditalNullities(textoVinculo);
    const vicio = vicios.find((v) => v.id === 'vicio-vinculo-empregaticio-previo');
    expect(vicio).toBeDefined();
    expect(vicio?.gravidade).toBe('ALTO');
    expect(vicio?.arquivoOrigem).toBe('Edital_Engenharia.pdf');
    expect(vicio?.pagina).toBe(14);
    expect(vicio?.clausula).toBe('9.4.2');
    expect(vicio?.fundamentoLegal).toContain('272');
    expect(vicio?.explicacaoSimples.length).toBeGreaterThan(120);
  });

  test('ignora sumários e modelos de declaração mesmo que mencionem termos sensíveis', () => {
    const textoIgnorado = `
[Página 1 de Edital_Sumario.pdf]
SUMÁRIO ................................................ 14
9.4.2 Lote único e vínculo empregatício ................. 14

[Página 20 de Edital_Sumario.pdf]
ANEXO V - MODELO DE DECLARAÇÃO DE DISPONIBILIDADE
Declaramos para fins de participação no lote único que o profissional possui vínculo conforme edital.
`;

    const vicios = auditEditalNullities(textoIgnorado);
    expect(vicios).toHaveLength(0);
  });
});
