import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlayCircle,
  BookOpen,
  Award,
  Video,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  GraduationCap,
} from 'lucide-react';
import api from '@/services/api';

interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  lessonType: 'VIDEO' | 'LIVE' | 'PDF' | 'QUIZ' | string;
  videoUrl?: string | null;
  materialUrl?: string | null;
  activityPrompt?: string | null;
  durationMinutes: number;
  completed: boolean;
}

interface Course {
  id: string;
  partnerName: string;
  title: string;
  category: string;
  level: string;
  description: string;
  thumbnailUrl?: string | null;
  featured: boolean;
  progresso: number;
  totalAulas: number;
  aulasConcluidas: number;
  lessons: Lesson[];
}

function getEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return null;
}

const CATEGORIAS = [
  { id: 'Todos', label: 'Todos os Cursos', icon: BookOpen },
  { id: 'Cursos Online', label: 'Cursos Online', icon: PlayCircle },
  { id: 'Cursos de Extensão', label: 'Cursos de Extensão', icon: GraduationCap },
  { id: 'Aulas ao Vivo', label: 'Aulas ao Vivo', icon: Video },
  { id: 'Biblioteca Digital', label: 'Biblioteca Digital', icon: BookOpen },
  { id: 'Certificados', label: 'Meus Certificados', icon: Award },
];

