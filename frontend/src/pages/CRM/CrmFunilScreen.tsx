import React from 'react';
import { 
  Search, Sparkles, ShieldCheck, BarChart3, 
  Plus, Calendar, DollarSign, ChevronRight, User, Loader2
} from 'lucide-react';
import { useOportunidadesCRM, useMetricasCRM, useMoverEtapaOportunidade } from '../../hooks/useCrmQuery';

type EtapaFunil = 'MAPPING' | 'ANALISE_LEX' | 'PROPOSTA' | 'DISPUTA' | 'HOMOLOGADO';

export const CrmFunilScreen: React.FC = () => {
  const { data: oportunidades = [], isLoading, isError } = useOportunidadesCRM();
  const { data: metricas } = useMetricasCRM();
  const moverEtapaMutation = useMoverEtapaOportunidade();

  const colunas: { id: EtapaFunil; titulo: string; corBarra: string }[] = [
    { id: 'MAPPING', titulo: '1. Mapeadas / Triagem', corBarra: 'bg-slate-400' },
    { id: 'ANALISE_LEX', titulo: '2. Análise Jurídica / LEX', corBarra: 'bg-blue-500' },
    { id: 'PROPOSTA', titulo: '3. Proposta Elaborada', corBarra: 'bg-amber-500' },
    { id: 'DISPUTA', titulo: '4. Em Pregão / Disputa', corBarra: 'bg-orange-500' },
    { id: 'HOMOLOGADO', titulo: '5. Homologado / Vencido', corBarra: 'bg-emerald-500' }
  ];

  const formatarMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const handleAvançar = (id: string, etapaAtual: EtapaFunil) => {
    const indexAtual = colunas.findIndex(c => c.id === etapaAtual);
    if (indexAtual < colunas.length - 1) {
      const proximaEtapa = colunas[indexAtual + 1].id;
      moverEtapaMutation.mutate({ id, novaEtapa: proximaEtapa });
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR NAVEGAÇÃO */}
      <aside className="w-60 bg-[#0B1736] text-white flex flex-col justify-between p-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-orange-500 flex items-center justify-center font-bold text-xs">
              EL
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">EXPERTISE</h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-wider">LICITATÓRIA</p>
            </div>
          </div>

          <nav className="space-y-1 text-xs">
            <a href="/radar" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Search size={16} /> <span>Radar de Editais</span>
            </a>
            <a href="/crm" className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-orange-500 text-white font-semibold shadow">
              <BarChart3 size={16} /> <span>CRM & Funil</span>
            </a>
            <a href="/lex" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Sparkles size={16} /> <span>Leitor LEX AI</span>
            </a>
            <a href="/cofre" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <ShieldCheck size={16} /> <span>Cofre de Documentos</span>
            </a>
          </nav>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Pipeline Comercial de Licitações
              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                Sincronizado via API
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Gerenciamento em tempo real do ciclo de vida das disputas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold text-slate-700">
              <DollarSign size={14} className="text-emerald-600" />
              Valor Total: <span className="font-extrabold text-slate-900">
                {metricas ? formatarMoeda(metricas.valorTotalEmDisputa) : '...'}
              </span>
            </div>
            <button className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition flex items-center gap-2">
              <Plus size={16} /> Nova Oportunidade
            </button>
          </div>
        </header>

        {/* ESTADO DE CARREGAMENTO */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center bg-slate-100">
            <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
              <Loader2 className="animate-spin text-orange-500" size={24} />
              Carregando dados do servidor...
            </div>
          </div>
        ) : isError ? (
          <div className="flex-1 flex items-center justify-center bg-slate-100 text-rose-600 font-bold text-sm">
            Erro ao conectar com a API de CRM.
          </div>
        ) : (
          /* CORPO DO KANBAN */
          <div className="p-6 flex-1 overflow-x-auto bg-slate-100">
            <div className="flex gap-4 h-full min-w-[1200px]">
              {colunas.map((coluna) => {
                const itensColuna = oportunidades.filter(o => o.etapa === coluna.id);
                const valorColuna = itensColuna.reduce((acc, curr) => acc + (curr.valorPropostaEmpresa || curr.valorEstimado), 0);

                return (
                  <div key={coluna.id} className="w-72 bg-slate-200/60 rounded-xl flex flex-col max-h-full border border-slate-300/60">
                    
                    <div className="p-3 bg-white rounded-t-xl border-b border-slate-200 shadow-sm flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${coluna.corBarra}`}></span>
                          {coluna.titulo}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {itensColuna.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-600">
                        {formatarMoeda(valorColuna)}
                      </span>
                    </div>

                    <div className="p-3 space-y-3 overflow-y-auto flex-1">
                      {itensColuna.map((opp) => (
                        <div 
                          key={opp.id} 
                          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded uppercase">
                              {opp.portal}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                              opp.prioridade === 'CRITICA' ? 'bg-rose-100 text-rose-700' :
                              opp.prioridade === 'ALTA' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {opp.prioridade}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{opp.numeroProcesso}</h4>
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">{opp.orgaoComprador}</p>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                            <div>
                              <span className="text-[9px] text-slate-400 font-bold block uppercase">Proposta</span>
                              <span className="font-extrabold text-slate-900">
                                {formatarMoeda(opp.valorPropostaEmpresa || opp.valorEstimado)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 font-bold block uppercase">Margem Est.</span>
                              <span className="font-extrabold text-emerald-600">
                                {opp.margemEstimadaPercentual}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Calendar size={12} className="text-blue-600" />
                              {new Date(opp.dataSessao).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={10} /> {opp.responsavel.split(' ')[0]}
                            </span>
                          </div>

                          {coluna.id !== 'HOMOLOGADO' && (
                            <div className="pt-1 flex justify-end">
                              <button 
                                onClick={() => handleAvançar(opp.id, opp.etapa as EtapaFunil)}
                                disabled={moverEtapaMutation.isPending}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 hover:underline disabled:opacity-50"
                              >
                                Avançar Etapa <ChevronRight size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};