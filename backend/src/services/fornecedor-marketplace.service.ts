import { isDatabaseConfigured } from '../config/env';
import { prisma } from '../database/prisma';
import { normalizarCnpj } from './cnpj.service';

export interface FornecedorMarketplaceRecord {
  id: string;
  ownerUserId: string | null;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnaePrincipal: string;
  ramoAtividade: string;
  regiaoAtendimento: string[];
  municipio: string | null;
  uf: string | null;
  notaReputacao: number;
  selosConformidade: string[];
  custoReferencia: number | null;
  unidadeCusto: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FornecedorMarketplaceInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnaePrincipal: string;
  ramoAtividade: string;
  regiaoAtendimento?: string[];
  municipio?: string | null;
  uf?: string | null;
  notaReputacao?: number;
  selosConformidade?: string[];
  custoReferencia?: number | null;
  unidadeCusto?: string | null;
  ativo?: boolean;
}

export interface FornecedorMarketplaceUpdateInput extends Partial<FornecedorMarketplaceInput> {}

export interface FornecedorMarketplaceFilters {
  busca?: string;
  cnae?: string;
  regiao?: string;
  uf?: string;
  limit?: number;
}

export interface FornecedorMarketplaceListResult {
  data: FornecedorMarketplaceRecord[];
  meta: {
    total: number;
    filters: FornecedorMarketplaceFilters;
  };
}

interface PrismaFornecedorMarketplaceRow {
  id: string;
  ownerUserId: string | null;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnaePrincipal: string;
  ramoAtividade: string;
  regiaoAtendimento: string[];
  municipio: string | null;
  uf: string | null;
  notaReputacao: unknown;
  selosConformidade: string[];
  custoReferencia: unknown;
  unidadeCusto: string | null;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaFornecedorMarketplaceDelegate {
  findMany(args: unknown): Promise<PrismaFornecedorMarketplaceRow[]>;
  findUnique(args: unknown): Promise<PrismaFornecedorMarketplaceRow | null>;
  create(args: unknown): Promise<PrismaFornecedorMarketplaceRow>;
  update(args: unknown): Promise<PrismaFornecedorMarketplaceRow>;
  delete(args: unknown): Promise<PrismaFornecedorMarketplaceRow>;
}

type PrismaComFornecedorMarketplace = {
  fornecedorMarketplace: PrismaFornecedorMarketplaceDelegate;
};

export class FornecedorMarketplaceService {
  async listar(filters: FornecedorMarketplaceFilters = {}): Promise<FornecedorMarketplaceListResult> {
    const limit = normalizeLimit(filters.limit);
    this.assertDatabaseConfigured();
    const rows = await db().fornecedorMarketplace.findMany({
      where: buildPrismaWhere(filters),
      orderBy: [
        { notaReputacao: 'desc' },
        { razaoSocial: 'asc' },
      ],
      take: limit,
    });
    const data = rows.map(mapPrismaFornecedor);
    return { data, meta: { total: data.length, filters: normalizeFilters(filters, limit) } };
  }

  async buscarPorId(id: string): Promise<FornecedorMarketplaceRecord | null> {
    this.assertDatabaseConfigured();
    const row = await db().fornecedorMarketplace.findUnique({ where: { id } });
    return row ? mapPrismaFornecedor(row) : null;
  }

  async criar(ownerUserId: string, input: FornecedorMarketplaceInput): Promise<FornecedorMarketplaceRecord> {
    const payload = sanitizeCreateInput(input);
    this.assertDatabaseConfigured();
    const row = await db().fornecedorMarketplace.create({
      data: {
        ownerUserId,
        ...payload,
      },
    });
    return mapPrismaFornecedor(row);
  }

  async atualizar(
    id: string,
    ownerUserId: string,
    input: FornecedorMarketplaceUpdateInput,
  ): Promise<FornecedorMarketplaceRecord | null> {
    const payload = sanitizeUpdateInput(input);
    this.assertDatabaseConfigured();
    const existing = await db().fornecedorMarketplace.findUnique({
      where: { id },
    });
    if (!existing) return null;
    assertFornecedorOwnership(existing.ownerUserId, ownerUserId);
    const row = await db().fornecedorMarketplace.update({
      where: { id },
      data: payload,
    });
    return mapPrismaFornecedor(row);
  }

  async remover(id: string, ownerUserId: string): Promise<boolean> {
    this.assertDatabaseConfigured();
    const existing = await db().fornecedorMarketplace.findUnique({
      where: { id },
    });
    if (!existing) return false;
    assertFornecedorOwnership(existing.ownerUserId, ownerUserId);
    await db().fornecedorMarketplace.delete({
      where: { id },
    });
    return true;
  }

  private assertDatabaseConfigured() {
    if (!isDatabaseConfigured()) {
      throw new Error('DATABASE_URL obrigatoria para FornecedorMarketplaceService.');
    }
  }
}


function assertFornecedorOwnership(
  recordOwnerUserId: string | null,
  authenticatedUserId: string,
) {
  if (!recordOwnerUserId || recordOwnerUserId !== authenticatedUserId) {
    throw new Error('FORNECEDOR_MARKETPLACE_FORBIDDEN');
  }
}

function db(): PrismaComFornecedorMarketplace {
  return prisma as unknown as PrismaComFornecedorMarketplace;
}

function sanitizeCreateInput(input: FornecedorMarketplaceInput): Omit<FornecedorMarketplaceRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'> {
  const cnpj = normalizarCnpj(input.cnpj);
  if (cnpj.length !== 14) throw new Error('FORNECEDOR_CNPJ_INVALIDO');

