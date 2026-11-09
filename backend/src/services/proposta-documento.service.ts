import PDFDocument from 'pdfkit';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { prisma } from '../database/prisma';
import { ProposalServiceError, proposalService } from './proposal.service';

export interface ItemDocumentoProposta {
  numero: string;
  descricao: string;
  marcaFabricante: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface DadosEstruturadosPropostaOficial {
  propostaId: string;
  titulo: string;
  empresa: {
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
    enderecoCompleto: string;
    contato: string;
    dadosBancarios: string;
    representanteLegal: string;
  };
  orgaoComprador: {
    nome: string;
    cnpj?: string;
    numeroEditalProcesso: string;
    modalidade: string;
    objeto: string;
  };
  itens: ItemDocumentoProposta[];
  valorGlobalTotal: number;
  valorGlobalPorExtenso: string;
  condicoesComerciais: {
    validadeDias: number;
    prazoEntregaDias: number;
    condicoesPagamento: string;
    garantia: string;
  };
  localData: string;
}

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

function converterBlocoAte999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (d > 0) partes.push(DEZENAS[d]);
      if (u > 0) partes.push(UNIDADES[u]);
    }
  }

  return partes.join(' e ');
}

export function valorPorExtensoBRL(valor: number): string {
  const seguro = Math.max(0, Number.isFinite(valor) ? Number(valor.toFixed(2)) : 0);
  const inteiro = Math.floor(seguro);
  const centavos = Math.round((seguro - inteiro) * 100);

  if (inteiro === 0 && centavos === 0) {
    return 'zero reais';
  }

  const partesInteiro: string[] = [];
  const bilhoes = Math.floor(inteiro / 1_000_000_000);
  const milhoes = Math.floor((inteiro % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((inteiro % 1_000_000) / 1_000);
  const centenas = inteiro % 1_000;

  if (bilhoes > 0) {
    partesInteiro.push(
      `${converterBlocoAte999(bilhoes)} ${bilhoes === 1 ? 'bilhão' : 'bilhões'}`
    );
  }
  if (milhoes > 0) {
    partesInteiro.push(
      `${converterBlocoAte999(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`
    );
  }
  if (milhares > 0) {
    partesInteiro.push(
      milhares === 1 ? 'mil' : `${converterBlocoAte999(milhares)} mil`
    );
  }
  if (centenas > 0) {
    partesInteiro.push(converterBlocoAte999(centenas));
  }

  let resultado = '';
  if (inteiro > 0) {
    const sufixoReal =
      inteiro === 1
        ? 'real'
        : centenas === 0 && milhares === 0 && (milhoes > 0 || bilhoes > 0)
          ? 'de reais'
          : 'reais';
    resultado = `${partesInteiro.join(', ')} ${sufixoReal}`;
  }

  if (centavos > 0) {
    const extCentavos = `${converterBlocoAte999(centavos)} ${
      centavos === 1 ? 'centavo' : 'centavos'
    }`;
    resultado = resultado ? `${resultado} e ${extCentavos}` : extCentavos;
  }

  return resultado;
}

export function formatarMoedaBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(valor) ? valor : 0);
}

