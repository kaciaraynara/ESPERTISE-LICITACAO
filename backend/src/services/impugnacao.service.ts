import {
  calcularPrazoDecadencialImpugnacao,
  type PrazoDecadencialImpugnacao,
} from '../utils/prazos.util';

export { calcularPrazoDecadencialImpugnacao } from '../utils/prazos.util';

export interface DadosEditalImpugnacao {
  orgao?: string;
  setorResponsavel?: string;
  modalidade?: string;
  numeroPregao?: string;
  numeroEdital?: string;
  processoAdministrativo?: string;
  objeto?: string;
  criterioJulgamento?: string;
  plataforma?: string;
  dataCertame: string;
  nomeEmpresa?: string;
  cnpjEmpresa?: string;
  representanteLegal?: string;
  pontosImpugnacao?: string[];
  dadosFraude?: DadosFraudeImpugnacao;
  formato?: 'markdown' | 'html';
}

export type NivelRiscoFraude = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface DadosFraudeImpugnacao {
  risco: NivelRiscoFraude;
  possuiSociosEmComum?: boolean;
  resumo?: {
    totalConcorrentes?: number;
    totalVinculosSocietarios?: number;
  };
  vinculosSocietarios?: VinculoFraudeImpugnacao[];
}

export interface VinculoFraudeImpugnacao {
  socio: {
    nome: string;
    documentoMascarado?: string | null;
  };
  empresas: EmpresaVinculadaFraude[];
  totalEmpresas?: number;
}

export interface EmpresaVinculadaFraude {
  cnpj: string;
  razaoSocial?: string;
  qualificacao?: string | null;
  dataEntradaSociedade?: string | null;
}

export interface PecaImpugnacaoGerada {
  formato: 'markdown' | 'html';
  conteudo: string;
  prazo: PrazoDecadencialImpugnacao;
  placeholders: string[];
}

