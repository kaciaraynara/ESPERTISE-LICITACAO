import { CalendarBlank, List, X } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '@components/brand/BrandLogo';
import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import CompanySelector from './CompanySelector';
import { getPlanDisplayLabel, resolveUserPlanTier } from './Sidebar';

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

const HEADER_TITLES: Record<string, string> = {
  '/fornecedor/dashboard': 'Painel de Comando do Licitante',
  '/fornecedor/radar': 'Radar de Oportunidades',
  '/fornecedor/score-viabilidade': 'Análise de Viabilidade',
  '/fornecedor/historico-concorrentes': 'Histórico de Concorrentes',
  '/fornecedor/investigacao': 'Inteligência Competitiva',
  '/fornecedor/disputas': 'Gestão de Disputas',
  '/fornecedor/propostas': 'Gerador de Propostas',
  '/fornecedor/robo-lances': 'Sala de Disputa & Lances',
  '/fornecedor/disputa-ao-vivo': 'Disputa Ao Vivo',
  '/fornecedor/srp': 'Buscador SRP e Carona',
  '/fornecedor/catalogo': 'Catálogo de Produtos',
  '/fornecedor/precificacao': 'Precificação Estratégica',
  '/fornecedores': 'Rede de Fornecedores',
  '/fornecedor/leitor-editais': 'Leitor Inteligente de Editais',
  '/fornecedor/lex': 'Análise com a Luli',
  '/fornecedor/impugnacao': 'Impugnação de Editais',
  '/fornecedor/recursos': 'Recursos Administrativos',
  '/fornecedor/defesas-recursos': 'Central de Defesas e Recursos',
  '/fornecedor/radar-nulidades': 'Radar de Nulidades',
  '/fornecedor/cofre': 'Cofre de Documentos',
  '/fornecedor/certidoes': 'Certidões Negativas',
  '/fornecedor/habilitacao': 'Matriz de Habilitação',
  '/fornecedor/prazos': 'Prazos Fatais e Alertas',
  '/fornecedor/gestao-pos-vitoria': 'Gestão Pós-Vitória',
  '/fornecedor/contratos': 'Gestão Contratual',
  '/fornecedor/expertise-fiscal': 'Expertise Fiscal',
  '/fornecedor/academia': 'Academia do Licitante',
  '/fornecedor/relatorios': 'Relatórios Estratégicos',
  '/fornecedor/empresa': 'Minha Empresa',
  '/fornecedor/planos': 'Planos e Assinatura',
  '/fornecedor/configuracoes': 'Configurações',
  '/fornecedor/pca': 'Planos de Contratações Anuais (PCA)',
  '/fornecedor/dispensa-eletronica': 'Dispensa Eletrônica',
  '/fornecedor/sicaf-credenciamento': 'SICAF e Certificação',
  '/fornecedor/integracoes': 'Integrações Oficiais',
  '/fornecedor/propostas/criar': 'Nova Proposta Comercial',
  '/fornecedor/expertise-intelligence': 'Inteligência & Malha Fina',
};

export function Header({ onToggleMobileMenu, mobileMenuOpen }: HeaderProps) {
  const { pathname } = useLocation();
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

  const userName = user?.nome?.trim() || 'Usuário';

  const initial = (
    userName.charAt(0) ||
    companyNomeFantasia.trim().charAt(0) ||
    'U'
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
            {HEADER_TITLES[pathname] || 'Visão Geral do Mercado'}
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

        {/* Dados Reais do Contexto: Nome Pessoal do Usuário e Empresa/Plano */}
        <div className="hidden min-w-0 text-right sm:block">
          <p
            className="max-w-56 truncate text-sm font-black text-slate-900"
            title={userName}
          >
            {userName}
          </p>
          <p
            className="max-w-56 truncate text-[11px] font-semibold text-slate-500"
            title={companyNomeFantasia}
          >
            {companyNomeFantasia} • <span className="font-bold text-brand-orange uppercase">{userPlanLevel}</span>
          </p>
        </div>

        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-sm font-black text-white shadow-sm"
          title={`${userName} (${companyNomeFantasia})`}
        >
          {initial}
        </span>
      </div>
    </header>
  );
}

export default Header;

