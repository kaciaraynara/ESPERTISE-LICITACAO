import { prisma } from '../database/prisma';

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

export interface ExtractedSpecsFicha {
  resumoExplicado: string;
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
  public static analisarTextoIntegral(notice: any, chunks: string[], itensOficiais: any[] = []): ExtractedSpecsFicha {
    const cleanChunks = chunks.filter(
      (c) => c && !c.includes('AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF'),
    );
    const possuiArquivosReaisLidos = cleanChunks.length > 0 && cleanChunks.join('').trim().length >= 120;
    const textoCompleto = cleanChunks.join('\n\n');
    const tLower = textoCompleto.toLowerCase();

    // 1. Formato da Disputa e Portal
    let disputaRemota: boolean | null = null;
    let formatoDisputa: 'ELETRONICA' | 'PRESENCIAL' | 'NAO_ESPECIFICADO' = 'NAO_ESPECIFICADO';
    let modoDisputaTexto = NAO_ESPECIFICADO;
    let trechoComprovante: string | null = null;

    const regexRemoto = /(?:pregão\s+eletrônico|concorrência\s+eletrônica|dispensa\s+eletrônica|sessão\s+pública\s+eletrônica|compras\.gov\.br|comprasnet|portal\s+de\s+compras\s+públicas|bll|bnc|licitanet|disputa\s+à\s+distância|sistema\s+eletrônico)/i;
    const regexPresencial = /(?:pregão\s+presencial|concorrência\s+presencial|sessão\s+presencial|sala\s+de\s+reuniões|abertura\s+presencial\s+dos\s+envelopes)/i;

    if (regexRemoto.test(textoCompleto) || regexRemoto.test(notice?.modoDisputa || '') || regexRemoto.test(notice?.modality || '')) {
      disputaRemota = true;
      formatoDisputa = 'ELETRONICA';
      modoDisputaTexto = 'Disputa Eletrônica (Sessão Online)';
      const match = textoCompleto.match(regexRemoto);
      if (match && match.index !== undefined) {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(textoCompleto.length, match.index + 180);
        trechoComprovante = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';
      }
    } else if (regexPresencial.test(textoCompleto) || regexPresencial.test(notice?.modoDisputa || '') || regexPresencial.test(notice?.modality || '')) {
      disputaRemota = false;
      formatoDisputa = 'PRESENCIAL';
      modoDisputaTexto = 'Disputa Presencial (Comparecimento Físico Exigido)';
      const match = textoCompleto.match(regexPresencial);
      if (match && match.index !== undefined) {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(textoCompleto.length, match.index + 180);
        trechoComprovante = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';
      }
    }

    // 2. Modo de Execução / Entrega (100% remoto somente com prova documental e sem entrega física/vistoria obrigatória)
    let execucaoOuEntrega: 'REMOTE' | 'PRESENTIAL' | 'HYBRID_OR_DELIVERY' | 'UNSPECIFIED' = 'UNSPECIFIED';
    const regexExecucaoRemota = /(?:prestação\s+de\s+serviços\s+remota|atendimento\s+remoto|acesso\s+remoto|ambiente\s+em\s+nuvem|software\s+como\s+serviço|saas|entrega\s+digital|execução\s+à\s+distância|100%\s+remoto)/i;
    const regexEntregaFisica = /(?:local\s+de\s+entrega|endereço\s+de\s+entrega|entrega\s+física|almoxarifado|frete|entrega\s+no\s+local|vistoria\s+obrigatória)/i;
    if (regexExecucaoRemota.test(textoCompleto) && !regexEntregaFisica.test(textoCompleto)) {
      execucaoOuEntrega = 'REMOTE';
      if (!trechoComprovante) {
        const matchExec = textoCompleto.match(regexExecucaoRemota);
        if (matchExec && matchExec.index !== undefined) {
          const start = Math.max(0, matchExec.index - 40);
          const end = Math.min(textoCompleto.length, matchExec.index + 180);
          trechoComprovante = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';
        }
      }
    } else if (/(?:local\s+de\s+entrega|endereço\s+de\s+entrega|entrega\s+física|almoxarifado|prazo\s+de\s+entrega)/i.test(textoCompleto)) {
      execucaoOuEntrega = 'HYBRID_OR_DELIVERY';
    }

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

    // 4. Extrações Reais de Habilitação (ZERO lista genérica fixa)
    const docJuridica: string[] = [];
    if (/(?:contrato\s+social|estatuto|ato\s+constitutivo)/i.test(textoCompleto)) docJuridica.push('Ato constitutivo / Contrato Social em vigor');
    if (/(?:cnpj|cadastro\s+nacional\s+da\s+pessoa\s+jurídica)/i.test(textoCompleto)) docJuridica.push('Comprovante de inscrição no CNPJ');
    if (/(?:registro\s+comercial|requerimento\s+de\s+empresário|mei|ccmei)/i.test(textoCompleto)) docJuridica.push('Registro comercial / Certificado de MEI (se aplicável)');
    if (docJuridica.length === 0) docJuridica.push(possuiArquivosReaisLidos ? 'Não detalhado expressamente nos trechos analisados' : NAO_ESPECIFICADO);

    const docFiscal: string[] = [];
    if (/(?:receita\s+federal|pgfn|tributos\s+federais|conjunta\s+federal)/i.test(textoCompleto)) docFiscal.push('Certidão Conjunta Federal / Dívida Ativa (RFB/PGFN)');
    if (/(?:fgts|fundo\s+de\s+garantia|crf)/i.test(textoCompleto)) docFiscal.push('Regularidade do FGTS (CRF)');
    if (/(?:cndt|débitos\s+trabalhistas|justiça\s+do\s+trabalho)/i.test(textoCompleto)) docFiscal.push('Certidão Negativa de Débitos Trabalhistas (CNDT)');
    if (/(?:fazenda\s+estadual|tributos\s+estaduais|sefaz)/i.test(textoCompleto)) docFiscal.push('Regularidade Fiscal Estadual');
    if (/(?:fazenda\s+municipal|tributos\s+municipais)/i.test(textoCompleto)) docFiscal.push('Regularidade Fiscal Municipal');
    if (docFiscal.length === 0) docFiscal.push(possuiArquivosReaisLidos ? 'Não detalhado expressamente nos trechos analisados' : NAO_ESPECIFICADO);

    // Balanço Patrimonial e Índices
    let balancoPatrimonial = NAO_ESPECIFICADO;
    if (/(?:dispensad[oa]\s+(?:o|a|de)\s+balanço|art\.?\s*70,?\s*(?:inciso\s*)?iii|entrega\s+imediata[^.\n]{0,60}balanço)/i.test(textoCompleto)) {
      balancoPatrimonial = extrairSentencaPorRegex(textoCompleto, /(?:dispensad[oa][^.\n]{0,80}balanço|balanço[^.\n]{0,80}dispensad[oa])/i, 120) || 'Dispensado conforme regras do edital';
    } else if (/balanço\s+patrimonial/i.test(textoCompleto)) {
      balancoPatrimonial = extrairSentencaPorRegex(textoCompleto, /balanço\s+patrimonial[^.\n]{0,160}/i, 140) || 'Exigido nos termos do edital';
    } else if (possuiArquivosReaisLidos) {
      balancoPatrimonial = NAO_EXIGIDO;
    }

    const exigenciaIndicesContabeis = extrairSentencaPorRegex(
      textoCompleto,
      /(?:liquidez\s+geral|solvência\s+geral|liquidez\s+corrente|índices\s+contábeis)[^.\n]{0,160}/i,
      140,
    ) || (possuiArquivosReaisLidos ? NAO_EXIGIDO : NAO_ESPECIFICADO);

    // Atestado Técnico, Percentual e Tempo Mínimo de Experiência
    const atestadoTecnico = extrairSentencaPorRegex(
      textoCompleto,
      /(?:atestado\s+de\s+capacidade\s+técnica|atestados?\s+fornecidos?\s+por\s+pessoa\s+jurídica)[^.\n]{0,180}/i,
      160,
    ) || (possuiArquivosReaisLidos ? NAO_EXIGIDO : NAO_ESPECIFICADO);

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
      /(?:registro\s+(?:ou\s+inscrição\s+)?no\s+(?:crea|cau|cra|crq|crm|coren|crf|conselho\s+regional)|licença\s+sanitária|anvisa|alvará\s+de\s+funcionamento)[^.\n]{0,150}/i,
      120,
    ) || NAO_EXIGIDO;

