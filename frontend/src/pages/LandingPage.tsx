import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, CheckCircle, MagnifyingGlass, FileText, 
  PaperPlaneRight, LockKey, ChartLineUp, Clock, CaretDown,
  Money, CaretRight
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const AnimatedCounter = ({ end, duration = 2, prefix = "", suffix = "" }: { end: number, duration?: number, prefix?: string, suffix?: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.ceil(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [end, duration]);

  return <span>{prefix}{count.toLocaleString('pt-BR')}{suffix}</span>;
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "O sistema mostra informações reais ou simulações?",
      a: "Mostra apenas dados oficiais dos portais do governo."
    },
    {
      q: "Como a ferramenta impede que eu tenha prejuízo nos lances?",
      a: "Você define a margem mínima. O sistema trava automaticamente quando o valor chega nela."
    },
    {
      q: "Meus documentos estão protegidos?",
      a: "Sim. Tudo fica criptografado e isolado. Só você tem acesso."
    }
  ];

  const tools = [
    {
      title: "Buscador de Compras 24h",
      desc: "Monitora os portais do governo o dia inteiro. Você encontra as compras abertas no seu estado antes de todo mundo.",
      icon: <MagnifyingGlass weight="fill" className="w-8 h-8 text-[#EA580C]" />
    },
    {
      title: "Revisor de Editais",
      desc: "Lê o edital em segundos e destaca as exigências que podem desclassificar sua empresa.",
      icon: <FileText weight="fill" className="w-8 h-8 text-[#EA580C]" />
    },
    {
      title: "Envio Automático de Preços",
      desc: "Acompanha as ofertas da concorrência e envia seus preços na velocidade máxima, respeitando a margem mínima que você definiu.",
      icon: <PaperPlaneRight weight="fill" className="w-8 h-8 text-[#EA580C]" />
    },
    {
      title: "Pasta Protegida + Alertas",
      desc: "Organiza todos os documentos da empresa e avisa no WhatsApp dias antes de qualquer vencimento.",
      icon: <LockKey weight="fill" className="w-8 h-8 text-[#EA580C]" />
    }
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, type: "spring", bounce: 0.2 } }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A2540] font-sans antialiased text-white selection:bg-[#EA580C] selection:text-white overflow-x-hidden">
      
      {/* HEADER */}
      <header className="absolute top-0 z-50 w-full bg-transparent">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6 md:px-12">
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <img src="/logo.png" alt="Expertise Licitatória" className="h-12 md:h-16 w-auto object-contain brightness-0 invert drop-shadow-md" />
          </div>
          <nav className="hidden lg:flex items-center gap-6">
            <button onClick={() => navigate('/login')} className="text-sm font-bold uppercase tracking-wider text-white hover:text-[#EA580C] transition-colors">
              Entrar
            </button>
            <button onClick={() => navigate('/register')} className="bg-[#EA580C] hover:bg-orange-600 text-white text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-orange-500/30">
              Criar Conta
            </button>
          </nav>
        </div>
      </header>

      {/* 1. HERO SECTION */}
      <section className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 px-6 md:px-12 flex flex-col lg:flex-row items-center max-w-7xl mx-auto gap-16">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="w-full lg:w-[55%] flex flex-col gap-8 relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-[1.1] text-white drop-shadow-sm">
            Feche mais contratos com o governo sem perder noites lendo editais.
          </h1>
          <p className="text-lg md:text-xl font-medium leading-relaxed text-blue-100 max-w-2xl">
            Monitore compras abertas 24 horas, descubra exigências perigosas em segundos e envie seus preços automaticamente. Tudo com dados oficiais e proteção total.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 pl-2">
                Dados oficiais em tempo real • Zero simulações
              </span>
              <button onClick={() => navigate('/register')} className="group flex items-center justify-center gap-3 bg-[#EA580C] hover:bg-orange-600 text-white text-sm md:text-base font-black uppercase tracking-widest px-8 py-5 rounded-xl transition-all shadow-xl hover:shadow-orange-500/40 w-full">
                Criar minha Central de Comando
                <CaretRight weight="bold" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <button onClick={() => document.getElementById('ferramentas')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-center bg-white/10 hover:bg-white/20 text-white text-sm md:text-base font-bold uppercase tracking-widest px-8 py-5 rounded-xl transition-all backdrop-blur-sm mt-6 sm:mt-6 w-full sm:w-auto">
              Ver como funciona em 90 segundos
            </button>
          </div>
        </motion.div>
        
        {/* Mockup / Visual */}
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.3, type: "spring" }} className="w-full lg:w-[45%] relative z-10 hidden md:block">
           <div className="w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#0f3457] to-[#0a1e35] border border-white/10 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 w-full h-10 bg-black/20 flex items-center px-4 gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-400/50"></div>
                 <div className="w-3 h-3 rounded-full bg-amber-400/50"></div>
                 <div className="w-3 h-3 rounded-full bg-emerald-400/50"></div>
              </div>
              <div className="p-8 pt-16 h-full flex flex-col gap-4">
                 <div className="w-full h-12 bg-white/5 rounded-lg border border-white/5 flex items-center px-4 gap-4">
                    <MagnifyingGlass className="w-5 h-5 text-slate-400" />
                    <div className="w-1/3 h-2 bg-slate-600 rounded"></div>
                 </div>
                 <div className="flex gap-4 h-full">
                    <div className="w-2/3 h-full bg-white/5 rounded-lg border border-white/5 p-4 flex flex-col gap-4">
                       <div className="w-1/2 h-3 bg-slate-500 rounded"></div>
                       <div className="w-3/4 h-2 bg-slate-600 rounded mt-4"></div>
                       <div className="w-5/6 h-2 bg-slate-600 rounded"></div>
                       <div className="w-4/6 h-2 bg-slate-600 rounded"></div>
                    </div>
                    <div className="w-1/3 h-full flex flex-col gap-4">
                       <div className="w-full flex-1 bg-[#EA580C]/20 rounded-lg border border-[#EA580C]/30 p-4 flex items-center justify-center">
                          <ChartLineUp className="w-12 h-12 text-[#EA580C] opacity-50" />
                       </div>
                       <div className="w-full flex-1 bg-white/5 rounded-lg border border-white/5"></div>
                    </div>
                 </div>
              </div>
           </div>
        </motion.div>
      </section>

      {/* 2. SEÇÃO DE DOR */}
      <section className="w-full bg-white py-24 px-6 md:px-12 relative border-t border-slate-100">
         <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-[#0A2540] mb-6">
               Você está deixando dinheiro na mesa todos os dias
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-lg md:text-xl text-slate-600 max-w-3xl mb-16 font-medium leading-relaxed">
               Pesquisar editais página por página e ler centenas de folhas para encontrar uma exigência escondida suga a energia da sua empresa e impede você de lucrar.
            </motion.p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-12 sm:gap-24 w-full">
               <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, type: "spring" }} className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-50 text-[#EA580C] mb-6">
                     <Clock weight="fill" className="w-8 h-8" />
                  </div>
                  <div className="text-5xl md:text-6xl font-black text-[#EA580C] tracking-tighter flex items-center gap-2">
                     <AnimatedCounter end={35} /> <span className="text-2xl md:text-3xl mt-3 uppercase">horas</span>
                  </div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-4">Buscando e lendo papéis</div>
               </motion.div>

               <div className="hidden sm:block w-px h-32 bg-slate-200"></div>

               <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2, type: "spring" }} className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-50 text-[#EA580C] mb-6">
                     <Money weight="fill" className="w-8 h-8" />
                  </div>
                  <div className="text-5xl md:text-6xl font-black text-[#EA580C] tracking-tighter flex items-center gap-2">
                     <span className="text-2xl md:text-3xl mt-3 uppercase">R$</span> <AnimatedCounter end={12500} />
                  </div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-4">Em oportunidades invisíveis</div>
               </motion.div>
            </div>
         </div>
      </section>

      {/* 3. FERRAMENTAS PRINCIPAIS */}
      <section id="ferramentas" className="w-full bg-[#0A2540] py-24 px-6 md:px-12 border-t border-white/5">
         <div className="max-w-7xl mx-auto">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white mb-16 text-center">
               As ferramentas que colocam você na frente
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {tools.map((tool, idx) => (
                  <motion.div 
                     key={idx}
                     initial={{ opacity: 0, y: 30 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     transition={{ duration: 0.5, delay: idx * 0.1 }}
                     whileHover={{ y: -8 }}
                     className="bg-white/5 border border-white/10 hover:border-[#EA580C]/50 rounded-2xl p-8 md:p-10 transition-all cursor-default group shadow-xl"
                  >
                     <div className="w-16 h-16 rounded-xl bg-white/10 group-hover:bg-[#EA580C]/20 flex items-center justify-center mb-6 transition-colors">
                        {tool.icon}
                     </div>
                     <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider mb-4 group-hover:text-[#EA580C] transition-colors">{tool.title}</h3>
                     <p className="text-blue-100/80 text-base md:text-lg leading-relaxed font-medium">
                        {tool.desc}
                     </p>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* 4. COMPARAÇÃO DE REALIDADE */}
      <section className="w-full bg-slate-50 py-24 px-6 md:px-12">
         <div className="max-w-5xl mx-auto text-center">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
               Seu concorrente trabalha duro. Você trabalha certo.
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto font-medium leading-relaxed mb-12">
               Enquanto eles perdem tardes preenchendo planilhas e checando sites confusos, a Expertise faz o trabalho pesado.
            </motion.p>
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="bg-[#0A2540] rounded-3xl p-12 md:p-16 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full bg-[#EA580C]/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
               <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white relative z-10 leading-snug">
                  O que você faria com <span className="text-[#EA580C]">40 horas livres</span> por semana?
               </h3>
            </motion.div>
         </div>
      </section>

      {/* 5. SEGURANÇA E CONFIANÇA */}
      <section className="w-full bg-white py-24 px-6 md:px-12 border-t border-slate-100">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="w-full md:w-1/2">
               <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
                  Infraestrutura de nível bancário
               </h2>
               <p className="text-lg text-slate-600 font-medium leading-relaxed mb-10">
                  Seu preço, sua margem e seus documentos ficam protegidos. Ninguém mais tem acesso. Você tem a chave e o controle absoluto.
               </p>
               <div className="space-y-6">
                  {[
                     "Criptografia de ponta a ponta",
                     "Isolamento total dos seus dados",
                     "Backups automáticos"
                  ].map((item, idx) => (
                     <div key={idx} className="flex items-center gap-4">
                        <CheckCircle weight="fill" className="text-emerald-500 w-8 h-8 shrink-0" />
                        <span className="text-lg font-black uppercase tracking-widest text-slate-800">{item}</span>
                     </div>
                  ))}
               </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="w-full md:w-1/2 flex justify-center">
               <div className="relative">
                  <div className="absolute inset-0 bg-[#EA580C]/20 blur-3xl rounded-full"></div>
                  <ShieldCheck weight="fill" className="w-48 h-48 md:w-64 md:h-64 text-[#0A2540] relative z-10 drop-shadow-2xl" />
                  <LockKey weight="fill" className="w-16 h-16 text-[#EA580C] absolute bottom-4 right-4 z-20 drop-shadow-lg bg-white rounded-full p-3" />
               </div>
            </motion.div>
         </div>
      </section>

      {/* 6. PERGUNTAS FREQUENTES */}
      <section className="w-full bg-slate-50 py-24 px-6 md:px-12">
         <div className="max-w-3xl mx-auto">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-12 text-center">
               Perguntas Frequentes
            </motion.h2>
            <div className="space-y-4">
               {faqs.map((faq, idx) => (
                  <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     transition={{ delay: idx * 0.1 }}
                     key={idx} 
                     className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                  >
                     <button 
                        onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                     >
                        <span className="font-black text-slate-800 uppercase tracking-wider text-sm md:text-base pr-4">{faq.q}</span>
                        <CaretDown weight="bold" className={`w-6 h-6 text-[#EA580C] transition-transform duration-300 shrink-0 ${activeFaq === idx ? 'rotate-180' : ''}`} />
                     </button>
                     <AnimatePresence>
                        {activeFaq === idx && (
                           <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                           >
                              <div className="p-6 pt-0 text-slate-600 font-medium leading-relaxed border-t border-slate-50 mt-2">
                                 {faq.a}
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* 7. CHAMADA FINAL */}
      <section className="w-full bg-[#0A2540] py-32 px-6 md:px-12 relative overflow-hidden border-t border-white/10">
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#EA580C]/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3"></div>
         <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter text-white mb-8 leading-[1.1]">
               Pare de perder oportunidades no mercado público.
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-xl text-blue-100 font-medium mb-12">
               Crie sua Central de Comando agora e comece a disputar com vantagem real.
            </motion.p>
            <motion.button initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} onClick={() => navigate('/register')} className="group flex items-center justify-center gap-3 bg-[#EA580C] hover:bg-orange-600 text-white text-base md:text-lg font-black uppercase tracking-widest px-10 py-6 rounded-xl transition-all shadow-2xl hover:shadow-orange-500/40 w-full md:w-auto">
               Criar minha Central de Comando
               <CaretRight weight="bold" className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </motion.button>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full bg-[#06182c] py-8 text-center border-t border-white/5">
         <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
         </p>
      </footer>

    </div>
  );
}