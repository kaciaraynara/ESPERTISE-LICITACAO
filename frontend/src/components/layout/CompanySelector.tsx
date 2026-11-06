import { Buildings, CaretDown } from '@phosphor-icons/react';
import { useCompany } from '../../contexts/CompanyContext';

function formatCnpj(value?: string | null) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 14) return value || 'CNPJ não informado';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default function CompanySelector() {
  const {
    companies,
    selectedCompany,
    setSelectedCompany,
    loadingCompanies,
    switchingCompany,
  } = useCompany();

  const options = companies.length > 0
    ? companies
    : selectedCompany
      ? [selectedCompany]
      : [];

  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <Buildings className="h-5 w-5 shrink-0 text-brand-orange" weight="duotone" aria-hidden="true" />
      <span className="sr-only">Empresa ativa</span>
      <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-500 sm:inline">
        Empresa ativa
      </span>
      <span className="relative min-w-0 flex-1">
        <select
          aria-label="Selecionar empresa ativa"
          value={selectedCompany?.id ?? ''}
          disabled={loadingCompanies || switchingCompany || options.length === 0}
          onChange={(event) => {
            const company = options.find((option) => option.id === event.target.value);
            if (company) setSelectedCompany(company);
          }}
          className="w-full min-w-24 max-w-56 appearance-none truncate bg-transparent py-0.5 pr-6 text-xs font-bold text-brand-blue outline-none disabled:cursor-wait disabled:opacity-60 sm:max-w-72"
        >
          {options.length === 0 ? (
            <option value="">{loadingCompanies ? 'Carregando empresas...' : 'Nenhuma empresa'}</option>
          ) : null}
          {options.map((company) => (
            <option key={company.id} value={company.id}>
              {company.razaoSocial} — {formatCnpj(company.cnpj)}
            </option>
          ))}
        </select>
        <CaretDown
          className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          weight="bold"
          aria-hidden="true"
        />
      </span>
      {switchingCompany ? (
        <span className="sr-only" role="status">Atualizando dados da empresa selecionada</span>
      ) : null}
    </label>
  );
}
