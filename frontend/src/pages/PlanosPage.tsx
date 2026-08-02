import { useState, useEffect } from 'react';
import { Check, Crown, RocketLaunch, Star, ShieldCheck, Spinner } from '@phosphor-icons/react';
import api from '@services/api';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  valorCentavos: number;
  destaque: boolean;
  limites: {
    maxCompanies: number;
    maxUsers: number;
    maxMonitoredNotices: number;
    maxNullityAnalysesMonth: number;
    maxProposalsMonth: number | null;
  };
}

export default function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    try {
      const response = await api.get('/pagamentos/planos');
      if (response.data.success) {
        setPlans(response.data.data.filter((p: Plan) => p.id !== 'free'));
      }
    } catch (error) {
      toast.error('Não foi possível carregar os planos no momento.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const response = await api.post('/pagamentos/checkout-auth', { plano: planId });
      if (response.data.success && response.data.data.url) {
        window.location.href = response.data.data.url;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao gerar checkout do Mercado Pago.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-brand-blue tracking-tight">
          Escale suas vendas para o Governo
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Escolha o plano ideal para a sua operação. Do licitante iniciante às grandes equipes estratégicas, a EXPERTISE impulsiona suas vitórias.
        </p>
      </div>

      {/* Cards de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 items-stretch">
        {plans.map((plan) => (
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

            <div className="mb-8">
              <span className="text-4xl font-black tracking-tight">
                R$ {(plan.valorCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-sm ml-2 ${plan.destaque ? 'text-slate-400' : 'text-slate-500'}`}>/ mês</span>
            </div>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={checkoutLoading === plan.id}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                ${plan.destaque 
                  ? 'bg-brand-orange text-white hover:bg-orange-600 active:scale-95 shadow-lg shadow-brand-orange/30' 
                  : 'bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 active:scale-95'}`}
            >
              {checkoutLoading === plan.id ? (
                <Spinner className="w-6 h-6 animate-spin" />
              ) : (
                'Assinar agora'
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
                  <span>{plan.limites.maxNullityAnalysesMonth} análises de nulidade c/ IA (mês)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className={`w-5 h-5 flex-shrink-0 ${plan.destaque ? 'text-brand-orange' : 'text-green-500'}`} weight="bold" />
                  <span>{plan.limites.maxProposalsMonth === null ? 'Propostas ilimitadas' : `${plan.limites.maxProposalsMonth} propostas automáticas (mês)`}</span>
                </li>
                
                {/* Funcionalidades Extras Específicas por Plano */}
                {plan.id === 'pro' && (
                  <li className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-700">
                    <RocketLaunch className="w-5 h-5 text-brand-orange flex-shrink-0" weight="duotone" />
                    <span className="font-bold text-white">Relatórios Estratégicos</span>
                  </li>
                )}
                {plan.id === 'master' && (
                  <>
                    <li className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-200">
                      <ShieldCheck className="w-5 h-5 text-brand-blue flex-shrink-0" weight="duotone" />
                      <span className="font-bold text-brand-blue">Investigação Concorrencial</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Crown className="w-5 h-5 text-brand-blue flex-shrink-0" weight="duotone" />
                      <span className="font-bold text-brand-blue">Robô de Lances Avançado</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer Segurança */}
      <div className="mt-16 text-center flex flex-col items-center justify-center gap-2 opacity-60">
        <ShieldCheck className="w-8 h-8 text-slate-500" />
        <p className="text-sm font-medium text-slate-500">
          Pagamento 100% seguro processado via Mercado Pago. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
