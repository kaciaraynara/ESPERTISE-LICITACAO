import { SignOut } from '@phosphor-icons/react';
import { useEffect, useState, Suspense } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useLogout } from '../../hooks';
import { useAuthStore } from '../../store/auth.store';
import Sidebar, { hasActivePaidPlan, isUserTrialActive } from './Sidebar';
import Header from './Header';
import { resolveProfileNavigation } from './profile-navigation';
import { useCompany } from '../../contexts/CompanyContext';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { GlobalCertificateAlertBanner } from '../common/GlobalCertificateAlertBanner';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { FORNECEDOR_ROUTES } from '../../routes';

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { switchingCompany, selectedCompany, isLoading, isFetching } = useCompany();
  const logout = useLogout();
  const user = useAuthStore((state) => state.user);
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const activePlanId = useAuthStore((state) => state.activePlanId);
  const groups = resolveProfileNavigation(user?.role, user);

  const isTrialActive = isUserTrialActive(user);
  const hasPaidPlan = hasActivePaidPlan(user, activePlanId);
  const shouldForcePlansScreen =
    planAccessLoaded &&
    !isTrialActive &&
    !hasPaidPlan &&
    location.pathname !== FORNECEDOR_ROUTES.planos &&
    location.pathname !== FORNECEDOR_ROUTES.configuracoes;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (shouldForcePlansScreen) {
    return <Navigate to={FORNECEDOR_ROUTES.planos} replace />;
  }

  // Trava estrutural no DashboardLayout: nunca renderiza o layout ou filhos com dados indefinidos
  if (isLoading || isFetching || !selectedCompany?.id) {
    return <LoadingSpinner fullscreen message="Carregando ambiente da empresa..." />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-light text-slate-800">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
          mobileMenuOpen={mobileMenuOpen}
        />

        {mobileMenuOpen ? (
          <div
            id="mobile-navigation"
            className="absolute inset-x-0 top-20 z-20 border-b border-white/10 bg-brand-dark p-5 text-white shadow-xl md:hidden"
          >
            <nav aria-label="Navegação móvel">
              {groups.map((group) => (
                <section key={group.label} className="mb-5 last:mb-0">
                  <h2 className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {group.label}
                  </h2>
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      const active = item.exact
                        ? location.pathname === item.path
                        : location.pathname.startsWith(item.path);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${active
                            ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${active ? 'text-brand-orange' : 'text-slate-400'}`}
                            weight={active ? 'fill' : 'bold'}
                          />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.06] px-4 py-3 text-sm font-bold text-red-200"
              >
                <SignOut className="h-5 w-5" weight="bold" />
                Encerrar sessão
              </button>
            </nav>
          </div>
        ) : null}

        <GlobalCertificateAlertBanner />

        <main
          id="main-content"
          tabIndex={-1}
          aria-busy={switchingCompany}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-brand-light"
        >
          <ErrorBoundary
            key={location.pathname}
            fallbackTitle="Erro ao carregar módulo da plataforma"
            fallbackMessage="O módulo solicitado encontrou uma instabilidade. Os dados das demais áreas continuam preservados."
          >
            <Suspense
              fallback={
                <div className="flex min-h-[400px] w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
                    <p className="text-xs font-bold text-slate-500">Carregando módulo da plataforma...</p>
                  </div>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
          {switchingCompany ? (
            <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4" role="status" aria-live="polite">
              <span className="rounded-full border border-blue-100 bg-white/95 px-4 py-2 text-xs font-bold text-brand-blue shadow-md">
                Atualizando dados da empresa selecionada...
              </span>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
