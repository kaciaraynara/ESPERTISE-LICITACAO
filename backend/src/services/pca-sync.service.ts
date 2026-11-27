import axios from 'axios';
import { prisma } from '../database/prisma';
import { expandirTermosCnae } from './cnae-dictionary.service';

const PNCP_BASE = (process.env.PNCP_CONSULTA_BASE_URL || 'https://pncp.gov.br/api/consulta/v1').replace(/\/+$/, '');
const PCA_PAGE_SIZE = 50;
const UPSERT_CHUNK_SIZE = 15;
const DEFAULT_PCA_CLASSES = [2, 7, 8, 4];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function inferirUfNome(nome: string): string | null {
  const up = nome.toUpperCase();
  const match = up.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  return match ? match[1] : null;
}

function limparDescricao(raw: string): string {
  return String(raw || '').replace(/^DESCRI[ÇC][ÃA]O:\s*/i, '').trim() || 'Item previsto no PCA';
}

function montarLinkPca(pncpId: string, cnpj: string, ano: number): string {
  const m = String(pncpId || '').match(/^(\d{14})-\d-(\d+)\/(\d{4})$/);
  if (m) return `https://pncp.gov.br/app/pca/${m[1]}/${m[3]}/${Number(m[2])}`;
  return `https://pncp.gov.br/app/pca?orgao=${cnpj}&ano=${ano}`;
}

function countBatchItems(registros: any[]): number {
  return registros.reduce(
    (acc, reg) => acc + (Array.isArray(reg?.itens) && reg.itens.length > 0 ? reg.itens.length : 1),
    0,
  );
}

function shouldStopPagination(responseData: any, registros: any[], pageSize: number, currentPage: number): boolean {
  if (registros.length === 0) return true;
  if (typeof responseData?.paginasRestantes === 'number') {
    return responseData.paginasRestantes <= 0;
  }
  if (typeof responseData?.totalPaginas === 'number' && responseData.totalPaginas > 0) {
    return currentPage >= responseData.totalPaginas;
  }
  return registros.length < pageSize && countBatchItems(registros) < pageSize;
}

export type JanelaTaticaPca = 'PREVISTA_ANTERIOR' | 'IMEDIATA' | 'ESTRATEGICA' | 'PLANEJAMENTO';

export function classificarJanelaTaticaPca(
  dataDesejada?: string | Date | null,
  referenceNowMs = Date.now(),
): {
  diasAtePrevisao: number | null;
  janelaTatica: JanelaTaticaPca;
  insightEstrategico: string;
} {
  let diasAtePrevisao: number | null = null;
  if (dataDesejada) {
    const dt = dataDesejada instanceof Date ? dataDesejada : new Date(dataDesejada);
    if (!Number.isNaN(dt.getTime())) {
      diasAtePrevisao = Math.ceil((dt.getTime() - referenceNowMs) / 86400000);
    }
  }

  if (diasAtePrevisao !== null && diasAtePrevisao < 0) {
    return {
      diasAtePrevisao,
      janelaTatica: 'PREVISTA_ANTERIOR',
      insightEstrategico:
        'Data prevista original já transcorrida: verifique no Radar de Licitações se o edital foi publicado pelo órgão ou se houve reprogramação.',
    };
  }

  if (diasAtePrevisao !== null && diasAtePrevisao <= 30) {
    return {
      diasAtePrevisao,
      janelaTatica: 'IMEDIATA',
      insightEstrategico:
        'Janela crítica (<=30 dias): o edital pode sair a qualquer momento. Feche cotações com fornecedores e valide certidões no Cofre agora.',
    };
  }

  if (diasAtePrevisao !== null && diasAtePrevisao <= 90) {
    return {
      diasAtePrevisao,
      janelaTatica: 'ESTRATEGICA',
      insightEstrategico:
        'Janela ideal de preparação (31 a 90 dias): antecipe atestados técnicos, estude contratações anteriores do órgão e monte sua planilha base.',
    };
  }

  return {
    diasAtePrevisao,
    janelaTatica: 'PLANEJAMENTO',
    insightEstrategico:
      'Planejamento antecipado (>90 dias): monitore o órgão no Radar para ser avisado assim que o Termo de Referência for publicado.',
  };
}

let pcaSyncInFlight: Promise<{ fetched: number; persisted: number }> | null = null;
let pcaSweepClassIndex = 0;

