import React from 'react';
import { 
  Bell, Calendar, Clock, CheckCircle2, Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prazosApi } from '@services/api';
import toast from 'react-hot-toast';

interface Prazo {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  dueAt: string;
  procurementNotice?: {
    orgao: string;
    objeto: string;
  };
}

export const PrazosAlertasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['prazos_items'],
    queryFn: async () => {
      const res = await prazosApi.listar();
      return res.data;
    }
  });

  const concluirMutation = useMutation({
    mutationFn: (id: string) => prazosApi.concluir(id),
    onSuccess: () => {
      toast.success('Prazo concluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prazos_items'] });
    },
    onError: () => toast.error('Erro ao concluir o prazo.')
  });

  const prazos: Prazo[] = resp?.data || [];

  const getDiasRestantes = (dataLimite: string) => {
    const hoje = new Date();
    const limite = new Date(dataLimite);
    const diffTime = limite.getTime() - hoje.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatarData = (data: string) => {
    const d = new Date(data);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Bell size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Central de Prazos, Recursos & Alertas
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de prazos fatais para Recursos Administrativos, Impugnações e Assinaturas de Contrato.
          </p>
        </div>
      </header>

      {/* PAINEL DE ALERTAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock size={16} className="text-[#EA580C]" />
            Cronograma de Prazos Fatais
          </h3>
        </div>

        <div className="space-y-3 min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="animate-spin text-[#EA580C] w-8 h-8" />
            </div>
          ) : prazos.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              Nenhum prazo encontrado.
            </div>
          ) : (
            prazos.map((prazo) => {
              const diasRestantes = getDiasRestantes(prazo.dueAt);
              const urgencia = diasRestantes <= 2 ? 'CRITICA' : diasRestantes <= 5 ? 'MEDIA' : 'NORMAL';

              return (
                <div 
                  key={prazo.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    prazo.status === 'DONE'
                      ? 'bg-slate-50 opacity-60 border-slate-200'
                      : urgencia === 'CRITICA'
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        prazo.type === 'APPEAL' 
                          ? 'bg-rose-100 text-rose-800' 
                          : prazo.type === 'IMPUGNATION' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {prazo.type}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{prazo.title}</span>
                    </div>
                    {prazo.procurementNotice && (
                      <p className="text-xs text-slate-600 font-medium">{prazo.procurementNotice.orgao} - {prazo.procurementNotice.objeto}</p>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> Limite: {formatarData(prazo.dueAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {prazo.status !== 'DONE' && (
                      <div className="text-right">
                        <span className="text-xs font-black text-rose-600 block">
                          {diasRestantes > 0 ? `${diasRestantes} DIA${diasRestantes === 1 ? '' : 'S'} RESTANTE${diasRestantes === 1 ? '' : 'S'}` : 'VENCIDO'}
                        </span>
                      </div>
                    )}
                    
                    {prazo.status !== 'DONE' ? (
                      <button 
                        onClick={() => concluirMutation.mutate(prazo.id)}
                        disabled={concluirMutation.isPending}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50"
                      >
                        Marcar Concluído
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={16} /> Concluído
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};