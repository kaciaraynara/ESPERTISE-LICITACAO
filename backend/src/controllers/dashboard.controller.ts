import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';

export class DashboardController {
  async getMetrics(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await prisma.company.findFirst({
        where: { userId },
      });

      if (!company) {
        return res.json({
          success: true,
          data: {
            editaisMonitorados: 0,
            analisesNulidade: 0,
            propostasCriadas: 0,
            prazosEstaSemana: 0,
            recomendacoes: [],
            prazosCriticos: [],
          },
        });
      }

      const [editaisMonitorados, analisesNulidade, propostasCriadas] = await Promise.all([
        prisma.companyMonitoredNotice.count({
          where: { companyId: company.id },
        }),
        prisma.legalAnalysis.count({
          where: { userId },
        }),
        prisma.proposal.count({
          where: { companyId: company.id },
        }),
      ]);

      const recomendacoes = await prisma.procurementNotice.findMany({
        take: 3,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          buyerName: true,
          uf: true,
          object: true,
          estimatedValue: true,
        },
      });

      const now = new Date();
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const prazosCriticos = await prisma.deadline.findMany({
        where: {
          companyId: company.id,
          dueAt: {
            gte: now,
            lte: endOfWeek,
          },
        },
        orderBy: { dueAt: 'asc' },
        take: 5,
        include: {
          procurementNotice: {
            select: { noticeNumber: true },
          },
        },
      });

      return res.json({
        success: true,
        data: {
          editaisMonitorados,
          analisesNulidade,
          propostasCriadas,
          prazosEstaSemana: prazosCriticos.length,
          recomendacoes: recomendacoes.map((rec: any) => ({
            id: rec.id,
            orgao: rec.buyerName,
            uf: rec.uf,
            objeto: rec.object,
            valor: rec.estimatedValue ? Number(rec.estimatedValue) : null,
          })),
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

