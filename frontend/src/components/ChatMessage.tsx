import React from 'react';
import ReactMarkdown from 'react-markdown';

export interface ChatMessageProps {
  id?: string;
  sender?: 'lex' | 'user';
  role?: 'lex' | 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  sender,
  role,
  content,
  isStreaming = false,
  className = '',
}) => {
  const isUser = sender === 'user' || role === 'user';

  // Pré-processamento leve para garantir que listas com hífen e quebras de linha sejam interpretadas de forma fluida pelo markdown
  const sanitizedContent = (content || '').replace(/\r\n/g, '\n');

  return (
    <div
      className={`relative break-words leading-relaxed select-text font-normal ${
        isUser ? 'text-white' : 'text-slate-800'
      } ${className}`}
      style={{ backgroundColor: 'transparent' }}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed text-inherit bg-transparent">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-inherit bg-transparent tracking-tight">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-inherit bg-transparent">
              {children}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5 pl-4 list-disc marker:text-[#EA580C] text-inherit bg-transparent">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 space-y-1.5 pl-4 list-decimal marker:text-[#EA580C] marker:font-bold text-inherit bg-transparent">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1 text-inherit bg-transparent">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-3 border-[#EA580C] pl-3 py-1 italic bg-slate-50/80 rounded-r-md text-slate-700 text-xs">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClass }) => {
            const isInline = !codeClass;
            return isInline ? (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] border border-slate-200">
                {children}
              </code>
            ) : (
              <pre className="my-2.5 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
                <code>{children}</code>
              </pre>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-sm font-black text-inherit mt-3 mb-1.5 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xs font-bold text-inherit mt-2.5 mb-1 first:mt-0 uppercase tracking-wide">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-inherit mt-2 mb-1 first:mt-0">
              {children}
            </h3>
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>

      {isStreaming && (
        <span
          className="inline-block w-1.5 h-3.5 ml-1 bg-[#EA580C] animate-pulse rounded-sm align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default ChatMessage;

