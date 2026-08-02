import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Copy,
  DollarSign,
  Factory,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  UploadCloud,
} from '@components/icons/phosphor-compat';
import toast from 'react-hot-toast';
import { marketplaceApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';

type MarketplaceItem = {
  id: string;
  nome_comercial: string;
  descricao_original: string;
  preco_unitario: number;
  unidade: string;
  ncm: string | null;
  segmento_macro: string;
  fornecedor_dados: {
    nome: string;
    cnpj: string | null;
    contato: string | null;
    localizacao: string | null;
    cidade: string | null;
    uf: string | null;
  };
  score_licitacao: number;
  origem_dado: string;
  created_at: string;
  updated_at: string;
};

type MarketplaceListData = {
  data: MarketplaceItem[];
  meta: {
    total: number;
    totalCatalogo: number;
    origemCompartilhada: boolean;
  };
};

type MarketplaceSearchResult = MarketplaceItem & {
  match_score: number;
  match_nivel: 'alto' | 'medio' | 'baixo';
  justificativa_match: string;
  vantagem_preco: string;
};

type MarketplaceCotacaoData = {
  consulta: {
    descricao_item: string;
    termos_identificados: string[];
    segmento_inferido: string;
    empresa_base: {
      razao_social: string;
      cnpj: string;
      uf: string | null;
    } | null;
  };
  resultados: MarketplaceSearchResult[];
  meta: {
    totalEncontrados: number;
    faixaPreco: {
      menor: number;
      maior: number;
      medio: number;
    } | null;
    observacoes: string[];
  };
};

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Sem preco';
  }

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value?: string) {
  if (!value) return 'Agora';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Agora';
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCnpj(value?: string | null) {
  if (!value) return 'CNPJ nao informado';
  if (value.length !== 14) return value;
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function ResultCard({ item }: { item: MarketplaceSearchResult }) {
  return (
    <article className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)] transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:shadow-lg hover:shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-brand-blue/20 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue">
              {item.segmento_macro}
            </span>
            <span className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
              item.match_nivel === 'alto'
                ? 'border border-brand-blue/20 bg-white text-brand-blue'
                : item.match_nivel === 'medio'
                  ? 'border border-brand-orange/50 bg-brand-orange/10 text-brand-blue'
                  : 'border border-gray-100 bg-white text-brand-blue/70'
            }`}>
              Match {item.match_score}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-bold tracking-tight text-brand-blue">{item.nome_comercial}</h3>
          <p className="mt-1 text-sm font-semibold text-brand-blue/70">{item.fornecedor_dados.nome}</p>
        </div>

        <div className="rounded-[24px] border border-[#D8E6FF] bg-white px-4 py-3 text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E6FB7]">Preco unitario</p>
          <p className="mt-1 text-2xl font-bold text-brand-blue">{formatCurrency(item.preco_unitario)}</p>
          <p className="text-xs font-semibold text-brand-blue/70">{item.unidade}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-brand-blue/70">{item.justificativa_match}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">Fornecedor</p>
          <p className="mt-2 text-sm font-bold text-brand-blue">{formatCnpj(item.fornecedor_dados.cnpj)}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">Localizacao</p>
          <p className="mt-2 text-sm font-bold text-brand-blue">
            {[item.fornecedor_dados.cidade, item.fornecedor_dados.uf].filter(Boolean).join(' / ') || 'Nao informado'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">Score licitacao</p>
          <p className="mt-2 text-sm font-bold text-brand-blue">{item.score_licitacao}/10</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue/70">NCM</p>
          <p className="mt-2 text-sm font-bold text-brand-blue">{item.ncm || 'Nao informado'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-brand-blue/70">{item.vantagem_preco}</p>
        {item.fornecedor_dados.contato ? (
          <span className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-xs font-bold text-brand-blue/70">
            Contato: {item.fornecedor_dados.contato}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function SourcingPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [descricaoItem, setDescricaoItem] = useState('');
  const [ufDestino, setUfDestino] = useState('');
  const [cidadeDestino, setCidadeDestino] = useState('');
  const [raioKm, setRaioKm] = useState('');

  const [rawInput, setRawInput] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [fornecedorCnpj, setFornecedorCnpj] = useState('');
  const [fornecedorContato, setFornecedorContato] = useState('');
  const [fornecedorCidade, setFornecedorCidade] = useState('');
  const [fornecedorUf, setFornecedorUf] = useState('');
  const [segmentoMacro, setSegmentoMacro] = useState('');

  const descricaoPreview = useDeferredValue(descricaoItem.trim());

  const promptQuery = useQuery({
    queryKey: ['marketplace', 'prompt'],
    queryFn: async () => {
      const response = await marketplaceApi.prompt();
      return response.data.data.prompt as string;
    },
    staleTime: 5 * 60 * 1000,
  });

  const catalogoQuery = useQuery({
    queryKey: ['marketplace', 'imports'],
    queryFn: async () => {
      const response = await marketplaceApi.listar({ meus: true, limit: 8 });
      return response.data as { success: boolean } & MarketplaceListData;
    },
    staleTime: 60 * 1000,
  });

  const cotacaoMutation = useMutation({
    mutationFn: async () => {
      const response = await marketplaceApi.cotar({
        descricao_item: descricaoItem,
        uf_destino: ufDestino || undefined,
        cidade_destino: cidadeDestino || undefined,
        raio_km: raioKm ? Number(raioKm) : undefined,
      });

      return response.data.data as MarketplaceCotacaoData;
    },
  });

  const catalogarMutation = useMutation({
    mutationFn: async () => {
      const response = await marketplaceApi.catalogar({
        raw_input: rawInput,
        fornecedor_nome: fornecedorNome || undefined,
        fornecedor_cnpj: fornecedorCnpj || undefined,
        fornecedor_contato: fornecedorContato || undefined,
        fornecedor_cidade: fornecedorCidade || undefined,
        fornecedor_uf: fornecedorUf || undefined,
        segmento_macro: segmentoMacro || undefined,
      });

      return response.data.data as {
        itens: MarketplaceItem[];
        meta: {
          importados: number;
          fornecedor: string;
          origem: string;
        };
      };
    },
    onSuccess: (data) => {
      toast.success(`${data.meta.importados} item(ns) catalogado(s) para ${data.meta.fornecedor}`);
      setRawInput('');
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'imports'] });
    },
  });

  const resultados = cotacaoMutation.data?.resultados ?? [];
  const meusItens = catalogoQuery.data?.data ?? [];
  const metaCatalogo = catalogoQuery.data?.meta;
  const faixaPreco = cotacaoMutation.data?.meta.faixaPreco ?? null;

  const handleBuscar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!descricaoItem.trim()) {
      toast.error('Cole o item do edital para iniciar a cotacao');
      return;
    }

    cotacaoMutation.mutate();
  };

  const handleCatalogar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!rawInput.trim()) {
      toast.error('Cole uma tabela de precos, XML de NFe ou catalogo do fornecedor');
      return;
    }

    catalogarMutation.mutate();
  };

  const handleCopiarPrompt = async () => {
    if (!promptQuery.data) {
      toast.error('Prompt ainda nao carregado');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptQuery.data);
      toast.success('Prompt copiado para sua area de transferencia');
    } catch {
      toast.error('Nao consegui copiar o prompt automaticamente');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="tech-panel-soft overflow-hidden p-6 lg:p-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[#B8D4FF] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            <Factory className="h-3.5 w-3.5" />
            Rede de fornecedores para licitantes
          </div>

          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-brand-blue">
            Encontre quem vende o item do edital, compare preco e monte a proposta com mais velocidade
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-blue/70">
            {user?.nome
              ? `${user.nome.split(' ')[0]}, aqui voce cola a descricao do edital e o Expertise devolve os fornecedores mais aderentes para sua estrategia comercial.`
              : 'Cole a descricao do item do edital, veja fornecedores aderentes e use a base para montar sua proposta com mais seguranca.'}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Catalogo ativo</p>
              <p className="mt-2 text-3xl font-bold text-brand-blue">{metaCatalogo?.totalCatalogo ?? 0}</p>
              <p className="mt-1 text-sm text-brand-blue/70">Itens ja organizados no marketplace interno da sua operacao.</p>
            </div>
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Melhor preco atual</p>
              <p className="mt-2 text-3xl font-bold text-brand-blue">{formatCurrency(faixaPreco?.menor ?? null)}</p>
              <p className="mt-1 text-sm text-brand-blue/70">Faixa mais barata entre os resultados da ultima cotacao.</p>
            </div>
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Segmento inferido</p>
              <p className="mt-2 text-lg font-bold text-brand-blue">
                {cotacaoMutation.data?.consulta.segmento_inferido || 'Aguardando item'}
              </p>
              <p className="mt-1 text-sm text-brand-blue/70">Classificacao automatica para encontrar fornecedor com mais precisao.</p>
            </div>
          </div>
        </div>

        <div className="tech-dark-panel p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-blue">Como isso ajuda na disputa</p>
          <h2 className="mt-3 text-2xl font-bold">Transforme o objeto do edital em base comercial acionavel</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-brand-blue/70">
            <p>1. Cole o item do edital exatamente como veio no termo de referencia.</p>
            <p>2. Veja quem vende, em qual UF, com qual preco e quao padronizado o item esta para licitacao.</p>
            <p>3. Importe XML de NFe, tabela de precos ou catalogo bruto para fortalecer sua propria rede de fornecedores.</p>
          </div>

          <div className="mt-6 rounded-[28px] border border-gray-100 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue">Leitura rapida</p>
            <p className="mt-2 text-sm leading-7 text-brand-blue/70">
              {descricaoPreview
                ? `Seu ultimo item em analise: "${descricaoPreview}".`
                : 'Quando voce colar um item, a tela organiza busca, faixa de preco e fornecedores mais competitivos.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <form onSubmit={handleBuscar} className="tech-panel p-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-brand-blue" />
            <h2 className="text-sm font-bold text-brand-blue">Cotar item do edital</h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-brand-blue/70">
            Descreva o objeto como ele aparece no edital. A busca cruza aderencia textual, score de licitacao, faixa de preco e prioridade regional.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                Item do edital
              </label>
              <textarea
                value={descricaoItem}
                onChange={(event) => setDescricaoItem(event.target.value)}
                rows={5}
                placeholder="Ex.: Cadeira giratoria com base em aco, revestimento em tecido preto, regulagem de altura e apoio lombar."
                className="mt-2 w-full rounded-[24px] border border-gray-100 bg-white px-4 py-4 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">UF do orgao</label>
                <input
                  value={ufDestino}
                  onChange={(event) => setUfDestino(event.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Cidade do orgao</label>
                <input
                  value={cidadeDestino}
                  onChange={(event) => setCidadeDestino(event.target.value)}
                  placeholder="Campinas"
                  className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Raio prioritario (km)</label>
                <input
                  value={raioKm}
                  onChange={(event) => setRaioKm(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  placeholder="200"
                  className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={cotacaoMutation.isPending} className="tech-primary-button">
              <Search className="h-4 w-4" />
              {cotacaoMutation.isPending ? 'Buscando fornecedores...' : 'Buscar fornecedores'}
            </button>
            <span className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-xs font-semibold text-brand-blue/70">
              Busca por descrição, score e região
            </span>
          </div>
        </form>

        <div className="tech-panel p-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-blue" />
            <h2 className="text-sm font-bold text-brand-blue">Resumo da ultima cotacao</h2>
          </div>

          {cotacaoMutation.isPending ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-[24px] bg-white" />
              ))}
            </div>
          ) : resultados.length === 0 ? (
            <div className="mt-5 rounded-[28px] border border-dashed border-gray-100 bg-white p-6 text-center">
              <Package className="mx-auto h-10 w-10 text-brand-blue/70" />
              <p className="mt-3 text-sm font-bold text-brand-blue">Nenhuma cotacao gerada ainda</p>
              <p className="mt-2 text-sm leading-7 text-brand-blue/70">
                Assim que voce buscar um item do edital, esta area resume a faixa de preco, os termos identificados e os fornecedores mais aderentes.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[26px] border border-[#D8E6FF] bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E6FB7]">Faixa de preco</p>
                  <p className="mt-2 text-3xl font-bold text-brand-blue">{formatCurrency(faixaPreco?.menor ?? null)}</p>
                  <p className="mt-2 text-sm leading-7 text-brand-blue/70">
                    Media atual em {formatCurrency(faixaPreco?.medio ?? null)} e teto em {formatCurrency(faixaPreco?.maior ?? null)}.
                  </p>
                </div>

                <div className="rounded-[26px] border border-gray-100 bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Melhor leitura</p>
                  <p className="mt-2 text-lg font-bold text-brand-blue">
                    {cotacaoMutation.data?.consulta.segmento_inferido || 'Nao identificado'}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-brand-blue/70">
                    {cotacaoMutation.data?.consulta.termos_identificados.slice(0, 4).join(', ') || 'Sem termos suficientes'}
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand-blue" />
                  <p className="text-sm font-bold text-brand-blue">Empresa usada como referencia</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-brand-blue/70">
                  {cotacaoMutation.data?.consulta.empresa_base
                    ? `${cotacaoMutation.data.consulta.empresa_base.razao_social} · ${formatCnpj(cotacaoMutation.data.consulta.empresa_base.cnpj)}`
                    : 'Nenhuma empresa vinculada. Cadastre o CNPJ da empresa para o ranking considerar melhor seu perfil comercial.'}
                </p>
              </div>

              {cotacaoMutation.data?.meta.observacoes.length ? (
                <div className="rounded-[28px] border border-brand-orange/50 bg-brand-orange/10 p-4 text-sm leading-7 text-brand-blue">
                  {cotacaoMutation.data.meta.observacoes.join(' ')}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="tech-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Resultado da busca</p>
            <h2 className="mt-1 text-xl font-bold text-brand-blue">Fornecedores ranqueados para seu item</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-xs font-bold text-brand-blue/70">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-blue" />
            {resultados.length} fornecedor(es) visiveis
          </div>
        </div>

        {resultados.length === 0 ? (
          <div className="p-10 text-center">
            <Search className="mx-auto h-10 w-10 text-brand-blue/70" />
            <p className="mt-3 text-sm font-semibold text-brand-blue/70">
              Os fornecedores aparecem aqui assim que voce fizer a busca.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-6">
            {resultados.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <form onSubmit={handleCatalogar} className="tech-panel p-6">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-brand-blue" />
            <h2 className="text-sm font-bold text-brand-blue">Importar base do fornecedor</h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-brand-blue/70">
            Cole XML de NFe, tabela de preco, catalogo bruto ou texto extraido do fornecedor. O sistema limpa os dados e cria uma vitrine pronta para busca.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Fornecedor</label>
              <input
                value={fornecedorNome}
                onChange={(event) => setFornecedorNome(event.target.value)}
                placeholder="Distribuidora Exemplo"
                className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">CNPJ</label>
              <input
                value={fornecedorCnpj}
                onChange={(event) => setFornecedorCnpj(event.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Contato</label>
              <input
                value={fornecedorContato}
                onChange={(event) => setFornecedorContato(event.target.value)}
                placeholder="vendas@fornecedor.com.br"
                className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Segmento macro</label>
              <input
                value={segmentoMacro}
                onChange={(event) => setSegmentoMacro(event.target.value)}
                placeholder="Papelaria, TI, Hospitalar..."
                className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Cidade</label>
              <input
                value={fornecedorCidade}
                onChange={(event) => setFornecedorCidade(event.target.value)}
                placeholder="Belo Horizonte"
                className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">UF</label>
              <input
                value={fornecedorUf}
                onChange={(event) => setFornecedorUf(event.target.value.toUpperCase().slice(0, 2))}
                placeholder="MG"
                className="mt-2 w-full rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Conteudo bruto para catalogar</label>
            <textarea
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              rows={10}
              placeholder="Cole aqui XML de NFe, linhas de tabela de precos, catalogo de produtos ou texto bruto do fornecedor."
              className="mt-2 w-full rounded-[24px] border border-gray-100 bg-white px-4 py-4 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white focus:ring-4 focus:ring-brand-blue/10"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={catalogarMutation.isPending} className="tech-primary-button">
              <UploadCloud className="h-4 w-4" />
              {catalogarMutation.isPending ? 'Catalogando base...' : 'Catalogar fornecedor'}
            </button>
            <span className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-xs font-semibold text-brand-blue/70">
              XML, tabela, planilha ou catalogo bruto
            </span>
          </div>
        </form>

        <div className="space-y-6">
          <section className="tech-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-blue" />
                <h2 className="text-sm font-bold text-brand-blue">Minha base importada</h2>
              </div>
              <span className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-xs font-bold text-brand-blue/70">
                {metaCatalogo?.total ?? 0} item(ns)
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {catalogoQuery.isLoading ? (
                [1, 2, 3].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-[24px] bg-white" />
                ))
              ) : meusItens.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-gray-100 bg-white p-5 text-center">
                  <p className="text-sm font-semibold text-brand-blue/70">Sua rede particular ainda esta vazia.</p>
                  <p className="mt-2 text-sm leading-7 text-brand-blue/70">
                    Importe os precos dos fornecedores que voce ja conhece para fortalecer o marketplace com dados reais.
                  </p>
                </div>
              ) : (
                meusItens.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-gray-100 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-brand-blue">{item.nome_comercial}</p>
                        <p className="mt-1 text-xs text-brand-blue/70">{item.fornecedor_dados.nome}</p>
                      </div>
                      <span className="rounded-lg border border-brand-blue/20 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-blue">
                        {item.segmento_macro}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-blue/70">
                        <DollarSign className="h-4 w-4 text-brand-blue/70" />
                        {formatCurrency(item.preco_unitario)} · {item.unidade}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-blue/70">
                        <MapPin className="h-4 w-4 text-brand-blue/70" />
                        {[item.fornecedor_dados.cidade, item.fornecedor_dados.uf].filter(Boolean).join(' / ') || 'Local nao informado'}
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-brand-blue/70">
                      Importado em {formatDate(item.updated_at)} · Origem {item.origem_dado}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="tech-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-blue" />
                <h2 className="text-sm font-bold text-brand-blue">Prompt operacional do marketplace</h2>
              </div>
              <button
                type="button"
                onClick={handleCopiarPrompt}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-xs font-bold text-brand-blue/70 transition hover:border-brand-blue/20 hover:text-brand-blue"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar prompt
              </button>
            </div>

            <p className="mt-3 text-sm leading-7 text-brand-blue/70">
              Use este prompt quando quiser processar planilhas externas e alimentar a base comercial com mais velocidade.
            </p>

            <div className="mt-4 rounded-[28px] border border-gray-100 bg-brand-blue p-4 text-sm leading-7 text-brand-blue/70">
              <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-6">
                {promptQuery.data || 'Carregando prompt...'}
              </pre>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand-blue">
              <ArrowRight className="h-3.5 w-3.5" />
              Pronto para XML de NFe, tabela de preco ou catalogo textual
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}



