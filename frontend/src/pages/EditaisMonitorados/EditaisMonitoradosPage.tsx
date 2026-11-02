import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark, Eye, Building2, Clock, Search, Loader2,
  Trash2, AlertCircle, Star, ExternalLink, RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface EditalMonitorado {
  id: string;
  status: string;
  priority: string;
  notes: string | null;
  monitoradoEm: string;
  edital: {
    id: string;
    numeroProcesso: string | null;
    orgao: string | null;
    cnpjOrgao: string | null;
    objeto: string;
    modalidade: string | null;
    uf: string | null;
    municipio: string | null;
    valorEstimado: number | null;
    situacao: string | null;
    link: string | null;
    dataAbertura: string | null;
    dataEncerramento: string | null;
    fonte: string;
  } | null;
}

interface MonitoredResponse {
  data: EditalMonitorado[];
  meta: { total: number; pagina: number; limite: number; totalPaginas: number };
}

const prioridadeBadge: Record<string, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-rose-100 text-rose-800' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-800' },
  normal: { label: 'Normal', className: 'bg-blue-100 text-blue-800' },
  low: { label: 'Baixa', className: 'bg-slate-100 text-slate-700' },
};

function formatarMoeda(valor: number | null) {
  if (!valor) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(data: string | null) {
  if (!data) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data));
  } catch {
    return data;
  }
}

export const EditaisMonitoradosPage: React.FC = () => {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<MonitoredResponse>({
    queryKey: ['monitored-notices', pagina],
    queryFn: async () => {
      const res = await api.get('/monitored-notices', { params: { pagina, limite: 20 } });
      return res.data;
    },
    staleTime: 1000 * 60 * 2, // 2 min
  });

  const removerMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monitored-notices/${id}`);
    },
    onSuccess: () => {
      toast.success('Edital removido da watchlist');
      queryClient.invalidateQueries({ queryKey: ['monitored-notices'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao remover edital');
    },
  });

  const editais = data?.data ?? [];
  const meta = data?.meta;

  const editaisFiltrados = busca.trim()
    ? editais.filter((e) => {
      const termo = busca.toLowerCase();
      return (
        e.edital?.orgao?.toLowerCase().includes(termo) ||
        e.edital?.objeto?.toLowerCase().includes(termo) ||
        e.edital?.numeroProcesso?.toLowerCase().includes(termo) ||
        e.edital?.uf?.toLowerCase().includes(termo)
      );
    })
    : editais;

  const handleRemover = useCallback((id: string) => {
    if (confirm('Remover este edital da sua watchlist?')) {
      removerMutation.mutate(id);
    }
  }, [removerMutation]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-4 sm:p-8">

      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Bookmark size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Editais Monitorados
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhe os editais da sua watchlist.
            {meta && meta.total > 0 && (
              <span className="ml-2 font-bold text-[#0A2540]">
                {meta.total} edital{meta.total !== 1 ? 'is' : ''} monitorado{meta.total !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      {/* BUSCA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por órgão, processo ou palavra-chave do objeto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-[#0A2540] w-8 h-8" />
          </div>

        ) : isError ? (
          <div className="bg-white p-6 rounded-2xl border border-rose-200 flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-800">
                {(error as any)?.response?.data?.message || 'Erro ao carregar editais monitorados.'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-xs font-bold text-rose-600 underline hover:text-rose-800"
              >
                Tentar novamente
              </button>
            </div>
          </div>

        ) : editaisFiltrados.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <Bookmark size={40} className="mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">
              {busca ? 'Nenhum resultado para sua busca' : 'Nenhum edital monitorado ainda'}
            </h3>
            <p className="text-xs text-slate-500">
              {busca
                ? 'Tente outros termos de busca.'
                : 'Acesse o Radar de Editais e clique em "Monitorar" para adicionar editais à sua watchlist.'}
            </p>
          </div>

        ) : (
          editaisFiltrados.map((item) => {
            const edital = item.edital;
            const prio = prioridadeBadge[item.priority] || prioridadeBadge.normal;

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {edital?.numeroProcesso && (
                      <span className="bg-[#0A2540] text-white font-black text-xs px-2.5 py-1 rounded-lg">
                        {edital.numeroProcesso}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <Building2 size={14} className="text-slate-400" />
                      {edital?.orgao || 'Órgão não informado'}
                      {edital?.uf ? ` — ${edital.uf}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {edital?.situacao && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded uppercase bg-blue-100 text-blue-800">
                        {edital.situacao}
                      </span>
                    )}
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${prio.className}`}>
                      <Star size={8} className="inline mr-1" />
                      {prio.label}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {edital?.objeto || 'Objeto não disponível'}
                </p>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 text-xs font-bold text-slate-600">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    {edital?.dataAbertura && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock size={13} />
                        Abertura:{' '}
                        <strong className="text-slate-900">
                          {formatarData(edital.dataAbertura)}
                        </strong>
                      </span>
                    )}
                    {edital?.fonte && (
                      <span className="text-slate-500">
                        Fonte: <strong className="text-slate-900">{edital.fonte}</strong>
                      </span>
                    )}
                    {edital?.valorEstimado !== null && (
                      <span className="text-slate-500">
                        Valor:{' '}
                        <strong className="text-slate-900 font-black">
                          {formatarMoeda(edital!.valorEstimado) || 'Não informado'}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {edital?.link && (
                      <a
                        href={edital.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                      >
                        <ExternalLink size={13} />
                        Portal
                      </a>
                    )}
                    <button
                      onClick={() => {
                        const targetId = edital?.id || item.id;
                        navigate(`/fornecedor/licitacoes/${encodeURIComponent(targetId)}`);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                    >
                      <Eye size={14} />
                      Detalhes
                    </button>
                    <button
                      onClick={() => handleRemover(item.id)}
                      disabled={removerMutation.isPending}
                      className="p-2 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50"
                      title="Remover da watchlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINAÇÃO */}
      {meta && meta.totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1 || isLoading}
            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            Anterior
          </button>
          <span className="text-xs font-bold text-slate-600">
            {pagina} / {meta.totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(meta.totalPaginas, p + 1))}
            disabled={pagina >= meta.totalPaginas || isLoading}
            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};