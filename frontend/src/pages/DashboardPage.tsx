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
  Search,
  ShieldCheck,
  Target,
  Clock,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { dashboardApi, certidoesApi, crmApi, licitacoesApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '@/store/auth.store';
import { getTrialDaysLeft, isUserTrialActive } from '@/components/layout/Sidebar';

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

function formatCnpj(cnpj?: string | null): string {
  if (!cnpj) return 'Aguardando cadastro';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
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

  // Consulta de regularidade cadastral (SICAF) e certidões reais da empresa
  const certidoesQuery = useQuery({
    queryKey: ['certidoes', selectedCompany?.id ?? 'default'],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      try {
        const response = await certidoesApi.listar({ empresa_id: selectedCompany.id });
        const raw = response.data?.data ?? response.data?.certidoes ?? response.data;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(selectedCompany?.id),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const certidoes = certidoesQuery.data ?? [];

  const certidaoTrabalhista = certidoes.find((c: any) => {
    const nome = (c.nome || '').toLowerCase();
    const orgao = (c.orgao || '').toLowerCase();
    const esfera = (c.esfera || '').toUpperCase();
    return esfera === 'TRABALHISTA' || nome.includes('trabalh') || nome.includes('cndt') || orgao.includes('tst');
  });

  const isTrabalhistaRegular = Boolean(
    certidaoTrabalhista &&
      certidaoTrabalhista.status === 'VALIDA' &&
      certidaoTrabalhista.regularidade !== 'IRREGULAR'
  );

  const certidaoFgts = certidoes.find((c: any) => {
    const nome = (c.nome || '').toLowerCase();
    const orgao = (c.orgao || '').toLowerCase();
    return nome.includes('fgts') || nome.includes('crf') || orgao.includes('caixa');
  });

  const isFgtsRegular = Boolean(
    certidaoFgts &&
      certidaoFgts.status === 'VALIDA' &&
      certidaoFgts.regularidade !== 'IRREGULAR'
  );

  const totalValidas = certidoes.filter(
    (c: any) => c.status === 'VALIDA' && c.regularidade !== 'IRREGULAR'
  ).length;

  const notaQualificacao = certidoes.length > 0 ? Number(((totalValidas / certidoes.length) * 10).toFixed(1)) : 0;

  // Metas de Contratos
  const editaisMonitorados = metrics?.editaisMonitorados ?? 0;
  const editaisTarget = 20;
  const progressoEditais = editaisMonitorados > 0 ? Math.min(100, Math.round((editaisMonitorados / editaisTarget) * 100)) : 0;

  const valorHomologado = metrics?.valorTotalEmDisputa ?? 0;
  const metaTrimestralTarget = 500000;
  const progressoMetaTrimestral = valorHomologado > 0 ? Math.min(100, Math.round((valorHomologado / metaTrimestralTarget) * 100)) : 0;

  const disputasSemana = metrics?.prazosEstaSemana ?? metrics?.crmOportunidades ?? 0;
  const disputasTarget = 5;
  const progressoDisputas = disputasSemana > 0 ? Math.min(100, Math.round((disputasSemana / disputasTarget) * 100)) : 0;

  // Licitações salvas do backend para Linha do Tempo e Assertividade
  const savedLicitacoesQuery = useQuery({
    queryKey: ['saved-licitacoes-dashboard', selectedCompany?.id ?? 'default'],
    queryFn: async () => {
      try {
        const res = await crmApi.getOportunidades();
        const raw = res.data?.data || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) return raw;

        // Fallback: busca licitações monitoradas/recentes do radar se o funil não tiver itens
        const fallbackRes = await licitacoesApi.listar({ tamanhoPagina: 5 });
        const fallbackData = fallbackRes.data?.data?.itens || fallbackRes.data?.itens || fallbackRes.data || [];
        return Array.isArray(fallbackData) ? fallbackData : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const savedLicitacoes = savedLicitacoesQuery.data ?? [];

  // Mapeamento normalizado para a Linha do Tempo (Órgão Público, Modalidade, Data da Sessão, Valor Estimado)
  const mappedTimeline = savedLicitacoes.slice(0, 5).map((item: any, idx: number) => {
    const notice = item.notice || item;
    const id = item.id || notice.id || `lic-${idx}`;
    const orgao = notice.buyerName || item.orgao || notice.orgao || 'Órgão Licitante';
    const uasg = notice.uasg || item.uasg || notice.cnpjOrgao || item.cnpjOrgao || (notice.uf ? `UF ${notice.uf}` : null);
    const modalidade = notice.modality || notice.modalidade || item.modalidade || 'Pregão Eletrônico';
    const rawData = notice.openingAt || notice.dataAbertura || item.dataAbertura || item.data_abertura || item.dataSessao || notice.data_abertura;
    const dataSessao = rawData ? formatarData(rawData) : 'A definir';
    const rawValor = notice.estimatedValue ?? notice.valorEstimado ?? item.valorEstimado ?? item.valor_estimado ?? item.valor ?? null;
    const valorEstimado = formatarMoeda(rawValor);
    const licitacaoId = notice.id || item.id || item.noticeId || '';

    return {
      id,
      licitacaoId,
      orgao,
      uasg,
      modalidade,
      dataSessao,
      valorEstimado,
    };
  });

  // Assertividade: Propostas Aceitas (Verde), Fase de Recurso (Laranja/Amarelo), Desclassificações (Vermelho)
  const propostasAceitasCount = savedLicitacoes.filter((i: any) =>
    ['ADJUDICADO', 'GANHO', 'HOMOLOGADO', 'VITORIA', 'ACEITA'].includes(String(i.stage || i.situacao || '').toUpperCase())
  ).length;

  const faseRecursoCount = savedLicitacoes.filter((i: any) =>
    ['RECURSO', 'IMPUGNACAO', 'ANALISE', 'DISPUTA'].includes(String(i.stage || i.situacao || '').toUpperCase())
  ).length;

  const desclassificacoesCount = savedLicitacoes.filter((i: any) =>
    ['PERDIDO', 'DESCLASSIFICADO', 'INABILITADO', 'FRACASSADO'].includes(String(i.stage || i.situacao || '').toUpperCase())
  ).length;

  const totalAssertividade = propostasAceitasCount + faseRecursoCount + desclassificacoesCount;

  const pctAceitas = totalAssertividade > 0
    ? Math.round((propostasAceitasCount / totalAssertividade) * 100)
    : (metrics?.taxaSucesso ?? 0);

  const pctRecurso = totalAssertividade > 0
    ? Math.round((faseRecursoCount / totalAssertividade) * 100)
    : (metrics?.prazosEstaSemana && metrics.prazosEstaSemana > 0 ? Math.min(30, metrics.prazosEstaSemana * 10) : 0);

  const pctDesclassificacoes = totalAssertividade > 0
    ? Math.max(0, 100 - pctAceitas - pctRecurso)
    : 0;

  const isContaNova =
    Boolean(metrics?.isContaNova) ||
    (!loading &&
      metrics &&
      metrics.valorTotalEmDisputa === 0 &&
      metrics.propostasCriadas === 0 &&
      (metrics.catalogItemsCount ?? 0) === 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-brand-light min-h-screen">
      {/* Header — Visão Geral das Licitações */}
      <header data-tour="executive-header" className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 capitalize">{dateLabel}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-dark">
            Visão Geral das Licitações
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            Inteligência estratégica, margem de lucro e governança sob a Lei 14.133/2021.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={FORNECEDOR_ROUTES.radar}
            data-tour="radar-opportunities"
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

      {/* Barra simples de status de teste & atalho rápido */}
      {isUserTrialActive(user) && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange border border-orange-200">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-brand-dark uppercase tracking-wide">
                    Período de Testes Ativo
                  </span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                    {getTrialDaysLeft(user)} dias restantes
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Acesso completo liberado a todas as ferramentas e busca de oportunidades da plataforma.
                </p>
              </div>
            </div>

            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Buscar Editais</span>
            </Link>
          </div>
        </section>
      )}

      {/* =========================================================================
          SEÇÃO ESTRUTURAL: PAINEL DE REGULARIDADE (SICAF) & METAS DE CONTRATOS
          ========================================================================= */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel de Regularidade (SICAF) - Esquerda */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-brand-dark">
                  <ShieldCheck className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Painel de Regularidade (SICAF)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Habilitação Fiscal & Cadastral
                  </p>
                </div>
              </div>

              {selectedCompany?.cnpj ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  CNPJ Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  Aguardando sincronização
                </span>
              )}
            </div>

            {/* Informações da Empresa & CNPJ */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-black text-brand-dark truncate">
                  {selectedCompany?.nomeFantasia || selectedCompany?.razaoSocial || 'Empresa Cadastrada'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  CNPJ: {formatCnpj(selectedCompany?.cnpj)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Nota Qualificação
                </span>
                <div className="text-lg font-black text-brand-dark">
                  {notaQualificacao > 0 ? (
                    <span className="text-emerald-600">{notaQualificacao.toFixed(1)}</span>
                  ) : (
                    <span className="text-slate-400">0.0</span>
                  )}
                  <span className="text-xs font-normal text-slate-400"> / 10</span>
                </div>
              </div>
            </div>

            {/* Duas Barras de Status Curtas (Trabalhista e FGTS) */}
            <div className="mt-5 space-y-4">
              {/* 1. Trabalhista (CNDT) */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    Trabalhista (CNDT)
                  </span>
                  {isTrabalhistaRegular ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      100% Regular
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      0% Aguardando Sincronização
                    </span>
                  )}
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isTrabalhistaRegular ? 'w-full bg-emerald-500' : 'w-0 bg-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* 2. FGTS / Previdenciária (CRF Caixa) */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    FGTS (CRF Caixa)
                  </span>
                  {isFgtsRegular ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      100% Regular
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      0% Aguardando Sincronização
                    </span>
                  )}
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFgtsRegular ? 'w-full bg-emerald-500' : 'w-0 bg-slate-300'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {certidoes.length > 0
                ? `${totalValidas} de ${certidoes.length} certidões ativas`
                : 'Sincronização cadastral pendente'}
            </span>
            <Link
              to={FORNECEDOR_ROUTES.certidoes}
              className="text-xs font-bold text-brand-blue hover:text-brand-dark transition flex items-center gap-1"
            >
              <span>Gerenciar SICAF</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Metas de Contratos - Direita (Topo) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-50 text-brand-orange">
                  <Target className="w-5 h-5 text-brand-orange" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Metas de Contratos
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Acompanhamento operacional e execução de certames
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-slate-400">
                Ciclo Atual
              </span>
            </div>

            {/* 3 Mini-cards com barra de progresso horizontal simples */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. Edital Transparência */}
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      1. Transparência
                    </span>
                    <span className="text-[10px] font-bold text-brand-blue">
                      {progressoEditais}%
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Edital Transparência
                  </h3>
                  <div className="text-xl font-black text-brand-dark tracking-tight my-1.5">
                    {editaisMonitorados}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      {editaisMonitorados === 1 ? 'edital' : 'editais'}
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-blue rounded-full transition-all duration-500"
                      style={{ width: `${progressoEditais}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    {editaisMonitorados > 0 ? 'Radar PNCP ativo' : '0% - Aguardando radar'}
                  </p>
                </div>
              </div>

              {/* 2. Meta Trimestral (Capital homologado) */}
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      2. Capital
                    </span>
                    <span className="text-[10px] font-bold text-brand-orange">
                      {progressoMetaTrimestral}%
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 truncate" title="Meta Trimestral (Capital homologado)">
                    Meta Trimestral
                  </h3>
                  <div className="text-lg font-black text-brand-orange tracking-tight my-1.5 truncate">
                    {formatarMoeda(valorHomologado)}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-orange rounded-full transition-all duration-500"
                      style={{ width: `${progressoMetaTrimestral}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    {valorHomologado > 0 ? 'Capital homologado' : '0% - Sem homologações'}
                  </p>
                </div>
              </div>

              {/* 3. Disputas da Semana */}
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      3. Disputas
                    </span>
                    <span className="text-[10px] font-bold text-brand-dark">
                      {progressoDisputas}%
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Disputas da Semana
                  </h3>
                  <div className="text-xl font-black text-brand-dark tracking-tight my-1.5">
                    {disputasSemana}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      {disputasSemana === 1 ? 'sessão' : 'sessões'}
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-dark rounded-full transition-all duration-500"
                      style={{ width: `${progressoDisputas}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    {disputasSemana > 0 ? 'Sessões em agenda' : '0% - Nenhuma sessão'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Conectado ao fluxo do PNCP e CRM Governamental
            </span>
            <Link
              to={FORNECEDOR_ROUTES.crm}
              className="text-xs font-bold text-brand-orange hover:text-orange-600 transition flex items-center gap-1"
            >
              <span>Acompanhar Esteira</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SEÇÃO DO MEIO: INDICADORES PRINCIPAIS & ASSERTIVIDADE (MEIO DIREITA)
          ========================================================================= */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3 Indicadores Principais (Meio Esquerda - 7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Valor Total em Disputa */}
          <div
            onClick={() => navigate(FORNECEDOR_ROUTES.crm)}
            className="cursor-pointer group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-dark hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out relative overflow-hidden flex flex-col justify-between"
            style={{ transition: 'all 0.3s ease' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Em Disputa
                </span>
                <div className="p-2 rounded-xl bg-blue-50 text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>

              {loading ? (
                <div className="h-8 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="text-2xl font-black text-brand-dark tracking-tight">
                  {formatarMoeda(metrics?.valorTotalEmDisputa ?? 0)}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] border-t border-slate-100 pt-2.5">
              <span className="text-slate-500 font-medium truncate">
                {metrics?.crmOportunidades ?? 0} disputas ativas
              </span>
              <span className="font-bold text-brand-dark flex items-center gap-0.5 shrink-0">
                Ver <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* 2. Sua Taxa de Sucesso */}
          <div
            onClick={() => navigate(FORNECEDOR_ROUTES.crm)}
            className="cursor-pointer group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-500 hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out relative overflow-hidden flex flex-col justify-between"
            style={{ transition: 'all 0.3s ease' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Taxa de Sucesso
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>

              {loading ? (
                <div className="h-8 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="text-2xl font-black text-emerald-600 tracking-tight">
                  {metrics?.taxaSucesso ?? 0}%
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] border-t border-slate-100 pt-2.5">
              <span className="text-slate-500 font-medium truncate">
                Homologados vs. disputa
              </span>
              <span className="font-bold text-emerald-700 flex items-center gap-0.5 shrink-0">
                Métricas <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* 3. Atenção Imediata */}
          <div
            onClick={() => navigate(FORNECEDOR_ROUTES.prazos_alertas)}
            className={`cursor-pointer group rounded-2xl border p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out relative overflow-hidden flex flex-col justify-between ${
              (metrics?.atencaoImediataCount ?? 0) > 0
                ? 'border-amber-300 bg-amber-50/30 hover:border-amber-500'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
            style={{ transition: 'all 0.3s ease' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Atenção Imediata
                </span>
                <div
                  className={`p-2 rounded-xl transition ${
                    (metrics?.atencaoImediataCount ?? 0) > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>

              {loading ? (
                <div className="h-8 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div
                  className={`text-2xl font-black tracking-tight ${
                    (metrics?.atencaoImediataCount ?? 0) > 0
                      ? 'text-amber-600'
                      : 'text-slate-800'
                  }`}
                >
                  {metrics?.atencaoImediataCount ?? 0}{' '}
                  <span className="text-xs font-bold text-slate-400">
                    {(metrics?.atencaoImediataCount ?? 0) === 1 ? 'alerta' : 'alertas'}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] border-t border-slate-100 pt-2.5">
              <span className="text-slate-500 font-medium truncate">
                {(metrics?.atencaoImediataCount ?? 0) > 0 ? 'Documentos / prazos' : 'Conformidade ativa'}
              </span>
              <span className="font-bold text-amber-700 flex items-center gap-0.5 shrink-0">
                Ver <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Assertividade (Meio Direita - 5 cols) */}
        <div
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md"
          style={{ transition: 'all 0.3s ease' }}
        >
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Assertividade
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Conversão em disputas governamentais
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {totalAssertividade > 0 ? `${totalAssertividade} analisadas` : 'Esteira Real'}
              </span>
            </div>

            {/* 3 Barras de Progresso Horizontais Empilhadas */}
            <div className="mt-4 space-y-3.5">
              {/* 1. Propostas Aceitas (Verde) */}
              <div
                className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/80 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                style={{ transition: 'all 0.3s ease' }}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Propostas Aceitas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {propostasAceitasCount} {propostasAceitasCount === 1 ? 'proposta' : 'propostas'}
                    </span>
                    <span className="text-xs font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {pctAceitas}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${pctAceitas}%` }}
                  />
                </div>
              </div>

              {/* 2. Fase de Recurso (Laranja/Amarelo) */}
              <div
                className="p-3 rounded-xl bg-amber-50/50 border border-amber-100/80 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                style={{ transition: 'all 0.3s ease' }}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Fase de Recurso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {faseRecursoCount} {faseRecursoCount === 1 ? 'processo' : 'processos'}
                    </span>
                    <span className="text-xs font-black text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                      {pctRecurso}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${pctRecurso}%` }}
                  />
                </div>
              </div>

              {/* 3. Desclassificações (Vermelho) */}
              <div
                className="p-3 rounded-xl bg-rose-50/50 border border-rose-100/80 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                style={{ transition: 'all 0.3s ease' }}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Desclassificações</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {desclassificacoesCount} {desclassificacoesCount === 1 ? 'ocorrência' : 'ocorrências'}
                    </span>
                    <span className="text-xs font-black text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                      {pctDesclassificacoes}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-rose-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${pctDesclassificacoes}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Índice de assertividade da esteira
            </span>
            <Link
              to={FORNECEDOR_ROUTES.crm}
              className="text-xs font-bold text-brand-orange hover:text-orange-600 transition flex items-center gap-1"
            >
              <span>Ver Funil</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CAMINHO DO SUCESSO (ONBOARDING INTELIGENTE: ZERO ATRITO)
          ========================================================================= */}
      {isContaNova && (
        <section className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-brand-orange text-xs font-bold mb-3 border border-orange-200">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              Caminho do Sucesso Licitatório
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 text-brand-dark">
              Pronto para faturar sua primeira licitação?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 font-medium">
              Encontre oportunidades, consulte seus custos e prepare propostas organizadas de acordo com as exigências do edital.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Passo 1 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
                className="bg-slate-50 hover:bg-orange-50/40 border border-slate-200 hover:border-orange-200 rounded-xl p-4 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <Package className="w-4 h-4 text-brand-orange group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">
                  Cadastre seus Produtos
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cadastre seus produtos e custos para consultar sua margem ao preparar uma proposta.
                </p>
              </div>

              {/* Passo 2 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                className="bg-slate-50 hover:bg-orange-50/40 border border-slate-200 hover:border-orange-200 rounded-xl p-4 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <Crosshair className="w-4 h-4 text-brand-orange group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">
                  Oportunidades Sugeridas
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Explore oportunidades publicadas nos portais oficiais do governo.
                </p>
              </div>

              {/* Passo 3 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.propostas)}
                className="bg-slate-50 hover:bg-orange-50/40 border border-slate-200 hover:border-orange-200 rounded-xl p-4 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <FileCheck2 className="w-4 h-4 text-brand-orange group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">
                  Gere sua Proposta
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Confira os itens identificados e revise seus preços antes de concluir.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
              className="h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <span>Começar pelo Catálogo de Produtos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* =========================================================================
          SEÇÃO INFERIOR: LINHA DO TEMPO (INFERIOR ESQUERDA) & PRAZOS (INFERIOR DIREITA)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Linha do Tempo (Inferior Esquerda - 7 cols) */}
        <section
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:shadow-md"
          style={{ transition: 'all 0.3s ease' }}
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-brand-blue">
                  <Clock className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Linha do Tempo
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Sessões públicas e licitações salvas na esteira
                  </p>
                </div>
              </div>

              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="text-xs font-bold text-brand-blue hover:text-brand-dark transition flex items-center gap-1"
              >
                <span>Explorar Radar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Tabela Limpa */}
            {mappedTimeline.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Órgão Público (UASG)</th>
                      <th className="py-2.5 px-3">Modalidade</th>
                      <th className="py-2.5 px-3">Data da Sessão</th>
                      <th className="py-2.5 px-3 text-right">Valor Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappedTimeline.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => item.licitacaoId && navigate(`/fornecedor/licitacao/${item.licitacaoId}`)}
                        className="group transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:bg-slate-50/80 cursor-pointer rounded-lg"
                        style={{ transition: 'all 0.3s ease' }}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[240px]">
                            {item.orgao}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {item.uasg ? (item.uasg.startsWith('UF') ? item.uasg : `UASG: ${item.uasg}`) : 'UASG: —'}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-brand-blue border border-blue-100">
                            {item.modalidade}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.dataSessao}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="text-xs font-black text-brand-dark">
                            {item.valorEstimado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Nenhuma licitação salva na esteira
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Acompanhe oportunidades no Radar Governamental e salve editais para visualizar o cronograma aqui.
                </p>
                <button
                  onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                  className="mt-4 h-8 px-4 rounded-md bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold transition"
                >
                  Conectar Oportunidades
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{mappedTimeline.length} licitações monitoradas</span>
            <span className="font-semibold text-brand-dark">Sincronizado com PNCP</span>
          </div>
        </section>

        {/* Prazos Críticos & Sessões Públicas (Inferior Direita - 5 cols) */}
        <section
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md"
          style={{ transition: 'all 0.3s ease' }}
        >
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Prazos Críticos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vencimentos e compromissos monitorados
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
                {metrics.prazosCriticos.slice(0, 4).map((prazo) => (
                  <div
                    key={prazo.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                    style={{ transition: 'all 0.3s ease' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prazo.evento}</p>
                      {prazo.edital && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">Edital: {prazo.edital}</p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {prazo.tipo?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-black text-brand-dark">
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
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Agenda integrada</span>
            <span className="font-semibold text-brand-dark">Lei 14.133/2021</span>
          </div>
        </section>
      </div>

      {/* Mercado Governamental: Oportunidades no Banco Interno */}
      <section
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between mb-8 transition-all duration-300 ease-in-out hover:shadow-md"
        style={{ transition: 'all 0.3s ease' }}
      >
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
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ transition: 'all 0.3s ease' }}
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
  );
}
