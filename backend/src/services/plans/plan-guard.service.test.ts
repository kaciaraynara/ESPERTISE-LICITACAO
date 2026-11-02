import { PlanGuardService, PlanLimitError } from './plan-guard.service';
import { prisma } from '../../database/prisma';

jest.mock('../../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
    systemModule: {
      findUnique: jest.fn(),
    },
  },
}));

describe('PlanGuardService', () => {
  const service = new PlanGuardService();
  const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
  const mockSubscriptionFindFirst = prisma.subscription.findFirst as jest.Mock;
  const mockSystemModuleFindUnique = (prisma as any).systemModule.findUnique as jest.Mock;

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

  it('retorna free quando a assinatura ativa expirou no tempo', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', plano: 'pro' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'pro',
      status: 'active',
      periodoFim: new Date(Date.now() - 3600_000), // Expirou há 1 hora
    });

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('free');
  });

  it('retorna free quando a assinatura foi cancelada', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', plano: 'master' });
    mockSubscriptionFindFirst.mockResolvedValueOnce(null);

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('free');
  });

  it('reconhece assinatura em status trialing não expirada', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'pro',
      status: 'trialing',
      periodoFim: new Date(Date.now() + 7 * 86_400_000),
    });

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('pro');
  });

  it('degrada para free quando o período de trial expirou', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', plano: 'pro' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'pro',
      status: 'trialing',
      periodoFim: new Date(Date.now() - 1000),
    });

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('free');
  });

  it('nunca concede plano pago por parâmetro direto de User.plano sem assinatura válida', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', plano: 'master' });
    mockSubscriptionFindFirst.mockResolvedValueOnce(null);

    await expect(service.resolveUserPlan('user-1')).resolves.toBe('free');
  });

  it('bloqueia a sexta empresa do Plano Básico com erro HTTP 403 e mensagem comercial', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'basic',
      status: 'active',
      periodoFim: new Date(Date.now() + 86_400_000),
    });

    await expect(service.assertCanCreateCompany('user-1', 5)).rejects.toMatchObject({
      code: 'company_limit_reached',
      statusCode: 403,
      message: 'Você atingiu o limite de 5 empresas do seu plano. Faça upgrade para cadastrar novos CNPJs.',
    });
  });

  it('expõe limite de empresas como AppError para o handler HTTP preservar o status 403', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'pro',
      status: 'active',
      periodoFim: new Date(Date.now() + 86_400_000),
    });

    const error = await service.assertCanCreateCompany('user-1', 10).catch((reason) => reason);

    expect(error).toBeInstanceOf(PlanLimitError);
    expect(error).toMatchObject({ statusCode: 403 });
  });

  it('bloqueia módulo experimental por prontidão técnica mesmo se usuário tiver plano Master', async () => {
    // Usuário com plano master ativo
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'master',
      status: 'active',
      periodoFim: new Date(Date.now() + 86_400_000),
    });

    // Módulo bid_robot está em implantação técnica
    mockSystemModuleFindUnique.mockResolvedValueOnce({
      key: 'bid_robot',
      name: 'Robô de Lances',
      status: 'IN_IMPLANTATION',
    });

    await expect(service.assertFeature('user-1', 'bid.robot')).rejects.toThrow(
      'O módulo "Robô de Lances" está em fase técnica (IN_IMPLANTATION) e ainda não está liberado para produção.',
    );
  });

  it('permite módulo se sua prontidão técnica for AVAILABLE e plano compatível', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      plano: 'master',
      status: 'active',
      periodoFim: new Date(Date.now() + 86_400_000),
    });

    mockSystemModuleFindUnique.mockResolvedValueOnce({
      key: 'bid_robot',
      name: 'Robô de Lances',
      status: 'AVAILABLE',
    });

    await expect(service.assertFeature('user-1', 'bid.robot')).resolves.toBeUndefined();
  });
});
