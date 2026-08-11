import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';

export class CatalogoController {
  public async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await prisma.company.findFirst({ where: { userId } });
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const items = await prisma.catalogItem.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: items });
  }

  public async criar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await prisma.company.findFirst({ where: { userId } });
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const {
      sku, codigoCatmat, nome, categoria, custoBase,
      precoMinimoLicitacao, unidadeMedida, status
    } = req.body;

    const item = await prisma.catalogItem.create({
      data: {
        companyId: company.id,
        sku,
        codigoCatmat,
        nome,
        categoria: categoria || 'MATERIAL',
        custoBase: custoBase ? Number(custoBase) : null,
        precoMinimoLicitacao: precoMinimoLicitacao ? Number(precoMinimoLicitacao) : null,
        unidadeMedida: unidadeMedida || 'UN',
        status: status || 'ATIVO',
      },
    });

    return res.status(201).json({ success: true, data: item });
  }

  public async atualizar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;
    const {
      sku, codigoCatmat, nome, categoria, custoBase,
      precoMinimoLicitacao, unidadeMedida, status
    } = req.body;

    const itemExists = await prisma.catalogItem.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!itemExists || itemExists.company.userId !== userId) {
      throw new ApiError('Item não encontrado ou acesso negado', 404);
    }

    const item = await prisma.catalogItem.update({
      where: { id },
      data: {
        sku,
        codigoCatmat,
        nome,
        categoria,
        custoBase: custoBase !== undefined ? Number(custoBase) : undefined,
        precoMinimoLicitacao: precoMinimoLicitacao !== undefined ? Number(precoMinimoLicitacao) : undefined,
        unidadeMedida,
        status,
      },
    });

    return res.json({ success: true, data: item });
  }

  public async remover(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;

    const itemExists = await prisma.catalogItem.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!itemExists || itemExists.company.userId !== userId) {
      throw new ApiError('Item não encontrado ou acesso negado', 404);
    }

    await prisma.catalogItem.delete({ where: { id } });

    return res.status(204).send();
  }
}
