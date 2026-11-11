import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Download, Loader2, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { streamAiChat } from '../../services/aiStream.service';
import { ChatMessage } from '../../components/ChatMessage';
import { EditalOption, EditalSelector } from '../../components/EditalSelector';

export const LexAnalisePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlEditalId =
    searchParams.get('edital') ||
    searchParams.get('editalId') ||
    searchParams.get('noticeId') ||
    searchParams.get('id') ||
    '';

  const [editalSelecionado, setEditalSelecionado] = useState<EditalOption | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [streamingAuditText, setStreamingAuditText] = useState('');
  const [isAuditStreaming, setIsAuditStreaming] = useState(false);
  const autoTriggeredRef = useRef(false);

  const executarAnaliseIa = async (alvo?: EditalOption) => {
    const edital = alvo || editalSelecionado;
    if (!edital) {
      toast.error('Selecione um edital real monitorado ou vinculado a uma proposta.');
      return;
    }

    setAnalisando(true);
    setIsAuditStreaming(true);
    setStreamingAuditText('');

    try {
      await streamAiChat({
        endpoint: '/lex/auditar',
        noticeId: edital.id,
        pergunta: 'Analise este edital, distinguindo fatos do documento, interpretação jurídica e limitações da análise. Não presuma cláusulas ausentes.',
        onChunk: (_chunk, accumulated) => {
          setStreamingAuditText(accumulated);
        },
        onDone: (fullText) => {
          setStreamingAuditText(fullText);
          setIsAuditStreaming(false);
          if (fullText.trim()) {
            toast.success('Análise preliminar concluída. Revise as fontes e limitações antes de tomar decisões.');
          } else {
            toast.error('A IA concluiu sem retornar uma análise.');
          }
        },
        onError: (err: any) => {
          toast.error(err?.message?.includes('403')
            ? 'Seu plano não permite executar esta análise.'
            : 'Não foi possível analisar o edital. Nenhum resultado demonstrativo será exibido.');
          setAnalisando(false);
          setIsAuditStreaming(false);
        },
      });
    } catch (err: any) {
      toast.error(err?.message?.includes('403')
        ? 'Seu plano não permite executar esta análise.'
        : 'Não foi possível analisar o edital. Nenhum resultado demonstrativo será exibido.');
    } finally {
      setAnalisando(false);
      setIsAuditStreaming(false);
    }
  };

  useEffect(() => {
    if (urlEditalId && editalSelecionado && !autoTriggeredRef.current && !analisando) {
      autoTriggeredRef.current = true;
      executarAnaliseIa(editalSelecionado);
    }
  }, [urlEditalId, editalSelecionado]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#0A2540] text-white rounded-lg shadow-md w-10 h-10 flex items-center justify-center overflow-hidden">
              <img src="/assets/mascote-3d.png" alt="Lex" className="w-8 h-8 object-contain" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Análise de Editais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Análise preliminar baseada no texto disponível do edital. As conclusões exigem validação profissional.
          </p>
        </div>

        <button 
          onClick={() => executarAnaliseIa()}
          disabled={analisando}
          className="px-6 py-3 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {analisando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {analisando ? 'ANALISANDO EDITAL...' : 'ANALISAR EDITAL SELECIONADO'}
        </button>
      </header>

      {/* PAINEL PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ESQUERDA: LISTA DE CLÁUSULAS */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <EditalSelector
              label="Edital real sob análise"
              selectedId={urlEditalId}
              onSelectEdital={setEditalSelecionado}
            />
          </div>

          {/* Resultado da análise do edital */}
          {(isAuditStreaming || streamingAuditText) && (
            <div className="bg-[#0A2540] border border-orange-500/40 rounded-2xl p-5 shadow-xl text-white space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-slate-800 rounded-lg">
                    <img src="/assets/mascote-3d.png" alt="Lex" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xs font-bold text-white tracking-wide">
                    Análise do edital
                  </span>
                </div>
                {isAuditStreaming ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-orange-400 font-bold bg-orange-950/60 px-2 py-0.5 rounded-full border border-orange-500/30">
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                    Lendo Edital...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle size={12} />
                    Concluído
                  </span>
                )}
              </div>
              <div className="text-xs leading-relaxed text-slate-100 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <ChatMessage
                  content={streamingAuditText}
                  isStreaming={isAuditStreaming}
                />
              </div>
            </div>
          )}

          {!streamingAuditText && !isAuditStreaming && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-600">
              Selecione um edital real para iniciar a análise. Não há cláusulas fictícias pré-carregadas.
            </div>
          )}
        </div>

        {/* DIREITA: PARECER GERAL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0A2540] text-white p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">
              Resumo do Diagnóstico LEX
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Edital selecionado:</span>
                <span className="font-bold text-white">{editalSelecionado ? 'Sim' : 'Não'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Pontos Críticos / Abusivos:</span>
                <span className="font-bold text-rose-400">—</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Ambiguidades Detectadas:</span>
                <span className="font-bold text-amber-400">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Índice de Conformidade Legal:</span>
                <span className="font-bold text-emerald-400">—</span>
              </div>
            </div>

            <button
              disabled
              title="A exportação será habilitada quando a análise gerar cláusulas estruturadas verificáveis."
              className="w-full mt-4 py-2.5 bg-slate-400 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Download size={14} />
              Exportação estruturada indisponível
            </button>
            <p className="text-[11px] text-slate-300">
              A análise textual da IA não é um parecer jurídico formal nem substitui revisão profissional.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};