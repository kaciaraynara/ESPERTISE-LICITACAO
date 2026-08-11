import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';
import { RequestWithCorrelationId } from './correlation-id.middleware';

export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: RequestWithCorrelationId,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = req.id;

  // Log centralizado do erro registrando o Correlation ID, rota, método e stack trace
  logger.error(error.message, {
    requestId,
    path: req.path,
    method: req.method,
    stack: error.stack,
  });

  // 1. Erros Operacionais Customizados (AppError)
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      requestId,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  // 2. Erros do Zod (Validação de schemas)
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      requestId,
      errors: error.errors.map((err) => ({
        field: err.path.join('.').replace(/^(body|query|params)\./, ''),
        message: err.message,
      })),
    });
    return;
  }

  // 3. Resposta padronizada para erros não tratados (500 Internal Server Error)
  const isProd = process.env.NODE_ENV === 'production';

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Ocorreu um erro interno inesperado no servidor.',
    requestId,
    ...(!isProd && { stack: error.stack, originalMessage: error.message }),
  });
};