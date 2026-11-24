import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Search,
  Loader2,
  Award,
  TrendingUp,
  MapPin,
  Layers,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';
import api, { concorrentesApi } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

interface DossieItem {
  cnpj: string;
  razaoSocial?: string;
  estatisticas: {
    totalContratos: number;
    valorTotalContratado: number;
    ticketMedio: number;
    maiorContrato: number;
    orgaosContratantes?: number;
    órgãosContratantes?: number;
    porOrgao?: Array<{ orgao: string; total: number; valorTotal: number }>;
    porÓrgão?: Array<{ orgao: string; total: number; valorTotal: number }>;
    porModalidade?: Record<string, number>;
  };
  contratos: Array<{
    id: string;
    numeroContrato: string | null;
    objeto: string | null;
    orgao: string | null;
    modalidade: string | null;
    valor: number;
    dataPublicacao: string | null;
    url: string | null;
  }>;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

export const HistoricoConcorrentesPage: React.FC = () => {
  const [cnpjs, setCnpjs] = useState<string[]>(['', '']);
  const [abaAtiva, setAbaAtiva] = useState<'ranking' | 'regiao' | 'atividades' | 'potencial'>('ranking');
  const [carregando, setCarregando] = useState(false);
  const [dossies, setDossies] = useState<DossieItem[]>([]);
  const { selectedCompany } = useCompany();
  const [sugeridos, setSugeridos] = useState<Array<{ cnpj: string; razaoSocial: string; uf?: string; porte?: string; totalVitorias?: number }>>([]);

  useEffect(() => {
    const cnae = (selectedCompany as any)?.cnaePrincipal || (selectedCompany as any)?.cnae_principal || '';
    const uf = (selectedCompany as any)?.estado || (selectedCompany as any)?.uf || '';
    if (!cnae) return;
    concorrentesApi.descoberta({ cnae: String(cnae), uf: uf ? String(uf) : undefined })
      .then((res) => {
        const lista = res?.data?.data?.concorrentesCnae || [];
        if (Array.isArray(lista) && lista.length > 0) {
          setSugeridos(lista.slice(0, 6));
          const iniciais = lista.slice(0, 3).map((x: any) => formatCnpjMask(x.cnpj));
          setCnpjs((prev) => (prev.every((c) => !c.trim()) ? iniciais : prev));
          consultarConcorrentes(iniciais, true);
        }
      })
      .catch(() => null);
  }, [selectedCompany]);

  const atualizarCnpj = (idx: number, valor: string) => {
    const copia = [...cnpjs];
    copia[idx] = formatCnpjMask(valor);
    setCnpjs(copia);
  };

  const adicionarCampoCnpj = () => {
    if (cnpjs.length >= 6) {
      toast.error('Limite de 6 concorrentes por comparativo.');
      return;
    }
    setCnpjs([...cnpjs, '']);
  };

  const removerCampoCnpj = (idx: number) => {
    if (cnpjs.length <= 1) return;
    setCnpjs(cnpjs.filter((_, i) => i !== idx));
  };

  const consultarConcorrentes = async (cnpjsOverride?: string[] | unknown, silencioso = false) => {
    const origem = Array.isArray(cnpjsOverride) ? cnpjsOverride : cnpjs;
    const validos = origem
      .map((c) => sanitizeCnpj(c))
      .filter((c) => isValidCnpj(c, { optional: false }));

    if (validos.length === 0) {
      toast.error('Digite ou selecione pelo menos um CNPJ válido para consultar.');
      return;
    }

    setCarregando(true);
    try {
      const resp = await api.post('/concorrentes/historico', { cnpjs: Array.from(new Set(validos)) }, { timeout: 30000 });
      const resultados = (resp.data?.data || []) as DossieItem[];
      setDossies(resultados);
      if (!silencioso) toast.success(`${resultados.length} concorrente(s) analisado(s) com dados reais.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Não foi possível consultar os concorrentes agora.');
    } finally {
      setCarregando(false);
    }
  };

  const totalContratos = dossies.reduce((s, d) => s + (d.estatisticas?.totalContratos || 0), 0);
  const valorGlobal = dossies.reduce((s, d) => s + (d.estatisticas?.valorTotalContratado || 0), 0);
  const totalÓrgãos = dossies.reduce(
    (s, d) => s + (d.estatisticas?.orgaosContratantes ?? d.estatisticas?.órgãosContratantes ?? 0),
    0
  );
  const ticketMedioGeral = totalContratos > 0 ? valorGlobal / totalContratos : 0;

  const dadosGraficoÓrgãos = dossies
    .flatMap((d) => d.estatisticas?.porOrgao || d.estatisticas?.porÓrgão || [])
    .slice(0, 6)
    .map((o) => ({
      nome: o.orgao.length > 22 ? o.orgao.slice(0, 22) + '...' : o.orgao,
      contratos: o.total,
      valor: o.valorTotal,
    }));

  const modalidadesMapa: Record<string, number> = {};
  dossies.forEach((d) => {
    Object.entries(d.estatisticas?.porModalidade || {}).forEach(([mod, qtd]) => {
      modalidadesMapa[mod] = (modalidadesMapa[mod] || 0) + qtd;
    });
  });
  const listaModalidades = Object.entries(modalidadesMapa).map(([nome, qtd]) => ({ nome, qtd }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Cabecalho */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">Histórico de Concorrentes</h1>
            <p className="text-xs text-slate-500">
              Conheça os concorrentes, onde atuam, suas vitórias e principais contratações reais no PNCP
            </p>
          </div>
        </div>
      </div>

      {/* Painel de entrada dinamica com + Adicionar CNPJ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            CNPJs para Comparativo de Histórico
          </span>
          <button
            type="button"
            onClick={adicionarCampoCnpj}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#081C3A] px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar CNPJ
          </button>
        </div>

        {sugeridos.length > 0 && (
          <div className="mb-4 w-full rounded-xl border border-blue-200 bg-blue-50/70 p-3">
            <p className="mb-2 text-xs font-semibold text-blue-900">
              Concorrentes do seu segmento com atuação em licitações (PNCP / Compras.gov.br) — clique para incluir:
            </p>
            <div className="flex flex-wrap gap-2">
              {sugeridos.map((s) => (
                <button
                  key={s.cnpj}
                  type="button"
                  onClick={() => {
                    const masked = formatCnpjMask(s.cnpj);
                    setCnpjs((prev) => (prev.includes(masked) ? prev : [...prev.filter(Boolean), masked].slice(0, 6)));
                  }}
                  className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-900 hover:bg-blue-100 transition"
                >
                  + {s.razaoSocial.slice(0, 32)} {s.uf ? `(${s.uf})` : ''} {s.totalVitorias ? `· ${s.totalVitorias} vitórias` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cnpjs.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={val}
                onChange={(e) => atualizarCnpj(idx, e.target.value)}
                placeholder={`CNPJ Concorrente ${idx + 1} (00.000.000/0000-00)`}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#081C3A]"
              />
              {cnpjs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerCampoCnpj(idx)}
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
            onClick={consultarConcorrentes}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Consultar Histórico Real
          </button>
        </div>
      </div>

      {/* 5 KPIs do Mockup */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Building2 className="h-4 w-4 text-[#081C3A]" /> Concorrentes
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{dossies.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Award className="h-4 w-4 text-[#F97316]" /> Contratos / Vitórias
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{totalContratos}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Ticket Médio
          </div>
          <div className="mt-2 text-lg font-extrabold text-[#081C3A]">{formatarMoeda(ticketMedioGeral)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <MapPin className="h-4 w-4 text-[#0070C0]" /> Órgãos Atendidos
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{totalÓrgãos}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Layers className="h-4 w-4 text-[#F97316]" /> Modalidades
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{listaModalidades.length}</div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'ranking', label: 'Ranking de Concorrentes', icon: Award },
          { id: 'regiao', label: 'Órgãos e Atuacao', icon: MapPin },
          { id: 'atividades', label: 'Modalidades Frequentes', icon: Layers },
          { id: 'potencial', label: 'Análise de Potencial', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id as any)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                active
                  ? 'bg-[#F97316] text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Graficos e Tabela */}
      {dossies.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">
              Órgãos com Maior Concentracao de Contratos
            </h2>
            {dadosGraficoÓrgãos.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoÓrgãos} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="nome" type="category" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="contratos" fill="#081C3A" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sem distribuicao por orgao nos contratos retornados.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Principais Modalidades Disputadas</h2>
            {listaModalidades.length > 0 ? (
              <div className="space-y-3">
                {listaModalidades.map((m) => (
                  <div key={m.nome} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{m.nome}</span>
                      <span>{m.qtd} contrato(s)</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#F97316]"
                        style={{ width: `${Math.min(100, (m.qtd / Math.max(1, totalContratos)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma modalidade registrada neste periodo.</p>
            )}
          </div>

          {/* Tabela Ranking */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">
              Principais Concorrentes da Disputa (Dados Reais)
            </h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">CNPJ</th>
                  <th className="py-2 pr-3">Potencial</th>
                  <th className="py-2 pr-3">Contratos</th>
                  <th className="py-2 pr-3">Volume Contratado</th>
                  <th className="py-2 pr-3">Maior Contrato</th>
                  <th className="py-2">Órgãos</th>
                </tr>
              </thead>
              <tbody>
                {dossies.map((d) => {
                  const alto = (d.estatisticas?.totalContratos || 0) >= 5;
                  return (
                    <tr key={d.cnpj} className="border-b border-slate-100">
                      <td className="py-3 pr-3">
                        <div className="font-bold text-[#081C3A]">{(d as any).razaoSocial || formatCnpjMask(d.cnpj)}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatCnpjMask(d.cnpj)} {(d as any).uf ? `· ${(d as any).municipio || ''}/${(d as any).uf}` : ''} {(d as any).situacao ? `· ${(d as any).situacao}` : ''}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            alto ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {alto ? 'Alto' : 'Medio'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-semibold">{d.estatisticas?.totalContratos || 0}</td>
                      <td className="py-3 pr-3 font-bold text-emerald-700">
                        {formatarMoeda(d.estatisticas?.valorTotalContratado || 0)}
                      </td>
                      <td className="py-3 pr-3">{formatarMoeda(d.estatisticas?.maiorContrato || 0)}</td>
                      <td className="py-3">{d.estatisticas?.orgaosContratantes ?? d.estatisticas?.['órgãosContratantes'] ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {abaAtiva === 'potencial' && dossies.some((d) => d.contratos?.length > 0) && (
              <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold text-[#081C3A]">Contratos Recentes Localizados</h3>
                {dossies.flatMap((d) => d.contratos || []).slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <span className="truncate pr-4 font-medium text-slate-700">
                      {c.orgao || 'Órgão'} — {c.objeto || 'Objeto nao informado'}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-bold text-[#081C3A]">{formatarMoeda(c.valor)}</span>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-[#0070C0] hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Adicione um ou mais CNPJs acima e clique em <strong>Consultar Histórico Real</strong> para montar os graficos e o ranking.
        </div>
      )}
    </div>
  );
};

export default HistoricoConcorrentesPage;
