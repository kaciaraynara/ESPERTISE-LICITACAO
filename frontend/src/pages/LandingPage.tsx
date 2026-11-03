import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   CheckCircle,
   MagnifyingGlass,
   FileText,
   CaretDown,
   CaretRight,
   WarningCircle,
   Check,
   X,
   ArrowRight,
   ShieldCheck,
   Calculator
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const LAPTOP_SLIDES = [
   {
      id: 1,
      image: '/painel-laptop-1.png',
      tag: 'Elaboração de Propostas',
      subtitle: 'Controle de envio, modelos padronizados e calendário de sessões'
   },
   {
      id: 2,
      image: '/painel-laptop-2.png',
      tag: 'Matriz de Habilitação',
      subtitle: 'Auditor dos 4 pilares da Lei 14.133/21 com conferência de conformidade'
   },
   {
      id: 3,
      image: '/painel-laptop-3.png',
      tag: 'Central de Certidões',
      subtitle: 'Acompanhamento preventivo de CNDs, CRF FGTS e débitos trabalhistas'
   },
   {
      id: 4,
      image: '/painel-laptop-4.png',
      tag: 'Academia do Licitante',
      subtitle: 'Capacitação prática em Nova Lei, teses do TCU e táticas de disputa'
   },
   {
      id: 5,
      image: '/painel-laptop-5.png',
      tag: 'Formação de Preço Real',
      subtitle: 'Composição de BDI, margem de lucro e as 6 declarações obrigatórias'
   }
];

