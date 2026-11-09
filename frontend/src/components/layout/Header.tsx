import { CalendarBlank, List, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import BrandLogo from '@components/brand/BrandLogo';
import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import CompanySelector from './CompanySelector';
import { getPlanDisplayLabel, resolveUserPlanTier } from './Sidebar';

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export function Header({ onToggleMobileMenu, mobileMenuOpen }: HeaderProps) {
  const { selectedCompany } = useCompany();
  const user = useAuthStore((state) => state.user);

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  // Consumo estrito do contexto real da empresa e usuário ativo
  const companyNomeFantasia =
    selectedCompany?.nomeFantasia ||
    selectedCompany?.nome_fantasia ||
    selectedCompany?.razaoSocial ||
    selectedCompany?.razao_social ||
    'Empresa';

  const rawPlanLevel = String(user?.planLevel || '').trim();
  const normalizedPlanLevel =
    /trial\s*enterprise/i.test(rawPlanLevel)
      ? 'Teste Gratuito'
      : rawPlanLevel;

  const userPlanLevel =
    normalizedPlanLevel ||
    (user?.isTrialActive
      ? 'Teste Gratuito'
      : getPlanDisplayLabel(resolveUserPlanTier(user)));

  const initial = (
    companyNomeFantasia.trim().charAt(0) ||
    user?.nome?.charAt(0) ||
    'E'
  ).toUpperCase();

  return (
    <header className="z-30 flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-sm sm:px-8 lg:px-8">
      {/* Lado Esquerdo: Mobile Menu + Título Principal Superior */}
      <div className="flex min-w-0 items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Fechar navegação' : 'Abrir navegação'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-brand-blue md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" weight="bold" />
            ) : (
              <List className="h-5 w-5" weight="bold" />
            )}
          </button>
        )}

        <Link
          to="/fornecedor/dashboard"
          className="flex items-center gap-2 md:hidden"
          aria-label="EXPERTISE Licitatória, Página Inicial"
        >
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5">
            <BrandLogo imageClassName="h-full w-full object-contain" />
          </div>
          <span className="hidden text-sm font-black tracking-[0.16em] text-brand-blue sm:block">
            EXPERTISE
          </span>
        </Link>

        {/* Título Principal Superior Solicitado: Visão Geral do Mercado */}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <span className="h-7 w-1 rounded-full bg-brand-orange" aria-hidden="true" />
          <h1 className="truncate text-base font-black text-brand-dark tracking-tight">
            Visão Geral do Mercado
          </h1>
        </div>
      </div>

      {/* Lado Direito: Seletor de Empresa + Data + {company.nomeFantasia} & {user.planLevel} */}
      <div className="flex min-w-0 items-center gap-3">
        <div data-tour="company-selector">
          <CompanySelector />
        </div>

        <p className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 md:flex">
          <CalendarBlank className="h-4 w-4" weight="bold" aria-hidden="true" />
          <span className="first-letter:uppercase">{dateLabel}</span>
        </p>

        {/* Dados Reais do Contexto: {company.nomeFantasia} e {user.planLevel} */}
        <div className="hidden min-w-0 text-right sm:block">
          <p
            className="max-w-56 truncate text-sm font-black text-slate-900"
            title={companyNomeFantasia}
          >
            {companyNomeFantasia}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">
            {userPlanLevel}
          </p>
        </div>

        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-sm font-black text-white shadow-sm"
          title={companyNomeFantasia}
        >
          {initial}
        </span>
      </div>
    </header>
  );
}

export default Header;