export class PropostaDocumentoService {
  async montarDadosEstruturados(
    userId: string | undefined,
    proposalId: string,
    overridePayload?: Record<string, any>
  ): Promise<DadosEstruturadosPropostaOficial> {
    let dbProposal: any = null;

    if (proposalId && proposalId !== 'preview' && userId) {
      try {
        dbProposal = await proposalService.getById(userId, proposalId);
      } catch (err) {
        if (!overridePayload || !Array.isArray(overridePayload.itens)) {
          throw err;
        }
      }
    }

    let companyRecord: any = dbProposal?.company || null;
    if (!companyRecord && userId) {
      const companyId = overridePayload?.companyId;
      companyRecord = await prisma.company.findFirst({
        where: companyId ? { id: String(companyId), userId } : { userId },
      });
    }

    const razaoSocial =
      overridePayload?.empresa?.razaoSocial ||
      companyRecord?.razaoSocial ||
      'Empresa Licitante Credenciada';
    const cnpj =
      overridePayload?.empresa?.cnpj ||
      companyRecord?.cnpj ||
      '00.000.000/0001-00';
    const enderecoCompleto =
      overridePayload?.empresa?.enderecoCompleto ||
      [
        companyRecord?.logradouro,
        companyRecord?.numero,
        companyRecord?.bairro,
        companyRecord?.municipio || companyRecord?.cidade,
        companyRecord?.uf,
        companyRecord?.cep ? `CEP ${companyRecord.cep}` : null,
      ]
        .filter(Boolean)
        .join(', ') ||
      'Sede Administrativa Comercial registrada no Cadastro Nacional (SICAF / PNCP)';
    const contato =
      overridePayload?.empresa?.contato ||
      [companyRecord?.email, companyRecord?.telefone].filter(Boolean).join(' | ') ||
      'Contato comercial oficial registrado no processo';
    const dadosBancarios =
      overridePayload?.empresa?.dadosBancarios ||
      'Banco do Brasil / Caixa Econômica Federal — Conta Corrente PJ vinculada ao CNPJ da Proponente';
    const representanteLegal =
      overridePayload?.empresa?.representanteLegal ||
      companyRecord?.representanteLegal ||
      'Representante Legal Constituído';

    const orgaoNome =
      overridePayload?.orgaoLicitante ||
      overridePayload?.orgao ||
      dbProposal?.procurementNotice?.buyerName ||
      'Órgão Público Licitante';
    const orgaoCnpj =
      overridePayload?.cnpjOrgao ||
      (dbProposal?.procurementNotice as any)?.buyerDocument ||
      '';
    const numeroEditalProcesso =
      overridePayload?.numeroEdital ||
      overridePayload?.numeroCertame ||
      dbProposal?.procurementNotice?.noticeNumber ||
      'Conforme Edital / Termo de Referência';
    const modalidade =
      overridePayload?.modalidade ||
      dbProposal?.procurementNotice?.modality ||
      'Pregão Eletrônico (Lei nº 14.133/2021)';
    const objeto =
      overridePayload?.objeto ||
      overridePayload?.objetoContratacao ||
      dbProposal?.procurementNotice?.object ||
      dbProposal?.titulo ||
      'Fornecimento de bens/serviços em estrita conformidade com o Termo de Referência do Edital.';

    const rawItems: any[] =
      Array.isArray(overridePayload?.itens) && overridePayload.itens.length > 0
        ? overridePayload.itens
        : Array.isArray(dbProposal?.items)
          ? dbProposal.items
          : [];

    if (rawItems.length === 0 && !dbProposal && !overridePayload) {
      throw new ProposalServiceError(
        'proposal_not_found',
        404,
        'Proposta não encontrada para exportação.'
      );
    }

    const itens: ItemDocumentoProposta[] = rawItems.map((it: any, index: number) => {
      const qtd = Math.max(0.01, Number(it.quantidade ?? it.quantity ?? 1) || 1);
      const unitario = Math.max(
        0,
        Number(
          it.precoUnitarioProposto ??
            it.valorUnitarioProposto ??
            it.valorUnitario ??
            it.valorUnitarioEstimado ??
            0
        ) || 0
      );
      const total = Number(
        (
          it.precoTotalProposto !== undefined && it.precoTotalProposto !== null
            ? Number(it.precoTotalProposto)
            : qtd * unitario
        ).toFixed(2)
      );
      const marcaModelo =
        [it.marca, it.modelo, it.marcaModelo].filter(Boolean).join(' / ') ||
        'Padrão Oficial / Primeira Linha';

      return {
        numero: String(it.numero ?? it.numeroItem ?? index + 1),
        descricao: String(it.descricao || it.description || `Item ${index + 1}`),
        marcaFabricante: marcaModelo,
        quantidade: qtd,
        unidade: String(it.unidade || it.unidadeMedida || 'UN'),
        valorUnitario: Number(unitario.toFixed(2)),
        valorTotal: total,
      };
    });

    const valorGlobalTotal = Number(
      itens.reduce((acc, item) => acc + item.valorTotal, 0).toFixed(2)
    );
    const valorGlobalPorExtenso = valorPorExtensoBRL(valorGlobalTotal);

    const validadeDias = Number(
      overridePayload?.validadeDias ?? dbProposal?.validadeDias ?? 60
    );
    const prazoEntregaDias = Number(
      overridePayload?.prazoEntregaDias ?? dbProposal?.prazoEntregaDias ?? 15
    );
    const condicoesPagamento = String(
      overridePayload?.condicoesPagamento ??
        dbProposal?.condicoesPagamento ??
        'Em até 30 (trinta) dias corridos após o ateste definitivo da Nota Fiscal, em conformidade com o Art. 141 da Lei Federal nº 14.133/2021.'
    );
    const garantia = String(
      overridePayload?.garantia ??
        dbProposal?.garantia ??
        '12 (doze) meses de garantia integral contra defeitos de fabricação ou vícios ocultos, sem ônus adicional para a Administração Pública.'
    );

    const dataFormatada = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return {
      propostaId: dbProposal?.id || proposalId || 'PROPOSTA-OFICIAL',
      titulo:
        overridePayload?.titulo ||
        dbProposal?.titulo ||
        `Proposta Comercial — ${numeroEditalProcesso}`,
      empresa: {
        razaoSocial,
        cnpj,
        enderecoCompleto,
        contato,
        dadosBancarios,
        representanteLegal,
      },
      orgaoComprador: {
        nome: orgaoNome,
        cnpj: orgaoCnpj || undefined,
        numeroEditalProcesso,
        modalidade,
        objeto,
      },
      itens,
      valorGlobalTotal,
      valorGlobalPorExtenso,
      condicoesComerciais: {
        validadeDias: validadeDias >= 1 ? validadeDias : 60,
        prazoEntregaDias: prazoEntregaDias >= 1 ? prazoEntregaDias : 15,
        condicoesPagamento,
        garantia,
      },
      localData: `Brasil, ${dataFormatada}`,
    };
  }

