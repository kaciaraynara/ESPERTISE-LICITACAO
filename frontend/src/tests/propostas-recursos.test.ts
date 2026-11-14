import { describe, it, expect } from 'vitest';
import {
  DECLARACOES_OBRIGATORIAS_14133,
  montarTextoPlanoProposta,
  formatarMoeda,
} from '../utils/pdfGenerator';
import recursosContent from '../pages/RecursosPage.tsx?raw';
import impugnacaoContent from '../pages/ImpugnacaoPage.tsx?raw';

describe('STEP 3: Fábrica de Propostas Comerciais e Peças Jurídicas Fundamentadas', () => {
  it('1. Contém as 6 Declarações Oficiais Obrigatórias da Lei 14.133/2021', () => {
    expect(DECLARACOES_OBRIGATORIAS_14133).toHaveLength(6);

    const titulos = DECLARACOES_OBRIGATORIAS_14133.map((d) => d.titulo);
    expect(titulos.some((t) => t.includes('ELABORAÇÃO INDEPENDENTE'))).toBe(true);
    expect(titulos.some((t) => t.includes('REQUISITOS DE HABILITAÇÃO'))).toBe(true);
    expect(titulos.some((t) => t.includes('ART. 7º DA CONSTITUIÇÃO FEDERAL'))).toBe(true);
    expect(titulos.some((t) => t.includes('INEXISTÊNCIA DE FATOS IMPEDITIVOS'))).toBe(true);
    expect(titulos.some((t) => t.includes('RESERVA DE CARGOS'))).toBe(true);
    expect(titulos.some((t) => t.includes('ENQUADRAMENTO LEGAL'))).toBe(true);

    // Amparos legais estritos
    const amparos = DECLARACOES_OBRIGATORIAS_14133.map((d) => d.amparoLegal).join(' ');
    expect(amparos).toContain('Art. 63');
    expect(amparos).toContain('Art. 68');
    expect(amparos).toContain('Art. 14');
    expect(amparos).toContain('Lei Federal nº 8.213/1991');
  });

  it('2. Gerador de Proposta monta documento completo, timbrado e com valor por extenso', () => {
    const dadosMock = {
      proposta: {
        id: 'prop-100',
        company: {
          id: 'comp-1',
          razaoSocial: 'FORNECEDOR DE ELITE LTDA',
          nomeFantasia: 'ELITE PRODUTOS',
          cnpj: '12.345.678/0001-90',
          email: 'contato@elite.com.br',
          telefone: '(11) 3333-4444',
        },
        validadeDias: 60,
        prazoEntregaDias: 15,
        garantia: 'Garantia técnica de 12 meses',
        condicoesPagamento: '30 dias úteis',
        criterioJulgamento: 'MENOR_PRECO',
      } as any,
      orgaoLicitante: 'MINISTÉRIO DA SAÚDE',
      numeroEdital: 'Pregão Eletrônico nº 050/2026',
      objetoLicitacao: 'Aquisição de equipamentos médicos hospitalares',
      modalidadeEdital: 'Pregão Eletrônico',
      itens: [
        {
          id: 'item-1',
          numero: 1,
          descricao: 'Monitor multiparâmetro com tela touch',
          marca: 'BioTech',
          modelo: 'BT-5000',
          unidade: 'UN',
          quantidade: 10,
          custoDireto: 5000,
          precoUnitarioProposto: 7500,
          precoTotalProposto: 75000,
        } as any,
      ],
      totalCalculado: 75000,
    };

    const textoGerado = montarTextoPlanoProposta(dadosMock);

    // 1. Identificação da Proponente e do Órgão
    expect(textoGerado).toContain('FORNECEDOR DE ELITE LTDA');
    expect(textoGerado).toContain('12.345.678/0001-90');
    expect(textoGerado).toContain('MINISTÉRIO DA SAÚDE');
    expect(textoGerado).toContain('Pregão Eletrônico nº 050/2026');

    // 2. Itens detalhados com marca e modelo
    expect(textoGerado).toContain('BioTech / BT-5000');
    expect(textoGerado).toContain('Monitor multiparâmetro com tela touch');
    expect(textoGerado).toContain('10 UN');

    // 3. Valor total formatado e por extenso
    expect(textoGerado).toContain(formatarMoeda(75000));
    expect(textoGerado).toContain('setenta e cinco mil reais');

    // 4. Prazos e garantia contratual
    expect(textoGerado).toContain('Prazo de Validade da Proposta: 60 (sessenta) dias corridos');
    expect(textoGerado).toContain('Prazo de Entrega / Início da Execução: 15 dias corridos');
    expect(textoGerado).toContain('Garantia técnica de 12 meses');
  });

  it('3. Recursos Administrativos possuem fundamentação formal, Súmulas do TCU e pedidos expressos', () => {
    // Fundamentação legal sob Lei 14.133/2021
    expect(recursosContent).toContain('Artigo 165');
    expect(recursosContent).toContain('Artigo 183');
    expect(recursosContent).toContain('dias úteis');

    // Súmulas do TCU de controle de abusividades
    expect(recursosContent).toContain('Súmula nº 275 do TCU');
    expect(recursosContent).toContain('Súmula nº 263 do TCU');

    // Pedidos formais de Efeito Suspensivo e Juízo de Retratação
    expect(recursosContent).toContain('EFEITO SUSPENSIVO');
    expect(recursosContent).toContain('Juízo de Retratação');
  });

  it('4. Impugnação de Editais observa a tempestividade legal de 3 dias úteis antes da abertura', () => {
    expect(impugnacaoContent).toContain('3 dias úteis antes da abertura');
    expect(impugnacaoContent).toContain('Lei 14.133/2021');
    expect(impugnacaoContent).toContain('Impugnação de Editais');
  });
});
