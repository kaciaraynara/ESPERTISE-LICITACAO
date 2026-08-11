import { useState } from 'react';
import { 
  FileText, Calendar, DollarSign, TrendingUp, 
  Plus, Search, ChevronRight, Clock
} from 'lucide-react';

interface Contrato {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  valorTotal: number;
  saldoRestante: number;
  dataInicio: string;
  dataFim: string;
  status: 'Ativo' | 'Em Reajuste' | 'Vencendo' | 'Encerrado';
  progressoPct: number;
}

export default function GestaoContratosPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const [contratos] = useState<Contrato[]>([]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header com Ações */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#EA580C]">Execução Contratual</span>
          <h1 className="text-2xl font-black text-[#0A2540]">Gestão de Contratos Públicos</h1>
          <p className="text-sm font-medium text-slate-500">Acompanhamento de vigências, saldo, reajustes, repactuações e termos aditivos.</p>
        </div>

        <button className="flex items-center gap-2 px-5 py-3 bg-[#0A2540] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-colors">
          <Plus className="w-4 h-4 text-[#EA580C]" />
          Novo Contrato
        </button>
      </div>

      {/* KPI Dashboard de Contratos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Contratos Ativos</p>
            <p className="text-xl font-black text-[#0A2540]">{contratos.length} Contratos</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Valor Total Sob Gestão</p>
            <p className="text-xl font-black text-[#0A2540]">R$ 0,00</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">A Vencer (30 dias)</p>
            <p className="text-xl font-black text-amber-600">0 Contratos</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Reajustes Anuais</p>
            <p className="text-xl font-black text-purple-700">0 Pendentes</p>
          </div>
        </div>
      </div>

      {/* Lista de Contratos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por número, órgão ou objeto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-[#0A2540] bg-white font-medium"
            />
          </div>
        </div>

        {/* Tabela de Contratos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-slate-700">
            <thead className="bg-slate-100 text-[#0A2540] font-black uppercase text-[10px] tracking-wider border-b">
              <tr>
                <th className="p-4">Contrato / Órgão</th>
                <th className="p-4">Vigência</th>
                <th className="p-4">Valor / Saldo</th>
                <th className="p-4">Status</th>
                <th className="p-4">Execução</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contratos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-10 h-10 text-slate-300" />
                      <p>Nenhum contrato cadastrado no momento.</p>
                      <button className="text-brand-blue font-bold text-xs uppercase hover:underline">
                        Cadastrar primeiro contrato
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                contratos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <p className="font-black text-[#0A2540]">{c.numero}</p>
                      <p className="text-[11px] text-slate-500 font-semibold">{c.orgao}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-xs">{c.objeto}</p>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.dataInicio} até {c.dataFim}</span>
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <p className="font-bold text-[#0A2540]">
                        R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Saldo: R$ {c.saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        c.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' :
                        c.status === 'Vencendo' ? 'bg-amber-100 text-amber-800' :
                        c.status === 'Em Reajuste' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="p-4 w-40 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>{c.progressoPct}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#EA580C] h-full rounded-full" 
                            style={{ width: `${c.progressoPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}