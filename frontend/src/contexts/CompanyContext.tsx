import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { empresasApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export interface Company {
  id: string;
  razaoSocial: string;
  razao_social?: string;
  nomeFantasia?: string | null;
  nome_fantasia?: string | null;
  cnpj: string;
  cnaePrincipal?: string | null;
  cnae_principal?: string | null;
  cnaesSecundarios?: string[];
  cnaes_secundarios?: string[];
  nicho?: string[];
  palavrasChave?: string[];
  palavras_chave?: string[];
  regioes?: string[];
  radarTiposObjeto?: string[];
  radar_tipos_objeto?: string[];
  radarIncluirSemClassificacao?: boolean;
  radar_incluir_sem_classificacao?: boolean;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  email?: string | null;
  porte?: string | null;
  status?: string | null;
  qsa?: Array<{
    nome?: string;
    qual?: string;
    pais_origem?: string;
    nome_rep_legal?: string;
    qual_rep_legal?: string;
  }>;
  uf?: string | null;
  municipio?: string | null;
  cidade?: string | null;
  // Perfil Tributário Corporativo
  regimeTributario?: string | null;
  anexoSimples?: string | null;
  faixaFaturamentoRbt12?: number | null;
  aliquotaEfetivaSimples?: number | null;
  ufSede?: string | null;
  municipioSede?: string | null;
  aliquotaIssPadrao?: number | null;
  aliquotaIcmsInterna?: number | null;
  regimeSubstituicaoTributaria?: boolean;
  desoneracaoFolha?: boolean;
  cprb?: number | null;
}

export interface CompanyContextData {
  selectedCompany: Company | null;
  companyId: string | null;
  setSelectedCompany: (company: Company) => void;
  switchingCompany: boolean;
  loadingCompanies: boolean;
  isLoading: boolean;
  isFetching: boolean;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  refreshCompanies: () => Promise<void>;
}

export const DEFAULT_COMPANY: Company = {
  id: 'default',
  razaoSocial: 'Empresa Principal',
  razao_social: 'Empresa Principal',
  nomeFantasia: 'Empresa Principal',
  nome_fantasia: 'Empresa Principal',
  cnpj: '',
  cnaePrincipal: null,
  cnae_principal: null,
  uf: null,
  municipio: null,
};

const DEFAULT_CONTEXT: CompanyContextData = {
  selectedCompany: DEFAULT_COMPANY,
  companyId: DEFAULT_COMPANY.id,
  setSelectedCompany: () => { },
  switchingCompany: false,
  loadingCompanies: false,
  isLoading: false,
  isFetching: false,
  companies: [DEFAULT_COMPANY],
  setCompanies: () => { },
  refreshCompanies: async () => { },
};

const CompanyContext = createContext<CompanyContextData>(DEFAULT_CONTEXT);

export function normalizeCompany(raw: any): Company {
  const razao = raw?.razaoSocial || raw?.razao_social || raw?.nomeFantasia || raw?.nome_fantasia || 'Empresa Principal';
  const cnae = raw?.cnaePrincipal || raw?.cnae_principal || null;
  const cnaesSec = Array.isArray(raw?.cnaesSecundarios)
    ? raw.cnaesSecundarios
    : Array.isArray(raw?.cnaes_secundarios)
      ? raw.cnaes_secundarios
      : Array.isArray(raw?.nicho)
        ? raw.nicho
        : [];
  const palavras = Array.isArray(raw?.palavrasChave)
    ? raw.palavrasChave
    : Array.isArray(raw?.palavras_chave)
      ? raw.palavras_chave
      : [];
  const municipio = raw?.municipio || raw?.cidade || null;
  const enderecoDerivado = [raw?.logradouro, raw?.bairro, municipio, raw?.uf, raw?.cep]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(', ');
  const endereco = raw?.endereco || enderecoDerivado || null;

  return {
    id: String(raw?.id || 'default'),
    razaoSocial: razao,
    razao_social: razao,
    nomeFantasia: raw?.nomeFantasia || raw?.nome_fantasia || null,
    nome_fantasia: raw?.nome_fantasia || raw?.nomeFantasia || null,
    cnpj: String(raw?.cnpj || ''),
    cnaePrincipal: cnae,
    cnae_principal: cnae,
    cnaesSecundarios: cnaesSec,
    cnaes_secundarios: cnaesSec,
    nicho: cnaesSec,
    palavrasChave: palavras,
    palavras_chave: palavras,
    regioes: Array.isArray(raw?.regioes) ? raw.regioes : [],
    radarTiposObjeto: Array.isArray(raw?.radarTiposObjeto)
      ? raw.radarTiposObjeto
      : Array.isArray(raw?.radar_tipos_objeto)
        ? raw.radar_tipos_objeto
        : [],
    radar_tipos_objeto: Array.isArray(raw?.radar_tipos_objeto)
      ? raw.radar_tipos_objeto
      : Array.isArray(raw?.radarTiposObjeto)
        ? raw.radarTiposObjeto
        : [],
    radarIncluirSemClassificacao:
      raw?.radarIncluirSemClassificacao ?? raw?.radar_incluir_sem_classificacao ?? true,
    radar_incluir_sem_classificacao:
      raw?.radar_incluir_sem_classificacao ?? raw?.radarIncluirSemClassificacao ?? true,
    cep: raw?.cep || null,
    logradouro: raw?.logradouro || null,
    bairro: raw?.bairro || null,
    endereco,
    telefone: raw?.telefone || null,
    email: raw?.email || null,
    porte: raw?.porte || null,
    status: raw?.status || null,
    qsa: Array.isArray(raw?.qsa) ? raw.qsa : undefined,
    uf: raw?.uf || raw?.ufSede || null,
    municipio,
    cidade: municipio,
    regimeTributario: raw?.regimeTributario || raw?.regime_tributario || 'SIMPLES_NACIONAL',
    anexoSimples: raw?.anexoSimples || raw?.anexo_simples || null,
    faixaFaturamentoRbt12: raw?.faixaFaturamentoRbt12 !== undefined ? Number(raw.faixaFaturamentoRbt12) : null,
    aliquotaEfetivaSimples: raw?.aliquotaEfetivaSimples !== undefined ? Number(raw.aliquotaEfetivaSimples) : null,
    ufSede: raw?.ufSede || raw?.uf_sede || raw?.uf || null,
    municipioSede: raw?.municipioSede || raw?.municipio_sede || municipio,
    aliquotaIssPadrao: raw?.aliquotaIssPadrao !== undefined ? Number(raw.aliquotaIssPadrao) : null,
    aliquotaIcmsInterna: raw?.aliquotaIcmsInterna !== undefined ? Number(raw.aliquotaIcmsInterna) : null,
    regimeSubstituicaoTributaria: Boolean(raw?.regimeSubstituicaoTributaria ?? raw?.regime_substituicao_tributaria ?? false),
    desoneracaoFolha: Boolean(raw?.desoneracaoFolha ?? raw?.desoneracao_folha ?? false),
    cprb: raw?.cprb !== undefined ? Number(raw.cprb) : null,
  };
}

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/esqueci-senha',
  '/reset-password',
  '/redefinir-senha',
  '/auth/redefinir-senha',
  '/termos',
  '/privacidade',
];

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const [companies, setCompaniesState] = useState<Company[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('@Expertise:selectedCompany');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id && parsed.id !== 'default') {
            return [normalizeCompany(parsed)];
          }
        } catch {
          // ignore
        }
      }
    }
    return [];
  });

  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('@Expertise:selectedCompany');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id && parsed.id !== 'default') {
            return normalizeCompany(parsed);
          }
        } catch {
          // ignore
        }
      }
    }
    if (user?.company && user.company.id && user.company.id !== 'default') {
      return normalizeCompany(user.company);
    }
    return null;
  });

  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const token = useAuthStore.getState().accessToken || window.sessionStorage.getItem('token') || window.localStorage.getItem('token');
      if (!token) return false;
      const stored = localStorage.getItem('@Expertise:selectedCompany');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.id && parsed.id !== 'default') {
            return false;
          }
        } catch {
          // ignore
        }
      }
      return true;
    }
    return false;
  });

  const handleSelectCompany = useCallback((company: Company) => {
    const normalized = normalizeCompany(company);
    if (!normalized.id || normalized.id === selectedCompany?.id) return;

    setSelectedCompanyState(normalized);
    if (typeof window !== 'undefined') {
      localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(normalized));
      window.dispatchEvent(new Event('companyChanged'));
    }
    setSwitchingCompany(true);

    // Consulta e sincroniza dados cadastrais reais ao selecionar a empresa
    if (normalized.id && normalized.id !== 'default') {
      empresasApi.buscarPorId(normalized.id)
        .then((res) => {
          const fresh = res.data?.data || res.data;
          if (fresh) {
            const fullNormalized = normalizeCompany(fresh);
            setSelectedCompanyState(fullNormalized);
            if (typeof window !== 'undefined') {
              localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(fullNormalized));
            }
          }
        })
        .catch(() => { })
        .finally(() => {
          setSwitchingCompany(false);
        });
    } else {
      setSwitchingCompany(false);
    }

    void queryClient
      .invalidateQueries({
        queryKey: ['dashboard', 'metrics', normalized.id],
        exact: true,
        refetchType: 'none',
      })
      .catch((error) => {
        console.error('Não foi possível atualizar os dados da empresa selecionada.', error);
      });
  }, [queryClient, selectedCompany?.id]);

  const setCompanies = useCallback((list: Company[]) => {
    const normalizedList = Array.isArray(list) ? list.map(normalizeCompany).filter((c) => Boolean(c.id)) : [];
    setCompaniesState(normalizedList);
  }, []);

  const refreshCompanies = useCallback(async () => {
    const hasToken = typeof window !== 'undefined' && Boolean(useAuthStore.getState().accessToken || window.sessionStorage.getItem('token') || window.localStorage.getItem('token'));
    if (!useAuthStore.getState().isAuthenticated && !hasToken) {
      setIsLoading(false);
      setIsFetching(false);
      setLoadingCompanies(false);
      return;
    }
    setLoadingCompanies(true);
    setIsFetching(true);
    try {
      const res = await empresasApi.listar();
      const rawList = Array.isArray(res.data?.data) ? res.data.data : [];
      const normalizedList = rawList.map(normalizeCompany).filter((c: Company) => Boolean(c.id));
      setCompaniesState(normalizedList);

      const storedRaw = typeof window !== 'undefined' ? localStorage.getItem('@Expertise:selectedCompany') : null;
      let stored: Company | null = null;
      if (storedRaw) {
        try {
          stored = normalizeCompany(JSON.parse(storedRaw));
        } catch {
          stored = null;
        }
      }

      if (stored && normalizedList.some((c: Company) => c.id === stored!.id)) {
        const currentMatch = normalizedList.find((c: Company) => c.id === stored!.id)!;
        setSelectedCompanyState((prev) => (prev?.id === currentMatch.id && prev?.cnpj === currentMatch.cnpj ? prev : currentMatch));
        if (typeof window !== 'undefined') {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(currentMatch));
        }
      } else if (normalizedList.length > 0) {
        setSelectedCompanyState((prev) => (prev?.id === normalizedList[0].id && prev?.cnpj === normalizedList[0].cnpj ? prev : normalizedList[0]));
        if (typeof window !== 'undefined') {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(normalizedList[0]));
        }
      } else {
        const currentUser = useAuthStore.getState().user;
        const fallbackComp: Company = currentUser?.company && (currentUser.company.id || currentUser.company.razaoSocial)
          ? normalizeCompany(currentUser.company)
          : {
            ...DEFAULT_COMPANY,
            id: currentUser?.id ? `comp-${currentUser.id}` : 'empresa-principal',
            razaoSocial: currentUser?.nome ? `Empresa de ${currentUser.nome}` : 'Empresa Principal',
          };
        setSelectedCompanyState(fallbackComp);
        if (typeof window !== 'undefined') {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(fallbackComp));
        }
      }
    } catch (error) {
      console.warn('[CompanyContext] Não foi possível listar empresas da API, aplicando fallback seguro.', error);
      const currentUser = useAuthStore.getState().user;
      const storedRaw = typeof window !== 'undefined' ? localStorage.getItem('@Expertise:selectedCompany') : null;
      let stored: Company | null = null;
      if (storedRaw) {
        try {
          stored = normalizeCompany(JSON.parse(storedRaw));
        } catch {
          stored = null;
        }
      }
      const fallbackComp: Company = stored && stored.id && stored.id !== 'default'
        ? stored
        : currentUser?.company && (currentUser.company.id || currentUser.company.razaoSocial)
          ? normalizeCompany(currentUser.company)
          : {
            ...DEFAULT_COMPANY,
            id: currentUser?.id ? `comp-${currentUser.id}` : 'empresa-principal',
            razaoSocial: currentUser?.nome ? `Empresa de ${currentUser.nome}` : 'Empresa Principal',
          };
      setSelectedCompanyState(fallbackComp);
      setCompaniesState((prev) => (prev.length > 0 ? prev : [fallbackComp]));
      if (typeof window !== 'undefined') {
        localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(fallbackComp));
      }
    } finally {
      setIsFetching(false);
      setLoadingCompanies(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshCompanies();
    } else {
      setCompaniesState([]);
      setSelectedCompanyState(null);
      setLoadingCompanies(false);
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [isAuthenticated, refreshCompanies]);

  const hasToken = typeof window !== 'undefined' && Boolean(useAuthStore.getState().accessToken || window.sessionStorage.getItem('token') || window.localStorage.getItem('token'));
  const isUserAuthenticated = isAuthenticated || hasToken;
  const isPublicRoute =
    typeof window !== 'undefined' &&
    PUBLIC_PATHS.some(
      (path) =>
        window.location.pathname === path ||
        window.location.pathname.startsWith('/termos') ||
        window.location.pathname.startsWith('/privacidade'),
    );

  // Trava estrutural obrigatória: em rotas autenticadas, SÓ PODE RENDERIZAR {children}
  // quando a API devolver os dados e os dados essenciais (ex: companyId) estiverem populados na memória.
  if (isUserAuthenticated && !isPublicRoute) {
    if (isLoading || isFetching) {
      return <LoadingSpinner fullscreen message="Carregando ambiente da empresa..." />;
    }

    if (!selectedCompany?.id) {
      return <LoadingSpinner fullscreen message="Carregando ambiente da empresa..." />;
    }
  }

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany: selectedCompany || DEFAULT_COMPANY,
        companyId: selectedCompany?.id || DEFAULT_COMPANY.id,
        setSelectedCompany: handleSelectCompany,
        switchingCompany,
        loadingCompanies,
        isLoading,
        isFetching,
        companies: companies.length > 0 ? companies : (selectedCompany ? [selectedCompany] : [DEFAULT_COMPANY]),
        setCompanies,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = (): CompanyContextData => {
  const context = useContext(CompanyContext);
  if (!context || !context.setSelectedCompany) {
    return DEFAULT_CONTEXT;
  }
  return context;
};
