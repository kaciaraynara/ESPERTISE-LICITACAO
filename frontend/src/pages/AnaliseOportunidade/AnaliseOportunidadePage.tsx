import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSearch,
  Scale,
  CheckSquare,
  Square,
} from 'lucide-react';

interface RequisitoEdital {
  id: string;
  categoria: 'HABILITACAO' | 'TECNICA' | 'FINANCEIRA' | 'OPERACIONAL';
  descricao: string;
  atendido: boolean;
  critico: boolean;
}

export const AnaliseOportunidadePage: React.FC = () => {
  const [valorProposta, setValorProposta] = useState<number>(450000);
  const [prazoExecucaoDias, setPrazoExecucaoDias] = useState<number>(30);
  const [margemEstimada, setMargemEstimada] = useState<number>(15);

  const [requisitos, setRequisitos] = useState<RequisitoEdital[]>([
    { id: '1', categoria: 'HABILITACAO', descricao: 'CND Federal, Estadual e Municipal Válidas', atendido: true, critico: true },
    { id: '2', categoria: 'TECNICA', descricao: 'Atestado de Capacidade Técnica compatível com 50% do objeto', atendido: true, critico: true },
    { id: '3', categoria: 'FINANCEIRA', descricao: 'Índice de Liquidez Geral (ILG) >= 1.0', atendido: true, critico: true },
    { id: '4', categoria: 'OPERACIONAL', descricao: 'Equipe técnica disponível no Estado de execução', atendido: false, critico: false },
    { id: '5', categoria: 'HABILITACAO', descricao: 'Balanço Patrimonial do último exercício social registrado', atendido: true, critico: true },
    { id: '6', categoria: 'OPERACIONAL', descricao: 'Vistoria técnica prévia obrigatória realizada', atendido: false, critico: true },
  ]);

  const toggleRequisito = (id: string) => {
    setRequisitos(prev => prev.map(item => item.id === id ? { ...item, atendido: !item.atendido } : item));
  };

  // Matriz de Decisão Go / No-Go
  const resultadoMatriz = useMemo(() => {
    const totalCriticos = requisitos.filter(r => r.critico).length;
    const criticosAtendidos = requisitos.filter(r => r.critico && r.atendido).length;
    const totalGeral = requisitos.length;
    const atendidosGeral = requisitos.filter(r => r.atendido).length;

    const percentualCritico = totalCriticos > 0 ? (criticosAtendidos / totalCriticos) * 100 : 100;
    const percentualGeral = totalGeral > 0 ? (atendidosGeral / totalGeral) * 100 : 100;

    let decisao: 'GO' | 'ALERTA' | 'NO_GO' = 'GO';
    let motivo = 'Todos os critérios críticos foram atendidos. Viabilidade técnica confirmada.';

    if (percentualCritico < 100) {
      decisao = 'NO_GO';
      motivo = 'Existem requisitos críticos obrigatórios não atendidos. Risco de inabilitação.';
    } else if (percentualGeral < 80 || margemEstimada < 10) {
      decisao = 'ALERTA';
      motivo = 'Viável, porém com pendências operacionais ou margem de lucro comprimida.';
    }

    return { decisao, motivo, percentualCritico, percentualGeral };
  }, [requisitos, margemEstimada]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <FileSearch size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Análise de Oportunidade & Matriz Go / No-Go
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Avaliação automatizada de riscos de inabilitação, capacidade técnica e viabilidade operacional.
          </p>
        </div>

        {/* DECISÃO FINAL EM DESTAQUE */}
        <div className="flex items-center gap-3">
          <div className={`px-5 py-3 rounded-xl border shadow-sm flex items-center gap-3 ${
            resultadoMatriz.decisao === 'GO' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : resultadoMatriz.decisao === 'ALERTA' 
              ? 'bg-amber-50 border-amber-200 text-amber-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {resultadoMatriz.decisao === 'GO' && <CheckCircle className="text-emerald-600" size={28} />}
            {resultadoMatriz.decisao === 'ALERTA' && <AlertTriangle className="text-amber-600" size={28} />}
            {resultadoMatriz.decisao === 'NO_GO' && <XCircle className="text-rose-600" size={28} />}
            
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">
                Parecer Técnico Final
              </span>
              <span className="text-lg font-black tracking-tight">
                {resultadoMatriz.decisao === 'GO' && 'APROVADO (GO)'}
                {resultadoMatriz.decisao === 'ALERTA' && 'ATENÇÃO (RISCO MÉDIO)'}
                {resultadoMatriz.decisao === 'NO_GO' && 'REPROVADO (NO-GO)'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* PAINEL PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA DA ESQUERDA: CHECKLIST DE EDITAL */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Scale size={16} className="text-[#EA580C]" />
              Checklist de Requisitos do Edital
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Marque os itens validados na documentação da empresa
            </span>
          </div>

          <div className="space-y-3">
            {requisitos.map((req) => (
              <div 
                key={req.id}
                onClick={() => toggleRequisito(req.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  req.atendido 
                    ? 'bg-slate-50/50 border-slate-200 hover:border-slate-300' 
                    : 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                }`}
              >
                <button className="mt-0.5 text-slate-700">
                  {req.atendido ? (
                    <CheckSquare size={18} className="text-emerald-600" />
                  ) : (
                    <Square size={18} className="text-slate-400" />
                  )}
                </button>

                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800">{req.descricao}</span>
                    {req.critico && (
                      <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                        Eliminatório
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {req.categoria}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA DA DIREITA: PARÂMETROS OPERACIONAIS & DIAGNÓSTICO */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* CARD DE PARÂMETROS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Métricas do Processo
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Valor Estimado do Contrato</label>
              <input 
                type="number"
                value={valorProposta}
                onChange={(e) => setValorProposta(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prazo Execução (Dias)</label>
                <input 
                  type="number"
                  value={prazoExecucaoDias}
                  onChange={(e) => setPrazoExecucaoDias(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Margem Líquida (%)</label>
                <input 
                  type="number"
                  value={margemEstimada}
                  onChange={(e) => setMargemEstimada(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                />
              </div>
            </div>
          </div>

          {/* DIAGNÓSTICO DA MATRIZ */}
          <div className="bg-[#0A2540] text-white p-6 rounded-2xl shadow-xl space-y-4">
            <h4 className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">
              Diagnóstico de Risco Automático
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
              {resultadoMatriz.motivo}
            </p>

            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Atendimento de Requisitos Críticos:</span>
                <span className={`font-bold ${resultadoMatriz.percentualCritico === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {resultadoMatriz.percentualCritico.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Aderência Geral ao Edital:</span>
                <span className="font-bold text-white">
                  {resultadoMatriz.percentualGeral.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};