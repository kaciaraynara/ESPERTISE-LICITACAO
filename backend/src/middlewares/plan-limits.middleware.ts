import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';

export const planLimitsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const userId = user.id;
    const tenantId = user.tenantId;
    const action = req.path; // e.g., /companies, /users

    // Buscar plano ativo
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userId,
        status: { in: ['active', 'trialing'] }
      }
    });

    const plano = subscription?.plano?.toLowerCase() || 'free';

    // Regra: API Investigacao só libera rota Lex/Sourcing
    if (plano === 'investigacao') {
      if (!action.includes('/lex') && !action.includes('/sourcing')) {
         return res.status(403).json({ 
           error: 'O seu plano (Investigações) só permite acesso à IA e buscas. Faça upgrade para o Premium para acessar o SaaS completo.' 
         });
      }
      return next();
    }

    // Regra: Premium tem limites físicos (10 usuarios, 10 empresas)
    if (plano === 'premium') {
      if (req.method === 'POST' && action.includes('/companies')) {
        const companiesCount = await prisma.company.count({ where: { tenantId } });
        if (companiesCount >= 10) {
          return res.status(403).json({ 
            error: 'Limite de 10 empresas atingido no plano Premium. Contate o suporte para um plano Enterprise.' 
          });
        }
      }

      if (req.method === 'POST' && action.includes('/users')) {
        const usersCount = await prisma.user.count({ where: { tenantId } });
        if (usersCount >= 10) {
          return res.status(403).json({ 
            error: 'Limite de 10 usuários atingido no plano Premium. Contate o suporte para um plano Enterprise.' 
          });
        }
      }
      return next();
    }

    // Free tier ou sem assinatura
    if (req.method !== 'GET') {
      return res.status(403).json({ error: 'Assine um plano para realizar esta ação.' });
    }

    next();
  } catch (error) {
    console.error('[PlanLimitsMiddleware] Erro:', error);
    res.status(500).json({ error: 'Erro interno na validação do plano.' });
  }
};
