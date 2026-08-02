import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSearch,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from '@components/icons/phosphor-compat';
import toast from 'react-hot-toast';
import { resolveAuthenticatedHome } from '../../routes';
import { authApi, integracoesApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import type { User as AuthUser } from '@/types';
import { getUserDisplayName } from '@/utils';

type AuthPayload = {
  user?: AuthUser;
  accessToken?: string;
};

type CompanyLookupState = 'idle' | 'loading' | 'success' | 'error';

function resolveAuthPayload(payload: unknown): AuthPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  return payload as AuthPayload;
}

function extractErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
    if (response?.status === 409) {
      return 'Já existe uma conta com este email.';
    }
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível concluir a autenticação agora.';
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTelefoneBr(raw?: string) {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (!digits) return undefined;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`;
  return `+${digits}`;
}

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '');
}

function formatCnpj(value: string) {
  const digits = normalizeCnpj(value).slice(0, 14);
  if (!digits) return '';
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function LandingAuthPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const authMode = useMemo<'login' | 'register'>(
    () => (location.pathname === '/login' ? 'login' : 'register'),
    [location.pathname],
  );

  const [loginEmail, setLoginEmail] = useState('');
  const [loginSenha, setLoginSenha] = useState('');

  const [registerNome, setRegisterNome] = useState('');
  const [registerTelefone, setRegisterTelefone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerSenha, setRegisterSenha] = useState('');
  const [registerLgpd, setRegisterLgpd] = useState(true);
  const [registerCnpj, setRegisterCnpj] = useState('');
  const [registerRazaoSocial, setRegisterRazaoSocial] = useState('');
  const [registerNomeFantasia, setRegisterNomeFantasia] = useState('');
  const [registerMunicipio, setRegisterMunicipio] = useState('');
  const [registerUf, setRegisterUf] = useState('');
  const [registerCnae, setRegisterCnae] = useState('');
  const [registerStatus, setRegisterStatus] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [lookupState, setLookupState] = useState<CompanyLookupState>('idle');
  const [lookupMessage, setLookupMessage] = useState('');

  useEffect(() => {
    if (authMode !== 'register') {
      return;
    }

    const cnpj = normalizeCnpj(registerCnpj);

    if (cnpj.length !== 14) {
      if (lookupState !== 'idle') {
        setLookupState('idle');
        setLookupMessage('');
      }
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLookupState('loading');
        setLookupMessage('Consultando dados oficiais da empresa...');

        const response = await integracoesApi.cnpjPublico(cnpj);
        const data = response.data?.data;

        if (!active || !data) return;

        setRegisterCnpj(formatCnpj(data.cnpj || cnpj));
        setRegisterRazaoSocial(data.razao_social || '');
        setRegisterNomeFantasia(data.nome_fantasia || '');
        setRegisterMunicipio(data.municipio || '');
        setRegisterUf(data.uf || '');
        setRegisterCnae(data.cnae_principal || '');
        setRegisterStatus(data.status || '');
        setLookupState('success');
        setLookupMessage('Empresa identificada automaticamente. Revise e continue o cadastro.');
      } catch {
        if (!active) return;

        setLookupState('error');
        setLookupMessage('Não foi possível completar o CNPJ agora. Você pode seguir preenchendo a empresa manualmente.');
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authMode, registerCnpj]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInlineError('');
    setSubmitting(true);

    try {
      const response = await authApi.login({ email: normalizeEmail(loginEmail), senha: loginSenha });
      const payload = resolveAuthPayload(response.data?.data);

      if (!payload.user || !payload.accessToken) {
        throw new Error('Resposta de login inválida.');
      }

      setAuth(payload.user, payload.accessToken);
      toast.success('Login realizado com sucesso.');
      navigate(resolveAuthenticatedHome(payload.user.role), { replace: true });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInlineError('');
    setSubmitting(true);

    try {
      const response = await authApi.register({
        nome: registerNome,
        email: normalizeEmail(registerEmail),
        senha: registerSenha,
        telefone: normalizeTelefoneBr(registerTelefone),
        aceite_lgpd: registerLgpd,
        cnpj: normalizeCnpj(registerCnpj),
        razao_social: registerRazaoSocial,
        nome_fantasia: registerNomeFantasia || undefined,
        municipio: registerMunicipio || undefined,
        uf: registerUf || undefined,
        cnae_principal: registerCnae || undefined,
        status: registerStatus || undefined,
      });

      const payload = resolveAuthPayload(response.data?.data);

      if (!payload.user || !payload.accessToken) {
        throw new Error('Resposta de cadastro inválida.');
      }

      setAuth(payload.user, payload.accessToken);
      toast.success('Conta e empresa criadas com sucesso.');
      navigate(resolveAuthenticatedHome(payload.user.role), { replace: true });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated && user) {
    return (
      <div className="rounded-lg border border-gray-100 bg-brand-blue p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-blue ring-1 ring-brand-blue/10">
            <CheckCircle2 className="h-6 w-6 text-brand-blue" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue">Sessão ativa</p>
            <h3 className="text-xl font-bold text-white">{getUserDisplayName(user, 'Conta Expertise')}</h3>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-gray-100 bg-white p-4">
          <p className="text-sm text-brand-blue/70">Sua conta já está pronta para continuar no painel operacional.</p>
          <button
            type="button"
            onClick={() => navigate('/fornecedor/dashboard')}
            className="flex h-11 w-full items-center justify-center rounded-md bg-brand-blue text-sm font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-[#172554]"
          >
            Abrir página inicial
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-brand-blue p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue">Acesso imediato</p>
          <h3 className="mt-2 text-2xl font-bold text-white">
            {authMode === 'login' ? 'Entrar na operação' : 'Cadastrar empresa e começar'}
          </h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white ring-1 ring-white/10">
          <Building2 className="h-5 w-5 text-brand-blue" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 rounded-md border border-gray-100 bg-white p-1">
        {[
          { mode: 'register' as const, label: 'Cadastro' },
          { mode: 'login' as const, label: 'Login' },
        ].map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => navigate(tab.mode === 'login' ? '/login' : '/register')}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              authMode === tab.mode
                ? 'bg-white text-brand-blue shadow-sm'
                : 'text-brand-blue/70 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {authMode === 'login' ? (
        <form className="space-y-4" onSubmit={handleLogin}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Email</span>
            <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
              <Mail className="h-4 w-4 text-brand-blue/70" />
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                placeholder="voce@empresa.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Senha</span>
            <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
              <LockKeyhole className="h-4 w-4 text-brand-blue/70" />
              <input
                type="password"
                value={loginSenha}
                onChange={(event) => setLoginSenha(event.target.value)}
                className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {inlineError && (
            <div className="rounded-md border border-brand-orange/50 bg-brand-orange/10 px-4 py-3 text-sm font-medium text-brand-blue">
              {inlineError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue px-4 py-3 text-sm font-bold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:bg-[#CBD5E1]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Entrar no painel
          </button>
          <a
            href="mailto:suporte@expertise.com.br?subject=Recuperar%20senha%20EXPERTISE"
            className="block text-center text-sm font-bold text-white"
          >
            Recuperar senha
          </a>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleRegister}>
          <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">CNPJ</span>
              <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
                <Building2 className="h-4 w-4 text-brand-blue/70" />
                <input
                  type="text"
                  value={registerCnpj}
                  onChange={(event) => setRegisterCnpj(formatCnpj(event.target.value))}
                  className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  required
                />
                {lookupState === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />}
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Empresa</span>
              <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
                <FileSearch className="h-4 w-4 text-brand-blue/70" />
                <input
                  type="text"
                  value={registerRazaoSocial}
                  onChange={(event) => setRegisterRazaoSocial(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                  placeholder="Razão social da empresa"
                  required
                />
              </div>
            </label>
          </div>

          {(lookupState !== 'idle' || registerNomeFantasia || registerMunicipio || registerCnae) && (
            <div className={`rounded-md border px-4 py-3 text-sm ${
              lookupState === 'error'
                ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue'
                : 'border-[#E2E8F0] bg-white text-[#334155]'
            }`}>
              <p className="font-semibold">{lookupMessage}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {registerNomeFantasia && (
                  <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Fantasia</p>
                    <p className="mt-1 text-sm text-[#334155]">{registerNomeFantasia}</p>
                  </div>
                )}
                {(registerMunicipio || registerUf) && (
                  <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Localização</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[#334155]">
                      <MapPin className="h-3.5 w-3.5 text-brand-blue" />
                      {[registerMunicipio, registerUf].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
              </div>
              {registerCnae && (
                <div className="mt-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">CNAE principal</p>
                  <p className="mt-1 text-sm text-[#334155]">{registerCnae}</p>
                </div>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Responsável pela operação</span>
            <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
              <User className="h-4 w-4 text-brand-blue/70" />
              <input
                type="text"
                value={registerNome}
                onChange={(event) => setRegisterNome(event.target.value)}
                className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                placeholder="Seu nome"
                autoComplete="name"
                required
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Telefone</span>
              <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
                <Phone className="h-4 w-4 text-brand-blue/70" />
                <input
                  type="tel"
                  value={registerTelefone}
                  onChange={(event) => setRegisterTelefone(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Email</span>
              <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
                <Mail className="h-4 w-4 text-brand-blue/70" />
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-blue/70">Senha</span>
            <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-4 py-3 focus-within:border-brand-blue/20 focus-within:ring-4 focus-within:ring-brand-blue/10">
              <LockKeyhole className="h-4 w-4 text-brand-blue/70" />
              <input
                type="password"
                value={registerSenha}
                onChange={(event) => setRegisterSenha(event.target.value)}
                className="w-full bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                placeholder="Min. 8 caracteres com letras e números"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-md border border-gray-100 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={registerLgpd}
              onChange={(event) => setRegisterLgpd(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-100 bg-transparent text-brand-blue"
            />
            <span className="text-sm leading-6 text-brand-blue/70">
              Aceito os termos de uso, tratamento de dados e política de privacidade da plataforma.
            </span>
          </label>

          {inlineError && (
            <div className="rounded-md border border-brand-orange/50 bg-brand-orange/10 px-4 py-3 text-sm font-medium text-brand-blue">
              {inlineError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue px-4 py-3 text-sm font-bold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:bg-[#CBD5E1]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Criar conta da empresa
          </button>

          <div className="flex items-start gap-2 rounded-md border border-brand-blue/20 bg-brand-blue px-4 py-3 text-sm text-brand-blue">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
            <span>Cadastro já nasce com CNPJ, empresa vinculada ao radar inicial, senha protegida com hash e sessão renovada por refresh token.</span>
          </div>
        </form>
      )}
    </div>
  );
}

