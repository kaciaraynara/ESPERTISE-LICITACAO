import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import axios from 'axios';

function isDatabaseUnavailable(error: any) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');

  return /^P10(?:0[0-9]|1[0-7])$/.test(code)
    || /can't reach database server|connection (?:refused|terminated|closed)|database.*unavailable|econnrefused|etimedout/i.test(message);
}

export const errorMiddleware = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development';

  // — ZodError: validação de entrada
  if (err instanceof ZodError) {
    console.warn('[VALIDATION]', err.issues);
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos na requisição.',
      errors: err.issues.map((issue) => ({
        campo: issue.path.join('.'),
        mensagem: issue.message,
      })),
    });
  }

  // — AxiosError: falha em API externa sem expor payload remoto
  if (axios.isAxiosError(err)) {
    const upstreamStatus = err.response?.status;
    const timedOut = upstreamStatus === 408
      || upstreamStatus === 504
      || err.code === 'ECONNABORTED'
      || err.code === 'ETIMEDOUT';
    const rateLimited = upstreamStatus === 429;
    const status = timedOut ? 504 : rateLimited ? 503 : 502;
    const code = timedOut
      ? 'UPSTREAM_TIMEOUT'
      : rateLimited
        ? 'UPSTREAM_RATE_LIMITED'
        : 'UPSTREAM_UNAVAILABLE';

    console.error('[EXTERNAL API]', {
      url: err.config?.url,
      upstreamStatus,
      code,
    });
    return res.status(status).json({
      success: false,
      code,
      message: timedOut
        ? 'O serviço externo demorou para responder.'
        : 'O serviço externo está temporariamente indisponível.',
    });
  }

  // — Token expirado / não autorizado
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado. Faça login novamente.' });
  }

  // — Prisma Errors: falhas de banco de dados
  if (err?.code === 'P2002') {
    const target = err.meta?.target as string[] | undefined;
    const campo = target ? target.join(', ') : 'Registro';
    return res.status(409).json({
      success: false,
      code: 'RESOURCE_CONFLICT',
      message: `${campo} já existe no sistema. Por favor, tente outro.`,
    });
  }

  if (isDatabaseUnavailable(err)) {
    console.error('[DATABASE UNAVAILABLE]', {
      code: err?.code,
      url: req.url,
      method: req.method,
    });
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      message: 'O serviço de dados está temporariamente indisponível.',
    });
  }

  // — Erro genérico
  const statusCode = err.status || err.statusCode || 500;
  const isOperational = statusCode >= 400
    && statusCode < 600
    && statusCode !== 500;
  const message = isOperational
    ? err.message || 'Não foi possível concluir a requisição.'
    : 'Erro interno no servidor.';

  console.error('[SERVER ERROR]', {
    message: err?.message || message,
    stack: isDev ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  return res.status(statusCode).json({
    success: false,
    ...(typeof err?.code === 'string' ? { code: err.code } : {}),
    message,
    ...(isOperational && err?.details ? { details: err.details } : {}),
  });
};