export function gerarEsqueletoImpugnacao(input: DadosEditalImpugnacao): PecaImpugnacaoGerada {
  const prazo = calcularPrazoDecadencialImpugnacao(input.dataCertame);
  const dados = normalizarDadosEdital(input);
  const pontos = normalizarPontos(input.pontosImpugnacao);
  const blocoFraude = montarBlocoFraude(input.dadosFraude);
  const formato = input.formato ?? 'markdown';

  const markdown = [
    `# IMPUGNAÇÃO AO EDITAL`,
    '',
    `À`,
    `${dados.orgao}`,
    `${dados.setorResponsavel}`,
    '',
    `Ref.: Impugnação ao Edital do ${dados.modalidade} nº ${dados.numeroEdital}`,
    `Processo Administrativo nº ${dados.processoAdministrativo}`,
    '',
    `${dados.nomeEmpresa}, inscrita no CNPJ sob nº ${dados.cnpjEmpresa}, por seu representante legal ${dados.representanteLegal}, vem, respeitosamente, apresentar IMPUGNAÇÃO AO EDITAL, com fundamento no art. 164, caput, da Lei nº 14.133/2021, pelos fatos e fundamentos a seguir expostos.`,
    '',
    `## I. DA TEMPESTIVIDADE`,
    '',
    `A abertura do certame está prevista para ${dados.dataCertame}. Nos termos do art. 164, caput, da Lei nº 14.133/2021, a impugnação deve ser protocolada até 3 dias úteis antes da data de abertura do certame.`,
    '',
    `Prazo decadencial calculado: ${prazo.prazoDecadencial}.`,
    '',
    `## II. DA SÍNTESE DO EDITAL`,
    '',
    `O edital referente ao ${dados.modalidade} nº ${dados.numeroEdital}, promovido por ${dados.orgao}, tem por objeto: ${dados.objeto}.`,
    '',
    `Critério de julgamento indicado: ${dados.criterioJulgamento}.`,
    `Plataforma ou sistema de disputa: ${dados.plataforma}.`,
    '',
    `## III. DOS PONTOS IMPUGNADOS`,
    '',
    ...pontos.flatMap((ponto, index) => [
      `### ${index + 1}. ${ponto}`,
      '',
      `Fato editalício: [DESCREVER_A_CLÁUSULA_OU_EXIGÊNCIA_IMPUGNADA_${index + 1}]`,
      '',
      `Risco jurídico ou operacional: [DESCREVER_O_PREJUÍZO_À_COMPETITIVIDADE_À_IGUALDADE_OU_AO_JULGAMENTO_OBJETIVO_${index + 1}]`,
      '',
      `Pedido específico: [INDICAR_A_RETIFICAÇÃO_OU_ESCLARECIMENTO_PRETENDIDO_${index + 1}]`,
      '',
    ]),
    `## IV. DOS FUNDAMENTOS JURÍDICOS`,
    '',
    `[FUNDAMENTACAO_LEGAL]`,
    '',
    `A presente impugnação observa a legitimidade conferida pelo art. 164, caput, da Lei nº 14.133/2021, diante de irregularidade ou necessidade de esclarecimento sobre os termos do edital.`,
    '',
    `A análise deve preservar os princípios do art. 5º da Lei nº 14.133/2021, especialmente legalidade, igualdade, vinculação ao edital, julgamento objetivo, competitividade, razoabilidade e proporcionalidade.`,
    '',
    `Também devem ser observados os objetivos do processo licitatório previstos no art. 11 da Lei nº 14.133/2021, notadamente a seleção da proposta apta a gerar o resultado de contratação mais vantajoso para a Administração Pública e a garantia de tratamento isonômico entre os licitantes.`,
    '',
    ...blocoFraude,
    blocoFraude.length > 0 ? `## VI. DOS PEDIDOS` : `## V. DOS PEDIDOS`,
    '',
    `Diante do exposto, requer-se:`,
    '',
    `1. O recebimento da presente impugnação, por ser tempestiva nos termos do art. 164, caput, da Lei nº 14.133/2021;`,
    `2. A análise dos pontos impugnados, com a devida motivação administrativa;`,
    `3. A retificação do edital nos itens indicados, caso reconhecida a irregularidade;`,
    `4. A republicação do edital e a reabertura dos prazos, quando a alteração impactar a formulação das propostas;`,
    `5. A divulgação da resposta em sítio eletrônico oficial, observando-se o art. 164, parágrafo único, da Lei nº 14.133/2021.`,
    ...(blocoFraude.length > 0
      ? [
        `6. A juntada da Malha Fina societária aos autos e a apuração específica dos vínculos societários comuns entre concorrentes, inclusive para eventual adoção das medidas cabíveis e preservação do regime recursal previsto no art. 166 da Lei nº 14.133/2021.`,
      ]
      : []),
    '',
    `[LOCAL], [DATA_DO_PROTOCOLO].`,
    '',
    `${dados.representanteLegal}`,
    `${dados.nomeEmpresa}`,
  ].join('\n');

  return {
    formato,
    conteudo: formato === 'html' ? renderHtml(markdown) : markdown,
    prazo,
    placeholders: [
      '[NOME_DO_ORGAO]',
      '[SETOR_RESPONSAVEL]',
      '[NUMERO_DO_PREGAO]',
      '[PROCESSO_ADMINISTRATIVO]',
      '[OBJETO_DO_EDITAL]',
      '[FUNDAMENTACAO_LEGAL]',
      '[NOME_DA_EMPRESA]',
      '[CNPJ_DA_EMPRESA]',
      '[REPRESENTANTE_LEGAL]',
      '[DESCREVER_A_CLÁUSULA_OU_EXIGÊNCIA_IMPUGNADA_1]',
      '[INDICAR_A_RETIFICAÇÃO_OU_ESCLARECIMENTO_PRETENDIDO_1]',
    ],
  };
}

