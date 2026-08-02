import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { aiApi } from '@services/api';

export type LexAIMessage = {
  id: string;
  role: 'user' | 'lex';
  content: string;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

    setMessages((current) => [
      ...current,
      { id: createId('user'), role: 'user', content: cleanQuestion },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiApi.consultar({ pergunta: cleanQuestion, contexto });
      const resposta = response.data?.data?.resposta || 'Não consegui gerar uma resposta agora.';
      setMessages((current) => [
        ...current,
        { id: createId('lex'), role: 'lex', content: resposta },
      ]);
    } catch {
      const message = 'Não consegui consultar o LEX agora. Se houver prazo em aberto, envie a dúvida para revisão jurídica e tente novamente em alguns instantes.';
      setMessages((current) => [
        ...current.filter((item) => item.id !== 'lex-unavailable'),
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

  function sendLastAnswerToLawyer() {
    if (!lastAnswer) return;

    window.sessionStorage.setItem('expertise:lex:sos-draft', lastAnswer);
    toast.success('Resposta separada para revisão jurídica.');
    window.location.href = '/licitante/juridico';
  }

  return {
    input,
    setInput,
    messages,
    isLoading,
    lastAnswer,
    ask,
    copyLastAnswer,
    sendLastAnswerToLawyer,
  };
}