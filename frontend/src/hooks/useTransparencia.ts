import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transparenciaApi } from '../services/transparencia.api';
import type {
  CleanTransparenciaCacheResponse,
  TransparenciaHealthData,
  TransparenciaResponse,
} from '../services/transparencia.api';
import toast from 'react-hot-toast';

// ─── Chaves de Cache React Query ─────────────────────────────────────────────

interface TransparenciaLicitacoesParams {
  dataInicial?: string;
  dataFinal?: string;
  codigoOrgao?: string;
  pagina?: number;
}

interface TransparenciaContratosParams {
  cnpj?: string;
  dataInicial?: string;
  dataFinal?: string;
  pagina?: number;
}

const QUERY_KEYS = {
  empresa: (cnpj: string) => ['transparencia', 'empresa', cnpj] as const,
  penalidades: (cnpj?: string) => ['transparencia', 'penalidades', cnpj] as const,
  licitacoes: (params?: TransparenciaLicitacoesParams) => ['transparencia', 'licitacoes', params] as const,
  contratos: (params?: TransparenciaContratosParams) => ['transparencia', 'contratos', params] as const,
  cepim: (cnpj: string) => ['transparencia', 'cepim', cnpj] as const,
  cnep: (cnpj: string) => ['transparencia', 'cnep', cnpj] as const,
  health: ['transparencia', 'health'] as const,
};

// ─── Hooks de Consulta ───────────────────────────────────────────────────────

export function useTransparenciaEmpresa(cnpj: string, enabled = true) {
  return useQuery<TransparenciaResponse>({
    queryKey: QUERY_KEYS.empresa(cnpj),
    queryFn: async () => {
      const { data } = await transparenciaApi.consultarEmpresa(cnpj);
      return data;
    },
    enabled: enabled && !!cnpj && cnpj.replace(/\D/g, '').length === 14,
    staleTime: 6 * 60 * 60 * 1000,  // 6h — alinhado com TTL do backend
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useTransparenciaPenalidades(cnpj?: string, enabled = true) {
  return useQuery<TransparenciaResponse>({
    queryKey: QUERY_KEYS.penalidades(cnpj),
    queryFn: async () => {
      const { data } = await transparenciaApi.consultarPenalidades({ cnpj });
      return data;
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    retry: 2,
  });
}

export function useTransparenciaLicitacoes(
  params?: TransparenciaLicitacoesParams,
  enabled = true
) {
  return useQuery<TransparenciaResponse>({
    queryKey: QUERY_KEYS.licitacoes(params),
    queryFn: async () => {
      const { data } = await transparenciaApi.consultarLicitacoes(params);
      return data;
    },
    enabled,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function useTransparenciaContratos(
  params?: TransparenciaContratosParams,
  enabled = true
) {
  return useQuery<TransparenciaResponse>({
    queryKey: QUERY_KEYS.contratos(params),
    queryFn: async () => {
      const { data } = await transparenciaApi.consultarContratos(params);
      return data;
    },
    enabled,
    staleTime: 12 * 60 * 60 * 1000, // 12h
    retry: 2,
  });
}

export function useTransparenciaCepim(cnpj: string, enabled = true) {
  return useQuery<TransparenciaResponse>({
    queryKey: QUERY_KEYS.cepim(cnpj),
    queryFn: async () => {
      const { data } = await transparenciaApi.consultarCepim(cnpj);
      return data;
    },
    enabled: enabled && !!cnpj,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function useTransparenciaCnep(cnpj: string, enabled = true) {
  return useQuery<TransparenciaResponse>({
    queryKey: QUERY_KEYS.cnep(cnpj),
    queryFn: async () => {
      const { data } = await transparenciaApi.consultarCnep(cnpj);
      return data;
    },
    enabled: enabled && !!cnpj,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

// ─── Health ──────────────────────────────────────────────────────────────────

export function useTransparenciaHealth(enabled = true) {
  return useQuery<TransparenciaHealthData>({
    queryKey: QUERY_KEYS.health,
    queryFn: async () => {
      const { data } = await transparenciaApi.health();
      return data.data;
    },
    enabled,
    staleTime: 30_000,      // 30s
    refetchInterval: 60_000, // Atualiza a cada 1 min
  });
}

// ─── Limpeza de Cache ────────────────────────────────────────────────────────

export function useCleanTransparenciaCache() {
  const queryClient = useQueryClient();

  return useMutation<CleanTransparenciaCacheResponse, Error>({
    mutationFn: async () => {
      const { data } = await transparenciaApi.cleanCache();
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Cache limpo com sucesso');
      queryClient.invalidateQueries({ queryKey: ['transparencia'] });
    },
    onError: () => {
      toast.error('Erro ao limpar cache');
    },
  });
}
