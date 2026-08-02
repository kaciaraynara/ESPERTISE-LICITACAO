import { useState } from 'react';
import { motion } from 'framer-motion';

export default function LexPage() {
  const [messages] = useState([
    { id: 1, sender: 'bot', text: 'OlÃ¡! Sou Lex, a inteligÃªncia artificial da Expertise LicitatÃ³ria. Como posso te ajudar com a Lei 14.133 hoje?' },
    { id: 2, sender: 'user', text: 'Preciso gerar um recurso administrativo porque fui inabilitado injustamente no balanÃ§o patrimonial.' },
    { id: 3, sender: 'bot', text: 'Entendi. Para montar a fundamentaÃ§Ã£o exata do seu recurso, me informe: 1) O nÃºmero do PregÃ£o/Edital e o Ã“rgÃ£o e 2) Qual foi a justificativa exata que o pregoeiro usou para inabilitar o seu balanÃ§o na ata?' }
  ]);

  return (
    <div className="p-6 h-full flex flex-col w-full max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-blue flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" className="text-brand-orange"><path fill="currentColor" d="M208 80h-29.47a47.88 47.88 0 0 0-14.77-31.54l14.58-14.58a8 8 0 0 0-11.31-11.31l-14.58 14.58a47.88 47.88 0 0 0-31.54-14.77V22a8 8 0 0 0-16 0v10.38a47.88 47.88 0 0 0-31.54 14.77L59.07 32.57a8 8 0 1 0-11.31 11.31l14.58 14.58A47.88 47.88 0 0 0 48 90v6a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8v48a32 32 0 0 0 32 32h96a32 32 0 0 0 32-32v-48a8 8 0 0 0 8-8v-32a8 8 0 0 0-8-8ZM80 184a8 8 0 0 1 0-16h96a8 8 0 0 1 0 16Zm96-104a32 32 0 1 1-32 32a32 32 0 0 1 32-32Z"></path></svg>
          Lex Assistant
        </h1>
        <p className="text-slate-500 mt-1">Seu especialista jurÃ­dico movido a InteligÃªncia Artificial, treinado na Nova Lei de LicitaÃ§Ãµes (14.133).</p>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_rgba(0,39,135,0.05)] flex flex-col overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender === 'user' ? 'bg-brand-blue text-white rounded-tr-sm' : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'}`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="relative flex items-center">
            <textarea 
              placeholder="Descreva o problema ou peÃ§a para gerar um recurso..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-14 py-3 text-sm focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange resize-none h-14"
              rows={1}
            ></textarea>
            <button className="absolute right-2 top-2 p-2 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="currentColor" d="M231.87 114l-168-95.89A16 16 0 0 0 40.92 37.34L71.55 128L40.92 218.67A16 16 0 0 0 56 240a16.15 16.15 0 0 0 7.93-2.1l167.92-96.05a16 16 0 0 0 .02-27.85ZM56 224a1.32 1.32 0 0 1-1.39-1.25L83.08 136H136a8 8 0 0 0 0-16H83.09L54.61 33.25A1.32 1.32 0 0 1 56 32l168 96Z"></path></svg>
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">A Lex pode cometer erros. Considere verificar as informaÃ§Ãµes importantes.</p>
        </div>
      </div>
    </div>
  );
}

