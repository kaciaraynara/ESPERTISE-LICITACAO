import { useState } from 'react';
import { FORNECEDOR_ROUTES } from '@/routes';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Funnel } from '@phosphor-icons/react';

// Mocked Sparkline Data
const generateSparkline = (trend: 'up' | 'down' | 'flat') => {
  return Array.from({ length: 15 }, (_, i) => {
    let val = 100;
    if (trend === 'up') val = 50 + i * 5 + Math.random() * 20;
    if (trend === 'down') val = 150 - i * 5 + Math.random() * 20;
    if (trend === 'flat') val = 100 + Math.random() * 20 - 10;
    return { val };
  });
};

const competitors = [
  { rank: 1, name: 'TechSupri Ltda.', cnpj: '12.345.678/0001-90', winRate: 38.6, part: 24, trend: 'Competitivo', color: '#10B981', sparkline: generateSparkline('down') },
  { rank: 2, name: 'Inova Solutions', cnpj: '98.765.432/0001-10', winRate: 27.4, part: 18, trend: 'Moderado', color: '#F59E0B', sparkline: generateSparkline('flat') },
  { rank: 3, name: 'Global Tech', cnpj: '11.222.333/0001-44', winRate: 21.8, part: 15, trend: 'Agressivo', color: '#EF4444', sparkline: generateSparkline('down') },
  { rank: 4, name: 'Soluções Integradas', cnpj: '55.666.777/0001-88', winRate: 16.2, part: 11, trend: 'Agressivo', color: '#EF4444', sparkline: generateSparkline('down') },
  { rank: 5, name: 'Smart Serviços', cnpj: '99.888.777/0001-66', winRate: 13.5, part: 9, trend: 'Competitivo', color: '#10B981', sparkline: generateSparkline('up') },
];

export function HistoricoConcorrentesPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <header className="flex flex-col gap-2 pb-8 border-b border-slate-200 mb-8">
        <div className="flex items-center gap-3 pl-3 border-l-4 border-[#0A2540]">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
              Histórico de Concorrentes
            </h1>
            <p className="text-sm font-medium text-slate-500">Acompanhe o desempenho e comportamento dos seus concorrentes.</p>
          </div>
        </div>
      </header>

      {/* Filters & Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Período</label>
            <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:border-[#0A2540]">
              <option>Últimos 6 meses</option>
              <option>Último ano</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Segmento</label>
            <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:border-[#0A2540]">
              <option>Todos</option>
              <option>Tecnologia da Informação</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Órgão</label>
            <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:border-[#0A2540]">
              <option>Todos</option>
              <option>Governo Federal</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-sm px-8 py-2.5 rounded-lg flex items-center gap-2 transition-colors">
              Filtrar
              <Funnel weight="bold" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-y border-slate-200">
                <th className="py-4 px-4 w-12 text-center"></th>
                <th className="py-4 px-4">Empresa</th>
                <th className="py-4 px-4 text-center">Taxa de Vitória*</th>
                <th className="py-4 px-4 text-center">Frequência de Participação</th>
                <th className="py-4 px-4">Comportamento de Preços</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {competitors.map((comp) => (
                <tr key={comp.rank} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 text-center font-black text-slate-800">{comp.rank}</td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900 text-sm">{comp.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{comp.cnpj}</p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <p className="font-black text-lg" style={{ color: comp.color }}>{comp.winRate.toLocaleString('pt-BR')}%</p>
                    <p className="text-[10px] text-slate-400">Vitórias</p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <p className="font-black text-lg text-slate-800">{comp.part}</p>
                    <p className="text-[10px] text-slate-400">Participações</p>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={comp.sparkline}>
                            <YAxis domain={['dataMin', 'dataMax']} hide />
                            <Line type="monotone" dataKey="val" stroke={comp.color} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Tendência de Preços</p>
                        <p className="text-[11px] font-bold" style={{ color: comp.color }}>{comp.trend}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
