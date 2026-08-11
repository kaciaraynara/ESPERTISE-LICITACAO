import { FORNECEDOR_ROUTES } from '@/routes';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { ArrowLeft, CheckCircle, Warning, Info } from '@phosphor-icons/react';

const radarData = [
  { subject: 'Preço', A: 90, B: 60, C: 70, D: 50 },
  { subject: 'Qualidade Técnica', A: 95, B: 75, C: 65, D: 85 },
  { subject: 'Capacidade', A: 85, B: 90, C: 70, D: 60 },
  { subject: 'Histórico', A: 80, B: 85, C: 60, D: 75 },
  { subject: 'Prazo', A: 90, B: 70, C: 80, D: 65 },
];

const scoreData = [
  { name: 'Score', value: 85 },
  { name: 'Rest', value: 15 },
];

export function AnaliseViabilidadeDetalhePage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <header className="flex flex-col gap-4 pb-8 border-b border-slate-200 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
            Análise de Viabilidade
          </h1>
          <Link to={FORNECEDOR_ROUTES.dashboard} className="text-sm font-bold text-brand-blue hover:underline flex items-center gap-1 mt-1">
            <ArrowLeft weight="bold" /> Voltar para editais
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-500">Edital: Pregão 042/2024</span>
          <button className="bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-sm px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors">
            <Info weight="bold" /> Gerar Relatório
          </button>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Score de Viabilidade */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col justify-center items-center relative">
          <h2 className="absolute top-6 left-6 text-lg font-black text-slate-900">Score de Viabilidade</h2>
          
          <div className="w-64 h-64 relative mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#F1F5F9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-black text-[#10B981]">85%</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#10B981] mt-1">ALTA VIABILIDADE</span>
              <span className="text-xs text-slate-400 mt-2 text-center max-w-[120px] leading-tight">Excelente oportunidade para participação</span>
            </div>
          </div>
        </div>

        {/* Resumo da Análise */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-black text-slate-900 mb-6">Resumo da Análise</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#10B981]" weight="fill" />
                <span className="font-bold text-slate-700">Estudo de Preços</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[#10B981]">Concluído</span>
            </div>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#10B981]" weight="fill" />
                <span className="font-bold text-slate-700">Perfil da Concorrência</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[#10B981]">Concluído</span>
            </div>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#10B981]" weight="fill" />
                <span className="font-bold text-slate-700">Exigências do Edital</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[#10B981]">Concluído</span>
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Warning className="w-5 h-5 text-[#F59E0B]" weight="fill" />
                <span className="font-bold text-slate-700">Riscos Identificados</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[#F59E0B]">2 riscos baixos</span>
            </div>
          </div>
        </div>

        {/* Análise de Preços */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-black text-slate-900 mb-2">Análise de Preços</h2>
          <p className="text-xs text-slate-500 mb-8">Comparativo com estimativa</p>

          <div className="space-y-8">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-slate-700 text-sm">Nosso Preço</span>
                <span className="font-black text-[#10B981] text-sm">R$ 245.000,00</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                <div className="absolute top-0 left-0 h-full bg-[#10B981] rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-slate-700 text-sm">Estimativa</span>
                <span className="font-black text-[#0A2540] text-sm">R$ 280.000,00</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                <div className="absolute top-0 left-0 h-full bg-[#0A2540] rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-center">
            <span className="font-bold text-slate-700 text-sm">Margem Estimada</span>
            <span className="font-black text-lg text-slate-900">12,5%</span>
          </div>
        </div>

        {/* Análise da Concorrência */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-lg font-black text-slate-900">Análise da Concorrência</h2>
              <p className="text-xs text-slate-500">Posicionamento competitivo</p>
            </div>
            
            <div className="flex flex-col gap-2 text-[10px] font-bold">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0A2540]"></div>
                <span>Nossa Empresa</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3B82F6]"></div>
                <span>Concorrente 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                <span>Concorrente 2</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#94A3B8]"></div>
                <span>Concorrente 3</span>
              </div>
            </div>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Nossa Empresa" dataKey="A" stroke="#0A2540" fill="#0A2540" fillOpacity={0.1} strokeWidth={2} />
                <Radar name="Concorrente 1" dataKey="B" stroke="#3B82F6" fill="transparent" strokeWidth={2} />
                <Radar name="Concorrente 2" dataKey="C" stroke="#F59E0B" fill="transparent" strokeWidth={2} />
                <Radar name="Concorrente 3" dataKey="D" stroke="#94A3B8" fill="transparent" strokeWidth={2} strokeDasharray="3 3" />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Riscos e Exigências */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 lg:col-span-2">
          <h2 className="text-lg font-black text-slate-900 mb-2">Riscos e Exigências</h2>
          <p className="text-xs text-slate-500 mb-8">Verificação automática</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">Qualificação Técnica</span>
              </div>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">Atendido</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">Garantias</span>
              </div>
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">Atenção</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">Qualificação Econômica</span>
              </div>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">Atendido</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">Visita Técnica</span>
              </div>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">Não exigida</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">Documentação</span>
              </div>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">Atendido</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">Amostras</span>
              </div>
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">Atenção</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
