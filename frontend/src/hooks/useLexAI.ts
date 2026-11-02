import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { streamAiChat } from '../services/aiStream.service';

export type LexAIMessage = {
  id: string;
  role: 'user' | 'lex';
  content: string;
  isStreaming?: boolean;
};

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useLexAI() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<LexAIMessage[]>([
    {
      id: 'welcome',
      role: 'lex',
      content: 'Sou o LEX. Posso ajudar a transformar dúvidas sobre edital, habilitação, recurso ou risco jurídico em próximos passos objetivos.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const lastAnswer = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'lex' && message.id !== 'welcome' && message.id !== 'lex-unavailable')?.content ?? '',
    [messages],
  );

  async function ask(pergunta: string, contexto?: string) {
    const cleanQuestion = pergunta.trim();
    if (!cleanQuestion || isLoading) return;

    const botMessageId = createId('lex');

    setMessages((current) => [
      ...current,
      { id: createId('user'), role: 'user', content: cleanQuestion },
      { id: botMessageId, role: 'lex', content: '', isStreaming: true },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      await streamAiChat({
        endpoint: '/ai/consultar',
        pergunta: cleanQuestion,
        contexto,
        onChunk: (_chunk, accumulated) => {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === botMessageId ? { ...msg, content: accumulated } : msg
            )
          );
        },
        onDone: (fullText) => {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, content: fullText || 'Resposta concluída.', isStreaming: false }
                : msg
            )
          );
        },
        onError: (err) => {
          throw err;
        },
      });
    } catch {
      const message = 'Não consegui consultar o LEX agora. Se houver prazo em aberto, envie a dúvida para revisão jurídica e tente novamente em alguns instantes.';
      setMessages((current) => [
        ...current.filter((item) => item.id !== botMessageId && item.id !== 'lex-unavailable'),
        { id: 'lex-unavailable', role: 'lex', content: message },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyLastAnswer() {
    if (!lastAnswer) return;

    await navigator.clipboard.writeText(lastAnswer);
    toast.success('Resposta do LEX copiada.');
  }


  return {
    input,
    setInput,
    messages,
    isLoading,
    lastAnswer,
    ask,
    copyLastAnswer,

  };
}