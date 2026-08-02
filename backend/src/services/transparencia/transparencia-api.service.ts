import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { tokenManager } from './token-manager.service';
import { cacheService } from './cache.service';
import { metricsService } from './metrics.service';
import { withRetry } from './retry.service';
import { getNumberEnv } from '../../config/env';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TransparenciaResponse<T = unknown> {
  success: boolean;
  data: T;
  meta: {
    source: 'memory' | 'database' | 'api';
    cached: boolean;
    cachedAt?: string;
    expiresAt?: string;
    responseTimeMs: number;
    endpoint: string;
  };
}

export interface ConsultaEmpresaParams {
  cnpj: string;
}

export interface ConsultaPenalidadesParams {
  cnpj?: string;
  pagina?: number;
}

export interface ConsultaLicitacoesParams {
  dataInicial?: string;
  dataFinal?: string;
  codigoOrgao?: string;
  pagina?: number;
}

export interface ConsultaContratosParams {
  cnpj?: string;
  dataInicial?: string;
  dataFinal?: string;
  pagina?: number;
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

function createAxiosInstance(baseUrl: string, headers: Record<string, string>): AxiosInstance {
  const instance = axios.create({
    baseURL: baseUrl,
    timeout: getNumberEnv('PORTAL_TRANSPARENCIA_TIMEOUT', 15000),
    headers,
  });

  // Interceptor de log (sem dados sensíveis)
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      const status = error.response?.status ?? 'NETWORK';
      console.warn(`[TransparenciaAPI] ⚠️ HTTP ${status} — ${error.config?.url}`);
      return Promise.reject(error);
    }
  );

  return instance;
}

// ─── Service Principal ────────────────────────────────────────────────────────

class TransparenciaApiService {

