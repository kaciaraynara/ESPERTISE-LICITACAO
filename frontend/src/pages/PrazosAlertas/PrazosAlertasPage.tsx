import React, { useState, useMemo } from 'react';
import { 
  Bell, Calendar, Clock, CheckCircle2, Loader2, Plus, 
  AlertTriangle, Filter, Building2, Check, X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prazosApi } from '@services/api';
import toast from 'react-hot-toast';

// Tipos oficiais de prazos sincronizados com o modelo Deadline do backend
export const DEADLINE_TYPES = [
  { value: 'SESSAO_PUBLICA', label: 'Sessão Pública' },
  { value: 'RECURSO', label: 'Recurso Administrativo' },
  { value: 'IMPUGNACAO', label: 'Impugnação ao Edital' },
  { value: 'ASSINATURA_CONTRATO', label: 'Assinatura de Contrato' },
  { value: 'PROPOSAL_SUBMISSION', label: 'Envio de Proposta' },
  { value: 'CLARIFICATION', label: 'Pedido de Esclarecimento' },
  { value: 'OTHER', label: 'Outros Prazos' },
];

export interface PrazoItem {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: 'PENDENTE' | 'CONCLUIDO' | 'VENCIDO' | 'OPEN' | 'DONE' | 'OVERDUE' | string;
  date?: string;
  dueAt: string;
  procurementNotice?: {
    id?: string;
    orgao?: string;
    buyerName?: string;
    objeto?: string;
    object?: string;
    noticeNumber?: string;
    externalId?: string;
  } | null;
}

