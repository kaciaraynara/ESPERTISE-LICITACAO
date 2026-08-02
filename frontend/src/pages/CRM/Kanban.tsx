import { motion } from 'framer-motion';

export default function KanbanPage() {
  const columns = [
    { id: 'prospeccao', title: 'Em Prospecção', count: 3, color: 'border-slate-200' },
    { id: 'analise', title: 'Em Análise', count: 2, color: 'border-blue-200' },
    { id: 'proposta', title: 'Proposta Enviada', count: 1, color: 'border-orange-200' },
    { id: 'ganho', title: 'Ganho', count: 1, color: 'border-emerald-200' },
  ];

  return (
    <div className="p-6 h-full flex flex-col w-full max-w-full overflow-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-blue mb-2">Funil de Oportunidades (CRM)</h1>
        <p className="text-slate-500">Arraste e solte as licitações para atualizar o status no seu pipeline de vendas.</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {columns.map((column, index) => (
          <div key={column.id} className={`flex-shrink-0 w-80 bg-slate-50/50 rounded-xl border ${column.color} flex flex-col max-h-full`}>
            {/* Header da Coluna */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-xl">
              <h3 className="font-bold text-slate-700">{column.title}</h3>
              <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">
                {column.count}
              </span>
            </div>

            {/* Area de Drop (Cards) */}
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md cursor-grab transition-shadow group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-slate-400" >Pregão #123/24</span>
                  <button className="text-slate-300 hover:text-brand-orange">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="currentColor" d="M144 128a16 16 0 1 1-16-16a16 16 0 0 1 16 16m-84-16a16 16 0 1 0 16 16a16 16 0 0 0-16-16m136 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16"></path></svg>
                  </button>
                </div>
                <h4 className="font-bold text-sm text-brand-blue mb-2 group-hover:text-brand-orange transition-colors">
                  Exemplo de Licitação Analisada {index + 1}
                </h4>
                <div className="text-xs text-slate-500 mb-3">Prefeitura de São Paulo - SP</div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-700">R$ 150K</span>
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand-blue">JD</div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Adicionar Oportunidade Avulsa */}
            <div className="p-3">
              <button className="w-full py-2 text-sm text-slate-400 font-medium hover:text-brand-orange hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>+</span> Adicionar Card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

