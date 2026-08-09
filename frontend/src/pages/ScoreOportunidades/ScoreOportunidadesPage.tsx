import React, { useState } from 'react';
import { 
  Target, ShieldAlert, Zap, BarChart3, 
  AlertTriangle, Building2
} from 'lucide-react';

interface OportunidadeScore {
  id: string;
  edital: string;
  orgao: string;
  valorEstimado: number;
  scoreGeral: number; // 0 a 100
  classificacao: 'ALTA_VIABILIDADE' | 'MEDIA_VIABILIDADE' | 'ALTO_RISCO';
  breakdown: {
    tecnico: number;
    comercial: number;
    juridico: number;
    concorrencial: number;
  };
  principalRisco: string;
}

export const ScoreOportunidadesPage: React.FC = () => {
  const [oportunidades] = useState<OportunidadeScore[]>([
    {
      id: '1',
      edital: 'PE 102/2026 - ERP e Suporte',
      orgao: 'Prefeitura Municipal de São Paulo',
      valorEstimado: 450000,
      scoreGeral: 88,
      classificacao: 'ALTA_VIABILIDADE',
      breakdown: { tecnico: 95, comercial: 85, juridico: 90, concorrencial: 82 },
      principalRisco: 'Prazo exíguo de implantação do sistema (30 dias).'
    },
    {
      id: '2',
      edital: 'PE 044/2026 - Consultoria TI',
      orgao: 'Governo do Estado do RJ - SEFAZ',
      valorEstimado: 1200000,
      scoreGeral: 65,
      classificacao: 'MEDIA_VIABILIDADE',
      breakdown: { tecnico: 80, comercial: 60, juridico: 55, concorrencial: 65 },
      principalRisco: 'Prazo de pagamento de 60 dias após emissão da NF.'
    },
    {
      id: '3',
      edital: 'PE 088/2026 - Equipamentos Hospitalares',
      orgao: 'Secretaria de Saúde do Estado de SP',
      valorEstimado: 3100000,
      scoreGeral: 42,
      classificacao: 'ALTO_RISCO',
      breakdown: { tecnico: 40, comercial: 50, juridico: 30, concorrencial: 48 },
      principalRisco: 'Exigência de atestado de capacidade técnica com especificações abusivas.'
    }
  ]);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getCorScore = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Target size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Score de Oportunidades & Matriz de Risco
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Algoritmo preditivo de viabilidade, atratividade comercial e matriz quantitativa de risco.
          </p>
        </div>
      </header>

      {/* METRICAS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Score Médio do Portfólio
            </span>
            <span className="text-2xl font-black text-slate-900">65.0 / 100</span>
          </div>
          <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
            <BarChart3 size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Oportunidades "Quentes"
            </span>
            <span className="text-2xl font-black text-emerald-600">1 Edital</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Zap size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Alertas de Alto Risco
            </span>
            <span className="text-2xl font-black text-rose-600">1 Edital</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* LISTA DE OPORTUNIDADES E SCORE DETALHADO */}
      <div className="space-y-6">
        {oportunidades.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* INFORMAÇÕES BÁSICAS */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900">{item.edital}</span>
              </div>
              <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
                <Building2 size={14} /> {item.orgao}
              </p>
              <div className="text-xs text-slate-700">
                Valor Estimado: <strong className="font-black text-slate-900">{formatarMoeda(item.valorEstimado)}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 mt-2">
                <strong className="text-rose-600 block mb-0.5 font-bold flex items-center gap-1">
                  <ShieldAlert size={12} /> Fator Principal de Risco:
                </strong>
                {item.principalRisco}
              </div>
            </div>

            {/* BARRA DE SCORE / BREAKDOWN */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Composição do Score (0-100)
              </span>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600">Capacidade Técnica:</span>
                  <span className="text-slate-900">{item.breakdown.tecnico}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#0A2540] h-full" style={{ width: `${item.breakdown.tecnico}%` }}></div>
                </div>

                <div className="flex justify-between font-bold pt-1">
                  <span className="text-slate-600">Atratividade Comercial:</span>
                  <span className="text-slate-900">{item.breakdown.comercial}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#EA580C] h-full" style={{ width: `${item.breakdown.comercial}%` }}></div>
                </div>

                <div className="flex justify-between font-bold pt-1">
                  <span className="text-slate-600">Segurança Jurídica:</span>
                  <span className="text-slate-900">{item.breakdown.juridico}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${item.breakdown.juridico}%` }}></div>
                </div>
              </div>
            </div>

            {/* CARD DE SCORE FINAL */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center p-4 rounded-xl border text-center space-y-1 bg-slate-50">
              <span className="text-[10px] font-black uppercase text-slate-400">Score Final</span>
              <span className={`text-3xl font-black px-3 py-1 rounded-xl border ${getCorScore(item.scoreGeral)}`}>
                {item.scoreGeral}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                {item.classificacao.replace('_', ' ')}
              </span>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};