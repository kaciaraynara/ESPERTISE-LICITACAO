import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { crmApi } from '@/services/api';
import { Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FORNECEDOR_ROUTES } from '@/routes';

type PipelineItem = {
  id: string;
  stage: string;
  position: number;
  notes?: string | null;
  notice: {
    id: string;
    noticeNumber: string | null;
    buyerName: string | null;
    estimatedValue: number | null;
    object: string | null;
    openingAt: string | null;
    status: string | null;
    uf: string | null;
    municipality: string | null;
  } | null;
};

const STAGES = [
  { id: 'MAPEADAS', title: 'Mapeadas (Radar)', aliases: ['OPORTUNIDADE', 'MAPEADAS', 'MAPPING'], color: 'border-slate-200' },
  { id: 'ANALISE', title: 'Análise de Viabilidade', aliases: ['ANALISE', 'ANALISE_LEX'], color: 'border-blue-200' },
  { id: 'PROPOSTA', title: 'Proposta Pronta', aliases: ['PROPOSTA'], color: 'border-amber-200' },
  { id: 'DISPUTA', title: 'Sessão Pública / Lances', aliases: ['DISPUTA'], color: 'border-orange-200' },
  { id: 'ADJUDICADO', title: 'Adjudicado / Vitória', aliases: ['ADJUDICADO', 'GANHO', 'HOMOLOGADO'], color: 'border-emerald-200' },
];

export default function KanbanPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['disputas-esteira-crm'],
    queryFn: async () => {
      const res = await crmApi.getOportunidades();
      return (res.data?.data || []) as PipelineItem[];
    },
  });

  const columns = useMemo(() => {
    return STAGES.map((col) => {
      const colItems = items.filter((item) =>
        col.aliases.some((alias) => alias.toUpperCase() === (item.stage || '').toUpperCase())
      );
      return {
        ...col,
        count: colItems.length,
        items: colItems,
      };
    });
  }, [items]);

  const formatarMoeda = (val: number | null | undefined) => {
    if (!val || isNaN(val)) return 'Valor sob cotação';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-6 h-full flex flex-col w-full max-w-full overflow-hidden bg-slate-50 min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Gestão de Disputas & Oportunidades
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Pipeline operacional das oportunidades salvas a partir do Radar de Editais.
          </p>
        </div>

        <Link
          to={FORNECEDOR_ROUTES.radar}
          className="inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-orange-600 transition"
        >
          <Plus size={16} /> Captar no Radar
        </Link>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-[#EA580C] w-8 h-8" />
          <p className="text-xs font-bold text-slate-500">Carregando oportunidades da esteira...</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-5 overflow-x-auto pb-4">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className={`flex-shrink-0 w-80 bg-white rounded-2xl border ${column.color} shadow-xs flex flex-col max-h-[calc(100vh-180px)]`}
            >
              {/* Header da Coluna */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl bg-slate-50/70">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">{column.title}</h3>
                <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {column.count}
                </span>
              </div>

              {/* Area de Drop (Cards) */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {column.items.length === 0 ? (
                  <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                    <p className="text-xs font-bold text-slate-600">Nenhuma oportunidade nesta etapa</p>
                    <p className="text-[10px] text-slate-400 mt-1">Salve editais no Radar para alimentá-la.</p>
                  </div>
                ) : (
                  column.items.map((item, itemIdx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (index + itemIdx) * 0.05 }}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-black text-brand-orange uppercase">
                          {item.notice?.noticeNumber || 'Edital'}
                        </span>
                        {item.notice?.uf && (
                          <span className="text-[10px] font-bold text-slate-400">
                            {item.notice.municipality ? `${item.notice.municipality} - ` : ''}{item.notice.uf}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 mb-1.5 line-clamp-2">
                        {item.notice?.object || 'Objeto do edital não informado'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mb-2 truncate">
                        {item.notice?.buyerName || 'Órgão licitante'}
                      </p>

                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                        <span className="text-xs font-black text-slate-900">
                          {formatarMoeda(item.notice?.estimatedValue)}
                        </span>
                        <Link
                          to={`/fornecedor/licitacao/${item.notice?.id || item.id}`}
                          className="text-[10px] font-black text-blue-600 hover:text-blue-800"
                        >
                          Ver Detalhes →
                        </Link>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
