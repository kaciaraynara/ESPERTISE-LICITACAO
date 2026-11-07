import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  MapPin,
  Calendar,
  ArrowRight,
  Zap,
  FileCheck2,
  Trophy,
  Trash2,
  Plus,
  DollarSign,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Search,
  Scale,
  Crosshair,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { crmApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import toast from 'react-hot-toast';

type PipelineItem = {
  id: string;
  stage: string;
  position: number;
  notes?: string | null;
  notice: {
    id: string;
    noticeNumber: string | null;
    buyerName: string | null;
    buyerDocument: string | null;
    estimatedValue: number | null;
    object: string | null;
    openingAt: string | null;
    status: string | null;
    source: string | null;
    externalId: string | null;
    uf: string | null;
    municipality: string | null;
  } | null;
};

type ColunaEsteira = {
  id: string;
  nome: string;
  aliases: string[];
  corBarra: string;
  corFundo: string;
  icon: any;
  descricao: string;
};

// As etapas reais da vida de um licitante vencedor (Lei 14.133/2021)
const COLUNAS_ESTEIRA: ColunaEsteira[] = [
  {
    id: 'MAPEADAS',
    nome: 'Mapeadas (Radar)',
    aliases: ['OPORTUNIDADE', 'MAPEADAS', 'MAPPING'],
    corBarra: 'bg-slate-400',
    corFundo: 'border-slate-200 bg-white',
    icon: Crosshair,
    descricao: 'Editais selecionados no radar',
  },
  {
    id: 'ANALISE',
    nome: 'Análise de Viabilidade',
    aliases: ['ANALISE', 'ANALISE_LEX'],
    corBarra: 'bg-blue-500',
    corFundo: 'border-blue-200 bg-blue-50/20',
    icon: Scale,
    descricao: 'Custos, BDI e risco jurídico',
  },
  {
    id: 'PROPOSTA',
    nome: 'Proposta Pronta',
    aliases: ['PROPOSTA'],
    corBarra: 'bg-amber-500',
    corFundo: 'border-amber-200 bg-amber-50/20',
    icon: FileText,
    descricao: 'Preço sustentável e compliance',
  },
  {
    id: 'DISPUTA',
    nome: 'Sessão Pública / Lances',
    aliases: ['DISPUTA'],
    corBarra: 'bg-orange-500',
    corFundo: 'border-orange-200 bg-orange-50/20',
    icon: Zap,
    descricao: 'Pregão eletrônico e lances',
  },
  {
    id: 'RECURSO',
    nome: 'Fase Recursal',
    aliases: ['RECURSO'],
    corBarra: 'bg-purple-500',
    corFundo: 'border-purple-200 bg-purple-50/20',
    icon: Scale,
    descricao: 'Prazos de recurso e contrarrazões',
  },
  {
    id: 'ADJUDICADO',
    nome: 'Adjudicado / Contrato',
    aliases: ['ADJUDICADO', 'GANHO', 'HOMOLOGADO'],
    corBarra: 'bg-emerald-500',
    corFundo: 'border-emerald-300 bg-emerald-50/30',
    icon: Trophy,
    descricao: 'Vitória e execução contratual',
  },
];

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(data: string | null | undefined): string {
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
}

export default function CrmKanbanPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Consulta as disputas persistidas no banco
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['disputas-esteira'],
    queryFn: async () => {
      const res = await crmApi.getOportunidades();
      return (res.data?.data || []) as PipelineItem[];
    },
  });

  // Consulta métricas agregadas em tempo real
  const { data: metricas } = useQuery({
    queryKey: ['disputas-metrics'],
    queryFn: async () => {
      const res = await crmApi.getMetrics();
      return res.data?.data;
    },
  });

  // Mutação para avançar/mover disputa de etapa
  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      await crmApi.moveOportunidade(id, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputas-esteira'] });
      queryClient.invalidateQueries({ queryKey: ['disputas-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Disputa atualizada na esteira!');
    },
    onError: () => {
      toast.error('Erro ao atualizar a etapa da disputa.');
    },
  });

  // Mutação para arquivar/remover disputa
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await crmApi.removeOportunidade(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputas-esteira'] });
      queryClient.invalidateQueries({ queryKey: ['disputas-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Disputa removida com sucesso');
    },
    onError: () => {
      toast.error('Erro ao remover disputa');
    },
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id && draggedItemId === id) {
      const item = items.find((i) => i.id === id);
      if (item && item.stage !== targetStage) {
        moveMutation.mutate({ id, stage: targetStage });
      }
    }
    setDraggedItemId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Deseja remover esta disputa da sua esteira?')) {
      deleteMutation.mutate(id);
    }
  };

  const valorTotalDisputas = items.reduce(
    (acc, curr) => acc + (curr.notice?.estimatedValue ? Number(curr.notice.estimatedValue) : 0),
    0,
  );

  return (
    <div className="flex flex-col h-full min-w-0 bg-white">
      {/* Header Executivo — Gestão de Disputas */}
      <div className="p-6 md:p-8 shrink-0 border-b border-gray-100 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#0A2540] font-black uppercase tracking-widest mb-1.5">
              <Trophy className="w-4 h-4 text-[#EA580C]" />
              Governança Operacional & Disputas
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#0A2540]">
              Gestão de Disputas
            </h1>
            <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">
              Acompanhamento estratégico do ciclo de vida das licitações públicas da sua empresa.
            </p>
          </div>

          {/* Cards de Métricas Agregadas da Esteira */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <FileCheck2 size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Disputas Ativas</p>
                <p className="text-base font-black text-slate-900">{items.length}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <DollarSign size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Valor em Disputa</p>
                <p className="text-base font-black text-slate-900">
                  {formatarMoeda(valorTotalDisputas)}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Taxa de Sucesso</p>
                <p className="text-base font-black text-slate-900">
                  {metricas?.taxaConversao ? `${metricas.taxaConversao}%` : '0%'}
                </p>
              </div>
            </div>

            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Plus size={16} /> Explorar Mercado
            </Link>
          </div>
        </div>
      </div>

      {/* ESTADO DE ERRO */}
      {isError && (
        <div className="m-6 p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-start gap-3 text-rose-800">
          <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Falha ao carregar disputas</h4>
            <p className="text-xs mt-1">
              {(error as any)?.response?.data?.message || 'Verifique sua conexão ou tente novamente.'}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}

      {/* ESTADO DE CARREGAMENTO */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#EA580C]" />
          <p className="text-sm font-bold text-slate-600">Sincronizando esteira de disputas...</p>
        </div>
      )}

      {/* ESTADO VAZIO: NENHUMA DISPUTA MAPEADA */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 m-6 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-orange-100/70 flex items-center justify-center text-[#EA580C] mb-4">
            <Trophy size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Aumente seu faturamento: encontre sua próxima disputa estratégica</h3>
          <p className="text-sm text-slate-500 max-w-md mt-2">
            Explore o Radar de Editais e adicione a primeira oportunidade à sua esteira para organizar prazos, avaliar margens e preparar propostas estratégicas.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="h-10 px-6 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-blue hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Search size={16} /> Explorar editais no Radar
            </Link>
          </div>
        </div>
      )}

      {/* ESTEIRA DE DISPUTAS */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 md:px-8 py-6 bg-slate-50/50">
          <div className="flex gap-5 h-full items-start min-w-[1550px]">
            {COLUNAS_ESTEIRA.map((coluna) => {
              const Icon = coluna.icon;
              const colunaItems = items.filter((i) => {
                const stageUpper = String(i.stage || '').toUpperCase();
                return coluna.aliases.includes(stageUpper) || stageUpper === coluna.id;
              });

              const valorTotalColuna = colunaItems.reduce(
                (acc, curr) => acc + (curr.notice?.estimatedValue ? Number(curr.notice.estimatedValue) : 0),
                0,
              );

              return (
                <div
                  key={coluna.id}
                  className={`shrink-0 w-80 max-h-[calc(100vh-220px)] flex flex-col rounded-2xl border-2 ${coluna.corFundo} shadow-sm transition-colors ${
                    draggedItemId ? 'border-dashed border-blue-400 bg-blue-50/10' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, coluna.id)}
                >
                  {/* Header da Coluna */}
                  <div className="p-4 bg-white rounded-t-2xl border-b border-slate-100 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${coluna.corBarra}`} />
                        <Icon className="w-4 h-4 text-slate-700" />
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">
                          {coluna.nome}
                        </h3>
                      </div>
                      <span className="bg-slate-100 text-slate-700 text-xs font-black px-2.5 py-0.5 rounded-full border border-slate-200">
                        {colunaItems.length}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      {formatarMoeda(valorTotalColuna)}
                    </p>
                  </div>

                  {/* Cards na Coluna */}
                  <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    {colunaItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-6 text-center bg-white/40 border border-dashed border-slate-200 rounded-xl min-h-[90px]">
                        <p className="text-xs font-semibold text-slate-400">Arraste uma disputa para cá</p>
                      </div>
                    )}

                    {colunaItems.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 hover:shadow-md hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing group"
                      >
                        {/* Origem e Identificador Oficial */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            {item.notice?.source || 'PNCP'}
                          </span>
                          {item.notice?.noticeNumber && (
                            <span
                              className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[140px]"
                              title={item.notice.noticeNumber}
                            >
                              {item.notice.noticeNumber}
                            </span>
                          )}
                        </div>

                        {/* Objeto do Edital */}
                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 mb-3 group-hover:text-blue-700 transition-colors">
                          {item.notice?.object || 'Objeto do edital não informado'}
                        </h4>

                        {/* Órgão Comprador e UF */}
                        <div className="space-y-1.5 text-[11px] text-slate-500 mb-3 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate" title={item.notice?.buyerName || ''}>
                              {item.notice?.buyerName || 'Órgão não informado'}
                            </span>
                          </div>

                          {(item.notice?.municipality || item.notice?.uf) && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{[item.notice.municipality, item.notice.uf].filter(Boolean).join(' - ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Valor Estimado */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Estimado</span>
                          <span className="text-xs font-black text-slate-900">
                            {formatarMoeda(item.notice?.estimatedValue)}
                          </span>
                        </div>

                        {/* Ações Estratégicas Rápidas */}
                        <div className="grid grid-cols-2 gap-1.5 mb-3 pt-1 border-t border-slate-100">
                          <button
                            onClick={() =>
                              navigate(
                                `/fornecedor/analise-viabilidade?edital=${encodeURIComponent(
                                  item.notice?.id || item.notice?.externalId || '',
                                )}`,
                              )
                            }
                            className="h-8 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition"
                            title="Ver viabilidade econômica"
                          >
                            <Scale className="w-3 h-3 text-indigo-600" />
                            <span>Viabilidade</span>
                          </button>

                          <button
                            onClick={() => {
                              if (item.notice) {
                                sessionStorage.setItem(
                                  'selected_notice',
                                  JSON.stringify({
                                    id: item.notice.id || item.notice.externalId,
                                    buyerName: item.notice.buyerName,
                                    object: item.notice.object,
                                    noticeNumber: item.notice.noticeNumber,
                                  }),
                                );
                              }
                              navigate(
                                `/fornecedor/propostas?edital=${encodeURIComponent(
                                  item.notice?.id || item.notice?.externalId || '',
                                )}`,
                              );
                            }}
                            className="h-8 px-2 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition"
                            title="Gerar proposta comercial"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Proposta</span>
                          </button>
                        </div>

                        {/* Rodapé do Card: Data / Remoção */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                          {item.notice?.openingAt ? (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              {formatarData(item.notice.openingAt)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Data não informada</span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              disabled={deleteMutation.isPending}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Remover da esteira de disputas"
                            >
                              <Trash2 size={14} />
                            </button>
                            <Link
                              to={`/fornecedor/licitacao/${encodeURIComponent(item.notice?.id || item.notice?.externalId || '')}`}
                              className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded transition flex items-center gap-1"
                            >
                              Ver <ArrowRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
