import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRinging,
  Buildings,
  CheckCircle,
  CheckSquare,
  ClockCounterClockwise,
  CreditCard,
  ShieldCheck,
  SpinnerGap,
  Trophy,
  WarningCircle,
} from '@phosphor-icons/react';
import api, { notificacoesApi, pagamentosApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

type PlanoApi = {
  id: string;
  nome?: string;
  descricao?: string;
  valor: number;
  valorCentavos?: number;
  destaque?: boolean;
  limites?: {
    maxCompanies: number;
    maxUsers: number;
    maxMonitoredNotices: number;
    maxNullityAnalysesMonth: number;
    maxProposalsMonth: number | null;
  };
};

const PLATFORM_PLANS = [
  {
    id: 'basic',
    nome: 'Básico',
    preco: 69.99,
    icon: ShieldCheck,
    descricao: 'Para começar com controle, organização e análises essenciais antes de disputar.',
    features: [
      '1 empresa cadastrada',
      'Até 2 usuários',
      'Até 10 editais monitorados',
      '3 análises de nulidade por mês',
      '5 propostas por mês',
      'Radar de Editais e documentos essenciais',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 149.99,
    icon: Trophy,
    destaque: true,
    descricao: 'Para licitantes recorrentes que precisam analisar oportunidades, preço e risco com mais estratégia.',
    features: [
      'Até 5 empresas',
      'Até 5 usuários',
      'Até 50 editais monitorados',
      '30 análises de nulidade por mês',
      '30 propostas por mês',
      'Score, SRP e Carona, precificação e relatórios simples',
    ],
  },
  {
    id: 'master',
    nome: 'Master',
    preco: 249.99,
    icon: Buildings,
    descricao: 'Para operação profissional com investigação concorrencial, relatórios estratégicos e equipe ampliada.',
    features: [
      'Até 10 empresas',
      'Até 10 usuários',
      'Até 200 editais monitorados',
      '100 análises de nulidade por mês',
      'Investigação Concorrencial',
      'Catálogo completo, LEX avançado e relatórios estratégicos',
    ],
  },
];

export default function PlanosPage() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null);
  const user = useAuthStore((state) => state.user);
  const planoUsuarioNormalizado = normalizePlanoUsuarioAtual(user?.plano);

  const planosQuery = useQuery({
    queryKey: ['pagamentos', 'planos'],
    queryFn: async () => {
      const response = await api.get('/pagamentos/planos');
      return response.data?.data as PlanoApi[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const checkout = useMutation({
    mutationFn: async (planoId: string) => {
      if (!user) {
        throw new Error('AUTH_REQUIRED');
      }

      const response = await pagamentosApi.criarCheckout({
        plano: planoId,
      });

      return response.data?.data ?? response.data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('O checkout não retornou uma URL válida.');
      }
    },
    onError: (error) => {
      if ((error as Error).message === 'AUTH_REQUIRED') {
        toast.error('Faça login para assinar um plano.');
        window.location.href = '/login';
        return;
      }

      toast.error('Erro ao iniciar checkout. Verifique se o plano está configurado no Mercado Pago.');
    },
  });

  if (planosQuery.isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-50 p-8 text-center text-brand-blue">
        <h1 className="text-2xl font-semibold">Planos indisponíveis</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-brand-blue/70">
          Não foi possível consultar os preços oficiais agora. Nenhum valor estimado será exibido.
        </p>
        <button
          type="button"
          onClick={() => planosQuery.refetch()}
          className="mt-6 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-brand-blue">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 lg:px-8">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-orange">
                Planos EXPERTISE
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
                Escolha o plano certo para disputar licitações com mais controle.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                As travas são aplicadas no backend: empresas, usuários, análises, propostas e recursos estratégicos respeitam o plano ativo.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-blue/10 bg-brand-blue p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Regra atual
              </p>
              <p className="mt-3 text-2xl font-semibold">
                Básico, Pro e Master
              </p>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Básico e Pro têm travas comerciais fortes. Master libera a operação estratégica com limite de segurança.
              </p>
            </div>
          </div>
        </header>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue/70">
                Fornecedor / Licitante
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Planos oficiais da plataforma
              </h2>
            </div>

            {planosQuery.isFetching ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue/70">
                <SpinnerGap className="h-4 w-4 animate-spin" weight="thin" />
                Sincronizando
              </span>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {PLATFORM_PLANS.map((plano) => {
              const planoApi = planosQuery.data?.find((item) => item.id === plano.id);
              const precoFinal = planoApi?.valor ?? plano.preco;
              const Icon = plano.icon;
              const isActive = planoUsuarioNormalizado === plano.id;

              return (
                <motion.article
                  key={plano.id}
                  whileHover={{ y: -4 }}
                  className={`flex min-h-[560px] flex-col rounded-3xl border bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] ${
                    plano.destaque ? 'border-brand-orange ring-2 ring-brand-orange/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-blue/10 bg-brand-blue/5 text-brand-blue">
                      <Icon className="h-6 w-6" weight="thin" />
                    </span>

                    {plano.destaque ? (
                      <span className="rounded-full border border-brand-orange bg-brand-orange/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
                        Mais escolhido
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6">
                    <h3 className="text-2xl font-semibold text-slate-950">{plano.nome}</h3>
                    <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{plano.descricao}</p>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-blue/70">
                      Mensalidade
                    </p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                      R$ {formatCurrency(precoFinal)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Cobrança mensal via Mercado Pago.
                    </p>
                  </div>

                  <ul className="mt-5 flex-1 space-y-3">
                    {plano.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm leading-6 text-slate-600">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" weight="fill" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isActive ? (
                      <button
                        type="button"
                        disabled
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-blue/20 bg-brand-blue/5 text-sm font-semibold uppercase tracking-[0.14em] text-brand-blue"
                      >
                        <CreditCard className="h-4 w-4" weight="thin" />
                        Plano ativo
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`btn-checkout-${plano.id}`}
                        onClick={() => checkout.mutate(plano.id)}
                        disabled={checkout.isPending || planosQuery.isFetching}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:shadow-[0_0_24px_rgba(30,58,138,0.22)] disabled:opacity-60"
                      >
                        {checkout.isPending && checkout.variables === plano.id ? (
                          <SpinnerGap className="h-4 w-4 animate-spin" weight="thin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" weight="thin" />
                        )}
                        Assinar {plano.nome}
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
          <button
            type="button"
            onClick={() => setFaqAberto(faqAberto === 0 ? null : 0)}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <span className="text-sm font-semibold text-slate-950">
              Qual plano devo oferecer primeiro para o cliente?
            </span>
            <ArrowRight className={`h-4 w-4 text-brand-blue/70 transition ${faqAberto === 0 ? 'rotate-90' : ''}`} weight="thin" />
          </button>

          {faqAberto === 0 ? (
            <div className="border-t border-slate-100 px-6 py-5 text-sm leading-7 text-slate-600">
              O Básico é a porta de entrada. O Pro é o plano mais vendável para quem já disputa com frequência. O Master é o plano estratégico, indicado para equipes, múltiplas empresas, investigação concorrencial e relatórios avançados.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function normalizePlanoUsuarioAtual(plano?: string | null) {
  const normalized = String(plano || '').trim().toLowerCase();

  const aliases: Record<string, string> = {
    basic: 'basic',
    basico: 'basic',
    básico: 'basic',
    starter: 'basic',
    pro: 'pro',
    profissional: 'pro',
    premium: 'pro',
    master: 'master',
    enterprise: 'master',
    avancado: 'master',
    avançado: 'master',
  };

  return aliases[normalized] ?? normalized;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
export function NotificacoesPage() {
  const queryClient = useQueryClient();
  const notificacoesQuery = useQuery({
    queryKey: ['notificacoes'],
    queryFn: async () => {
      const response = await notificacoesApi.listar();
      return response.data?.data as Array<{
        id: string;
        tipo: string;
        titulo: string;
        mensagem: string;
        created_at: string;
        lida?: boolean;
        link?: string | null;
      }>;
    },
    refetchInterval: 60_000,
  });

  const marcarTodas = useMutation({
    mutationFn: () => notificacoesApi.marcarTodasComoLidas(),
    onSuccess: () => {
      toast.success('Alertas marcados como lidos.');
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const notificacoes = notificacoesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue/70">Central executiva</p>
          <h1 className="mt-2 text-2xl font-semibold text-brand-blue">Alertas e notificacoes</h1>
        </div>
        <button
          type="button"
          onClick={() => marcarTodas.mutate()}
          disabled={marcarTodas.isPending || notificacoes.length === 0}
          className="inline-flex items-center gap-2 border border-gray-100 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue transition hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
        >
          {marcarTodas.isPending ? <SpinnerGap className="h-4 w-4 animate-spin" weight="thin" /> : <CheckSquare className="h-4 w-4" weight="thin" />}
          Marcar como lido
        </button>
      </header>

      {notificacoesQuery.isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse border border-gray-100 bg-white shadow-[0_4px_20px_rgba(30,58,138,0.05)]" />
          ))}
        </div>
      ) : notificacoes.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-gray-100 bg-white p-10 text-center shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
          <BellRinging className="h-12 w-12 text-brand-blue/70" weight="thin" />
          <p className="mt-4 text-sm font-semibold text-brand-blue">Nenhum alerta por enquanto</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-brand-blue/70">
            Certidoes, editais, SOS e movimentacoes do sistema aparecem aqui assim que forem registrados.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 bg-white shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
          {notificacoes.map((item) => {
            const Icon = resolveNotificationIcon(item.tipo);
            return (
              <a
                key={item.id}
                href={item.link || '#'}
                className={`flex gap-4 px-5 py-4 transition hover:bg-white ${item.lida ? 'opacity-70' : ''}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-gray-100 bg-white text-brand-blue">
                  <Icon className="h-5 w-5" weight="thin" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-brand-blue">{item.titulo}</span>
                    <span className="text-xs text-brand-blue/70">{formatHoraRelativa(item.created_at)}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-brand-blue/70">{item.mensagem}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatHoraRelativa(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'agora';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function resolveNotificationIcon(tipo: string) {
  if (tipo === 'prazo_proximo') return WarningCircle;
  if (tipo === 'nova_oportunidade') return BellRinging;
  if (tipo === 'score_alto') return Trophy;
  return ClockCounterClockwise;
}
