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
  Calculator,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const LAPTOP_SLIDES = [
  {
    id: 1,
    image: '/painel-laptop-1.png',
    tag: 'Elaboração de Propostas',
    subtitle: 'Tabelas de preços preenchidas, declarações prontas e calendário de sessões',
  },
  {
    id: 2,
    image: '/painel-laptop-2.png',
    tag: 'Conferência de Documentos',
    subtitle: 'Verificação automática dos documentos exigidos pela Lei 14.133/21',
  },
  {
    id: 3,
    image: '/painel-laptop-3.png',
    tag: 'Central de Certidões',
    subtitle: 'Acompanhamento preventivo de certidões federais, estaduais, municipais, FGTS e trabalhistas',
  },
  {
    id: 4,
    image: '/painel-laptop-4.png',
    tag: 'Guia Prático do Licitante',
    subtitle: 'Orientação passo a passo em cada fase da disputa para você decidir com segurança',
  },
  {
    id: 5,
    image: '/painel-laptop-5.png',
    tag: 'Formação de Preço Seguro',
    subtitle: 'Cálculo de custos, impostos e margem mínima para disputar sem prejuízo',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % LAPTOP_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const faqs = [
    {
      q: 'Como o sistema me avisa antes de uma certidão vencer?',
      a: 'Você cadastra os documentos da sua empresa uma única vez. O sistema acompanha a validade das certidões (Federal, FGTS, Trabalhista, Estadual e Municipal) e emite alertas com antecedência no seu painel para você renovar antes de qualquer pregão.',
    },
    {
      q: 'De onde vêm os editais mostrados na plataforma?',
      a: 'Buscamos as compras públicas diretamente nas fontes oficiais do governo, como o Portal Nacional de Contratações Públicas (PNCP) e o Compras.gov.br. Filtramos apenas as oportunidades que têm a ver com o que a sua empresa vende.',
    },
    {
      q: 'Como o sistema evita que eu tome prejuízo na disputa?',
      a: 'Você informa o custo do seu produto ou serviço, impostos e frete. O sistema calcula a sua margem mínima de lucro e trava o piso seguro para você não baixar o preço além do limite durante a sessão.',
    },
    {
      q: 'Consigo cadastrar mais de uma empresa ou filial?',
      a: 'Sim. Você pode cadastrar matriz e filiais, ou diferentes CNPJs, mantendo os documentos, certidões e editais de cada empresa organizados separadamente.',
    },
    {
      q: 'Tenho que pagar porcentagem quando vencer uma licitação?',
      a: 'Não. Nunca cobramos comissão nem porcentagem sobre os contratos que a sua empresa conquistar. Todo o resultado do contrato é 100% seu.',
    },
    {
      q: 'O assistente ajuda mesmo quem está começando agora?',
      a: 'Sim. O Consultor Lex acompanha você em todas as telas mostrando o próximo passo: desde escolher o edital e conferir os documentos até montar a proposta, enviar lances ou pedir esclarecimentos.',
    },
  ];

  const painPoints = [
    {
      title: 'Perder a licitação por certidão vencida',
      desc: 'Você gasta tempo preparando a proposta e, na hora de enviar, descobre que uma certidão expirou no dia anterior. A empresa é desclassificada sem chance de recurso.',
      solucao: 'O sistema monitora todas as validades e avisa com dias de antecedência para você nunca ser pego de surpresa.',
    },
    {
      title: 'Não ver o edital a tempo de pedir correção',
      desc: 'O edital traz uma exigência exagerada ou errada. Existe um prazo curto antes da disputa para pedir correção. Quando você percebe, o prazo já passou.',
      solucao: 'Receba alertas imediatos dos editais e veja em destaque a data limite para pedidos de correção e recursos.',
    },
    {
      title: 'Baixar o preço demais na disputa e fechar no vermelho',
      desc: 'Na pressa do pregão, o preço vai caindo para vencer o concorrente. O contrato é assinado, mas depois as contas não fecham e a empresa fica no prejuízo.',
      solucao: 'Nossa planilha define o seu valor mínimo seguro antes de entrar na sala de disputa.',
    },
    {
      title: 'Passar horas lendo editais compridos para nada',
      desc: 'Sua equipe lê dezenas de páginas para só no final descobrir que pediram um atestado ou exigência que a empresa não atende.',
      solucao: 'Veja um resumo claro com os documentos pedidos, os itens e os pontos de atenção logo no início.',
    },
  ];

  const etapasPrincipais = [
    {
      number: '01',
      icon: <MagnifyingGlass weight="bold" className="w-6 h-6 text-[#EA580C]" />,
      title: 'Radar de Oportunidades',
      subtitle: 'Só o que sua empresa vende',
      desc: 'Encontre compras públicas abertas no governo federal, estados e municípios filtradas pelo seu ramo de atuação, sem precisar navegar em vários portais diferentes.',
      itens: ['Filtro pelo que você vende', 'Oportunidades em todo o Brasil', 'Avisos de novas licitações'],
    },
    {
      number: '02',
      icon: <FileText weight="bold" className="w-6 h-6 text-[#EA580C]" />,
      title: 'Resumo Prático & Guia Passo a Passo',
      subtitle: 'Direto aos pontos que importam',
      desc: 'Em vez de se perder em editais com centenas de páginas, consulte os documentos pedidos, atestados exigidos, prazos de entrega e receba orientação do próximo passo em cada etapa.',
      itens: ['Lista clara de documentos necessários', 'Monitoramento de prazos de impugnação e recurso', 'Destaque para exigências fora do comum'],
    },
    {
      number: '03',
      icon: <ShieldCheck weight="bold" className="w-6 h-6 text-[#EA580C]" />,
      title: 'Guarda de Documentos e Certidões',
      subtitle: 'Sua habilitação sempre em dia',
      desc: 'Mantenha contrato social, certidões negativas, atestados de capacidade e procurações guardados em um só lugar seguro e prontos para envio.',
      itens: ['Contagem regressiva de validade', 'Avisos antes de qualquer certidão vencer', 'Organização separada por empresa e CNPJ'],
    },
    {
      number: '04',
      icon: <Calculator weight="bold" className="w-6 h-6 text-[#EA580C]" />,
      title: 'Planilha de Preço e Sala de Disputa',
      subtitle: 'Dispute sabendo o seu lucro',
      desc: 'Informe os custos da mercadoria ou serviço, impostos e frete. Acompanhe a disputa em uma tabela prática e proteja seu valor mínimo para nunca vender no prejuízo.',
      itens: ['Preço mínimo seguro para lances', 'Cálculo simples de custos e impostos', 'Proposta readequada pronta após vencer'],
    },
  ];

  const comparison = [
    {
      item: 'Acompanhamento de prazos e certidões',
      antes: 'Planilhas manuais ou conferência em cima da hora, com risco de esquecer.',
      comExpertise: 'O sistema monitora validades e prazos críticos e avisa com antecedência.',
    },
    {
      item: 'Busca de editais',
      antes: 'Entrar em vários portais diferentes todos os dias procurando no escuro.',
      comExpertise: 'Editais reunidos em um único painel e filtrados para o seu negócio.',
    },
    {
      item: 'Leitura de exigências',
      antes: 'Ler mais de 100 páginas de arquivos para saber se pode participar.',
      comExpertise: 'Resumo direto com a lista do que a licitação exige e o que fazer em seguida.',
    },
    {
      item: 'Preço no pregão',
      antes: 'Dar lances na emoção e correr o risco de vender abaixo do custo.',
      comExpertise: 'Valor mínimo calculado antes para garantir o lucro da sua empresa.',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white font-sans antialiased text-[#0A2540] selection:bg-[#EA580C] selection:text-white">
      {/* 1. TOPO DE CONFIANÇA */}
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

      {/* 2. CABEÇALHO PRINCIPAL */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6 lg:px-12">
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

          <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-700">
            <a href="#problemas" className="hover:text-[#EA580C] transition-colors">O que resolvemos</a>
            <a href="#como-funciona" className="hover:text-[#EA580C] transition-colors">Como funciona</a>
            <a href="#comparativo" className="hover:text-[#EA580C] transition-colors">Comparativo</a>
            <a href="#pre-lancamento" className="hover:text-[#EA580C] transition-colors">Pré-Lançamento</a>
            <a href="#duvidas" className="hover:text-[#EA580C] transition-colors">Dúvidas comuns</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs font-bold uppercase tracking-wider text-[#0A2540] hover:text-[#EA580C] px-3 py-2 transition-colors cursor-pointer"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="flex items-center gap-2 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] active:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider px-5 sm:px-6 py-3.5 shadow-[0_8px_20px_rgba(234,88,12,0.28)] transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Criar Conta</span>
              <CaretRight weight="bold" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO */}
      <section className="relative w-full bg-white border-b border-slate-200 pt-12 pb-20 lg:pt-16 lg:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[#EA580C] text-xs font-black uppercase tracking-wider">
                Pré-Lançamento Oficial • Vagas Antecipadas
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0A2540] tracking-tight leading-[1.15]">
                Pare de perder licitações por <span className="text-[#EA580C]">certidão vencida</span> ou por vender barato demais.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
                A Expertise Licitatória encontra os editais certos para a sua empresa, acompanha todos os seus prazos e guia você passo a passo para disputar contratos com lucro real.
              </p>

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
                  <span>Preço mínimo seguro para lances</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <CheckCircle weight="fill" className="w-5 h-5 text-[#EA580C] shrink-0" />
                  <span>Guia inteligente em todas as etapas</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="flex items-center justify-center gap-3 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] active:bg-[#c2410c] text-white text-sm font-black uppercase tracking-widest px-8 py-5 shadow-[0_12px_28px_rgba(234,88,12,0.32)] transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Garantir Acesso Antecipado</span>
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
                Cadastro rápido pelo CNPJ. Sem comissão sobre contratos vencidos.
              </p>
            </motion.div>

            <div className="lg:col-span-5 relative flex flex-col items-center justify-center pt-8 lg:pt-0">
              <div className="absolute -inset-4 sm:-inset-10 bg-gradient-to-tr from-[#EA580C]/20 via-[#0A2540]/10 to-blue-600/20 rounded-full blur-3xl opacity-70 pointer-events-none" />

              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-full flex flex-col items-center"
              >
                <div className="relative w-full max-w-[560px] lg:max-w-none aspect-[522/478]">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={LAPTOP_SLIDES[activeSlide].id}
                      src={LAPTOP_SLIDES[activeSlide].image}
                      alt={LAPTOP_SLIDES[activeSlide].tag}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                      className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_20px_30px_rgba(10,37,64,0.30)]"
                      loading="eager"
                    />
                  </AnimatePresence>
                </div>
                <div className="w-[82%] max-w-[460px] h-6 bg-[#0A2540]/35 rounded-full blur-xl -mt-4 pointer-events-none" />
              </motion.div>

              <div className="w-full flex items-center justify-center mt-3 z-20">
                <div className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                  {LAPTOP_SLIDES.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
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

      {/* 4. O QUE RESOLVEMOS */}
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

      {/* 5. COMO FUNCIONA NA PRÁTICA */}
      <section id="como-funciona" className="w-full bg-white py-20 lg:py-24 px-6 lg:px-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0A2540] tracking-tight">
              Tudo o que você precisa em quatro etapas práticas.
            </h2>
            <p className="text-base text-slate-600 font-medium">
              Sem telas complicadas ou termos difíceis. Veja como a Expertise Licitatória organiza a sua rotina:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {etapasPrincipais.map((etapa, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-8 space-y-5 hover:bg-white hover:shadow-md hover:border-orange-200 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
                      {etapa.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-[#0A2540]">{etapa.title}</h3>
                      <span className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">{etapa.subtitle}</span>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-slate-300 font-mono">{etapa.number}</span>
                </div>

                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {etapa.desc}
                </p>

                <div className="pt-4 border-t border-slate-200/80 space-y-2">
                  {etapa.itens.map((it, iIdx) => (
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

      {/* 6. TABELA COMPARATIVA */}
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

      {/* 7. PRÉ-LANÇAMENTO EM BREVE (SEM EXIBIÇÃO DE VALORES POR ENQUANTO) */}
      <section id="pre-lancamento" className="w-full bg-white py-20 lg:py-28 px-6 lg:px-12 border-b border-slate-200">
        <div className="max-w-5xl mx-auto rounded-3xl border border-slate-200 bg-gradient-to-br from-[#F8FAFC] via-white to-orange-50/40 p-8 sm:p-12 lg:p-14 shadow-lg text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0A2540] text-white text-xs font-black uppercase tracking-widest">
            Pré-Lançamento • Em Breve
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0A2540] tracking-tight max-w-3xl mx-auto">
            Prepare sua empresa para entrar na frente nas próximas licitações
          </h2>

          <p className="text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Estamos finalizando a abertura oficial dos planos comerciais. Quem se cadastrar agora no pré-lançamento já garante acesso antecipado para organizar certidões, acompanhar editais do seu ramo e testar a plataforma na prática.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-left max-w-3xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black text-[#0A2540] uppercase tracking-wider">1. Radar & Prazos</p>
              <p className="text-xs text-slate-600 mt-1">Monitoramento diário dos editais e datas limites sem perder nenhuma oportunidade.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black text-[#0A2540] uppercase tracking-wider">2. Guia Passo a Passo</p>
              <p className="text-xs text-slate-600 mt-1">Assistente presente em todas as telas mostrando exatamente o que fazer a seguir.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black text-[#0A2540] uppercase tracking-wider">3. Lucro Protegido</p>
              <p className="text-xs text-slate-600 mt-1">Planilha prática de custos e trava mínima para disputar pregões com tranquilidade.</p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] text-white text-sm font-black uppercase tracking-widest px-8 py-4 shadow-[0_10px_24px_rgba(234,88,12,0.28)] transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Entrar no Pré-Lançamento</span>
              <ArrowRight weight="bold" className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto rounded-xl border-2 border-[#0A2540] text-[#0A2540] hover:bg-slate-50 text-xs font-black uppercase tracking-wider px-8 py-4 transition-colors cursor-pointer"
            >
              Já tenho acesso
            </button>
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
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-bold text-[#0A2540] pr-4">{faq.q}</span>
                  <CaretDown
                    weight="bold"
                    className={`w-5 h-5 text-slate-500 transition-transform duration-200 shrink-0 ${activeFaq === idx ? 'rotate-180 text-[#EA580C]' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
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
              type="button"
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl bg-[#EA580C] hover:bg-[#d94e08] active:bg-[#c2410c] text-white text-sm font-black uppercase tracking-widest px-10 py-5 shadow-[0_12px_28px_rgba(234,88,12,0.35)] transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Cadastrar Minha Empresa Agora</span>
              <CaretRight weight="bold" className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-blue-800 bg-blue-900/60 hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider px-8 py-5 transition-colors cursor-pointer"
            >
              <span>Já Tenho Uma Conta</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 font-medium pt-2">
            Ativação imediata. Sem carência e sem taxas escondidas.
          </p>
        </div>
      </section>

      {/* 10. RODAPÉ */}
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
            <a href="#pre-lancamento" className="hover:text-[#EA580C] transition-colors">Pré-Lançamento</a>
            <button type="button" onClick={() => navigate('/termos-de-uso')} className="hover:text-[#EA580C] transition-colors cursor-pointer">Termos de Uso</button>
            <button type="button" onClick={() => navigate('/politica-privacidade')} className="hover:text-[#EA580C] transition-colors cursor-pointer">Política de Privacidade</button>
          </div>

          <p className="text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}