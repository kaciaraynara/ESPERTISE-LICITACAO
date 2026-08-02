import api from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TransparenciaMeta {
  source: 'memory' | 'database' | 'api';
  cached: boolean;
  cachedAt?: string;
  expiresAt?: string;
  responseTimeMs: number;
  endpoint: string;
}

export interface TransparenciaResponse<T = unknown> {
  success: boolean;
  data: T;
  meta: TransparenciaMeta;
}

export interface TokenHealth {
  token: string;
  maskedToken: string;
  isConfigured: boolean;
  currentWindow: 'diurno' | 'noturno';
  limitPerMinute: number;
  usedThisMinute: number;
  remainingThisMinute: number;
  isBlocked: boolean;
  blockedUntil: string | null;
}

export interface TransparenciaHealthData {
  token: TokenHealth;
  metrics: {
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    cacheHits: number;
    fallbackCalls: number;
    avgResponseMs: number;
    callsPerMinute: number;
    uptimeMinutes: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  };
  cache: {
    keys: number;
    hits: number;
    misses: number;
    hitRate: string;
  };
}

export interface CleanTransparenciaCacheResponse {
  success: boolean;
  message?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const transparenciaApi = {
  // Consultas de dados
  consultarEmpresa: (cnpj: string) =>
    api.get<TransparenciaResponse>(`/transparencia/empresa/${encodeURIComponent(cnpj)}`),

  consultarPenalidades: (params?: { cnpj?: string; pagina?: number }) =>
    api.get<TransparenciaResponse>('/transparencia/penalidades', { params }),

  consultarLicitacoes: (params?: { dataInicial?: string; dataFinal?: string; codigoOrgao?: string; pagina?: number }) =>
    api.get<TransparenciaResponse>('/transparencia/licitacoes', { params }),

  consultarContratos: (params?: { cnpj?: string; dataInicial?: string; dataFinal?: string; pagina?: number }) =>
    api.get<TransparenciaResponse>('/transparencia/contratos', { params }),

  consultarCepim: (cnpj: string) =>
    api.get<TransparenciaResponse>(`/transparencia/cepim/${encodeURIComponent(cnpj)}`),

  consultarCnep: (cnpj: string) =>
    api.get<TransparenciaResponse>(`/transparencia/cnep/${encodeURIComponent(cnpj)}`),

  // Health & Métricas
  health: () =>
    api.get<{ success: boolean; data: TransparenciaHealthData }>('/transparencia/health'),

  metrics: (windowMinutes?: number) =>
    api.get('/transparencia/metrics', { params: { window: windowMinutes } }),

  cleanCache: () =>
    api.post<CleanTransparenciaCacheResponse>('/transparencia/cache/clean'),
};
