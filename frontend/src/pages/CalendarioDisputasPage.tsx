import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
  DollarSign,
  ExternalLink,
  AlertTriangle,
} from '@components/icons/phosphor-compat';
import api from '@services/api';
import { Button } from '@/components/ui';

type Licitacao = {
  id: string;
  objeto: string;
  orgao: string;
  uf?: string;
  valor_estimado?: number;
  data_abertura?: string;
  modalidade?: string;
  link?: string;
  score?: { pontuacao: number; nivel: string };
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMoney(v?: number) {
  if (!v) return 'Não informado';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function getDayKey(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarioDisputasPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const licitacoesQuery = useQuery({
    queryKey: ['calendario-disputas'],
    queryFn: async () => {
      const response = await api.get('/licitacoes', { params: { pagina: 1, tamanhoPagina: 100 } });
      return (response.data?.data ?? []) as Licitacao[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const licitacoes = licitacoesQuery.data ?? [];

  // Mapear licitações por dia
  const byDay = useMemo(() => {
    const map = new Map<string, Licitacao[]>();
    licitacoes.forEach((lic) => {
      const key = getDayKey(lic.data_abertura);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lic);
    });
    return map;
  }, [licitacoes]);

  // Gerar dias do mês
  const daysInMonth = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ day: number | null; key: string | null }> = [];

    for (let i = 0; i < startPad; i++) {
      days.push({ day: null, key: null });
    }
    for (let d = 1; d <= totalDays; d++) {
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, key });
    }
    return days;
  }, [viewYear, viewMonth]);

  const todayKey = getDayKey(today.toISOString());

  const selectedItems = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }

  // Métricas rápidas
  const totalMes = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    let count = 0;
    byDay.forEach((items, key) => {
      if (key.startsWith(prefix)) count += items.length;
    });
    return count;
  }, [byDay, viewYear, viewMonth]);

  const urgentes = useMemo(() => {
    const in7 = new Date(Date.now() + 7 * 86400000);
    return licitacoes.filter(lic => {
      if (!lic.data_abertura) return false;
      const d = new Date(lic.data_abertura);
      return d >= today && d <= in7;
    });
  }, [licitacoes]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-blue/70">
            <Calendar className="h-3.5 w-3.5" />
            Agenda de disputas
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-blue">
            Calendário de Editais
          </h1>
          <p className="mt-1 text-sm text-brand-blue/70">
            Visualize e planeje suas participações por data de abertura.
          </p>
        </div>

        <div className="flex gap-3">
          {urgentes.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-orange/50 bg-brand-orange/10 px-4 py-2.5 text-sm font-bold text-brand-blue">
              <AlertTriangle className="h-4 w-4" />
              {urgentes.length} disputa{urgentes.length > 1 ? 's' : ''} em até 7 dias
            </div>
          )}
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Este mês', value: totalMes, hint: 'editais com abertura prevista', color: 'text-brand-blue bg-white border-brand-blue/20' },
          { label: 'Próximos 7 dias', value: urgentes.length, hint: 'disputas urgentes para preparar', color: 'text-brand-blue bg-brand-orange/10 border-brand-orange/50' },
          { label: 'Total no radar', value: licitacoes.length, hint: 'editais carregados do radar', color: 'text-brand-blue bg-white border-brand-blue/20' },
        ].map(card => (
          <div key={card.label} className={`rounded-lg border p-5 ${card.color}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
            <p className="mt-1 text-sm opacity-80">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* CALENDÁRIO */}
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <Button
              onClick={prevMonth}
              className="rounded-lg border border-gray-100 p-2 hover:bg-white transition"
            >
              <ChevronLeft className="h-4 w-4 text-brand-blue/70" />
            </Button>
            <h2 className="text-lg font-bold text-brand-blue">
              {MESES[viewMonth]} {viewYear}
            </h2>
            <Button
              onClick={nextMonth}
              className="rounded-lg border border-gray-100 p-2 hover:bg-white transition"
            >
              <ChevronRight className="h-4 w-4 text-brand-blue/70" />
            </Button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {daysInMonth.map((cell, i) => {
              const hasItems = cell.key ? byDay.has(cell.key) : false;
              const count = cell.key ? (byDay.get(cell.key)?.length ?? 0) : 0;
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;

              return (
                <div
                  key={i}
                  onClick={() => cell.key && setSelectedDay(isSelected ? null : cell.key)}
                  className={`relative min-h-[72px] border-b border-r border-gray-100 p-2 transition last:border-r-0
                    ${cell.day ? 'cursor-pointer hover:bg-white' : ''}
                    ${isSelected ? 'bg-white ring-1 ring-inset ring-brand-blue/10' : ''}
                  `}
                >
                  {cell.day !== null && (
                    <>
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                        isToday
                          ? 'bg-brand-blue text-white'
                          : 'text-brand-blue'
                      }`}>
                        {cell.day}
                      </span>

                      {hasItems && (
                        <div className="mt-1 space-y-0.5">
                          {count <= 2
                            ? byDay.get(cell.key!)?.slice(0, 2).map((lic, idx) => (
                              <div
                                key={idx}
                                className={`truncate rounded px-1 py-0.5 text-[9px] font-bold ${
                                  (lic.score?.pontuacao ?? 0) >= 80
                                    ? 'bg-white text-brand-blue'
                                    : 'bg-white text-brand-blue'
                                }`}
                              >
                                {lic.objeto.substring(0, 20)}...
                              </div>
                            ))
                            : (
                              <div className="rounded bg-brand-blue px-1 py-0.5 text-[9px] font-bold text-white">
                                {count} editais
                              </div>
                            )
                          }
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PAINEL LATERAL */}
        <div className="space-y-4">
          {selectedDay ? (
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-white px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                  Editais em {selectedDay.split('-').reverse().join('/')}
                </p>
                <p className="mt-1 text-lg font-bold text-brand-blue">
                  {selectedItems.length} disputa{selectedItems.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {selectedItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="mx-auto h-10 w-10 text-brand-blue/70 mb-3" />
                    <p className="text-sm text-brand-blue/70">Nenhum edital neste dia</p>
                  </div>
                ) : (
                  selectedItems.map(lic => (
                    <div key={lic.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-brand-blue leading-snug">
                          {lic.objeto}
                        </p>
                        {lic.score && (
                          <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                            lic.score.pontuacao >= 80
                              ? 'border-brand-blue/20 bg-white text-brand-blue'
                              : 'border-gray-100 bg-white text-brand-blue/70'
                          }`}>
                            {lic.score.pontuacao}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-xs text-brand-blue/70">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lic.orgao}</span>
                        </div>
                        {lic.valor_estimado && (
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-bold text-brand-blue">{formatMoney(lic.valor_estimado)}</span>
                          </div>
                        )}
                        {lic.data_abertura && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {new Date(lic.data_abertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Link
                          to={`/licitante/licitacoes/${encodeURIComponent(lic.id)}`}
                          className="flex-1 rounded-lg border border-brand-blue/20 bg-white py-2 text-center text-xs font-bold text-brand-blue hover:bg-white transition"
                        >
                          Analisar
                        </Link>
                        {lic.link && (
                          <a
                            href={lic.link}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-brand-blue/70 hover:bg-white transition flex items-center gap-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70 mb-3">
                  Próximas urgentes
                </p>
                {urgentes.length === 0 ? (
                  <p className="text-sm text-brand-blue/70">Nenhuma disputa nos próximos 7 dias</p>
                ) : (
                  <div className="space-y-3">
                    {urgentes.slice(0, 5).map(lic => {
                      const diasRestantes = Math.ceil((new Date(lic.data_abertura!).getTime() - Date.now()) / 86400000);
                      return (
                        <Link
                          key={lic.id}
                          to={`/licitante/licitacoes/${encodeURIComponent(lic.id)}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 hover:border-brand-blue/20 hover:bg-white transition"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-brand-blue">{lic.objeto}</p>
                            <p className="mt-0.5 text-xs text-brand-blue/70">{lic.orgao}</p>
                          </div>
                          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                            diasRestantes <= 1
                              ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue'
                              : diasRestantes <= 3
                                ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue'
                                : 'border-brand-blue/20 bg-white text-brand-blue'
                          }`}>
                            {diasRestantes === 0 ? 'Hoje' : `${diasRestantes}d`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-100 bg-white p-4 text-sm text-brand-blue/70">
                <p className="font-bold text-brand-blue mb-1">Como usar o calendário</p>
                <p className="leading-6">Clique em qualquer dia com editais para ver os detalhes e ir direto para análise ou sala do robô.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
