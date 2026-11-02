import axios from 'axios';
import { prisma } from '../database/prisma';

export interface CnpjPublicoData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  municipio: string | null;
  uf: string | null;
  cnae_principal: string | null;
  status: string | null;
}

const memoryCnpjCache = new Map<string, { data: CnpjPublicoData; expiresAt: number }>();
const pendingCnpjLookups = new Map<string, Promise<CnpjPublicoData>>();
const MEMORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const DB_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function normalizarCnpj(value: string) {
  return value.replace(/\D/g, '');
}

function getBrasilApiBaseUrl() {
  return (process.env.BRASILAPI_URL || 'https://brasilapi.com.br').replace(/\/+$/, '');
}

export async function consultarCnpjOficial(cnpj: string): Promise<CnpjPublicoData> {
  const cnpjLimpo = normalizarCnpj(cnpj);

  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ_INVALIDO');
  }

  const pending = pendingCnpjLookups.get(cnpjLimpo);
  if (pending) {
    return pending;
  }

  const lookup = consultarCnpjSemCoalescencia(cnpjLimpo);
  pendingCnpjLookups.set(cnpjLimpo, lookup);
  try {
    return await lookup;
  } finally {
    if (pendingCnpjLookups.get(cnpjLimpo) === lookup) {
      pendingCnpjLookups.delete(cnpjLimpo);
    }
  }
}

async function consultarCnpjSemCoalescencia(cnpjLimpo: string): Promise<CnpjPublicoData> {
  // 1. Cache em memória de alta velocidade
  const cachedMem = memoryCnpjCache.get(cnpjLimpo);
  if (cachedMem && cachedMem.expiresAt > Date.now()) {
    return cachedMem.data;
  }

  // 2. Cache persistente na tabela PublicCompany (data_companies)
  const dedupeKey = `cnpj:${cnpjLimpo}`;
  try {
    const dbCached = await prisma.publicCompany.findFirst({
      where: {
        OR: [{ dedupeKey }, { cnpj: cnpjLimpo }],
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (
      dbCached &&
      dbCached.legalName &&
      Date.now() - dbCached.updatedAt.getTime() < DB_CACHE_TTL_MS
    ) {
      const mapped: CnpjPublicoData = {
        cnpj: cnpjLimpo,
        razao_social: dbCached.legalName,
        nome_fantasia: dbCached.tradeName || dbCached.legalName,
        municipio: dbCached.municipality || null,
        uf: dbCached.uf || null,
        cnae_principal: dbCached.mainCnae || null,
        status: dbCached.status || null,
      };
      memoryCnpjCache.set(cnpjLimpo, {
        data: mapped,
        expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
      });
      return mapped;
    }
  } catch (error) {
    console.warn('[CNPJ_CACHE_READ_FAILED] Não foi possível consultar o cache persistente.', error);
  }

  // 3. Provedores externos resilientes com fallback em cascata
  let result: CnpjPublicoData | null = null;
  let rawMetadata: any = null;

  // Tentativa 1: BrasilAPI
  try {
    const response = await axios.get(`${getBrasilApiBaseUrl()}/api/cnpj/v1/${cnpjLimpo}`, {
      timeout: 6000,
    });
    const data = response.data;
    if (data?.razao_social) {
      rawMetadata = data;
      result = {
        cnpj: cnpjLimpo,
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social,
        municipio: data.municipio || null,
        uf: data.uf || null,
        cnae_principal:
          data.cnae_fiscal && data.cnae_fiscal_descricao
            ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`
            : null,
        status: data.descricao_situacao_cadastral || null,
      };
    }
  } catch (err: any) {
    console.warn(`[CNPJ] BrasilAPI indisponível ou rate-limited (${err.response?.status || err.message}). Tentando MinhaReceita.`);
  }

  // Tentativa 2: Minha Receita
  if (!result) {
    try {
      const response = await axios.get(`https://minhareceita.org/${cnpjLimpo}`, {
        timeout: 6000,
      });
      const data = response.data;
      if (data?.razao_social) {
        rawMetadata = data;
        result = {
          cnpj: cnpjLimpo,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || data.razao_social,
          municipio: data.municipio || null,
          uf: data.uf || null,
          cnae_principal: data.cnae_fiscal
            ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao || ''}`
            : null,
          status: data.descricao_situacao_cadastral || null,
        };
      }
    } catch (err: any) {
      console.warn(`[CNPJ] MinhaReceita indisponível (${err.response?.status || err.message}). Tentando ReceitaWS.`);
    }
  }

  // Tentativa 3: ReceitaWS
  if (!result) {
    try {
      const response = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
        timeout: 6000,
      });
      const data = response.data;
      if (data?.nome && data.status !== 'ERROR') {
        rawMetadata = data;
        result = {
          cnpj: cnpjLimpo,
          razao_social: data.nome,
          nome_fantasia: data.fantasia || data.nome,
          municipio: data.municipio || null,
          uf: data.uf || null,
          cnae_principal: data.atividade_principal?.[0]?.text || null,
          status: data.situacao || null,
        };
      }
    } catch (err: any) {
      console.warn(`[CNPJ] ReceitaWS indisponível (${err.response?.status || err.message}).`);
    }
  }

  if (!result) {
    throw new Error('CNPJ_CONSULTA_FALHOU');
  }

  memoryCnpjCache.set(cnpjLimpo, {
    data: result,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });

  // Persiste de forma assíncrona no cache de empresas públicas
  if (result.razao_social) {
    prisma.publicCompany
      .upsert({
        where: { dedupeKey },
        create: {
          source: 'public_api',
          cnpj: cnpjLimpo,
          dedupeKey,
          legalName: result.razao_social,
          tradeName: result.nome_fantasia,
          status: result.status,
          mainCnae: result.cnae_principal,
          municipality: result.municipio,
          uf: result.uf,
          partners: Array.isArray(rawMetadata?.qsa) ? rawMetadata.qsa : undefined,
          metadata: rawMetadata || {},
          lastSyncedAt: new Date(),
        },
        update: {
          legalName: result.razao_social,
          tradeName: result.nome_fantasia,
          status: result.status,
          mainCnae: result.cnae_principal,
          municipality: result.municipio,
          uf: result.uf,
          partners: Array.isArray(rawMetadata?.qsa) ? rawMetadata.qsa : undefined,
          metadata: rawMetadata || {},
          lastSyncedAt: new Date(),
        },
      })
      .catch((error) => {
        console.error('[CNPJ_CACHE_WRITE_FAILED] Não foi possível atualizar o cache persistente.', error);
      });
  }

  return result;
}
