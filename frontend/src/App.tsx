import React, { Suspense, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { authApi, pagamentosApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import {
  FORNECEDOR_ROUTES,
  LEGACY_FORNECEDOR_ROUTES,
  resolveAuthenticatedHome,
} from './routes';

import DashboardLayout from './components/layout/DashboardLayout';
import LandingPage from './pages/LandingPage';
import AuthPages from './pages/AuthPages';
import { PremiumFeatureGuard } from './components/monetization/PremiumFeatureGuard';
import { CompanyProvider } from './contexts/CompanyContext';

const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const LicitacoesPage = React.lazy(() => import('./pages/LicitacoesPage'));
const LicitacaoDetalhePage = React.lazy(() => import('./pages/LicitacaoDetalhePage'));
const CofrePage = React.lazy(() => import('./pages/CofrePage'));
const PlanosPage = React.lazy(() => import('./pages/PlanosPage'));
const ConfiguracoesPage = React.lazy(() => import('./pages/Configuracoes/ConfiguracoesPage'));
const CatalogoPage = React.lazy(() =>
  import('./pages/Catalogo/CatalogoPage').then((module) => ({ default: module.CatalogoPage })),
);
const PrazosAlertasPage = React.lazy(() =>
  import('./pages/PrazosAlertas/PrazosAlertasPage').then((module) => ({ default: module.PrazosAlertasPage })),
);
const GestaoContratualPage = React.lazy(() =>
  import('./pages/GestaoContratualPage').then((module) => ({ default: module.GestaoContratualPage })),
);
const InvestigacaoConcorrencialPage = React.lazy(() =>
  import('./pages/InvestigacaoConcorrencial/InvestigacaoConcorrencialPage').then((module) => ({
    default: module.InvestigacaoConcorrencialPage,
  })),
);
const RelatoriosPage = React.lazy(() =>
  import('./pages/Relatorios/RelatoriosPage').then((module) => ({ default: module.RelatoriosPage })),
);
const PropostasPage = React.lazy(() => import('./pages/Propostas/PropostasPage'));
const CriarPropostaPage = React.lazy(() => import('./pages/Propostas/CriarPropostaPage'));
const PropostaDetalhePage = React.lazy(() => import('./pages/Propostas/PropostaDetalhePage'));
const LexAnalisePage = React.lazy(() =>
  import('./pages/Lex/LexAnalisePage').then((module) => ({ default: module.LexAnalisePage })),
);
const HistoricoConcorrentesPage = React.lazy(() =>
  import('./pages/HistoricoConcorrentesPage').then((module) => ({ default: module.HistoricoConcorrentesPage })),
);
const AnaliseViabilidadeDetalhePage = React.lazy(() =>
  import('./pages/AnaliseViabilidadeDetalhePage').then((module) => ({
    default: module.AnaliseViabilidadeDetalhePage,
  })),
);
const CrmKanbanPage = React.lazy(() => import('./pages/CrmKanbanPage'));
const CrmFunilScreen = React.lazy(() =>
  import('./pages/CRM/CrmFunilScreen').then((module) => ({ default: module.CrmFunilScreen })),
);
const PrecificacaoPage = React.lazy(() =>
  import('./pages/Precificacao/PrecificacaoPage').then((module) => ({ default: module.PrecificacaoPage })),
);
const EditaisMonitoradosPage = React.lazy(() =>
  import('./pages/EditaisMonitorados/EditaisMonitoradosPage').then((module) => ({
    default: module.EditaisMonitoradosPage,
  })),
);
const ScoreOportunidadesPage = React.lazy(() =>
  import('./pages/ScoreOportunidades/ScoreOportunidadesPage').then((module) => ({
    default: module.ScoreOportunidadesPage,
  })),
);
const NulidadesPage = React.lazy(() =>
  import('./pages/Nulidades/NulidadesPage').then((module) => ({ default: module.NulidadesPage })),
);
const LeitorEditaisPage = React.lazy(() => import('./pages/LeitorEditaisPage'));
const CredenciamentoPage = React.lazy(() => import('./pages/CredenciamentoPage'));
const DispensaEletronicaPage = React.lazy(() => import('./pages/DispensaEletronicaPage'));
const RecursosPage = React.lazy(() => import('./pages/RecursosPage'));
const HabilitacaoPage = React.lazy(() => import('./pages/HabilitacaoPage'));
const CertidoesPage = React.lazy(() => import('./pages/CertidoesPage'));
const ImpugnacaoPage = React.lazy(() => import('./pages/ImpugnacaoPage'));
const RoboPage = React.lazy(() => import('./pages/RoboPage'));
const DisputaAoVivoPage = React.lazy(() => import('./pages/DisputaAoVivoPage'));
const ContenciosoHubPage = React.lazy(() => import('./pages/Contencioso/ContenciosoHubPage'));
const GestaoPosVitoriaPage = React.lazy(() => import('./pages/GestaoPosVitoriaPage'));
const SrpPage = React.lazy(() =>
  import('./pages/Srp/SrpPage').then((module) => ({ default: module.SrpPage })),
);
const AcademiaPage = React.lazy(() =>
  import('./pages/Academia/AcademiaPage').then((module) => ({ default: module.AcademiaPage })),
);
const TermosDeUsoPage = React.lazy(() => import('./pages/TermosDeUsoPage'));
const PoliticaPrivacidadePage = React.lazy(() => import('./pages/PoliticaPrivacidadePage'));
const EmpresaPage = React.lazy(() => import('./pages/EmpresaPage'));
const IntegracoesPage = React.lazy(() => import('./pages/IntegracoesPage'));
const RadarPage = React.lazy(() => import('./pages/RadarPage'));

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
// VERIFICAÇÃO DE SESSÃO — EXECUTA UMA ÚNICA VEZ NA CARGA DO APP
// ----------------------------------------------------
// Não depende de mudanças de rota. Renovações durante o uso ficam a cargo
// do interceptor 401 em services/api.ts (refresh sob demanda, deduplicado).
const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/esqueci-senha', '/reset-password', '/redefinir-senha', '/auth/redefinir-senha', '/termos', '/privacidade'];
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

function isAccessTokenValid(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
    if (typeof payload?.exp !== 'number') return false;
    return payload.exp * 1000 - TOKEN_EXPIRY_SAFETY_MS > Date.now();
  } catch {
    return false;
  }
}

function AuthBootstrap() {
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    // Guarda contra dupla execução (StrictMode / remount).
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    const { isAuthenticated, accessToken, refreshToken, setAuth, logout } = useAuthStore.getState();

    // Token válido em memória → nenhuma chamada de rede.
    if (isAuthenticated && isAccessTokenValid(accessToken)) return;

    // Páginas públicas não exigem sessão.
    if (PUBLIC_PATHS.includes(window.location.pathname)) return;

    // Sem sessão prévia: o PrivateRoute redireciona para /login sem chamar a API.
    if (!isAuthenticated && !refreshToken) return;

    // Executa uma única vez (guardado por hasBootstrapped). Reutiliza a mesma
    // promise de refresh do interceptor 401, evitando chamadas paralelas.
    authApi
      .refresh()
      .then(({ data }) => {
        if (!data?.data?.accessToken || !data?.data?.user) {
          logout();
          return;
        }
        setAuth(data.data.user, data.data.accessToken, data.data.refreshToken ?? refreshToken ?? undefined);
      })
      .catch(() => {
        logout();
      });
  }, []);

  return null;
}

function PlanAccessBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);
  const setPlanAccess = useAuthStore((state) => state.setPlanAccess);
  const clearPlanAccess = useAuthStore((state) => state.clearPlanAccess);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      clearPlanAccess();
      return;
    }

    let active = true;
    let requestInFlight = false;
    let lastSyncAt = 0;

    const syncPlanAccess = async (force = false) => {
      if (requestInFlight || (!force && Date.now() - lastSyncAt < 5_000)) return;
      requestInFlight = true;
      lastSyncAt = Date.now();

      try {
        const response = await pagamentosApi.minhaAssinatura();
        const subscription = response.data?.data;
        if (
          !subscription ||
          typeof subscription.plano !== 'string' ||
          !Array.isArray(subscription.features)
        ) {
          throw new Error('Resposta de assinatura inválida.');
        }
        if (active) {
          setPlanAccess(subscription.plano, subscription.features);
        }
      } catch (error) {
        if (active) {
          clearPlanAccess();
          console.error('[PlanAccess] Não foi possível sincronizar os acessos do plano.', error);
        }
      } finally {
        requestInFlight = false;
      }
    };

    void syncPlanAccess(true);
    const handleFocus = () => void syncPlanAccess(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncPlanAccess(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, userId, setPlanAccess, clearPlanAccess]);

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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-orange">Erro 404</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-dark">
          Esta página não está disponível
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 font-medium">
          O endereço não corresponde a uma funcionalidade ativa do EXPERTISE Licitatória.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-brand-dark px-5 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors shadow-lg"
        >
          <ArrowLeft className="h-4 w-4" weight="bold" />
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

