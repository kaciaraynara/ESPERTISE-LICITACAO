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
          {/* Coluna da Esquerda: Apresentação Institucional */}
          <div className="space-y-6 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0070C0]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Acesso Seguro à Plataforma</span>
            </div>

            <h1 className="text-4xl font-extrabold leading-tight text-[#081C3A] sm:text-5xl">
              Seu próximo resultado começa aqui
            </h1>

            <p className="max-w-lg text-base font-medium text-slate-600 leading-relaxed">
              Retorne à sua conta e continue acompanhando oportunidades no PNCP, controlando certidões de habilitação e disputando com margem de lucro protegida.
            </p>

            <div className="space-y-4 pt-2">
              {INSTITUTIONAL_HIGHLIGHTS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div key={idx} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0070C0]">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#081C3A]">{item.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna da Direita: Card de Login */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl lg:col-span-6">
            <h2 className="text-2xl font-extrabold text-[#081C3A]">Acesse sua conta</h2>
            <p className="mt-1 text-sm text-slate-500">Entre para acompanhar suas oportunidades e disputas.</p>

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

  const [etapaSucesso, setEtapaSucesso] = useState(false);
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

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

    if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      setErro('A senha deve conter no mínimo 8 caracteres, incluindo pelo menos uma letra e um número.');
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

      setEtapaSucesso(true);
      setTimeout(() => {
        navigate(FORNECEDOR_ROUTES.dashboard, { replace: true });
      }, 1200);
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
            <img src="/logo.png" alt="Expertise Licitatória" className="h-8 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6600]">
                <span>Pré-Lançamento • Vagas Antecipadas</span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#081C3A] sm:text-4xl">
                Cadastre sua empresa e comece a vencer licitações
              </h1>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed font-medium">
                Acesse oportunidades oficiais em todo o Brasil, proteja suas certidões antes do vencimento e dispute com preço técnico e seguro.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-[#081C3A]">
                  <CheckCircle2 className="h-4 w-4 text-[#0070C0]" />
                  <span>Passo 1: Seus dados de acesso</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Nome oficial para documentos e credenciais seguras para acesso diário.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-[#081C3A]">
                  <CheckCircle2 className="h-4 w-4 text-[#0070C0]" />
                  <span>Passo 2: Dados da empresa (CNPJ)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Preenchimento automático das informações cadastrais via base oficial.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-[#081C3A]">
                  <CheckCircle2 className="h-4 w-4 text-[#0070C0]" />
                  <span>Passo 3: Acesso imediato</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Painel desbloqueado imediatamente para você iniciar suas buscas.
                </p>
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Formulário Completo em 2 Blocos */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl lg:col-span-7">
            {etapaSucesso ? (
              <div className="space-y-4 py-16 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 animate-bounce" />
                <h2 className="text-2xl font-extrabold text-[#081C3A]">Conta criada com sucesso!</h2>
                <p className="text-sm font-medium text-slate-600">
                  Preparando seu painel de trabalho com todas as ferramentas...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {erro && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{erro}</span>
                  </div>
                )}

                {/* Bloco 1: Dados Pessoais do Representante */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-[#0070C0]">
                      1
                    </div>
                    <h2 className="text-base font-extrabold text-[#081C3A]">Seus dados de acesso</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Informe seu nome oficial para os documentos e como gostaria de ser chamado na plataforma.
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Nome completo (oficial)"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                    </div>

                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={apelido}
                        onChange={(e) => setApelido(e.target.value)}
                        placeholder="Como gostaria de ser chamado(a)?"
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
                        placeholder="E-mail profissional"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Senha (mín. 8 caracteres, letra e número)"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bloco 2: Dados da Empresa com Busca de CNPJ */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-[#FF6600]">
                      2
                    </div>
                    <h2 className="text-base font-extrabold text-[#081C3A]">Dados da empresa</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Digite o CNPJ para preenchimento automático das informações cadastrais.
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          placeholder="CNPJ (apenas números ou formatado)"
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
                        {buscandoCnpj ? 'Consultando...' : 'Buscar CNPJ'}
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
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="Telefone comercial"
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={setor}
                        onChange={(e) => setSetor(e.target.value)}
                        placeholder="Ramo de atuação / CNAE"
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none transition focus:border-[#0070C0]"
                      />
                    </div>
                  </div>
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

                  <button
                    type="submit"
                    disabled={carregando}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#e55b00] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {carregando ? 'Criando conta da empresa...' : 'Criar Conta e Acessar Plataforma'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
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
