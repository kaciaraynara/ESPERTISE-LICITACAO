// 📁 frontend/src/pages/Srp/SrpPage.tsx

import React, { useState } from 'react';
import { 
  FileCheck, Building2, DollarSign, TrendingUp, Plus, ExternalLink, Share2
} from 'lucide-react';

interface AtaRegistroPreco {
  id: string;
  numeroAta: string;
  orgaoGerenciador: string;
  objeto: string;
  valorTotalAta: number;
  saldoDisponivel: number;
  vigenciaFim: string;
  permitirCarona: boolean;
  caronasAprovadasCount: number;
  status: 'VIGENTE' | 'PRÓXIMO_VENCIMENTO' | 'EXHAUSTED' | 'EXPIRADO';
}

export const SrpPage: React.FC = () => {
  const [atas] = useState<AtaRegistroPreco[]>([
    {
      id: '1',
      numeroAta: 'ARP 014/2025',
      orgaoGerenciador: 'Ministério da Saúde - DLOG',
      objeto: 'Ata de Registro de Preços para fornecimento de licenças de software corporativo e suporte técnico.',
      valorTotalAta: 5000000,
      saldoDisponivel: 3200000,
      vigenciaFim: '15/11/2026',
      permitirCarona: true,
      caronasAprovadasCount: 3,
      status: 'VIGENTE'
    },
    {
      id: '2',
      numeroAta: 'ARP 089/2025',
      orgaoGerenciador: 'Prefeitura Municipal de Campinas',
      objeto: 'Registro de preços para contratação de serviços continuados de tecnologia da informação.',
      valorTotalAta: 1800000,
      saldoDisponivel: 250000,
      vigenciaFim: '28/09/2026',
      permitirCarona: true,
      caronasAprovadasCount: 5,
      status: 'PRÓXIMO_VENCIMENTO'
    },
    {
      id: '3',
      numeroAta: 'ARP 102/2024',
      orgaoGerenciador: 'Governo do Estado de Minas Gerais - SEPLAG',
      objeto: 'Aquisição de equipamentos de processamento de dados e conectividade.',
      valorTotalAta: 8900000,
      saldoDisponivel: 0,
      vigenciaFim: '10/01/2026',
      permitirCarona: false,
      caronasAprovadasCount: 12,
      status: 'EXHAUSTED'
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
              <FileCheck size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              SRP & Gestão de Atas de Registro de Preços / Caronas
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de saldos de Atas de Registro de Preços (ARP), controle de empenhos e autorizações de adesão por órgãos não participantes (caronas).
          </p>
        </div>

        <button className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all">
          <Plus size={16} /> REGISTRAR NOVA ATA (ARP)
        </button>
      </header>

      {/* METRICAS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Total Registrado em Atas
            </span>
            <span className="text-2xl font-black text-slate-900">{formatarMoeda(15700000)}</span>
          </div>
          <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Saldo Restante para Empenho
            </span>
            <span className="text-2xl font-black text-emerald-600">{formatarMoeda(3450000)}</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Caronas Aprovadas (Total)
            </span>
            <span className="text-2xl font-black text-slate-900">20 Solicitações</span>
          </div>
          <div className="p-3 bg-orange-50 text-[#EA580C] rounded-xl">
            <Share2 size={24} />
          </div>
        </div>
      </div>

      {/* LISTA DE ATAS */}
      <div className="space-y-4">
        {atas.map((ata) => {
          const percentualUsado = Math.round(((ata.valorTotalAta - ata.saldoDisponivel) / ata.valorTotalAta) * 100);

          return (
            <div key={ata.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-[#0A2540] text-white font-black text-xs px-2.5 py-1 rounded-lg">
                    {ata.numeroAta}
                  </span>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Building2 size={14} className="text-slate-400" /> Órgão Gerenciador: {ata.orgaoGerenciador}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                    ata.status === 'VIGENTE' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : ata.status === 'PRÓXIMO_VENCIMENTO' 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {ata.status.replace('_', ' ')}
                  </span>

                  {ata.permitirCarona && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800 flex items-center gap-1">
                      <Share2 size={10} /> Aceita Carona
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-700 font-medium">
                {ata.objeto}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div className="md:col-span-4">
                  <span className="text-slate-500 font-bold block">Valor Total Registrado:</span>
                  <span className="text-slate-900 font-black text-sm">{formatarMoeda(ata.valorTotalAta)}</span>
                </div>

                <div className="md:col-span-5">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-500">Saldo Disponível:</span>
                    <span className="text-emerald-600 font-black">{formatarMoeda(ata.saldoDisponivel)} ({100 - percentualUsado}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#EA580C] h-full" style={{ width: `${percentualUsado}%` }}></div>
                  </div>
                </div>

                <div className="md:col-span-3 text-right">
                  <span className="text-slate-500 font-bold block">Vigência até:</span>
                  <span className="text-slate-900 font-black">{ata.vigenciaFim}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-bold">
                  Adesões de Carona Aprovadas: <strong className="text-slate-900 font-black">{ata.caronasAprovadasCount}</strong>
                </span>

                <button className="px-4 py-2 bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all">
                  <ExternalLink size={14} /> Detalhes & Solicitações de Adesão
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};