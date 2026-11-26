import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  DollarSign,
  Search,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  RefreshCw,
  FileCheck,
  Database,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { superAdminApi } from '@services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import IntegracoesPage from '../IntegracoesPage';

interface BackendUser {
  id: string;
  nome: string | null;
  email: string;
  role: string;
  plano: string | null;
  createdAt: string;
  ultimoAcesso: string | null;
  subscriptions?: Array<{
    status: string;
    plano: string | null;
  }>;
}

interface TelemetryHealthItem {
  service: string;
  status: string;
  latencyMs?: number;
  activeRooms?: number;
  poolHealth?: string;
  activeSubscribers?: number;
}

interface TelemetryBugItem {
  id: string;
  level: string;
  service: string;
  message: string;
  timestamp: string;
}

function formatDatePt(iso?: string | null): string {
  if (!iso) return 'Sem registro';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SuperAdminPage() {
  const [busca, setBusca] = useState('');
  const [filtroPlano, setFiltroPlano] = useState('TODOS');
  const [abaAtiva, setAbaAtiva] = useState<'portais' | 'usuarios' | 'bugs'>('portais');
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const metricsQuery = useQuery({
    queryKey: ['super-admin', 'metrics'],
    queryFn: async () => {
      const res = await superAdminApi.metrics();
      return res.data?.data as {
        totalUsers: number;
        activeSubscribers: number;
        trialUsers: number;
        cancellations: number;
        mrr: number;
      };
    },
  });

  const usersQuery = useQuery({
    queryKey: ['super-admin', 'users'],
    queryFn: async () => {
      const res = await superAdminApi.users(0, 100);
      return (res.data?.data?.users || []) as BackendUser[];
    },
  });

  const telemetryQuery = useQuery({
    queryKey: ['super-admin', 'telemetry'],
    queryFn: async () => {
      const res = await superAdminApi.telemetry();
      return res.data?.data as {
        status: string;
        uptime: string;
        metrics: {
          totalUsers: number;
          activeSubscribers: number;
          fiscalAddonSubscribers: number;
          mrrTotal: number;
        };
        health: TelemetryHealthItem[];
        recentBugs: TelemetryBugItem[];
      };
    },
    refetchInterval: 30_000,
  });

  const users = usersQuery.data ?? [];
  const totalUsuarios = telemetryQuery.data?.metrics?.totalUsers ?? metricsQuery.data?.totalUsers ?? users.length;
  const assinantesAtivos = telemetryQuery.data?.metrics?.activeSubscribers ?? metricsQuery.data?.activeSubscribers ?? 0;
  const adicionaisFiscais = telemetryQuery.data?.metrics?.fiscalAddonSubscribers ?? 0;
  const mrrTotal = telemetryQuery.data?.metrics?.mrrTotal ?? metricsQuery.data?.mrr ?? 0;

  const handleSincronizarTudo = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['super-admin'] }),
      queryClient.invalidateQueries({ queryKey: ['integracoes'] }),
    ]);
    toast.success('Métricas e telemetria dos portais atualizadas.');
  };

  const handleToggleAcessoGratuito = async (user: BackendUser, currentlyGranted: boolean) => {
    setMutatingUserId(user.id);
    try {
      await superAdminApi.toggleFreeAccess(user.id, !currentlyGranted, 'MASTER');
      await queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      toast.success(
        !currentlyGranted
          ? `Acesso gratuito Master liberado para ${user.nome || user.email}.`
          : `Acesso gratuito revogado para ${user.nome || user.email}.`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao atualizar acesso gratuito.');
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleToggleExpertiseFiscal = async (user: BackendUser, currentlyActive: boolean) => {
    setMutatingUserId(user.id);
    try {
      await superAdminApi.toggleExpertiseFiscal(user.id, !currentlyActive);
      await queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      toast.success(
        !currentlyActive
          ? `Módulo Expertise Fiscal ativado para ${user.nome || user.email}.`
          : `Módulo Expertise Fiscal desativado para ${user.nome || user.email}.`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao atualizar Expertise Fiscal.');
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleChangePlano = async (user: BackendUser, novoPlano: 'BASIC' | 'MEDIUM' | 'MASTER') => {
    setMutatingUserId(user.id);
    try {
      await superAdminApi.toggleFreeAccess(user.id, true, novoPlano);
      await queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      toast.success(`Plano atualizado para ${novoPlano}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao atualizar plano.');
    } finally {
      setMutatingUserId(null);
    }
  };

  const usuariosFiltrados = users.filter((u) => {
    const nome = (u.nome || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchBusca = nome.includes(busca.toLowerCase()) || email.includes(busca.toLowerCase());
    const planoUpper = String(u.plano || 'BASIC').toUpperCase();
    const matchPlano = filtroPlano === 'TODOS' || planoUpper === filtroPlano;
    return matchBusca && matchPlano;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 font-inter">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* CABEÇALHO DO SUPER ADMIN */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-[#FF6600]">
                <ShieldAlert className="h-3.5 w-3.5" />
                Painel Restrito do Proprietário
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                Acesso Exclusivo
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#081C3A]">
              Central de Comando Super Admin
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Acompanhe todos os portais de ingestão, falhas de sincronização, acessos de clientes, planos e saúde do sistema nos bastidores.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={FORNECEDOR_ROUTES.dashboard}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar à Plataforma
            </Link>
            <button
              type="button"
              onClick={handleSincronizarTudo}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-[#081C3A] shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 text-[#0070C0]" />
              Atualizar Dados
            </button>
          </div>
        </div>

        {/* 4 CARDS DE MÉTRICAS OPERACIONAIS E MRR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuários Cadastrados</span>
              <div className="p-2.5 bg-blue-50 text-[#0070C0] rounded-2xl">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-[#081C3A]">
              {assinantesAtivos} <span className="text-xs font-semibold text-slate-400">/ {totalUsuarios} total</span>
            </p>
            <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Assinaturas ativas em produção
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Módulos Expertise Fiscal</span>
              <div className="p-2.5 bg-orange-50 text-[#FF6600] rounded-2xl">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-[#FF6600]">{adicionaisFiscais}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">R$ 99,99/mês adicionais por empresa</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturamento Recorrente (MRR)</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-emerald-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrrTotal)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">Inclui planos regulares + Expertise Fiscal</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saúde do Sistema</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-[#081C3A]">
              {telemetryQuery.data?.status === 'operational' ? 'Operacional' : 'Verificando...'}
            </p>
            <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Uptime {telemetryQuery.data?.uptime || '99.98%'}
            </p>
          </div>
        </div>

        {/* ABAS SUPER ADMIN */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setAbaAtiva('portais')}
            className={`pb-3 px-2 text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'portais'
                ? 'border-b-2 border-[#FF6600] text-[#081C3A]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Database className="h-4 w-4" />
            Portais, Integrações & Falhas de Sync
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('usuarios')}
            className={`pb-3 px-2 text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'usuarios'
                ? 'border-b-2 border-[#FF6600] text-[#081C3A]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="h-4 w-4" />
            Gestão de Usuários & Acessos
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('bugs')}
            className={`pb-3 px-2 text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'bugs'
                ? 'border-b-2 border-[#FF6600] text-[#081C3A]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Activity className="h-4 w-4" />
            Monitoramento de Serviços e Logs
          </button>
        </div>

        {/* ABA 1: PORTAIS & SINCRONIZAÇÃO (EXCLUSIVO SUPER ADMIN) */}
        {abaAtiva === 'portais' && (
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <IntegracoesPage />
          </div>
        )}

        {/* ABA 2: GESTÃO DE USUÁRIOS */}
        {abaAtiva === 'usuarios' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="relative w-full sm:w-96">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs font-bold border border-slate-200 rounded-full outline-none focus:border-[#0070C0] bg-[#F8FAFC]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-bold text-slate-500">Filtrar Plano:</label>
                <select
                  value={filtroPlano}
                  onChange={(e) => setFiltroPlano(e.target.value)}
                  className="text-xs font-bold border border-slate-200 rounded-full px-3 py-1.5 bg-[#F8FAFC] text-[#081C3A] outline-none"
                >
                  <option value="TODOS">Todos os Planos</option>
                  <option value="BASIC">Plano Basic</option>
                  <option value="MEDIUM">Plano Medium</option>
                  <option value="MASTER">Plano Master</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs font-medium text-slate-700">
                <thead className="bg-[#081C3A] text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Usuário / E-mail</th>
                    <th className="p-4">Perfil</th>
                    <th className="p-4">Plano Vigente</th>
                    <th className="p-4">Expertise Fiscal (Add-on)</th>
                    <th className="p-4">Último Acesso</th>
                    <th className="p-4 text-right">Ações Imediatas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Carregando usuários reais do banco de dados...
                      </td>
                    </tr>
                  ) : usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Nenhum usuário encontrado para o filtro informado.
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((u) => {
                      const planoUpper = String(u.plano || 'BASIC').toUpperCase();
                      const currentPlan: 'BASIC' | 'MEDIUM' | 'MASTER' =
                        planoUpper === 'MASTER' ? 'MASTER' : planoUpper === 'MEDIUM' ? 'MEDIUM' : 'BASIC';
                      const fiscalAtivo = Boolean(
                        u.subscriptions?.some((s) => s.status === 'active' && s.plano === 'expertise_fiscal_addon'),
                      );
                      const acessoAtivo = Boolean(
                        u.subscriptions?.some((s) => s.status === 'active' && s.plano !== 'expertise_fiscal_addon'),
                      );
                      const busy = mutatingUserId === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition">
                          <td className="p-4">
                            <p className="font-extrabold text-[#081C3A] text-sm">{u.nome || 'Sem nome'}</p>
                            <p className="text-slate-400 text-[11px]">{u.email}</p>
                          </td>

                          <td className="p-4">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                              {u.role}
                            </span>
                          </td>

                          <td className="p-4">
                            <select
                              disabled={busy}
                              value={currentPlan}
                              onChange={(e) =>
                                handleChangePlano(u, e.target.value as 'BASIC' | 'MEDIUM' | 'MASTER')
                              }
                              className={`rounded-full px-3 py-1 text-[11px] font-extrabold border outline-none ${
                                currentPlan === 'MASTER'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : currentPlan === 'MEDIUM'
                                    ? 'bg-blue-50 text-[#0070C0] border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="BASIC">Plano Básico</option>
                              <option value="MEDIUM">Plano Intermediário</option>
                              <option value="MASTER">Plano Master Completo</option>
                            </select>
                          </td>

                          <td className="p-4">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleToggleExpertiseFiscal(u, fiscalAtivo)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border transition cursor-pointer ${
                                fiscalAtivo
                                  ? 'bg-orange-50 border-orange-300 text-[#FF6600]'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <FileCheck className="h-3.5 w-3.5" />
                              {fiscalAtivo ? 'Ativo (+ R$ 99,99)' : 'Inativo (Ativar)'}
                            </button>
                          </td>

                          <td className="p-4 text-slate-500 font-medium">
                            {formatDatePt(u.ultimoAcesso || u.createdAt)}
                          </td>

                          <td className="p-4 text-right">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleToggleAcessoGratuito(u, acessoAtivo)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                                acessoAtivo
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {acessoAtivo ? (
                                <>
                                  <XCircle className="h-3.5 w-3.5" />
                                  Revogar Cortesia
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3.5 w-3.5" />
                                  Liberar Acesso Master
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 3: MONITORAMENTO DE SERVIÇOS E LOGS */}
        {abaAtiva === 'bugs' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(telemetryQuery.data?.health || []).map((item) => (
                <div key={item.service} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.service}</p>
                  <p className="text-lg font-black text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    {item.status === 'online' ? 'Operacional' : item.status}
                    {typeof item.latencyMs === 'number' ? ` (${item.latencyMs}ms)` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {typeof item.activeRooms === 'number'
                      ? `${item.activeRooms} salas ativas`
                      : item.poolHealth
                        ? `Pool: ${item.poolHealth}`
                        : typeof item.activeSubscribers === 'number'
                          ? `${item.activeSubscribers} assinantes ativos`
                          : 'Monitoramento contínuo'}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-[#081C3A] flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#0070C0]" />
                Histórico de Eventos do Servidor
              </h3>

              <div className="space-y-3">
                {(telemetryQuery.data?.recentBugs || []).map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-[#081C3A]">{log.service}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{log.message}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatDatePt(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
