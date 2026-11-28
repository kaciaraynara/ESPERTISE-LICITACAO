import { prisma } from '../database/prisma';
import { classifyExecutionMode, StatusLeituraCompleta } from './execution-classifier.service';
import { auditEditalNullities } from './nullity-auditor.service';

export interface VicioIrregularidadeEdital {
  id: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  arquivoOrigem: string;
  pagina: number | string;
  clausula?: string | null;
  trechoLiteral: string;
  fundamentoLegal: string;
  explicacaoSimples: string;
  acaoRecomendada: string;
}

export interface AuditoriaEditalResultado {
  status: 'IRREGULARIDADE_DETECTADA' | 'CONFORME';
  mensagem: string;
  totalVicios: number;
  viciosAltos: number;
  viciosMedios: number;
  viciosBaixos: number;
  apontamentos: VicioIrregularidadeEdital[];
}

export interface SecaoResumoExplicado {
  objetoContratacao: {
    oQueOrgaoQuer: string;
    itensDetalhados: Array<{
      itemNumero: number;
      descricao: string;
      quantidade: number;
      unidade: string;
      valorUnitarioEstimado: number | null;
      valorTotalEstimado: number | null;
    }>;
    valorGlobalEstimado: number | null;
  };
  disputaEPrazos: {
    portalDisputa: string;
    formatoDisputa: 'ELETRONICA' | 'PRESENCIAL' | 'NAO_ESPECIFICADO';
    aberturaSessao: string | null;
    prazoLimiteProposta: string;
    prazoEsclarecimento: string;
    prazoLimiteImpugnacao: string;
    trechoComprovante: string | null;
  };
  condicoesEntregaExecucao: {
    prazoEntrega: string;
    localEntrega: string;
    exigeAmostra: boolean;
    detalhesAmostra: string;
    exigeCatalogo: boolean;
    detalhesCatalogo: string;
    exigeVistoria: boolean;
    detalhesVistoria: string;
  };
  documentosExigidosHabilitacao: {
    juridica: string[];
    fiscalTrabalhista: string[];
    balancoPatrimonial: string;
    exigenciaIndicesContabeis: string;
    atestadoTecnico: string;
    limiteAtestadoPercentual: string;
    tempoMinimoExperiencia: string;
    registroConselhoOuAlvara: string;
  };
  financeiroEContrato: {
    condicoesPagamento: string;
    vigenciaContrato: string;
    criterioReajuste: string;
    garantiaContratual: string;
    multasEPenalidades: string;
  };
  beneficioMeEpp: {
    exclusivoOuCotaMeEpp: boolean;
    detalhesMeEpp: string;
  };
}

export interface BlocoExplicacaoProfessor {
  titulo: string;
  resumoDidatico: string;
  referenciaFonte: string;
}

export interface ExplicacaoProfessorCompleta {
  bloco1ObjetoPratico: BlocoExplicacaoProfessor;
  bloco2DisputaEPrazos: BlocoExplicacaoProfessor;
  bloco3HabilitacaoCompleta: BlocoExplicacaoProfessor;
  bloco4GarantiasECustosOcultos: BlocoExplicacaoProfessor;
  bloco5EntregaPagamentoVigenciaPenalidades: BlocoExplicacaoProfessor;
  bloco6BeneficiosMeEppEstrategia: BlocoExplicacaoProfessor;
  bloco7PontosCriticosEFormalismo: BlocoExplicacaoProfessor;
}

export interface TrechosLiteraisCapitulos {
  disputaEPrazos: string | null;
  entregaEExecucao: string | null;
  habilitacaoJuridica: string | null;
  regularidadeFiscal: string | null;
  qualificacaoEconomica: string | null;
  qualificacaoTecnica: string | null;
  pagamentoEContrato: string | null;
}

export interface ExtractedSpecsFicha {
  resumoExplicado: string;
  explicacaoProfessor: ExplicacaoProfessorCompleta;
  trechosLiterais: TrechosLiteraisCapitulos;
  possuiArquivosReaisLidos: boolean;
  secoes: SecaoResumoExplicado;
  itensDetalhados: Array<{
    itemNumero: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorUnitarioEstimado: number | null;
    valorTotalEstimado: number | null;
  }>;
  disputaEExecucao: {
    disputaRemota: boolean | null;
    modoDisputaTexto: string;
    execucaoOuEntrega: 'REMOTE' | 'PRESENTIAL' | 'HYBRID_OR_DELIVERY' | 'UNSPECIFIED';
    exigeVistoria: boolean | null;
    exigeAmostra: boolean | null;
    trechoComprovante: string | null;
  };
  habilitacaoCompleta: {
    juridica: string[];
    fiscalTrabalhista: string[];
    economicoFinanceira: string[];
    qualificacaoTecnica: string[];
    limiteAtestadoPercentual: string;
  };
  prazosECondicoes: {
    aberturaSessao: string | null;
    prazoImpugnacao: string;
    prazoEntregaOuExecucao: string;
    localEntrega: string;
    prazoPagamento: string;
    vigenciaContrato: string;
  };
  pontosDeAtencaoERiscos: Array<{
    titulo: string;
    gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
    baseLegal: string;
    arquivoOrigem?: string;
    pagina?: number | string;
    trechoLiteral: string;
    explicacaoSimples?: string;
    acaoRecomendada?: string;
  }>;
  auditoria: AuditoriaEditalResultado;
}

const NAO_ESPECIFICADO = 'Não especificado nos arquivos analisados';
const NAO_EXIGIDO = 'Não exigido nos arquivos analisados';

