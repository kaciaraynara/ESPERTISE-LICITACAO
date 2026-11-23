import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Package,
  Plus,
  Search,
  Trash2,
  Filter,
  Loader2,
  X,
  TrendingUp,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoApi } from '@services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import toast from 'react-hot-toast';

interface ProdutoCatalogo {
  id: string;
  sku: string;
  codigoCatmat: string | null;
  nome: string;
  categoria: string;
  custoBase: number | null;
  precoMinimoLicitacao: number | null;
  unidadeMedida: string;
  status: string;
}

const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const CatalogoPage: React.FC = () => {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState<'OFICIAL' | 'MEU_CATALOGO'>('OFICIAL');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado da pesquisa oficial CATMAT / CATSER + Preços Públicos
  const [termoOficial, setTermoOficial] = useState('LIMPEZA');
  const [codigoOficial, setCodigoOficial] = useState('24023');
  const [tipoOficial, setTipoOficial] = useState<'TODOS' | 'MATERIAL' | 'SERVICO'>('SERVICO');
  const [ufOficial, setUfOficial] = useState('');
  const [consultandoOficial, setConsultandoOficial] = useState(false);
  const [resultadoOficial, setResultadoOficial] = useState<any>(null);

  const [formData, setFormData] = useState({
    sku: '',
    nome: '',
    codigoCatmat: '',
    categoria: 'MATERIAL',
    custoBase: '',
    precoMinimoLicitacao: '',
    unidadeMedida: 'UN',
    status: 'ATIVO',
  });

  const queryClient = useQueryClient();

  const { data: resp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['catalogo_items'],
    queryFn: async () => {
      const res = await catalogoApi.listar();
      return res.data;
    },
  });

  const produtos: ProdutoCatalogo[] = resp?.data || [];

  const criarMutation = useMutation({
    mutationFn: async (payload: {
      sku: string;
      nome: string;
      codigoCatmat?: string;
      categoria: string;
      custoBase: number;
      precoMinimoLicitacao?: number;
      unidadeMedida: string;
      status: string;
    }) => {
      return catalogoApi.criar(payload);
    },
    onSuccess: () => {
      toast.success('Item cadastrado com sucesso no catálogo!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      setIsModalOpen(false);
      setFormData({
        sku: '',
        nome: '',
        codigoCatmat: '',
        categoria: 'MATERIAL',
        custoBase: '',
        precoMinimoLicitacao: '',
        unidadeMedida: 'UN',
        status: 'ATIVO',
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao cadastrar o item no catálogo.';
      toast.error(msg);
    },
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => catalogoApi.remover(id),
    onSuccess: () => {
      toast.success('Item removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
    },
    onError: () => toast.error('Erro ao remover o item do catálogo.'),
  });

  const handleBuscarOficial = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const codigoLimpo = codigoOficial.replace(/\D/g, '');
    if (termoOficial.trim().length < 2 && !codigoLimpo) {
      toast.error('Informe uma descrição (mín. 2 caracteres) ou código CATMAT/CATSER.');
      return;
    }

    setConsultandoOficial(true);
    try {
      const res = await catalogoApi.buscarCatmatCatser({
        q: termoOficial.trim() || undefined,
        codigo: codigoLimpo || undefined,
        tipo: tipoOficial,
        uf: ufOficial || undefined,
      });
      setResultadoOficial(res.data?.data || null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao consultar CATMAT/CATSER e preços públicos.');
    } finally {
      setConsultandoOficial(false);
    }
  };

  const abrirModalImportacao = (item: {
    codigo?: string | null;
    descricao: string;
    categoria?: string;
    unidade?: string;
    valorReferencia?: number;
  }) => {
    const cod = String(item.codigo || '').replace(/\D/g, '');
    setFormData({
      sku: cod ? `GOV-${cod}` : `PNCP-${Date.now().toString().slice(-4)}`,
      nome: item.descricao.slice(0, 120),
      codigoCatmat: cod,
      categoria: item.categoria === 'SERVICO' ? 'SERVICO' : 'MATERIAL',
      custoBase: item.valorReferencia && item.valorReferencia > 0
        ? (item.valorReferencia * 0.75).toFixed(2)
        : '',
      precoMinimoLicitacao: item.valorReferencia && item.valorReferencia > 0
        ? item.valorReferencia.toFixed(2)
        : '',
      unidadeMedida: (item.unidade || 'UN').slice(0, 12),
      status: 'ATIVO',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku.trim()) {
      toast.error('Informe o código interno (SKU) do produto ou serviço.');
      return;
    }
    if (!formData.nome.trim()) {
      toast.error('Informe a descrição do item.');
      return;
    }
    const custo = parseFloat(formData.custoBase);
    if (isNaN(custo) || custo <= 0) {
      toast.error('Informe um custo base válido maior que zero.');
      return;
    }

    const precoMin = formData.precoMinimoLicitacao
      ? parseFloat(formData.precoMinimoLicitacao)
      : undefined;

    criarMutation.mutate({
      sku: formData.sku.trim(),
      nome: formData.nome.trim(),
      codigoCatmat: formData.codigoCatmat.trim() || undefined,
      categoria: formData.categoria,
      custoBase: custo,
      precoMinimoLicitacao: precoMin,
      unidadeMedida: formData.unidadeMedida.trim() || 'UN',
      status: formData.status,
    });
  };

  const formatarMoeda = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const produtosFiltrados = produtos.filter((p) => {
    const atendeBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.sku.toLowerCase().includes(busca.toLowerCase()) ||
      Boolean(p.codigoCatmat && p.codigoCatmat.includes(busca));
    const atendeCategoria = filtroCategoria === 'TODOS' || p.categoria === filtroCategoria;
    return atendeBusca && atendeCategoria;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#081c3a] text-white rounded-xl shadow-sm shrink-0">
              <Package size={20} />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#081c3a] tracking-tight">
              Catálogo CATMAT / CATSER & Banco de Preços
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Pesquise códigos oficiais CATMAT (Materiais) e CATSER (Serviços) no Compras.gov.br + PNCP para precificar com norte de mercado.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} /> Novo Item no Catálogo
        </button>
      </header>

      {/* ABAS PRINCIPAIS */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAbaAtiva('OFICIAL')}
          className={`px-4 py-2 rounded-full text-xs font-black transition cursor-pointer ${abaAtiva === 'OFICIAL'
              ? 'bg-[#081c3a] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
        >
          Catálogo Oficial CATMAT / CATSER & Preços
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('MEU_CATALOGO')}
          className={`px-4 py-2 rounded-full text-xs font-black transition cursor-pointer ${abaAtiva === 'MEU_CATALOGO'
              ? 'bg-[#081c3a] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
        >
          Meu Catálogo da Empresa ({produtos.length})
        </button>
      </div>

      {/* ABA 1: PESQUISA OFICIAL CATMAT / CATSER + REFERÊNCIA DE PREÇOS */}
      {abaAtiva === 'OFICIAL' && (
        <div className="space-y-6">
          <form
            onSubmit={handleBuscarOficial}
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Descrição do Produto ou Serviço
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={termoOficial}
                  onChange={(e) => setTermoOficial(e.target.value)}
                  placeholder="Ex.: limpeza, notebook, ar condicionado..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Código CATMAT/CATSER
              </label>
              <input
                type="text"
                value={codigoOficial}
                onChange={(e) => setCodigoOficial(e.target.value)}
                placeholder="Ex: 24023 ou 460949"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Catálogo
              </label>
              <select
                value={tipoOficial}
                onChange={(e) => setTipoOficial(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
              >
                <option value="TODOS">Todos (CATMAT + CATSER)</option>
                <option value="MATERIAL">Material (CATMAT)</option>
                <option value="SERVICO">Serviço (CATSER)</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                UF de Referência
              </label>
              <select
                value={ufOficial}
                onChange={(e) => setUfOficial(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
              >
                <option value="">Todo o Brasil</option>
                {UFS_BRASIL.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={consultandoOficial}
                className="w-full rounded-xl bg-[#EA580C] hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-xs py-2.5 px-4 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {consultandoOficial ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                {consultandoOficial ? 'Consultando...' : 'Buscar Preços'}
              </button>
            </div>
          </form>

          {!resultadoOficial && !consultandoOficial && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Tag size={28} className="mx-auto text-[#EA580C]" />
              <h3 className="text-sm font-black text-slate-900">
                Consulte Preços Homologados do Governo Federal
              </h3>
              <p className="text-xs text-slate-500 max-w-xl mx-auto">
                Digite um produto, serviço ou código CATMAT/CATSER e clique em <strong>Buscar Preços</strong> para enxergar o menor preço, mediana recomendada e amostras reais do Compras.gov.br e PNCP.
              </p>
            </div>
          )}

          {resultadoOficial && (
            <div className="space-y-5">
              {/* CARDS DE ESTATÍSTICAS (NORTE DE PREÇO) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Menor Preço Encontrado</span>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                    {formatarMoeda(resultadoOficial.estatisticas?.minimo)}
                  </p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-emerald-700">Mediana (Norte Recomendado)</span>
                  <p className="text-lg sm:text-xl font-black text-emerald-800 mt-1">
                    {formatarMoeda(resultadoOficial.estatisticas?.mediana)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Média Praticada</span>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                    {formatarMoeda(resultadoOficial.estatisticas?.media)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Maior Preço / Amostras</span>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                    {formatarMoeda(resultadoOficial.estatisticas?.maximo)}
                  </p>
                  <p className="text-[11px] text-slate-500">{resultadoOficial.totalAmostras || 0} amostra(s) válidas</p>
                </div>
              </div>

              {/* AÇÃO RÁPIDA COM MEDIANA PARA PRECIFICAÇÃO */}
              {Number(resultadoOficial.estatisticas?.mediana) > 0 && (
                <div className="bg-[#081c3a] text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs space-y-1">
                    <p className="font-black text-sm">
                      Mediana de Referência: {formatarMoeda(resultadoOficial.estatisticas.mediana)}
                    </p>
                    <p className="text-slate-300">
                      Leve esse valor direto para o simulador de margem e BDI antes de montar sua proposta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `${FORNECEDOR_ROUTES.precificacao_estrategica}?refValor=${encodeURIComponent(
                          String(resultadoOficial.estatisticas.mediana),
                        )}&refNome=${encodeURIComponent(resultadoOficial.termo || '')}&refCodigo=${encodeURIComponent(
                          resultadoOficial.codigo || '',
                        )}`,
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white transition cursor-pointer whitespace-nowrap"
                  >
                    Simular na Precificação <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* CÓDIGOS DO CATÁLOGO OFICIAL ENCONTRADOS */}
              {Array.isArray(resultadoOficial.itensCatalogoOficial) && resultadoOficial.itensCatalogoOficial.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <h3 className="text-sm font-black text-slate-900">
                    Códigos Oficiais Localizados ({resultadoOficial.itensCatalogoOficial.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {resultadoOficial.itensCatalogoOficial.slice(0, 8).map((cat: any) => (
                      <div
                        key={`${cat.tipo}-${cat.codigo}`}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#081c3a] text-white">
                              {cat.tipo === 'SERVICO' ? 'CATSER' : 'CATMAT'} {cat.codigo}
                            </span>
                            {cat.ncm && <span className="text-[10px] font-mono text-slate-500">{cat.ncm}</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-900 mt-1.5">{cat.descricao}</p>
                          {(cat.grupo || cat.classe) && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {[cat.grupo, cat.classe].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/70">
                          <button
                            type="button"
                            onClick={() => {
                              setCodigoOficial(cat.codigo);
                              setTipoOficial(cat.tipo);
                              void catalogoApi.buscarCatmatCatser({
                                q: cat.descricao.slice(0, 60),
                                codigo: cat.codigo,
                                tipo: cat.tipo,
                                uf: ufOficial || undefined,
                              }).then((r) => setResultadoOficial(r.data?.data || null));
                            }}
                            className="text-[11px] font-bold text-[#0070C0] hover:underline cursor-pointer"
                          >
                            Ver preços deste código
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              abrirModalImportacao({
                                codigo: cat.codigo,
                                descricao: cat.descricao,
                                categoria: cat.tipo,
                                unidade: cat.unidadePadrao,
                                valorReferencia: resultadoOficial.estatisticas?.mediana,
                              })
                            }
                            className="text-[11px] font-bold text-[#EA580C] hover:underline cursor-pointer"
                          >
                            + Importar para Meu Catálogo
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AMOSTRAS REAIS DE PREÇOS */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Amostras Reais Praticadas ({resultadoOficial.amostras?.length || 0})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Preços unitários de compras públicas homologadas no Compras.gov.br e PNCP.
                    </p>
                  </div>
                </div>

                {(!resultadoOficial.amostras || resultadoOficial.amostras.length === 0) ? (
                  <p className="p-6 text-xs text-slate-500">
                    Nenhuma amostra numérica de preço encontrada para este filtro. Tente pesquisar com outro código CATMAT/CATSER ou termo mais amplo.
                  </p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {resultadoOficial.amostras.map((amostra: any) => (
                        <div key={amostra.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {amostra.fonte} {amostra.codigoCatalogo ? `#${amostra.codigoCatalogo}` : ''}
                            </span>
                            <span className="font-black text-sm text-emerald-700">
                              {formatarMoeda(amostra.valorUnitario)}/{amostra.unidade}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900">{amostra.descricao}</p>
                          <p className="text-[11px] text-slate-500">
                            {amostra.orgao}{amostra.uf ? ` (${amostra.uf})` : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              abrirModalImportacao({
                                codigo: amostra.codigoCatalogo,
                                descricao: amostra.descricao,
                                unidade: amostra.unidade,
                                valorReferencia: amostra.valorUnitario,
                              })
                            }
                            className="text-[11px] font-bold text-[#EA580C] hover:underline cursor-pointer"
                          >
                            + Importar para Meu Catálogo
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                            <th className="p-3.5">Fonte / Cód.</th>
                            <th className="p-3.5">Item / Descrição</th>
                            <th className="p-3.5">Órgão Comprador</th>
                            <th className="p-3.5 text-center">UF</th>
                            <th className="p-3.5 text-right">Preço Unitário</th>
                            <th className="p-3.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {resultadoOficial.amostras.map((amostra: any) => (
                            <tr key={amostra.id} className="hover:bg-slate-50/70">
                              <td className="p-3.5 whitespace-nowrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {amostra.fonte}
                                </span>
                                {amostra.codigoCatalogo && (
                                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                    #{amostra.codigoCatalogo}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 font-bold text-slate-900 max-w-md">{amostra.descricao}</td>
                              <td className="p-3.5 text-slate-600">{amostra.orgao}</td>
                              <td className="p-3.5 text-center font-bold text-slate-700">{amostra.uf || '—'}</td>
                              <td className="p-3.5 text-right font-black text-emerald-700 whitespace-nowrap">
                                {formatarMoeda(amostra.valorUnitario)}{' '}
                                <span className="text-[10px] font-medium text-slate-400">/{amostra.unidade}</span>
                              </td>
                              <td className="p-3.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirModalImportacao({
                                      codigo: amostra.codigoCatalogo,
                                      descricao: amostra.descricao,
                                      unidade: amostra.unidade,
                                      valorReferencia: amostra.valorUnitario,
                                    })
                                  }
                                  className="text-xs font-bold text-[#EA580C] hover:underline cursor-pointer"
                                >
                                  Importar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: MEU CATÁLOGO DA EMPRESA */}
      {abaAtiva === 'MEU_CATALOGO' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por descrição, código interno ou código CATMAT/CATSER..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-full pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0070c0]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={16} className="text-slate-400" />
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full md:w-auto bg-white border border-slate-300 rounded-full px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0070c0]"
              >
                <option value="TODOS">Todas as Categorias</option>
                <option value="MATERIAL">Materiais</option>
                <option value="SERVICO">Serviços</option>
                <option value="SOFTWARE">Softwares</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[280px]">
            {isError ? (
              <div role="alert" className="flex flex-col items-center justify-center p-12 text-center">
                <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 mb-3">
                  <AlertCircle size={36} />
                </div>
                <h3 className="text-base font-black text-slate-900">Não foi possível carregar o catálogo</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                  {(error as any)?.response?.data?.message || 'O serviço pode estar indisponível. Nenhum item foi carregado; evite cadastrar duplicatas.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  Tentar novamente
                </button>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center h-[280px] gap-3">
                <Loader2 className="animate-spin text-[#EA580C] w-8 h-8" />
                <p className="text-xs font-bold text-slate-500">Carregando itens do catálogo...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="p-4 rounded-2xl bg-orange-50 text-[#EA580C] mb-3">
                  <Package size={36} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Nenhum item cadastrado no catálogo
                </h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                  Cadastre seus produtos ou importe diretamente da aba CATMAT / CATSER para alimentar automaticamente suas propostas.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Cadastrar Primeiro Item
                </button>
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100">
                  {produtosFiltrados.map((item) => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.sku}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.categoria} ({item.unidadeMedida || 'UN'})
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{item.nome}</p>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span>Custo: <strong>{formatarMoeda(item.custoBase)}</strong></span>
                        <span className="text-emerald-700 font-black">Mín: {formatarMoeda(item.precoMinimoLicitacao)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                        <th className="p-4">Código / CATMAT</th>
                        <th className="p-4">Descrição do Item</th>
                        <th className="p-4 text-center">Tipo e Unid.</th>
                        <th className="p-4 text-right">Custo Base</th>
                        <th className="p-4 text-right">Preço Mínimo de Venda</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {produtosFiltrados.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{item.sku}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              CATMAT/SER: {item.codigoCatmat || '—'}
                            </div>
                          </td>
                          <td className="p-4 font-bold text-slate-800">{item.nome}</td>
                          <td className="p-4 text-center">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {item.categoria} ({item.unidadeMedida || 'UN'})
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-slate-700">
                            {formatarMoeda(item.custoBase)}
                          </td>
                          <td className="p-4 text-right font-black text-emerald-600">
                            {formatarMoeda(item.precoMinimoLicitacao)}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${item.status === 'ATIVO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'EM_FALTA'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                if (window.confirm(`Deseja realmente remover o item "${item.nome}"?`)) {
                                  removerMutation.mutate(item.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-full text-rose-600 transition cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-[#EA580C]">
                  <Package size={18} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Cadastrar Item e Custo Base
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Código Interno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PROD-2026-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Código CATMAT / CATSER
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 482910"
                    value={formData.codigoCatmat}
                    onChange={(e) => setFormData({ ...formData, codigoCatmat: e.target.value })}
                    className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-900 focus:border-[#0070c0] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600">
                  Descrição do Item / Nome Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Notebook Corporativo 16GB SSD 512GB"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Categoria
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="mt-1 w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
                  >
                    <option value="MATERIAL">Material</option>
                    <option value="SERVICO">Serviço</option>
                    <option value="SOFTWARE">Software / Licença</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Unidade de Medida
                  </label>
                  <input
                    type="text"
                    placeholder="UN, KG, HORA, MES..."
                    value={formData.unidadeMedida}
                    onChange={(e) => setFormData({ ...formData, unidadeMedida: e.target.value })}
                    className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Custo Base (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 3500.00"
                    value={formData.custoBase}
                    onChange={(e) => setFormData({ ...formData, custoBase: e.target.value })}
                    className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-900 focus:border-[#0070c0] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Preço Mínimo de Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ex: 4200.00"
                    value={formData.precoMinimoLicitacao}
                    onChange={(e) =>
                      setFormData({ ...formData, precoMinimoLicitacao: e.target.value })
                    }
                    className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-emerald-700 focus:border-[#0070c0] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600">
                  Status Inicial
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-1 w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-900 focus:border-[#0070c0] focus:outline-none"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="EM_FALTA">Em Falta</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criarMutation.isPending}
                  className="flex items-center gap-2 rounded-full bg-[#EA580C] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-600 disabled:opacity-50 cursor-pointer"
                >
                  {criarMutation.isPending ? 'Salvando...' : 'Salvar no Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
