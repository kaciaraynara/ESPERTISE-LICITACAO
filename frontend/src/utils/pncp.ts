/**
/**
 * Utilitários para resiliência e auditoria oficial de editais do PNCP
 * Rigorosamente em conformidade com as 5 Regras de Ouro:
 * 1. Zero mocks ou dados fictícios
 * 2. NO_DATA != ZERO (ausência de valor nunca é exibida como zero)
 * 3. Fuso horário oficial America/Sao_Paulo (-03:00) em todas as datas
 * 4. Parser estrito de identificador PNCP (numeroControlePNCP -> cnpj, ano, sequencial)
 */

export interface PncpUrlParams {
  cnpj: string;
  anoCompra: number;
  sequencialCompra: number;
}

/**
 * Formata um CNPJ de 14 dígitos no padrão XX.XXX.XXX/XXXX-XX
 */
export function formatCnpj(rawCnpj?: string | null): string {
  if (!rawCnpj) return '—';
  const clean = String(rawCnpj).replace(/\D/g, '');
  if (clean.length !== 14) return String(rawCnpj);
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

/**
 * Converte qualquer formato de data do PNCP para ISO com timezone correto de Brasília (-03:00)
 */
export function parsePncpDateToIso(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  if (/([+-]\d{2}:\d{2}|Z)$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
    const d = new Date(`${trimmed}-03:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00-03:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (/^\d{8}$/.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const m = trimmed.slice(4, 6);
    const day = trimmed.slice(6, 8);
    const d = new Date(`${y}-${m}-${day}T12:00:00-03:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Converte com segurança datas do PNCP para objeto Date, evitando o recuo D-1.
 * - Se rawDate for YYYY-MM-DD ou YYYY-MM-DDT00:00:00.000Z, converte usando ${str.slice(0, 10)}T12:00:00-03:00.
 * - Se rawDate for timestamp ISO sem offset, anexa -03:00 antes de instanciar new Date().
 */
export function parsePncpDateSafe(rawDate?: string | Date | null): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate;
  }
  const str = String(rawDate).trim();
  if (!str) return null;

  // YYYY-MM-DD ou YYYY-MM-DDT00:00:00... (inclusive com .000Z)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z?$/i.test(str)) {
    const d = new Date(`${str.slice(0, 10)}T12:00:00-03:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Timestamp ISO sem offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
    const d = new Date(`${str}-03:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const day = str.slice(6, 8);
    const d = new Date(`${y}-${m}-${day}T12:00:00-03:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata data no fuso de Brasília (America/Sao_Paulo) no padrão pt-BR.
 */
export function formatPncpDateBR(rawDate?: string | Date | null, includeTime: boolean = false): string {
  const d = parsePncpDateSafe(rawDate);
  if (!d) return '—';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('pt-BR', options).format(d);
}

/**
 * Formata data no fuso de Brasília (America/Sao_Paulo) sem sofrer recuo D-1
 */
export function formatPncpDate(dateStr?: string | Date | null): string {
  return formatPncpDateBR(dateStr, false);
}

/**
 * Formata data e hora no fuso de Brasília (America/Sao_Paulo)
 */
export function formatPncpDateTime(dateStr?: string | Date | null): string {
  return formatPncpDateBR(dateStr, true);
}

/**
 * Extrai os parâmetros oficiais do PNCP (cnpj, anoCompra, sequencialCompra)
 * Prioridade absoluta ao número de controle PNCP (ex: 43076702000161-1-000055/2026).
 * REGRA INVIOLÁVEL: JAMAIS usa numeroCompra ou noticeNumber como sequencialCompra.
 */
export function extractPncpParams(edital: any): PncpUrlParams | null {
  if (!edital) return null;

  // 1. Extração prioritária a partir do numeroControlePNCP / externalId
  const numControle = String(
    edital.numeroControlePNCP ||
    edital.numero_controle_pncp ||
    edital.externalId ||
    edital.external_id ||
    edital.id ||
    '',
  ).trim().replace(/^pncp-/i, '');

  // Padrão oficial PNCP: CNPJ-1-SEQUENCIAL/ANO ou CNPJ-SEQUENCIAL/ANO
  const matchOficial = numControle.match(/^(\d{14})(?:-\d+)?-(\d+)[/-](\d{4})$/);
  if (matchOficial) {
    const [, cnpj, sequencial, ano] = matchOficial;
    return {
      cnpj,
      anoCompra: Number(ano),
      sequencialCompra: Number(sequencial),
    };
  }

  // Padrão com barras: CNPJ/ANO/SEQUENCIAL
  const matchBarras = numControle.match(/^(\d{14})[/-](\d{4})[/-](\d+)$/);
  if (matchBarras) {
    const [, cnpj, ano, sequencial] = matchBarras;
    return {
      cnpj,
      anoCompra: Number(ano),
      sequencialCompra: Number(sequencial),
    };
  }

  // 2. Extração de URLs de portais existentes
  const candidateUrl = String(
    edital.urlOficialPncp ||
    edital.urlOficial ||
    edital.link ||
    edital.linkEditalPNCP ||
    edital.url ||
    edital.linkSistemaOrigem ||
    '',
  );
  if (candidateUrl.includes('/editais/')) {
    const matchUrl = candidateUrl.match(/\/editais\/(\d{14})\/(\d{4})\/(\d+)/);
    if (matchUrl) {
      const [, cnpj, ano, sequencial] = matchUrl;
      return {
        cnpj,
        anoCompra: Number(ano),
        sequencialCompra: Number(sequencial),
      };
    }
  }

  if (candidateUrl.includes('/compras/')) {
    const matchApi = candidateUrl.match(/\/orgaos\/(\d{14})\/compras\/(\d{4})\/(\d+)/);
    if (matchApi) {
      const [, cnpj, ano, sequencial] = matchApi;
      return {
        cnpj,
        anoCompra: Number(ano),
        sequencialCompra: Number(sequencial),
      };
    }
  }

  // 3. Fallback estrito: Propriedades explícitas caso sequencialCompra seja numérico e válido
  // REGRA DE OURO: JAMAIS use numeroCompra ou noticeNumber como sequencialCompra!
  const rawCnpj = String(
    edital.cnpjOrgao ||
    edital.cnpj ||
    edital.buyerDocument ||
    '',
  ).replace(/\D/g, '');

  const rawAno = Number(edital.anoCompra || edital.ano);
  const rawSeq = Number(edital.sequencialCompra);

  if (rawCnpj.length === 14 && Number.isFinite(rawAno) && rawAno >= 2000 && Number.isFinite(rawSeq) && rawSeq > 0) {
    return {
      cnpj: rawCnpj,
      anoCompra: rawAno,
      sequencialCompra: rawSeq,
    };
  }

  return null;
}

/**
 * Constrói a URL oficial verídica da contratação no portal web do PNCP:
 * https://pncp.gov.br/app/editais/{cnpj}/{ano}/{sequencial}
 */
export function buildOfficialPncpPortalUrl(edital: any): string {
  if (!edital) return 'https://pncp.gov.br/app/editais';

  const params = extractPncpParams(edital);
  if (params) {
    return `https://pncp.gov.br/app/editais/${params.cnpj}/${params.anoCompra}/${params.sequencialCompra}`;
  }

  return 'https://pncp.gov.br/app/editais';
}

/**
 * Função para acesso direto e seguro ao edital no portal web oficial do PNCP.
 * ELIMINA DEFINITIVAMENTE O ERRO 503 ao NUNCA redirecionar o navegador para '/api/pncp/.../arquivos/1'.
 */
export async function handleDownloadEdital(
  edital: any,
  options?: {
    openFn?: (url: string, target?: string, features?: string) => void;
  },
): Promise<string> {
  const openImpl = options?.openFn || ((url: string, target = '_blank', features = 'noopener,noreferrer') => {
    if (typeof window !== 'undefined') {
      window.open(url, target, features);
    }
  });

  const urlWebPncp = buildOfficialPncpPortalUrl(edital);
  openImpl(urlWebPncp, '_blank', 'noopener,noreferrer');
  return urlWebPncp;
}
