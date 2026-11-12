import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  Copy,
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
  Plus,
  TrendingUp,
} from '@components/icons/phosphor-compat';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils';
import { lexApi, licitacoesApi, empresasApi, crmApi, propostasApi } from '@services/api';
import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import { isUserFreePlan } from '@/components/monetization/PremiumFeatureGuard';
import { PaywallModal } from '@/components/monetization/PaywallModal';


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

type ActiveTab = 'viabilidade' | 'resumo' | 'proposta' | 'impugnacao' | 'robo';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('viabilidade');
  const [textoEdital, setTextoEdital] = useState('');
  const [contextoImpugnacao, setContextoImpugnacao] = useState('');
  const [resumo, setResumo] = useState<ResumoResult | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaResult | null>(null);
  const [proposta, setProposta] = useState<PropostaResult | null>(null);
  const [impugnacao, setImpugnacao] = useState<ImpugnacaoResult | null>(null);

  const user = useAuthStore((state) => state.user);
  const { selectedCompany } = useCompany();
  const [paywallAberto, setPaywallAberto] = useState(false);

  // Estados interativos da calculadora de viabilidade
  const [custoProdutoCustom, setCustoProdutoCustom] = useState<number | null>(null);
  const [aliquotaImpostosCustom, setAliquotaImpostosCustom] = useState<number | null>(null);
  const [custoFreteCustom, setCustoFreteCustom] = useState<number | null>(null);
  const [taxasAdmCustom, setTaxasAdmCustom] = useState<number | null>(null);
  const [margemDesejadaCustom, setMargemDesejadaCustom] = useState<number | null>(null);

  const licitacaoQuery = useQuery({
    queryKey: ['licitacao-detalhe', licitacaoId],
    queryFn: async () => {
      try {
        const response = await licitacoesApi.buscarPorId(licitacaoId);
        return response.data?.data as Licitacao;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          toast.error('Edital não localizado na fonte oficial do PNCP.', { id: 'edital-detalhe-404' });
        } else {
          toast.error('Não foi possível carregar os detalhes do edital.', { id: 'edital-detalhe-err' });
        }
        throw err;
      }
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

  const itensQuery = useQuery({
    queryKey: ['licitacao-itens', licitacaoId],
    queryFn: async () => {
      try {
        const response = await licitacoesApi.obterItens(licitacaoId);
        return (response.data?.data ?? []) as any[];
      } catch (err) {
        console.warn('[LicitacaoDetalhePage] Erro ao carregar itens do edital:', err);
        return [];
      }
    },
    enabled: Boolean(licitacaoId),
    staleTime: 5 * 60 * 1000,
  });

  const [gerandoPropostaComercial, setGerandoPropostaComercial] = useState(false);

  const handleGerarPropostaComercial = async () => {
    setGerandoPropostaComercial(true);
    try {
      const selectedCompanyId =
        selectedCompany?.id && selectedCompany.id !== 'default'
          ? selectedCompany.id
          : empresaQuery.data?.[0]?.id;
      const res = await propostasApi.preencherPropostaViaLex({
        noticeId: licitacaoId,
        companyId: selectedCompanyId,
        autoCreate: true,
      });

      const proposalId = res.data?.data?.proposalId || res.data?.data?.proposal?.id;
      toast.success('Proposta comercial gerada com sucesso com base nos itens reais e BDI!');
      if (proposalId) {
        navigate(`/fornecedor/propostas/${proposalId}`);
      } else {
        navigate('/fornecedor/propostas');
      }
    } catch (err: any) {
      console.error('[LicitacaoDetalhePage] Erro ao gerar proposta comercial:', err);
      toast.error(err?.response?.data?.message || 'Falha ao gerar proposta comercial a partir dos itens.');
    } finally {
      setGerandoPropostaComercial(false);
    }
  };

  const nomeEmpresa =
    selectedCompany?.razaoSocial ||
    selectedCompany?.razao_social ||
    empresaQuery.data?.[0]?.razao_social ||
    'Empresa Licitante';

  const handleInvestigarHistoricoOrgao = () => {
    const isFree = isUserFreePlan(user?.plano);
    const hasPermission = user?.permissoes?.includes('investigation.competitor_intelligence') || (!isFree && Boolean(user?.plano));
    if (isFree || !hasPermission) {
      setPaywallAberto(true);
      return;
    }

    const lic = licitacaoQuery.data;
    const termo = (lic as any)?.cnpjOrgao || (lic as any)?.buyerDocument || (lic as any)?.cnpj || lic?.orgao || '';
    navigate(`/fornecedor/historico-concorrentes?busca=${encodeURIComponent(termo)}`);
  };

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

  const crmQuery = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: async () => {
      const res = await crmApi.getOportunidades();
      return (res.data?.data || []) as any[];
    },
    staleTime: 60 * 1000,
  });

  const isInCrm = Boolean(
    crmQuery.data?.some(
      (item: any) =>
        item.noticeId === licitacaoId ||
        item.notice?.id === licitacaoId ||
        item.notice?.externalId === licitacaoId ||
        (licitacaoQuery.data?.id && (item.noticeId === licitacaoQuery.data.id || item.notice?.id === licitacaoQuery.data.id))
    )
  );

  const salvarCrmMutation = useMutation({
    mutationFn: async () => {
      await crmApi.createOportunidade({ noticeId: licitacaoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      toast.success('Edital adicionado à sua Gestão de Disputas!');
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
        toast.error('Este edital já está na sua Gestão de Disputas.');
      } else {
        toast.error(err?.response?.data?.message || 'Erro ao adicionar à Gestão de Disputas.');
      }
    },
  });

  if (!licitacaoId) return null;

  const lic = licitacaoQuery.data;
  const itensEdital = itensQuery.data ?? [];
  const somaValorItens = itensEdital.reduce(
    (acc: number, it: any) =>
      acc +
      (Number(
        it.valorTotal ??
        it.estimatedTotalValue ??
        ((Number(it.quantidade ?? it.quantity) || 1) *
          (Number(it.valorUnitarioEstimado ?? it.estimatedUnitValue) || 0)),
      ) || 0),
    0,
  );
  const rawValorEdital = Number(lic?.valor_estimado ?? (lic as any)?.valorEstimado) || 0;
  const isValorSigiloso = rawValorEdital <= 0 && somaValorItens > 0;
  const valorEdital = rawValorEdital > 0 ? rawValorEdital : somaValorItens;

  // Parâmetros de custos interativos com defaults baseados no edital
  const custoProduto = custoProdutoCustom ?? Math.round(valorEdital * 0.65);
  const aliquotaImpostos = aliquotaImpostosCustom ?? 12;
  const custoFrete = custoFreteCustom ?? Math.round(valorEdital * 0.05);
  const taxasAdm = taxasAdmCustom ?? Math.round(valorEdital * 0.03);
  const margemDesejada = margemDesejadaCustom ?? 15;

  const custosDiretos = custoProduto + custoFrete + taxasAdm;
  const divisor = Math.max(0.05, 1 - (aliquotaImpostos + margemDesejada) / 100);
  const precoMinimoSustentavel = Math.round(custosDiretos / divisor);
  const impostosCalculados = Math.round(valorEdital * (aliquotaImpostos / 100));
  const saldoLiquido = valorEdital - custosDiretos - impostosCalculados;
  const margemRealPercentual = valorEdital > 0 ? Math.round(((saldoLiquido / valorEdital) * 100) * 10) / 10 : 0;

  let viabilidadeStatus: {
    status: 'VIAVEL' | 'APERTADA' | 'INVIAVEL' | 'SEM_VALOR';
    label: string;
    badgeClass: string;
    descricao: string;
  };

  if (valorEdital <= 0) {
    viabilidadeStatus = {
      status: 'SEM_VALOR',
      label: 'Valor a Definir',
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
      descricao: 'Edital oficial sem valor de referência divulgado. Necessário cotar itens unitários para estimar a margem.',
    };
  } else if (precoMinimoSustentavel > valorEdital || margemRealPercentual < 5) {
    viabilidadeStatus = {
      status: 'INVIAVEL',
      label: 'Inviável (Preço Mínimo Excede Teto)',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
      descricao: `Preço mínimo saudável (${formatCurrency(precoMinimoSustentavel)}) supera o teto oficial (${formatCurrency(valorEdital)}). Risco de prejuízo ou inexequibilidade.`,
    };
  } else if (margemRealPercentual < 12) {
    viabilidadeStatus = {
      status: 'APERTADA',
      label: 'Margem Apertada (Atenção a Custos)',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
      descricao: `Operação viável com margem líquida calculada em ${margemRealPercentual}%. Requer estrito controle de frete e despesas.`,
    };
  } else {
    viabilidadeStatus = {
      status: 'VIAVEL',
      label: 'Viável (Alta Atratividade)',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      descricao: `Margem saudável de ${margemRealPercentual}% líquido calculada dentro do teto oficial do certame.`,
    };
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <Link
        to="/fornecedor/radar"
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

      {licitacaoQuery.isError && (
        <div className="rounded-[28px] border border-gray-100 bg-white p-12 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-800">Edital não encontrado</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            O edital solicitado não foi localizado na base de dados ou na fonte oficial do governo (PNCP). Verifique o número de controle ou selecione outro certame.
          </p>
          <div className="mt-6">
            <Link
              to="/fornecedor/radar"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 transition-colors shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Radar
            </Link>
          </div>
        </div>
      )}

      {lic && (
        <>
          <section className="overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-xl shadow-[0_4px_20px_rgba(30,58,138,0.05)]">
            <div className="bg-white px-8 py-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                  Fonte: {lic.fonte || 'PNCP'}
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono font-bold text-slate-700">
                  ID: {(lic as any).numeroControlePNCP || lic.id}
                </span>
                <ScorePill score={lic.score} />
              </div>

              <h1 className="mt-4 max-w-4xl text-2xl font-bold leading-tight tracking-tight text-brand-blue md:text-3xl">
                {lic.objeto}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-blue/70">
                Tela focada em praticidade: análise de viabilidade com margem líquida real, resumo executivo, proposta comercial e acesso rápido à sala de lances.
              </p>
            </div>

            <div className="grid gap-4 border-t border-gray-100 p-8 md:grid-cols-5">
              <div className="rounded-[24px] border border-brand-blue/20 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand-blue" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue">Valor estimado</p>
                </div>
                <p className="text-lg font-bold text-brand-blue">
                  {formatCurrency(valorEdital)}
                  {isValorSigiloso && (
                    <span className="block text-[10px] font-bold text-amber-700 mt-0.5">
                      (Soma Real dos Itens do TR)
                    </span>
                  )}
                </p>
              </div>

              <div className={`rounded-[24px] border p-5 ${viabilidadeStatus.badgeClass}`}>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Viabilidade</p>
                </div>
                <p className="text-xs font-bold leading-tight">{viabilidadeStatus.label}</p>
                {valorEdital > 0 && (
                  <p className="text-[11px] font-semibold mt-1 opacity-80">
                    Mínimo: {formatCurrency(precoMinimoSustentavel)}
                  </p>
                )}
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-blue/70" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Abertura</p>
                </div>
                <p className="text-base font-bold text-brand-blue">{formatDate(lic.data_abertura)}</p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5 flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-blue/70" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue/70">Orgao</p>
                  </div>
                  <p className="text-base font-bold text-brand-blue truncate" title={lic.orgao}>{lic.orgao}</p>
                  {(lic.municipio || lic.uf) && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-brand-blue/70">
                      <MapPin className="h-3.5 w-3.5" />
                      {[lic.municipio, lic.uf].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  id="btn-investigar-historico-orgao-card"
                  onClick={handleInvestigarHistoricoOrgao}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue hover:text-brand-orange transition cursor-pointer"
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  Investigar Histórico do Órgão
                </button>
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
              {isInCrm ? (
                <Link
                  to="/fornecedor/disputas"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Na Gestão de Disputas
                </Link>
              ) : (
                <button
                  onClick={() => salvarCrmMutation.mutate()}
                  disabled={salvarCrmMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#0A2540] bg-[#0A2540] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#07192b] active:scale-95 disabled:opacity-50"
                >
                  {salvarCrmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Adicionar às Disputas
                </button>
              )}
              <button
                type="button"
                id="btn-investigar-historico-orgao-toolbar"
                onClick={handleInvestigarHistoricoOrgao}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-white px-5 py-3 text-sm font-bold text-brand-blue transition hover:bg-slate-50 hover:border-brand-blue/40 cursor-pointer"
              >
                <FileSearch className="h-4 w-4 text-brand-blue/70" />
                Investigar Histórico do Órgão
              </button>
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
                to={'/fornecedor/lex'}
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
                { id: 'viabilidade', label: 'Viabilidade & Precificação', color: 'bg-emerald-600 text-white' },
                { id: 'resumo', label: 'Resumo do edital', color: 'bg-brand-blue text-white' },
                { id: 'proposta', label: 'Proposta estrategica', color: 'bg-brand-blue text-white' },
                { id: 'impugnacao', label: 'Impugnacao', color: 'bg-brand-blue text-white' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`rounded-lg px-4 py-3 text-sm font-bold transition ${activeTab === tab.id
                      ? tab.color
                      : 'bg-white text-brand-blue/70 hover:bg-white'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'viabilidade' && (
            <section className="rounded-[28px] border border-gray-100 bg-white p-6 lg:p-8 shadow-sm shadow-[0_4px_20px_rgba(30,58,138,0.05)] space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-600">
                    <Calculator className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-brand-blue">Calculadora de Viabilidade Econômica</h2>
                    <p className="text-sm text-brand-blue/70">
                      Simulação determinística do Preço Mínimo Sustentável cruzando custos diretos, impostos e margem mínima.
                    </p>
                  </div>
                </div>

                <div className={`px-4 py-2 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center gap-2 ${viabilidadeStatus.badgeClass}`}>
                  <TrendingUp className="h-4 w-4" />
                  <span>{viabilidadeStatus.label}</span>
                </div>
              </div>

              {/* Grid: Parâmetros Reativos + Decomposição Financeira */}
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Coluna 1: Parâmetros da Empresa / Disputa */}
                <div className="space-y-5 rounded-[24px] border border-gray-100 bg-slate-50/50 p-6">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Parâmetros Operacionais da Sua Empresa
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Custo do Produto / Aquisição (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={custoProduto}
                        onChange={(e) => setCustoProdutoCustom(Math.max(0, Number(e.target.value)))}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-blue outline-none transition focus:border-brand-blue"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Custo de mercadoria junto ao fornecedor ou insumos.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Alíquota de Impostos (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          step="0.5"
                          value={aliquotaImpostos}
                          onChange={(e) => setAliquotaImpostosCustom(Math.max(0, Math.min(90, Number(e.target.value))))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-blue outline-none transition focus:border-brand-blue"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Simples (6-14%) ou Presumido (13-16%)</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Margem Mínima Alvo (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="80"
                          step="1"
                          value={margemDesejada}
                          onChange={(e) => setMargemDesejadaCustom(Math.max(1, Math.min(80, Number(e.target.value))))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-blue outline-none transition focus:border-brand-blue"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Retorno líquido pretendido</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Frete e Logística (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={custoFrete}
                          onChange={(e) => setCustoFreteCustom(Math.max(0, Number(e.target.value)))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-blue outline-none transition focus:border-brand-blue"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Taxas Administrativas (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={taxasAdm}
                          onChange={(e) => setTaxasAdmCustom(Math.max(0, Number(e.target.value)))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-blue outline-none transition focus:border-brand-blue"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCustoProdutoCustom(null);
                      setAliquotaImpostosCustom(null);
                      setCustoFreteCustom(null);
                      setTaxasAdmCustom(null);
                      setMargemDesejadaCustom(null);
                      toast.success('Parâmetros restaurados para os valores sugeridos do edital.');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-brand-blue transition underline mt-2"
                  >
                    Restaurar padrões sugeridos do edital
                  </button>
                </div>

                {/* Coluna 2: Decomposição e Resultado Determinístico */}
                <div className="space-y-6 flex flex-col justify-between">
                  <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                      Demonstrativo de Viabilidade Econômica
                    </h3>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-slate-600 font-semibold">Valor Estimado do Edital (Teto Máximo)</span>
                        <strong className="text-brand-blue">{formatCurrency(valorEdital)}</strong>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-100 text-rose-600">
                        <span>(-) Custo do Produto / Fornecimento</span>
                        <strong>{formatCurrency(custoProduto)}</strong>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-100 text-rose-600">
                        <span>(-) Impostos Fiscais ({aliquotaImpostos}%)</span>
                        <strong>{formatCurrency(impostosCalculados)}</strong>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-100 text-rose-600">
                        <span>(-) Logística e Taxas Operacionais</span>
                        <strong>{formatCurrency(custoFrete + taxasAdm)}</strong>
                      </div>

                      <div className="flex justify-between items-center py-3 border-t-2 border-dashed border-gray-200 font-bold">
                        <span className="text-slate-800">Preço Mínimo Saudável (Custo + Margem)</span>
                        <span className="text-base text-brand-orange">{formatCurrency(precoMinimoSustentavel)}</span>
                      </div>

                      <div className="flex justify-between items-center py-3 bg-emerald-50 rounded-xl px-4 border border-emerald-200">
                        <div>
                          <p className="text-xs uppercase tracking-wider font-black text-emerald-800">Margem Líquida Real</p>
                          <p className="text-[11px] text-emerald-700 font-semibold">{formatCurrency(saldoLiquido)}</p>
                        </div>
                        <span className="text-2xl font-black text-emerald-800">{margemRealPercentual.toFixed(1)}%</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed mt-2">{viabilidadeStatus.descricao}</p>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap items-center gap-3">
                    {isInCrm ? (
                      <Link
                        to="/fornecedor/disputas"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 shadow-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Na Gestão de Disputas
                      </Link>
                    ) : (
                      <button
                        onClick={() => salvarCrmMutation.mutate()}
                        disabled={salvarCrmMutation.isPending}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#0A2540] bg-[#0A2540] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#07192b] active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        {salvarCrmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Disputar / Adicionar à Esteira
                      </button>
                    )}

                    <button
                      type="button"
                      id="btn-gerar-proposta-comercial-viabilidade"
                      onClick={handleGerarPropostaComercial}
                      disabled={gerandoPropostaComercial}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
                    >
                      {gerandoPropostaComercial ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Gerar Proposta Comercial com Estes Preços
                    </button>
                  </div>
                </div>
              </div>

              {/* TABELA DE ITENS REAIS DO PNCP & PRECIFICAÇÃO DETERMINÍSTICA */}
              <div className="space-y-4 pt-6 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-brand-blue flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      Itens Oficiais da Contratação (PNCP) & Formação de Preço
                    </h3>
                    <p className="text-xs text-brand-blue/70">
                      Itens extraídos em tempo real do portal governamental e precificados com BDI, Split Payment e Stop-Loss.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 block">Total de Itens</span>
                    <span className="text-sm font-black text-brand-blue">
                      {itensEdital.length} {itensEdital.length === 1 ? 'item' : 'itens'} ({formatCurrency(somaValorItens || valorEdital)})
                    </span>
                  </div>
                </div>

                {itensQuery.isLoading ? (
                  <div className="rounded-2xl border border-gray-100 bg-slate-50/50 p-8 text-center">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-brand-blue" />
                    <p className="text-xs font-bold text-slate-500">Consultando itens oficiais no PNCP...</p>
                  </div>
                ) : itensEdital.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                    Nenhum item unitário individualizado retornado pelo PNCP. Consulte os anexos e o Termo de Referência.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-gray-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="py-3 px-3 w-12 text-center">#</th>
                          <th className="py-3 px-4 min-w-[220px]">Descrição do Item</th>
                          <th className="py-3 px-3 text-center w-24">Qtd / Un</th>
                          <th className="py-3 px-3 text-right w-28">Ref. PNCP</th>
                          <th className="py-3 px-3 text-right w-28">Total PNCP</th>
                          <th className="py-3 px-3 text-right w-28">Custo Base</th>
                          <th className="py-3 px-3 text-right w-28 text-rose-700">Stop-Loss</th>
                          <th className="py-3 px-3 text-right w-28 text-emerald-700">Preço Alvo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {itensEdital.map((it: any, idx: number) => {
                          const num = it.itemNumber || it.numeroItem || idx + 1;
                          const desc = it.descricao || it.description || 'Item da contratação';
                          const qtd = Number(it.quantidade ?? it.quantity ?? 1);
                          const un = it.unidadeMedida || it.unit || 'UN';
                          const vUnit = Number(it.valorUnitarioEstimado ?? it.estimatedUnitValue) || 0;
                          const vTot = Number(it.valorTotal ?? it.estimatedTotalValue) || (vUnit * qtd);
                          const custoBase = it.custoBase != null ? Number(it.custoBase) : (it.unitCost != null ? Number(it.unitCost) : null);
                          const stopLoss = it.precoMinimoStopLoss != null ? Number(it.precoMinimoStopLoss) : null;
                          const precoAlvo = it.precoAlvo != null ? Number(it.precoAlvo) : (vUnit > 0 ? vUnit : null);
                          const hasMatch = Boolean(it.matched);

                          return (
                            <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 font-mono font-bold text-slate-500 text-center">{num}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900 leading-snug">{desc}</div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {hasMatch ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Match: {it.catalogItem?.nome || 'Catálogo Ativo'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                      Item do Edital
                                    </span>
                                  )}
                                  {it.catalogoCodigo && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700">
                                      CAT: {it.catalogoCodigo}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-700">
                                {qtd} <span className="text-[10px] text-slate-400 font-semibold">{un}</span>
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-700">
                                {vUnit > 0 ? formatCurrency(vUnit) : 'Sigiloso'}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900">
                                {vTot > 0 ? formatCurrency(vTot) : 'Sigiloso'}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-700">
                                {custoBase != null && custoBase > 0 ? formatCurrency(custoBase) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-rose-600">
                                {stopLoss != null && stopLoss > 0 ? formatCurrency(stopLoss) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="py-3 px-3 text-right font-black text-emerald-700">
                                {precoAlvo != null && precoAlvo > 0 ? formatCurrency(precoAlvo) : <span className="text-slate-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'resumo' && (
            <section className="rounded-[28px] border border-gray-100 bg-white p-6 lg:p-8 shadow-sm space-y-8">
              {/* CABEÇALHO DO RESUMO ESTRATÉGICO */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-[#0A2540] text-white rounded-xl">
                      <Scale className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      Resumo Executivo Estratégico & Jurídico
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Análise sintetizada sob a égide da Nova Lei de Licitações (Lei Federal nº 14.133/2021).
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => resumoMutation.mutate()}
                    disabled={resumoMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0A2540] hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-sm disabled:opacity-60"
                  >
                    {resumoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                    {resumo ? 'Atualizar resumo' : 'Analisar edital'}
                  </button>
                </div>
              </div>

              {/* OS 3 PILARES OBRIGATÓRIOS DO RESUMO ESTRATÉGICO (LEI 14.133) */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* PILAR 1: OBJETO E AMPARO LEGAL */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <FileText className="h-4 w-4 text-[#EA580C]" />
                    Objeto e Amparo Legal
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 block">Amparo Normativo:</span>
                      <span className="inline-block mt-0.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 font-bold border border-blue-200">
                        {(lic as any).amparoLegal || 'Lei Federal nº 14.133/2021'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Modalidade de Contratação:</span>
                      <span>{lic.modalidade || 'Pregão Eletrônico (Art. 28, I)'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Órgão Convocador:</span>
                      <span>{lic.orgao} • {lic.municipio ? `${lic.municipio}/${lic.uf}` : lic.uf || 'Nacional'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Resumo do Objeto:</span>
                      <p className="line-clamp-4 text-slate-600 mt-0.5">{lic.objeto}</p>
                    </div>
                  </div>
                </div>

                {/* PILAR 2: CRITÉRIO DE JULGAMENTO & DINÂMICA */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <Scale className="h-4 w-4 text-[#0A2540]" />
                    Critério de Julgamento
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 block">Critério Oficial:</span>
                      <span className="inline-block mt-0.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        {(lic as any).criterioJulgamento || (lic as any).judgmentCriterion || 'Menor Preço Global / Por Item (Art. 33, I)'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Modo de Disputa:</span>
                      <span>{(lic as any).modoDisputa || (lic as any).modo_disputa || 'Aberto e Fechado (Art. 56)'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Sistema de Registro de Preços:</span>
                      <span>{(lic as any).srp ? 'Sim (Ata de Registro de Preços - SRP)' : 'Não (Contratação Direta/Específica)'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Teto Orçamentário Oficial:</span>
                      <strong className="text-sm text-slate-900">{formatCurrency(valorEdital)}</strong>
                    </div>
                  </div>
                </div>

                {/* PILAR 3: RISCOS E REQUISITOS DE HABILITAÇÃO */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Riscos & Habilitação (Art. 62 a 70)
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 block">Regularidade Fiscal e Trabalhista:</span>
                      <span>CND Federal, CNDT, FGTS e Fazenda Estadual/Municipal ativas.</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Qualificação Econômica:</span>
                      <span>Certidão de Falência e Recuperação Judicial negativa (Art. 69).</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Trava de Inexequibilidade:</span>
                      <span>Proibido lance abaixo do custo operacional (Art. 59, III).</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Prazos e Recursos:</span>
                      <span>Prazo de intenção de recurso em 3 dias úteis pós-julgamento (Art. 165).</span>
                    </div>
                  </div>
                </div>
              </div>

              {resumo && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
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

      {/* Modal de Conversão / Paywall para Usuários Gratuitos */}
      <PaywallModal
        isOpen={paywallAberto}
        onClose={() => setPaywallAberto(false)}
        moduleName="Dossiê de Concorrentes & Histórico do Órgão"
      />
    </div>
  );
}
