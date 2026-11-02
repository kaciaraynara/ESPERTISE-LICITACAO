import React from 'react';
import { 
  BarChart3, Download, Award, TrendingUp, CheckCircle2, 
  ArrowUpRight, Loader2, Kanban, Building2, 
  ExternalLink, FileText, RefreshCw, AlertCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { crmApi } from '@services/api';
import { FORNECEDOR_ROUTES } from '@/routes';

interface EtapaStats {
  stage: string;
  label: string;
  count: number;
  valorTotal: number;
}

interface PortalStats {
  portal: string;
  total: number;
  vitorias: number;
  valorTotal: number;
  winRate: number;
}

interface UltimaOportunidade {
  id: string;
  stage: string;
  stageLabel: string;
  updatedAt: string;
  notice: {
    id: string;
    noticeNumber: string;
    buyerName: string;
    object: string;
    estimatedValue: number;
    portalName: string;
    uf: string | null;
  } | null;
}

interface MetricasPipelineData {
  totalPipeline: number;
  valorTotalEmDisputa: number;
  taxaConversao: number;
  sessoesHoje: number;
  vitorias: number;
  derrotas: number;
  arquivados: number;
  faturamentoAdjudicado: number;
  ticketMedio: number;
  porEtapa: EtapaStats[];
  desempenhoPorPortal: PortalStats[];
  ultimasOportunidades: UltimaOportunidade[];
}

export const RelatoriosPage: React.FC = () => {
  const { data: resp, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['crm_metricas_relatorios'],
    queryFn: async () => {
      const res = await crmApi.getMetrics();
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const metrics: MetricasPipelineData | null = resp?.data || null;

  const formatarMoeda = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatarData = (data: string | null | undefined) => {
    if (!data) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(data));
    } catch {
      return data;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 sm:p-8">
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
              <BarChart3 size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Relatórios e Resultados
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulte o resumo das suas disputas e os resultados registrados pela empresa.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Atualizar Dados
          </button>

          <button 
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Download size={16} /> EXPORTAR RELATÓRIO (PDF)
          </button>
        </div>
      </header>

      {/* LOADING STATE */}
      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 shadow-sm text-center flex flex-col items-center justify-center">
          <Loader2 size={36} className="animate-spin text-[#0A2540] mb-3" />
          <h3 className="text-sm font-black text-slate-900">Carregando métricas da sua operação...</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Consultando registros de disputas, histórico de vitórias e valores em andamento no banco de dados.
          </p>
        </div>
      )}

      {/* ERROR STATE */}
      {isError && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl mb-8 flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-900">Falha ao carregar relatórios estratégicos</h3>
            <p className="text-xs text-rose-700 mt-1">
              {(error as any)?.response?.data?.message || 'Conexão com os portais governamentais temporariamente indisponível. Tentando novamente...'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* EMPTY STATE HONESTO: Sem editais no funil */}
      {!isLoading && !isError && metrics && metrics.totalPipeline === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center max-w-2xl mx-auto my-8">
          <div className="bg-slate-100 p-4 rounded-full inline-flex mb-4">
            <Kanban size={36} className="text-slate-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-2">
            Nenhum edital cadastrado na sua Gestão de Disputas
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Os Relatórios Estratégicos calculam dinamicamente sua taxa de conversão (Win Rate), volume financeiro em disputa, faturamento adjudicado e ticket médio a partir das oportunidades ativas na sua Gestão de Disputas.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs text-slate-600 space-y-2 mb-6">
            <p className="font-bold text-slate-800">Como ativar suas métricas reais:</p>
            <p>1. Acesse o <strong>Radar de Editais</strong> e selecione oportunidades de interesse.</p>
            <p>2. Clique em <strong>Disputar / Adicionar à Esteira</strong> para enviar o edital à Gestão de Disputas.</p>
            <p>3. Conforme você avança de etapa (Proposta, Disputa, Habilitação e Vitória), seus gráficos e relatórios serão gerados automaticamente.</p>
          </div>
          <Link
            to={FORNECEDOR_ROUTES.radar}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0A2540] hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow transition"
          >
            Ir para o Radar de Editais
          </Link>
        </div>
      )}

      {/* DASHBOARD REAL COM DADOS REAIS */}
      {!isLoading && !isError && metrics && metrics.totalPipeline > 0 && (
        <div className="space-y-8">
          {/* KPI TOP CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Faturamento Adjudicado
                </span>
                <Award size={18} className="text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-700 block">
                {formatarMoeda(metrics.faturamentoAdjudicado)}
              </span>
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600" />
                {metrics.vitorias} edital(is) com vitória homologada
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Taxa de Vitória (Win Rate)
                </span>
                <TrendingUp size={18} className="text-blue-500" />
              </div>
              <span className="text-2xl font-black text-blue-700 block">
                {metrics.taxaConversao}%
              </span>
              <div className="text-[11px] font-bold text-slate-500">
                {metrics.vitorias} vitórias em {metrics.vitorias + metrics.derrotas > 0 ? metrics.vitorias + metrics.derrotas : metrics.totalPipeline} processos
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Volume em Disputa Ativa
                </span>
                <ArrowUpRight size={18} className="text-[#EA580C]" />
              </div>
              <span className="text-2xl font-black text-slate-900 block">
                {formatarMoeda(metrics.valorTotalEmDisputa)}
              </span>
              <div className="text-[11px] font-bold text-slate-500">
                Oportunidades em preparação e pregão
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Ticket Médio Homologado
                </span>
                <Building2 size={18} className="text-slate-400" />
              </div>
              <span className="text-2xl font-black text-slate-900 block">
                {formatarMoeda(metrics.ticketMedio)}
              </span>
              <div className="text-[11px] font-bold text-slate-500">
                Média financeira por vitória
              </div>
            </div>
          </div>

          {/* DISTRIBUIÇÃO POR ETAPAS DO FUNIL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Distribuição de Editais por Etapa da Esteira
                </h3>
                <p className="text-xs text-slate-500">
                  Total de {metrics.totalPipeline} oportunidades distribuídas na esteira estratégica
                </p>
              </div>
              <Link
                to={FORNECEDOR_ROUTES.disputas}
                className="text-xs font-bold text-[#0A2540] hover:underline flex items-center gap-1"
              >
                Abrir Gestão de Disputas <ExternalLink size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.porEtapa.map((etapa) => {
                const percentual = metrics.totalPipeline > 0 ? Math.round((etapa.count / metrics.totalPipeline) * 100) : 0;
                return (
                  <div key={etapa.stage} className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 truncate">{etapa.label}</span>
                      <span className="text-xs font-black text-[#0A2540] bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                        {etapa.count}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${etapa.stage === 'GANHO' ? 'bg-emerald-500' : etapa.stage === 'PERDIDO' ? 'bg-rose-500' : 'bg-[#0A2540]'}`}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{percentual}% do funil</span>
                      <span className="font-bold text-slate-700">{formatarMoeda(etapa.valorTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DESEMPENHO POR PORTAL & ÚLTIMAS MOVIMENTAÇÕES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ESQUERDA: DESEMPENHO POR PORTAL DE COMPRAS */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Award size={18} className="text-[#EA580C]" />
                Desempenho por Portal de Compras
              </h3>
              <p className="text-xs text-slate-500">
                Estatísticas apuradas com base nos órgãos e portais oficiais dos seus editais
              </p>

              {metrics.desempenhoPorPortal.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhum portal mapeado ainda.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {metrics.desempenhoPorPortal.map((portal) => (
                    <div
                      key={portal.portal}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <strong className="text-xs font-black text-slate-900 block">
                          {portal.portal}
                        </strong>
                        <span className="text-slate-500 text-[11px]">
                          {portal.total} edital(is) | {portal.vitorias} vitória(s) | {formatarMoeda(portal.valorTotal)}
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg self-start sm:self-auto">
                        {portal.winRate}% Win Rate
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DIREITA: ÚLTIMAS OPORTUNIDADES NO PIPELINE */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-[#0A2540]" />
                Últimas Movimentações na Esteira
              </h3>
              <p className="text-xs text-slate-500">
                Editais recentemente atualizados na sua esteira de disputas
              </p>

              {metrics.ultimasOportunidades.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {metrics.ultimasOportunidades.slice(0, 5).map((op) => (
                    <div
                      key={op.id}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-black text-slate-900 truncate">
                            {op.notice?.buyerName || 'Órgão não especificado'}
                          </span>
                          {op.notice?.uf && (
                            <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                              {op.notice.uf}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {op.notice?.object || op.notice?.noticeNumber || 'Edital em processo'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-bold text-slate-800 block">
                          {formatarMoeda(op.notice?.estimatedValue)}
                        </span>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {formatarData(op.updatedAt)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            op.stage === 'GANHO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : op.stage === 'PERDIDO'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {op.stageLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RelatoriosPage;