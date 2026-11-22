import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Plus, Video, LogOut, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';

const TOKEN_KEY = 'expertise_partner_token';
const PARTNER_KEY = 'expertise_partner_info';

export const ParceiroAcademiaPage: React.FC = () => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [partner, setPartner] = useState<any>(() => {
    try { return JSON.parse(sessionStorage.getItem(PARTNER_KEY) || 'null'); } catch { return null; }
  });
  const [modoCadastro, setModoCadastro] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [erro, setErro] = useState('');

  const [cursos, setCursos] = useState<any[]>([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCategory, setCourseCategory] = useState('Cursos Online');
  const [courseDesc, setCourseDesc] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState('VIDEO');
  const [videoUrl, setVideoUrl] = useState('');
  const [activityPrompt, setActivityPrompt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [msg, setMsg] = useState('');

  const carregarCursos = async (tk = token) => {
    if (!tk) return;
    try {
      const resp = await api.get('/academia/parceiro/meus-cursos', {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const list = resp.data?.data || [];
      setCursos(list);
      if (list.length > 0 && !selectedCourseId) setSelectedCourseId(list[0].id);
    } catch {
      // Token expirado
    }
  };

  useEffect(() => {
    if (token) void carregarCursos(token);
  }, [token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      const endpoint = modoCadastro ? '/academia/parceiro/cadastro' : '/academia/parceiro/login';
      const payload = modoCadastro ? { name, email, password, specialty } : { email, password };
      const resp = await api.post(endpoint, payload);
      const tk = resp.data?.token;
      const p = resp.data?.partner;
      if (tk) {
        sessionStorage.setItem(TOKEN_KEY, tk);
        sessionStorage.setItem(PARTNER_KEY, JSON.stringify(p));
        setToken(tk);
        setPartner(p);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao autenticar parceiro.');
    }
  };

  const criarCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const resp = await api.post(
      '/academia/parceiro/cursos',
      { title: courseTitle, category: courseCategory, description: courseDesc },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setCourseTitle('');
    setCourseDesc('');
    setSelectedCourseId(resp.data?.data?.id || '');
    setMsg('Curso publicado com sucesso na Academia!');
    await carregarCursos();
  };

  const adicionarAula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setMsg('');
    await api.post(
      `/academia/parceiro/cursos/${selectedCourseId}/aulas`,
      { title: lessonTitle, lessonType, videoUrl, activityPrompt, durationMinutes },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setLessonTitle('');
    setVideoUrl('');
    setActivityPrompt('');
    setMsg('Aula e atividade publicadas com sucesso!');
    await carregarCursos();
  };

  const sair = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PARTNER_KEY);
    setToken('');
    setPartner(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#081C3A] p-5 text-white">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-[#FF6600]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Portal de Professores & Palestrantes Parceiros</h1>
              <p className="text-xs text-slate-300">Publique cursos, videoaulas, lives e atividades práticas na Academia Expertise</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/fornecedor/academia" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20">
              <ArrowLeft className="h-3.5 w-3.5" /> Ver Academia
            </Link>
            {token && (
              <button type="button" onClick={sair} className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3.5 py-1.5 text-xs font-bold text-red-200 cursor-pointer">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            )}
          </div>
        </div>

        {!token ? (
          <form onSubmit={handleAuth} className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-[#081C3A]">
              {modoCadastro ? 'Cadastro de Professor / Palestrante' : 'Acesso do Professor / Parceiro'}
            </h2>
            {erro && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{erro}</p>}
            {modoCadastro && (
              <>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
                <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Especialidade (ex: Pregão Eletrônico / Obras)" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
              </>
            )}
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail profissional" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
            <button type="submit" className="w-full rounded-full bg-[#FF6600] py-2.5 text-sm font-bold text-white cursor-pointer">
              {modoCadastro ? 'Criar Conta de Parceiro' : 'Entrar no Portal'}
            </button>
            <button type="button" onClick={() => setModoCadastro(!modoCadastro)} className="w-full text-xs font-semibold text-[#0070C0] cursor-pointer">
              {modoCadastro ? 'Já tenho cadastro — Fazer login' : 'Quero ser Professor Parceiro — Cadastrar'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {msg && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> {msg}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form onSubmit={criarCurso} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                <h2 className="text-base font-bold text-[#081C3A] flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[#FF6600]" /> Novo Curso / Trilha ({partner?.name})
                </h2>
                <input required value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="Título do curso" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <select value={courseCategory} onChange={(e) => setCourseCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="Cursos Online">Cursos Online</option>
                  <option value="Cursos de Extensão">Cursos de Extensão</option>
                  <option value="Aulas ao Vivo">Aulas ao Vivo</option>
                  <option value="Biblioteca Digital">Biblioteca Digital</option>
                </select>
                <textarea required value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} placeholder="Descrição do curso e objetivos" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button type="submit" className="rounded-full bg-[#081C3A] px-5 py-2 text-xs font-bold text-white cursor-pointer">
                  Publicar Curso
                </button>
              </form>

              <form onSubmit={adicionarAula} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                <h2 className="text-base font-bold text-[#081C3A] flex items-center gap-2">
                  <Video className="h-4 w-4 text-[#0070C0]" /> Publicar Aula ou Atividade
                </h2>
                <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Selecione um curso seu...</option>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <input required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Título da aula" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={lessonType} onChange={(e) => setLessonType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="VIDEO">Videoaula</option>
                    <option value="LIVE">Aula ao Vivo</option>
                    <option value="PDF">Material PDF</option>
                    <option value="QUIZ">Atividade Prática</option>
                  </select>
                  <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} placeholder="Minutos" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Link do vídeo (YouTube, Vimeo ou MP4)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <textarea value={activityPrompt} onChange={(e) => setActivityPrompt(e.target.value)} placeholder="Atividade prática para o licitante (opcional)" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button type="submit" disabled={!selectedCourseId} className="rounded-full bg-[#FF6600] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
                  Publicar Aula
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#081C3A]">Meus Cursos Publicados ({cursos.length})</h3>
              {cursos.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-[#081C3A]">{c.title} <span className="text-xs font-normal text-slate-500">({c.lessons?.length || 0} aulas)</span></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParceiroAcademiaPage;