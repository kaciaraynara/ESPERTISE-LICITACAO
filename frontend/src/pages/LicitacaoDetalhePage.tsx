import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  Crosshair,
  DollarSign,
  ExternalLink,
  FileSearch,
  FileText,
  Gavel,
  Loader2,
  MapPin,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from '@components/icons/phosphor-compat';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils';
import { lexApi, licitacoesApi, empresasApi } from '@services/api';

type Score = {
  pontuacao: number;
  nivel: 'alto' | 'medio' | 'baixo';
  criterios?: {
    nicho: number;
    valor: number;
    prazo: number;
    orgao: number;
    completude: number;
    historico: number;
  };
};

type Licitacao = {
  id: string;
  objeto: string;
  orgao: string;
  uf?: string;
  municipio?: string;
  valor_estimado?: number;
  data_abertura?: string;
  modalidade?: string;
  situacao?: string;
  link?: string;
  fonte?: string;
  score?: Score | null;
};

type ResumoResult = {
  visao_geral: string;
  objeto_resumido: string;
  o_que_exige_do_licitante: string[];
  datas_criticas: string[];
  alertas: string[];
  recomendacao_final: string;
};

type VicioJuridico = {
  erro: string;
  base_legal: string;
  risco: 'desclassificacao' | 'nulidade' | 'outro';
  acao_sugerida: string;
};

type ChecklistItem = {
  documento: string;
  possui: boolean;
  observacao?: string;
};

type AuditoriaResult = {
  resumo: string;
  status_juridico: 'aprovado' | 'atencao' | 'irregular';
  justificativa_recomendacao: string;
  vicios: VicioJuridico[];
  checklist_habilitacao: ChecklistItem[];
  citacoes_lei_14133: string[];
};

type PropostaResult = {
  estrategia_precificacao: string;
  margem_sugerida: string;
  proposta_comercial: string;
  pontos_destaque: string[];
};

type ImpugnacaoResult = {
  tese_central: string;
  fundamentos: string[];
  pedidos: string[];
  texto_impugnacao: string;
};

type ActiveTab = 'resumo' | 'proposta' | 'impugnacao' | 'robo';

function progressWidthClass(percent: number) {
  const clamped = Math.max(0, Math.min(percent, 100));
  if (clamped >= 95) return 'w-full';
  if (clamped >= 80) return 'w-4/5';
  if (clamped >= 66) return 'w-2/3';
  if (clamped >= 50) return 'w-1/2';
  if (clamped >= 33) return 'w-1/3';
  if (clamped >= 25) return 'w-1/4';
  if (clamped >= 16) return 'w-1/6';
  if (clamped > 0) return 'w-[8%]';
  return 'w-0';
}
function StatusBadge({ status }: { status: AuditoriaResult['status_juridico'] }) {
  const styles = {
    aprovado: 'border-brand-blue/20 bg-white text-brand-blue',
    atencao: 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue',
    irregular: 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue',
  }[status];

  const labels = {
    aprovado: 'Edital seguro',
    atencao: 'Pede cautela',
    irregular: 'Vicios relevantes',
  };

  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${styles}`}>
      {labels[status]}
    </span>
  );
}

function ScorePill({ score }: { score?: Score | null }) {
  if (!score) return null;

  const tone =
    score.pontuacao >= 80
      ? 'border-brand-blue/20 bg-white text-brand-blue'
      : score.pontuacao >= 60
        ? 'border-brand-blue/20 bg-white text-brand-blue'
        : 'border-gray-100 bg-white text-brand-blue/70';

  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${tone}`}>
      Score {score.pontuacao}
    </span>
  );
}

function CriterioBar({
  label,
  value,
  color,
  maxValue,
}: {
  label: string;
  value: number;
  color: string;
  maxValue: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-brand-blue/70">{label}</span>
        <span className="text-sm font-bold text-brand-blue">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-lg bg-white">
        <div className={`h-full rounded-lg ${color} ${progressWidthClass((value / maxValue) * 100)}`} />
      </div>
    </div>
  );
}

