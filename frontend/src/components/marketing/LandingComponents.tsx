import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  LockKey,
  Robot,
  FileText,
  Calculator,
  CaretDown,
  CaretUp,
  Target,
  MagnifyingGlass,
  ChartLineUp,
  Briefcase,
  Gavel
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import BrandLogo from '@components/brand/BrandLogo';

const PLATFORM_PLANS = [
  {
    id: 'basic',
    nome: 'Básico',
    preco: '69,99',
    descricao: 'Para empresas iniciantes que precisam de organização e alertas básicos.',
    features: [
      '1 empresa cadastrada',
      'Até 10 editais monitorados',
      '3 análises de edital por mês',
      'Busca de Editais',
      'Acervo de Documentos',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: '149,99',
    destaque: true,
    descricao: 'Para negócios que participam de licitações com frequência e buscam crescimento.',
    features: [
      'Até 5 empresas',
      'Até 50 editais monitorados',
      '30 análises de edital por mês',
      'Análise de Oportunidade',
      'Precificação Automatizada',
    ],
  },
  {
    id: 'master',
    nome: 'Master',
    preco: '249,99',
    descricao: 'Para operações avançadas que precisam de relatórios profundos e análise de mercado.',
    features: [
      'Até 10 empresas',
      'Até 200 editais monitorados',
      '100 análises de edital por mês',
      'Investigação de Concorrentes',
      'Relatórios Estratégicos',
    ],
  },
];

const FAQS = [
  {
    question: "O sistema participa dos lances automaticamente por mim?",
    answer: "Não. A Expertise Licitatória não retira o seu controle. Nós fornecemos os dados precisos, a leitura inteligente do edital e a organização dos seus documentos para que você dê o seu lance com segurança e certeza do seu lucro."
  },
  {
    question: "Como funciona a leitura inteligente de editais?",
    answer: "Nosso sistema cruza o texto do edital com as leis atuais e regras do TCU. Se o edital pedir um documento proibido ou tentar restringir a competição, a plataforma avisa você imediatamente para que seja possível pedir a correção."
  },
  {
    question: "Os dados das licitações são confiáveis?",
    answer: "Sim. A nossa plataforma é conectada diretamente aos portais oficiais do governo, como o PNCP. Você recebe os dados oficiais e em tempo real."
  },
  {
    question: "Meus documentos ficam seguros no sistema?",
    answer: "Completamente seguros. Usamos tecnologias de proteção avançadas e criptografia. Só você e sua equipe têm acesso aos arquivos. Trabalhamos seguindo todas as regras da LGPD."
  }
];

const FULL_FEATURES = [
  { icon: MagnifyingGlass, title: "Busca Oficial", desc: "Varredura contínua e oficial diretamente do PNCP." },
  { icon: ShieldCheck, title: "Auditoria IA", desc: "Aponta falhas e exigências abusivas nos editais em segundos." },
  { icon: LockKey, title: "Acervo Seguro", desc: "Controle de validade de certidões com alertas automáticos." },
  { icon: ChartLineUp, title: "Viabilidade", desc: "Algoritmo que indica se a disputa é favorável ao seu negócio." },
  { icon: Calculator, title: "Preço Exato", desc: "Calculadora de margem para garantir contratos lucrativos." },
  { icon: Gavel, title: "Base Jurídica", desc: "Modelos dinâmicos para questionar editais direcionados." },
  { icon: Briefcase, title: "Multi-CNPJ", desc: "Gerencie a documentação de várias empresas na mesma tela." },
  { icon: Robot, title: "Propostas Automáticas", desc: "Geração de propostas comerciais sem digitação repetitiva." },
];

function Accordion({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-6 text-left focus:outline-none group"
      >
        <h4 className="text-xl font-black text-slate-900 group-hover:text-brand-orange transition-colors uppercase tracking-tight">{question}</h4>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isOpen ? 'border-brand-orange bg-brand-orange text-white' : 'border-slate-900 text-slate-900 group-hover:border-brand-orange group-hover:text-brand-orange'}`}>
          {isOpen ? <CaretUp className="h-5 w-5" weight="bold" /> : <CaretDown className="h-5 w-5" weight="bold" />}
        </div>
      </button>
      {isOpen && (
        <div className="pb-8 pr-12 text-slate-600 text-lg leading-relaxed font-medium">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans scroll-smooth selection:bg-brand-blue selection:text-white">

      {/* INJEÇÃO DE CSS PARA A ANIMAÇÃO DO MARQUEE (PADRÃO FIAP) */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
          display: flex;
          width: max-content;
        }
        .text-outline {
          -webkit-text-stroke: 1px rgba(255,255,255,0.2);
          color: transparent;
        }
      `}</style>

      {/* HEADER MINIMALISTA E SÓLIDO */}
      <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-slate-900 bg-white" aria-label="Cabeçalho">
        <div className="mx-auto flex h-20 w-full items-center justify-between px-6 md:px-12">

          <Link to="/" className="flex items-center gap-3 group">
            <BrandLogo imageClassName="h-10 w-10 object-contain grayscale group-hover:grayscale-0 transition-all duration-300" />
            <span className="flex flex-col">
              <span className="block text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">
                EXPERTISE
              </span>
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange mt-1">
                Licitatória
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-10 text-sm font-black uppercase tracking-widest text-slate-900 md:flex">
            <a className="transition hover:text-brand-orange" href="#tecnologia">Tecnologia</a>
            <a className="transition hover:text-brand-orange" href="#estrutura">Estrutura</a>
            <a className="transition hover:text-brand-orange" href="#planos">Acesso</a>
          </nav>

          <div className="flex items-center gap-6">
            <Link to="/login" className="hidden text-sm font-black uppercase tracking-widest text-slate-900 transition hover:text-brand-orange sm:block">
              Entrar
            </Link>
            <Link to="/register" className="inline-flex items-center gap-2 bg-brand-orange px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-slate-900">
              Criar Conta
              <ArrowRight className="hidden h-4 w-4 sm:block" weight="bold" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="pt-20">

        {/* HERO SECTION - TIPOGRAFIA MONUMENTAL E ALTO CONTRASTE */}
        <section className="relative overflow-hidden bg-brand-blue pt-20 pb-0 flex flex-col items-center border-b-8 border-brand-orange">

          {/* TEXTO DE FUNDO GIGANTE (EFEITO EDITORIAL) */}
          <div className="absolute top-10 left-0 w-full overflow-hidden pointer-events-none flex justify-center opacity-20">
            <h1 className="text-[12vw] font-black uppercase text-white leading-none tracking-tighter whitespace-nowrap">
              PERFORMANCE
            </h1>
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-6 text-center mt-12 sm:mt-24">

            <div className="mb-8 inline-flex items-center gap-2 border border-brand-orange/30 bg-brand-orange/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand-orange">
              Inteligência B2G
            </div>

            <h2 className="max-w-5xl text-5xl font-black uppercase leading-[0.95] tracking-tighter text-white sm:text-7xl lg:text-8xl">
              PRECISÃO EM <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-[#ff985c]">LICITAÇÕES</span>
            </h2>

            <p className="mt-10 max-w-2xl text-xl leading-relaxed text-blue-100 font-medium">
              A arquitetura tecnológica desenvolvida para estruturar seus documentos, auditar editais públicos e garantir lucratividade em cada contrato.
            </p>

            <div className="mt-12 mb-20 flex w-full flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex min-h-[64px] items-center justify-center gap-3 bg-brand-orange px-12 py-4 text-lg font-black uppercase tracking-wider text-white transition hover:bg-white hover:text-slate-900"
              >
                Acessar Plataforma
                <ArrowRight className="h-6 w-6" weight="bold" />
              </Link>
            </div>

            {/* CONTAINER DA INTERFACE - ESTILO CORTADO E TECH */}
            <div className="w-full max-w-6xl border-t-4 border-x-4 border-slate-800 bg-slate-900 p-2 relative z-10 translate-y-12">
              <div className="flex items-center gap-2 bg-slate-900 p-3 pb-4">
                <div className="h-3 w-3 rounded-full bg-slate-700"></div>
                <div className="h-3 w-3 rounded-full bg-slate-700"></div>
                <div className="h-3 w-3 rounded-full bg-slate-700"></div>
              </div>
              <div className="overflow-hidden bg-slate-50 border border-slate-800">
                <img
                  src="/sua-captura-de-tela.png"
                  alt="Interface da Plataforma Expertise"
                  className="w-full h-auto object-cover block opacity-90 hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAIXA MARQUEE (MOVIMENTO CONSTANTE) */}
        <div className="bg-brand-orange py-4 overflow-hidden border-b-4 border-slate-900 flex items-center">
          <div className="animate-marquee flex gap-12 items-center">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-12">
                <span className="text-2xl font-black uppercase tracking-widest text-slate-900">RADAR PNCP</span>
                <span className="text-2xl font-black uppercase tracking-widest text-white">AUDITORIA IA</span>
                <span className="text-2xl font-black uppercase tracking-widest text-slate-900">ACERVO DIGITAL</span>
                <span className="text-2xl font-black uppercase tracking-widest text-white">PRECIFICAÇÃO</span>
              </div>
            ))}
          </div>
        </div>

        {/* SEÇÃO 2: O PROBLEMA COM TIPOGRAFIA FORTE */}
        <section className="bg-white py-32 border-b-2 border-slate-200">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="grid lg:grid-cols-12 gap-16">
              <div className="lg:col-span-5">
                <h2 className="text-4xl font-black uppercase leading-tight tracking-tighter text-slate-900 sm:text-6xl">
                  A OPERAÇÃO <br /> INVISÍVEL
                </h2>
                <p className="mt-8 text-xl text-slate-600 font-medium leading-relaxed">
                  A maioria das empresas é desclassificada antes mesmo da fase de lances devido a falhas humanas em processos repetitivos.
                </p>
              </div>

              <div className="lg:col-span-7 grid gap-6 sm:grid-cols-2">
                <div className="border-2 border-slate-900 p-8 bg-slate-50">
                  <FileText className="h-10 w-10 text-brand-orange mb-6" weight="duotone" />
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Falha Documental</h3>
                  <p className="text-slate-600 font-medium">Perda de contratos milionários por certidões vencidas ou falta de documentos essenciais.</p>
                </div>
                <div className="border-2 border-slate-900 p-8 bg-slate-50">
                  <Target className="h-10 w-10 text-brand-orange mb-6" weight="duotone" />
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Editais Viciados</h3>
                  <p className="text-slate-600 font-medium">Falta de inteligência jurídica para identificar e impugnar regras que favorecem concorrentes.</p>
                </div>
                <div className="border-2 border-slate-900 p-8 bg-slate-50 sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <Calculator className="h-12 w-12 text-brand-orange shrink-0" weight="duotone" />
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Formação de Preço</h3>
                    <p className="text-slate-600 font-medium">Precificar com base em suposições gera vitórias que resultam em margens negativas.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 3: TECNOLOGIA (GRID ESTRUTURADO TIPO CURRÍCULO) */}
        <section id="tecnologia" className="bg-slate-900 py-32 text-white">
          <div className="mx-auto max-w-7xl px-6 md:px-12">

            <div className="mb-20">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl">
                ENGENHARIA DA <span className="text-brand-orange">PLATAFORMA</span>
              </h2>
            </div>

            <div className="grid lg:grid-cols-3 gap-y-16 gap-x-12">

              {/* Módulo 01 */}
              <div className="relative">
                <div className="text-8xl font-black text-white text-outline absolute -top-12 -left-4 opacity-50 z-0 select-none">01</div>
                <div className="relative z-10 pt-6 border-t-2 border-brand-orange">
                  <h3 className="text-3xl font-black uppercase tracking-tight text-white mb-6">Radar PNCP</h3>
                  <p className="text-lg text-slate-400 font-medium leading-relaxed mb-6">
                    Conexão direta com a fonte de dados oficial. Monitoramento contínuo de novas oportunidades alinhadas exatamente ao perfil do seu CNPJ.
                  </p>
                </div>
              </div>

              {/* Módulo 02 */}
              <div className="relative">
                <div className="text-8xl font-black text-white text-outline absolute -top-12 -left-4 opacity-50 z-0 select-none">02</div>
                <div className="relative z-10 pt-6 border-t-2 border-brand-orange">
                  <h3 className="text-3xl font-black uppercase tracking-tight text-white mb-6">Auditoria IA</h3>
                  <p className="text-lg text-slate-400 font-medium leading-relaxed mb-6">
                    Varredura automatizada em editais extensos. A inteligência destaca cláusulas restritivas e fornece o embasamento para impugnações imediatas.
                  </p>
                </div>
              </div>

              {/* Módulo 03 */}
              <div className="relative">
                <div className="text-8xl font-black text-white text-outline absolute -top-12 -left-4 opacity-50 z-0 select-none">03</div>
                <div className="relative z-10 pt-6 border-t-2 border-brand-orange">
                  <h3 className="text-3xl font-black uppercase tracking-tight text-white mb-6">Acervo Digital</h3>
                  <p className="text-lg text-slate-400 font-medium leading-relaxed mb-6">
                    Centralização criptografada do acervo de habilitação da empresa, com gestão inteligente e alertas preditivos de vencimento.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* SEÇÃO 4: ESTRUTURA E FERRAMENTAS COMPLETAS */}
        <section id="estrutura" className="bg-slate-50 py-32 border-b-2 border-slate-200">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="mb-16">
              <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter sm:text-6xl">
                ECOSSISTEMA COMPLETO
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {FULL_FEATURES.map((feat, idx) => (
                <div key={idx} className="bg-white p-8 border-2 border-slate-200 hover:border-slate-900 transition-colors group">
                  <feat.icon className="h-10 w-10 text-brand-orange mb-6 transition-transform group-hover:scale-110" weight="duotone" />
                  <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-3">{feat.title}</h4>
                  <p className="text-slate-600 font-medium leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÃO 5: PLANOS (ABORDAGEM DIRETA E CORPORATIVA) */}
        <section id="planos" className="bg-white py-32">
          <div className="mx-auto max-w-7xl px-6 md:px-12">

            <div className="text-center mb-20">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 sm:text-6xl">
                ACESSO À PLATAFORMA
              </h2>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {PLATFORM_PLANS.map((plano) => (
                <div
                  key={plano.id}
                  className={`relative bg-slate-50 p-10 transition-colors flex flex-col ${plano.destaque ? 'border-4 border-slate-900 bg-white' : 'border-2 border-slate-200 hover:border-slate-400'
                    }`}
                >
                  {plano.destaque && (
                    <div className="absolute -top-4 right-8 bg-brand-orange text-white px-4 py-1 text-xs font-black uppercase tracking-widest">
                      RECOMENDADO
                    </div>
                  )}

                  <h3 className="text-3xl font-black uppercase tracking-tight text-slate-900">{plano.nome}</h3>
                  <p className="mt-4 text-slate-600 font-medium min-h-[60px]">{plano.descricao}</p>

                  <div className="mt-8 pb-8 border-b-2 border-slate-200 flex items-baseline gap-2">
                    <span className="text-5xl font-black text-brand-blue tracking-tighter">R$ {plano.preco}</span>
                    <span className="text-sm font-black text-slate-400 uppercase">/mês</span>
                  </div>

                  <ul className="mt-8 space-y-4 flex-1">
                    {plano.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-4 text-slate-900 font-bold">
                        <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-brand-orange" weight="bold" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/register"
                    className={`mt-10 flex w-full items-center justify-center px-6 py-5 text-lg font-black uppercase tracking-widest transition-colors ${plano.destaque
                      ? 'bg-slate-900 text-white hover:bg-brand-orange'
                      : 'bg-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'
                      }`}
                  >
                    Selecionar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÃO 6: FAQ ESTRUTURADO */}
        <section id="faq" className="py-32 bg-slate-50 border-t-2 border-slate-200">
          <div className="mx-auto max-w-4xl px-6 md:px-12">
            <div className="mb-16">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 sm:text-6xl">Dúvidas Frequentes</h2>
            </div>
            <div className="bg-transparent">
              {FAQS.map((faq, idx) => (
                <Accordion key={idx} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA GIGANTE */}
        <section className="bg-brand-blue py-32 text-center border-t-8 border-brand-orange">
          <div className="mx-auto max-w-5xl px-6 md:px-12">
            <h2 className="text-5xl font-black uppercase leading-[0.95] tracking-tighter text-white sm:text-7xl">
              PROFISSIONALIZE <br /> SUAS DISPUTAS
            </h2>
            <div className="mt-12 flex justify-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-3 bg-brand-orange px-12 py-5 text-xl font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-slate-900"
              >
                Acessar o Ambiente
                <ArrowRight className="h-6 w-6" weight="bold" />
              </Link>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-slate-900 text-slate-400">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-12">

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10 border-b-2 border-slate-800 pb-12">
            <div className="flex items-center gap-4">
              <BrandLogo imageClassName="h-12 w-12 object-contain grayscale invert brightness-200" />
              <div>
                <p className="text-white font-black uppercase tracking-widest text-2xl leading-none">EXPERTISE</p>
                <p className="text-brand-orange font-black uppercase text-xs tracking-[0.3em] mt-1">Licitatória</p>
              </div>
            </div>

            <div className="flex gap-8 text-sm font-black uppercase tracking-widest">
              <Link to="/login" className="hover:text-white transition">Entrar</Link>
              <Link to="/register" className="hover:text-brand-orange transition">Novo Cadastro</Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between pt-8 gap-6 text-xs font-bold uppercase tracking-widest">
            <p>EXPERTISE LICITATÓRIA © {new Date().getFullYear()}. TODOS OS DIREITOS RESERVADOS.</p>
            <p className="flex items-center gap-2">
              Conformidade com a <LockKey className="h-4 w-4 text-brand-orange" weight="bold" /> LGPD
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}