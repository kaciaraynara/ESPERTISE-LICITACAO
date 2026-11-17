import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Bot,
  ExternalLink,
  Building2,
  FileCheck2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { licitacoesApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';
import { FORNECEDOR_ROUTES } from '@/routes';
import { buildOfficialPncpPortalUrl, formatPncpDateBR } from '@/utils/pncp';

function formatarMoeda(v: number | null | undefined): string {
  if (!v || Number.isNaN(Number(v))) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function calcularViabilidade(edital: any, empresa: any): {
  score: number;
  faixa: 'VERDE' | 'AMARELO' | 'VERMELHO';
  motivos: string[];
} {
  let score = 45;
  const motivos: string[] = [];
  const objeto = String(edital.objeto || edital.objetoCompra || '').toLowerCase();
  const ufEmpresa = String(empresa?.uf || '').toUpperCase();
  const ufEdital = String(edital.uf || edital.unidadeOrgao?.ufSigla || '').toUpperCase();

  if (ufEmpresa && ufEdital && ufEmpresa === ufEdital) {
    score += 22;
    motivos.push(`Mesma UF da empresa (${ufEmpresa})`);
  }

  const cnaeDesc = String(empresa?.cnaeDescricao || empresa?.cnaePrincipal || '').toLowerCase();
  const palavrasCnae = cnaeDesc
    .split(/[^a-z0-9à-ú]+/i)
    .filter((w) => w.length >= 4);

  const bateuCnae = palavrasCnae.some((p) => objeto.includes(p));
  if (bateuCnae) {
    score += 25;
    motivos.push('Aderente ao CNAE principal da empresa');
  }

  const valor = Number(edital.valorTotalEstimado ?? edital.valorEstimado ?? 0);
  if (valor > 0) {
    score += 8;
    motivos.push('Valor de referencia divulgado');
  }

  const finalScore = Math.min(98, Math.max(25, score));
  const faixa: 'VERDE' | 'AMARELO' | 'VERMELHO' =
    finalScore >= 75 ? 'VERDE' : finalScore >= 55 ? 'AMARELO' : 'VERMELHO';

  if (motivos.length === 0) {
    motivos.push('Analise detalhada recomendada com a Luli antes de participar');
  }

  return { score: finalScore, faixa, motivos };
}

export const ScoreOportunidadesPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany: activeCompany } = useCompany();
  const [editais, setEditais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroFaixa, setFiltroFaixa] = useState<'TODOS' | 'VERDE' | 'AMARELO' | 'VERMELHO'>('TODOS');

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const resp = await licitacoesApi.listar({ local: true } as any);
        const lista = resp.data?.items || resp.data?.data || [];
        if (ativo) setEditais(Array.isArray(lista) ? lista : []);
      } catch {
        if (ativo) setEditais([]);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [activeCompany?.id]);

  const analisados = useMemo(() => {
    return editais
      .map((ed) => {
        const calc = calcularViabilidade(ed, activeCompany);
        return { ...ed, _viab: calc };
      })
      .sort((a, b) => b._viab.score - a._viab.score);
  }, [editais, activeCompany]);

  const verdes = analisados.filter((e) => e._viab.faixa === 'VERDE').length;
  const amarelos = analisados.filter((e) => e._viab.faixa === 'AMARELO').length;
  const vermelhos = analisados.filter((e) => e._viab.faixa === 'VERMELHO').length;

  const filtrados =
    filtroFaixa === 'TODOS'
      ? analisados
      : analisados.filter((e) => e._viab.faixa === filtroFaixa);

  const dadosSemaforo = [
    { nome: 'Alta Viabilidade', qtd: verdes, cor: '#16A34A' },
    { nome: 'Media Viabilidade', qtd: amarelos, cor: '#F59E0B' },
    { nome: 'Baixa Viabilidade', qtd: vermelhos, cor: '#DC2626' },
  ];

  const mapaUf: Record<string, number> = {};
  analisados.forEach((e) => {
    const u = String(e.uf || e.unidadeOrgao?.ufSigla || 'BR').toUpperCase();
    mapaUf[u] = (mapaUf[u] || 0) + 1;
  });
  const dadosUf = Object.entries(mapaUf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([uf, qtd]) => ({ uf, qtd }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">Analise de Viabilidade</h1>
            <p className="text-xs text-slate-500">
              Editais classificados com base no CNAE, localizacao e perfil real da empresa ativa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <Building2 className="h-4 w-4 text-[#0070C0]" />
          <span className="font-bold">{activeCompany?.razaoSocial || 'Empresa Ativa'}</span>
          {activeCompany?.uf && <span className="rounded bg-white px-2 py-0.5 font-bold">{activeCompany.uf}</span>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Editais Avaliados</div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{analisados.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Alta Viabilidade
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">{verdes}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Media Viabilidade
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700">{amarelos}</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <XCircle className="h-4 w-4" /> Baixa Viabilidade
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-700">{vermelhos}</div>
        </div>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Distribuicao por Semaforo</h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosSemaforo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                  {dadosSemaforo.map((entry, idx) => (
                    <Cell key={idx} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Principais Estados com Oportunidades</h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosUf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#081C3A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'TODOS', label: `Todos (${analisados.length})` },
          { id: 'VERDE', label: `Alta Viabilidade (${verdes})` },
          { id: 'AMARELO', label: `Media Viabilidade (${amarelos})` },
          { id: 'VERMELHO', label: `Baixa Viabilidade (${vermelhos})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroFaixa(f.id as any)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              filtroFaixa === f.id
                ? 'bg-[#081C3A] text-white'
                : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de Editais */}
      {carregando ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-[#081C3A]">
          <Loader2 className="h-5 w-5 animate-spin text-[#F97316]" />
          Extraindo e classificando editais compativeis com sua empresa...
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.slice(0, 30).map((ed, idx) => {
            const { score, faixa, motivos } = ed._viab;
            const badge =
              faixa === 'VERDE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : faixa === 'AMARELO'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';
            const portalUrl = buildOfficialPncpPortalUrl(ed);

            return (
              <div key={ed.id || idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${badge}`}>
                        {score}% · {faixa === 'VERDE' ? 'Alta Viabilidade' : faixa === 'AMARELO' ? 'Media Viabilidade' : 'Baixa Viabilidade'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
                        {ed.modalidadeNome || ed.modalidade || 'Pregao'}
                      </span>
                      {(ed.uf || ed.unidadeOrgao?.ufSigla) && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0070C0]">
                          {ed.uf || ed.unidadeOrgao?.ufSigla}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-extrabold text-[#081C3A]">
                      {ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Orgao Publico'}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-700">
                      {ed.objeto || ed.objetoCompra || 'Objeto nao informado'}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>
                        Valor: <strong className="text-emerald-700">{formatarMoeda(ed.valorTotalEstimado ?? ed.valorEstimado)}</strong>
                      </span>
                      <span>
                        Abertura: <strong>{formatPncpDateBR(ed.dataAberturaProposta || ed.dataPublicacaoPncp, true)}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {motivos.map((m: string) => (
                        <span key={m} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          <FileCheck2 className="h-3 w-3 text-[#F97316]" /> {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`${FORNECEDOR_ROUTES.lex}?edital=${encodeURIComponent(ed.id || '')}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Bot className="h-4 w-4 text-[#F97316]" />
                      Ler Edital com a Luli
                    </button>
                    {portalUrl && (
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0070C0] hover:bg-slate-50"
                      >
                        PNCP <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScoreOportunidadesPage;
