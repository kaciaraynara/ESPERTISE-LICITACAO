import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileStack,
  FolderSearch,
  Layers,
  ListChecks,
  Menu,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';

const BENEFITS = [
  {
    Icon: Target,
    title: 'Encontre oportunidades para sua empresa',
    text: 'Reúna as compras do governo que combinam com o seu negócio.',
  },
  {
    Icon: Settings2,
    title: 'Acompanhe tudo em um só lugar',
    text: 'Organize informações e acompanhe cada etapa com mais clareza.',
  },
  {
    Icon: ShieldCheck,
    title: 'Decida com mais confiança',
    text: 'Confira os detalhes antes de escolher quais oportunidades seguir.',
  },
];

const PROBLEMS = [
  {
    Icon: Search,
    title: 'Encontrar oportunidades',
    text: 'Facilite a busca por processos que possam interessar à sua empresa.',
  },
  {
    Icon: FileStack,
    title: 'Entender as informações',
    text: 'Consulte os detalhes sem começar sua pesquisa do zero a cada oportunidade.',
  },
  {
    Icon: Layers,
    title: 'Organizar a rotina',
    text: 'Tenha mais clareza ao acompanhar as informações importantes dos processos.',
  },
  {
    Icon: FolderSearch,
    title: 'Perceber pontos de atenção',
    text: 'Note detalhes que merecem um olhar cuidadoso antes de decidir.',
  },
];

const STEPS = [
  {
    Icon: Search,
    title: 'Encontre',
    text: 'Busque oportunidades de licitação usando a busca e os filtros por ramo e estado.',
    visual: ['Busca por palavra-chave', 'Filtro pelo seu ramo', 'Filtro por estado'],
  },
  {
    Icon: Scale,
    title: 'Consulte',
    text: 'Veja as informações do processo e entenda os principais detalhes com a Luli.',
    visual: ['Objeto da compra', 'Prazos de envio e disputa', 'Exigências de habilitação'],
  },
  {
    Icon: ClipboardCheck,
    title: 'Analise',
    text: 'Observe os pontos importantes e identifique o que precisa ser conferido com cuidado.',
    visual: ['Certidões verificadas', 'Fornecedores cotados', 'Margem protegida'],
  },
  {
    Icon: ListChecks,
    title: 'Decida',
    text: 'Use as informações reais para disputar com segurança e gerar sua proposta oficial.',
    visual: ['Proposta em PDF', 'Disputa organizada', 'Pós-vitória e contratos'],
  },
];

