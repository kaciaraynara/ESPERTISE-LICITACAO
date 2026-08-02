import axios from 'axios';
import { prisma } from '../database/prisma';
import { planGuardService } from './plans/plan-guard.service';
import { ApiError } from '../shared/errors/ApiError';
import { consultarCnpjOficial } from './cnpj.service';

export class EmpresasService {
  private async getTenantId(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenantId: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new ApiError(
        'Conta não encontrada ou inativa.',
        401,
        'ACCOUNT_UNAVAILABLE',
      );
    }

    return user.tenantId;
  }

  public mapCompany(company: any) {
    return {
      id: company.id,
      user_id: company.userId,
      cnpj: company.cnpj,
      razao_social: company.razaoSocial,
      nome_fantasia: company.nomeFantasia,
      cnae_principal: company.cnaePrincipal,
      municipio: company.municipio,
      uf: company.uf,
      status: company.status,
      nicho: company.nicho,
      palavras_chave: company.palavrasChave,
      valor_min: company.valorMin ? Number(company.valorMin) : null,
      valor_max: company.valorMax ? Number(company.valorMax) : null,
      regioes: company.regioes,
      orgaos_preferidos: company.orgaosPreferidos,
      orgaos_bloqueados: company.orgaosBloqueados,
      created_at: company.createdAt.toISOString(),
      updated_at: company.updatedAt.toISOString(),
    };
  }

  public async listar(userId: string) {
    const tenantId = await this.getTenantId(userId);
    const rows = await prisma.company.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(this.mapCompany);
  }

  public async buscarPorId(userId: string, id: string) {
    const tenantId = await this.getTenantId(userId);
    const row = await prisma.company.findFirst({
      where: { id, tenantId },
    });
    
    if (!row) {
      throw new ApiError('Empresa não encontrada', 404);
    }
    
    return this.mapCompany(row);
  }

  public async criar(userId: string, body: Record<string, unknown>) {
    const tenantId = await this.getTenantId(userId);
    const official = await this.consultarEmpresaOficial(String(body.cnpj ?? ''));
    const cnpj = official.cnpj;

    const existingCompany = await prisma.company.findFirst({
      where: { tenantId, cnpj },
      select: { id: true },
    });

    if (existingCompany) {
      throw new ApiError(
        'Já existe uma empresa cadastrada com este CNPJ.',
        409,
        'COMPANY_ALREADY_EXISTS',
      );
    }

    const currentCompanyCount = await prisma.company.count({
      where: { tenantId },
    });
    await planGuardService.assertCanCreateCompany(userId, currentCompanyCount);

    const row = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId,
          userId,
          cnpj,
          razaoSocial: official.razao_social,
          nomeFantasia: official.nome_fantasia,
          cnaePrincipal: official.cnae_principal,
          municipio: official.municipio,
          uf: official.uf,
          status: official.status,
          nicho: this.stringArray(body.nicho),
          palavrasChave: this.stringArray(body.palavras_chave),
          valorMin: this.numberOrNull(body.valor_min),
          valorMax: this.numberOrNull(body.valor_max),
          regioes: this.stringArray(body.regioes),
          orgaosPreferidos: this.stringArray(body.orgaos_preferidos),
          orgaosBloqueados: this.stringArray(body.orgaos_bloqueados),
        },
      });

      await tx.notification.create({
        data: {
          userId,
          tipo: 'empresa_configurada',
          titulo: 'Empresa configurada com sucesso',
          mensagem: `${official.razao_social} foi vinculada à conta.`,
          link: '/fornecedor/dashboard',
          status: 'enviada',
          enviadaEm: new Date(),
          lida: false,
        },
      });

      return company;
    });

    return this.mapCompany(row);
  }

  public async atualizar(userId: string, id: string, body: Record<string, unknown>) {
    const tenantId = await this.getTenantId(userId);
    const atualRow = await prisma.company.findFirst({
      where: { id, tenantId },
    });

    if (!atualRow) {
      throw new ApiError('Empresa não encontrada', 404);
    }

    const atual = this.mapCompany(atualRow);
    const requestedCnpj = String(body.cnpj ?? atual.cnpj).replace(/\D/g, '');
    const official = requestedCnpj === atualRow.cnpj
      ? {
          cnpj: atualRow.cnpj,
          razao_social: atualRow.razaoSocial,
          nome_fantasia: atualRow.nomeFantasia,
          cnae_principal: atualRow.cnaePrincipal,
          municipio: atualRow.municipio,
          uf: atualRow.uf,
          status: atualRow.status,
        }
      : await this.consultarEmpresaOficial(requestedCnpj);
    const cnpj = official.cnpj;

    const conflict = await prisma.company.findFirst({
      where: {
        tenantId,
        cnpj,
        id: { not: id },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ApiError(
        'Já existe outra empresa cadastrada com este CNPJ.',
        409,
        'COMPANY_ALREADY_EXISTS',
      );
    }

    const row = await prisma.company.update({
      where: { id },
      data: {
        cnpj,
        razaoSocial: official.razao_social,
        nomeFantasia: official.nome_fantasia,
        cnaePrincipal: official.cnae_principal,
        municipio: official.municipio,
        uf: official.uf,
        status: official.status,
        nicho: body.nicho === undefined ? atual.nicho : this.stringArray(body.nicho),
        palavrasChave: body.palavras_chave === undefined
          ? atual.palavras_chave
          : this.stringArray(body.palavras_chave),
        valorMin: body.valor_min === undefined ? atual.valor_min : this.numberOrNull(body.valor_min),
        valorMax: body.valor_max === undefined ? atual.valor_max : this.numberOrNull(body.valor_max),
        regioes: body.regioes === undefined
          ? atual.regioes
          : this.stringArray(body.regioes),
        orgaosPreferidos: body.orgaos_preferidos === undefined
          ? atual.orgaos_preferidos
          : this.stringArray(body.orgaos_preferidos),
        orgaosBloqueados: body.orgaos_bloqueados === undefined
          ? atual.orgaos_bloqueados
          : this.stringArray(body.orgaos_bloqueados),
      },
    });

    return this.mapCompany(row);
  }

  private stringArray(value: unknown) {
    return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
  }

  private async consultarEmpresaOficial(input: string) {
    const cnpj = input.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      throw new ApiError('Informe um CNPJ válido com 14 dígitos.', 400, 'CNPJ_INVALID');
    }

    try {
      const official = await consultarCnpjOficial(cnpj);
      const officialCnpj = official.cnpj.replace(/\D/g, '');
      if (
        officialCnpj !== cnpj
        || !official.razao_social?.trim()
      ) {
        throw new ApiError(
          'A fonte oficial retornou dados incompletos para o CNPJ informado.',
          503,
          'CNPJ_INVALID_RESPONSE',
        );
      }

      return {
        ...official,
        cnpj: officialCnpj,
        razao_social: official.razao_social.trim(),
        nome_fantasia: official.nome_fantasia?.trim() || null,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new ApiError(
            'CNPJ não encontrado na fonte oficial.',
            422,
            'CNPJ_NOT_FOUND',
          );
        }

        const timedOut = error.response?.status === 408
          || error.response?.status === 504
          || error.code === 'ECONNABORTED'
          || error.code === 'ETIMEDOUT';
        throw new ApiError(
          timedOut
            ? 'A fonte oficial de CNPJ demorou para responder.'
            : 'A fonte oficial de CNPJ está temporariamente indisponível.',
          timedOut ? 504 : 503,
          timedOut ? 'CNPJ_SERVICE_TIMEOUT' : 'CNPJ_SERVICE_UNAVAILABLE',
        );
      }

      throw new ApiError(
        'Não foi possível validar o CNPJ na fonte oficial.',
        503,
        'CNPJ_SERVICE_UNAVAILABLE',
      );
    }
  }

  private numberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}

export const empresasService = new EmpresasService();
