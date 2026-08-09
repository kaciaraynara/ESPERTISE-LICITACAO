import React, { useState } from 'react';
import { 
  AlertOctagon, FileText, Send, Plus, 
  Clock
} from 'lucide-react';

interface NulidadeImpugnacao {
  id: string;
  edital: string;
  orgao: string;
  tipoInfracao: 'RESTRIÇÃO_DE_COMPETITIVIDADE' | 'EXIGÊNCIA_ILEGAL' | 'CLÁUSULA_AMBÍGUA';
  resumoIrregularidade: string;
  prazoLimiteImpugnacao: string;
  status: 'RASCUNHO' | 'MINUTA_GERADA' | 'PROTOCOLADA' | 'DEFERIDA' | 'INDEFERIDA';
}

export const NulidadesPage: React.FC = () => {
  const [nulidades] = useState<NulidadeImpugnacao[]>([
    {
      id: '1',
      edital: 'PE 102/2026',
      orgao: 'Prefeitura Municipal de São Paulo',
      tipoInfracao: 'RESTRIÇÃO_DE_COMPETITIVIDADE',
      resumoIrregularidade: 'Exigência de atestado técnico registrado no CREA local com restrição territorial geográfica indevida.',
      prazoLimiteImpugnacao: '11/08/2026 17:00',
      status: 'MINUTA_GERADA'
    },
    {
      id: '2',
      edital: 'PE 088/2026',
      orgao: 'Secretaria Estadual de Saúde SP',
      tipoInfracao: 'EXIGÊNCIA_ILEGAL',
      resumoIrregularidade: 'Exigência de capital social mínimo superior a 10% do valor estimado da contratação.',
      prazoLimiteImpugnacao: '09/08/2026 18:00',
      status: 'PROTOCOLADA'
    }
  ]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <AlertOctagon size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Radar de Nulidades & Gerador de Impugnações
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Identificação de vício insanável no edital e elaboração automatizada de peças de impugnação e pedidos de esclarecimento.
          </p>
        </div>

        <button className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all">
          <Plus size={16} /> NOVA IMPUGNAÇÃO MANUAL
        </button>
      </header>

      {/* LISTA DE NULIDADES E PEÇAS JURÍDICAS */}
      <div className="space-y-4">
        {nulidades.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-[#0A2540] text-white font-black text-xs px-2.5 py-1 rounded-lg">
                  {item.edital}
                </span>
                <span className="text-xs font-bold text-slate-900">{item.orgao}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded uppercase bg-rose-100 text-rose-800">
                  {item.tipoInfracao.replace(/_/g, ' ')}
                </span>

                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                  item.status === 'PROTOCOLADA' 
                    ? 'bg-blue-100 text-blue-800' 
                    : item.status === 'MINUTA_GERADA' 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <strong className="text-slate-900 block font-bold mb-1">Irregularidade Apontada:</strong>
              {item.resumoIrregularidade}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <Clock size={14} /> Prazo Limite para Protocolo: <strong className="text-rose-700">{item.prazoLimiteImpugnacao}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all">
                  <FileText size={14} /> Ver Minuta
                </button>
                <button className="px-4 py-2 bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all">
                  <Send size={14} /> Protocolar / Registrar
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};