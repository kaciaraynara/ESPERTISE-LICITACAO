import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Filter,
  Loader2,
  X,
  Building2,
  ShieldCheck,
  ArrowRight,
  Globe,
  Lock,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

interface ProdutoCatalogo {
  id: string;
  sku: string;
  codigoCatmat: string | null;
  nome: string;
  categoria: string;
  custoBase: number | null;
  precoMinimoLicitacao: number | null;
  precoAtacado?: number | null;
  unidadeMedida: string;
  status: string;
  visivel_mercado?: boolean;
  usuario_id?: string | null;
  empresa_id?: string | null;
  razaoSocial?: string;
  cnpjFornecedor?: string | null;
  uf?: string | null;
}

export const CatalogoPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [abaAtiva, setAbaAtiva] = useState<'meus_produtos' | 'banco_fornecedores'>('meus_produtos');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    nome: '',
    codigoCatmat: '',
    categoria: 'MATERIAL',
    custoBase: '',
    precoMinimoLicitacao: '',
    unidadeMedida: 'UN',
    status: 'ATIVO',
    visivel_mercado: false,
  });

  const queryClient = useQueryClient();

  // ABA 1: Meus Produtos e Custos (Restrito e Confidencial - LGPD)
  const { data: respMeus, isLoading: isLoadingMeus } = useQuery({
    queryKey: ['catalogo_items', currentUser?.id],
    queryFn: async () => {
      const res = await catalogoApi.listar();
      return res.data;
    },
  });

  // ABA 2: Banco de Fornecedores (Somente visivel_mercado = true)
  const { data: respMercado, isLoading: isLoadingMercado } = useQuery({
    queryKey: ['catalogo_mercado_items'],
    queryFn: async () => {
      const res = await catalogoApi.listarMercado();
      return res.data;
    },
  });

  const meusProdutos: ProdutoCatalogo[] = respMeus?.data || [];
  const produtosMercado: ProdutoCatalogo[] = respMercado?.data || [];

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
      visivel_mercado: boolean;
    }) => {
      return catalogoApi.criar(payload);
    },
    onSuccess: () => {
      toast.success('Item cadastrado com sucesso no catálogo!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_mercado_items'] });
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
        visivel_mercado: false,
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao cadastrar o item no catálogo.';
      toast.error(msg);
    },
  });

  const toggleVisibilidadeMutation = useMutation({
    mutationFn: async ({ id, visivel }: { id: string; visivel: boolean }) => {
      return catalogoApi.atualizar(id, {
        visivel_mercado: visivel,
        status: visivel ? 'PUBLICO_MERCADO' : 'ATIVO',
      });
    },
    onSuccess: () => {
      toast.success('Visibilidade no Banco de Fornecedores atualizada!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_mercado_items'] });
    },
    onError: () => toast.error('Não foi possível atualizar a visibilidade do item.'),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => catalogoApi.remover(id),
    onSuccess: () => {
      toast.success('Item removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_mercado_items'] });
    },
    onError: () => toast.error('Erro ao remover o item do catálogo.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku.trim()) {
      toast.error('Informe o SKU do produto/serviço.');
      return;
    }
    if (!formData.nome.trim()) {
      toast.error('Informe a descrição/nome do item.');
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
      status: formData.visivel_mercado ? 'PUBLICO_MERCADO' : formData.status,
      visivel_mercado: formData.visivel_mercado,
    });
  };

  const handleUsarNaProposta = (item: ProdutoCatalogo) => {
    try {
      sessionStorage.setItem(
        'expertise_insumo_proposta',
        JSON.stringify({
          id: item.id,
          sku: item.sku,
          nome: item.nome,
          unidadeMedida: item.unidadeMedida || 'UN',
          precoAtacado: item.precoAtacado ?? item.precoMinimoLicitacao ?? item.custoBase ?? 0,
          razaoSocial: item.razaoSocial || 'Fornecedor Homologado',
        })
      );
    } catch {
      // ignora erro de storage
    }
    toast.success(`Insumo "${item.nome}" selecionado para a proposta!`);
    navigate('/propostas/criar');
  };

  const formatarMoeda = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
  };

  const meusProdutosFiltrados = meusProdutos.filter((p) => {
    const atendeBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.sku.toLowerCase().includes(busca.toLowerCase()) ||
      Boolean(p.codigoCatmat && p.codigoCatmat.includes(busca));
    const atendeCategoria = filtroCategoria === 'TODOS' || p.categoria === filtroCategoria;
    return atendeBusca && atendeCategoria;
  });

  const mercadoFiltrado = produtosMercado
    .filter((p) => p.visivel_mercado !== false)
    .filter((p) => {
      const atendeBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.razaoSocial || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(busca.toLowerCase());
      const atendeCategoria = filtroCategoria === 'TODOS' || p.categoria === filtroCategoria;
      return atendeBusca && atendeCategoria;
    });

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#334155] p-6 md:p-8 max-w-7xl mx-auto">
      {/* CABEÇALHO */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-[#0B192C] text-white rounded-xl shadow-xs">
              <Package size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[#0B192C] tracking-tight">
                Catálogo de Produtos & Marketplace de Insumos
              </h1>
              <p className="text-xs text-[#334155] mt-0.5 font-medium flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Isolamento de escopo compatível com LGPD: seus custos internos permanecem confidenciais por padrão.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} /> NOVO ITEM NO CATÁLOGO
        </button>
      </header>

      {/* NAVEGAÇÃO EM DUAS ABAS INDEPENDENTES (LGPD COMPLIANT) */}
      <div
        role="tablist"
        aria-label="Abas do Catálogo e Marketplace"
        className="flex flex-wrap items-center gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-2xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'meus_produtos'}
          onClick={() => setAbaAtiva('meus_produtos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'meus_produtos'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0B192C] hover:bg-slate-50'
          }`}
        >
          <Lock size={14} className={abaAtiva === 'meus_produtos' ? 'text-[#F97316]' : 'text-slate-400'} />
          <span>Meus Produtos e Custos</span>
          <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-white/15">
            {meusProdutos.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'banco_fornecedores'}
          onClick={() => setAbaAtiva('banco_fornecedores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'banco_fornecedores'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0B192C] hover:bg-slate-50'
          }`}
        >
          <Globe size={14} className={abaAtiva === 'banco_fornecedores' ? 'text-[#F97316]' : 'text-slate-400'} />
          <span>Banco de Fornecedores</span>
          <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-600">
            {produtosMercado.length}
          </span>
        </button>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              abaAtiva === 'meus_produtos'
                ? 'Buscar meus produtos por descrição, SKU ou código CATMAT/CATSER...'
                : 'Buscar no Banco de Fornecedores por insumo, Razão Social ou SKU...'
            }
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#0B192C]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-slate-400" />
          <select
            aria-label="Filtrar por categoria"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0B192C] focus:outline-none"
          >
            <option value="TODOS">Todas Categorias</option>
            <option value="MATERIAL">Materiais</option>
            <option value="SERVICO">Serviços</option>
            <option value="SOFTWARE">Softwares</option>
          </select>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: MEUS PRODUTOS E CUSTOS */}
      {abaAtiva === 'meus_produtos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
          {isLoadingMeus ? (
            <div className="flex flex-col items-center justify-center h-[320px] gap-3">
              <Loader2 className="animate-spin text-[#F97316] w-8 h-8" />
              <p className="text-xs font-bold text-slate-500">Carregando seus produtos e custos...</p>
            </div>
          ) : meusProdutosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-4 rounded-2xl bg-orange-50 text-[#F97316] mb-3">
                <Package size={36} />
              </div>
              <h3 className="text-base font-bold text-[#0B192C]">
                Nenhum item cadastrado em Meus Produtos e Custos
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Cadastre seus materiais, insumos ou serviços com os custos base privados para alimentar automaticamente a formação de lances e propostas.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={14} /> Cadastrar Primeiro Item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] bg-slate-50">
                    <th className="p-4">SKU / CATMAT</th>
                    <th className="p-4">Descrição do Item</th>
                    <th className="p-4 text-center">Tipo & Unid.</th>
                    <th className="p-4 text-right">Custo Base (Privado)</th>
                    <th className="p-4 text-right">Preço Mínimo / Atacado</th>
                    <th className="p-4 text-center">Visível no Mercado</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#334155]">
                  {meusProdutosFiltrados.map((item) => {
                    const isVisivel = Boolean(item.visivel_mercado || item.status === 'PUBLICO_MERCADO');
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-[#0B192C]">{item.sku}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            CATMAT: {item.codigoCatmat || '—'}
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-[#0B192C]">{item.nome}</td>
                        <td className="p-4 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.categoria} ({item.unidadeMedida || 'UN'})
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-700">
                          {formatarMoeda(item.custoBase)}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-700">
                          {formatarMoeda(item.precoMinimoLicitacao)}
                        </td>
                        <td className="p-4 text-center">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isVisivel}
                              onChange={(e) =>
                                toggleVisibilidadeMutation.mutate({
                                  id: item.id,
                                  visivel: e.target.checked,
                                })
                              }
                              className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                            />
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isVisivel
                                  ? 'bg-[#DCFCE7] text-[#166534]'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isVisivel ? 'Público B2B' : 'Privado'}
                            </span>
                          </label>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUsarNaProposta(item)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0B192C] border border-blue-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Usar na Proposta
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Deseja realmente remover o item "${item.nome}"?`)) {
                                  removerMutation.mutate(item.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: BANCO DE FORNECEDORES (visivel_mercado = true) */}
      {abaAtiva === 'banco_fornecedores' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
          {isLoadingMercado ? (
            <div className="flex flex-col items-center justify-center h-[320px] gap-3">
              <Loader2 className="animate-spin text-[#F97316] w-8 h-8" />
              <p className="text-xs font-bold text-slate-500">
                Consultando insumos públicos no Banco de Fornecedores...
              </p>
            </div>
          ) : mercadoFiltrado.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-4 rounded-2xl bg-blue-50 text-[#0B192C] mb-3">
                <Building2 size={36} />
              </div>
              <h3 className="text-base font-bold text-[#0B192C]">
                Nenhum insumo público disponível para este filtro
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Para publicar ofertas B2B no Banco de Fornecedores, ative a opção &quot;Disponibilizar no Banco de Fornecedores&quot; ao cadastrar ou editar um item na aba Meus Produtos e Custos.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, visivel_mercado: true }));
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={14} /> Publicar Oferta no Banco de Fornecedores
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] bg-slate-50">
                    <th className="p-4">Razão Social do Fornecedor</th>
                    <th className="p-4">Descrição do Insumo</th>
                    <th className="p-4 text-center">Categoria & Unid.</th>
                    <th className="p-4 text-right">Preço de Atacado</th>
                    <th className="p-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#334155]">
                  {mercadoFiltrado.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[#0B192C] flex items-center gap-1.5">
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                          <span>{item.razaoSocial || 'Fornecedor Homologado B2B'}</span>
                        </div>
                        {item.uf && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            UF: {item.uf}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-[#0B192C]">{item.nome}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          SKU: {item.sku} {item.codigoCatmat ? `· CATMAT: ${item.codigoCatmat}` : ''}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.categoria} ({item.unidadeMedida || 'UN'})
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-700 text-sm">
                        {formatarMoeda(item.precoAtacado ?? item.precoMinimoLicitacao ?? item.custoBase)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleUsarNaProposta(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                        >
                          <span>Usar na Proposta</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NOVO ITEM NO CATÁLOGO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-[#F97316]">
                  <Package size={18} />
                </div>
                <h3 className="text-base font-bold text-[#0B192C]">
                  Cadastrar Item & Composição de Custo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    SKU / Código Interno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PROD-2026-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] focus:border-[#0B192C] focus:outline-none"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#0B192C] focus:border-[#0B192C] focus:outline-none"
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
                  placeholder="Ex: Notebook Corporativo Core i7 16GB SSD 512GB"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] focus:border-[#0B192C] focus:outline-none"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0B192C] focus:border-[#0B192C] focus:outline-none"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] focus:border-[#0B192C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Custo Base Direto (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 3500.00"
                    value={formData.custoBase}
                    onChange={(e) => setFormData({ ...formData, custoBase: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] focus:border-[#0B192C] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Preço Mínimo / Atacado (R$)
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-emerald-700 focus:border-[#0B192C] focus:outline-none"
                  />
                </div>
              </div>

              {/* CONTROLE DE ESCOPO LGPD: visivel_mercado */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.visivel_mercado}
                    onChange={(e) =>
                      setFormData({ ...formData, visivel_mercado: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  />
                  <div>
                    <span className="block text-xs font-bold text-[#0B192C]">
                      Disponibilizar no Banco de Fornecedores (visivel_mercado)
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Desmarcado (padrão): o item e seus custos ficam 100% restritos à sua conta. Marcado: exibe o insumo e o preço de atacado para parceiros na aba Banco de Fornecedores.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criarMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-orange-600 cursor-pointer"
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

export const CatalogoMarketplacePage = CatalogoPage;
export default CatalogoPage;
