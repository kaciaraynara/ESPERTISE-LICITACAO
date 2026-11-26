import {
  buildRadarSqlQuery,
  normalizeModalityFilter,
  normalizeSourceValues,
  parsePalavras,
  parseTipoObjeto,
  parseUfs,
} from './radar-query-builder.service';

describe('radar-query-builder.service', () => {
  test('parseUfs suporta UF simples, lista separada por vírgula e ignora TODOS/BR', () => {
    expect(parseUfs('ce')).toEqual(['CE']);
    expect(parseUfs('CE, pe; ba TODOS BR XX')).toEqual(['CE', 'PE', 'BA']);
    expect(parseUfs(['to', 'CE', 'ce'])).toEqual(['TO', 'CE']);
  });

  test('normalizeSourceValues mapeia todas as fontes oficiais sem distorção', () => {
    expect(normalizeSourceValues('TODAS')).toBeNull();
    expect(normalizeSourceValues('pncp')).toEqual(['PNCP', 'pncp']);
    expect(normalizeSourceValues('ComprasGov')).toEqual(['ComprasGov', 'compras_gov', 'comprasgov']);
    expect(normalizeSourceValues('querido_diario')).toEqual(['querido_diario', 'QueridoDiario', 'QUERIDO_DIARIO']);
  });

  test('parseTipoObjeto e parsePalavras limpam duplicadas e acentos', () => {
    expect(parseTipoObjeto('bens, serviços, obras, TODAS')).toEqual(['BENS', 'SERVICOS', 'OBRAS']);
    expect(parsePalavras('uniformes, Uniformes; fardamento, a')).toEqual(['uniformes', 'fardamento']);
  });

  test('normalizeModalityFilter resolve códigos PNCP e SRP', () => {
    expect(normalizeModalityFilter('SRP')).toEqual({ isSrp: true, term: null });
    expect(normalizeModalityFilter('6')).toEqual({ isSrp: false, term: 'Pregão' });
    expect(normalizeModalityFilter('8')).toEqual({ isSrp: false, term: 'Dispensa' });
  });

  test('buildRadarSqlQuery gera consulta parametrizada com apenasAbertos, baixaProcura e FTS', () => {
    const built = buildRadarSqlQuery({
      uf: 'CE,PE',
      fonte: 'PNCP',
      apenasAbertos: true,
      baixaProcura: true,
      q: 'vestuario',
      palavras: ['uniformes', 'fardamento'],
      tipoObjeto: 'BENS',
      incluirSemClassificacao: true,
      ordenarPor: 'maior_valor',
    });

    expect(built.baseWhereSql).toContain('uf = ANY($1::text[])');
    expect(built.baseWhereSql).toContain('source = ANY($2::text[])');
    expect(built.baseWhereSql).toContain("NOT (COALESCE(status, '') ~* '(suspens|revogad|anulad|cancelad|encerrad|desert|fracassad|homologad)')");
    expect(built.baseWhereSql).toContain("source = 'querido_diario'");
    expect(built.baseWhereSql).toContain("COALESCE(object_type, '') <> 'OBRAS'");
    expect(built.baseWhereSql).toContain("plainto_tsquery('portuguese', public.immutable_unaccent($3))");
    expect(built.baseParams).toEqual([
      ['CE', 'PE'],
      ['PNCP', 'pncp'],
      'vestuario',
      '%vestuario%',
      'uniformes',
      'fardamento',
    ]);
    expect(built.fullWhereSql).toContain('(object_type = ANY($7::text[]) OR object_type IS NULL)');
    expect(built.listParams).toEqual([
      ['CE', 'PE'],
      ['PNCP', 'pncp'],
      'vestuario',
      '%vestuario%',
      'uniformes',
      'fardamento',
      ['BENS'],
    ]);
    expect(built.orderBySql).toBe('estimated_value DESC NULLS LAST, published_at DESC NULLS LAST, id DESC');
  });

  test('buildRadarSqlQuery suporta busca por código/CNPJ, tipoObjeto estrito e todas as ordenações', () => {
    const codeSearch = buildRadarSqlQuery({
      q: '12345678/2026',
      tipoObjeto: 'SERVICOS',
      incluirSemClassificacao: false,
      ordenarPor: 'encerramento',
    });

    expect(codeSearch.fullWhereSql).toContain('notice_number ILIKE');
    expect(codeSearch.fullWhereSql).toContain('object_type = ANY(');
    expect(codeSearch.fullWhereSql).not.toContain('object_type IS NULL');
    expect(codeSearch.orderBySql).toContain('closing_at ASC NULLS LAST');

    const menorValor = buildRadarSqlQuery({ ordenarPor: 'menor_valor' });
    expect(menorValor.orderBySql).toContain('estimated_value ASC NULLS LAST');

    const relevancia = buildRadarSqlQuery({
      ordenarPor: 'relevancia',
      profileKeywords: ['uniformes'],
      profileUfs: ['CE'],
    });
    expect(relevancia.orderBySql).toContain('ts_rank_cd(search_vector');
    expect(relevancia.orderBySql).toContain('CASE WHEN uf = ANY(');
  });
});
