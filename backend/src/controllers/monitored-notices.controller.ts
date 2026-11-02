import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';

export class MonitoredNoticesController {
  /**
   * GET /monitored-notices
   * Lista todos os editais monitorados da empresa do usuário autenticado.
   */
  public async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await prisma.company.findFirst({ where: { userId } });
    if (!company) {
      // Usuário sem empresa cadastrada: retorna lista vazia (sem erro)
      return res.json({ success: true, data: [], meta: { total: 0 } });
    }

    const pagina = Math.max(1, Number(req.query.pagina ?? 1));
    const limite = Math.min(100, Math.max(1, Number(req.query.limite ?? 20)));
    const skip = (pagina - 1) * limite;

    const [total, registros] = await Promise.all([
      prisma.companyMonitoredNotice.count({
        where: { companyId: company.id },
      }),
      prisma.companyMonitoredNotice.findMany({
        where: { companyId: company.id },
        skip,
        take: limite,
        orderBy: { createdAt: 'desc' },
        include: {
          procurementNotice: {
            select: {
              id: true,
              noticeNumber: true,
              modality: true,
              buyerName: true,
              buyerDocument: true,
              object: true,
              uf: true,
              municipality: true,
              estimatedValue: true,
              status: true,
              url: true,
              publishedAt: true,
              openingAt: true,
              closingAt: true,
              source: true,
              externalId: true,
            },
          },
        },
      }),
    ]);

    const data = registros.map((r) => ({
      id: r.id,
      status: r.status,
      priority: r.priority,
      notes: r.notes,
      monitoradoEm: r.createdAt,
      edital: r.procurementNotice
        ? {
            id: r.procurementNotice.id,
            numeroProcesso: r.procurementNotice.noticeNumber,
            orgao: r.procurementNotice.buyerName,
            cnpjOrgao: r.procurementNotice.buyerDocument,
            objeto: r.procurementNotice.object,
            modalidade: r.procurementNotice.modality,
            uf: r.procurementNotice.uf,
            municipio: r.procurementNotice.municipality,
            valorEstimado: r.procurementNotice.estimatedValue
              ? Number(r.procurementNotice.estimatedValue)
              : null,
            situacao: r.procurementNotice.status,
            link: r.procurementNotice.url,
            dataPublicacao: r.procurementNotice.publishedAt,
            dataAbertura: r.procurementNotice.openingAt,
            dataEncerramento: r.procurementNotice.closingAt,
            fonte: r.procurementNotice.source,
            idExterno: r.procurementNotice.externalId,
          }
        : null,
    }));

    return res.json({
      success: true,
      data,
      meta: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    });
  }

  /**
   * DELETE /monitored-notices/:id
   * Remove um edital da watchlist do usuário.
   */
  public async remover(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;

    const registro = await prisma.companyMonitoredNotice.findUnique({
      where: { id },
      include: { company: { select: { userId: true } } },
    });

    if (!registro || registro.company.userId !== userId) {
      throw new ApiError('Registro não encontrado ou acesso negado', 404);
    }

    await prisma.companyMonitoredNotice.delete({ where: { id } });

    return res.json({ success: true, message: 'Edital removido da watchlist' });
  }

  /**
   * PATCH /monitored-notices/:id/prioridade
   * Atualiza a prioridade de um edital monitorado.
   */
  public async atualizarPrioridade(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;
    const { priority, notes } = req.body;

    const prioridadesValidas = ['low', 'normal', 'high', 'critical'];
    if (priority && !prioridadesValidas.includes(priority)) {
      throw new ApiError(`Prioridade inválida. Use: ${prioridadesValidas.join(', ')}`, 400);
    }

    const registro = await prisma.companyMonitoredNotice.findUnique({
      where: { id },
      include: { company: { select: { userId: true } } },
    });

    if (!registro || registro.company.userId !== userId) {
      throw new ApiError('Registro não encontrado ou acesso negado', 404);
    }

    const atualizado = await prisma.companyMonitoredNotice.update({
      where: { id },
      data: {
        ...(priority !== undefined && { priority }),
        ...(notes !== undefined && { notes }),
      },
    });

    return res.json({ success: true, data: atualizado });
  }
}
