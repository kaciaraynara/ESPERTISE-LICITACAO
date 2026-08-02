import { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Database,
  Globe,
  Clock,
  Building2,
  Activity,
  CheckCircle,
  AlertTriangle,
  Info,
} from '../icons/phosphor-compat';
import {
  useTransparenciaEmpresa,
  useTransparenciaPenalidades,
  useTransparenciaCepim,
  useTransparenciaCnep,
  useTransparenciaHealth,
  useCleanTransparenciaCache,
} from '../../hooks/useTransparencia';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ConsultaTipo = 'empresa' | 'penalidades' | 'cepim' | 'cnep';

const CONSULTA_OPTIONS: Array<{ key: ConsultaTipo; label: string; desc: string }> = [
  { key: 'empresa', label: 'Dados da Empresa', desc: 'Fornecedor no Portal da Transparência' },
  { key: 'penalidades', label: 'Penalidades (CEIS)', desc: 'Cadastro de Empresas Inidôneas' },
  { key: 'cepim', label: 'CEPIM', desc: 'Entidades Privadas Impedidas' },
  { key: 'cnep', label: 'CNEP', desc: 'Cadastro de Empresas Punidas' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

function ResultSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="grid grid-cols-2 gap-4 pt-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

// ─── Cache Indicator ──────────────────────────────────────────────────────────

function CacheIndicator({ meta }: { meta?: { source: string; cached: boolean; responseTimeMs: number; cachedAt?: string } }) {
  if (!meta) return null;

  const icon = meta.source === 'memory' ? (
    <Activity className="h-3.5 w-3.5" />
  ) : meta.source === 'database' ? (
    <Database className="h-3.5 w-3.5" />
  ) : (
    <Globe className="h-3.5 w-3.5" />
  );

  const label = meta.source === 'memory' ? 'Cache memória' :
    meta.source === 'database' ? 'Cache banco' : 'API ao vivo';

  const bgClass = meta.cached
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${bgClass}`}>
      {icon}
      {label}
      <span className="text-[10px] opacity-70">({meta.responseTimeMs}ms)</span>
    </div>
  );
}

// ─── Formatador CNPJ ──────────────────────────────────────────────────────────

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function TransparenciaPanel() {
  const [cnpj, setCnpj] = useState('');
  const [consultaTipo, setConsultaTipo] = useState<ConsultaTipo>('empresa');
  const [submitted, setSubmitted] = useState(false);
  const cnpjLimpo = useMemo(() => cnpj.replace(/\D/g, ''), [cnpj]);
  const isValid = cnpjLimpo.length === 14;

  // Queries (só ativam quando submitted & cnpj válido)
  const empresaQuery = useTransparenciaEmpresa(cnpjLimpo, submitted && consultaTipo === 'empresa');
  const penalidadesQuery = useTransparenciaPenalidades(cnpjLimpo, submitted && consultaTipo === 'penalidades');
  const cepimQuery = useTransparenciaCepim(cnpjLimpo, submitted && consultaTipo === 'cepim');
  const cnepQuery = useTransparenciaCnep(cnpjLimpo, submitted && consultaTipo === 'cnep');

  const healthQuery = useTransparenciaHealth(true);
  const cleanCacheMutation = useCleanTransparenciaCache();

  const activeQuery = consultaTipo === 'empresa' ? empresaQuery :
    consultaTipo === 'penalidades' ? penalidadesQuery :
      consultaTipo === 'cepim' ? cepimQuery : cnepQuery;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setCnpj('');
  };

  return (
    <div className="min-h-full bg-white text-brand-blue">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6 lg:px-8">

        {/* Header */}
        <header className="flex flex-col gap-5 border-b border-gray-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-blue/70">Portal da Transparência</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Consulta Integrada</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-blue/70">
              Verifique fornecedores, penalidades, impedimentos e punições diretamente da base federal.
            </p>
          </div>

          {/* Status Card */}
          {healthQuery.data && (
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-gray-100 bg-white text-center shadow-sm">
              <div className="px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">Token</p>
                <p className="mt-1 text-sm font-bold text-brand-blue">
                  {healthQuery.data.token.isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="h-3.5 w-3.5" /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3.5 w-3.5" /> Inativo
                    </span>
                  )}
                </p>
              </div>
              <div className="border-l border-gray-100 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">Janela</p>
                <p className="mt-1 text-sm font-bold text-brand-blue">
                  {healthQuery.data.token.currentWindow === 'diurno' ? '☀️ Diurno' : '🌙 Noturno'}
                </p>
              </div>
              <div className="border-l border-gray-100 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">Restantes</p>
                <p className="mt-1 text-sm font-bold text-brand-blue">
                  {healthQuery.data.token.remainingThisMinute}/{healthQuery.data.token.limitPerMinute}
                </p>
              </div>
            </div>
          )}
        </header>

        {/* Formulário de consulta */}
        <section className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand-blue">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-blue">Consulta de Fornecedor</p>
                <p className="text-xs text-brand-blue/70">Fonte: Portal da Transparência — Gov Federal</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => cleanCacheMutation.mutate()}
              disabled={cleanCacheMutation.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-100 px-3 text-sm font-bold text-brand-blue/70 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${cleanCacheMutation.isPending ? 'animate-spin' : ''}`} />
              Limpar Cache
            </button>
          </div>

          {/* Tipo de consulta */}
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-5 py-3">
            {CONSULTA_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setConsultaTipo(opt.key); setSubmitted(false); }}
                className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition ${consultaTipo === opt.key
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-gray-100 bg-white text-brand-blue/70 hover:bg-gray-50'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* CNPJ Input */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-brand-blue/70">
                CNPJ do Fornecedor
              </label>
              <div className="flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 transition focus-within:border-brand-blue focus-within:shadow-[0_0_0_3px_rgba(30,58,138,0.12)]">
                <Search className="h-4 w-4 text-brand-blue/50" />
                <input
                  id="transparencia-cnpj-input"
                  value={cnpj}
                  onChange={(e) => { setCnpj(formatCnpj(e.target.value)); setSubmitted(false); }}
                  placeholder="00.000.000/0000-00"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-brand-blue/40"
                  maxLength={18}
                />
              </div>
            </div>

            <button
              id="transparencia-consultar-btn"
              type="submit"
              disabled={!isValid || activeQuery.isFetching}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#172554] disabled:opacity-50"
            >
              {activeQuery.isFetching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Consultar
            </button>

            {submitted && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-100 px-4 text-sm font-bold text-brand-blue/70 transition hover:bg-gray-50"
              >
                Nova consulta
              </button>
            )}
          </form>
        </section>

        {/* Resultado */}
        {submitted && (
          <section className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-blue">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-brand-blue">
                    {CONSULTA_OPTIONS.find(o => o.key === consultaTipo)?.label}
                  </p>
                  <p className="text-xs text-brand-blue/70">CNPJ: {formatCnpj(cnpjLimpo)}</p>
                </div>
              </div>

              {activeQuery.data && (
                <CacheIndicator meta={(activeQuery.data as any)?.meta} />
              )}
            </div>

            {/* Loading */}
            {activeQuery.isFetching && <ResultSkeleton />}

            {/* Error */}
            {activeQuery.isError && !activeQuery.isFetching && (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-brand-blue">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-brand-blue">Consulta temporariamente indisponível</p>
                  <p className="text-xs text-brand-blue/70">
                    O Portal da Transparência pode estar instável. Dados em cache serão retornados quando disponíveis.
                  </p>
                </div>
              </div>
            )}

            {/* Success - Raw Data Display */}
            {activeQuery.data && !activeQuery.isFetching && (
              <div className="p-5">
                {(activeQuery.data as any)?.success === false ? (
                  <div className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <Info className="h-5 w-5 text-brand-blue" />
                    <p className="text-sm text-[#334155]">
                      Nenhum registro encontrado para este CNPJ nesta consulta.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Indicador de cache */}
                    {(activeQuery.data as any)?.meta?.cached && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-bold">Dados em cache</span>
                        <span className="opacity-70">
                          — atualizados em {new Date((activeQuery.data as any).meta.cachedAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}

                    {/* Dados */}
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                      <table className="w-full border-separate border-spacing-0 text-left">
                        <thead>
                          <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">
                            <th className="px-5 py-3">Campo</th>
                            <th className="px-5 py-3">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderDataRows((activeQuery.data as any)?.data)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Métricas */}
        {healthQuery.data && (
          <section className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <p className="text-sm font-bold text-brand-blue">Métricas do sistema</p>
              <p className="text-xs text-brand-blue/70">Últimos 60 minutos</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4 lg:grid-cols-6">
              <MetricCard label="Total chamadas" value={String(healthQuery.data.metrics.totalCalls)} />
              <MetricCard label="Sucesso" value={String(healthQuery.data.metrics.successCalls)} color="emerald" />
              <MetricCard label="Cache hits" value={String(healthQuery.data.metrics.cacheHits)} color="blue" />
              <MetricCard label="Erros" value={String(healthQuery.data.metrics.errorCalls)} color="red" />
              <MetricCard label="Tempo médio" value={`${healthQuery.data.metrics.avgResponseMs}ms`} />
              <MetricCard label="Cache hit rate" value={healthQuery.data.cache.hitRate} color="emerald" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color?: 'emerald' | 'blue' | 'red' }) {
  const colorClass = color === 'emerald' ? 'text-emerald-600' :
    color === 'blue' ? 'text-blue-600' :
      color === 'red' ? 'text-red-500' : 'text-brand-blue';

  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">{label}</p>
      <p className={`mt-1 text-xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ─── Renderiza dados genéricos em tabela ──────────────────────────────────────

function renderDataRows(data: unknown, prefix = ''): JSX.Element[] {
  if (!data || typeof data !== 'object') {
    return [
      <tr key="empty">
        <td className="border-b border-gray-100 px-5 py-3 text-sm text-brand-blue/70" colSpan={2}>
          Nenhum dado disponível
        </td>
      </tr>
    ];
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return [
        <tr key="empty-arr">
          <td className="border-b border-gray-100 px-5 py-3 text-sm text-brand-blue/70" colSpan={2}>
            Nenhum registro encontrado
          </td>
        </tr>
      ];
    }

    return data.flatMap((item, i) => renderDataRows(item, `${prefix}[${i}].`));
  }

  return Object.entries(data as Record<string, unknown>)
    .filter(([key]) => !['id', 'links', '_links'].includes(key))
    .map(([key, val]) => {
      const displayKey = `${prefix}${key}`;
      const displayVal = val === null ? '—' :
        typeof val === 'boolean' ? (val ? 'Sim' : 'Não') :
          typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);

      return (
        <tr key={displayKey} className="bg-white hover:bg-gray-50">
          <td className="border-b border-gray-100 px-5 py-3 text-xs font-bold text-brand-blue/70 whitespace-nowrap">{displayKey}</td>
          <td className="border-b border-gray-100 px-5 py-3 text-sm text-brand-blue break-all">{displayVal}</td>
        </tr>
      );
    });
}
