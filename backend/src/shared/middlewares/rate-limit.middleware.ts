import { Request, Response, NextFunction } from 'express';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function createSimpleRateLimit(maxRequests = 40, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any)?.user?.id || req.ip || 'anon';
    const key = `${req.baseUrl}:${userId}`;
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (buckets.size > 5000) {
        const first = buckets.keys().next().value;
        if (first) buckets.delete(first);
      }
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Muitas requisicoes em sequencia. Aguarde alguns segundos e tente novamente.',
      });
    }

    entry.count += 1;
    return next();
  };
}