export default function LandingPage() {
   const navigate = useNavigate();
   const [activeFaq, setActiveFaq] = useState<number | null>(null);
   const [billingPeriod, setBillingPeriod] = useState<'mensal' | 'anual'>('mensal');
   const [activeSlide, setActiveSlide] = useState(0);

   // Rotação suave e automática das telas internas do notebook
   useEffect(() => {
      const timer = setInterval(() => {
         setActiveSlide((prev) => (prev + 1) % LAPTOP_SLIDES.length);
      }, 4500);
      return () => clearInterval(timer);
   }, []);

   const faqs = [
      {
         q: "Como o sistema me avisa antes de uma certidão vencer?",
         a: "Você cadastra os documentos da sua empresa uma única vez. O sistema acompanha a validade das certidões negativas (Federal, FGTS, Trabalhista, Estadual e Municipal) e emite alertas visuais com antecedência no seu painel para você renovar antes de qualquer sessão de pregão."
      },
      {
         q: "De onde vêm os editais mostrados na plataforma?",
         a: "Buscamos as compras públicas diretamente nas fontes oficiais do governo, como o Portal Nacional de Contratações Públicas (PNCP) e o Compras.gov.br. Filtramos apenas as oportunidades que têm a ver com o que sua empresa vende."
      },
      {
         q: "Como o sistema evita que eu tome prejuízo no pregão?",
         a: "Você informa o custo do seu produto ou serviço, impostos e frete. O sistema calcula a sua margem mínima de lucro e mostra até onde você pode baixar o preço na disputa sem tomar prejuízo no contrato."
      },
      {
         q: "Consigo cadastrar mais de uma empresa ou filial?",
         a: "Sim. Você pode cadastrar matriz e filiais, ou diferentes CNPJs, mantendo os documentos, certidões e editais de cada empresa organizados separadamente."
      },
      {
         q: "Tenho que pagar porcentagem quando vencer uma licitação?",
         a: "Não. Não cobramos comissão, nem porcentagem sobre seus contratos. Você paga apenas o valor da mensalidade fixa do plano escolhido."
      },
      {
         q: "Existe fidelidade ou posso cancelar quando quiser?",
         a: "Não exigimos fidelidade nem multas. Você tem total controle para cancelar ou alterar o seu plano a qualquer momento pelo próprio painel."
      }
   ];

   const painPoints = [
      {
         title: "Perder a licitação por certidão vencida",
         desc: "Você gasta tempo preparando a proposta e, na hora de enviar, descobre que uma certidão expirou no dia anterior. A empresa é desclassificada sem chance de recurso.",
         solucao: "O sistema avisa com dias de antecedência para você nunca ser pego de surpresa."
      },
      {
         title: "Não ver o edital a tempo de pedir correção",
         desc: "O edital traz uma exigência exagerada ou errada. Existe um prazo de até 3 dias antes da disputa para pedir correção. Quando você vê o edital, o prazo já passou.",
         solucao: "Receba alertas imediatos dos editais e veja com destaque a data limite para pedir correções."
      },
      {
         title: "Baixar o preço demais na disputa e fechar no vermelho",
         desc: "Na pressa do pregão, o preço vai caindo para vencer o concorrente. O contrato é assinado, mas depois as contas não fecham e a empresa fica no prejuízo.",
         solucao: "A calculadora mostra seu valor mínimo seguro antes de você entrar na disputa."
      },
      {
         title: "Passar horas lendo editais compridos para nada",
         desc: "Sua equipe lê dezenas de páginas para só no final descobrir que pediram um atestado ou exigência que sua empresa não atende.",
         solucao: "Veja um resumo com os pontos de atenção e os documentos pedidos logo no início."
      }
   ];

   const modules = [
      {
         number: "01",
         icon: <MagnifyingGlass weight="bold" className="w-6 h-6 text-[#EA580C]" />,
         title: "Radar de Oportunidades",
         subtitle: "Só o que sua empresa vende",
         desc: "Encontre compras públicas abertas no governo federal, estados e municípios filtradas pelo seu ramo de atuação, sem precisar navegar em vários portais diferentes.",
         itens: ["Filtro pelo que você vende", "Oportunidades em todo o Brasil", "Avisos de novas licitações"]
      },
      {
         number: "02",
         icon: <FileText weight="bold" className="w-6 h-6 text-[#EA580C]" />,
         title: "Resumo Prático do Edital",
         subtitle: "Direto aos pontos que importam",
         desc: "Em vez de se perder em editais com centenas de páginas, consulte os documentos pedidos, atestados exigidos, prazos de entrega e datas limites de forma clara.",
         itens: ["Checklist de documentos necessários", "Prazos para pedir esclarecimento", "Destaque para exigências fora do comum"]
      },
      {
         number: "03",
         icon: <ShieldCheck weight="bold" className="w-6 h-6 text-[#EA580C]" />,
         title: "Guarda de Documentos e Certidões",
         subtitle: "Sua habilitação sempre em dia",
         desc: "Mantenha contrato social, certidões negativas, atestados de capacidade técnica e procurações guardados em um só lugar seguro e prontos para envio.",
         itens: ["Contagem regressiva de validade", "Avisos antes de qualquer certidão expirar", "Organização separada por empresa e CNPJ"]
      },
      {
         number: "04",
         icon: <Calculator weight="bold" className="w-6 h-6 text-[#EA580C]" />,
         title: "Calculadora de Preço de Venda",
         subtitle: "Dispute sabendo o seu lucro",
         desc: "Coloque os custos da sua mercadoria ou serviço, impostos e frete. O sistema aponta até quanto você pode baixar na disputa sem ter prejuízo.",
         itens: ["Preço mínimo seguro para lances", "Cálculo simples de custos e impostos", "Margem de lucro protegida"]
      }
   ];

   const comparison = [
      {
         item: "Acompanhamento de certidões",
         antes: "Planilhas manuais ou conferência em cima da hora, com risco de esquecer.",
         comExpertise: "O sistema monitora as validades e avisa com antecedência."
      },
      {
         item: "Busca de editais",
         antes: "Entrar em vários portais diferentes todos os dias procurando no escuro.",
         comExpertise: "Editais reunidos em um único painel e filtrados para o seu negócio."
      },
      {
         item: "Leitura de exigências",
         antes: "Ler mais de 100 páginas de arquivos PDF para saber se pode participar.",
         comExpertise: "Resumo rápido com a lista do que a licitação exige."
      },
      {
         item: "Preço no pregão",
         antes: "Dar lances na emoção e correr o risco de vender abaixo do custo.",
         comExpertise: "Valor mínimo calculado antes para garantir o lucro da sua empresa."
      }
   ];

   return (
      <div className="min-h-screen w-full bg-white font-sans antialiased text-[#0A2540] selection:bg-[#EA580C] selection:text-white">

         {/* 1. TOPO DE AVISO / CONFIANÇA */}
         <div className="w-full bg-[#0A2540] text-white py-2 px-4 text-xs font-medium border-b border-blue-950">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
               <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-[#EA580C] animate-pulse" />
                  <span className="text-slate-100 font-bold">Expertise Licitatória</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-300">Conectado às compras públicas de todo o Brasil (Lei 14.133/2021)</span>
               </div>
               <div className="flex items-center gap-4 text-slate-300">
                  <span className="flex items-center gap-1.5">
                     <ShieldCheck weight="fill" className="w-4 h-4 text-[#EA580C]" />
                     Seus dados e documentos protegidos
                  </span>
               </div>
            </div>
         </div>

         {/* 2. CABEÇALHO PRINCIPAL COM A LOGO REAL */}
         <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
            <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6 lg:px-12">
               
               {/* Logo Oficial da Imagem logo.png */}
               <div 
                  className="flex items-center cursor-pointer py-2" 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
               >
                  <img 
                     src="/logo.png" 
                     alt="Expertise Licitatória" 
                     className="h-12 sm:h-14 w-auto object-contain drop-shadow-sm"
                     loading="eager"
                  />
               </div>

               {/* Navegação Simples */}
               <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <a href="#problemas" className="hover:text-[#EA580C] transition-colors">O que resolvemos</a>
                  <a href="#como-funciona" className="hover:text-[#EA580C] transition-colors">Como funciona</a>
                  <a href="#comparativo" className="hover:text-[#EA580C] transition-colors">Comparativo</a>
                  <a href="#planos" className="hover:text-[#EA580C] transition-colors">Planos</a>
                  <a href="#duvidas" className="hover:text-[#EA580C] transition-colors">Dúvidas comuns</a>
               </nav>

               {/* Botões de Acesso */}
               <div className="flex items-center gap-3">
                  <button 
                     onClick={() => navigate('/login')} 
                     className="text-xs font-bold uppercase tracking-wider text-[#0A2540] hover:text-[#EA580C] px-3 py-2 transition-colors"
                  >
                     Entrar
                  </button>
                  <button 
                     onClick={() => navigate('/register')} 
                     className="flex items-center gap-2 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] active:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider px-5 sm:px-6 py-3.5 shadow-[0_8px_20px_rgba(234,88,12,0.28)] transition-all hover:-translate-y-0.5"
                  >
                     <span>Criar Conta</span>
                     <CaretRight weight="bold" className="w-4 h-4" />
                  </button>
               </div>

            </div>
         </header>

         {/* 3. HERO: MENSAGEM CLARA PARA O EMPRESÁRIO */}
         <section className="relative w-full bg-white border-b border-slate-200 pt-12 pb-20 lg:pt-16 lg:pb-24 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
               
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                  
                  {/* Texto Principal */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="lg:col-span-7 space-y-6">
                     
                     <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0A2540] tracking-tight leading-[1.15]">
                        Pare de perder licitações por <span className="text-[#EA580C]">certidão vencida</span> ou por vender barato demais.
                     </h1>

                     <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
                        A Expertise Licitatória encontra os editais certos para a sua empresa, avisa os prazos das suas certidões e ajuda você a disputar contratos com o preço certo para garantir lucro.
                     </p>

                     {/* Benefícios Rápidos */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#EA580C] shrink-0" />
                           <span>Aviso antes da certidão vencer</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#EA580C] shrink-0" />
                           <span>Editais filtrados para o seu ramo</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#EA580C] shrink-0" />
                           <span>Preço mínimo calculado para lances</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#EA580C] shrink-0" />
                           <span>Resumo das exigências do edital</span>
                        </div>
                     </div>

                     {/* Botão de Ação */}
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                        <button 
                           onClick={() => navigate('/register')} 
                           className="flex items-center justify-center gap-3 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] active:bg-[#c2410c] text-white text-sm font-black uppercase tracking-widest px-8 py-5 shadow-[0_12px_28px_rgba(234,88,12,0.32)] transition-all hover:-translate-y-0.5"
                        >
                           <span>Cadastrar Minha Empresa</span>
                           <ArrowRight weight="bold" className="w-5 h-5" />
                        </button>

                        <a 
                           href="#como-funciona" 
                           className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#0A2540] text-xs font-bold uppercase tracking-wider px-6 py-5 shadow-sm transition-colors text-center"
                        >
                           <span>Ver Como Funciona</span>
                        </a>
                     </div>

                     <p className="text-xs text-slate-500 font-medium">
                        Cadastro rápido pelo CNPJ. Não cobramos nenhuma comissão sobre contratos vencidos.
                     </p>

                  </motion.div>

                  {/* Computador com Telas Interativas Passando em Rotação Suave */}
                  <div className="lg:col-span-5 relative flex flex-col items-center justify-center pt-8 lg:pt-0">
                     {/* Iluminação Ambiente Suave */}
                     <div className="absolute -inset-4 sm:-inset-10 bg-gradient-to-tr from-[#EA580C]/20 via-[#0A2540]/10 to-blue-600/20 rounded-full blur-3xl opacity-70 pointer-events-none" />

                     {/* Mockup do Laptop Calmo com Encaixe Perfeito de Tela */}
                     <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ 
                           duration: 6, 
                           repeat: Infinity, 
                           ease: "easeInOut" 
                        }}
                        className="relative z-10 w-full flex flex-col items-center"
                     >
                        {/* Imagem do Laptop com Crossfade Suave entre as Telas */}
                        <div className="relative w-full max-w-[560px] lg:max-w-none aspect-[522/478]">
                           <AnimatePresence mode="wait">
                              <motion.img 
                                 key={LAPTOP_SLIDES[activeSlide].id}
                                 src={LAPTOP_SLIDES[activeSlide].image} 
                                 alt={LAPTOP_SLIDES[activeSlide].tag}
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 exit={{ opacity: 0 }}
                                 transition={{ duration: 0.45, ease: "easeInOut" }}
                                 className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_20px_30px_rgba(10,37,64,0.30)]"
                                 loading="eager"
                              />
                           </AnimatePresence>
                        </div>

                        {/* Sombra de Apoio Estável */}
                        <div className="w-[82%] max-w-[460px] h-6 bg-[#0A2540]/35 rounded-full blur-xl -mt-4 pointer-events-none" />
                     </motion.div>

                     {/* Navegação Interativa entre os Módulos do Sistema */}
                     <div className="w-full flex items-center justify-center mt-3 z-20">
                        <div className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                           {LAPTOP_SLIDES.map((slide, idx) => (
                              <button
                                 key={slide.id}
                                 onClick={() => setActiveSlide(idx)}
                                 className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    activeSlide === idx
                                       ? 'bg-[#0A2540] text-white shadow-sm ring-2 ring-[#EA580C]'
                                       : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                 }`}
                              >
                                 {slide.tag}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

               </div>

            </div>
         </section>

         {/* 4. O QUE RESOLVEMOS (PROBLEMAS REAIS QUE CUSTAM CARO) */}
         <section id="problemas" className="w-full bg-[#F8FAFC] py-20 lg:py-24 px-6 lg:px-12 border-b border-slate-200">
            <div className="max-w-7xl mx-auto space-y-12">
               
               <div className="max-w-3xl space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#EA580C] block">
                     O Que Mais Prejudica as Empresas
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0A2540] tracking-tight">
                     Você já perdeu uma licitação por algum desses motivos?
                  </h2>
                  <p className="text-base text-slate-600 font-medium">
                     Disputar contratos públicos exige atenção a regras e datas. A maioria das empresas perde dinheiro nos mesmos erros comuns:
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {painPoints.map((item, idx) => (
                     <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-7 space-y-3 shadow-sm hover:border-orange-300 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C] border border-orange-200 shrink-0">
                              <WarningCircle weight="bold" className="w-6 h-6" />
                           </div>
                           <h3 className="text-base sm:text-lg font-black text-[#0A2540]">{item.title}</h3>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                           {item.desc}
                        </p>
                        <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs font-bold text-[#0A2540]">
                           <CheckCircle weight="fill" className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                           <span>Como resolvemos: <span className="font-normal text-slate-600">{item.solucao}</span></span>
                        </div>
                     </div>
                  ))}
               </div>

            </div>
         </section>

         {/* 5. COMO FUNCIONA NA PRÁTICA (OS 4 MÓDULOS) */}
         <section id="como-funciona" className="w-full bg-white py-20 lg:py-24 px-6 lg:px-12 border-b border-slate-200">
            <div className="max-w-7xl mx-auto space-y-14">
               
               <div className="text-center max-w-3xl mx-auto space-y-3">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0A2540] tracking-tight">
                     Tudo o que você precisa em quatro etapas práticas.
                  </h2>
                  <p className="text-base text-slate-600 font-medium">
                     Sem telas complicadas ou termos difíceis. Veja como a Expertise Licitatória organiza sua rotina:
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {modules.map((mod, idx) => (
                     <div key={idx} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-8 space-y-5 hover:bg-white hover:shadow-md hover:border-orange-200 transition-all">
                        
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
                                 {mod.icon}
                              </div>
                              <div>
                                 <h3 className="text-lg font-black text-[#0A2540]">{mod.title}</h3>
                                 <span className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">{mod.subtitle}</span>
                              </div>
                           </div>
                           <span className="text-2xl font-black text-slate-300 font-mono">{mod.number}</span>
                        </div>

                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                           {mod.desc}
                        </p>

                        <div className="pt-4 border-t border-slate-200/80 space-y-2">
                           {mod.itens.map((it, iIdx) => (
                              <div key={iIdx} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                                 <CheckCircle weight="fill" className="w-4 h-4 text-[#EA580C] shrink-0" />
                                 <span>{it}</span>
                              </div>
                           ))}
                        </div>

                     </div>
                  ))}
               </div>

            </div>
         </section>

         {/* 6. TABELA COMPARATIVA (MANUAL VS EXPERTISE) */}
         <section id="comparativo" className="w-full bg-[#F8FAFC] py-20 lg:py-24 px-6 lg:px-12 border-b border-slate-200">
            <div className="max-w-7xl mx-auto space-y-12">
               
               <div className="text-center max-w-3xl mx-auto space-y-3">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0A2540] tracking-tight">
                     Disputar licitações no improviso vs. Com a Expertise
                  </h2>
               </div>

               <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                     <thead>
                        <tr className="bg-[#0A2540] text-white">
                           <th className="py-4 px-6 font-bold uppercase tracking-wider text-slate-200 w-1/4">Na Sua Empresa</th>
                           <th className="py-4 px-6 font-bold uppercase tracking-wider text-slate-400 w-3/8">Fazendo Manualmente</th>
                           <th className="py-4 px-6 font-black uppercase tracking-wider text-[#EA580C] w-3/8 bg-blue-950 border-l border-blue-900">
                              Com a Expertise Licitatória
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {comparison.map((row, idx) => (
                           <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="py-4 px-6 font-bold text-[#0A2540]">{row.item}</td>
                              <td className="py-4 px-6 text-slate-600 font-medium">
                                 <div className="flex items-start gap-2">
                                    <X weight="bold" className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span>{row.antes}</span>
                                 </div>
                              </td>
                              <td className="py-4 px-6 font-bold text-[#0A2540] bg-orange-50/30 border-l border-slate-200">
                                 <div className="flex items-start gap-2">
                                    <Check weight="bold" className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                                    <span>{row.comExpertise}</span>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

            </div>
         </section>

         {/* 7. PLANOS E PREÇOS - EXATAMENTE COMO NO MODELO OFICIAL */}
         <section id="planos" className="w-full bg-white py-20 lg:py-28 px-6 lg:px-12 border-b border-slate-200">
            <div className="max-w-7xl mx-auto space-y-12">
               
               {/* Cabeçalho Oficial */}
               <div className="max-w-4xl">
                  <div className="inline-block">
                     <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0A2540] tracking-tight">
                        Escolha a melhor solução para o seu negócio
                     </h2>
                     <div className="h-1 w-28 bg-[#EA580C] mt-2 rounded-full" />
                  </div>
                  <p className="text-base text-slate-600 font-medium leading-relaxed mt-4 max-w-3xl">
                     Desenvolvemos planos com progressão clara. Do MEI que busca organização à grande empresa que exige inteligência competitiva e automação em larga escala.
                  </p>

                  {/* Alternador Mensal / Anual */}
                  <div className="pt-6 flex flex-wrap items-center gap-3">
                     <div className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                        <button
                           onClick={() => setBillingPeriod('mensal')}
                           className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                              billingPeriod === 'mensal'
                                 ? 'bg-white text-[#0A2540] shadow-sm'
                                 : 'text-slate-600 hover:text-slate-900'
                           }`}
                        >
                           Mensal
                        </button>
                        <button
                           onClick={() => setBillingPeriod('anual')}
                           className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                              billingPeriod === 'anual'
                                 ? 'bg-[#0A2540] text-white shadow-sm'
                                 : 'text-slate-600 hover:text-slate-900'
                           }`}
                        >
                           <span>Anual</span>
                           <span className="bg-[#EA580C] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                              -20% Desconto
                           </span>
                        </button>
                     </div>
                     <span className="text-xs text-slate-500 font-medium">
                        Sem fidelidade ou carência. Cancele quando desejar.
                     </span>
                  </div>
               </div>

               {/* Grid dos 3 Cards Oficiais com Microinterações */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-2">
                  
                  {/* CARD 1: Básico */}
                  <motion.div 
                     whileHover={{ y: -6, transition: { duration: 0.2 } }}
                     className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-lg hover:border-slate-300 transition-all"
                  >
                     <div>
                        <div className="text-center pb-6 border-b border-slate-100">
                           <h3 className="text-2xl font-black text-[#0A2540]">Básico</h3>
                           <p className="text-xs text-slate-500 mt-1.5 font-medium max-w-[240px] mx-auto">
                              Para quem está começando e precisa se organizar.
                           </p>
                           
                           <div className="mt-5 flex items-baseline justify-center gap-1">
                              <span className="text-sm font-bold text-slate-500">R$</span>
                              <span className="text-4xl font-black text-[#0A2540]">
                                 {billingPeriod === 'anual' ? '79,90' : '99,99'}
                              </span>
                              <span className="text-xs text-slate-500 font-bold">/mês</span>
                           </div>
                        </div>

                        <ul className="space-y-3.5 text-xs text-slate-700 py-6">
                           {[
                              { label: 'Radar de Licitações (filtros básicos)' },
                              { label: 'Leitor Inteligente de Editais' },
                              { label: 'Checklist e Cofre Documental' },
                              { label: 'Controle de certidões e vencimentos' },
                              { label: 'Calendário de prazos e alertas' },
                              { label: 'Elaboração de propostas (modelos)' },
                              { label: 'Calculadora básica de custos' },
                              { label: 'Cadastro e gestão de até 5 empresas (CNPJs)' },
                              { label: 'Gestão Contratual (controle de prazos)' },
                              { label: 'Acesso à Academia do Licitante' },
                           ].map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 transition-transform hover:translate-x-1 duration-150">
                                 <span className="text-[#EA580C] font-black text-sm shrink-0 leading-none mt-0.5">✓</span>
                                 <span className="font-normal text-slate-700">{item.label}</span>
                              </li>
                           ))}
                        </ul>
                     </div>

                     <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/register', { state: { plano: 'basico' } })} 
                        className="mt-6 w-full py-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0A2540] text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                     >
                        Começar no Básico
                     </motion.button>
                  </motion.div>

                  {/* CARD 2: Avançado (MELHOR CUSTO-BENEFÍCIO) */}
                  <motion.div 
                     whileHover={{ y: -8, transition: { duration: 0.2 } }}
                     className="rounded-3xl border-2 border-[#0062D2] bg-gradient-to-b from-[#F0F7FF]/60 via-white to-white p-7 sm:p-8 flex flex-col justify-between shadow-xl relative"
                  >
                     {/* Badge de Destaque Superior */}
                     <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0062D2] text-white text-[10px] font-black uppercase tracking-widest px-5 py-1 rounded-full shadow-md whitespace-nowrap">
                        MELHOR CUSTO-BENEFÍCIO
                     </div>

                     <div>
                        <div className="text-center pb-6 border-b border-blue-100/80 pt-1">
                           <h3 className="text-2xl font-black text-[#0A2540]">Avançado</h3>
                           <p className="text-xs text-slate-500 mt-1.5 font-medium max-w-[240px] mx-auto">
                              Para analisar e competir em alto nível.
                           </p>
                           
                           <div className="mt-5 flex items-baseline justify-center gap-1">
                              <span className="text-sm font-bold text-[#0062D2]">R$</span>
                              <span className="text-4xl font-black text-[#0062D2]">
                                 {billingPeriod === 'anual' ? '159,00' : '199,00'}
                              </span>
                              <span className="text-xs text-slate-500 font-bold">/mês</span>
                           </div>
                        </div>

                        <ul className="space-y-3.5 text-xs text-slate-700 py-6">
                           {[
                              { label: 'Tudo do plano Básico, mais:', bold: true },
                              { label: 'Gestão de até 10 empresas (CNPJs)', bold: false },
                              { label: 'Radar de Nulidades nos editais', bold: false },
                              { label: 'Score de Viabilidade e Concorrência', bold: false },
                              { label: 'Histórico de Concorrentes', bold: false },
                              { label: 'Impugnação Inteligente (Assistente IA)', bold: false },
                              { label: 'Cálculos avançados (tributos e margens)', bold: false },
                              { label: 'Análise de Dispensa Eletrônica', bold: false },
                              { label: 'Gestão de SRP e acompanhamento de atas', bold: false },
                              { label: 'Robôs de Lance (limites configurados)', bold: false },
                              { label: 'Gestão Financeira Pós-Vitória', bold: false },
                           ].map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 transition-transform hover:translate-x-1 duration-150">
                                 <span className="text-[#EA580C] font-black text-sm shrink-0 leading-none mt-0.5">✓</span>
                                 <span className={item.bold ? 'font-bold text-[#0A2540]' : 'font-normal text-slate-700'}>
                                    {item.label}
                                 </span>
                              </li>
                           ))}
                        </ul>
                     </div>

                     <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/register', { state: { plano: 'avancado' } })} 
                        className="mt-6 w-full py-4 rounded-xl bg-[#0062D2] hover:bg-[#0051b3] text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_8px_20px_rgba(0,98,210,0.35)]"
                     >
                        Quero o Plano Avançado
                     </motion.button>
                  </motion.div>

                  {/* CARD 3: Master (PREMIUM) */}
                  <motion.div 
                     whileHover={{ y: -6, transition: { duration: 0.2 } }}
                     className="rounded-3xl border border-slate-300 bg-white p-7 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-lg hover:border-slate-400 transition-all relative"
                  >
                     {/* Badge de Destaque Superior */}
                     <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0A2540] text-white text-[10px] font-black uppercase tracking-widest px-5 py-1 rounded-full shadow-md whitespace-nowrap">
                        PREMIUM
                     </div>

                     <div>
                        <div className="text-center pb-6 border-b border-slate-100 pt-1">
                           <h3 className="text-2xl font-black text-[#0A2540]">Master</h3>
                           <p className="text-xs text-slate-500 mt-1.5 font-medium max-w-[240px] mx-auto">
                              Inteligência, gestão completa e apoio jurídico.
                           </p>
                           
                           <div className="mt-5 flex items-baseline justify-center gap-1">
                              <span className="text-sm font-bold text-slate-500">R$</span>
                              <span className="text-4xl font-black text-[#0A2540]">
                                 {billingPeriod === 'anual' ? '399,00' : '499,00'}
                              </span>
                              <span className="text-xs text-slate-500 font-bold">/mês</span>
                           </div>
                        </div>

                        <ul className="space-y-3.5 text-xs text-slate-700 py-6">
                           {[
                              { label: 'Tudo do plano Avançado, mais:', bold: true },
                              { label: 'Gestão de até 20 empresas (CNPJs)', bold: true },
                              { label: 'Radar e Inteligência Competitiva ampliados', bold: false },
                              { label: 'Radar de Fraudes e Compliance', bold: true },
                              { label: 'Automação total de propostas e fluxos', bold: false },
                              { label: 'Painel Financeiro consolidado', bold: false },
                              { label: 'Robô de Reajuste (índices/cláusulas)', bold: true },
                              { label: 'Assistente de Repactuação', bold: true },
                              { label: 'Assistente de Reequilíbrio (Cálculo)', bold: true },
                              { label: 'Gestão de Caução e Garantias (Proposta e Contratual)', bold: true },
                              { label: 'Revisão assistida e análise de riscos', bold: false },
                              { label: 'Dossiês documentais e minutas', bold: false },
                              { label: 'Apoio jurídico por advogado parceiro (escopo/franquia)', bold: false },
                           ].map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 transition-transform hover:translate-x-1 duration-150">
                                 <span className="text-[#0A2540] font-black text-sm shrink-0 leading-none mt-0.5">✓</span>
                                 <span className={item.bold ? 'font-bold text-[#0A2540]' : 'font-normal text-slate-700'}>
                                    {item.label}
                                 </span>
                              </li>
                           ))}
                        </ul>
                     </div>

                     <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/register', { state: { plano: 'master' } })} 
                        className="mt-6 w-full py-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0A2540] text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                     >
                        Escolher Plano Master
                     </motion.button>
                  </motion.div>

               </div>

            </div>
         </section>

         {/* 8. PERGUNTAS FREQUENTES */}
         <section id="duvidas" className="w-full bg-[#F8FAFC] py-20 lg:py-24 px-6 lg:px-12 border-b border-slate-200">
            <div className="max-w-4xl mx-auto space-y-10">
               
               <div className="text-center space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#EA580C] block">Tire Suas Dúvidas</span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0A2540] tracking-tight">
                     Perguntas Mais Comuns
                  </h2>
               </div>

               <div className="space-y-3">
                  {faqs.map((faq, idx) => (
                     <div key={idx} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        <button 
                           onClick={() => setActiveFaq(activeFaq === idx ? null : idx)} 
                           className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-slate-50 transition-colors"
                        >
                           <span className="text-sm font-bold text-[#0A2540] pr-4">{faq.q}</span>
                           <CaretDown weight="bold" className={`w-5 h-5 text-slate-500 transition-transform duration-200 shrink-0 ${activeFaq === idx ? 'rotate-180 text-[#EA580C]' : ''}`} />
                        </button>
                        <AnimatePresence>
                           {activeFaq === idx && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                                 <div className="p-5 sm:p-6 pt-0 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                                    {faq.a}
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  ))}
               </div>

            </div>
         </section>

         {/* 9. CHAMADA FINAL */}
         <section className="w-full bg-[#0A2540] text-white py-20 lg:py-24 px-6 lg:px-12 text-center relative overflow-hidden">
            <div className="max-w-4xl mx-auto space-y-7 relative z-10">
               
               <img 
                  src="/logo.png" 
                  alt="Expertise Licitatória" 
                  className="h-16 w-auto mx-auto object-contain brightness-0 invert drop-shadow-md mb-4" 
               />

               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                  Comece hoje a disputar licitações com mais segurança e organização.
               </h2>

               <p className="text-base sm:text-lg text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
                  Cadastre sua empresa em poucos minutos e tenha as melhores ferramentas para encontrar editais, controlar certidões e vencer contratos com lucro.
               </p>

               <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                     onClick={() => navigate('/register')} 
                     className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] active:bg-[#c2410c] text-white text-sm font-black uppercase tracking-widest px-10 py-5 shadow-[0_12px_28px_rgba(234,88,12,0.35)] transition-all hover:-translate-y-0.5"
                  >
                     <span>Cadastrar Minha Empresa Agora</span>
                     <CaretRight weight="bold" className="w-5 h-5" />
                  </button>

                  <button 
                     onClick={() => navigate('/login')} 
                     className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-blue-800 bg-blue-900/60 hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider px-8 py-5 transition-colors"
                  >
                     <span>Já Tenho Uma Conta</span>
                  </button>
               </div>

               <p className="text-xs text-slate-400 font-medium pt-2">
                  Ativação imediata. Sem carência e sem taxas escondidas.
               </p>

            </div>
         </section>

         {/* 10. RODAPÉ COM A LOGO REAL */}
         <footer className="w-full bg-white border-t border-slate-200 py-10 px-6 lg:px-12 text-slate-600 text-xs">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
               
               <div className="flex items-center gap-4">
                  <img 
                     src="/logo.png" 
                     alt="Expertise Licitatória" 
                     className="h-10 w-auto object-contain"
                  />
                  <div>
                     <span className="font-black text-sm tracking-tight text-[#0A2540] block">EXPERTISE LICITATÓRIA</span>
                     <span className="text-[10px] text-slate-400 block font-medium">Plataforma de Gestão em Licitações Públicas</span>
                  </div>
               </div>

               <div className="flex flex-wrap items-center justify-center gap-6 font-bold uppercase tracking-wider text-[11px] text-slate-500">
                  <a href="#problemas" className="hover:text-[#EA580C] transition-colors">O que resolvemos</a>
                  <a href="#como-funciona" className="hover:text-[#EA580C] transition-colors">Como funciona</a>
                  <a href="#planos" className="hover:text-[#EA580C] transition-colors">Planos</a>
                  <button onClick={() => navigate('/termos-de-uso')} className="hover:text-[#EA580C] transition-colors">Termos de Uso</button>
                  <button onClick={() => navigate('/politica-privacidade')} className="hover:text-[#EA580C] transition-colors">Política de Privacidade</button>
               </div>

               <p className="text-slate-400 font-medium">
                  &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
               </p>

            </div>
         </footer>

      </div>
   );
}