  const razaoSocial = requiredText(input.razaoSocial, 'FORNECEDOR_RAZAO_SOCIAL_OBRIGATORIA');
  const cnaePrincipal = requiredText(input.cnaePrincipal, 'FORNECEDOR_CNAE_OBRIGATORIO');
  const ramoAtividade = requiredText(input.ramoAtividade, 'FORNECEDOR_RAMO_OBRIGATORIO');

  return {
    cnpj,
    razaoSocial,
    nomeFantasia: nullableText(input.nomeFantasia),
    cnaePrincipal,
    ramoAtividade,
    regiaoAtendimento: normalizeStringList(input.regiaoAtendimento),
    municipio: nullableText(input.municipio),
    uf: normalizeUf(input.uf),
    notaReputacao: normalizeReputacao(input.notaReputacao),
    selosConformidade: normalizeStringList(input.selosConformidade),
    custoReferencia: normalizeNullableMoney(input.custoReferencia),
    unidadeCusto: nullableText(input.unidadeCusto),
    ativo: input.ativo ?? true,
  };
}

function sanitizeUpdateInput(input: FornecedorMarketplaceUpdateInput): Partial<Omit<FornecedorMarketplaceRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>> {
  const payload: Partial<Omit<FornecedorMarketplaceRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>> = {};

  if (input.cnpj !== undefined) {
    const cnpj = normalizarCnpj(input.cnpj);
    if (cnpj.length !== 14) throw new Error('FORNECEDOR_CNPJ_INVALIDO');
    payload.cnpj = cnpj;
  }
  if (input.razaoSocial !== undefined) payload.razaoSocial = requiredText(input.razaoSocial, 'FORNECEDOR_RAZAO_SOCIAL_OBRIGATORIA');
  if (input.nomeFantasia !== undefined) payload.nomeFantasia = nullableText(input.nomeFantasia);
  if (input.cnaePrincipal !== undefined) payload.cnaePrincipal = requiredText(input.cnaePrincipal, 'FORNECEDOR_CNAE_OBRIGATORIO');
  if (input.ramoAtividade !== undefined) payload.ramoAtividade = requiredText(input.ramoAtividade, 'FORNECEDOR_RAMO_OBRIGATORIO');
  if (input.regiaoAtendimento !== undefined) payload.regiaoAtendimento = normalizeStringList(input.regiaoAtendimento);
  if (input.municipio !== undefined) payload.municipio = nullableText(input.municipio);
  if (input.uf !== undefined) payload.uf = normalizeUf(input.uf);
  if (input.notaReputacao !== undefined) payload.notaReputacao = normalizeReputacao(input.notaReputacao);
  if (input.selosConformidade !== undefined) payload.selosConformidade = normalizeStringList(input.selosConformidade);
  if (input.custoReferencia !== undefined) payload.custoReferencia = normalizeNullableMoney(input.custoReferencia);
  if (input.unidadeCusto !== undefined) payload.unidadeCusto = nullableText(input.unidadeCusto);
  if (input.ativo !== undefined) payload.ativo = input.ativo;

  return payload;
}

function buildPrismaWhere(filters: FornecedorMarketplaceFilters): Record<string, unknown> {
  const where: Record<string, unknown> = { ativo: true };
  const busca = normalizeSearch(filters.busca);
  const cnae = nullableText(filters.cnae);
  const regiao = nullableText(filters.regiao);
  const uf = normalizeUf(filters.uf);

  if (busca) {
    where.OR = [
      { razaoSocial: { contains: busca, mode: 'insensitive' } },
      { nomeFantasia: { contains: busca, mode: 'insensitive' } },
      { cnpj: { contains: normalizarCnpj(busca) || busca, mode: 'insensitive' } },
      { cnaePrincipal: { contains: busca, mode: 'insensitive' } },
      { ramoAtividade: { contains: busca, mode: 'insensitive' } },
      { municipio: { contains: busca, mode: 'insensitive' } },
    ];
  }
  if (cnae) where.cnaePrincipal = { contains: cnae, mode: 'insensitive' };
  if (regiao) where.regiaoAtendimento = { has: regiao.toUpperCase() };
  if (uf) where.uf = uf;

  return where;
}

function mapPrismaFornecedor(row: PrismaFornecedorMarketplaceRow): FornecedorMarketplaceRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    cnaePrincipal: row.cnaePrincipal,
    ramoAtividade: row.ramoAtividade,
    regiaoAtendimento: row.regiaoAtendimento,
    municipio: row.municipio,
    uf: row.uf,
    notaReputacao: Number(row.notaReputacao),
    selosConformidade: row.selosConformidade,
    custoReferencia: row.custoReferencia === null || row.custoReferencia === undefined ? null : Number(row.custoReferencia),
    unidadeCusto: row.unidadeCusto,
    ativo: row.ativo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeFilters(filters: FornecedorMarketplaceFilters, limit: number): FornecedorMarketplaceFilters {
  return {
    busca: nullableText(filters.busca) ?? undefined,
    cnae: nullableText(filters.cnae) ?? undefined,
    regiao: nullableText(filters.regiao) ?? undefined,
    uf: normalizeUf(filters.uf) ?? undefined,
    limit,
  };
}

function requiredText(value: string | null | undefined, code: string) {
  const normalized = nullableText(value);
  if (!normalized) throw new Error(code);
  return normalized;
}

function nullableText(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeSearch(value: string | null | undefined) {
  return nullableText(value);
}

function normalizeUf(value: string | null | undefined) {
  const normalized = nullableText(value)?.toUpperCase();
  return normalized && normalized.length === 2 ? normalized : null;
}

function normalizeStringList(values: string[] | null | undefined) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeReputacao(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value * 100) / 100, 0), 5);
}

function normalizeNullableMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function normalizeLimit(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 40;
  return Math.max(1, Math.min(Math.trunc(value), 200));
}

