import React, { useState } from 'react';
import { Users, Search, BarChart2, ExternalLink } from 'lucide-react';

interface Concorrente {
  id: string;
  razaoSocial: string;
  cnpj: string;
  vitoriasAno: number;
  totalFaturado: number;
  descontoMedio: number;
  agressividade: 'ALTA' | 'MEDIA' | 'BAIXA';
  portaVitoriaPreferida: string;
}

export const InvestigacaoConcorrencialPage: React.FC = () => {
  const [busca, setBusca] = useState('');

  const [concorrentes] = useState<Concorrente[]>([
    {
      id: '1',
      razaoSocial: 'ALPHA TECH SERVICOS E SISTEMAS LTDA',
      cnpj: '12.345.678/0001-90',
      vitoriasAno: 34,
      totalFaturado: 12800000,
      descontoMedio: 18.5,
      agressividade: 'ALTA',
      portaVitoriaPreferida: 'Compras.gov.br'
    },
    {
      id: '2',
      razaoSocial: 'BETA SOLUTIONS SOLUCOES EM TI S.A.',
      cnpj: '98.765.432/0001-10',
      vitoriasAno: 19,
      totalFaturado: 8400000,
      descontoMedio: 11.2,
      agressividade: 'MEDIA',
      portaVitoriaPreferida: 'LicitaNet'
    },
    {
      id: '3',
      razaoSocial: 'GAMMA SERVICOS E CONSTRUTORA LTDA',
      cnpj: '45.678.901/0001-22',
      vitoriasAno: 8,
      totalFaturado: 3100000,
      descontoMedio: 8.0,
      agressividade: 'BAIXA',
      portaVitoriaPreferida: 'BEC-SP'
    }
  ]);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Users size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Investigação Concorrencial & Inteligência de Mercado
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mapeamento de padrões de comportamento, agressividade de preço e histórico de vitórias dos concorrentes.
          </p>
        </div>
      </header>

      {/* FILTRO E BUSCA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por CNPJ ou Razão Social do Concorrente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>
      </div>

      {/* TABELA DE CONCORRENTES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm flex items-center gap-2">
          <BarChart2 size={16} className="text-[#EA580C]" />
          Ranking & Perfil do Mercado Licitatório
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                <th className="p-4">Empresa / CNPJ</th>
                <th className="p-4 text-center">Vitórias (Ano)</th>
                <th className="p-4 text-right">Volume Contratado</th>
                <th className="p-4 text-center">Desconto Médio</th>
                <th className="p-4 text-center">Perfil de Disputa</th>
                <th className="p-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {concorrentes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{c.razaoSocial}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{c.cnpj}</div>
                  </td>
                  <td className="p-4 text-center font-bold">{c.vitoriasAno}</td>
                  <td className="p-4 text-right font-black text-slate-900">
                    {formatarMoeda(c.totalFaturado)}
                  </td>
                  <td className="p-4 text-center font-bold text-slate-700">
                    {c.descontoMedio.toFixed(1)}%
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                      c.agressividade === 'ALTA' 
                        ? 'bg-rose-100 text-rose-800' 
                        : c.agressividade === 'MEDIA' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {c.agressividade}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button className="p-2 text-slate-600 hover:text-[#0A2540] hover:bg-slate-100 rounded-lg transition-all">
                      <ExternalLink size={16} />
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