export async function syncPcaRecentDays(options: {
  daysBack?: number;
  maxPagesPerDay?: number;
  maxCatalogPagesPerClass?: number;
} = {}): Promise<{
  fetched: number;
  persisted: number;
}> {
  if (pcaSyncInFlight) return pcaSyncInFlight;

  pcaSyncInFlight = (async () => {
    const daysBack = Math.max(1, Math.min(10, options.daysBack ?? 3));
    const maxPages = Math.max(1, Math.min(20, options.maxPagesPerDay ?? 4));
    const maxCatalogPages = Math.max(1, Math.min(10, options.maxCatalogPagesPerClass ?? 3));
    const pageSize = PCA_PAGE_SIZE;
    let fetched = 0;
    let persisted = 0;

    const knownBuyers = new Map<string, { uf: string | null; municipality: string | null }>();
    try {
      const notices = await prisma.procurementNotice.findMany({
        where: { buyerDocument: { not: null }, uf: { not: null } },
        select: { buyerDocument: true, uf: true, municipality: true },
        distinct: ['buyerDocument'],
        take: 5000,
      });
      for (const n of notices) {
        if (n.buyerDocument) {
          knownBuyers.set(n.buyerDocument.replace(/\D/g, ''), { uf: n.uf, municipality: n.municipality });
        }
      }
    } catch {
      // Segue sem enriquecimento prévio caso notices falhem
    }

    const persistRegistros = async (registros: any[]) => {
      const planCache = new Map<string, string>();
      const pendingItems: Array<{
        planId: string;
        pncpId: string;
        itemNumber: number;
        year: number;
        buyerName: string;
        buyerDocument: string;
        uf: string | null;
        municipality: string | null;
        category: string | null;
        description: string;
        desiredDate: Date | null;
        estimatedValue: number | null;
        linkPcaPncp: string;
      }> = [];

      for (const reg of registros) {
        const pncpId = String(reg?.idPcaPncp || reg?.numeroControlePcaPncp || '').trim();
        if (!pncpId) continue;

        const ano = Number(reg.anoPca || new Date().getFullYear());
        const cnpj = String(reg.orgaoEntidadeCnpj || reg.orgaoEntidade?.cnpj || '').replace(/\D/g, '');
        const buyerName = String(reg.orgaoEntidadeRazaoSocial || reg.orgaoEntidade?.razaoSocial || 'Órgão Público').trim();
        const geo = cnpj ? knownBuyers.get(cnpj) : undefined;
        const uf = (reg.unidadeOrgao?.ufSigla || reg.ufSigla || geo?.uf || inferirUfNome(buyerName) || null) as string | null;
        const municipality = (reg.unidadeOrgao?.municipioNome || reg.municipioNome || geo?.municipality || null) as string | null;
        const linkPcaPncp = montarLinkPca(pncpId, cnpj, ano);
        const itens = Array.isArray(reg.itens) && reg.itens.length > 0 ? reg.itens : [reg];

        let planId = planCache.get(pncpId);
        if (!planId) {
          const plan = await prisma.annualProcurementPlan.upsert({
            where: { pncpId },
            create: {
              pncpId,
              year: ano,
              buyerName,
              buyerDocument: cnpj || '00000000000000',
              uf,
              municipality,
              totalItems: itens.length,
              totalValue: reg.valorTotalEstimado != null ? Number(reg.valorTotalEstimado) : null,
            },
            update: {
              buyerName,
              uf: uf ?? undefined,
              municipality: municipality ?? undefined,
              totalItems: itens.length,
            },
          });
          planId = plan.id;
          planCache.set(pncpId, planId);
        }

        const seenItemNum = new Set<number>();
        for (let idx = 0; idx < itens.length; idx++) {
          const it = itens[idx];
          let itemNumber = Number(it.numeroItem || idx + 1);
          while (seenItemNum.has(itemNumber)) {
            itemNumber += 1;
          }
          seenItemNum.add(itemNumber);

          const description = limparDescricao(
            it.descricaoItem ||
              it.descricao ||
              it.especificacao ||
              it.materialOuServicoNome ||
              it.classificacaoSuperiorNome ||
              it.classeNome ||
              reg.objeto ||
              it.grupoNome ||
              '',
          );
          const category =
            it.categoriaItemPcaNome || it.categoriaItemPca || it.classificacaoSuperiorNome || it.grupoNome || null;
          const rawDes = it.dataDesejada || reg.dataDesejada || null;
          const desiredDate = rawDes && !isNaN(new Date(rawDes).getTime()) ? new Date(rawDes) : null;
          const rawVal = it.valorTotal ?? reg.valorTotalEstimado ?? null;
          const estimatedValue = rawVal != null && !isNaN(Number(rawVal)) ? Number(rawVal) : null;

          pendingItems.push({
            planId,
            pncpId,
            itemNumber,
            year: ano,
            buyerName,
            buyerDocument: cnpj || '00000000000000',
            uf,
            municipality,
            category: category ? String(category) : null,
            description,
            desiredDate,
            estimatedValue,
            linkPcaPncp,
          });
        }
      }

      const itemRepo = (prisma as any).annualProcurementPlanItem;
      for (let offset = 0; offset < pendingItems.length; offset += UPSERT_CHUNK_SIZE) {
        const chunk = pendingItems.slice(offset, offset + UPSERT_CHUNK_SIZE);
        await Promise.all(
          chunk.map((item) =>
            itemRepo.upsert({
              where: { pncpId_itemNumber: { pncpId: item.pncpId, itemNumber: item.itemNumber } },
              create: item,
              update: {
                buyerName: item.buyerName,
                uf: item.uf ?? undefined,
                municipality: item.municipality ?? undefined,
                category: item.category ?? undefined,
                description: item.description,
                desiredDate: item.desiredDate,
                estimatedValue: item.estimatedValue ?? undefined,
              },
            }),
          ),
        );
        persisted += chunk.length;
      }
    };

    // 1. Tenta dias recentes a partir de hoje com janela dataInicio < dataFim (D-1..D), tamanhoPagina=50 e condição real de parada
    for (let offset = 0; offset < daysBack; offset++) {
      const targetEnd = new Date();
      targetEnd.setUTCDate(targetEnd.getUTCDate() - offset);
      const targetStart = new Date(targetEnd.getTime());
      targetStart.setUTCDate(targetStart.getUTCDate() - 1);
      const dataInicio = toYmd(targetStart);
      const dataFim = toYmd(targetEnd);

      for (let pagina = 1; pagina <= maxPages; pagina++) {
        try {
          const resp = await axios.get(`${PNCP_BASE}/pca/atualizacao`, {
            params: { dataInicio, dataFim, pagina, tamanhoPagina: pageSize },
            timeout: 25000,
            headers: { Accept: 'application/json', 'User-Agent': 'EXPERTISE-SaaS/1.0' },
            validateStatus: (s) => s === 200 || s === 204,
          });
          if (resp.status === 204 || !Array.isArray(resp.data?.data) || resp.data.data.length === 0) break;
          fetched += resp.data.data.length;
          await persistRegistros(resp.data.data);
          if (shouldStopPagination(resp.data, resp.data.data, pageSize, pagina)) break;
        } catch {
          break;
        }
      }
    }

    // 2. Se base local ainda estiver enxuta, popula via catálogo oficial /pca/ multi-classificação + janelas âncora ativas
    const anoAtual = Math.max(2026, new Date().getFullYear());
    const currentTotal = await (prisma as any).annualProcurementPlanItem.count({ where: { year: { gte: anoAtual } } }).catch(() => 0);
    if (currentTotal < 500) {
      const anosCatalogo = [anoAtual, anoAtual + 1];
      const orderedClasses = DEFAULT_PCA_CLASSES.map(
        (_, idx) => DEFAULT_PCA_CLASSES[(pcaSweepClassIndex + idx) % DEFAULT_PCA_CLASSES.length],
      );
      pcaSweepClassIndex = (pcaSweepClassIndex + 1) % DEFAULT_PCA_CLASSES.length;

      for (const anoTarget of anosCatalogo) {
        if (persisted >= 400) break;

        for (const codigoClassificacao of orderedClasses) {
          if (persisted >= 400) break;

          for (let pagina = 1; pagina <= maxCatalogPages; pagina++) {
            try {
              const respCat = await axios.get(`${PNCP_BASE}/pca/`, {
                params: {
                  anoPca: anoTarget,
                  codigoClassificacaoSuperior: codigoClassificacao,
                  pagina,
                  tamanhoPagina: pageSize,
                },
                timeout: 15000,
                headers: { Accept: 'application/json', 'User-Agent': 'EXPERTISE-SaaS/1.0' },
                validateStatus: (s) => s === 200 || s === 204,
              });
              if (respCat.status !== 200 || !Array.isArray(respCat.data?.data) || respCat.data.data.length === 0) {
                break;
              }
              fetched += respCat.data.data.length;
              await persistRegistros(respCat.data.data);
              if (shouldStopPagination(respCat.data, respCat.data.data, pageSize, pagina) || persisted >= 400) {
                break;
              }
              await sleep(250);
            } catch {
              // Timeout/429 em uma classificação não bloqueia as demais
              break;
            }
          }
        }
      }

      if (persisted < 200) {
        const janelasAncora2026: Array<[string, string]> = [
          ['20261020', '20261021'],
          ['20260401', '20260402'],
          ['20260302', '20260303'],
        ];
        for (const [dataInicio, dataFim] of janelasAncora2026) {
          if (persisted >= 300) break;
          try {
            const resp = await axios.get(`${PNCP_BASE}/pca/atualizacao`, {
              params: { dataInicio, dataFim, pagina: 1, tamanhoPagina: pageSize },
              timeout: 25000,
              headers: { Accept: 'application/json', 'User-Agent': 'EXPERTISE-SaaS/1.0' },
              validateStatus: (s) => s === 200 || s === 204,
            });
            if (resp.status === 200 && Array.isArray(resp.data?.data) && resp.data.data.length > 0) {
              fetched += resp.data.data.length;
              await persistRegistros(resp.data.data);
            }
          } catch {
            // Continua próxima janela
          }
        }
      }
    }

    return { fetched, persisted };
  })().finally(() => {
    pcaSyncInFlight = null;
  });

  return pcaSyncInFlight;
}

