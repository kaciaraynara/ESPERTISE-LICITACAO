import { Stack } from '@phosphor-icons/react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { integracoesApi } from '@services/api';
import toast from 'react-hot-toast';
import {
  ExternalLink,
  Activity,
  Database,
  RefreshCw,
  ServerCrash,
  DownloadCloud,
  CheckCircle2,
  Clock,
} from '@components/icons/phosphor-compat';

type Fonte = {
  id: string;
  nome: string;
  orgao: string;
  tipo: string;
  descricao: string;
  documentacaoUrl: string;
  integradoNoApp: boolean;
};

type HealthItem = { id: string; ok: boolean; ms: number; mensagem?: string };

interface TelemetriaData {
  resumo: {
    totalEditais: number;
    totalAbertos: number;
    novos24h: number;
    ultimaSincronizacao: string | null;
  };
  fontes: Array<{
    source: string;
    total: number;
    abertos: number;
    novos24h: number;
    ultimaPublicacao: string | null;
    ultimaAtualizacao: string | null;
  }>;
  cursores: Array<{
    source: string;
    cursorKey: string;
    cursorValue: Record<string, any> | null;
    lastSyncedAt: string | null;
  }>;
  jobs: Array<{
    id: string;
    source: string;
    connector: string;
    status: string;
    recordsSeen: number;
    recordsAccepted: number;
    recordsFailed: number;
    errorMessage: string | null;
    finishedAt: string | null;
  }>;
}

function normalizeHealthPayload(payload: any): HealthItem[] {
  if (Array.isArray(payload?.data)) {
    return payload.data as HealthItem[];
  }

  if (payload?.integrations) {
    return Object.entries(payload.integrations).map(([key, value]) => ({
      id: key.toUpperCase(),
      ok: value === 'connected',
      ms: 35,
      mensagem: value === 'connected' ? 'Operante' : 'Falha',
    })) as HealthItem[];
  }

  return [];
}