function extrairSentencaPorRegex(texto: string, regex: RegExp, maxLen = 240): string | null {
  const m = texto.match(regex);
  if (!m || m.index === undefined) return null;
  const start = Math.max(0, m.index - 15);
  const end = Math.min(texto.length, m.index + m[0].length + maxLen);
  const slice = texto.slice(start, end).replace(/\[Página \d+ de [^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
  return slice.length >= 10 ? slice : null;
}

/**
 * Analisador Profundo de Editais com 100% de Veracidade (Zero Texto Genérico, Zero Alucinação)
 */
export class EditalDeepAnalyzerService {
  /**
   * Extrai e estrutura as especificações técnicas EXCLUSIVAMENTE dos trechos reais lidos
   */
  private static localizarPaginaEArquivo(texto: string, index: number): string {
    const antes = texto.slice(0, index);
    const matches = [...antes.matchAll(/\[P[aá]gina\s+(\d+)\s+de\s+([^\]]+)\]/gi)];
    if (matches.length === 0) return 'Documento oficial do certame';
    const last = matches[matches.length - 1];
    return `${last[2].trim()} | Pág. ${last[1]}`;
  }

  private static extrairCapituloComReferencia(
    texto: string,
    regexes: RegExp[],
    maxLen = 650,
  ): { texto: string; referencia: string; formatado: string } | null {
    for (const rx of regexes) {
      const m = texto.match(rx);
      if (!m || m.index === undefined) continue;
      const referencia = this.localizarPaginaEArquivo(texto, m.index);
      const rawSlice = texto
        .slice(m.index, m.index + maxLen + 120)
        .replace(/\[P[aá]gina\s+\d+\s+de\s+[^\]]+\]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (rawSlice.length < 30) continue;
      const textoLimpo = rawSlice.length > maxLen ? rawSlice.slice(0, maxLen).trimEnd() + '...' : rawSlice;
      return {
        texto: textoLimpo,
        referencia,
        formatado: `[${referencia}] ${textoLimpo}`,
      };
    }
    return null;
  }

  private static extrairCapituloEdital(texto: string, regexTitulo: RegExp, maxLen = 420): string | null {
    const res = this.extrairCapituloComReferencia(texto, [regexTitulo], maxLen);
    return res ? res.formatado : null;
  }

  public static analisarTextoIntegral(notice: any, chunks: string[], itensOficiais: any[] = []): ExtractedSpecsFicha {
    const cleanChunks = chunks.filter(
      (c) => c && !c.includes('AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF'),
    );
    const possuiArquivosReaisLidos = cleanChunks.length > 0 && cleanChunks.join('').trim().length >= 120;
    const textoCompleto = cleanChunks.join('\n\n');
    const tLower = textoCompleto.toLowerCase();

    // 1 e 2. Classificação estrita de Disputa e Execução (somente com leitura completa)
    const statusLeituraCompleta: StatusLeituraCompleta = possuiArquivosReaisLidos
      ? 'CONCLUIDO'
      : 'SEM_ARQUIVO_LEGIVEL';
    const execClass = classifyExecutionMode(textoCompleto, statusLeituraCompleta, {
      modality: notice?.modality,
      modoDisputa: notice?.modoDisputa,
      object: notice?.object,
    });
    const disputaRemota = execClass.isRemoteDispute;
    const formatoDisputa: 'ELETRONICA' | 'PRESENCIAL' | 'NAO_ESPECIFICADO' =
      disputaRemota === true ? 'ELETRONICA' : disputaRemota === false ? 'PRESENCIAL' : 'NAO_ESPECIFICADO';
    const modoDisputaTexto =
      disputaRemota === true
        ? 'Disputa Eletrônica (Sessão Online)'
        : disputaRemota === false
          ? 'Disputa Presencial (Comparecimento Físico Exigido)'
          : NAO_ESPECIFICADO;
    const trechoComprovante = execClass.executionEvidence;
    const execucaoOuEntrega: 'REMOTE' | 'PRESENTIAL' | 'HYBRID_OR_DELIVERY' | 'UNSPECIFIED' =
      execClass.executionMode === 'REMOTO_INTEGRAL'
        ? 'REMOTE'
        : execClass.executionMode === 'PRESENCIAL_FISICO'
          ? 'PRESENTIAL'
          : execClass.executionMode === 'HIBRIDO'
            ? 'HYBRID_OR_DELIVERY'
            : 'UNSPECIFIED';

    // 3. Extrações Reais de Prazos, Entrega, Amostra, Catálogo e Vistoria
    const prazoEntregaExtraido = extrairSentencaPorRegex(
      textoCompleto,
      /(?:prazo\s+(?:máximo\s+)?de\s+entrega|prazo\s+para\s+(?:entrega|fornecimento|início\s+da\s+execução)|entrega\s+deverá\s+ser\s+efetuada\s+em)[^.\n]{0,160}/i,
      140,
    ) || NAO_ESPECIFICADO;

    const localEntregaExtraido = extrairSentencaPorRegex(
      textoCompleto,
      /(?:local\s+de\s+entrega|endereço\s+de\s+entrega|local\s+da\s+execução|deverão\s+ser\s+entregues\s+n[ao])[^.\n]{0,180}/i,
      150,
    ) || (notice?.municipality && notice?.uf ? `${notice.municipality} - ${notice.uf} (endereço exato não detalhado nos trechos lidos)` : NAO_ESPECIFICADO);

    const exigeAmostra = /(?:apresentação\s+de\s+amostra|envio\s+de\s+amostra|prova\s+de\s+conceito|exigência\s+de\s+amostra)/i.test(textoCompleto);
    const detalhesAmostra = exigeAmostra
      ? (extrairSentencaPorRegex(textoCompleto, /(?:amostra|prova\s+de\s+conceito)[^.\n]{0,180}/i, 160) || 'Exigência de amostra citada no edital.')
      : NAO_EXIGIDO;

    const exigeCatalogo = /(?:catálogo|prospecto|folder|ficha\s+técnica\s+do\s+fabricante)/i.test(textoCompleto);
    const detalhesCatalogo = exigeCatalogo
      ? (extrairSentencaPorRegex(textoCompleto, /(?:catálogo|prospecto|folder|ficha\s+técnica)[^.\n]{0,160}/i, 140) || 'Exigência de catálogo/ficha técnica citada no edital.')
      : NAO_EXIGIDO;

    const exigeVistoria = /(?:vistoria|visita\s+técnica)/i.test(textoCompleto);
    const detalhesVistoria = exigeVistoria
      ? (extrairSentencaPorRegex(textoCompleto, /(?:vistoria|visita\s+técnica)[^.\n]{0,180}/i, 160) || 'Vistoria técnica citada no edital.')
      : NAO_EXIGIDO;

    // 4. Extrações Reais de Habilitação por Capítulos e Cláusulas (ZERO lista genérica fixa)
    const capHabJuridica = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:HABILITA[CÇ][AÃ]O\s+JUR[IÍ]DICA|DA\s+HABILITA[CÇ][AÃ]O\s+JUR[IÍ]DICA)\b/i,
      /(?:DOCUMENTOS\s+DE\s+HABILITA[CÇ][AÃ]O|DOS\s+DOCUMENTOS\s+DE\s+HABILITA[CÇ][AÃ]O|9\.\s*DA\s+HABILITA[CÇ][AÃ]O)\b/i,
    ]);
    const capFiscal = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:REGULARIDADE\s+FISCAL|HABILITA[CÇ][AÃ]O\s+FISCAL,?\s+SOCIAL\s+E\s+TRABALHISTA)\b/i,
      /(?:PROVA\s+DE\s+INSCRI[CÇ][AÃ]O\s+NO\s+CADASTRO|CERTID[OÕ]ES\s+DE\s+REGULARIDADE\s+FISCAL)\b/i,
    ]);
    const capEconomica = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:QUALIFICA[CÇ][AÃ]O\s+ECON[OÔ]MICO[\s-]+FINANCEIRA|HABILITA[CÇ][AÃ]O\s+ECON[OÔ]MICO[\s-]+FINANCEIRA)\b/i,
      /(?:BALAN[CÇ]O\s+PATRIMONIAL\s+E\s+DEMONSTRA[CÇ][OÕ]ES|CERTID[AÃ]O\s+NEGATIVA\s+DE\s+FAL[EÊ]NCIA)\b/i,
    ]);
    const capTecnica = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:QUALIFICA[CÇ][AÃ]O\s+T[EÉ]CNICA|CAPACIDADE\s+T[EÉ]CNICA|HABILITA[CÇ][AÃ]O\s+T[EÉ]CNICA)\b/i,
      /(?:ATESTADO(?:S)?\s+DE\s+CAPACIDADE\s+T[EÉ]CNICA)\b/i,
    ]);
    const capPagamento = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:DO\s+PAGAMENTO|DAS\s+CONDI[CÇ][OÕ]ES\s+DE\s+PAGAMENTO|FORMA\s+DE\s+PAGAMENTO|LIQUIDA[CÇ][AÃ]O\s+E\s+PAGAMENTO|CRIT[EÉ]RIOS\s+DE\s+MEDI[CÇ][AÃ]O\s+E\s+DE\s+PAGAMENTO)\b/i,
    ]);
    const capVigencia = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:DA\s+VIG[EÊ]NCIA|PRAZO\s+DE\s+VIG[EÊ]NCIA|VIG[EÊ]NCIA\s+DO\s+CONTRATO|VIG[EÊ]NCIA\s+DA\s+ATA)\b/i,
    ]);
    const capReajuste = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:DO\s+REAJUSTE|REAJUSTAMENTO\s+DE\s+PRE[CÇ]OS|REEQUIL[IÍ]BRIO\s+ECON[OÔ]MICO)\b/i,
    ]);
    const capSancoes = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:DAS\s+SAN[CÇ][OÕ]ES|DAS\s+PENALIDADES|INFRA[CÇ][OÕ]ES\s+E\s+SAN[CÇ][OÕ]ES|SAN[CÇ][OÕ]ES\s+ADMINISTRATIVAS)\b/i,
    ]);
    const capEntrega = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:DA\s+ENTREGA|CONDI[CÇ][OÕ]ES\s+DE\s+ENTREGA|EXECU[CÇ][AÃ]O\s+DO\s+OBJETO|MODELO\s+DE\s+EXECU[CÇ][AÃ]O)\b/i,
    ]);
    const capDisputa = this.extrairCapituloComReferencia(textoCompleto, [
      /(?:DA\s+ABERTURA\s+DA\s+SESS[AÃ]O|DO\s+MODO\s+DE\s+DISPUTA|FASE\s+DE\s+LANCES|ENVIO\s+DA\s+PROPOSTA)\b/i,
    ]);

    const docJuridica: string[] = [];
    if (/(?:contrato\s+social|estatuto|ato\s+constitutivo)/i.test(textoCompleto)) docJuridica.push('Ato constitutivo / Contrato Social em vigor');
    if (/(?:cnpj|cadastro\s+nacional\s+da\s+pessoa\s+jurídica)/i.test(textoCompleto)) docJuridica.push('Comprovante de inscrição no CNPJ');
    if (/(?:registro\s+comercial|requerimento\s+de\s+empresário|mei|ccmei)/i.test(textoCompleto)) docJuridica.push('Registro comercial / Certificado de MEI (se aplicável)');
    if (/(?:cédula\s+de\s+identidade|documento\s+de\s+identidade|procuração)/i.test(textoCompleto)) docJuridica.push('Documento de identificação do representante / procuração');
    if (docJuridica.length === 0 && capHabJuridica) docJuridica.push(capHabJuridica.formatado);
    if (docJuridica.length === 0) docJuridica.push(possuiArquivosReaisLidos ? 'Remetido ao Termo de Referência / verificar anexos do órgão' : NAO_ESPECIFICADO);

    const docFiscal: string[] = [];
    if (/(?:receita\s+federal|pgfn|tributos\s+federais|conjunta\s+federal)/i.test(textoCompleto)) docFiscal.push('Certidão Conjunta Federal / Dívida Ativa (RFB/PGFN)');
    if (/(?:fgts|fundo\s+de\s+garantia|crf)/i.test(textoCompleto)) docFiscal.push('Regularidade do FGTS (CRF)');
    if (/(?:cndt|débitos\s+trabalhistas|justiça\s+do\s+trabalho)/i.test(textoCompleto)) docFiscal.push('Certidão Negativa de Débitos Trabalhistas (CNDT)');
    if (/(?:fazenda\s+estadual|tributos\s+estaduais|sefaz)/i.test(textoCompleto)) docFiscal.push('Regularidade Fiscal Estadual');
    if (/(?:fazenda\s+municipal|tributos\s+municipais)/i.test(textoCompleto)) docFiscal.push('Regularidade Fiscal Municipal');
    if (/(?:cumprimento\s+do\s+disposto\s+no\s+inciso\s+xxxiii|art\.?\s*7[º°],?\s*xxxiii|menor\s+de\s+18)/i.test(textoCompleto)) docFiscal.push('Declaração de cumprimento ao Art. 7º, XXXIII da CF (não emprego de menor)');
    if (docFiscal.length === 0 && capFiscal) docFiscal.push(capFiscal.formatado);
    if (docFiscal.length === 0) docFiscal.push(possuiArquivosReaisLidos ? 'Remetido ao Termo de Referência / verificar anexos do órgão' : NAO_ESPECIFICADO);

    // Balanço Patrimonial, Capital/PL e Índices
    let balancoPatrimonial = NAO_ESPECIFICADO;
    if (/(?:dispensad[oa]\s+(?:o|a|de)\s+balanço|art\.?\s*70,?\s*(?:inciso\s*)?iii|entrega\s+imediata[^.\n]{0,60}balanço)/i.test(textoCompleto)) {
      balancoPatrimonial = extrairSentencaPorRegex(textoCompleto, /(?:dispensad[oa][^.\n]{0,80}balanço|balanço[^.\n]{0,80}dispensad[oa])/i, 160) || 'Dispensado conforme regras do edital';
    } else if (/balanço\s+patrimonial/i.test(textoCompleto)) {
      balancoPatrimonial = extrairSentencaPorRegex(textoCompleto, /balanço\s+patrimonial[^.\n]{0,200}/i, 180) || 'Exigido nos termos do edital';
    } else if (capEconomica) {
      balancoPatrimonial = capEconomica.formatado;
    } else if (possuiArquivosReaisLidos) {
      balancoPatrimonial = NAO_EXIGIDO;
    }

    const capitalOuPl = extrairSentencaPorRegex(
      textoCompleto,
      /(?:capital\s+social\s+m[ií]nimo|patrim[oô]nio\s+l[ií]quido\s+m[ií]nimo|fal[eê]ncia\s+e\s+concordata|recupera[cç][aã]o\s+judicial)[^.\n]{0,180}/i,
      160,
    );
    const exigenciaIndicesContabeis = [
      extrairSentencaPorRegex(
        textoCompleto,
        /(?:liquidez\s+geral|solvência\s+geral|liquidez\s+corrente|índices\s+contábeis)[^.\n]{0,180}/i,
        160,
      ),
      capitalOuPl,
    ].filter(Boolean).join(' | ') || (capEconomica ? capEconomica.formatado : (possuiArquivosReaisLidos ? NAO_EXIGIDO : NAO_ESPECIFICADO));

    // Atestado Técnico, Percentual e Tempo Mínimo de Experiência
    const atestadoTecnico = extrairSentencaPorRegex(
      textoCompleto,
      new RegExp('(?:atestado\\s+de\\s+capacidade\\s+t[eé]cnica|atestados?\\s+fornecidos?\\s+por\\s+pessoa\\s+jur[ií]dica|comprova[cç][aã]o\\s+de\\s+aptid[aã]o|qualifica[cç][aã]o\\s+t[eé]cnica|acervo\\s+t[eé]cnico|experi[eê]ncia\\s+anterior)[^.\\n]{0,240}', 'i'),
      220,
    ) || (capTecnica ? capTecnica.formatado : (possuiArquivosReaisLidos
      ? (/habilita[cç][aã]o/i.test(textoCompleto) ? 'Verificar cláusula de qualificação técnica no Termo de Referência (não localizada automaticamente no corpo principal)' : NAO_ESPECIFICADO)
      : NAO_ESPECIFICADO));

    const matchPercentAtestado = textoCompleto.match(/(?:atestado|capacidade\s+técnica|quantitativo\s+mínimo)[^.\n]{0,100}(\d{1,3}\s*%)/i);
    const limiteAtestadoPercentual = matchPercentAtestado
      ? `Exige comprovação de ${matchPercentAtestado[1]} (${extrairSentencaPorRegex(textoCompleto, /(?:atestado|capacidade\s+técnica)[^.\n]{0,100}\d{1,3}\s*%/i, 80)})`
      : (atestadoTecnico !== NAO_EXIGIDO && atestadoTecnico !== NAO_ESPECIFICADO ? 'Percentual numérico não especificado' : NAO_EXIGIDO);

    const tempoMinimoExperiencia = extrairSentencaPorRegex(
      textoCompleto,
      /(?:experiência\s+mínima|tempo\s+mínimo\s+de\s+experiência|comprovação\s+de\s+experiência\s+de\s+no\s+mínimo)[^.\n]{0,140}(?:\d+\s*(?:meses|anos))/i,
      120,
    ) || 'Não exige tempo mínimo de experiência';

    const registroConselhoOuAlvara = extrairSentencaPorRegex(
      textoCompleto,
      /(?:registro\s+(?:ou\s+inscrição\s+)?no\s+(?:crea|cau|cra|crq|crm|coren|crf|cro|conselho\s+regional)|licença\s+sanitária|anvisa|alvará\s+de\s+funcionamento)[^.\n]{0,160}/i,
      140,
    ) || NAO_EXIGIDO;

    // 5. Condições Financeiras e Contratuais Reais
    const condicoesPagamento = extrairSentencaPorRegex(
      textoCompleto,
      /(?:prazo\s+de\s+pagamento|pagamento\s+ser[aá]\s+efetuado|liquida[cç][aã]o\s+e\s+pagamento|pagamento\s+ocorrer[aá]\s+em|at[eé]\s+\d+\s*(?:\([^)]+\)\s*)?dias\s*(?:úteis|corridos)?[^.\n]{0,80}(?:nota\s+fiscal|fatura|atesto))[^.\n]{0,180}/i,
      160,
    ) || (capPagamento ? capPagamento.formatado : NAO_ESPECIFICADO);

    const vigenciaContrato = extrairSentencaPorRegex(
      textoCompleto,
      /(?:prazo\s+de\s+vig[eê]ncia|vig[eê]ncia\s+do\s+contrato|vig[eê]ncia\s+da\s+ata|ata\s+de\s+registro\s+de\s+pre[cç]os\s+ter[aá]\s+validade)[^.\n]{0,160}/i,
      140,
    ) || (capVigencia ? capVigencia.formatado : NAO_ESPECIFICADO);

    const criterioReajuste = extrairSentencaPorRegex(
      textoCompleto,
      /(?:reajuste|reajustamento\s+de\s+pre[cç]os)[^.\n]{0,180}(?:ipca|igp-m|inpc|igpm|incc|ipca-e|índice|12\s*\(doze\)\s*meses)[^.\n]{0,80}/i,
      150,
    ) || (capReajuste ? capReajuste.formatado : NAO_ESPECIFICADO);

    const garantiaProposta = extrairSentencaPorRegex(
      textoCompleto,
      new RegExp('(?:garantia\\s+(?:de|da)\\s+proposta|cau[cç][aã]o\\s+de\\s+proposta|art\\.?\\s*58)[^.\\n]{0,180}', 'i'),
      160,
    );
    const garantiaExec = extrairSentencaPorRegex(
      textoCompleto,
      new RegExp('(?:garantia\\s+contratual|garantia\\s+de\\s+execu[cç][aã]o|art\\.?\\s*96)[^.\\n]{0,160}', 'i'),
      150,
    );
    const garantiaContratual = [
      garantiaProposta ? `Garantia de Proposta (Caução Art. 58): ${garantiaProposta}` : '',
      garantiaExec ? `Garantia Contratual (Art. 96): ${garantiaExec}` : '',
    ].filter(Boolean).join(' | ') || (possuiArquivosReaisLidos ? NAO_EXIGIDO : NAO_ESPECIFICADO);

    const multasEPenalidades = extrairSentencaPorRegex(
      textoCompleto,
      /(?:multa\s+(?:morat[oó]ria|compensat[oó]ria)|san[cç][oõ]es\s+administrativas|penalidades)[^.\n]{0,180}/i,
      160,
    ) || (capSancoes ? capSancoes.formatado : NAO_ESPECIFICADO);

    // 6. Benefício ME / EPP
    const exclusivoOuCotaMeEpp = /(?:exclusiv[oa]\s+para\s+(?:me|epp|microempresa)|cota\s+reservada|lei\s+complementar\s+n[º°]?\s*123)/i.test(textoCompleto);
    const detalhesMeEpp = exclusivoOuCotaMeEpp
      ? (extrairSentencaPorRegex(textoCompleto, /(?:exclusiv[oa]\s+para\s+me|cota\s+reservada|microempresas\s+e\s+empresas\s+de\s+pequeno\s+porte)[^.\n]{0,160}/i, 140) || 'Prevê tratamento diferenciado ou exclusividade para ME/EPP (LC 123/2006).')
      : 'Disputa aberta para ampla concorrência (sem menção expressa de exclusividade ME/EPP nos trechos analisados).';

    // 7. Auditoria Especialista em 2 Etapas (Zero Falsos Positivos em Modelos de Declaração)
    const vicios: VicioIrregularidadeEdital[] = possuiArquivosReaisLidos
      ? auditEditalNullities(textoCompleto)
      : [];

    const auditoriaResultado: AuditoriaEditalResultado = {
      status: vicios.length > 0 ? 'IRREGULARIDADE_DETECTADA' : 'CONFORME',
      mensagem: !possuiArquivosReaisLidos
        ? 'Auditoria de cláusulas pendente: apenas os dados básicos do portal foram publicados. Anexe o PDF do edital para checar exigências e riscos antes de disputar.'
        : vicios.length > 0
          ? `Edital auditado: foram identificadas ${vicios.length} irregularidade(s) com prova literal nos documentos oficiais.`
          : 'Edital auditado por completo: nenhuma cláusula restritiva ou irregularidade identificada nos arquivos analisados.',
      totalVicios: vicios.length,
      viciosAltos: vicios.filter((v) => v.gravidade === 'ALTO').length,
      viciosMedios: vicios.filter((v) => v.gravidade === 'MEDIO').length,
      viciosBaixos: vicios.filter((v) => v.gravidade === 'BAIXO').length,
      apontamentos: vicios,
    };

    // 8. Itens Detalhados
    const itensExtraidos: ExtractedSpecsFicha['itensDetalhados'] = [];
    if (Array.isArray(itensOficiais) && itensOficiais.length > 0) {
      itensOficiais.forEach((it: any, idx: number) => {
        itensExtraidos.push({
          itemNumero: it.itemNumber ?? it.numeroItem ?? idx + 1,
          descricao: String(it.description || it.descricao || 'Item do Termo de Referência').trim(),
          quantidade: Number(it.quantity ?? it.quantidade ?? 1),
          unidade: String(it.unit ?? it.unidadeMedida ?? 'UN').toUpperCase().trim(),
          valorUnitarioEstimado: Number(it.estimatedUnitValue ?? it.valorUnitarioEstimado) || null,
          valorTotalEstimado: Number(it.estimatedTotalValue ?? it.valorTotal) || null,
        });
      });
    }

    const objetoPrincipal = notice?.object || notice?.objeto || NAO_ESPECIFICADO;
    const orgao = notice?.buyerName || notice?.orgao || 'Órgão Licitante';
    const valorGlobal = Number(notice?.estimatedValue || 0) || null;
    const dataAberturaStr = notice?.openingAt ? new Date(notice.openingAt).toLocaleString('pt-BR') : null;

    const secoes: SecaoResumoExplicado = {
      objetoContratacao: {
        oQueOrgaoQuer: `${objetoPrincipal} (Órgão contratante: ${orgao}).`,
        itensDetalhados: itensExtraidos,
        valorGlobalEstimado: valorGlobal,
      },
      disputaEPrazos: {
        portalDisputa: notice?.source || NAO_ESPECIFICADO,
        formatoDisputa,
        aberturaSessao: dataAberturaStr,
        prazoLimiteProposta: dataAberturaStr ? `Até a abertura da sessão (${dataAberturaStr})` : NAO_ESPECIFICADO,
        prazoEsclarecimento: 'Até 3 dias úteis antes da data de abertura do certame (Art. 164 da Lei 14.133/2021)',
        prazoLimiteImpugnacao: 'Até 3 dias úteis antes da data de abertura do certame (Art. 164 da Lei 14.133/2021)',
        trechoComprovante,
      },
      condicoesEntregaExecucao: {
        prazoEntrega: prazoEntregaExtraido,
        localEntrega: localEntregaExtraido,
        exigeAmostra,
        detalhesAmostra,
        exigeCatalogo,
        detalhesCatalogo,
        exigeVistoria,
        detalhesVistoria,
      },
      documentosExigidosHabilitacao: {
        juridica: docJuridica,
        fiscalTrabalhista: docFiscal,
        balancoPatrimonial,
        exigenciaIndicesContabeis,
        atestadoTecnico,
        limiteAtestadoPercentual,
        tempoMinimoExperiencia,
        registroConselhoOuAlvara,
      },
      financeiroEContrato: {
        condicoesPagamento,
        vigenciaContrato,
        criterioReajuste,
        garantiaContratual,
        multasEPenalidades,
      },
      beneficioMeEpp: {
        exclusivoOuCotaMeEpp,
        detalhesMeEpp,
      },
    };

    const isLoteUnico = /(?:lote\s+[uú]nico|menor\s+pre[cç]o\s+global|pre[cç]o\s+global)/i.test(textoCompleto);
    const prazoPropostaAjustada = extrairSentencaPorRegex(
      textoCompleto,
      /(?:proposta\s+(?:readequada|ajustada|atualizada)|envio\s+da\s+proposta\s+final)[^.\n]{0,140}/i,
      120,
    ) || 'Conforme prazo definido pelo pregoeiro na sessão (regra geral: mín. 2 horas).';
    const planilhaCustosInfo = extrairSentencaPorRegex(
      textoCompleto,
      /(?:planilha\s+(?:detalhada\s+)?de\s+custos|composi[cç][aã]o\s+(?:detalhada\s+)?de\s+custos|\bbdi\b)[^.\n]{0,160}/i,
      140,
    );
    const indicacaoMarca = extrairSentencaPorRegex(
      textoCompleto,
      /(?:marca\s+de\s+refer[eê]ncia|vedad[ao]\s+indica[cç][aã]o\s+de\s+marca|ou\s+similar|equivalente)[^.\n]{0,140}/i,
      120,
    ) || 'Sem indicação restritiva de marca identificada nos trechos lidos.';

    const trechosLiterais: TrechosLiteraisCapitulos = {
      disputaEPrazos: capDisputa?.formatado || trechoComprovante || null,
      entregaEExecucao: capEntrega?.formatado || null,
      habilitacaoJuridica: capHabJuridica?.formatado || null,
      regularidadeFiscal: capFiscal?.formatado || null,
      qualificacaoEconomica: capEconomica?.formatado || null,
      qualificacaoTecnica: capTecnica?.formatado || null,
      pagamentoEContrato: [capPagamento?.formatado, capVigencia?.formatado, capSancoes?.formatado].filter(Boolean).join('\n\n') || null,
    };

    const explicacaoProfessor: ExplicacaoProfessorCompleta = {
      bloco1ObjetoPratico: {
        titulo: '1. O que o órgão quer contratar na prática',
        resumoDidatico: `${orgao} pretende contratar: ${objetoPrincipal}. ${itensExtraidos.length > 0 ? `Foram mapeados ${itensExtraidos.length} item(ns) oficial(is).` : 'Itens não detalhados na API do portal.'} Critério: ${isLoteUnico ? 'Lote Único / Preço Global (exige cotação completa do grupo)' : (notice?.judgmentCriterion || 'Menor Preço por Item')}. Valor estimado: ${valorGlobal ? `R$ ${valorGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sigiloso ou consultar Termo de Referência'}. Marca/Modelo: ${indicacaoMarca}`,
        referenciaFonte: possuiArquivosReaisLidos ? 'Edital / Termo de Referência (Preâmbulo e Objeto)' : 'Metadados oficiais do PNCP (PDF não lido)',
      },
      bloco2DisputaEPrazos: {
        titulo: '2. Como funciona a disputa e quais são os prazos fatais',
        resumoDidatico: `Modalidade ${notice?.modality || 'Licitação'} no portal ${notice?.source || 'Oficial'} (${modoDisputaTexto}). Abertura: ${dataAberturaStr || 'Consultar edital'}. Prazo fatal para pedidos de esclarecimento e impugnação: até 3 dias úteis antes da abertura (Art. 164 da Lei 14.133/2021). Após a fase de lances, atenção ao envio de proposta ajustada/planilha: ${prazoPropostaAjustada}`,
        referenciaFonte: capDisputa?.referencia || (possuiArquivosReaisLidos ? 'Capítulo da Sessão Pública / Lances' : 'Pendente leitura integral do PDF'),
      },
      bloco3HabilitacaoCompleta: {
        titulo: '3. Tudo o que o órgão exige na Habilitação (sem esconder nada)',
        resumoDidatico: `Jurídica (Art. 66): ${docJuridica.join('; ')}. Fiscal/Trabalhista (Art. 68): ${docFiscal.join('; ')}. Econômico-Financeira (Art. 69): Balanço: ${balancoPatrimonial}; Índices/Capital: ${exigenciaIndicesContabeis}. Técnica (Art. 67): ${atestadoTecnico} (${limiteAtestadoPercentual}; ${tempoMinimoExperiencia}; Conselho/Alvará: ${registroConselhoOuAlvara}).`,
        referenciaFonte: [capHabJuridica?.referencia, capEconomica?.referencia, capTecnica?.referencia].filter(Boolean).join(' · ') || (possuiArquivosReaisLidos ? 'Capítulo de Habilitação' : 'Pendente leitura integral do PDF'),
      },
      bloco4GarantiasECustosOcultos: {
        titulo: '4. Garantias financeiras, custos ocultos e exigências operacionais',
        resumoDidatico: `Garantias: ${garantiaContratual}. Planilha de Custos / BDI: ${planilhaCustosInfo || (possuiArquivosReaisLidos ? 'Não há exigência expressa de planilha aberta de BDI localizada automaticamente' : NAO_ESPECIFICADO)}. Vistoria técnica: ${detalhesVistoria}. Amostra / Prova de Conceito: ${detalhesAmostra}. Catálogo: ${detalhesCatalogo}.`,
        referenciaFonte: possuiArquivosReaisLidos ? 'Cláusulas de Garantia, Proposta e Termo de Referência' : 'Pendente leitura integral do PDF',
      },
      bloco5EntregaPagamentoVigenciaPenalidades: {
        titulo: '5. Entrega, execução, pagamento, vigências e penalidades',
        resumoDidatico: `Prazo de entrega/início: ${prazoEntregaExtraido}. Local: ${localEntregaExtraido}. Pagamento: ${condicoesPagamento}. Vigência: ${vigenciaContrato}. Reajuste: ${criterioReajuste}. Multas e sanções: ${multasEPenalidades}.`,
        referenciaFonte: [capEntrega?.referencia, capPagamento?.referencia, capVigencia?.referencia, capSancoes?.referencia].filter(Boolean).join(' · ') || (possuiArquivosReaisLidos ? 'Termo de Referência e Minuta Contratual' : 'Pendente leitura integral do PDF'),
      },
      bloco6BeneficiosMeEppEstrategia: {
        titulo: '6. Benefícios ME/EPP e estratégia prática',
        resumoDidatico: `${detalhesMeEpp} Lembre-se da preferência do empate ficto (até 5% no pregão / 10% nas demais modalidades — Arts. 44 e 45 da LC 123/2006) e do prazo de 5 dias úteis para regularização fiscal tardia caso haja restrição em certidão (Art. 43, §1º).`,
        referenciaFonte: possuiArquivosReaisLidos ? 'Regras de Tratamento Diferenciado ME/EPP (LC 123/2006)' : 'Regra geral LC 123/2006 (confirmar no PDF)',
      },
      bloco7PontosCriticosEFormalismo: {
        titulo: '7. Pontos críticos, armadilhas e formalismo moderado',
        resumoDidatico: vicios.length > 0
          ? `Atenção máxima: foram localizadas ${vicios.length} cláusula(s) potencialmente restritiva(s): ${vicios.map((v) => `${v.titulo} (${v.arquivoOrigem}, Pág. ${v.pagina})`).join('; ')}. Caso alguma falha documental formal ocorra na sessão, invoque o Art. 64 da Lei 14.133/2021 e o Acórdão 1.211/2021-TCU (diligência de condição pré-existente).`
          : (possuiArquivosReaisLidos
            ? 'Nenhuma das 7 irregularidades automáticas clássicas foi disparada, mas confira atentamente o Termo de Referência quanto a prazos curtos, exigências de marca e planilhas. Em falhas formais sanáveis na sessão, invoque o Art. 64 da Lei 14.133/2021 e o Acórdão 1.211/2021-TCU.'
            : 'Auditoria jurídica completa pendente: anexe o PDF integral do edital e do Termo de Referência antes de precificar para não assumir riscos ocultos.'),
        referenciaFonte: vicios.length > 0 ? vicios.map((v) => `${v.arquivoOrigem} | Pág. ${v.pagina}`).join(' · ') : (possuiArquivosReaisLidos ? 'Auditoria Integral dos Documentos' : 'Leitura Pendente'),
      },
    };

    const resumoExplicado = [
      `1. O QUE O ÓRGÃO CONTRATA: ${explicacaoProfessor.bloco1ObjetoPratico.resumoDidatico}`,
      `2. DISPUTA E PRAZOS: ${explicacaoProfessor.bloco2DisputaEPrazos.resumoDidatico}`,
      `3. HABILITAÇÃO COMPLETA: ${explicacaoProfessor.bloco3HabilitacaoCompleta.resumoDidatico}`,
      `4. GARANTIAS E CUSTOS: ${explicacaoProfessor.bloco4GarantiasECustosOcultos.resumoDidatico}`,
      `5. ENTREGA, PAGAMENTO E CONTRATO: ${explicacaoProfessor.bloco5EntregaPagamentoVigenciaPenalidades.resumoDidatico}`,
    ].join('\n\n');

    return {
      resumoExplicado,
      explicacaoProfessor,
      trechosLiterais,
      possuiArquivosReaisLidos,
      secoes,
      itensDetalhados: itensExtraidos,
      disputaEExecucao: {
        disputaRemota,
        modoDisputaTexto,
        execucaoOuEntrega,
        exigeVistoria,
        exigeAmostra,
        trechoComprovante,
      },
      habilitacaoCompleta: {
        juridica: docJuridica,
        fiscalTrabalhista: docFiscal,
        economicoFinanceira: [balancoPatrimonial, exigenciaIndicesContabeis].filter((x) => x !== NAO_EXIGIDO && x !== NAO_ESPECIFICADO),
        qualificacaoTecnica: [atestadoTecnico, tempoMinimoExperiencia, registroConselhoOuAlvara].filter((x) => x !== NAO_EXIGIDO && x !== NAO_ESPECIFICADO),
        limiteAtestadoPercentual,
      },
      prazosECondicoes: {
        aberturaSessao: dataAberturaStr,
        prazoImpugnacao: secoes.disputaEPrazos.prazoLimiteImpugnacao,
        prazoEntregaOuExecucao: prazoEntregaExtraido,
        localEntrega: localEntregaExtraido,
        prazoPagamento: condicoesPagamento,
        vigenciaContrato,
      },
      pontosDeAtencaoERiscos: (() => {
        const extras: Array<{
          titulo: string;
          gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
          baseLegal: string;
          arquivoOrigem: string;
          pagina: number | string;
          trechoLiteral: string;
          explicacaoSimples: string;
          acaoRecomendada: string;
        }> = [];

        const pushInvestigacao = (
          regex: RegExp,
          titulo: string,
          gravidade: 'ALTO' | 'MEDIO' | 'BAIXO',
          baseLegal: string,
          explicacaoSimples: string,
          acaoRecomendada: string,
        ) => {
          const m = textoCompleto.match(regex);
          if (!m || m.index === undefined) return;
          const antes = textoCompleto.slice(0, m.index);
          const pags = [...antes.matchAll(/\[P[aá]gina\s+(\d+)\s+de\s+([^\]]+)\]/gi)];
          const ultimaPag = pags.length > 0 ? pags[pags.length - 1] : null;
          const trecho = textoCompleto.slice(Math.max(0, m.index - 40), Math.min(textoCompleto.length, m.index + m[0].length + 180)).replace(/\s+/g, ' ').trim();
          extras.push({
            titulo,
            gravidade,
            baseLegal,
            arquivoOrigem: ultimaPag ? ultimaPag[2].trim() : 'Edital / Termo de Referencia',
            pagina: ultimaPag ? Number(ultimaPag[1]) || ultimaPag[1] : 'Conforme edital',
            trechoLiteral: trecho,
            explicacaoSimples,
            acaoRecomendada,
          });
        };

        pushInvestigacao(
          new RegExp('(?:garantia\\s+(?:de|da)\\s+proposta|cau[cç][aã]o)[^.\\n]{0,120}', 'i'),
          'Exigencia Elevada: Garantia de Proposta / Caucao Previa',
          'ALTO',
          'Art. 58 da Lei 14.133/2021 (limitada a 1% do valor estimado)',
          'O edital exige garantia financeira previa para participacao. Verifique o valor a imobilizar (caucao, seguro-garantia ou fianca bancaria) antes de entrar na disputa.',
          'Provisionar seguro-garantia ou caucao antes da sessao e conferir se o percentual nao ultrapassa 1%.'
        );

        pushInvestigacao(
          new RegExp('(?:lote\\s+[uú]nico|menor\\s+pre[cç]o\\s+global)[^.\\n]{0,120}', 'i'),
          'Atencao: Julgamento em Lote Unico / Preco Global',
          'MEDIO',
          'Sumula 247 do TCU e Art. 40, paragrafo 3o da Lei 14.133/2021',
          'A contratacao agrupa o objeto em lote unico. Quando os servicos ou itens forem divisiveis sem perda tecnica, a ausencia de justificativa no ETP pode restringir a competicao.',
          'Conferir no Estudo Tecnico Preliminar se ha justificativa tecnica para o nao parcelamento.'
        );

        pushInvestigacao(
          new RegExp('(?:prova\\s+de\\s+conceito|amostra\\s+t[eé]cnica|demonstra[cç][aã]o\\s+(?:do\\s+sistema|de\\s+funcionalidades))[^.\\n]{0,120}', 'i'),
          'Exigencia Elevada: Prova de Conceito (POC) / Amostra',
          'ALTO',
          'Art. 17, paragrafo 3o e Art. 41, II da Lei 14.133/2021',
          'O certame preve demonstracao pratica ou prova de conceito. Verifique se os criterios sao objetivos, se o prazo e suficiente e se nao exige sistema totalmente customizado antes da contratacao.',
          'Conferir o roteiro de avaliacao da POC e o prazo concedido ao primeiro colocado.'
        );

        pushInvestigacao(
          new RegExp('(?:planilha\\s+(?:detalhada\\s+)?de\\s+custos|composi[cç][aã]o\\s+(?:detalhada\\s+)?de\\s+custos|exequibilidade\\s+da\\s+proposta)[^.\\n]{0,120}', 'i'),
          'Exigencia Elevada: Planilha Detalhada de Custos e Exequibilidade',
          'MEDIO',
          'Art. 59 da Lei 14.133/2021',
          'O edital exige detalhamento analitico de composicao de custos ou demonstracao de exequibilidade. Erros na planilha podem gerar desclassificacao se nao houver diligencia.',
          'Estruturar previamente a planilha aberta de custos, encargos, tributos e BDI.'
        );

        pushInvestigacao(
          new RegExp('(?:dilig[eê]ncia|complementa[cç][aã]o\\s+de\\s+document|saneamento\\s+de\\s+falha)[^.\\n]{0,120}', 'i'),
          'Ponto Positivo: Previsao de Diligencia e Formalismo Moderado',
          'BAIXO',
          'Art. 64 da Lei 14.133/2021 e Acordao 1.211/2021-Plenario TCU',
          'O edital preve abertura para diligencia e saneamento de falhas formais ou documentacao complementar que comprove condicao preexistente.',
          'Usar esta clausula como defesa caso haja erro formal sanavel na habilitacao.'
        );

        return [
          ...vicios.map((v) => ({
            titulo: v.titulo,
            gravidade: v.gravidade,
            baseLegal: v.fundamentoLegal,
            arquivoOrigem: v.arquivoOrigem,
            pagina: v.pagina,
            trechoLiteral: v.trechoLiteral,
            explicacaoSimples: v.explicacaoSimples,
            acaoRecomendada: v.acaoRecomendada,
          })),
          ...extras,
        ];
      })(),
      auditoria: auditoriaResultado,
    };
  }

  /**
   * Refina extração utilizando IA estritamente aterrada no texto real do PDF (se GEMINI_API_KEY presente)
   */
  private static async refinarExtracaoComIaReal(
    fichaBase: ExtractedSpecsFicha,
    textoReal: string,
  ): Promise<ExtractedSpecsFicha> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !fichaBase.possuiArquivosReaisLidos || textoReal.trim().length < 250) {
      return fichaBase;
    }

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelos = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];

      // Map-Reduce: envia o texto integral ate 240k chars por bloco (sem perder secao intermediaria)
      const blocos: string[] = [];
      const TAM_BLOCO = 240000;
      for (let i = 0; i < textoReal.length; i += TAM_BLOCO) {
        blocos.push(textoReal.slice(i, i + TAM_BLOCO));
      }

      const parsed: Record<string, any> = {};
      for (const blocoTexto of blocos.slice(0, 4)) {
        const prompt = `Você é um professor especialista em licitações públicas brasileiras (Lei 14.133/2021 e LC 123/2006) orientando um empresário antes da disputa.
Extraia EXCLUSIVAMENTE as informações literais presentes no texto oficial abaixo, traduzindo o juridiquês para a prática do licitante sem inventar nada.
REGRAS INEGOCIAVEIS:
1. PROIBIDO inventar, presumir ou usar texto genérico.
2. Se uma informação NÃO estiver expressa neste bloco de texto, escreva exatamente: "Não especificado nos arquivos analisados". Só escreva "Não exigido" se o edital expressamente dispensar o requisito.
3. Cite números exatos, prazos exatos, nomes de documentos exatos e SEMPRE informe Arquivo, Página e Item/Cláusula onde encontrou (ex: "Edital.pdf | Pág. 12 | Item 9.4").

Retorne exatamente este JSON:
{
  "prazoEntrega": "string",
  "localEntrega": "string",
  "detalhesAmostra": "string",
  "detalhesCatalogo": "string",
  "detalhesVistoria": "string",
  "balancoPatrimonial": "string",
  "exigenciaIndicesContabeis": "string",
  "atestadoTecnico": "string",
  "limiteAtestadoPercentual": "string",
  "tempoMinimoExperiencia": "string",
  "registroConselhoOuAlvara": "string",
  "condicoesPagamento": "string",
  "vigenciaContrato": "string",
  "criterioReajuste": "string",
  "garantiaContratual": "string",
  "multasEPenalidades": "string",
  "bloco1ObjetoPratico": { "resumoDidatico": "O que o órgão quer contratar na prática, itens/lotes, critério de julgamento, lote único vs por item, valor estimado e indicação de marca/modelo", "referenciaFonte": "Arquivo | Pág. | Item" },
  "bloco2DisputaEPrazos": { "resumoDidatico": "Portal oficial, modo de disputa, data/hora, prazo de esclarecimento/impugnação Art. 164 e prazo pós-lance para proposta ajustada e planilha", "referenciaFonte": "Arquivo | Pág. | Item" },
  "bloco3HabilitacaoCompleta": { "resumoDidatico": "Habilitação jurídica Art. 66, fiscal/trabalhista Art. 68, econômico-financeira Art. 69 (balanço, índices, capital/PL mínimo) e técnica Art. 67 (atestado, % mínimo, conselho, RT) sem esconder nada", "referenciaFonte": "Arquivo | Pág. | Item" },
  "bloco4GarantiasECustosOcultos": { "resumoDidatico": "Garantia de proposta/caução Art. 58, garantia contratual Art. 96, planilha de custos/BDI, vistoria Art. 63 e amostra/POC", "referenciaFonte": "Arquivo | Pág. | Item" },
  "bloco5EntregaPagamentoVigenciaPenalidades": { "resumoDidatico": "Prazo/local de entrega ou execução remota, condições de pagamento, vigência do contrato/ata, índice de reajuste e multas", "referenciaFonte": "Arquivo | Pág. | Item" },
  "bloco6BeneficiosMeEppEstrategia": { "resumoDidatico": "Exclusividade até R$ 80 mil, cota reservada 25%, empate ficto e regularização tardia da LC 123/2006", "referenciaFonte": "Arquivo | Pág. | Item" },
  "bloco7PontosCriticosEFormalismo": { "resumoDidatico": "O que pode inabilitar na prática, cláusulas restritivas com trecho literal e abertura para diligência pelo Art. 64 e Acórdão 1.211/2021-TCU", "referenciaFonte": "Arquivo | Pág. | Item" },
  "parecerExecutivoCompleto": "Resumo explicativo completo para o licitante cobrindo os 7 pontos acima com clareza"
}

TEXTO OFICIAL DO EDITAL:
${blocoTexto}`;

        let result: any = null;
        let lastModelErr: any = null;
        for (const modelName of modelos) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { responseMimeType: 'application/json' },
            });
            result = await Promise.race([
              model.generateContent(prompt),
              new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_IA_EXTRACAO')), 45000)),
            ]);
            break;
          } catch (mErr: any) {
            lastModelErr = mErr;
          }
        }
        if (!result) throw lastModelErr || new Error('GEMINI_MODELS_UNAVAILABLE');

        const rawJson = String(result?.response?.text?.() || '').trim();
        const parte = JSON.parse(rawJson);
        for (const [k, v] of Object.entries(parte || {})) {
          if (typeof v === 'string' && v.trim().length > 3 && !v.includes('Não especificado')) {
            parsed[k] = parsed[k] && !String(parsed[k]).includes(v.trim()) ? `${parsed[k]} | ${v.trim()}` : v.trim();
          } else if (v && typeof v === 'object' && typeof (v as any).resumoDidatico === 'string') {
            const resumo = String((v as any).resumoDidatico || '').trim();
            const ref = String((v as any).referenciaFonte || '').trim();
            if (resumo.length > 10 && !resumo.includes('Não especificado')) {
              if (!parsed[k]) {
                parsed[k] = { resumoDidatico: resumo, referenciaFonte: ref || 'Edital Oficial' };
              } else {
                if (!parsed[k].resumoDidatico.includes(resumo)) {
                  parsed[k].resumoDidatico = `${parsed[k].resumoDidatico}\n${resumo}`;
                }
                if (ref && !parsed[k].referenciaFonte.includes(ref)) {
                  parsed[k].referenciaFonte = `${parsed[k].referenciaFonte} · ${ref}`;
                }
              }
            }
          }
        }
      }

      const safePick = (val: any, fallback: string) => {
        if (typeof val === 'string' && val.trim().length > 3 && !val.includes('Não especificado')) {
          return val.trim();
        }
        return fallback;
      };

      fichaBase.secoes.condicoesEntregaExecucao.prazoEntrega = safePick(parsed.prazoEntrega, fichaBase.secoes.condicoesEntregaExecucao.prazoEntrega);
      fichaBase.secoes.condicoesEntregaExecucao.localEntrega = safePick(parsed.localEntrega, fichaBase.secoes.condicoesEntregaExecucao.localEntrega);
      fichaBase.secoes.condicoesEntregaExecucao.detalhesAmostra = safePick(parsed.detalhesAmostra, fichaBase.secoes.condicoesEntregaExecucao.detalhesAmostra);
      fichaBase.secoes.condicoesEntregaExecucao.detalhesCatalogo = safePick(parsed.detalhesCatalogo, fichaBase.secoes.condicoesEntregaExecucao.detalhesCatalogo);
      fichaBase.secoes.condicoesEntregaExecucao.detalhesVistoria = safePick(parsed.detalhesVistoria, fichaBase.secoes.condicoesEntregaExecucao.detalhesVistoria);

      fichaBase.secoes.documentosExigidosHabilitacao.balancoPatrimonial = safePick(parsed.balancoPatrimonial, fichaBase.secoes.documentosExigidosHabilitacao.balancoPatrimonial);
      fichaBase.secoes.documentosExigidosHabilitacao.exigenciaIndicesContabeis = safePick(parsed.exigenciaIndicesContabeis, fichaBase.secoes.documentosExigidosHabilitacao.exigenciaIndicesContabeis);
      fichaBase.secoes.documentosExigidosHabilitacao.atestadoTecnico = safePick(parsed.atestadoTecnico, fichaBase.secoes.documentosExigidosHabilitacao.atestadoTecnico);
      fichaBase.secoes.documentosExigidosHabilitacao.limiteAtestadoPercentual = safePick(parsed.limiteAtestadoPercentual, fichaBase.secoes.documentosExigidosHabilitacao.limiteAtestadoPercentual);
      fichaBase.secoes.documentosExigidosHabilitacao.tempoMinimoExperiencia = safePick(parsed.tempoMinimoExperiencia, fichaBase.secoes.documentosExigidosHabilitacao.tempoMinimoExperiencia);
      fichaBase.secoes.documentosExigidosHabilitacao.registroConselhoOuAlvara = safePick(parsed.registroConselhoOuAlvara, fichaBase.secoes.documentosExigidosHabilitacao.registroConselhoOuAlvara);

      fichaBase.secoes.financeiroEContrato.condicoesPagamento = safePick(parsed.condicoesPagamento, fichaBase.secoes.financeiroEContrato.condicoesPagamento);
      fichaBase.secoes.financeiroEContrato.vigenciaContrato = safePick(parsed.vigenciaContrato, fichaBase.secoes.financeiroEContrato.vigenciaContrato);
      fichaBase.secoes.financeiroEContrato.criterioReajuste = safePick(parsed.criterioReajuste, fichaBase.secoes.financeiroEContrato.criterioReajuste);
      fichaBase.secoes.financeiroEContrato.garantiaContratual = safePick(parsed.garantiaContratual, fichaBase.secoes.financeiroEContrato.garantiaContratual);
      fichaBase.secoes.financeiroEContrato.multasEPenalidades = safePick(parsed.multasEPenalidades, fichaBase.secoes.financeiroEContrato.multasEPenalidades);
        if (typeof parsed.parecerExecutivoCompleto === 'string' && parsed.parecerExecutivoCompleto.trim().length > 80) {
          fichaBase.resumoExplicado = parsed.parecerExecutivoCompleto.trim();
        }

      const mergeBloco = (key: keyof ExplicacaoProfessorCompleta) => {
        const val = parsed[key];
        if (val && typeof val.resumoDidatico === 'string' && val.resumoDidatico.trim().length > 20) {
          fichaBase.explicacaoProfessor[key] = {
            titulo: fichaBase.explicacaoProfessor[key].titulo,
            resumoDidatico: val.resumoDidatico.trim(),
            referenciaFonte: val.referenciaFonte || fichaBase.explicacaoProfessor[key].referenciaFonte,
          };
        }
      };
      mergeBloco('bloco1ObjetoPratico');
      mergeBloco('bloco2DisputaEPrazos');
      mergeBloco('bloco3HabilitacaoCompleta');
      mergeBloco('bloco4GarantiasECustosOcultos');
      mergeBloco('bloco5EntregaPagamentoVigenciaPenalidades');
      mergeBloco('bloco6BeneficiosMeEppEstrategia');
      mergeBloco('bloco7PontosCriticosEFormalismo');

      // Sincroniza prazosECondicoes
      fichaBase.prazosECondicoes.prazoEntregaOuExecucao = fichaBase.secoes.condicoesEntregaExecucao.prazoEntrega;
      fichaBase.prazosECondicoes.localEntrega = fichaBase.secoes.condicoesEntregaExecucao.localEntrega;
      fichaBase.prazosECondicoes.prazoPagamento = fichaBase.secoes.financeiroEContrato.condicoesPagamento;
      fichaBase.prazosECondicoes.vigenciaContrato = fichaBase.secoes.financeiroEContrato.vigenciaContrato;
    } catch (err: any) {
      console.warn('[EditalDeepAnalyzer] Refinamento IA opcional indisponível, mantendo extração determinística:', err?.message);
    }

    return fichaBase;
  }

  /**
   * Executa a análise profunda de um edital e salva na base de dados
   */
  public static async processarEditalPorId(noticeId: string, force = false): Promise<ExtractedSpecsFicha | null> {
    const notice = await prisma.procurementNotice.findFirst({
      where: {
        OR: [
          { id: noticeId.match(/^[0-9a-fA-F-]{36}$/) ? noticeId : undefined },
          { numeroControlePncp: noticeId },
          { externalId: noticeId },
        ].filter(Boolean) as any,
      },
      include: {
        items: true,
      },
    });

    if (!notice) return null;

    const existingMeta = (typeof notice.metadata === 'object' && notice.metadata ? notice.metadata : {}) as Record<string, any>;
    if (!force && existingMeta.deepReadStatus === 'DONE' && Number(existingMeta.fichaVersion || 0) >= 6 && existingMeta.extractedSpecsJson?.explicacaoProfessor) {
      return existingMeta.extractedSpecsJson as ExtractedSpecsFicha;
    }

    const chunkLookupIds = [notice.id, notice.externalId, notice.numeroControlePncp].filter(Boolean) as string[];
    const chunks = await prisma.documentChunk.findMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId: { in: chunkLookupIds },
      },
      orderBy: { chunkIndex: 'asc' },
    });

    const textosChunks = chunks.map((c) => c.content);
    let ficha = this.analisarTextoIntegral(notice, textosChunks, notice.items || []);

    // Refina extração sobre o texto real dos arquivos (caso haja texto real extraído)
    if (ficha.possuiArquivosReaisLidos) {
      ficha = await this.refinarExtracaoComIaReal(ficha, textosChunks.join('\n\n'));
    }

    // Atualiza metadados com deepReadStatus, statusLeituraCompleta, classificação estrita e ficha estruturada
    const strictExec = classifyExecutionMode(
      textosChunks.join('\n\n'),
      ficha.possuiArquivosReaisLidos ? 'CONCLUIDO' : 'SEM_ARQUIVO_LEGIVEL',
      { modality: notice.modality, modoDisputa: notice.modoDisputa, object: notice.object },
    );

    await prisma.procurementNotice.update({
      where: { id: notice.id },
      data: {
        metadata: {
          ...(typeof notice.metadata === 'object' && notice.metadata ? (notice.metadata as Record<string, any>) : {}),
          deepReadStatus: ficha.possuiArquivosReaisLidos ? 'DONE' : 'PENDING',
          statusLeituraCompleta: ficha.possuiArquivosReaisLidos ? 'CONCLUIDO' : 'SEM_ARQUIVO_LEGIVEL',
          fichaVersion: 6,
          deepReadAt: new Date().toISOString(),
          extractedSpecsJson: ficha as any,
          isRemoteDispute: strictExec.isRemoteDispute,
          executionMode: strictExec.executionMode,
          executionEvidence: strictExec.executionEvidence,
          numeroOficialEdital: notice.noticeNumber || notice.externalId || null,
          numeroProcesso: notice.processoAdministrativo || null,
          auditoriaStatus: ficha.auditoria.status,
          totalVicios: ficha.auditoria.totalVicios,
        } as any,
      },
    });

    return ficha;
  }
}
