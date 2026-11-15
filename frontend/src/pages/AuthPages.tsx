import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Search,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Building2,
  User,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { FORNECEDOR_ROUTES, resolveAuthenticatedHome } from '@/routes';

const INSTITUTIONAL_HIGHLIGHTS = [
  {
    icon: Search,
    title: 'Captação Oficial Integrada',
    desc: 'Oportunidades em tempo real direto do PNCP e Compras.gov.br sob as regras da Lei 14.133/2021.',
  },
  {
    icon: ShieldCheck,
    title: 'Controle das 5 Certidões Obrigatórias',
    desc: 'Monitoramento preventivo de validades das certidões de habilitação fiscal, social e trabalhista.',
  },
  {
    icon: TrendingUp,
    title: 'Preço Seguro e Margem Protegida',
    desc: 'Formação técnica de preços com trava mínima de lances para proteger sua empresa contra prejuízos.',
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo) {
      setErro('Informe o seu e-mail de acesso.');
      return;
    }

    if (!senha) {
      setErro('Digite sua senha para continuar.');
      return;
    }

    setCarregando(true);
    try {
      const response = await authApi.login({
        email: emailLimpo,
        senha,
      });

      const resData = response.data?.data || response.data;
      const user = resData?.user;
      const accessToken = resData?.accessToken || resData?.token;
      const refreshToken = resData?.refreshToken;

      if (!accessToken || !user) {
        throw new Error('Não foi possível autenticar. Verifique seus dados.');
      }

      useAuthStore.getState().setAuth(user, accessToken, refreshToken);

      if (user.company) {
        try {
          localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(user.company));
        } catch {
          // ignore localStorage errors
        }
      }

      const destino = resolveAuthenticatedHome();
      navigate(destino || FORNECEDOR_ROUTES.dashboard, { replace: true });
    } catch (err: any) {
      const msgServidor =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message;

      if (
        err?.response?.status === 401 ||
        err?.response?.data?.code === 'INVALID_CREDENTIALS' ||
        /credenciais|senha incorreta|não encontrado/i.test(msgServidor || '')
      ) {
        setErro('E-mail ou senha incorretos. Confira suas credenciais e tente novamente.');
      } else if (err?.response?.status === 400) {
        setErro('Dados de login inválidos. Certifique-se de que o e-mail e a senha estejam corretos.');
      } else if (err?.code === 'ECONNABORTED' || /network|failed to fetch/i.test(err?.message || '')) {
        setErro('Falha de conexão com os serviços da plataforma. Verifique sua conexão à internet.');
      } else {
        setErro(msgServidor || 'Não foi possível entrar. Tente novamente em alguns instantes.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#081C3A]">
            <img src="/logo.png" alt="Expertise Licitatória" className="h-8 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span>EXPERTISE LICITATÓRIA</span>
          </Link>
          <Link
            to="/cadastro"
            className="rounded-xl border border-[#0070C0] bg-white px-4 py-2 text-xs font-bold text-[#0070C0] transition hover:bg-blue-50"
          >
            Cadastrar minha empresa
          </Link>
        </header>

        <div className="mt-12 grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Coluna da Esquerda: Imagem Executiva e Apresentação do Modelo Canva (Slide 02) */}
          <div className="space-y-6 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6600]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Mais de 40 anos de especialidade</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-[#081C3A]">
              Mais oportunidades para o <span className="text-[#FF6600]">crescimento</span> da sua empresa
            </h1>

            <p className="max-w-lg text-base font-medium text-slate-600 leading-relaxed">
              Acesse sua conta para acompanhar editais oficiais no PNCP, manter certidões de habilitação sempre em dia e formular propostas com margem de lucro protegida.
            </p>

            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
              <div className="flex items-center gap-5">
                <img
                  src="/assets/hero-businesswoman.png"
                  alt="Gestão Licitatória"
                  className="h-28 w-28 rounded-2xl object-cover object-top border border-slate-200 shadow-sm shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="space-y-1.5">
                  <h3 className="text-sm font-extrabold text-[#081C3A]">Estratégia Comprovada em Licitações</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Orientação clara em todas as fases da disputa, da análise criteriosa do edital à homologação do contrato.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-[#0070C0]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Ambiente 100% em conformidade com a Lei 14.133/2021</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {INSTITUTIONAL_HIGHLIGHTS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div key={idx} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0070C0]">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#081C3A]">{item.title}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna da Direita: Card de Login do Modelo Canva (Slide 02) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl lg:col-span-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <img
                src="/logo.png"
                alt="Expertise Licitatória"
                className="h-10 w-auto object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div>
                <h2 className="text-xl font-black text-[#081C3A]">Acesse sua conta</h2>
                <p className="text-xs font-medium text-slate-500">Digite seus dados para entrar na plataforma</p>
              </div>
            </div>

            {erro && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#081C3A]">E-mail de acesso</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@suaempresa.com.br"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#0070C0] focus:ring-2 focus:ring-[#0070C0]/20"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#081C3A]">Sua senha</label>
                  <Link to="/esqueci-senha" className="text-xs font-medium text-[#0070C0] hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha cadastrada"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 text-sm outline-none transition focus:border-[#0070C0] focus:ring-2 focus:ring-[#0070C0]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={carregando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#e55b00] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {carregando ? 'Entrando na plataforma...' : 'Entrar na Plataforma'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Ainda não tem conta cadastrada?{' '}
              <Link to="/cadastro" className="font-bold text-[#0070C0] hover:underline">
                Cadastre sua empresa aqui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [telefone, setTelefone] = useState('');
  const [setor, setSetor] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('');

  const [aceite, setAceite] = useState(true);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErro('Informe um e-mail válido para acesso.');
      return;
    }
    if (!senha) {
      setErro('Por favor, crie uma senha segura para o seu acesso.');
      return;
    }
    if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      setErro('A senha deve conter no mínimo 8 caracteres, com pelo menos uma letra e um número.');
      return;
    }
    if (!confirmarSenha) {
      setErro('Por favor, confirme a sua senha digitando-a novamente.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas digitadas não coincidem. Confira e tente novamente.');
      return;
    }

    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const digitos = cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setErro('Informe um CNPJ válido com 14 dígitos para prosseguir.');
      return;
    }
    if (!razaoSocial.trim()) {
      setErro('Por favor, informe a Razão Social da empresa.');
      return;
    }

    setStep(3);
  };

  const handleBuscarCnpj = async () => {
    const digitos = cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setErro('Informe um CNPJ válido com 14 dígitos para buscar.');
      return;
    }
    setErro(null);
    setBuscandoCnpj(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!resp.ok) {
        throw new Error('CNPJ não localizado na base pública da Receita Federal.');
      }
      const dados = await resp.json();
      if (dados.razao_social) setRazaoSocial(dados.razao_social);
      if (dados.nome_fantasia) setNomeFantasia(dados.nome_fantasia);
      if (dados.ddd_telefone_1) {
        const telFormatado = `${dados.ddd_telefone_1}`.replace(/\D/g, '');
        setTelefone(telFormatado);
      }
      if (dados.cnae_fiscal_descricao) setSetor(dados.cnae_fiscal_descricao);
      if (dados.municipio) setMunicipio(dados.municipio);
      if (dados.uf) setUf(dados.uf);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível consultar os dados do CNPJ automaticamente. Você pode preenchê-los manualmente.');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!aceite) {
      setErro('É necessário concordar com os Termos de Uso e Política de Privacidade para criar sua conta.');
      return;
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanPhone = telefone.replace(/\D/g, '');

    setCarregando(true);
    try {
      const response = await authApi.register({
        nome: nome.trim(),
        apelido: apelido.trim() || undefined,
        email: email.trim().toLowerCase(),
        senha,
        cnpj: cleanCnpj,
        razao_social: razaoSocial.trim() || undefined,
        nome_fantasia: nomeFantasia.trim() || undefined,
        cnae_principal: setor.trim() || undefined,
        municipio: municipio.trim() || undefined,
        uf: uf.trim().toUpperCase() || undefined,
        telefone: cleanPhone.length >= 10 ? cleanPhone : undefined,
        aceite_lgpd: true,
        role: 'fornecedor',
      });

      const resData = response.data?.data || response.data;
      const user = resData?.user;
      const accessToken = resData?.accessToken || resData?.token;
      const refreshToken = resData?.refreshToken;

      if (accessToken && user) {
        useAuthStore.getState().setAuth(user, accessToken, refreshToken);
        if (user.company) {
          try {
            localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(user.company));
          } catch {
            // ignore
          }
        }
      }

      setStep(4);
      setTimeout(() => {
        navigate(FORNECEDOR_ROUTES.dashboard, { replace: true });
      }, 1500);
    } catch (err: any) {
      const msgServidor =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message;

      if (err?.response?.status === 409 || /já existe/i.test(msgServidor || '')) {
        setErro('Já existe uma conta cadastrada com este e-mail. Faça login ou recupere sua senha.');
      } else if (err?.response?.status === 400 && err?.response?.data?.errors) {
        const primeiroErro = err.response.data.errors[0]?.message;
        setErro(primeiroErro || 'Dados de cadastro inválidos. Confira os campos preenchidos.');
      } else {
        setErro(msgServidor || 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#081C3A]">
            <img src="/logo.png" alt="Expertise Licitatória" className="h-9 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span>EXPERTISE LICITATÓRIA</span>
          </Link>
          <Link
            to="/login"
            className="rounded-xl bg-[#0070C0] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#005ea3]"
          >
            Já tenho uma conta
          </Link>
        </header>

        <div className="mt-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          {/* Coluna da Esquerda: Informações e Vantagens */}
          <div className="space-y-6 lg:col-span-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6600]">
                <span>Mais de 40 anos de especialidade</span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#081C3A] sm:text-4xl">
                Cadastre sua empresa e comece a vencer licitações
              </h1>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed font-medium">
                Acesse oportunidades oficiais em todo o Brasil, proteja suas certidões antes do vencimento e dispute com preço seguro e margem garantida.
              </p>
            </div>

            {/* Stepper Vertical Informativo */}
            <div className="space-y-3 pt-2">
              <div className={`rounded-2xl border p-4 shadow-sm transition ${step === 1 ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2.5 text-sm font-bold text-[#081C3A]">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${step >= 1 ? 'bg-[#FF6600] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    1
                  </div>
                  <span>Etapa 1: Seus dados de acesso</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 pl-8">
                  Nome oficial para documentos e credenciais seguras para acesso diário.
                </p>
              </div>

              <div className={`rounded-2xl border p-4 shadow-sm transition ${step === 2 ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2.5 text-sm font-bold text-[#081C3A]">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${step >= 2 ? 'bg-[#FF6600] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    2
                  </div>
                  <span>Etapa 2: Dados da empresa (CNPJ)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 pl-8">
                  Preenchimento automático das informações cadastrais via base oficial.
                </p>
              </div>

              <div className={`rounded-2xl border p-4 shadow-sm transition ${step === 3 ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2.5 text-sm font-bold text-[#081C3A]">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${step >= 3 ? 'bg-[#FF6600] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    3
                  </div>
                  <span>Etapa 3: Confirmação e termos</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 pl-8">
                  Revisão clara e transparente dos seus dados antes da ativação.
                </p>
              </div>

              <div className={`rounded-2xl border p-4 shadow-sm transition ${step === 4 ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2.5 text-sm font-bold text-[#081C3A]">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${step === 4 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    4
                  </div>
                  <span>Etapa 4: Conclusão e acesso</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 pl-8">
                  Painel desbloqueado imediatamente para você iniciar suas buscas.
                </p>
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Stepper Card do Modelo Canva (Slide 03) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl lg:col-span-7">
            {/* Stepper Horizontal Header */}
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              {[
                { n: 1, label: 'Seus dados' },
                { n: 2, label: 'Empresa' },
                { n: 3, label: 'Confirmação' },
                { n: 4, label: 'Conclusão' },
              ].map((s) => (
                <div key={s.n} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                      step === s.n
                        ? 'bg-[#FF6600] text-white shadow-sm'
                        : step > s.n
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step > s.n ? '✓' : s.n}
                  </div>
                  <span
                    className={`hidden sm:inline text-xs font-bold ${
                      step === s.n ? 'text-[#081C3A]' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {erro && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{erro}</span>
              </div>
            )}

            {/* ETAPA 1: SEUS DADOS */}
            {step === 1 && (
              <form onSubmit={handleNextStep1} className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#081C3A]">1. Seus dados de acesso</h2>
                  <p className="text-xs text-slate-500">Informe seu nome oficial e credenciais para login.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                  <div className="relative sm:col-span-2">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo (oficial para documentos)"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={apelido}
                      onChange={(e) => setApelido(e.target.value)}
                      placeholder="Como prefere ser chamado(a)?"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-mail de acesso profissional"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#081C3A]">
                      Criar senha <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Digite sua senha (mínimo 8 caracteres)"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#081C3A]">
                      Confirmar senha <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type={mostrarConfirmarSenha ? 'text' : 'password'}
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                        placeholder="Digite a mesma senha novamente para confirmar"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarConfirmarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={mostrarConfirmarSenha ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {mostrarConfirmarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#e55b00] cursor-pointer"
                  >
                    <span>Continuar para dados da empresa</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ETAPA 2: EMPRESA */}
            {step === 2 && (
              <form onSubmit={handleNextStep2} className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#081C3A]">2. Dados da empresa</h2>
                  <p className="text-xs text-slate-500">Digite o CNPJ para preenchimento oficial automático.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                  <div className="flex gap-2 sm:col-span-2">
                    <div className="relative flex-1">
                      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        onBlur={() => {
                          if (cnpj.replace(/\D/g, '').length === 14 && !razaoSocial) {
                            void handleBuscarCnpj();
                          }
                        }}
                        placeholder="CNPJ (14 dígitos)"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBuscarCnpj}
                      disabled={buscandoCnpj}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070C0] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005ea3] disabled:opacity-60 cursor-pointer"
                    >
                      <Search className="h-4 w-4" />
                      {buscandoCnpj ? 'Buscando...' : 'Buscar CNPJ'}
                    </button>
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      required
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Razão Social da empresa"
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      placeholder="Nome Fantasia (opcional)"
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="Telefone / WhatsApp comercial"
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      placeholder="Município"
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      placeholder="Estado (UF)"
                      maxLength={2}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={setor}
                      onChange={(e) => setSetor(e.target.value)}
                      placeholder="Ramo de atuação / CNAE principal"
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#e55b00] cursor-pointer"
                  >
                    <span>Continuar para confirmação</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ETAPA 3: CONFIRMAÇÃO */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#081C3A]">3. Confirmação dos dados</h2>
                  <p className="text-xs text-slate-500">Revise suas informações antes de concluir o cadastro.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Representante</span>
                      <span className="font-bold text-[#081C3A]">{nome}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">E-mail de acesso</span>
                      <span className="font-bold text-[#0070C0]">{email}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">CNPJ</span>
                      <span className="font-bold text-[#081C3A]">{cnpj}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Razão Social</span>
                      <span className="font-bold text-[#081C3A]">{razaoSocial}</span>
                    </div>
                  </div>

                  {(municipio || uf) && (
                    <div className="border-t border-slate-200 pt-2 text-slate-600">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Localidade</span>
                      <span>{[municipio, uf].filter(Boolean).join(' - ')}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceite}
                      onChange={(e) => setAceite(e.target.checked)}
                      className="mt-0.5 rounded text-[#0070C0] focus:ring-[#0070C0]"
                    />
                    <span>
                      Declaro que li e concordo com os{' '}
                      <Link to="/termos" target="_blank" className="font-bold text-[#0070C0] hover:underline">
                        Termos de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link to="/privacidade" target="_blank" className="font-bold text-[#0070C0] hover:underline">
                        Política de Privacidade
                      </Link>
                      .
                    </span>
                  </label>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={carregando}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#e55b00] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                    >
                      {carregando ? 'Criando conta da empresa...' : 'Concluir Cadastro e Acessar'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ETAPA 4: CONCLUSÃO */}
            {step === 4 && (
              <div className="space-y-4 py-12 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 animate-bounce" />
                <h2 className="text-2xl font-extrabold text-[#081C3A]">Conta criada com sucesso!</h2>
                <p className="text-sm font-medium text-slate-600 max-w-md mx-auto">
                  Estamos preparando o seu painel de trabalho com todas as ferramentas de busca, certidões e gestão licitatória.
                </p>
                <div className="pt-4">
                  <span className="inline-block h-2 w-32 rounded-full bg-emerald-100 overflow-hidden">
                    <span className="block h-full w-full bg-emerald-500 animate-pulse" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPages({ defaultView }: { defaultView?: 'login' | 'register' }) {
  const location = useLocation();
  const isRegister =
    defaultView === 'register' ||
    location.pathname === '/register' ||
    location.pathname === '/cadastro';

  return isRegister ? <RegisterPage /> : <LoginPage />;
}
