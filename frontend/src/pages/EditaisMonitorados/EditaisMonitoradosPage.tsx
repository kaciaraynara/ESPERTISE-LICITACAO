import React, { useState } from 'react';
import { 
  Bookmark, Eye, Building2, Clock, Search
} from 'lucide-react';

interface EditalMonitorado {
  id: string;
  numeroProcesso: string;
  orgao: string;
  portal: string;
  objeto: string;
  dataAbertura: string;
  valorEstimado: number;
  status: 'PUBLICADO' | 'EM_DISPUTA' | 'SUSPENSO' | 'HOMOLOGADO';
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export const EditaisMonitoradosPage: React.FC = () => {
  const [busca, setBusca] = useState('');

  const [editais] = useState<EditalMonitorado[]>([
    {
      id: '1',
      numeroProcesso: 'PE 102/2026',
      orgao: 'Prefeitura Municipal de São Paulo',
      portal: 'Compras.gov.br',
      objeto: 'Contratação de empresa para fornecimento de licenças de software ERP e suporte técnico continuado.',
      dataAbertura: '14/08/2026 09:00',
      valorEstimado: 450000,
      status: 'PUBLICADO',
      prioridade: 'ALTA'
    },
    {
      id: '2',
      numeroProcesso: 'PE 044/2026',
      orgao: 'Governo do Estado do Rio de Janeiro - SEFAZ',
      portal: 'LicitaNet',
      objeto: 'Prestação de serviços de consultoria especializada em Governança Pública e TI.',
      dataAbertura: '18/08/2026 14:00',
      valorEstimado: 1200000,
      status: 'PUBLICADO',
      prioridade: 'ALTA'
    },
    {
      id: '3',
      numeroProcesso: 'PE 012/2026',
      orgao: 'Tribunal de Justiça do Estado de Minas Gerais',
      portal: 'Portal de Compras Públicas',
      objeto: 'Aquisição de infraestrutura de servidores e equipamentos de redes.',
      dataAbertura: '05/08/2026 10:00',
      valorEstimado: 890000,
      status: 'SUSPENSO',
      prioridade: 'MEDIA'
    }
  ]);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <Bookmark size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Editais Monitorados & Watchlist
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhamento em tempo real das licitações favoritadas e monitoramento de retificações.
          </p>
        </div>
      </header>

      {/* BUSCA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Filtrar por órgão, processo ou palavra-chave do objeto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>
      </div>

      {/* CARDS DE EDITAIS MONITORADOS */}
      <div className="space-y-4">
        {editais.map((edital) => (
          <div key={edital.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-[#0A2540] text-white font-black text-xs px-2.5 py-1 rounded-lg">
                  {edital.numeroProcesso}
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                  <Building2 size={14} className="text-slate-400" /> {edital.orgao}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                  edital.status === 'PUBLICADO'
                    ? 'bg-blue-100 text-blue-800'
                    : edital.status === 'SUSPENSO'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {edital.status}
                </span>

                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                  edital.prioridade === 'ALTA' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  Prioridade {edital.prioridade}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              {edital.objeto}
            </p>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock size={14} /> Abertura: <strong className="text-slate-900">{edital.dataAbertura}</strong>
                </span>
                <span className="text-slate-500">
                  Portal: <strong className="text-slate-900">{edital.portal}</strong>
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-slate-500">
                  Valor Estimado: <strong className="text-slate-900 font-black">{formatarMoeda(edital.valorEstimado)}</strong>
                </span>
                <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all">
                  <Eye size={14} /> Abrir Detalhes
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};