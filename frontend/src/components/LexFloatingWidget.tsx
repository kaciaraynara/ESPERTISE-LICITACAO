import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import api from '../services/api'; // Ajuste o import do seu serviço AXIOS / API

interface Message {
  id: string;
  sender: 'lex' | 'user';
  text: string;
  timestamp: string;
  isError?: boolean;
}

export const LexFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'lex',
      text: 'Olá! Sou o LEX, seu assistente estratégico em licitações. Qual dúvida jurídica ou estratégica você quer esclarecer agora sobre a Lei 14.133/21 ou sobre seus editais?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Insere mensagem do usuário
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userQuery,
      timestamp: time
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. Chamada real para o Backend / API de IA do EXPERTISE
      // Altere a rota '/lex/chat' para a rota exata do seu controller no NestJS/Express
      const response = await api.post('/lex/chat', { prompt: userQuery });
      
      const botResponseText = response.data?.answer || response.data?.message || response.data?.response;

      const lexMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'lex',
        text: botResponseText || 'Entendi sua pergunta. No momento estou processando essa análise específica diretamente na base normativa.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, lexMsg]);
    } catch (error) {
      console.error('Erro na integração com LEX:', error);
      
      // Resposta de fallback amigável em caso de instabilidade da API
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'lex',
        text: 'Não consegui me conectar à central de inteligência no momento. Por favor, tente novamente em instantes.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Botão Flutuante (Robô no Topo) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 bg-[#0A2540] hover:bg-slate-800 text-white px-5 py-3.5 rounded-full shadow-2xl border-2 border-[#EA580C] transition-all transform hover:scale-105"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-[#EA580C]" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <span className="font-bold text-sm text-white tracking-wide">LEX IA</span>
        </button>
      )}

      {/* Janela de Chat */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[560px] overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-[#0A2540] text-white p-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <Bot className="w-5 h-5 text-[#EA580C]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-sm tracking-wide">LEX</h3>
                  <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
                </div>
                <p className="text-[11px] text-slate-300 font-medium">Inteligência Jurídica & Estratégia</p>
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
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed font-medium shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#0A2540] text-white rounded-br-none'
                      : msg.isError
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.isError && <AlertCircle className="w-4 h-4 text-red-500 mb-1 inline mr-1" />}
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Indicador de Carregamento (Digitando...) */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none w-fit shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-[#EA580C]" />
                <span className="text-xs font-semibold">LEX está consultando a base legal...</span>
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
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte sobre leis, editais ou estratégias..."
              disabled={isLoading}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] transition-all bg-slate-50 focus:bg-white text-slate-800 font-medium disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-[#EA580C] hover:bg-orange-600 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};