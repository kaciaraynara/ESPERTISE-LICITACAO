import { FORNECEDOR_ROUTES } from '@/routes';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { getUserDisplayName } from '@/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: '30/06', editais: 140, valor: 80, orgaos: 40 },
  { name: '07/07', editais: 200, valor: 150, orgaos: 80 },
  { name: '14/07', editais: 240, valor: 280, orgaos: 120 },
  { name: '21/07', editais: 260, valor: 320, orgaos: 150 },
  { name: '29/07', editais: 280, valor: 350, orgaos: 180 },
];

export default function DashboardPage() {
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date()).replace('.', '');

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <header className="flex flex-col gap-2 pb-8 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 mb-8">
        <div className="flex items-center gap-3 pl-3 border-l-4 border-[#EA580C]">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
              Radar de Editais
            </h1>
            <p className="text-sm font-medium text-slate-500">Dados atualizados em tempo real de fontes oficiais</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-slate-200/50 px-4 py-2 text-xs font-bold text-slate-500">
            {dateLabel}
          </span>
        </div>
      </header>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Editais Ativos</p>
          <div className="text-4xl font-black text-[#0A2540] mb-2">237</div>
          <p className="text-xs font-bold text-emerald-600">+18% vs. ontem</p>
          <p className="text-[10px] text-slate-400 mt-1">Fontes oficiais</p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Valor Total</p>
          <div className="text-4xl font-black text-[#0A2540] mb-2">R$ 48,7 mi</div>
          <p className="text-xs font-bold text-emerald-600">+12% vs. ontem</p>
          <p className="text-[10px] text-slate-400 mt-1">Calculado com base nos dados oficiais</p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Órgãos Compradores</p>
          <div className="text-4xl font-black text-[#0A2540] mb-2">156</div>
          <p className="text-xs font-bold text-emerald-600">+9% vs. ontem</p>
          <p className="text-[10px] text-slate-400 mt-1">Dados verificados</p>
        </div>
      </div>

      {/* Fontes Oficiais */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">Fontes oficiais</h2>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Verificadas</span>
            </div>
            <p className="text-sm text-slate-500">Dados obtidos diretamente dos portais oficiais</p>
          </div>
          <button className="text-sm font-bold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition">
            Ver todas as fontes
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center text-white font-bold text-xs">CN</div>
            <div>
              <p className="text-sm font-black text-slate-800">COMPRASNET</p>
              <p className="text-[10px] font-semibold text-slate-500">Governo Federal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-xs">PN</div>
            <div>
              <p className="text-sm font-black text-slate-800">PNCP</p>
              <p className="text-[10px] font-semibold text-slate-500">Portal Nacional</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs">SP</div>
            <div>
              <p className="text-sm font-black text-slate-800">TCE/SP</p>
              <p className="text-[10px] font-semibold text-slate-500">Tribunal de Contas SP</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-indigo-900 rounded-full flex items-center justify-center text-white font-bold text-xs">TC</div>
            <div>
              <p className="text-sm font-black text-slate-800">TCU</p>
              <p className="text-[10px] font-semibold text-slate-500">Tribunal de Contas da União</p>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico do mercado (Line Chart) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Histórico do mercado</h2>
            <p className="text-sm text-slate-500">Acompanhe a evolução dos dados do mercado</p>
          </div>
          <select className="text-sm font-bold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 bg-white hover:bg-slate-50 transition outline-none cursor-pointer">
            <option>Últimos 30 dias</option>
            <option>Últimos 3 meses</option>
            <option>Este ano</option>
          </select>
        </div>

        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-[#1d4ed8] rounded-full"></div>
            <span className="text-xs font-bold text-slate-600">Editais publicados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-[#ea580c] rounded-full"></div>
            <span className="text-xs font-bold text-slate-600">Valor total (R$)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-[#059669] rounded-full"></div>
            <span className="text-xs font-bold text-slate-600">Órgãos compradores</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
              />
              <Line type="monotone" dataKey="editais" stroke="#1d4ed8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="valor" stroke="#ea580c" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="orgaos" stroke="#059669" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Exemplo de edital ativo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-black text-slate-900">Exemplo de edital ativo</h2>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Dado real</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-100 bg-slate-50/50 p-5 rounded-xl">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Órgão</p>
            <p className="text-sm font-bold text-[#0A2540]">PREFEITURA MUNICIPAL DE SÃO PAULO</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Objeto</p>
            <p className="text-sm font-bold text-slate-600 max-w-xs truncate">Aquisição de materiais de escritório</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor Estimado</p>
            <p className="text-sm font-black text-[#0A2540]">R$ 1.250.000,00</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Abertura</p>
            <p className="text-sm font-bold text-slate-600">15/08/2026 09:00</p>
          </div>
          <button className="text-xs font-bold text-[#0A2540] border border-[#0A2540] rounded-lg px-4 py-2 hover:bg-[#0A2540] hover:text-white transition whitespace-nowrap">
            Ver detalhes
          </button>
        </div>
      </div>

    </div>
  );
}