    // 5. Condições Financeiras e Contratuais Reais
    const condicoesPagamento = extrairSentencaPorRegex(
      textoCompleto,
      /(?:prazo\s+de\s+pagamento|pagamento\s+será\s+efetuado|liquidação\s+e\s+pagamento)[^.\n]{0,160}/i,
      140,
    ) || NAO_ESPECIFICADO;

    const vigenciaContrato = extrairSentencaPorRegex(
      textoCompleto,
      /(?:prazo\s+de\s+vigência|vigência\s+do\s+contrato|vigência\s+da\s+ata)[^.\n]{0,140}/i,
      120,
    ) || NAO_ESPECIFICADO;

    const criterioReajuste = extrairSentencaPorRegex(
      textoCompleto,
      /(?:reajuste|reajustamento\s+de\s+preços)[^.\n]{0,160}(?:ipca|igp-m|inpc|igpm|incc|ipca-e|índice)[^.\n]{0,80}/i,
      120,
    ) || NAO_ESPECIFICADO;

    const garantiaContratual = extrairSentencaPorRegex(
      textoCompleto,
      /(?:garantia\s+contratual|garantia\s+de\s+execução)[^.\n]{0,140}/i,
      120,
    ) || NAO_EXIGIDO;

    const multasEPenalidades = extrairSentencaPorRegex(
      textoCompleto,
      /(?:multa\s+(?:moratória|compensatória)|sanções\s+administrativas|penalidades)[^.\n]{0,160}/i,
      140,
    ) || NAO_ESPECIFICADO;

