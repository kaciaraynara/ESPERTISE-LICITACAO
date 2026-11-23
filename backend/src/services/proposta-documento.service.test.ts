import {
  propostaDocumentoService,
  valorPorExtensoBRL,
} from './proposta-documento.service';

describe('PropostaDocumentoService (STEP 5/5 — Word & PDF Lei 14.133/2021)', () => {
  test('converte valores em reais por extenso corretamente com regras de ligacao e milhao exato', () => {
    expect(valorPorExtensoBRL(12450)).toBe(
      'doze mil, quatrocentos e cinquenta reais',
    );
    expect(valorPorExtensoBRL(1.5)).toBe('um real e cinquenta centavos');
    expect(valorPorExtensoBRL(1000000)).toBe('um milhão de reais');
    expect(valorPorExtensoBRL(1050)).toBe('mil e cinquenta reais');
  });

  test('nao injeta CNPJ 00.000.000/0001-00 nem contradicao sessenta e garante exatidao matematica dos itens', async () => {
    const dados = await propostaDocumentoService.montarDadosEstruturados(
      undefined,
      'preview',
      {
        titulo: 'Proposta Teste Zero-Erro',
        validadeDias: 90,
        itens: [
          {
            numero: '1',
            descricao: 'Item Teste Arredondamento',
            quantidade: 3,
            unidade: 'UN',
            valorUnitarioProposto: 10.335,
            precoTotalProposto: 9999.99, // divergente: deve ser recalculado para 3 * 10.34 = 31.02
          },
        ],
      },
    );

    expect(dados.empresa.cnpj).not.toBe('00.000.000/0001-00');
    expect(dados.empresa.dadosBancarios).not.toContain('Banco do Brasil / Caixa');
    expect(dados.itens[0].valorUnitario).toBe(10.34);
    expect(dados.itens[0].valorTotal).toBe(31.02);
    expect(dados.valorGlobalTotal).toBe(31.02);
    expect(dados.condicoesComerciais.validadeDias).toBe(90);

    const docxBuffer = await propostaDocumentoService.gerarDocxBuffer(dados);
    expect(docxBuffer.subarray(0, 2).toString('ascii')).toBe('PK');
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

