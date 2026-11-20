import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Search,
  Loader2,
  Award,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  Target,
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
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

function formatarMoeda(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

export const InvestigacaoConcorrencialPage: React.FC = () => {
  const [cnpjs, setCnpjs] = useState<string[]>(['', '']);
  const [carregando, setCarregando] = useState(false);
  const [dossies, setDossies] = useState<any[]>([]);

  const atualizarCnpj = (idx: number, valor: string) => {
    const copia = [...cnpjs];
    copia[idx] = formatCnpjMask(valor);
    setCnpjs(copia);
  };

  const adicionarCnpj = () => {
    if (cnpjs.length >= 6) {
      toast.error('Maximo de 6 CNPJs por analise.');
      return;
    }
    setCnpjs([...cnpjs, '']);
  };

  const removerCnpj = (idx: number) => {
    if (cnpjs.length <= 1) return;
    setCnpjs(cnpjs.filter((_, i) => i !== idx));
  };

  const analisarMercado = async () => {
    const validos = cnpjs
      .map((c) => sanitizeCnpj(c))
      .filter((c) => isValidCnpj(c, { optional: false }));

    if (validos.length === 0) {
      toast.error('Informe pelo menos um CNPJ valido.');
      return;
    }

    setCarregando(true);
    try {
      const resp = await api.post('/concorrentes/historico', { cnpjs: Array.from(new Set(validos)) }, { timeout: 30000 });
      setDossies(resp.data?.data || []);
      toast.success('Inteligencia competitiva atualizada.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao buscar dados competitivos.');
    } finally {
      setCarregando(false);
    }
  };

  const totalContratos = dossies.reduce((s, d) => s + (d.estatisticas?.totalContratos || 0), 0);
  const lider = [...dossies].sort(
    (a, b) => (b.estatisticas?.totalContratos || 0) - (a.estatisticas?.totalContratos || 0)
  )[0];
  const volumeTotal = dossies.reduce((s, d) => s + (d.estatisticas?.valorTotalContratado || 0), 0);
  const orgaosTotais = dossies.reduce((s, d) => s + (d.estatisticas?.orgaosContratantes || 0), 0);

  // Evolucao mensal real a partir dos contratos retornados
  const mapaMes: Record<string, number> = {};
  dossies.forEach((d) => {
    (d.contratos || []).forEach((c: any) => {
      if (!(c.dataAssinatura || c.dataPublicacao)) return;
      const dt = new Date((c.dataAssinatura || c.dataPublicacao));
      if (Number.isNaN(dt.getTime())) return;
      const chave = `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      mapaMes[chave] = (mapaMes[chave] || 0) + 1;
    });
  });
  const serieMensal = Object.entries(mapaMes)
    .slice(-6)
    .map(([mes, contratos]) => ({ mes, contratos }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">Inteligencia Competitiva</h1>
            <p className="text-xs text-slate-500">
              Analise estrategica de concorrentes, mercado e desempenho em licitacoes
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={adicionarCnpj}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#081C3A] px-4 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar CNPJ
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cnpjs.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={val}
                onChange={(e) => atualizarCnpj(idx, e.target.value)}
                placeholder={`CNPJ Concorrente ${idx + 1}`}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
              />
              {cnpjs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerCnpj(idx)}
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={carregando}
            onClick={analisarMercado}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Gerar Analise Competitiva
          </button>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Users className="h-4 w-4 text-[#081C3A]" /> Concorrentes Identificados
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{dossies.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Award className="h-4 w-4 text-[#F97316]" /> Contratos do Lider
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">
            {lider?.estatisticas?.totalContratos || 0}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Volume Contratado
          </div>
          <div className="mt-2 text-lg font-extrabold text-[#081C3A]">{formatarMoeda(volumeTotal)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Target className="h-4 w-4 text-[#0070C0]" /> Orgaos Contratantes
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{orgaosTotais}</div>
        </div>
      </div>

      {dossies.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Principais Concorrentes</h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">CNPJ</th>
                  <th className="py-2">Contratos</th>
                  <th className="py-2">Ticket Medio</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {dossies.map((d) => (
                  <tr key={d.cnpj} className="border-b border-slate-100">
                    <td className="py-2.5 font-bold text-[#081C3A]">{formatCnpjMask(d.cnpj)}</td>
                    <td className="py-2.5">{d.estatisticas?.totalContratos || 0}</td>
                    <td className="py-2.5">{formatarMoeda(d.estatisticas?.ticketMedio || 0)}</td>
                    <td className="py-2.5 font-bold text-emerald-700">
                      {formatarMoeda(d.estatisticas?.valorTotalContratado || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Evolucao de Contratacoes</h2>
            {serieMensal.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="contratos" stroke="#0070C0" fill="#bfdbfe" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sem historico mensal suficiente para plotar serie temporal.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
              <ShieldCheck className="h-4 w-4 text-[#F97316]" /> Padroes Observados
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              <li>Total consolidado de {totalContratos} contrato(s) publico(s) nos CNPJs consultados.</li>
              {lider && (
                <li>
                  Maior frequencia concentrada no CNPJ {formatCnpjMask(lider.cnpj)} com{' '}
                  {lider.estatisticas?.orgaosContratantes || 0} orgao(s) distinto(s).
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
              <Target className="h-4 w-4 text-[#F97316]" /> Proximas Acoes Sugeridas
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              <li>Cruzar os CNPJs lideres no Radar de Irregularidades para verificar socios ou enderecos em comum.</li>
              <li>Simular proposta com reducao de 8% sobre os valores de referencia do PNCP na Central Luli.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigacaoConcorrencialPage;
