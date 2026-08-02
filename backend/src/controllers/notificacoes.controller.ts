import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';

export class NotificacoesController {
  async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const pagina = Number(req.query.pagina ?? 1);
    const limite = Number(req.query.limite ?? 20);

    const total = await prisma.notification.count({ where: { userId } });
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { enviadaEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    const naoLidas = await prisma.notification.count({ where: { userId, lida: false } });

    const data = rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      titulo: r.titulo,
      mensagem: r.mensagem,
      link: r.link,
      status: r.status,
      lida: r.lida,
      enviada_em: r.enviadaEm?.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      meta: {
        total,
        pagina,
        limite,
        nao_lidas: naoLidas,
      },
    });
  }

  async marcarTodasComoLidas(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const result = await prisma.notification.updateMany({
      where: { userId, lida: false },
      data: { lida: true, status: 'enviada' }
    });

    const atualizadas = result.count;

    return res.json({
      success: true,
      data: { atualizadas },
      message: atualizadas > 0 ? 'Notificações marcadas como lidas' : 'Nenhuma notificação pendente',
    });
  }
}
