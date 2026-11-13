import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  Compass,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { streamAiChat } from '../services/aiStream.service';
import { ChatMessage } from './ChatMessage';

interface LexMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface RouteGuidance {
  screenLabel: string;
  nextStep: string;
  quickPrompts: string[];
}

function resolveRouteGuidance(pathname: string): RouteGuidance {
  const path = pathname.toLowerCase();

  if (path.includes('/licitacoes/') && path.split('/').filter(Boolean).length >= 2) {
    return {
      screenLabel: 'Resumo do Edital',
      nextStep:
        'Confira os itens pedidos, veja se a sua empresa tem os documentos exigidos e calcule seu preço mínimo antes de cadastrar a proposta.',
      quickPrompts: [
        'O que devo conferir neste edital antes de decidir participar?',
        'Como pedir esclarecimento ou impugnar um edital no prazo de 3 dias úteis?',
        'Como funciona o benefício de microempresa na hora do desempate?',
      ],
    };
  }

  if (path.includes('/licitacoes') || path.includes('/radar') || path.includes('/monitorados')) {
    return {
      screenLabel: 'Buscar Oportunidades',
      nextStep:
        'Filtre os editais pelo seu estado e pela situação "A Receber Propostas", abra os que combinam com seus produtos e salve para montar sua proposta.',
      quickPrompts: [
        'Como escolher os editais com maior chance de vitória e lucro?',
        'O que fazer quando o edital não mostra o valor estimado?',
        'Como funciona a disputa no modo Aberto e no Aberto-Fechado?',
      ],
    };
  }

  if (path.includes('/precificacao') || path.includes('/propostas')) {
    return {
      screenLabel: 'Montagem de Preço e Proposta',
      nextStep:
        'Informe o custo real do produto ou serviço, seus impostos, frete e a margem de lucro desejada para garantir que a proposta não dê prejuízo.',
      quickPrompts: [
        'Como calcular meu preço mínimo deixando margem para negociar depois?',
        'Como comprovar que meu preço é viável se o pregoeiro pedir explicação?',
        'Qual o prazo para enviar a proposta final depois de vencer o item?',
      ],
    };
  }

  if (path.includes('/robo') || path.includes('/disputa')) {
    return {
      screenLabel: 'Sala de Disputa e Lances',
      nextStep:
        'Deixe seu valor mínimo travado em cada item, use a Tela Espelhada para acompanhar o portal oficial ao lado e responda ao pregoeiro no chat rapidamente.',
      quickPrompts: [
        'Qual a melhor estratégia para os minutos finais da disputa?',
        'Como negociar no chat com o pregoeiro sem perder meu lucro?',
        'O que fazer se um concorrente baixar o preço abaixo do possível?',
      ],
    };
  }

  if (path.includes('/cofre') || path.includes('/certidoes') || path.includes('/habilitacao')) {
    return {
      screenLabel: 'Documentos e Certidões',
      nextStep:
        'Mantenha suas certidões (Federal, Estadual, Municipal, FGTS e Trabalhista) sempre em dia. Microempresas têm 5 dias úteis (prorrogáveis por mais 5) para regularizar certidão vencida.',
      quickPrompts: [
        'Esqueci de enviar um documento que eu já tinha antes da sessão. Posso entregar depois?',
        'Como funciona o prazo extra para microempresa com certidão vencida?',
        'O órgão pode exigir atestado técnico acima de 50% da quantidade?',
      ],
    };
  }

  if (
    path.includes('/impugnacao') ||
    path.includes('/recursos') ||
    path.includes('/nulidades') ||
    path.includes('/contencioso')
  ) {
    return {
      screenLabel: 'Impugnações e Recursos',
      nextStep:
        'Fique atento aos prazos: até 3 dias úteis antes da sessão para impugnar o edital e manifestação imediata no sistema caso precise entrar com recurso.',
      quickPrompts: [
        'Como contestar itens agrupados juntos sem necessidade?',
        'Como fazer um recurso contra desclassificação por erro simples de documento?',
        'Como pedir a desclassificação de concorrente que ofertou produto fora do edital?',
      ],
    };
  }

  if (path.includes('/expertise-fiscal')) {
    return {
      screenLabel: 'Gestão Fiscal e Tributária',
      nextStep:
        'Confira suas notas fiscais e verifique se houve retenção indevida de impostos (especialmente para empresas do Simples Nacional) ou necessidade de reequilíbrio de preço.',
      quickPrompts: [
        'Empresa do Simples Nacional sofre retenção de impostos na nota para órgão público?',
        'Quando posso pedir reequilíbrio de preço por aumento de custo ou imposto?',
        'Quais cuidados tomar ao emitir nota fiscal para prefeitura ou estado?',
      ],
    };
  }

  if (path.includes('/pos-vitoria') || path.includes('/contratos') || path.includes('/srp')) {
    return {
      screenLabel: 'Contratos e Atas de Registro de Preços',
      nextStep:
        'Acompanhe seus empenhos, prazos de entrega e pedidos de adesão ("carona") para entregar sempre no prazo e evitar multas.',
      quickPrompts: [
        'Como funciona o pedido de adesão (carona) em Ata de Registro de Preços?',
        'Como pedir prorrogação do prazo de entrega sem levar multa?',
        'Qual a diferença entre reajuste anual e revisão de preço?',
      ],
    };
  }

  return {
    screenLabel: 'Painel Principal',
    nextStep:
      'Confira os prazos do dia, verifique se suas certidões estão válidas e escolha um edital na busca de oportunidades para montar sua proposta.',
    quickPrompts: [
      'Me dê um passo a passo simples para começar a vencer licitações.',
      'Quais são os erros mais comuns que fazem empresas perderem licitações?',
      'Como negociar com o pregoeiro mantendo minha margem de lucro?',
    ],
  };
}

