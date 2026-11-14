import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Search, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FORNECEDOR_ROUTES } from '../routes';

export function LoginPage() {
  const { login } = useAuth() as any;
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(email, senha);
      navigate(FORNECEDOR_ROUTES.dashboard);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'E-mail ou senha inválidos. Confira seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold text-[#081C3A]">
          EXPERTISE LICITATÓRIA
        </Link>

        <div className="mt-12 grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Lado esquerdo */}
          <div className="space-y-4 lg:col-span-6">
            <h1 className="text-4xl font-extrabold leading-tight text-[#081C3A] sm:text-5xl">
              Seu próximo resultado começa aqui
            </h1>
            <p className="max-w-md text-base font-medium text-slate-600">
              Retorne à sua conta e continue acompanhando oportunidades, editais e todo o seu processo em um só lugar.
            </p>
          </div>

          {/* Card de Login */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg lg:col-span-6">
            <h2 className="text-2xl font-extrabold text-[#081C3A]">Acesse sua conta</h2>
            <p className="mt-1 text-sm text-slate-500">Entre para acompanhar suas oportunidades.</p>

            {erro && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                {erro}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#081C3A]">E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu e-mail"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#081C3A]">Senha</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 text-sm outline-none focus:border-[#0070C0]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={carregando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00] disabled:opacity-60"
              >
                {carregando ? 'Entrando...' : 'Entrar'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Ainda não tem conta?{' '}
              <Link to="/cadastro" className="font-bold text-[#0070C0] hover:underline">
                Cadastre sua empresa
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth() as any;
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [setor, setSetor] = useState('Comércio / Fornecimento');
  const [aceite, setAceite] = useState(true);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleBuscarCnpj = async () => {
    const digitos = cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) return;
    setBuscandoCnpj(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (resp.ok) {
        const dados = await resp.json();
        if (dados.razao_social) setRazaoSocial(dados.razao_social);
        if (dados.ddd_telefone_1) setTelefone(dados.ddd_telefone_1);
        if (dados.cnae_fiscal_descricao) setSetor(dados.cnae_fiscal_descricao);
      }
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceite) {
      setErro('Concorde com os Termos de Uso para continuar.');
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      await register({
        name: nome,
        email,
        password: senha,
        razaoSocial,
        cnpj,
        telefone,
        setor,
      });
      setEtapa(2);
      setTimeout(() => navigate(FORNECEDOR_ROUTES.dashboard), 1200);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Não foi possível concluir o cadastro. Verifique os dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Topo */}
        <header className="flex items-center justify-between">
          <Link to="/" className="text-lg font-extrabold text-[#081C3A]">
            EXPERTISE LICITATÓRIA
          </Link>
          <Link
            to="/login"
            className="rounded-xl bg-[#FF6600] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#e55b00]"
          >
            Entrar na plataforma
          </Link>
        </header>

        <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          {/* Lado esquerdo */}
          <div className="space-y-6 lg:col-span-5">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight text-[#081C3A]">
                Crie sua conta
              </h1>
              <p className="mt-2 text-lg font-bold text-[#081C3A]">
                Cadastre sua empresa para começar
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Acesse oportunidades, organize seus processos e leve sua empresa a um novo nível em licitações.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <TrendingUp className="h-6 w-6 text-[#FF6600]" />
              <p className="text-sm font-bold text-[#081C3A]">
                Mais oportunidades para o seu negócio
              </p>
            </div>
          </div>

          {/* Formulário */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg lg:col-span-7">
            {etapa === 2 ? (
              <div className="py-12 text-center space-y-3">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h2 className="text-2xl font-extrabold text-[#081C3A]">Conta criada com sucesso!</h2>
                <p className="text-sm text-slate-500">Abrindo seu painel da Expertise...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {erro && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                    {erro}
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-extrabold text-[#081C3A]">Seus dados</h2>
                  <p className="text-xs text-slate-500">Informe seus dados para criar o acesso à plataforma.</p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      required
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo"
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-mail profissional"
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                    <input
                      required
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Crie uma senha"
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0] sm:col-span-2"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h2 className="text-lg font-extrabold text-[#081C3A]">Dados da empresa</h2>
                  <p className="text-xs text-slate-500">Digite o CNPJ para preencher automaticamente ou informe abaixo.</p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex gap-2 sm:col-span-2">
                      <input
                        required
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="CNPJ da empresa"
                        className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                      />
                      <button
                        type="button"
                        onClick={handleBuscarCnpj}
                        disabled={buscandoCnpj}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070C0] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#005ea3]"
                      >
                        <Search className="h-4 w-4" />
                        {buscandoCnpj ? 'Buscando...' : 'Buscar CNPJ'}
                      </button>
                    </div>

                    <input
                      required
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Razão social"
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="Telefone comercial"
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                    <input
                      type="text"
                      value={setor}
                      onChange={(e) => setSetor(e.target.value)}
                      placeholder="Setor de atuação"
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0] sm:col-span-2"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={aceite}
                    onChange={(e) => setAceite(e.target.checked)}
                  />
                  Li e concordo com os Termos de Uso e Política de Privacidade.
                </label>

                <button
                  type="submit"
                  disabled={carregando}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00] disabled:opacity-60"
                >
                  {carregando ? 'Criando conta...' : 'Continuar'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}