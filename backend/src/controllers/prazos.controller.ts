import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';

export class PrazosController {
  public async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await prisma.company.findFirst({ where: { userId } });
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const prazos = await prisma.deadline.findMany({
      where: { companyId: company.id },
      include: { procurementNotice: true },
      orderBy: { dueAt: 'asc' },
    });

    return res.json({ success: true, data: prazos });
  }

  public async concluir(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;

    const prazo = await prisma.deadline.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!prazo || prazo.company.userId !== userId) {
      throw new ApiError('Prazo não encontrado ou acesso negado', 404);
    }

    const atualizado = await prisma.deadline.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    return res.json({ success: true, data: atualizado });
  }
}
