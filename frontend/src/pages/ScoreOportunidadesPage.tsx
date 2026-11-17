import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ExternalLink,
  RefreshCw,
  DollarSign,
  MapPin,
  Clock,
} from 'lucide-react';
import { licitacoesApi } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';
import DossieEditalModal, { DossieEditalData } from '../components/DossieEditalModal';
import { buildOfficialPncpPortalUrl } from '../utils/pncp';

function normalizar(txt: string): string {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extrairTermosEmpresa(empresa: any): string[] {
  const cnpjLimpo = String(empresa?.cnpj || '').replace(/\D/g, '');
  let cnaesSalvos: string[] = [];
  try {
    const raw = cnpjLimpo ? localStorage.getItem(`@Expertise:cnaes_${cnpjLimpo}`) : null;
    if (raw) cnaesSalvos = JSON.parse(raw);
  } catch {}
  const emp = empresa as any;
  const fontes = [
    emp?.cnaeDescricao,
    emp?.ramoAtividade,
    emp?.atividadePrincipal,
    ...(Array.isArray(emp?.cnaesSecundarios) ? emp.cnaesSecundarios : []),
    ...cnaesSalvos,
  ].filter(Boolean);

  const stop = new Set(['comercio', 'varejista', 'atacadista', 'servicos', 'artigos', 'outros', 'produtos', 'geral', 'ltda', 'para']);
  const termos = new Set<string>();
  for (const f of fontes) {
    normalizar(String(f))
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 3 && !stop.has(p))
      .forEach((p) => termos.add(p));
  }
  if (termos.has('vestuario') || termos.has('roupas')) {
    ['uniforme', 'fardamento', 'confeccao', 'camiseta', 'calcados'].forEach((t) => termos.add(t));
  }
  return Array.from(termos);
}

function calcularViabilidadeReal(item: any, termos: string[], ufEmpresa?: string) {
  let score = 40;
  const obj = normalizar(item.objetoCompra || item.objeto || '');
  const acertos = termos.filter((t) => obj.includes(t)).length;
  if (acertos >= 2) score += 38;
  else if (acertos === 1) score += 28;

  const ufEdital = item.unidadeOrgao?.ufSigla || item.uf || '';
  if (ufEmpresa && ufEdital && ufEmpresa.toUpperCase() === ufEdital.toUpperCase()) {
    score += 12;
  }

  const valor = Number(item.valorTotalEstimado ?? item.valorEstimado ?? item.valor_estimado ?? 0);
  if (valor > 0 && valor <= 80000) score += 8; // faixa exclusiva ME/EPP
  else if (valor > 80000) score += 5;

  const finalScore = Math.min(98, Math.max(25, score));
  const faixa = finalScore >= 75 ? 'VERDE' : finalScore >= 50 ? 'AMARELO' : 'VERMELHO';
  return { score: finalScore, faixa, valor, acertos };
}