export const AcademiaPage: React.FC = () => {
  const [cursos, setCursos] = useState<Course[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
  const [cursoSelecionado, setCursoSelecionado] = useState<Course | null>(null);
  const [aulaAtiva, setAulaAtiva] = useState<Lesson | null>(null);
  const [salvandoAula, setSalvandoAula] = useState(false);

  const carregarCatalogo = async () => {
    setCarregando(true);
    try {
      const resp = await api.get('/academia/catalogo');
      const lista: Course[] = resp.data?.data || [];
      setCursos(lista);
      if (cursoSelecionado) {
        const atualizado = lista.find((c) => c.id === cursoSelecionado.id);
        if (atualizado) {
          setCursoSelecionado(atualizado);
          if (aulaAtiva) {
            const aulaAtual = atualizado.lessons.find((l) => l.id === aulaAtiva.id);
            if (aulaAtual) setAulaAtiva(aulaAtual);
          }
        }
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarCatalogo();
  }, []);

  const abrirCurso = (curso: Course, aulaInicial?: Lesson) => {
    setCursoSelecionado(curso);
    setAulaAtiva(aulaInicial || curso.lessons[0] || null);
  };

  const toggleConcluirAula = async (lesson: Lesson) => {
    setSalvandoAula(true);
    try {
      await api.post(`/academia/aulas/${lesson.id}/concluir`);
      await carregarCatalogo();
    } finally {
      setSalvandoAula(false);
    }
  };

  const cursoDestaque = cursos.find((c) => c.featured) || cursos[0] || null;

  const cursosFiltrados = cursos.filter((c) => {
    if (categoriaAtiva === 'Todos') return true;
    if (categoriaAtiva === 'Certificados') return c.progresso === 100;
    return c.category.toLowerCase() === categoriaAtiva.toLowerCase();
  });

  const embedUrl = getEmbedUrl(aulaAtiva?.videoUrl);

  return (
    <div className="space-y-6 pb-24">
      {/* HERO ESTILO STREAMING COM CONTRASTE BRANCO LEGÍVEL */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#081C3A] via-[#0F2D5C] to-[#005596] p-6 sm:p-10 text-white shadow-lg">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-amber-300">
              <GraduationCap className="h-3.5 w-3.5" />
              Academia do Licitante • Lei 14.133/2021
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              {cursoDestaque ? cursoDestaque.title : 'Cursos, aulas e capacitação prática em licitações'}
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              {cursoDestaque
                ? cursoDestaque.description
                : 'Treinamento direto ao ponto para vencer pregões, evitar inabilitações e dominar estratégias de Proteção de Margem da sua empresa.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {cursoDestaque && (
                <button
                  type="button"
                  onClick={() => abrirCurso(cursoDestaque)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FF6600] hover:bg-[#e55b00] px-5 py-2.5 text-sm font-bold text-white shadow transition cursor-pointer"
                >
                  <PlayCircle className="h-4 w-4" />
                  Assistir Agora
                </button>
              )}
              <Link
                to="/parceiro/academia"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-bold text-white transition"
              >
                <Users className="h-4 w-4" />
                Portal de Professores & Parceiros
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <p className="text-xs text-slate-300">Trilhas Disponíveis</p>
              <p className="text-2xl font-black text-white mt-1">{cursos.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <p className="text-xs text-slate-300">Certificados Obtidos</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">
                {cursos.filter((c) => c.progresso === 100).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE CATEGORIAS RESPONSIVA */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIAS.map((cat) => {
          const Icon = cat.icon;
          const ativo = categoriaAtiva === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoriaAtiva(cat.id)}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition cursor-pointer ${
                ativo
                  ? 'border-[#0070C0] bg-[#081C3A] text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#0070C0]'
              }`}
            >
              <Icon className={`h-5 w-5 ${ativo ? 'text-[#FF6600]' : 'text-[#FF6600]'}`} />
              <span className="text-xs font-bold">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* GRADE ESTILO NETFLIX */}
      {carregando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando trilhas e aulas da Academia...
        </div>
      ) : cursosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Nenhum curso encontrado nesta categoria ainda.
          </p>
          <button
            type="button"
            onClick={() => setCategoriaAtiva('Todos')}
            className="rounded-full bg-[#081C3A] px-4 py-2 text-xs font-bold text-white cursor-pointer"
          >
            Ver Todos os Cursos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {cursosFiltrados.map((curso) => (
            <div
              key={curso.id}
              onClick={() => abrirCurso(curso)}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-[#0070C0] transition cursor-pointer"
            >
              <div>
                <div className="relative h-36 bg-gradient-to-br from-[#081C3A] to-[#0070C0] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {curso.category}
                    </span>
                    <span className="rounded-full bg-[#FF6600] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {curso.level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span className="text-xs font-medium text-slate-200 truncate">{curso.partnerName}</span>
                    <PlayCircle className="h-8 w-8 text-white/90 group-hover:scale-110 transition shrink-0" />
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-bold text-[#081C3A] line-clamp-2">{curso.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{curso.description}</p>
                </div>
              </div>
              <div className="px-4 pb-4 pt-2 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>{curso.aulasConcluidas}/{curso.totalAulas} aulas</span>
                  <span className={curso.progresso === 100 ? 'text-emerald-600 font-bold' : 'text-[#0070C0]'}>
                    {curso.progresso}% concluído
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all ${curso.progresso === 100 ? 'bg-emerald-500' : 'bg-[#FF6600]'}`}
                    style={{ width: `${curso.progresso}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PLAYER DE AULAS E ATIVIDADES */}
      {cursoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#081C3A] px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-300">{cursoSelecionado.category} • {cursoSelecionado.partnerName}</p>
                <h2 className="text-base sm:text-lg font-bold truncate">{cursoSelecionado.title}</h2>
              </div>
              <button
                type="button"
                aria-label="Fechar player"
                onClick={() => { setCursoSelecionado(null); setAulaAtiva(null); }}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 overflow-y-auto">
              {/* Player & Atividade */}
              <div className="lg:col-span-2 p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200">
                {aulaAtiva ? (
                  <>
                    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center">
                      {embedUrl ? (
                        <iframe
                          src={embedUrl}
                          title={aulaAtiva.title}
                          className="h-full w-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      ) : aulaAtiva.videoUrl ? (
                        <video src={aulaAtiva.videoUrl} controls className="h-full w-full" />
                      ) : (
                        <div className="p-6 text-center text-white space-y-2">
                          <PlayCircle className="h-12 w-12 mx-auto text-[#FF6600]" />
                          <p className="text-sm font-bold">{aulaAtiva.title}</p>
                          <p className="text-xs text-slate-300">
                            Conteúdo prático e roteiro de aplicação imediata na plataforma.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#081C3A]">{aulaAtiva.title}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <Clock className="h-3.5 w-3.5" /> {aulaAtiva.durationMinutes} min • {aulaAtiva.lessonType}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={salvandoAula}
                        onClick={() => void toggleConcluirAula(aulaAtiva)}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
                          aulaAtiva.completed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#FF6600] text-white hover:bg-[#e55b00]'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {aulaAtiva.completed ? 'Aula Concluída' : 'Marcar como Concluída'}
                      </button>
                    </div>

                    {aulaAtiva.activityPrompt && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold text-amber-900 uppercase">Atividade Prática da Aula</p>
                        <p className="text-sm text-amber-950 mt-1">{aulaAtiva.activityPrompt}</p>
                      </div>
                    )}

                    {aulaAtiva.materialUrl && (
                      <a
                        href={aulaAtiva.materialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-[#0070C0] hover:bg-slate-50"
                      >
                        Abrir Material Complementar <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Nenhuma aula cadastrada neste curso ainda.</p>
                )}
              </div>

              {/* Lista de Aulas do Curso */}
              <div className="p-4 space-y-2 bg-slate-50">
                <p className="text-xs font-bold uppercase text-slate-500 px-1">Aulas do Curso</p>
                {cursoSelecionado.lessons.map((l, idx) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setAulaAtiva(l)}
                    className={`w-full text-left rounded-xl border p-3 transition cursor-pointer ${
                      aulaAtiva?.id === l.id
                        ? 'border-[#0070C0] bg-white shadow-sm'
                        : 'border-slate-200 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#081C3A]">
                        {idx + 1}. {l.title}
                      </span>
                      {l.completed && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{l.lessonType} • {l.durationMinutes} min</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademiaPage;