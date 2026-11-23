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

export function valorPorExtenso(valor: number): string {
  const num = Math.max(0, Number.isFinite(Number(valor)) ? Number(Number(valor).toFixed(2)) : 0);
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

  const bilhoes = Math.floor(inteiro / 1_000_000_000);
  const milhoes = Math.floor((inteiro % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((inteiro % 1_000_000) / 1_000);
  const restoInt = inteiro % 1_000;

  const grupos: string[] = [];
  if (bilhoes > 0) grupos.push(`${converterGrupo(bilhoes)} ${bilhoes === 1 ? 'bilhão' : 'bilhões'}`);
  if (milhoes > 0) grupos.push(`${converterGrupo(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
  if (milhares > 0) grupos.push(`${milhares === 1 ? 'mil' : `${converterGrupo(milhares)} mil`}`);
  if (restoInt > 0) grupos.push(converterGrupo(restoInt));

  let textoInteiro = '';
  if (inteiro > 0) {
    let textoGrupos = '';
    if (grupos.length >= 2 && restoInt > 0 && (restoInt < 100 || restoInt % 100 === 0)) {
      textoGrupos = `${grupos.slice(0, -1).join(', ')} e ${grupos[grupos.length - 1]}`;
    } else {
      textoGrupos = grupos.join(', ');
    }
    const sufixoReal =
      inteiro === 1
        ? 'real'
        : restoInt === 0 && milhares === 0 && (milhoes > 0 || bilhoes > 0)
          ? 'de reais'
          : 'reais';
    textoInteiro = `${textoGrupos} ${sufixoReal}`;
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

export function construirHtmlPdfProposta(dados: any): string {
  const { proposta, orgaoLicitante, numeroEdital, objetoLicitacao, modalidadeEdital, itens, totalCalculado } = dados;

  const diagnostico = (dados as any).diagnostico || {};
  const momentoEnvio = diagnostico.momentoEnvio || 'READEQUADA_VENCEDORA';
  const isDesidentificada = momentoEnvio === 'INICIAL_DESIDENTIFICADA';

  const emp = (dados as any).empresa || proposta?.company;
  const razaoSocial = isDesidentificada
    ? 'LICITANTE PROPONENTE (IDENTIFICAÇÃO VEDADA NA FASE INICIAL)'
    : (emp?.razaoSocial || proposta?.company?.razaoSocial || 'EMPRESA PROPONENTE');
  const nomeFantasia = isDesidentificada
    ? 'PROPOSTA INICIAL DESIDENTIFICADA'
    : (emp?.nomeFantasia || proposta?.company?.nomeFantasia || razaoSocial);
  const cnpjRaw = String(emp?.cnpj || proposta?.company?.cnpj || '').replace(/\D/g, '');
  const cnpj = isDesidentificada
    ? 'Oculto conforme vedação legal de identificação prévia'
    : (cnpjRaw.length === 14 ? cnpjRaw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (emp?.cnpj || proposta?.company?.cnpj || 'Não informado'));
  const inscricaoEstadual = diagnostico.inscricaoEstadual || emp?.inscricaoEstadual || 'Conforme cadastro estadual';
  const email = isDesidentificada ? '—' : (emp?.email || proposta?.company?.email || 'Não informado');
  const telefone = isDesidentificada ? '—' : (emp?.telefone || proposta?.company?.telefone || 'Não informado');
  const endereco = isDesidentificada ? '' : (emp?.endereco || proposta?.company?.endereco || '');
  const cidadeUf = emp?.cidadeUf || [emp?.cidade || emp?.municipio, emp?.uf].filter(Boolean).join(' - ') || 'Brasil';

  const banco = diagnostico.banco || emp?.banco || 'Conforme cadastro bancário da empresa';
  const agencia = diagnostico.agencia || emp?.agencia || '—';
  const contaCorrente = diagnostico.contaCorrente || emp?.contaCorrente || '—';

  const encarregadoNome = diagnostico.encarregadoNome || emp?.representanteLegal || 'Representante Legal Constituído';
  const encarregadoCpf = diagnostico.encarregadoCpf || 'Conforme Contrato Social / Procuração';
  const encarregadoRg = diagnostico.encarregadoRg || 'Conforme documento oficial anexo';
  const encarregadoEstadoCivil = diagnostico.encarregadoEstadoCivil || 'Conforme qualificação contratual';
  const encarregadoProfissao = diagnostico.encarregadoProfissao || 'Sócio-Administrador / Representante Legal';
  const encarregadoTelefone = diagnostico.encarregadoTelefone || telefone;
  const encarregadoEndereco = diagnostico.encarregadoEndereco || [endereco, cidadeUf].filter(Boolean).join(' - ') || 'Conforme Contrato Social';

  const orgao = orgaoLicitante || (dados as any).orgao || 'Órgão Licitante Promotor';
  const obj = objetoLicitacao || (dados as any).objeto || 'Objeto da contratação pública conforme Edital';
  const num = numeroEdital || (dados as any).numeroProcesso || 'S/N';
  const mod = modalidadeEdital || (dados as any).modalidade || 'Pregão Eletrônico (Lei nº 14.133/2021)';
  const criterio = (diagnostico.criterioJulgamento || proposta?.criterioJulgamento || 'Menor Preço').replace(/_/g, ' ');
  const validade = diagnostico.validadeDias || (dados as any).validadeDias || proposta?.validadeDias || 60;
  const entrega = diagnostico.prazoEntrega || (dados as any).prazoEntrega || proposta?.prazoEntregaDias || 15;
  const garantia = diagnostico.garantia || (dados as any).garantia || proposta?.garantia || '12 (doze) meses a contar do recebimento definitivo do objeto.';

  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const rawItens: any[] = Array.isArray(itens) ? itens : [];
  const somaCustosDiretos = rawItens.reduce(
    (acc, it) => acc + (Number(it.custoDireto ?? it.custoUnitario ?? 0) * (Number(it.quantidade) || 1)),
    0
  );
  const totalFinalCalculado =
    Number(totalCalculado) ||
    rawItens.reduce((acc, it) => {
      const itemTot =
        it.precoTotalProposto !== undefined && it.precoTotalProposto !== null
          ? Number(it.precoTotalProposto)
          : it.valorTotal !== undefined && it.valorTotal !== null
          ? Number(it.valorTotal)
          : (Number(it.quantidade || 1) * Number(it.precoUnitarioProposto ?? it.valorUnitario ?? 0));
      return acc + (Number(itemTot) || 0);
    }, 0);
  const diferencaBruta = Math.max(0, totalFinalCalculado - somaCustosDiretos);

  // Agrupamento por Lote para o Anexo VI - Ficha Técnica Descritiva do Objeto
  const lotesMap = new Map<string, any[]>();
  rawItens.forEach((it, idx) => {
    const loteKey = String(it.lote || '01').padStart(2, '0');
    if (!lotesMap.has(loteKey)) lotesMap.set(loteKey, []);
    lotesMap.get(loteKey)!.push({ ...it, _idx: idx });
  });

  const rowsItensHtml = rawItens
    .map((it, idx) => {
      const marcaModelo =
        it.marca ||
        it.marcaModelo ||
        [it.marca, it.modelo].filter(Boolean).join(' / ') ||
        'Conforme especificação técnica do Termo de Referência';
      const custo = Number(it.custoDireto ?? it.custoUnitario ?? 0);
      const encargos = Number(it.encargosPercentual ?? it.despesasPercentual ?? 0);
      const margem = Number(it.margemLucroPercentual ?? it.margemPercentual ?? 0);
      const unitario = Number(it.precoUnitarioProposto ?? it.valorUnitario ?? 0);
      const totalItem = Number(it.precoTotalProposto ?? it.valorTotal ?? (Number(it.quantidade || 1) * unitario));

      return `
      <tr>
        <td style="text-align:center; font-weight:bold;">${it.numero || idx + 1}</td>
        <td>
          <strong>${escapeHtml(it.descricao)}</strong><br/>
          <span style="font-size:8pt; color:#475569;">Marca / Modelo: ${escapeHtml(marcaModelo)}</span>
        </td>
        <td style="text-align:center;">${escapeHtml(String(it.unidade || 'UN'))}</td>
        <td style="text-align:center;">${it.quantidade}</td>
        <td style="text-align:right;">${formatarMoeda(custo)}</td>
        <td style="text-align:right;">${encargos}%</td>
        <td style="text-align:right;">${margem}%</td>
        <td style="text-align:right; font-weight:bold;">${formatarMoeda(unitario)}</td>
        <td style="text-align:right; font-weight:bold; color:#081C3A;">${formatarMoeda(totalItem)}</td>
      </tr>`;
    })
    .join('');

  const tabelasAnexoViPorLoteHtml = Array.from(lotesMap.entries())
    .map(([loteNum, itensDoLote]) => {
      const subtotalLote = itensDoLote.reduce((acc, it) => {
        const unitario = Number(it.precoUnitarioProposto ?? it.valorUnitario ?? 0);
        const totalItem = Number(it.precoTotalProposto ?? it.valorTotal ?? (Number(it.quantidade || 1) * unitario));
        return acc + totalItem;
      }, 0);

      const linhasLote = itensDoLote
        .map((it) => {
          const marcaModelo =
            it.marca ||
            it.marcaModelo ||
            [it.marca, it.modelo].filter(Boolean).join(' / ') ||
            'Conforme Termo de Referência';
          const unitario = Number(it.precoUnitarioProposto ?? it.valorUnitario ?? 0);
          const totalItem = Number(it.precoTotalProposto ?? it.valorTotal ?? (Number(it.quantidade || 1) * unitario));
          return `
          <tr>
            <td style="text-align:center; font-weight:bold;">${it.numero || it._idx + 1}</td>
            <td>${escapeHtml(it.descricao)}</td>
            <td style="text-align:center;">${escapeHtml(String(it.unidade || 'UN'))}</td>
            <td style="text-align:center;">${it.quantidade}</td>
            <td style="text-align:center; font-weight:bold;">${escapeHtml(marcaModelo)}</td>
            <td style="text-align:right;">${formatarMoeda(unitario)}</td>
            <td style="text-align:right; font-weight:bold;">${formatarMoeda(totalItem)}</td>
          </tr>`;
        })
        .join('');

      return `
      <div style="margin-top: 12px; page-break-inside: avoid;">
        <div style="background:#081C3A; color:#FFFFFF; font-family:Arial,sans-serif; font-size:9pt; font-weight:bold; padding:5px 10px; text-transform:uppercase;">
          LOTE ${escapeHtml(loteNum)}
        </div>
        <table class="table-itens" style="margin-top:0;">
          <thead>
            <tr>
              <th style="width: 6%;">ITEM</th>
              <th style="width: 38%;">OBJETO / ESPECIFICAÇÃO TÉCNICA</th>
              <th style="width: 7%;">UN</th>
              <th style="width: 7%;">QTD</th>
              <th style="width: 18%;">MARCA / MODELO</th>
              <th style="width: 12%;">PREÇO UNITÁRIO</th>
              <th style="width: 12%;">PREÇO TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${linhasLote}
          </tbody>
        </table>
        <div style="background:#F1F5F9; border:1px solid #081C3A; padding:6px 10px; text-align:right; font-size:9pt; font-weight:bold;">
          VALOR TOTAL DO LOTE ${escapeHtml(loteNum)}: ${formatarMoeda(subtotalLote)} (${escapeHtml(valorPorExtenso(subtotalLote))})
        </div>
      </div>`;
    })
    .join('');

  const isMeEpp =
    diagnostico.declararMeEpp !== undefined
      ? Boolean(diagnostico.declararMeEpp)
      : /\b(me|epp|micro|pequeno)\b/i.test(String((dados as any).enquadramento || emp?.porte || emp?.enquadramento || ''));
  const prazoEntregaTexto = /^\d+$/.test(String(entrega).trim()) ? (String(entrega).trim() + ' dias úteis a contar do recebimento da Nota de Empenho ou Ordem de Fornecimento.') : String(entrega);
  const declaracoesHtml = DECLARACOES_OBRIGATORIAS_14133.filter((dec) => isMeEpp || !/ME\/EPP|123\/2006/i.test(dec.titulo + ' ' + dec.amparoLegal))
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
        ${!isDesidentificada ? `
        <div class="header" style="display:flex; justify-content:space-between; align-items:center; text-align:left;">
          <div>
            <h1 style="font-size:14pt;">${escapeHtml(razaoSocial)}</h1>
            <h2>CNPJ: ${escapeHtml(cnpj)} | Inscrição Estadual: ${escapeHtml(inscricaoEstadual)}</h2>
            <div style="font-size:8.5pt; color:#334155; margin-top:3px;">
              ${escapeHtml([endereco, cidadeUf].filter(Boolean).join(' — '))} | Fone: ${escapeHtml(telefone)} | E-mail: ${escapeHtml(email)}
            </div>
          </div>
          <div style="text-align:right; font-family:Arial,sans-serif;">
            <div style="background:#081C3A; color:#FFFFFF; padding:5px 10px; border-radius:4px; font-size:8.5pt; font-weight:bold;">
              CARTA-PROPOSTA COMERCIAL
            </div>
            <div style="font-size:8pt; color:#475569; margin-top:3px;">Lei Federal nº 14.133/2021</div>
          </div>
        </div>
        ` : `
        <div class="header">
          <h1>Ficha Técnica Descritiva e Proposta Inicial de Preços</h1>
          <h2>Observação Legal: Por força da legislação vigente, é vedada a identificação do licitante</h2>
        </div>
        `}

        <div style="margin-bottom:10px; font-size:9.5pt;">
          <strong>À ${escapeHtml(orgao)}</strong><br/>
          <strong>Ref.: ${escapeHtml(mod)} Nº ${escapeHtml(num)}</strong><br/>
          <span>Apresentamos nossa proposta comercial de preços e especificações técnicas em estrita conformidade com o Edital e Termo de Referência.</span>
        </div>

        ${!isDesidentificada ? `
        <div class="section-title">1. Identificação do Licitante, Dados Bancários e Encarregado do Contrato</div>
        <table class="grid-info">
          <tr>
            <td style="width: 55%;"><strong>Razão Social:</strong> ${escapeHtml(razaoSocial)}</td>
            <td style="width: 45%;"><strong>CNPJ / MF:</strong> ${escapeHtml(cnpj)}</td>
          </tr>
          <tr>
            <td><strong>Nome Fantasia:</strong> ${escapeHtml(nomeFantasia)}</td>
            <td><strong>Enquadramento Legal:</strong> ${isMeEpp ? 'ME / EPP (Art. 3º LC nº 123/2006)' : 'Ampla Concorrência'}</td>
          </tr>
          <tr>
            <td><strong>Endereço Completo:</strong> ${escapeHtml([endereco, cidadeUf].filter(Boolean).join(' - ') || 'Brasil')}</td>
            <td><strong>Telefone / E-mail:</strong> ${escapeHtml([telefone, email].filter(Boolean).join(' | '))}</td>
          </tr>
          <tr>
            <td><strong>Estabelecimento Bancário:</strong> ${escapeHtml(banco)}</td>
            <td><strong>Agência:</strong> ${escapeHtml(agencia)} | <strong>Conta Corrente:</strong> ${escapeHtml(contaCorrente)}</td>
          </tr>
          <tr>
            <td colspan="2" style="background:#F8FAFC;">
              <strong>DADOS DA PROPOSTA:</strong> Validade: <strong>${validade} dias</strong> | Prazo de Entrega: <strong>${escapeHtml(prazoEntregaTexto)}</strong> | Prazo de Garantia: <strong>${escapeHtml(garantia)}</strong>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <strong>IDENTIFICAÇÃO DO ENCARREGADO PARA ASSINATURA DA ATA E DO CONTRATO:</strong><br/>
              <strong>Nome Completo:</strong> ${escapeHtml(encarregadoNome)} | <strong>CPF/MF:</strong> ${escapeHtml(encarregadoCpf)} | <strong>RG:</strong> ${escapeHtml(encarregadoRg)}<br/>
              <strong>Estado Civil:</strong> ${escapeHtml(encarregadoEstadoCivil)} | <strong>Profissão:</strong> ${escapeHtml(encarregadoProfissao)} | <strong>Telefone:</strong> ${escapeHtml(encarregadoTelefone)}<br/>
              <strong>Endereço Residencial:</strong> ${escapeHtml(encarregadoEndereco)}
            </td>
          </tr>
        </table>
        ` : ''}

        <div class="section-title">2. Condições Gerais e Preço (${momentoEnvio === 'READEQUADA_VENCEDORA' ? 'Readequado ao Lance Vencedor' : 'Proposta Inicial'})</div>
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

        <div class="box-texto">
          <strong>2.1.</strong> A proponente propõe-se a fornecer/executar o objeto licitado pelo valor global total de <strong>${formatarMoeda(totalFinalCalculado)} (${escapeHtml(valorPorExtenso(totalFinalCalculado))})</strong>, conforme preços unitários e totais constantes da Ficha Técnica Descritiva.<br/>
          <strong>2.2.</strong> O preço proposto inclui todas as despesas com impostos, encargos sociais, tributários, trabalhistas, previdenciários, fiscais e comerciais, fretes, seguros, embalagens e quaisquer outros custos diretos ou indiretos incidentes sobre o objeto (Art. 63, § 1º da Lei nº 14.133/2021).
        </div>

        <div class="section-title">3. Planilha Orçamentária Detalhada e Formação de Preços</div>
        <table class="table-itens">
          <thead>
            <tr>
              <th style="width: 5%;">Item</th>
              <th style="width: 33%;">Descrição, Especificação e Marca/Modelo</th>
              <th style="width: 6%;">Un</th>
              <th style="width: 6%;">Qtd</th>
              <th style="width: 10%;">Custo Direto</th>
              <th style="width: 8%;">Encargos</th>
              <th style="width: 8%;">Margem</th>
              <th style="width: 12%;">Unitário</th>
              <th style="width: 12%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsItensHtml}
          </tbody>
        </table>

        <div class="total-banner">
          VALOR GLOBAL DA PROPOSTA: <span style="color:#0070C0;">${formatarMoeda(totalFinalCalculado)}</span><br/>
          <span style="font-size:8.5pt; font-weight:normal; color:#334155;">(${escapeHtml(valorPorExtenso(totalFinalCalculado))})</span>
        </div>

        <div class="section-title">4. Anexo — Ficha Técnica Descritiva do Objeto por Lote e Item</div>
        ${tabelasAnexoViPorLoteHtml}

        <div class="box-texto" style="margin-top:10px;">
          <strong>Declaração de atendimento às condições do Edital:</strong> Declaramos que os produtos e serviços cotados atendem integralmente a todas as especificações técnicas, prazos e condições exigidas no Edital e no Termo de Referência.<br/>
          ${isMeEpp ? '<strong>Declaração de condição de ME-EPP:</strong> Declaramos, sob as penas da lei, que cumprimos os requisitos legais para qualificação como Microempresa ou Empresa de Pequeno Porte, nos termos do Art. 3º da Lei Complementar nº 123/2006 e Art. 4º da Lei nº 14.133/2021.<br/>' : ''}
          <strong>Observação:</strong> Por força da legislação vigente, na fase de proposta inicial desidentificada é vedada qualquer identificação prévia do licitante no sistema eletrônico.
        </div>

        <div class="section-title">5. Demonstração de Exequibilidade e Integralidade dos Custos (Art. 59 e Art. 63, § 1º)</div>
        <div class="box-texto">
          Em estrita observância ao <strong>Art. 59, inciso III e § 4º</strong>, e ao <strong>Art. 63, § 1º da Lei Federal nº 14.133/2021</strong>, bem como à <strong>Súmula nº 262 do Tribunal de Contas da União (TCU)</strong>, demonstramos que o valor global ofertado de <strong>${formatarMoeda(totalFinalCalculado)}</strong> frente ao custo direto base apurado de <strong>${formatarMoeda(somaCustosDiretos)}</strong> (margem bruta de cobertura de <strong>${formatarMoeda(diferencaBruta)}</strong>) garante plena exequibilidade contratual.
        </div>

        <div class="section-title">6. Declarações Obrigatórias da Lei Federal nº 14.133/2021</div>
        <div class="declaracoes-container">
          ${declaracoesHtml}
        </div>

        ${!isDesidentificada ? `
        <div class="assinatura">
          <p style="margin-bottom: 24px;">${escapeHtml(cidadeUf)}, ${dataExtenso}.</p>
          <div class="linha-assinatura"></div>
          <strong>${escapeHtml(razaoSocial)}</strong><br />
          <span>CNPJ / MF: ${escapeHtml(cnpj)}</span><br />
          <span style="font-size: 8.5pt; color: #0F172A; font-weight: bold;">${escapeHtml(encarregadoNome)} — CPF: ${escapeHtml(encarregadoCpf)}</span><br />
          <span style="font-size: 8pt; color: #475569;">Assinatura Digital Qualificada (Padrão ICP-Brasil / Gov.br)</span>
        </div>
        ` : ''}
      </body>
    </html>
  `;
}

export function imprimirPropostaPdf(dados: any): boolean {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return false;
      const html = construirHtmlPdfProposta(dados);
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
      return true;
    }

    const html = construirHtmlPdfProposta(dados);
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // Limpeza do iframe
        }
      }, 1500);
    }, 300);

    return true;
  } catch {
    window.print();
    return true;
  }
}

export const gerarPropostaComercialPdf = imprimirPropostaPdf;
export const gerarPropostaPDF = imprimirPropostaPdf;
export default imprimirPropostaPdf;
