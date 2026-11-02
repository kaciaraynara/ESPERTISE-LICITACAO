import { prisma } from '../database/prisma';

export interface PlanResetResult {
  usersResetCount: number;
  subscriptionsResetCount: number;
  timestamp: string;
}

/**
 * Worker responsável por zerar os contadores de consumo mensal
 * (monthlyAnalysesUsed e monthlyProposalsUsed) no primeiro dia do ciclo de faturamento.
 */
export class PlanResetWorker {
  async resetMonthlyUsage(): Promise<PlanResetResult> {
    const now = new Date();

    console.info(JSON.stringify({
      event: 'PLAN_MONTHLY_RESET_STARTED',
      timestamp: now.toISOString(),
    }));

    try {
      // 1. Zera contadores na tabela de usuários
      const usersUpdate = await prisma.user.updateMany({
        data: {
          monthlyAnalysesUsed: 0,
          monthlyProposalsUsed: 0,
          lastResetDate: now,
        },
      });

      // 2. Zera contadores na tabela de assinaturas (se existirem)
      const subsUpdate = await prisma.subscription.updateMany({
        data: {
          monthlyAnalysesUsed: 0,
          monthlyProposalsUsed: 0,
          lastResetDate: now,
        },
      }).catch(() => ({ count: 0 }));

      const result: PlanResetResult = {
        usersResetCount: usersUpdate.count,
        subscriptionsResetCount: subsUpdate.count,
        timestamp: now.toISOString(),
      };

      console.info(JSON.stringify({
        event: 'PLAN_MONTHLY_RESET_COMPLETED',
        ...result,
      }));

      return result;
    } catch (error: any) {
      console.error(JSON.stringify({
        event: 'PLAN_MONTHLY_RESET_FAILED',
        error: error?.message || error,
        timestamp: now.toISOString(),
      }));
      throw error;
    }
  }
}

export const planResetWorker = new PlanResetWorker();
