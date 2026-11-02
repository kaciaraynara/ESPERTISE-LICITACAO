import { PlanResetWorker } from './plan-reset.worker';
import { prisma } from '../database/prisma';

jest.mock('../database/prisma', () => ({
  prisma: {
    user: {
      updateMany: jest.fn(),
    },
    subscription: {
      updateMany: jest.fn(),
    },
  },
}));

describe('PlanResetWorker — Reset Mensal dos Contadores de Consumo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve zerar monthlyAnalysesUsed e monthlyProposalsUsed para todos os usuários e assinaturas', async () => {
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 142 });
    (prisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 120 });

    const worker = new PlanResetWorker();
    const result = await worker.resetMonthlyUsage();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      data: {
        monthlyAnalysesUsed: 0,
        monthlyProposalsUsed: 0,
        lastResetDate: expect.any(Date),
      },
    });

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      data: {
        monthlyAnalysesUsed: 0,
        monthlyProposalsUsed: 0,
        lastResetDate: expect.any(Date),
      },
    });

    expect(result.usersResetCount).toBe(142);
    expect(result.subscriptionsResetCount).toBe(120);
    expect(result.timestamp).toBeDefined();
  });

  it('deve propagar erro caso ocorra falha na base de dados', async () => {
    (prisma.user.updateMany as jest.Mock).mockRejectedValue(new Error('DB Connection Timeout'));

    const worker = new PlanResetWorker();
    await expect(worker.resetMonthlyUsage()).rejects.toThrow('DB Connection Timeout');
  });
});
