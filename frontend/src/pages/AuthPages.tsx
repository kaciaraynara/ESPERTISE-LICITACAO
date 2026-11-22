import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Search } from 'lucide-react';
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F4F7FB]">
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
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 w-full">
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
          className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-6 px-4 py-6 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-16"
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

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl w-full min-w-0 lg:col-span-7 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function extrairMensagemErro(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e.message || e.msg || String(e)).join(' • ');
  }
  if (Array.isArray(data?.details) && data.details.length > 0) {
    return data.details.map((e: any) => e.message || String(e)).join(' • ');
  }
  return data?.message || data?.error || fallback;
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
      setErro(extrairMensagemErro(err, 'E-mail ou senha inválidos. Confira os dados e tente novamente.'));
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

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [telefone, setTelefone] = useState('');
  const [setor, setSetor] = useState('');
  const [cnaesLista, setCnaesLista] = useState<string[]>([]);
  const [aceite, setAceite] = useState(false);
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
      const todosCnaes = [
        dados.cnae_fiscal_descricao ? `${dados.cnae_fiscal || ''} - ${dados.cnae_fiscal_descricao}`.trim() : '',
        ...(Array.isArray(dados.cnaes_secundarios)
          ? dados.cnaes_secundarios.map((c: any) => `${c.codigo || ''} - ${c.descricao || ''}`.trim())
          : []),
      ].filter(Boolean);
      setCnaesLista(todosCnaes);
      if (dados.cnae_fiscal_descricao) setSetor(dados.cnae_fiscal_descricao);
      setAvisoCnpj(`Empresa e ${todosCnaes.length || 1} CNAE(s) carregados automaticamente!`);
    } catch {
      setErro('Não foi possível consultar o CNPJ agora. Preencha os dados da empresa manualmente.');
    } finally {
      setBuscandoCnpj(false);
    }
  }

  function avancarEtapa1(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !email.trim()) {
      setErro('Preencha seu nome completo e e-mail profissional.');
      return;
    }
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
      setErro('A senha deve ter no mínimo 8 caracteres com pelo menos uma letra e um número.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas precisam ser iguais.');
      return;
    }
    setEtapa(2);
  }

  function avancarEtapa2(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (cnpj.replace(/\D/g, '').length !== 14) {
      setErro('Informe um CNPJ válido com 14 números.');
      return;
    }
    if (!razaoSocial.trim()) {
      setErro('Informe o nome da empresa ou clique em Buscar CNPJ.');
      return;
    }
    setEtapa(3);
  }

  async function concluirCadastro(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!aceite) {
      setErro('Confirme que está de acordo com os termos para criar a conta.');
      return;
    }

    setLoading(true);
    try {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      if (cnaesLista.length > 0 && cnpjLimpo) {
        localStorage.setItem(`@Expertise:cnaes_${cnpjLimpo}`, JSON.stringify(cnaesLista));
      }
      const resp = await authApi.register({
        aceite_lgpd: Boolean(aceite),
        nome: nome.trim(),
        email: email.trim(),
        senha,
        razaoSocial: razaoSocial.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
        telefone: telefone.trim(),
        cnaePrincipal: setor.trim(),
        cnaesSecundarios: cnaesLista.slice(1),
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
      setErro(extrairMensagemErro(err, 'Não foi possível concluir o cadastro. Verifique os dados.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountLayout signup>
      <ol className="mb-6 grid grid-cols-3 border-b border-slate-100 pb-4 text-center text-xs text-slate-400">
        {[
          { num: 1, label: 'Seus dados' },
          { num: 2, label: 'Empresa' },
          { num: 3, label: 'Confirmação' },
        ].map((step) => {
          const atual = etapa === step.num;
          const feito = etapa > step.num;
          return (
            <li
              key={step.num}
              className={atual ? 'font-bold text-[#FF6600]' : feito ? 'font-bold text-[#0070C0]' : ''}
            >
              <span
                className={`mx-auto mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  atual
                    ? 'bg-[#FF6600] text-white'
                    : feito
                    ? 'bg-[#0070C0] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step.num}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>

      {/* ETAPA 1: SEUS DADOS */}
      {etapa === 1 && (
        <form onSubmit={avancarEtapa1} className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-[#081C3A]">Seus dados</h2>
            <p className="mt-1 text-sm text-slate-500">Informe seus dados para criar seu acesso.</p>
          </div>

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

          {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
          >
            Continuar para Dados da Empresa
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      {/* ETAPA 2: EMPRESA */}
      {etapa === 2 && (
        <form onSubmit={avancarEtapa2} className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-[#081C3A]">Dados da empresa</h2>
            <p className="mt-1 text-sm text-slate-500">Digite o CNPJ para preencher os dados automaticamente.</p>
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

          {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setErro('');
                setEtapa(1);
              }}
              className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              type="submit"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF6600] text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
            >
              Continuar para Confirmação
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* ETAPA 3: CONFIRMAÇÃO */}
      {etapa === 3 && (
        <form onSubmit={concluirCadastro} className="space-y-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <h2 className="text-2xl font-bold text-[#081C3A]">Confirmação do cadastro</h2>
              <p className="text-sm text-slate-500">Confira os dados antes de ativar seu acesso.</p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-sm">
            <p><strong>Responsável:</strong> {nome}</p>
            <p><strong>E-mail:</strong> {email}</p>
            <p><strong>Empresa:</strong> {razaoSocial}</p>
            <p><strong>CNPJ:</strong> {cnpj}</p>
            {setor && <p><strong>CNAE / Atividade:</strong> {setor}</p>}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={aceite}
              onChange={(e) => setAceite(e.target.checked)}
            />
            Confirmo os dados informados e concordo com os Termos de Uso e Política de Privacidade.
          </label>

          {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setErro('');
                setEtapa(2);
              }}
              className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[48px] w-full sm:flex-1 items-center justify-center gap-2 rounded-xl bg-[#0070C0] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#005ea3] disabled:opacity-60"
            >
              {loading ? 'Criando conta...' : 'Finalizar e entrar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link to="/login" className="font-bold text-[#0070C0] hover:underline">
          Entrar
        </Link>
      </p>
    </AccountLayout>
  );
}

export default function AuthPages({
  mode,
  defaultView,
}: {
  mode?: 'login' | 'register';
  defaultView?: 'login' | 'register';
}) {
  const { pathname } = useLocation();
  const isRegister =
    (mode || defaultView) === 'register' ||
    pathname.includes('register') ||
    pathname.includes('cadastro');
  return isRegister ? <RegisterPage /> : <LoginPage />;
}
