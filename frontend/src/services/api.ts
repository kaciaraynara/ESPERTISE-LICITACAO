import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import type {
  DadosFraudePeca,
  FornecedorMarketplace,
  RadarLicitacoesFiltros,
  User,
} from '@/types';

type RefreshRequestBody = { refreshToken?: string | null };

export function resolveBaseUrl(): string {
  let configured = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Ambiente local de desenvolvimento
  if (isLocalHost) {
    if (configured && !configured.endsWith('/api/v1') && !configured.endsWith('/api')) {
      return `${configured}/api/v1`;
    }
    return configured || 'http://localhost:3001/api/v1';
  }

  // Se uma URL remota foi explicitamente configurada (e não aponta para localhost)
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    // Normalização defensiva: se configurado https://espertise-licitacao.onrender.com sem /api/v1,
    // concatena /api/v1 para casar com os endpoints do backend.
    if (!configured.endsWith('/api/v1') && !configured.endsWith('/api')) {
      return `${configured}/api/v1`;
    }
    return configured;
  }

  // Em produção no domínio próprio ou Vercel, usar o proxy reverso /api/v1
  return '/api/v1';
}

export const BASE_URL = resolveBaseUrl();

type RefreshSessionPayload = {
  data: {
    accessToken: string;
    refreshToken?: string;
    user?: User;
  };
};

let refreshRequest: Promise<AxiosResponse<RefreshSessionPayload>> | null = null;
let redirectingToLogin = false;

function requestSessionRefresh() {
  if (!refreshRequest) {
    // Envia o refreshToken salvo no store (localStorage persist) no body.
    // O backend lê req.body?.refreshToken antes do cookie — funciona cross-site sem HTTPS.
    const body: RefreshRequestBody = {
      refreshToken: useAuthStore.getState().refreshToken,
    };
    refreshRequest = axios
      .post<RefreshSessionPayload>(`${BASE_URL}/auth/refresh`, body, { withCredentials: true })
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

// ─── Request interceptor — injetar token e empresa (Multi-Tenant) ────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const authState = useAuthStore.getState();
  const token =
    authState.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Captura o ID da empresa ativa no frontend (com fallback imediato para a empresa do usuário logado)
  let activeCompanyId: string | null = null;
  if (typeof window !== 'undefined') {
    const storedCompany = localStorage.getItem('@Expertise:selectedCompany');
    if (storedCompany) {
      try {
        const company = JSON.parse(storedCompany);
        if (company && (company.id || company.companyId)) {
          activeCompanyId = String(company.id || company.companyId);
        }
      } catch (e) {
        console.error('Erro ao ler empresa selecionada', e);
      }
    }
  }

  if (!activeCompanyId) {
    activeCompanyId =
      authState.user?.company?.id ||
      authState.user?.company_id ||
      null;
  }

  if (activeCompanyId) {
    config.headers['x-company-id'] = activeCompanyId;
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
        // Atualiza tokens no store (persiste no localStorage automaticamente)
        if (data.data.user) {
          useAuthStore.getState().setAuth(data.data.user, data.data.accessToken, data.data.refreshToken ?? undefined);
        } else if (data.data.refreshToken) {
          useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
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

    if (error.response?.status === 403) {
      const data = error.response?.data as any;
      if (
        data?.code === 'FEATURE_NOT_IN_PLAN' ||
        data?.code === 'PLAN_LIMIT_EXCEEDED' ||
        data?.code === 'PLAN_LIMIT_REACHED'
      ) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('expertise:paywall-triggered', { detail: data }));
        }
        const msg = data?.message || 'Recurso exclusivo de planos superiores. Conheça nossos planos para desbloquear.';
        toast.error(msg, { id: 'plan-limit-toast', duration: 4500 });
      }
    }

    // Tratamento de erros de conectividade, CORS e respostas do servidor
    const FRIENDLY_GATEWAY_ERROR_MSG = 'Servidor temporariamente indisponível. Verifique se o backend está ativo ou tente novamente em instantes.';
    const isNetworkOrCors =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      (typeof error.message === 'string' &&
        (error.message.includes('Network Error') ||
          error.message.toLowerCase().includes('cors')));
    const isGatewayError =
      error.response?.status === 502 ||
      error.response?.status === 504 ||
      error.response?.status === 503;
    const isServerError = Boolean(error.response?.status && error.response.status >= 500);
    const backendExplicitMessage =
      error.response?.data && typeof error.response.data === 'object'
        ? (error.response.data as any).message
        : undefined;

    if (isNetworkOrCors) {
      error.message = FRIENDLY_GATEWAY_ERROR_MSG;
      if (!error.response) {
        (error as any).response = {
          data: { message: FRIENDLY_GATEWAY_ERROR_MSG },
          status: 503,
          statusText: 'Service Unavailable',
          headers: {},
          config: original,
        };
      }
    } else if (isGatewayError && !backendExplicitMessage) {
      error.message = FRIENDLY_GATEWAY_ERROR_MSG;
      if (error.response?.data && typeof error.response.data === 'object') {
        (error.response.data as any).message = FRIENDLY_GATEWAY_ERROR_MSG;
      }
    } else if (isServerError && !backendExplicitMessage) {
      error.message = FRIENDLY_GATEWAY_ERROR_MSG;
      if (error.response?.data && typeof error.response.data === 'object') {
        (error.response.data as any).message = FRIENDLY_GATEWAY_ERROR_MSG;
      }
    }

    return Promise.reject(error);
  },
);
//─── AUTH ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: {
    email: string;
    senha: string;
    nome: string;
    telefone?: string;
    aceite_lgpd: boolean;
    cnpj?: string;
    razao_social?: string;
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
  exportData: () => api.get('/auth/export-data'),
  deleteAccount: () => api.delete('/auth/account'),
  refresh: requestSessionRefresh,
  logout: () => api.post('/auth/logout', {}),
};

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard/metrics'),
};

