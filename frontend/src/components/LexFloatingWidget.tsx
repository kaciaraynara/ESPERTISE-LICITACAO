import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Bot,
  ChevronRight,
  Compass,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
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
      screenLabel: 'Dossiê do Edital',
      nextStep:
        'Confira os itens do Termo de Referência, verifique se há exigência de atestado acima de 50% (Súmula 263/TCU) e simule seu preço mínimo antes de cadastrar proposta.',
      quickPrompts: [
        'Quais pontos de atenção devo checar neste edital antes de disputar?',
        'Como impugnar exigência restritiva em até 3 dias úteis (Art. 164)?',
        'Qual a regra de empate ficto ME/EPP (5% em 5 minutos) no pregão?',
      ],
    };
  }

  if (path.includes('/licitacoes') || path.includes('/radar') || path.includes('/monitorados')) {
    return {
      screenLabel: 'Buscar Oportunidades (PNCP)',
      nextStep:
        'Filtre os editais por UF e situação "A Receber Propostas", abra o edital com maior aderência ao seu catálogo e envie os itens para a calculadora de Precificação & BDI.',
      quickPrompts: [
        'Como escolher os editais com maior chance de vitória e margem?',
        'O que fazer quando o valor estimado do edital é sigiloso?',
        'Como funciona o modo de disputa Aberto-Fechado (IN 73/2022)?',
      ],
    };
  }

  if (path.includes('/precificacao') || path.includes('/propostas')) {
    return {
      screenLabel: 'Precificação & BDI / Propostas',
      nextStep:
        'Defina seu custo real de reposição, impostos do seu regime tributário, frete e margem mínima para travar o seu Stop-Loss (Piso Mínimo Exequível) antes da sessão.',
      quickPrompts: [
        'Como calcular meu Stop-Loss reservando gordura para negociar no Art. 61?',
        'Como comprovar exequibilidade se meu lance ficar abaixo de 75% (Súmula 262/TCU)?',
        'Qual o prazo para enviar a proposta readequada após vencer o item?',
      ],
    };
  }

  if (path.includes('/robo') || path.includes('/disputa')) {
    return {
      screenLabel: 'Mesa Operacional de Disputa e Lances',
      nextStep:
        'Mantenha o Stop-Loss travado em cada item, acompanhe os 2 minutos finais no modo Aberto (ou a faixa de 10% no Aberto-Fechado) e responda ao Pregoeiro no chat em até 60 segundos.',
      quickPrompts: [
        'Qual a melhor tática para o lance fechado de 5 minutos no modo Aberto-Fechado?',
        'Como negociar com o Pregoeiro no chat (Art. 61) sem perder margem?',
        'Como exigir diligência se o concorrente der mergulho de preço inexequível?',
      ],
    };
  }

  if (path.includes('/cofre') || path.includes('/certidoes') || path.includes('/habilitacao')) {
    return {
      screenLabel: 'Habilitação e Documentos (Art. 62 a 70)',
      nextStep:
        'Verifique a validade das certidões fiscais, FGTS e CNDT. Se você for ME/EPP com restrição fiscal, a LC 123/2006 garante 5 dias úteis prorrogáveis por mais 5 para regularizar.',
      quickPrompts: [
        'Esqueci um documento preexistente: como usar o Acórdão 1211/2021 do TCU?',
        'Como funciona o prazo de 5 + 5 dias úteis para certidão vencida de ME/EPP?',
        'Qual o limite legal de quantitativos em atestados técnicos (Art. 67, § 2º)?',
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
      screenLabel: 'Defesa Jurídica, Impugnação e Recursos',
      nextStep:
        'Observe o prazo fatal de 3 dias úteis antes da abertura para Impugnação (Art. 164) e manifeste intenção imediata no sistema para Recurso Administrativo com 3 dias úteis para razões (Art. 165).',
      quickPrompts: [
        'Estruture argumentos contra agrupamento indevido em lote único (Súmula 247/TCU).',
        'Estruture recurso contra inabilitação formal citando o Acórdão 1211/2021-TCU.',
        'Como pedir desclassificação de concorrente que descumpriu marca/modelo do edital?',
      ],
    };
  }

  if (path.includes('/expertise-fiscal')) {
    return {
      screenLabel: 'Expertise Fiscal & Tributária',
      nextStep:
        'Importe os XMLs de NF-e, audite retenções da IN RFB 1.234/2012 (evitando retenção indevida no Simples Nacional) e gere a minuta de Reequilíbrio Econômico-Financeiro (Art. 124, II, "d").',
      quickPrompts: [
        'Empresa do Simples Nacional sofre retenção de IR/PIS/COFINS pela IN 1.234/2012?',
        'Como pedir Reequilíbrio Econômico-Financeiro por aumento de carga tributária (Art. 134)?',
        'Como evitar glosa fiscal na emissão da nota de empenho para órgão público?',
      ],
    };
  }

  if (path.includes('/pos-vitoria') || path.includes('/contratos') || path.includes('/srp')) {
    return {
      screenLabel: 'Gestão Contratual e Atas de Registro de Preços (SRP)',
      nextStep:
        'Monitore o saldo de empenhos, os prazos de entrega e os limites de adesão ("carona") do Art. 86 da Lei 14.133/2021 (50% por órgão carona e 200% no total).',
      quickPrompts: [
        'Quais são os limites de carona em Ata de Registro de Preços (Decreto 11.462/2023)?',
        'Como solicitar prorrogação de prazo de entrega sem sofrer multa contratual?',
        'Quando cabe reajuste (IPCA) versus revisão/reequilíbrio contratual?',
      ],
    };
  }

  return {
    screenLabel: 'Painel Estratégico Expertise Licitatória',
    nextStep:
      'Revise os alertas de prazos do dia, confira suas certidões vigentes e selecione uma oportunidade no PNCP para iniciar a análise de viabilidade e precificação.',
    quickPrompts: [
      'Me dê um roteiro rápido em 4 passos para vencer licitações com lucro seguro.',
      'Quais são as principais armadilhas da Lei 14.133/2021 na fase de habilitação?',
      'Como negociar no chat com o Pregoeiro (Art. 61) mantendo minha margem?',
    ],
  };
}

