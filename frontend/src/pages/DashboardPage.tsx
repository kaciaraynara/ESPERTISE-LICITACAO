import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  RefreshCw,
  DollarSign,
  Trophy,
  AlertTriangle,
  Building2,
  ArrowRight,
  Package,
  Crosshair,
  FileCheck2,
  ChevronRight,
  CheckCircle2,
  Search,
  ShieldCheck,
  Target,
  Clock,
  Calendar,
  TrendingUp,
  FileText,
  Sparkles,
  Award,
  Check,
} from 'lucide-react';
import { dashboardApi, certidoesApi, crmApi, licitacoesApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '@/store/auth.store';
import { getTrialDaysLeft, isUserTrialActive } from '@/components/layout/Sidebar';

interface DashboardMetrics {
  isContaNova?: boolean;
  valorTotalEmDisputa: number;
  taxaSucesso: number;
  atencaoImediataCount: number;
  certidoesVencendoCount?: number;
  prazosUrgentesCount?: number;
  catalogItemsCount?: number;
  editaisMonitorados: number;
  analisesNulidade: number;
  propostasCriadas: number;
  prazosEstaSemana: number;
  crmOportunidades?: number;
  crmValorEmDisputa?: number;
  statsRadar?: {
    editaisAtivos: number;
    valorTotalEstimado: number;
    orgaosCompradores: number;
  };
  recomendacoes: Array<{
    id: string;
    orgao: string;
    uf: string;
    objeto: string;
    valor: number | null;
    modalidade?: string;
  }>;
  prazosCriticos: Array<{
    id: string;
    evento: string;
    data: string;
    tipo: string;
    edital?: string;
  }>;
}

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(data: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(data));
  } catch {
    return data;
  }
}


const DASHBOARD_METRICS_QUERY_KEY = ['dashboard', 'metrics'] as const;
const MANUAL_REFRESH_COOLDOWN_MS = 30_000;

/**
 * Converte qualquer falha técnica em mensagem de negócio.
 * Nunca expõe termos técnicos (status HTTP, IP, Axios, payload) ao usuário.
 */
function mensagemDeNegocio(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'Atualizando métricas financeiras... Aguarde alguns instantes.';
  if (status === 401 || status === 403) return 'Sua sessão está sendo validada. Atualize em instantes.';
  return 'Conexão temporariamente indisponível.';
}

