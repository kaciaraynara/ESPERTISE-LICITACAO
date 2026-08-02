import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { useAuthStore } from '@store/auth.store';
import type {
  DadosFraudePeca,
  FornecedorMarketplace,
  RadarLicitacoesFiltros,
  User,
} from '@/types';

function resolveBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api/v1';
  }

  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/api/v1`;
  }

  return '/api/v1'; // Fallback para SSR
}

const BASE_URL = resolveBaseUrl();

type RefreshSessionPayload = {
  data: {
    accessToken: string;
    user?: User;
  };
};

let refreshRequest: Promise<AxiosResponse<RefreshSessionPayload>> | null = null;
let redirectingToLogin = false;

function requestSessionRefresh() {
  if (!refreshRequest) {
    refreshRequest = axios
      .post<RefreshSessionPayload>(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

// ─── Instância Axios ──────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — injetar token ─────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — refresh token e erros ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = original.url ?? '';
    const isAuthFlowRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
    ].some((path) => requestUrl.includes(path));

    if (error.response?.status === 401 && !original._retry && !isAuthFlowRequest) {
      original._retry = true;

      try {
        const { data } = await requestSessionRefresh();
        if (!data.data.accessToken) {
          throw new Error('Refresh de sessão sem token de acesso.');
        }
        if (data.data.user) {
          useAuthStore.getState().setAuth(data.data.user, data.data.accessToken);
        } else {
          useAuthStore.getState().setAccessToken(data.data.accessToken);
        }
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        if (
          typeof window !== 'undefined'
          && window.location.pathname !== '/login'
          && !redirectingToLogin
        ) {
          redirectingToLogin = true;
          window.location.assign('/login');
        }
      }
    }

    return Promise.reject(error);
  },
);

// â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const authApi = {
  register: (body: {
    email: string;
    senha: string;
    nome: string;
    telefone?: string;
    aceite_lgpd: boolean;
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    cnae_principal?: string;
    municipio?: string;
    uf?: string;
    status?: string;
    role?: 'fornecedor' | 'advogado' | 'contador';
    oab_numero?: string;
    oab_uf?: string;
    crc_numero?: string;
    crc_uf?: string;
  }) =>
    api.post('/auth/register', body),
  login: (body: { email: string; senha: string }) =>
    api.post('/auth/login', body),
  forgotPassword: (body: { email: string }) =>
    api.post('/auth/forgot-password', body),
  resetPassword: (body: { token: string; senha: string }) =>
    api.post('/auth/reset-password', body),
  me: () => api.get('/auth/me'),
  updateProfile: (body: { nome?: string; telefone?: string; senha?: string }) =>
    api.put('/auth/update-profile', body),
  refresh: requestSessionRefresh,
  logout: () => api.post('/auth/logout', {}),
};

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard/metrics'),
};

export const documentosApi = {
  status: () => api.get<{ success: boolean; data: { available: boolean } }>('/documentos/storage-status'),
  listar: (params?: { empresa_id?: string }) => api.get('/documentos', { params }),
  upload: (formData: FormData) =>
    api.post('/documentos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  remover: (id: string) => api.delete(`/documentos/${id}`),
};

// ─── Licitações ───────────────────────────────────────────────────────────────
export const licitacoesApi = {
  listar: (params?: RadarLicitacoesFiltros) => api.get('/licitacoes', { params }),
  buscarPorId: (id: string) => api.get(`/licitacoes/${encodeURIComponent(id)}`),
  monitorar: (id: string) => api.post('/licitacoes/monitor', { id }),
};


// ─── Integrações (fontes de dados oficiais + health) ─────────────────────────
export const integracoesApi = {
  catalogo: () => api.get('/integracoes/catalogo'),
  health: () => api.get('/integracoes/health'),
  cnpj: (cnpj: string) => api.get(`/integracoes/cnpj/${encodeURIComponent(cnpj)}`),
  cnpjPublico: (cnpj: string) => api.get(`/public/cnpj/${encodeURIComponent(cnpj)}`),
  sincronizarPncp: () => api.post('/integracoes/sincronizar/pncp'),
};

// â”€â”€â”€ Auditoria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const auditoriaApi = {
  auditar: (licitacaoId: string, textoEdital?: string) =>
    api.post(`/auditoria/${encodeURIComponent(licitacaoId)}`, { textoEdital }),
  buscar: (licitacaoId: string) => api.get(`/licitacoes/${encodeURIComponent(licitacaoId)}`),
};

export const aiApi = {
  consultar: (body: { pergunta: string; contexto?: string }) => api.post('/ai/consultar', body),
};

export const lexApi = {
  resumo: (body: { edital_id?: string; texto_edital?: string }) => api.post('/lex/resumo', body),
  auditar: (body: { edital_id?: string; texto_edital?: string }) => api.post('/lex/auditar', body),
  proposta: (body: { edital_id?: string; texto_edital?: string; nome_empresa?: string }) => api.post('/lex/proposta', body),
  impugnacao: (body: { edital_id?: string; texto_edital?: string; contexto?: string }) => api.post('/lex/impugnacao', body),
  chat: (body: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; contextoEdital?: string }) => api.post('/lex/chat', body),
};

export const impugnacaoApi = {
  calcularPrazo: (body: { data_certame: string }) => api.post('/impugnacoes/prazo', body),
  gerarPeca: (body: {
    orgao?: string;
    setor_responsavel?: string;
    modalidade?: string;
    numero_pregao?: string;
    numero_edital?: string;
    processo_administrativo?: string;
    objeto?: string;
    criterio_julgamento?: string;
    plataforma?: string;
    data_certame: string;
    nome_empresa?: string;
    cnpj_empresa?: string;
    representante_legal?: string;
    pontos_impugnacao?: string[] | string;
    dadosFraude?: DadosFraudePeca;
    formato?: 'markdown' | 'html';
  }) => api.post('/impugnacoes/peca', body),
};

export const concorrentesApi = {
  malhaFina: (body: { cnpjs: string[]; licitacaoId?: string }) =>
    api.post('/concorrentes/malha-fina', body),
};

export const roboApi = {
  buscarConfig: (licitacaoId: string) => api.get(`/robo/${encodeURIComponent(licitacaoId)}/config`),
  salvarConfig: (licitacaoId: string, body: Record<string, unknown>) => api.post(`/robo/${encodeURIComponent(licitacaoId)}/config`, body),
  processarLance: (licitacaoId: string, body: { precoAtual: number; tempoRestante?: number; souPrimeiro: boolean }) =>
    api.post(`/robo/${encodeURIComponent(licitacaoId)}/lance`, body),
  listarLogs: (licitacaoId: string) => api.get(`/robo/${encodeURIComponent(licitacaoId)}/logs`),
  toggle: (licitacaoId: string) => api.patch(`/robo/${encodeURIComponent(licitacaoId)}/toggle`),
};

// â”€â”€â”€ Empresas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const empresasApi = {
  listar: () => api.get('/empresas'),
  criar: (body: Record<string, unknown>) => api.post('/empresas', body),
  atualizar: (id: string, body: Record<string, unknown>) => api.patch(`/empresas/${id}`, body),
  buscarPorId: (id: string) => api.get(`/empresas/${id}`),
};

export const marketplaceApi = {
  listar: (params?: Record<string, unknown>) => api.get('/marketplace', { params }),
  listarFornecedores: (params?: { busca?: string; cnae?: string; regiao?: string; uf?: string; limit?: number }) =>
    api.get('/marketplace/fornecedores', { params }),
  criarFornecedor: (body: Omit<FornecedorMarketplace, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>) =>
    api.post('/marketplace/fornecedores', body),
  atualizarFornecedor: (id: string, body: Partial<Omit<FornecedorMarketplace, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>) =>
    api.patch(`/marketplace/fornecedores/${encodeURIComponent(id)}`, body),
  removerFornecedor: (id: string) =>
    api.delete(`/marketplace/fornecedores/${encodeURIComponent(id)}`),
  prompt: () => api.get('/marketplace/prompt'),
  catalogar: (body: {
    raw_input: string;
    fornecedor_nome?: string;
    fornecedor_cnpj?: string;
    fornecedor_contato?: string;
    fornecedor_cidade?: string;
    fornecedor_uf?: string;
    fornecedor_cep?: string;
    fornecedor_localizacao?: string;
    segmento_macro?: string;
  }) => api.post('/marketplace/catalogar', body),
  cotar: (body: {
    descricao_item: string;
    uf_destino?: string;
    cidade_destino?: string;
    raio_km?: number;
  }) => api.post('/marketplace/cotar', body),
};

export const precificacaoApi = {
  calcularViabilidade: (body: {
    preco_lance: number;
    custo_produto: number;
    percentual_impostos: number;
    custo_logistico: number;
    taxas_administrativas: number;
  }) => api.post('/precificacao/viabilidade', body),
};

export const juridicoApi = {
  planos: () => api.get('/juridico/planos'),
  minhaAssinatura: () => api.get('/juridico/assinatura'),
  listarAdvogados: (params?: { busca?: string; uf?: string }) => api.get('/juridico/advogados', { params }),
  meuPerfil: () => api.get('/juridico/meu-perfil'),
  salvarPerfil: (body: {
    nome_exibicao?: string;
    oab_numero: string;
    oab_uf: string;
    especialidades: string[] | string;
    cidade?: string;
    uf?: string;
    bio?: string;
    contato_publico?: string;
    plano_mensal: 'juridico_essencial' | 'juridico_profissional';
  }) => api.post('/juridico/meu-perfil', body),
  listarCasos: () => api.get('/juridico/casos'),
  abrirCaso: (body: {
    lawyer_user_id: string;
    assunto: string;
    edital_id?: string;
    edital_objeto?: string;
    descricao: string;
    telefone_cliente?: string;
  }) => api.post('/juridico/casos', body),
  enviarMensagem: (id: string, conteudo: string) => api.post(`/juridico/casos/${encodeURIComponent(id)}/mensagens`, { conteudo }),
  atualizarStatus: (id: string, status: 'novo' | 'em_andamento' | 'concluido') =>
    api.patch(`/juridico/casos/${encodeURIComponent(id)}/status`, { status }),
  avaliarCaso: (id: string, body: { nota: number; comentario?: string }) =>
    api.post(`/juridico/casos/${encodeURIComponent(id)}/avaliacao`, body),
};

// ─── Notificações ────────────────────────────────────────────────────────────
export const notificacoesApi = {
  listar: (params?: { pagina?: number; limite?: number }) =>
    api.get('/notificacoes', { params }),
  marcarTodasComoLidas: () => api.post('/notificacoes/marcar-todas-lidas'),
};

// â”€â”€â”€ Pagamentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const pagamentosApi = {
  criarCheckout: (body: { plano: string; successUrl?: string; cancelUrl?: string }) =>
    api.post('/pagamentos/checkout-auth', body),
  criarCheckoutAutenticado: (body: { plano: string; successUrl?: string; cancelUrl?: string }) =>
    api.post('/pagamentos/checkout-auth', body),
  criarPortal: (returnUrl: string) => api.post('/pagamentos/portal', { returnUrl }),
  minhaAssinatura: () => api.get('/pagamentos/assinatura'),
};

export default api;


export type SystemModuleStatus =
  | 'AVAILABLE'
  | 'IN_IMPLANTATION'
  | 'INTEGRATION_PENDING'
  | 'HIDDEN'
  | 'DISABLED';

export interface SystemModule {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  route?: string | null;
  icon?: string | null;
  status: SystemModuleStatus;
  statusLabel: string;
  isAvailable: boolean;
  sortOrder: number;
  isVisible: boolean;
}

export interface SystemModulesResponse {
  modules: SystemModule[];
  total: number;
}

export const modulesApi = {
  listar: () => api.get<SystemModulesResponse>('/modules'),
};
