import { useState, useEffect } from 'react';
import { Check, Crown, RocketLaunch, Star, ShieldCheck, Spinner, ArrowClockwise, Warning } from '@phosphor-icons/react';
import { pagamentosApi } from '@services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  valorCentavos: number;
  destaque: boolean;
  features: string[];
  mercadoPagoConfigurado: boolean;
  limites: {
    maxCompanies: number;
    maxUsers: number;
    maxMonitoredNotices: number;
    maxNullityAnalysesMonth: number;
    maxProposalsMonth: number | null;
  };
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'basic',
    nome: 'Básico',
    descricao: 'Ideal para quem está iniciando nas vendas governamentais com estrutura enxuta.',
    valor: 247,
    valorCentavos: 24700,
    destaque: false,
    features: [
      'radar_editais',
      'resumo_edital_basico',
      'fabrica_propostas',
      'catalogo_produtos',
      'cofre_documentos',
      'habilitacao',
      'certidoes',
      'prazos_alertas',
      'crm_kanban',
      'dispensa_eletronica',
      'academia_licitante',
      'gestao_contratual',
      'credenciamento',
    ],
    mercadoPagoConfigurado: true,
    limites: {
      maxCompanies: 5,
      maxUsers: 2,
      maxMonitoredNotices: 20,
      maxNullityAnalysesMonth: 5,
      maxProposalsMonth: 15,
    },
  },
  {
    id: 'pro',
    nome: 'Avançado',
    descricao: 'Para empresas em expansão que precisam de inteligência estratégica e automação diária.',
    valor: 497,
    valorCentavos: 49700,
    destaque: true,
    features: [
      'radar_editais',
      'resumo_edital_completo',
      'score_oportunidade',
      'precificacao_estrategica',
      'analise_viabilidade',
      'impugnacao_edital',
      'recursos_administrativos',
      'robo_lances',
      'srp_carona',
      'lex_ia_avancada',
      'relatorios_estrategicos',
    ],
    mercadoPagoConfigurado: true,
    limites: {
      maxCompanies: 10,
      maxUsers: 5,
      maxMonitoredNotices: 50,
      maxNullityAnalysesMonth: 20,
      maxProposalsMonth: 50,
    },
  },
  {
    id: 'master',
    nome: 'Master',
    descricao: 'Operações de grande porte que exigem investigação de concorrentes e inteligência máxima.',
    valor: 997,
    valorCentavos: 99700,
    destaque: false,
    features: [
      'radar_editais',
      'resumo_edital_completo',
      'score_oportunidade',
      'precificacao_estrategica',
      'analise_viabilidade',
      'impugnacao_edital',
      'recursos_administrativos',
      'robo_lances',
      'srp_carona',
      'lex_ia_avancada',
      'relatorios_estrategicos',
      'historico_concorrentes',
      'investigacao_concorrencial',
      'cartel_signals',
    ],
    mercadoPagoConfigurado: true,
    limites: {
      maxCompanies: 20,
      maxUsers: 15,
      maxMonitoredNotices: 150,
      maxNullityAnalysesMonth: 50,
      maxProposalsMonth: null,
    },
  },
];

