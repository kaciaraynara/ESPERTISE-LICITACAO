import { Request, Response, NextFunction } from 'express';
import { requirePlanFeature } from './plan-feature.middleware';
import { planGuardService, PlanLimitError } from '../../services/plans/plan-guard.service';

jest.mock('../../services/plans/plan-guard.service', () => {
  class PlanLimitError extends Error {
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;

    constructor(code: string, message: string, statusCode = 403, details?: Record<string, unknown>) {
      super(message);
      this.name = 'PlanLimitError';
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
    }
  }

  return {
    planGuardService: {
      assertFeature: jest.fn(),
    },
    PlanLimitError,
  };
});

describe('requirePlanFeature', () => {
  const mockedPlanGuard = planGuardService as jest.Mocked<typeof planGuardService>;

  function buildResponse() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    return res;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('permite acesso quando plano possui funcionalidade', async () => {
    mockedPlanGuard.assertFeature.mockResolvedValueOnce();

    const req = {
      user: {
        id: 'user-1',
        email: 'user@expertise.test',
        plano: 'pro',
        role: 'fornecedor',
      },
    } as unknown as Request;

    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await requirePlanFeature('pricing.strategy')(req, res, next);

    expect(mockedPlanGuard.assertFeature).toHaveBeenCalledWith('user-1', 'pricing.strategy');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('bloqueia acesso quando funcionalidade nao esta disponivel no plano', async () => {
    const error = new PlanLimitError(
      'plan_feature_not_available',
      'Este recurso está disponível no plano Master. Faça upgrade para acessar.',
      403,
      {
        currentPlan: 'pro',
        requiredPlan: 'master',
        feature: 'investigation.cartel_signals',
      },
    );

    mockedPlanGuard.assertFeature.mockRejectedValueOnce(error);

    const req = {
      user: {
        id: 'user-1',
        email: 'user@expertise.test',
        plano: 'pro',
        role: 'fornecedor',
      },
    } as unknown as Request;

    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await requirePlanFeature('investigation.cartel_signals')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'plan_feature_not_available',
      message: 'Este recurso está disponível no plano Master. Faça upgrade para acessar.',
      details: {
        currentPlan: 'pro',
        requiredPlan: 'master',
        feature: 'investigation.cartel_signals',
      },
    });
  });

  test('retorna 401 quando usuario nao esta autenticado', async () => {
    const req = {} as Request;
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await requirePlanFeature('proposal.factory')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('retorna 500 em erro inesperado na validacao do plano', async () => {
    mockedPlanGuard.assertFeature.mockRejectedValueOnce(new Error('Falha inesperada'));

    const req = {
      user: {
        id: 'user-1',
        email: 'user@expertise.test',
        plano: 'pro',
        role: 'fornecedor',
      },
    } as unknown as Request;

    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await requirePlanFeature('proposal.factory')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});