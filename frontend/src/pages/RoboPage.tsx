import React, { useState } from 'react';
import {
  Bot,
  TrendingDown,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Calculator,
  Activity,
  ExternalLink,
  Plus,
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
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

interface LanceRegistro {
  horario: string;
  fornecedor: string;
  valor: number;
}

export const RoboPage: React.FC = () => {
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [margemDesejada, setMargemDesejada] = useState(12.5);
  const [reducaoMax, setReducaoMax] = useState(8);
  const [ativo, setAtivo] = useState(true);
  const [lancesSessao, setLancesSessao] = useState<LanceRegistro[]>([]);
  const [novoLanceInput, setNovoLanceInput] = useState('');

  const valorBase = Number(edital?.valorEstimado || 0);
  const valorAlvo = valorBase > 0 ? valorBase * (1 - reducaoMax / 100) : 0;
  const lucroEstimado = valorAlvo > 0 ? valorAlvo * (margemDesejada / 100) : 0;

  const curvaReal =
    lancesSessao.length > 0
      ? lancesSessao.map((l, i) => ({ rodada: `Lance ${i + 1}`, seuLance: l.valor }))
      : valorBase > 0
      ? [
          { rodada: 'Referencia', seuLance: Math.round(valorBase) },
          { rodada: 'Piso Seguro', seuLance: Math.round(valorAlvo) },
        ]
      : [];

  const formatarMoeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const registrarLance = () => {
    const num = Number(novoLanceInput.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (!num || num <= 0) return;
    setLancesSessao((prev) => [
      ...prev,
      {
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fornecedor: 'Sua Empresa',
        valor: num,
      },
    ]);
    setNovoLanceInput('');
  };

  const urlPortal = edital ? buildOfficialPncpPortalUrl(edital) : '';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#081C3A]">Sala de Disputa & Robo de Lances</h1>
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
              Selecione um edital real para espelhar os itens da sessao, controlar margem e registrar lances
            </p>
          </div>
        </div>
        <div className="w-full md:w-80">
          <EditalSelector onSelectEdital={(e) => setEdital(e)} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Valor de Referencia Real</div>
          <div className="mt-2 text-xl font-extrabold text-[#081C3A]">
            {valorBase > 0 ? formatarMoeda(valorBase) : 'Selecione um edital'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {edital ? `${edital.numeroEdital} · ${edital.orgao}` : 'Nenhum edital selecionado'}
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
          <div className="mt-2 text-xl font-extrabold text-[#0070C0]">
            {valorAlvo > 0 ? formatarMoeda(valorAlvo) : 'R$ 0,00'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Lucro projetado: {formatarMoeda(lucroEstimado)}
          </div>
        </div>
      </div>

      {/* Sala Espelhada + Lances */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
              <Sparkles className="h-4 w-4 text-[#F97316]" /> Sala Espelhada da Disputa
            </h2>
            {urlPortal && (
              <a
                href={urlPortal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-[#0070C0] px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                Abrir Sala Oficial <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={novoLanceInput}
              onChange={(e) => setNovoLanceInput(e.target.value)}
              placeholder="Registrar lance da sessao (ex: 45200.00)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#081C3A]"
            />
            <button
              type="button"
              onClick={registrarLance}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#081C3A] px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" /> Registrar
            </button>
          </div>

          {lancesSessao.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Horario</th>
                  <th className="py-2">Fornecedor</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancesSessao.map((l, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">{l.horario}</td>
                    <td className="py-2 font-bold text-[#081C3A]">{l.fornecedor}</td>
                    <td className="py-2 text-right font-bold text-emerald-700">{formatarMoeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              {edital?.itens && edital.itens.length > 0
                ? `Edital carregado com ${edital.itens.length} item(ns). Registre seu lance acima ou abra a sala oficial.`
                : 'Selecione um edital salvo ou monitorado para acompanhar os itens e registrar lances reais.'}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
            <Activity className="h-4 w-4 text-[#0070C0]" /> Curva de Lances da Sessao
          </h2>
          {curvaReal.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curvaReal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="rodada" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="seuLance" stroke="#081C3A" fill="#bfdbfe" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-60 items-center justify-center text-xs text-slate-500">
              A curva sera exibida assim que um edital real for selecionado.
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Piso calculado sem dados ficticios: {formatarMoeda(valorAlvo)}</span>
            <CheckCircle2 className="ml-auto h-4 w-4 text-[#F97316]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoboPage;
