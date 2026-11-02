import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, FileText, Send, 
  Clock, Search, Loader2, Copy, Check, X, ShieldAlert, Download
} from 'lucide-react';
import { noticesApi, impugnacaoApi } from '@services/api';

interface NulidadeImpugnacao {
  id: string;
  edital: string;
  orgao: string;
  tipoInfracao: string;
  resumoIrregularidade: string;
  prazoLimiteImpugnacao: string;
  status: 'RASCUNHO' | 'MINUTA_GERADA' | 'PROTOCOLADA' | 'DEFERIDA' | 'INDEFERIDA';
}

interface MinutaModalData {
  noticeId: string;
  edital: string;
  orgao: string;
  conteudo: string;
  dataCertame?: string;
  prazoDecadencial?: string;
}

export const NulidadesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [nulidades, setNulidades] = useState<NulidadeImpugnacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  
  // Estado do Modal de Minuta
  const [loadingMinutaId, setLoadingMinutaId] = useState<string | null>(null);
  const [selectedMinuta, setSelectedMinuta] = useState<MinutaModalData | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchNotices = async (q?: string) => {
    setLoading(true);
    try {
      const res = await noticesApi.search({ q: q || 'licitacao', limit: 5 });
      const items = res.data?.items || res.data?.data || [];
      const mapped = items.map((item: any) => ({
        id: item.id,
        edital: item.title || item.noticeNumber || item.objeto?.substring(0, 50) || item.id,
        orgao: item.metadata?.orgao || item.buyerName || item.orgao || 'Órgão não especificado',
        tipoInfracao: 'ANALISANDO_EDITAL',
        resumoIrregularidade: 'Clique em Analisar Edital para buscar possíveis nulidades.',
        prazoLimiteImpugnacao: item.metadata?.data_abertura || item.openingAt || item.data_abertura || 'Indefinido',
        status: 'RASCUNHO' as const
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
      const radar = res.data?.data || res.data;
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

  const handleViewMinuta = async (item: NulidadeImpugnacao) => {
    setLoadingMinutaId(item.id);
    setCopied(false);
    try {
      // 1. Tenta buscar a minuta pelo endpoint dedicado no radar de editais
      const res = await noticesApi.getMinutaImpugnacao(item.id);
      const data = res.data?.data;

      if (data && data.conteudo) {
        setSelectedMinuta({
          noticeId: item.id,
          edital: item.edital,
          orgao: item.orgao,
          conteudo: data.conteudo,
          dataCertame: data.dataCertame,
          prazoDecadencial: data.prazo?.prazoDecadencial,
        });
        return;
      }

      // 2. Fallback via gerador geral de peças de impugnação
      const fallbackRes = await impugnacaoApi.gerarPeca({
        orgao: item.orgao,
        objeto: item.edital,
        data_certame: typeof item.prazoLimiteImpugnacao === 'string' && item.prazoLimiteImpugnacao.length >= 10
          ? item.prazoLimiteImpugnacao.substring(0, 10)
          : new Date().toISOString().substring(0, 10),
        pontos_impugnacao: [item.resumoIrregularidade],
      });

      const fallbackData = fallbackRes.data?.data;
      setSelectedMinuta({
        noticeId: item.id,
        edital: item.edital,
        orgao: item.orgao,
        conteudo: fallbackData?.conteudo || 'Minuta jurídica não disponível no momento.',
        prazoDecadencial: fallbackData?.prazo?.prazoDecadencial,
      });
    } catch (err) {
      console.error('Erro ao obter minuta jurídica:', err);
      alert('Não foi possível gerar a minuta deste edital. Verifique se o edital está ativo.');
    } finally {
      setLoadingMinutaId(null);
    }
  };

  const handleCopyText = async () => {
    if (!selectedMinuta?.conteudo) return;
    try {
      await navigator.clipboard.writeText(selectedMinuta.conteudo);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleDownload = () => {
    if (!selectedMinuta?.conteudo) return;
    const element = document.createElement('a');
    const file = new Blob([selectedMinuta.conteudo], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Impugnacao_${selectedMinuta.noticeId.substring(0, 8)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
              Revisão de Exigências e Preparação de Impugnações
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Identifique possíveis problemas no edital e organize os fundamentos para uma impugnação conforme a Lei nº 14.133/2021.
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
                  onClick={() => handleViewMinuta(item)}
                  disabled={loadingMinutaId === item.id}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loadingMinutaId === item.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileText size={14} />
                  )}
                  Ver Minuta
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

      {/* MODAL: MINUTA DE IMPUGNAÇÃO (LEI 14.133/21) */}
      {selectedMinuta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-[#0A2540] text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-900 rounded-xl shadow-md">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    Minuta de Impugnação ao Edital
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Art. 164 — Lei 14.133/21
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedMinuta.edital} · {selectedMinuta.orgao}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedMinuta(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content / Preview da Peça */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              {selectedMinuta.prazoDecadencial && (
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <Clock size={16} className="text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Prazo Decadencial Legal:</strong> Protocolar até <strong>{selectedMinuta.prazoDecadencial}</strong> (3 dias úteis antes da abertura do certame, conforme art. 164, caput, Lei 14.133/2021).
                  </span>
                </div>
              )}

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-inner">
                <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                  {selectedMinuta.conteudo}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Peça jurídica estruturada com fundamentação legal, tempestividade e pedidos formais.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  title="Baixar arquivo Markdown"
                >
                  <Download size={15} /> Baixar .md
                </button>

                <button
                  onClick={handleCopyText}
                  className={`px-5 py-2.5 font-black text-xs rounded-xl flex items-center gap-2 shadow-md transition-all ${
                    copied 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-[#0A2540] hover:bg-slate-800 text-white'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado para Área de Transferência!' : 'Copiar Minuta Completa'}
                </button>

                <button
                  onClick={() => setSelectedMinuta(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};