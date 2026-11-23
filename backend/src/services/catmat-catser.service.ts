import axios from 'axios';
import { prisma } from '../database/prisma';

const COMPRASGOV_BASE = (process.env.COMPRASGOV_BASE_URL || 'https://dadosabertos.compras.gov.br').replace(/\/+$/, '');
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'EXPERTISE-SaaS/1.0',
};

export type TipoCatalogoOficial = 'TODOS' | 'MATERIAL' | 'SERVICO';

export interface CatalogoOficialItem {
  codigo: string;
  tipo: 'MATERIAL' | 'SERVICO';
  descricao: string;
  grupo: string | null;
  classe: string | null;
  pdm: string | null;
  ncm: string | null;
  unidadePadrao: string;
  ativo: boolean;
}

export interface AmostraPrecoPublico {
  id: string;
  fonte: 'COMPRASGOV_CATMAT' | 'COMPRASGOV_CATSER' | 'PNCP';
  codigoCatalogo: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  orgao: string;
  uf: string;
  modalidade: string;
  numeroControle: string;
  dataCompra: string | null;
}

export interface EstatisticasPrecoPublico {
  minimo: number;
  mediana: number;
  media: number;
  maximo: number;
}

export interface PesquisaReferenciaPrecosResult {
  termo: string;
  codigo: string | null;
  tipo: TipoCatalogoOficial;
  uf: string | null;
  totalAmostras: number;
  estatisticas: EstatisticasPrecoPublico;
  amostras: AmostraPrecoPublico[];
  itensCatalogoOficial: CatalogoOficialItem[];
  fontes: Array<{
    fonte: string;
    status: 'success' | 'empty' | 'error';
    total: number;
    mensagem?: string;
  }>;
  consultadoEm: string;
}

