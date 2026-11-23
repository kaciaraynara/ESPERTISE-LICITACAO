import {
  MAPA_ESTADOS_BRASIL,
  HabilitacaoService,
  formatarCnpj,
  obterLinkMunicipal,
} from './habilitacao.service';

jest.mock('../database/prisma', () => ({
  prisma: {
    company: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'empresa-teste-123',
        razaoSocial: 'EMPRESA EXEMPLAR COMERCIO E SERVICOS LTDA',
        cnpj: '12345678000199',
        municipio: 'Fortaleza',
        uf: 'CE',
      }),
    },
    document: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

describe('Serviço de Documentos de Habilitação (Lei nº 14.133/2021)', () => {
  const service = new HabilitacaoService();

  const empresaMock = {
    id: 'empresa-teste-123',
    razaoSocial: 'EMPRESA EXEMPLAR COMERCIO E SERVICOS LTDA',
    nomeFantasia: 'EXEMPLAR SUPRIMENTOS',
    cnpj: '12345678000199',
    municipio: 'Fortaleza',
    uf: 'CE',
    logradouro: 'Av. Santos Dumont, 1000',
    bairro: 'Aldeota',
    cep: '60150-160',
    cnaePrincipal: '47.81-4-00 - Comércio varejista de artigos do vestuário e acessórios',
    porte: 'Microempresa (ME)',
  };

  it('1. Deve cobrir exatamente todos os 26 estados brasileiros + DF com links válidos de SEFAZ e Tribunal de Justiça', () => {
    const siglasEsperadas = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
    ];

    expect(Object.keys(MAPA_ESTADOS_BRASIL).length).toBe(27);

    siglasEsperadas.forEach((uf) => {
      const config = MAPA_ESTADOS_BRASIL[uf];
      expect(config).toBeDefined();
      expect(config.uf).toBe(uf);
      expect(config.nomeEstado.length).toBeGreaterThan(0);
      expect(config.urlSefaz).toMatch(/^https?:\/\//i);
      expect(config.urlTribunalJustica).toMatch(/^https?:\/\//i);
    });
  });

  it('2. Deve formatar CNPJ corretamente e gerar link para prefeitura municipal', () => {
    expect(formatarCnpj('12345678000199')).toBe('12.345.678/0001-99');

    const linkSp = obterLinkMunicipal('São Paulo', 'SP');
    expect(linkSp).toContain('prefeitura.sp.gov.br');

    const linkFortaleza = obterLinkMunicipal('Fortaleza', 'CE');
    expect(linkFortaleza).toContain('sefin.fortaleza.ce.gov.br');

    const linkGenerico = obterLinkMunicipal('Sobral', 'CE');
    expect(linkGenerico).toMatch(/^https?:\/\//i);
  });

  it('3. Deve gerar arquivo PDF válido e completo das Declarações Obrigatórias da Lei 14.133/2021', async () => {
    const buffer = await service.gerarBufferPdfDeclaracoesLei14133(empresaMock);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1500);

    // Assinatura de cabeçalho PDF (%PDF-)
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('4. Deve exigir comprovante oficial da Receita Federal para CNPJ e não gerar documento apócrifo', async () => {
    const status = await service.obterStatusDocumentos('user-1', 'emp-1');
    const itemCnpj = status.itens.find((i) => i.codigo === 1);

    expect(itemCnpj).toBeDefined();
    expect(itemCnpj?.automatico).toBe(false);
    expect(itemCnpj?.exigePortalGoverno).toBe(true);
    expect(itemCnpj?.linkOficial).toContain('receita.fazenda.gov.br');
  });
});
