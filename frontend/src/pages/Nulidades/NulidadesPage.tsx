import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, FileText, Send, Plus, 
  Clock, Search, Loader2
} from 'lucide-react';
import { noticesApi } from '@services/api';

interface NulidadeImpugnacao {
  id: string;
  edital: string;
  orgao: string;
  tipoInfracao: string;
  resumoIrregularidade: string;
  prazoLimiteImpugnacao: string;
  status: 'RASCUNHO' | 'MINUTA_GERADA' | 'PROTOCOLADA' | 'DEFERIDA' | 'INDEFERIDA';
}

export const NulidadesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [nulidades, setNulidades] = useState<NulidadeImpugnacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const fetchNotices = async (q?: string) => {
    setLoading(true);
    try {
      const res = await noticesApi.search({ q: q || 'licitacao', limit: 5 });
      const items = res.data?.data || [];
      const mapped = items.map((item: any) => ({
        id: item.id,
        edital: item.title?.substring(0, 50) || item.id,
        orgao: item.metadata?.orgao || 'Órgão não especificado',
        tipoInfracao: 'ANALISANDO_EDITAL',
        resumoIrregularidade: 'Clique em Analisar Edital para buscar possíveis nulidades.',
        prazoLimiteImpugnacao: item.metadata?.data_abertura || 'Indefinido',
        status: 'RASCUNHO'
      }));
      setNulidades(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSearch = () => {
    fetchNotices(searchTerm);
  };

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      const res = await noticesApi.getErrorRadar(id);
      const radar = res.data?.data;
      if (radar && radar.issues && radar.issues.length > 0) {
        setNulidades(prev => prev.map(n => {
          if (n.id === id) {
            return {
              ...n,
              tipoInfracao: radar.issues[0].title || 'NULIDADE_ENCONTRADA',
              resumoIrregularidade: radar.issues[0].description,
              status: 'MINUTA_GERADA'
            };
          }
          return n;
        }));
      } else {
        setNulidades(prev => prev.map(n => {
          if (n.id === id) {
            return {
              ...n,
              tipoInfracao: 'SEM_IRREGULARIDADES',
              resumoIrregularidade: 'Nenhuma irregularidade detectada neste edital.',
            };
          }
          return n;
        }));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao analisar edital');
    } finally {
      setAnalyzingId(null);
    }
  };

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

        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar editais..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
            />
          </div>
          <button onClick={handleSearch} className="px-5 py-2.5 bg-[#0A2540] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all">
            BUSCAR
          </button>
        </div>
      </header>

      {/* LISTA DE NULIDADES E PEÇAS JURÍDICAS */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-[#0A2540]" size={32} />
          </div>
        ) : nulidades.map((item) => (
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
              <strong className="text-slate-900 block font-bold mb-1">Status / Irregularidade Apontada:</strong>
              {item.resumoIrregularidade}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <Clock size={14} /> Prazo: <strong className="text-rose-700">{item.prazoLimiteImpugnacao}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleAnalyze(item.id)}
                  disabled={analyzingId === item.id}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {analyzingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Analisar Edital
                </button>
                <button 
                  disabled={item.status === 'RASCUNHO'}
                  className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <FileText size={14} /> Ver Minuta
                </button>
                <button 
                  disabled={item.status === 'RASCUNHO'}
                  className="px-4 py-2 bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
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