function formatDateTimePt(iso?: string | null): string {
  if (!iso) return 'Aguardando 1ª execução';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSourceLabel(source: string): string {
  const s = source.toLowerCase();
  if (s === 'pncp') return 'PNCP Oficial (Federal / Estados / Municípios)';
  if (s === 'comprasgov' || s === 'compras_gov') return 'Compras.gov.br (SIASG)';
  if (s === 'querido_diario') return 'Querido Diário (Diários Oficiais Municipais)';
  if (s === 'portal_transparencia') return 'Portal da Transparência (CGU)';
  return source;
}

export default function IntegracoesPage() {
  const [sincronizando, setSincronizando] = useState(false);
  const queryClient = useQueryClient();

  const catalog = useQuery({
    queryKey: ['integracoes', 'catalogo'],
    queryFn: async () => {
      const response = await integracoesApi.catalogo();
      if (!Array.isArray(response.data?.data)) return [];
      return response.data.data as Fonte[];
    },
  });

  const health = useQuery({
    queryKey: ['integracoes', 'health'],
    queryFn: async () => {
      const response = await integracoesApi.health();
      return normalizeHealthPayload(response.data);
    },
    refetchInterval: 60_000,
  });

  const telemetria = useQuery({
    queryKey: ['integracoes', 'telemetria'],
    queryFn: async () => {
      const response = await integracoesApi.telemetria();
      return (response.data?.data ?? null) as TelemetriaData | null;
    },
    refetchInterval: 30_000,
  });

  const indicesBcb = useQuery({
    queryKey: ['integracoes', 'indices-economicos'],
    queryFn: async () => {
      const response = await integracoesApi.indicesEconomicos();
      return response.data?.data ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const handleSincronizarPNCP = async () => {
    setSincronizando(true);
    const toastId = toast.loading('Sincronizando PNCP (todas modalidades), Compras.gov e Diários Oficiais...', {
      style: { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' },
    });

    try {
      const response = await integracoesApi.sincronizarPncp();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integracoes', 'telemetria'] }),
        queryClient.invalidateQueries({ queryKey: ['integracoes', 'health'] }),
      ]);

      if (response.data.success) {
        toast.success(
          `Sincronização concluída: ${response.data.persistidos ?? response.data.inseridos ?? 0} editais processados.`,
          { id: toastId },
        );
      } else {
        toast.error(
          `Sincronização parcial: ${response.data.falhas ?? 0} conector(es) falharam.`,
          { id: toastId },
        );
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Falha ao sincronizar com os portais. Tente novamente.', {
        id: toastId,
      });
    } finally {
      setSincronizando(false);
    }
  };

  const pncpSweepCursors = (telemetria.data?.cursores || []).filter((c) =>
    c.cursorKey.startsWith('proposta_sweep_mod_'),
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 bg-[#F8FAFC] min-h-screen text-[#081C3A]">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-[#081C3A] tracking-tight">
            Integrações & Ingestão Multi-Portal
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Monitore a captura contínua das 12 modalidades do PNCP, Compras.gov.br, Diários Oficiais e APIs governamentais.
          </p>
        </div>

        <button
          onClick={handleSincronizarPNCP}
          disabled={sincronizando}
          className="inline-flex items-center gap-2 bg-[#081C3A] hover:bg-[#0f2b56] active:scale-95 disabled:opacity-60 text-white px-5 py-3 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          {sincronizando ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <DownloadCloud className="w-4 h-4" />
          )}
          {sincronizando ? 'Sincronizando portais...' : 'Executar sincronização agora'}
        </button>
      </div>

      {/* 4 KPIs REAIS DE INGESTÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total na Base</p>
          <p className="mt-1 text-2xl font-extrabold text-[#081C3A]">
            {telemetria.isLoading ? '...' : (telemetria.data?.resumo.totalEditais ?? 0).toLocaleString('pt-BR')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Editais consolidados e indexados</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Abertos p/ Proposta</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">
            {telemetria.isLoading ? '...' : (telemetria.data?.resumo.totalAbertos ?? 0).toLocaleString('pt-BR')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Com prazo vigente no Radar</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#0070C0]">Capturados em 24h</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0070C0]">
            {telemetria.isLoading ? '...' : (telemetria.data?.resumo.novos24h ?? 0).toLocaleString('pt-BR')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Novas publicações das últimas 24h</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Última Sincronização</p>
          <p className="mt-1 text-lg font-extrabold text-[#081C3A] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#0070C0]" />
            {telemetria.isLoading ? '...' : formatDateTimePt(telemetria.data?.resumo.ultimaSincronizacao)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Ciclo automático a cada 30 min</p>
        </div>
      </div>

      {/* ÍNDICES ECONÔMICOS OFICIAIS (BANCO CENTRAL - SGS) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-[#081C3A] text-base">
              Índices Econômicos Oficiais (Banco Central — Reajuste Art. 135 Lei 14.133/2021)
            </h2>
            <p className="text-xs text-slate-500">
              Séries temporais diretas do Banco Central do Brasil para balizar aditivos de reajuste e equilíbrio econômico-financeiro.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void indicesBcb.refetch()}
            disabled={indicesBcb.isFetching}
            className="text-xs font-bold text-[#081C3A] border border-slate-200 hover:border-[#0070C0] px-3 py-1.5 rounded-full self-start sm:self-auto cursor-pointer"
          >
            {indicesBcb.isFetching ? 'Atualizando...' : 'Atualizar Índices BCB'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <p className="text-[11px] font-bold uppercase text-slate-500">IPCA Acumulado (12 meses)</p>
            <p className="text-2xl font-black text-[#081C3A] mt-1">
              {indicesBcb.isLoading
                ? '...'
                : indicesBcb.data?.ipca?.acumulado12m !== null && indicesBcb.data?.ipca?.acumulado12m !== undefined
                  ? `${indicesBcb.data.ipca.acumulado12m.toFixed(2)}%`
                  : 'Indisponível'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Último mês ({indicesBcb.data?.ipca?.ultimoMes?.data || '—'}):{' '}
              <strong>
                {indicesBcb.data?.ipca?.ultimoMes ? `${indicesBcb.data.ipca.ultimoMes.valor}%` : '—'}
              </strong>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <p className="text-[11px] font-bold uppercase text-slate-500">IGP-M Acumulado (12 meses)</p>
            <p className="text-2xl font-black text-[#081C3A] mt-1">
              {indicesBcb.isLoading
                ? '...'
                : indicesBcb.data?.igpm?.acumulado12m !== null && indicesBcb.data?.igpm?.acumulado12m !== undefined
                  ? `${indicesBcb.data.igpm.acumulado12m.toFixed(2)}%`
                  : 'Indisponível'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Último mês ({indicesBcb.data?.igpm?.ultimoMes?.data || '—'}):{' '}
              <strong>
                {indicesBcb.data?.igpm?.ultimoMes ? `${indicesBcb.data.igpm.ultimoMes.valor}%` : '—'}
              </strong>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
            <p className="text-[11px] font-bold uppercase text-[#0070C0]">Taxa SELIC Meta Anual</p>
            <p className="text-2xl font-black text-[#081C3A] mt-1">
              {indicesBcb.isLoading
                ? '...'
                : indicesBcb.data?.selic?.metaAnual !== null && indicesBcb.data?.selic?.metaAnual !== undefined
                  ? `${indicesBcb.data.selic.metaAnual.toFixed(2)}% a.a.`
                  : 'Indisponível'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Referência BCB: {indicesBcb.data?.selic?.dataReferencia || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* STATUS DAS APIS DO GOVERNO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#0070C0]" />
            <h2 className="font-bold text-[#081C3A] text-base">Saúde das Conexões Oficiais em Tempo Real</h2>
          </div>
          <button
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
            className="flex items-center gap-2 text-xs font-bold text-[#081C3A] border border-slate-200 hover:border-[#0070C0] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${health.isFetching ? 'animate-spin text-[#0070C0]' : ''}`} />
            Testar Conexões
          </button>
        </div>

        {health.isLoading && (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Testando rotas oficiais...
          </p>
        )}

        {health.isError && (
          <div className="flex items-center gap-3 text-sm text-red-800 bg-red-50 p-4 rounded-xl border border-red-200">
            <ServerCrash className="w-5 h-5" />
            <div>
              <p className="font-bold">Não foi possível verificar as integrações</p>
              <p>{health.error instanceof Error ? health.error.message : 'O serviço de saúde está indisponível.'}</p>
            </div>
          </div>
        )}

        {health.data && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(health.data as HealthItem[]).map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between border border-slate-200 bg-slate-50/50 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      h.ok ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-[#081C3A] font-bold text-sm block">{h.id}</span>
                    {h.mensagem && (
                      <span className="text-[11px] text-slate-500 truncate block">{h.mensagem}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-slate-600 font-mono text-xs bg-white px-2 py-1 rounded-md border border-slate-200">
                    {h.ms} ms
                  </span>
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                      h.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {h.ok ? 'OPERANTE' : 'ATENÇÃO'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* COBERTURA POR PORTAL + PROGRESSO DE VARREDURA COM CURSOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Database className="w-5 h-5 text-[#0070C0]" />
            <h2 className="font-bold text-[#081C3A] text-base">Cobertura por Portal na Base</h2>
          </div>

          {telemetria.data?.fontes?.length ? (
            <div className="space-y-3">
              {telemetria.data.fontes.map((f) => (
                <div
                  key={f.source}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-bold text-[#081C3A]">{formatSourceLabel(f.source)}</p>
                    <p className="text-xs text-slate-500">
                      Última publicação: {formatDateTimePt(f.ultimaPublicacao)} • Novas 24h: {f.novos24h}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                    <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-slate-700">
                      {f.total.toLocaleString('pt-BR')} total
                    </span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-emerald-700">
                      {f.abertos.toLocaleString('pt-BR')} abertos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {telemetria.isLoading ? 'Carregando estatísticas por portal...' : 'Nenhum dado de ingestão registrado ainda.'}
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Stack className="w-5 h-5 text-[#0070C0]" />
            <h2 className="font-bold text-[#081C3A] text-base">Varredura Contínua PNCP por Modalidade (Cursor)</h2>
          </div>

          {pncpSweepCursors.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {pncpSweepCursors.map((c) => {
                const v = c.cursorValue || {};
                const label = v.modalidadeNome || c.cursorKey;
                const pct = typeof v.progressPct === 'number' ? v.progressPct : 100;
                const detalhe =
                  v.modalidadeCodigo === 8 && v.totalUfs
                    ? `Rotação por UF (${Array.isArray(v.lastUfs) ? v.lastUfs.join(', ') : ''})`
                    : v.totalPages
                      ? `Pág. ${v.lastPageRead || 1}/${v.totalPages}`
                      : 'Sincronizado';
                return (
                  <div key={c.cursorKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#081C3A]">{label}</span>
                      <span className="text-slate-500">
                        {detalhe} • {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0070C0] transition-all"
                        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Os cursores de varredura completa das 12 modalidades aparecem após o próximo ciclo de sincronização.
            </p>
          )}
        </div>
      </div>

      {/* ÚLTIMOS JOBS DE INGESTÃO */}
      {telemetria.data?.jobs && telemetria.data.jobs.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-[#081C3A] text-base">Histórico Recente de Execuções</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2 pr-4">Portal</th>
                  <th className="py-2 pr-4">Conector</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Lidos / Gravados</th>
                  <th className="py-2">Concluído em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetria.data.jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-2.5 pr-4 font-bold text-[#081C3A]">{job.source}</td>
                    <td className="py-2.5 pr-4 font-mono text-slate-600">{job.connector}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-bold ${
                          job.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'partial'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-slate-700">
                      {job.recordsSeen} / {job.recordsAccepted}
                      {job.recordsFailed > 0 ? ` (${job.recordsFailed} falhas)` : ''}
                    </td>
                    <td className="py-2.5 text-slate-500">{formatDateTimePt(job.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATÁLOGO DE BASES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-[#081C3A] flex items-center gap-2 mb-5">
          <Database className="w-5 h-5 text-[#0070C0]" />
          Bases de Dados Oficiais Integradas
        </h2>

        <div className="space-y-3.5">
          {catalog.isLoading && <p className="text-slate-500 text-sm">Carregando catálogo...</p>}
          {catalog.isError && (
            <p role="alert" className="text-sm text-amber-700">
              Não foi possível carregar o catálogo de integrações.
            </p>
          )}
          {catalog.data &&
            catalog.data.map((f) => (
              <div
                key={f.id}
                className="p-4 border border-slate-200 rounded-xl hover:border-[#0070C0]/40 transition-colors bg-white"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#081C3A] text-sm sm:text-base">{f.nome}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {f.tipo}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          f.integradoNoApp
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {f.integradoNoApp ? 'Integrado' : 'Planejado'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0070C0] mb-1.5">{f.orgao}</p>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">{f.descricao}</p>
                  </div>
                  <a
                    href={f.documentacaoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0070C0] border border-slate-200 hover:border-[#0070C0] px-3 py-2 rounded-full transition-colors whitespace-nowrap self-start"
                  >
                    Documentação <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
