import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { licitacoesApi } from '@services/api';
import type {
  RadarLicitacao,
  RadarLicitacoesFiltros,
  RadarLicitacoesResponse,
} from '@/types';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Radar,
  Search,
} from '@components/icons/phosphor-compat';

interface RadarUiFilters {
  uf: string;
  modalidade: string;
  palavraChave: string;
  dataFinal: string;
  pagina: number;
  tamanhoPagina: number;
}

interface RadarErrorPayload {
  code?: string;
  message?: string;
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function getDefaultEndDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 60);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toRequestParams(filters: RadarUiFilters): RadarLicitacoesFiltros {
  const palavraChave = filters.palavraChave.trim();
  const modalidade = filters.modalidade.trim();

  return {
    dataFinal: filters.dataFinal.replace(/-/g, ''),
    ...(modalidade
      ? { codigoModalidadeContratacao: Number(modalidade) }
      : {}),
    ...(filters.uf ? { uf: filters.uf } : {}),
    ...(palavraChave ? { palavraChave } : {}),
    pagina: filters.pagina,
    tamanhoPagina: filters.tamanhoPagina,
  };
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null): string {
  const date = parseDate(value);
  if (!date) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = parseDate(value);
  if (!date) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeText(value: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isOpenOpportunity(item: RadarLicitacao, now: number): boolean {
  const status = normalizeText(item.situacao);
  const closedStatus = /(encerr|finaliz|cancel|anulad|revogad|suspens|desert|fracass)/.test(status);
  if (closedStatus) return false;

  const closingDate = parseDate(item.dataEncerramento);
  if (closingDate) return closingDate.getTime() >= now;

  return /(abert|publicad|recebendo|divulgad|andamento)/.test(status);
}

function getRadarError(error: unknown): { title: string; message: string } {
  if (axios.isAxiosError<RadarErrorPayload>(error)) {
    const code = error.response?.data?.code;
    const backendMessage = error.response?.data?.message;

    if (code === 'PNCP_RATE_LIMITED' || error.response?.status === 429) {
      return {
        title: 'Limite temporário da fonte oficial',
        message: backendMessage
          ?? 'Fonte oficial temporariamente limitada. Tente novamente em alguns minutos.',
      };
    }

    if (code === 'PNCP_TIMEOUT' || error.code === 'ECONNABORTED') {
      return {
        title: 'Tempo de resposta excedido',
        message: backendMessage
          ?? 'O PNCP demorou para responder. Tente novamente em instantes.',
      };
    }

    if (!error.response) {
      return {
        title: 'API interna indisponível',
        message: 'Não foi possível acessar o serviço de consulta. Verifique a conexão e tente novamente.',
      };
    }

    return {
      title: 'Não foi possível consultar o PNCP',
      message: backendMessage ?? 'A fonte oficial não retornou os editais. Tente novamente.',
    };
  }

  return {
    title: 'Resposta inválida',
    message: 'A API interna não retornou o contrato esperado. Tente novamente.',
  };
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-blue to-blue-500" />
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
          {icon}
        </span>
      </div>
      <p className="truncate text-2xl font-bold text-slate-900" title={value}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export default function RadarPage() {
  const [filters, setFilters] = useState<RadarUiFilters>({
    uf: '',
    modalidade: '6',
    palavraChave: '',
    dataFinal: getDefaultEndDate(),
    pagina: 1,
    tamanhoPagina: 20,
  });
  const [appliedFilters, setAppliedFilters] = useState<RadarUiFilters | null>(null);
  const [result, setResult] = useState<RadarLicitacoesResponse | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (requestFilters: RadarLicitacoesFiltros) => {
      const response = await licitacoesApi.listar(requestFilters);
      if (
        response.data?.success !== true
        || !Array.isArray(response.data.data)
        || !response.data.meta
      ) {
        throw new Error('RADAR_INVALID_RESPONSE');
      }
      return response.data;
    },
    onSuccess: (response) => setResult(response),
  });

  const monitorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await licitacoesApi.monitorar(id);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Edital monitorado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erro ao monitorar edital');
    }
  });

  const runSearch = (nextFilters: RadarUiFilters) => {
    if (searchMutation.isPending) return;
    setHasSearched(true);
    setResult(null);
    setAppliedFilters(nextFilters);
    searchMutation.mutate(toRequestParams(nextFilters));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch(filters);
  };

  const metrics = useMemo(() => {
    const items = result?.data ?? [];
    const now = Date.now();
    const values = items
      .map((item) => item.valorEstimado)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const futureClosingDates = items
      .map((item) => parseDate(item.dataEncerramento))
      .filter((date): date is Date => date !== null && date.getTime() >= now)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      displayed: items.length,
      open: items.filter((item) => isOpenOpportunity(item, now)).length,
      highestValue: values.length > 0 ? Math.max(...values) : null,
      nextClosing: futureClosingDates[0]?.toISOString() ?? null,
    };
  }, [result]);

  const error = searchMutation.isError
    ? getRadarError(searchMutation.error)
    : null;

  const goToPage = (page: number) => {
    if (!appliedFilters || page < 1 || searchMutation.isPending) return;
    const nextFilters = { ...appliedFilters, pagina: page };
    setFilters(nextFilters);
    runSearch(nextFilters);
  };

  const canGoNext = Boolean(
    result
    && appliedFilters
    && (
      result.meta.totalRegistros === null
        ? result.data.length === result.meta.tamanhoPagina
        : result.meta.pagina * result.meta.tamanhoPagina < result.meta.totalRegistros
    ),
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      <header className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 border-l-4 border-brand-orange pl-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Radar de Editais
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600">
            {result ? formatDateTime(result.meta.atualizadoEm) : 'Aguardando busca'}
          </span>
        </div>
      </header>

        <form
          onSubmit={handleSubmit}
          className="relative z-10 -mt-2 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6 lg:grid-cols-12"
          aria-label="Filtros de busca do Radar de Editais"
        >
          <div className="lg:col-span-2">
            <label htmlFor="radar-uf" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
              UF
            </label>
            <select
              id="radar-uf"
              value={filters.uf}
              onChange={(event) => setFilters((current) => ({
                ...current,
                uf: event.target.value,
                pagina: 1,
              }))}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Nacional</option>
              {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="radar-modalidade" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Modalidade
            </label>
            <input
              id="radar-modalidade"
              type="number"
              min="1"
              required
              inputMode="numeric"
              value={filters.modalidade}
              onChange={(event) => setFilters((current) => ({
                ...current,
                modalidade: event.target.value,
                pagina: 1,
              }))}
              aria-describedby="radar-modalidade-help"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
            />
            <p id="radar-modalidade-help" className="mt-1 text-[11px] text-slate-500">Código 6: Pregão eletrônico</p>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="radar-keyword" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Palavra-chave
            </label>
            <input
              id="radar-keyword"
              type="search"
              value={filters.palavraChave}
              onChange={(event) => setFilters((current) => ({
                ...current,
                palavraChave: event.target.value,
                pagina: 1,
              }))}
              placeholder="Objeto, material ou serviço"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="radar-end-date" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Propostas até
            </label>
            <input
              id="radar-end-date"
              type="date"
              required
              value={filters.dataFinal}
              onChange={(event) => setFilters((current) => ({
                ...current,
                dataFinal: event.target.value,
                pagina: 1,
              }))}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:col-span-3">
            <div>
              <label htmlFor="radar-page" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Página
              </label>
              <input
                id="radar-page"
                type="number"
                min="1"
                required
                value={filters.pagina}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  pagina: Math.max(1, Number(event.target.value) || 1),
                }))}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="radar-page-size" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Itens
              </label>
              <select
                id="radar-page-size"
                value={filters.tamanhoPagina}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  tamanhoPagina: Number(event.target.value),
                  pagina: 1,
                }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between lg:col-span-12">
            <p className="text-xs leading-5 text-slate-500">
              A consulta acontece somente quando você aciona a busca.
            </p>
            <button
              type="submit"
              disabled={searchMutation.isPending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searchMutation.isPending
                ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                : <Search className="h-5 w-5" aria-hidden="true" />}
              {searchMutation.isPending ? 'Consultando fonte oficial...' : 'Buscar editais no PNCP'}
            </button>
          </div>
        </form>

        {result && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos editais encontrados">
            <MetricCard
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              label="Total exibido"
              value={String(metrics.displayed)}
              detail={result.meta.totalRegistros === null
                ? 'Itens desta consulta'
                : `${result.meta.totalRegistros.toLocaleString('pt-BR')} registro(s) informado(s) pela fonte`}
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              label="Oportunidades abertas"
              value={String(metrics.open)}
              detail="Calculado pelos status e prazos recebidos"
            />
            <MetricCard
              icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
              label="Maior valor estimado"
              value={formatMoney(metrics.highestValue)}
              detail="Entre os itens exibidos"
            />
            <MetricCard
              icon={<Calendar className="h-5 w-5" aria-hidden="true" />}
              label="Próximo encerramento"
              value={formatDate(metrics.nextClosing)}
              detail="Próxima data futura informada"
            />
          </section>
        )}

        <section className="mt-6" aria-live="polite" aria-busy={searchMutation.isPending}>
          {searchMutation.isPending && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center shadow-sm">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">Consultando o PNCP</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                A API interna está aguardando a resposta da fonte oficial.
              </p>
            </div>
          )}

          {!searchMutation.isPending && error && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 text-center">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">{error.title}</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{error.message}</p>
              {appliedFilters && (
                <button
                  type="button"
                  onClick={() => runSearch(appliedFilters)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {!searchMutation.isPending && !error && !hasSearched && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-gradient-to-b from-white to-blue-50/40 px-6 text-center">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-blue">
                <Radar className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">Sua consulta está pronta</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Revise os filtros e use o botão de busca para consultar as oportunidades oficiais.
              </p>
            </div>
          )}

          {!searchMutation.isPending && result?.data.length === 0 && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center shadow-sm">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Search className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">Nenhum edital encontrado</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                O PNCP não retornou resultados para estes filtros. Limpe a UF para uma busca nacional ou ajuste o período.
              </p>
            </div>
          )}

          {!searchMutation.isPending && result && result.data.length > 0 && (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Editais encontrados</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Página {result.meta.pagina} · {result.data.length} item(ns) exibido(s)
                  </p>
                </div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Consulta atualizada em {formatDateTime(result.meta.atualizadoEm)}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {result.data.map((item) => {
                  const location = [item.municipio, item.uf].filter(Boolean).join(' / ') || 'Não informado';

                  return (
                    <article
                      key={item.id}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-blue">
                            {item.modalidade ?? 'Não informado'}
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                            {item.fonte}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {item.situacao ?? 'Não informado'}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        <div className="mb-4">
                          <p className="mb-2 flex items-start gap-2 text-sm font-bold text-brand-blue">
                            <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{item.orgao || 'Não informado'}</span>
                          </p>
                          <h3 className="line-clamp-3 text-lg font-bold leading-6 text-slate-900">
                            {item.objeto || 'Não informado'}
                          </h3>
                        </div>

                        <dl className="grid gap-3 border-y border-slate-100 py-4 sm:grid-cols-2">
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Localização</dt>
                            <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                              {location}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Valor estimado</dt>
                            <dd className="mt-1 text-sm font-bold text-brand-blue">{formatMoney(item.valorEstimado)}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Encerramento</dt>
                            <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                              <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                              {formatDate(item.dataEncerramento)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Modo de disputa</dt>
                            <dd className="mt-1 text-sm font-medium text-slate-700">{item.modoDisputa ?? 'Não informado'}</dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                          <div className="min-w-0 text-xs leading-5 text-slate-500">
                            <p className="truncate" title={item.numeroControlePNCP}>
                              <strong className="text-slate-600">Controle PNCP:</strong> {item.numeroControlePNCP}
                            </p>
                            <p>
                              <strong className="text-slate-600">Publicação:</strong> {formatDate(item.dataPublicacao)}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => monitorMutation.mutate(item.numeroControlePNCP)}
                              disabled={monitorMutation.isPending}
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 disabled:opacity-50"
                              aria-label={`Monitorar edital ${item.numeroControlePNCP}`}
                            >
                              <Radar className="h-4 w-4" aria-hidden="true" />
                              Monitorar
                            </button>
                            <Link
                              to={`/fornecedor/licitacao/${encodeURIComponent(item.numeroControlePNCP)}`}
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-blue bg-white px-4 py-2.5 text-sm font-bold text-brand-blue transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                              aria-label={`Analisar edital ${item.numeroControlePNCP}`}
                            >
                              Analisar IA
                            </Link>
                            {item.link ? (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                                aria-label={`Abrir edital ${item.numeroControlePNCP} no sistema de origem`}
                              >
                                Abrir
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">
                                Sem Link
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <nav className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Paginação dos editais">
                <button
                  type="button"
                  onClick={() => goToPage((appliedFilters?.pagina ?? 1) - 1)}
                  disabled={!appliedFilters || appliedFilters.pagina <= 1 || searchMutation.isPending}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 text-sm font-semibold text-slate-600">
                  Página {result.meta.pagina}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage((appliedFilters?.pagina ?? 1) + 1)}
                  disabled={!canGoNext || searchMutation.isPending}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </nav>
            </>
          )}
        </section>
      </div>
  );
}
