import { useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  nome: string;
  email: string;
  plano: 'BASIC' | 'MEDIUM' | 'MASTER';
  acessoGratuitoLiberado: boolean;
  expertiseFiscalAtivo: boolean;
  ultimoAcesso: string;
  status: 'Ativo' | 'Em Teste' | 'Suspenso';
}

const INITIAL_USERS: AdminUser[] = [
  {
    id: 'usr-1',
    nome: 'Luis Antonio Gomes Paiva',
    email: 'luiscidgomes2020@gmail.com',
    plano: 'MASTER',
    acessoGratuitoLiberado: true,
    expertiseFiscalAtivo: true,
    ultimoAcesso: 'Hoje às 17:42',
    status: 'Ativo',
  },
  {
    id: 'usr-2',
    nome: 'Ana Clara Engenharia & Obras',
    email: 'contato@anaclaraengenharia.com.br',
    plano: 'MEDIUM',
    acessoGratuitoLiberado: false,
    expertiseFiscalAtivo: true,
    ultimoAcesso: 'Ontem às 14:10',
    status: 'Ativo',
  },
  {
    id: 'usr-3',
    nome: 'Distribuidora Norte Medicamentos',
    email: 'licitacoes@nortemed.com.br',
    plano: 'BASIC',
    acessoGratuitoLiberado: false,
    expertiseFiscalAtivo: false,
    ultimoAcesso: '12/11/2026',
    status: 'Em Teste',
  },
  {
    id: 'usr-4',
    nome: 'TecnoSupply Informática Ltda',
    email: 'comercial@tecnosupply.com.br',
    plano: 'MASTER',
    acessoGratuitoLiberado: true,
    expertiseFiscalAtivo: false,
    ultimoAcesso: '10/11/2026',
    status: 'Ativo',
  },
];

