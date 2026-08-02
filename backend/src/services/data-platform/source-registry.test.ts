import { assertSafeDataSource, listDataSources } from './source-registry';

describe('data platform source registry', () => {
  test('registra fontes prioritarias sem scraping inseguro', () => {
    const sources = listDataSources();
    const codes = sources.map((source) => source.code).sort();

    expect(codes).toEqual([
      'cade',
      'compras_gov',
      'pncp',
      'portal_transparencia',
      'receita_federal',
      'tcu',
    ]);
    expect(sources.every((source) => source.safeAccessOnly)).toBe(true);
    expect(sources.every((source) => source.accessMode !== undefined)).toBe(true);
  });

  test('TCU e CADE ficam preparados apenas para API configurada', () => {
    expect(assertSafeDataSource('tcu').accessMode).toBe('configured_api');
    expect(assertSafeDataSource('cade').accessMode).toBe('configured_api');
  });
});
