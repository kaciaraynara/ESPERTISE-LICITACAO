import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Filter,
  Loader2,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoApi } from '@services/api';
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

export const CatalogoPage: React.FC = () => {
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
  });

  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery({
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
      status: formData.status,
    });
  };

  const formatarMoeda = (val: number | null) => {
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 md:p-8 max-w-7xl mx-auto">
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-xl shadow-sm">
              <Package size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Catálogo de Produtos, Serviços & Custos
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Cadastro de itens padronizados e custos base vinculados a códigos governamentais CATMAT/CATSER.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
        >
          <Plus size={16} /> NOVO ITEM NO CATÁLOGO
        </button>
      </header>

      {/* FILTROS E PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, SKU ou código CATMAT/CATSER..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
          >
            <option value="TODOS">Todas Categorias</option>
            <option value="MATERIAL">Materiais</option>
            <option value="SERVICO">Serviços</option>
            <option value="SOFTWARE">Softwares</option>
          </select>
        </div>
      </div>

      {/* TABELA DE PRODUTOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[320px] gap-3">
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
              Cadastre seus materiais, insumos ou serviços com os custos base para alimentar automaticamente a formação de lances e a fábrica de propostas.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
            >
              <Plus size={14} /> Cadastrar Primeiro Item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                  <th className="p-4">SKU / CATMAT</th>
                  <th className="p-4">Descrição do Item</th>
                  <th className="p-4 text-center">Tipo & Unid.</th>
                  <th className="p-4 text-right">Custo Base</th>
                  <th className="p-4 text-right">Preço Mínimo (Licitatório)</th>
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
                        CATMAT: {item.codigoCatmat || '—'}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-slate-800">{item.nome}</td>
                    <td className="p-4 text-center">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
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
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                          item.status === 'ATIVO'
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
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition"
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
        )}
      </div>

      {/* MODAL: NOVO ITEM NO CATÁLOGO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-[#EA580C]">
                  <Package size={18} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Cadastrar Item & Composição de Custo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600">
                    SKU / Código Interno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PROD-2026-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0A2540] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600">
                    Código CATMAT / CATSER
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 482910"
                    value={formData.codigoCatmat}
                    onChange={(e) => setFormData({ ...formData, codigoCatmat: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#0A2540] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600">
                  Descrição do Item / Nome Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Notebook Corporativo Core i7 16GB SSD 512GB"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0A2540] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600">
                    Categoria
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0A2540] focus:outline-none"
                  >
                    <option value="MATERIAL">Material</option>
                    <option value="SERVICO">Serviço</option>
                    <option value="SOFTWARE">Software / Licença</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600">
                    Unidade de Medida
                  </label>
                  <input
                    type="text"
                    placeholder="UN, KG, HORA, MES..."
                    value={formData.unidadeMedida}
                    onChange={(e) => setFormData({ ...formData, unidadeMedida: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0A2540] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600">
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-900 focus:border-[#0A2540] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600">
                    Preço Mínimo / Stop-Loss (R$)
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-emerald-700 focus:border-[#0A2540] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600">
                  Status Inicial
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0A2540] focus:outline-none"
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
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criarMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-[#EA580C] px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-orange-600 disabled:opacity-50"
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
