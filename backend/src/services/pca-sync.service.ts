import axios from 'axios';
import { prisma } from '../database/prisma';
import { expandirTermosCnae } from './cnae-dictionary.service';

const PNCP_BASE = (process.env.PNCP_CONSULTA_BASE_URL || 'https://pncp.gov.br/api/consulta/v1').replace(/\/+$/, '');

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

export async function syncPcaRecentDays(options: { daysBack?: number; maxPagesPerDay?: number } = {}): Promise<{
  fetched: number;
  persisted: number;
}> {
  const daysBack = Math.max(1, Math.min(10, options.daysBack ?? 3));
  const maxPages = Math.max(1, Math.min(20, options.maxPagesPerDay ?? 6));
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
    // Segue sem enriquecimento prévio
  }

  for (let offset = 0; offset < daysBack; offset++) {
    const target = new Date();
    target.setUTCDate(target.getUTCDate() - offset);
    const ymd = toYmd(target);

    for (let pagina = 1; pagina <= maxPages; pagina++) {
      try {
        const resp = await axios.get(`${PNCP_BASE}/pca/atualizacao`, {
          params: { dataInicio: ymd, dataFim: ymd, pagina, tamanhoPagina: 500 },
          timeout: 30000,
          validateStatus: (s) => s === 200 || s === 204,
        });

        if (resp.status === 204 || !Array.isArray(resp.data?.data) || resp.data.data.length === 0) {
          break;
        }

        const registros = resp.data.data as any[];
        fetched += registros.length;

        for (const reg of registros) {
          const pncpId = String(reg.idPcaPncp || reg.numeroControlePcaPncp || '').trim();
          if (!pncpId) continue;

          const ano = Number(reg.anoPca || new Date().getFullYear());
          const cnpj = String(reg.orgaoEntidadeCnpj || reg.orgaoEntidade?.cnpj || '').replace(/\D/g, '');
          const buyerName = String(reg.orgaoEntidadeRazaoSocial || reg.orgaoEntidade?.razaoSocial || 'Órgão Público').trim();
          const geo = cnpj ? knownBuyers.get(cnpj) : undefined;
          const uf = (reg.unidadeOrgao?.ufSigla || geo?.uf || inferirUfNome(buyerName) || null) as string | null;
          const municipality = (reg.unidadeOrgao?.municipioNome || geo?.municipality || null) as string | null;
          const linkPcaPncp = montarLinkPca(pncpId, cnpj, ano);

          const itens = Array.isArray(reg.itens) && reg.itens.length > 0 ? reg.itens : [reg];

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

          for (let idx = 0; idx < itens.length; idx++) {
            const it = itens[idx];
            const itemNumber = Number(it.numeroItem || idx + 1);
            const description = limparDescricao(it.descricao || it.objeto || reg.objeto || '');
            const category = it.categoriaItemPcaNome || it.categoriaItemPca || null;
            const rawDes = it.dataDesejada || reg.dataDesejada || null;
            const desiredDate = rawDes && !isNaN(new Date(rawDes).getTime()) ? new Date(rawDes) : null;
            const estimatedValue = it.valorTotal != null ? Number(it.valorTotal) : (reg.valorTotalEstimado != null ? Number(reg.valorTotalEstimado) : null);

            await (prisma as any).annualProcurementPlanItem.upsert({
              where: { pncpId_itemNumber: { pncpId, itemNumber } },
              create: {
                planId: plan.id,
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
                estimatedValue: estimatedValue != null && !isNaN(estimatedValue) ? estimatedValue : null,
                linkPcaPncp,
              },
              update: {
                buyerName,
                uf: uf ?? undefined,
                municipality: municipality ?? undefined,
                category: category ? String(category) : undefined,
                description,
                desiredDate,
                estimatedValue: estimatedValue != null && !isNaN(estimatedValue) ? estimatedValue : undefined,
              },
            });
            persisted++;
          }
        }

        if (registros.length < 500) break;
      } catch {
        break;
      }
    }
  }

  return { fetched, persisted };
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

  if (totalInDb === 0 || filtros.forceRefresh) {
    await syncPcaRecentDays({ daysBack: filtros.forceRefresh ? 3 : 2, maxPagesPerDay: 4 });
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
    termos.push(...exp.slice(0, 5));
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

  const items = rows.map((r: any) => ({
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
    valorTotalEstimado: r.estimatedValue != null ? Number(r.estimatedValue) : null,
    linkPcaPncp: r.linkPcaPncp || `https://pncp.gov.br/app/pca?ano=${r.year}`,
    dataPublicacao: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    dataAtualizacao: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  }));

  return {
    items,
    total,
    pagina: page,
    tamanhoPagina: size,
    totalPaginas: Math.max(1, Math.ceil(total / size)),
  };
}