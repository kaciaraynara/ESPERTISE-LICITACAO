export type StatusLeituraCompleta =
  | 'PENDENTE'
  | 'LENDO'
  | 'CONCLUIDO'
  | 'SEM_ARQUIVO_LEGIVEL'
  | 'ERRO';

export type ExecutionModeStrict =
  | 'REMOTO_INTEGRAL'
  | 'HIBRIDO'
  | 'PRESENCIAL_FISICO'
  | 'NAO_IDENTIFICADO';

export interface ExecutionClassificationResult {
  executionMode: ExecutionModeStrict;
  isRemoteDispute: boolean | null;
  executionEvidence: string | null;
}

const REGEX_DISPUTA_ELETRONICA =
  /(?:preg[ãa]o\s+eletr[ôo]nico|concorr[êe]ncia\s+eletr[ôo]nica|dispensa\s+eletr[ôo]nica|sess[ãa]o\s+p[úu]blica\s+eletr[ôo]nica|compras\.gov\.br|comprasnet|portal\s+de\s+compras\s+p[úu]blicas|bll|bnc|licitanet|sistema\s+eletr[ôo]nico)/i;

const REGEX_DISPUTA_PRESENCIAL =
  /(?:preg[ãa]o\s+presencial|concorr[êe]ncia\s+presencial|sess[ãa]o\s+presencial|abertura\s+presencial\s+dos\s+envelopes)/i;

const REGEX_REMOTO_DIGITAL =
  /(?:software\s+como\s+servi[çc]o|saas|licenciamento\s+de\s+software|licen[çc]a\s+de\s+uso\s+de\s+sistema|ambiente\s+em\s+nuvem|cloud\s+computing|entrega\s+eletr[ôo]nica|entrega\s+digital|presta[çc][ãa]o\s+de\s+servi[çc]os\s+(?:de\s+forma\s+)?remota|atendimento\s+remoto|consultoria\s+online|100%\s+remoto|execu[çc][ãa]o\s+[àa]\s+dist[âa]ncia)/i;

const REGEX_ENTREGA_FISICA_OU_PRESENCIAL =
  /(?:entrega\s+f[íi]sica|local\s+de\s+entrega|endere[çc]o\s+de\s+entrega|almoxarifado|instala[çc][ãa]o\s+(?:no\s+local|in\s+loco|na\s+sede)|orienta[çc][ãa]o\s+operacional|montagem\s+no\s+local|manuten[çc][ãa]o\s+presencial|vistoria\s+(?:t[eé]cnica\s+)?obrigat[óo]ria|visita\s+t[eé]cnica\s+obrigat[óo]ria|atendimento\s+presencial|nas\s+depend[êe]ncias\s+d[ao]|na\s+sede\s+d[ao]|aquisi[çc][ãa]o\s+de\s+(?:equipamentos?|materiais?|nobreaks?|mobili[áa]rio|ve[íi]culos?|g[êe]neros\s+aliment[íi]cios|medicamentos?|uniformes?)|fornecimento\s+de\s+(?:materiais?|equipamentos?|bens\s+permanentes?))/i;

const REGEX_PRESENCIAL_ESTRITO =
  /(?:instala[çc][ãa]o\s+(?:no\s+local|in\s+loco|na\s+sede)|orienta[çc][ãa]o\s+operacional|manuten[çc][ãa]o\s+presencial|atendimento\s+presencial|nas\s+depend[êe]ncias\s+d[ao]|na\s+sede\s+d[ao]|vistoria\s+(?:t[eé]cnica\s+)?obrigat[óo]ria|almoxarifado|entrega\s+f[íi]sica)/i;

function extractLocationAndSnippet(texto: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(texto.length, matchIndex + matchLength + 140);
  const snippet = texto.slice(start, end).replace(/\s+/g, ' ').trim();

  const antes = texto.slice(0, matchIndex);
  const pageMatches = [...antes.matchAll(/\[P[áa]gina\s+(\d+)\s+de\s+([^\]]+)\]/gi)];
  if (pageMatches.length > 0) {
    const last = pageMatches[pageMatches.length - 1];
    return `[${last[2].trim()} | Pág. ${last[1]}] "${snippet}"`;
  }
  return `"${snippet}"`;
}

