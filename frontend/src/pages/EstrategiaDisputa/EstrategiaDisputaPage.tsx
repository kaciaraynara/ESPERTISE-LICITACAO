import React, { useState } from 'react';
import { 
  Crosshair, ShieldCheck, Zap, TrendingDown, 
  Settings, Play, Pause
} from 'lucide-react';

export const EstrategiaDisputaPage: React.FC = () => {
  const [modoDisputa, setModoDisputa] = useState<'AGRESSIVO' | 'CONSERVADOR' | 'SNIPER'>('CONSERVADOR');
  const [lanceInicial, setLanceInicial] = useState<number>(180000);
  const [limiteMinimo, setLimiteMinimo] = useState<number>(142000);
  const [decrementoMinimo, setDecrementoMinimo] = useState<number>(200);
  const [delaySegundos, setDelaySegundos] = useState<number>(3);
  const [roboAtivo, setRoboAtivo] = useState<boolean>(false);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#EA580C] text-white rounded-lg shadow-md">
              <Crosshair size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Estratégia de Disputa & Tática de Lances
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configuração tática para disputa em tempo real e automação via robô programado.
          </p>
        </div>

        <button 
          onClick={() => setRoboAtivo(!roboAtivo)}
          className={`px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all ${
            roboAtivo 
              ? 'bg-rose-600 hover:bg-rose-700 text-white' 
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {roboAtivo ? <Pause size={18} /> : <Play size={18} />}
          {roboAtivo ? 'PAUSAR AUTOMAÇÃO' : 'ATIVAR ROBÔ DE DISPUTA'}
        </button>
      </header>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* MODO DE JOGO / PERFIL */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div 
            onClick={() => setModoDisputa('CONSERVADOR')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              modoDisputa === 'CONSERVADOR' 
                ? 'bg-white border-[#0A2540] ring-2 ring-[#0A2540] shadow-md' 
                : 'bg-white/60 border-slate-200 hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className="text-blue-600" size={24} />
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase">
                Segurança
              </span>
            </div>
            <h3 className="font-black text-slate-900 text-sm">Modo Conservador</h3>
            <p className="text-xs text-slate-500 mt-1">
              Cobre ofertas mantendo decrementos fixos. Preserva a margem máxima até a fase final.
            </p>
          </div>

          <div 
            onClick={() => setModoDisputa('SNIPER')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              modoDisputa === 'SNIPER' 
                ? 'bg-white border-[#EA580C] ring-2 ring-[#EA580C] shadow-md' 
                : 'bg-white/60 border-slate-200 hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className="text-[#EA580C]" size={24} />
              <span className="text-[10px] font-extrabold bg-orange-100 text-orange-800 px-2 py-0.5 rounded uppercase">
                Estratégico
              </span>
            </div>
            <h3 className="font-black text-slate-900 text-sm">Modo Sniper (Último Segundo)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Envia o lance decisivo nos últimos segundos da prorrogação da disputa.
            </p>
          </div>

          <div 
            onClick={() => setModoDisputa('AGRESSIVO')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              modoDisputa === 'AGRESSIVO' 
                ? 'bg-white border-rose-600 ring-2 ring-rose-600 shadow-md' 
                : 'bg-white/60 border-slate-200 hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="text-rose-600" size={24} />
              <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded uppercase">
                Domínio
              </span>
            </div>
            <h3 className="font-black text-slate-900 text-sm">Modo Agressivo</h3>
            <p className="text-xs text-slate-500 mt-1">
              Força queda de preço imediata para desestimular concorrentes e fechar o lote rápido.
            </p>
          </div>

        </div>

        {/* CONTROLES DE PARAMETRIZAÇÃO */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
            <Settings size={16} className="text-[#0A2540]" />
            Parâmetros Financeiros de Disputa
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lance de Abertura (Proposta Inicial)</label>
              <input 
                type="number" 
                value={lanceInicial}
                onChange={(e) => setLanceInicial(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Valor cadastrado na fase de propostas</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Preço Mínimo Improrrogável (Stop Bottom)</label>
              <input 
                type="number" 
                value={limiteMinimo}
                onChange={(e) => setLimiteMinimo(parseFloat(e.target.value) || 0)}
                className="w-full bg-rose-50 border border-rose-200 text-rose-900 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <span className="text-[10px] text-rose-500 mt-1 block font-semibold">O robô não efetuará lances abaixo deste valor</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Decremento Mínimo por Lance (R$)</label>
              <input 
                type="number" 
                value={decrementoMinimo}
                onChange={(e) => setDecrementoMinimo(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tempo de Reação (Segundos)</label>
              <input 
                type="number" 
                value={delaySegundos}
                onChange={(e) => setDelaySegundos(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
              />
            </div>
          </div>
        </div>

        {/* STATUS DA SESSÃO */}
        <div className="lg:col-span-4 bg-[#0A2540] text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#EA580C] uppercase tracking-wider block">
              Status do Algoritmo
            </span>
            <h3 className="text-xl font-black mt-1">
              {roboAtivo ? 'SISTEMA EM OPERAÇÃO' : 'SISTEMA EM STANDBY'}
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              Modo selecionado: <strong className="text-white">{modoDisputa}</strong>
            </p>
          </div>

          <div className="space-y-3 my-6 text-xs bg-white/5 p-4 rounded-xl border border-white/10">
            <div className="flex justify-between">
              <span className="text-slate-400">Lance Atual Teto:</span>
              <span className="font-bold text-white">{formatarMoeda(lanceInicial)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Piso de Segurança:</span>
              <span className="font-bold text-emerald-400">{formatarMoeda(limiteMinimo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Margem Protetora:</span>
              <span className="font-bold text-orange-400">
                {formatarMoeda(lanceInicial - limiteMinimo)}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center">
            Conectado com os portais Compras.gov, LicitaNet e Portal de Compras Públicas.
          </div>
        </div>

      </div>

    </div>
  );
};