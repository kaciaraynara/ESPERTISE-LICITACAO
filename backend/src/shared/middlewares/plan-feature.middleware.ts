import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { planGuardService, PlanLimitError } from '../../services/plans/plan-guard.service';
import { type PlanFeature } from '../../services/plans/plan.constants';

export function requirePlanFeature(feature: PlanFeature) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuario nao autenticado',
      });
    }

    try {
      await planGuardService.assertFeature(userId, feature);
      return next();
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
          details: error.details,
        });
      }

      console.error('[PLAN_FEATURE] Erro ao validar funcionalidade do plano:', error);

      return res.status(500).json({
        success: false,
        code: 'plan_feature_validation_failed',
        message: 'Nao foi possivel validar o acesso a esta funcionalidade.',
      });
    }
  };
}
