import { useState } from 'react';
import { motion } from 'framer-motion';

export default function LexPage() {
  const [messages] = useState([
    { id: 1, sender: 'bot', text: 'Olá! Sou Lex, o Especialista Jurídico Digital da Expertise Licitatória. Como posso apoiar sua estratégia hoje?' },
    { id: 2, sender: 'user', text: 'Fui inabilitado no balanço patrimonial e preciso de um recurso administrativo.' },
    { id: 3, sender: 'bot', text: 'Perfeito. Para estruturarmos uma fundamentação sólida, por favor, me informe o número do Pregão/Edital e qual foi a justificativa exata registrada em ata pelo pregoeiro.' }
  ]);

  return (
    <div className="p-6 h-full flex flex-col w-full max-w-5xl mx-auto bg-[#F3F8FF] min-h-screen">
      <div className="mb-6 px-4">
        <h1 className="text-3xl font-black text-[#0A2540] flex items-center gap-3 uppercase tracking-tighter">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" className="text-[#EA580C] drop-shadow-sm"><path fill="currentColor" d="M208 80h-29.47a47.88 47.88 0 0 0-14.77-31.54l14.58-14.58a8 8 0 0 0-11.31-11.31l-14.58 14.58a47.88 47.88 0 0 0-31.54-14.77V22a8 8 0 0 0-16 0v10.38a47.88 47.88 0 0 0-31.54 14.77L59.07 32.57a8 8 0 1 0-11.31 11.31l14.58 14.58A47.88 47.88 0 0 0 48 90v6a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8v48a32 32 0 0 0 32 32h96a32 32 0 0 0 32-32v-48a8 8 0 0 0 8-8v-32a8 8 0 0 0-8-8ZM80 184a8 8 0 0 1 0-16h96a8 8 0 0 1 0 16Zm96-104a32 32 0 1 1-32 32a32 32 0 0 1 32-32Z"></path></svg>
          Lex Assistant
        </h1>
        <p className="text-slate-500 mt-1 font-medium text-sm">Seu consultor digital sênior para análise de editais e formulação de teses jurídicas na Nova Lei de Licitações (14.133).</p>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden mx-4 mb-4">
        {/* Chat Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.sender === 'user' ? 'bg-[#0A2540] text-white rounded-tr-sm' : 'bg-slate-50 border border-slate-200 text-[#0A2540] rounded-tl-sm'}`}>
                <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="relative flex items-center group">
            <textarea 
              placeholder="Descreva o cenário da disputa ou peça para elaborar um recurso..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-14 py-4 text-sm font-medium focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] resize-none h-16 shadow-sm transition-all group-hover:border-slate-300"
              rows={1}
            ></textarea>
            <button className="absolute right-3 top-3 p-2 bg-[#EA580C] text-white rounded-lg hover:bg-orange-600 transition-all shadow-md active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="currentColor" d="M231.87 114l-168-95.89A16 16 0 0 0 40.92 37.34L71.55 128L40.92 218.67A16 16 0 0 0 56 240a16.15 16.15 0 0 0 7.93-2.1l167.92-96.05a16 16 0 0 0 .02-27.85ZM56 224a1.32 1.32 0 0 1-1.39-1.25L83.08 136H136a8 8 0 0 0 0-16H83.09L54.61 33.25A1.32 1.32 0 0 1 56 32l168 96Z"></path></svg>
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-3 font-medium">Sempre revise as teses e fundamentações. O Lex atua como um assistente especialista, mas a decisão final é sua.</p>
        </div>
      </div>
    </div>
  );
}

