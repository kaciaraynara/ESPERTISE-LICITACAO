import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   ShieldCheck, CheckCircle, MagnifyingGlass, FileText,
   PaperPlaneRight, LockKey, CaretDown,
   CaretRight, Target, Lightbulb, Users
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
   const navigate = useNavigate();
   const [activeFaq, setActiveFaq] = useState<number | null>(null);

   const faqs = [
      {
         q: "De onde vêm as oportunidades apresentadas?",
         a: "As oportunidades são consultadas em fontes oficiais, como o Portal Nacional de Contratações Públicas (PNCP)."
      },
      {
         q: "Como a ferramenta evita prejuízo nos lances?",
         a: "Você define sua margem mínima e mantém o controle dos valores enviados nos portais oficiais."
      },
      {
         q: "Meus documentos estão seguros?",
         a: "Você pode organizar os documentos da empresa e controlar o acesso das pessoas autorizadas na sua conta."
      }
   ];

   const tools = [
      {
         title: "Busca Inteligente",
         desc: "Encontre oportunidades publicadas no PNCP e acompanhe editais relacionados às atividades da sua empresa.",
         icon: <MagnifyingGlass weight="fill" className="w-8 h-8 text-[#EA580C]" />
      },
      {
         title: "Assistente de Análise de Editais",
         desc: "Consulte um resumo do edital e os pontos de atenção identificados para decidir com mais clareza se vale participar.",
         icon: <FileText weight="fill" className="w-8 h-8 text-[#EA580C]" />
      },
      {
         title: "Criação Rápida de Propostas",
         desc: "Aproveite as informações do edital para preparar sua proposta com mais agilidade. Revise os itens, preços e declarações antes do envio.",
         icon: <PaperPlaneRight weight="fill" className="w-8 h-8 text-[#EA580C]" />
      }
   ];

   const fadeInUp = {
      hidden: { opacity: 0, y: 40 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.8, type: "spring", bounce: 0.2 } }
   };

   return (
      <div className="min-h-screen w-full bg-white font-sans antialiased text-slate-900 selection:bg-[#EA580C] selection:text-white overflow-x-hidden">
         <style>{`
            @keyframes hero-drift {
               0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
               50% { transform: translate3d(1.5%, -1%, 0) scale(1.04); }
            }
            .hero-mesh {
               background-image:
                  linear-gradient(rgba(10, 37, 64, .035) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(10, 37, 64, .035) 1px, transparent 1px);
               background-size: 44px 44px;
               mask-image: linear-gradient(to bottom, black, transparent 92%);
            }
            .hero-ambient { animation: hero-drift 18s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
               .hero-ambient { animation: none !important; }
            }
         `}</style>

         {/* HEADER */}
         <header className="fixed top-0 z-50 w-full border-b border-white/70 bg-white/80 shadow-[0_8px_30px_rgba(15,35,60,0.04)] backdrop-blur-xl">
            <div className="mx-auto flex h-20 md:h-24 max-w-7xl items-center justify-between px-6 md:px-12">
               <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                  {/* Logo oficial reduzida para ~50% conforme diretrizes premium */}
                  <img src="/logo.png" alt="Expertise Licitatória" className="h-16 md:h-20 w-auto object-contain drop-shadow-sm" />
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
         <section className="relative isolate flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-36 md:px-12 lg:pt-44">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#F8FBFF] via-white to-white">
               <div className="hero-mesh absolute inset-0 opacity-80" />
               <div className="hero-ambient absolute -right-32 -top-20 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(191,219,254,.48),rgba(255,255,255,0)_68%)] will-change-transform" />
               <div className="hero-ambient absolute -bottom-48 -left-36 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(255,237,213,.58),rgba(255,255,255,0)_68%)] [animation-delay:-8s] will-change-transform" />
               <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
            </div>

            <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 text-center">
               <h1 className="text-4xl font-black uppercase leading-[1.08] tracking-[-.055em] text-[#0A2540] md:text-5xl lg:text-6xl">
                  Deixe nosso assistente ajudar a analisar editais extensos. Você dedica mais tempo a fechar negócios.
               </h1>
               <p className="max-w-3xl text-lg font-medium leading-relaxed text-slate-600 md:text-xl">
                  Encontre oportunidades no PNCP, compreenda melhor as exigências e prepare propostas com mais organização — mantendo o controle de cada decisão.
               </p>

               <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full justify-center">
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-[#0A2540] pl-2 text-center">
                        Oportunidades consultadas em fontes oficiais
                     </span>
                     <button onClick={() => navigate('/register')} className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#EA580C] px-8 py-5 text-sm font-black uppercase tracking-widest text-white shadow-[0_12px_34px_rgba(234,88,12,0.25)] transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_18px_40px_rgba(234,88,12,0.32)] md:text-base">
                        Criar meu Painel Executivo
                        <CaretRight weight="bold" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                     </button>
                  </div>
                  <button onClick={() => document.getElementById('ferramentas')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-center bg-white border-2 border-slate-200 hover:border-[#EA580C] text-[#0A2540] hover:text-[#EA580C] text-sm md:text-base font-bold uppercase tracking-widest px-8 py-5 rounded-xl transition-all mt-6 sm:mt-6 w-full sm:w-auto shadow-sm">
                     Ver como funciona
                  </button>
               </div>
            </motion.div>
         </section>

         {/* 2. DESPERTAR */}
         <section className="flex min-h-[390px] w-full items-center bg-white px-6 py-24 md:px-12">
            <div className="mx-auto max-w-5xl text-center">
               <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.5 }} variants={fadeInUp} className="text-3xl font-black uppercase leading-tight tracking-[-.045em] text-[#0A2540] md:text-5xl">
                  Seu concorrente trabalha duro. Você trabalha certo.
               </motion.h2>
               <motion.p initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.5 }} variants={fadeInUp} className="mt-8 text-xl font-bold uppercase tracking-tight text-slate-500 md:text-3xl">
                  O que sua equipe faria com mais tempo para cuidar dos negócios?
               </motion.p>
            </div>
         </section>

         {/* 3. O QUE FAZEMOS */}
         <section className="w-full bg-white py-24 px-6 md:px-12">
            <div className="max-w-4xl mx-auto text-center">
               <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="flex justify-center mb-6">
                  <div className="w-16 h-2 bg-[#EA580C] rounded-full"></div>
               </motion.div>
               <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
                  Como ajudamos
               </motion.h2>
               <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="space-y-6 text-lg md:text-xl text-slate-600 font-medium leading-relaxed">
                  <p>
                     A Expertise Licitatória nasceu para organizar e simplificar a vida de quem disputa contratos públicos.
                  </p>
                  <p>
                     Reunimos oportunidades públicas, análise de editais, organização de documentos e preparação de propostas em um só lugar.
                  </p>
                  <p className="text-[#0A2540] font-bold">
                     Tudo pensado para simplificar a rotina da sua empresa e apoiar decisões mais bem informadas.
                  </p>
               </motion.div>
            </div>
         </section>

         {/* 4. MISSÃO, VALORES E CULTURA */}
         <section className="w-full bg-[#F8F9FA] py-24 px-6 md:px-12 text-[#0A2540]">
            <div className="max-w-6xl mx-auto">
               <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-16 text-center">
                  Nossa essência
               </motion.h2>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
                  {/* Missão */}
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }} className="rounded-3xl border border-white bg-white p-10 text-center shadow-[0_16px_50px_rgba(15,35,60,0.07)]">
                     <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center mb-6">
                        <Target weight="fill" className="w-8 h-8" />
                     </div>
                     <h3 className="mb-4 text-2xl font-black uppercase tracking-wider">Missão</h3>
                     <p className="font-medium leading-relaxed text-slate-600">
                        Tornar o mercado de licitações mais acessível, organizado e previsível para empresas de todos os portes.
                     </p>
                  </motion.div>

                  {/* Valores */}
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.06 }} className="rounded-3xl border border-white bg-white p-10 shadow-[0_16px_50px_rgba(15,35,60,0.07)]">
                     <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center mb-6">
                        <Lightbulb weight="fill" className="w-8 h-8" />
                     </div>
                     <h3 className="mb-6 text-center text-2xl font-black uppercase tracking-wider">Valores</h3>
                     <ul className="w-full space-y-4 font-medium text-slate-600">
                        <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Precisão em tudo que fazemos</li>
                        <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Transparência total com o cliente</li>
                        <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Foco real em resultado</li>
                        <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Proteção dos dados e da margem</li>
                        <li className="flex items-center gap-3"><CheckCircle weight="fill" className="text-[#EA580C] shrink-0 w-6 h-6" /> Simplicidade sem perder qualidade</li>
                     </ul>
                  </motion.div>

                  {/* Cultura */}
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.12 }} className="rounded-3xl border border-white bg-white p-10 text-center shadow-[0_16px_50px_rgba(15,35,60,0.07)]">
                     <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center mb-6">
                        <Users weight="fill" className="w-8 h-8" />
                     </div>
                     <h3 className="mb-4 text-2xl font-black uppercase tracking-wider">Cultura</h3>
                     <p className="mb-4 font-medium leading-relaxed text-slate-600">
                        Trabalhamos com seriedade, clareza e compromisso. Acreditamos que tecnologia boa é aquela que o empresário entende e usa no dia a dia sem dificuldade.
                     </p>
                     <p className="font-medium leading-relaxed text-slate-600">
                        Nossa cultura é orientada a resolver problemas reais do mercado público, com responsabilidade e eficiência.
                     </p>
                  </motion.div>
               </div>
            </div>
         </section>

         {/* 5. FERRAMENTAS PRINCIPAIS */}
         <section id="ferramentas" className="w-full bg-[#F8F9FA] py-24 px-6 md:px-12">
            <div className="max-w-7xl mx-auto">
               <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-16 text-center">
                  As ferramentas que colocam você na frente
               </motion.h2>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {tools.map((tool, idx) => (
                     <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.4, delay: idx * 0.06 }}
                        whileHover={{ y: -5 }}
                        className="group cursor-default rounded-2xl border border-white/90 bg-white/90 p-8 shadow-[0_12px_36px_rgba(15,35,60,0.055)] backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 hover:border-orange-200 hover:shadow-[0_24px_55px_rgba(15,35,60,0.12)] md:p-10"
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

         {/* 7. SEGURANÇA */}
         <section className="relative isolate w-full overflow-hidden bg-white py-24 px-6 md:px-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(#CBD5E1_0.7px,transparent_0.7px)] [background-size:18px_18px]" />
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
               <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="w-full md:w-1/2">
                  <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-8">
                     Proteção de nível bancário
                  </h2>
                  <p className="text-lg text-slate-600 font-medium leading-relaxed mb-10">
                     Seus documentos e informações ficam disponíveis para você e para as pessoas autorizadas da sua equipe.
                  </p>
                  <div className="space-y-6">
                     {[
                        "Acesso para pessoas autorizadas",
                        "Documentos organizados por empresa",
                        "Acompanhamento de vencimentos"
                     ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                           <CheckCircle weight="fill" className="text-emerald-500 w-8 h-8 shrink-0" />
                           <span className="text-lg font-black uppercase tracking-widest text-[#0A2540]">{item}</span>
                        </div>
                     ))}
                  </div>
               </motion.div>
               <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.45 }} className="w-full md:w-1/2 flex justify-center">
                  <div className="relative rounded-[2rem] border border-white/90 bg-white/70 p-12 shadow-[0_24px_80px_rgba(15,35,60,0.12)] backdrop-blur-xl">
                     <ShieldCheck weight="fill" className="relative z-10 h-48 w-48 text-[#0A2540] drop-shadow-[0_18px_24px_rgba(10,37,64,0.16)] md:h-64 md:w-64" />
                     <motion.div
                        initial={{ opacity: 0, y: 12, rotate: -14 }}
                        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="absolute bottom-7 right-7 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-400 shadow-[0_8px_24px_rgba(15,35,60,0.16)]"
                     >
                        <LockKey weight="fill" className="h-8 w-8" />
                        <motion.span
                           initial={{ opacity: 0.2 }}
                           whileInView={{ opacity: 1 }}
                           viewport={{ once: true, amount: 0.5 }}
                           transition={{ duration: 0.5, delay: 0.85 }}
                           className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.65)]"
                        />
                     </motion.div>
                  </div>
               </motion.div>
            </div>
         </section>

         {/* 8. PLANOS */}
         <section id="planos" className="w-full bg-white py-28 px-6 md:px-12">
            <div className="max-w-6xl mx-auto">
               <div className="text-center mb-16">
                  <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A2540] mb-6">
                     Planos e Preços
                  </motion.h2>
                  <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-lg text-slate-600 font-medium">
                     Escolha o plano ideal para a sua operação. Do licitante iniciante às grandes equipes estratégicas.
                  </motion.p>
               </div>

               <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-3 md:gap-6 lg:gap-8">
                  {/* Plano Basico */}
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,35,60,0.055)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,35,60,0.11)]">
                     <h3 className="text-2xl font-black text-[#0A2540] mb-2">Básico</h3>
                     <p className="text-sm text-slate-500 min-h-[40px] mb-6">Para o licitante que está começando a se organizar.</p>
                     <div className="mb-8">
                        <span className="text-4xl font-black text-[#0A2540]">R$ 99,99</span><span className="text-slate-500">/mês</span>
                     </div>
                     <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Até 5 CNPJs</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">1 Usuário</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="text-emerald-500 w-5 h-5 shrink-0" /><span className="text-sm font-medium text-slate-700">Monitoramento de editais básico</span></li>
                     </ul>
                     <button onClick={() => navigate('/register')} className="w-full py-4 rounded-xl font-bold bg-slate-100 text-[#0A2540] hover:bg-slate-200 transition-colors uppercase tracking-widest text-sm">Assinar Básico</button>
                  </motion.div>

                  {/* Plano Avançado */}
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.06 }} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,35,60,0.055)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,35,60,0.11)]">
                     <h3 className="mb-2 text-2xl font-black text-[#0A2540]">Avançado</h3>
                     <p className="mb-6 min-h-[40px] text-sm text-slate-500">Para operações em crescimento que precisam de mais inteligência e escala.</p>
                     <div className="mb-8">
                        <span className="text-4xl font-black text-[#0A2540]">R$ 199,00</span><span className="text-slate-500">/mês</span>
                     </div>
                     <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-emerald-500" /><span className="text-sm font-medium text-slate-700">Até 10 CNPJs e 3 usuários</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-emerald-500" /><span className="text-sm font-medium text-slate-700">Radar de editais ampliado</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-emerald-500" /><span className="text-sm font-medium text-slate-700">Análises do Lex para apoiar decisões</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-emerald-500" /><span className="text-sm font-medium text-slate-700">Ferramentas de propostas e gestão</span></li>
                     </ul>
                     <button onClick={() => navigate('/register')} className="w-full rounded-xl bg-slate-100 py-4 text-sm font-bold uppercase tracking-widest text-[#0A2540] transition-colors hover:bg-slate-200">Conhecer Avançado</button>
                  </motion.div>

                  {/* Plano Master */}
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.12 }} whileHover={{ y: -5 }} className="relative z-10 flex flex-col rounded-3xl border border-[#102E4B] bg-[#071B2E] p-8 text-white shadow-[0_24px_70px_rgba(7,27,46,0.28)] transition-shadow duration-200 hover:shadow-[0_30px_90px_rgba(7,27,46,0.38)] md:scale-[1.08] lg:scale-[1.15]">
                     <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-orange-300/30 bg-[#EA580C] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_8px_24px_rgba(234,88,12,0.32)]">
                        A Escolha das Empresas Líderes
                     </div>
                     <h3 className="mb-2 mt-3 text-2xl font-black text-white">Master</h3>
                     <p className="mb-6 min-h-[40px] text-sm text-blue-100">A operação completa para empresas que querem disputar com estratégia.</p>
                     <div className="mb-8">
                        <span className="text-4xl font-black text-white">R$ 399,99</span><span className="text-blue-200">/mês</span>
                     </div>
                     <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-[#FB923C]" /><span className="text-sm font-medium text-white">Até 20 CNPJs e usuários ilimitados</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-[#FB923C]" /><span className="text-sm font-medium text-white">Lex para análise e preparação de editais</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-[#FB923C]" /><span className="text-sm font-medium text-white">Gestão jurídica e recursos</span></li>
                        <li className="flex items-start gap-3"><CheckCircle weight="fill" className="h-5 w-5 shrink-0 text-[#FB923C]" /><span className="text-sm font-medium text-white">Suporte prioritário</span></li>
                     </ul>
                     <button onClick={() => navigate('/register')} className="w-full rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_12px_34px_rgba(234,88,12,0.27)] transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_18px_42px_rgba(234,88,12,0.38)]">Assinar Plano Master</button>
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
         <section className="relative w-full overflow-hidden bg-[#F8F9FA] px-6 py-28 md:px-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-0 h-[34rem] w-[34rem] -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(255,237,213,.72),rgba(255,255,255,0)_68%)]" />
            <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
               <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="mb-8 text-4xl font-black uppercase leading-[1.1] tracking-tighter text-[#0A2540] md:text-5xl lg:text-6xl">
                  Pare de perder oportunidades no mercado público.
               </motion.h2>
               <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="mb-12 max-w-2xl text-xl font-medium text-slate-600">
                  Organize sua rotina de licitações e encontre novas oportunidades para a sua empresa.
               </motion.p>
               <motion.button initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} onClick={() => navigate('/register')} className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#EA580C] px-10 py-6 text-base font-black uppercase tracking-widest text-white shadow-[0_14px_38px_rgba(234,88,12,0.26)] transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_20px_48px_rgba(234,88,12,0.34)] md:w-auto md:text-lg">
                  Criar meu Painel Executivo
                  <CaretRight weight="bold" className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
               </motion.button>
            </div>
         </section>

         {/* FOOTER */}
         <footer className="w-full border-t border-slate-100 bg-white py-10 text-center">
            <img src="/logo.png" alt="Expertise Licitatória" className="mx-auto mb-6 h-8 w-auto object-contain opacity-75" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
               &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
            </p>
         </footer>

      </div>
   );
}