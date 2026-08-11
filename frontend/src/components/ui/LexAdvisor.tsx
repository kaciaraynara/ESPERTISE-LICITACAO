import { FormEvent, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpenText,
  CopySimple,
  Gavel,
  PaperPlaneTilt,
  Scales,
  ShieldCheck,
  SpinnerGap,
  UserFocus,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useLexAI } from '@hooks/useLexAI';

type ThinIcon = typeof BookOpenText;

type QuickAction = {
  id: string;
  label: string;
  icon: ThinIcon;
  prompt: string;
};

const TYPING_DOT_DELAY_CLASSES = ['[animation-delay:0ms]', '[animation-delay:140ms]', '[animation-delay:280ms]'];

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'lei-14133',
    label: 'Lei 14.133',
    icon: BookOpenText,
    prompt: 'Resuma em linguagem executiva o principal risco desta situação com base na Lei 14.133/2021.',
  },
  {
    id: 'tcu',
    label: 'TCU',
    icon: Scales,
    prompt: 'Aponte cuidados do TCU relevantes para julgamento, habilitação ou impugnação neste caso.',
  },
  {
    id: 'impugnacao',
    label: 'Impugnação',
    icon: Gavel,
    prompt: 'Indique se há tese objetiva de impugnação e quais pontos precisam de revisão humana.',
  },
  {
    id: 'habilitacao',
    label: 'Habilitação',
    icon: ShieldCheck,
    prompt: 'Monte um checklist curto dos documentos de habilitação e riscos de inabilitação.',
  },
  {
    id: 'risco',
    label: 'Risco crítico',
    icon: WarningCircle,
    prompt: 'Liste riscos críticos e próximos passos antes de enviar lance ou proposta.',
  },
];

function renderContent(content: string) {
  return content.split('\n').map((line, index, lines) => (
    <span key={`${line}-${index}`}>
      {line.replace(/\*\*(.*?)\*\*/g, '$1')}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function TypingPulse() {
  return (
    <span className="inline-flex items-center gap-2 text-white">
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className={`h-2 w-2 animate-pulse bg-white ${TYPING_DOT_DELAY_CLASSES[item]}`}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-white">LEX está digitando</span>
    </span>
  );
}

export function LexAdvisor() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    input,
    setInput,
    messages,
    isLoading,
    lastAnswer,
    ask,
    copyLastAnswer,

  } = useLexAI();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      window.setTimeout(() => inputRef.current?.focus(), 160);
    }
  }, [messages, isLoading, isOpen]);

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    ask(input, 'Dashboard do fornecedor na plataforma Expertise.');
  }

  const canUseAnswerActions = Boolean(lastAnswer && !isLoading);

  return (
    <>
      {isOpen ? (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          className="fixed bottom-24 right-6 z-[70] flex h-[560px] w-[560px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-[0_22px_70px_rgba(27,27,27,0.12)]"
        >
          <header className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-md border border-[#1B1B1B] text-brand-blue">
                <Scales className="h-6 w-6" weight="thin" />
              </span>
              <div>
                <p className="text-sm font-semibold text-brand-blue">LEX</p>
                <p className="text-xs text-brand-blue/70">Lei 14.133/2021, TCU e revisão executiva</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-100 text-brand-blue/70 transition hover:border-brand-blue/20 hover:text-brand-blue"
              aria-label="Fechar LEX"
            >
              <X className="h-5 w-5" weight="thin" />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_180px]">
            <div className="flex min-w-0 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto bg-white p-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'lex' ? (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-100 bg-white text-brand-blue">
                        <Scales className="h-4 w-4" weight="thin" />
                      </span>
                    ) : null}
                    <div className={`max-w-[86%] border px-4 py-3 text-sm leading-6 ${
                      message.role === 'lex'
                        ? 'border-[#1B1B1B] bg-brand-blue text-white'
                        : 'border-gray-100 bg-white text-brand-blue'
                    }`}>
                      {renderContent(message.content)}
                    </div>
                  </div>
                ))}

                {isLoading ? (
                  <div className="flex gap-2">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-100 bg-white text-brand-blue">
                      <Scales className="h-4 w-4" weight="thin" />
                    </span>
                    <div className="border border-[#1B1B1B] bg-brand-blue px-4 py-3">
                      <TypingPulse />
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-100 bg-white p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyLastAnswer}
                    disabled={!canUseAnswerActions}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-brand-blue transition hover:border-brand-blue/20 disabled:opacity-45"
                  >
                    <CopySimple className="h-4 w-4" weight="thin" />
                    Copiar resposta
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    id="lex-input"
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Digite sua dúvida objetiva"
                    disabled={isLoading}
                    className="h-11 flex-1 rounded-md border border-gray-100 bg-white px-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 disabled:opacity-60"
                  />
                  <motion.button
                    type="submit"
                    id="lex-send-btn"
                    disabled={!input.trim() || isLoading}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(30,58,138,0.18)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-blue text-white transition disabled:bg-[#E9E1D8] disabled:text-brand-blue/60"
                  >
                    {isLoading ? <SpinnerGap className="h-5 w-5 animate-spin" weight="thin" /> : <PaperPlaneTilt className="h-5 w-5" weight="thin" />}
                  </motion.button>
                </form>
              </div>
            </div>

            <aside className="border-l border-gray-100 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-blue/60">Ações rápidas</p>
              </div>
              <div className="space-y-2 p-3">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.id}
                      type="button"
                      onClick={() => ask(action.prompt, 'Consulta rápida aberta pelo widget flutuante do LEX.')}
                      disabled={isLoading}
                      whileHover={{ scale: 1.02, boxShadow: '0 0 18px rgba(30,58,138,0.10)' }}
                      className="flex w-full items-center gap-3 rounded-md border border-gray-100 bg-white px-3 py-3 text-left text-xs font-semibold text-brand-blue transition hover:border-brand-blue/20 disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 shrink-0" weight="thin" />
                      {action.label}
                    </motion.button>
                  );
                })}
              </div>
              <div className="mx-3 mt-2 rounded-md border border-brand-orange/35 bg-[#F3F1FF] p-3 text-xs leading-5 text-[#45378F]">
                Se houver impacto jurídico, envie a resposta para revisão humana antes do protocolo.
              </div>
            </aside>
          </div>
        </motion.section>
      ) : null}

      <motion.button
        type="button"
        id="lex-advisor-btn"
        onClick={() => setIsOpen((value) => !value)}
        whileHover={{ scale: 1.02, boxShadow: '0 0 26px rgba(30,58,138,0.24)' }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-6 right-6 z-[70] flex h-14 items-center gap-3 rounded-lg bg-brand-blue px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_18px_48px_rgba(27,27,27,0.16)]"
        aria-label="Abrir LEX"
      >
        <Scales className="h-5 w-5" weight="thin" />
        LEX
      </motion.button>
    </>
  );
}