function protectFeature(feature: string, moduleName: string, content: React.ReactNode) {
  return (
    <PremiumFeatureGuard requiredFeature={feature} moduleName={moduleName}>
      {content}
    </PremiumFeatureGuard>
  );
}

// ----------------------------------------------------
// ARQUITETURA PRINCIPAL DO APP
// ----------------------------------------------------
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CompanyProvider>
      <AuthBootstrap />
      <PlanAccessBootstrap />
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-white px-4 py-2 font-bold text-brand-dark shadow-xl focus:not-sr-only"
      >
        Pular para o conteúdo principal
      </a>

      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-white font-sans">
          <div className="text-center animate-pulse">
            <h2 className="text-2xl font-black tracking-tighter text-brand-dark">
              Carregando sua área de trabalho...
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-400">
              Aguarde enquanto abrimos as informações.
            </p>
          </div>
        </div>
      }>
        <Routes>
          {/* Rotas Institucionais */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/termos" element={<TermosDeUsoPage />} />
          <Route path="/privacidade" element={<PoliticaPrivacidadePage />} />
          
          {/* Rotas de Autenticação */}
          <Route path="/login" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/auth/redefinir-senha" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/redefinir-senha" element={<PublicRoute><AuthPages /></PublicRoute>} />
          <Route path="/esqueci-senha" element={<PublicRoute><AuthPages /></PublicRoute>} />

          {/* Rotas Seguras ERP */}
          <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
            <Route path={FORNECEDOR_ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={FORNECEDOR_ROUTES.licitacao_detalhe} element={protectFeature('radar_editais', 'Buscar Oportunidades', <LicitacaoDetalhePage />)} />
            <Route path={FORNECEDOR_ROUTES.licitacoes_detalhe_alias} element={protectFeature('radar_editais', 'Buscar Oportunidades', <LicitacaoDetalhePage />)} />
            
            {/* Módulos Operacionais Conectados */}
            <Route path={FORNECEDOR_ROUTES.disputas} element={protectFeature('crm_kanban', 'Gestão de Disputas', <CrmKanbanPage />)} />
            <Route path="/fornecedor/crm" element={<Navigate to={FORNECEDOR_ROUTES.disputas} replace />} />
            <Route path="/crm" element={<Navigate to={FORNECEDOR_ROUTES.disputas} replace />} />
            <Route path="/disputas" element={<Navigate to={FORNECEDOR_ROUTES.disputas} replace />} />
            <Route path="/crm-legacy" element={protectFeature('crm_kanban', 'Gestão de Disputas', <CrmFunilScreen />)} />
            <Route path={FORNECEDOR_ROUTES.precificacao_estrategica} element={protectFeature('precificacao_estrategica', 'Precificação Estratégica', <PrecificacaoPage />)} />

            {/* As 16 Ferramentas Principais da Plataforma (Arte Oficial) */}
            <Route path={FORNECEDOR_ROUTES.radar} element={protectFeature('radar_editais', 'Buscar Oportunidades', <LicitacoesPage />)} />
            <Route path={FORNECEDOR_ROUTES.radar_nulidades} element={protectFeature('radar_erros_edital', 'Radar de Nulidades', <NulidadesPage />)} />
            <Route path={FORNECEDOR_ROUTES.leitor_editais} element={protectFeature('resumo_edital_completo', 'Leitor Inteligente de Editais', <LeitorEditaisPage />)} />
            <Route path={FORNECEDOR_ROUTES.impugnacao} element={protectFeature('impugnacao_edital', 'Impugnação Inteligente', <ImpugnacaoPage />)} />
            <Route path={FORNECEDOR_ROUTES.score_viabilidade} element={protectFeature('score_oportunidade', 'Termômetro de Oportunidade', <ScoreOportunidadesPage />)} />
            <Route path={FORNECEDOR_ROUTES.robo_lances} element={protectFeature('robo_lances', 'Envio Automático de Lances', <RoboPage />)} />
            <Route path={FORNECEDOR_ROUTES.disputa_ao_vivo} element={protectFeature('robo_lances', 'Disputa ao Vivo', <DisputaAoVivoPage />)} />
            <Route
              path={FORNECEDOR_ROUTES.pregao_eletronico}
              element={protectFeature('radar_editais', 'Pregão Eletrônico', <LicitacoesPage key="pregao-eletronico" modalidadeInicial="Pregão Eletrônico" />)}
            />
            <Route
              path={FORNECEDOR_ROUTES.concorrencia}
              element={protectFeature('radar_editais', 'Concorrência', <LicitacoesPage key="concorrencia" modalidadeInicial="Concorrência" />)}
            />
            <Route
              path={FORNECEDOR_ROUTES.credenciamento}
              element={protectFeature('radar_editais', 'Credenciamento', <LicitacoesPage key="credenciamento" modalidadeInicial="Credenciamento" />)}
            />
            <Route path={FORNECEDOR_ROUTES.sicaf_credenciamento} element={protectFeature('credenciamento', 'SICAF e Certificação', <CredenciamentoPage />)} />
            <Route path={FORNECEDOR_ROUTES.dispensa_eletronica} element={protectFeature('dispensa_eletronica', 'Dispensa Eletrônica', <DispensaEletronicaPage />)} />
            <Route path={FORNECEDOR_ROUTES.recursos} element={protectFeature('recursos_administrativos', 'Recursos Administrativos', <RecursosPage />)} />
            <Route path={FORNECEDOR_ROUTES.defesas_recursos} element={protectFeature('recursos_administrativos', 'Defesas e Recursos', <ContenciosoHubPage />)} />
            <Route path={FORNECEDOR_ROUTES.habilitacao} element={protectFeature('habilitacao', 'Habilitação', <HabilitacaoPage />)} />
            <Route path={FORNECEDOR_ROUTES.cofre} element={protectFeature('cofre_documentos', 'Meus Documentos', <CofrePage />)} />
            <Route path={FORNECEDOR_ROUTES.certidoes} element={protectFeature('certidoes', 'Certidões', <CertidoesPage />)} />
            <Route path={FORNECEDOR_ROUTES.srp} element={protectFeature('srp_carona', 'Sistema de Registro de Preços', <SrpPage />)} />
            <Route path={FORNECEDOR_ROUTES.academia} element={protectFeature('academia_licitante', 'Academia do Licitante', <AcademiaPage />)} />
            <Route
              path={FORNECEDOR_ROUTES.propostas}
              element={protectFeature('fabrica_propostas', 'Gerador de Propostas', <PropostasPage />)}
            />
            <Route
              path={FORNECEDOR_ROUTES.lex}
              element={protectFeature('lex_ia_avancada', 'Análise de Editais', <LexAnalisePage />)}
            />

            {/* Módulos de Gestão, Sub-rotas e Aliases */}
            <Route
              path={FORNECEDOR_ROUTES.proposta_criar}
              element={protectFeature('fabrica_propostas', 'Gerador de Propostas', <CriarPropostaPage />)}
            />
            <Route
              path={FORNECEDOR_ROUTES.proposta_detalhe}
              element={protectFeature('fabrica_propostas', 'Gerador de Propostas', <PropostaDetalhePage />)}
            />
            <Route path={FORNECEDOR_ROUTES.catalogo} element={protectFeature('catalogo_produtos', 'Catálogo de Produtos', <CatalogoPage />)} />
            <Route path={FORNECEDOR_ROUTES.prazos_alertas} element={protectFeature('prazos_alertas', 'Prazos e Alertas', <PrazosAlertasPage />)} />

            {/* Rotas Diretas Operacionais Desobstruídas */}
            <Route path="/oportunidades" element={protectFeature('radar_editais', 'Buscar Oportunidades', <LicitacoesPage />)} />
            <Route path="/propostas" element={protectFeature('fabrica_propostas', 'Gerador de Propostas', <PropostasPage />)} />
            <Route path="/propostas/criar" element={protectFeature('fabrica_propostas', 'Gerador de Propostas', <CriarPropostaPage />)} />
            <Route path="/catalogo" element={protectFeature('catalogo_produtos', 'Catálogo de Produtos', <CatalogoPage />)} />
            <Route path="/prazos" element={protectFeature('prazos_alertas', 'Prazos e Alertas', <PrazosAlertasPage />)} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route
              path={FORNECEDOR_ROUTES.gestao_contratual}
              element={protectFeature('gestao_contratual', 'Gestão Contratual', <GestaoContratualPage />)}
            />
            <Route
              path={FORNECEDOR_ROUTES.gestao_pos_vitoria}
              element={protectFeature('gestao_contratual', 'Garantias e Gestão Pós-Vitória', <GestaoPosVitoriaPage />)}
            />
            <Route path={FORNECEDOR_ROUTES.documentos} element={protectFeature('cofre_documentos', 'Meus Documentos', <CofrePage />)} />
            <Route path={FORNECEDOR_ROUTES.score_oportunidades} element={protectFeature('score_oportunidade', 'Termômetro de Oportunidade', <ScoreOportunidadesPage />)} />
            <Route path={FORNECEDOR_ROUTES.srp_carona} element={protectFeature('srp_carona', 'Sistema de Registro de Preços', <SrpPage />)} />
            <Route path={FORNECEDOR_ROUTES.editais_monitorados} element={protectFeature('radar_editais', 'Editais Monitorados', <EditaisMonitoradosPage />)} />
            <Route path={FORNECEDOR_ROUTES.analise_viabilidade} element={protectFeature('analise_viabilidade', 'Análise de Viabilidade', <AnaliseViabilidadeDetalhePage />)} />
            <Route path={`${FORNECEDOR_ROUTES.analise_viabilidade}/:id`} element={protectFeature('analise_viabilidade', 'Análise de Viabilidade', <AnaliseViabilidadeDetalhePage />)} />
            <Route path={FORNECEDOR_ROUTES.estrategia_disputa} element={protectFeature('robo_lances', 'Estratégia de Disputa', <RoboPage />)} />
            <Route
              path={FORNECEDOR_ROUTES.historico_concorrentes}
              element={protectFeature('historico_concorrentes', 'Histórico de Concorrentes', <HistoricoConcorrentesPage />)}
            />
            <Route
              path={FORNECEDOR_ROUTES.investigacao_concorrencial}
              element={protectFeature('inteligencia_concorrentes', 'Dossiê de Concorrentes', <InvestigacaoConcorrencialPage />)}
            />
            <Route path={FORNECEDOR_ROUTES.relatorios_estrategicos} element={protectFeature('relatorios_estrategicos', 'Relatórios Estratégicos', <RelatoriosPage />)} />
            <Route path={FORNECEDOR_ROUTES.planos} element={<PlanosPage />} />
            <Route path={FORNECEDOR_ROUTES.configuracoes} element={<ConfiguracoesPage />} />
            <Route path={FORNECEDOR_ROUTES.empresa} element={<EmpresaPage />} />
            <Route path={FORNECEDOR_ROUTES.integracoes} element={<IntegracoesPage />} />
            <Route path="/fornecedor/radar-telemetria" element={<RadarPage />} />
            <Route path="/admin/radar" element={<RadarPage />} />

            {/* Aliases Seguros */}
            <Route path={LEGACY_FORNECEDOR_ROUTES.cofre} element={<Navigate to={FORNECEDOR_ROUTES.documentos} replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
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
      </CompanyProvider>
    </QueryClientProvider>
  );
}