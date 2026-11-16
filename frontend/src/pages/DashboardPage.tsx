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
  Search,
  ShieldCheck,
  TrendingUp,
  Gavel,
  Vault,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '@/store/auth.store';

interface DashboardMetrics {
  companyName?: string;
  atencaoImediataCount?: number;
  certidoesVencendoCount?: number;
  prazosUrgentesCount?: number;
  editaisMonitorados?: number;
  propostasCriadas?: number;
  prazosEstaSemana?: number;
  crmOportunidades?: number;
  statsRadar?: {
    editaisAtivos?: number;
    valorTotalEstimado?: number;
    orgaosCompradores?: number;
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
      const res = await dashboardApi.getMetrics();
      return (res.data?.data || res.data || {}) as DashboardMetrics;
    },
    staleTime: 60_000,
  });

  const nomeEmpresa =
    selectedCompany?.nomeFantasia?.trim() ||
    selectedCompany?.razaoSocial?.trim() ||
    metrics?.companyName ||
    user?.apelido?.trim() ||
    user?.nome?.trim() ||
    'Sua Empresa';
  void nomeEmpresa;

  // 4 Indicadores Reais do dashboardApi.getMetrics()
  const editaisCompativeis =
    metrics?.statsRadar?.editaisAtivos ?? metrics?.editaisMonitorados ?? 0;
  const disputasEmAndamento =
    metrics?.crmOportunidades ?? metrics?.propostasCriadas ?? 0;
  const certidoesVencendo = metrics?.certidoesVencendoCount ?? 0;
  const certidoesEmDia =
    certidoesVencendo === 0
      ? '5 de 5'
      : `${Math.max(0, 5 - certidoesVencendo)} de 5`;
  const proximosPrazos =
    metrics?.prazosEstaSemana ??
    metrics?.prazosUrgentesCount ??
    (metrics?.prazosCriticos?.length ?? 0);

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
              placeholder="Buscar editais, órgãos ou produtos no radar..."
              className="w-full bg-white border border-slate-200 rounded-full pl-11 pr-4 py-2.5 text-sm text-[#081C3A] placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-[#0070C0]"
            />
          </div>
        </form>

        {/* SAUDAÇÃO PERSONALIZADA COM A EMPRESA ATIVA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-bold text-[#0070C0]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Painel da Empresa Ativa</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#081C3A] tracking-tight">
              Olá, {user?.nome ? user.nome.split(' ')[0] : 'Empreendedor'}!
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Central de comando das suas licitações públicas. Acompanhe seus indicadores em tempo real e avance com segurança na Lei 14.133/2021.
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
                  Explorar editais no radar
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#081C3A] text-[#FF6600] flex items-center justify-center shrink-0">
                <TrendingUp className="w-7 h-7" />
              </div>
            </Link>
          </div>
        </div>

        {/* 4 INDICADORES REAIS DO MODELO CANVA (SLIDE 04) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            <h2 className="text-lg font-bold text-[#081C3A]">Visão geral em tempo real</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* 1. OPORTUNIDADES EM ABERTO */}
              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-[#FF6600] transition-all flex flex-col justify-between min-h-[136px] overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FF6600]" />
                <div className="flex items-start justify-between pl-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Oportunidades
                  </span>
                  <div className="p-1.5 rounded-lg bg-orange-50 text-[#FF6600]">
                    <Search className="w-4 h-4" />
                  </div>
                </div>
                <div className="pl-1 my-1">
                  <span className="text-2xl font-black text-[#081C3A]">
                    {isLoading ? '...' : editaisCompativeis.toLocaleString('pt-BR')}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Editais compatíveis</p>
                </div>
                <div className="flex items-center justify-between gap-1 pl-1 pt-2 border-t border-slate-100 text-[11px] font-bold text-[#FF6600]">
                  <span>Ver todas</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 2. PROCESSOS EM ANDAMENTO */}
              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-[#0070C0] transition-all flex flex-col justify-between min-h-[136px] overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0070C0]" />
                <div className="flex items-start justify-between pl-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Em andamento
                  </span>
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#0070C0]">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="pl-1 my-1">
                  <span className="text-2xl font-black text-[#081C3A]">
                    {isLoading ? '...' : disputasEmAndamento}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Disputas e cotações</p>
                </div>
                <div className="flex items-center justify-between gap-1 pl-1 pt-2 border-t border-slate-100 text-[11px] font-bold text-[#0070C0]">
                  <span>Acompanhar</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 3. ALERTAS ATIVOS (CERTIDÕES E RISCOS) */}
              <Link
                to={FORNECEDOR_ROUTES.cofre}
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-amber-500 transition-all flex flex-col justify-between min-h-[136px] overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                <div className="flex items-start justify-between pl-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Certidões
                  </span>
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="pl-1 my-1">
                  <span className="text-2xl font-black text-[#081C3A]">
                    {isLoading ? '...' : certidoesEmDia}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Habilitação regular</p>
                </div>
                <div className="flex items-center justify-between gap-1 pl-1 pt-2 border-t border-slate-100 text-[11px] font-bold text-amber-600">
                  <span>Conferir cofre</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 4. TAREFAS PENDENTES / PRÓXIMOS PRAZOS */}
              <Link
                to={FORNECEDOR_ROUTES.prazos_alertas}
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between min-h-[136px] overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                <div className="flex items-start justify-between pl-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Prazos
                  </span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <Bell className="w-4 h-4" />
                  </div>
                </div>
                <div className="pl-1 my-1">
                  <span className="text-2xl font-black text-[#081C3A]">
                    {isLoading ? '...' : proximosPrazos}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Compromissos ativos</p>
                </div>
                <div className="flex items-center justify-between gap-1 pl-1 pt-2 border-t border-slate-100 text-[11px] font-bold text-emerald-600">
                  <span>Ver agenda</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* ATALHOS RÁPIDOS PARA O FLUXO PRINCIPAL */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-lg font-bold text-[#081C3A]">Atalhos estratégicos</h2>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <Search className="w-4 h-4 text-[#0070C0]" />
                  1. Buscar editais no radar
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <ListChecks className="w-4 h-4 text-[#081C3A]" />
                  2. Gestão de disputas
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.propostas}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <FileText className="w-4 h-4 text-[#FF6600]" />
                  3. Gerador de propostas
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.robo_lances}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <Gavel className="w-4 h-4 text-[#081C3A]" />
                  4. Sala de disputa
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                to={FORNECEDOR_ROUTES.cofre}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-[#081C3A]">
                  <Vault className="w-4 h-4 text-[#0070C0]" />
                  5. Cofre e certidões
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
                Ver todas no radar <ArrowRight className="w-3.5 h-3.5" />
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
                <div className="p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0070C0] flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#081C3A]">Nenhum edital salvo no radar</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Explore as oportunidades abertas no Radar de Editais e salve aquelas que combinam com seu produto ou serviço.
                    </p>
                  </div>
                  <Link
                    to={FORNECEDOR_ROUTES.radar}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0070C0] text-white text-xs font-bold rounded-full hover:bg-[#005ea3] transition shadow-xs"
                  >
                    Abrir Radar de Editais
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
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
                    <p className="text-sm font-bold text-[#081C3A]">Gestão de disputas</p>
                    <p className="text-xs text-slate-500">Acompanhe etapas e oportunidades salvas</p>
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
                    <p className="text-sm font-bold text-[#081C3A]">Próximos vencimentos</p>
                    <p className="text-xs text-slate-500">Alertas de prazos de proposta e impugnação</p>
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
                    <p className="text-sm font-bold text-[#081C3A]">Gerador de propostas</p>
                    <p className="text-xs text-slate-500">Monte planilhas com trava de margem</p>
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