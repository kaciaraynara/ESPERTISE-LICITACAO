import { Link } from 'react-router-dom';
import {
  resolveModuleRoute,
  resolveStatusClass,
  resolveStatusLabel,
  useSystemModules,
} from '../hooks/useSystemModules';

export default function ModuleStatusPage({ moduleKey }: { moduleKey: string }) {
  const modulesQuery = useSystemModules();
  const module = modulesQuery.data?.find((item) => item.key === moduleKey);

  const name = module?.name || 'Funcionalidade';
  const description =
    module?.description ||
    'Esta área está sendo estruturada para operar com dados reais, sem simulações.';
  const status = module?.status || 'IN_IMPLANTATION';
  const statusLabel = module?.statusLabel || resolveStatusLabel(status);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      <header className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 border-l-4 border-brand-orange pl-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {name}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${resolveStatusClass(status)}`}>
            {statusLabel}
          </span>
        </div>
      </header>

      <section className="mt-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="max-w-3xl text-sm leading-7 text-slate-600">{description}</p>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-brand-blue">
              Status da entrega
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              Esta tela já está registrada no menu e no banco de dados. A próxima etapa é conectar
              a funcionalidade aos fluxos reais da plataforma, mantendo rastreabilidade e evitando
              qualquer dado fictício.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/fornecedor/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-brand-blue px-5 py-3 text-sm font-black text-white hover:bg-brand-blue/90 transition-colors"
            >
              Voltar para Página Inicial
            </Link>

            {module && resolveModuleRoute(module) !== '/fornecedor/dashboard' && (
              <Link
                to="/fornecedor/radar"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-brand-blue hover:bg-slate-50 transition-colors"
              >
                Ir para Radar de Editais
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
