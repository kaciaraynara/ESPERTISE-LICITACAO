import React, { Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { authApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import {
  FORNECEDOR_ROUTES,
  LEGACY_FORNECEDOR_ROUTES,
  resolveAuthenticatedHome,
} from './routes';

// Importações Estáticas (Anti-Quebra e Anti-Lazy Load Undefined)
import DashboardLayout from './components/layout/DashboardLayout';
import LandingPage from './pages/LandingPage';
import AuthPages from './pages/AuthPages';
import DashboardPage from './pages/DashboardPage';
import RadarPage from './pages/Radar';
import LicitacaoDetalhePage from './pages/LicitacaoDetalhePage';
import RoboPage from './pages/RoboPage';
import CofrePage from './pages/CofrePage';
import PlanosPage from './pages/PlanosPage';
import ModuleStatusPage from './pages/ModuleStatusPage';
import { LexFloatingWidget } from './components/LexFloatingWidget';
import ConfiguracoesPage from './pages/Configuracoes/ConfiguracoesPage';
import { CatalogoPage } from './pages/Catalogo/CatalogoPage';
import { PrazosAlertasPage } from './pages/PrazosAlertas/PrazosAlertasPage';
import { InvestigacaoConcorrencialPage } from './pages/InvestigacaoConcorrencial/InvestigacaoConcorrencialPage';
import { RelatoriosPage } from './pages/Relatorios/RelatoriosPage';
import { PropostasPage } from './pages/Propostas/PropostasPage';
import { LexAnalisePage } from './pages/Lex/LexAnalisePage';
// Módulos Ativos Conectados
import { CrmFunilScreen } from './pages/CRM/CrmFunilScreen';
import { PrecificacaoPage } from './pages/Precificacao/PrecificacaoPage';
// Importações no topo do App.tsx
// Removed unused imports: CatalogoPage, EditaisMonitoradosPage
// Importações no topo do App.tsx
import { ScoreOportunidadesPage } from './pages/ScoreOportunidades/ScoreOportunidadesPage';
import { NulidadesPage } from './pages/Nulidades/NulidadesPage';
// Importações no topo do App.tsx
// Removed unused imports: SrpPage, RelatoriosPage
// Importações no topo do App.tsx

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// ----------------------------------------------------
// PROTEÇÃO DE ROTAS SÍNCRONA E DIRETA (SEM LOOPS)
// ----------------------------------------------------
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to={resolveAuthenticatedHome()} replace />;
}

// ----------------------------------------------------
// INTERCEPTOR SILENCIOSO DE SESSÃO EXPIRADA
// ----------------------------------------------------
function AuthBootstrap() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (isAuthenticated) return;
    
    // Evita loops infinitos em páginas públicas que não exigem refresh
    const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
    if (publicPaths.includes(location.pathname)) return;

    let active = true;
    authApi
      .refresh()
      .then(({ data }) => {
        if (!active) return;
        if (!data?.data?.accessToken || !data?.data?.user) {
          logout();
          window.location.href = '/login'; // Hard reset de segurança
          return;
        }
        setAuth(data.data.user, data.data.accessToken);
      })
      .catch(() => {
        if (active) {
          logout();
          window.location.href = '/login'; // Hard reset de segurança
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, location.pathname, logout, setAuth]);

  return null;
}

// ----------------------------------------------------
// PÁGINA 404 COM IDENTIDADE LIGHT PREMIUM
// ----------------------------------------------------
function NotFoundPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-slate-50 px-6"
    >
      <div className="max-w-lg text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#EA580C]">Erro 404</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#0A2540]">
          Esta página não está disponível
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 font-medium">
          O endereço não corresponde a uma funcionalidade ativa do EXPERTISE Licitatória.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#0A2540] px-5 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors shadow-lg"
        >
          <ArrowLeft className="h-4 w-4" weight="bold" />
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

// ----------------------------------------------------
// ARQUITETURA PRINCIPAL DO APP
// ----------------------------------------------------
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-white px-4 py-2 font-bold text-[#0A2540] shadow-xl focus:not-sr-only"
      >
        Pular para o conteúdo principal
      </a>

      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-white font-sans">
          <div className="text-center animate-pulse">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-[#0A2540]">
              SINCRONIZANDO CENTRAL DE COMANDO...
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-2">
              Conectando ao ambiente operacional da Digital Day Software
            </p>
          </div>
        </div>
      }>
        <Routes>
          {/* Rotas Institucionais */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Rotas de Autenticação */}
          <Route path="/login" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><AuthPages /></PublicRoute>} />

          {/* Rotas Seguras ERP */}
          <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
            <Route path={FORNECEDOR_ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={FORNECEDOR_ROUTES.radar} element={<RadarPage />} />
            <Route path={FORNECEDOR_ROUTES.licitacao_detalhe} element={<LicitacaoDetalhePage />} />
            <Route path={FORNECEDOR_ROUTES.documentos} element={<CofrePage />} />
            
            {/* Módulos Operacionais Conectados */}
            <Route path="/crm" element={<CrmFunilScreen />} />
            <Route path={FORNECEDOR_ROUTES.precificacao_estrategica} element={<PrecificacaoPage />} />

            {/* Módulos em Desenvolvimento / Status */}
            <Route path={FORNECEDOR_ROUTES.academia} element={<ModuleStatusPage moduleKey="academia" />} />
            <Route path={FORNECEDOR_ROUTES.score_oportunidades} element={<ModuleStatusPage moduleKey="score_oportunidades" />} />
            <Route path={FORNECEDOR_ROUTES.srp_carona} element={<ModuleStatusPage moduleKey="srp_carona" />} />
            <Route path={FORNECEDOR_ROUTES.editais_monitorados} element={<ModuleStatusPage moduleKey="editais_monitorados" />} />
            <Route path={FORNECEDOR_ROUTES.analise_oportunidade} element={<ScoreOportunidadesPage />} />
            <Route path={FORNECEDOR_ROUTES.radar_nulidades} element={<NulidadesPage />} />
            <Route path={FORNECEDOR_ROUTES.robo_lances} element={<RoboPage />} />
            <Route path={FORNECEDOR_ROUTES.propostas} element={<PropostasPage />} />
            <Route path={FORNECEDOR_ROUTES.catalogo} element={<CatalogoPage />} />
            <Route path={FORNECEDOR_ROUTES.prazos_alertas} element={<PrazosAlertasPage />} />
            <Route path={FORNECEDOR_ROUTES.lex} element={<LexAnalisePage />} />
            <Route path={FORNECEDOR_ROUTES.investigacao_concorrencial} element={<InvestigacaoConcorrencialPage />} />
            <Route path={FORNECEDOR_ROUTES.relatorios_estrategicos} element={<RelatoriosPage />} />
            <Route path={FORNECEDOR_ROUTES.planos} element={<PlanosPage />} />
            <Route path={FORNECEDOR_ROUTES.configuracoes} element={<ConfiguracoesPage />} />

            {/* Alias Seguros */}
            <Route path={LEGACY_FORNECEDOR_ROUTES.cofre} element={<Navigate to={FORNECEDOR_ROUTES.documentos} replace />} />
            <Route path="/dashboard" element={<Navigate to={FORNECEDOR_ROUTES.dashboard} replace />} />
          </Route>

          {/* Fallback 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4500,
          style: {
            background: '#FFFFFF',
            color: '#0A2540',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
            fontSize: '14px',
            fontFamily: 'sans-serif',
            fontWeight: 'bold'
          },
          success: { iconTheme: { primary: '#EA580C', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#B91C1C', secondary: '#FFFFFF' } },
        }}
      />
      {/* Widget do LEX Fixo na Tela */}
      <LexFloatingWidget />
    </QueryClientProvider>
  );
}