function isRateLimited(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 429;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { selectedCompany } = useCompany();
  const lastManualRefreshRef = useRef(0);

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // A chave separa os dados por empresa e o refetch no mount garante dados atuais
  // ao alternar de empresa, mesmo quando já existe um resultado em cache.
  const metricsQuery = useQuery({
    queryKey: [...DASHBOARD_METRICS_QUERY_KEY, selectedCompany?.id ?? 'default'],
    queryFn: async (): Promise<DashboardMetrics> => {
      const { data } = await dashboardApi.getMetrics();
      if (!data?.success || !data?.data) {
        throw new Error('DASHBOARD_METRICS_INVALID_RESPONSE');
      }
      return data.data as DashboardMetrics;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const metrics = metricsQuery.data ?? null;
  const loading = metricsQuery.isFetching;
  const error = metricsQuery.isError ? mensagemDeNegocio(metricsQuery.error) : null;

  // Atualização manual com trava anti-rajada (evita novos 429).
  const carregarMetricas = useCallback(() => {
    const now = Date.now();
    const cooldown = isRateLimited(metricsQuery.error)
      ? MANUAL_REFRESH_COOLDOWN_MS * 2
      : MANUAL_REFRESH_COOLDOWN_MS;
    if (metricsQuery.isFetching || now - lastManualRefreshRef.current < cooldown) return;
    lastManualRefreshRef.current = now;
    void metricsQuery.refetch();
  }, [metricsQuery]);

  // Consulta de regularidade cadastral (SICAF) e certidões reais da empresa
  const certidoesQuery = useQuery({
    queryKey: ['certidoes', selectedCompany?.id ?? 'default'],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      try {
        const response = await certidoesApi.listar({ empresa_id: selectedCompany.id });
        const raw = response.data?.data ?? response.data?.certidoes ?? response.data;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(selectedCompany?.id),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const certidoes = certidoesQuery.data ?? [];

  // Metas de Contratos
  const editaisMonitorados = metrics?.editaisMonitorados ?? 0;
  const editaisTarget = 20;
  const progressoEditais = editaisMonitorados > 0 ? Math.min(100, Math.round((editaisMonitorados / editaisTarget) * 100)) : 0;

  const valorHomologado = metrics?.valorTotalEmDisputa ?? 0;
  const metaTrimestralTarget = 500000;
  const progressoMetaTrimestral = valorHomologado > 0 ? Math.min(100, Math.round((valorHomologado / metaTrimestralTarget) * 100)) : 0;


  // Licitações salvas do backend para Linha do Tempo e Assertividade
  const savedLicitacoesQuery = useQuery({
    queryKey: ['saved-licitacoes-dashboard', selectedCompany?.id ?? 'default'],
    queryFn: async () => {
      try {
        const res = await crmApi.getOportunidades();
        const raw = res.data?.data || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) return raw;

        // Fallback: busca licitações monitoradas/recentes do radar se o funil não tiver itens
        const fallbackRes = await licitacoesApi.listar({ tamanhoPagina: 5 });
        const fallbackData = fallbackRes.data?.data?.itens || fallbackRes.data?.itens || fallbackRes.data || [];
        return Array.isArray(fallbackData) ? fallbackData : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const savedLicitacoes = savedLicitacoesQuery.data ?? [];

  // Mapeamento normalizado para a Linha do Tempo (Órgão Público, Modalidade, Data da Sessão, Valor Estimado)
  const mappedTimeline = savedLicitacoes.slice(0, 5).map((item: any, idx: number) => {
    const notice = item.notice || item;
    const id = item.id || notice.id || `lic-${idx}`;
    const orgao = notice.buyerName || item.orgao || notice.orgao || 'Órgão Licitante';
    const uasg = notice.uasg || item.uasg || notice.cnpjOrgao || item.cnpjOrgao || (notice.uf ? `UF ${notice.uf}` : null);
    const modalidade = notice.modality || notice.modalidade || item.modalidade || 'Pregão Eletrônico';
    const rawData = notice.openingAt || notice.dataAbertura || item.dataAbertura || item.data_abertura || item.dataSessao || notice.data_abertura;
    const dataSessao = rawData ? formatarData(rawData) : 'A definir';
    const rawValor = notice.estimatedValue ?? notice.valorEstimado ?? item.valorEstimado ?? item.valor_estimado ?? item.valor ?? null;
    const valorEstimado = formatarMoeda(rawValor);
    const licitacaoId = notice.id || item.id || item.noticeId || '';

    return {
      id,
      licitacaoId,
      orgao,
      uasg,
      modalidade,
      dataSessao,
      valorEstimado,
    };
  });

  // Assertividade: Propostas Aceitas (Verde), Fase de Recurso (Laranja/Amarelo), Desclassificações (Vermelho)
  const propostasAceitasCount = savedLicitacoes.filter((i: any) =>
    ['ADJUDICADO', 'GANHO', 'HOMOLOGADO', 'VITORIA', 'ACEITA'].includes(String(i.stage || i.situacao || '').toUpperCase())
  ).length;

  const isContaNova =
    Boolean(metrics?.isContaNova) ||
    (!loading &&
      metrics &&
      metrics.valorTotalEmDisputa === 0 &&
      metrics.propostasCriadas === 0 &&
      (metrics.catalogItemsCount ?? 0) === 0);

  // Ranking dos Editais do Dia com Maior Chance de Vitória (Dados Reais do PNCP)
  const rankingEditaisQuery = useQuery({
    queryKey: ['ranking-editais-dashboard', selectedCompany?.id ?? 'default'],
    queryFn: async () => {
      try {
        const res = await licitacoesApi.listar({ tamanhoPagina: 10 });
        const raw = res.data?.data?.itens || res.data?.itens || res.data?.data || [];
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Score real de aderência quando calculado pelo backend; nunca inventado no frontend
  const getScoreReal = (edital: any): number | null => {
    const s = edital?.score?.pontuacao ?? edital?.scoreAderencia ?? edital?.score;
    const n = typeof s === 'number' ? s : Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const rawRanking: any[] = rankingEditaisQuery.data ?? [];
  const displayRanking = [...(rawRanking.length > 0 ? rawRanking : (metrics?.recomendacoes ?? []))]
    .sort((a: any, b: any) => (getScoreReal(b) ?? -1) - (getScoreReal(a) ?? -1))
    .slice(0, 5);

  // Mapeamento das 5 Certidões Obrigatórias da Lei 14.133/2021
  const findCertidao = (keywords: string[], esfera?: string) => {
    return certidoes.find((c: any) => {
      const nome = (c.nome || c.tipo || '').toLowerCase();
      const orgao = (c.orgao || '').toLowerCase();
      const esf = (c.esfera || '').toUpperCase();
      if (esfera && esf === esfera) return true;
      return keywords.some((kw) => nome.includes(kw) || orgao.includes(kw));
    });
  };

  const certFederal = findCertidao(['federal', 'pgfn', 'receita', 'inss', 'uniao'], 'FEDERAL');
  const certFgts = findCertidao(['fgts', 'crf', 'caixa']);
  const certTrabalhista = findCertidao(['trabalh', 'cndt', 'tst'], 'TRABALHISTA');
  const certEstadual = findCertidao(['estadual', 'sefaz', 'icms'], 'ESTADUAL');
  const certMunicipal = findCertidao(['municipal', 'prefeitura', 'iss'], 'MUNICIPAL');

  const cincoCertidoes = [
    {
      id: 'federal',
      nome: 'Receita Federal / PGFN',
      descricao: 'Tributos Federais e Contribuições Previdenciárias',
      item: certFederal,
      isValida: Boolean(certFederal && certFederal.status === 'VALIDA' && certFederal.regularidade !== 'IRREGULAR'),
      dias: certFederal?.validade ? Math.max(0, Math.ceil((new Date(certFederal.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null,
    },
    {
      id: 'fgts',
      nome: 'FGTS (CRF Caixa)',
      descricao: 'Certificado de Regularidade do FGTS',
      item: certFgts,
      isValida: Boolean(certFgts && certFgts.status === 'VALIDA' && certFgts.regularidade !== 'IRREGULAR'),
      dias: certFgts?.validade ? Math.max(0, Math.ceil((new Date(certFgts.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null,
    },
    {
      id: 'trabalhista',
      nome: 'CNDT Trabalhista (TST)',
      descricao: 'Certidão Negativa de Débitos Trabalhistas',
      item: certTrabalhista,
      isValida: Boolean(certTrabalhista && certTrabalhista.status === 'VALIDA' && certTrabalhista.regularidade !== 'IRREGULAR'),
      dias: certTrabalhista?.validade ? Math.max(0, Math.ceil((new Date(certTrabalhista.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null,
    },
    {
      id: 'estadual',
      nome: 'Fazenda Estadual',
      descricao: 'ICMS e Dívida Ativa Estadual',
      item: certEstadual,
      isValida: Boolean(certEstadual && certEstadual.status === 'VALIDA' && certEstadual.regularidade !== 'IRREGULAR'),
      dias: certEstadual?.validade ? Math.max(0, Math.ceil((new Date(certEstadual.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null,
    },
    {
      id: 'municipal',
      nome: 'Fazenda Municipal',
      descricao: 'ISS e Tributos Municipais',
      item: certMunicipal,
      isValida: Boolean(certMunicipal && certMunicipal.status === 'VALIDA' && certMunicipal.regularidade !== 'IRREGULAR'),
      dias: certMunicipal?.validade ? Math.max(0, Math.ceil((new Date(certMunicipal.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null,
    },
  ];

  const totalCertidoesValidas = cincoCertidoes.filter((c) => c.isValida).length;
  const saudeCertidoesPercent = Math.round((totalCertidoesValidas / 5) * 100);

  // Geometria do Donut SVG
  const radiusDonut = 48;
  const circDonut = 2 * Math.PI * radiusDonut;
  const dashoffsetDonut = circDonut - (saudeCertidoesPercent / 100) * circDonut;

  // Funil Visual de Licitações por Etapa
  const funilEtapas = [
    {
      step: 1,
      titulo: 'Prospecção',
      subtitulo: 'Radar PNCP',
      count: metrics?.editaisMonitorados || savedLicitacoes.length || 0,
      badge: 'Filtro por UF & Ramos',
      corBorda: 'border-blue-300',
      corFundo: 'bg-blue-50/70',
      corTexto: 'text-[#0070c0]',
      link: FORNECEDOR_ROUTES.radar,
    },
    {
      step: 2,
      titulo: 'Análise Técnica',
      subtitulo: 'Robô Lex & Riscos',
      count: metrics?.analisesNulidade ?? 0,
      badge: 'Atestados <= 50%',
      corBorda: 'border-orange-300',
      corFundo: 'bg-orange-50/70',
      corTexto: 'text-[#ff6600]',
      link: FORNECEDOR_ROUTES.lex,
    },
    {
      step: 3,
      titulo: 'Proposta Elaborada',
      subtitulo: 'Precificação & BDI',
      count: metrics?.propostasCriadas ?? 0,
      badge: 'Trava Stop-Loss',
      corBorda: 'border-emerald-300',
      corFundo: 'bg-emerald-50/70',
      corTexto: 'text-emerald-700',
      link: FORNECEDOR_ROUTES.precificacao_estrategica,
    },
    {
      step: 4,
      titulo: 'Disputa ao Vivo',
      subtitulo: 'Mesa de Lances',
      count: metrics?.crmOportunidades || metrics?.prazosEstaSemana || 0,
      badge: 'Aberto / Fechado',
      corBorda: 'border-slate-300',
      corFundo: 'bg-slate-100/80',
      corTexto: 'text-[#081c3a]',
      link: FORNECEDOR_ROUTES.disputa_ao_vivo,
    },
    {
      step: 5,
      titulo: 'Homologada / Vencida',
      subtitulo: 'Contratos Ganhos',
      count: propostasAceitasCount || 0,
      badge: `${metrics?.taxaSucesso ?? 0}% Sucesso`,
      corBorda: 'border-emerald-400',
      corFundo: 'bg-emerald-100/80',
      corTexto: 'text-emerald-800',
      link: FORNECEDOR_ROUTES.gestao_pos_vitoria,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-brand-light min-h-screen">
      {/* Header — Visão Geral das Licitações com Nome do Usuário */}
      <header data-tour="executive-header" className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-brand-blue capitalize">{dateLabel}</span>
            {user?.nome && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-600">Olá, {user.nome}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-dark">
            Visão Geral das Licitações
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            Inteligência estratégica, margem de lucro e governança sob a Lei 14.133/2021.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={FORNECEDOR_ROUTES.radar}
            data-tour="radar-opportunities"
            className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Crosshair className="w-4 h-4 shrink-0" />
            <span>Mercado Governamental</span>
          </Link>

          <button
            onClick={carregarMetricas}
            disabled={loading}
            title="Atualizar indicadores"
            className="h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          OS 4 ATALHOS ESTRATÉGICOS DE 1 CLIQUE (TOPO DA PÁGINA)
          ========================================================================= */}
      <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Atalhos Estratégicos">
        {/* 1. Buscar Editais Compatíveis (Radar) */}
        <Link
          to={FORNECEDOR_ROUTES.radar}
          className="group bg-white border border-slate-200 hover:border-brand-blue rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="w-8 h-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-black text-xs group-hover:bg-brand-blue group-hover:text-white transition-colors">
                1
              </span>
              <Crosshair className="w-5 h-5 text-brand-blue group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-black text-brand-dark group-hover:text-brand-blue transition-colors leading-snug">
              1. Buscar Editais Compatíveis
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consulte oportunidades publicadas no PNCP por UF e palavra-chave.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-blue">
            <span>Acessar Radar</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 2. Ler Resumo e Estratégia do Edital (Lex) */}
        <Link
          to={FORNECEDOR_ROUTES.lex}
          className="group bg-white border border-slate-200 hover:border-brand-orange rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="w-8 h-8 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center font-black text-xs group-hover:bg-brand-orange group-hover:text-white transition-colors">
                2
              </span>
              <FileText className="w-5 h-5 text-brand-orange group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-black text-brand-dark group-hover:text-brand-orange transition-colors leading-snug">
              2. Ler Resumo e Estratégia
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Análise com o Robô Lex: limites de atestados (Súmula 263) e impugnações.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-orange">
            <span>Consultar Lex</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 3. Montar Proposta (Planilha Estilo Excel) */}
        <Link
          to={FORNECEDOR_ROUTES.precificacao_estrategica}
          className="group bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                3
              </span>
              <DollarSign className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-black text-brand-dark group-hover:text-emerald-700 transition-colors leading-snug">
              3. Montar Proposta
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Planilha de Custos & BDI com trava automática de Stop-Loss.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>Simular BDI</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 4. Abrir Sala de Disputa e Lances Automáticos */}
        <Link
          to={FORNECEDOR_ROUTES.disputa_ao_vivo}
          className="group bg-white border border-slate-200 hover:border-brand-dark rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="w-8 h-8 rounded-xl bg-slate-100 text-brand-dark flex items-center justify-center font-black text-xs group-hover:bg-brand-dark group-hover:text-white transition-colors">
                4
              </span>
              <Target className="w-5 h-5 text-brand-dark group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-black text-brand-dark group-hover:text-brand-blue transition-colors leading-snug">
              4. Sala de Disputa e Lances
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Mesa Operacional ao vivo nos modos Aberto e Aberto-Fechado (IN 73/2022).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-dark">
            <span>Entrar na Sala</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      {/* =========================================================================
          GRÁFICO 1: FUNIL VISUAL DE LICITAÇÕES POR ETAPA
          ========================================================================= */}
      <section className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-5 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-brand-blue">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-brand-dark">
                Funil Visual de Licitações por Etapa
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento da esteira operacional: da prospecção à vitória homologada
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 self-start sm:self-auto">
            Esteira Dinâmica
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {funilEtapas.map((etapa) => (
            <Link
              key={etapa.step}
              to={etapa.link}
              className={`p-4 rounded-xl border ${etapa.corBorda} ${etapa.corFundo} flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-sm group`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-white text-xs font-black flex items-center justify-center shadow-xs">
                    {etapa.step}
                  </span>
                  <span className={`text-[11px] font-bold ${etapa.corTexto} bg-white/80 px-2 py-0.5 rounded-full`}>
                    {etapa.badge}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-brand-blue transition-colors">
                  {etapa.titulo}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {etapa.subtitulo}
                </p>
                <div className="text-2xl font-black text-brand-dark mt-3 tracking-tight">
                  {etapa.count}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    {etapa.count === 1 ? 'item' : 'itens'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Ver etapa</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =========================================================================
          GRÁFICO 2: ANEL DE SAÚDE DAS 5 CERTIDÕES OBRIGATÓRIAS + METAS DE CONTRATOS
          ========================================================================= */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Anel de Saúde das 5 Certidões Obrigatórias (Esquerda - 6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Anel de Saúde das 5 Certidões Obrigatórias
                  </h2>
                  <p className="text-xs text-slate-500">
                    Habilitação Fiscal e Trabalhista (Arts. 68 e 69 da Lei 14.133/2021)
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${totalCertidoesValidas === 5
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                {totalCertidoesValidas} de 5 Válidas
              </span>
            </div>

            {/* Layout com Donut SVG e Lista das 5 Certidões */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              {/* Donut Chart SVG */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center p-3">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r={radiusDonut}
                      className="text-slate-100"
                      strokeWidth="10"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r={radiusDonut}
                      className={saudeCertidoesPercent >= 80 ? 'text-emerald-500' : saudeCertidoesPercent >= 50 ? 'text-amber-500' : 'text-rose-500'}
                      strokeWidth="10"
                      strokeDasharray={circDonut}
                      strokeDashoffset={dashoffsetDonut}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-brand-dark tracking-tight">
                      {saudeCertidoesPercent}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Saúde
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500 mt-2 text-center">
                  {totalCertidoesValidas === 5 ? 'Apta para qualquer certame' : 'Atenção aos vencimentos'}
                </span>
              </div>

              {/* Lista das 5 Certidões Obrigatórias */}
              <div className="sm:col-span-7 space-y-2">
                {cincoCertidoes.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-800 truncate" title={cert.nome}>
                        {cert.nome}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {cert.descricao}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {cert.isValida ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" />
                          <span>Válida</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Pendente</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Conforme regularidade exigida no SICAF
            </span>
            <Link
              to={FORNECEDOR_ROUTES.certidoes}
              className="font-bold text-brand-blue hover:text-brand-dark transition flex items-center gap-1"
            >
              <span>Gerenciar Certidões</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Metas de Contratos & Indicadores (Direita - 6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-50 text-brand-orange">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Metas de Contratos & Assertividade
                  </h2>
                  <p className="text-xs text-slate-500">
                    Execução trimestral e taxa de conversão em disputas
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400">Ciclo Vigente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  1. Editais Salvos
                </span>
                <div className="text-xl font-black text-brand-dark">
                  {editaisMonitorados}
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-brand-blue rounded-full"
                    style={{ width: `${progressoEditais}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">{progressoEditais}% da meta</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  2. Capital em Jogo
                </span>
                <div className="text-lg font-black text-brand-orange truncate">
                  {formatarMoeda(valorHomologado)}
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-brand-orange rounded-full"
                    style={{ width: `${progressoMetaTrimestral}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">{progressoMetaTrimestral}% atingido</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  3. Taxa de Sucesso
                </span>
                <div className="text-xl font-black text-emerald-600">
                  {metrics?.taxaSucesso ?? 0}%
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${metrics?.taxaSucesso ?? 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Homologações</span>
              </div>
            </div>

            {/* Alerta de Prazos ou Dica Tática */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-brand-dark">
                  Dica Tática dos 40 Anos de Experiência:
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  No modo de disputa Aberto-Fechado (IN 73/2022), mantenha-se dentro da faixa de 10% do primeiro colocado durante a fase aberta para garantir convocação ao lance final sigiloso.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Métricas integradas à mesa operacional</span>
            <Link
              to={FORNECEDOR_ROUTES.crm}
              className="font-bold text-brand-orange hover:text-orange-600 transition flex items-center gap-1"
            >
              <span>Ver CRM Licitatório</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          GRÁFICO 3: RANKING DOS EDITAIS DO DIA COM MAIOR CHANCE DE VITÓRIA
          ========================================================================= */}
      <section className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-5 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 text-brand-orange">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-brand-dark">
                Ranking dos Editais do Dia com Maior Chance de Vitória
              </h2>
              <p className="text-xs text-slate-500">
                Oportunidades em aberto no PNCP ranqueadas por aderência e competitividade
              </p>
            </div>
          </div>
          <Link
            to={FORNECEDOR_ROUTES.radar}
            className="text-xs font-bold text-brand-blue hover:text-brand-dark transition flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Ver Todos os Editais no Radar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {displayRanking.length > 0 ? (
          <div className="space-y-3">
            {displayRanking.map((edital: any, index: number) => {
              const id = edital.id || `rank-${index}`;
              const orgao = edital.buyerName || edital.orgao || edital.nomeOrgao || 'Órgão Licitante';
              const uf = edital.uf || 'BR';
              const modalidade = edital.modality || edital.modalidade || 'Pregão Eletrônico';
              const objeto = edital.object || edital.objeto || 'Contratação regida pela Lei Federal nº 14.133/2021';
              const rawValor = edital.estimatedValue ?? edital.valorEstimado ?? edital.valor ?? null;
              const valorFormatado = rawValor && Number(rawValor) > 0 ? formatarMoeda(Number(rawValor)) : 'Orçamento Sigiloso / Ver Itens no TR';
              const score = getScoreReal(edital);

              return (
                <div
                  key={id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-brand-blue transition-all duration-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-xl bg-brand-dark text-white font-black text-xs flex items-center justify-center shrink-0">
                      {index + 1}º
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-blue-100">
                          {modalidade}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                          UF: {uf}
                        </span>
                        {score !== null && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Aderência: {score}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 truncate" title={orgao}>
                        {orgao}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                        {objeto}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Valor de Referência
                      </span>
                      <span className="text-sm font-black text-brand-dark">
                        {valorFormatado}
                      </span>
                    </div>

                    <Link
                      to={`${FORNECEDOR_ROUTES.lex}?editalId=${id}`}
                      className="h-9 px-3.5 rounded-lg bg-[#0070c0] hover:bg-[#081c3a] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                      <span>Analisar com Lex</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">
              Aguardando sincronização de editais do PNCP
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Acesse o Radar Governamental para buscar oportunidades ativas no seu segmento.
            </p>
            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="inline-block mt-3 h-8 px-4 leading-8 rounded-md bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold transition"
            >
              Abrir Radar
            </Link>
          </div>
        )}
      </section>

      {/* Alerta de Falha */}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-800">{error}</p>
            <button
              onClick={carregarMetricas}
              className="mt-1 text-xs font-bold text-rose-600 underline hover:text-rose-800"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Barra simples de status de teste & atalho rápido */}
      {isUserTrialActive(user) && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange border border-orange-200">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-brand-dark uppercase tracking-wide">
                    Período de Testes Ativo
                  </span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                    {getTrialDaysLeft(user)} dias restantes
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Acesso completo liberado a todas as ferramentas e busca de oportunidades da plataforma.
                </p>
              </div>
            </div>

            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Buscar Editais</span>
            </Link>
          </div>
        </section>
      )}

      {/* =========================================================================
          CAMINHO DO SUCESSO (ONBOARDING INTELIGENTE: ZERO ATRITO)
          ========================================================================= */}
      {isContaNova && (
        <section className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-brand-orange text-xs font-bold mb-3 border border-orange-200">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              Caminho do Sucesso Licitatório
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 text-brand-dark">
              Pronto para faturar sua primeira licitação?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 font-medium">
              Encontre oportunidades, consulte seus custos e prepare propostas organizadas de acordo com as exigências do edital.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Passo 1 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
                className="bg-slate-50 hover:bg-orange-50/40 border border-slate-200 hover:border-orange-200 rounded-xl p-4 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <Package className="w-4 h-4 text-brand-orange group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">
                  Cadastre seus Produtos
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cadastre seus produtos e custos para consultar sua margem ao preparar uma proposta.
                </p>
              </div>

              {/* Passo 2 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                className="bg-slate-50 hover:bg-orange-50/40 border border-slate-200 hover:border-orange-200 rounded-xl p-4 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <Crosshair className="w-4 h-4 text-brand-orange group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">
                  Oportunidades Sugeridas
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Explore oportunidades publicadas nos portais oficiais do governo.
                </p>
              </div>

              {/* Passo 3 */}
              <div
                onClick={() => navigate(FORNECEDOR_ROUTES.propostas)}
                className="bg-slate-50 hover:bg-orange-50/40 border border-slate-200 hover:border-orange-200 rounded-xl p-4 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <FileCheck2 className="w-4 h-4 text-brand-orange group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">
                  Gere sua Proposta
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Confira os itens identificados e revise seus preços antes de concluir.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate(FORNECEDOR_ROUTES.catalogo)}
              className="h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <span>Começar pelo Catálogo de Produtos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* =========================================================================
          SEÇÃO INFERIOR: LINHA DO TEMPO (INFERIOR ESQUERDA) & PRAZOS (INFERIOR DIREITA)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Linha do Tempo (Inferior Esquerda - 7 cols) */}
        <section
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:shadow-md"
          style={{ transition: 'all 0.3s ease' }}
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-brand-blue">
                  <Clock className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-dark">
                    Linha do Tempo
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Sessões públicas e licitações salvas na esteira
                  </p>
                </div>
              </div>

              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="text-xs font-bold text-brand-blue hover:text-brand-dark transition flex items-center gap-1"
              >
                <span>Explorar Radar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Tabela Limpa */}
            {mappedTimeline.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Órgão Público (UASG)</th>
                      <th className="py-2.5 px-3">Modalidade</th>
                      <th className="py-2.5 px-3">Data da Sessão</th>
                      <th className="py-2.5 px-3 text-right">Valor Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappedTimeline.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => item.licitacaoId && navigate(`/fornecedor/licitacao/${item.licitacaoId}`)}
                        className="group transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:bg-slate-50/80 cursor-pointer rounded-lg"
                        style={{ transition: 'all 0.3s ease' }}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[240px]">
                            {item.orgao}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {item.uasg ? (item.uasg.startsWith('UF') ? item.uasg : `UASG: ${item.uasg}`) : 'UASG: —'}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-brand-blue border border-blue-100">
                            {item.modalidade}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.dataSessao}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="text-xs font-black text-brand-dark">
                            {item.valorEstimado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Nenhuma licitação salva na esteira
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Acompanhe oportunidades no Radar Governamental e salve editais para visualizar o cronograma aqui.
                </p>
                <button
                  onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                  className="mt-4 h-8 px-4 rounded-md bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold transition"
                >
                  Conectar Oportunidades
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{mappedTimeline.length} licitações monitoradas</span>
            <span className="font-semibold text-brand-dark">Sincronizado com PNCP</span>
          </div>
        </section>

        {/* Prazos Críticos & Sessões Públicas (Inferior Direita - 5 cols) */}
        <section
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md"
          style={{ transition: 'all 0.3s ease' }}
        >
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Prazos Críticos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vencimentos e compromissos monitorados
                </p>
              </div>
              <button
                onClick={() => navigate(FORNECEDOR_ROUTES.prazos_alertas)}
                className="h-8 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1"
              >
                Ver todos
              </button>
            </div>

            {metrics?.prazosCriticos && metrics.prazosCriticos.length > 0 ? (
              <div className="space-y-3">
                {metrics.prazosCriticos.slice(0, 4).map((prazo) => (
                  <div
                    key={prazo.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                    style={{ transition: 'all 0.3s ease' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prazo.evento}</p>
                      {prazo.edital && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">Edital: {prazo.edital}</p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {prazo.tipo?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-black text-brand-dark">
                        {formatarData(prazo.data)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Nenhum prazo urgente vencendo hoje
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Sessões de disputa, recursos tempestivos e certidões em conformidade com o cronograma.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => navigate(FORNECEDOR_ROUTES.prazos_alertas)}
                    className="h-8 px-3 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cadastrar Prazo
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Agenda integrada</span>
            <span className="font-semibold text-brand-dark">Lei 14.133/2021</span>
          </div>
        </section>
      </div>

      {/* Mercado Governamental: Oportunidades no Banco Interno */}
      <section
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between mb-8 transition-all duration-300 ease-in-out hover:shadow-md"
        style={{ transition: 'all 0.3s ease' }}
      >
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Mercado Governamental Recente
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Oportunidades catalogadas no banco de dados interno
              </p>
            </div>
            <button
              onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
              className="h-8 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1"
            >
              Abrir Radar
            </button>
          </div>

          {metrics?.recomendacoes && metrics.recomendacoes.length > 0 ? (
            <div className="space-y-3">
              {metrics.recomendacoes.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => navigate(`/fornecedor/licitacao/${rec.id}`)}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ transition: 'all 0.3s ease' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {rec.orgao || 'Órgão Licitante'}
                        {rec.uf ? ` · ${rec.uf}` : ''}
                      </p>
                    </div>
                    {rec.modalidade && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                        {rec.modalidade}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                    {rec.objeto}
                  </p>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
                    <span className="text-slate-400 text-[10px] font-semibold">Valor Estimado</span>
                    <strong className="text-slate-900 font-black">
                      {formatarMoeda(rec.valor)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-slate-100">
              <Crosshair className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                Carregando oportunidades oficiais...
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Consulte os editais de Pregão Eletrônico e Dispensa gravados em nosso banco.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
                  className="h-8 px-4 rounded-md bg-brand-blue text-white text-xs font-bold hover:bg-slate-800 transition"
                >
                  Acessar Radar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
