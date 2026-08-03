import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, CheckCircle, MagnifyingGlass, FileText, 
  PaperPlaneRight, LockKey, Clock, CaretDown,
  Money, CaretRight, Target, Lightbulb, Handshake, Users
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
      q: "Como a ferramenta evita prejuízo nos lances?",
      a: "Você define a margem mínima. O sistema respeita esse limite automaticamente."
    },
    {
      q: "Meus documentos estão seguros?",
      a: "Sim. Tudo fica protegido e isolado. Só você tem acesso."
    }
  ];

  const tools = [
    {
      title: "Buscador de Compras 24h",
      desc: "Monitora os portais do governo o dia inteiro. Você encontra as compras abertas no seu estado com agilidade.",
      icon: <MagnifyingGlass weight="fill" className="w-8 h-8 text-[#EA580C]" />
    },
    {
      title: "Revisor de Editais",
      desc: "Analisa o edital em segundos e destaca as exigências que podem atrapalhar ou desclassificar sua empresa.",
      icon: <FileText weight="fill" className="w-8 h-8 text-[#EA580C]" />
    },
    {
      title: "Envio Automático de Preços",
      desc: "Acompanha as ofertas da concorrência e envia seus preços na velocidade máxima, respeitando a margem mínima definida por você.",
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
    <div className="min-h-screen w-full bg-white font-sans antialiased text-slate-900 selection:bg-[#EA580C] selection:text-white overflow-x-hidden">
      
      {/* HEADER */}
      <header className="absolute top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto flex h-20 md:h-24 max-w-7xl items-center justify-between px-6 md:px-12">
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            {/* Logo oficial em cor original, tamanho grande (h-12 a h-16) */}
            <img src="/logo.png" alt="Expertise Licitatória" className="h-12 md:h-16 w-auto object-contain drop-shadow-sm" />
          </div>
          <nav className="hidden lg:flex items-center gap-6">
            <button onClick={() => navigate('/login')} className="text-sm font-bold uppercase tracking-wider text-[#0A2540] hover:text-[#EA580C] transition-colors">
              Entrar
            </button>
            <button onClick={() => navigate('/register')} className="bg-[#EA580C] hover:bg-orange-600 text-white text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-orange-500/30">
              Criar Conta
            </button>
          </nav>
        </div>
      </header>

      {/* 1. HERO SECTION */}
      <section className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-center max-w-7xl mx-auto gap-16 min-h-screen">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white -z-10"></div>
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="w-full text-center flex flex-col items-center gap-8 relative z-10 max-w-4xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-[1.1] text-[#0A2540] drop-shadow-sm">
            Feche mais contratos com o governo sem perder noites lendo editais.
          </h1>
          <p className="text-lg md:text-xl font-medium leading-relaxed text-slate-600 max-w-3xl">
            Monitore compras abertas 24 horas, identifique exigências importantes em segundos e envie seus preços automaticamente. Tudo com dados oficiais e total proteção.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full justify-center">
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0A2540] pl-2 text-center">
                Dados oficiais em tempo real • Zero simulações
              </span>
              <button onClick={() => navigate('/register')} className="group flex items-center justify-center gap-3 bg-[#EA580C] hover:bg-orange-600 text-white text-sm md:text-base font-black uppercase tracking-widest px-8 py-5 rounded-xl transition-all shadow-xl hover:shadow-orange-500/40 w-full">
                Criar minha Central de Comando
                <CaretRight weight="bold" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <button onClick={() => document.getElementById('ferramentas')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-center bg-white border-2 border-slate-200 hover:border-[#EA580C] text-[#0A2540] hover:text-[#EA580C] text-sm md:text-base font-bold uppercase tracking-widest px-8 py-5 rounded-xl transition-all mt-6 sm:mt-6 w-full sm:w-auto shadow-sm">
              Ver como funciona
            </button>
          </div>
        </motion.div>
      </section>

      {/* 2. SEÇÃO DE DOR */}
      <section className="w-full bg-slate-50 py-24 px-6 md:px-12 relative border-t border-slate-100">
         <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-[#0A2540] mb-16">
               Você está deixando dinheiro na mesa todos os dias
            </motion.h2>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-12 sm:gap-32 w-full">
               <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, type: "spring" }} className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-orange-100/50 text-[#EA580C] mb-6 shadow-sm border border-orange-100">
                     <Clock weight="fill" className="w-10 h-10" />
                  </div>
                  <div className="text-6xl md:text-7xl font-black text-[#EA580C] tracking-tighter flex items-center gap-2 drop-shadow-sm">
                     <AnimatedCounter end={35} /> <span className="text-2xl md:text-3xl mt-4 uppercase">horas</span>
                  </div>
                  <div className="text-base font-bold text-slate-500 uppercase tracking-widest mt-4">Buscando e lendo papéis</div>
               </motion.div>

               <div className="hidden sm:block w-px h-40 bg-slate-200"></div>

               <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2, type: "spring" }} className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-orange-100/50 text-[#EA580C] mb-6 shadow-sm border border-orange-100">
                     <Money weight="fill" className="w-10 h-10" />
                  </div>
                  <div className="text-6xl md:text-7xl font-black text-[#EA580C] tracking-tighter flex items-center gap-2 drop-shadow-sm">
                     <span className="text-2xl md:text-3xl mt-4 uppercase">R$</span> <AnimatedCounter end={12500} />
                  </div>
                  <div className="text-base font-bold text-slate-500 uppercase tracking-widest mt-4">Em oportunidades invisíveis</div>
               </motion.div>
            </div>
         </div>
      </section>

      {/* 3. O QUE FAZEMOS */}
      <section className="w-full bg-white py-24 px-6 md:px-12">
         <div className="max-w-4xl mx-auto text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="flex justify-center mb-6">
               <div className="w-16 h-2 bg-[#EA580C] rounded-full"></div>
            </motion.div>
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
               O que fazemos
            </motion.h2>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="space-y-6 text-lg md:text-xl text-slate-600 font-medium leading-relaxed">
               <p>
                  A Expertise Licitatória nasceu para organizar e simplificar a vida de quem disputa contratos públicos.
               </p>
               <p>
                  Reunimos em um só lugar o monitoramento de editais, a análise das exigências, o controle de documentos e o envio automático de preços.
               </p>
               <p className="text-[#0A2540] font-bold">
                  Tudo pensado para que sua empresa gaste menos tempo com tarefas manuais e mais tempo fechando negócios.
               </p>
            </motion.div>
         </div>
      </section>

      {/* 4. MISSÃO, VALORES E CULTURA */}
      <section className="w-full bg-[#0A2540] py-24 px-6 md:px-12 text-white">
         <div className="max-w-6xl mx-auto">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white mb-16 text-center">
               Nossa essência
            </motion.h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
               {/* Missão */}
               <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="bg-white/5 border border-white/10 rounded-3xl p-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center mb-6">
                     <Target weight="fill" className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-wider mb-4">Missão</h3>
                  <p className="text-blue-100 leading-relaxed font-medium">
                     Tornar o mercado de licitações mais acessível, organizado e previsível para empresas de todos os portes.
                  </p>
               </motion.div>

               {/* Valores */}
               <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-white/5 border border-white/10 rounded-3xl p-10 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center mb-6">
                     <Lightbulb weight="fill" className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-wider mb-6 text-center">Valores</h3>
                  <ul className="space-y-4 text-blue-100 font-medium w-full">
                     <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Precisão em tudo que fazemos</li>
                     <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Transparência total com o cliente</li>
                     <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Foco real em resultado</li>
                     <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Proteção dos dados e da margem</li>
                     <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Simplicidade sem perder qualidade</li>
                  </ul>
               </motion.div>

               {/* Cultura */}
               <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-white/5 border border-white/10 rounded-3xl p-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center mb-6">
                     <Users weight="fill" className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-wider mb-4">Cultura</h3>
                  <p className="text-blue-100 leading-relaxed font-medium mb-4">
                     Trabalhamos com seriedade, clareza e compromisso. Acreditamos que tecnologia boa é aquela que o empresário entende e usa no dia a dia sem dificuldade.
                  </p>
                  <p className="text-blue-100 leading-relaxed font-medium">
                     Nossa cultura é orientada a resolver problemas reais do mercado público, com responsabilidade e eficiência.
                  </p>
               </motion.div>
            </div>
         </div>
      </section>

      {/* 5. FERRAMENTAS PRINCIPAIS */}
      <section id="ferramentas" className="w-full bg-slate-50 py-24 px-6 md:px-12 border-t border-slate-200">
         <div className="max-w-7xl mx-auto">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-16 text-center">
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
                     className="bg-white border border-slate-200 hover:border-[#EA580C]/50 rounded-2xl p-8 md:p-10 transition-all cursor-default group shadow-sm hover:shadow-xl"
                  >
                     <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-orange-50 group-hover:border-orange-100 flex items-center justify-center mb-6 transition-colors">
                        {tool.icon}
                     </div>
                     <h3 className="text-xl md:text-2xl font-black text-[#0A2540] uppercase tracking-wider mb-4 group-hover:text-[#EA580C] transition-colors">{tool.title}</h3>
                     <p className="text-slate-600 text-base md:text-lg leading-relaxed font-medium">
                        {tool.desc}
                     </p>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* 6. COMPARAÇÃO DE REALIDADE */}
      <section className="w-full bg-white py-24 px-6 md:px-12">
         <div className="max-w-5xl mx-auto text-center">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
               Seu concorrente trabalha duro. Você trabalha certo.
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto font-medium leading-relaxed mb-12">
               Enquanto muitos perdem tempo em planilhas e sites confusos, a Expertise organiza tudo e mostra o que realmente importa.
            </motion.p>
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="bg-slate-50 border border-slate-200 rounded-3xl p-12 md:p-16 shadow-lg relative overflow-hidden">
               <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] relative z-10 leading-snug">
                  O que você faria com <span className="text-[#EA580C]">40 horas livres</span> por semana?
               </h3>
            </motion.div>
         </div>
      </section>

      {/* 7. SEGURANÇA */}
      <section className="w-full bg-slate-50 py-24 px-6 md:px-12 border-t border-slate-200">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="w-full md:w-1/2">
               <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
                  Proteção de nível bancário
               </h2>
               <p className="text-lg text-slate-600 font-medium leading-relaxed mb-10">
                  Seu preço, sua margem e seus documentos ficam protegidos. Só você tem acesso.
               </p>
               <div className="space-y-6">
                  {[
                     "Criptografia de ponta a ponta",
                     "Isolamento total dos seus dados",
                     "Backups automáticos"
                  ].map((item, idx) => (
                     <div key={idx} className="flex items-center gap-4">
                        <CheckCircle weight="fill" className="text-emerald-500 w-8 h-8 shrink-0" />
                        <span className="text-lg font-black uppercase tracking-widest text-[#0A2540]">{item}</span>
                     </div>
                  ))}
               </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="w-full md:w-1/2 flex justify-center">
               <div className="relative">
                  <ShieldCheck weight="fill" className="w-48 h-48 md:w-64 md:h-64 text-[#0A2540] relative z-10 drop-shadow-xl" />
                  <LockKey weight="fill" className="w-16 h-16 text-[#EA580C] absolute bottom-4 right-4 z-20 drop-shadow-md bg-white rounded-full p-3 border border-slate-100" />
               </div>
            </motion.div>
         </div>
      </section>

      {/* 8. PLANOS */}
      <section id="planos" className="w-full bg-slate-50 py-24 px-6 md:px-12 border-t border-slate-200">
         <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
               <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-6">
                  Planos e Preços
               </motion.h2>
               <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-lg text-slate-600 font-medium">
                  Escolha o plano ideal para a sua operação. Do licitante iniciante às grandes equipes estratégicas.
               </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
               {/* Plano Basico */}
               <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all flex flex-col">
                  <h3 className="text-2xl font-black text-[#0A2540] mb-2">Básico</h3>
                  <p className="text-sm text-slate-500 min-h-[40px] mb-6">Para o licitante que está começando a se organizar.</p>
                  <div className="mb-8">
                     <span className="text-4xl font-black text-[#0A2540]">R$ 69,99</span><span className="text-slate-500">/mês</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Até 1 CNPJ</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">1 Usuário</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Monitoramento de editais básico</span></li>
                  </ul>
                  <button onClick={() => navigate('/register')} className="w-full py-4 rounded-xl font-bold bg-slate-100 text-[#0A2540] hover:bg-slate-200 transition-colors uppercase tracking-widest text-sm">Assinar Básico</button>
               </motion.div>

               {/* Plano Pro */}
               <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-[#0A2540] border border-[#0A2540] rounded-3xl p-8 shadow-2xl transform md:-translate-y-4 flex flex-col relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#EA580C] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg whitespace-nowrap">Mais Popular</div>
                  <h3 className="text-2xl font-black text-white mb-2">Pro</h3>
                  <p className="text-sm text-blue-200 min-h-[40px] mb-6">A escolha inteligente para quem quer escalar os resultados.</p>
                  <div className="mb-8">
                     <span className="text-4xl font-black text-white">R$ 149,99</span><span className="text-blue-200">/mês</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-[#EA580C] w-5 h-5 shrink-0" /><span className="text-sm font-medium text-white">Até 3 CNPJs e 3 Usuários</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-[#EA580C] w-5 h-5 shrink-0" /><span className="text-sm font-medium text-white">Radar 24h Ilimitado</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-[#EA580C] w-5 h-5 shrink-0" /><span className="text-sm font-medium text-white">100 Análises de IA/mês</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-[#EA580C] w-5 h-5 shrink-0" /><span className="text-sm font-medium text-white">Robô de Lances Automático</span></li>
                  </ul>
                  <button onClick={() => navigate('/register')} className="w-full py-4 rounded-xl font-bold bg-[#EA580C] hover:bg-orange-600 text-white transition-all shadow-lg hover:shadow-orange-500/30 uppercase tracking-widest text-sm">Assinar Pro</button>
               </motion.div>

               {/* Plano Master */}
               <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all flex flex-col">
                  <h3 className="text-2xl font-black text-[#0A2540] mb-2">Master</h3>
                  <p className="text-sm text-slate-500 min-h-[40px] mb-6">O pacote completo para equipes de alta performance.</p>
                  <div className="mb-8">
                     <span className="text-4xl font-black text-[#0A2540]">R$ 249,99</span><span className="text-slate-500">/mês</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Até 10 CNPJs (Usuários ilim.)</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">IA e Lances ilimitados</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Painel Jurídico / Recursos</span></li>
                     <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Suporte prioritário WhatsApp</span></li>
                  </ul>
                  <button onClick={() => navigate('/register')} className="w-full py-4 rounded-xl font-bold bg-slate-100 text-[#0A2540] hover:bg-slate-200 transition-colors uppercase tracking-widest text-sm">Assinar Master</button>
               </motion.div>
            </div>
         </div>
      </section>

      {/* 9. PERGUNTAS FREQUENTES */}
      <section className="w-full bg-white py-24 px-6 md:px-12 border-t border-slate-100">
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
                     className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition-colors"
                  >
                     <button 
                        onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                     >
                        <span className="font-black text-[#0A2540] uppercase tracking-wider text-sm md:text-base pr-4">{faq.q}</span>
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

      {/* 10. CHAMADA FINAL */}
      <section className="w-full bg-[#0A2540] py-32 px-6 md:px-12 relative overflow-hidden border-t border-[#0A2540]">
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#EA580C]/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3"></div>
         <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter text-white mb-8 leading-[1.1]">
               Pare de perder oportunidades no mercado público.
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-xl text-blue-100 font-medium mb-12 max-w-2xl">
               Crie sua Central de Comando agora e comece a disputar com mais organização e vantagem.
            </motion.p>
            <motion.button initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} onClick={() => navigate('/register')} className="group flex items-center justify-center gap-3 bg-[#EA580C] hover:bg-orange-600 text-white text-base md:text-lg font-black uppercase tracking-widest px-10 py-6 rounded-xl transition-all shadow-2xl hover:shadow-orange-500/40 w-full md:w-auto">
               Criar minha Central de Comando
               <CaretRight weight="bold" className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </motion.button>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full bg-[#06182c] py-12 text-center border-t border-white/5">
         <img src="/logo.png" alt="Expertise Licitatória" className="h-8 w-auto object-contain brightness-0 invert opacity-50 mx-auto mb-6" />
         <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
         </p>
      </footer>

    </div>
  );
}