export default function PlanosPage() {
  const user = useAuthStore((state) => state.user);
  const activePlanId = useAuthStore((state) => state.activePlanId);
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const setPlanAccess = useAuthStore((state) => state.setPlanAccess);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const [hasFallback, setHasFallback] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanos();
    void syncSubscription();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('status') !== 'success') return;

    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const confirmCheckout = async () => {
      try {
        await pagamentosApi.reconciliarAssinatura();
      } catch {
        // O webhook pode ainda estar processando; a consulta abaixo continuará tentando.
      }

      try {
        const response = await pagamentosApi.minhaAssinatura();
        const subscription = response.data?.data;
        if (!active || !subscription) return;
        setPlanAccess(subscription.plano, subscription.features);
        if (subscription.ativa) {
          toast.success(`Plano ${subscription.plano === 'pro' ? 'Avançado' : subscription.plano} ativado.`);
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      } catch (error) {
        console.error('[Planos] Falha ao confirmar o status do checkout.', error);
      }

      attempts += 1;
      if (attempts < 10 && active) {
        timer = setTimeout(() => void confirmCheckout(), 2_000);
      } else if (active) {
        toast.error('O pagamento ainda está em confirmação. A tela será atualizada quando o gateway confirmar a assinatura.');
      }
    };

    void confirmCheckout();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [setPlanAccess]);

  async function syncSubscription() {
    try {
      const response = await pagamentosApi.minhaAssinatura();
      const subscription = response.data?.data;
      if (subscription) {
        setPlanAccess(subscription.plano, subscription.features);
        return subscription;
      }
      return null;
    } catch (error) {
      console.warn('[Planos] Não foi possível consultar a assinatura atual.', error);
      return null;
    }
  }

  const fetchPlanos = async () => {
    setLoading(true);
    try {
      const response = await pagamentosApi.planos();
      if (response.data?.success && Array.isArray(response.data?.data) && response.data.data.length > 0) {
        const loaded = response.data.data.filter((p: Plan) => p.id !== 'free');
        if (loaded.length > 0) {
          setPlans(loaded);
          setHasFallback(false);
          return;
        }
      }
      setPlans(FALLBACK_PLANS);
      setHasFallback(true);
    } catch {
      setPlans(FALLBACK_PLANS);
      setHasFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    if (!planAccessLoaded && !user?.isTrialActive) {
      toast.error('Aguarde a confirmação do seu plano atual.');
      return;
    }

    if (activePlanId === planId && !user?.isTrialActive) {
      toast.success('Este já é o seu plano atual.');
      return;
    }

    if (activePlanId !== 'free' && activePlanId !== 'master' && !user?.isTrialActive) {
      toast.error('Para alterar uma assinatura ativa, fale com o suporte.');
      return;
    }

    setCheckoutLoading(planId);
    try {
      const response = await pagamentosApi.criarCheckout({ plano: planId });
      if (response.data?.success && response.data?.data?.url) {
        window.location.href = response.data.data.url;
        return;
      }
      toast.error('O Mercado Pago não retornou o endereço do checkout.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao iniciar checkout seguro do Mercado Pago.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-10">
      {/* Banner de Trial Ativo */}
      {user?.isTrialActive && (
        <div className="rounded-2xl border border-emerald-400 bg-emerald-500/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-emerald-950 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-xl shadow-sm">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-black">Você está no Período de Testes Oficial (Plano Master)</h2>
              <p className="text-xs text-emerald-900 font-medium">
                Acesso completo a 100% das ferramentas liberado por mais <strong>{user.daysLeftTrial ?? 15} dias</strong>. Aproveite para explorar o radar, emissor e robô de lances.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-700 text-white uppercase tracking-wider shadow-xs">
            Ativo até {user.trialEndsAt ? new Date(user.trialEndsAt).toLocaleDateString('pt-BR') : '15 dias'}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-brand-blue tracking-tight">
          Escale suas vendas para o Governo
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed font-medium">
          Escolha o plano ideal para a sua operação. Do licitante iniciante às grandes equipes estratégicas, a EXPERTISE impulsiona suas vitórias sob a Lei 14.133/2021.
        </p>

        {hasFallback && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <Warning className="w-4 h-4 text-amber-600" />
            <span>Exibindo catálogo oficial da plataforma.</span>
            <button
              onClick={() => void fetchPlanos()}
              className="underline text-amber-900 hover:text-black flex items-center gap-1 font-bold ml-1 cursor-pointer"
            >
              <ArrowClockwise className="w-3 h-3" /> Atualizar
            </button>
          </div>
        )}
      </div>

      {/* Cards de Planos */}
      {loading ? (
        <div className="flex h-64 w-full items-center justify-center">
          <Spinner className="h-8 w-8 animate-spin text-brand-blue" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 items-stretch">
          {plans.map((plan) => {
            const isCurrentPlan = activePlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-8 shadow-xl transition-all duration-300 hover:-translate-y-2 
                  ${plan.destaque ? 'border-brand-orange bg-gradient-to-b from-brand-blue to-slate-900 text-white transform md:-translate-y-4 md:hover:-translate-y-6' : 'border-slate-200 bg-white'}`}
              >
                {plan.destaque && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-orange text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                    <Star weight="fill" className="w-4 h-4" /> Mais Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-2xl font-black ${plan.destaque ? 'text-white' : 'text-brand-blue'}`}>
                    {plan.nome}
                  </h3>
                  <p className={`mt-2 text-sm min-h-[40px] ${plan.destaque ? 'text-slate-300' : 'text-slate-500'}`}>
                    {plan.descricao}
                  </p>
                </div>

                {isCurrentPlan && (
                  <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-800">
                    {user?.isTrialActive ? 'Plano liberado pelo Trial' : 'Plano atual'}
                  </div>
                )}

                <div className="mb-8">
                  <span className="text-4xl font-black tracking-tight">
                    R$ {(plan.valorCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-sm ml-2 ${plan.destaque ? 'text-slate-400' : 'text-slate-500'}`}>/ mês</span>
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={
                    checkoutLoading === plan.id ||
                    (isCurrentPlan && !user?.isTrialActive) ||
                    !plan.mercadoPagoConfigurado
                  }
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 cursor-pointer
                    ${plan.destaque 
                      ? 'bg-brand-orange text-white hover:bg-orange-600 active:scale-95 shadow-lg shadow-brand-orange/30' 
                      : 'bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 active:scale-95'}`}
                >
                  {checkoutLoading === plan.id ? (
                    <Spinner className="w-6 h-6 animate-spin" />
                  ) : isCurrentPlan && !user?.isTrialActive ? (
                    'Seu plano atual'
                  ) : !plan.mercadoPagoConfigurado ? (
                    'Checkout em configuração'
                  ) : user?.isTrialActive ? (
                    'Assinar para manter após o Trial'
                  ) : activePlanId !== 'free' ? (
                    'Fale com o suporte para alterar'
                  ) : (
                    'Assinar agora via Mercado Pago'
                  )}
                </button>

                <div className={`mt-8 space-y-4 flex-1 ${plan.destaque ? 'text-slate-300' : 'text-slate-600'}`}>
                  <div className="font-semibold text-sm uppercase tracking-wider mb-4 border-b border-current pb-2 opacity-50">
                    O que está incluído:
                  </div>
                  
                  <ul className="space-y-4 text-sm font-medium">
                    <li className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 ${plan.destaque ? 'text-brand-orange' : 'text-green-500'}`} weight="bold" />
                      <span>Até {plan.limites.maxCompanies} empresa(s) CNPJ</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 ${plan.destaque ? 'text-brand-orange' : 'text-green-500'}`} weight="bold" />
                      <span>Até {plan.limites.maxUsers} usuário(s)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 ${plan.destaque ? 'text-brand-orange' : 'text-green-500'}`} weight="bold" />
                      <span>{plan.limites.maxMonitoredNotices} editais monitorados simultâneos</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 ${plan.destaque ? 'text-brand-orange' : 'text-green-500'}`} weight="bold" />
                      <span>{plan.limites.maxNullityAnalysesMonth} análises de exigências por mês</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 ${plan.destaque ? 'text-brand-orange' : 'text-green-500'}`} weight="bold" />
                      <span>{plan.limites.maxProposalsMonth === null ? 'Propostas ilimitadas' : `${plan.limites.maxProposalsMonth} propostas por mês`}</span>
                    </li>
                    
                    {plan.id === 'pro' && (
                      <li className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-700">
                        <RocketLaunch className="w-5 h-5 text-brand-orange flex-shrink-0" weight="duotone" />
                        <span className="font-bold text-white">Relatórios Estratégicos & Robô de Lances</span>
                      </li>
                    )}
                    {plan.id === 'master' && (
                      <>
                        <li className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-200">
                          <ShieldCheck className="w-5 h-5 text-brand-blue flex-shrink-0" weight="duotone" />
                          <span className="font-bold text-brand-blue">Investigação Concorrencial & Cartéis</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Crown className="w-5 h-5 text-brand-blue flex-shrink-0" weight="duotone" />
                          <span className="font-bold text-brand-blue">Robô de Lances Avançado Ilimitado</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Footer Segurança */}
      <div className="mt-16 text-center flex flex-col items-center justify-center gap-2 opacity-70">
        <ShieldCheck className="w-8 h-8 text-emerald-600" />
        <p className="text-sm font-bold text-slate-700">
          Pagamento recorrente seguro processado pelo Mercado Pago.
        </p>
        <p className="text-xs text-slate-500">
          O acesso aos planos comerciais é ativado automaticamente com garantia incondicional de 7 dias.
        </p>
      </div>
    </div>
  );
}
