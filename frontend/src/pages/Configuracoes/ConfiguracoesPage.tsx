import { useState, useEffect } from 'react';
import { 
  Settings, Building, ShieldCheck, Bell, 
  Cpu, Save, CheckCircle2, Loader2, Send, Plus, Lock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { authApi, empresasApi, notificacoesApi } from '@services/api';
import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import { PaywallModal } from '@/components/monetization/PaywallModal';
import toast from 'react-hot-toast';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';
import { useBrasilApiCnpj } from '@/hooks/useBrasilApiCnpj';

export default function ConfiguracoesPage() {
  const [abaAtiva, setAbaAtiva] = useState<'EMPRESA' | 'CERTIFICADO' | 'INTEGRACOES' | 'NOTIFICACOES'>('EMPRESA');
  const [mostrarFormularioEmpresa, setMostrarFormularioEmpresa] = useState(false);
  const [novoCnpj, setNovoCnpj] = useState('');
  const [mostrarModalUpgrade, setMostrarModalUpgrade] = useState(false);
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const activePlanId = useAuthStore((state) => state.activePlanId);
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const { refreshCompanies } = useCompany();
  const updateUser = useAuthStore((state) => state.updateUser);

  const { data: empresasResp, isLoading } = useQuery({
    queryKey: ['minhas_empresas'],
    queryFn: async () => {
      const res = await empresasApi.listar();
      return res.data;
    }
  });

  const empresas = Array.isArray(empresasResp?.data) ? empresasResp.data : [];
  const empresa = empresas[0];
  const plansQuery = useQuery({
    queryKey: ['planos-disponiveis'],
    queryFn: async () => {
      const response = await api.get('/pagamentos/planos');
      return response.data?.data as Array<{
        id: string;
        limites?: { maxCompanies?: number };
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const normalizedPlanId = activePlanId === 'avancado' ? 'pro' : activePlanId;
  const companyLimit = plansQuery.data?.find((plan) => plan.id === normalizedPlanId)?.limites?.maxCompanies;
  const hasResolvedCompanyLimit =
    planAccessLoaded && plansQuery.isSuccess && Number.isInteger(companyLimit) && (companyLimit ?? 0) > 0;
  const limitReached = hasResolvedCompanyLimit && empresas.length >= (companyLimit ?? 0);
  const nextPlanLabel = normalizedPlanId === 'basic' || normalizedPlanId === 'free'
    ? 'Fazer Upgrade para o plano Avançado'
    : normalizedPlanId === 'pro'
      ? 'Fazer Upgrade para o plano Master'
      : 'Ver opções de plano';

  const [formData, setFormData] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    cep: '',
    logradouro: '',
    bairro: '',
    cidade: '',
    uf: '',
    cnaePrincipal: '',
    status: '',
    whatsapp: authUser?.telefone || '',
  });

  useEffect(() => {
    if (empresa) {
      setFormData((prev) => ({
        ...prev,
        razaoSocial: empresa.razaoSocial || empresa.razao_social || prev.razaoSocial || '',
        nomeFantasia: empresa.nomeFantasia || empresa.nome_fantasia || prev.nomeFantasia || '',
        cnpj: formatCnpjMask(empresa.cnpj || prev.cnpj || ''),
        cep: empresa.cep || prev.cep || '',
        logradouro: empresa.logradouro || prev.logradouro || '',
        bairro: empresa.bairro || prev.bairro || '',
        cidade: empresa.municipio || empresa.cidade || prev.cidade || '',
        uf: empresa.uf || prev.uf || '',
        cnaePrincipal: empresa.cnaePrincipal || empresa.cnae_principal || prev.cnaePrincipal || '',
        status: empresa.status || prev.status || '',
        whatsapp: authUser?.telefone || prev.whatsapp || '',
      }));
    }
  }, [empresa?.id, authUser?.telefone]);

  const {
    isLoading: isBuscandoCnpj,
    error: erroBuscaCnpj,
  } = useBrasilApiCnpj(formData.cnpj, {
    onSuccess: (dados) => {
      setFormData((prev) => ({
        ...prev,
        razaoSocial: dados.razaoSocial || prev.razaoSocial,
        nomeFantasia: dados.nomeFantasia || prev.nomeFantasia,
        cep: dados.cep || prev.cep,
        logradouro: dados.logradouro || prev.logradouro,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.cidade || prev.cidade,
        uf: dados.uf || prev.uf,
        cnaePrincipal: dados.cnaePrincipal || prev.cnaePrincipal,
        status: dados.status || prev.status,
      }));
    },
  });

  const {
    isLoading: isBuscandoNovoCnpj,
    error: erroBuscaNovoCnpj,
    data: dadosNovoCnpj,
  } = useBrasilApiCnpj(novoCnpj, {
    enabled: mostrarFormularioEmpresa,
    onSuccess: (dados) => {
      setFormData((prev) => ({
        ...prev,
        cnpj: formatCnpjMask(dados.cnpj),
        razaoSocial: dados.razaoSocial || prev.razaoSocial,
        nomeFantasia: dados.nomeFantasia || prev.nomeFantasia,
        cep: dados.cep || prev.cep,
        logradouro: dados.logradouro || prev.logradouro,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.cidade || prev.cidade,
        uf: dados.uf || prev.uf,
        cnaePrincipal: dados.cnaePrincipal || prev.cnaePrincipal,
        status: dados.status || prev.status,
      }));
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { empresa: Record<string, unknown>; whatsapp: string }) => {
      const companyRequest = empresa?.id
        ? empresasApi.atualizar(empresa.id, data.empresa)
        : empresasApi.criar(data.empresa);
      const requests = [companyRequest];
      if (data.whatsapp !== (authUser?.telefone || '')) {
        requests.push(authApi.updateProfile({ telefone: data.whatsapp }));
      }
      return Promise.all(requests);
    },
    onSuccess: (_result, variables) => {
      updateUser({ telefone: variables.whatsapp });
      toast.success('Configurações salvas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['minhas_empresas'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao salvar configurações.');
    }
  });

  const addCompanyMutation = useMutation({
    mutationFn: async (cnpj: string) =>
      empresasApi.criar({
        cnpj: sanitizeCnpj(cnpj),
        razao_social: dadosNovoCnpj?.razaoSocial || formData.razaoSocial || undefined,
        nome_fantasia: dadosNovoCnpj?.nomeFantasia || formData.nomeFantasia || undefined,
        municipio: dadosNovoCnpj?.cidade || formData.cidade || undefined,
        uf: dadosNovoCnpj?.uf || formData.uf || undefined,
        cnae_principal: dadosNovoCnpj?.cnaePrincipal || formData.cnaePrincipal || undefined,
      }),
    onSuccess: async () => {
      toast.success('Empresa adicionada com sucesso.');
      setNovoCnpj('');
      setMostrarFormularioEmpresa(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['minhas_empresas'] }),
        refreshCompanies(),
      ]);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Não foi possível adicionar a empresa.');
    },
  });

  const handleAdicionarEmpresa = () => {
    if (limitReached) {
      setMostrarFormularioEmpresa(false);
      setMostrarModalUpgrade(true);
      return;
    }

    if (!hasResolvedCompanyLimit) {
      toast.error('Não foi possível confirmar o limite do seu plano. Tente novamente.');
      return;
    }

    setMostrarFormularioEmpresa(true);
  };

  const handleSubmitNovaEmpresa = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cnpjLimpo = sanitizeCnpj(novoCnpj);
    if (!isValidCnpj(cnpjLimpo, { optional: false })) {
      toast.error('Informe um CNPJ válido com 14 caracteres alfanuméricos (XX.XXX.XXX/XXXX-XX).');
      return;
    }
    if (limitReached) {
      setMostrarFormularioEmpresa(false);
      setMostrarModalUpgrade(true);
      return;
    }
    addCompanyMutation.mutate(cnpjLimpo);
  };

  const [enviandoSms, setEnviandoSms] = useState(false);

  const handleEnviarSmsTeste = async () => {
    if (!formData.whatsapp?.trim()) {
      toast.error('Informe um número de telefone com DDD para testar o envio.');
      return;
    }
    setEnviandoSms(true);
    const toastId = toast.loading('Disparando ping de teste via WhatsApp/SMS...');
    try {
      const res = await notificacoesApi.enviarSmsTeste(formData.whatsapp);
      toast.success(res.data?.message || 'SMS de teste enviado com sucesso!', { id: toastId });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao disparar SMS de teste.', { id: toastId });
    } finally {
      setEnviandoSms(false);
    }
  };

  const handleSave = () => {
    const cleanFormCnpj = sanitizeCnpj(formData.cnpj);
    if (cleanFormCnpj.length > 0 && !isValidCnpj(cleanFormCnpj, { optional: false })) {
      toast.error('O CNPJ informado é inválido. Use 14 caracteres alfanuméricos (XX.XXX.XXX/XXXX-XX).');
      return;
    }
    mutation.mutate({
      empresa: {
        razaoSocial: formData.razaoSocial,
        razao_social: formData.razaoSocial,
        nomeFantasia: formData.nomeFantasia,
        nome_fantasia: formData.nomeFantasia,
        cnpj: cleanFormCnpj,
        cep: formData.cep,
        logradouro: formData.logradouro,
        bairro: formData.bairro,
        municipio: formData.cidade,
        uf: formData.uf,
        cnaePrincipal: formData.cnaePrincipal,
        cnae_principal: formData.cnaePrincipal,
        status: formData.status,
      },
      whatsapp: formData.whatsapp.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Settings size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Configurações da Empresa
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consulte as opções de acesso aos portais públicos e configure os avisos da sua empresa.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={mutation.isPending}
          className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
          SALVAR ALTERAÇÕES
        </button>
      </header>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex border-b border-slate-200 mb-8 space-x-4">
        <button 
          onClick={() => setAbaAtiva('EMPRESA')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'EMPRESA' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Building size={16} /> Dados do Licitante
        </button>

        <button 
          onClick={() => setAbaAtiva('CERTIFICADO')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'CERTIFICADO' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldCheck size={16} /> Certificado Digital (A1)
        </button>

        <button 
          onClick={() => setAbaAtiva('INTEGRACOES')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'INTEGRACOES' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Cpu size={16} /> Credenciais dos Portais
        </button>

        <button 
          onClick={() => setAbaAtiva('NOTIFICACOES')}
          className={`pb-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'NOTIFICACOES' ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bell size={16} /> Alertas & WhatsApp
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl space-y-6">
        
        {abaAtiva === 'EMPRESA' && (
          <div className="space-y-4">
            <section aria-labelledby="minhas-empresas-heading" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 id="minhas-empresas-heading" className="text-sm font-bold text-slate-900">
                    Minhas Empresas
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {hasResolvedCompanyLimit
                      ? `${empresas.length} de ${companyLimit} empresas utilizadas no plano ${activePlanId === 'pro' ? 'Avançado' : activePlanId === 'master' ? 'Master' : 'Básico'}.`
                      : 'Consultando o limite de empresas do seu plano...'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-disabled={limitReached}
                  onClick={handleAdicionarEmpresa}
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-colors ${
                    limitReached
                      ? 'cursor-pointer bg-slate-200 text-slate-600 hover:bg-slate-300'
                      : hasResolvedCompanyLimit
                        ? 'bg-[#EA580C] text-white hover:bg-orange-600'
                        : 'cursor-wait bg-slate-200 text-slate-500'
                  }`}
                  title={limitReached ? 'Clique para conhecer os planos com mais empresas' : 'Adicionar uma empresa'}
                >
                  {limitReached ? <Lock size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                  {limitReached
                    ? 'Limite de Empresas Atingido'
                    : hasResolvedCompanyLimit
                      ? 'Adicionar Empresa'
                      : 'Verificando limite...'}
                </button>
              </div>

              {plansQuery.isError ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  Não foi possível consultar os limites do plano. Tente novamente antes de cadastrar outra empresa.
                  <button
                    type="button"
                    onClick={() => void plansQuery.refetch()}
                    className="ml-1 underline"
                  >
                    Tentar novamente
                  </button>
                </p>
              ) : null}

              {empresas.length > 0 ? (
                <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {empresas.map((item: any) => (
                    <li key={item.id} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
                      <span className="truncate text-xs font-bold text-slate-800">
                        {item.razaoSocial || item.razao_social || 'Empresa'}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {item.cnpj || 'CNPJ não informado'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-500">
                  Nenhuma empresa cadastrada.
                </p>
              )}

              {mostrarFormularioEmpresa && !limitReached ? (
                <div className="space-y-2 rounded-xl border border-blue-100 bg-white p-3">
                  <form onSubmit={handleSubmitNovaEmpresa} className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="novo-cnpj" className="sr-only">CNPJ da nova empresa</label>
                    <div className="relative min-w-0 flex-1">
                      <input
                        id="novo-cnpj"
                        type="text"
                        autoComplete="off"
                        value={novoCnpj}
                        onChange={(event) => setNovoCnpj(formatCnpjMask(event.target.value))}
                        placeholder="XX.XXX.XXX/XXXX-XX (letras e números)"
                        maxLength={18}
                        className="w-full rounded-lg border border-slate-200 pl-3 pr-9 py-2 text-xs font-semibold outline-none focus:border-blue-400"
                      />
                      {isBuscandoNovoCnpj && (
                        <Loader2
                          size={14}
                          aria-label="Consultando CNPJ na BrasilAPI"
                          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                        />
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={addCompanyMutation.isPending}
                      className="rounded-lg bg-[#0A2540] px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      {addCompanyMutation.isPending ? 'Validando...' : 'Cadastrar CNPJ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormularioEmpresa(false);
                        setNovoCnpj('');
                      }}
                      className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </form>
                  {erroBuscaNovoCnpj && (
                    <p role="status" className="text-[11px] font-medium text-amber-700">
                      {erroBuscaNovoCnpj}
                    </p>
                  )}
                </div>
              ) : null}
            </section>

            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Informações Cadastrais da Empresa
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-cnpj" className="block text-xs font-bold text-slate-600 mb-1">
                  CNPJ (Alfanumérico — busca automática ao completar 14 caracteres)
                </label>
                <div className="relative">
                  <input
                    id="cfg-cnpj"
                    type="text"
                    maxLength={18}
                    placeholder="XX.XXX.XXX/XXXX-XX"
                    value={formData.cnpj}
                    onChange={(e) => setFormData((p) => ({ ...p, cnpj: formatCnpjMask(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                  />
                  {isBuscandoCnpj && (
                    <Loader2
                      size={15}
                      aria-label="Buscando dados da empresa na BrasilAPI"
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#EA580C]"
                    />
                  )}
                </div>
                {erroBuscaCnpj && (
                  <p role="status" className="mt-1 text-[11px] font-medium text-amber-700">
                    {erroBuscaCnpj}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cfg-razao-social" className="block text-xs font-bold text-slate-600 mb-1">
                  Razão Social
                </label>
                <input
                  id="cfg-razao-social"
                  type="text"
                  placeholder="Razão Social da empresa"
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData((p) => ({ ...p, razaoSocial: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                />
              </div>

              <div>
                <label htmlFor="cfg-nome-fantasia" className="block text-xs font-bold text-slate-600 mb-1">
                  Nome Fantasia
                </label>
                <input
                  id="cfg-nome-fantasia"
                  type="text"
                  placeholder="Nome Fantasia"
                  value={formData.nomeFantasia}
                  onChange={(e) => setFormData((p) => ({ ...p, nomeFantasia: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                />
              </div>

              <div>
                <label htmlFor="cfg-cep" className="block text-xs font-bold text-slate-600 mb-1">
                  CEP
                </label>
                <input
                  id="cfg-cep"
                  type="text"
                  maxLength={9}
                  placeholder="00000-000"
                  value={formData.cep}
                  onChange={(e) => setFormData((p) => ({ ...p, cep: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="cfg-logradouro" className="block text-xs font-bold text-slate-600 mb-1">
                  Logradouro
                </label>
                <input
                  id="cfg-logradouro"
                  type="text"
                  placeholder="Rua, Avenida, número e complemento"
                  value={formData.logradouro}
                  onChange={(e) => setFormData((p) => ({ ...p, logradouro: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                />
              </div>

              <div>
                <label htmlFor="cfg-bairro" className="block text-xs font-bold text-slate-600 mb-1">
                  Bairro
                </label>
                <input
                  id="cfg-bairro"
                  type="text"
                  placeholder="Bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData((p) => ({ ...p, bairro: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="cfg-cidade" className="block text-xs font-bold text-slate-600 mb-1">
                    Cidade
                  </label>
                  <input
                    id="cfg-cidade"
                    type="text"
                    placeholder="Município / Cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData((p) => ({ ...p, cidade: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-uf" className="block text-xs font-bold text-slate-600 mb-1">
                    UF
                  </label>
                  <input
                    id="cfg-uf"
                    type="text"
                    maxLength={2}
                    placeholder="UF"
                    value={formData.uf}
                    onChange={(e) => setFormData((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 uppercase focus:outline-none focus:border-[#0A2540]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cfg-status" className="block text-xs font-bold text-slate-600 mb-1">
                  Porte da Empresa / Status
                </label>
                <select
                  id="cfg-status"
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                >
                  <option value="">Selecione...</option>
                  <option value="EPP">Empresa de Pequeno Porte (EPP)</option>
                  <option value="ME">Microempresa (ME)</option>
                  <option value="DEMAIS">Demais (Geral)</option>
                  <option value="ATIVA">Ativa</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-cnae" className="block text-xs font-bold text-slate-600 mb-1">
                  CNAE Principal
                </label>
                <input
                  id="cfg-cnae"
                  type="text"
                  placeholder="Código e descrição do CNAE"
                  value={formData.cnaePrincipal}
                  onChange={(e) => setFormData((p) => ({ ...p, cnaePrincipal: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0A2540]"
                />
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'CERTIFICADO' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Gerenciamento do Certificado Digital A1 (.PFX / .P12)
            </h3>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600" size={20} />
                <div>
                  <strong className="text-xs font-bold text-emerald-900 block">Certificado Válido Instalado</strong>
                  <span className="text-[10px] text-emerald-700">Validade até: 22/11/2026 | Emissor: AC Certisign RFB</span>
                </div>
              </div>
              <button className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-all">
                Substituir Certificado
              </button>
            </div>
          </div>
        )}

        {abaAtiva === 'INTEGRACOES' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Conexões Ativas com Portais
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-900 font-bold block">Compras.gov.br (SIASG)</strong>
                  <span className="text-slate-500 text-[10px]">Acesso pelo certificado digital e pelas credenciais do portal</span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">CONECTADO</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-900 font-bold block">LicitaNet / Portal de Compras Públicas</strong>
                  <span className="text-slate-500 text-[10px]">Envie os lances diretamente no portal oficial</span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">CONECTADO</span>
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'NOTIFICACOES' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Bell size={18} className="text-[#EA580C]" />
                Avisos por WhatsApp e SMS
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Receba avisos sobre editais alinhados ao seu perfil, prazos importantes e convocações.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Número do WhatsApp / Celular para Alertas Urgentes
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData(p => ({ ...p, whatsapp: e.target.value }))}
                      placeholder="+55 (11) 99999-9999"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleEnviarSmsTeste}
                    disabled={enviandoSms}
                    className="px-4 py-2.5 bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                    title="Envia uma mensagem de teste para verificar o recebimento dos avisos"
                  >
                    {enviandoSms ? (
                      <Loader2 size={14} className="animate-spin text-orange-400" />
                    ) : (
                      <Send size={14} />
                    )}
                    <span>Enviar SMS de Teste</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  Você receberá uma mensagem para confirmar que os avisos estão chegando.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      <PaywallModal
        isOpen={mostrarModalUpgrade}
        onClose={() => setMostrarModalUpgrade(false)}
        moduleName="Limite de empresas atingido"
        title="Amplie sua operação"
        message={`Você possui ${empresas.length} empresa(s) e atingiu o limite de ${companyLimit ?? empresas.length} do seu plano atual. Faça upgrade para cadastrar novos CNPJs.`}
        upgradeButtonLabel={nextPlanLabel}
      />
    </div>
  );
}