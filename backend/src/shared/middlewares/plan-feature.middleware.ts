import { Request, Response, NextFunction } from 'express';
import { planGuardService, PlanLimitError } from '../../services/plans/plan-guard.service';
import type { PlanFeature } from '../../services/plans/plan.constants';

export function checkPlanLimit(feature: PlanFeature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUser = (req as Request & { user?: { id?: string } }).user;
      const userId = authUser?.id ?? req.headers?.['x-user-id'];

      if (!userId) {
        res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      await planGuardService.assertFeature(String(userId), feature);
      next();
    } catch (error) {
      if (!((req as Request & { user?: { id?: string } }).user?.id) && !req.headers?.['x-user-id']) {
        res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }
      if (error instanceof PlanLimitError) {
        res.status(error.statusCode ?? 403).json({
          success: false,
          code: error.code,
          message: error.message,
          details: error.details,
        });
        return;
      }

      res.status(500).json({
        success: false,
        code: 'PLAN_VALIDATION_ERROR',
        message: 'Erro inesperado ao validar plano.',
      });
    }
  };
}

export const requirePlanFeature = (feature: string) => checkPlanLimit(feature as PlanFeature);