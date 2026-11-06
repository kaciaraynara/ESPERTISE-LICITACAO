import { Request, Response } from 'express';
import { prisma } from '../database/prisma';

/**
 * Controller de Telemetria do Radar de Segurança e Auditoria.
 */
export class AuditController {
  /**
   * Retorna os últimos 50 registros da tabela `AuditLog` ordenados por `timestamp: 'desc'`.
   */
  public static async getTelemetry(_req: Request, res: Response): Promise<Response> {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nome: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        logs,
        total: logs.length,
        generatedAt: new Date().toISOString(),
      },
    });
  }

  public async getTelemetry(req: Request, res: Response): Promise<Response> {
    return AuditController.getTelemetry(req, res);
  }
}

export const auditController = new AuditController();