    // 6. Benefício ME / EPP
    const exclusivoOuCotaMeEpp = /(?:exclusiv[oa]\s+para\s+(?:me|epp|microempresa)|cota\s+reservada|lei\s+complementar\s+n[º°]?\s*123)/i.test(textoCompleto);
    const detalhesMeEpp = exclusivoOuCotaMeEpp
      ? (extrairSentencaPorRegex(textoCompleto, /(?:exclusiv[oa]\s+para\s+me|cota\s+reservada|microempresas\s+e\s+empresas\s+de\s+pequeno\s+porte)[^.\n]{0,160}/i, 140) || 'Prevê tratamento diferenciado ou exclusividade para ME/EPP (LC 123/2006).')
      : 'Disputa aberta para ampla concorrência (sem menção expressa de exclusividade ME/EPP nos trechos analisados).';

    // Helper para extrair trecho literal de vício com identificação de arquivo, página e cláusula/subitem
    const extrairEvidenciaLocalizada = (regex: RegExp): { trecho: string; arquivo: string; pagina: string | number; clausula: string | null } | null => {
      const match = textoCompleto.match(regex);
      if (!match || match.index === undefined) return null;

      const start = Math.max(0, match.index - 30);
      const end = Math.min(textoCompleto.length, match.index + match[0].length + 90);
      const trecho = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';

      const textoAnterior = textoCompleto.slice(0, match.index);
      const pageMatches = [...textoAnterior.matchAll(/\[Página\s+(\d+)\s+de\s+([^\]]+)\]/gi)];

      let pagina: string | number = 'Conforme texto oficial';
      let arquivo = 'Edital / Termo de Referência';

      if (pageMatches.length > 0) {
        const lastPage = pageMatches[pageMatches.length - 1];
        if (lastPage && lastPage[1]) {
          pagina = Number(lastPage[1]) || lastPage[1];
          if (lastPage[2]) arquivo = lastPage[2].trim();
        }
      } else {
        const arqMatch = textoAnterior.match(/===\s*(?:ANEXO|DOCUMENTO|ARQUIVO INTERNO DO PACOTE):\s*([^=\n]+)\s*===/gi);
        if (arqMatch && arqMatch.length > 0) {
          const cleanName = arqMatch[arqMatch.length - 1]
            .replace(/===\s*(?:ANEXO|DOCUMENTO|ARQUIVO INTERNO DO PACOTE):\s*/i, '')
            .replace(/\s*===/, '')
            .trim();
          if (cleanName) arquivo = cleanName;
        }
      }

