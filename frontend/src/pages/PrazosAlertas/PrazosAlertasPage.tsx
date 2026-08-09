import React, { useState } from 'react';
import { 
  Bell, Calendar, Clock, CheckCircle2
} from 'lucide-react';

interface AlertaPrazo {
  id: string;
  orgao: string;
  objeto: string;
  tipoPrazo: 'RECURSO' | 'IMPUGNACAO' | 'CONTRATO' | 'ESCLARECIMENTO';
  dataLimite: string;
  diasRestantes: number;
  urgencia: 'CRITICA' | 'MEDIA' | 'NORMAL';
  status: 'PENDENTE' | 'CONCLUIDO';
}

export const PrazosAlertasPage: React.FC = () => {
  const [alertas, setAlertas] = useState<AlertaPrazo[]>([
    {
      id: '1',
      orgao: 'Prefeitura Municipal de São Paulo',
      objeto: 'Pregão Eletrônico nº 102/2026 - Registro de Preços para Material Didático',
      tipoPrazo: 'RECURSO',
      dataLimite: '12/08/2026 23:59',
      diasRestantes: 2,
      urgencia: 'CRITICA',
      status: 'PENDENTE'
    },
    {
      id: '2',
      orgao: 'Tribunal Regional do Trabalho - 2ª Região',
      objeto: 'Concorrência nº 015/2026 - Reforma Predial',
      tipoPrazo: 'IMPUGNACAO',
      dataLimite: '15/08/2026 17:00',
      diasRestantes: 5,
      urgencia: 'MEDIA',
      status: 'PENDENTE'
    },
    {
      id: '3',
      orgao: 'Secretaria de Saúde do Estado',
      objeto: 'Pregão Eletrônico nº 088/2026 - Insumos Hospitalares',
      tipoPrazo: 'CONTRATO',
      dataLimite: '20/08/2026 18:00',
      diasRestantes: 10,
      urgencia: 'NORMAL',
      status: 'PENDENTE'
    }
  ]);

  const concluirAlerta = (id: string) => {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, status: 'CONCLUIDO' } : a));
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Bell size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Central de Prazos, Recursos & Alertas
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de prazos fatais para Recursos Administrativos, Impugnações e Assinaturas de Contrato.
          </p>
        </div>
      </header>

      {/* PAINEL DE ALERTAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock size={16} className="text-[#EA580C]" />
            Cronograma de Prazos Fatais
          </h3>
        </div>

        <div className="space-y-3">
          {alertas.map((alerta) => (
            <div 
              key={alerta.id}
              className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                alerta.status === 'CONCLUIDO'
                  ? 'bg-slate-50 opacity-60 border-slate-200'
                  : alerta.urgencia === 'CRITICA'
                  ? 'bg-rose-50/50 border-rose-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                    alerta.tipoPrazo === 'RECURSO' 
                      ? 'bg-rose-100 text-rose-800' 
                      : alerta.tipoPrazo === 'IMPUGNACAO' 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {alerta.tipoPrazo}
                  </span>
                  <span className="text-xs font-bold text-slate-900">{alerta.orgao}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{alerta.objeto}</p>
                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Limite: {alerta.dataLimite}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {alerta.status !== 'CONCLUIDO' && (
                  <div className="text-right">
                    <span className="text-xs font-black text-rose-600 block">
                      {alerta.diasRestantes} D{alerta.diasRestantes === 1 ? 'IA' : 'IAS'} RESTANTES
                    </span>
                  </div>
                )}
                
                {alerta.status === 'PENDENTE' ? (
                  <button 
                    onClick={() => concluirAlerta(alerta.id)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all"
                  >
                    Marcar Concluído
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={16} /> Concluído
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};