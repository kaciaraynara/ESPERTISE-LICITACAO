import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Search } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { FORNECEDOR_ROUTES } from '../routes';

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-[#081C3A]">
        {label}
      </label>
      {children}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} id={id}>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-[#081C3A] outline-none transition focus:border-[#0070C0]"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

function AccountLayout({ signup, children }: { signup?: boolean; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Expertise Licitatória"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-base font-extrabold text-[#081C3A]">EXPERTISE LICITATÓRIA</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-bold text-[#081C3A] hover:text-[#0070C0]">
              Entrar
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-[#FF6600] px-4 py-2 text-xs font-bold text-white hover:bg-[#e55b00]"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="relative min-h-[calc(100svh-80px)] overflow-hidden">
        <img
          src={signup ? '/assets/signup-scene.jpg' : '/assets/login-scene.jpg'}
          alt={signup ? 'Profissional em escritório' : 'Profissional trabalhando no computador'}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F4F7FB]/90 via-[#F4F7FB]/65 to-[#F4F7FB]/80" />

        <div
          data-ready={ready}
          className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-12 lg:gap-16"
        >
          <div className="space-y-4 lg:col-span-5">
            <h1 className="max-w-xs text-4xl font-extrabold leading-[1.08] text-[#081C3A] sm:text-5xl">
              {signup ? 'Crie sua conta' : 'Seu próximo resultado começa aqui'}
            </h1>
            <p className="max-w-xs text-lg font-semibold text-[#081C3A]">
              {signup ? 'Cadastre sua empresa para começar' : 'Acesse sua conta e continue de onde parou.'}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-slate-600">
              {signup
                ? 'Encontre oportunidades e organize o trabalho da sua empresa.'
                : 'Suas oportunidades e informações reunidas em um só lugar.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl lg:col-span-7 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [reset, setReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagem('');

    if (reset) {
      setMensagem('Solicite a redefinição de senha pelo suporte oficial da Expertise ou tente novamente com sua senha cadastrada.');
      return;
    }

    setLoading(true);
    try {
      const resp = await authApi.login({ email: email.trim(), senha });
      const data = resp?.data?.data || resp?.data || {};
      const user = data.user;
      const accessToken = data.accessToken || data.token;
      const refreshToken = data.refreshToken || '';

      if (user && accessToken) {
        useAuthStore.getState().setAuth(user, accessToken, refreshToken);
      }
      navigate(FORNECEDOR_ROUTES.dashboard);
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'E-mail ou senha inválidos. Confira os dados e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountLayout>
      <h2 className="text-3xl font-bold text-[#081C3A]">
        {reset ? 'Recupere sua senha' : 'Acesse sua conta'}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">
        {reset ? 'Informe o e-mail da sua conta.' : 'Entre para acompanhar suas oportunidades.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <Field label="E-mail" id="email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="Seu e-mail"
              required
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-[#081C3A] outline-none transition focus:border-[#0070C0]"
            />
          </div>
        </Field>

        {!reset && (
          <PasswordField
            id="password"
            label="Senha"
            value={senha}
            onChange={setSenha}
            autoComplete="current-password"
          />
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setReset(!reset);
              setErro('');
              setMensagem('');
            }}
            className="text-xs font-semibold text-[#FF6600] hover:underline"
          >
            {reset ? 'Voltar para entrar' : 'Esqueci minha senha'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00] disabled:opacity-60"
        >
          {loading ? 'Entrando...' : reset ? 'Enviar recuperação' : 'Entrar'}
          <ArrowRight className="h-4 w-4" />
        </button>

        {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}
        {mensagem && <p className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-[#0070C0]">{mensagem}</p>}
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Ainda não tem conta?{' '}
        <Link to="/register" className="font-bold text-[#0070C0] hover:underline">
          Criar conta
        </Link>
      </p>
    </AccountLayout>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [telefone, setTelefone] = useState('');
  const [setor, setSetor] = useState('');
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoCnpj, setAvisoCnpj] = useState('');

  async function buscarCnpj() {
    const digitos = cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setErro('Informe os 14 números do CNPJ para consultar.');
      return;
    }
    setErro('');
    setAvisoCnpj('');
    setBuscandoCnpj(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!resp.ok) throw new Error('CNPJ não encontrado');
      const dados = await resp.json();
      if (dados.razao_social) setRazaoSocial(dados.razao_social);
      if (dados.ddd_telefone_1) setTelefone(dados.ddd_telefone_1);
      if (dados.cnae_fiscal_descricao) setSetor(dados.cnae_fiscal_descricao);
      setAvisoCnpj('Dados da empresa carregados automaticamente!');
    } catch {
      setErro('Não foi possível consultar o CNPJ agora. Preencha os dados da empresa manualmente.');
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (senha !== confirmarSenha) {
      setErro('As senhas precisam ser iguais.');
      return;
    }
    if (senha.length < 8) {
      setErro('A senha precisa ter no mínimo 8 caracteres com letra e número.');
      return;
    }

    setLoading(true);
    try {
      const resp = await authApi.register({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        razaoSocial: razaoSocial.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
        telefone: telefone.trim(),
        ramoAtividade: setor.trim(),
      } as any);

      const data = resp?.data?.data || resp?.data || {};
      const user = data.user;
      const accessToken = data.accessToken || data.token;
      const refreshToken = data.refreshToken || '';

      if (user && accessToken) {
        useAuthStore.getState().setAuth(user, accessToken, refreshToken);
      }
      navigate(FORNECEDOR_ROUTES.dashboard);
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Não foi possível concluir o cadastro. Verifique os dados.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountLayout signup>
      <ol className="mb-6 grid grid-cols-3 border-b border-slate-100 pb-4 text-center text-xs text-slate-400">
        {['Seus dados', 'Empresa', 'Confirmação'].map((step, i) => (
          <li key={step} className={i === 0 ? 'font-bold text-[#FF6600]' : ''}>
            <span
              className={`mx-auto mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                i === 0 ? 'bg-[#FF6600] text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <h2 className="text-2xl font-bold text-[#081C3A]">Seus dados</h2>
      <p className="mt-1 text-sm text-slate-500">Informe seus dados para criar sua conta.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" id="name">
            <input
              id="name"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#0070C0]"
            />
          </Field>
          <Field label="E-mail profissional" id="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#0070C0]"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField id="password" label="Senha" value={senha} onChange={setSenha} />
          <PasswordField
            id="confirm-password"
            label="Confirmar senha"
            value={confirmarSenha}
            onChange={setConfirmarSenha}
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-base font-bold text-[#081C3A]">Dados da empresa</h3>
          <p className="text-xs text-slate-500">Digite o CNPJ para preencher os dados automaticamente.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="CNPJ" id="cnpj">
              <div className="flex gap-2">
                <input
                  id="cnpj"
                  type="text"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  required
                  className="h-10 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#0070C0]"
                />
                <button
                  type="button"
                  onClick={buscarCnpj}
                  disabled={buscandoCnpj}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0070C0] px-4 text-xs font-bold text-white hover:bg-[#005ea3] disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  {buscandoCnpj ? 'Buscando...' : 'Buscar CNPJ'}
                </button>
              </div>
            </Field>
            {avisoCnpj && <p className="mt-1.5 text-xs font-semibold text-emerald-600">{avisoCnpj}</p>}
          </div>

          <Field label="Nome da empresa" id="company">
            <input
              id="company"
              type="text"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              required
              className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#0070C0]"
            />
          </Field>
          <Field label="Telefone comercial" id="phone">
            <input
              id="phone"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#0070C0]"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Área de atuação" id="sector">
              <input
                id="sector"
                type="text"
                placeholder="Ex.: comércio de vestuário, informática"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#0070C0]"
              />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00] disabled:opacity-60"
        >
          {loading ? 'Criando conta...' : 'Continuar'}
          <ArrowRight className="h-4 w-4" />
        </button>

        {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link to="/login" className="font-bold text-[#0070C0] hover:underline">
          Entrar
        </Link>
      </p>
    </AccountLayout>
  );
}

export default function AuthPages({ mode, defaultView }: { mode?: 'login' | 'register'; defaultView?: 'login' | 'register' }) {
  const { pathname } = useLocation();
  const isRegister =
    (mode || defaultView) === 'register' || pathname.includes('register') || pathname.includes('cadastro');
  return isRegister ? <RegisterPage /> : <LoginPage />;
}