  async gerarDocxBuffer(dados: DadosEstruturadosPropostaOficial): Promise<Buffer> {
    const borderPadrao = {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    };

    const headerCells = [
      { label: 'Item', width: 7 },
      { label: 'Descrição Detalhada', width: 33 },
      { label: 'Marca / Fabricante', width: 15 },
      { label: 'Qtd', width: 8 },
      { label: 'Unid.', width: 8 },
      { label: 'Valor Unitário', width: 14 },
      { label: 'Valor Total', width: 15 },
    ].map(
      (col) =>
        new TableCell({
          width: { size: col.width, type: WidthType.PERCENTAGE },
          shading: { fill: '0B192C', type: ShadingType.CLEAR, color: 'auto' },
          borders: borderPadrao,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: col.label,
                  bold: true,
                  color: 'FFFFFF',
                  size: 18,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        })
    );

    const itemRows = dados.itens.map(
      (it) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: it.numero, bold: true, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: it.descricao, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: it.marcaFabricante, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: String(it.quantidade), size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: it.unidade, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatarMoedaBRL(it.valorUnitario),
                      size: 18,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: borderPadrao,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatarMoedaBRL(it.valorTotal),
                      bold: true,
                      size: 18,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    );

    const totalRow = new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 5,
          borders: borderPadrao,
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `VALOR GLOBAL TOTAL DA PROPOSTA (por extenso: ${dados.valorGlobalPorExtenso})`,
                  bold: true,
                  size: 19,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          columnSpan: 2,
          borders: borderPadrao,
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: formatarMoedaBRL(dados.valorGlobalTotal),
                  bold: true,
                  size: 20,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: 'PROPOSTA COMERCIAL OFICIAL — LEI FEDERAL Nº 14.133/2021',
                  bold: true,
                  size: 26,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),