  /**
   * Método central: busca com cache → API com retry → fallback
   */
  private async query<T>(
    userId: string,
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<TransparenciaResponse<T>> {
    const startTime = Date.now();
    const cacheKey = cacheService.buildKey(endpoint, params);

    // ─── 1. Verificar cache ─────────────────────────────────────────────
    const cached = await cacheService.get<T>(cacheKey);
    if (cached) {
      const responseTimeMs = Date.now() - startTime;
      metricsService.record({
        endpoint,
        userId,
        responseTimeMs,
        status: 'cache_hit',
        source: cached.source,
      });

      return {
        success: true,
        data: cached.data,
        meta: {
          source: cached.source,
          cached: true,
          cachedAt: cached.cachedAt?.toISOString(),
          expiresAt: cached.expiresAt?.toISOString(),
          responseTimeMs,
          endpoint,
        },
      };
    }

    // ─── 2. Consultar API com retry ─────────────────────────────────────
    try {
      const result = await tokenManager.schedule<AxiosResponse>(userId, async (baseUrl, headers) => {
        const client = createAxiosInstance(baseUrl, headers);

        const retryResult = await withRetry(
          () => client.get(endpoint, { params }),
          {
            maxRetries: 3,
            baseDelayMs: 1000,
            onRetry: (attempt, error, delay) => {
              console.log(
                `[TransparenciaAPI] ♻️ Retry ${attempt}/3 para ${endpoint}: ${error.message} (delay: ${delay}ms)`
              );
            },
          }
        );

        return retryResult.data;
      });

      const data = result.data as T;
      const responseTimeMs = Date.now() - startTime;

      // Salvar no cache
      await cacheService.set(cacheKey, endpoint, data);

      metricsService.record({
        endpoint,
        userId,
        responseTimeMs,
        status: 'success',
        source: 'api',
      });

      return {
        success: true,
        data,
        meta: {
          source: 'api',
          cached: false,
          responseTimeMs,
          endpoint,
        },
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      // ─── 3. Fallback: último cache válido (mesmo expirado) ────────────
      const fallback = await cacheService.getFallback<T>(cacheKey);
      if (fallback) {
        metricsService.record({
          endpoint,
          userId,
          responseTimeMs,
          status: 'fallback',
          source: 'database',
          errorMessage,
        });

        console.warn(`[TransparenciaAPI] ⚠️ Usando fallback para ${endpoint}: ${errorMessage}`);

        return {
          success: true,
          data: fallback.data,
          meta: {
            source: 'database',
            cached: true,
            cachedAt: fallback.cachedAt?.toISOString(),
            expiresAt: fallback.expiresAt?.toISOString(),
            responseTimeMs,
            endpoint,
          },
        };
      }

      // ─── 4. Sem fallback: erro tratado ────────────────────────────────
      metricsService.record({
        endpoint,
        userId,
        responseTimeMs,
        status: 'error',
        source: 'api',
        errorMessage,
      });

      return {
        success: false,
        data: null as unknown as T,
        meta: {
          source: 'api',
          cached: false,
          responseTimeMs,
          endpoint,
        },
      };
    }
  }

  // ─── Endpoints Específicos ────────────────────────────────────────────────

  /**
   * Consulta dados de uma empresa/fornecedor pelo CNPJ
   */
  public async consultarEmpresa(userId: string, cnpj: string): Promise<TransparenciaResponse> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.query(userId, `/fornecedores/${cnpjLimpo}`, {});
  }

  /**
   * Consulta penalidades/sanções de uma empresa
   */
  public async consultarPenalidades(
    userId: string,
    params: ConsultaPenalidadesParams
  ): Promise<TransparenciaResponse> {
    const queryParams: Record<string, unknown> = {};
    if (params.cnpj) queryParams.cpfCnpj = params.cnpj.replace(/\D/g, '');
    if (params.pagina) queryParams.pagina = params.pagina;
    return this.query(userId, '/ceis', queryParams);
  }

  /**
   * Consulta licitações no Portal da Transparência
   */
  public async consultarLicitacoes(
    userId: string,
    params: ConsultaLicitacoesParams
  ): Promise<TransparenciaResponse> {
    const queryParams: Record<string, unknown> = {};
    if (params.dataInicial) queryParams.dataInicial = params.dataInicial;
    if (params.dataFinal) queryParams.dataFinal = params.dataFinal;
    if (params.codigoOrgao) queryParams.codigoOrgao = params.codigoOrgao;
    if (params.pagina) queryParams.pagina = params.pagina;
    return this.query(userId, '/licitacoes', queryParams);
  }

  /**
   * Consulta contratos de uma empresa
   */
  public async consultarContratos(
    userId: string,
    params: ConsultaContratosParams
  ): Promise<TransparenciaResponse> {
    const queryParams: Record<string, unknown> = {};
    if (params.cnpj) queryParams.cpfCnpj = params.cnpj.replace(/\D/g, '');
    if (params.dataInicial) queryParams.dataInicial = params.dataInicial;
    if (params.dataFinal) queryParams.dataFinal = params.dataFinal;
    if (params.pagina) queryParams.pagina = params.pagina;
    return this.query(userId, '/contratos', queryParams);
  }

  /**
   * Consulta CEPIM (Cadastro de Entidades Privadas sem Fins Lucrativos Impedidas)
   */
  public async consultarCepim(userId: string, cnpj: string): Promise<TransparenciaResponse> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.query(userId, '/cepim', { cnpjSancionado: cnpjLimpo });
  }

  /**
   * Consulta CNEP (Cadastro Nacional de Empresas Punidas)
   */
  public async consultarCnep(userId: string, cnpj: string): Promise<TransparenciaResponse> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.query(userId, '/cnep', { cpfCnpj: cnpjLimpo });
  }

  /**
   * Consulta genérica para qualquer endpoint da API
   */
  public async consultarGenerico(
    userId: string,
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<TransparenciaResponse> {
    return this.query(userId, endpoint, params);
  }

  // ─── Health / Métricas ────────────────────────────────────────────────────

  public getTokenHealth() {
    return tokenManager.getHealth();
  }

  public getMetrics(windowMinutes?: number) {
    return metricsService.getSummary(windowMinutes);
  }

  public getRecentLogs(limit?: number) {
    return metricsService.getRecentLogs(limit);
  }

  public getCacheStats() {
    return cacheService.getMemoryStats();
  }

  public async cleanExpiredCache() {
    return cacheService.cleanExpired();
  }
}

// ─── Export Singleton ─────────────────────────────────────────────────────────

export const transparenciaApi = new TransparenciaApiService();