function buildOfflineContingencyReply(question: string, guidance: RouteGuidance): string {
  return `**[Fato da fonte]**
Você está em **${guidance.screenLabel}**. Sua dúvida foi registrada: *"${question}"*.

**[Cálculo reproduzível]**
- **Impugnação e Esclarecimentos (Art. 164 da Lei 14.133/2021)**: até **3 (três) dias úteis** antes da data de abertura do certame.
- **Recurso Administrativo (Art. 165, I da Lei 14.133/2021)**: intenção imediata no chat da sessão e **3 (três) dias úteis** para apresentação das razões recursais.
- **Empate Ficto ME/EPP (Art. 44, § 2º da LC 123/2006)**: margem de até **5% (cinco por cento)** no pregão com envio de lance em até **5 (cinco) minutos**.
- **Proposta Readequada (IN SEGES/ME 73/2022, Art. 29, § 2º)**: prazo mínimo de **2 (duas) horas**, prorrogável mediante solicitação motivada antes do vencimento.

**[Indício]**
- Na habilitação técnica (**Art. 67, § 2º da Lei 14.133/2021 e Súmula 263/TCU**), o edital não pode exigir atestados superiores a **50%** dos quantitativos das parcelas de maior relevância.
- Caso falte documento preexistente à abertura da sessão, exija a abertura de diligência com base no **Art. 64 da Lei 14.133/2021** e no **Acórdão 1211/2021-TCU-Plenário**.

**[Hipótese]**
- Na negociação do **Art. 61**, mantenha reserva tática de 0,5% a 1,5% acima do seu **Stop-Loss** e demonstre a exequibilidade da proposta com notas fiscais de entrada e planilha de custos (**Súmula 262/TCU e Art. 59, § 2º**).

**[Próximo Passo Recomendado]**
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
      id: 'welcome-lex',
      role: 'assistant',
      content: `Olá! Sou o **Lex**, seu consultor estratégico com **40 anos de experiência prática em licitações públicas** (Lei 14.133/2021, LC 123/2006, IN 73/2022 e Jurisprudência do TCU).\n\nEstou acompanhando sua tela atual e pronto para orientar sua precificação, estratégia de lances, negociação com o Pregoeiro ou defesa jurídica.`,
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
        content: `Histórico reiniciado. Estou acompanhando a tela **${guidance.screenLabel}**. Qual é a sua dúvida jurídica, tributária ou de disputa?`,
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
          className={`bg-white border border-slate-300 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] sm:w-[640px] h-[84vh]'
              : 'w-[92vw] sm:w-[430px] h-[640px] max-h-[84vh]'
          }`}
          role="dialog"
          aria-label="Assistente Estratégico Lex"
        >
          {/* Cabeçalho Institucional nas Cores Originais da Marca */}
          <div className="bg-[#081c3a] text-white px-4 py-3.5 flex items-center justify-between border-b-2 border-[#0070c0] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/assets/mascote-3d.png"
                  alt="Lex"
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Bot className="w-5 h-5 text-[#ff6600] hidden" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base truncate">
                    Consultor Lex
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#0070c0] text-white">
                    40 Anos de Experiência
                  </span>
                </div>
                <p className="text-xs text-slate-200 truncate">
                  Lei 14.133/2021 • Jurisprudência TCU • Estratégia de Lances
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearHistory}
                title="Limpar conversa"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Reduzir janela' : 'Expandir janela'}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
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
                title="Fechar assistente"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Banner Contextual de Próximo Passo Recomendado (Estilo Mercado Pago / Gov.br) */}
          <div className="bg-[#f8fafc] border-b border-slate-200 px-4 py-3 shrink-0">
            <div className="flex items-start gap-2.5 border-l-4 border-[#0070c0] pl-3">
              <Compass className="w-4 h-4 text-[#0070c0] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#081c3a]">
                    Próximo Passo Recomendado • {guidance.screenLabel}
                  </span>
                </div>
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
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm ${
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
                          Consultando legislação e jurisprudência do TCU...
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

          {/* Atalhos Táticos Rápidos da Tela Atual */}
          <div className="px-4 py-2 bg-[#f8fafc] border-t border-slate-200 shrink-0">
            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#ff6600]" />
              Perguntas rápidas sobre esta etapa:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {guidance.quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void handleSendQuestion(prompt)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-[#0070c0] hover:bg-blue-50/40 text-xs font-medium text-[#081c3a] transition-colors disabled:opacity-50"
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
              placeholder="Pergunte sobre o edital, lances, recursos ou impostos..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#f8fafc] border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#0070c0] focus:bg-white"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isStreaming}
              className="px-4 py-2.5 rounded-xl bg-[#0070c0] hover:bg-[#081c3a] text-white font-semibold text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
          className="group flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-full bg-[#081c3a] hover:bg-[#0070c0] text-white shadow-xl border-2 border-white transition-all duration-200"
          aria-label="Abrir Consultor Lex"
        >
          <div className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="/assets/mascote-3d.png"
              alt="Lex"
              className="w-7 h-7 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#ff6600] ring-2 ring-[#081c3a]" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold leading-tight text-white flex items-center gap-1.5">
              <span>Consultor Lex</span>
              <span className="px-1.5 py-0.5 rounded bg-[#0070c0] group-hover:bg-[#081c3a] text-white text-xs font-semibold">
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
