import { Response } from 'express';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';

interface GlobalRadarCache {
  statsRadar: {
    editaisAtivos: number;
    valorTotalEstimado: number;
    orgaosCompradores: number;
  };
  recomendacoes: Array<{
    id: string;
    orgao: string | null;
    uf: string | null;
    objeto: string;
    valor: number | null;
    modalidade: string | null;
  }>;
  expiresAt: number;
}

let globalRadarCache: GlobalRadarCache | null = null;
const RADAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache para proteger o pool PostgreSQL em alta concorrência

async function getGlobalRadarSummary(): Promise<Omit<GlobalRadarCache, 'expiresAt'>> {
  if (globalRadarCache && globalRadarCache.expiresAt > Date.now()) {
    return {
      statsRadar: globalRadarCache.statsRadar,
      recomendacoes: globalRadarCache.recomendacoes,
    };
  }

  let totalEditaisAtivos = 0;
  let valorTotalEstimado = 0;
  let orgaosCompradores = 0;
  let recomendacoesRaw: any[] = [];

  try {
    const [count, aggr, buyers, recs] = await Promise.all([
      prisma.procurementNotice.count(),
      prisma.procurementNotice.aggregate({ _sum: { estimatedValue: true } }),
      prisma.procurementNotice.groupBy({ by: ['buyerName'] }),
      prisma.procurementNotice.findMany({
        take: 4,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          buyerName: true,
          uf: true,
          object: true,
          estimatedValue: true,
          modality: true,
        },
      }),
    ]);

    totalEditaisAtivos = typeof count === 'number' ? count : 0;
    valorTotalEstimado = aggr?._sum?.estimatedValue != null ? Number(aggr._sum.estimatedValue) : 0;
    orgaosCompradores = Array.isArray(buyers) ? buyers.filter((b: any) => Boolean(b.buyerName)).length : 0;
    recomendacoesRaw = Array.isArray(recs) ? recs : [];
  } catch {
    // Fallback resiliente
  }

  const summary = {
    statsRadar: {
      editaisAtivos: totalEditaisAtivos,
      valorTotalEstimado,
      orgaosCompradores,
    },
    recomendacoes: recomendacoesRaw.map((rec: any) => ({
      id: rec.id,
      orgao: rec.buyerName,
      uf: rec.uf,
      objeto: rec.object,
      valor: rec.estimatedValue ? Number(rec.estimatedValue) : null,
      modalidade: rec.modality,
    })),
  };

  globalRadarCache = {
    ...summary,
    expiresAt: Date.now() + RADAR_CACHE_TTL_MS,
  };

  return summary;
}

export class DashboardController {
  async getMetrics(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const [company, globalSummary] = await Promise.all([
        resolveAuthorizedCompany(userId, req.companyId),
        getGlobalRadarSummary(),
      ]);

      // Se a empresa ainda não tiver sido criada para este usuário
      if (!company) {
        return res.json({
          success: true,
          data: {
            isContaNova: true,
            valorTotalEmDisputa: 0,
            taxaSucesso: 0,
            atencaoImediataCount: 0,
            certidoesVencendoCount: 0,
            prazosUrgentesCount: 0,
            catalogItemsCount: 0,
            propostasCriadas: 0,
            editaisMonitorados: 0,
            analisesNulidade: 0,
            crmOportunidades: 0,
            crmValorEmDisputa: 0,
            prazosEstaSemana: 0,
            statsRadar: globalSummary.statsRadar,
            recomendacoes: globalSummary.recomendacoes,
            prazosCriticos: [],
          },
        });
      }

      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const [
        editaisMonitorados,
        analisesNulidade,
        propostasCriadas,
        crmOportunidades,
        crmDisputa,
        ganhosCount,
        perdidosCount,
        catalogItemsCount,
        certidoesVencendoCount,
        prazosUrgentesCount,
        prazosCriticos,
      ] = await Promise.all([
        prisma.companyMonitoredNotice.count({
          where: { companyId: company.id },
        }),
        prisma.legalAnalysis.count({
          where: { userId },
        }),
        prisma.proposal.count({
          where: { companyId: company.id },
        }),
        prisma.biddingPipeline.count({
          where: { userId },
        }),
        prisma.biddingPipeline.findMany({
          where: {
            userId,
            stage: { notIn: ['GANHO', 'ADJUDICADO', 'HOMOLOGADO', 'PERDIDO', 'DESCLASSIFICADO', 'ARQUIVADO'] },
          },
          include: {
            notice: { select: { estimatedValue: true } },
          },
        }),
        prisma.biddingPipeline.count({
          where: {
            userId,
            stage: { in: ['GANHO', 'ADJUDICADO', 'HOMOLOGADO'] },
          },
        }),
        prisma.biddingPipeline.count({
          where: {
            userId,
            stage: { in: ['PERDIDO', 'DESCLASSIFICADO', 'ARQUIVADO'] },
          },
        }),
        prisma.catalogItem.count({
          where: { companyId: company.id },
        }),
        prisma.document.count({
          where: {
            companyId: company.id,
            validade: { lte: in15Days },
          },
        }),
        prisma.deadline.count({
          where: {
            companyId: company.id,
            status: 'OPEN',
            dueAt: { lte: in3Days },
          },
        }),
        prisma.deadline.findMany({
          where: {
            companyId: company.id,
            dueAt: {
              gte: now,
              lte: in7Days,
            },
          },
          orderBy: { dueAt: 'asc' },
          take: 5,
          include: {
            procurementNotice: {
              select: { noticeNumber: true },
            },
          },
        }),
      ]);

      const valorTotalEmDisputa = crmDisputa.reduce((acc, curr) => {
        return acc + (curr.notice?.estimatedValue ? Number(curr.notice.estimatedValue) : 0);
      }, 0);

      const totalFinalizados = ganhosCount + perdidosCount;
      const taxaSucesso = totalFinalizados > 0 ? Math.round((ganhosCount / totalFinalizados) * 100) : 0;
      const atencaoImediataCount = certidoesVencendoCount + prazosUrgentesCount;
      const isContaNova = crmOportunidades === 0 && propostasCriadas === 0 && catalogItemsCount === 0;

      return res.json({
        success: true,
        data: {
          isContaNova,
          companyId: company.id,
          companyName: company.razaoSocial,
          valorTotalEmDisputa,
          taxaSucesso,
          atencaoImediataCount,
          certidoesVencendoCount,
          prazosUrgentesCount,
          catalogItemsCount,
          editaisMonitorados,
          analisesNulidade,
          propostasCriadas,
          crmOportunidades,
          crmValorEmDisputa: valorTotalEmDisputa,
          prazosEstaSemana: prazosCriticos.length,
          statsRadar: globalSummary.statsRadar,
          recomendacoes: globalSummary.recomendacoes,
          prazosCriticos: prazosCriticos.map((prazo: any) => ({
            id: prazo.id,
            evento: prazo.title,
            data: prazo.dueAt,
            tipo: prazo.type,
            edital: prazo.procurementNotice?.noticeNumber,
          })),
        },
      });
    } catch (error) {
      console.error('[DashboardController] Erro ao carregar métricas:', error);
      return res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
  }
}
