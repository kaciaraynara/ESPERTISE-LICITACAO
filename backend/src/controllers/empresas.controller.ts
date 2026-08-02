import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { empresasService } from '../services/empresas.service';
import { ApiError } from '../shared/errors/ApiError';

export class EmpresasController {
  public async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Usuário não autenticado', 401);
    }

    const empresas = await empresasService.listar(userId);
    return res.json({ success: true, data: empresas });
  }

  public async buscarPorId(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      throw new ApiError('Usuário não autenticado', 401);
    }

    const empresa = await empresasService.buscarPorId(userId, id);
    return res.json({ success: true, data: empresa });
  }

  public async criar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Usuário não autenticado', 401);
    }

    const body = req.body as Record<string, unknown>;
    const empresa = await empresasService.criar(userId, body);

    return res.status(201).json({ success: true, data: empresa });
  }

  public async atualizar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      throw new ApiError('Usuário não autenticado', 401);
    }

    const body = req.body as Record<string, unknown>;
    const empresa = await empresasService.atualizar(userId, id, body);

    return res.json({ success: true, data: empresa });
  }
}
