import { useState, useEffect } from 'react';
import {
  Check,
  Crown,
  RocketLaunch,
  Star,
  ShieldCheck,
  Spinner,
  WhatsappLogo,
  EnvelopeSimple,
  Buildings,
  Receipt,
  Sparkle,
  X,
  ArrowRight,
  ArrowSquareOut,
  ChatCircleDots,
  Scales,
} from '@phosphor-icons/react';
import { pagamentosApi } from '@services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { isUserTrialActive, getTrialDaysLeft } from '@/components/layout/Sidebar';

interface PlanLimits {
  maxCompanies: number;
  maxUsers: number;
  maxMonitoredNotices: number;
  maxNullityAnalysesMonth: number;
  maxProposalsMonth: number | null;
}

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  valorCentavos: number;
  destaque: boolean;
  features: string[];
  mercadoPagoConfigurado: boolean;
  limites: PlanLimits;
}

const COMMERCIAL_WHATSAPP =
  (import.meta.env.VITE_COMMERCIAL_WHATSAPP as string | undefined)?.replace(/\D/g, '') ||
  '5511999999999';

const COMMERCIAL_EMAIL = 'comercial@expertiselicitatoria.com.br';

export function buildCommercialWhatsAppUrl(
  planName: string,
  userEmail?: string | null,
  companyName?: string | null,
): string {
  const accountInfo = userEmail ? ` Minha conta: ${userEmail}.` : '';
  const companyInfo = companyName ? ` Empresa: ${companyName}.` : '';
  const text = `Olá, desejo ativar o Plano ${planName} na Expertise Licitatória.${accountInfo}${companyInfo}`;
  return `https://wa.me/${COMMERCIAL_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'basic',
    nome: 'Básico',
    descricao: 'Para licitantes iniciando a operação estruturada com até 5 CNPJs e 15 propostas mensais.',
    valor: 99.99,
    valorCentavos: 9999,
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
      maxMonitoredNotices: 15,
      maxNullityAnalysesMonth: 50,
      maxProposalsMonth: 15,
    },
  },
  {
    id: 'pro',
    nome: 'Avançado',
    descricao: 'Para empresas em expansão que exigem inteligência estratégica, robô de lances e precificação.',
    valor: 199.99,
    valorCentavos: 19999,
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
      maxNullityAnalysesMonth: 150,
      maxProposalsMonth: 50,
    },
  },
  {
    id: 'master',
    nome: 'Master',
    descricao: 'Operações de alta performance: propostas ilimitadas, robô de reajuste, garantias e inteligência anticartel.',
    valor: 499.99,
    valorCentavos: 49999,
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
      'malha_fina_qsa',
      'gestao_garantias',
      'robo_reajuste',
      'assistente_repactuacao',
      'assistente_reequilibrio',
    ],
    mercadoPagoConfigurado: true,
    limites: {
      maxCompanies: 20,
      maxUsers: 10,
      maxMonitoredNotices: 200,
      maxNullityAnalysesMonth: 100,
      maxProposalsMonth: null,
    },
  },
];

interface ConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
  billingPeriod: 'mensal' | 'anual';
  userEmail?: string | null;
  companyName?: string | null;
}

function ConsultantModal({
  isOpen,
  onClose,
  plan,
  billingPeriod,
  userEmail,
  companyName,
}: ConsultantModalProps) {
  if (!isOpen || !plan) return null;

  const basePrice = plan.valorCentavos > 0 ? plan.valorCentavos / 100 : plan.valor;
  const monthlyPrice = billingPeriod === 'anual' ? Math.round(basePrice * 0.8 * 100) / 100 : basePrice;
  const formattedPrice = monthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const whatsAppUrl = buildCommercialWhatsAppUrl(plan.nome, userEmail, companyName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-consultant-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-blue-600/10 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" weight="bold" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
            <ChatCircleDots className="w-7 h-7" weight="duotone" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0A2540] text-[11px] font-black uppercase tracking-wider">
            <Sparkle className="w-3.5 h-3.5 text-amber-500" weight="fill" />
            Ativação Corporativa B2B
          </div>

          <h3 id="modal-consultant-title" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Integração de pagamento em finalização. Fale com um consultor.
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            Nosso checkout automatizado está recebendo atualizações de conformidade bancária. Para que sua operação não sofra interrupções, nossa equipe comercial realiza a liberação imediata da sua conta.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Plano Selecionado
              </span>
              <span className="text-lg font-black text-brand-blue">
                Plano {plan.nome}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                R$ {formattedPrice}
              </span>
              <span className="text-[11px] text-slate-500 block">/mês ({billingPeriod})</span>
            </div>
          </div>

          <div className="pt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" weight="bold" />
              <span>Até <strong>{plan.limites.maxCompanies} empresas (CNPJs)</strong> vinculadas</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" weight="bold" />
              <span>Até <strong>{plan.limites.maxUsers} licenças</strong> de usuário na equipe</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" weight="bold" />
              <span>Opções de faturamento: <strong>PIX Imediato, Boleto Bancário PJ ou Cartão</strong></span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm tracking-wide flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <WhatsappLogo className="w-5 h-5" weight="fill" />
            <span>Falar com Consultor via WhatsApp</span>
            <ArrowSquareOut className="w-4 h-4 opacity-80 ml-auto" weight="bold" />
          </a>

          <a
            href={`mailto:${COMMERCIAL_EMAIL}?subject=${encodeURIComponent(`Ativação do Plano ${plan.nome} - Expertise Licitatória`)}&body=${encodeURIComponent(`Olá equipe comercial,\n\nDesejo ativar o Plano ${plan.nome} (${billingPeriod}) na Expertise Licitatória.\nE-mail da conta: ${userEmail || ''}\nEmpresa: ${companyName || ''}\n\nPor favor, enviem os dados de faturamento.`)}`}
            className="w-full py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <EnvelopeSimple className="w-4 h-4" weight="bold" />
            <span>Solicitar Faturamento por E-mail</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-700 transition py-1 cursor-pointer"
          >
            Voltar para a tabela de planos
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" weight="fill" />
          <span>Atendimento empresarial de segunda a sexta, das 08h às 18h (Horário de Brasília)</span>
        </div>
      </div>
    </div>
  );
}

export default function PlanosPage() {
  const user = useAuthStore((state) => state.user);
  const activePlanId = useAuthStore((state) => state.activePlanId);
  const setPlanAccess = useAuthStore((state) => state.setPlanAccess);

  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'mensal' | 'anual'>('mensal');

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isConsultantModalOpen, setIsConsultantModalOpen] = useState(false);

  const userTrialActive = isUserTrialActive(user);
  const trialDaysRemaining = getTrialDaysLeft(user);

  useEffect(() => {
    void fetchPlanos();
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
        // Webhook pode estar processando
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
        timer = setTimeout(() => void confirmCheckout(), 2000);
      } else if (active) {
        toast.error('O pagamento ainda está em confirmação. Atualize a tela em instantes.');
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
    } catch {
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
          return;
        }
      }
      setPlans(FALLBACK_PLANS);
    } catch {
      setPlans(FALLBACK_PLANS);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanAction = async (plan: Plan) => {
    const isCurrentPlan = activePlanId === plan.id;
    if (isCurrentPlan && !userTrialActive) {
      toast.success('Este já é o seu plano atual ativo.');
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const response = await pagamentosApi.criarCheckout({ plano: plan.id });
      const checkoutUrl = response.data?.data?.url;
      if (response.data?.success && checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      setSelectedPlan(plan);
      setIsConsultantModalOpen(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg && err?.response?.status !== 503) {
        toast.error(msg);
      } else {
        setSelectedPlan(plan);
        setIsConsultantModalOpen(true);
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getButtonCopy = (plan: Plan, isCurrentPlan: boolean) => {
    if (isCurrentPlan && !userTrialActive) {
      return 'Plano Atual Ativo';
    }
    if (plan.id === 'basic') {
      return 'Assinar Plano';
    }
    return 'Fazer Upgrade';
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10 font-sans selection:bg-brand-orange selection:text-white">
      {userTrialActive && (
        <div className="rounded-3xl border border-emerald-400 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-5 text-emerald-950 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white font-black text-2xl shadow-md">
              ⚡
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 text-[10px] font-black uppercase tracking-wider mb-1">
                Acesso Master Liberado
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-emerald-950">
                Você está no Período de Testes Oficial (15 Dias de Plano Master)
              </h2>
              <p className="text-xs sm:text-sm text-emerald-800 font-medium">
                Todas as 4 Centrais Estratégicas estão ativas por mais <strong>{trialDaysRemaining} dias</strong>. Garanta a continuidade da sua operação assinando seu plano antes do término.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-xl text-xs font-black bg-emerald-700 text-white uppercase tracking-wider shadow-sm">
            {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}
          </span>
        </div>
      )}

      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-dark/5 border border-brand-dark/15 text-brand-dark text-xs font-black uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-brand-orange" weight="fill" />
          Planos Comerciais • Plataforma Oficial 2026
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-dark tracking-tight">
          Escale suas Vendas para o Governo
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium max-w-2xl mx-auto">
          Escolha a estrutura adequada para sua empresa vencer mais licitações sob a Nova Lei 14.133/2021. Sem fidelidade, sem carência e sem comissão sobre contratos ganhos.
        </p>

        <div className="pt-4 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-slate-100 border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setBillingPeriod('mensal')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                billingPeriod === 'mensal'
                  ? 'bg-white text-brand-dark shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faturamento Mensal
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('anual')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                billingPeriod === 'anual'
                  ? 'bg-brand-dark text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Faturamento Anual</span>
              <span className="bg-brand-orange text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                -20% OFF
              </span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-72 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8 animate-spin text-brand-orange" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Carregando catálogo corporativo...
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10 items-stretch">
          {plans.map((plan) => {
            const isCurrentPlan = activePlanId === plan.id;
            const basePrice = plan.valorCentavos > 0 ? plan.valorCentavos / 100 : plan.valor;
            const monthlyPrice = billingPeriod === 'anual' ? Math.round(basePrice * 0.8 * 100) / 100 : basePrice;
            const buttonCopy = getButtonCopy(plan, isCurrentPlan);

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-8 shadow-xl transition-all duration-300 hover:-translate-y-1.5 ${
                  plan.destaque
                    ? 'border-brand-orange bg-gradient-to-b from-brand-dark via-[#0a2347] to-brand-dark text-white transform md:-translate-y-3 md:hover:-translate-y-5 shadow-orange-500/10'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                {plan.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-orange text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md whitespace-nowrap">
                    <Star weight="fill" className="w-3.5 h-3.5" /> Mais Escolhido
                  </div>
                )}

                {plan.id === 'master' && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-dark text-amber-400 border border-amber-400/30 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md whitespace-nowrap">
                    <Crown weight="fill" className="w-3.5 h-3.5" /> Enterprise • Premium
                  </div>
                )}

                <div className="mb-6 pt-2">
                  <h3 className={`text-2xl font-black ${plan.destaque ? 'text-white' : 'text-brand-dark'}`}>
                    {plan.nome}
                  </h3>
                  <p className={`mt-2 text-xs sm:text-sm min-h-[44px] leading-relaxed font-medium ${plan.destaque ? 'text-slate-300' : 'text-slate-600'}`}>
                    {plan.descricao}
                  </p>
                </div>

                {isCurrentPlan && (
                  <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" weight="bold" />
                    <span>{userTrialActive ? 'Plano liberado durante o Teste Gratuito' : 'Seu plano atual ativo'}</span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-black uppercase text-slate-400">R$</span>
                    <span className="text-4xl sm:text-5xl font-black tracking-tight">
                      {monthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs ml-1 font-bold ${plan.destaque ? 'text-slate-400' : 'text-slate-500'}`}>
                      /mês
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 font-medium ${plan.destaque ? 'text-slate-400' : 'text-slate-500'}`}>
                    {billingPeriod === 'anual' ? 'Faturamento anual com 20% de economia' : 'Faturamento mensal recorrente'}
                  </p>
                </div>

                <button
                  type="button"
                  id={`btn-plan-${plan.id}`}
                  onClick={() => handlePlanAction(plan)}
                  disabled={checkoutLoading === plan.id || (isCurrentPlan && !userTrialActive)}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    isCurrentPlan && !userTrialActive
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-brand-orange hover:bg-orange-600 text-white shadow-orange-500/30 hover:shadow-orange-500/50 active:scale-98'
                  }`}
                >
                  {checkoutLoading === plan.id ? (
                    <Spinner className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>{buttonCopy}</span>
                      <ArrowRight className="w-4 h-4" weight="bold" />
                    </>
                  )}
                </button>

                <div className={`mt-8 space-y-3.5 flex-1 pt-6 border-t ${plan.destaque ? 'border-white/10 text-slate-200' : 'border-slate-100 text-slate-700'}`}>
                  <p className="font-black text-[11px] uppercase tracking-widest opacity-60">
                    O que está incluído:
                  </p>

                  <ul className="space-y-3 text-xs sm:text-sm font-medium">
                    <li className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.destaque ? 'text-brand-orange' : 'text-emerald-600'}`} weight="bold" />
                      <span>Até <strong>{plan.limites.maxCompanies} empresas (CNPJs)</strong></span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.destaque ? 'text-brand-orange' : 'text-emerald-600'}`} weight="bold" />
                      <span>Até <strong>{plan.limites.maxUsers} usuário(s)</strong> na equipe</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.destaque ? 'text-brand-orange' : 'text-emerald-600'}`} weight="bold" />
                      <span><strong>{plan.limites.maxMonitoredNotices} editais</strong> monitorados simultâneos</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.destaque ? 'text-brand-orange' : 'text-emerald-600'}`} weight="bold" />
                      <span>
                        {plan.limites.maxProposalsMonth === null ? (
                          <strong className="text-emerald-500">Propostas comerciais ilimitadas</strong>
                        ) : (
                          <span>Até <strong>{plan.limites.maxProposalsMonth} propostas</strong> geradas/mês</span>
                        )}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.destaque ? 'text-brand-orange' : 'text-emerald-600'}`} weight="bold" />
                      <span>Radar de Editais (Lei 14.133/21)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.destaque ? 'text-brand-orange' : 'text-emerald-600'}`} weight="bold" />
                      <span>Cofre de Documentos & Alerta de Certidões</span>
                    </li>

                    {plan.id === 'pro' && (
                      <li className="flex items-start gap-2.5 pt-2 border-t border-white/10 text-white font-bold">
                        <RocketLaunch className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" weight="duotone" />
                        <span>Envio Automático de Lances, Quadro de Etapas & Lex</span>
                      </li>
                    )}

                    {plan.id === 'master' && (
                      <>
                        <li className="flex items-start gap-2.5 pt-2 border-t border-slate-100 font-bold text-brand-dark">
                          <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" weight="fill" />
                          <span>Robô de Reajuste & Assistente de Repactuação</span>
                        </li>
                        <li className="flex items-start gap-2.5 font-bold text-brand-dark">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" weight="bold" />
                          <span>Garantias Retidas (Art. 96) & Inteligência Anticartel</span>
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

      <section className="rounded-3xl border-2 border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black uppercase tracking-wider">
              <Scales className="w-4 h-4 text-indigo-400" weight="fill" />
              Complemento Oficial • Add-on Estratégico
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Expertise Fiscal: Blindagem Tributária de Contratos
            </h2>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
              Compatível com qualquer plano (Básico, Avançado ou Master). Audite retenções na fonte, recupere créditos fiscais e simule os impactos da Reforma Tributária (CBS/IBS) com alíquotas reais versionadas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-200">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                <span><strong>Retenções IN 1.234/12 & 2.145/23:</strong> Auditoria de notas fiscais de bens (5,85%) e serviços (9,45%).</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                <span><strong>INSS 11% / CPRB 3,5%:</strong> Dedução de materiais e cessão de mão de obra (IN RFB nº 2.110/22).</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                <span><strong>Segregação Monofásica:</strong> Identificação e restituição de PIS/COFINS pago a maior no PGDAS.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                <span><strong>Reforma Tributária (LC 214/2025):</strong> Simulação de CBS 0,9% + IBS 0,1% e redutores de 60%/30%.</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-auto shrink-0 flex flex-col items-center lg:items-end justify-center rounded-2xl bg-white/5 border border-white/10 p-6 sm:p-7 backdrop-blur-sm text-center lg:text-right">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
              Valor Adicional por Empresa
            </span>
            <div className="flex items-baseline justify-center lg:justify-end gap-1 mb-2">
              <span className="text-xs font-black uppercase text-indigo-200">+ R$</span>
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">99,99</span>
              <span className="text-xs font-bold text-slate-300">/mês</span>
            </div>
            <span className="text-[11px] text-slate-400 block mb-5">
              Sem fidelidade • Adicione ao seu plano a qualquer momento
            </span>

            <a
              href={`https://wa.me/${COMMERCIAL_WHATSAPP}?text=${encodeURIComponent(`Olá, desejo contratar o Add-on Expertise Fiscal (+R$ 99,99/mês) na Expertise Licitatória.${user?.email ? ` Minha conta: ${user.email}.` : ''}${user?.company?.razaoSocial ? ` Empresa: ${user.company.razaoSocial}.` : ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <WhatsappLogo className="w-4 h-4" weight="fill" />
              <span>Ativar Add-on Expertise Fiscal</span>
              <ArrowSquareOut className="w-4 h-4" weight="bold" />
            </a>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-xl sm:text-2xl font-black text-brand-dark tracking-tight">
            Garantia de Excelência e Conformidade Corporativa
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Estrutura desenhada para atender desde departamentos de licitação enxutos até grandes grupos empresariais.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue border border-brand-blue/30">
              <Receipt className="w-5 h-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Faturamento Flexível
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Opção de faturamento por boleto para PJ, PIX ou cartão corporativo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Buildings className="w-5 h-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Nota Fiscal Automática
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Emissão de NF-e mensal vinculada diretamente ao CNPJ contratante.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange border border-orange-200">
              <ShieldCheck className="w-5 h-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Lei 14.133/21 & LGPD
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Segurança jurídica e proteção integral de dados estratégicos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
              <Crown className="w-5 h-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Sem Comissão de Êxito
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                100% do valor do contrato conquistado pertence exclusivamente à sua empresa.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Precisa de contrato sob medida com múltiplos CNPJs ou Acordo de Nível de Serviço (SLA)?</span>
          </div>

          <a
            href={buildCommercialWhatsAppUrl('Personalizado / Enterprise', user?.email, user?.company?.razaoSocial)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-brand-orange hover:text-orange-700 underline cursor-pointer"
          >
            <WhatsappLogo className="w-4 h-4" weight="fill" />
            <span>Falar com a Diretoria Comercial →</span>
          </a>
        </div>
      </section>

      <ConsultantModal
        isOpen={isConsultantModalOpen}
        onClose={() => setIsConsultantModalOpen(false)}
        plan={selectedPlan}
        billingPeriod={billingPeriod}
        userEmail={user?.email}
        companyName={user?.company?.razaoSocial}
      />
    </div>
  );
}