const FAQS = [
  {
    q: 'Como a Expertise Licitatória ajuda a não perder prazos e certidões?',
    a: 'O sistema acompanha suas certidões e as datas de cada licitação salva, avisando com antecedência para você não ser pego de surpresa.',
  },
  {
    q: 'Posso cadastrar mais de uma empresa ou CNPJ na mesma conta?',
    a: 'Sim. Você pode gerenciar suas empresas e alternar entre elas com um clique no topo da plataforma.',
  },
  {
    q: 'Como funciona o apoio da Assistente Luli?',
    a: 'A Luli orienta você passo a passo dentro de cada tela, explicando prazos, documentos e detalhes do edital em linguagem simples.',
  },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [autoStep, setAutoStep] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!autoStep) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [autoStep]);

  const currentStep = STEPS[activeStep];

  return (
    <div className="min-h-screen bg-white text-[#081C3A]">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Expertise Licitatória"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-base font-extrabold tracking-tight text-[#081C3A]">
              EXPERTISE LICITATÓRIA
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#081C3A] lg:flex">
            <a href="#inicio" className="hover:text-[#0070C0]">Início</a>
            <a href="#solucoes" className="hover:text-[#0070C0]">Soluções</a>
            <a href="#como-funciona" className="hover:text-[#0070C0]">Como funciona</a>
            <a href="#pre-lancamento" className="hover:text-[#0070C0]">Pré-lançamento</a>
            <a href="#duvidas" className="hover:text-[#0070C0]">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              to="/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-bold text-[#081C3A] hover:bg-slate-100 sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6600] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
            >
              Entrar na plataforma
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-2 text-[#081C3A] lg:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-100 bg-white px-5 pb-5 lg:hidden">
            {[
              { href: '#inicio', label: 'Início' },
              { href: '#solucoes', label: 'Soluções' },
              { href: '#como-funciona', label: 'Como funciona' },
              { href: '#pre-lancamento', label: 'Pré-lançamento' },
              { href: '#duvidas', label: 'Dúvidas' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block border-b border-slate-100 py-3 text-sm font-semibold text-[#081C3A]"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-4 flex gap-2">
              <Link to="/login" className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-bold text-[#081C3A]">
                Entrar
              </Link>
              <Link to="/register" className="flex-1 rounded-xl bg-[#FF6600] py-2.5 text-center text-sm font-bold text-white">
                Criar conta
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Hero com a imagem oficial do Lovable */}
      <section id="inicio" className="relative min-h-[520px] overflow-hidden bg-[#F4F7FB]">
        <img
          src="/assets/platform-scene.jpg"
          alt="Plataforma Expertise Licitatória em computador e celular"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F4F7FB] via-[#F4F7FB]/90 to-transparent lg:via-[#F4F7FB]/70" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <div className="max-w-lg">
            <p className="mb-3 text-sm font-bold text-[#0070C0]">Expertise Licitatória</p>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-[#081C3A] lg:text-5xl">
              Transforme licitações em oportunidades de crescimento
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Encontre compras do governo, acompanhe oportunidades e organize o trabalho da sua empresa em um só lugar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6600] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
              >
                Conhecer a plataforma
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-[#081C3A] transition hover:border-[#0070C0]"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Faixa dos 3 Benefícios */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:grid-cols-3">
          {BENEFITS.map(({ Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4 md:border-r md:border-slate-100 md:pr-6 last:border-0">
              <Icon className="mt-1 h-8 w-8 shrink-0 text-[#FF6600]" strokeWidth={1.7} />
              <div>
                <h2 className="text-base font-bold leading-snug text-[#081C3A]">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* O Desafio */}
      <section id="solucoes" className="bg-[#F8FAFC] py-16">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#0070C0]">O desafio</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-extrabold text-[#081C3A] sm:text-4xl">
            Quem trabalha com licitações conhece essa rotina
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p) => (
              <article
                key={p.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1"
              >
                <p.Icon className="h-7 w-7 text-[#0070C0]" />
                <h3 className="mt-4 text-lg font-bold text-[#081C3A]">{p.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{p.text}</p>
              </article>
            ))}
          </div>

          <p className="mx-auto mt-12 max-w-3xl text-center text-xl font-medium leading-relaxed text-[#081C3A] md:text-2xl">
            <span className="font-bold text-[#0070C0]">Mais clareza</span> para analisar oportunidades.{' '}
            <span className="font-bold text-[#FF6600]">Mais organização</span> para decidir os próximos passos.
          </p>
        </div>
      </section>

      {/* Como Funciona (4 passos interativos) */}
      <section id="como-funciona" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#0070C0]">Como funciona</p>
          <h2 className="mt-2 text-3xl font-extrabold text-[#081C3A] sm:text-4xl">
            Quatro passos para uma rotina mais clara
          </h2>

          <div className="mt-12">
            <div className="relative grid grid-cols-4 gap-2">
              <div className="absolute left-[12.5%] right-[12.5%] top-7 h-1 rounded bg-slate-200" />
              <div
                className="absolute left-[12.5%] top-7 h-1 rounded bg-[#FF6600] transition-all duration-500"
                style={{ width: `${(activeStep / 3) * 75}%` }}
              />
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => {
                    setActiveStep(i);
                    setAutoStep(false);
                  }}
                  className="relative flex flex-col items-center gap-2 text-center"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full border-4 border-white transition-colors ${
                      i <= activeStep ? 'bg-[#081C3A] text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <s.Icon className="h-6 w-6" />
                  </span>
                  <span
                    className={`text-sm font-extrabold uppercase md:text-lg ${
                      i === activeStep ? 'text-[#FF6600]' : 'text-[#081C3A]'
                    }`}
                  >
                    {i + 1}. {s.title}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-10 grid items-center gap-8 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 md:grid-cols-2 md:p-10">
              <div>
                <h3 className="text-2xl font-extrabold uppercase text-[#081C3A]">{currentStep.title}</h3>
                <p className="mt-3 text-base text-slate-600">{currentStep.text}</p>
              </div>
              <div className="grid gap-2.5">
                {currentStep.visual.map((v, idx) => (
                  <div key={v} className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${idx === 0 ? 'bg-[#FF6600]' : 'bg-[#0070C0]'}`} />
                    <span className="text-sm font-semibold text-[#081C3A]">{v}</span>
                    <Check className="ml-auto h-4 w-4 text-emerald-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pré-Lançamento (sem exposição de preços) */}
      <section id="pre-lancamento" className="bg-[#F8FAFC] py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <span className="inline-flex rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-[#0070C0]">
                  Pré-Lançamento • Em Breve
                </span>
                <h2 className="mt-3 text-3xl font-extrabold text-[#081C3A]">
                  Prepare sua empresa para entrar na frente nas próximas licitações
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Cadastre sua empresa gratuitamente durante o pré-lançamento para testar o Radar de Editais, organizar suas certidões e montar propostas com apoio da Assistente Luli.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6600] px-7 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
                >
                  Cadastrar minha empresa
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-[#081C3A] hover:border-[#0070C0]"
                >
                  Já tenho acesso
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-5">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-[#0070C0]">Dúvidas comuns</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-[#081C3A]">Perguntas frequentes</h2>

          <div className="mt-8 space-y-3">
            {FAQS.map((item, idx) => {
              const aberto = openFaq === idx;
              return (
                <div key={item.q} className="rounded-2xl border border-slate-200 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(aberto ? null : idx)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-[#081C3A]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                  </button>
                  {aberto && <p className="px-5 pb-4 text-sm text-slate-600">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-[#081C3A] py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-slate-300 sm:flex-row">
          <span className="font-bold text-white">EXPERTISE LICITATÓRIA</span>
          <span>© {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