function onlyDigits(value: string | number | undefined | null): string {
  return String(value ?? '').replace(/\D/g, '');
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calcularEstatisticasPrecos(valoresInput: number[]): EstatisticasPrecoPublico {
  const valores = valoresInput
    .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (valores.length === 0) {
    return { minimo: 0, mediana: 0, media: 0, maximo: 0 };
  }

  const minimo = roundMoney(valores[0]);
  const maximo = roundMoney(valores[valores.length - 1]);
  const mid = Math.floor(valores.length / 2);
  const mediana =
    valores.length % 2 === 0
      ? roundMoney((valores[mid - 1] + valores[mid]) / 2)
      : roundMoney(valores[mid]);
  const soma = valores.reduce((acc, v) => acc + v, 0);
  const media = roundMoney(soma / valores.length);

  return { minimo, mediana, media, maximo };
}

export async function buscarItensCatmat(params: {
  termo?: string;
  codigoItem?: string;
  pagina?: number;
  tamanhoPagina?: number;
}): Promise<CatalogoOficialItem[]> {
  const codigo = onlyDigits(params.codigoItem);
  const termo = String(params.termo || '').trim();
  if (!codigo && termo.length < 2) return [];

  const queryParams: Record<string, string | number | boolean> = {
    pagina: Math.max(1, Number(params.pagina || 1)),
    tamanhoPagina: Math.min(50, Math.max(10, Number(params.tamanhoPagina || 20))),
    statusItem: true,
  };
  if (codigo) {
    queryParams.codigoItem = Number(codigo);
  } else {
    queryParams.descricaoItem = termo.toUpperCase();
  }

  const resp = await axios.get(`${COMPRASGOV_BASE}/modulo-material/4_consultarItemMaterial`, {
    params: queryParams,
    timeout: 10000,
    headers: DEFAULT_HEADERS,
    validateStatus: (s) => s === 200 || s === 404,
  });

  if (resp.status !== 200 || !Array.isArray(resp.data?.resultado)) {
    return [];
  }

  return resp.data.resultado.map((raw: any) => ({
    codigo: String(raw.codigoItem ?? raw.codigo ?? ''),
    tipo: 'MATERIAL' as const,
    descricao: String(raw.descricaoItem || raw.nomePdm || 'Material CATMAT').trim(),
    grupo: raw.nomeGrupo ? String(raw.nomeGrupo).trim() : null,
    classe: raw.nomeClasse ? String(raw.nomeClasse).trim() : null,
    pdm: raw.nomePdm ? String(raw.nomePdm).trim() : null,
    ncm: raw.codigoNcm ? String(raw.codigoNcm).trim() : null,
    unidadePadrao: String(raw.unidadeFornecimento || raw.siglaUnidadeFornecimento || 'UN').trim(),
    ativo: raw.statusItem !== false,
  })).filter((item: CatalogoOficialItem) => item.codigo.length > 0);
}

export async function buscarItensCatser(params: {
  termo?: string;
  codigoServico?: string;
  pagina?: number;
  tamanhoPagina?: number;
}): Promise<CatalogoOficialItem[]> {
  const codigo = onlyDigits(params.codigoServico);
  const termo = String(params.termo || '').trim().toLowerCase();
  if (!codigo && termo.length < 2) return [];

  const queryParams: Record<string, string | number | boolean> = {
    pagina: Math.max(1, Number(params.pagina || 1)),
    tamanhoPagina: codigo ? 20 : 100,
    statusServico: true,
  };
  if (codigo) {
    queryParams.codigoServico = Number(codigo);
  }

  const resp = await axios.get(`${COMPRASGOV_BASE}/modulo-servico/6_consultarItemServico`, {
    params: queryParams,
    timeout: 10000,
    headers: DEFAULT_HEADERS,
    validateStatus: (s) => s === 200 || s === 404,
  });

  if (resp.status !== 200 || !Array.isArray(resp.data?.resultado)) {
    return [];
  }

  const tokens = termo.split(/\s+/).filter((t) => t.length >= 2);
  const mapped: CatalogoOficialItem[] = resp.data.resultado
    .map((raw: any) => {
      const descParts = [raw.nomeServico, raw.descricaoServico, raw.nomeClasse, raw.nomeGrupo]
        .filter(Boolean)
        .map((s) => String(s).trim());
      return {
        codigo: String(raw.codigoServico ?? raw.codigo ?? ''),
        tipo: 'SERVICO' as const,
        descricao: descParts[0] || 'Serviço CATSER',
        grupo: raw.nomeGrupo ? String(raw.nomeGrupo).trim() : null,
        classe: raw.nomeClasse ? String(raw.nomeClasse).trim() : null,
        pdm: raw.nomeSubclasse ? String(raw.nomeSubclasse).trim() : null,
        ncm: raw.codigoCpc ? `CPC ${raw.codigoCpc}` : null,
        unidadePadrao: 'UN',
        ativo: raw.statusServico !== false,
      };
    })
    .filter((item: CatalogoOficialItem) => item.codigo.length > 0);

  if (!codigo && tokens.length > 0) {
    const filtered = mapped.filter((item) => {
      const hay = `${item.descricao} ${item.grupo || ''} ${item.classe || ''}`.toLowerCase();
      return tokens.some((tk) => hay.includes(tk));
    });
    return filtered.slice(0, Number(params.tamanhoPagina || 20));
  }

  return mapped.slice(0, Number(params.tamanhoPagina || 20));
}

function mapComprasGovPrecoRows(
  rows: any[],
  fonte: 'COMPRASGOV_CATMAT' | 'COMPRASGOV_CATSER',
  codigoFallback: string,
): AmostraPrecoPublico[] {
  return rows
    .map((x: any, idx: number): AmostraPrecoPublico | null => {
      const valorUnitario = Number(
        x.precoUnitario ?? x.valorUnitario ?? x.valorUnitarioHomologado ?? x.valorCalculado ?? 0,
      );
      if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) return null;

      return {
        id: `${fonte}-${x.idCompra || x.idItemCompra || codigoFallback}-${idx}`,
        fonte,
        codigoCatalogo: String(x.codigoItemCatalogo || codigoFallback || ''),
        descricao: String(x.descricaoItem || x.nomePdm || x.nomeClasse || 'Item Compras.gov.br').trim(),
        unidade: String(x.siglaUnidadeMedida || x.siglaUnidadeFornecimento || x.nomeUnidadeMedida || 'UN').trim(),
        quantidade: Number(x.quantidade || 1) || 1,
        valorUnitario: roundMoney(valorUnitario),
        orgao: String(x.nomeUasg || x.nomeOrgao || (x.codigoUasg ? `UASG ${x.codigoUasg}` : 'Órgão Federal / SIASG')).trim(),
        uf: String(x.estado || x.uf || '').trim().toUpperCase(),
        modalidade: `SIASG / Modalidade ${x.modalidade || 'Pregão'}`,
        numeroControle: String(x.idCompra || ''),
        dataCompra: x.dataCompra || x.dataResultado || x.dataHoraAtualizacaoCompra || null,
      };
    })
    .filter((item): item is AmostraPrecoPublico => item !== null);
}

