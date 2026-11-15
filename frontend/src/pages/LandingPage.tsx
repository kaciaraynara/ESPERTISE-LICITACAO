import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Search,
  FileText,
  ShieldCheck,
  Calculator,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Check,
  X,
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const painPoints = [
    {
      title: 'Perder a licitação por certidão vencida',
      desc: 'Sua empresa gasta dias preparando a proposta e, na hora da habilitação, descobre que uma certidão expirou. A desclassificação é imediata e sem chance de recurso.',
      solucao: 'Acompanhamento preventivo que avisa com antecedência a data de renovação de todas as certidões federais, estaduais, municipais, FGTS e CNDT.',
    },
    {
      title: 'Perder prazos curtos para impugnar editais com exigências ilegais',
      desc: 'O edital traz exigências que barram a sua empresa. A Lei 14.133/2021 estabelece prazo rígido de 3 dias úteis antes da abertura para pedir correção. Quando você percebe, o prazo já passou.',
      solucao: 'Destaque visual automático das datas limites de esclarecimento, impugnação e sessão pública no horário oficial de Brasília.',
    },
    {
      title: 'Disputar na emoção da sala de lances e fechar no prejuízo',
      desc: 'No calor da disputa, o preço vai caindo para vencer o concorrente. O contrato é assinado, mas depois os custos não fecham e a sua empresa amarga prejuízo.',
      solucao: 'Proteção de margem mínima calculada antes da sessão, impedindo o envio de lances abaixo do custo seguro.',
    },
    {
      title: 'Passar horas lendo editais compridos para ver que não compensa',
      desc: 'Sua equipe perde tempo valioso lendo arquivos de 150 páginas para só no final descobrir uma exigência impeditiva ou orçamento incompatível.',
      solucao: 'Resumo estruturado direto ao ponto com objeto, valor estimado real, documentos de habilitação e pontos de atenção críticos.',
    },
  ];

  const etapasPrincipais = [
    {
      numero: '01',
      icon: Search,
      titulo: 'Radar Oficial PNCP e Compras.gov.br',
      subtitulo: 'Apenas oportunidades compatíveis com seu CNAE',
      desc: 'Captação diária de compras públicas abertas em órgãos federais, estaduais e municipais de todo o Brasil, filtradas pelo ramo de atividade que sua empresa realmente fornece.',
      itens: ['Conexão oficial com a Lei 14.133/2021', 'Filtro por Estado, Município e palavras-chave', 'Alertas diários de novas publicações'],
    },
    {
      numero: '02',
      icon: FileText,
      titulo: 'Resumo Estratégico & Leitor Inteligente',
      subtitulo: 'Direto aos requisitos eliminatórios',
      desc: 'Em vez de se perder em editais extensos, veja os documentos exigidos, atestados técnicos, regras de reajuste e prazos de impugnação de forma clara e objetiva.',
      itens: ['Lista exata dos documentos de habilitação', 'Destaque para exigências restritivas', 'Contagem regressiva no horário de Brasília'],
    },
    {
      numero: '03',
      icon: ShieldCheck,
      titulo: 'Controle das 5 Certidões Obrigatórias',
      subtitulo: 'Sua habilitação protegida 24 horas por dia',
      desc: 'Mantenha Contrato Social, Certidões Negativas, Balanço Patrimonial e Atestados de Capacidade Técnica centralizados em um cofre digital seguro e sempre atualizados.',
      itens: ['Painel das 5 certidões da Lei 14.133/2021', 'Alertas preventivos antes do vencimento', 'Organização por empresa e CNPJ'],
    },
    {
      numero: '04',
      icon: Calculator,
      titulo: 'Formação de Preço e Sala de Lances',
      subtitulo: 'Dispute sabendo exatamente o seu lucro',
      desc: 'Defina custos de mercadoria, tributos, frete e margem desejada. Receba a sugestão de lance inicial e trave o limite mínimo para disputar pregões com tranquilidade.',
      itens: ['Cálculo de margem de contribuição e impostos', 'Proteção de Margem contra inexequibilidade', 'Proposta readequada pronta para envio'],
    },
  ];

  const comparativo = [
    {
      criterio: 'Acompanhamento de certidões e prazos',
      manual: 'Planilhas avulsas ou conferência em cima da hora, correndo risco de inabilitação.',
      expertise: 'Painel visual com as 5 certidões obrigatórias e alertas preventivos com dias de antecedência.',
    },
    {
      criterio: 'Busca de editais e compras públicas',
      manual: 'Acessar manualmente dezenas de portais diferentes todos os dias procurando no escuro.',
      expertise: 'Editais oficiais do PNCP e Compras.gov.br reunidos e filtrados pelo que sua empresa vende.',
    },
    {
      criterio: 'Análise de exigências e riscos',
      manual: 'Leitura manual de centenas de páginas em PDFs escaneados com alto risco de passar batido.',
      expertise: 'Resumo imediato dos documentos pedidos, atestados exigidos e prazos de impugnação.',
    },
    {
      criterio: 'Preço na sala de disputa',
      manual: 'Dar lances na emoção para vencer e depois descobrir que o valor não cobre os custos.',
      expertise: 'Planilha técnica com margem de segurança e proteção de margem de lucro.',
    },
  ];

  const faqs = [
    {
      q: 'Como a Expertise Licitatória me ajuda a não perder prazos de certidões?',
      a: 'Você cadastra os documentos da sua empresa uma única vez. A plataforma monitora continuamente a validade das 5 certidões obrigatórias da Lei 14.133/2021 (Federal/INSS, FGTS, Trabalhista CNDT, Estadual e Municipal) e emite alertas visuais com antecedência para que você renove os documentos antes de qualquer sessão.',
    },
    {
      q: 'De onde vêm os editais e oportunidades exibidos?',
      a: 'Buscamos as compras públicas diretamente das fontes oficiais do governo, com integração direta ao Portal Nacional de Contratações Públicas (PNCP) e Compras.gov.br sob as diretrizes da Nova Lei de Licitações (Lei 14.133/2021).',
    },
    {
      q: 'Como funciona a proteção de margem mínima?',
      a: 'Antes de entrar na sala de disputa, você informa o custo de aquisição do produto ou prestação do serviço, impostos aplicáveis e despesas com frete. O sistema calcula a sua margem mínima e define o valor de corte seguro, alertando caso algum lance ameace a saúde financeira da sua empresa.',
    },
    {
      q: 'A plataforma cobra comissão sobre as licitações que minha empresa vencer?',
      a: 'Não. A Expertise Licitatória nunca cobra nenhuma comissão ou percentual sobre os contratos ou itens que sua empresa conquistar. Todo o lucro e o faturamento do contrato são 100% da sua empresa.',
    },
    {
      q: 'A plataforma serve para quem está começando agora a vender para o governo?',
      a: 'Sim. A plataforma foi construída em linguagem clara e estruturada, sem jargões confusos. A assistente Luli orienta em cada etapa da jornada: da escolha da oportunidade à conferência de documentos e formação de preços.',
    },
    {
      q: 'Posso cadastrar mais de um CNPJ ou filial na mesma conta?',
      a: 'Sim. Você pode alternar facilmente entre matriz e filiais ou cadastrar diferentes CNPJs, mantendo os documentos, certidões e histórico de cada empresa organizados de forma independente.',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white font-sans text-[#081C3A] antialiased selection:bg-[#0070C0] selection:text-white">
      {/* 1. TOPO OFICIAL GOV.BR / PNCP */}
      <div className="w-full bg-[#081C3A] px-4 py-2 text-xs font-medium text-white border-b border-blue-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#FF6600] animate-pulse" />
            <span className="font-extrabold tracking-wide text-white">EXPERTISE LICITATÓRIA</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-300">Conectado ao PNCP e Compras.gov.br (Lei 14.133/2021)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-[#FF6600]" />
              Ambiente Seguro • Dados e Documentos Protegidos
            </span>
          </div>
        </div>
      </div>

      {/* 2. CABEÇALHO PRINCIPAL NAVEGÁVEL */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
          <Link to="/" className="flex items-center gap-3 py-2 cursor-pointer">
            <img
              src="/assets/logo.png"
              alt="Expertise Licitatória"
              className="h-10 sm:h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.src = '/logo.png';
              }}
            />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-[#081C3A]">
                EXPERTISE LICITATÓRIA
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6600]">
                Especialidade em Vencer Licitações
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-700">
            <a href="#como-funciona" className="transition hover:text-[#0070C0]">
              Como funciona
            </a>
            <a href="#solucoes" className="transition hover:text-[#0070C0]">
              Soluções
            </a>
            <a href="#comparativo" className="transition hover:text-[#0070C0]">
              Comparativo
            </a>
            <a href="#academia" className="transition hover:text-[#0070C0]">
              Academia do Licitante
            </a>
            <a href="#pre-lancamento" className="transition hover:text-[#0070C0]">
              Planos
            </a>
            <a href="#duvidas" className="transition hover:text-[#0070C0]">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#081C3A] transition hover:text-[#0070C0] cursor-pointer"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate('/cadastro')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6600] px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-md transition hover:bg-[#e55b00] active:scale-95 cursor-pointer"
            >
              <span>Começar Agora</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION COM MOCKUP REAL DO NOTEBOOK (SLIDE 01 CANVA) */}
      <section className="relative w-full border-b border-slate-200 bg-[#F8FAFC] pt-12 pb-20 lg:pt-16 lg:pb-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Coluna de Texto & Proposta de Valor */}
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-[#FF6600]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Mais de 40 anos de especialidade em compras públicas</span>
              </div>

              <h1 className="text-3xl font-black tracking-tight text-[#081C3A] sm:text-4xl lg:text-5xl leading-[1.15]">
                Transforme licitações em <span className="text-[#FF6600]">oportunidades de crescimento</span> para sua empresa.
              </h1>

              <p className="max-w-2xl text-base font-medium leading-relaxed text-slate-600 sm:text-lg">
                Encontre editais com mais estratégia, acompanhe todo o processo e aumente as chances da sua empresa vencer, tudo em um só lugar.
              </p>

              {/* Barra de Busca de Oportunidades do Hero */}
              <div className="relative max-w-xl">
                <div className="flex items-center rounded-2xl border border-slate-300 bg-white p-1.5 shadow-md focus-within:border-[#0070C0] focus-within:ring-2 focus-within:ring-[#0070C0]/20">
                  <Search className="ml-3.5 h-5 w-5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        navigate(`/login?redirect=${encodeURIComponent('/fornecedor/radar?q=' + searchQuery.trim())}`);
                      }
                    }}
                    placeholder="Buscar editais, órgãos ou palavras-chave..."
                    className="w-full bg-transparent px-3 py-2 text-sm text-[#081C3A] placeholder-slate-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        navigate(`/login?redirect=${encodeURIComponent('/fornecedor/radar?q=' + searchQuery.trim())}`);
                      } else {
                        navigate('/login');
                      }
                    }}
                    className="rounded-xl bg-[#FF6600] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#e55b00] cursor-pointer shrink-0"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {/* Destaques em linha */}
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#0070C0]" />
                  <span>Aviso antes da certidão vencer</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#0070C0]" />
                  <span>Editais compatíveis com seu ramo</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#0070C0]" />
                  <span>Preço seguro com margem protegida</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#0070C0]" />
                  <span>Orientações passo a passo em cada fase</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => navigate('/cadastro')}
                  className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#FF6600] px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-[#e55b00] hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Conheça a plataforma</span>
                  <ArrowRight className="h-5 w-5" />
                </button>

                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#081C3A] shadow-sm transition hover:bg-slate-50 text-center"
                >
                  <span>Como funciona</span>
                </a>
              </div>

              <p className="text-xs font-medium text-slate-500">
                Cadastro simples e seguro. Sem cobrança de comissões sobre suas vitórias.
              </p>
            </div>

            {/* Coluna da Direita: Mockup Real do MacBook (Slide 01 Canva) */}
            <div className="relative flex flex-col items-center justify-center lg:col-span-6">
              <div className="relative w-full max-w-xl">
                <img
                  src="/assets/laptop-mockup.png"
                  alt="Plataforma Expertise Licitatória"
                  className="w-full h-auto object-contain drop-shadow-2xl transition hover:scale-[1.02] duration-300"
                />

                {/* Badge Flutuante Superior */}
                <div className="absolute -top-3 -left-2 sm:-left-4 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF6600]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-[#081C3A]">PNCP em Tempo Real</p>
                    <p className="text-[11px] text-slate-500 font-medium">Conectado à Lei 14.133/2021</p>
                  </div>
                </div>

                {/* Badge Flutuante Inferior */}
                <div className="absolute -bottom-4 -right-2 sm:-right-4 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0070C0]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-[#081C3A]">Proteção de Margem</p>
                    <p className="text-[11px] text-slate-500 font-medium">Trava de lance sem prejuízo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3.1 CARDS DE DESTAQUE DO MODELO CANVA (SLIDE 01) */}
      <section className="w-full bg-white py-12 border-b border-slate-200 px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-7 space-y-3 transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF6600] text-white shadow-sm">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-[#081C3A]">Encontre editais com mais estratégia</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Identifique oportunidades alinhadas com o perfil e o ramo da sua empresa, sem perder tempo procurando em dezenas de portais diferentes.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-7 space-y-3 transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0070C0] text-white shadow-sm">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-[#081C3A]">Conduza todo o processo em um só lugar</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Da triagem do edital até a elaboração da proposta com organização, clareza e controle rigoroso de datas e prazos.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 space-y-3 transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#081C3A] text-white shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-[#081C3A]">Mais segurança para a sua empresa</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Menos retrabalho, documentação sempre em dia e decisões bem embasadas com mais de 40 anos de especialidade em compras públicas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. O QUE RESOLVEMOS (DORES DO LICITANTE) */}
      <section id="problemas" className="w-full border-b border-slate-200 bg-white py-20 lg:py-24 px-6 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF6600] block">
              O Que Mais Prejudica as Empresas em Licitações
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#081C3A] tracking-tight">
              Você já perdeu uma licitação por algum desses motivos?
            </h2>
            <p className="text-base font-medium text-slate-600">
              Vender para o governo exige atenção a regras e prazos rígidos. A maioria das empresas perde contratos nos mesmos erros conhecidos:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {painPoints.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 space-y-3 shadow-sm transition hover:border-orange-300 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-[#FF6600]">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#081C3A]">{item.title}</h3>
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-600">{item.desc}</p>
                <div className="pt-3 border-t border-slate-200 flex items-start gap-2 text-xs font-bold text-[#081C3A]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0070C0] mt-0.5" />
                  <span>
                    Como a Expertise resolve:{' '}
                    <span className="font-normal text-slate-600">{item.solucao}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. COMO FUNCIONA NA PRÁTICA (4 ETAPAS) */}
      <section id="como-funciona" className="w-full border-b border-slate-200 bg-[#F8FAFC] py-20 lg:py-24 px-6 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-14">
          <div className="mx-auto max-w-3xl text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0070C0] block">
              Processo Completo e Descomplicado
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#081C3A] tracking-tight">
              Tudo o que sua empresa precisa em quatro etapas práticas
            </h2>
            <p className="text-base font-medium text-slate-600">
              Sem telas confusas ou jargões técnicos. Veja como a Expertise Licitatória organiza toda a sua operação:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {etapasPrincipais.map((etapa, idx) => {
              const IconComponent = etapa.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-8 space-y-5 shadow-sm transition hover:shadow-md hover:border-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#0070C0] border border-blue-100">
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#081C3A]">{etapa.titulo}</h3>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#FF6600]">
                          {etapa.subtitulo}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-2xl font-black text-slate-300">{etapa.numero}</span>
                  </div>

                  <p className="text-sm font-medium leading-relaxed text-slate-600">{etapa.desc}</p>

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    {etapa.itens.map((it, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0070C0]" />
                        <span>{it}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. TABELA COMPARATIVA (MANUAL VS EXPERTISE) */}
      <section id="comparativo" className="w-full border-b border-slate-200 bg-white py-20 lg:py-24 px-6 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="mx-auto max-w-3xl text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0070C0] block">
              Comparativo Claro
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#081C3A] tracking-tight">
              Disputar licitações no improviso vs. Com a Expertise Licitatória
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#081C3A] text-white">
                  <th className="py-4 px-6 font-bold uppercase tracking-wider text-slate-200 w-1/4">Atividade</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-wider text-slate-400 w-3/8">Fazendo Manualmente</th>
                  <th className="py-4 px-6 font-black uppercase tracking-wider text-[#FF6600] w-3/8 bg-blue-950 border-l border-blue-900">
                    Com a Expertise Licitatória
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparativo.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-4 px-6 font-bold text-[#081C3A]">{row.criterio}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      <div className="flex items-start gap-2">
                        <X className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                        <span>{row.manual}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-[#081C3A] bg-orange-50/20 border-l border-slate-200">
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 shrink-0 text-[#0070C0] mt-0.5" />
                        <span>{row.expertise}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6.1 ACADEMIA DO LICITANTE - CAPACITAÇÃO E CURSOS ABERTOS */}
      <section id="academia" className="w-full border-b border-slate-200 bg-white py-20 lg:py-24 px-6 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-[#FF6600] block">
                Capacitação Prática & Hub de Aulas
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#081C3A] tracking-tight">
                Academia do Licitante: Do Iniciante ao Avançado
              </h2>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Aprenda a vencer compras públicas com quem tem mais de 40 anos de prática jurídica e operacional. Cursos práticos, modelos de certidões grátis, impugnações e estratégias de sala de lances abertas para você se qualificar.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/cadastro')}
              className="inline-flex items-center gap-2 self-start rounded-full bg-[#081C3A] hover:bg-[#0070C0] text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <span>Acessar Cursos Gratuitos</span>
              <ArrowRight className="h-4 w-4 text-[#FF6600]" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl border border-slate-200 bg-[#F8FAFC] space-y-4 hover:border-[#0070C0]/50 transition">
              <div className="flex justify-between items-center">
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5">Iniciante</span>
                <span className="text-xs font-bold text-slate-400">8h de conteúdo</span>
              </div>
              <h3 className="text-lg font-black text-[#081C3A]">Como Emitir Todas as Certidões Grátis</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Passo a passo definitivo para emitir CND Federal, CNDT do TST, CRF da Caixa, Estadual e Municipal em poucos minutos sem gastar nada com despachantes.
              </p>
              <div className="pt-2 text-xs font-bold text-[#0070C0] flex items-center gap-1.5">
                <span>Aula aberta disponível</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 bg-[#F8FAFC] space-y-4 hover:border-[#0070C0]/50 transition">
              <div className="flex justify-between items-center">
                <span className="rounded-full bg-blue-100 text-[#0070C0] text-[10px] font-black uppercase px-2.5 py-0.5">Intermediário</span>
                <span className="text-xs font-bold text-slate-400">12h de conteúdo</span>
              </div>
              <h3 className="text-lg font-black text-[#081C3A]">Estratégia de Lances no Compras.gov.br</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Táticas reais de pregoeiros experientes nos modos aberto e aberto-fechado, regras de desempate ME/EPP e proteção de margem para não vender com prejuízo.
              </p>
              <div className="pt-2 text-xs font-bold text-[#0070C0] flex items-center gap-1.5">
                <span>Trilha completa com mentoria</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 bg-[#F8FAFC] space-y-4 hover:border-[#0070C0]/50 transition">
              <div className="flex justify-between items-center">
                <span className="rounded-full bg-orange-100 text-[#FF6600] text-[10px] font-black uppercase px-2.5 py-0.5">Avançado</span>
                <span className="text-xs font-bold text-slate-400">16h de conteúdo</span>
              </div>
              <h3 className="text-lg font-black text-[#081C3A]">Impugnações, Recursos e Súmulas do TCU</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Como anular cláusulas ilegais e restritivas no prazo de 3 dias úteis da Lei 14.133/2021 com peças jurídicas completas e fundamentadas sem terceirizar.
              </p>
              <div className="pt-2 text-xs font-bold text-[#0070C0] flex items-center gap-1.5">
                <span>Modelos práticos em PDF</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRÉ-LANÇAMENTO (SEM VALORES DE PLANOS) */}
      <section id="pre-lancamento" className="w-full border-b border-slate-200 bg-[#F8FAFC] py-20 lg:py-28 px-6 lg:px-12">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-[#F8FAFC] to-orange-50/40 p-8 sm:p-12 lg:p-14 shadow-xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#081C3A] px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
            <Sparkles className="h-3.5 w-3.5 text-[#FF6600]" />
            <span>Pré-Lançamento Oficial • Vagas Antecipadas</span>
          </div>

          <h2 className="mx-auto max-w-3xl text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#081C3A]">
            Prepare sua empresa para sair na frente nas próximas compras públicas
          </h2>

          <p className="mx-auto max-w-2xl text-base font-medium leading-relaxed text-slate-600">
            Estamos abrindo as vagas do pré-lançamento antecipado. Quem se cadastrar agora garante acesso imediato para organizar certidões, monitorar editais compatíveis e testar todas as ferramentas na prática.
          </p>

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 pt-2 text-left sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-[#081C3A]">1. Radar PNCP & Prazos</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Monitoramento diário das oportunidades oficiais e datas críticas sem perder nenhum prazo.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-[#081C3A]">2. Guia Passo a Passo</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Assistente inteligente presente em todas as telas indicando o próximo passo seguro.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-[#081C3A]">3. Margem e Lucro Seguro</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Formação técnica de preços com trava mínima de lances para proteger sua empresa.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/cadastro')}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#FF6600] px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-[#e55b00] active:scale-95 sm:w-auto cursor-pointer"
            >
              <span>Cadastrar no Pré-Lançamento</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full rounded-xl border-2 border-[#081C3A] px-8 py-4 text-xs font-black uppercase tracking-wider text-[#081C3A] transition hover:bg-slate-50 sm:w-auto cursor-pointer"
            >
              Já tenho acesso
            </button>
          </div>
        </div>
      </section>

      {/* 8. PERGUNTAS FREQUENTES (FAQ) */}
      <section id="duvidas" className="w-full border-b border-slate-200 bg-white py-20 lg:py-24 px-6 lg:px-12">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0070C0] block">
              Tire Suas Dúvidas
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#081C3A] tracking-tight">
              Perguntas Mais Comuns
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-[#F8FAFC] overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-white transition-colors cursor-pointer"
                >
                  <span className="text-sm font-bold text-[#081C3A] pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-500 transition-transform duration-200 shrink-0 ${activeFaq === idx ? 'rotate-180 text-[#0070C0]' : ''
                      }`}
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
                      <div className="p-5 sm:p-6 pt-0 border-t border-slate-200 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
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

      {/* 9. CHAMADA FINAL DE ALTO IMPACTO */}
      <section className="w-full bg-[#081C3A] text-white py-20 lg:py-24 px-6 lg:px-12 text-center relative overflow-hidden">
        <div className="mx-auto max-w-4xl space-y-7 relative z-10">
          <img
            src="/assets/mascote-3d.png"
            alt="Mascote Expertise"
            className="h-20 w-auto mx-auto object-contain drop-shadow-md mb-2"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Comece hoje a disputar licitações com segurança e organização.
          </h2>

          <p className="mx-auto max-w-2xl text-base sm:text-lg font-medium leading-relaxed text-slate-300">
            Cadastre sua empresa no pré-lançamento e tenha as melhores ferramentas para captar editais no PNCP, monitorar certidões e vencer contratos com lucro real.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/cadastro')}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#FF6600] px-10 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl transition hover:bg-[#e55b00] active:scale-95 sm:w-auto cursor-pointer"
            >
              <span>Cadastrar Minha Empresa Agora</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-900/60 px-8 py-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-900 sm:w-auto cursor-pointer"
            >
              <span>Já Tenho Uma Conta</span>
            </button>
          </div>

          <p className="pt-2 text-xs font-medium text-slate-400">
            Ativação imediata. Sem fidelidade e sem comissão sobre vitórias.
          </p>
        </div>
      </section>

      {/* 10. RODAPÉ INSTITUCIONAL */}
      <footer className="w-full border-t border-slate-200 bg-white py-10 px-6 lg:px-12 text-xs text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Expertise Licitatória"
              className="h-9 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <span className="block text-sm font-black tracking-tight text-[#081C3A]">
                EXPERTISE LICITATÓRIA
              </span>
              <span className="block text-[10px] font-medium text-slate-400">
                Plataforma de Gestão em Compras Públicas • Lei 14.133/2021
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <a href="#problemas" className="transition hover:text-[#0070C0]">
              O que resolvemos
            </a>
            <a href="#como-funciona" className="transition hover:text-[#0070C0]">
              Como funciona
            </a>
            <a href="#pre-lancamento" className="transition hover:text-[#0070C0]">
              Pré-Lançamento
            </a>
            <Link to="/termos" className="transition hover:text-[#0070C0]">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="transition hover:text-[#0070C0]">
              Política de Privacidade
            </Link>
          </div>

          <p className="font-medium text-slate-400">
            &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
