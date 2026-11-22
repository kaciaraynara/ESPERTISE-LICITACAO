import { useState, useEffect } from 'react';
import {
  Check,
  Crown,
  RocketLaunch,
  ShieldCheck,
  Spinner,
  WhatsappLogo,
  EnvelopeSimple,
  Sparkle,
  X,
  ArrowRight,
  ArrowSquareOut,
  ChatCircleDots,
  Scales,
  QrCode,
  CreditCard,
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
  asaasConfigurado: boolean;
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
    asaasConfigurado: true,
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
    asaasConfigurado: true,
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
    asaasConfigurado: true,
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
  const [billingPeriod, setBillingPeriod] = useState<'mensal' | 'anual'>('mensal');  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

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
      const response = await pagamentosApi.criarCheckout({ plano: plan.id, billingType: formaPagamento, ciclo: billingPeriod === 'anual' ? 'YEARLY' : 'MONTHLY' });
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <ShieldCheck className="w-5 h-5" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Período de testes ativo • Plano Master liberado por {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'}
              </p>
              <p className="text-xs text-emerald-800">
                Escolha sua forma de pagamento e assine antes do término para manter sua operação ativa.
              </p>
            </div>
          </div>
          <span className="shrink-0 self-start sm:self-auto rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">
            {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Planos e Assinatura
          </h1>
          <p className="text-sm text-slate-600">
            Escolha a estrutura ideal para sua empresa operar na Lei 14.133/2021. Sem fidelidade e sem comissão sobre contratos.
          </p>
        </div>

        <div className="inline-flex self-start md:self-auto items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setBillingPeriod('mensal')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              billingPeriod === 'mensal'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod('anual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              billingPeriod === 'anual'
                ? 'bg-[#081C3A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Anual</span>
            <span className="rounded-md bg-brand-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
              -20%
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-72 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8 animate-spin text-brand-orange" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Carregando planos...
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const isCurrentPlan = activePlanId === plan.id;
              const basePrice = plan.valorCentavos > 0 ? plan.valorCentavos / 100 : plan.valor;
              const monthlyPrice = billingPeriod === 'anual' ? Math.round(basePrice * 0.8 * 100) / 100 : basePrice;
              const buttonCopy = getButtonCopy(plan, isCurrentPlan);

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                    plan.destaque
                      ? 'border-[#081C3A] bg-[#081C3A] text-white shadow-lg'
                      : 'border-slate-200 bg-white text-slate-800 shadow-xs'
                  }`}
                >
                  {(plan.destaque || plan.id === 'master') && (
                    <span className={`self-start mb-3 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      plan.destaque
                        ? 'bg-brand-orange text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {plan.destaque ? 'Mais escolhido' : 'Enterprise'}
                    </span>
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

                <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100/90 p-1">
                  <button
                    type="button"
                    onClick={() => setFormaPagamento('PIX')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                      formaPagamento === 'PIX'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" weight="bold" />
                    <span>Pix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormaPagamento('CREDIT_CARD')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                      formaPagamento === 'CREDIT_CARD'
                        ? 'bg-[#081C3A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" weight="bold" />
                    <span>Cartão</span>
                  </button>
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
        </>
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

            <div className="w-full grid grid-cols-2 gap-1.5 rounded-xl bg-white/10 p-1 mb-3">
              <button
                type="button"
                onClick={() => setFormaPagamento('PIX')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                  formaPagamento === 'PIX' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" weight="bold" />
                <span>Pix</span>
              </button>
              <button
                type="button"
                onClick={() => setFormaPagamento('CREDIT_CARD')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                  formaPagamento === 'CREDIT_CARD' ? 'bg-white text-[#081C3A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" weight="bold" />
                <span>Cartão</span>
              </button>
            </div>
            <button
              type="button"
              disabled={checkoutLoading === 'expertise_fiscal'}
              onClick={() => handlePlanAction({ id: 'expertise_fiscal', nome: 'Expertise Fiscal' } as any)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {checkoutLoading === 'expertise_fiscal' ? <Spinner className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" weight="bold" />}
              <span>Ativar Add-on no Asaas</span>
            </button>
          </div>
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