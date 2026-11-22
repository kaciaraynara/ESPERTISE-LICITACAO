import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  PlayCircle,
  BookOpen,
  Award,
  Users,
  Video,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface CursoItem {
  id: string;
  titulo: string;
  subtitulo: string;
  aulas: string[];
}

const CURSOS: CursoItem[] = [
  {
    id: 'lei-14133',
    titulo: 'Lei 14.133/21 — Aplicação Prática',
    subtitulo: 'Fases do pregão eletronico, habilitação, lances e julgamento.',
    aulas: [
      'Visao geral da Nova Lei de Licitações e modalidades',
      'Leitura estrategica do Edital e Termo de Referencia',
      'Habilitacao juridica, fiscal e qualificacao tecnica',
    ],
  },
  {
    id: 'gestao-contratos',
    titulo: 'Gestão e Fiscalizacao de Contratos',
    subtitulo: 'Execucao contratual, aditivos, medicoes e prevencao de glosas.',
    aulas: [
      'Obrigacoes da contratada e recebimento provisorio/definitivo',
      'Alteracoes contratuais e limites legais de acrescimo',
      'Gestão de garantias e notificacoes administrativas',
    ],
  },
  {
    id: 'reequilibrio',
    titulo: 'Reequilibrio, Reajuste e Repactuacao',
    subtitulo: 'Como preservar sua margem de lucro em contratos de longo prazo.',
    aulas: [
      'Diferenca entre reajuste por indice, repactuacao e reequilibrio',
      'Comprovacao documental de variacao extraordinaria de custos',
      'Modelo pratico de requerimento administrativo',
    ],
  },
  {
    id: 'auditoria',
    titulo: 'Auditoria e Controle em Licitações',
    subtitulo: 'Impugnacoes, recursos, jurisprudencia do TCU e integridade.',
    aulas: [
      'Identificando clausulas restritivas e direcionamento',
      'Prazos decadenciais de impugnacao e recurso administrativo',
      'Boas praticas de compliance e defesa perante órgãos de controle',
    ],
  },
];

export const AcademiaPage: React.FC = () => {
  const [progresso, setProgresso] = useState<Record<string, string[]>>({});
  const [cursoAtivo, setCursoAtivo] = useState<CursoItem>(CURSOS[0]);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('expertise_academia_progresso');
      if (salvo) setProgresso(JSON.parse(salvo));
    } catch {
      // ignora
    }
  }, []);

  const alternarAula = (cursoId: string, aula: string) => {
    const atuais = progresso[cursoId] || [];
    const novos = atuais.includes(aula)
      ? atuais.filter((a) => a !== aula)
      : [...atuais, aula];
    const atualizado = { ...progresso, [cursoId]: novos };
    setProgresso(atualizado);
    localStorage.setItem('expertise_academia_progresso', JSON.stringify(atualizado));
  };

  const atalhos = [
    { nome: 'Cursos Online', icon: PlayCircle },
    { nome: 'Cursos de Extensao', icon: GraduationCap },
    { nome: 'Aulas ao Vivo', icon: Video },
    { nome: 'Biblioteca Digital', icon: BookOpen },
    { nome: 'Certificados', icon: Award },
    { nome: 'Professores', icon: Users },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Banner Principal */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-r from-[#081C3A] to-[#0f3460] p-6 text-white shadow-md md:flex-row md:items-center md:p-8">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#F97316]">
            <GraduationCap className="h-4 w-4" /> Academia do Licitante
          </div>
          <h1 className="text-2xl font-extrabold md:text-3xl">
            Cursos, aulas e capacitação pratica em licitações e contratos
          </h1>
          <p className="text-sm text-slate-200">
            Treinamento direto ao ponto para vencer pregões, evitar inabilitações e proteger a margem da sua empresa.
          </p>
          <button
            type="button"
            onClick={() => setCursoAtivo(CURSOS[0])}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
          >
            Acessar cursos <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 6 Atalhos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {atalhos.map((a) => {
          const Icon = a.icon;
          return (
            <div
              key={a.nome}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
            >
              <div className="rounded-xl bg-orange-50 p-2.5 text-[#F97316]">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-[#081C3A]">{a.nome}</span>
            </div>
          );
        })}
      </div>

      {/* Cursos em Destaque */}
      <div>
        <h2 className="mb-3 text-base font-extrabold text-[#081C3A]">Cursos em Destaque</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CURSOS.map((curso) => {
            const concluidas = (progresso[curso.id] || []).length;
            const pct = Math.round((concluidas / curso.aulas.length) * 100);
            const selecionado = cursoAtivo.id === curso.id;
            return (
              <button
                key={curso.id}
                type="button"
                onClick={() => setCursoAtivo(curso)}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition ${
                  selecionado
                    ? 'border-[#F97316] bg-orange-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="text-sm font-extrabold text-[#081C3A]">{curso.titulo}</div>
                  <p className="mt-1 text-xs text-slate-500">{curso.subtitulo}</p>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-600">
                    <span>Progresso</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modulo de Aulas do Curso Selecionado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-extrabold text-[#081C3A]">{cursoAtivo.titulo}</h3>
        <p className="mt-1 text-xs text-slate-500">{cursoAtivo.subtitulo}</p>
        <div className="mt-4 space-y-2.5">
          {cursoAtivo.aulas.map((aula, i) => {
            const feita = (progresso[cursoAtivo.id] || []).includes(aula);
            return (
              <button
                key={aula}
                type="button"
                onClick={() => alternarAula(cursoAtivo.id, aula)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-semibold transition ${
                  feita
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span>
                  Aula {i + 1}: {aula}
                </span>
                <span className="inline-flex items-center gap-1 font-bold">
                  <CheckCircle2 className={`h-4 w-4 ${feita ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {feita ? 'Concluída' : 'Marcar concluida'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AcademiaPage;
