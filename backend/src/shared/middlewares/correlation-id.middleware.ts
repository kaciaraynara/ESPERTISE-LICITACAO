import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithCorrelationId extends Request {
  id?: string;
}

export const correlationIdMiddleware = (
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction,
): void => {
  // Captura o ID vindo dos headers ou gera um novo UUID v4
  const headerId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = Array.isArray(headerId) ? headerId[0] : headerId || randomUUID();

  // Injeta o ID na requisição e nos headers da resposta HTTP
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};