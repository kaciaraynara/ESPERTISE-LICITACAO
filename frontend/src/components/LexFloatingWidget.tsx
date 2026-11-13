import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Bot,
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
        'Leia o que o órgão está comprando, confira os itens pedidos e veja se sua empresa tem todas as certidões em dia antes de montar o preço.',
      quickPrompts: [
        'Me explique de forma simples o que esse edital exige para eu participar.',
        'Quais prazos eu não posso perder neste edital?',
        'Como funciona a preferência para microempresa na hora do desempate?',
      ],
    };
  }

  if (path.includes('/licitacoes') || path.includes('/radar') || path.includes('/monitorados')) {
    return {
      screenLabel: 'Busca de Editais',
      nextStep:
        'Digite o nome do produto ou serviço que você vende, escolha o seu estado e clique em Buscar Editais. Quando achar um bom, salve para montar sua proposta.',
      quickPrompts: [
        'Como escolher os editais com maior chance de ganhar e ter lucro?',
        'O que fazer quando o edital não mostra o valor estimado?',
        'Qual a diferença entre Pregão Eletrônico, Dispensa e Registro de Preços?',
      ],
    };
  }

  if (path.includes('/precificacao') || path.includes('/propostas')) {
    return {
      screenLabel: 'Proposta e Preços',
      nextStep:
        'Coloque o custo real do seu produto ou serviço, some frete e impostos, e defina o lucro mínimo. Assim você gera o documento completo sem risco de prejuízo.',
      quickPrompts: [
        'Como montar meu preço deixando uma margem segura para negociar depois?',
        'O que preciso colocar na proposta para não ser desclassificado?',
        'Quanto tempo tenho para enviar a proposta final depois de ganhar?',
      ],
    };
  }

  if (path.includes('/robo') || path.includes('/disputa')) {
    return {
      screenLabel: 'Sala de Disputa',
      nextStep:
        'Confira seu valor mínimo em cada item, clique em Abrir Tela Espelhada para acompanhar o portal oficial ao lado e use o botão Copiar para dar seus lances sem errar.',
      quickPrompts: [
        'Qual a melhor estratégia para os minutos finais da disputa?',
        'Como conversar com o pregoeiro no chat sem perder meu lucro?',
        'O que fazer se um concorrente baixar o preço abaixo do possível?',
      ],
    };
  }

  if (path.includes('/cofre') || path.includes('/certidoes') || path.includes('/habilitacao')) {
    return {
      screenLabel: 'Documentos e Certidões',
      nextStep:
        'Confira se suas 5 certidões (Federal, Estadual, Municipal, FGTS e Trabalhista) estão válidas. Se você for ME ou EPP e alguma vencer, a lei dá 5 dias úteis para regularizar.',
      quickPrompts: [
        'Quais documentos toda empresa precisa ter prontos para licitar?',
        'Esqueci um documento na hora de enviar. Posso mandar depois?',
        'Como funciona o prazo extra para microempresa com certidão vencida?',
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
      screenLabel: 'Defesas e Recursos',
      nextStep:
        'Fique de olho nos prazos: até 3 dias úteis antes da abertura para questionar o edital, e manifeste interesse logo após o resultado se precisar recorrer.',
      quickPrompts: [
        'Quando vale a pena pedir esclarecimento ou impugnar um edital?',
        'Como fazer um recurso simples e direto contra desclassificação?',
        'Como apontar que um concorrente ofertou produto fora do que o edital pediu?',
      ],
    };
  }

  if (path.includes('/expertise-fiscal')) {
    return {
      screenLabel: 'Notas Fiscais e Impostos',
      nextStep:
        'Envie suas notas fiscais para conferir se houve desconto indevido de imposto no pagamento do órgão público ou se você tem direito a reajuste no contrato.',
      quickPrompts: [
        'Empresa do Simples Nacional deve ter imposto retido na nota para órgão público?',
        'Quando posso pedir reequilíbrio de preço porque meu custo subiu?',
        'Quais cuidados tomar ao emitir nota fiscal para prefeitura ou estado?',
      ],
    };
  }

  if (path.includes('/pos-vitoria') || path.includes('/contratos') || path.includes('/srp')) {
    return {
      screenLabel: 'Contratos e Entregas',
      nextStep:
        'Acompanhe suas notas de empenho e datas de entrega para cumprir tudo no prazo e receber sem atrasos.',
      quickPrompts: [
        'Como funciona o pedido de adesão (carona) em Ata de Registro de Preços?',
        'Preciso de mais prazo para entregar o pedido. Como pedir sem levar multa?',
        'Qual a diferença entre reajuste anual e revisão de preço do contrato?',
      ],
    };
  }

  return {
    screenLabel: 'Painel Principal',
    nextStep:
      'Comece conferindo os prazos do dia e suas certidões. Depois, escolha uma oportunidade na Busca de Editais para montar sua proposta.',
    quickPrompts: [
      'Sou iniciante: me explique passo a passo como vencer minha primeira licitação.',
      'Quais são os erros mais comuns que fazem empresas perderem licitações?',
      'Como organizar minha empresa para participar toda semana sem sufoco?',
    ],
  };
}