export const PrazosAlertasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'CRITICOS' | 'FUTUROS' | 'CONCLUIDOS'>('TODOS');
  
  const [newPrazo, setNewPrazo] = useState({ 
    title: '', 
    type: 'SESSAO_PUBLICA', 
    date: '', 
    description: '' 
  });

  // 1. Busca oficial de prazos via GET /prazos ordenados da data mais próxima à mais distante
  const { data: resp, isLoading, isError } = useQuery({
    queryKey: ['prazos_items'],
    queryFn: async () => {
      const res = await prazosApi.listar();
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  // Mutação para concluir prazo
  const concluirMutation = useMutation({
    mutationFn: (id: string) => prazosApi.concluir(id),
    onSuccess: () => {
      toast.success('Prazo concluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prazos_items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
    },
    onError: () => toast.error('Nossos servidores estão processando a solicitação. Tente novamente.')
  });

  // Mutação para criação manual de prazo
  const criarMutation = useMutation({
    mutationFn: () => {
      const isoDate = new Date(newPrazo.date).toISOString();
      return prazosApi.criar({
        title: newPrazo.title.trim(),
        type: newPrazo.type,
        date: isoDate,
        dueAt: isoDate,
        description: newPrazo.description?.trim() || undefined,
        status: 'PENDENTE',
      });
    },
    onSuccess: () => {
      toast.success('Novo prazo cadastrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prazos_items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      setIsModalOpen(false);
      setNewPrazo({ title: '', type: 'SESSAO_PUBLICA', date: '', description: '' });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao cadastrar prazo. Verifique os dados informados.');
    }
  });

  const prazos: PrazoItem[] = resp?.data || [];

  // Cálculo de dias restantes até o vencimento fatal
  const getDiasRestantes = (dataLimite: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(dataLimite);
    limite.setHours(0, 0, 0, 0);
    const diffTime = limite.getTime() - hoje.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatarData = (dataStr: string) => {
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dataStr;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const found = DEADLINE_TYPES.find(t => t.value === tipo);
    if (found) return found.label;
    if (tipo === 'DISPUTE_SESSION') return 'Sessão Pública';
    if (tipo === 'IMPUGNATION') return 'Impugnação ao Edital';
    if (tipo === 'APPEAL') return 'Recurso Administrativo';
    if (tipo === 'CONTRACT_SIGNING') return 'Assinatura de Contrato';
    return tipo;
  };

  // Contadores para os Cards de Resumo Executivo
  const metrics = useMemo(() => {
    let criticos = 0;
    let futuros = 0;
    let concluidos = 0;

    prazos.forEach((p) => {
      const isDone = p.status === 'CONCLUIDO' || p.status === 'DONE';
      if (isDone) {
        concluidos++;
      } else {
        const dias = getDiasRestantes(p.date || p.dueAt);
        if (dias <= 2) {
          criticos++;
        } else {
          futuros++;
        }
      }
    });

    return { criticos, futuros, concluidos, total: prazos.length };
  }, [prazos]);

  // Lista filtrada
  const prazosFiltrados = useMemo(() => {
    return prazos.filter((p) => {
      const isDone = p.status === 'CONCLUIDO' || p.status === 'DONE';
      if (filtroStatus === 'CONCLUIDOS') return isDone;
      if (isDone) return filtroStatus === 'TODOS';
      
      const dias = getDiasRestantes(p.date || p.dueAt);
      if (filtroStatus === 'CRITICOS') return dias <= 2;
      if (filtroStatus === 'FUTUROS') return dias > 2;
      return true;
    });
  }, [prazos, filtroStatus]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 sm:p-8 lg:p-10">
      
      {/* CABEÇALHO EXECUTIVO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
              <Bell size={22} className="text-[#EA580C]" />
            </span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-100 text-[#EA580C] border border-orange-200">
                  Gestão Governamental
                </span>
                <span className="text-xs text-slate-400 font-semibold">• Lei 14.133/2021</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Prazos Fatais e Alertas Oficiais
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Acompanhe sessões públicas, prazos para recursos e impugnações e assinaturas de contrato das suas disputas.
          </p>
        </div>

        <button 
          id="btn-novo-prazo"
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#EA580C] hover:bg-orange-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Novo Prazo</span>
        </button>
      </header>

      {/* CARDS DE RESUMO ESTRATÉGICO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Prazos Críticos (≤ 2 dias)
            </span>
            <span className="text-2xl font-black text-rose-600">
              {metrics.criticos}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Prazos Futuros (&gt; 2 dias)
            </span>
            <span className="text-2xl font-black text-emerald-600">
              {metrics.futuros}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Prazos Cumpridos
            </span>
            <span className="text-2xl font-black text-slate-800">
              {metrics.concluidos}
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-[#0A2540] rounded-xl">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* PAINEL PRINCIPAL DE PRAZOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* FILTROS DE VISUALIZAÇÃO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[#EA580C]" />
            <h2 className="font-black text-slate-900 text-sm tracking-tight">
              Cronograma de Disputas & Prazos
            </h2>
            <span className="text-xs font-bold text-slate-400 ml-1">
              ({prazosFiltrados.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
              <Filter size={12} /> Filtro:
            </span>
            <button
              type="button"
              onClick={() => setFiltroStatus('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filtroStatus === 'TODOS'
                  ? 'bg-[#0A2540] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({prazos.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('CRITICOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filtroStatus === 'CRITICOS'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-rose-700 hover:bg-rose-50'
              }`}
            >
              Críticos ({metrics.criticos})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('FUTUROS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filtroStatus === 'FUTUROS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Futuros ({metrics.futuros})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('CONCLUIDOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filtroStatus === 'CONCLUIDOS'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Concluídos ({metrics.concluidos})
            </button>
          </div>
        </div>

        {/* LISTA DE PRAZOS MAPPER */}
        <div className="space-y-3 min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-slate-400 gap-3">
              <Loader2 className="animate-spin text-[#EA580C] w-8 h-8" />
              <span className="text-xs font-bold">Sincronizando cronograma oficial de prazos...</span>
            </div>
          ) : isError ? (
            <div className="text-center p-8 text-rose-600 font-bold text-xs bg-rose-50 rounded-xl border border-rose-200">
              Conexão com os portais governamentais temporariamente indisponível. Tentando novamente...
            </div>
          ) : prazosFiltrados.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 space-y-2">
              <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-black text-slate-700">Nenhum prazo encontrado neste filtro.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Ao adicionar editais à sua Gestão de Disputas no Radar, as Sessões Públicas de abertura são agendadas automaticamente aqui.
              </p>
            </div>
          ) : (
            prazosFiltrados.map((prazo) => {
              const dataAlvo = prazo.date || prazo.dueAt;
              const diasRestantes = getDiasRestantes(dataAlvo);
              const isConcluido = prazo.status === 'CONCLUIDO' || prazo.status === 'DONE';
              const isCritico = diasRestantes <= 2 && !isConcluido;

              // Cor da tag de urgência:
              // - Próximos 2 dias (ou vencido): vermelha/laranja
              // - Futuros (> 2 dias): verde ou neutra
              const badgeUrgenciaClass = isConcluido
                ? 'bg-slate-100 border-slate-200 text-slate-600'
                : isCritico
                ? diasRestantes <= 0
                  ? 'bg-rose-100/90 border-rose-300 text-rose-700 font-black'
                  : 'bg-orange-100/90 border-orange-300 text-orange-700 font-black'
                : diasRestantes <= 5
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                : 'bg-slate-100 border-slate-200 text-slate-700 font-bold';

              const textoUrgencia = isConcluido
                ? 'Cumprido'
                : diasRestantes < 0
                ? 'Prazo Expirado'
                : diasRestantes === 0
                ? 'Vence Hoje'
                : diasRestantes === 1
                ? 'Amanhã (1 dia restante)'
                : `${diasRestantes} dias restantes`;

              const orgaoNome = prazo.procurementNotice?.orgao || prazo.procurementNotice?.buyerName;
              const objetoTexto = prazo.procurementNotice?.objeto || prazo.procurementNotice?.object;
              const editalNumero = prazo.procurementNotice?.noticeNumber || prazo.procurementNotice?.externalId;

              return (
                <div 
                  key={prazo.id}
                  className={`p-5 rounded-2xl border transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5 ${
                    isConcluido
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : isCritico
                      ? 'bg-rose-50/30 border-rose-200/90 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Tag do Tipo do Prazo */}
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider bg-[#0A2540] text-white">
                        {getTipoLabel(prazo.type)}
                      </span>

                      {/* Tag de Urgência (Vermelha/Laranja se <= 2 dias; Verde/Neutra se Futuro) */}
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${badgeUrgenciaClass}`}>
                        {isCritico && <AlertTriangle size={11} className="shrink-0" />}
                        {textoUrgencia}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
                      {prazo.title}
                    </h3>

                    {/* Vínculo com Órgão / Edital */}
                    {(orgaoNome || objetoTexto) && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-600 font-medium">
                        {orgaoNome && (
                          <span className="flex items-center gap-1.5 shrink-0">
                            <Building2 size={13} className="text-slate-400" />
                            <strong>{orgaoNome}</strong>
                          </span>
                        )}
                        {editalNumero && (
                          <span className="text-slate-400">• {editalNumero}</span>
                        )}
                        {objetoTexto && (
                          <span className="text-slate-500 truncate max-w-xl">
                            — {objetoTexto}
                          </span>
                        )}
                      </div>
                    )}

                    {prazo.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {prazo.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-semibold pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" /> 
                        Data Limite: <strong>{formatarData(dataAlvo)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* AÇÕES DE CONCLUSÃO */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    {!isConcluido ? (
                      <button 
                        type="button"
                        onClick={() => concluirMutation.mutate(prazo.id)}
                        disabled={concluirMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-[#0A2540] active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Marcar Concluído</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <span>Cumprido</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL NOVO PRAZO (POST /prazos) */}
      {isModalOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 text-[#EA580C] rounded-xl">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    Cadastrar Novo Prazo Fatal
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registre marcos de recursos, impugnações e sessões
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (newPrazo.title && newPrazo.date && !criarMutation.isPending) {
                  criarMutation.mutate();
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Título do Prazo *
                </label>
                <input 
                  type="text" 
                  required
                  value={newPrazo.title}
                  onChange={e => setNewPrazo(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-slate-100 transition"
                  placeholder="Ex: Protocolo de Recurso Administrativo - Pregão 45/2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Tipo de Prazo *
                  </label>
                  <select 
                    value={newPrazo.type}
                    onChange={e => setNewPrazo(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-slate-100 transition"
                  >
                    {DEADLINE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Data e Hora Limite *
                  </label>
                  <input 
                    type="datetime-local" 
                    required
                    value={newPrazo.date}
                    onChange={e => setNewPrazo(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-slate-100 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Observações Estratégicas (opcional)
                </label>
                <textarea 
                  value={newPrazo.description}
                  onChange={e => setNewPrazo(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm font-normal text-slate-800 outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-slate-100 transition resize-none"
                  rows={3}
                  placeholder="Detalhes adicionais, fundamentos jurídicos ou contatos do pregoeiro..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 font-bold text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={!newPrazo.title || !newPrazo.date || criarMutation.isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {criarMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Prazo</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};