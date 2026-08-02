import { Response } from 'express';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { roboService, RoboConfigRecord } from '../services/robo.service';
import { ApiError } from '../shared/errors/ApiError';

function getAuthenticatedUserId(req: AuthRequest) {
  const userId = req.user?.id;
  if (!userId) throw new ApiError('Usuário autenticado não identificado.', 401);
  return userId;
}

export class RoboController {
  public async getConfig(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);

    const config = await roboService.getConfig(userId, licitacaoId);
    return res.json({ success: true, data: config });
  }

  public async salvarConfig(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);
    const payload = req.body as Partial<RoboConfigRecord>;

    const config = await roboService.salvarConfig(userId, licitacaoId, payload);

    return res.json({
      success: true,
      data: config,
      message: 'Sala do robo configurada com sucesso.',
    });
  }

  public async processarLance(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);

    const { precoAtual, tempoRestante } = req.body as {
      precoAtual: number;
      tempoRestante?: number;
    };
    const body = req.body as { souPrimeiro?: boolean; souoPrimeiro?: boolean };
    const souPrimeiro = Boolean(body.souPrimeiro ?? body.souoPrimeiro);

    try {
      const result = await roboService.processarLance(userId, licitacaoId, precoAtual, tempoRestante, souPrimeiro);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.message?.includes('NOT_FOUND')) {
        throw new ApiError('Robô não configurado para esta licitação', 404);
      }
      throw err;
    }
  }

  public async getLogs(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);

    const logs = await roboService.getLogs(userId, licitacaoId);
    return res.json({ success: true, data: logs });
  }

  public async toggleRobo(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);

    try {
      const result = await roboService.toggleRobo(userId, licitacaoId);
      return res.json({
        success: true,
        data: result,
        message: result.ativo ? 'Robô ativado e monitorando a disputa.' : 'Robô pausado com segurança.',
      });
    } catch (err: any) {
      if (err.message?.includes('NOT_FOUND')) {
        throw new ApiError('Configuração não encontrada', 404);
      }
      throw err;
    }
  }
}
