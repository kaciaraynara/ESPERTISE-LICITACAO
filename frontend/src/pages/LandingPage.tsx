import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Target,
  Settings,
  ShieldCheck,
  Search,
  FileText,
  Bell,
  CheckCircle2,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#081C3A]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Expertise Licitatória"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-lg font-extrabold tracking-tight text-[#081C3A]">
              EXPERTISE LICITATÓRIA
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#inicio" className="text-[#081C3A] underline decoration-[#FF6600] decoration-2 underline-offset-8">
              Início
            </a>
            <a href="#solucoes" className="hover:text-[#0070C0]">Soluções</a>
            <a href="#como-funciona" className="hover:text-[#0070C0]">Como funciona</a>
            <a href="#vantagens" className="hover:text-[#0070C0]">Vantagens</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-bold text-[#081C3A] hover:bg-slate-100">
              Entrar
            </Link>
            <Link to="/register" className="rounded-xl bg-[#FF6600] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]">
              Conheça a plataforma
            </Link>
          </div>
        </div>
      </header>

      <section id="inicio" className="mx-auto max-w-7xl px-4 py-14 sm:px-8 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-[#0070C0]">
              Pré-Lançamento Oficial • Vagas Antecipadas
            </span>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[#081C3A] sm:text-5xl">
              Transforme licitações em oportunidades de crescimento
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              Encontre editais compatíveis com sua empresa, acompanhe prazos e certidões em um só lugar e dispute contratos com segurança.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#FF6600] px-7 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]">
                Criar conta gratuita
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-[#081C3A] transition hover:border-[#0070C0]">
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between bg-[#081C3A] px-5 py-3 text-white">
                <span className="text-xs font-bold">Painel da Empresa</span>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  Base Nacional Conectada
                </span>
              </div>

              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-[#081C3A]">Olá, sua empresa!</p>
                    <p className="text-xs text-slate-500">Resumo diário das suas oportunidades</p>
                  </div>
                  <span className="rounded-full bg-[#FF6600] px-3 py-1 text-xs font-bold text-white">
                    Buscar editais
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-3.5">
                    <FileText className="h-5 w-5 text-[#0070C0]" />
                    <p className="mt-2 text-xs font-bold text-[#081C3A]">Editais</p>
                    <p className="text-[11px] text-slate-500">Filtrados pelo seu ramo</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-3.5">
                    <Search className="h-5 w-5 text-[#0070C0]" />
                    <p className="mt-2 text-xs font-bold text-[#081C3A]">Disputas</p>
                    <p className="text-[11px] text-slate-500">Etapas organizadas</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-3.5">
                    <Bell className="h-5 w-5 text-[#FF6600]" />
                    <p className="mt-2 text-xs font-bold text-[#081C3A]">Alertas</p>
                    <p className="text-[11px] text-slate-500">Prazos e certidões</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-[#081C3A]">
                    <span>Oportunidade em destaque</span>
                    <span className="text-emerald-600">Alta viabilidade</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Acompanhe valores, datas de sessão e documentos exigidos antes de enviar sua proposta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solucoes" className="border-t border-slate-200/80 bg-white py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-8 md:grid-cols-3">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6600]">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#081C3A]">Encontre editais com estratégia</h3>
              <p className="mt-1 text-sm text-slate-600">
                Filtros diretos para identificar oportunidades reais para o ramo da sua empresa.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0070C0]">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#081C3A]">Conduza tudo em um só lugar</h3>
              <p className="mt-1 text-sm text-slate-600">
                Organize propostas, fornecedores, prazos e etapas da disputa com clareza.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#081C3A]">Mais segurança para sua empresa</h3>
              <p className="mt-1 text-sm text-slate-600">
                Certidões monitoradas e preço mínimo protegido para não vender com prejuízo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-14 sm:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-[#081C3A] sm:text-3xl">
            Do cadastro à disputa em 4 passos simples
          </h2>
        </div>

        <div id="vantagens" className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '1', t: 'Cadastre pelo CNPJ', d: 'Os dados e o ramo da sua empresa são preenchidos na hora.' },
            { n: '2', t: 'Receba editais do seu setor', d: 'Veja oportunidades filtradas com escore de viabilidade.' },
            { n: '3', t: 'Monte sua proposta', d: 'Defina seu preço mínimo seguro e gere o documento em PDF.' },
            { n: '4', t: 'Dispute com controle', d: 'Acompanhe prazos, certidões e recursos sem perder datas.' },
          ].map((item) => (
            <div key={item.n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0070C0] text-xs font-bold text-white">
                {item.n}
              </div>
              <h3 className="mt-4 text-base font-extrabold text-[#081C3A]">{item.t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{item.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-3xl bg-[#081C3A] p-8 text-white md:flex-row">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-300">
              <CheckCircle2 className="h-4 w-4" />
              Pronto para começar hoje
            </div>
            <h3 className="text-2xl font-extrabold">Comece a organizar suas licitações agora</h3>
          </div>
          <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#FF6600] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#e55b00]">
            Cadastrar minha empresa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
