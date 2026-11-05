import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';

/**
 * Gerenciamento Singleton da conexão Redis dedicada à camada de Segurança e Rate Limiting.
 */
let securityRedisClient: Redis | null = null;

export function getSecurityRedisClient(): Redis | null {
  if (securityRedisClient) {
    return securityRedisClient;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();

  if (!redisUrl && !redisHost) {
    return null;
  }

  const client = redisUrl
    ? new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
      })
    : new Redis({
        host: redisHost,
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD?.trim() || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
      });

  client.on('error', (err) => {
    console.error('[SECURITY_REDIS_ERROR] Falha na conexão Redis de Rate Limit:', err.message);
  });

  securityRedisClient = client;
  return securityRedisClient;
}

export async function closeSecurityRedisClient(): Promise<void> {
  if (securityRedisClient) {
    await securityRedisClient.quit().catch(() => securityRedisClient?.disconnect());
    securityRedisClient = null;
  }
}

/**
 * Extrai o IP real do cliente priorizando estritamente o header `cf-connecting-ip`
 * injetado pela borda da Cloudflare, mitigando ataques de IP Spoofing em `X-Forwarded-For`.
 */
export function extractTrustedClientIp(req: Request): string {
  const cfConnectingIp = req.headers['cf-connecting-ip'];

  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  if (Array.isArray(cfConnectingIp) && cfConnectingIp[0]?.trim()) {
    return cfConnectingIp[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown-ip';
}

/**
 * 1. Middleware de Remoção de Fingerprinting e Hardening de Headers HTTP (Helmet).
 * - Oculta estritamente `X-Powered-By` (`hidePoweredBy: true` + remoção explícita).
 * - Desativa Sniffing de MIME type (`noSniff: true` -> `X-Content-Type-Options: nosniff`).
 * - Ativa filtros XSS globais (`xssFilter: true` + `contentSecurityPolicy` restritiva).
 */
const helmetMiddleware = helmet({
  hidePoweredBy: true,
  noSniff: true,
  xssFilter: true,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

export const securityHeadersMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.removeHeader('X-Powered-By');
  return helmetMiddleware(req, res, next);
};

/**
 * Cria a store Redis para o `express-rate-limit` quando a instância do Redis está configurada.
 */
function buildRedisRateLimitStore(prefix: string): RedisStore | undefined {
  const client = getSecurityRedisClient();
  if (!client) {
    return undefined;
  }

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) =>
      client.call(args[0], ...args.slice(1)) as Promise<any>,
  });
}

/**
 * 2. Middleware de Proteção contra Força Bruta (`adminLoginLimiter`).
 * - Limite estrito: máximo de 5 requisições por janela de 15 minutos.
 * - Acoplado ao Redis (`rate-limit-redis`) com fallback resiliente (`passOnStoreError: true`).
 * - `keyGenerator` extrai o IP primariamente de `cf-connecting-ip` (Cloudflare).
 * - Retorna HTTP `429 Too Many Requests` ao exceder o limite.
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo de 5 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: buildRedisRateLimitStore('rl:admin_login:'),
  keyGenerator: (req: Request): string => extractTrustedClientIp(req),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message:
        'Muitas tentativas de autenticação a partir deste endereço IP. Bloqueio temporário de 15 minutos ativado.',
    });
  },
});

