import {
  calcularPrazoDecadencialImpugnacao,
  calcularPrazosMinimosApresentacaoProposta,
  calcularPrazosRecursoLei14133,
} from './prazos.util';

describe('PrazosUtil - Lei 14.133/2021', () => {
  describe('calcularPrazoDecadencialImpugnacao (Art. 164)', () => {
    test('calcula prazo de 3 dias uteis retroativos a partir de uma terca-feira', () => {
      // 2026-10-20 e terca-feira
      const resultado = calcularPrazoDecadencialImpugnacao('2026-10-20');

      expect(resultado.diasUteisAntes).toBe(3);
      expect(resultado.fundamentoLegal.artigo).toBe('art. 164, caput');
      // 1 dia util antes: 2026-10-19 (segunda)
      // 2 dias uteis antes: 2026-10-16 (sexta)
      // 3 dias uteis antes: 2026-10-15 (quinta)
      expect(resultado.prazoDecadencial).toBe('2026-10-15');
    });
  });

  describe('calcularPrazosMinimosApresentacaoProposta (Art. 55)', () => {
    test('aquisição de bens por menor preço exige 8 dias úteis (Art. 55, I, a)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'BENS',
        criterioJulgamento: 'MENOR_PRECO',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(8);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, I, "a"');
    });

    test('aquisição de bens por outros critérios exige 15 dias úteis (Art. 55, I, b)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'BENS',
        criterioJulgamento: 'MELHOR_TECNICA',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(15);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, I, "b"');
    });

    test('serviços comuns menor preço exige 10 dias úteis (Art. 55, II, a)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'SERVICOS_COMUNS',
        criterioJulgamento: 'MENOR_PRECO',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(10);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, II, "a"');
    });

    test('serviços especiais menor preço exige 25 dias úteis (Art. 55, II, b)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'SERVICOS_ESPECIAIS',
        criterioJulgamento: 'MENOR_PRECO',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(25);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, II, "b"');
    });

    test('contratação integrada exige 60 dias úteis (Art. 55, II, c)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'CONTRATACAO_INTEGRADA',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(60);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, II, "c"');
    });

    test('leilão exige 15 dias úteis (Art. 55, III)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'LEILAO',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(15);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, III');
    });

    test('concurso exige 35 dias úteis (Art. 55, IV)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'CONCURSO',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(35);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, IV');
    });

    test('diálogo competitivo exige 25 dias úteis para manifestação (Art. 55, V)', () => {
      const res = calcularPrazosMinimosApresentacaoProposta({
        tipoObjeto: 'DIALOGO_COMPETITIVO',
        dataPublicacaoEdital: '2026-10-01',
      });

      expect(res.diasUteisMinimos).toBe(25);
      expect(res.fundamentoLegal.inciso).toContain('art. 55, V');
    });
  });

  describe('calcularPrazosRecursoLei14133 (Art. 165)', () => {
    test('calcula 3 dias uteis para razoes e 3 dias uteis para contrarrazoes', () => {
      // 2026-10-01 e quinta-feira
      const resultado = calcularPrazosRecursoLei14133('2026-10-01');

      expect(resultado.diasUteisRazoes).toBe(3);
      expect(resultado.diasUteisContrarrazoes).toBe(3);
      expect(resultado.diasUteisDecisao).toBe(10);
      expect(resultado.prazoIntencao).toContain('Imediata em sessão');
      expect(resultado.fundamentoLegal.artigo).toBe('art. 165');
      // 3 dias úteis a partir de 2026-10-01 (qui): sex(2), seg(5), ter(6)
      expect(resultado.limiteRazoesRecursais).toBe('2026-10-06');
    });
  });
});
