import { PlanGuardService } from './plan-guard.service';
import { prisma } from '../../database/prisma';

jest.mock('../../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
  },
}));

describe('PlanGuardService', () => {
  const service = new PlanGuardService();
  const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
  const mockSubscriptionFindFirst = prisma.subscription.findFirst as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prioriza o plano da assinatura ativa quando existe', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'pro',
      status: 'active',
      periodoFim: new Date(Date.now() + 86_400_000),
    });

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('pro');
  });

  it('retorna free quando não existe assinatura ativa', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce(null);

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('free');
  });
});
