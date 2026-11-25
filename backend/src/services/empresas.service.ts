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

  public mapCompany(company: any, qsa?: any[]) {
    const enderecoParts = [
      company.logradouro,
      company.bairro,
      company.municipio,
      company.uf,
      company.cep,
    ]
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);

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
      cnaes_secundarios: company.nicho || [],
      cnaesSecundarios: company.nicho || [],
      cep: company.cep ?? null,
      logradouro: company.logradouro ?? null,
      bairro: company.bairro ?? null,
      endereco: enderecoParts.length > 0 ? enderecoParts.join(', ') : null,
      telefone: company.telefone ?? null,
      email: company.email ?? null,
      porte: company.porte ?? null,
      municipio: company.municipio,
      uf: company.uf,
      status: company.status,
      nicho: company.nicho,
      palavras_chave: company.palavrasChave,
      palavrasChave: company.palavrasChave,
      radar_tipos_objeto: Array.isArray(company.radarTiposObjeto) ? company.radarTiposObjeto : [],
      radarTiposObjeto: Array.isArray(company.radarTiposObjeto) ? company.radarTiposObjeto : [],
      radar_incluir_sem_classificacao: company.radarIncluirSemClassificacao ?? true,
      radarIncluirSemClassificacao: company.radarIncluirSemClassificacao ?? true,
      valor_min: company.valorMin ? Number(company.valorMin) : null,
      valor_max: company.valorMax ? Number(company.valorMax) : null,
      regioes: company.regioes,
      orgaos_preferidos: company.orgaosPreferidos,
      orgaos_bloqueados: company.orgaosBloqueados,
      // Perfil Tributário
      regimeTributario: company.regimeTributario || 'SIMPLES_NACIONAL',
      regime_tributario: company.regimeTributario || 'SIMPLES_NACIONAL',
      anexoSimples: company.anexoSimples || 'ANEXO_I_COMERCIO',
      anexo_simples: company.anexoSimples || 'ANEXO_I_COMERCIO',
      faixaFaturamentoRbt12: company.faixaFaturamentoRbt12 ? Number(company.faixaFaturamentoRbt12) : null,
      faixa_faturamento_rbt12: company.faixaFaturamentoRbt12 ? Number(company.faixaFaturamentoRbt12) : null,
      aliquotaEfetivaSimples: company.aliquotaEfetivaSimples ? Number(company.aliquotaEfetivaSimples) : 6.0,
      aliquota_efetiva_simples: company.aliquotaEfetivaSimples ? Number(company.aliquotaEfetivaSimples) : 6.0,
      ufSede: company.ufSede || company.uf || null,
      uf_sede: company.ufSede || company.uf || null,
      municipioSede: company.municipioSede || company.municipio || null,
      municipio_sede: company.municipioSede || company.municipio || null,
      aliquotaIssPadrao: company.aliquotaIssPadrao ? Number(company.aliquotaIssPadrao) : 3.0,
      aliquota_iss_padrao: company.aliquotaIssPadrao ? Number(company.aliquotaIssPadrao) : 3.0,
      aliquotaIcmsInterna: company.aliquotaIcmsInterna ? Number(company.aliquotaIcmsInterna) : 18.0,
      aliquota_icms_interna: company.aliquotaIcmsInterna ? Number(company.aliquotaIcmsInterna) : 18.0,
      regimeSubstituicaoTributaria: company.regimeSubstituicaoTributaria ?? false,
      regime_substituicao_tributaria: company.regimeSubstituicaoTributaria ?? false,
      desoneracaoFolha: company.desoneracaoFolha ?? false,
      desoneracao_folha: company.desoneracaoFolha ?? false,
      cprb: company.cprb ? Number(company.cprb) : 0.0,
      qsa: qsa || company.qsa || [],
      created_at: company.createdAt instanceof Date ? company.createdAt.toISOString() : String(company.createdAt),
      updated_at: company.updatedAt instanceof Date ? company.updatedAt.toISOString() : String(company.updatedAt),
    };
  }

  public async listar(userId: string) {
    const tenantId = await this.getTenantId(userId);
    const rows = await prisma.company.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.mapCompany(r));
  }

  public async buscarPorId(userId: string, id: string) {
    const tenantId = await this.getTenantId(userId);
    const existing = await prisma.company.findFirst({
      where: { id, tenantId, userId },
    });

    if (!existing) {
      throw new ApiError('Empresa não encontrada', 404);
    }

    // Ao buscar/selecionar a empresa, sincroniza com dados cadastrais reais da Receita
    let targetCompany = existing;
    let qsaList: any[] = [];
    try {
      const synced = await sincronizarEmpresaComDadosReceita(existing.id, tenantId);
      if (synced) {
        targetCompany = synced as any;
        qsaList = (synced as any).qsa || [];
      }
    } catch {
      // continua com dados cadastrados
    }

    if (qsaList.length === 0) {
      const cleanDigits = targetCompany.cnpj.replace(/\D/g, '');
      const publicComp = await prisma.publicCompany.findFirst({
        where: { cnpj: cleanDigits },
        select: { partners: true },
      }).catch(() => null);
      if (Array.isArray(publicComp?.partners)) {
        qsaList = publicComp.partners as any[];
      }
    }

    return this.mapCompany(targetCompany, qsaList);
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
    const manualCnae = String(body.cnae_principal ?? body.cnaePrincipal ?? '').trim();
    const manualMunicipio = String(body.municipio ?? body.cidade ?? '').trim();
    const manualUf = body.uf ? String(body.uf).trim().slice(0, 2).toUpperCase() : '';
    const manualStatus = body.status ? String(body.status).trim() : '';
    const manualPorte = body.porte ? String(body.porte).trim() : '';

    const official = await this.consultarEmpresaOficial(cleanCnpj, {
      razao_social: manualRazao,
      nome_fantasia: manualFantasia,
      cnae_principal: manualCnae || undefined,
      municipio: manualMunicipio || undefined,
      uf: manualUf || undefined,
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

    const nichosManuais = this.stringArray(body.nicho ?? body.cnaesSecundarios ?? body.cnaes_secundarios);
    const nichosOficiais = official.cnaes_secundarios || [];
    const nichosFinais = nichosManuais.length > 0
      ? Array.from(new Set([...nichosManuais, ...nichosOficiais]))
      : nichosOficiais;

    const regioesManuais = this.stringArray(body.regioes);
    const ufFinal = (manualUf || official.uf || '').slice(0, 2).toUpperCase() || null;
    const regioesFinais = ufFinal && !regioesManuais.includes(ufFinal)
      ? [...regioesManuais, ufFinal]
      : regioesManuais;
    const razaoFinal = manualRazao || official.razao_social;
    const fantasiaFinal = manualFantasia || official.nome_fantasia;
    const municipioFinal = manualMunicipio || official.municipio || null;

    const row = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId,
          userId,
          cnpj,
          razaoSocial: razaoFinal,
          nomeFantasia: fantasiaFinal,
          cnaePrincipal: manualCnae || official.cnae_principal,
          municipio: manualMunicipio || official.municipio,
          uf: ufFinal,
          cep: this.optionalString(body.cep),
          logradouro: this.optionalString(body.logradouro),
          bairro: this.optionalString(body.bairro),
          telefone: this.optionalString(body.telefone),
          email: this.optionalString(body.email),
          porte: manualPorte || null,
          status: manualStatus || official.status || 'ATIVO',
          nicho: nichosFinais,
          palavrasChave: this.stringArray(body.palavras_chave ?? body.palavrasChave),
          radarTiposObjeto: this.stringArray(body.radar_tipos_objeto ?? body.radarTiposObjeto),
          radarIncluirSemClassificacao:
            body.radar_incluir_sem_classificacao === undefined && body.radarIncluirSemClassificacao === undefined
              ? true
              : Boolean(body.radar_incluir_sem_classificacao ?? body.radarIncluirSemClassificacao),
          valorMin: this.numberOrNull(body.valor_min),
          valorMax: this.numberOrNull(body.valor_max),
          regioes: regioesFinais,
          orgaosPreferidos: this.stringArray(body.orgaos_preferidos),
          orgaosBloqueados: this.stringArray(body.orgaos_bloqueados),
          regimeTributario: this.optionalString(body.regime_tributario ?? body.regimeTributario) || 'SIMPLES_NACIONAL',
          anexoSimples: this.optionalString(body.anexo_simples ?? body.anexoSimples) || 'ANEXO_I_COMERCIO',
          faixaFaturamentoRbt12: this.numberOrNull(body.faixa_faturamento_rbt12 ?? body.faixaFaturamentoRbt12),
          aliquotaEfetivaSimples: this.numberOrNull(body.aliquota_efetiva_simples ?? body.aliquotaEfetivaSimples) ?? 6.0,
          ufSede: this.optionalString(body.uf_sede ?? body.ufSede ?? ufFinal),
          municipioSede: this.optionalString(body.municipio_sede ?? body.municipioSede ?? municipioFinal),
          aliquotaIssPadrao: this.numberOrNull(body.aliquota_iss_padrao ?? body.aliquotaIssPadrao) ?? 3.0,
          aliquotaIcmsInterna: this.numberOrNull(body.aliquota_icms_interna ?? body.aliquotaIcmsInterna) ?? 18.0,
          regimeSubstituicaoTributaria: Boolean(body.regime_substituicao_tributaria ?? body.regimeSubstituicaoTributaria ?? false),
          desoneracaoFolha: Boolean(body.desoneracao_folha ?? body.desoneracaoFolha ?? false),
          cprb: this.numberOrNull(body.cprb) ?? 0.0,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          tipo: 'empresa_configurada',
          titulo: 'Empresa configurada com sucesso',
          mensagem: `${razaoFinal} foi vinculada à conta.`,
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
    const hasCnpjInput = body.cnpj !== undefined && String(body.cnpj ?? '').trim() !== '';
    const requestedCnpj = hasCnpjInput
      ? String(body.cnpj).toUpperCase().replace(/[^A-Z0-9]/g, '')
      : atualRow.cnpj;
    const cnpjChanged = Boolean(requestedCnpj && requestedCnpj !== atualRow.cnpj);

    const official = cnpjChanged
      ? await this.consultarEmpresaOficial(requestedCnpj)
      : null;
    const cnpj = official ? official.cnpj : (requestedCnpj || atualRow.cnpj);

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

    const rawRazao = body.razaoSocial ?? body.razao_social ?? body.razoesocial;
    const rawFantasia = body.nomeFantasia ?? body.nome_fantasia;
    const rawCnae = body.cnaePrincipal ?? body.cnae_principal;
    const rawMunicipio = body.municipio ?? body.cidade;
    const rawUf = body.uf;
    const rawNicho = body.nicho ?? body.cnaesSecundarios ?? body.cnaes_secundarios;
    const rawPalavras = body.palavrasChave ?? body.palavras_chave;

    const nextRazao = rawRazao !== undefined && String(rawRazao ?? '').trim()
      ? String(rawRazao).trim()
      : (official?.razao_social ?? atualRow.razaoSocial);
    const nextFantasia = rawFantasia !== undefined
      ? (String(rawFantasia ?? '').trim() || null)
      : (official?.nome_fantasia ?? atualRow.nomeFantasia);
    const nextCnae = rawCnae !== undefined
      ? (String(rawCnae ?? '').trim() || null)
      : (official?.cnae_principal ?? atualRow.cnaePrincipal);
    const nextMunicipio = rawMunicipio !== undefined
      ? (String(rawMunicipio ?? '').trim() || null)
      : (official?.municipio ?? atualRow.municipio);
    const nextUf = rawUf !== undefined
      ? (String(rawUf ?? '').trim().slice(0, 2).toUpperCase() || null)
      : (official?.uf ?? atualRow.uf);
    const nextStatus = body.status !== undefined
      ? (String(body.status ?? '').trim() || null)
      : (official?.status ?? atualRow.status);

    const row = await prisma.company.update({
      where: { id },
      data: {
        cnpj,
        razaoSocial: nextRazao,
        nomeFantasia: nextFantasia,
        cnaePrincipal: nextCnae,
        municipio: nextMunicipio,
        uf: nextUf,
        cep: body.cep === undefined ? atualRow.cep : this.optionalString(body.cep),
        logradouro: body.logradouro === undefined ? atualRow.logradouro : this.optionalString(body.logradouro),
        bairro: body.bairro === undefined ? atualRow.bairro : this.optionalString(body.bairro),
        telefone: body.telefone === undefined ? atualRow.telefone : this.optionalString(body.telefone),
        email: body.email === undefined ? atualRow.email : this.optionalString(body.email),
        porte: body.porte === undefined ? atualRow.porte : this.optionalString(body.porte),
        status: nextStatus,
        nicho: rawNicho === undefined ? atual.nicho : this.stringArray(rawNicho),
        palavrasChave: rawPalavras === undefined
          ? atual.palavras_chave
          : this.stringArray(rawPalavras),
        radarTiposObjeto:
          body.radar_tipos_objeto === undefined && body.radarTiposObjeto === undefined
            ? atual.radar_tipos_objeto
            : this.stringArray(body.radar_tipos_objeto ?? body.radarTiposObjeto),
        radarIncluirSemClassificacao:
          body.radar_incluir_sem_classificacao === undefined && body.radarIncluirSemClassificacao === undefined
            ? atual.radar_incluir_sem_classificacao
            : Boolean(body.radar_incluir_sem_classificacao ?? body.radarIncluirSemClassificacao),
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
        regimeTributario: body.regime_tributario === undefined && body.regimeTributario === undefined
          ? (atualRow.regimeTributario || 'SIMPLES_NACIONAL')
          : (this.optionalString(body.regime_tributario ?? body.regimeTributario) || 'SIMPLES_NACIONAL'),
        anexoSimples: body.anexo_simples === undefined && body.anexoSimples === undefined
          ? (atualRow.anexoSimples || 'ANEXO_I_COMERCIO')
          : (this.optionalString(body.anexo_simples ?? body.anexoSimples) || 'ANEXO_I_COMERCIO'),
        faixaFaturamentoRbt12: body.faixa_faturamento_rbt12 === undefined && body.faixaFaturamentoRbt12 === undefined
          ? atualRow.faixaFaturamentoRbt12
          : this.numberOrNull(body.faixa_faturamento_rbt12 ?? body.faixaFaturamentoRbt12),
        aliquotaEfetivaSimples: body.aliquota_efetiva_simples === undefined && body.aliquotaEfetivaSimples === undefined
          ? atualRow.aliquotaEfetivaSimples
          : (this.numberOrNull(body.aliquota_efetiva_simples ?? body.aliquotaEfetivaSimples) ?? 6.0),
        ufSede: body.uf_sede === undefined && body.ufSede === undefined
          ? atualRow.ufSede
          : this.optionalString(body.uf_sede ?? body.ufSede),
        municipioSede: body.municipio_sede === undefined && body.municipioSede === undefined
          ? atualRow.municipioSede
          : this.optionalString(body.municipio_sede ?? body.municipioSede),
        aliquotaIssPadrao: body.aliquota_iss_padrao === undefined && body.aliquotaIssPadrao === undefined
          ? atualRow.aliquotaIssPadrao
          : (this.numberOrNull(body.aliquota_iss_padrao ?? body.aliquotaIssPadrao) ?? 3.0),
        aliquotaIcmsInterna: body.aliquota_icms_interna === undefined && body.aliquotaIcmsInterna === undefined
          ? atualRow.aliquotaIcmsInterna
          : (this.numberOrNull(body.aliquota_icms_interna ?? body.aliquotaIcmsInterna) ?? 18.0),
        regimeSubstituicaoTributaria: body.regime_substituicao_tributaria === undefined && body.regimeSubstituicaoTributaria === undefined
          ? atualRow.regimeSubstituicaoTributaria
          : Boolean(body.regime_substituicao_tributaria ?? body.regimeSubstituicaoTributaria),
        desoneracaoFolha: body.desoneracao_folha === undefined && body.desoneracaoFolha === undefined
          ? atualRow.desoneracaoFolha
          : Boolean(body.desoneracao_folha ?? body.desoneracaoFolha),
        cprb: body.cprb === undefined
          ? atualRow.cprb
          : (this.numberOrNull(body.cprb) ?? 0.0),
      },
    });

    return this.mapCompany(row);
  }

  private optionalString(value: unknown) {
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || null;
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
