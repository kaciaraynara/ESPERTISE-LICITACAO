/**
 * Gerador Oficial de Proposta Comercial Fundamentada
 * Conformidade integral com a Lei Federal nº 14.133/2021 e Jurisprudência do TCU.
 */

import { ProposalDto, ProposalItemDto } from '@/services/api';

export const DECLARACOES_OBRIGATORIAS_14133 = [
  {
    numero: 1,
    titulo: '1. DECLARAÇÃO DE ELABORAÇÃO INDEPENDENTE DE PROPOSTA',
    amparoLegal: 'Art. 63, inciso I, da Lei Federal nº 14.133/2021 c/c Art. 299 do Código Penal Brasileiro',
    texto:
      'Declaramos, sob as penas da lei, em especial o Art. 299 do Código Penal Brasileiro e o Art. 63, inciso I, da Lei Federal nº 14.133/2021, que a presente proposta comercial foi elaborada de maneira autônoma e independente pela empresa proponente, e que seu conteúdo, preços, planilhas e estratégias comerciais não foram, no todo ou em parte, direta ou indiretamente, informados, discutidos, recebidos ou compartilhados com qualquer outro licitante concorrente, potencial interessado ou agente público antes da abertura formal da sessão pública do certame.',
  },
  {
    numero: 2,
    titulo: '2. DECLARAÇÃO DE CUMPRIMENTO PLENO DOS REQUISITOS DE HABILITAÇÃO',
    amparoLegal: 'Art. 63, inciso I, e Art. 92, inciso XVI, da Lei Federal nº 14.133/2021',
    texto:
      'Declaramos, sob as sanções administrativas e legais cabíveis, que atendemos e cumprimos integralmente todos os requisitos de habilitação jurídica, regularidade fiscal, social e trabalhista, qualificação técnica e qualificação econômico-financeira exigidos no instrumento convocatório e seus anexos, comprometendo-nos a manter todas essas condições de regularidade durante toda a vigência contratual.',
  },
  {
    numero: 3,
    titulo: '3. DECLARAÇÃO DE OBSERVÂNCIA AO DISPOSTO NO INCISO XXXIII DO ART. 7º DA CONSTITUIÇÃO FEDERAL',
    amparoLegal: 'Art. 68, inciso VI, da Lei Federal nº 14.133/2021 c/c Art. 7º, inciso XXXIII, da Constituição Federal de 1988',
    texto:
      'Declaramos, para fins do disposto no Art. 68, inciso VI, da Lei Federal nº 14.133/2021 e no Art. 7º, inciso XXXIII, da Constituição Federal de 1988, que não empregamos menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre, e que não empregamos menor de 16 (dezesseis) anos em qualquer trabalho, salvo na condição de aprendiz, a partir dos 14 (quatorze) anos de idade, em estrita conformidade com a legislação trabalhista vigente.',
  },
  {
    numero: 4,
    titulo: '4. DECLARAÇÃO DE INEXISTÊNCIA DE FATOS IMPEDITIVOS, SANÇÕES OU IMPEDIMENTOS LEGAIS',
    amparoLegal: 'Art. 14 e Art. 156 da Lei Federal nº 14.133/2021',
    texto:
      'Declaramos, sob as penalidades da lei, a inexistência de quaisquer fatos impeditivos supervenientes, impedimentos previstos no Art. 14 da Lei nº 14.133/2021 ou sanções administrativas restritivas que obstem nossa participação nesta licitação, assegurando que a empresa e seus sócios/administradores não se encontram suspensos do direito de licitar, impedidos de contratar ou declarados inidôneos por qualquer órgão ou entidade da Administração Pública direta ou indireta da União, Estados, Distrito Federal ou Municípios.',
  },
  {
    numero: 5,
    titulo: '5. DECLARAÇÃO DE CUMPRIMENTO DE RESERVA DE CARGOS PARA PESSOAS COM DEFICIÊNCIA E REABILITADOS',
    amparoLegal: 'Art. 63, inciso IV, da Lei Federal nº 14.133/2021 c/c Art. 93 da Lei Federal nº 8.213/1991',
    texto:
      'Declaramos que a empresa cumpre integralmente as exigências legais de reserva de cargos para pessoa com deficiência (PCD) e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas, observando rigorosamente o disposto no Art. 63, inciso IV, da Lei Federal nº 14.133/2021 e no Art. 93 da Lei nº 8.213/1991, conforme o porte e o quadro funcional da sociedade.',
  },
  {
    numero: 6,
    titulo: '6. DECLARAÇÃO DE ENQUADRAMENTO LEGAL (ME/EPP) E CRITÉRIOS DE SUSTENTABILIDADE',
    amparoLegal: 'Art. 4º e Art. 11, inciso IV, da Lei Federal nº 14.133/2021 c/c Lei Complementar nº 123/2006',
    texto:
      'Declaramos que a execução do objeto observará os critérios de sustentabilidade ambiental, logística reversa e destinação adequada de resíduos exigidos no Termo de Referência, bem como, quando aplicável ao regime da proponente, que cumprimos os requisitos legais para qualificação como Microempresa (ME) ou Empresa de Pequeno Porte (EPP) nos termos da Lei Complementar nº 123/2006 e do Art. 4º da Lei nº 14.133/2021, sem extrapolação dos limites de faturamento no ano-calendário.',
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

function valorPorExtenso(valor: number): string {
  const num = Number(valor) || 0;
  if (num === 0) return 'zero reais';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const converterGrupo = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);
    if (resto >= 10 && resto < 20) {
      partes.push(especiais[resto - 10]);
    } else {
      if (d > 0) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }
    return partes.join(' e ');
  };

  const inteiro = Math.floor(num);
  const centavos = Math.round((num - inteiro) * 100);

  const milhoes = Math.floor(inteiro / 1000000);
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  const restoInt = inteiro % 1000;

  const grupos: string[] = [];
  if (milhoes > 0) grupos.push(`${converterGrupo(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
  if (milhares > 0) grupos.push(`${milhares === 1 ? 'mil' : `${converterGrupo(milhares)} mil`}`);
  if (restoInt > 0) grupos.push(converterGrupo(restoInt));

  let textoInteiro = grupos.join(', ');
  if (inteiro > 0) {
    textoInteiro += inteiro === 1 ? ' real' : ' reais';
  }

  if (centavos > 0) {
    const textoCentavos = `${converterGrupo(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
    return textoInteiro ? `${textoInteiro} e ${textoCentavos}` : textoCentavos;
  }
  return textoInteiro;
}

function escapeHtml(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function montarTextoPlanoProposta(dados: DadosDocumentoProposta): string {
  const { proposta, orgaoLicitante, numeroEdital, objetoLicitacao, modalidadeEdital, itens, totalCalculado } = dados;
  const lines: string[] = [];

  const razaoSocial = proposta?.company?.razaoSocial || 'EMPRESA PROPONENTE';
  const nomeFantasia = proposta?.company?.nomeFantasia || razaoSocial;
  const cnpj = proposta?.company?.cnpj || 'Não informado';
  const email = proposta?.company?.email || 'Não informado';
  const telefone = proposta?.company?.telefone || 'Não informado';
  const orgao = orgaoLicitante || 'Órgão Licitante Promotor';
  const obj = objetoLicitacao || 'Objeto da contratação pública conforme Edital';
  const num = numeroEdital || 'S/N';
  const mod = modalidadeEdital || 'Pregão Eletrônico (Lei nº 14.133/2021)';
  const criterio = proposta?.criterioJulgamento?.replace(/_/g, ' ') || 'Menor Preço';
  const validade = proposta?.validadeDias || 60;
  const entrega = proposta?.prazoEntregaDias || 15;
  const garantia = proposta?.garantia || 'Garantia legal e contratual mínima de 12 (doze) meses contra defeitos de fabricação ou falhas de execução.';
  const pagamento = proposta?.condicoesPagamento || 'Em até 30 (trinta) dias corridos após o recebimento definitivo e atesto da Nota Fiscal.';

  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  lines.push('================================================================================');
  lines.push('        PROPOSTA COMERCIAL OFICIAL E DEMONSTRATIVO DE FORMAÇÃO DE PREÇOS        ');
  lines.push('              LEI FEDERAL Nº 14.133/2021 E JURISPRUDÊNCIA DO TCU              ');
  lines.push('================================================================================\n');

  lines.push('1. IDENTIFICAÇÃO COMPLETA DA EMPRESA PROPONENTE');
  lines.push(`Razão Social: ${razaoSocial}`);
  lines.push(`Nome Fantasia: ${nomeFantasia}`);
  lines.push(`CNPJ / MF: ${cnpj}`);
  lines.push(`E-mail Oficial para Intimações e Ordens de Fornecimento: ${email}`);
  lines.push(`Telefone Comercial: ${telefone}`);
  lines.push(`Enquadramento Tributário / Empresarial: ${proposta?.declaracaoMeEpp ? 'Microempresa ou Empresa de Pequeno Porte (LC nº 123/2006)' : 'Regime Geral / Ampla Concorrência'}\n`);

  lines.push('2. IDENTIFICAÇÃO DO ÓRGÃO LICITANTE E DADOS DO CERTAME');
  lines.push(`Órgão / Entidade Promotora: ${orgao}`);
  lines.push(`Edital / Processo Administrativo: ${num}`);
  lines.push(`Modalidade da Licitação: ${mod}`);
  lines.push(`Critério de Julgamento: ${criterio}`);
  lines.push(`Objeto Detalhado: ${obj}\n`);

  lines.push('3. PLANILHA ORÇAMENTÁRIA DETALHADA POR ITEM');
  lines.push('--------------------------------------------------------------------------------');
  if (itens.length === 0) {
    lines.push('Nenhum item cadastrado nesta proposta.');
  } else {
    itens.forEach((it, idx) => {
      const marcaModelo = [it.marca, it.modelo].filter(Boolean).join(' / ') || 'Conforme especificação do Termo de Referência';
      lines.push(
        `Item ${it.numero || idx + 1}: ${it.descricao}\n` +
          `  - Marca / Modelo / Referência: ${marcaModelo}\n` +
          `  - Quantidade / Unidade: ${it.quantidade} ${it.unidade}\n` +
          `  - Custo Direto Unitário: ${formatarMoeda(it.custoDireto)} | Encargos e Tributos: ${Number(it.encargosPercentual ?? it.bdiPercentual ?? 0)}% | Margem Líquida: ${Number(it.margemLucroPercentual ?? 0)}%\n` +
          `  - Preço Unitário Proposto: ${formatarMoeda(it.precoUnitarioProposto)} | Preço Total do Item: ${formatarMoeda(it.precoTotalProposto)}`
      );
    });
  }
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`VALOR GLOBAL DA PROPOSTA: ${formatarMoeda(totalCalculado)} (${valorPorExtenso(totalCalculado)})\n`);

  lines.push('4. DEMONSTRAÇÃO DE EXEQUIBILIDADE E INTEGRALIDADE DOS CUSTOS (ART. 59 E ART. 63, § 1º DA LEI 14.133/2021)');
  lines.push(
    'Em atendimento ao disposto no Art. 59, inciso III e § 4º, bem como no Art. 63, § 1º da Lei Federal nº 14.133/2021 e à Súmula nº 262 do Tribunal de Contas da União (TCU), declaramos e demonstramos que os valores unitários e globais ofertados nesta proposta são plenamente exequíveis, cobrindo integralmente:\n' +
      'a) Todos os custos diretos de aquisição, insumos, matérias-primas, equipamentos e mão de obra especializada;\n' +
      'b) Todos os encargos trabalhistas, previdenciários, fundiários (FGTS) e obrigações decorrentes de convenções ou acordos coletivos de trabalho;\n' +
      'c) Todos os tributos federais, estaduais e municipais incidentes sobre o faturamento e a operação;\n' +
      'd) Despesas operacionais, logísticas, frete CIF até o local indicado pelo Órgão, seguros, embalagens, taxas administrativas e margem de lucro líquida sustentável.\n'
  );

  lines.push('5. CONDIÇÕES COMERCIAIS, PRAZOS, GARANTIA E PAGAMENTO (ARTS. 90 E 92 DA LEI 14.133/2021)');
  lines.push(`- Prazo de Validade da Proposta: ${validade} (sessenta) dias corridos a contar da data de abertura da sessão pública (Art. 90, § 3º).`);
  lines.push(`- Prazo de Entrega / Início da Execução: ${entrega} dias corridos contados do recebimento da Nota de Empenho ou Ordem de Fornecimento.`);
  lines.push(`- Garantia e Assistência Técnica: ${garantia} Comprometemo-nos à substituição imediata, sem ônus ao Órgão, de qualquer item em desacordo com o Termo de Referência.`);
  lines.push(`- Condições de Pagamento: ${pagamento}`);
  lines.push('- Vinculação ao Edital: Declaramos plena ciência e concordância irrestrita com todas as cláusulas do Edital, Termo de Referência e Minuta Contratual.\n');

  lines.push('6. DECLARAÇÕES OBRIGATÓRIAS EXIGIDAS PELA LEI FEDERAL Nº 14.133/2021');
  DECLARACOES_OBRIGATORIAS_14133.forEach((dec) => {
    lines.push(`${dec.titulo}`);
    lines.push(`Amparo Legal: ${dec.amparoLegal}`);
    lines.push(`${dec.texto}\n`);
  });

  lines.push(`${dataExtenso}.\n\n`);
  lines.push('___________________________________________________________');
  lines.push(`${razaoSocial}`);
  lines.push(`CNPJ / MF: ${cnpj}`);
  lines.push('Representante Legal Autorizado');

  return lines.join('\n');
}

export function construirHtmlPdfProposta(dados: DadosDocumentoProposta): string {
  const { proposta, orgaoLicitante, numeroEdital, objetoLicitacao, modalidadeEdital, itens, totalCalculado } = dados;

  const razaoSocial = proposta?.company?.razaoSocial || 'EMPRESA PROPONENTE';
  const nomeFantasia = proposta?.company?.nomeFantasia || razaoSocial;
  const cnpj = proposta?.company?.cnpj || 'Não informado';
  const email = proposta?.company?.email || 'Não informado';
  const telefone = proposta?.company?.telefone || 'Não informado';
  const orgao = orgaoLicitante || 'Órgão Licitante Promotor';
  const obj = objetoLicitacao || 'Objeto da contratação pública conforme Edital';
  const num = numeroEdital || 'S/N';
  const mod = modalidadeEdital || 'Pregão Eletrônico (Lei nº 14.133/2021)';
  const criterio = proposta?.criterioJulgamento?.replace(/_/g, ' ') || 'Menor Preço';
  const validade = proposta?.validadeDias || 60;
  const entrega = proposta?.prazoEntregaDias || 15;
  const garantia = proposta?.garantia || 'Garantia legal e contratual mínima de 12 (doze) meses contra vícios, defeitos de fabricação ou falhas de execução.';
  const pagamento = proposta?.condicoesPagamento || 'Em até 30 (trinta) dias corridos após o recebimento definitivo e atesto da Nota Fiscal em conta vinculada ao CNPJ da proponente.';

  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const somaCustosDiretos = itens.reduce((acc, it) => acc + (Number(it.custoDireto) || 0) * (Number(it.quantidade) || 1), 0);
  const diferencaBruta = Math.max(0, totalCalculado - somaCustosDiretos);

  const rowsItensHtml = itens
    .map((it, idx) => {
      const marcaModelo = [it.marca, it.modelo].filter(Boolean).join(' / ') || 'Conforme Edital';
      return `
      <tr>
        <td style="text-align:center; font-weight:bold;">${it.numero || idx + 1}</td>
        <td>
          <strong>${escapeHtml(it.descricao)}</strong><br/>
          <span style="font-size:8pt; color:#475569;">Marca/Modelo: ${escapeHtml(marcaModelo)}</span>
        </td>
        <td style="text-align:center;">${it.quantidade} ${escapeHtml(it.unidade)}</td>
        <td style="text-align:right;">${formatarMoeda(it.custoDireto)}</td>
        <td style="text-align:right;">${Number(it.encargosPercentual ?? it.bdiPercentual ?? 0)}%</td>
        <td style="text-align:right;">${Number(it.margemLucroPercentual ?? 0)}%</td>
        <td style="text-align:right; font-weight:bold;">${formatarMoeda(it.precoUnitarioProposto)}</td>
        <td style="text-align:right; font-weight:bold; color:#081C3A;">${formatarMoeda(it.precoTotalProposto)}</td>
      </tr>`;
    })
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
        <title>Proposta Comercial Oficial - ${escapeHtml(razaoSocial)}</title>
        <style>
          @page {
            margin: 15mm;
            size: A4 portrait;
          }
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 9.8pt;
            line-height: 1.45;
            color: #0F172A;
            margin: 0;
            padding: 0;
          }
          .header {
            text-align: center;
            border-bottom: 2.5px solid #081C3A;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .header h1 {
            font-family: Arial, sans-serif;
            font-size: 13pt;
            margin: 0;
            color: #081C3A;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          .header h2 {
            font-family: Arial, sans-serif;
            font-size: 9pt;
            margin: 4px 0 0 0;
            color: #0070C0;
            font-weight: bold;
          }
          .section-title {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            font-weight: bold;
            color: #081C3A;
            text-transform: uppercase;
            border-bottom: 1.5px solid #CBD5E1;
            padding-bottom: 3px;
            margin-top: 14px;
            margin-bottom: 7px;
            page-break-after: avoid;
          }
          .grid-info {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 9.2pt;
          }
          .grid-info td {
            padding: 3.5px 6px;
            vertical-align: top;
            border: 1px solid #E2E8F0;
          }
          .table-itens {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 10px;
            font-size: 8.8pt;
          }
          .table-itens th {
            background-color: #081C3A;
            color: #FFFFFF;
            border: 1px solid #081C3A;
            padding: 6px 4px;
            font-family: Arial, sans-serif;
            font-size: 7.8pt;
            text-transform: uppercase;
            text-align: center;
          }
          .table-itens td {
            border: 1px solid #CBD5E1;
            padding: 5px;
          }
          .total-banner {
            background-color: #F8FAFC;
            border: 1.5px solid #081C3A;
            padding: 8px 12px;
            text-align: right;
            font-size: 10.5pt;
            font-weight: bold;
            margin-bottom: 12px;
          }
          .box-texto {
            background-color: #F8FAFC;
            border-left: 3px solid #0070C0;
            padding: 8px 12px;
            margin-bottom: 10px;
            text-align: justify;
            font-size: 9.2pt;
          }
          .box-texto ul {
            margin: 5px 0 0 18px;
            padding: 0;
          }
          .box-texto li {
            margin-bottom: 3px;
          }
          .declaracoes-container {
            border: 1px solid #CBD5E1;
            background-color: #FAFAFA;
            padding: 10px 14px;
            border-radius: 4px;
            margin-top: 8px;
          }
          .declaracao-item {
            margin-bottom: 9px;
            text-align: justify;
            font-size: 8.9pt;
            line-height: 1.38;
            page-break-inside: avoid;
          }
          .declaracao-item strong {
            display: block;
            color: #081C3A;
            font-family: Arial, sans-serif;
            font-size: 8.8pt;
            margin-bottom: 1px;
          }
          .declaracao-item .amparo {
            display: block;
            font-size: 7.6pt;
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
            width: 320px;
            border-top: 1px solid #0F172A;
            margin: 0 auto 6px auto;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Proposta Comercial Oficial e Demonstrativo de Formação de Preços</h1>
          <h2>Instrumento Fundamentado na Lei Federal nº 14.133/2021 e Jurisprudência do TCU</h2>
        </div>

        <div class="section-title">1. Identificação Completa da Empresa Proponente</div>
        <table class="grid-info">
          <tr>
            <td style="width: 55%;"><strong>Razão Social:</strong> ${escapeHtml(razaoSocial)}</td>
            <td style="width: 45%;"><strong>CNPJ / MF:</strong> ${escapeHtml(cnpj)}</td>
          </tr>
          <tr>
            <td><strong>Nome Fantasia:</strong> ${escapeHtml(nomeFantasia)}</td>
            <td><strong>Enquadramento Legal:</strong> ${proposta?.declaracaoMeEpp ? 'ME / EPP (LC nº 123/2006)' : 'Ampla Concorrência'}</td>
          </tr>
          <tr>
            <td><strong>E-mail Oficial:</strong> ${escapeHtml(email)}</td>
            <td><strong>Telefone Comercial:</strong> ${escapeHtml(telefone)}</td>
          </tr>
        </table>

        <div class="section-title">2. Identificação do Órgão Licitante e Dados do Certame</div>
        <table class="grid-info">
          <tr>
            <td style="width: 60%;"><strong>Órgão / Entidade Promotora:</strong> ${escapeHtml(orgao)}</td>
            <td style="width: 40%;"><strong>Edital / Processo nº:</strong> ${escapeHtml(num)}</td>
          </tr>
          <tr>
            <td><strong>Modalidade:</strong> ${escapeHtml(mod)}</td>
            <td><strong>Critério de Julgamento:</strong> ${escapeHtml(criterio)}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Objeto da Contratação:</strong> ${escapeHtml(obj)}</td>
          </tr>
        </table>

        <div class="section-title">3. Planilha Orçamentária Detalhada e Formação de Preços</div>
        <table class="table-itens">
          <thead>
            <tr>
              <th style="width: 5%;">Item</th>
              <th style="width: 35%;">Descrição, Especificação e Marca/Modelo</th>
              <th style="width: 10%;">Qtd / Un</th>
              <th style="width: 10%;">Custo Direto</th>
              <th style="width: 9%;">Encargos (%)</th>
              <th style="width: 8%;">Margem (%)</th>
              <th style="width: 11%;">Unitário</th>
              <th style="width: 12%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsItensHtml}
          </tbody>
        </table>

        <div class="total-banner">
          VALOR GLOBAL DA PROPOSTA: <span style="color:#0070C0;">${formatarMoeda(totalCalculado)}</span><br/>
          <span style="font-size:8.5pt; font-weight:normal; color:#334155;">(${escapeHtml(valorPorExtenso(totalCalculado))})</span>
        </div>

        <div class="section-title">4. Demonstração de Exequibilidade e Integralidade dos Custos (Art. 59 e Art. 63, § 1º)</div>
        <div class="box-texto">
          Em estrita observância ao <strong>Art. 59, inciso III e § 4º</strong>, e ao <strong>Art. 63, § 1º da Lei Federal nº 14.133/2021</strong>, bem como à <strong>Súmula nº 262 do Tribunal de Contas da União (TCU)</strong>, demonstramos que o valor global ofertado de <strong>${formatarMoeda(totalCalculado)}</strong> frente ao custo direto base apurado de <strong>${formatarMoeda(somaCustosDiretos)}</strong> (margem bruta de cobertura de <strong>${formatarMoeda(diferencaBruta)}</strong>) garante plena exequibilidade contratual e compreende integralmente:
          <ul>
            <li>Todos os custos diretos de aquisição, insumos, materiais, equipamentos e mão de obra necessária à execução do objeto;</li>
            <li>Todos os encargos trabalhistas, previdenciários, sociais, fundiários e direitos previstos em convenções coletivas de trabalho aplicáveis;</li>
            <li>Todos os tributos federais, estaduais e municipais incidentes sobre a operação e o faturamento;</li>
            <li>Despesas operacionais, frete até o local de entrega designado pelo Órgão, seguros, embalagens, taxas administrativas e lucro líquido sustentável.</li>
          </ul>
        </div>

        <div class="section-title">5. Condições Comerciais, Entrega, Garantia e Pagamento (Arts. 90 e 92)</div>
        <div class="box-texto">
          <ul>
            <li><strong>Validade da Proposta:</strong> ${validade} (sessenta) dias corridos a contar da abertura da sessão pública (Art. 90, § 3º da Lei nº 14.133/2021).</li>
            <li><strong>Prazo de Entrega / Execução:</strong> ${entrega} dias corridos após o recebimento da Nota de Empenho ou Ordem de Fornecimento.</li>
            <li><strong>Garantia e Substituição:</strong> ${escapeHtml(garantia)} Compromisso de substituição imediata, sem ônus à Administração, em caso de desconformidade.</li>
            <li><strong>Condições de Pagamento:</strong> ${escapeHtml(pagamento)}</li>
            <li><strong>Submissão ao Edital:</strong> Declaramos integral concordância com todas as regras do Edital, Termo de Referência e Minuta do Contrato.</li>
          </ul>
        </div>

        <div class="section-title">6. Declarações Obrigatórias da Lei Federal nº 14.133/2021</div>
        <div class="declaracoes-container">
          ${declaracoesHtml}
        </div>

        <div class="assinatura">
          <p style="margin-bottom: 24px;">${dataExtenso}.</p>
          <div class="linha-assinatura"></div>
          <strong>${escapeHtml(razaoSocial)}</strong><br />
          <span>CNPJ / MF: ${escapeHtml(cnpj)}</span><br />
          <span style="font-size: 8.5pt; color: #475569;">Representante Legal Autorizado</span>
        </div>
      </body>
    </html>
  `;
}

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