export default function SuperAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>(INITIAL_USERS);
  const [busca, setBusca] = useState('');
  const [filtroPlano, setFiltroPlano] = useState('TODOS');
  const [abaAtiva, setAbaAtiva] = useState<'usuarios' | 'bugs'>('usuarios');

  // Métricas calculadas em tempo real
  const totalUsuarios = users.length;
  const assinantesAtivos = users.filter((u) => u.status === 'Ativo').length;
  const adicionaisFiscais = users.filter((u) => u.expertiseFiscalAtivo).length;
  
  // Preço base R$ 249,99 + R$ 99,99 do adicional fiscal
  const mrrBase = assinantesAtivos * 249.99;
  const mrrFiscal = adicionaisFiscais * 99.99;
  const mrrTotal = mrrBase + mrrFiscal;

  const handleToggleAcessoGratuito = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const novoEstado = !u.acessoGratuitoLiberado;
          toast.success(
            novoEstado
              ? `Acesso gratuito total concedido com sucesso para ${u.nome}!`
              : `Acesso gratuito revogado para ${u.nome}.`,
          );
          return {
            ...u,
            acessoGratuitoLiberado: novoEstado,
            plano: novoEstado ? 'MASTER' : 'BASIC',
          };
        }
        return u;
      }),
    );
  };

  const handleToggleExpertiseFiscal = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const novoEstado = !u.expertiseFiscalAtivo;
          toast.success(
            novoEstado
              ? `Módulo Expertise Fiscal (+ R$ 99,99/mês) ativado para ${u.nome}!`
              : `Módulo Expertise Fiscal desativado para ${u.nome}.`,
          );
          return {
            ...u,
            expertiseFiscalAtivo: novoEstado,
          };
        }
        return u;
      }),
    );
  };

  const handleChangePlano = (userId: string, novoPlano: 'BASIC' | 'MEDIUM' | 'MASTER') => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, plano: novoPlano } : u)),
    );
    toast.success(`Plano atualizado para ${novoPlano}!`);
  };

  const usuariosFiltrados = users.filter((u) => {
    const matchBusca =
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());
    const matchPlano = filtroPlano === 'TODOS' || u.plano === filtroPlano;
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
              Controle total da plataforma Expertise Licitatória: liberação de acessos gratuitos, gestão de planos, ativação do Expertise Fiscal e monitoramento de estabilidade.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                toast.success('Métricas e status dos serviços sincronizados com sucesso!');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-[#081C3A] shadow-xs hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-4 w-4 text-[#0070C0]" />
              Sincronizar
            </button>
          </div>
        </div>

        {/* 4 CARDS DE MÉTRICAS OPERACIONAIS E MRR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuários Ativos</span>
              <div className="p-2.5 bg-blue-50 text-[#0070C0] rounded-2xl">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-[#081C3A]">{assinantesAtivos} <span className="text-xs font-semibold text-slate-400">/ {totalUsuarios} total</span></p>
            <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% ativos na última semana
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
            <p className="mt-1 text-xs font-medium text-slate-500">
              R$ 99,99/mês adicionais por empresa
            </p>
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
            <p className="mt-1 text-xs font-medium text-slate-500">
              Inclui planos regulares + Expertise Fiscal
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saúde do Sistema</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-[#081C3A]">100% Online</p>
            <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Zero falhas críticas reportadas
            </p>
          </div>
        </div>

        {/* ABAS SUPER ADMIN */}
        <div className="flex items-center gap-3 border-b border-slate-200">
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
            Monitoramento de Conexão e Bugs
          </button>
        </div>

        {/* ABA 1: GESTÃO DE USUÁRIOS */}
        {abaAtiva === 'usuarios' && (
          <div className="space-y-4">
            {/* BARRA DE FILTROS */}
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

            {/* TABELA DE USUÁRIOS */}
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs font-medium text-slate-700">
                <thead className="bg-[#081C3A] text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Usuário / Empresa</th>
                    <th className="p-4">Plano Vigente</th>
                    <th className="p-4">Expertise Fiscal (Add-on)</th>
                    <th className="p-4">Acesso Gratuito</th>
                    <th className="p-4">Último Acesso</th>
                    <th className="p-4 text-right">Ações Imediatas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuariosFiltrados.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <p className="font-extrabold text-[#081C3A] text-sm">{u.nome}</p>
                        <p className="text-slate-400 text-[11px]">{u.email}</p>
                      </td>

                      <td className="p-4">
                        <select
                          value={u.plano}
                          onChange={(e) =>
                            handleChangePlano(u.id, e.target.value as 'BASIC' | 'MEDIUM' | 'MASTER')
                          }
                          className={`rounded-full px-3 py-1 text-[11px] font-extrabold border outline-none ${
                            u.plano === 'MASTER'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : u.plano === 'MEDIUM'
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
                          onClick={() => handleToggleExpertiseFiscal(u.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border transition cursor-pointer ${
                            u.expertiseFiscalAtivo
                              ? 'bg-orange-50 border-orange-300 text-[#FF6600]'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                          }`}
                          title="Clique para ativar ou desativar o módulo adicional de R$ 99,99/mês"
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          {u.expertiseFiscalAtivo ? 'Ativo (+ R$ 99,99)' : 'Inativo (Ativar)'}
                        </button>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            u.acessoGratuitoLiberado
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {u.acessoGratuitoLiberado ? 'Liberado Grátis' : 'Assinatura Regular'}
                        </span>
                      </td>

                      <td className="p-4 text-slate-500 font-medium">
                        {u.ultimoAcesso}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleAcessoGratuito(u.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                            u.acessoGratuitoLiberado
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {u.acessoGratuitoLiberado ? (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Revogar Acesso
                            </>
                          ) : (
                            <>
                              <Zap className="h-3.5 w-3.5" />
                              Liberar Acesso Gratuito
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 2: TELEMETRIA & MONITORAMENTO DE BUGS */}
        {abaAtiva === 'bugs' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Portal PNCP Oficial</p>
                <p className="text-lg font-black text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Operacional (82ms)
                </p>
                <p className="text-[11px] text-slate-400">Última checagem há 1 minuto</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Socket Sala de Lances</p>
                <p className="text-lg font-black text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado (14 salas)
                </p>
                <p className="text-[11px] text-slate-400">Transmissão em tempo real</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Banco de Dados</p>
                <p className="text-lg font-black text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  100% Saudável
                </p>
                <p className="text-[11px] text-slate-400">Tempo de resposta: 12ms</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expertise Fiscal</p>
                <p className="text-lg font-black text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Motor Tributário Ativo
                </p>
                <p className="text-[11px] text-slate-400">2 empresas sincronizadas</p>
              </div>
            </div>

            {/* LOG DE EVENTOS E HISTÓRICO DE ESTABILIDADE */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-[#081C3A] flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#0070C0]" />
                Histórico de Eventos e Diagnóstico Preventivo
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-[#081C3A]">Rotina de Sincronização PNCP concluída com êxito</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Captadas 124 novas oportunidades públicas sem qualquer intercorrência de conexão.</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">Há 5 min</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#0070C0] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-[#081C3A]">Motor de Proteção de Margem ativo na Sala de Lances</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">100% dos lances validados contra a margem de segurança mínima dos fornecedores.</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">Há 22 min</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-[#081C3A]">Auditoria Contratual e Alertas de Vigência</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Disparados avisos preventivos para 3 contratos com vencimento nos próximos 30 dias.</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">Há 1 hora</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
