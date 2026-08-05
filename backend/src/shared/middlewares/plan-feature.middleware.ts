import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma';

export type PlanResourceType = 'monitored_bids' | 'ai_analysis' | 'proposals';

// Limites definidos para cada tipo de plano (String do campo user.plano)
const PLAN_LIMITS: Record<string, { maxMonitoredBids: number; maxAiAnalyses: number; maxProposals: number }> = {
  FREE: { maxMonitoredBids: 5, maxAiAnalyses: 3, maxProposals: 2 },
  GRATUITO: { maxMonitoredBids: 5, maxAiAnalyses: 3, maxProposals: 2 },
  PRO: { maxMonitoredBids: 50, maxAiAnalyses: 30, maxProposals: 20 },
  ENTERPRISE: { maxMonitoredBids: 9999, maxAiAnalyses: 9999, maxProposals: 9999 },
};

export function checkPlanLimit(resourceType: PlanResourceType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || req.headers['x-user-id'];

      if (!userId) {
        res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: String(userId) },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado.',
        });
        return;
      }

      // Lê o plano (ex: 'FREE', 'PRO') vindo da coluna plano/plan do banco
      const userPlanKey = String((user as any).plano || (user as any).plan || 'FREE').toUpperCase();
      const limits = PLAN_LIMITS[userPlanKey] || PLAN_LIMITS.FREE;

      let currentUsage = 0;
      let maxAllowed = 0;

      const prismaAny = prisma as any;

      switch (resourceType) {
        case 'monitored_bids':
          maxAllowed = limits.maxMonitoredBids;
          if (prismaAny.monitoredBid) {
            currentUsage = await prismaAny.monitoredBid.count({ where: { userId: user.id } });
          }
          break;

        case 'ai_analysis':
          maxAllowed = limits.maxAiAnalyses;
          if (prismaAny.aiAnalysis) {
            currentUsage = await prismaAny.aiAnalysis.count({ where: { userId: user.id } });
          }
          break;

        case 'proposals':
          maxAllowed = limits.maxProposals;
          if (prismaAny.proposal) {
            currentUsage = await prismaAny.proposal.count({ where: { userId: user.id } });
          }
          break;
      }

      if (currentUsage >= maxAllowed) {
        res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_EXCEEDED',
          message: `Você atingiu o limite do seu plano (${userPlanKey}). Faça upgrade para continuar.`,
          currentUsage,
          maxAllowed,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
// Adicione esta linha ao final do arquivo:
export const requirePlanFeature = (feature: string) => checkPlanLimit(feature as any);