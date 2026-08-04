import { FORNECEDOR_ROUTES } from '@/routes';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@services/api';
import { Loader2 } from '@components/icons/phosphor-compat';
import { useAuthStore } from '@/store/auth.store';
import { getUserDisplayName } from '@/utils';

export default function DashboardPage() {
  const { data: metricsResponse, isLoading } = useQuery({
    queryKey: ['dashboard_metrics'],
    queryFn: async () => {
      const res = await dashboardApi.getMetrics();
      return res.data;
    },
  });

  const metrics = metricsResponse?.data || {
    editaisMonitorados: 0,
    analisesNulidade: 0,
    propostasCriadas: 0,
    prazosEstaSemana: 0,
    recomendacoes: [],
    prazosCriticos: [],
  };

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date()).replace('.', '');

  const user = useAuthStore(state => state.user);
  const displayName = getUserDisplayName(user, 'Estrategista');
  const horaAtual = new Date().getHours();
  const saudacao = horaAtual < 12 ? 'Bom dia' : horaAtual < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      <header className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 border-l-4 border-[#EA580C] pl-3">
          <h1 className="text-2xl font-black tracking-tighter text-[#0A2540] uppercase">
            {saudacao}, <span className="text-[#EA580C]">{displayName.split(' ')[0]}</span>.
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600">
            {dateLabel}
          </span>
        </div>
      </header>

      {/* Alerta */}
      <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-100 flex items-center gap-3 text-red-700">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <span className="text-sm font-semibold">Prazo de impugnação: Pregão 042/2024 — hoje</span>
      </div>

      <div className="mb-6 rounded-lg bg-blue-50/50 p-4 border border-blue-100 flex items-center gap-3 text-brand-blue">
        <span className="text-xl leading-none">*</span>
        <span className="text-sm font-medium">3 novos editais no radar correspondem ao seu perfil</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow group">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 group-hover:text-[#0A2540] transition-colors">Editais Monitorados</p>
          <div className="text-3xl font-black text-[#0A2540] mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.editaisMonitorados}
          </div>
          <p className="text-xs text-slate-400">Total monitorado</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow group">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 group-hover:text-[#EA580C] transition-colors">Análises do Especialista</p>
          <div className="text-3xl font-black text-[#EA580C] mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.analisesNulidade}
          </div>
          <p className="text-xs text-slate-400">Realizadas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow group">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 group-hover:text-emerald-600 transition-colors">Propostas Criadas</p>
          <div className="text-3xl font-black text-emerald-600 mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.propostasCriadas}
          </div>
          <p className="text-xs text-slate-400">Registradas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow group">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 group-hover:text-[#EA580C] transition-colors">Prazos Esta Semana</p>
          <div className="text-3xl font-black text-[#EA580C] mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.prazosEstaSemana}
          </div>
          <p className="text-xs text-slate-400">Próximos 7 dias</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Prazos críticos */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-slate-900">Prazos críticos</h2>
              <Link to={FORNECEDOR_ROUTES.prazos_alertas} className="text-sm text-brand-blue font-bold hover:underline">Ver todos &rarr;</Link>
            </div>

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Evento</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Carregando prazos...
                    </td>
                  </tr>
                ) : metrics.prazosCriticos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">Nenhum prazo crítico para esta semana.</td>
                  </tr>
                ) : (
                  metrics.prazosCriticos.map((prazo: any) => (
                    <tr key={prazo.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                      <td className="py-4 font-bold text-slate-700 flex items-center gap-2 group-hover:text-[#0A2540]">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 group-hover:scale-110 transition-transform"></div>
                        {prazo.evento} {prazo.edital ? `— ${prazo.edital}` : ''}
                      </td>
                      <td className="py-4 font-semibold text-slate-600 group-hover:text-[#0A2540]">
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(prazo.data))}
                      </td>
                      <td className="py-4">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1 rounded group-hover:bg-[#0A2540] group-hover:text-white transition-colors">
                          {prazo.tipo.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Oportunidades */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-slate-900">Oportunidades recentes</h2>
              <Link to={FORNECEDOR_ROUTES.radar} className="text-sm text-brand-blue font-bold hover:underline">Radar completo &rarr;</Link>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="py-8 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Carregando oportunidades...
                </div>
              ) : metrics.recomendacoes.length === 0 ? (
                <div className="py-8 text-center text-slate-500">Nenhuma oportunidade recomendada no momento.</div>
              ) : (
                metrics.recomendacoes.map((rec: any, index: number) => (
                  <div key={rec.id} className={`flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-default ${index < metrics.recomendacoes.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <div>
                      <p className="text-xs text-slate-400 group-hover:text-slate-500 transition-colors">{rec.orgao} — {rec.uf}</p>
                      <p className="font-bold text-[#0A2540] line-clamp-1 group-hover:text-[#EA580C] transition-colors" title={rec.objeto}>{rec.objeto}</p>
                      <p className="text-emerald-600 font-semibold text-sm group-hover:text-emerald-700 transition-colors">
                        {rec.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rec.valor) : 'Valor não informado'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Uso do plano */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-black text-slate-900">Uso do plano</h2>
              <span className="bg-[#EA580C]/10 text-[#EA580C] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">PRO</span>
            </div>

            <div className="space-y-6">
              <div className="group">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-bold text-slate-700 group-hover:text-[#0A2540] transition-colors">Editais monitorados</span>
                  <span className="text-slate-500 font-medium">7/50</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0A2540] w-[14%] rounded-full group-hover:bg-[#EA580C] transition-colors"></div>
                </div>
              </div>

              <div className="group">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-bold text-slate-700 group-hover:text-[#0A2540] transition-colors">Análises do Especialista</span>
                  <span className="text-slate-500 font-medium">12/30</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#EA580C] w-[40%] rounded-full group-hover:bg-orange-500 transition-colors"></div>
                </div>
              </div>

              <div className="group">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-bold text-slate-700 group-hover:text-[#0A2540] transition-colors">Propostas</span>
                  <span className="text-slate-500 font-medium">8/30</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[26%] rounded-full group-hover:bg-emerald-400 transition-colors"></div>
                </div>
              </div>
            </div>
            <button className="w-full mt-8 py-3 bg-[#0A2540] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-colors active:scale-95">
              Upgrade de plano
            </button>
          </div>

          {/* Documentos */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-black text-slate-900">Documentos</h2>
              <Link to={FORNECEDOR_ROUTES.documentos} className="text-[10px] font-bold text-slate-400 hover:text-[#0A2540] transition-colors">Ver &rarr;</Link>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-default">
                <p className="font-bold text-sm text-slate-700 group-hover:text-[#0A2540] transition-colors">CND Federal</p>
                <p className="text-xs text-slate-400 group-hover:text-[#EA580C] transition-colors">15/08/2025</p>
              </div>
              <div className="p-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-default">
                <p className="font-bold text-sm text-slate-700 group-hover:text-[#0A2540] transition-colors">FGTS</p>
                <p className="text-xs text-slate-400 group-hover:text-[#EA580C] transition-colors">02/09/2025</p>
              </div>
              <div className="p-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-default">
                <p className="font-bold text-sm text-slate-700 group-hover:text-[#0A2540] transition-colors">Balanço Patrimonial</p>
                <p className="text-xs text-slate-400 group-hover:text-[#EA580C] transition-colors">31/12/2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
