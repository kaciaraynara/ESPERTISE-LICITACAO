import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp, Calculator, ShieldAlert, Square } from 'lucide-react';
import { streamAiChat } from '../services/aiStream.service';
import { ChatMessage } from './ChatMessage';

interface EvidenceSource {
  fonte?: string;
  identificador?: string;
  trechoRelevante?: string;
  tipoEpistemico?: string;
  autoridade?: string;
  titulo?: string;
  referencia?: string;
  similaridade?: number;
}

interface Message {
  id: string;
  sender: 'lex' | 'user';
  text: string;
  timestamp: string;
  isError?: boolean;
  isInconclusive?: boolean;
  nivelCerteza?: string;
  fontes?: EvidenceSource[];
  calculos?: any[];
  dadosFaltantes?: string[];
  isStreaming?: boolean;
}

export const LexFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'lex',
      text: 'Olá! Sou o LEX, a inteligência jurídica do EXPERTISE. Posso analisar editais, calcular prazos de impugnação, avaliar requisitos de habilitação e apontar indícios de restritividade com base na Lei 14.133/21.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
      );
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userQuery,
      timestamp: time,
    };

    const botMsgId = (Date.now() + 1).toString();
    const initialBotMsg: Message = {
      id: botMsgId,
      sender: 'lex',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    setInput('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const chatMessages = messages
        .filter((m) => !m.isError && !m.text.includes('Olá! Sou o LEX'))
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }));

      chatMessages.push({ role: 'user', content: userQuery });

      // Consumo de fluxo nativo SSE via Fetch API com ReadableStream
      await streamAiChat({
        endpoint: '/lex/chat',
        messages: chatMessages,
        signal: abortController.signal,
        onChunk: (_chunk, accumulated) => {
          // Atualiza o texto em tempo real palavra por palavra
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId ? { ...msg, text: accumulated } : msg
            )
          );
        },
        onDone: (fullText, metadata) => {
          const isInconclusive =
            metadata?.status === 'inconclusivo' || metadata?.nivelCerteza === 'inconclusivo';

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? {
                    ...msg,
                    text: fullText,
                    isStreaming: false,
                    isInconclusive,
                    nivelCerteza: metadata?.nivelCerteza,
                    fontes: metadata?.fontes || [],
                    calculos: metadata?.calculos || [],
                    dadosFaltantes: metadata?.dadosFaltantes || [],
                  }
                : msg
            )
          );
        },
        onError: (streamError) => {
          throw streamError;
        },
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Erro na consulta ao LEX:', error);

      const errorMsgText =
        error.message?.includes('403') || error.response?.status === 403
          ? 'Funcionalidade Premium. Eleve sua estratégia, analise o mercado e evite erros em suas propostas. Acesse Planos para fazer upgrade.'
          : error.message ||
            'Não foi possível consultar a central de inteligência no momento.';

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? {
                ...msg,
                text: errorMsgText,
                isError: true,
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const getEpistemicBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'Fato da fonte':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Cálculo reproduzível':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Indício':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Hipótese':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {!isOpen && (
        <button
          data-tour="lex-assistant"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 bg-brand-dark hover:bg-slate-800 text-white px-5 py-3.5 rounded-full shadow-2xl border-2 border-brand-orange transition-all transform hover:scale-105"
        >
          <div className="relative">
            <img src="/assets/mascote-3d.png" alt="Lex (Central Jurídica)" className="w-7 h-7 object-contain" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <span className="font-bold text-sm text-white tracking-wide">Lex (Central Jurídica)</span>
        </button>
      )}

      {isOpen && (
        <div className="w-[380px] sm:w-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[600px] overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-brand-dark text-white p-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-1 bg-slate-800/80 rounded-xl border border-slate-700 w-9 h-9 flex items-center justify-center overflow-hidden">
                <img src="/assets/mascote-3d.png" alt="Lex (Central Jurídica)" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-sm tracking-wide">LEX</h3>
                  <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  Central Jurídica & Distinção Epistêmica
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Histórico de Mensagens */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[90%] text-xs leading-relaxed font-medium shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#0A2540] text-white rounded-br-none'
                      : msg.isError
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-none'
                      : msg.isInconclusive
                      ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.isError && (
                    <div className="flex items-center gap-1.5 text-red-700 font-bold mb-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span>Falha de Provedor</span>
                    </div>
                  )}

                  {msg.isInconclusive && (
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold mb-1.5 bg-amber-100/70 px-2 py-1 rounded-md w-fit">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Análise Inconclusiva (Base Parcial)</span>
                    </div>
                  )}

                  <ChatMessage
                    sender={msg.sender}
                    content={msg.text}
                    isStreaming={msg.isStreaming}
                  />

                  {/* Cálculos Determinísticos */}
                  {msg.calculos && msg.calculos.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Cálculos Determinísticos do Sistema:</span>
                      </div>
                      {msg.calculos.map((calc, idx) => (
                        <div key={idx} className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 text-[10px] text-emerald-900">
                          <p className="font-semibold">{calc.descricao}</p>
                          <p className="text-emerald-700 mt-0.5">{calc.fundamentacaoLegal}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dados Faltantes em caso Inconclusivo */}
                  {msg.dadosFaltantes && msg.dadosFaltantes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60">
                      <span className="text-[10px] font-bold text-amber-900">Dados faltantes para conclusão:</span>
                      <ul className="list-disc list-inside text-[10px] text-amber-800 mt-1">
                        {msg.dadosFaltantes.map((dado, i) => (
                          <li key={i}>{dado}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Fontes e Evidências com Epistemologia */}
                  {(() => {
                    const fontesValidas = (msg.fontes || []).filter((f: any) => {
                      if (!f) return false;
                      if (typeof f === 'string') return (f as string).trim().length > 0;
                      const trecho = String(f.trechoRelevante || '').trim();
                      const ident = String(f.identificador || f.referencia || f.titulo || '').trim();
                      const nome = String(f.fonte || f.autoridade || '').trim();
                      return trecho.length > 0 || ident.length > 0 || nome.length > 0;
                    });

                    if (fontesValidas.length === 0) return null;

                    return (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <button
                          onClick={() =>
                            setExpandedSourceId(expandedSourceId === msg.id ? null : msg.id)
                          }
                          className="flex items-center gap-1 text-[10px] font-bold text-[#0A2540] hover:text-[#EA580C] transition-colors"
                        >
                          <span>Fontes e Evidências ({fontesValidas.length})</span>
                          {expandedSourceId === msg.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {expandedSourceId === msg.id && (
                          <div className="mt-2 space-y-1.5">
                            {fontesValidas.map((fonte, idx) => {
                              const nome = (fonte.fonte || fonte.autoridade || 'Jurisprudência').trim();
                              const ident = (fonte.identificador || fonte.referencia || fonte.titulo || '').trim();
                              const badge = (fonte.tipoEpistemico || 'Fato da fonte').trim();
                              const trecho = (fonte.trechoRelevante || '').trim();

                              return (
                                <div
                                  key={idx}
                                  className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px]"
                                >
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="font-bold text-slate-800 truncate">
                                      {nome}
                                      {ident && ident !== nome ? ` • ${ident}` : ''}
                                    </span>
                                    <span
                                      className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${getEpistemicBadgeColor(
                                        badge,
                                      )}`}
                                    >
                                      {badge}
                                    </span>
                                  </div>
                                  {trecho.length > 0 && (
                                    <p className="text-slate-600 italic">"{trecho}"</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && !messages.some((m) => m.isStreaming && m.text.length > 0) && (
              <div className="flex items-center gap-2 text-slate-500 bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none w-fit shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-[#EA580C]" />
                <span className="text-xs font-semibold">Consultando referências legais...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form / Input */}
          <div className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
              placeholder="Dúvida sobre edital, prazos, Lei 14.133..."
              disabled={isLoading}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] transition-all bg-slate-50 focus:bg-white text-slate-800 font-medium disabled:opacity-50"
            />
            {isLoading ? (
              <button
                onClick={handleStop}
                title="Interromper geração"
                className="bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="bg-[#EA580C] hover:bg-orange-600 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};