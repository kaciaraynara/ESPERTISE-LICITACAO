import { useState } from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  Zap,
  CheckCircle2,
  FileCheck2,
  Trophy
} from '@components/icons/phosphor-compat';
import { Link } from 'react-router-dom';

type FilaCRM = {
  id: string;
  nome: string;
  cor: string;
  icon: any;
  items: Array<any>;
}

export default function CrmKanbanPage() {
  const [filas] = useState<FilaCRM[]>([
    {
      id: 'prospectando',
      nome: 'Prospectando / Radar',
      cor: 'border-gray-100 bg-[#FFFFFF]',
      icon: MapPin,
      items: []
    },
    {
      id: 'analisando',
      nome: 'Analisando',
      cor: 'border-[#334155]/10 bg-[#F1F5F9]/20',
      icon: FileCheck2,
      items: []
    },
    {
      id: 'proposta',
      nome: 'Proposta Enviada',
      cor: 'border-[#1E40AF]/20 bg-[#F8FAFC]',
      icon: FileCheck2,
      items: []
    },
    {
      id: 'disputa',
      nome: 'Em Disputa',
      cor: 'border-brand-blue/20 bg-white',
      icon: Zap,
      items: []
    },
    {
      id: 'recursos',
      nome: 'Fase de Recursos',
      cor: 'border-brand-orange/20 bg-orange-50/20',
      icon: Zap,
      items: []
    },
    {
      id: 'contratado',
      nome: 'Contrato Assinado',
      cor: 'border-brand-blue/20 bg-[#F2FCF5]',
      icon: Trophy,
      items: []
    }
  ]);

  return (
    <div className="flex flex-col h-full min-w-0 bg-[#FFFFFF]">
      <div className="p-8 md:p-12 shrink-0 flex flex-col sm:flex-row items-start sm:items-end justify-between border-b border-gray-100 bg-white gap-6">
        <div>
          <div className="flex items-center gap-3 text-sm text-brand-orange font-black uppercase tracking-widest mb-3">
            <Trophy className="w-5 h-5" weight="bold" />
            CRM Expertise
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Pipeline Estratégico
          </h1>
          <p className="text-slate-500 mt-4 text-lg font-medium">
            Gestão operacional de editais. Da prospecção até a assinatura do contrato.
          </p>
        </div>
        <button className="px-8 py-4 bg-brand-orange hover:bg-orange-500 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-2xl hover:shadow-brand-orange/40 hover:-translate-y-1">
          + Registrar Edital Externo
        </button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 md:px-12 py-10 bg-slate-50/50">
        <div className="flex gap-6 h-full items-start">
          {filas.map(fila => {
            const Icon = fila.icon;
            return (
              <div key={fila.id} className={`shrink-0 w-96 max-h-full flex flex-col rounded-2xl border-2 ${fila.cor} bg-slate-50/30`}>

                {/* Header da Coluna */}
                <div className="p-6 flex items-center justify-between border-b border-transparent shrink-0">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-brand-blue" weight="bold" />
                    <h3 className="font-black text-brand-blue text-base uppercase tracking-widest">{fila.nome}</h3>
                    <span className="bg-white text-brand-blue text-xs font-black px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 ml-2">
                      {fila.items.length}
                    </span>
                  </div>
                  <button className="text-slate-400 hover:text-brand-blue transition-colors">
                    <MoreHorizontal className="w-6 h-6" weight="bold" />
                  </button>
                </div>

                {/* Cards */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4 shadow-inner-soft rounded-b-2xl">
                  {fila.items.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-white/50 border-2 border-dashed border-slate-200 rounded-xl h-40">
                      <p className="text-sm font-bold text-slate-400">Nenhum edital</p>
                    </div>
                  )}
                  {fila.items.map(item => (
                    <div
                      key={item.id}
                      className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 hover:shadow-xl hover:border-brand-blue/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                    >

                      <div className="flex items-start justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-50 border-2 border-slate-100 px-3 py-1.5 rounded-lg">
                          PNCP
                        </span>
                        {item.score && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue bg-blue-50/50 px-3 py-1.5 rounded-lg border-2 border-brand-blue/20">
                            {item.score}% Match
                          </span>
                        )}
                        {item.pos && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand-orange bg-orange-50/50 px-3 py-1.5 rounded-lg border-2 border-brand-orange/30">
                            {item.pos}
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-black text-slate-900 leading-snug line-clamp-3 mb-4 group-hover:text-brand-blue transition-colors duration-300">
                        {item.obj}
                      </h4>

                      <div className="space-y-3 text-sm text-slate-500 mb-5 font-semibold">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 opacity-70" weight="bold" />
                          <span className="truncate">{item.org}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="font-black text-slate-900 text-base drop-shadow-sm">{item.val}</span>
                          {item.lanceAtual && <span className="font-black text-white bg-green-600 px-3 py-1 rounded-lg shadow-sm">{item.lanceAtual}</span>}
                        </div>
                      </div>

                      {/* Footer do Card */}
                      <div className="flex items-center justify-between pt-5 border-t-2 border-slate-50 text-[11px] font-black uppercase tracking-widest">
                        {item.statusAnalise ? (
                          <span className="flex items-center gap-1.5 text-brand-blue">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {item.statusAnalise}
                          </span>
                        ) : item.prazo ? (
                          <span className="flex items-center gap-1.5 text-brand-blue">
                            <Calendar className="w-3.5 h-3.5" /> {item.prazo}
                          </span>
                        ) : item.status ? (
                          <span className="flex items-center gap-1.5 text-brand-blue">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {item.status}
                          </span>
                        ) : (
                          <span className="text-brand-blue/70">Aguardando ação</span>
                        )}

                        <div className="flex items-center gap-2">
                          {fila.id === 'disputa' && (
                            <button className="text-white bg-brand-orange hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-md shadow-brand-orange/20">
                              <Zap className="w-3.5 h-3.5" weight="fill" />
                              Robô
                            </button>
                          )}
                          <Link to={`/licitante/licitacoes/${encodeURIComponent(String(item.id))}`} className="text-brand-blue/70 group-hover:text-brand-blue bg-white group-hover:bg-slate-50 px-3 py-1.5 rounded-lg border-2 border-transparent group-hover:border-slate-100 transition-all duration-300 flex items-center gap-1">
                            Ver <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                    </div>
                  ))}

                  {fila.items.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-lg p-4 text-center">
                      <p className="text-xs font-semibold text-brand-blue/70">Nenhum edital nesta etapa</p>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
