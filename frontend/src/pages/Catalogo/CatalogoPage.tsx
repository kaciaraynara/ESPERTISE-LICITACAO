import React, { useState } from 'react';
import {
  Package, Plus, Search, Edit3, Trash2, Filter
} from 'lucide-react';

interface ProdutoCatalogo {
  id: string;
  sku: string;
  codigoCatmat: string;
  nome: string;
  categoria: 'MATERIAL' | 'SERVICO' | 'SOFTWARE';
  custoBase: number;
  precoMinimoLicitacao: number;
  unidadeMedida: string;
  status: 'ATIVO' | 'EM_FALTA' | 'DESCONTINUADO';
}

export const CatalogoPage: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');

  const [produtos] = useState<ProdutoCatalogo[]>([
    {
      id: '1',
      sku: 'PRD-001',
      codigoCatmat: '481239',
      nome: 'Licença de Software de Gestão Pública com Suporte Técnico',
      categoria: 'SOFTWARE',
      custoBase: 8500,
      precoMinimoLicitacao: 12000,
      unidadeMedida: 'UN',
      status: 'ATIVO'
    },
    {
      id: '2',
      sku: 'PRD-002',
      codigoCatmat: '312904',
      nome: 'Serviço de Consultoria Jurídica em Licitações (Hora-Homem)',
      categoria: 'SERVICO',
      custoBase: 180,
      precoMinimoLicitacao: 350,
      unidadeMedida: 'HORA',
      status: 'ATIVO'
    },
    {
      id: '3',
      sku: 'PRD-003',
      codigoCatmat: '150921',
      nome: 'Servidor Rack 2U Octa-Core 64GB RAM 2TB SSD',
      categoria: 'MATERIAL',
      custoBase: 14000,
      precoMinimoLicitacao: 18500,
      unidadeMedida: 'UN',
      status: 'EM_FALTA'
    }
  ]);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const produtosFiltrados = produtos.filter(p => {
    const atendeBusca = p.nome.toLowerCase().includes(busca.toLowerCase()) || 
                        p.sku.toLowerCase().includes(busca.toLowerCase()) || 
                        p.codigoCatmat.includes(busca);
    const atendeCategoria = filtroCategoria === 'TODOS' || p.categoria === filtroCategoria;
    return atendeBusca && atendeCategoria;
  });

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Package size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Catálogo de Produtos, Serviços & CATMAT/CATSER
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cadastro de itens padronizados com vinculo direto a códigos de compras governamentais.
          </p>
        </div>

        <button className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all">
          <Plus size={16} /> NOVO ITEM NO CATÁLOGO
        </button>
      </header>

      {/* FILTROS E PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por nome, SKU ou Código CATMAT/CATSER..."
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                <th className="p-4">SKU / CATMAT</th>
                <th className="p-4">Descrição do Item</th>
                <th className="p-4 text-center">Tipo</th>
                <th className="p-4 text-right">Custo Base</th>
                <th className="p-4 text-right">Preço Mínimo (Licitatório)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {produtosFiltrados.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{item.sku}</div>
                    <div className="text-[10px] text-slate-400 font-mono">CATMAT: {item.codigoCatmat}</div>
                  </td>
                  <td className="p-4 font-bold text-slate-800">{item.nome}</td>
                  <td className="p-4 text-center">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {item.categoria}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-slate-600">
                    {formatarMoeda(item.custoBase)}
                  </td>
                  <td className="p-4 text-right font-black text-emerald-600">
                    {formatarMoeda(item.precoMinimoLicitacao)}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                      item.status === 'ATIVO' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : item.status === 'EM_FALTA' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
                      <Edit3 size={14} />
                    </button>
                    <button className="p-1.5 hover:bg-rose-50 rounded text-rose-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};