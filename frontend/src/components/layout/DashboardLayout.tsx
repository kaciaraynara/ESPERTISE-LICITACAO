import { useEffect, useState, Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import Sidebar, { hasActivePaidPlan, isUserTrialActive } from './Sidebar';
import Header from './Header';
import { useCompany } from '../../contexts/CompanyContext';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { GlobalCertificateAlertBanner } from '../common/GlobalCertificateAlertBanner';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { FORNECEDOR_ROUTES } from '../../routes';
import LexFloatingWidget from '../LexFloatingWidget';

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { switchingCompany, selectedCompany, isLoading } = useCompany();
  const user = useAuthStore((state) => state.user);
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const activePlanId = useAuthStore((state) => state.activePlanId);

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
  if (isLoading && !selectedCompany?.id) {
    return <LoadingSpinner fullscreen message="Carregando ambiente da empresa..." />;
  }

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-brand-light text-slate-800">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
          mobileMenuOpen={mobileMenuOpen}
        />

        <GlobalCertificateAlertBanner />

        <main
          id="main-content"
          tabIndex={0}
          style={{ overflowY: 'auto' }}
          aria-busy={switchingCompany}
          className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden bg-brand-light pb-24"
        >
          <ErrorBoundary
            key={location.pathname}
            fallbackTitle="Instabilidade temporária na exibição desta página"
            fallbackMessage="A área solicitada encontrou uma instabilidade pontual. Os dados das demais áreas da plataforma continuam preservados."
          >
            <Suspense
              fallback={
                <div className="flex min-h-[400px] w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
                    <p className="text-xs font-bold text-slate-500">Carregando dados da plataforma...</p>
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
      <LexFloatingWidget />
    </div>
  );
}
