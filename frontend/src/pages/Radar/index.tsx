import { useState } from 'react';
import { Target, Search, AlertTriangle, Bookmark, Filter, RefreshCw } from 'lucide-react';

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState<'score' | 'pncp' | 'nulidades' | 'monitorados'>('score');

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#0A2540] tracking-tight">Radar de Oportunidades</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Monitoramento em tempo real do PNCP, inteligência de score e gestão jurídica.
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

          <button
            onClick={() => setActiveTab('nulidades')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'nulidades'
                ? 'bg-white text-[#0A2540] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'nulidades' ? 'text-[#EA580C]' : ''}`} />
            Nulidades & SRP / Carona
          </button>

          <button
            onClick={() => setActiveTab('monitorados')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'monitorados'
                ? 'bg-white text-[#0A2540] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${activeTab === 'monitorados' ? 'text-[#EA580C]' : ''}`} />
            Editais Monitorados
          </button>
        </div>

        {/* Conteúdo Dinâmico da Aba Selecionada */}
        <div className="p-6">
          {activeTab === 'score' && (
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-900 text-sm font-medium">
                 Exibindo licitações ordenadas pelo <strong>Score de Aderência</strong> ao perfil cadastrado da sua empresa.
              </div>
              {/* Renderize aqui a lista de cards com o ScoreBadge */}
            </div>
          )}

          {activeTab === 'pncp' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm font-medium">
                 Pesquisa direta na base bruta do Portal Nacional de Contratações Públicas (PNCP).
              </div>
              {/* Componente / Tabela de busca PNCP */}
            </div>
          )}

          {activeTab === 'nulidades' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm font-medium">
                 Alertas automáticos de divergências legais, cláusulas restritivas e oportunidades de Ata de Registro de Preços (SRP).
              </div>
              {/* Componente de análise de nulidades */}
            </div>
          )}

          {activeTab === 'monitorados' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium">
                 Sua lista de acompanhamento prioritário e alteração de fases de disputa.
              </div>
              {/* Lista de favoritos/monitorados */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}