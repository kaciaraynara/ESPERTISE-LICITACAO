/**
 * Utilitário Oficial de Geração e Impressão de Propostas Comerciais em PDF
 * em Estrita Conformidade com a Lei Federal nº 14.133/2021 (Nova Lei de Licitações)
 * e Jurisprudência Consolidada do Tribunal de Contas da União (TCU).
 */

import { ProposalDto, ProposalItemDto } from '@/services/api';

// =============================================================================
// AS 6 DECLARAÇÕES OBRIGATÓRIAS DO ART. 63 DA LEI FEDERAL Nº 14.133/2021
// =============================================================================
export const DECLARACOES_OBRIGATORIAS_14133 = [
  {
    numero: 1,
    titulo: '1. DECLARAÇÃO DE ELABORAÇÃO INDEPENDENTE DE PROPOSTA',
    amparoLegal: 'Art. 63, inciso I, da Lei Federal nº 14.133/2021 c/c Art. 299 do Código Penal',
    texto:
      'Declaramos, sob as penas da lei, em especial o Art. 299 do Código Penal Brasileiro e o Art. 63, I da Lei Federal nº 14.133/2021, que a presente proposta comercial foi elaborada de maneira autônoma e independente, e que seu conteúdo não foi, no todo ou em parte, direta ou indiretamente, informado a, discutido com ou compartilhado com qualquer outro licitante concorrente ou agente público antes da abertura formal da sessão pública.',
  },
  {
    numero: 2,
    titulo: '2. DECLARAÇÃO DE CUMPRIMENTO DOS REQUISITOS DE HABILITAÇÃO',
    amparoLegal: 'Art. 63, inciso I, da Lei Federal nº 14.133/2021',
    texto:
      'Declaramos que atendemos e cumprimos plenamente todos os requisitos de habilitação jurídica, fiscal, social, trabalhista, técnica e econômico-financeira estabelecidos no instrumento convocatório, com documentação idônea, regular e tempestiva, comprometendo-nos a manter a integridade destas condições durante toda a vigência da contratação.',
  },
  {
    numero: 3,
    titulo: '3. DECLARAÇÃO DE NÃO EMPREGO DE MENORES',
    amparoLegal: 'Art. 63, inciso VI, da Lei nº 14.133/2021 c/c Art. 7º, XXXIII da CF/88',
    texto:
      'Declaramos para fins do disposto no Art. 63, inciso VI, da Lei Federal nº 14.133/2021 c/c Art. 7º, inciso XXXIII, da Constituição Federal de 1988, que não empregamos menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre e não empregamos menor de 16 (dezesseis) anos em nenhuma atividade laboral, salvo na condição de aprendiz a partir dos 14 (quatorze) anos de idade.',
  },
  {
    numero: 4,
    titulo: '4. DECLARAÇÃO DE INEXISTÊNCIA DE FATOS IMPEDITIVOS E SANÇÕES',
    amparoLegal: 'Art. 14 da Lei Federal nº 14.133/2021',
    texto:
      'Declaramos, sob as penalidades legais, a inexistência de fatos impeditivos supervenientes ou sanções restritivas que obstem nossa participação no certame, assegurando que a empresa e seus sócios não incorrem em suspensão do direito de licitar, impedimento de contratar ou declaração de inidoneidade emitida por órgão ou entidade da Administração Pública direta ou indireta de qualquer esfera federativa.',
  },
  {
    numero: 5,
    titulo: '5. DECLARAÇÃO DE RESERVA DE CARGOS PCD E REABILITADOS DA PREVIDÊNCIA',
    amparoLegal: 'Art. 63, inciso IV, da Lei nº 14.133/2021 c/c Art. 93 da Lei nº 8.213/1991',
    texto:
      'Declaramos que a empresa atende com rigor às normas de acessibilidade e cumpre as reservas legais de cargos para pessoas com deficiência (PCD) e para reabilitados da Previdência Social, em conformidade com o Art. 63, IV da Lei nº 14.133/2021 c/c Art. 93 da Lei nº 8.213/1991.',
  },
  {
    numero: 6,
    titulo: '6. DECLARAÇÃO DE ENQUADRAMENTO ME/EPP OU SUSTENTABILIDADE AMBIENTAL',
    amparoLegal: 'Art. 4º ou Art. 11, IV e Art. 63 da Lei Federal nº 14.133/2021',
    texto:
      'Declaramos que a empresa atende plenamente aos critérios de sustentabilidade ambiental, logística reversa e descarte ambientalmente adequado exigidos para o fornecimento, bem como, se aplicável, que preenchemos os requisitos de qualificação de Microempresa ou Empresa de Pequeno Porte (LC 123/2006 c/c Art. 4º da Lei nº 14.133/2021), não incidindo em nenhuma de suas vedações.',
  },
];

