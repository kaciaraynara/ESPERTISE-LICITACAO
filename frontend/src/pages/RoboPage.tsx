import React, { useState } from 'react';
import {
  Bot,
  TrendingDown,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Calculator,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { EditalOption, EditalSelector } from '@/components/EditalSelector';

export const RoboPage: React.FC = () => {
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [margemDesejada, setMargemDesejada] = useState(12.5);
  const [reducaoMax, setReducaoMax] = useState(8);
  const [ativo, setAtivo] = useState(true);

  const valorBase = Number(edital?.valorEstimado || 100000);
  const valorAlvo = valorBase * (1 - reducaoMax / 100);
  const lucroEstimado = valorAlvo * (margemDesejada / 100);

  const curvaSimulada = [
    { rodada: 'Abertura', seuLance: Math.round(valorBase), referencia: Math.round(valorBase) },
    { rodada: 'Rodada 1', seuLance: Math.round(valorBase * 0.97), referencia: Math.round(valorBase * 0.98) },
    { rodada: 'Rodada 2', seuLance: Math.round(valorBase * 0.94), referencia: Math.round(valorBase * 0.95) },
    { rodada: 'Alvo Final', seuLance: Math.round(valorAlvo), referencia: Math.round(valorBase * 0.93) },
  ];

  const formatarMoeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#081C3A]">Robo de Lances</h1>
              <button
                type="button"
                onClick={() => setAtivo(!ativo)}
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {ativo ? 'Ativo' : 'Pausado'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Estrategia inteligente de margem minima e simulacao competitiva para a disputa
            </p>
          </div>
        </div>
        <div className="w-full md:w-80">
          <EditalSelector onSelectEdital={(e) => setEdital(e)} />
        </div>
      </div>

      {/* KPIs do Robo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Valor de Referencia</div>
          <div className="mt-2 text-xl font-extrabold text-[#081C3A]">{formatarMoeda(valorBase)}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {edital ? edital.numeroEdital : 'Selecione um edital acima'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Margem de Lucro Alvo</div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{margemDesejada.toFixed(1)}%</div>
          <input
            type="range"
            min={3}
            max={35}
            step={0.5}
            value={margemDesejada}
            onChange={(e) => setMargemDesejada(Number(e.target.value))}
            className="mt-2 w-full accent-[#F97316]"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <TrendingDown className="h-4 w-4 text-emerald-600" /> Reducao Estrategica
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">-{reducaoMax}%</div>
          <input
            type="range"
            min={1}
            max={25}
            step={1}
            value={reducaoMax}
            onChange={(e) => setReducaoMax(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-600"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Calculator className="h-4 w-4 text-[#0070C0]" /> Lance Minimo Seguro
          </div>
          <div className="mt-2 text-xl font-extrabold text-[#0070C0]">{formatarMoeda(valorAlvo)}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            Lucro projetado: {formatarMoeda(lucroEstimado)}
          </div>
        </div>
      </div>

      {/* Grafico e Analise */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
            <Activity className="h-4 w-4 text-[#0070C0]" /> Curva Estrategica de Lances
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curvaSimulada}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rodada" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="seuLance" stroke="#081C3A" fill="#bfdbfe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
              <Sparkles className="h-4 w-4 text-[#F97316]" /> Analise Inteligente da Disputa
            </h2>
            <ul className="space-y-2.5 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Estrategia configurada para reduzir ate <strong>{reducaoMax}%</strong> mantendo margem minima de{' '}
                  <strong>{margemDesejada.toFixed(1)}%</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0070C0]" />
                <span>
                  Piso de seguranca travado em <strong>{formatarMoeda(valorAlvo)}</strong> para evitar lances inexequiveis.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoboPage;