export async function consultarPrecosCatmat(codigoItem: string, uf?: string): Promise<AmostraPrecoPublico[]> {
  const cod = onlyDigits(codigoItem);
  if (!cod) return [];

  const ufNorm = uf && uf.trim().length === 2 && uf.trim().toUpperCase() !== 'TODOS'
    ? uf.trim().toUpperCase()
    : undefined;

  try {
    const resp = await axios.get(`${COMPRASGOV_BASE}/modulo-pesquisa-preco/1_consultarMaterial`, {
      params: {
        tipo: 'ITEM',
        codigo: Number(cod),
        pagina: 1,
        tamanhoPagina: 25,
        ...(ufNorm ? { estado: ufNorm } : {}),
      },
      timeout: 10000,
      headers: DEFAULT_HEADERS,
      validateStatus: (s) => s === 200 || s === 404,
    });

    if (resp.status === 200 && Array.isArray(resp.data?.resultado) && resp.data.resultado.length > 0) {
      return mapComprasGovPrecoRows(resp.data.resultado, 'COMPRASGOV_CATMAT', cod);
    }
  } catch {
    // Segue para endpoint de detalhe oficial
  }

  try {
    const fallback = await axios.get(`${COMPRASGOV_BASE}/modulo-pesquisa-preco/2_consultarMaterialDetalhe`, {
      params: {
        codigoItemCatalogo: Number(cod),
        pagina: 1,
        tamanhoPagina: 25,
      },
      timeout: 10000,
      headers: DEFAULT_HEADERS,
      validateStatus: (s) => s === 200 || s === 404,
    });

    if (fallback.status === 200 && Array.isArray(fallback.data?.resultado)) {
      return mapComprasGovPrecoRows(fallback.data.resultado, 'COMPRASGOV_CATMAT', cod);
    }
  } catch {
    return [];
  }

  return [];
}

export async function consultarPrecosCatser(codigoServico: string, uf?: string): Promise<AmostraPrecoPublico[]> {
  const cod = onlyDigits(codigoServico);
  if (!cod) return [];

  const ufNorm = uf && uf.trim().length === 2 && uf.trim().toUpperCase() !== 'TODOS'
    ? uf.trim().toUpperCase()
    : undefined;

  const resp = await axios.get(`${COMPRASGOV_BASE}/modulo-pesquisa-preco/3_consultarServico`, {
    params: {
      codigoItemCatalogo: Number(cod),
      pagina: 1,
      tamanhoPagina: 25,
      ...(ufNorm ? { estado: ufNorm } : {}),
    },
    timeout: 10000,
    headers: DEFAULT_HEADERS,
    validateStatus: (s) => s === 200 || s === 404,
  });

  if (resp.status !== 200 || !Array.isArray(resp.data?.resultado)) {
    return [];
  }

  return mapComprasGovPrecoRows(resp.data.resultado, 'COMPRASGOV_CATSER', cod);
}

async function consultarAmostrasPncpBanco(termo: string, uf?: string): Promise<AmostraPrecoPublico[]> {
  if (!termo || termo.trim().length < 2) return [];
  if (typeof prisma?.procurementItem?.findMany !== 'function') return [];

  const ufNorm = uf && uf.trim().length === 2 && uf.trim().toUpperCase() !== 'TODOS'
    ? uf.trim().toUpperCase()
    : undefined;

  const rows = await prisma.procurementItem.findMany({
    where: {
      description: { contains: termo.trim(), mode: 'insensitive' },
      estimatedUnitValue: { gt: 0 },
      ...(ufNorm ? { procurementNotice: { uf: ufNorm } } : {}),
    },
    take: 40,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      description: true,
      unit: true,
      quantity: true,
      estimatedUnitValue: true,
      procurementNotice: {
        select: {
          buyerName: true,
          uf: true,
          modality: true,
          externalId: true,
          publishedAt: true,
        },
      },
    },
  });

  return rows
    .map((i): AmostraPrecoPublico | null => {
      const val = Number(i.estimatedUnitValue);
      if (!Number.isFinite(val) || val <= 0) return null;
      return {
        id: i.id,
        fonte: 'PNCP',
        codigoCatalogo: null,
        descricao: i.description,
        unidade: i.unit || 'UN',
        quantidade: Number(i.quantity || 1) || 1,
        valorUnitario: roundMoney(val),
        orgao: i.procurementNotice?.buyerName || 'Órgão Público',
        uf: i.procurementNotice?.uf || '',
        modalidade: i.procurementNotice?.modality || 'PNCP',
        numeroControle: i.procurementNotice?.externalId || '',
        dataCompra: i.procurementNotice?.publishedAt ? new Date(i.procurementNotice.publishedAt).toISOString() : null,
      };
    })
    .filter((x): x is AmostraPrecoPublico => x !== null);
}

