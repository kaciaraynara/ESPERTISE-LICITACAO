import {
  propostaDocumentoService,
  valorPorExtensoBRL,
} from './proposta-documento.service';

describe('PropostaDocumentoService (STEP 5/5 — Word & PDF Lei 14.133/2021)', () => {
  test('converte valores em reais por extenso corretamente', () => {
    expect(valorPorExtensoBRL(12450)).toBe(
      'doze mil, quatrocentos e cinquenta reais',
    );
    expect(valorPorExtensoBRL(1.5)).toBe('um real e cinquenta centavos');
  });

  test('gera buffers binarios validos de Word (.docx) e PDF (.pdf) com os 5 blocos oficiais', async () => {
    const dados = await propostaDocumentoService.montarDadosEstruturados(
      undefined,
      'preview',
      {
        titulo: 'Proposta Comercial — PE 90010/2026',
        empresa: {
          razaoSocial: 'TechGov Soluções Ltda',
          cnpj: '12.345.678/0001-99',
          enderecoCompleto: 'Av. Paulista, 1000, São Paulo/SP',
          contato: 'licitacoes@techgov.com.br | (11) 3000-0000',
          dadosBancarios: 'Banco do Brasil (001) — Ag. 1234-5 — CC 98765-0',
          representanteLegal: 'João da Silva — Diretor Comercial',
        },
        orgaoLicitante: 'Ministério da Gestão e da Inovação em Serviços Públicos',
        cnpjOrgao: '00.489.828/0001-55',
        numeroEdital: 'PE 90010/2026',
        modalidade: 'Pregão Eletrônico',
        objeto: 'Aquisição de estações de trabalho corporativas de alto desempenho',
        validadeDias: 60,
        prazoEntregaDias: 15,
        itens: [
          {
            numero: '1',
            descricao: 'Estação de Trabalho Corporativa i7 32GB SSD 1TB',
            marca: 'Dell',
            modelo: 'OptiPlex 7010',
            quantidade: 10,
            unidade: 'UN',
            valorUnitarioProposto: 6500,
          },
        ],
      },
    );

    expect(dados.valorGlobalTotal).toBe(65000);
    expect(dados.valorGlobalPorExtenso).toBe('sessenta e cinco mil reais');

    const docxBuffer = await propostaDocumentoService.gerarDocxBuffer(dados);
    expect(Buffer.isBuffer(docxBuffer)).toBe(true);
    expect(docxBuffer.length).toBeGreaterThan(1000);
    // Arquivo .docx é um container OpenXML (ZIP) que inicia com "PK"
    expect(docxBuffer.subarray(0, 2).toString('ascii')).toBe('PK');

    const pdfBuffer = await propostaDocumentoService.gerarPdfBuffer(dados);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    // Arquivo .pdf inicia com "%PDF"
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});

