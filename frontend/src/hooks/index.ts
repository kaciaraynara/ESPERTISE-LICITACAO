import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import api from '@services/api';
import toast from 'react-hot-toast';
import { resolveAuthenticatedHome } from '../routes';
import { ApiResponse, Licitacao, LicitacaoFiltros, PaginatedResponse, User } from '@/types';

/** Alinha com o backend: DDD+nacional → +55… */
function normalizeTelefoneBr(raw?: string): string | undefined {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (!digits) return undefined;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`;
  return `+${digits}`;
}

// ─── Auth hooks ───────────────────────────────────────────────────────────────
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: { email: string; senha: string }) =>
      api.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/login',
        credentials,
      ),
    onSuccess: ({ data }) => {
      setAuth(data.data.user, data.data.accessToken);
      toast.success(`Bem-vindo, ${data.data.user.nome ?? data.data.user.email}!`);
      navigate(resolveAuthenticatedHome(data.data.user.role));
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (dto: {
      email: string;
      senha: string;
      nome: string;
      telefone?: string;
      aceite_lgpd: true;
    }) =>
      api.post('/auth/register', {
        ...dto,
        telefone: normalizeTelefoneBr(dto.telefone),
      }),
    onSuccess: ({ data }) => {
      setAuth(data.data.user, data.data.accessToken);
      toast.success('Conta criada com sucesso!');
      navigate(resolveAuthenticatedHome(data.data.user.role));
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      logout();
      navigate('/login');
      toast.success('Sessão encerrada');
    }
  };
}

// ─── Licitações hooks ─────────────────────────────────────────────────────────
export function useLicitacoes(filtros: LicitacaoFiltros) {
  return useQuery({
    queryKey: ['licitacoes', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<Licitacao>>('/licitacoes', { params: filtros })
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

export function useLicitacao(id: string) {
  return useQuery({
    queryKey: ['licitacao', id],
    queryFn: () =>
      api.get<ApiResponse<Licitacao>>(`/licitacoes/${encodeURIComponent(id)}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useAuditarEdital(licitacaoId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (textoEdital?: string) =>
      api.post(`/auditoria/${encodeURIComponent(licitacaoId)}`, { textoEdital }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['licitacao', licitacaoId] });
      qc.invalidateQueries({ queryKey: ['licitacoes'] });
      toast.success('Auditoria concluída!');
    },
  });
}

// ─── Empresas hooks ───────────────────────────────────────────────────────────
export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: () => api.get('/empresas').then((r) => r.data.data),
  });
}

export function useCriarEmpresa() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (dto: unknown) => api.post('/empresas', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      toast.success('Empresa cadastrada!');
    },
  });
}

export function useAtualizarEmpresa() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      api.patch(`/empresas/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
    },
  });
}

// ─── Pagamentos hooks ─────────────────────────────────────────────────────────
export function useCheckout() {
  return useMutation({
    mutationFn: (plano: 'basic' | 'pro' | 'premium' | 'starter' | 'profissional' | 'enterprise') =>
      api
        .post<ApiResponse<{ url: string | null; _mock?: boolean }>>('/pagamentos/checkout-session', {
          plano,
          successUrl: `${window.location.origin}/fornecedor/dashboard?upgrade=success`,
          cancelUrl: `${window.location.origin}/planos`,
        })
        .then((r) => r.data.data),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
  });
}

export function usePortalCliente() {
  return useMutation({
    mutationFn: () =>
      api
        .post<ApiResponse<{ url: string }>>('/pagamentos/portal', {
          returnUrl: `${window.location.origin}/fornecedor/dashboard`,
        })
        .then((r) => r.data.data),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

// ─── Notificações hooks ───────────────────────────────────────────────────────
export function useNotificacoes() {
  return useQuery({
    queryKey: ['notificacoes'],
    queryFn: () => api.get('/notificacoes').then((r) => r.data.data),
    refetchInterval: 60 * 1000, // atualiza a cada 1 min
  });
}
