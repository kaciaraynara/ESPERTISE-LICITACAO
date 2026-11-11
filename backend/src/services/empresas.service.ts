import axios from 'axios';
import { prisma } from '../database/prisma';
import { planGuardService } from './plans/plan-guard.service';
import { ApiError } from '../shared/errors/ApiError';
import { consultarCnpjOficial, sincronizarEmpresaComDadosReceita } from './cnpj.service';

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
      userId: company.userId,
      cnpj: company.cnpj,
      razao_social: company.razaoSocial,
      razaoSocial: company.razaoSocial,
      nome_fantasia: company.nomeFantasia,
      nomeFantasia: company.nomeFantasia,
      cnae_principal: company.cnaePrincipal,
      cnaePrincipal: company.cnaePrincipal,
      municipio: company.municipio,
      uf: company.uf,
      status: company.status,
      nicho: company.nicho,
      palavras_chave: company.palavrasChave,
      palavrasChave: company.palavrasChave,
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
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(this.mapCompany);
  }

  public async buscarPorId(userId: string, id: string) {
    const tenantId = await this.getTenantId(userId);
    const row = await prisma.company.findFirst({
      where: { id, tenantId, userId },
    });
    
    if (!row) {
      throw new ApiError('Empresa não encontrada', 404);
    }
    
    // Se a empresa ainda não tiver cnaePrincipal ou nicho preenchido, sincroniza em background com dados reais da Receita
    if (!row.cnaePrincipal || !row.nicho || row.nicho.length === 0) {
      sincronizarEmpresaComDadosReceita(row.id, tenantId).catch(() => {});
    }

    return this.mapCompany(row);
  }

  public async criar(userId: string, body: Record<string, unknown>) {
    const tenantId = await this.getTenantId(userId);
    const rawCnpj = String(body.cnpj ?? '');
    const cleanCnpj = rawCnpj.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleanCnpj.length !== 14 || /^([A-Z0-9])\1{13}$/.test(cleanCnpj)) {
      throw new ApiError('Informe um CNPJ válido com 14 caracteres alfanuméricos.', 400, 'CNPJ_INVALID');
    }

    const manualRazao = String(
      body.razao_social ?? body.razoesocial ?? body.razaoSocial ?? ''
    ).trim();
    const manualFantasia = String(
      body.nome_fantasia ?? body.nomeFantasia ?? manualRazao ?? ''
    ).trim();

    const official = await this.consultarEmpresaOficial(cleanCnpj, {
      razao_social: manualRazao,
      nome_fantasia: manualFantasia,
      cnae_principal: body.cnae_principal ? String(body.cnae_principal) : undefined,
      municipio: body.municipio ? String(body.municipio) : undefined,
      uf: body.uf ? String(body.uf).trim().slice(0, 2).toUpperCase() : undefined,
    });
    const cnpj = cleanCnpj;

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

    const nichosManuais = this.stringArray(body.nicho);
    const nichosOficiais = official.cnaes_secundarios || [];
    const nichosFinais = Array.from(new Set([...nichosManuais, ...nichosOficiais]));

    const regioesManuais = this.stringArray(body.regioes);
    const ufOficial = official.uf ? official.uf.slice(0, 2).toUpperCase() : null;
    const regioesFinais = ufOficial && !regioesManuais.includes(ufOficial)
      ? [...regioesManuais, ufOficial]
      : regioesManuais;

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
          uf: ufOficial,
          status: official.status || 'ATIVO',
          nicho: nichosFinais,
          palavrasChave: this.stringArray(body.palavras_chave),
          valorMin: this.numberOrNull(body.valor_min),
          valorMax: this.numberOrNull(body.valor_max),
          regioes: regioesFinais,
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
      where: { id, tenantId, userId },
    });

    if (!atualRow) {
      throw new ApiError('Empresa não encontrada', 404);
    }

    const atual = this.mapCompany(atualRow);
    const requestedCnpj = String(body.cnpj ?? atual.cnpj).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const official = !requestedCnpj || requestedCnpj === atualRow.cnpj
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

  private async consultarEmpresaOficial(
    input: string,
    fallbackData?: {
      razao_social?: string;
      nome_fantasia?: string;
      municipio?: string;
      uf?: string;
      cnae_principal?: string;
    }
  ) {
    const cnpj = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cnpj.length !== 14 || /^([A-Z0-9])\1{13}$/.test(cnpj)) {
      throw new ApiError('Informe um CNPJ válido com 14 caracteres alfanuméricos.', 400, 'CNPJ_INVALID');
    }

    const fallbackRazao = (fallbackData?.razao_social || '').trim()
      || (fallbackData?.nome_fantasia || '').trim()
      || `Empresa ${cnpj}`;
    const fallbackFantasia = (fallbackData?.nome_fantasia || '').trim() || fallbackRazao;

    try {
      const official = await consultarCnpjOficial(cnpj);
      const officialCnpj = official.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '');

      return {
        ...official,
        cnpj: officialCnpj || cnpj,
        razao_social: official.razao_social?.trim() || fallbackRazao,
        nome_fantasia: official.nome_fantasia?.trim() || fallbackFantasia,
        cnae_principal: official.cnae_principal || fallbackData?.cnae_principal || null,
        cnaes_secundarios: official.cnaes_secundarios || [],
        qsa: official.qsa || [],
        municipio: official.municipio || fallbackData?.municipio || null,
        uf: (official.uf || fallbackData?.uf || null)?.slice(0, 2).toUpperCase() || null,
        status: official.status || 'ATIVO',
      };
    } catch (error) {
      console.warn(`[EMPRESAS_CNPJ_FALLBACK] Consulta oficial externa falhou para CNPJ ${cnpj}. Aplicando fallback local:`, error instanceof Error ? error.message : error);

      return {
        cnpj,
        razao_social: fallbackRazao,
        nome_fantasia: fallbackFantasia,
        cnae_principal: fallbackData?.cnae_principal || null,
        cnaes_secundarios: [],
        qsa: [],
        municipio: fallbackData?.municipio || null,
        uf: fallbackData?.uf ? fallbackData.uf.slice(0, 2).toUpperCase() : null,
        status: 'ATIVO',
      };
    }
  }

  private numberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}

export const empresasService = new EmpresasService();
