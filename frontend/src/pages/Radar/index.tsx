import { useState } from 'react';
import { Target, Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { licitacoesApi } from '@services/api';
import { useNavigate } from 'react-router-dom';

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState<'score' | 'pncp' | 'nulidades' | 'monitorados'>('score');
  const navigate = useNavigate();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['licitacoes_radar', activeTab],
    queryFn: async () => {
      const res = await licitacoesApi.listar({ limit: 10 } as any);
      return res.data;
    }
  });

  const licitacoes = resp?.data || [];

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatarData = (data: string) => {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#0A2540] tracking-tight">Radar de Oportunidades</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Consulte oportunidades do PNCP e acompanhe os principais pontos de cada edital.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#EA580C] hover:bg-orange-600 rounded-xl transition-colors shadow-md">
            <RefreshCw className="w-4 h-4" />
            Sincronizar PNCP
          </button>
        </div>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('score')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'score'
                ? 'bg-white text-[#0A2540] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Target className={`w-4 h-4 ${activeTab === 'score' ? 'text-[#EA580C]' : ''}`} />
            Recomendados por Score
          </button>

          <button
            onClick={() => setActiveTab('pncp')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'pncp'
                ? 'bg-white text-[#0A2540] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Search className={`w-4 h-4 ${activeTab === 'pncp' ? 'text-[#EA580C]' : ''}`} />
            Busca Geral PNCP
          </button>
        </div>

        {/* Conteúdo Dinâmico da Aba Selecionada */}
        <div className="p-6">
          <div className="space-y-4 min-h-[300px]">
            {activeTab === 'score' && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-900 text-sm font-medium mb-4">
                 Exibindo licitações ordenadas pelo <strong>Score de Aderência</strong> ao perfil cadastrado da sua empresa.
              </div>
            )}
            {activeTab === 'pncp' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm font-medium mb-4">
                 Pesquisa direta na base bruta do Portal Nacional de Contratações Públicas (PNCP).
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="animate-spin text-[#EA580C] w-8 h-8" />
              </div>
            ) : licitacoes.length === 0 ? (
              <div className="text-center p-8 text-slate-500">
                Nenhuma licitação encontrada no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {licitacoes.map((licitacao: any) => (
                  <div key={licitacao.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase bg-blue-100 text-blue-800">
                          {licitacao.modalidade || 'Licitação'}
                        </span>
                        {activeTab === 'score' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800">
                            SCORE: {licitacao.score || 85}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1 line-clamp-2" title={licitacao.orgao}>
                        {licitacao.orgao}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-3 mb-4" title={licitacao.objeto}>
                        {licitacao.objeto}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Abertura:</span>
                        <span className="font-bold text-slate-900">{formatarData(licitacao.dataAbertura)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Valor:</span>
                        <span className="font-black text-[#0A2540]">{formatarMoeda(licitacao.valorEstimado || 0)}</span>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => navigate(`/fornecedor/licitacao/${encodeURIComponent(licitacao.id)}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          <Search size={14} /> Analisar
                        </button>
                        {(() => {
                          const numPncp = licitacao.numeroControlePNCP || licitacao.numero_controle_pncp;
                          const portalUrl = licitacao.linkSistemaOrigem || licitacao.documento_url || licitacao.link || (numPncp ? `https://pncp.gov.br/app/editais/${encodeURIComponent(numPncp)}` : null);
                          if (!portalUrl) return null;
                          return (
                            <a
                              href={portalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                              title="Ver edital no portal oficial (PNCP / Compras.gov)"
                            >
                              Portal
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}