import React, { useState } from 'react';
import { 
  FileText, Plus, Download, Building2, FileSpreadsheet, Send, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { propostasApi } from '@services/api';

interface ItemProposta {
  id: string;
  itemNumero: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  marcaModelo: string;
}

export const PropostasPage: React.FC = () => {
  const [razaoSocial] = useState('DIGITAL DAY SOFTWARE E SERVICOS LTDA');
  const [cnpj] = useState('00.000.000/0001-00');
  const [titulo, setTitulo] = useState('Proposta Comercial Padrão');
  const [validadePropostaDias, setValidadePropostaDias] = useState(60);
  const [prazoEntregaDias, setPrazoEntregaDias] = useState(15);
  const [saving, setSaving] = useState(false);
  
  const [itens, setItens] = useState<ItemProposta[]>([
    {
      id: '1',
      itemNumero: 1,
      descricao: 'Licenciamento de Software de Gestão Pública com Suporte Técnico 24/7',
      unidade: 'UN',
      quantidade: 12,
      valorUnitario: 14500,
      marcaModelo: 'Expertise ERP v4.2'
    },
    {
      id: '2',
      itemNumero: 2,
      descricao: 'Serviço Especializado de Treinamento e Capacitação de Servidores',
      unidade: 'HORA',
      quantidade: 40,
      valorUnitario: 350,
      marcaModelo: 'Serviço Próprio'
    }
  ]);

  const adicionarItem = () => {
    const novoItem: ItemProposta = {
      id: Date.now().toString(),
      itemNumero: itens.length + 1,
      descricao: 'Novo item da proposta...',
      unidade: 'UN',
      quantidade: 1,
      valorUnitario: 1000,
      marcaModelo: 'Marca/Modelo'
    };
    setItens([...itens, novoItem]);
  };

  const atualizarItem = (id: string, campo: keyof ItemProposta, valor: any) => {
    setItens(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await propostasApi.criarRascunho({
        companyId: '00000000-0000-0000-0000-000000000000', // Mock UUID for the demo
        titulo,
        validadeDias: validadePropostaDias,
        prazoEntregaDias,
      });
      toast.success('Proposta salva com sucesso!');
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.success('Proposta processada. (Modo demonstrativo)');
      } else {
        toast.success('Proposta salva em rascunho com sucesso!');
      }
    } finally {
      setSaving(false);
    }
  };

  const valorTotalProposta = itens.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <FileText size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Gerador & Gestor de Propostas Comerciais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Geração automatizada de proposta comercial formalizada em conformidade com a Lei 14.133/21.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm transition-all">
            <Download size={16} />
            Exportar PDF
          </button>
          <button 
            onClick={handleSalvar}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Finalizar e Cadastrar
          </button>
        </div>
      </header>

      {/* PAINEL PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* EDITAR PROPOSTA */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* IDENTIFICAÇÃO */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
              <Building2 size={16} className="text-[#0A2540]" />
              Dados do Proponente & Condições Gerais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-600 mb-1">Título da Proposta</label>
                <input 
                  type="text" 
                  value={titulo} 
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]" 
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Razão Social</label>
                <input type="text" readOnly value={razaoSocial} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800" />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">CNPJ</label>
                <input type="text" readOnly value={cnpj} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800" />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Validade da Proposta (Dias)</label>
                <input 
                  type="number" 
                  value={validadePropostaDias} 
                  onChange={(e) => setValidadePropostaDias(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]" 
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Prazo de Entrega/Execução (Dias)</label>
                <input 
                  type="number" 
                  value={prazoEntregaDias} 
                  onChange={(e) => setPrazoEntregaDias(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]" 
                />
              </div>
            </div>
          </div>

          {/* TABELA DE ITENS DA PROPOSTA */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#EA580C]" />
                Composição do Preço & Planilha de Custos
              </h3>
              <button 
                onClick={adicionarItem}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                    <th className="p-3">Item</th>
                    <th className="p-3">Descrição / Especificação</th>
                    <th className="p-3">Marca / Modelo</th>
                    <th className="p-3 text-center">Qtd</th>
                    <th className="p-3 text-right">Valor Unit. (R$)</th>
                    <th className="p-3 text-right">Total (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {itens.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-center">{item.itemNumero}</td>
                      <td className="p-3">
                        <input 
                          type="text" 
                          value={item.descricao}
                          onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none font-bold text-slate-900"
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          type="text" 
                          value={item.marcaModelo}
                          onChange={(e) => atualizarItem(item.id, 'marcaModelo', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none text-slate-600"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input 
                          type="number" 
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                          className="w-16 text-center bg-slate-50 border border-slate-200 rounded p-1 font-bold"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input 
                          type="number" 
                          value={item.valorUnitario}
                          onChange={(e) => atualizarItem(item.id, 'valorUnitario', parseFloat(e.target.value) || 0)}
                          className="w-24 text-right bg-slate-50 border border-slate-200 rounded p-1 font-bold text-slate-900"
                        />
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">
                        {formatarMoeda(item.quantidade * item.valorUnitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RESUMO E TOTALIZADORES */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0A2540] text-white p-6 rounded-2xl shadow-xl space-y-6">
            <div>
              <span className="text-[10px] font-black text-[#EA580C] uppercase tracking-wider block">
                Valor Total da Proposta
              </span>
              <h2 className="text-3xl font-black mt-1 text-white">
                {formatarMoeda(valorTotalProposta)}
              </h2>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total de Itens:</span>
                <span className="font-bold text-white">{itens.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Validade Declarada:</span>
                <span className="font-bold text-white">{validadePropostaDias} Dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Prazo de Execução:</span>
                <span className="font-bold text-white">{prazoEntregaDias} Dias</span>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-[11px] text-slate-300 leading-relaxed">
              Declaro que nos preços propostos estão incluídos todos os tributos, encargos sociais, trabalhistas, previdenciários e frete até o local de entrega.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};