function buildOfflineContingencyReply(question: string, guidance: RouteGuidance): string {
  return `Você está na etapa **${guidance.screenLabel}**. Sobre a sua dúvida (*"${question}"*), aqui vão os prazos e regras principais para não errar:

- **Pedido de esclarecimento ou impugnação**: até **3 dias úteis** antes da data de abertura da sessão.
- **Recurso após o resultado**: manifeste a intenção logo após o pregoeiro abrir o prazo no chat, e envie as razões em até **3 dias úteis**.
- **Vantagem para Microempresa e EPP**: se sua proposta ficar até **5% acima** da melhor oferta, você tem **5 minutos** na sessão para dar um lance menor e assumir o 1º lugar.
- **Proposta final readequada**: após vencer o item, o prazo mínimo para enviar a proposta ajustada é de **2 horas** (podendo pedir mais tempo antes de vencer).

**Próximo passo recomendado nesta tela:**
${guidance.nextStep}`;
}

export const LexFloatingWidget: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const guidance = useMemo(
    () => resolveRouteGuidance(location.pathname),
    [location.pathname],
  );

  const detectedNoticeId = useMemo(() => {
    const paramId =
      searchParams.get('edital') ||
      searchParams.get('editalId') ||
      searchParams.get('noticeId') ||
      searchParams.get('id');
    if (paramId) return paramId;
    const match = location.pathname.match(/\/licitacoes\/([^/?#]+)/i);
    if (match && match[1] && match[1] !== 'monitorados') {
      return match[1];
    }
    return undefined;
  }, [location.pathname, searchParams]);

  const [messages, setMessages] = useState<LexMessage[]>([
    {
      id: 'welcome-guia',
      role: 'assistant',
      content:
        'Olá! Este é o seu **Guia do Licitante**.\n\nEstou acompanhando a tela em que você está agora para ajudar em todas as etapas: escolha do edital, formação de preço, lances, prazos, documentos e recursos. Como posso te ajudar hoje?',
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendQuestion = async (customPrompt?: string) => {
    const question = (customPrompt ?? inputValue).trim();
    if (!question || isStreaming) return;

    if (!customPrompt) {
      setInputValue('');
    }

    const userMsg: LexMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const assistantMsgId = `guia-${Date.now() + 1}`;
    const placeholderAssistantMsg: LexMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
    setIsStreaming(true);

    try {
      await streamAiChat({
        endpoint: '/lex/chat',
        pergunta: question,
        noticeId: detectedNoticeId,
        contexto: `Tela atual do usuário: ${guidance.screenLabel} (${location.pathname}). Próximo passo recomendado da tela: ${guidance.nextStep}`,
        messages: messages
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }))
          .concat([{ role: 'user', content: question }]),
        onChunk: (_chunk, accumulated) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg,
            ),
          );
        },
        onDone: (fullText) => {
          const finalContent =
            fullText && fullText.trim().length > 0
              ? fullText
              : buildOfflineContingencyReply(question, guidance);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: finalContent } : msg,
            ),
          );
          setIsStreaming(false);
        },
        onError: () => {
          const fallback = buildOfflineContingencyReply(question, guidance);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: fallback } : msg,
            ),
          );
          setIsStreaming(false);
        },
      });
    } catch {
      const fallback = buildOfflineContingencyReply(question, guidance);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: fallback } : msg,
        ),
      );
      setIsStreaming(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Conversa reiniciada. Estou acompanhando a etapa **${guidance.screenLabel}**. Qual é a sua dúvida sobre prazos, preços, documentos ou disputa?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end font-sans">
      {isOpen ? (
        <div
          className={`bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] sm:w-[640px] h-[84vh]'
              : 'w-[92vw] sm:w-[430px] h-[640px] max-h-[84vh]'
          }`}
          role="dialog"
          aria-label="Guia do Licitante"
        >
          {/* Cabeçalho Limpo */}
          <div className="bg-[#081c3a] text-white px-4 py-3.5 flex items-center justify-between border-b-2 border-[#0070c0] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-[#ff6600]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base truncate">
                    Guia do Licitante
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0070c0] text-white">
                    Passo a Passo
                  </span>
                </div>
                <p className="text-xs text-slate-200 truncate">
                  Orientação completa em prazos, preços, lances e documentos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearHistory}
                title="Limpar conversa"
                className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Reduzir janela' : 'Expandir janela'}
                className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Fechar guia"
                className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Próximo Passo Recomendado */}
          <div className="bg-[#f8fafc] border-b border-slate-200 px-4 py-3 shrink-0">
            <div className="flex items-start gap-2.5 border-l-4 border-[#0070c0] pl-3">
              <Compass className="w-4 h-4 text-[#0070c0] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#081c3a] block">
                  O que fazer agora • {guidance.screenLabel}
                </span>
                <p className="text-xs text-slate-700 mt-0.5 leading-snug">
                  {guidance.nextStep}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-[#081c3a] text-white rounded-br-none'
                      : 'bg-[#f8fafc] text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <ChatMessage content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-600 py-1">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0070c0]" />
                        <span className="text-xs font-medium">
                          Verificando regras e orientações...
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 mt-1 px-1">
                  {msg.role === 'user' ? 'Você' : 'Guia'} • {msg.timestamp}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Perguntas Rápidas */}
          <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-slate-200 shrink-0">
            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#ff6600]" />
              <span>Dúvidas comuns nesta etapa:</span>
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {guidance.quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void handleSendQuestion(prompt)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:border-[#0070c0] hover:bg-blue-50/40 text-xs font-medium text-[#081c3a] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span className="truncate max-w-[230px]">{prompt}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#0070c0] shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Campo de Entrada */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendQuestion();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isStreaming}
              placeholder="Escreva sua dúvida sobre o edital, prazos ou lances..."
              className="flex-1 px-4 py-2.5 text-sm bg-[#f8fafc] border border-slate-300 rounded-full text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#0070c0] focus:bg-white"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isStreaming}
              className="px-4 py-2.5 rounded-full bg-[#0070c0] hover:bg-[#081c3a] text-white font-semibold text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Enviar</span>
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-full bg-[#081c3a] hover:bg-[#0070c0] text-white shadow-xl border-2 border-white transition-all duration-200 cursor-pointer"
          aria-label="Abrir Guia do Licitante"
        >
          <div className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-[#ff6600]" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#081c3a]" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold leading-tight text-white flex items-center gap-1.5">
              <span>Guia do Licitante</span>
              <span className="px-2 py-0.5 rounded-full bg-[#0070c0] group-hover:bg-[#081c3a] text-white text-[11px] font-semibold">
                Ajuda
              </span>
            </div>
            <div className="text-xs text-slate-200 leading-tight truncate max-w-[170px]">
              {guidance.screenLabel}
            </div>
          </div>
        </button>
      )}
    </div>
  );
};

export default LexFloatingWidget;