import { DataNormalizationService } from '../normalization.service';
import { ComprasGovDataConnector } from './comprasgov.adapter';
import { PncpDataConnector } from './pncp.adapter';

describe('official source adapters', () => {
  test('normaliza PNCP para procurement_notice compatível com a data platform', async () => {
    const connector = new PncpDataConnector(async () => ({
      totalRegistros: 1,
      pagina: 1,
      tamanhoPagina: 1,
      data: [{
        numeroControlePNCP: 'PNCP-2026-001',
        objeto: 'Contratacao de plataforma SaaS com termo de referencia detalhado',
        modalidadeNome: 'Pregao eletronico',
        situacaoCompraNome: 'Publicada',
        orgaoEntidade: { razaoSocial: 'Ministerio Teste', cnpj: '12345678000190' },
        unidadeOrgao: { ufSigla: 'DF', municipioNome: 'Brasilia', nomeUnidade: 'Unidade Teste' },
        valorTotalEstimado: 250000,
        dataPublicacaoPncp: '2026-06-01',
        dataAberturaProposta: '2026-06-10',
        dataEncerramentoProposta: '2026-06-12',
        linkEditalPNCP: 'https://pncp.gov.br/edital/teste',
      }],
    }));

    const [raw] = await connector.fetch({ tenantId: 'tenant-1', limit: 1 });
    const normalized = new DataNormalizationService().normalize(raw);

    expect(raw.source).toBe('pncp');
    expect(raw.entityType).toBe('procurement_notice');
    expect(normalized.externalId).toBe('PNCP-2026-001');
    expect(normalized.title).toContain('Contratacao de plataforma SaaS');
    expect(normalized.fields).toMatchObject({
      uf: 'DF',
      municipality: 'Brasilia',
      modality: 'Pregao eletronico',
      buyerName: 'Ministerio Teste',
      buyerDocument: '12345678000190',
      estimatedValue: 250000,
    });
  });

  test('normaliza Compras.gov para procurement_notice compatível com a data platform', async () => {
    const connector = new ComprasGovDataConnector(async () => ({
      total: 1,
      data: [{
        id: 'UASG-123-PE-45',
        numero: '45/2026',
        objeto: 'Aquisicao de notebooks para escolas publicas',
        orgao: 'UASG 123',
        uasg: '123',
        uf: 'SP',
        valor_estimado: 98000,
        data_abertura: '2026-07-01',
        data_encerramento: '2026-07-03',
        modalidade: 'Pregao',
        situacao: 'Publicada',
        link: 'https://compras.dados.gov.br/pregao/teste',
      }],
    }));

    const [raw] = await connector.fetch({ filters: { uf: 'SP' } });
    const normalized = new DataNormalizationService().normalize(raw);

    expect(raw.source).toBe('compras_gov');
    expect(normalized.externalId).toBe('UASG-123-PE-45');
    expect(normalized.fields).toMatchObject({
      uf: 'SP',
      modality: 'Pregao',
      buyerName: 'UASG 123',
      estimatedValue: 98000,
    });
  });
});
