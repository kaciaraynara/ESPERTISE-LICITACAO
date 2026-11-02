import React, { createContext, useContext, useState, useEffect } from 'react';
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
  uf?: string | null;
  municipio?: string | null;
}

interface CompanyContextData {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  switchingCompany: boolean;
  loadingCompanies: boolean;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextData>({} as CompanyContextData);

function normalizeCompany(raw: any): Company {
  const razao = raw?.razaoSocial || raw?.razao_social || raw?.nomeFantasia || raw?.nome_fantasia || 'Empresa';
  return {
    id: String(raw?.id || ''),
    razaoSocial: razao,
    razao_social: razao,
    nomeFantasia: raw?.nomeFantasia || raw?.nome_fantasia || null,
    nome_fantasia: raw?.nome_fantasia || raw?.nomeFantasia || null,
    cnpj: String(raw?.cnpj || ''),
    uf: raw?.uf || null,
    municipio: raw?.municipio || null,
  };
}

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [companies, setCompaniesState] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleSelectCompany = (company: Company) => {
    const normalized = normalizeCompany(company);
    if (!normalized.id || normalized.id === selectedCompany?.id) return;

    setSelectedCompanyState(normalized);
    localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(normalized));
    window.dispatchEvent(new Event('companyChanged'));
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
  };

  const setCompanies = (list: Company[]) => {
    const normalizedList = Array.isArray(list) ? list.map(normalizeCompany).filter((c) => Boolean(c.id)) : [];
    setCompaniesState(normalizedList);
  };

  const refreshCompanies = async () => {
    if (!useAuthStore.getState().isAuthenticated) return;
    setLoadingCompanies(true);
    try {
      const res = await empresasApi.listar();
      const rawList = Array.isArray(res.data?.data) ? res.data.data : [];
      const normalizedList = rawList.map(normalizeCompany).filter((c: Company) => Boolean(c.id));
      setCompaniesState(normalizedList);

      const storedRaw = localStorage.getItem('@Expertise:selectedCompany');
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
        localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(currentMatch));
      } else if (normalizedList.length > 0) {
        setSelectedCompanyState(normalizedList[0]);
        localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(normalizedList[0]));
      } else {
        setSelectedCompanyState(null);
        localStorage.removeItem('@Expertise:selectedCompany');
      }
    } catch (error) {
      console.error('Não foi possível atualizar as empresas da conta.', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('@Expertise:selectedCompany');
    if (stored) {
      try {
        setSelectedCompanyState(normalizeCompany(JSON.parse(stored)));
      } catch {
        localStorage.removeItem('@Expertise:selectedCompany');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const stored = localStorage.getItem('@Expertise:selectedCompany');
      if (stored && !selectedCompany) {
        try {
          setSelectedCompanyState(normalizeCompany(JSON.parse(stored)));
        } catch {
          // ignore
        }
      } else if (!selectedCompany) {
        const userCompany = useAuthStore.getState().user?.company;
        if (userCompany?.id) {
          const normalized = normalizeCompany(userCompany);
          setSelectedCompanyState(normalized);
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(normalized));
        }
      }
      void refreshCompanies();
    } else {
      setCompaniesState([]);
      setSelectedCompanyState(null);
      setLoadingCompanies(false);
    }
  }, [isAuthenticated]);

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany: handleSelectCompany,
        switchingCompany,
        loadingCompanies,
        companies,
        setCompanies,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => useContext(CompanyContext);
