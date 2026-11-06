import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { empresasApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';

export interface Company {
  id: string;
  razaoSocial: string;
  razao_social?: string;
  nomeFantasia?: string | null;
  nome_fantasia?: string | null;
  cnpj: string;
  cnaePrincipal?: string | null;
  cnae_principal?: string | null;
  uf?: string | null;
  municipio?: string | null;
}

export interface CompanyContextData {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  switchingCompany: boolean;
  loadingCompanies: boolean;
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
  setSelectedCompany: () => {},
  switchingCompany: false,
  loadingCompanies: false,
  companies: [DEFAULT_COMPANY],
  setCompanies: () => {},
  refreshCompanies: async () => {},
};

const CompanyContext = createContext<CompanyContextData>(DEFAULT_CONTEXT);

export function normalizeCompany(raw: any): Company {
  const razao = raw?.razaoSocial || raw?.razao_social || raw?.nomeFantasia || raw?.nome_fantasia || 'Empresa Principal';
  const cnae = raw?.cnaePrincipal || raw?.cnae_principal || null;
  return {
    id: String(raw?.id || 'default'),
    razaoSocial: razao,
    razao_social: razao,
    nomeFantasia: raw?.nomeFantasia || raw?.nome_fantasia || null,
    nome_fantasia: raw?.nome_fantasia || raw?.nomeFantasia || null,
    cnpj: String(raw?.cnpj || ''),
    cnaePrincipal: cnae,
    cnae_principal: cnae,
    uf: raw?.uf || null,
    municipio: raw?.municipio || null,
  };
}

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const [companies, setCompaniesState] = useState<Company[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('@Expertise:selectedCompany');
      if (stored) {
        try {
          return [normalizeCompany(JSON.parse(stored))];
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
          return normalizeCompany(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
    if (user?.company) {
      return normalizeCompany(user.company);
    }
    return null;
  });

  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) return false;
      const stored = localStorage.getItem('@Expertise:selectedCompany');
      if (stored) return false;
    }
    return true;
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
    void queryClient
      .invalidateQueries({
        queryKey: ['dashboard', 'metrics', normalized.id],
        exact: true,
        refetchType: 'none',
      })
      .catch((error) => {
        console.error('Não foi possível atualizar os dados da empresa selecionada.', error);
      })
      .finally(() => setSwitchingCompany(false));
  }, [queryClient, selectedCompany?.id]);

  const setCompanies = useCallback((list: Company[]) => {
    const normalizedList = Array.isArray(list) ? list.map(normalizeCompany).filter((c) => Boolean(c.id)) : [];
    setCompaniesState(normalizedList);
  }, []);

  const refreshCompanies = useCallback(async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setLoadingCompanies(true);
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
        setSelectedCompanyState(currentMatch);
        if (typeof window !== 'undefined') {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(currentMatch));
        }
      } else if (normalizedList.length > 0) {
        setSelectedCompanyState(normalizedList[0]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(normalizedList[0]));
        }
      } else {
        const currentUser = useAuthStore.getState().user;
        const fallbackComp = currentUser?.company && (currentUser.company.id || currentUser.company.razaoSocial)
          ? normalizeCompany(currentUser.company)
          : DEFAULT_COMPANY;
        setSelectedCompanyState(fallbackComp);
        if (typeof window !== 'undefined') {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(fallbackComp));
        }
      }
    } catch (error) {
      console.warn('[CompanyContext] Não foi possível listar empresas da API, aplicando fallback seguro.', error);
      const currentUser = useAuthStore.getState().user;
      const fallbackComp = currentUser?.company
        ? normalizeCompany(currentUser.company)
        : (selectedCompany || DEFAULT_COMPANY);
      setSelectedCompanyState(fallbackComp);
      setCompaniesState((prev) => (prev.length > 0 ? prev : [fallbackComp]));
    } finally {
      setLoadingCompanies(false);
      setIsLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshCompanies();
    } else {
      setCompaniesState([]);
      setSelectedCompanyState(null);
      setLoadingCompanies(false);
      setIsLoading(false);
    }
  }, [isAuthenticated, refreshCompanies]);

  if (isAuthenticated && isLoading && !selectedCompany) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 font-sans" role="status">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
          <p className="text-sm font-bold text-brand-dark">Carregando ambiente da empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany: selectedCompany || DEFAULT_COMPANY,
        setSelectedCompany: handleSelectCompany,
        switchingCompany,
        loadingCompanies,
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
