import React, { useState } from 'react';
import { BarChart3, Download, Award, XCircle, ArrowUpRight } from 'lucide-react';

export const RelatoriosPage: React.FC = () => {
  const [periodo, setPeriodo] = useState('2026');

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <BarChart3 size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Relatórios Estratégicos & Analytics Licitatório
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Métricas de desempenho comercial, taxa de conversão (Win Rate), análise de ROI e motivos de perda.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={periodo} 
            onChange={(e) => setPeriodo(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 shadow-sm focus:outline-none"
          >
            <option value="2026">Ano de 2026</option>
            <option value="2025">Ano de 2025</option>
          </select>

          <button className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all">
            <Download size={16} /> EXPORTAR EXECUTIVE REPORT (PDF)
          </button>
        </div>
      </header>

      {/* KPI TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Faturamento Adjudicado
          </span>
          <span className="text-2xl font-black text-slate-900">{formatarMoeda(18450000)}</span>
          <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
            <ArrowUpRight size={12} /> +24% em relação ao ano anterior
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Taxa de Vitória (Win Rate)
          </span>
          <span className="text-2xl font-black text-emerald-600">38.4%</span>
          <div className="text-[10px] font-bold text-slate-500">
            32 vitórias em 83 disputas
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Ticket Médio por Contrato
          </span>
          <span className="text-2xl font-black text-slate-900">{formatarMoeda(576562)}</span>
          <div className="text-[10px] font-bold text-slate-500">
            Média por edital ganho
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Desconto Médio Aplicado
          </span>
          <span className="text-2xl font-black text-[#EA580C]">14.2%</span>
          <div className="text-[10px] font-bold text-slate-500">
            Abaixo da margem de segurança
          </div>
        </div>
      </div>

      {/* ANÁLISE DE MOTIVOS DE PERDA & PERFORMANCE POR PORTAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ESQUERDA: MOTIVOS DE PERDA */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <XCircle size={18} className="text-rose-600" />
            Análise de Motivos de Perda / Desclassificação
          </h3>

          <div className="space-y-3 pt-2 text-xs">
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">Preço Inexequível do Concorrente (Preço)</span>
                <span className="text-slate-900">52% (26 processos)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full" style={{ width: '52%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">Inabilitação Documental / Validade</span>
                <span className="text-slate-900">24% (12 processos)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: '24%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">Não atendimento a Requisito Técnico</span>
                <span className="text-slate-900">16% (8 processos)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-slate-700 h-full" style={{ width: '16%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">Desistência Estratégica na Disputa</span>
                <span className="text-slate-900">8% (4 processos)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: '8%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* DIREITA: DESEMPENHO POR PORTAL */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Award size={18} className="text-[#EA580C]" />
            Desempenho por Portal de Compras
          </h3>

          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 font-bold block">Compras.gov.br (SIASG)</strong>
                <span className="text-slate-500 text-[10px]">18 Vitórias | R$ 11.200.000</span>
              </div>
              <span className="font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                42.1% Win Rate
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 font-bold block">LicitaNet</strong>
                <span className="text-slate-500 text-[10px]">9 Vitórias | R$ 4.800.000</span>
              </div>
              <span className="font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                36.0% Win Rate
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 font-bold block">BEC-SP</strong>
                <span className="text-slate-500 text-[10px]">5 Vitórias | R$ 2.450.000</span>
              </div>
              <span className="font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                31.2% Win Rate
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};