export async function queryPcaFromDb(filtros: {
  anoPca?: number;
  uf?: string;
  palavraChave?: string;
  cnae?: string;
  pagina?: number;
  tamanhoPagina?: number;
  forceRefresh?: boolean;
}) {
  const repo = (prisma as any).annualProcurementPlanItem;
  const totalInDb = await repo.count();

  if (filtros.forceRefresh) {
    await syncPcaRecentDays({ daysBack: 3, maxPagesPerDay: 2, maxCatalogPagesPerClass: 3 });
  } else if (totalInDb === 0) {
    // Primeira carga: aguarda até 8s e deixa o restante completar em segundo plano sem dar timeout HTTP
    await Promise.race([
      syncPcaRecentDays({ daysBack: 1, maxPagesPerDay: 1, maxCatalogPagesPerClass: 2 }).catch(() => ({
        fetched: 0,
        persisted: 0,
      })),
      sleep(8000),
    ]);
  } else if (totalInDb < 300) {
    // Dispara backfill nacional sem bloquear a requisição do usuário
    void syncPcaRecentDays({ daysBack: 2, maxPagesPerDay: 2, maxCatalogPagesPerClass: 3 }).catch(() => undefined);
  }

  const page = Math.max(1, Number(filtros.pagina || 1));
  const size = Math.max(10, Math.min(100, Number(filtros.tamanhoPagina || 20)));
  const and: any[] = [];

  if (filtros.anoPca) {
    and.push({ year: Number(filtros.anoPca) });
  }
  if (filtros.uf && filtros.uf.trim().toUpperCase() !== 'TODOS') {
    and.push({ uf: { equals: filtros.uf.trim().toUpperCase(), mode: 'insensitive' } });
  }

  const termos: string[] = [];
  if (filtros.palavraChave?.trim()) termos.push(filtros.palavraChave.trim());
  if (filtros.cnae?.trim()) {
    const exp = expandirTermosCnae(filtros.cnae.trim());
    termos.push(...exp.slice(0, 8));
  }
  if (termos.length > 0) {
    and.push({
      OR: termos.flatMap((t) => [
        { description: { contains: t, mode: 'insensitive' } },
        { buyerName: { contains: t, mode: 'insensitive' } },
        { category: { contains: t, mode: 'insensitive' } },
      ]),
    });
  }

  const where = and.length > 0 ? { AND: and } : {};
  const [total, rows] = await Promise.all([
    repo.count({ where }),
    repo.findMany({
      where,
      orderBy: [{ desiredDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  const nowMs = Date.now();
  const items = rows.map((r: any) => {
    const tatica = classificarJanelaTaticaPca(r.desiredDate, nowMs);
    return {
      id: r.id,
      idPcaPncp: r.pncpId,
      anoPca: r.year,
      orgaoNome: r.buyerName,
      orgaoCnpj: r.buyerDocument,
      uf: r.uf,
      municipio: r.municipality,
      categoria: r.category,
      descricaoItem: r.description,
      dataDesejada: r.desiredDate ? new Date(r.desiredDate).toISOString() : null,
      diasAtePrevisao: tatica.diasAtePrevisao,
      janelaTatica: tatica.janelaTatica,
      insightEstrategico: tatica.insightEstrategico,
      valorTotalEstimado: r.estimatedValue != null ? Number(r.estimatedValue) : null,
      linkPcaPncp: r.linkPcaPncp || `https://pncp.gov.br/app/pca?ano=${r.year}`,
      dataPublicacao: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      dataAtualizacao: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    };
  });

  return {
    items,
    total,
    pagina: page,
    tamanhoPagina: size,
    totalPaginas: Math.max(1, Math.ceil(total / size)),
  };
}