/**
 * Classifica o regime real de disputa e execução/entrega exclusivamente a partir
 * do texto integral salvo no banco. Nunca retorna 'REMOTO_INTEGRAL' sem leitura
 * completa concluída e sem descartar entrega física/instalação/presença no órgão.
 */
export function classifyExecutionMode(
  textoCompleto: string,
  statusLeituraCompleta: StatusLeituraCompleta,
  fallbackMeta?: { modality?: string | null; modoDisputa?: string | null; object?: string | null },
): ExecutionClassificationResult {
  const metaText = `${fallbackMeta?.modality || ''} ${fallbackMeta?.modoDisputa || ''}`;
  let isRemoteDispute: boolean | null = null;

  if (REGEX_DISPUTA_ELETRONICA.test(textoCompleto) || REGEX_DISPUTA_ELETRONICA.test(metaText)) {
    isRemoteDispute = true;
  } else if (REGEX_DISPUTA_PRESENCIAL.test(textoCompleto) || REGEX_DISPUTA_PRESENCIAL.test(metaText)) {
    isRemoteDispute = false;
  }

  if (statusLeituraCompleta !== 'CONCLUIDO' || textoCompleto.trim().length < 150) {
    return {
      executionMode: 'NAO_IDENTIFICADO',
      isRemoteDispute,
      executionEvidence: null,
    };
  }

  const textoParaAnalise = `${fallbackMeta?.object || ''}\n${textoCompleto}`;
  const matchFisicoTexto = textoCompleto.match(REGEX_ENTREGA_FISICA_OU_PRESENCIAL);
  const matchFisicoMeta = (fallbackMeta?.object || '').match(REGEX_ENTREGA_FISICA_OU_PRESENCIAL);
  const matchRemotoTexto = textoCompleto.match(REGEX_REMOTO_DIGITAL);
  const matchRemotoMeta = (fallbackMeta?.object || '').match(REGEX_REMOTO_DIGITAL);

  if (matchFisicoTexto && matchFisicoTexto.index !== undefined) {
    const isStrictPresencial = REGEX_PRESENCIAL_ESTRITO.test(textoParaAnalise);
    return {
      executionMode: isStrictPresencial && !matchRemotoTexto && !matchRemotoMeta ? 'PRESENCIAL_FISICO' : 'HIBRIDO',
      isRemoteDispute,
      executionEvidence: extractLocationAndSnippet(textoCompleto, matchFisicoTexto.index, matchFisicoTexto[0].length),
    };
  }

  if (matchFisicoMeta && matchFisicoMeta.index !== undefined) {
    const isStrictPresencial = REGEX_PRESENCIAL_ESTRITO.test(textoParaAnalise);
    return {
      executionMode: isStrictPresencial && !matchRemotoTexto ? 'PRESENCIAL_FISICO' : 'HIBRIDO',
      isRemoteDispute,
      executionEvidence: `"${String(fallbackMeta?.object || '').trim()}"`,
    };
  }

  const temBemFisicoSemSoftware =
    /\b(?:aquisi[cç][aã]o|fornecimento)\s+de\b/i.test(textoParaAnalise) &&
    !matchRemotoTexto &&
    !matchRemotoMeta;

  if (!temBemFisicoSemSoftware && matchRemotoTexto && matchRemotoTexto.index !== undefined && isRemoteDispute !== false) {
    return {
      executionMode: 'REMOTO_INTEGRAL',
      isRemoteDispute: true,
      executionEvidence: extractLocationAndSnippet(textoCompleto, matchRemotoTexto.index, matchRemotoTexto[0].length),
    };
  }

  return {
    executionMode: 'NAO_IDENTIFICADO',
    isRemoteDispute,
    executionEvidence: null,
  };
}