export interface DadosDocumentoProposta {
  proposta: ProposalDto | null;
  orgaoLicitante: string;
  numeroEdital: string;
  objetoLicitacao: string;
  modalidadeEdital?: string;
  itens: ProposalItemDto[];
  totalCalculado: number;
}

export function formatarMoeda(val: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
}

/**
 * Monta o texto plano estruturado do documento completo com formatação institucional e jurídica.
 */
export function montarTextoPlanoProposta(dados: DadosDocumentoProposta): string {
  const { proposta, orgaoLicitante, numeroEdital, objetoLicitacao, modalidadeEdital, itens, totalCalculado } = dados;
  const lines: string[] = [];

  const razaoSocial = proposta?.company?.razaoSocial || 'EMPRESA PROPONENTE LTDA';
  const cnpj = proposta?.company?.cnpj || '00.000.000/0001-00';
  const orgao = orgaoLicitante || 'Órgão Licitante Promotor';
  const obj = objetoLicitacao || 'Objeto da contratação pública';
  const num = numeroEdital || 'S/N';
  const mod = modalidadeEdital || 'Pregão Eletrônico (Lei 14.133/2021)';
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  lines.push('================================================================================');
  lines.push('               PROPOSTA COMERCIAL E PLANILHA ORÇAMENTÁRIA OFICIAL              ');
  lines.push('                 ADEQUADA À LEI FEDERAL Nº 14.133/2021 E AO TCU                 ');
  lines.push('================================================================================\n');

  lines.push('1. IDENTIFICAÇÃO DO PROPONENTE');
  lines.push(`Razão Social: ${razaoSocial}`);
  lines.push(`CNPJ / MF: ${cnpj}`);
  lines.push(`Enquadramento Legal: ${proposta?.declaracaoMeEpp ? 'Microempresa ou EPP (LC 123/06)' : 'Ampla Concorrência'}`);
  lines.push(`Validade da Proposta: ${proposta?.validadeDias || 60} (sessenta) dias corridos (Art. 90, § 3º)`);
  lines.push(`Prazo de Entrega: ${proposta?.prazoEntregaDias || 15} dias corridos\n`);

  lines.push('2. IDENTIFICAÇÃO DO ÓRGÃO E DO CERTAME (PAINEL DE DISPUTAS)');
  lines.push(`Órgão Licitante: ${orgao}`);
  lines.push(`Objeto da Licitação: ${obj}`);
  lines.push(`Edital / Processo nº: ${num}`);
  lines.push(`Modalidade: ${mod}`);
  lines.push('Amparo Legal: Lei Federal nº 14.133/2021 (Nova Lei de Licitações e Contratos)\n');

  lines.push('3. PLANILHA DE PREÇOS UNITÁRIOS E FORMAÇÃO DE PREÇO (ART. 59, LEI 14.133/21)');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('| Item | Descrição                       | Qtd | Un | C. Direto | Enc.(%) | Lucro(%) | Venda Unit. | Total (R$) |');
  lines.push('--------------------------------------------------------------------------------');

  if (itens.length === 0) {
    lines.push('| (Nenhum item adicionado à planilha até o momento)                             |');
  } else {
    itens.forEach((it, idx) => {
      const itemNum = String(it.numero || idx + 1).padStart(4);
      const desc = it.descricao.length > 30 ? `${it.descricao.slice(0, 27)}...` : it.descricao.padEnd(30);
      const qtd = String(Number(it.quantidade)).padStart(3);
      const un = (it.unidade || 'UN').slice(0, 2).padEnd(2);
      const custo = formatarMoeda(it.custoDireto).padStart(9);
      const enc = `${Number(it.encargosPercentual ?? it.bdiPercentual ?? 0)}%`.padStart(7);
      const marg = `${Number(it.margemLucroPercentual ?? 0)}%`.padStart(8);
      const vUnit = formatarMoeda(it.precoUnitarioProposto).padStart(11);
      const vTot = formatarMoeda(it.precoTotalProposto).padStart(10);
      lines.push(`| ${itemNum} | ${desc} | ${qtd} | ${un} | ${custo} | ${enc} | ${marg} | ${vUnit} | ${vTot} |`);
    });
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push(`VALOR TOTAL PROPOSTO: ${formatarMoeda(totalCalculado)}`);
  lines.push('Exequibilidade Homologada: Preços cobrem integralmente custos e encargos (Art. 59, III).\n');

  lines.push('4. CONDIÇÕES GERAIS DE FORNECIMENTO (ARTS. 90 E 92, LEI 14.133/2021)');
  lines.push(`- Prazo de Validade da Proposta: ${proposta?.validadeDias || 60} dias corridos.`);
  lines.push(`- Prazo de Entrega: ${proposta?.prazoEntregaDias || 15} dias após emissão da Ordem de Fornecimento.`);
  lines.push('- Condições de Pagamento: Em até 30 dias após liquidação da despesa e ateste fiscal.');
  lines.push('- Garantia Oferecida: Garantia legal e contratual de 12 meses contra quaisquer vícios ou defeitos.\n');

  lines.push('================================================================================');
  lines.push('5. DECLARAÇÕES OBRIGATÓRIAS DO ART. 63 DA LEI FEDERAL Nº 14.133/2021           ');
  lines.push('================================================================================');
  lines.push('Sob as penas da lei e em cumprimento às exigências editalícias, declaramos que:\n');

  DECLARACOES_OBRIGATORIAS_14133.forEach((dec) => {
    lines.push(`${dec.titulo}`);
    lines.push(`Base Legal: ${dec.amparoLegal}`);
    lines.push(`${dec.texto}\n`);
  });

  lines.push('6. COMPROMISSO DE FORNECIMENTO E ASSINATURA DO REPRESENTANTE LEGAL');
  lines.push('Declaramos que nos preços ofertados estão inclusos todos os custos diretos, custos indiretos, tributos, encargos trabalhistas, previdenciários, fiscais, comerciais, taxas de administração, frete, lucro e quaisquer outras despesas indispensáveis à perfeita execução do objeto contratual.\n');
  lines.push(`${dataExtenso}.\n\n`);
  lines.push('___________________________________________________________');
  lines.push(`${razaoSocial}`);
  lines.push(`CNPJ / MF: ${cnpj}`);
  lines.push('Representante Legal Autorizado');

  return lines.join('\n');
}

/**
 * Constrói o HTML completo com formatação gráfica de alta precisão A4 para impressão e download de PDF.
 */
export function construirHtmlPdfProposta(dados: DadosDocumentoProposta): string {
  const { proposta, orgaoLicitante, numeroEdital, objetoLicitacao, modalidadeEdital, itens, totalCalculado } = dados;

  const razaoSocial = proposta?.company?.razaoSocial || 'EMPRESA PROPONENTE LTDA';
  const cnpj = proposta?.company?.cnpj || '00.000.000/0001-00';
  const orgao = orgaoLicitante || 'Órgão Licitante Promotor';
  const obj = objetoLicitacao || 'Objeto da contratação pública';
  const num = numeroEdital || 'S/N';
  const mod = modalidadeEdital || 'Pregão Eletrônico (Lei 14.133/2021)';
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const rowsItensHtml = itens
    .map(
      (it, idx) => `
      <tr>
        <td style="text-align:center; font-weight:bold;">${it.numero || idx + 1}</td>
        <td>${it.descricao}</td>
        <td style="text-align:center;">${it.quantidade} ${it.unidade}</td>
        <td style="text-align:right;">${formatarMoeda(it.custoDireto)}</td>
        <td style="text-align:right;">${Number(it.encargosPercentual ?? it.bdiPercentual ?? 0)}%</td>
        <td style="text-align:right;">${Number(it.margemLucroPercentual ?? 0)}%</td>
        <td style="text-align:right; font-weight:bold;">${formatarMoeda(it.precoUnitarioProposto)}</td>
        <td style="text-align:right; font-weight:bold; color:#0A2540;">${formatarMoeda(it.precoTotalProposto)}</td>
      </tr>`
    )
    .join('');

  const declaracoesHtml = DECLARACOES_OBRIGATORIAS_14133
    .map(
      (dec) => `
      <div class="declaracao-item">
        <strong>${dec.titulo}</strong>
        <span class="amparo">${dec.amparoLegal}</span>
        <p>${dec.texto}</p>
      </div>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Proposta Comercial Oficial - Lei 14.133/2021 - ${razaoSocial}</title>
        <style>
          @page {
            margin: 15mm;
            size: A4 portrait;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #111;
            margin: 0;
            padding: 0;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0A2540;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .header h1 {
            font-family: Arial, sans-serif;
            font-size: 13pt;
            margin: 0;
            color: #0A2540;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header h2 {
            font-family: Arial, sans-serif;
            font-size: 9.5pt;
            margin: 4px 0 0 0;
            color: #EA580C;
            font-weight: bold;
          }
          .section-title {
            font-family: Arial, sans-serif;
            font-size: 10.5pt;
            font-weight: bold;
            color: #0A2540;
            text-transform: uppercase;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 3px;
            margin-top: 14px;
            margin-bottom: 6px;
          }
          .grid-info {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 9.5pt;
          }
          .grid-info td {
            padding: 2.5px 5px;
            vertical-align: top;
          }
          .table-itens {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 10px;
            font-size: 9pt;
          }
          .table-itens th {
            background-color: #f1f5f9;
            border: 1px solid #94a3b8;
            padding: 5px 4px;
            font-family: Arial, sans-serif;
            font-size: 8pt;
            text-transform: uppercase;
            text-align: center;
          }
          .table-itens td {
            border: 1px solid #cbd5e1;
            padding: 4px 5px;
          }
          .total-banner {
            background-color: #f8fafc;
            border: 1.5px solid #0A2540;
            padding: 6px 10px;
            text-align: right;
            font-size: 10.5pt;
            font-weight: bold;
            margin-bottom: 14px;
          }
          .declaracoes-container {
            page-break-inside: avoid;
            border: 1.5px solid #cbd5e1;
            background-color: #fafafa;
            padding: 10px 14px;
            border-radius: 4px;
            margin-top: 12px;
          }
          .declaracao-item {
            margin-bottom: 8px;
            text-align: justify;
            font-size: 9pt;
            line-height: 1.35;
          }
          .declaracao-item strong {
            display: block;
            color: #0A2540;
            font-family: Arial, sans-serif;
            font-size: 9pt;
            margin-bottom: 1px;
          }
          .declaracao-item .amparo {
            display: block;
            font-size: 7.5pt;
            color: #475569;
            font-style: italic;
            margin-bottom: 2px;
          }
          .declaracao-item p {
            margin: 0;
          }
          .assinatura {
            margin-top: 28px;
            text-align: center;
            page-break-inside: avoid;
          }
          .linha-assinatura {
            width: 300px;
            border-top: 1px solid #111;
            margin: 0 auto 6px auto;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Proposta Comercial e Formação de Preço Oficial</h1>
          <h2>Conformidade Integral com a Lei Federal nº 14.133/2021 (Art. 59 e Art. 63)</h2>
        </div>

        <div class="section-title">1. Dados do Proponente</div>
        <table class="grid-info">
          <tr>
            <td style="width: 50%;"><strong>Razão Social:</strong> ${razaoSocial}</td>
            <td style="width: 50%;"><strong>CNPJ / MF:</strong> ${cnpj}</td>
          </tr>
          <tr>
            <td><strong>Regime Tributário:</strong> ${proposta?.declaracaoMeEpp ? 'ME / EPP (LC 123/06)' : 'Ampla Concorrência'}</td>
            <td><strong>Validade da Proposta:</strong> ${proposta?.validadeDias || 60} dias corridos (Art. 90, § 3º)</td>
          </tr>
        </table>

        <div class="section-title">2. Dados da Licitação e Órgão Licitante (Painel de Disputas)</div>
        <table class="grid-info">
          <tr>
            <td style="width: 60%;"><strong>Órgão Licitante:</strong> ${orgao}</td>
            <td style="width: 40%;"><strong>Edital / Processo:</strong> ${num}</td>
          </tr>
          <tr>
            <td><strong>Objeto Licitado:</strong> ${obj}</td>
            <td><strong>Modalidade:</strong> ${mod}</td>
          </tr>
        </table>

        <div class="section-title">3. Planilha Orçamentária & Formação de Preço (Art. 59, III da Lei 14.133/21)</div>
        <table class="table-itens">
          <thead>
            <tr>
              <th style="width: 5%;">Item</th>
              <th style="width: 35%;">Descrição & Especificação</th>
              <th style="width: 10%;">Qtd / Un</th>
              <th style="width: 10%;">Custo Direto</th>
              <th style="width: 8%;">Tributos / Enc.(%)</th>
              <th style="width: 8%;">Margem Lucro(%)</th>
              <th style="width: 12%;">Valor Final Unit.</th>
              <th style="width: 12%;">Valor Final Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsItensHtml}
          </tbody>
        </table>

        <div class="total-banner">
          VALOR FINAL TOTAL OFERTADO: <span style="color:#EA580C;">${formatarMoeda(totalCalculado)}</span>
        </div>

        <div class="section-title">4. Declarações Obrigatórias do Art. 63 da Lei Federal nº 14.133/2021</div>
        <div class="declaracoes-container">
          ${declaracoesHtml}
        </div>

        <div class="assinatura">
          <p style="margin-bottom: 20px;">${dataExtenso}.</p>
          <div class="linha-assinatura"></div>
          <strong>${razaoSocial}</strong><br />
          <span>CNPJ: ${cnpj}</span><br />
          <span style="font-size: 8.5pt; color: #555;">Representante Legal Autorizado</span>
        </div>
      </body>
    </html>
  `;
}

/**
 * Dispara a impressão nativa / Salvar em PDF via popup do navegador.
 */
export function imprimirPropostaPdf(dados: DadosDocumentoProposta): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  const html = construirHtmlPdfProposta(dados);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);

  return true;
}
