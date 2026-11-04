import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Trophy,
  AlertTriangle,
  Building2,
  ArrowRight,
  Package,
  Crosshair,
  FileCheck2,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '@/store/auth.store';

interface DashboardMetrics {
  isContaNova?: boolean;
  valorTotalEmDisputa: number;
  taxaSucesso: number;
  atencaoImediataCount: number;
  certidoesVencendoCount?: number;
  prazosUrgentesCount?: number;
  catalogItemsCount?: number;
  editaisMonitorados: number;
  analisesNulidade: number;
  propostasCriadas: number;
  prazosEstaSemana: number;
  crmOportunidades?: number;
  crmValorEmDisputa?: number;
  statsRadar?: {
    editaisAtivos: number;
    valorTotalEstimado: number;
    orgaosCompradores: number;
  };
  recomendacoes: Array<{
    id: string;
    orgao: string;
    uf: string;
    objeto: string;
    valor: number | null;
    modalidade?: string;
  }>;
  prazosCriticos: Array<{
    id: string;
    evento: string;
    data: string;
    tipo: string;
    edital?: string;
  }>;
}

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(data: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(data));
  } catch {
    return data;
  }
}

const DASHBOARD_METRICS_QUERY_KEY = ['dashboard', 'metrics'] as const;
const MANUAL_REFRESH_COOLDOWN_MS = 30_000;

/**
 * Converte qualquer falha técnica em mensagem de negócio.
 * Nunca expõe termos técnicos (status HTTP, IP, Axios, payload) ao usuário.
 */
function mensagemDeNegocio(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'Atualizando métricas financeiras... Aguarde alguns instantes.';
  if (status === 401 || status === 403) return 'Sua sessão está sendo validada. Atualize em instantes.';
  return 'Conexão temporariamente indisponível.';
}

