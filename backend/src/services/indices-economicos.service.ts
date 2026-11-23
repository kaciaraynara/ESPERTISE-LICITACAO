import axios from 'axios';

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie';

export interface SerieMensalBcb {
  data: string;
  valor: number;
}

export interface IndicesEconomicosResult {
  ok: boolean;
  ms: number;
  consultadoEm: string;
  ipca: {
    ultimoMes: SerieMensalBcb | null;
    acumulado12m: number | null;
    serieRecente: SerieMensalBcb[];
  };
  igpm: {
    ultimoMes: SerieMensalBcb | null;
    acumulado12m: number | null;
    serieRecente: SerieMensalBcb[];
  };
  selic: {
    metaAnual: number | null;
    dataReferencia: string | null;
  };
  baseLegal: string;
  erro?: string;
}

function parseBcbRows(raw: unknown): SerieMensalBcb[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      data: String(item?.data || '').trim(),
      valor: Number(String(item?.valor ?? '').replace(',', '.')),
    }))
    .filter((item) => item.data.length > 0 && Number.isFinite(item.valor));
}

export function calcularAcumuladoComposto(rows: SerieMensalBcb[]): number | null {
  if (rows.length === 0) return null;
  const fator = rows.reduce((acc, r) => acc * (1 + r.valor / 100), 1);
  return Math.round(((fator - 1) * 100 + Number.EPSILON) * 100) / 100;
}

async function fetchSerieBcb(codigo: number, ultimos: number): Promise<SerieMensalBcb[]> {
  const resp = await axios.get(`${BCB_BASE}/bcdata.sgs.${codigo}/dados/ultimos/${ultimos}`, {
    params: { formato: 'json' },
    timeout: 8000,
    headers: { Accept: 'application/json', 'User-Agent': 'EXPERTISE-SaaS/1.0' },
  });
  return parseBcbRows(resp.data);
}

export async function obterIndicesEconomicosBcb(): Promise<IndicesEconomicosResult> {
  const inicio = Date.now();
  const [ipcaRes, igpmRes, selicRes] = await Promise.allSettled([
    fetchSerieBcb(433, 12),
    fetchSerieBcb(189, 12),
    fetchSerieBcb(432, 1),
  ]);

  const ipcaRows = ipcaRes.status === 'fulfilled' ? ipcaRes.value : [];
  const igpmRows = igpmRes.status === 'fulfilled' ? igpmRes.value : [];
  const selicRows = selicRes.status === 'fulfilled' ? selicRes.value : [];

  const anyOk = ipcaRows.length > 0 || igpmRows.length > 0 || selicRows.length > 0;

  return {
    ok: anyOk,
    ms: Date.now() - inicio,
    consultadoEm: new Date().toISOString(),
    ipca: {
      ultimoMes: ipcaRows.length > 0 ? ipcaRows[ipcaRows.length - 1] : null,
      acumulado12m: calcularAcumuladoComposto(ipcaRows),
      serieRecente: ipcaRows.slice(-6),
    },
    igpm: {
      ultimoMes: igpmRows.length > 0 ? igpmRows[igpmRows.length - 1] : null,
      acumulado12m: calcularAcumuladoComposto(igpmRows),
      serieRecente: igpmRows.slice(-6),
    },
    selic: {
      metaAnual: selicRows.length > 0 ? selicRows[selicRows.length - 1].valor : null,
      dataReferencia: selicRows.length > 0 ? selicRows[selicRows.length - 1].data : null,
    },
    baseLegal: 'Art. 135 da Lei 14.133/2021 — Reajuste de contratos por índices oficiais (Banco Central do Brasil / IBGE / FGV)',
    erro: anyOk ? undefined : 'Não foi possível consultar as séries do Banco Central no momento.',
  };
}
