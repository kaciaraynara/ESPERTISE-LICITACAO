import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch,
  FileText,
  Users,
  Scale,
  Trophy,
  ArrowRight,
  ChevronRight,
  Trash2,
  TrendingUp,
  Gavel,
} from 'lucide-react';
import { crmApi } from '../services/api';
import { FORNECEDOR_ROUTES } from '../routes';

interface Oportunidade {
  id: string;
  noticeId?: string;
  stage: string;
  notes?: string;
  createdAt?: string;
  notice?: {
    id?: string;
    objetoCompra?: string;
    objeto?: string;
    orgaoEntidade?: { razaoSocial?: string };
    orgaoNome?: string;
    valorTotalEstimado?: number;
    dataEncerramentoProposta?: string;
  };
}

const COLUNAS = [
  {
    id: 'ANALISE',
    titulo: 'Análise',
    subtitulo: 'Oportunidades em avaliação',
    acaoLabel: 'Ver oportunidades',
    rota: FORNECEDOR_ROUTES.radar,
    icon: FileSearch,
    corIcone: 'text-[#FF6600]',
  },
  {
    id: 'PROPOSTA',
    titulo: 'Proposta',
    subtitulo: 'Elaboração e envio',
    acaoLabel: 'Criar proposta',
    rota: FORNECEDOR_ROUTES.propostas,
    icon: FileText,
    corIcone: 'text-[#081C3A]',
  },
  {
    id: 'SESSAO_PUBLICA',
    titulo: 'Sessão pública',
    subtitulo: 'Acompanhamento em tempo real',
    acaoLabel: 'Acessar sessão',
    rota: FORNECEDOR_ROUTES.disputa_ao_vivo,
    icon: Users,
    corIcone: 'text-[#0070C0]',
  },
  {
    id: 'FASE_RECURSAL',
    titulo: 'Fase recursal',
    subtitulo: 'Recursos e manifestações',
    acaoLabel: 'Ver processos',
    rota: FORNECEDOR_ROUTES.recursos,
    icon: Scale,
    corIcone: 'text-[#081C3A]',
  },
  {
    id: 'ADJUDICACAO',
    titulo: 'Adjudicação',
    subtitulo: 'Resultado e homologação',
    acaoLabel: 'Acompanhar',
    rota: FORNECEDOR_ROUTES.gestao_pos_vitoria,
    icon: Trophy,
    corIcone: 'text-[#FF6600]',
  },
];

function normalizarEstagio(stage?: string): string {
  const s = (stage || 'ANALISE').toUpperCase();
  if (['ANALISE', 'TRIAGEM', 'NOVO', 'CAPTACAO'].includes(s)) return 'ANALISE';
  if (['PROPOSTA', 'ELABORACAO', 'HABILITACAO'].includes(s)) return 'PROPOSTA';
  if (['SESSAO_PUBLICA', 'DISPUTA', 'LANCES', 'EM_DISPUTA'].includes(s)) return 'SESSAO_PUBLICA';
  if (['FASE_RECURSAL', 'RECURSO', 'RECURSOS'].includes(s)) return 'FASE_RECURSAL';
  if (['ADJUDICACAO', 'GANHO', 'HOMOLOGADO', 'VENCIDO'].includes(s)) return 'ADJUDICACAO';
  return 'ANALISE';
}

export default function CrmKanbanPage() {
  const navigate = useNavigate();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [movendoId, setMovendoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resp = await crmApi.getOportunidades();
      const lista = resp?.data?.items || resp?.data?.data || resp?.data || [];
      setOportunidades(Array.isArray(lista) ? lista : []);
    } catch {
      setOportunidades([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleAvancarEtapa = async (op: Oportunidade) => {
    const atual = normalizarEstagio(op.stage);
    const idx = COLUNAS.findIndex((c) => c.id === atual);
    if (idx < 0 || idx >= COLUNAS.length - 1) return;

    const proximo = COLUNAS[idx + 1].id;
    setMovendoId(op.id);
    try {
      await crmApi.moveOportunidade(op.id, { stage: proximo });
      setOportunidades((prev) =>
        prev.map((item) => (item.id === op.id ? { ...item, stage: proximo } : item))
      );
    } finally {
      setMovendoId(null);
    }
  };

  const handleRemover = async (id: string) => {
    setMovendoId(id);
    try {
      await crmApi.removeOportunidade(id);
      setOportunidades((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setMovendoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#081C3A]">
              Gestão de disputas
            </h1>
            <p className="mt-1 text-lg font-bold text-[#081C3A]">
              Acompanhe cada etapa da licitação
            </p>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Tenha visão completa das oportunidades salvas e saiba qual é o próximo passo para avançar, com mais organização e controle.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
            className="inline-flex items-center gap-2 self-start rounded-full bg-[#FF6600] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
          >
            Explorar oportunidades
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Grade das 5 etapas */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUNAS.map((col, colIndex) => {
            const Icon = col.icon;
            const itens = oportunidades.filter((op) => normalizarEstagio(op.stage) === col.id);

            return (
              <div
                key={col.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-4">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-xl bg-slate-50 p-2">
                        <Icon className={`h-5 w-5 ${col.corIcone}`} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#081C3A]">{col.titulo}</h2>
                        <p className="text-[11px] text-slate-500">{col.subtitulo}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0070C0]">
                      {itens.length}
                    </span>
                  </div>

                  {/* Cards da coluna */}
                  <div className="space-y-2.5">
                    {carregando ? (
                      <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                    ) : itens.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs text-slate-400">
                        Nenhuma disputa nesta etapa
                      </div>
                    ) : (
                      itens.map((op) => {
                        const titulo =
                          op.notice?.objetoCompra ||
                          op.notice?.objeto ||
                          op.notes ||
                          'Licitação salva no Radar';
                        const orgao =
                          op.notice?.orgaoEntidade?.razaoSocial ||
                          op.notice?.orgaoNome ||
                          'Órgão público';

                        return (
                          <div
                            key={op.id}
                            className="group rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 transition hover:border-[#0070C0]/40 hover:bg-white"
                          >
                            <p className="line-clamp-2 text-xs font-bold text-[#081C3A]">
                              {titulo}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">{orgao}</p>

                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5">
                              <button
                                type="button"
                                onClick={() => handleRemover(op.id)}
                                disabled={movendoId === op.id}
                                title="Remover das disputas"
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>

                              <div className="flex items-center gap-1.5">
                                {col.id === 'SESSAO_PUBLICA' && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(FORNECEDOR_ROUTES.disputa_ao_vivo)}
                                    className="inline-flex items-center gap-1 rounded-full bg-[#0070C0] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#005ea3]"
                                  >
                                    <Gavel className="h-3 w-3" />
                                    Sala
                                  </button>
                                )}

                                {colIndex < COLUNAS.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleAvancarEtapa(op)}
                                    disabled={movendoId === op.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#081C3A] shadow-sm transition hover:text-[#0070C0]"
                                  >
                                    Avançar
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Rodapé da coluna */}
                <button
                  type="button"
                  onClick={() => navigate(col.rota)}
                  className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-[#0070C0] transition hover:text-[#081C3A]"
                >
                  <span>{col.acaoLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Banner inferior */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6600]">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#081C3A]">
                Do edital ao resultado, com mais clareza e eficiência.
              </h3>
            </div>
          </div>
          <p className="max-w-md text-sm text-slate-500">
            Centralize suas disputas, acompanhe prazos, organize documentos e avance com segurança em cada pregão.
          </p>
        </div>
      </div>
    </div>
  );
}