function copyText(text: string, successMessage: string) {
  navigator.clipboard.writeText(text);
  toast.success(successMessage);
}

export default function LicitacaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const licitacaoId = id ? decodeURIComponent(id) : '';
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumo');
  const [textoEdital, setTextoEdital] = useState('');
  const [contextoImpugnacao, setContextoImpugnacao] = useState('');
  const [resumo, setResumo] = useState<ResumoResult | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaResult | null>(null);
  const [proposta, setProposta] = useState<PropostaResult | null>(null);
  const [impugnacao, setImpugnacao] = useState<ImpugnacaoResult | null>(null);

  const licitacaoQuery = useQuery({
    queryKey: ['licitacao-detalhe', licitacaoId],
    queryFn: async () => {
      const response = await licitacoesApi.buscarPorId(licitacaoId);
      return response.data?.data as Licitacao;
    },
    enabled: Boolean(licitacaoId),
    retry: 1,
  });

  const empresaQuery = useQuery({
    queryKey: ['empresas-detalhe'],
    queryFn: async () => {
      const response = await empresasApi.listar();
      return (response.data?.data ?? []) as Array<{ id: string; razao_social: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const nomeEmpresa = empresaQuery.data?.[0]?.razao_social || 'Empresa Licitante';

  const resumoMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        edital_id: licitacaoId,
        texto_edital: textoEdital || undefined,
      };
      const [resumoResponse, auditoriaResponse] = await Promise.all([
        lexApi.resumo(payload),
        lexApi.auditar(payload),
      ]);

      return {
        resumo: resumoResponse.data?.data as ResumoResult,
        auditoria: auditoriaResponse.data?.data as AuditoriaResult,
      };
    },
    onSuccess: (data) => {
      setResumo(data.resumo);
      setAuditoria(data.auditoria);
      setContextoImpugnacao(
        data.auditoria.vicios?.map((item) => `${item.erro} | ${item.base_legal} | ${item.acao_sugerida}`).join('\n') || '',
      );
      toast.success('Resumo executivo e leitura juridica gerados.');
    },
    onError: () => toast.error('Nao foi possivel gerar o resumo agora.'),
  });

  const propostaMutation = useMutation({
    mutationFn: async () => {
      const response = await lexApi.proposta({
        edital_id: licitacaoId,
        texto_edital: textoEdital || undefined,
        nome_empresa: nomeEmpresa,
      });

      return response.data?.data as PropostaResult;
    },
    onSuccess: (data) => {
      setProposta(data);
      toast.success('Proposta estrategica gerada.');
    },
    onError: () => toast.error('Nao foi possivel gerar a proposta agora.'),
  });

  const impugnacaoMutation = useMutation({
    mutationFn: async () => {
      const response = await lexApi.impugnacao({
        edital_id: licitacaoId,
        texto_edital: textoEdital || undefined,
        contexto: contextoImpugnacao || auditoria?.vicios?.map((item) => `${item.erro} - ${item.base_legal}`).join('\n'),
      });

      return response.data?.data as ImpugnacaoResult;
    },
    onSuccess: (data) => {
      setImpugnacao(data);
      toast.success('Minuta de impugnacao preparada.');
    },
    onError: () => toast.error('Nao foi possivel montar a impugnacao agora.'),
  });

  if (!licitacaoId) return null;

  const lic = licitacaoQuery.data;
  const juridicoHref = `/juridico?edital=${encodeURIComponent(licitacaoId)}&objeto=${encodeURIComponent(lic?.objeto || '')}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <Link
        to="/licitante/licitacoes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue/70 transition hover:text-brand-blue"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao radar
      </Link>

      {licitacaoQuery.isLoading && (
        <div className="rounded-[28px] border border-gray-100 bg-white p-12 text-center shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand-blue" />
          <p className="text-sm text-brand-blue/70">Carregando edital...</p>
        </div>
      )}

      {lic && (
        <>
          <section className="overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-xl shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
            <div className="bg-white px-8 py-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                  {lic.fonte || 'Radar'}
                </span>
                <ScorePill score={lic.score} />
              </div>

              <h1 className="mt-4 max-w-4xl text-2xl font-bold leading-tight tracking-tight text-brand-blue md:text-3xl">
                {lic.objeto}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-blue/70">
                Tela focada em praticidade: resumo executivo, score de aderencia, proposta estrategica, impugnacao e acesso rapido a sala do robo para participar da disputa sem perder tempo.
              </p>
            </div>

            <div className="grid gap-4 border-t border-gray-100 p-8 md:grid-cols-4">
              <div className="rounded-[24px] border border-brand-blue/20 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand-blue" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue">Valor estimado</p>
                </div>
                <p className="text-lg font-bold text-brand-blue">{formatCurrency(lic.valor_estimado)}</p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-blue/70" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Abertura</p>
                </div>
                <p className="text-base font-bold text-brand-blue">{formatDate(lic.data_abertura)}</p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand-blue/70" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Orgao</p>
                </div>
                <p className="text-base font-bold text-brand-blue">{lic.orgao}</p>
                {(lic.municipio || lic.uf) && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-brand-blue/70">
                    <MapPin className="h-3.5 w-3.5" />
                    {[lic.municipio, lic.uf].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-blue/70" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Modalidade</p>
                </div>
                <p className="text-base font-bold text-brand-blue">{lic.modalidade || 'Nao informada'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-gray-100 px-8 py-5">
              {lic.link && (
                <a
                  href={lic.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-5 py-3 text-sm font-bold text-brand-blue transition hover:border-brand-blue/20"
                >
                  <ExternalLink className="h-4 w-4 text-brand-blue/70" />
                  Abrir portal original
                </a>
              )}
              <Link
                to={`/fornecedor/robo-lances?licitacao=${encodeURIComponent(licitacaoId)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-orange bg-brand-orange px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                <Crosshair className="h-4 w-4" />
                Sala do Robô
              </Link>
              <Link
                to={juridicoHref}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-white px-5 py-3 text-sm font-bold text-brand-blue transition hover:bg-white"
              >
                <Gavel className="h-4 w-4" />
                Acionar jurídico
              </Link>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-blue" />
                <h2 className="text-sm font-bold text-brand-blue">Grau de score do edital</h2>
              </div>
              <p className="mt-2 text-sm leading-7 text-brand-blue/70">
                O score combina aderencia ao nicho, valor, prazo e alinhamento operacional para priorizar os melhores editais para a empresa.
              </p>

              {lic.score?.criterios ? (
                <div className="mt-5 space-y-4">
                  <CriterioBar label="Nicho e CNAE" value={lic.score.criterios.nicho} color="bg-brand-blue" maxValue={35} />
                  <CriterioBar label="Faixa de valor" value={lic.score.criterios.valor} color="bg-brand-blue" maxValue={15} />
                  <CriterioBar label="Janela de prazo" value={lic.score.criterios.prazo} color="bg-brand-blue" maxValue={15} />
                  <CriterioBar label="Orgao e regiao" value={lic.score.criterios.orgao} color="bg-brand-blue" maxValue={15} />
                  <CriterioBar label="Completude" value={lic.score.criterios.completude} color="bg-brand-orange/10" maxValue={12} />
                  <CriterioBar label="Historico da fonte" value={lic.score.criterios.historico} color="bg-brand-blue" maxValue={10} />
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-gray-100 bg-white p-4 text-sm text-brand-blue/70">
                  O score detalhado sera exibido conforme o edital for avaliado a partir do perfil da empresa vinculada.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-blue" />
                <h2 className="text-sm font-bold text-brand-blue">Entrada rapida para analise</h2>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">
                  Texto adicional do edital
                </label>
                <textarea
                  value={textoEdital}
                  onChange={(event) => setTextoEdital(event.target.value)}
                  rows={7}
                  placeholder="Cole aqui trechos do edital, exigencias especificas, planilha resumida ou clausulas que merecem leitura aprofundada."
                  className="w-full rounded-[24px] border border-gray-100 bg-white px-4 py-4 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white"
                />
                <p className="text-xs leading-6 text-brand-blue/70">
                  O Expertise ja tenta usar os dados do edital automaticamente. Colar trechos ajuda a melhorar resumo, proposta e impugnacao.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'resumo', label: 'Resumo do edital', color: 'bg-brand-blue text-white' },
                { id: 'proposta', label: 'Proposta estrategica', color: 'bg-brand-blue text-white' },
                { id: 'impugnacao', label: 'Impugnacao', color: 'bg-brand-blue text-white' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
                    activeTab === tab.id
                      ? tab.color
                      : 'bg-white text-brand-blue/70 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'resumo' && (
            <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
              {!resumo && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white p-3">
                      <FileSearch className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-brand-blue">Resumo executivo e leitura juridica</h2>
                      <p className="text-sm text-brand-blue/70">
                        Entenda rapidamente objeto, exigencias, datas, riscos e pontos de atencao sem ler o edital inteiro.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => resumoMutation.mutate()}
                    disabled={resumoMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-blue disabled:opacity-60"
                  >
                    {resumoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                    Gerar resumo executivo
                  </button>
                </div>
              )}

              {resumo && (
                <div className="space-y-6">
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[24px] border border-brand-blue/20 bg-white p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <Scale className="h-4 w-4 text-brand-blue" />
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Visao geral</p>
                      </div>
                      <p className="text-sm leading-7 text-brand-blue">{resumo.visao_geral}</p>
                      <p className="mt-4 text-sm font-bold text-brand-blue">{resumo.recomendacao_final}</p>
                    </div>

                    <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-brand-blue" />
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Objeto resumido</p>
                      </div>
                      <p className="text-sm leading-7 text-brand-blue">{resumo.objeto_resumido}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">O que exige do licitante</p>
                      <div className="mt-3 space-y-2">
                        {resumo.o_que_exige_do_licitante.map((item) => (
                          <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-brand-blue shadow-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Datas criticas</p>
                      <div className="mt-3 space-y-2">
                        {resumo.datas_criticas.map((item) => (
                          <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-brand-blue shadow-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-brand-orange/50 bg-brand-orange/10 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Alertas</p>
                      <div className="mt-3 space-y-2">
                        {resumo.alertas.map((item) => (
                          <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-brand-blue shadow-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {auditoria && (
                    <div className="space-y-5 border-t border-gray-100 pt-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={auditoria.status_juridico} />
                        <button
                          onClick={() => {
                            setResumo(null);
                            setAuditoria(null);
                          }}
                          className="text-xs font-bold text-brand-blue/70 transition hover:text-brand-blue"
                        >
                          Gerar nova leitura
                        </button>
                      </div>

                      <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                        <p className="text-sm leading-7 text-brand-blue">{auditoria.justificativa_recomendacao}</p>
                      </div>

                      {auditoria.vicios?.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-brand-blue" />
                            <h3 className="text-sm font-bold text-brand-blue">Vicios e pontos de impugnacao</h3>
                          </div>
                          {auditoria.vicios.map((vicio) => (
                            <div key={`${vicio.erro}-${vicio.base_legal}`} className="rounded-[24px] border border-brand-orange/50 bg-white p-5">
                              <p className="text-sm font-bold text-brand-blue">{vicio.erro}</p>
                              <p className="mt-2 text-xs font-semibold text-brand-blue">{vicio.base_legal}</p>
                              <p className="mt-3 text-sm leading-7 text-brand-blue/70">{vicio.acao_sugerida}</p>
                              <button
                                onClick={() => copyText(vicio.acao_sugerida, 'Trecho copiado para impugnacao.')}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-white px-4 py-2 text-xs font-bold text-brand-blue transition hover:bg-white"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar fundamento
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {auditoria.checklist_habilitacao?.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-brand-blue" />
                            <h3 className="text-sm font-bold text-brand-blue">Checklist de habilitacao</h3>
                          </div>
                          <div className="overflow-hidden rounded-[24px] border border-gray-100">
                            {auditoria.checklist_habilitacao.map((item) => (
                              <div key={`${item.documento}-${item.observacao || ''}`} className="flex items-start gap-3 border-b border-gray-100 bg-white px-4 py-3 last:border-b-0">
                                <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.possui ? 'text-brand-blue' : 'text-brand-blue'}`} />
                                <div>
                                  <p className="text-sm font-semibold text-brand-blue">{item.documento}</p>
                                  {item.observacao && <p className="mt-1 text-xs text-brand-blue/70">{item.observacao}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'proposta' && (
            <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
              {!proposta && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white p-3">
                      <Scale className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-brand-blue">Proposta estrategica e precificacao</h2>
                      <p className="text-sm text-brand-blue/70">
                        Monte uma proposta mais assertiva para participar da disputa com mais clareza comercial.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => propostaMutation.mutate()}
                    disabled={propostaMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-blue disabled:opacity-60"
                  >
                    {propostaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Gerar proposta estrategica
                  </button>
                </div>
              )}

              {proposta && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-brand-blue/20 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Estrategia</p>
                      <p className="mt-3 text-sm leading-7 text-brand-blue">{proposta.estrategia_precificacao}</p>
                    </div>

                    <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Margem sugerida</p>
                      <p className="mt-3 text-3xl font-bold text-brand-blue">{proposta.margem_sugerida}</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Pontos de destaque</p>
                    <div className="mt-3 space-y-2">
                      {proposta.pontos_destaque.map((item) => (
                        <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-brand-blue shadow-sm">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Documento base da proposta</p>
                        <p className="mt-1 text-sm text-brand-blue/70">Texto inicial para ajuste comercial e envio.</p>
                      </div>
                      <button
                        onClick={() => copyText(proposta.proposta_comercial, 'Proposta copiada.')}
                        className="inline-flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-white px-4 py-2 text-xs font-bold text-brand-blue transition hover:bg-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar proposta
                      </button>
                    </div>
                    <pre className="mt-4 whitespace-pre-wrap rounded-[20px] bg-white p-4 text-xs leading-7 text-brand-blue">
                      {proposta.proposta_comercial}
                    </pre>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'impugnacao' && (
            <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
              {!impugnacao && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white p-3">
                      <ShieldAlert className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-brand-blue">Minuta de impugnacao</h2>
                      <p className="text-sm text-brand-blue/70">
                        Estruture a impugnacao quando o edital apresentar vicios, erros ou clausulas restritivas.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={contextoImpugnacao}
                    onChange={(event) => setContextoImpugnacao(event.target.value)}
                    rows={6}
                    placeholder="Opcional: complemente com clausulas, exigencias ou fundamentos que devem ser atacados."
                    className="w-full rounded-[24px] border border-gray-100 bg-white px-4 py-4 text-sm text-brand-blue outline-none transition focus:border-brand-blue/20 focus:bg-white"
                  />

                  <button
                    onClick={() => impugnacaoMutation.mutate()}
                    disabled={impugnacaoMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-blue disabled:opacity-60"
                  >
                    {impugnacaoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                    Gerar minuta de impugnacao
                  </button>
                </div>
              )}

              {impugnacao && (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-brand-orange/50 bg-brand-orange/10 p-5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-brand-blue" />
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Tese central</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-brand-blue">{impugnacao.tese_central}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Fundamentos</p>
                      <div className="mt-3 space-y-2">
                        {impugnacao.fundamentos.map((item) => (
                          <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-brand-blue shadow-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Pedidos</p>
                      <div className="mt-3 space-y-2">
                        {impugnacao.pedidos.map((item) => (
                          <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-brand-blue shadow-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70">Texto completo</p>
                        <p className="mt-1 text-sm text-brand-blue/70">Minuta inicial para protocolo e refinamento juridico.</p>
                      </div>
                      <button
                        onClick={() => copyText(impugnacao.texto_impugnacao, 'Impugnacao copiada.')}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-4 py-2 text-xs font-bold text-brand-blue transition hover:bg-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar minuta
                      </button>
                    </div>

                    <pre className="mt-4 whitespace-pre-wrap rounded-[20px] bg-white p-4 text-xs leading-7 text-brand-blue">
                      {impugnacao.texto_impugnacao}
                    </pre>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
