import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  BarChart3,
  Search,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '@/store/auth.store';

interface DashboardMetrics {
  atencaoImediataCount?: number;
  certidoesVencendoCount?: number;
  prazosUrgentesCount?: number;
  editaisMonitorados?: number;
  propostasCriadas?: number;
  prazosEstaSemana?: number;
  crmOportunidades?: number;
  statsRadar?: {
    editaisAtivos?: number;
  };
  recomendacoes?: Array<{
    id: string;
    orgao: string;
    uf: string;
    objeto: string;
    valor: number | null;
    modalidade?: string;
  }>;
  prazosCriticos?: Array<{
    id: string;
    evento: string;
    data: string;
    tipo: string;
    edital?: string;
  }>;
}

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor) || valor <= 0) {
    return 'Consultar no edital';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const { user } = useAuthStore();
  const [termoBusca, setTermoBusca] = useState('');

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics', selectedCompany?.id],
    queryFn: async () => {
      const res = await dashboardApi.getMetrics(selectedCompany?.id);
      return (res.data?.data || res.data || {}) as DashboardMetrics;
    },
    staleTime: 60_000,
  });

  const primeiroNome =
    (user?.apelido || user?.nome || selectedCompany?.nomeFantasia || 'Empresa')
      .trim()
      .split(/\s+/)[0];

  const oportunidadesAbertas =
    metrics?.statsRadar?.editaisAtivos ?? metrics?.editaisMonitorados ?? 0;
  const processosAndamento =
    metrics?.crmOportunidades ?? metrics?.propostasCriadas ?? 0;
  const alertasAtivos =
    metrics?.prazosUrgentesCount ?? metrics?.prazosEstaSemana ?? 0;
  const tarefasPendentes =
    metrics?.atencaoImediataCount ?? metrics?.certidoesVencendoCount ?? 0;

  const recomendacoes = Array.isArray(metrics?.recomendacoes)
    ? metrics.recomendacoes.slice(0, 4)
    : [];

  const handleBuscarTopo = (e: React.FormEvent) => {
    e.preventDefault();
    const q = termoBusca.trim();
    if (q) {
      navigate(`${FORNECEDOR_ROUTES.radar}?busca=${encodeURIComponent(q)}`);
    } else {
      navigate(FORNECEDOR_ROUTES.radar);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#081C3A] p-5 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* BARRA DE BUSCA SUPERIOR */}
        <form onSubmit={handleBuscarTopo} className="max-w-xl">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar editais, órgãos ou palavras-chave..."
              className="w-full bg-white border border-slate-200 rounded-full pl-11 pr-4 py-2.5 text-sm text-[#081C3A] placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-[#0070C0]"
            />
          </div>
        </form>

        {/* SAUDAÇÃO + BANNER LATERAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-[#081C3A] tracking-tight">
              Olá, {primeiroNome}!
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Aqui está o panorama da sua jornada em licitações. Acompanhe suas oportunidades e avance com mais estratégia.
            </p>
          </div>

          <div className="lg:col-span-5">
            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="group flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-white to-blue-50 border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all"
            >
              <div className="space-y-1">
                <p className="text-base font-black text-[#081C3A] leading-snug">
                  Mais oportunidades para o crescimento da sua empresa
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0]">
                  Explorar editais abertos
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#081C3A] text-[#FF6600] flex items-center justify-center shrink-0">
                <TrendingUp className="w-7 h-7" />
              </div>
            </Link>
          </div>
        </div>

        {/* VISÃO GERAL (4 CARDS) + ACESSO RÁPIDO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            <h2 className="text-lg font-bold text-[#081C3A]">Visão geral</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-[#0070C0] transition-all flex flex-col justify-between min-h-[132px]"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-slate-50 text-[#081C3A]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-black text-[#081C3A]">
                    {isLoading ? '...' : oportunidadesAbertas.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2 mt-4">
                  <span className="text-xs font-semibold text-slate-700 leading-snug">
                    Oportunidades em aberto
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#0070C0] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-[#0070C0] transition-all flex flex-col justify-between min-h-[132px]"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-slate-50 text-[#081C3A]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-black text-[#081C3A]">
                    {isLoading ? '...' : processosAndamento}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2 mt-4">
                  <span className="text-xs font-semibold text-slate-700 leading-snug">
                    Processos em andamento
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#0070C0] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              <Link
                to={FORNECEDOR_ROUTES.prazos_alertas}
                className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-[#0070C0] transition-all flex flex-col justify-between min-h-[132px]"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-slate-50 text-[#081C3A]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-black text-[#081C3A]">
                    {isLoading ? '...' : alertasAtivos}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2 mt-4">
                  <span className="text-xs font-semibold text-slate-700 leading-snug">
                    Alertas ativos
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#0070C0] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              <Link
                to={FORNECEDOR_ROUTES.certidoes}
                className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-[#0070C0] transition-all flex flex-col justify-between min-h-[132px]"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl bg-slate-50 text-[#081C3A]">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-black text-[#081C3A]">
                    {isLoading ? '...' : tarefasPendentes}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2 mt-4">
                  <span className="text-xs font-semibold text-slate-700 leading-snug">
                    Tarefas pendentes
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#0070C0] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* ACESSO RÁPIDO */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-lg font-bold text-[#081C3A]">Acesso rápido</h2>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <FileText className="w-4 h-4 text-[#FF6600]" />
                  Buscar editais
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <ListChecks className="w-4 h-4 text-[#081C3A]" />
                  Gerenciar processos
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.prazos_alertas}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <Settings className="w-4 h-4 text-[#081C3A]" />
                  Configurar alertas
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.relatorios_estrategicos}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <BarChart3 className="w-4 h-4 text-[#081C3A]" />
                  Acessar relatórios
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>

        {/* SUAS OPORTUNIDADES EM FOCO + ACOMPANHE SEUS PROCESSOS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#081C3A]">
                Suas oportunidades em foco
              </h2>
              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0] hover:underline"
              >
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
              {recomendacoes.length > 0 ? (
                recomendacoes.map((item) => (
                  <Link
                    key={item.id}
                    to={`${FORNECEDOR_ROUTES.radar}?busca=${encodeURIComponent(item.orgao)}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#081C3A] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#081C3A] truncate">
                          {item.orgao} {item.uf ? `(${item.uf})` : ''}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {item.objeto}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold text-[#0070C0] hidden sm:inline">
                        {formatarMoeda(item.valor)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))
              ) : (
                <>
                  <Link
                    to={FORNECEDOR_ROUTES.radar}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#081C3A]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#081C3A]">Editais recentes</p>
                        <p className="text-xs text-slate-500">Novas oportunidades de seu interesse</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>

                  <Link
                    to={FORNECEDOR_ROUTES.radar}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#081C3A]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#081C3A]">Oportunidades recomendadas</p>
                        <p className="text-xs text-slate-500">Com base no ramo da sua empresa</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>

                  <Link
                    to={FORNECEDOR_ROUTES.editais_monitorados}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#081C3A]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#081C3A]">Acompanhamento personalizado</p>
                        <p className="text-xs text-slate-500">Editais que você salvou para disputar</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* ACOMPANHE SEUS PROCESSOS */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#081C3A]">
                Acompanhe seus processos
              </h2>
              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0] hover:underline"
              >
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[#081C3A]" />
                  <div>
                    <p className="text-sm font-bold text-[#081C3A]">Em análise</p>
                    <p className="text-xs text-slate-500">Acompanhe o andamento das etapas</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to={FORNECEDOR_ROUTES.prazos_alertas}
                className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#081C3A]" />
                  <div>
                    <p className="text-sm font-bold text-[#081C3A]">Prazos próximos</p>
                    <p className="text-xs text-slate-500">Fique atento aos próximos vencimentos</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                to={FORNECEDOR_ROUTES.propostas}
                className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#081C3A]" />
                  <div>
                    <p className="text-sm font-bold text-[#081C3A]">Propostas salvas</p>
                    <p className="text-xs text-slate-500">Revise e finalize suas propostas</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}