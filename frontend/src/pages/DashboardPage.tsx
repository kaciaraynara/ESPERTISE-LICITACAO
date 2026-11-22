import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Calendar,
  FolderOpen,
  FileCheck2,
  Bot,
  ShieldAlert,
  TrendingUp,
  Cpu,
  Briefcase,
  Calculator,
  ArrowRight,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { licitacoesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { FORNECEDOR_ROUTES } from '@/routes';

function formatarMoeda(valor: number | null | undefined): string {
  if (!valor || Number.isNaN(Number(valor))) return 'A definir';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

function formatarData(raw?: string | null): string {
  if (!raw) return 'Consultar edital';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Consultar edital';
  return d.toLocaleDateString('pt-BR');
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const nomeUsuario = (user as any)?.name || (user as any)?.nome || 'Licitante';

  const [editais, setEditais] = useState<any[]>([]);
  const [totalRadar, setTotalRadar] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resp = await licitacoesApi.listar({ local: true } as any);
        const lista = resp.data?.items || resp.data?.data || [];
        if (ativo) {
          setEditais(Array.isArray(lista) ? lista : []);
          setTotalRadar(Number(resp.data?.total || lista.length || 0));
        }
      } catch {
        if (ativo) setEditais([]);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const oportunidadesHoje = editais.filter((e) =>
    String(e.dataPublicacaoPncp || e.createdAt || '').startsWith(hojeStr)
  ).length;

  const ferramentas = [
    { titulo: 'Leitor de Edital (Luli)', icon: Bot, rota: FORNECEDOR_ROUTES.lex },
    { titulo: 'Análise de Irregularidades', icon: ShieldAlert, rota: FORNECEDOR_ROUTES.radar_nulidades },
    { titulo: 'Análise de Viabilidade', icon: TrendingUp, rota: FORNECEDOR_ROUTES.score_viabilidade },
    { titulo: 'Robô de Lance', icon: Cpu, rota: FORNECEDOR_ROUTES.robo_lances },
    { titulo: 'Histórico Concorrentes', icon: Briefcase, rota: FORNECEDOR_ROUTES.historico_concorrentes },
    { titulo: 'SRP e Gestão de Atas', icon: Calculator, rota: FORNECEDOR_ROUTES.srp },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-[#081C3A]">Olá, {nomeUsuario}!</h1>
          <p className="text-sm text-slate-500">
            Acompanhe suas oportunidades reais, alertas e ferramentas estratégicas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600"
        >
          Explorar Radar de Licitações <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Trilha Guiada - Por onde começar */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-[#081C3A] to-[#0f3460] p-4 sm:p-5 text-white shadow-sm">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#F97316]">
          Por onde começar — Fluxo Completo em 3 Passos
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
            className="rounded-xl bg-white/10 p-3 text-left transition hover:bg-white/20"
          >
            <div className="text-xs font-extrabold text-[#F97316]">Passo 1 · Encontrar Editais</div>
            <div className="mt-1 text-xs text-slate-100">Clique nos CNAEs da sua empresa no Radar para filtrar oportunidades reais.</div>
          </button>
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.score_viabilidade)}
            className="rounded-xl bg-white/10 p-3 text-left transition hover:bg-white/20"
          >
            <div className="text-xs font-extrabold text-[#F97316]">Passo 2 · Validar Viabilidade</div>
            <div className="mt-1 text-xs text-slate-100">Veja em quais certames vale mais a pena participar antes de gastar tempo.</div>
          </button>
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.lex)}
            className="rounded-xl bg-white/10 p-3 text-left transition hover:bg-white/20"
          >
            <div className="text-xs font-extrabold text-[#F97316]">Passo 3 · Analisar e Disputar</div>
            <div className="mt-1 text-xs text-slate-100">Leia o edital com a Luli, monte a proposta e controle os lances na Sala.</div>
          </button>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Target className="h-4 w-4 text-[#F97316]" /> Licitações no Radar
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{totalRadar}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Calendar className="h-4 w-4 text-[#0070C0]" /> Oportunidades Hoje
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{oportunidadesHoje}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FolderOpen className="h-4 w-4 text-[#081C3A]" /> Editais Carregados
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{editais.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FileCheck2 className="h-4 w-4 text-emerald-600" /> Status do Motor
          </div>
          <div className="mt-2 text-base font-extrabold text-emerald-700">PNCP Online</div>
        </div>
      </div>

      {/* Oportunidades em Destaque */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#081C3A]">Oportunidades em Destaque</h2>
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0] hover:underline"
          >
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" /> Carregando editais reais...
          </div>
        ) : editais.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Órgão</th>
                  <th className="py-2 pr-3">Objeto</th>
                  <th className="py-2 pr-3">Valor Estimado</th>
                  <th className="py-2 pr-3">Abertura / Prazo</th>
                  <th className="py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {editais.slice(0, 5).map((ed) => (
                  <tr key={ed.id || ed.numeroControlePNCP} className="border-b border-slate-100">
                    <td className="py-3 pr-3 font-bold text-[#081C3A]">
                      {ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Órgão Publico'}
                    </td>
                    <td className="max-w-md truncate py-3 pr-3 text-slate-700">
                      {ed.objeto || ed.objetoCompra || 'Objeto nao informado'}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-emerald-700">
                      {formatarMoeda(ed.valorTotalEstimado ?? ed.valorEstimado)}
                    </td>
                    <td className="py-3 pr-3 text-slate-500">
                      {formatarData(ed.dataAberturaProposta || ed.dataEncerramentoProposta)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`${FORNECEDOR_ROUTES.lex}?edital=${encodeURIComponent(ed.id || '')}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:border-[#F97316] hover:bg-orange-50"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-[#F97316]" /> Analisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-xs text-slate-500">
            Nenhum edital sincronizado no momento. Acesse o Radar de Licitações para buscar por UF ou CNAE.
          </p>
        )}
      </div>

      {/* Ferramentas Inteligentes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-extrabold text-[#081C3A]">Ferramentas Inteligentes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ferramentas.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.titulo}
                type="button"
                onClick={() => navigate(f.rota)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-center transition hover:border-[#F97316] hover:bg-orange-50/40"
              >
                <div className="rounded-xl bg-white p-2.5 text-[#F97316] shadow-xs">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#081C3A]">{f.titulo}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const FornecedorDashboardPage = DashboardPage;
export default DashboardPage;
