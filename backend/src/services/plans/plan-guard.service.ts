import { prisma } from '../../database/prisma';
import { AppError } from '../../shared/errors/app-error';
import {
  getMinimumPlanForFeature,
  getPlanDefinition,
  getPlanLimits,
  normalizePlanId,
  planHasFeature,
  type PlanFeature,
  type PlanId,
} from './plan.constants';
import {
  getMinimumCommercialPlanForFeature,
  hasCommercialPlanFeature,
  resolveCommercialPlanKey,
} from '../../config/plan-features';

interface UserPlanSource {
  plano?: string | null;
  plan?: string | null;
  planType?: string | null;
}

interface SubscriptionPlanSource {
  plano?: string | null;
  plan?: string | null;
  status?: string | null;
  periodoFim?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
}

export const FEATURE_MODULE_MAPPING: Partial<Record<PlanFeature, string>> = {
  'bid.robot': 'bid_robot',
  'investigation.cartel_signals': 'cartel_signals',
  'investigation.competitor_intelligence': 'competitor_intelligence',
};

export class PlanLimitError extends AppError {
  constructor(code: string, message: string, statusCode = 403, details?: Record<string, unknown>) {
    super(message, statusCode, code, details);
    this.name = 'PlanLimitError';
  }
}

export class PlanGuardService {
  async resolveUserPlan(userId: string): Promise<PlanId> {
    const now = new Date();

    const user = await this.loadUserPlanSource(userId);

    if (!user) {
      throw new PlanLimitError(
        'user_not_found',
        'Usuário não encontrado para validação do plano.',
        404,
      );
    }

    const activeSubscription = await this.loadActiveSubscription(userId, now);
    const subscriptionPlan = this.getPlanValue(activeSubscription);

    if (subscriptionPlan) {
      return normalizePlanId(subscriptionPlan);
    }

    // Se não há assinatura ativa válida (ou se expirou/cancelou), o plano é estritamente 'free'.
    // Nunca confia em valor herdado ou manipulado diretamente em User.plano para conceder planos pagos.
    return 'free';
  }

  async assertFeature(userId: string, feature: PlanFeature | string): Promise<void> {
    const planId = await this.resolveUserPlan(userId);

    // Verifica o acesso somente com base na assinatura ativa validada pelo servidor.
    const isAllowed =
      planHasFeature(planId, feature as PlanFeature) ||
      hasCommercialPlanFeature(planId, feature);

    if (!isAllowed) {
      const minimumPlan =
        getMinimumPlanForFeature(feature as PlanFeature) ??
        getMinimumCommercialPlanForFeature(feature)?.slug ??
        'master';

      throw new PlanLimitError(
        'plan_feature_not_available',
        this.buildFeatureMessage(minimumPlan),
        403,
        {
          currentPlan: planId,
          requiredPlan: minimumPlan,
          feature,
        },
      );
    }

    await this.assertModuleReadiness(feature as PlanFeature);
  }

  private async assertModuleReadiness(feature: PlanFeature): Promise<void> {
    const moduleKey = FEATURE_MODULE_MAPPING[feature];
    if (!moduleKey) {
      return;
    }

    try {
      const systemModule = await (prisma as any).systemModule?.findUnique({
        where: { key: moduleKey },
        select: { key: true, name: true, status: true },
      });

      if (systemModule && systemModule.status !== 'AVAILABLE') {
        throw new PlanLimitError(
          'module_not_ready',
          `O módulo "${systemModule.name || moduleKey}" está em fase técnica (${systemModule.status}) e ainda não está liberado para produção.`,
          403,
          {
            feature,
            moduleKey,
            moduleStatus: systemModule.status,
          },
        );
      }
    } catch (error) {
      if (error instanceof PlanLimitError) {
        throw error;
      }
      // Se a tabela system_modules não existir no banco de testes, prossegue normalmente
    }
  }

  private async loadUserPlanSource(userId: string): Promise<UserPlanSource | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { plano: true },
    }) as Promise<UserPlanSource | null>;
  }

  private async loadActiveSubscription(userId: string, now: Date): Promise<SubscriptionPlanSource | null> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        categoria: 'plataforma',
        status: {
          in: ['active', 'trialing'],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        plano: true,
        status: true,
        periodoFim: true,
      },
    }) as SubscriptionPlanSource | null;

    if (!subscription) {
      return null;
    }

    const endDate = (subscription as SubscriptionPlanSource & { currentPeriodEnd?: Date | string | null }).currentPeriodEnd ?? subscription.periodoFim;
    if (endDate && new Date(endDate) < now) {
      return null;
    }

    return subscription;
  }

  private getPlanValue(source?: { plano?: string | null; plan?: string | null } | null): string | null {
    return source?.plano ?? source?.plan ?? null;
  }

  async assertCanCreateCompany(userId: string, currentCompanyCount: number): Promise<void> {
    const planId = await this.resolveUserPlan(userId);
    const limits = getPlanLimits(planId);

    if (currentCompanyCount < limits.maxCompanies) {
      return;
    }

    throw new PlanLimitError(
      'company_limit_reached',
      `Você atingiu o limite de ${limits.maxCompanies} empresas do seu plano. Faça upgrade para cadastrar novos CNPJs.`,
      403,
      {
        currentPlan: planId,
        currentCompanyCount,
        maxCompanies: limits.maxCompanies,
      },
    );
  }

  async assertCanCreateUser(userId: string, currentUserCount: number): Promise<void> {
    const planId = await this.resolveUserPlan(userId);
    const limits = getPlanLimits(planId);

    if (currentUserCount < limits.maxUsers) {
      return;
    }

    throw new PlanLimitError(
      'user_limit_reached',
      `Seu plano atual permite até ${limits.maxUsers} usuário(s). Faça upgrade para adicionar mais usuários.`,
      403,
      {
        currentPlan: planId,
        currentUserCount,
        maxUsers: limits.maxUsers,
      },
    );
  }

  async getUserPlanContext(userId: string) {
    const planId = await this.resolveUserPlan(userId);
    const definition = getPlanDefinition(planId);

    return {
      plan: definition,
      limits: getPlanLimits(planId),
    };
  }

  private buildFeatureMessage(minimumPlan: PlanId | null): string {
    if (minimumPlan === 'master') {
      return 'Este recurso está disponível no plano Master. Faça upgrade para acessar.';
    }

    if (minimumPlan === 'pro') {
      return 'Este recurso está disponível a partir do plano Pro. Faça upgrade para continuar.';
    }

    if (minimumPlan === 'basic') {
      return 'Este recurso está disponível a partir do plano Básico. Escolha um plano para continuar.';
    }

    return 'Seu plano atual não permite acessar esta funcionalidade.';
  }
}

export const planGuardService = new PlanGuardService();