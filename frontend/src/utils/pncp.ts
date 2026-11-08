/**
 * Utilitários para resiliência e auditoria oficial de editais do PNCP
 */

export interface PncpUrlParams {
  cnpj: string;
  anoCompra: number | string;
  sequencialCompra: number | string;
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
 * Extrai os parâmetros oficiais do PNCP (cnpj, anoCompra, sequencialCompra)
 * a partir de qualquer estrutura de dados de edital (API, CRM, PNCP raw).
 */
export function extractPncpParams(edital: any): PncpUrlParams | null {
  if (!edital) return null;

  // 1. Extração do número de controle PNCP
  const numControle = String(
    edital.numeroControlePNCP ||
    edital.numero_controle_pncp ||
    edital.id ||
    '',
  ).trim().replace(/^pncp-/i, '');

  // Padrão oficial PNCP: CNPJ-1-SEQUENCIAL/ANO ou CNPJ-SEQUENCIAL/ANO ou variações com traço
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

  // 2. Extração de URLs existentes
  const candidateUrl = String(
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

  // 3. Extração direta de propriedades individuais
  const rawCnpj = String(
    edital.cnpjOrgao ||
    edital.cnpj ||
    edital.buyerDocument ||
    '',
  ).replace(/\D/g, '');

  const rawAno =
    edital.anoCompra ||
    edital.ano ||
    (edital.dataPublicacao || edital.dataAbertura
      ? new Date(edital.dataPublicacao || edital.dataAbertura).getFullYear()
      : null);

  const rawSeq =
    edital.sequencialCompra ||
    edital.sequencial ||
    (edital.numeroCompra ? String(edital.numeroCompra).replace(/\D/g, '') : null);

  if (rawCnpj.length === 14 && rawAno && rawSeq) {
    return {
      cnpj: rawCnpj,
      anoCompra: Number(rawAno),
      sequencialCompra: Number(rawSeq),
    };
  }

  return null;
}

/**
 * Constrói a URL oficial verídica da contratação no portal web do PNCP:
 * https://pncp.gov.br/app/editais/{cnpj}/{ano}/{sequencial}
 */
export function buildOfficialPncpPortalUrl(edital: any): string {
  const params = extractPncpParams(edital);
  if (params) {
    return `https://pncp.gov.br/app/editais/${params.cnpj}/${params.anoCompra}/${params.sequencialCompra}`;
  }
  return 'https://pncp.gov.br/app/editais';
}

/**
 * Função resiliente para download de editais com fallback imediato para o portal oficial
 * em caso de erro 503, indisponibilidade ou ausência de anexo direto.
 */
export async function handleDownloadEdital(
  edital: any,
  options?: {
    fetchFn?: typeof fetch;
    openFn?: (url: string, target?: string) => void;
    warnFn?: typeof console.warn;
  },
): Promise<void> {
  const fetchImpl = options?.fetchFn || (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);
  const openImpl = options?.openFn || ((url: string, target = '_blank') => {
    if (typeof window !== 'undefined') window.open(url, target);
  });
  const warnImpl = options?.warnFn || console.warn;

  const urlOficialPncp = buildOfficialPncpPortalUrl(edital);

  try {
    const editalId = encodeURIComponent(edital?.id || edital?.numeroControlePNCP || '');
    const response = await fetchImpl(`/api/editais/${editalId}/download-url`);
    if (!response.ok) {
      throw new Error(`Servidor do governo instável (status ${response.status})`);
    }

    const data = await response.json();
    if (data?.downloadUrl) {
      openImpl(data.downloadUrl, '_blank');
      return;
    }

    throw new Error('Anexo indisponível');
  } catch (err) {
    // FALLBACK IMEDIATO: Se falhar ou der 503, redireciona para a página oficial do certame no PNCP
    warnImpl('[PNCP Fallback] Redirecionando para visualização no portal governamental:', err);
    openImpl(urlOficialPncp, '_blank');
  }
}

