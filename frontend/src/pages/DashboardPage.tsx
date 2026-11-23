import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Calendar,
  FolderOpen,
  FileCheck2,
  FileText,
  ShieldAlert,
  TrendingUp,
  Cpu,
  Briefcase,
  Calculator,
  ArrowRight,
  BarChart3,
  Loader2,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { dashboardApi, licitacoesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
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
  const { selectedCompany } = useCompany();
  const nomeUsuario = (user as any)?.name || (user as any)?.nome || 'Licitante';

  const [editais, setEditais] = useState<any[]>([]);
  const [totalRadar, setTotalRadar] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    document.title = 'Painel de Comando | Expertise Licitatória';
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setCarregando(true);
        const radarFiltros: Record<string, any> = { local: true, limite: 8 };

        if (selectedCompany?.cnaePrincipal) {
          radarFiltros.cnae = selectedCompany.cnaePrincipal;
        }
        if (selectedCompany?.palavrasChave?.length) {
          radarFiltros.palavras = selectedCompany.palavrasChave;
        }
        if (selectedCompany?.id) {
          radarFiltros.empresa_id = selectedCompany.id;
        }

        const [radarResp, metricsResp] = await Promise.allSettled([
          licitacoesApi.listar(radarFiltros as any),
          dashboardApi.getMetrics(),
        ]);

        if (!ativo) return;

        if (radarResp.status === 'fulfilled') {
          const lista = radarResp.value.data?.items || radarResp.value.data?.data || [];
          setEditais(Array.isArray(lista) ? lista : []);
          setTotalRadar(Number(radarResp.value.data?.total || lista.length || 0));
        } else {
          setEditais([]);
        }

        if (metricsResp.status === 'fulfilled') {
          const m = metricsResp.value.data?.data ?? null;
          setMetrics(m);
          if (m?.statsRadar?.editaisAtivos && Number(m.statsRadar.editaisAtivos) > 0) {
            setTotalRadar(Number(m.statsRadar.editaisAtivos));
          }
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [selectedCompany?.id, selectedCompany?.cnaePrincipal]);

  const totalRadarExibido = Number(metrics?.statsRadar?.editaisAtivos || totalRadar || 0);
  const propostasCriadas = Number(metrics?.propostasCriadas || 0);
  const atencaoImediata = Number(metrics?.atencaoImediataCount || 0);
  const valorDisputa = Number(metrics?.valorTotalEmDisputa || 0);

  const ferramentas = [
    { titulo: 'Catálogo CATMAT / Preços', icon: Package, rota: FORNECEDOR_ROUTES.catalogo },
    { titulo: 'SICAF & Certidões', icon: ShieldCheck, rota: FORNECEDOR_ROUTES.sicaf_credenciamento },
    { titulo: 'Análise Técnica de Edital', icon: FileText, rota: FORNECEDOR_ROUTES.lex },
    { titulo: 'Precificação Estratégica', icon: Calculator, rota: FORNECEDOR_ROUTES.precificacao_estrategica },
    { titulo: 'Análise de Irregularidades', icon: ShieldAlert, rota: FORNECEDOR_ROUTES.radar_nulidades },
    { titulo: 'Sala de Disputa & Lances', icon: Cpu, rota: FORNECEDOR_ROUTES.disputa_ao_vivo },
    { titulo: 'Histórico Concorrentes', icon: Briefcase, rota: FORNECEDOR_ROUTES.historico_concorrentes },
    { titulo: 'Análise de Viabilidade', icon: TrendingUp, rota: FORNECEDOR_ROUTES.score_viabilidade },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#081C3A]">Olá, {nomeUsuario}!</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe suas oportunidades reais, prazos, referências CATMAT/CATSER e ferramentas estratégicas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 self-start md:self-auto"
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
            <div className="mt-1 text-xs text-slate-100">Filtre oportunidades reais no Radar por CNAE, UF ou objeto.</div>
          </button>
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
            className="rounded-xl bg-white/10 p-3 text-left transition hover:bg-white/20"
          >
            <div className="text-xs font-extrabold text-[#F97316]">Passo 2 · Consultar CATMAT & Custos</div>
            <div className="mt-1 text-xs text-slate-100">Veja preços praticados no Compras.gov.br/PNCP e forme sua margem.</div>
          </button>
          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.propostas)}
            className="rounded-xl bg-white/10 p-3 text-left transition hover:bg-white/20"
          >
            <div className="text-xs font-extrabold text-[#F97316]">Passo 3 · Emitir Proposta & Disputar</div>
            <div className="mt-1 text-xs text-slate-100">Gere proposta em Word/PDF pela Lei 14.133/2021 e controle os lances.</div>
          </button>
        </div>
      </div>

      {/* 4 KPIs REAIS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Target className="h-4 w-4 text-[#F97316]" /> Editais Indexados (Base Real)
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[#081C3A]">
            {totalRadarExibido.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FileCheck2 className="h-4 w-4 text-emerald-600" /> Propostas Geradas
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[#081C3A]">{propostasCriadas}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Calendar className="h-4 w-4 text-[#0070C0]" /> Alertas (Prazos / Certidões)
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[#081C3A]">{atencaoImediata}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FolderOpen className="h-4 w-4 text-[#081C3A]" /> Oportunidades em Acompanhamento
          </div>
          <div className="mt-2 text-base sm:text-xl font-extrabold text-emerald-700">
            {valorDisputa > 0 ? formatarMoeda(valorDisputa) : `${metrics?.editaisMonitorados ?? 0} monitorado(s)`}
          </div>
        </div>
      </div>

      {/* Oportunidades em Destaque */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
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
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {editais.slice(0, 5).map((ed) => (
                <div key={ed.id || ed.numeroControlePNCP} className="py-3 space-y-2">
                  <p className="text-xs font-bold text-[#081C3A]">
                    {ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Órgão Público'}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {ed.objeto || ed.objetoCompra || 'Objeto não informado'}
                  </p>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-semibold text-emerald-700">
                      {formatarMoeda(ed.valorTotalEstimado ?? ed.valorEstimado)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`${FORNECEDOR_ROUTES.lex}?edital=${encodeURIComponent(ed.id || '')}`)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-[#081C3A]"
                    >
                      <BarChart3 className="h-3.5 w-3.5 text-[#F97316]" /> Analisar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
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
                        {ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Órgão Público'}
                      </td>
                      <td className="max-w-md truncate py-3 pr-3 text-slate-700">
                        {ed.objeto || ed.objetoCompra || 'Objeto não informado'}
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
          </>
        ) : (
          <p className="py-6 text-xs text-slate-500">
            Nenhum edital sincronizado no momento. Acesse o Radar de Licitações para buscar por UF ou CNAE.
          </p>
        )}
      </div>

      {/* Ferramentas Inteligentes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <h2 className="mb-4 text-base font-extrabold text-[#081C3A]">Ferramentas Inteligentes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
