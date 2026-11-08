import { Response } from 'express';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';

export class CatalogoController {
  public async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await resolveAuthorizedCompany(userId, req.companyId);
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const items = await prisma.catalogItem.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = items.map((item) => ({
      ...item,
      custoBase: item.custoBase !== null ? Number(item.custoBase) : null,
      precoMinimoLicitacao: item.precoMinimoLicitacao !== null ? Number(item.precoMinimoLicitacao) : null,
      usuario_id: userId,
      empresa_id: company.id,
      razaoSocial: company.razaoSocial,
      visivel_mercado: item.status === 'PUBLICO_MERCADO',
    }));

    return res.json({ success: true, data: mapped });
  }

  public async listarMercado(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const [publicCatalogItems, marketplaceSuppliers] = await Promise.all([
      prisma.catalogItem.findMany({
        where: { status: 'PUBLICO_MERCADO' },
        include: {
          company: {
            select: {
              id: true,
              userId: true,
              razaoSocial: true,
              nomeFantasia: true,
              cnpj: true,
              uf: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),
      prisma.fornecedorMarketplace.findMany({
        where: { ativo: true },
        orderBy: { notaReputacao: 'desc' },
        take: 50,
      }).catch(() => []),
    ]);

    const fromCatalog = publicCatalogItems.map((item: any) => ({
      id: item.id,
      sku: item.sku,
      codigoCatmat: item.codigoCatmat,
      nome: item.nome,
      descricao: item.nome,
      categoria: item.categoria,
      precoAtacado: item.precoMinimoLicitacao !== null
        ? Number(item.precoMinimoLicitacao)
        : item.custoBase !== null
          ? Number(item.custoBase)
          : 0,
      custoBase: item.custoBase !== null ? Number(item.custoBase) : null,
      precoMinimoLicitacao: item.precoMinimoLicitacao !== null ? Number(item.precoMinimoLicitacao) : null,
      unidadeMedida: item.unidadeMedida || 'UN',
      razaoSocial: item.company?.razaoSocial || 'Fornecedor Homologado',
      cnpj: item.company?.cnpj || '',
      uf: item.company?.uf || '',
      empresa_id: item.companyId,
      usuario_id: item.company?.userId || null,
      visivel_mercado: true,
      origem: 'CATALOGO_PUBLICO',
    }));

    const fromSuppliers = marketplaceSuppliers.map((sup: any) => ({
      id: sup.id,
      sku: `FORN-${String(sup.cnpj || '').slice(-4) || '0001'}`,
      codigoCatmat: sup.cnaePrincipal || null,
      nome: sup.ramoAtividade || sup.nomeFantasia || sup.razaoSocial,
      descricao: sup.ramoAtividade || 'Fornecimento de insumos para licitações públicas',
      categoria: 'FORNECEDOR_HOMOLOGADO',
      precoAtacado: sup.custoReferencia !== null ? Number(sup.custoReferencia) : 0,
      custoBase: sup.custoReferencia !== null ? Number(sup.custoReferencia) : null,
      precoMinimoLicitacao: sup.custoReferencia !== null ? Number(sup.custoReferencia) : null,
      unidadeMedida: sup.unidadeCusto || 'UN',
      razaoSocial: sup.razaoSocial,
      cnpj: sup.cnpj,
      uf: sup.uf || '',
      empresa_id: sup.id,
      usuario_id: sup.ownerUserId || null,
      visivel_mercado: true,
      origem: 'BANCO_FORNECEDORES',
    }));

    return res.json({
      success: true,
      data: [...fromCatalog, ...fromSuppliers],
    });
  }

  public async criar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await resolveAuthorizedCompany(userId, req.body?.companyId || req.companyId);
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const {
      sku, codigoCatmat, nome, categoria, custoBase,
      precoMinimoLicitacao, unidadeMedida, status, visivel_mercado,
    } = req.body;

    const isPublic = Boolean(visivel_mercado) || status === 'PUBLICO_MERCADO';
    const effectiveStatus = isPublic ? 'PUBLICO_MERCADO' : (status || 'ATIVO');

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
        status: effectiveStatus,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...item,
        custoBase: item.custoBase !== null ? Number(item.custoBase) : null,
        precoMinimoLicitacao: item.precoMinimoLicitacao !== null ? Number(item.precoMinimoLicitacao) : null,
        usuario_id: userId,
        empresa_id: company.id,
        razaoSocial: company.razaoSocial,
        visivel_mercado: item.status === 'PUBLICO_MERCADO',
      },
    });
  }

  public async atualizar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;
    const {
      sku, codigoCatmat, nome, categoria, custoBase,
      precoMinimoLicitacao, unidadeMedida, status, visivel_mercado,
    } = req.body;

    const itemExists = await prisma.catalogItem.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!itemExists || itemExists.company.userId !== userId) {
      throw new ApiError('Item não encontrado ou acesso negado', 404);
    }

    const effectiveStatus =
      visivel_mercado !== undefined
        ? (visivel_mercado ? 'PUBLICO_MERCADO' : 'ATIVO')
        : status;

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
        status: effectiveStatus,
      },
    });

    return res.json({
      success: true,
      data: {
        ...item,
        custoBase: item.custoBase !== null ? Number(item.custoBase) : null,
        precoMinimoLicitacao: item.precoMinimoLicitacao !== null ? Number(item.precoMinimoLicitacao) : null,
        usuario_id: userId,
        empresa_id: itemExists.companyId,
        razaoSocial: itemExists.company.razaoSocial,
        visivel_mercado: item.status === 'PUBLICO_MERCADO',
      },
    });
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
