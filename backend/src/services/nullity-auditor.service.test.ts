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
});
