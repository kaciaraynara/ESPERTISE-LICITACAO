import { keywordsForCnae } from './cnae-to-keywords.service';

describe('keywordsForCnae', () => {
  it('deduz termos de busca de construção civil a partir do código CNAE', () => {
    expect(keywordsForCnae('4120-4/00 - Construção de edifícios')).toEqual(
      expect.arrayContaining(['obra', 'construção', 'engenharia', 'reforma']),
    );
  });

  it('deduz termos de tecnologia para CNAEs de software', () => {
    expect(keywordsForCnae('6201-5/01 - Desenvolvimento de programas de computador')).toEqual(
      expect.arrayContaining(['software', 'tecnologia', 'sistemas']),
    );
  });

  it('retorna lista vazia quando o CNAE ainda não está disponível', () => {
    expect(keywordsForCnae(null)).toEqual([]);
  });
});
