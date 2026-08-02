import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle, Question, ArrowRight, InstagramLogo, LockKey, ChartLineUp, Target, Database, Buildings } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  
  // Estados - Hero Section
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState(false);
  
  // Estados - Calculadora
  const [processosMensais, setProcessosMensais] = useState(10);
  const horasPerdidas = processosMensais * 3.5;
  const dinheiroPerdido = processosMensais * 1250;

  // Estados - FAQ
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Consulta automática de CNPJ (BrasilAPI Real)
  useEffect(() => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      setIsLoadingCnpj(true);
      setCnpjError(false);
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
        .then(res => {
           if (!res.ok) throw new Error('CNPJ Inválido');
           return res.json();
        })
        .then(data => {
           setRazaoSocial(data.razao_social || 'EMPRESA ENCONTRADA (SEM RAZÃO SOCIAL)');
        })
        .catch(() => {
           setRazaoSocial('');
           setCnpjError(true);
        })
        .finally(() => {
           setIsLoadingCnpj(false);
        });
    } else {
      if (razaoSocial) setRazaoSocial('');
      if (cnpjError) setCnpjError(false);
    }
  }, [cnpj]);

  // Faqs data
  const faqs = [
    {
      q: "O sistema exibe informações reais ou simulações?",
      a: "Trabalhamos estritamente com dados oficiais capturados em tempo real diretamente dos canais do governo (PNCP e Compras.gov). Se uma fonte pública estiver instável ou indisponível, o painel avisa o operador imediatamente, proibindo informações fictícias."
    },
    {
      q: "Como a ferramenta impede que minha empresa tenha prejuízo nos lances?",
      a: "Antes de abrir a sessão pública, você preenche a Calculadora de Preço Seguro inserindo o custo do produto, impostos e frete. O enviador automático respeita esse limite milimetricamente, travando a operação antes de gerar qualquer prejuízo."
    },
    {
      q: "Meus documentos estratégicos estão protegidos contra vazamento?",
      a: "Sim. Toda a sua documentação de habilitação cadastral e dados de faturamento empresarial são guardados sob criptografia bancária rigorosa de alta segurança e isolamento completo no servidor, seguindo a LGPD."
    }
  ];

  // Variantes Framer Motion
  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, type: "spring", bounce: 0.2 } }
  };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  return (
    <div className="min-h-screen w-full bg-white font-sans antialiased text-slate-900 selection:bg-[#EA580C] selection:text-white overflow-x-hidden">
      
      {/* BARRA SUPERIOR (VERCEL BAR) */}
      <div className="w-full bg-[#0A2540] py-3 text-center transition-colors">
        <a href="/login" className="text-[11px] font-black uppercase tracking-widest text-slate-200 hover:text-[#EA580C] transition-colors">
          Acesse sua conta ou cadastre-se 
        </a>
      </div>

      {/* HEADER ULTRA-MINIMALISTA */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 md:px-12">
          
          <div className="flex items-center cursor-pointer w-[60%] md:w-auto" onClick={() => window.scrollTo(0,0)}>
            {/* LOGO CORRIGIDA */}
            <img src="/logo.png" alt="Expertise Licitatória" className="h-10 md:h-12 w-auto object-contain flex-shrink-0" />
          </div>

          <nav className="hidden items-center gap-10 lg:flex">
            <a href="#solucoes" className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0A2540] transition-colors">A Solução</a>
            <a href="#calculadora" className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0A2540] transition-colors">O Prejuízo</a>
            <a href="#seguranca" className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0A2540] transition-colors">Infraestrutura</a>
            <a href="#duvidas" className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0A2540] transition-colors">Dúvidas</a>
          </nav>

          <div>
            <button 
              onClick={() => navigate('/login')}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#0A2540] shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              Acessar Plataforma
            </button>
          </div>
        </div>
      </header>

      <main className="w-full bg-white">
        
        {/* DOBRA 1: O IMPACTO INICIAL (HERO) */}
        <section className="mx-auto max-w-7xl px-6 py-20 md:py-32 md:px-12 border-b border-slate-100">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
            
            <motion.div 
              initial="hidden" animate="visible" variants={fadeInUp}
              className="flex flex-col gap-8 lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200/60 px-3 py-1 text-slate-500 text-[11px] font-black uppercase tracking-wider w-fit shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#EA580C] animate-pulse" />
                Dados Oficiais em Tempo Real
              </div>

              <h1 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-4xl md:text-5xl lg:text-[4rem] lg:leading-[1.05]">
                O jeito mais fácil e seguro de sua empresa fechar grandes contratos com o governo.
              </h1>
              
              <p className="max-w-xl text-lg font-medium text-slate-500 leading-relaxed">
                Descubra papéis de compras abertos na hora, encontre armadilhas escondidas que tentam te derrubar e mande seus preços automaticamente.
              </p>

              <div className="flex items-center gap-2 text-[#EA580C] pt-2">
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest text-[#0A2540]">
                  Sem jargões técnicos. Apenas resultados reais.
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full lg:col-span-5 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540]/5 to-[#EA580C]/5 rounded-3xl transform rotate-3 scale-105 -z-10"></div>
              <div className="w-full rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-xl p-8 shadow-2xl shadow-slate-200/50">
                <h2 className="mb-6 font-sans font-black text-sm uppercase tracking-tight text-slate-900 border-b border-slate-100 pb-3">
                  Crie sua central de comando
                </h2>

                <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nome do responsável</label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 transition-all focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] outline-none" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">E-mail corporativo</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="diretoria@empresa.com" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 transition-all focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] outline-none" />
                  </div>

                  <div className="flex flex-col gap-1.5 relative">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">CNPJ da empresa</label>
                    <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" maxLength={18} className={`h-12 w-full rounded-xl border ${cnpjError ? 'border-red-500' : 'border-slate-200'} bg-white px-4 text-sm font-bold text-slate-900 transition-all focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] outline-none`} />
                    {isLoadingCnpj && (
                      <div className="absolute right-4 top-[34px] animate-spin h-5 w-5 border-2 border-[#EA580C] border-t-transparent rounded-full"></div>
                    )}
                    {cnpjError && (
                      <span className="text-[10px] font-bold text-red-500 uppercase mt-1">CNPJ não encontrado na Receita Federal</span>
                    )}
                  </div>

                  <AnimatePresence>
                     {razaoSocial && !cnpjError && (
                       <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                         <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 mt-2 flex items-center gap-3">
                           <CheckCircle className="text-emerald-500 h-6 w-6 flex-shrink-0" weight="fill" />
                           <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Razão Social Encontrada</p>
                              <p className="text-xs font-black text-[#0A2540] mt-1">{razaoSocial}</p>
                           </div>
                         </div>
                       </motion.div>
                     )}
                  </AnimatePresence>

                  <button onClick={() => navigate('/register', { state: { nome, email, cnpj: cnpj.replace(/\D/g, ''), razaoSocial } })} className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#EA580C] text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-orange-600 active:scale-95 group overflow-hidden relative">
                    <span className="relative z-10 flex items-center gap-2">
                       INICIAR CADASTRO AGORA <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  </button>

                </form>
              </div>
            </motion.div>

          </div>
        </section>

        {/* DOBRA 2: FONTES OFICIAIS */}
        <section className="border-b border-slate-100 bg-slate-50/50 py-12 overflow-hidden">
           <div className="max-w-7xl mx-auto px-6 md:px-12">
              <div className="text-center mb-6">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">JOGAMOS NO TERRENO REAL. ZERO SIMULAÇÕES.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                 <span className="font-sans font-black text-xl md:text-2xl text-[#0A2540] tracking-tighter uppercase">COMPRAS.GOV</span>
                 <span className="font-sans font-black text-xl md:text-2xl text-[#0A2540] tracking-tighter uppercase">PNCP</span>
                 <span className="font-sans font-black text-xl md:text-2xl text-[#0A2540] tracking-tighter uppercase">LICITAÇÕES-E</span>
                 <span className="font-sans font-black text-xl md:text-2xl text-[#0A2540] tracking-tighter uppercase">BANCO DO BRASIL</span>
              </div>
           </div>
        </section>

        {/* DOBRA 3: A CALCULADORA DA DOR */}
        <section id="calculadora" className="mx-auto max-w-7xl px-6 py-24 md:py-32 md:px-12 border-b border-slate-100">
           <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeInUp} className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl md:text-5xl mb-6">
                 VOCÊ ESTÁ DEIXANDO DINHEIRO NA MESA TODOS OS DIAS.
              </h2>
              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                 Pesquisar editais manualmente, ler centenas de páginas e perder prazos de lances destrói a margem de lucro da sua operação. Descubra o tamanho do seu prejuízo.
              </p>
           </motion.div>

           <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 md:p-12 shadow-2xl shadow-slate-200/50">
              <div className="mb-12">
                 <label className="flex justify-between items-end mb-6">
                    <span className="text-sm font-black uppercase tracking-widest text-[#0A2540]">Volume Mensal de Licitações</span>
                    <span className="text-3xl font-black text-[#EA580C]">{processosMensais}</span>
                 </label>
                 <input 
                    type="range" min="1" max="50" 
                    value={processosMensais} 
                    onChange={(e) => setProcessosMensais(Number(e.target.value))}
                    className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#EA580C]"
                 />
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                 <div className="bg-red-50 rounded-2xl p-8 border border-red-100">
                    <p className="text-xs font-black uppercase tracking-widest text-red-500 mb-2">TEMPO PERDIDO (MÊS)</p>
                    <p className="text-4xl font-black text-red-950">{horasPerdidas} Horas</p>
                    <p className="text-sm font-medium text-red-800 mt-2">Buscando e lendo papéis</p>
                 </div>
                 <div className="bg-red-50 rounded-2xl p-8 border border-red-100">
                    <p className="text-xs font-black uppercase tracking-widest text-red-500 mb-2">PREJUÍZO ESTIMADO (MÊS)</p>
                    <p className="text-4xl font-black text-red-950">
                       R$ {dinheiroPerdido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm font-medium text-red-800 mt-2">Em oportunidades invisíveis</p>
                 </div>
              </div>
           </motion.div>
        </section>

        {/* DOBRA 4, 5, 6, 7: O ARSENAL FLUTUANTE */}
        <section id="solucoes" className="mx-auto max-w-7xl px-6 py-24 md:py-32 md:px-12 border-b border-slate-100 bg-slate-50/30">
           <div className="mb-20 text-center max-w-3xl mx-auto">
              <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl md:text-5xl mb-6">
                 O ARSENAL DE GUERRA
              </h2>
              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                 Um conjunto de ferramentas cirúrgicas desenhadas estritamente para colocar você em primeiro lugar no pódio das licitações.
              </p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* DOBRA 4 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} className="group relative bg-white rounded-3xl p-10 border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-[#0A2540]/10 hover:-translate-y-2 transition-all duration-300">
                 <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 group-hover:bg-[#0A2540] group-hover:text-white transition-all duration-300">
                    <Target size={28} />
                 </div>
                 <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">MERCADO ATIVO</div>
                 <h3 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-2xl mb-4">BUSCADOR DE COMPRAS 24H</h3>
                 <p className="text-slate-500 font-medium leading-relaxed">O painel monitora os portais do governo o dia todo. Você encontra editais abertos no seu estado antes de todo mundo. Chega de acordar cedo para caçar PDF em sites confusos.</p>
              </motion.div>

              {/* DOBRA 5 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} className="group relative bg-white rounded-3xl p-10 border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-[#EA580C]/10 hover:-translate-y-2 transition-all duration-300">
                 <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 group-hover:scale-110 group-hover:bg-[#EA580C] group-hover:text-white transition-all duration-300">
                    <ShieldCheck size={28} />
                 </div>
                 <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">SEGURANÇA JURÍDICA</div>
                 <h3 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-2xl mb-4">REVISOR ANTI-ARMADILHAS</h3>
                 <p className="text-slate-500 font-medium leading-relaxed">Ler calhamaços de 100 páginas é coisa do passado. O sistema escaneia o edital em segundos e aponta em vermelho exigências absurdas e armadilhas desenhadas para desclassificar a sua empresa.</p>
              </motion.div>

              {/* DOBRA 6 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} className="group relative bg-white rounded-3xl p-10 border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-[#0A2540]/10 hover:-translate-y-2 transition-all duration-300">
                 <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                    <ChartLineUp size={28} />
                 </div>
                 <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">OPERAÇÕES</div>
                 <h3 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-2xl mb-4">ENVIADOR SNIPER DE PREÇOS</h3>
                 <p className="text-slate-500 font-medium leading-relaxed">Dispute o primeiro lugar na velocidade máxima permitida pelos portais. O sistema cobre as ofertas da concorrência de forma autônoma, travando imediatamente se o valor encostar na sua margem de lucro mínima.</p>
              </motion.div>

              {/* DOBRA 7 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} className="group relative bg-white rounded-3xl p-10 border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-2 transition-all duration-300">
                 <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                    <Database size={28} />
                 </div>
                 <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">RISCO ZERO</div>
                 <h3 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-2xl mb-4">PASTA CRIPTOGRAFADA E ALERTAS</h3>
                 <p className="text-slate-500 font-medium leading-relaxed">Organização cirúrgica de certidões, balanços e alvarás. Alertas preventivos automáticos direto no seu WhatsApp te avisam dias antes do vencimento para blindar seu CNPJ.</p>
              </motion.div>
           </div>
        </section>

        {/* DOBRA 8: A DIFERENÇA (COMPARATIVO) */}
        <section className="mx-auto max-w-7xl px-6 py-24 md:py-32 md:px-12 border-b border-slate-100">
           <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="bg-[#0A2540] rounded-[2rem] p-8 md:p-16 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <h2 className="font-sans font-black uppercase tracking-tighter text-white text-3xl md:text-5xl mb-8 relative z-10">
                 O SEU CONCORRENTE TRABALHA DURO.<br/>VOCÊ TRABALHA CERTO.
              </h2>
              <p className="text-xl text-blue-100 font-medium max-w-3xl mx-auto leading-relaxed relative z-10">
                 Enquanto eles perdem tardes preenchendo planilhas e checando portais confusos, a Expertise Licitatória faz o trabalho pesado para a sua equipe. <strong>O que você faria com 40 horas livres por semana?</strong>
              </p>
           </motion.div>
        </section>

        {/* DOBRA 9: A FORTALEZA */}
        <section id="seguranca" className="mx-auto max-w-7xl px-6 py-24 md:py-32 md:px-12 border-b border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
             <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
                <Buildings className="h-16 w-16 text-[#EA580C] mb-8" />
                <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl md:text-5xl mb-6">
                  INFRAESTRUTURA DE NÍVEL BANCÁRIO
                </h2>
                <p className="text-lg text-slate-500 font-medium leading-relaxed mb-8">
                  Toda a documentação estratégica e dados de faturamento da sua empresa são processados sob criptografia rigorosa, em servidores isolados. O seu preço e a sua margem são segredos intocáveis.
                </p>
                <ul className="space-y-4">
                   <li className="flex items-center gap-3 text-sm font-bold text-[#0A2540] uppercase tracking-wider">
                      <CheckCircle className="h-6 w-6 text-emerald-500" weight="fill" /> Criptografia de ponta a ponta
                   </li>
                   <li className="flex items-center gap-3 text-sm font-bold text-[#0A2540] uppercase tracking-wider">
                      <CheckCircle className="h-6 w-6 text-emerald-500" weight="fill" /> Isolamento de dados LGPD
                   </li>
                   <li className="flex items-center gap-3 text-sm font-bold text-[#0A2540] uppercase tracking-wider">
                      <CheckCircle className="h-6 w-6 text-emerald-500" weight="fill" /> Backups automáticos redundantes
                   </li>
                </ul>
             </motion.div>
             <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="bg-slate-50 rounded-3xl p-10 border border-slate-200 shadow-xl relative overflow-hidden h-full flex flex-col justify-center">
                <LockKey className="h-12 w-12 text-slate-400 mb-6" />
                <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A2540] mb-4">Seu Cofre Digital</h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Sem acessos de terceiros. Sem cruzamento de dados. Sua operação é enclausurada e totalmente independente. Você tem a chave e o controle absoluto do seu negócio público.
                </p>
             </motion.div>
          </div>
        </section>

        {/* DOBRA 10: FAQ LEX E ASSINATURA FINAL */}
        <section id="duvidas" className="mx-auto max-w-4xl px-6 py-24 md:py-32 md:px-12">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-16">
            <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl md:text-5xl">
              RESTOU ALGUMA DÚVIDA?
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="space-y-4 mb-24">
            {faqs.map((faq, i) => (
              <motion.div variants={fadeInUp} key={i} className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                 <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    className="w-full flex items-center justify-between text-left focus:outline-none"
                 >
                    <span className="font-black text-[#0A2540] text-sm md:text-base uppercase tracking-wider pr-8">{faq.q}</span>
                    <div className={`p-2 rounded-full transition-colors ${activeFaq === i ? 'bg-orange-50' : 'bg-slate-50'}`}>
                       <Question className={`h-5 w-5 transition-transform ${activeFaq === i ? 'rotate-180 text-[#EA580C]' : 'text-slate-400'}`} weight="bold" />
                    </div>
                 </button>
                 <AnimatePresence>
                    {activeFaq === i && (
                       <motion.div 
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                       >
                          <p className="mt-4 text-base font-medium text-slate-500 leading-relaxed pt-4 border-t border-slate-100">
                             {faq.a}
                          </p>
                       </motion.div>
                    )}
                 </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center">
             <h3 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl mb-8">
                PARE DE BRINCAR NO MERCADO PÚBLICO.
             </h3>
             <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#EA580C] px-10 text-sm font-black uppercase tracking-widest text-white shadow-xl hover:bg-orange-600 transition-all hover:scale-105 active:scale-95">
                CRIAR CENTRAL DE COMANDO
             </button>
          </div>
        </section>

      </main>

      {/* FOOTER DIGITAL DAY */}
      <footer className="w-full bg-[#0A2540] py-8 border-t border-[#0A2540]">
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row items-center justify-between px-6 md:px-12 gap-6">
           <div className="flex items-center w-[60%] md:w-auto">
              <img src="/logo.png" alt="Expertise Licitatória" className="h-8 w-auto object-contain brightness-0 invert opacity-90" />
           </div>
           
           <a 
              href="https://instagram.com/digitalday_software" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors group"
           >
              Desenvolvido por Digital Day Software 
              <span className="p-1.5 rounded-full bg-slate-800 group-hover:bg-[#EA580C] transition-colors">
                 <InstagramLogo className="h-4 w-4" weight="fill" />
              </span>
           </a>
        </div>
      </footer>

    </div>
  );
}