export function ScoreOportunidadesPage() {
  const { selectedCompany } = useCompany();
  const [editais, setEditais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroFaixa, setFiltroFaixa] = useState<'TODAS' | 'VERDE' | 'AMARELO' | 'VERMELHO'>('TODAS');
  const [editalModal, setEditalModal] = useState<DossieEditalData | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const resp = await licitacoesApi.listar({ limit: 100, local: true } as any);
      const lista = resp?.data?.items || resp?.data?.data || (Array.isArray(resp?.data) ? resp.data : []);
      setEditais(Array.isArray(lista) ? lista : []);
    } catch {
      setEditais([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const termos = useMemo(() => extrairTermosEmpresa(selectedCompany), [selectedCompany]);
  const ufEmpresa = (selectedCompany as any)?.uf || (selectedCompany as any)?.estado || '';

  const analisados = useMemo(() => {
    return editais
      .map((item) => {
        const calc = calcularViabilidadeReal(item, termos, ufEmpresa);
        return { ...item, ...calc };
      })
      .sort((a, b) => b.score - a.score || b.valor - a.valor);
  }, [editais, termos, ufEmpresa]);

  const filtrados = useMemo(() => {
    if (filtroFaixa === 'TODAS') return analisados;
    return analisados.filter((e) => e.faixa === filtroFaixa);
  }, [analisados, filtroFaixa]);

  const totalVerde = analisados.filter((e) => e.faixa === 'VERDE').length;
  const totalAmarelo = analisados.filter((e) => e.faixa === 'AMARELO').length;
  const totalVermelho = analisados.filter((e) => e.faixa === 'VERMELHO').length;
  const potencialTotal = analisados
    .filter((e) => e.faixa === 'VERDE')
    .reduce((acc, e) => acc + (e.valor || 0), 0);

  const dadosGraficoFaixas = [
    { nome: 'Alta (Verde)', qtd: totalVerde, cor: '#10b981' },
    { nome: 'Média (Amarelo)', qtd: totalAmarelo, cor: '#f59e0b' },
    { nome: 'Baixa (Vermelho)', qtd: totalVermelho, cor: '#ef4444' },
  ];

  const dadosPorUf = useMemo(() => {
    const mapa: Record<string, number> = {};
    analisados.filter((e) => e.faixa !== 'VERMELHO').forEach((e) => {
      const uf = e.unidadeOrgao?.ufSigla || e.uf || 'BR';
      mapa[uf] = (mapa[uf] || 0) + 1;
    });
    return Object.entries(mapa)
      .map(([uf, qtd]) => ({ uf, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);
  }, [analisados]);

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#081C3A] flex items-center gap-2.5">
              <TrendingUp className="h-7 w-7 text-[#FF6600]" />
              Análise de Viabilidade e Rentabilidade
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Editais classificados pelo potencial real de ganho e aderência ao CNAE de{' '}
              <strong className="text-[#081C3A]">{selectedCompany?.razaoSocial || 'sua empresa'}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-full bg-[#081C3A] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0f2b56] cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar análise
          </button>
        </div>

        {/* 4 KPIs Visuais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Editais Avaliados</p>
            <p className="mt-2 text-3xl font-extrabold text-[#081C3A]">{analisados.length}</p>
            <p className="mt-1 text-xs text-slate-500">Base oficial sincronizada</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Alta Viabilidade (Verde)
            </p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">{totalVerde}</p>
            <p className="mt-1 text-xs text-emerald-700">Mais rentáveis para o seu CNPJ</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Média Viabilidade (Amarelo)
            </p>
            <p className="mt-2 text-3xl font-extrabold text-amber-600">{totalAmarelo}</p>
            <p className="mt-1 text-xs text-amber-700">Avaliar logística e margem</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-[#0070C0] flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Volume nos Verdes
            </p>
            <p className="mt-2 text-2xl font-extrabold text-[#081C3A]">
              {potencialTotal > 0 ? potencialTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Consultar'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Soma estimada das melhores oportunidades</p>
          </div>
        </div>

        {/* Gráficos Visuais */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#081C3A] mb-4">Distribuição por Semáforo de Viabilidade</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoFaixas}>
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="qtd" radius={[8, 8, 0, 0]}>
                    {dadosGraficoFaixas.map((entry, idx) => (
                      <Cell key={idx} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#081C3A] mb-4">Estados com Mais Oportunidades Viáveis</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorUf}>
                  <XAxis dataKey="uf" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#0070C0" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Filtros Semáforo */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'TODAS', label: `Todos (${analisados.length})` },
            { id: 'VERDE', label: `Verde — Mais Rentáveis (${totalVerde})` },
            { id: 'AMARELO', label: `Amarelo — Médios (${totalAmarelo})` },
            { id: 'VERMELHO', label: `Vermelho — Baixos (${totalVermelho})` },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFiltroFaixa(btn.id as any)}
              className={`rounded-full px-4 py-2 text-xs font-bold border transition cursor-pointer ${
                filtroFaixa === btn.id
                  ? 'bg-[#081C3A] text-white border-[#081C3A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Lista Rankeada */}
        <div className="space-y-3">
          {filtrados.slice(0, 40).map((edital, idx) => {
            const isVerde = edital.faixa === 'VERDE';
            const isAmarelo = edital.faixa === 'AMARELO';
            const badgeCls = isVerde
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : isAmarelo
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-rose-200 bg-rose-50 text-rose-700';
            const borderCls = isVerde
              ? 'border-l-4 border-l-emerald-500'
              : isAmarelo
              ? 'border-l-4 border-l-amber-400'
              : 'border-l-4 border-l-rose-500';
            const orgao = edital.orgao || edital.nomeOrgao || edital.buyerName || edital.orgaoEntidade?.razaoSocial || 'Órgão Licitante';
            const uf = edital.unidadeOrgao?.ufSigla || edital.uf || 'BR';
            const objeto = edital.objetoCompra || edital.objeto || '';
            const urlPncp = buildOfficialPncpPortalUrl(edital);

            return (
              <motion.div
                key={String(edital.id || idx)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.25) }}
                className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all ${borderCls}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${badgeCls}`}>
                      {isVerde ? <CheckCircle2 className="h-3.5 w-3.5" /> : isAmarelo ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {edital.score}% • {isVerde ? 'Alta Viabilidade' : isAmarelo ? 'Média Viabilidade' : 'Baixa Viabilidade'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {edital.modalidadeNome || edital.modalidade || 'Pregão'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditalModal(edital)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:bg-slate-50 cursor-pointer"
                    >
                      Ver Resumo
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('luli:analisar-edital', { detail: edital }))}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070C0] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#005ea3] cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Analisar com a Luli
                    </button>
                    {urlPncp && (
                      <a
                        href={urlPncp}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-[#081C3A]"
                      >
                        PNCP <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-sm font-bold text-[#081C3A] leading-snug">{objeto}</h3>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{orgao}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {uf}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <DollarSign className="h-3.5 w-3.5" />
                    {edital.valor > 0 ? edital.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Consultar no edital'}
                  </span>
                  {edital.dataEncerramentoProposta && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Encerra: {new Date(edital.dataEncerramentoProposta).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <DossieEditalModal
        isOpen={Boolean(editalModal)}
        onClose={() => setEditalModal(null)}
        edital={editalModal}
      />
    </div>
  );
}

export default ScoreOportunidadesPage;