function buildHumanFallbackReply(question: string, guidance: RouteGuidance): string {
  return `Entendi sua dúvida sobre **"${question}"** aqui na tela de **${guidance.screenLabel}**! Vou te explicar de forma bem prática como funciona:

1. **O que você deve fazer agora nesta etapa:**
   ${guidance.nextStep}

2. **Prazos que você precisa ter sempre no radar:**
   - **Antes da sessão (até 3 dias úteis antes):** é o prazo máximo para tirar dúvidas ou pedir correção de alguma regra do edital.
   - **Na hora do desempate (Microempresa e EPP):** se o seu preço ficar até 5% acima do menor lance, você tem 5 minutos para dar um lance menor e assumir o 1º lugar.
   - **Depois de ganhar o item:** o pregoeiro abre o prazo (no mínimo 2 horas) para você enviar a proposta final ajustada com o valor vencedor.
   - **Se precisar recorrer:** assim que o resultado sair, manifeste no chat do portal que deseja recorrer e depois envie o texto completo em até 3 dias úteis.

Se quiser, me conte qual é o produto ou edital que você está olhando agora que eu te ajudo a montar a melhor estratégia!`;
}

export const LexFloatingWidget: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [imgError, setImgError] = useState(false);

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
      id: 'welcome-lex',
      role: 'assistant',
      content:
        'Oi! Eu sou o **Lex**, seu parceiro de licitações aqui na Expertise.\n\nPode falar comigo do seu jeito — seja sua primeira licitação ou sua centésima. Estou vendo em qual tela você está e vou te explicar tudo passo a passo: o que fazer agora, quais prazos vigiar e como proteger seu lucro. No que posso te ajudar?',
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

    const assistantMsgId = `lex-${Date.now() + 1}`;
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
        contexto: `Responda de forma 100% humana, acolhedora, clara e detalhada (sem jargões difíceis), explicando passo a passo como um consultor real conversando com o usuário. Tela atual: ${guidance.screenLabel} (${location.pathname}). Orientação da tela: ${guidance.nextStep}`,
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
              : buildHumanFallbackReply(question, guidance);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: finalContent } : msg,
            ),
          );
          setIsStreaming(false);
        },
        onError: () => {
          const fallback = buildHumanFallbackReply(question, guidance);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: fallback } : msg,
            ),
          );
          setIsStreaming(false);
        },
      });
    } catch {
      const fallback = buildHumanFallbackReply(question, guidance);
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
        content: `Pronto, limpei nossa conversa! Continuo com você aqui na tela de **${guidance.screenLabel}**. Qual dúvida posso esclarecer agora?`,
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
              : 'w-[92vw] sm:w-[440px] h-[640px] max-h-[84vh]'
          }`}
          role="dialog"
          aria-label="Lex — Seu Guia de Licitações"
        >
          <div className="bg-[#081c3a] text-white px-4 py-3.5 flex items-center justify-between border-b-2 border-[#0070c0] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0 overflow-hidden">
                {!imgError ? (
                  <img
                    src="/assets/mascote-3d.png"
                    alt="Lex"
                    className="w-9 h-9 object-contain"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <Bot className="w-5 h-5 text-[#ff6600]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base truncate">
                    Lex • Seu Guia
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0070c0] text-white">
                    Online
                  </span>
                </div>
                <p className="text-xs text-slate-200 truncate">
                  Explicação passo a passo, prazos e apoio em todas as telas
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
                          Preparando sua explicação...
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 mt-1 px-1">
                  {msg.role === 'user' ? 'Você' : 'Lex'} • {msg.timestamp}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-slate-200 shrink-0">
            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#ff6600]" />
              <span>Pergunte com 1 clique:</span>
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
              placeholder="Pergunte qualquer coisa sobre esta tela ou edital..."
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
          className="group flex items-center gap-3 pl-2.5 pr-4 py-2 rounded-full bg-[#081c3a] hover:bg-[#0070c0] text-white shadow-xl border-2 border-white transition-all duration-200 cursor-pointer"
          aria-label="Falar com o Lex"
        >
          <div className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center overflow-hidden shrink-0">
            {!imgError ? (
              <img
                src="/assets/mascote-3d.png"
                alt="Lex"
                className="w-9 h-9 object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <Bot className="w-5 h-5 text-[#ff6600]" />
            )}
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#081c3a]" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold leading-tight text-white flex items-center gap-1.5">
              <span>Fale com o Lex</span>
              <span className="px-2 py-0.5 rounded-full bg-[#ff6600] text-white text-[11px] font-semibold">
                Guia
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