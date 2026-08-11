import React, { useState } from 'react';
import { GraduationCap, Search, PlayCircle, ArrowRight } from 'lucide-react';

interface MóduloEstudo {
  id: string;
  titulo: string;
  categoria: 'LEGISLAÇÃO' | 'TCU_JURISPRUDÊNCIA' | 'TÁTICAS_DE_DISPUTA' | 'ESTRATÉGIA';
  duracao: string;
  aulasCount: number;
  nivel: 'INICIANTE' | 'INTERMEDIÁRIO' | 'AVANÇADO';
  progresso: number;
}

export const AcademiaPage: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('TODAS');

  const [modulos] = useState<MóduloEstudo[]>([
    {
      id: '1',
      titulo: 'Lei 14.133/21: Domínio Prático da Nova Lei de Licitações',
      categoria: 'LEGISLAÇÃO',
      duracao: '4h 30m',
      aulasCount: 12,
      nivel: 'INTERMEDIÁRIO',
      progresso: 85
    },
    {
      id: '2',
      titulo: 'Jurisprudência Frequente do TCU em Pregões Eletrônicos',
      categoria: 'TCU_JURISPRUDÊNCIA',
      duracao: '3h 15m',
      aulasCount: 8,
      nivel: 'AVANÇADO',
      progresso: 40
    },
    {
      id: '3',
      titulo: 'Algoritmos e Estratégia Prática para Disputa de Lances',
      categoria: 'TÁTICAS_DE_DISPUTA',
      duracao: '2h 00m',
      aulasCount: 6,
      nivel: 'AVANÇADO',
      progresso: 100
    },
    {
      id: '4',
      titulo: 'Como Elaborar Impugnações Vencedoras de Forma Eficiente',
      categoria: 'ESTRATÉGIA',
      duracao: '1h 45m',
      aulasCount: 5,
      nivel: 'INICIANTE',
      progresso: 0
    }
  ]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-lg shadow-md">
              <GraduationCap size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Academia Licitatória & Base de Conhecimento
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Treinamentos práticos, guias jurisprudenciais do TCU e teses jurídicas para capacitação contínua da equipe.
          </p>
        </div>
      </header>

      {/* BUSCA E FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Pesquisar por tema, súmula do TCU, artigo da lei ou tática..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>

        <select 
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none w-full md:w-auto"
        >
          <option value="TODAS">Todas as Categorias</option>
          <option value="LEGISLAÇÃO">Legislação</option>
          <option value="TCU_JURISPRUDÊNCIA">Jurisprudência TCU</option>
          <option value="TÁTICAS_DE_DISPUTA">Táticas de Disputa</option>
          <option value="ESTRATÉGIA">Estratégia Jurídica</option>
        </select>
      </div>

      {/* CARDS DE MÓDULOS DE CURSO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modulos.map((mod) => (
          <div key={mod.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                  {mod.categoria.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Nível: {mod.nivel}
                </span>
              </div>

              <h3 className="text-sm font-black text-slate-900 leading-snug">
                {mod.titulo}
              </h3>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1">
                  <PlayCircle size={14} className="text-[#EA580C]" /> {mod.aulasCount} Aulas
                </span>
                <span>•</span>
                <span>{mod.duracao} de conteúdo</span>
              </div>
            </div>

            {/* PROGRESSO */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">Progresso</span>
                <span className="text-slate-900">{mod.progresso}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-[#0A2540] h-full transition-all" style={{ width: `${mod.progresso}%` }}></div>
              </div>

              <button className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all">
                {mod.progresso === 100 ? 'REVISAR MÓDULO' : mod.progresso > 0 ? 'CONTINUAR CURSO' : 'INICIAR MÓDULO'}
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};