function montarBlocoFraude(dadosFraude?: DadosFraudeImpugnacao): string[] {
  if (!dadosFraude || !dadosFraude.vinculosSocietarios?.length) return [];

  const vinculos = dadosFraude.vinculosSocietarios
    .filter((vinculo) => vinculo.socio?.nome && vinculo.empresas?.length > 1);

  if (vinculos.length === 0) return [];

  return [
    `## V. DA MALHA FINA SOCIETÁRIA E DOS INDÍCIOS DE CONLUIO`,
    '',
    `A análise objetiva da malha societária dos concorrentes indicou risco ${dadosFraude.risco} de vínculo econômico ou societário relevante entre participantes do certame, com identificação de sócios ou administradores em comum. Tais elementos recomendam a apuração pela Administração antes da prática de novos atos decisórios, especialmente para preservar a competitividade, a isonomia e a rastreabilidade do procedimento, sem prejuízo da instrução de eventual recurso administrativo na forma do art. 166 da Lei nº 14.133/2021, quando cabível.`,
    '',
    `Vínculos societários identificados:`,
    '',
    ...vinculos.flatMap((vinculo, index) => [
      `${index + 1}. ${formatarSocio(vinculo)}: ${formatarEmpresasVinculadas(vinculo.empresas)}.`,
    ]),
    '',
  ];
}

function formatarSocio(vinculo: VinculoFraudeImpugnacao) {
  const documento = clean(vinculo.socio.documentoMascarado ?? undefined);
  return documento ? `${vinculo.socio.nome} (${documento})` : vinculo.socio.nome;
}

function formatarEmpresasVinculadas(empresas: EmpresaVinculadaFraude[]) {
  return empresas
    .map((empresa) => {
      const razaoSocial = clean(empresa.razaoSocial) ?? 'Razão social não informada';
      const cnpj = clean(empresa.cnpj) ?? 'CNPJ não informado';
      const qualificacao = clean(empresa.qualificacao ?? undefined);
      return qualificacao ? `${razaoSocial} - CNPJ ${cnpj} (${qualificacao})` : `${razaoSocial} - CNPJ ${cnpj}`;
    })
    .join('; ');
}

function normalizarDadosEdital(input: DadosEditalImpugnacao) {
  const numero = clean(input.numeroEdital) ?? clean(input.numeroPregao) ?? '[NUMERO_DO_PREGAO]';

  return {
    orgao: clean(input.orgao) ?? '[NOME_DO_ORGAO]',
    setorResponsavel: clean(input.setorResponsavel) ?? '[SETOR_RESPONSAVEL]',
    modalidade: clean(input.modalidade) ?? '[MODALIDADE]',
    numeroEdital: numero,
    processoAdministrativo: clean(input.processoAdministrativo) ?? '[PROCESSO_ADMINISTRATIVO]',
    objeto: clean(input.objeto) ?? '[OBJETO_DO_EDITAL]',
    criterioJulgamento: clean(input.criterioJulgamento) ?? '[CRITÉRIO_DE_JULGAMENTO]',
    plataforma: clean(input.plataforma) ?? '[PLATAFORMA_DE_DISPUTA]',
    dataCertame: calcularPrazoDecadencialImpugnacao(input.dataCertame).dataCertame,
    nomeEmpresa: clean(input.nomeEmpresa) ?? '[NOME_DA_EMPRESA]',
    cnpjEmpresa: clean(input.cnpjEmpresa) ?? '[CNPJ_DA_EMPRESA]',
    representanteLegal: clean(input.representanteLegal) ?? '[REPRESENTANTE_LEGAL]',
  };
}

function normalizarPontos(pontos?: string[]) {
  const validos = pontos?.map((ponto) => ponto.trim()).filter(Boolean) ?? [];

  if (validos.length > 0) {
    return validos;
  }

  return [
    '[PONTO_DE_IMPUGNAÇÃO_1]',
    '[PONTO_DE_IMPUGNAÇÃO_2]',
  ];
}

function clean(value?: string) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function renderHtml(markdown: string) {
  const lines = markdown.split('\n');
  const html: string[] = ['<article class="impugnacao-peca">'];
  let listOpen = false;

  for (const line of lines) {
    if (!line.trim()) {
      if (listOpen) {
        html.push('</ol>');
        listOpen = false;
      }
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!listOpen) {
        html.push('<ol>');
        listOpen = true;
      }
      html.push(`<li>${escapeHtml(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  html.push('</article>');
  return html.join('\n');

  function closeList() {
    if (listOpen) {
      html.push('</ol>');
      listOpen = false;
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
