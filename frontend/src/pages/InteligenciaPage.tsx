import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Building2,
  CheckCircle2,
  MapPin,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
} from '@components/icons/phosphor-compat';
import { Link } from 'react-router-dom';
import api from '@services/api';

type Empresa = {
  id: string;
  razao_social: string;
  uf?: string | null;
  palavras_chave?: string[];
};

type Licitacao = {
  id: string;
  objeto: string;
  orgao: string;
  uf?: string;
  valor_estimado?: number;
  data_abertura?: string;
  score?: { pontuacao: number };
};

function formatMoney(value?: number) {
  if (!value) return 'Não informado';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function InteligenciaPage() {
  const intelligenceQuery = useQuery({
    queryKey: ['inteligencia', 'overview'],
    queryFn: async () => {
      const [empresasResponse, licitacoesResponse] = await Promise.all([
        api.get('/empresas'),
        api.get('/licitacoes', { params: { pagina: 1, tamanhoPagina: 50 } }),
      ]);

      return {
        empresas: (empresasResponse.data?.data ?? []) as Empresa[],
        licitacoes: (licitacoesResponse.data?.data ?? []) as Licitacao[],
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const empresa = intelligenceQuery.data?.empresas?.[0] ?? null;
  const licitacoes = intelligenceQuery.data?.licitacoes ?? [];

  const topOrgaos = useMemo(() => {
    const counts = new Map<string, number>();
    licitacoes.forEach((licitacao) => {
      if (!licitacao.orgao) return;
      counts.set(licitacao.orgao, (counts.get(licitacao.orgao) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([orgao, total]) => ({ orgao, total }));
  }, [licitacoes]);

  const topUfs = useMemo(() => {
    const counts = new Map<string, number>();
    licitacoes.forEach((licitacao) => {
      if (!licitacao.uf) return;
      counts.set(licitacao.uf, (counts.get(licitacao.uf) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([uf, total]) => ({ uf, total }));
  }, [licitacoes]);

  const resumo = useMemo(() => {
    const total = licitacoes.length;
    const altaPrioridade = licitacoes.filter((item) => (item.score?.pontuacao ?? 0) >= 80).length;
    const valores = licitacoes.map((item) => item.valor_estimado).filter((value): value is number => Number.isFinite(value));
    const mediaValor = valores.length ? valores.reduce((acc, current) => acc + current, 0) / valores.length : 0;

    return {
      total,
      altaPrioridade,
      mediaValor,
    };
  }, [licitacoes]);

  if (intelligenceQuery.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-brand-blue/70">Carregando dados oficiais...</div>;
  }

  if (intelligenceQuery.isError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center p-8 text-center text-brand-blue">
        <h1 className="text-2xl font-semibold">Inteligência indisponível</h1>
        <p className="mt-3 text-sm text-brand-blue/70">Não exibimos métricas simuladas quando as fontes reais falham.</p>
        <button type="button" onClick={() => intelligenceQuery.refetch()} className="mt-6 bg-brand-blue px-5 py-3 text-sm font-semibold text-white">Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-brand-blue">
            <span className="rounded-lg bg-white p-2">
              <BarChart2 className="h-6 w-6 text-brand-blue" />
            </span>
            Análise de mercado
          </h1>
          <p className="mt-1 text-sm text-brand-blue/70">
            Esta visão agora usa os dados reais já disponíveis no seu radar e no cadastro da empresa.
          </p>
        </div>

        <Link
          to="/licitante/licitacoes"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-blue px-4 py-3 text-sm font-bold text-white transition hover:bg-[#172554]"
        >
          <Search className="h-4 w-4" />
          Abrir radar
        </Link>
      </div>

      {!empresa ? (
        <div className="rounded-lg border border-gray-100 bg-white p-10 text-center shadow-sm">
          <Building2 className="mx-auto h-10 w-10 text-brand-blue/70" />
          <h2 className="mt-4 text-lg font-bold text-brand-blue">Vincule uma empresa para gerar leitura útil.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-brand-blue/70">
            Sem o CNPJ e os termos de busca da operação, este módulo não deve inventar concorrentes nem
            históricos. Ele passa a mostrar apenas sinais derivados dos dados reais da sua conta.
          </p>
          <Link
            to="/empresa"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-3 text-sm font-bold text-white transition hover:bg-[#172554]"
          >
            Configurar empresa
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                titulo: 'Empresa base',
                valor: empresa.razao_social,
                detalhe: empresa.uf || 'Sem UF definida',
                icon: Building2,
                tone: 'blue',
              },
              {
                titulo: 'Radar analisado',
                valor: String(resumo.total),
                detalhe: 'editais disponíveis para leitura',
                icon: Target,
                tone: 'emerald',
              },
              {
                titulo: 'Score alto',
                valor: String(resumo.altaPrioridade),
                detalhe: 'itens com score >= 80',
                icon: TrendingUp,
                tone: 'violet',
              },
              {
                titulo: 'Valor médio',
                valor: formatMoney(resumo.mediaValor),
                detalhe: 'média de valor estimado no radar',
                icon: ShieldCheck,
                tone: 'indigo',
              },
            ].map((card) => {
              const toneStyles: Record<string, string> = {
                blue: 'bg-white border-brand-blue/20 text-brand-blue',
                emerald: 'bg-white border-brand-blue/20 text-brand-blue',
                violet: 'bg-[#F3E8FF] border-brand-orange/30 text-[#334155]',
                indigo: 'bg-white border-brand-blue/20 text-brand-blue',
              };

              const Icon = card.icon;

              return (
                <div key={card.titulo} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">{card.titulo}</span>
                    <div className={`rounded-lg border p-2 ${toneStyles[card.tone]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-brand-blue">{card.valor}</p>
                  <p className="mt-2 text-sm text-brand-blue/70">{card.detalhe}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-bold text-brand-blue">Órgãos com maior recorrência no radar</h2>
              </div>

              {topOrgaos.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-brand-blue/70" />
                  <p className="mt-3 text-sm text-brand-blue/70">Ainda não há volume suficiente para mostrar recorrência por órgão.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {topOrgaos.map((item) => (
                    <div key={item.orgao} className="flex items-center justify-between gap-3 px-5 py-4">
                      <div>
                        <p className="text-sm font-bold text-brand-blue">{item.orgao}</p>
                        <p className="mt-1 text-xs text-brand-blue/70">Presença recorrente no universo consultado pela API.</p>
                      </div>
                      <span className="rounded-lg border border-brand-blue/20 bg-white px-3 py-1 text-xs font-bold text-brand-blue">
                        {item.total} ocorrências
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-6">
              <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-brand-blue">Termos de busca da empresa</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {empresa.palavras_chave && empresa.palavras_chave.length > 0 ? (
                    empresa.palavras_chave.map((keyword) => (
                      <span key={keyword} className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-xs font-bold text-brand-blue/70">
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-brand-blue/70">Nenhum termo de busca configurado ainda.</p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-brand-blue">
                  <MapPin className="h-4 w-4 text-brand-blue" />
                  UFs mais presentes
                </h2>
                <div className="mt-4 space-y-3">
                  {topUfs.length === 0 ? (
                    <p className="text-sm text-brand-blue/70">Sem distribuição geográfica suficiente no radar atual.</p>
                  ) : (
                    topUfs.map((item) => (
                      <div key={item.uf} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
                        <span className="text-sm font-bold text-brand-blue">{item.uf}</span>
                        <span className="text-xs font-bold text-brand-blue">{item.total} oportunidades</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-brand-blue">Leitura honesta do módulo</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-brand-blue/70">
                  <li>O módulo deixa de inventar concorrentes e passa a derivar sinais do radar ativo.</li>
                  <li>Para análise competitiva avançada, ainda serão necessárias integrações adicionais de mercado.</li>
                  <li>As próximas melhorias devem nascer de fontes reais, não de cenários simulados na interface.</li>
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


