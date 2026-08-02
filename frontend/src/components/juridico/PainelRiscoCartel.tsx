import { AlertTriangle, ArrowRight, ShieldAlert } from '@components/icons/phosphor-compat';
import type { MalhaFinaLicitacao } from '@/types';

interface PainelRiscoCartelProps {
  dados: MalhaFinaLicitacao | null;
  onElaborarRecurso?: () => void;
  loading?: boolean;
}

export default function PainelRiscoCartel({ dados, onElaborarRecurso, loading }: PainelRiscoCartelProps) {
  if (!dados) return null;

  const riscoStyles = {
    ALTO: {
      root: 'border-red-200 bg-red-50/50',
      badge: 'border-red-200 bg-white text-red-600',
      text: 'text-red-600',
    },
    MEDIO: {
      root: 'border-brand-orange/30 bg-orange-50/50',
      badge: 'border-brand-orange/30 bg-white text-brand-orange',
      text: 'text-brand-orange',
    },
    BAIXO: {
      root: 'border-slate-200 bg-slate-50',
      badge: 'border-slate-200 bg-white text-slate-500',
      text: 'text-slate-500',
    },
  } satisfies Record<MalhaFinaLicitacao['risco'], { root: string; badge: string; text: string }>;

  const styles = riscoStyles[dados.risco];
  const isAlto = dados.risco === 'ALTO';
  const vinculos = dados.vinculosSocietarios.slice(0, 3);

  return (
    <section className={`rounded-2xl border-2 p-6 lg:p-8 ${styles.root}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-xs font-black uppercase tracking-widest ${styles.badge}`}>
              {isAlto ? <ShieldAlert className="h-4 w-4" weight="bold" /> : <AlertTriangle className="h-4 w-4" weight="bold" />}
              Risco {dados.risco}
            </span>
            <span className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
              {dados.resumo.totalConcorrentes} Concorrentes
            </span>
          </div>

          <h2 className={`mt-6 text-2xl font-black tracking-tight ${styles.text}`}>
            Malha Societária do Certame
          </h2>
          <p className="mt-3 max-w-3xl text-base font-medium leading-relaxed text-slate-600">
            {isAlto
              ? 'Foram encontrados vínculos societários comuns entre empresas concorrentes. O conjunto está pronto para instruir peça recursal com prova documental.'
              : 'A malha foi processada e não há alerta crítico de vínculo societário comum no conjunto analisado.'}
          </p>
        </div>

        {isAlto && onElaborarRecurso ? (
          <button
            type="button"
            onClick={onElaborarRecurso}
            disabled={loading}
            className="inline-flex h-14 w-full lg:w-auto shrink-0 items-center justify-center gap-3 rounded-xl bg-brand-orange hover:bg-orange-500 px-8 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Elaborar Recurso com Provas
            <ArrowRight className="h-5 w-5" weight="bold" />
          </button>
        ) : null}
      </div>

      {vinculos.length > 0 ? (
        <div className="mt-8 overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="divide-y-2 divide-slate-100">
            {vinculos.map((vinculo) => (
              <div key={`${vinculo.socio.nome}-${vinculo.totalEmpresas}`} className="px-6 py-5">
                <p className="text-base font-black text-slate-900">
                  {vinculo.socio.nome}
                  {vinculo.socio.documentoMascarado ? (
                    <span className="ml-3 text-sm font-bold text-slate-400">
                      {vinculo.socio.documentoMascarado}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                  {vinculo.empresas.map((empresa) => `${empresa.razaoSocial} (${empresa.cnpj})`).join(' • ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
