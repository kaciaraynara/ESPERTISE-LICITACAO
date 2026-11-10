import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  User as UserIcon,
} from 'lucide-react';
import {
  fetchAdminRadarTelemetry,
  type AuditLogTelemetryItem,
} from '@/services/admin-telemetry.service';

function formatAuditTimestamp(isoString: string): string {
  if (!isoString) return '—';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsed);
}

function getActionBadgeConfig(action: string): {
  classes: string;
  dotClasses: string;
  label: string;
} {
  const normalized = String(action || '').trim().toUpperCase();

  if (normalized === 'LOGIN_FAILED' || normalized.includes('FAILED') || normalized.includes('FORBIDDEN')) {
    return {
      classes: 'bg-red-100 text-red-800 border border-red-200',
      dotClasses: 'bg-red-600',
      label: normalized,
    };
  }

  if (normalized === 'LOGIN_SUCCESS' || normalized === 'ADMIN_LOGIN_SUCCESS') {
    return {
      classes: 'bg-green-100 text-green-800 border border-green-200',
      dotClasses: 'bg-green-600',
      label: normalized,
    };
  }

  if (normalized === 'PROPOSAL_GENERATED' || normalized.startsWith('PROPOSAL_')) {
    return {
      classes: 'bg-blue-100 text-blue-800 border border-blue-200',
      dotClasses: 'bg-blue-600',
      label: normalized,
    };
  }

  return {
    classes: 'bg-slate-100 text-slate-800 border border-slate-200',
    dotClasses: 'bg-slate-500',
    label: normalized || 'EVENTO',
  };
}

function formatPayloadPreview(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    return 'Sem metadados adicionais';
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export default function RadarPage() {
  const [logs, setLogs] = useState<AuditLogTelemetryItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadTelemetry = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetchAdminRadarTelemetry();
      const fetchedLogs = Array.isArray(response?.data?.logs) ? response.data.logs : [];
      setLogs(fetchedLogs);
      setGeneratedAt(response?.data?.generatedAt || new Date().toISOString());
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;

      if (status === 401 || status === 403) {
        setError(
          serverMsg ||
            'Sessão administrativa não autorizada ou expirada. Autentique-se com credenciais de administrador.',
        );
      } else {
        setError(
          serverMsg ||
            'Não foi possível carregar os registros de telemetria de segurança no momento.',
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTelemetry(false);
  }, [loadTelemetry]);

  const metrics = useMemo(() => {
    const failedCount = logs.filter((item) => item.action === 'LOGIN_FAILED').length;
    const successCount = logs.filter((item) => item.action === 'LOGIN_SUCCESS').length;
    const uniqueIps = new Set(logs.map((item) => item.ipAddress).filter(Boolean)).size;

    return {
      total: logs.length,
      failedCount,
      successCount,
      uniqueIps,
    };
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 lg:p-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* CABEÇALHO SÓBRIO / CORPORATIVO B2B */}
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand-orange shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 border border-slate-200">
                  SOC & IAM Telemetry
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3" /> HttpOnly Session Active
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-dark">
                Radar de Telemetria e Auditoria de Segurança
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Monitoramento em tempo real dos últimos 50 eventos críticos de autenticação, ameaças por IP e operações sensíveis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {generatedAt && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Atualizado: {formatAuditTimestamp(generatedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadTelemetry(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-orange hover:bg-orange-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 text-white ${isLoading || isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>
        </header>

        {/* CARDS EXECUTIVOS DE TELEMETRIA */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Eventos Inspecionados</span>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-brand-dark">{metrics.total}</p>
            <p className="mt-1 text-[11px] text-slate-500">Janela dos 50 registros mais recentes</p>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-red-700">
              <span>Falhas de Login (Threat)</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-red-600">{metrics.failedCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">Monitorado pelo motor anti-força bruta</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <span>Autenticações Válidas</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600">{metrics.successCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">Sessões validadas via cookie estrito</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-blue">
              <span>Endereços IP Distintos</span>
              <Globe className="h-4 w-4 text-brand-blue" />
            </div>
            <p className="mt-2 text-2xl font-black text-brand-dark">{metrics.uniqueIps}</p>
            <p className="mt-1 text-[11px] text-slate-500">Extraídos via Cloudflare (cf-connecting-ip)</p>
          </div>
        </section>

        {/* ESTADO DE LOADING */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
            <Loader2 className="h-9 w-9 animate-spin text-brand-orange" />
            <p className="mt-3 text-sm font-bold text-slate-700">
              Carregando telemetria de auditoria...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Validando sessão segura HttpOnly e consultando trilha imutável no PostgreSQL.
            </p>
          </div>
        )}

        {/* ESTADO DE ERRO */}
        {!isLoading && error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 sm:flex-row sm:items-center sm:justify-between shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <h2 className="text-sm font-bold text-red-800">
                  Falha ao comunicar com o Radar de Telemetria
                </h2>
                <p className="mt-1 text-xs text-red-600">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadTelemetry(true)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-orange hover:bg-orange-600 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* TABELA RESPONSIVA DE AUDITORIA */}
        {!isLoading && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm h-auto overflow-visible">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-brand-orange" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-brand-dark">
                  Trilha de Auditoria Recente (AuditLog)
                </h2>
              </div>
              <span className="text-xs font-medium text-slate-500">
                Exibindo {logs.length} registro(s)
              </span>
            </div>

            <div className="w-full h-auto overflow-visible">
              <table className="w-full table-fixed border-collapse text-left text-xs h-auto overflow-visible">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="w-[18%] px-4 py-3.5">Data / Hora</th>
                    <th className="w-[16%] px-4 py-3.5">IP de Origem</th>
                    <th className="w-[18%] px-4 py-3.5">Ação</th>
                    <th className="w-[18%] px-4 py-3.5">Usuário</th>
                    <th className="w-[30%] px-4 py-3.5">Detalhes (Payload)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <FileSpreadsheet className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">
                          Nenhum evento de auditoria registrado até o momento.
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Assim que novos eventos de autenticação ou geração de propostas ocorrerem, eles serão listados aqui.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const badge = getActionBadgeConfig(log.action);
                      const userDisplay =
                        log.user?.email ||
                        log.user?.nome ||
                        log.userId ||
                        'Não autenticado';

                      return (
                        <tr
                          key={log.id}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          {/* Coluna 1: Data/Hora */}
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-700">
                            {formatAuditTimestamp(log.timestamp)}
                          </td>

                          {/* Coluna 2: IP de Origem */}
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-brand-dark">
                              {log.ipAddress || 'unknown-ip'}
                            </span>
                          </td>

                          {/* Coluna 3: Ação (Threat Indicator Badge) */}
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${badge.classes}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${badge.dotClasses}`}
                              />
                              {badge.label}
                            </span>
                          </td>

                          {/* Coluna 4: Usuário */}
                          <td className="px-4 py-3.5 text-slate-800">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <div className="truncate max-w-[200px]">
                                <span className="font-semibold">{userDisplay}</span>
                                {log.user?.role && (
                                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 border border-slate-200">
                                    {log.user.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Coluna 5: Detalhes (Payload) */}
                          <td className="px-4 py-3.5">
                            <div className="max-w-md space-y-1">
                              <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                                {formatPayloadPreview(log.payload)}
                              </pre>
                              {log.userAgent && (
                                <p
                                  className="truncate text-[10px] text-slate-400"
                                  title={log.userAgent}
                                >
                                  UA: {log.userAgent}
                                </p>
                              )}
                            </div>
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
      </div>
    </div>
  );
}

export { RadarPage };
