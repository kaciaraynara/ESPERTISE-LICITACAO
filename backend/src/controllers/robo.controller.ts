import { Response } from 'express';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { roboService, RoboConfigRecord } from '../services/robo.service';
import { biddingEngine, ItemDisputaEngineConfig } from '../services/trading-engine/bidding-engine.service';
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

  public async stopAll(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);

    // Pausa a sessão geral
    await roboService.salvarConfig(userId, licitacaoId, { ativo: false });

    return res.json({
      success: true,
      message: 'PARADA DE EMERGÊNCIA ATIVADA: Todos os robôs e disparos foram interrompidos instantaneamente.',
      timestamp: new Date().toISOString(),
    });
  }

  public async disparoValidado(req: AuthRequest, res: Response) {
    const { licitacaoId } = req.params;
    const userId = getAuthenticatedUserId(req);
    const itemConfig = req.body as ItemDisputaEngineConfig;

    if (!itemConfig || !itemConfig.itemId) {
      throw new ApiError('Configuração do item de disputa inválida.', 400);
    }

    try {
      const decisao = biddingEngine.processarDecisao(itemConfig);
      return res.json({ success: true, data: decisao });
    } catch (err: any) {
      if (err.name === 'StopLossViolationError' || err.code === 'STOP_LOSS_VIOLATION') {
        return res.status(403).json({
          success: false,
          error: 'STOP_LOSS_VIOLATION',
          message: err.message,
        });
      }
      if (err.name === 'DuplicateBidError' || err.code === 'DUPLICATE_BID_BLOCKED') {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_BID_BLOCKED',
          message: err.message,
        });
      }
      throw err;
    }
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
