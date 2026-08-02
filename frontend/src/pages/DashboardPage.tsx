import { FORNECEDOR_ROUTES } from '@/routes';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@services/api';
import { Loader2 } from '@components/icons/phosphor-compat';

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

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      <header className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 border-l-4 border-brand-orange pl-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Página Inicial
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
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Editais Monitorados</p>
          <div className="text-3xl font-black text-brand-blue mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.editaisMonitorados}
          </div>
          <p className="text-xs text-slate-400">Total monitorado</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Análises de Nulidade</p>
          <div className="text-3xl font-black text-brand-orange mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.analisesNulidade}
          </div>
          <p className="text-xs text-slate-400">Realizadas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Propostas Criadas</p>
          <div className="text-3xl font-black text-emerald-600 mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.propostasCriadas}
          </div>
          <p className="text-xs text-slate-400">Registradas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Prazos Esta Semana</p>
          <div className="text-3xl font-black text-brand-orange mb-1">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : metrics.prazosEstaSemana}
          </div>
          <p className="text-xs text-slate-400">próximos 7 dias</p>
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
                    <tr key={prazo.id}>
                      <td className="py-4 font-bold text-slate-700 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {prazo.evento} {prazo.edital ? `— ${prazo.edital}` : ''}
                      </td>
                      <td className="py-4 font-semibold text-slate-600">
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(prazo.data))}
                      </td>
                      <td className="py-4">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1 rounded">
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
                  <div key={rec.id} className={`flex justify-between items-center ${index < metrics.recomendacoes.length - 1 ? 'border-b border-slate-100 pb-4' : ''}`}>
                    <div>
                      <p className="text-xs text-slate-400">{rec.orgao} — {rec.uf}</p>
                      <p className="font-bold text-brand-blue line-clamp-1" title={rec.objeto}>{rec.objeto}</p>
                      <p className="text-emerald-600 font-semibold text-sm">
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
              <span className="bg-slate-100 text-[10px] font-bold px-2 py-0.5 rounded text-slate-600">PRO</span>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-slate-700">Editais monitorados</span>
                  <span className="text-slate-500">7/50</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-blue w-[14%] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-slate-700">Análises de nulidade</span>
                  <span className="text-slate-500">12/30</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-orange w-[40%] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-slate-700">Propostas</span>
                  <span className="text-slate-500">8/30</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[26%] rounded-full"></div>
                </div>
              </div>
            </div>
            <button className="w-full mt-6 py-2 bg-brand-blue text-white rounded-lg text-sm font-bold shadow-md hover:bg-brand-blue/90 transition-colors">
              Upgrade de plano
            </button>
          </div>

          {/* Documentos */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-black text-slate-900">Documentos</h2>
              <Link to={FORNECEDOR_ROUTES.documentos} className="text-[10px] font-bold text-slate-400 hover:text-brand-blue">Ver &rarr;</Link>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-bold text-sm text-slate-700">CND Federal</p>
                <p className="text-xs text-slate-400">15/08/2025</p>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-700">FGTS</p>
                <p className="text-xs text-slate-400">02/09/2025</p>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-700">Balanço Patrimonial</p>
                <p className="text-xs text-slate-400">31/12/2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