function isRateLimited(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 429;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { selectedCompany } = useCompany();
  const lastManualRefreshRef = useRef(0);

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // A chave separa os dados por empresa e o refetch no mount garante dados atuais
  // ao alternar de empresa, mesmo quando já existe um resultado em cache.
  const metricsQuery = useQuery({
    queryKey: [...DASHBOARD_METRICS_QUERY_KEY, selectedCompany?.id ?? 'default'],
    queryFn: async (): Promise<DashboardMetrics> => {
      const { data } = await dashboardApi.getMetrics();
      if (!data?.success || !data?.data) {
        throw new Error('DASHBOARD_METRICS_INVALID_RESPONSE');
      }
      return data.data as DashboardMetrics;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const metrics = metricsQuery.data ?? null;
  const loading = metricsQuery.isFetching;
  const error = metricsQuery.isError ? mensagemDeNegocio(metricsQuery.error) : null;

  // Atualização manual com trava anti-rajada (evita novos 429).
  const carregarMetricas = useCallback(() => {
    const now = Date.now();
    const cooldown = isRateLimited(metricsQuery.error)
      ? MANUAL_REFRESH_COOLDOWN_MS * 2
      : MANUAL_REFRESH_COOLDOWN_MS;
    if (metricsQuery.isFetching || now - lastManualRefreshRef.current < cooldown) return;
    lastManualRefreshRef.current = now;
    void metricsQuery.refetch();
  }, [metricsQuery]);

  const isContaNova =
    Boolean(metrics?.isContaNova) ||
    (!loading &&
      metrics &&
      metrics.valorTotalEmDisputa === 0 &&
      metrics.propostasCriadas === 0 &&
      (metrics.catalogItemsCount ?? 0) === 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-slate-50 min-h-screen">
      {/* Header Executivo — Sala de Comando */}
      <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-900 border border-orange-200">
              Sala de Comando
            </span>
            <span className="text-xs text-slate-400 capitalize">{dateLabel}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A2540]">
            Painel Executivo de Licitações
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            Inteligência estratégica, margem de lucro e governança sob a Lei 14.133/2021.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={FORNECEDOR_ROUTES.radar}
            className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Crosshair className="w-4 h-4 shrink-0" />
            <span>Mercado Governamental</span>
          </Link>

          <button
            onClick={carregarMetricas}
            disabled={loading}
            title="Atualizar indicadores"
            className="h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </header>

      {/* Alerta de Falha */}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-800">{error}</p>
            <button
              onClick={carregarMetricas}
              className="mt-1 text-xs font-bold text-rose-600 underline hover:text-rose-800"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Card de Boas-Vindas com o Assistente LEX & Free Trial Master */}
      {user?.isTrialActive && (
        <section className="mb-8 rounded-2xl border border-blue-900/30 bg-gradient-to-br from-[#0A2540] via-slate-900 to-[#0A2540] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-400 border border-orange-500/30">
                <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                <span>Free Trial Oficial · 15 Dias de Plano Master</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Bem-vindo à EXPERTISE, {user.nome?.split(' ')[0] || 'Licitante'}! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                Seu acesso completo está liberado. Eu sou o <strong>LEX</strong>, seu copiloto jurídico com IA especializado na Lei 14.133/2021. Estou pronto para analisar seus editais, apontar exigências restritivas e orientar sua estratégia de vitória.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={FORNECEDOR_ROUTES.lex}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analisar Edital com o LEX</span>
                </Link>
                <Link
                  to={FORNECEDOR_ROUTES.radar}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider border border-white/20 transition"
                >
                  <Crosshair className="w-4 h-4 text-orange-400" />
                  <span>Buscar Oportunidades no Radar</span>
                </Link>
                <Link
                  to={FORNECEDOR_ROUTES.cofre}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs transition"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>Cofre de Documentos</span>
                </Link>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl bg-white/5 border border-white/10 p-5 text-center min-w-[220px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Tempo Restante de Teste
              </span>
              <div className="text-4xl font-black text-brand-orange tracking-tight my-1">
                {user.daysLeftTrial ?? 15} <span className="text-base text-slate-300 font-bold">dias</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Todas as 16 ferramentas liberadas
              </p>
              <Link
                to={FORNECEDOR_ROUTES.planos}
                className="mt-3 block text-[11px] font-bold text-orange-300 underline hover:text-white"
              >
                Ver detalhes do plano Master →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          OS 3 PILARES DO CEO: DINHEIRO, VITÓRIA E RISCO
          ========================================================================= */}
      <section className="mb-8">
        {isContaNova ? (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50/50 p-2 sm:p-4">
            {/* Background com dados ilustrativos, mini-gráficos e blur */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 filter blur-[4px] select-none pointer-events-none opacity-40">
              {/* 1. Ilustrativo: Valor Total em Disputa */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Valor Total em Disputa
                  </span>
                  <div className="p-2.5 rounded-xl bg-blue-50 text-[#0A2540]">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                  R$ 4.850.000,00
                </div>
                <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                  <span className="text-slate-500 font-medium">
                    12 disputas na esteira
                  </span>
                  <div className="flex items-end gap-1 h-5">
                    <span className="w-1.5 h-2 bg-blue-300 rounded-t" />
                    <span className="w-1.5 h-3.5 bg-blue-400 rounded-t" />
                    <span className="w-1.5 h-2.5 bg-blue-300 rounded-t" />
                    <span className="w-1.5 h-5 bg-blue-600 rounded-t" />
                  </div>
                </div>
              </div>

              {/* 2. Ilustrativo: Sua Taxa de Sucesso */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Sua Taxa de Sucesso
                  </span>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
                  68.4%
                </div>
                <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                  <span className="text-slate-500 font-medium">
                    Conversão qualificada
                  </span>
                  <div className="flex items-end gap-1 h-5">
                    <span className="w-1.5 h-3 bg-emerald-300 rounded-t" />
                    <span className="w-1.5 h-4 bg-emerald-400 rounded-t" />
                    <span className="w-1.5 h-5 bg-emerald-600 rounded-t" />
                  </div>
                </div>
              </div>

              {/* 3. Ilustrativo: Atenção Imediata */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Atenção Imediata
                  </span>
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-amber-600 tracking-tight">
                  0 <span className="text-base font-bold text-slate-400">alertas</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                  <span className="text-slate-500 font-medium">
                    100% em conformidade
                  </span>
                  <span className="font-bold text-emerald-700">Auditado</span>
                </div>
              </div>
            </div>

            {/* Overlay Central Primário */}
            <div className="absolute inset-0 flex items-center justify-center p-4 z-10 bg-white/40 backdrop-blur-[1px]">
              <div className="bg-white/95 border border-slate-200/90 shadow-xl rounded-2xl p-6 sm:p-8 max-w-xl text-center backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-[#0A2540] text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-950/20">
                  <Sparkles className="w-6 h-6 text-brand-orange" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#0A2540] tracking-tight mb-2">
                  Conecte suas disputas para gerar inteligência de mercado
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                  Acompanhe oportunidades e visualize informações sobre sua atuação e os próximos passos.
                </p>
                <button
                  onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-orange-500/25 transition active:scale-95"
                >
                  <span>Conectar Disputas no Radar de Oportunidades</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Valor Total em Disputa */}
            <div
              onClick={() => navigate(FORNECEDOR_ROUTES.crm)}
              className="cursor-pointer group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#0A2540] hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Valor Total em Disputa
                </span>
                <div className="p-2.5 rounded-xl bg-blue-50 text-[#0A2540] group-hover:bg-[#0A2540] group-hover:text-white transition">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              {loading ? (
                <div className="h-10 flex items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                  {formatarMoeda(metrics?.valorTotalEmDisputa ?? 0)}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                <span className="text-slate-500 font-medium">
                  {metrics?.crmOportunidades ?? 0} disputas ativas na sua esteira
                </span>
                <span className="font-bold text-[#0A2540] group-hover:translate-x-1 transition flex items-center gap-1">
                  Ver esteira <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* 2. Sua Taxa de Sucesso */}
            <div
              onClick={() => navigate(FORNECEDOR_ROUTES.crm)}
              className="cursor-pointer group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Sua Taxa de Sucesso
                </span>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>

              {loading ? (
                <div className="h-10 flex items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
                  {metrics?.taxaSucesso ?? 0}%
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                <span className="text-slate-500 font-medium">
                  Contratos homologados vs. disputas encerradas
                </span>
                <span className="font-bold text-emerald-700 group-hover:translate-x-1 transition flex items-center gap-1">
                  Desempenho <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* 3. Atenção Imediata */}
            <div
              onClick={() => navigate(FORNECEDOR_ROUTES.prazos_alertas)}
              className={`cursor-pointer group rounded-2xl border p-6 shadow-sm transition-all relative overflow-hidden ${
                (metrics?.atencaoImediataCount ?? 0) > 0
                  ? 'border-amber-300 bg-amber-50/30 hover:border-amber-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Atenção Imediata
                </span>
                <div
                  className={`p-2.5 rounded-xl transition ${
                    (metrics?.atencaoImediataCount ?? 0) > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              {loading ? (
                <div className="h-10 flex items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : (
                <div
                  className={`text-3xl sm:text-4xl font-black tracking-tight ${
                    (metrics?.atencaoImediataCount ?? 0) > 0
                      ? 'text-amber-600'
                      : 'text-slate-800'
                  }`}
                >
                  {metrics?.atencaoImediataCount ?? 0}{' '}
                  <span className="text-base font-bold text-slate-400">
                    {(metrics?.atencaoImediataCount ?? 0) === 1 ? 'alerta' : 'alertas'}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                <span className="text-slate-500 font-medium">
                  {(metrics?.atencaoImediataCount ?? 0) > 0
                    ? `${metrics?.certidoesVencendoCount ?? 0} certidões · ${metrics?.prazosUrgentesCount ?? 0} prazos críticos`
                    : 'Documentação e prazos em dia'}
                </span>
                <span className="font-bold text-amber-700 group-hover:translate-x-1 transition flex items-center gap-1">
                  Verificar <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          CAMINHO DO SUCESSO (ONBOARDING INTELIGENTE: ZERO ATRITO)
          ========================================================================= */}
      {isContaNova && (
        <section className="bg-gradient-to-r from-[#0A2540] via-slate-900 to-indigo-950 text-white rounded-2xl p-7 sm:p-9 mb-8 shadow-md border border-indigo-900/30 relative overflow-hidden">
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold mb-3 border border-orange-400/30">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              Caminho do Sucesso Licitatório
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
              Pronto para faturar sua primeira licitação?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
              Encontre oportunidades, consulte seus custos e prepare propostas organizadas de acordo com as exigências do edital.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Passo 1 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
                className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <Package className="w-4 h-4 text-orange-400 group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">
                  Cadastre seus Produtos
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Cadastre seus produtos e custos para consultar sua margem ao preparar uma proposta.
                </p>
              </div>

              {/* Passo 2 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <Crosshair className="w-4 h-4 text-orange-400 group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">
                  Oportunidades Sugeridas
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Explore oportunidades publicadas nos portais oficiais do governo.
                </p>
              </div>

              {/* Passo 3 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.propostas)}
                className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <FileCheck2 className="w-4 h-4 text-orange-400 group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">
                  Gere sua Proposta
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Confira os itens identificados e revise seus preços antes de concluir.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
              className="h-11 px-6 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2 shadow-lg transition"
            >
              <span>Começar pelo Catálogo de Produtos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* =========================================================================
          DISPUTAS: PRAZOS E OPORTUNIDADES
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Prazos Críticos & Recursos */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Prazos Críticos & Sessões Públicas
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vencimentos e compromissos operacionais monitorados
                </p>
              </div>
              <button
                onClick={() => navigate(FORNECEDOR_ROUTES.prazos_alertas)}
                className="h-8 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1"
              >
                Ver todos
              </button>
            </div>

            {metrics?.prazosCriticos && metrics.prazosCriticos.length > 0 ? (
              <div className="space-y-3">
                {metrics.prazosCriticos.map((prazo) => (
                  <div
                    key={prazo.id}
                    className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prazo.evento}</p>
                      {prazo.edital && (
                        <p className="text-[11px] text-slate-500 mt-0.5">Edital: {prazo.edital}</p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {prazo.tipo?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-black text-[#0A2540]">
                        {formatarData(prazo.data)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Nenhum prazo urgente vencendo hoje
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Sessões de disputa, recursos tempestivos e certidões em conformidade com o cronograma.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => navigate(FORNECEDOR_ROUTES.prazos_alertas)}
                    className="h-8 px-3 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cadastrar Prazo
                  </button>
                  <button
                    onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                    className="h-8 px-3 rounded-md bg-brand-blue text-white text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Explorar Mercado
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Mercado Governamental: Oportunidades no Banco Interno */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Mercado Governamental Recente
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Oportunidades catalogadas no banco de dados interno
                </p>
              </div>
              <button
                onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                className="h-8 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1"
              >
                Abrir Radar
              </button>
            </div>

            {metrics?.recomendacoes && metrics.recomendacoes.length > 0 ? (
              <div className="space-y-3">
                {metrics.recomendacoes.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => navigate(`/fornecedor/licitacao/${rec.id}`)}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {rec.orgao || 'Órgão Licitante'}
                          {rec.uf ? ` · ${rec.uf}` : ''}
                        </p>
                      </div>
                      {rec.modalidade && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                          {rec.modalidade}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                      {rec.objeto}
                    </p>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
                      <span className="text-slate-400 text-[10px] font-semibold">Valor Estimado</span>
                      <strong className="text-slate-900 font-black">
                        {formatarMoeda(rec.valor)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
                <Crosshair className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Carregando oportunidades oficiais...
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Consulte os editais de Pregão Eletrônico e Dispensa gravados em nosso banco.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                    className="h-8 px-4 rounded-md bg-brand-blue text-white text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Acessar Radar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