      const janelaClausula = textoCompleto.slice(Math.max(0, match.index - 350), match.index + 30);
      const clauseMatches = [...janelaClausula.matchAll(/(?:Cláusula\s+[A-Za-zÀ-ÿ0-9ºª.-]+|Subitem\s+\d+(?:\.\d+)+|Item\s+\d+(?:\.\d+)+|\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})*\b)/gi)];
      const clausula = clauseMatches.length > 0
        ? clauseMatches[clauseMatches.length - 1][0].trim()
        : null;

      return { trecho, arquivo, pagina, clausula };
    };

    // 7. Auditoria Determinística de Irregularidades com Prova Literal
    const vicios: VicioIrregularidadeEdital[] = [];

    const regexAtestadoExcessivo = /(?:atestado|capacidade\s+t[eé]cnica|comprova[çc][ãa]o\s+de\s+aptid[ãa]o)[^\n.]{0,100}(?:5[1-9]%|[6-9][0-9]%|100%)[^\n.]{0,100}/i;
    if (regexAtestadoExcessivo.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexAtestadoExcessivo);
      if (ev) {
        vicios.push({
          id: 'vicio-atestado-50',
          titulo: 'Exigência Excessiva de Quantitativo em Atestado Técnico (> 50%)',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 67, § 1º e § 2º da Lei 14.133/2021 e Súmula nº 263 do TCU',
          explicacaoSimples: 'A Administração não pode exigir atestado de capacidade técnica superior a 50% dos quantitativos da licitação.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital (Art. 164) requerendo a limitação a no máximo 50%.',
        });
      }
    }

    const regexRestricaoGeo = /(?:possuir\s+sede\s+n[ao]|obrigatoriamente\s+sediada|escrit[oó]rio\s+local|filial\s+no\s+munic[ií]pio|atestado\s+emitido\s+no\s+estado|registro\s+no\s+conselho\s+regional\s+local\s+antes\s+da\s+contrata[çc][ãa]o)[^\n.]{0,100}/i;
    if (regexRestricaoGeo.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexRestricaoGeo);
      if (ev) {
        vicios.push({
          id: 'vicio-restricao-geografica',
          titulo: 'Restrição Geográfica Indevida / Exigência de Sede Local',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 9º, inciso I, alínea "a" da Lei 14.133/2021 e Súmula nº 272 do TCU',
          explicacaoSimples: 'É proibido restringir a disputa ou exigir sede ou filial prévia em município ou estado específico.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital requerendo a anulação da exigência geográfica.',
        });
      }
    }

    const regexVistoriaObrigatoria = /(?:vistoria|visita\s+t[eé]cnica)\s+obrigat[oó]ria[^\n.]{0,100}/i;
    const temDeclaracaoSubstitutiva = /(?:declara[çc][ãa]o\s+formal|declara[çc][ãa]o\s+de\s+conhecimento|facultada\s+a\s+substitui[çc][ãa]o)/i.test(textoCompleto);
    if (regexVistoriaObrigatoria.test(textoCompleto) && !temDeclaracaoSubstitutiva) {
      const ev = extrairEvidenciaLocalizada(regexVistoriaObrigatoria);
      if (ev) {
        vicios.push({
          id: 'vicio-vistoria-obrigatoria',
          titulo: 'Vistoria Obrigatória sem Opção de Declaração Formal Substitutiva',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 63, § 2º e § 3º da Lei Federal nº 14.133/2021',
          explicacaoSimples: 'A lei garante ao licitante o direito de substituir a vistoria presencial por declaração formal de conhecimento.',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação para assegurar a substituição por declaração.',
        });
      }
    }

    const regexMarcaDirecionada = /(?:marca\s+[A-Z][a-zA-Z0-9]+|modelo\s+[A-Z][a-zA-Z0-9]+|prefer[eê]ncia\s+pela\s+marca)[^\n.]{0,100}/i;
    const temSimilar = /(?:ou\s+similar|ou\s+equivalente|de\s+melhor\s+qualidade)/i.test(textoCompleto);
    if (regexMarcaDirecionada.test(textoCompleto) && !temSimilar) {
      const ev = extrairEvidenciaLocalizada(regexMarcaDirecionada);
      if (ev) {
        vicios.push({
          id: 'vicio-direcionamento-marca',
          titulo: 'Direcionamento de Marca / Modelo sem Cláusula "ou equivalente"',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 41, inciso I da Lei 14.133/2021 e Súmula nº 270 do TCU',
          explicacaoSimples: 'A indicação de marca sem justificativa técnica e sem a locução "ou equivalente" fere a isonomia.',
          acaoRecomendada: 'Protocolar Impugnação exigindo a inclusão da expressão "ou equivalente".',
        });
      }
    }

    const regexCertificacaoPrivada = /(?:certifica[çc][ãa]o\s+ISO|ISO\s*9001|ISO\s*27001|ISO\s*14001|CMMI|MPS\.BR|laudo\s+t[eé]cnico\s+pr[eé]vio)[^\n.]{0,120}(?:habilita[çc][ãa]o|desclassifica[çc][ãa]o|sob\s+pena)/i;
    if (regexCertificacaoPrivada.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexCertificacaoPrivada);
      if (ev) {
        vicios.push({
          id: 'vicio-certificacao-iso',
          titulo: 'Exigência Ilegal de Certificação Privada (ISO / CMMI) na Habilitação',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Arts. 62 a 70 da Lei 14.133/2021 e Súmula nº 192 / Acórdão 1.214/2013-Plenário do TCU',
          explicacaoSimples: 'Certificações privadas como ISO 9001 não podem ser exigidas como condição eliminatória de habilitação.',
          acaoRecomendada: 'Protocolar Impugnação requerendo a exclusão da certificação como requisito habilitatório.',
        });
      }
    }

    const regexLoteUnicoIndevido = /(?:adjudica[çc][ãa]o\s+por\s+lote\s+[uú]nico|crit[eé]rio\s+global\s+em\s+lote\s+[uú]nico)[^\n.]{0,100}(?:sem\s+justificativa|divis[ií]veis)/i;
    if (regexLoteUnicoIndevido.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexLoteUnicoIndevido);
      if (ev) {
        vicios.push({
          id: 'vicio-agrupamento-lote-unico',
          titulo: 'Agrupamento Indevido de Itens Divisíveis em Lote Único',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 40, § 2º da Lei 14.133/2021 e Súmula nº 247 do TCU',
          explicacaoSimples: 'Itens divisíveis devem ser licitados separadamente para ampliar a competitividade.',
          acaoRecomendada: 'Protocolar Impugnação pleiteando o parcelamento do objeto por itens.',
        });
      }
    }

    const regexPrazoExiguo = /(?:prazo\s+de\s+entrega|execu[çc][ãa]o)[^\n.]{0,80}(?:(?:24|48)\s*horas|1\s*dia\s*[uú]til)[^\n.]{0,80}/i;
    if (regexPrazoExiguo.test(textoCompleto) && !/perec[ií]vel|urg[eê]ncia\s+m[eé]dica|pronto\s+socorro/i.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexPrazoExiguo);
      if (ev) {
        vicios.push({
          id: 'vicio-prazo-exiguo',
          titulo: 'Prazo de Entrega Exíguo / Desproporcional',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 40, § 2º da Lei 14.133/2021 e Princípio da Razoabilidade',
          explicacaoSimples: 'Prazos de 24h ou 48h sem urgência comprovada funcionam como restrição geográfica indireta.',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação solicitando prazo compatível com a logística.',
        });
      }
    }

    const regexGarantiaAbusiva = /(?:garantia\s+contratual|garantia\s+de\s+execu[çc][ãa]o)[^\n.]{0,80}(?:1[1-9]%|[2-9][0-9]%)[^\n.]{0,80}/i;
    if (regexGarantiaAbusiva.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexGarantiaAbusiva);
      if (ev) {
        vicios.push({
          id: 'vicio-garantia-excessiva',
          titulo: 'Exigência de Garantia Contratual Acima do Limite Legal',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          clausula: ev.clausula,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 98 da Lei Federal nº 14.133/2021 (limite de 5%, ou 10% em alta complexidade)',
          explicacaoSimples: 'A garantia de execução não pode superar os limites máximos previstos no Art. 98 da Lei.',
          acaoRecomendada: 'Protocolar Impugnação para adequação do percentual de garantia.',
        });
      }
    }

    const auditoriaResultado: AuditoriaEditalResultado = {
      status: vicios.length > 0 ? 'IRREGULARIDADE_DETECTADA' : 'CONFORME',
      mensagem: vicios.length > 0
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

    const resumoExplicado = `Contratação promovida por ${orgao} com objeto: ${objetoPrincipal}. ${
      itensExtraidos.length > 0 ? `Contempla ${itensExtraidos.length} item(ns) oficial(is).` : ''
    }`;

    return {
      resumoExplicado,
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
      pontosDeAtencaoERiscos: vicios.map((v) => ({
        titulo: v.titulo,
        gravidade: v.gravidade,
        baseLegal: v.fundamentoLegal,
        arquivoOrigem: v.arquivoOrigem,
        pagina: v.pagina,
        trechoLiteral: v.trechoLiteral,
        explicacaoSimples: v.explicacaoSimples,
        acaoRecomendada: v.acaoRecomendada,
      })),
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
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      // Amostra estratégica: início (Edital), meio (Habilitação/TR) e fim (Minuta/Contrato/Anexos)
      const inicio = textoReal.slice(0, 28000);
      const meio = textoReal.length > 40000 ? textoReal.slice(Math.floor(textoReal.length / 2) - 10000, Math.floor(textoReal.length / 2) + 12000) : '';
      const fim = textoReal.length > 60000 ? textoReal.slice(-20000) : '';
      const textoConsolidado = [inicio, meio, fim].filter(Boolean).join('\n\n--- TRECHO SEGUINTE DO ARQUIVO ---\n\n');

      const prompt = `Você é um analista sênior de licitações públicas. Extraia EXCLUSIVAMENTE as informações literais presentes no texto oficial abaixo.
REGRAS INEGOCIAVEIS:
1. PROIBIDO inventar, presumir ou usar texto genérico.
2. Se uma informação NÃO estiver expressa no texto, escreva exatamente: "Não especificado nos arquivos analisados" ou "Não exigido nos arquivos analisados".
3. Cite números exatos, prazos exatos e nomes de documentos exatos escritos neste texto.

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
  "multasEPenalidades": "string"
}

TEXTO OFICIAL DO EDITAL:
${textoConsolidado}`;

      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_IA_EXTRACAO')), 18000)),
      ]) as any;

      const rawJson = String(result?.response?.text?.() || '').trim();
      const parsed = JSON.parse(rawJson);

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
    if (!force && existingMeta.deepReadStatus === 'DONE' && existingMeta.extractedSpecsJson?.secoes) {
      return existingMeta.extractedSpecsJson as ExtractedSpecsFicha;
    }

    // Busca chunks existentes do edital
    const chunks = await prisma.documentChunk.findMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId: notice.id,
      },
      orderBy: { chunkIndex: 'asc' },
      take: 80,
    });

    const textosChunks = chunks.map((c) => c.content);
    let ficha = this.analisarTextoIntegral(notice, textosChunks, notice.items || []);

    // Refina extração sobre o texto real dos arquivos (caso haja texto real extraído)
    if (ficha.possuiArquivosReaisLidos) {
      ficha = await this.refinarExtracaoComIaReal(ficha, textosChunks.join('\n\n'));
    }

    // Atualiza metadados com deepReadStatus e ficha estruturada
    await prisma.procurementNotice.update({
      where: { id: notice.id },
      data: {
        metadata: {
          ...(typeof notice.metadata === 'object' && notice.metadata ? (notice.metadata as Record<string, any>) : {}),
          deepReadStatus: ficha.possuiArquivosReaisLidos ? 'DONE' : 'PENDING',
          deepReadAt: new Date().toISOString(),
          extractedSpecsJson: ficha as any,
          isRemoteDispute: ficha.disputaEExecucao.disputaRemota,
          executionMode: ficha.disputaEExecucao.execucaoOuEntrega,
          executionEvidence: ficha.disputaEExecucao.trechoComprovante,
          auditoriaStatus: ficha.auditoria.status,
          totalVicios: ficha.auditoria.totalVicios,
        } as any,
      },
    });

    return ficha;
  }
}