            // BLOCO 1: CABEÇALHO FORMAL
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({
                  text: '1. IDENTIFICAÇÃO DA PROPONENTE E DO CERTAME',
                  bold: true,
                  size: 22,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: 'Razão Social: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: `${dados.empresa.razaoSocial} | `, size: 20, font: 'Calibri' }),
                new TextRun({ text: 'CNPJ: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: dados.empresa.cnpj, size: 20, font: 'Calibri' }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: 'Endereço Completo: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: dados.empresa.enderecoCompleto, size: 20, font: 'Calibri' }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: 'Contato Oficial: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: `${dados.empresa.contato} | `, size: 20, font: 'Calibri' }),
                new TextRun({ text: 'Dados Bancários: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: dados.empresa.dadosBancarios, size: 20, font: 'Calibri' }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: 'Órgão Comprador: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({
                  text: `${dados.orgaoComprador.nome}${dados.orgaoComprador.cnpj ? ` (CNPJ: ${dados.orgaoComprador.cnpj})` : ''}`,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: 'Edital / Processo: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({
                  text: `${dados.orgaoComprador.numeroEditalProcesso} | `,
                  size: 20,
                  font: 'Calibri',
                }),
                new TextRun({ text: 'Modalidade: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: dados.orgaoComprador.modalidade, size: 20, font: 'Calibri' }),
              ],
            }),
            new Paragraph({
              spacing: { after: 180 },
              children: [
                new TextRun({ text: 'Objeto da Contratação: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: dados.orgaoComprador.objeto, size: 20, font: 'Calibri' }),
              ],
            }),

            // BLOCO 2: TABELA OFICIAL DE ITENS E PREÇOS
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 100 },
              children: [
                new TextRun({
                  text: '2. PLANILHA OFICIAL DE ITENS E FORMAÇÃO DE PREÇOS',
                  bold: true,
                  size: 22,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({ tableHeader: true, cantSplit: true, children: headerCells }),
                ...itemRows,
                totalRow,
              ],
            }),

            // BLOCO 3: CONDIÇÕES COMERCIAIS
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 220, after: 100 },
              children: [
                new TextRun({
                  text: '3. CONDIÇÕES COMERCIAIS E OPERACIONAIS',
                  bold: true,
                  size: 22,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: '• Validade da Proposta: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({
                  text: `${dados.condicoesComerciais.validadeDias} (sessenta ou conforme edital) dias corridos, a contar da data de sua apresentação, nos termos do Art. 90, § 3º da Lei nº 14.133/2021.`,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: '• Prazo de Entrega / Execução: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({
                  text: `Até ${dados.condicoesComerciais.prazoEntregaDias} dias corridos após o recebimento da Nota de Empenho / Ordem de Fornecimento.`,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: '• Condições de Pagamento: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({
                  text: dados.condicoesComerciais.condicoesPagamento,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 140 },
              children: [
                new TextRun({ text: '• Garantia e Custos Inclusos: ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({
                  text: `${dados.condicoesComerciais.garantia} Nos preços propostos estão inclusos todos os custos diretos e indiretos, tributos, encargos trabalhistas, previdenciários, fretes e seguros (Art. 59, III da Lei nº 14.133/2021).`,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),

            // BLOCO 4: DECLARAÇÕES LEGAIS OBRIGATÓRIAS (ART. 63 DA LEI 14.133/2021)
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 100 },
              children: [
                new TextRun({
                  text: '4. DECLARAÇÕES LEGAIS OBRIGATÓRIAS (ART. 63 DA LEI Nº 14.133/2021)',
                  bold: true,
                  size: 22,
                  font: 'Calibri',
                  color: '0B192C',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: 'I. Cumprimento do Art. 7º, XXXIII da Constituição Federal: ',
                  bold: true,
                  size: 19,
                  font: 'Calibri',
                }),
                new TextRun({
                  text: 'Declaramos, sob as penas da lei e para fins do disposto no inciso VI do Art. 68 da Lei Federal nº 14.133/2021, que não empregamos menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre e não empregamos menor de 16 (dezesseis) anos, salvo menor, a partir de 14 (quatorze) anos, na condição de aprendiz.',
                  size: 19,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: 'II. Inexistência de Fatos Impeditivos e Habilitação (Art. 63, I): ',
                  bold: true,
                  size: 19,
                  font: 'Calibri',
                }),
                new TextRun({
                  text: 'Declaramos que atendemos integralmente aos requisitos de habilitação exigidos no edital e que inexistem fatos impeditivos ou supervenientes para nossa habilitação e contratação com a Administração Pública.',
                  size: 19,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: 'III. Elaboração Independente de Proposta e Reserva de Cargos (Art. 63, IV e § 1º): ',
                  bold: true,
                  size: 19,
                  font: 'Calibri',
                }),
                new TextRun({
                  text: 'Declaramos que esta proposta foi elaborada de maneira independente, que compreende a integralidade dos custos para atendimento dos direitos trabalhistas assegurados na Constituição Federal e nas leis trabalhistas, e que cumprimos as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social.',
                  size: 19,
                  font: 'Calibri',
                }),
              ],
            }),

            // BLOCO 5: FECHO E ASSINATURA
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 280, after: 360 },
              children: [
                new TextRun({
                  text: `${dados.localData}.`,
                  bold: true,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: '__________________________________________________________________',
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: dados.empresa.razaoSocial,
                  bold: true,
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `CNPJ: ${dados.empresa.cnpj} — ${dados.empresa.representanteLegal}`,
                  size: 19,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }

  async gerarPdfBuffer(dados: DadosEstruturadosPropostaOficial): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80;
      const bottomLimit = doc.page.height - 60;

      const ensureSpace = (neededHeight: number) => {
        if (doc.y + neededHeight > bottomLimit) {
          doc.addPage();
        }
      };

      // TÍTULO PRINCIPAL
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#0B192C')
        .text('PROPOSTA COMERCIAL OFICIAL — LEI FEDERAL Nº 14.133/2021', {
          align: 'center',
        });
      doc.moveDown(0.8);

      // BLOCO 1: CABEÇALHO FORMAL
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#0B192C')
        .text('1. IDENTIFICAÇÃO DA PROPONENTE E DO CERTAME');
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(`Razão Social: ${dados.empresa.razaoSocial} | CNPJ: ${dados.empresa.cnpj}`);
      doc.text(`Endereço Completo: ${dados.empresa.enderecoCompleto}`);
      doc.text(`Contato: ${dados.empresa.contato}`);
      doc.text(`Dados Bancários: ${dados.empresa.dadosBancarios}`);
      doc.moveDown(0.3);
      doc.text(
        `Órgão Comprador: ${dados.orgaoComprador.nome}${dados.orgaoComprador.cnpj ? ` (CNPJ: ${dados.orgaoComprador.cnpj})` : ''}`
      );
      doc.text(
        `Edital / Processo: ${dados.orgaoComprador.numeroEditalProcesso} | Modalidade: ${dados.orgaoComprador.modalidade}`
      );
      doc.text(`Objeto da Contratação: ${dados.orgaoComprador.objeto}`);
      doc.moveDown(0.8);

      // BLOCO 2: TABELA OFICIAL DE ITENS E PREÇOS
      ensureSpace(90);
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#0B192C')
        .text('2. TABELA OFICIAL DE ITENS E PREÇOS');
      doc.moveDown(0.4);

      const cols = [
        { label: 'Item', width: 32, align: 'center' as const },
        { label: 'Descrição Detalhada', width: 175, align: 'left' as const },
        { label: 'Marca/Fabr.', width: 78, align: 'left' as const },
        { label: 'Qtd', width: 38, align: 'right' as const },
        { label: 'Unid.', width: 36, align: 'center' as const },
        { label: 'Vlr. Unitário', width: 78, align: 'right' as const },
        { label: 'Valor Total', width: 78, align: 'right' as const },
      ];

      const drawTableHeader = () => {
        const startY = doc.y;
        doc.rect(40, startY, pageWidth, 20).fill('#0B192C');
        let currentX = 40;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        for (const col of cols) {
          doc.text(col.label, currentX + 3, startY + 6, {
            width: col.width - 6,
            align: col.align,
          });
          currentX += col.width;
        }
        doc.y = startY + 20;
      };

      drawTableHeader();

      for (const item of dados.itens) {
        const descHeight = doc.heightOfString(item.descricao, { width: cols[1].width - 6 });
        const marcaHeight = doc.heightOfString(item.marcaFabricante, { width: cols[2].width - 6 });
        const rowHeight = Math.max(20, Math.ceil(Math.max(descHeight, marcaHeight)) + 10);

        if (doc.y + rowHeight > bottomLimit) {
          doc.addPage();
          drawTableHeader();
        }

        const rowY = doc.y;
        doc
          .rect(40, rowY, pageWidth, rowHeight)
          .strokeColor('#E2E8F0')
          .lineWidth(0.5)
          .stroke();

        let x = 40;
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        const values = [
          item.numero,
          item.descricao,
          item.marcaFabricante,
          String(item.quantidade),
          item.unidade,
          formatarMoedaBRL(item.valorUnitario),
          formatarMoedaBRL(item.valorTotal),
        ];

        cols.forEach((col, idx) => {
          doc.text(values[idx], x + 3, rowY + 5, {
            width: col.width - 6,
            align: col.align,
          });
          x += col.width;
        });

        doc.y = rowY + rowHeight;
      }

      // LINHA DE FECHAMENTO: VALOR GLOBAL EM ALGARISMOS E POR EXTENSO
      ensureSpace(40);
      const totalY = doc.y;
      doc.rect(40, totalY, pageWidth, 28).fillAndStroke('#F1F5F9', '#CBD5E1');
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0B192C')
        .text(
          `VALOR GLOBAL TOTAL: ${formatarMoedaBRL(dados.valorGlobalTotal)} (${dados.valorGlobalPorExtenso})`,
          46,
          totalY + 9,
          { width: pageWidth - 12, align: 'right' }
        );
      doc.y = totalY + 36;

      // BLOCO 3: CONDIÇÕES COMERCIAIS
      ensureSpace(95);
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#0B192C')
        .text('3. CONDIÇÕES COMERCIAIS', 40);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(
        `• Validade da Proposta: ${dados.condicoesComerciais.validadeDias} dias corridos, contados da data de apresentação (Art. 90, § 3º da Lei nº 14.133/2021).`
      );
      doc.text(
        `• Prazo de Entrega: ${dados.condicoesComerciais.prazoEntregaDias} dias corridos após o recebimento da Ordem de Fornecimento / Empenho.`
      );
      doc.text(`• Condições de Pagamento: ${dados.condicoesComerciais.condicoesPagamento}`);
      doc.text(`• Garantia Técnica: ${dados.condicoesComerciais.garantia}`);
      doc.moveDown(0.7);

      // BLOCO 4: DECLARAÇÕES LEGAIS OBRIGATÓRIAS (ART. 63 DA LEI 14.133/2021)
      ensureSpace(130);
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#0B192C')
        .text('4. DECLARAÇÕES LEGAIS OBRIGATÓRIAS (ART. 63 DA LEI Nº 14.133/2021)', 40);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
      doc.text(
        '1) Declaração de Cumprimento do Art. 7º, XXXIII da CF/88 (Art. 68, VI da Lei 14.133/2021): Declaramos que não empregamos menor de 18 anos em trabalho noturno, perigoso ou insalubre e não empregamos menor de 16 anos, salvo na condição de aprendiz a partir de 14 anos.'
      );
      doc.moveDown(0.2);
      doc.text(
        '2) Declaração de Inexistência de Fatos Impeditivos (Art. 63, I da Lei 14.133/2021): Declaramos que cumprimos plenamente os requisitos de habilitação definidos no edital e que inexistem fatos impeditivos para nossa participação e contratação.'
      );
      doc.moveDown(0.2);
      doc.text(
        '3) Declaração de Elaboração Independente de Proposta e Integralidade de Custos (Art. 63, § 1º e IV): Declaramos que a proposta foi elaborada de forma independente, compreende a integralidade dos custos trabalhistas e tributários e atende à reserva legal de cargos para PcD e reabilitados.'
      );
      doc.moveDown(1.2);

      // BLOCO 5: FECHO E ASSINATURA
      ensureSpace(85);
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#0B192C')
        .text(`${dados.localData}.`, { align: 'right' });
      doc.moveDown(1.6);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#334155')
        .text('_______________________________________________________________', {
          align: 'center',
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#0B192C')
        .text(dados.empresa.razaoSocial, { align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text(`CNPJ: ${dados.empresa.cnpj} — ${dados.empresa.representanteLegal}`, {
          align: 'center',
        });

      doc.end();
    });
  }
}

export const propostaDocumentoService = new PropostaDocumentoService();

