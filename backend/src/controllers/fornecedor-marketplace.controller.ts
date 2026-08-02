import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import {
  FornecedorMarketplaceInput,
  FornecedorMarketplaceService,
  FornecedorMarketplaceUpdateInput,
} from '../services/fornecedor-marketplace.service';

const fornecedores = new FornecedorMarketplaceService();

const fornecedorSchema = z.object({
  cnpj: z.string().trim().min(11),
  razaoSocial: z.string().trim().min(2),
  nomeFantasia: z.string().trim().nullable().optional(),
  cnaePrincipal: z.string().trim().min(2),
  ramoAtividade: z.string().trim().min(2),
  regiaoAtendimento: z.union([z.array(z.string()), z.string()]).optional().transform(toStringArray),
  municipio: z.string().trim().nullable().optional(),
  uf: z.string().trim().length(2).nullable().optional(),
  notaReputacao: z.coerce.number().min(0).max(5).optional(),
  selosConformidade: z.union([z.array(z.string()), z.string()]).optional().transform(toStringArray),
  custoReferencia: z.coerce.number().min(0).nullable().optional(),
  unidadeCusto: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

const fornecedorUpdateSchema = fornecedorSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar o fornecedor.',
});

export class FornecedorMarketplaceController {
  async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    try {
      const data = await fornecedores.listar({
        busca: stringOrUndefined(req.query.busca),
        cnae: stringOrUndefined(req.query.cnae),
        regiao: stringOrUndefined(req.query.regiao),
        uf: stringOrUndefined(req.query.uf),
        limit: numberOrUndefined(req.query.limit),
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      return handleFornecedorError(error, res);
    }
  }

  async buscarPorId(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    try {
      const data = await fornecedores.buscarPorId(req.params.id);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return handleFornecedorError(error, res);
    }
  }

  async criar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const parsed = fornecedorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para cadastro de fornecedor.',
        errors: parsed.error.errors,
      });
    }

    try {
      const data = await fornecedores.criar(userId, parsed.data as FornecedorMarketplaceInput);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleFornecedorError(error, res);
    }
  }

  async atualizar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const parsed = fornecedorUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para atualização de fornecedor.',
        errors: parsed.error.errors,
      });
    }

    try {
      const data = await fornecedores.atualizar(
        req.params.id,
        userId,
        parsed.data as FornecedorMarketplaceUpdateInput,
      );
      if (!data) {
        return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return handleFornecedorError(error, res);
    }
  }

  async remover(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    try {
      const removed = await fornecedores.remover(req.params.id, userId);
      if (!removed) {
        return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
      }

      return res.status(204).send();
    } catch (error) {
      return handleFornecedorError(error, res);
    }
  }
}

function toStringArray(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function handleFornecedorError(error: unknown, res: Response) {
  const message = error instanceof Error ? error.message : 'Erro ao processar fornecedor do marketplace.';
  const prismaCode = getPrismaCode(error);

  if (message === 'FORNECEDOR_CNPJ_INVALIDO') {
    return res.status(400).json({ success: false, message: 'CNPJ inválido. Informe 14 dígitos.' });
  }

  if (message === 'FORNECEDOR_CNPJ_DUPLICADO' || prismaCode === 'P2002') {
    return res.status(409).json({ success: false, message: 'Já existe fornecedor cadastrado com este CNPJ.' });
  }

  if (message === 'FORNECEDOR_MARKETPLACE_FORBIDDEN') {
    return res.status(403).json({
      success: false,
      message: 'Você não possui permissão para alterar este fornecedor.',
    });
  }

  if (prismaCode === 'P2025') {
    return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
  }

  console.error(JSON.stringify({
    event: 'FORNECEDOR_MARKETPLACE_FAILED',
    error: message,
    timestamp: new Date().toISOString(),
  }));

  return res.status(500).json({
    success: false,
    message: 'Erro ao processar diretório corporativo de fornecedores.',
  });
}

function getPrismaCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