export async function pesquisarReferenciaPrecos(params: {
  termo?: string;
  codigo?: string;
  tipo?: TipoCatalogoOficial;
  uf?: string;
}): Promise<PesquisaReferenciaPrecosResult> {
  const termo = String(params.termo || '').trim();
  const codigo = onlyDigits(params.codigo || (/^\d{3,9}$/.test(termo) ? termo : ''));
  const tipo: TipoCatalogoOficial = params.tipo === 'MATERIAL' || params.tipo === 'SERVICO' ? params.tipo : 'TODOS';
  const uf = params.uf && params.uf.trim().length === 2 ? params.uf.trim().toUpperCase() : null;

  const buscaTermo = /^\d{3,9}$/.test(termo) ? '' : termo;
  const fontes: PesquisaReferenciaPrecosResult['fontes'] = [];

  const [catmatRes, catserRes, pncpRes, precoCatmatDiretoRes, precoCatserDiretoRes] = await Promise.allSettled([
    tipo !== 'SERVICO'
      ? buscarItensCatmat({ termo: buscaTermo, codigoItem: codigo || undefined, tamanhoPagina: 15 })
      : Promise.resolve([]),
    tipo !== 'MATERIAL'
      ? buscarItensCatser({ termo: buscaTermo, codigoServico: codigo || undefined, tamanhoPagina: 15 })
      : Promise.resolve([]),
    buscaTermo ? consultarAmostrasPncpBanco(buscaTermo, uf || undefined) : Promise.resolve([]),
    codigo && tipo !== 'SERVICO' ? consultarPrecosCatmat(codigo, uf || undefined) : Promise.resolve([]),
    codigo && tipo !== 'MATERIAL' ? consultarPrecosCatser(codigo, uf || undefined) : Promise.resolve([]),
  ]);

  const catmatItens = catmatRes.status === 'fulfilled' ? catmatRes.value : [];
  const catserItens = catserRes.status === 'fulfilled' ? catserRes.value : [];
  const itensCatalogoOficial = [...catmatItens, ...catserItens];

  let amostrasCatmat = precoCatmatDiretoRes.status === 'fulfilled' ? precoCatmatDiretoRes.value : [];
  let amostrasCatser = precoCatserDiretoRes.status === 'fulfilled' ? precoCatserDiretoRes.value : [];

  // Se o usuário buscou apenas por termo textual e encontramos código CATMAT/CATSER no catálogo oficial,
  // busca automaticamente os preços praticados do primeiro item correspondente.
  if (!codigo && amostrasCatmat.length === 0 && catmatItens.length > 0) {
    amostrasCatmat = await consultarPrecosCatmat(catmatItens[0].codigo, uf || undefined).catch(() => []);
  }
  if (!codigo && amostrasCatser.length === 0 && catserItens.length > 0) {
    amostrasCatser = await consultarPrecosCatser(catserItens[0].codigo, uf || undefined).catch(() => []);
  }

  const amostrasPncp = pncpRes.status === 'fulfilled' ? pncpRes.value : [];

  if (tipo !== 'SERVICO') {
    fontes.push({
      fonte: 'Compras.gov CATMAT',
      status: catmatRes.status === 'rejected' && precoCatmatDiretoRes.status === 'rejected'
        ? 'error'
        : amostrasCatmat.length > 0 || catmatItens.length > 0
          ? 'success'
          : 'empty',
      total: amostrasCatmat.length,
    });
  }
  if (tipo !== 'MATERIAL') {
    fontes.push({
      fonte: 'Compras.gov CATSER',
      status: catserRes.status === 'rejected' && precoCatserDiretoRes.status === 'rejected'
        ? 'error'
        : amostrasCatser.length > 0 || catserItens.length > 0
          ? 'success'
          : 'empty',
      total: amostrasCatser.length,
    });
  }
  if (buscaTermo) {
    fontes.push({
      fonte: 'PNCP Oficial',
      status: pncpRes.status === 'rejected' ? 'error' : amostrasPncp.length > 0 ? 'success' : 'empty',
      total: amostrasPncp.length,
    });
  }

  const amostras = [...amostrasCatmat, ...amostrasCatser, ...amostrasPncp].slice(0, 40);
  const estatisticas = calcularEstatisticasPrecos(amostras.map((a) => a.valorUnitario));

  return {
    termo: termo || codigo,
    codigo: codigo || null,
    tipo,
    uf,
    totalAmostras: amostras.length,
    estatisticas,
    amostras,
    itensCatalogoOficial,
    fontes,
    consultadoEm: new Date().toISOString(),
  };
}