export const certidoesApi = {
  listar: (params?: { empresa_id?: string }) => api.get('/certidoes', { params }),
  forceSync: () => api.post('/certidoes/force-sync', {}),
  download: (id: string, empresaId?: string) =>
    api.get(`/certidoes/${encodeURIComponent(id)}/download`, {
      params: { empresa_id: empresaId },
      responseType: 'blob',
    }),
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

export const empresasApi = {
  listar: () => api.get('/empresas'),
  buscarPorId: (id: string) => api.get(`/empresas/${encodeURIComponent(id)}`),
  atualizar: (id: string, body: Record<string, unknown>) => api.patch(`/empresas/${encodeURIComponent(id)}`, body),
  criar: (body: Record<string, unknown>) => api.post('/empresas', body),
};

export const catalogoApi = {
  listar: () => api.get('/catalogo'),
  listarMercado: () => api.get('/catalogo/mercado'),
  criar: (body: Record<string, unknown>) => api.post('/catalogo', body),
  atualizar: (id: string, body: Record<string, unknown>) => api.patch(`/catalogo/${encodeURIComponent(id)}`, body),
  remover: (id: string) => api.delete(`/catalogo/${encodeURIComponent(id)}`),
};

export const prazosApi = {
  listar: () => api.get('/prazos'),
  concluir: (id: string) => api.patch(`/prazos/${encodeURIComponent(id)}/concluir`),
  criar: (body: {
    title: string;
    type: string;
    dueAt?: string;
    date?: string;
    status?: string;
    description?: string;
    companyId?: string;
    procurementNoticeId?: string;
  }) => api.post('/prazos', body),
};

// ─── Licitações ───────────────────────────────────────────────────────────────
export const licitacoesApi = {
  listar: (params?: RadarLicitacoesFiltros) => api.get('/licitacoes', { params }),
  sincronizar: (body?: Record<string, unknown>) => api.post('/licitacoes/sincronizar', body || {}),
  buscarPorId: (id: string) => api.get(`/licitacoes/${encodeURIComponent(id)}`),
  obterItens: (id: string) => api.get(`/licitacoes/${encodeURIComponent(id)}/itens`),
  monitorar: (id: string) => api.post('/licitacoes/monitor', { id }),
  salvar: (body: {
    id?: string;
    noticeId?: string;
    numeroControlePNCP: string;
    orgao: string;
    cnpjOrgao?: string | null;
    objeto: string;
    valorEstimado?: number | null;
    dataLimite?: string | null;
    urlOficialPncp: string;
    modalidade?: string;
    uf?: string;
    municipio?: string;
    itens?: any[];
  }) => api.post('/licitacoes/salvar', body),
  listarSalvos: () => api.get('/licitacoes/salvos'),
};


// ─── Integrações (fontes de dados oficiais + health) ─────────────────────────
export const integracoesApi = {
  catalogo: () => api.get('/integracoes/catalogo'),
  health: () => api.get('/integracoes/health'),
  cnpj: (cnpj: string) => api.get(`/integracoes/cnpj/${encodeURIComponent(cnpj)}`),
  cnpjPublico: (cnpj: string) => api.get(`/public/cnpj/${encodeURIComponent(cnpj)}`),
  sincronizarPncp: () => api.post('/integracoes/sincronizar/pncp'),
};

// ─── Auditoria ───────────────────────────────────────────────────────────────
export const auditoriaApi = {
  auditar: (licitacaoId: string, textoEdital?: string) =>
    api.post(`/auditoria/${encodeURIComponent(licitacaoId)}`, { textoEdital }),
  buscar: (licitacaoId: string) => api.get(`/licitacoes/${encodeURIComponent(licitacaoId)}`),
};

export const aiApi = {
  consultar: (body: { pergunta: string; contexto?: string }) => api.post('/ai/consultar', body),
};

export interface ExportarParecerPayload {
  editalSelecionado: string;
  editalDetalhes: {
    orgao: string;
    objeto: string;
    modalidade?: string;
  };
  clausulas: Array<{
    item: string;
    categoria: string;
    textoClausula: string;
    analiseLex: string;
    sugestaoImpugnacao?: string;
    nivelRisco: string;
  }>;
  resumo?: {
    totalClausulas?: number;
    pontosCriticos?: number;
    ambiguidades?: number;
    indiceConformidade?: string;
  };
  companyId?: string;
}

export const lexApi = {
  resumo: (body: { edital_id?: string; texto_edital?: string }) => api.post('/lex/resumo', body),
  auditar: (body: { edital_id?: string; texto_edital?: string }) => api.post('/lex/auditar', body),
  proposta: (body: { edital_id?: string; texto_edital?: string; nome_empresa?: string }) => api.post('/lex/proposta', body),
  analise: (body: { noticeId?: string; licitacaoId?: string; edital_id?: string }) => api.post('/lex/analise', body),
  impugnacao: (body: { edital_id?: string; texto_edital?: string; contexto?: string }) => api.post('/lex/impugnacao', body),
  chat: (body: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; contextoEdital?: string }) => api.post('/lex/chat', body),
  consultar: (body: { pergunta: string; contexto?: string }) => api.post('/ai/consultar', body),
  exportarParecerPdf: (body: ExportarParecerPayload) =>
    api.post('/lex/parecer-pdf', body, {
      responseType: 'blob',
    }),
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

export const noticesApi = {
  search: (params: any) => api.get('/notices/search', { params }),
  getById: (id: string) => api.get(`/notices/${encodeURIComponent(id)}`),
  getBasicSummary: (id: string) => api.get(`/notices/${encodeURIComponent(id)}/basic-summary`),
  getErrorRadar: (id: string) => api.get(`/notices/${id}/error-radar`),
  getMinutaImpugnacao: (id: string) => api.get(`/notices/${id}/minuta-impugnacao`),
  getOpportunityScore: (id: string) => api.get(`/notices/${id}/opportunity-score`),
  getBatchOpportunityScore: (noticeIds: string[]) =>
    api.post('/notices/batch-score', { noticeIds }),
  getDownloadUrl: (id: string) => api.get(`/editais/${encodeURIComponent(id)}/download-url`),
  getItens: (id: string) => api.get(`/editais/${encodeURIComponent(id)}/itens`),
};

export const concorrentesApi = {
  getDossie: (cnpj: string) => api.get(`/concorrentes/${encodeURIComponent(cnpj)}/dossie`),
  malhaFina: (body: { cnpjs: string[]; licitacaoId?: string }) =>
    api.post('/concorrentes/malha-fina', body),
};

// ─── Gestão Contratual Pós-Vitória (Contratos, Vigências e Reajuste) ─────────
export interface ContractAmendmentDto {
  id: string;
  contractId: string;
  numeroAditivo: string;
  tipo: string;
  indiceAplicado?: string | null;
  percentualReajuste?: number | null;
  valorAnterior: number;
  valorAcrescimo: number;
  valorAtualizado: number;
  dataAssinatura: string;
  novaDataFim?: string | null;
  justificativa?: string | null;
  relatorioCalculo?: string | null;
  createdAt: string;
}

export interface ContractValidityPeriodDto {
  id: string;
  contractId: string;
  cicloNumero: number;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  diasAntecedenciaAlerta: number;
  status: string;
  observacoes?: string | null;
}

export interface ContractDto {
  id: string;
  companyId: string;
  cnpjEmpresa: string;
  numeroContrato: string;
  orgao: string;
  cnpjOrgao?: string | null;
  objeto: string;
  valorInicial: number;
  valorAtual: number;
  indiceReajuste?: string | null;
  dataBaseOrcamento?: string | null;
  dataAssinatura: string;
  dataInicioVigencia?: string | null;
  dataFim: string;
  dedicacaoExclusiva: boolean;
  isMaoDeObraExclusiva: boolean;
  predominanciaMaoDeObra: boolean;
  isFornecimentoGeral: boolean;
  status: 'ATIVO' | 'ENCERRADO' | 'SUSPENSO' | 'RESCINDIDO' | string;
  observacoes?: string | null;
  diasParaVencimento: number;
  nivelAlertaVencimento: 'VENCIDO' | 'CRITICO' | 'ATENCAO' | 'NORMAL';
  elegivelReajusteAnual: boolean;
  aditivos: ContractAmendmentDto[];
  prazosVigencia: ContractValidityPeriodDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractGuaranteeDto {
  id: string;
  contractId: string | null;
  tipoGarantia: 'PROPOSTA' | 'CONTRATO';
  modalidade: 'CAUCAO' | 'SEGURO' | 'FIANCA';
  valorOriginal: number;
  status: 'RETIDA' | 'PRONTA_RESGATE' | 'RESGATADA';
  dataVencimento: string | null;
  statusAlerta: string | null;
  comprovanteUrl: string | null;
  contrato: {
    id: string;
    numeroContrato: string;
    orgao: string;
    status?: string;
  } | null;
}

export interface ContractGuaranteesResponse {
  success: boolean;
  data: {
    totalRetido: number;
    garantias: ContractGuaranteeDto[];
  };
}

export interface ContratosListResponse {
  success: boolean;
  data: {
    company: {
      id: string;
      cnpj: string;
      razaoSocial: string;
    };
    kpis: {
      totalContratos: number;
      contratosAtivos: number;
      contratosCriticos: number;
      contratosElegiveisReajuste: number;
      valorTotalAtivo: number;
    };
    contratos: ContractDto[];
    alertasVencimento: Array<{
      id: string;
      numeroContrato: string;
      orgao: string;
      objeto: string;
      valorAtual: number;
      dataAssinatura: string;
      dataFim: string;
      diasParaVencimento: number;
      nivelAlertaVencimento: 'VENCIDO' | 'CRITICO' | 'ATENCAO' | 'NORMAL';
      elegivelReajusteAnual: boolean;
      indiceReajuste: string;
      status: string;
      prazosVigencia: ContractValidityPeriodDto[];
    }>;
  };
}

export interface RelatorioReajusteResponse {
  success: boolean;
  message: string;
  data: {
    contractId: string;
    numeroContrato: string;
    orgao: string;
    tipoPleito: 'REAJUSTE' | 'REPACTUACAO' | 'REEQUILIBRIO';
    indiceUtilizado: string;
    percentualAplicado: number;
    valorAnterior: number;
    acrescimoGlobal: number;
    novoValorContrato: number;
    impactoMensalEstimado: number;
    mesesRetroativos: number;
    valorRetroativoEstimado: number;
    impactoFinanceiroTotal: number;
    fundamentoLegal: string;
    aditivoCriado?: ContractAmendmentDto | null;
    relatorioTexto: string;
    geradoEm: string;
  };
}

export const contratosApi = {
  listar: () => api.get<ContratosListResponse>('/contratos'),
  listarGarantias: () => api.get<ContractGuaranteesResponse>('/contratos/garantias'),
  gerarOficioRestituicaoGarantia: (id: string) =>
    api.get<Blob>(`/contratos/garantias/${encodeURIComponent(id)}/restituicao`, {
      responseType: 'blob',
    }),
  gerarOficioRepactuacao: (
    id: string,
    body: {
      salarioAtual: number;
      novoSalario: number;
      quantidadePostos: number;
    },
  ) =>
    api.post<Blob>(
      `/contratos/${encodeURIComponent(id)}/repactuacao/oficio`,
      body,
      { responseType: 'blob' },
    ),
  criar: (body: {
    numeroContrato: string;
    orgao: string;
    cnpjOrgao?: string;
    objeto: string;
    valorInicial: number;
    valorAtual?: number;
    indiceReajuste?: string;
    dataBaseOrcamento?: string;
    dataAssinatura: string;
    dataInicioVigencia?: string;
    dataFim: string;
    dedicacaoExclusiva?: boolean;
    predominanciaMaoDeObra?: boolean;
    status?: string;
    observacoes?: string;
  }) => api.post<{ success: boolean; message: string; data: ContractDto }>('/contratos', body),
  atualizar: (id: string, body: Record<string, unknown>) =>
    api.patch<{ success: boolean; message: string; data: ContractDto }>(
      `/contratos/${encodeURIComponent(id)}`,
      body,
    ),
  gerarRelatorioReajuste: (
    id: string,
    body: {
      tipoPleito?: 'REAJUSTE' | 'REPACTUACAO' | 'REEQUILIBRIO';
      indiceAplicado?: string;
      percentualReajuste?: number;
      variacaoMaoDeObraPercentual?: number;
      variacaoInsumosPercentual?: number;
      pesoMaoDeObra?: number;
      mesesRetroativos?: number;
      justificativaAdicional?: string;
      registrarAditivo?: boolean;
    },
  ) => {
    const {
      indiceAplicado,
      percentualReajuste,
      justificativaAdicional,
      ...rest
    } = body;
    return api.post<RelatorioReajusteResponse>(
      `/contratos/${encodeURIComponent(id)}/reajuste`,
      {
        ...rest,
        indiceUtilizado: indiceAplicado,
        percentualIndice: percentualReajuste,
        justificativaFatica: justificativaAdicional,
      },
    );
  },
};

export const crmApi = {
  getOportunidades: () => api.get('/crm/oportunidades'),
  createOportunidade: (body: { noticeId: string; stage?: string; notes?: string }) =>
    api.post('/crm/oportunidades', body),
  moveOportunidade: (id: string, body: { stage?: string; position?: number }) =>
    api.patch(`/crm/oportunidades/${encodeURIComponent(id)}/etapa`, body),
  removeOportunidade: (id: string) => api.delete(`/crm/oportunidades/${encodeURIComponent(id)}`),
  getMetrics: () => api.get('/crm/metricas'),
};

export const roboApi = {
  buscarConfig: (licitacaoId: string) => api.get(`/robo/${encodeURIComponent(licitacaoId)}/config`),
  salvarConfig: (licitacaoId: string, body: Record<string, unknown>) => api.post(`/robo/${encodeURIComponent(licitacaoId)}/config`, body),
  processarLance: (licitacaoId: string, body: { precoAtual: number; tempoRestante?: number; souPrimeiro: boolean }) =>
    api.post(`/robo/${encodeURIComponent(licitacaoId)}/lance`, body),
  listarLogs: (licitacaoId: string) => api.get(`/robo/${encodeURIComponent(licitacaoId)}/logs`),
  toggle: (licitacaoId: string) => api.patch(`/robo/${encodeURIComponent(licitacaoId)}/toggle`),
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
  calcularViabilidade: (body: any) => api.post('/precificacao/viabilidade', body),
};


// ─── Editais Monitorados (watchlist) ─────────────────────────────────────────
export const monitoredNoticesApi = {
  listar: (params?: { pagina?: number; limite?: number }) =>
    api.get('/monitored-notices', { params }),
  remover: (id: string) => api.delete(`/monitored-notices/${encodeURIComponent(id)}`),
  atualizarPrioridade: (id: string, body: { priority?: string; notes?: string }) =>
    api.patch(`/monitored-notices/${encodeURIComponent(id)}/prioridade`, body),
};

// ─── Notificações ──────────────────────────────────────────────────────────────
export const notificacoesApi = {
  listar: (params?: { pagina?: number; limite?: number }) =>
    api.get('/notificacoes', { params }),
  marcarTodasComoLidas: () => api.post('/notificacoes/marcar-todas-lidas'),
  enviarSmsTeste: (telefone?: string) =>
    api.post('/notificacoes/teste-sms', { telefone }),
};

// ─── Pagamentos (Mercado Pago) ───────────────────────────────────────────────
export interface MinhaAssinaturaResponse {
  plano: string;
  nome?: string;
  features: string[];
  status: string;
  ativa: boolean;
  isTrialActive?: boolean;
  trialEndsAt?: string | null;
  diasRestantes?: number;
  gateway: 'mercado_pago' | null;
  periodo_fim?: string;
  pendingPlanId?: string | null;
  pendingPlanAt?: string | null;
}

export const pagamentosApi = {
  planos: () => api.get('/pagamentos/planos'),
  criarCheckout: (body: { plano: string; successUrl?: string; cancelUrl?: string }) =>
    api.post('/pagamentos/checkout', body),
  criarCheckoutAutenticado: (body: { plano: string; successUrl?: string; cancelUrl?: string }) =>
    api.post('/pagamentos/checkout', body),
  reconciliarAssinatura: () => api.post('/pagamentos/assinatura/reconciliar', {}),
  ativarTrial: () => api.post('/pagamentos/trial/ativar', {}),
  minhaAssinatura: () => api.get<{ success: boolean; data: MinhaAssinaturaResponse }>('/pagamentos/assinatura'),
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

export const analiseViabilidadeApi = {
  obterPorEdital: (editalId?: string, params?: Record<string, unknown>) =>
    api.get(editalId ? `/analise-viabilidade/${encodeURIComponent(editalId)}` : '/analise-viabilidade', { params }),
};

// ─── Criar Proposta (Lei 14.133/2021) ────────────────────────────────────────
export interface ProposalItemDto {
  id: string;
  proposalId: string;
  posicao: number;
  numero: string;
  codigo?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  marca?: string | null;
  modelo?: string | null;
  custoUnitario?: number | null;
  custoDireto?: number | null;
  custoIndireto?: number | null;
  tributosPercentual?: number | null;
  encargosPercentual?: number | null;
  bdiPercentual?: number | null;
  margemLucroPercentual?: number | null;
  descontoPercentual?: number | null;
  precoUnitarioProposto: number | null;
  precoTotalProposto: number | null;
  catalogoPrecoReferencia?: number | null;
  inexequivel: boolean;
  prazoGarantiaMeses?: number | null;
  observacoes?: string | null;
}

export interface ProposalDto {
  id: string;
  companyId: string;
  procurementNoticeId?: string | null;
  titulo: string;
  status: string;
  moeda: string;
  criterioJulgamento?: string | null;
  bdiGeral?: number | null;
  encargosSociais?: number | null;
  margemMinimaSustentavel?: number | null;
  valorTotalProposto?: number | null;
  validadeDias: number;
  prazoEntregaDias: number;
  garantia?: string | null;
  condicoesPagamento?: string | null;
  declaracaoIndependente: boolean;
  declaracaoHabilitacao: boolean;
  declaracaoMenor: boolean;
  declaracaoMeEpp: boolean;
  declaracaoInidoneidade: boolean;
  declaracaoAcessibilidade: boolean;
  propostaFormatadaText?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    razaoSocial: string;
    nomeFantasia?: string | null;
    cnpj: string;
    email?: string | null;
    telefone?: string | null;
  };
  procurementNotice?: {
    id: string;
    noticeNumber?: string | null;
    buyerName?: string | null;
    object: string;
    modality?: string | null;
    judgmentCriterion?: string | null;
    modoDisputa?: string | null;
    openingAt?: string | null;
    closingAt?: string | null;
    estimatedValue?: number | null;
    items?: Array<{
      id?: string;
      itemNumber?: string | null;
      description?: string | null;
      quantity?: number | string | null;
      unit?: string | null;
      estimatedUnitValue?: number | string | null;
      estimatedTotalValue?: number | string | null;
    }>;
  } | null;
  items: ProposalItemDto[];
}

export interface ProposalComplianceDto {
  isCompliant: boolean;
  warnings: string[];
  errors: string[];
  declaracoesObrigatorias: {
    elaboracaoIndependente: boolean;
    habilitacaoCompleta: boolean;
    naoEmpregoMenor: boolean;
    inexistenciaImpedimento: boolean;
    reservaCargosPcd: boolean;
    meEpp: boolean;
  };
  validadeDias: number;
  validadeSuficiente: boolean;
  itensInexequiveis: number;
}

export const propostasApi = {
  listar: (params?: { companyId?: string }) =>
    api.get<{ success: boolean; data: ProposalDto[] }>('/propostas', { params }),
  obterPorId: (id: string) =>
    api.get<{ success: boolean; data: ProposalDto }>(`/propostas/${encodeURIComponent(id)}`),
  criarRascunho: (body: {
    companyId: string;
    procurementNoticeId?: string;
    titulo: string;
    validadeDias?: number;
    prazoEntregaDias?: number;
    bdiGeral?: number;
    encargosSociais?: number;
    margemMinimaSustentavel?: number;
    criterioJulgamento?: string;
  }) => api.post<{ success: boolean; data: ProposalDto }>('/propostas', body),
  adicionarItem: (id: string, body: {
    descricao: string;
    unidade: string;
    quantidade: number;
    numero?: string;
    marca?: string;
    modelo?: string;
    custoDireto?: number | null;
    custoIndireto?: number | null;
    tributosPercentual?: number | null;
    encargosPercentual?: number | null;
    bdiPercentual?: number | null;
    margemLucroPercentual?: number | null;
    precoUnitarioProposto?: number | null;
    precoTotalProposto?: number | null;
    prazoGarantiaMeses?: number;
    observacoes?: string;
  }) => api.post<{ success: boolean; data: ProposalItemDto }>(`/propostas/${encodeURIComponent(id)}/itens`, body),
  atualizarProposta: (id: string, body: Record<string, unknown>) =>
    api.patch<{ success: boolean; data: ProposalDto }>(`/propostas/${encodeURIComponent(id)}`, body),
  atualizarItem: (id: string, itemId: string, body: Record<string, unknown>) =>
    api.patch<{ success: boolean; data: ProposalItemDto }>(`/propostas/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}`, body),
  removerItem: (id: string, itemId: string) =>
    api.delete<{ success: boolean; data: { deleted: boolean; id: string } }>(`/propostas/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}`),
  obterCompliance: (id: string) =>
    api.get<{ success: boolean; data: ProposalComplianceDto }>(`/propostas/${encodeURIComponent(id)}/compliance`),
  gerarDocumento: (id: string) =>
    api.post<{ success: boolean; data: { proposalId: string; document: string; compliance: ProposalComplianceDto; valorTotal: number } }>(`/propostas/${encodeURIComponent(id)}/documento`),
  obterDocumento: (id: string) =>
    api.get<{ success: boolean; data: { proposalId: string; document: string; compliance: ProposalComplianceDto; valorTotal: number } }>(`/propostas/${encodeURIComponent(id)}/documento`),
  extrairEditalLex: (body: { noticeId: string; companyId?: string; autoCreate?: boolean }) =>
    api.post<{ success: boolean; data: { proposalId: string; proposal: ProposalDto; items: any[]; extracted: any } }>('/lex/extrair-proposta', body),
  preencherPropostaViaLex: (body: { proposalId?: string; noticeId: string; companyId?: string; autoCreate?: boolean }) =>
    api.post<{ success: boolean; data: { proposalId: string; proposal: ProposalDto; items: any[]; extracted: any } }>('/lex/preencher-proposta', body),
  calcularPrecificacao: (body: {
    custoDireto: number;
    tributosPercentual: number;
    valorReferenciaEdital: number;
    precoOfertado?: number;
  }) =>
    api.post<{
      success: boolean;
      custoBase: number;
      precoMinimo: number;
      precoCompetitivo: number;
      precoTeto: number;
      statusExequibilidade: string;
      data: {
        custoBase: number;
        precoMinimo: number;
        precoCompetitivo: number;
        precoTeto: number;
        statusExequibilidade: string;
      };
    }>('/propostas/calcular-precificacao', body),
  exportarDocx: (id: string, body?: Record<string, unknown>) =>
    api.post<Blob>(`/propostas/${encodeURIComponent(id)}/exportar-docx`, body || {}, {
      responseType: 'blob',
    }),
  exportarPdf: (id: string, body?: Record<string, unknown>) =>
    api.post<Blob>(`/propostas/${encodeURIComponent(id)}/exportar-pdf`, body || {}, {
      responseType: 'blob',
    }),
};

// =============================================================================
// EXPERTISE FISCAL API (MOTOR TRIBUTÁRIO & AUDITORIA DE CRÉDITOS)
// =============================================================================
export const expertiseFiscalApi = {
  importarXml: (formData: FormData) =>
    api.post<{ success: boolean; data: any; message: string }>('/tax/fiscal/import-xml', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importarXmlContent: (body: { filename?: string; fileContent: string }) =>
    api.post<{ success: boolean; data: any; message: string }>('/tax/fiscal/import-xml', body),
  listarCreditos: (params?: { status?: string; originCategory?: string }) =>
    api.get<{ success: boolean; data: any[] }>('/tax/fiscal/credits', { params }),
  listarDocumentos: () =>
    api.get<{ success: boolean; data: any[] }>('/tax/fiscal/documents'),
  validarCredito: (id: string, body: {
    validatedByProfessionalName: string;
    validatedByRegistryCrcOab: string;
    perdcompProtocol?: string;
  }) => api.post<{ success: boolean; data: any; message: string }>(`/tax/fiscal/validate-credit/${encodeURIComponent(id)}`, body),
  simularReforma: (body: {
    grossRevenueAnnual?: number;
    targetCnae?: string;
    operationType?: string;
  }) => api.post<{ success: boolean; data: any }>('/tax/fiscal/simulate-reform', body),
  simularPropostaBdi: (body: {
    noticeId?: string;
    directCost: number;
    operationalExpenses?: number;
    targetMarginPercent?: number;
    creditOpportunityIds?: string[];
  }) => api.post<{ success: boolean; data: any }>('/tax/fiscal/simulate-proposal-bdi', body),
  executarAuditoriaFiscal: (body?: {
    noticeId?: string;
    documentId?: string;
    orgaoDestinatarioNome?: string;
    orgaoDestinatarioCnpj?: string;
  }) => api.post<{ success: boolean; data: any }>('/tax/fiscal/audit', body || {}),
  gerarAnexoIv: (body?: {
    orgaoDestinatarioNome?: string;
    orgaoDestinatarioCnpj?: string;
    cidade?: string;
    uf?: string;
  }) => api.post<{ success: boolean; data: any }>('/tax/fiscal/anexo-iv', body || {}),
  prepararPerdcompCompensacaoCruzada: (body?: {
    creditIds?: string[];
    validationPayload?: {
      creditId: string;
      validatedByProfessionalName: string;
      validatedByRegistryCrcOab: string;
    };
    debitosParaCompensar?: Array<{
      tipoDebito: string;
      competencia: string;
      codigoReceita: string;
      valorOriginalDebito: number;
    }>;
    protocolosParaRegistrar?: Array<{
      creditId: string;
      protocolo: string;
    }>;
  }) => api.post<{ success: boolean; data: any }>('/tax/fiscal/perdcomp-cross-offset', body || {}),
};

export {
  adminTelemetryApi,
  fetchAdminRadarTelemetry,
  type AuditLogTelemetryItem,
  type AdminTelemetryResponse,
} from './admin-telemetry.service';

