// 📁 frontend/src/pages/analise-viabilidade/AnaliseViabilidadeScreen.tsx

import React from 'react';
import { 
  CheckCircle2, AlertTriangle, ArrowLeft, Download, 
  ChevronDown, ShieldCheck, FileText, BarChart3, Users, History, Layers
} from 'lucide-react';

export const AnaliseViabilidadeScreen: React.FC = () => {
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* SIDEBAR LATERAL */}
      <aside className="w-64 bg-[#0B1736] text-white flex flex-col justify-between p-4">
        <div>
          {/* Logo Expertise Licitatória */}
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-orange-500 flex items-center justify-center font-bold text-xs">
              EL
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">EXPERTISE</h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-wider">LICITATÓRIA</p>
            </div>
          </div>

          {/* Menus de Navegação */}
          <nav className="space-y-1 text-xs">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Layers size={16} /> <span>Página Inicial</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-orange-500 text-white font-semibold">
              <BarChart3 size={16} /> <span>Análise de Viabilidade</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <FileText size={16} /> <span>Edital</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Users size={16} /> <span>Análise de Concorrência</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <ShieldCheck size={16} /> <span>Exigências do Edital</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Download size={16} /> <span>Relatórios</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <History size={16} /> <span>Histórico</span>
            </a>
          </nav>
        </div>

        {/* Rodapé do Perfil do Usuário */}
        <div className="border-t border-slate-800 pt-3">
          <p className="text-[10px] text-slate-400">Plano PRO</p>
          <p className="text-xs font-semibold text-slate-200">TechSupri Ltda.</p>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto p-8">
        
        {/* CABEÇALHO DA TELA */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Análise de Viabilidade</h1>
            <a href="#" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-1">
              <ArrowLeft size={12} /> Voltar para editais
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Edital */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm cursor-pointer">
              <span>Edital: Pregão 042/2024</span>
              <ChevronDown size={14} className="text-slate-400" />
            </div>

            {/* Botão Gerar Relatório */}
            <button className="bg-[#0B1736] hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow transition">
              <Download size={14} /> Gerar Relatório
            </button>
          </div>
        </div>

        {/* GRID SUPERIOR: SCORE + RESUMO */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          
          {/* Card 1: Score de Viabilidade */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-slate-800 text-sm mb-4 self-start">Score de Viabilidade</h3>
            
            {/* Gauge Circular */}
            <div className="relative w-40 h-40 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray="85, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-3xl font-extrabold text-slate-900">85%</span>
                <p className="text-[10px] font-bold text-emerald-600 tracking-wider">ALTA VIABILIDADE</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-2">Excelente oportunidade para participação</p>
          </div>

          {/* Card 2: Resumo da Análise */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Resumo da Análise</h3>
            
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-500" /> Estudo de Preços
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-bold">Concluído</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-500" /> Perfil da Concorrência
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-bold">Concluído</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-500" /> Exigências do Edital
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-bold">Concluído</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <AlertTriangle size={16} className="text-amber-500" /> Riscos Identificados
                </span>
                <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded text-[10px] font-bold">2 riscos baixos</span>
              </div>
            </div>
          </div>

        </div>

        {/* GRID INTERMEDIÁRIO: PREÇOS + CONCORRÊNCIA */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          
          {/* Card 3: Análise de Preços */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Análise de Preços</h3>
              <p className="text-[11px] text-slate-400 mb-6">Comparativo com estimativa</p>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">Nosso Preço</span>
                    <span className="text-slate-900">R$ 245.000,00</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: '87.5%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">Estimativa</span>
                    <span className="text-slate-900">R$ 280.000,00</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-6">
              <span className="text-xs text-slate-500 font-medium">Margem Estimada</span>
              <span className="text-lg font-bold text-emerald-600">12,5%</span>
            </div>
          </div>

          {/* Card 4: Radar de Concorrência */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm">Análise da Concorrência</h3>
            <p className="text-[11px] text-slate-400 mb-4">Posicionamento competitivo</p>

            {/* Simulação do Gráfico de Radar em SVG */}
            <div className="flex justify-center my-2">
              <svg width="220" height="180" viewBox="0 0 200 180" className="overflow-visible">
                {/* Linhas teia */}
                <polygon points="100,20 170,60 145,140 55,140 30,60" fill="none" stroke="#E2E8F0" strokeWidth="1" />
                <polygon points="100,50 145,75 130,120 70,120 55,75" fill="none" stroke="#E2E8F0" strokeWidth="1" />
                
                {/* Nosso Perfil (Azul Escuro) */}
                <polygon points="100,25 160,65 135,130 65,135 40,65" fill="rgba(37, 99, 235, 0.15)" stroke="#2563EB" strokeWidth="2" />

                {/* Concorrente 1 (Laranja) */}
                <polygon points="100,45 150,70 140,125 60,115 50,75" fill="none" stroke="#F97316" strokeWidth="1.5" strokeDasharray="3,3" />

                {/* Rótulos dos Eixos */}
                <text x="100" y="10" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">Preço</text>
                <text x="180" y="60" textAnchor="start" className="text-[9px] fill-slate-400 font-semibold">Qualidade Técnica</text>
                <text x="150" y="160" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">Capacidade</text>
                <text x="50" y="160" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">Histórico</text>
                <text x="20" y="60" textAnchor="end" className="text-[9px] fill-slate-400 font-semibold">Prazo</text>
              </svg>
            </div>

            {/* Legenda do Gráfico */}
            <div className="flex justify-center gap-4 text-[10px] text-slate-600 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600" /> Nossa Empresa</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Concorrente 1</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Concorrente 2</span>
            </div>
          </div>

        </div>

        {/* TABELA INFERIOR: RISCOS E EXIGÊNCIAS */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm">Riscos e Exigências</h3>
          <p className="text-[11px] text-slate-400 mb-4">Verificação automática</p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-700 font-medium">Qualificação Técnica</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">Atendido</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-700 font-medium">Garantias</span>
              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Atenção</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-700 font-medium">Qualificação Econômica</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">Atendido</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-700 font-medium">Visita Técnica</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">Não exigida</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-700 font-medium">Documentação</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">Atendido</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-700 font-medium">Amostras</span>
              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Atenção</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};