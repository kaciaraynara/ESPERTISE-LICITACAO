import axios from 'axios';
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

  async enviarSmsTeste(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const telefoneInformado = typeof req.body?.telefone === 'string'
      ? req.body.telefone.trim()
      : '';
    const destinatario = telefoneInformado || req.user?.telefone?.trim() || '';
    const numeroNormalizado = destinatario.replace(/\D/g, '');

    if (numeroNormalizado.length < 10 || numeroNormalizado.length > 15) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PHONE',
        message: 'Informe um telefone válido com DDD para receber o teste.',
      });
    }

    const apiUrl = process.env.WHATSAPP_API_URL?.trim();
    const clientToken = process.env.WHATSAPP_CLIENT_TOKEN?.trim();
    if (!apiUrl || !clientToken) {
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
        message: 'O provedor de WhatsApp não está configurado. Nenhuma mensagem foi enviada.',
      });
    }

    const mensagem = 'Teste de notificação do sistema EXPERTISE.';
    try {
      await axios.post(
        apiUrl,
        { phone: numeroNormalizado, message: mensagem },
        {
          headers: { 'Client-Token': clientToken },
          timeout: 10_000,
        },
      );
    } catch (error) {
      console.error('[Notificacoes] Falha no envio de teste WhatsApp.', {
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
      });
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_DELIVERY_FAILED',
        message: 'O provedor não confirmou o envio da mensagem.',
      });
    }

    const notificacao = await prisma.notification.create({
      data: {
        userId,
        tipo: 'sistema',
        titulo: 'Teste de Notificação WhatsApp/SMS',
        mensagem: `Mensagem de teste enviada para ${numeroNormalizado} pelo provedor configurado.`,
        canal: 'whatsapp',
        status: 'enviada',
        enviadaEm: new Date(),
        lida: false,
      },
    });

    return res.json({
      success: true,
      message: `Mensagem de teste aceita pelo provedor para ${numeroNormalizado}.`,
      data: {
        destinatario: numeroNormalizado,
        timestamp: new Date().toISOString(),
        notificacaoId: notificacao.id,
        status: 'ACCEPTED_BY_PROVIDER',
      },
    });
  }
}
