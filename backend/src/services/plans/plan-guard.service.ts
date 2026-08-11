import { prisma } from '../../database/prisma';
import {
  getMinimumPlanForFeature,
  getPlanDefinition,
  getPlanLimits,
  normalizePlanId,
  planHasFeature,
  type PlanFeature,
  type PlanId,
} from './plan.constants';

interface UserPlanSource {
  plano?: string | null;
  plan?: string | null;
}

interface SubscriptionPlanSource {
  plano?: string | null;
  plan?: string | null;
  status?: string | null;
  periodoFim?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
}

export class PlanLimitError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode = 403, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
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

    return normalizePlanId(this.getPlanValue(user) ?? 'free');
  }

  async assertFeature(userId: string, feature: PlanFeature): Promise<void> {
    const planId = await this.resolveUserPlan(userId);

    if (planHasFeature(planId, feature)) {
      return;
    }

    const minimumPlan = getMinimumPlanForFeature(feature);

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
      `Seu plano atual permite cadastrar até ${limits.maxCompanies} empresa(s). Faça upgrade para cadastrar mais empresas.`,
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