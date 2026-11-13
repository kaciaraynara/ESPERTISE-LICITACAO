import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Download,
  Plus,
  CheckCircle2,
  Gavel,
  Building2,
  MapPin,
  RefreshCw,
  Package,
  ShieldCheck,
  ListChecks,
  Calculator,
  ArrowRight,
} from 'lucide-react';
import { noticesApi, lexApi } from '../services/api';
import {
  buildOfficialPncpPortalUrl,
  handleDownloadEdital,
  formatCnpj,
} from '../utils/pncp';

export interface ResumoEditalItem {
  numeroItem?: number | string;
  itemNumber?: number | string;
  numero?: number | string;
  descricao?: string;
  description?: string;
  quantidade?: number | string;
  quantity?: number | string;
  unidade?: string;
  unidadeMedida?: string;
  valorReferencia?: number | string;
  valorUnitarioEstimado?: number | string;
  valorEstimadoUnitario?: number | string;
  valorTotal?: number | string;
  valorEstimadoTotal?: number | string;
}

export interface ResumoEditalData {
  id: string;
  objeto: string;
  orgao: string;
  cnpjOrgao?: string | null;
  cnpj?: string | null;
  uf?: string | null;
  municipio?: string | null;
  valorEstimado?: number | null;
  valor_estimado?: number | null;
  dataAbertura?: string | null;
  data_abertura?: string | null;
  dataEncerramento?: string | null;
  data_encerramento?: string | null;
  dataPublicacao?: string | null;
  data_publicacao?: string | null;
  modalidade?: string | null;
  modoDisputa?: string | null;
  criterioJulgamento?: string | null;
  numeroEdital?: string | null;
  numeroCompra?: string | null;
  processo?: string | null;
  numeroControlePNCP?: string | null;
  downloadUrl?: string | null;
  itens?: ResumoEditalItem[];
  items?: ResumoEditalItem[];
  anoCompra?: number | string;
  sequencialCompra?: number | string;
  informacaoComplementar?: string | null;
  amparoLegal?: string | null;
  exigenciasHabilitacao?: {
    balanco?: string | null;
    atestados?: string | null;
    certidoes?: string | null;
  };
}

interface ResumoEstrategicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  edital: ResumoEditalData | null;
  isSalvo?: boolean;
  isSalvando?: boolean;
  onSalvar?: (edital: ResumoEditalData) => void;
}

type ModalTab = 'dossie' | 'itens' | 'habilitacao' | 'etapas' | 'auditoria';

function formatBRL(valor?: number | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
    return 'Orçamento Sigiloso / Consolidado nos Itens';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor));
}

function formatPncpDateSafe(raw?: string | null, includeTime = true): string {
  if (!raw) return 'Ver no edital oficial';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Ver no edital oficial';

  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    normalized = `${trimmed}T12:00:00-03:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(trimmed)) {
    normalized = `${trimmed.slice(0, 10)}T12:00:00-03:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
    normalized = `${trimmed}-03:00`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return trimmed;

  const dataStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

  if (includeTime && (trimmed.includes('T') || trimmed.includes(':')) && !/^\d{4}-\d{2}-\d{2}T00:00:00/.test(trimmed)) {
    const horaStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
    return `${dataStr} às ${horaStr} (Brasília)`;
  }

  return dataStr;
}

function calcularPrazoImpugnacao(rawDataSessao?: string | null): string {
  if (!rawDataSessao) return 'Até 3 dias úteis antes da data de abertura (Art. 164 da Lei 14.133/2021)';
  const d = new Date(rawDataSessao);
  if (Number.isNaN(d.getTime())) return 'Até 3 dias úteis antes da abertura (Art. 164 da Lei 14.133/2021)';

  let diasUteis = 0;
  const limite = new Date(d.getTime());
  while (diasUteis < 3) {
    limite.setDate(limite.getDate() - 1);
    const dow = limite.getDay();
    if (dow !== 0 && dow !== 6) diasUteis++;
  }
  const dataFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(limite);
  return `Até ${dataFmt} às 23:59 (3 dias úteis antes — Art. 164 da Lei 14.133/2021)`;
}

export default function ResumoEstrategicoModal({
  isOpen,
  onClose,
  edital,
  isSalvo = false,
  isSalvando = false,
  onSalvar,
}: ResumoEstrategicoModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ModalTab>('dossie');
  const [detalhesCarregando, setDetalhesCarregando] = useState(false);
  const [criterioExtra, setCriterioExtra] = useState<string | null>(null);
  const [modoDisputaExtra, setModoDisputaExtra] = useState<string | null>(null);
  const [infoComplementarExtra, setInfoComplementarExtra] = useState<string | null>(null);
  const [amparoLegalExtra, setAmparoLegalExtra] = useState<string | null>(null);
  const [itensExtra, setItensExtra] = useState<ResumoEditalItem[]>([]);
  const [analiseProfunda, setAnaliseProfunda] = useState<string | null>(null);
  const [gerandoAnalise, setGerandoAnalise] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !edital?.id) {
      setCriterioExtra(null);
      setModoDisputaExtra(null);
      setInfoComplementarExtra(null);
      setAmparoLegalExtra(null);
      setItensExtra([]);
      setAnaliseProfunda(null);
      setActiveTab('dossie');
      return;
    }

    let active = true;
    setDetalhesCarregando(true);

    Promise.allSettled([
      noticesApi.getById(edital.id),
      noticesApi.getBasicSummary(edital.id),
      noticesApi.getItens(edital.id),
    ])
      .then(([detailRes, summaryRes, itensRes]) => {
        if (!active) return;

        if (detailRes.status === 'fulfilled') {
          const detail = detailRes.value?.data?.data || detailRes.value?.data;
          if (detail) {
            if (detail.judgmentCriterion || detail.criterioJulgamento) {
              setCriterioExtra(detail.judgmentCriterion || detail.criterioJulgamento);
            }
            if (detail.modoDisputa || detail.disputeMode) {
              setModoDisputaExtra(detail.modoDisputa || detail.disputeMode);
            }
            if (detail.informacaoComplementar || detail.metadata?.informacaoComplementar) {
              setInfoComplementarExtra(detail.informacaoComplementar || detail.metadata?.informacaoComplementar);
            }
            if (detail.amparoLegal || detail.metadata?.amparoLegalNome) {
              setAmparoLegalExtra(detail.amparoLegal || detail.metadata?.amparoLegalNome);
            }
            if (Array.isArray(detail.items) && detail.items.length > 0) {
              setItensExtra(detail.items);
            }
          }
        }

        if (summaryRes.status === 'fulfilled') {
          const summary = summaryRes.value?.data?.data || summaryRes.value?.data;
          if (summary) {
            if (!criterioExtra && summary.criterioJulgamento) {
              setCriterioExtra(summary.criterioJulgamento);
            }
            if (Array.isArray(summary.items) && summary.items.length > 0) {
              setItensExtra((prev) => (prev.length > 0 ? prev : summary.items));
            }
          }
        }

        if (itensRes.status === 'fulfilled') {
          const itens = itensRes.value?.data?.data || itensRes.value?.data;
          if (Array.isArray(itens) && itens.length > 0) {
            setItensExtra((prev) => (prev.length > 0 ? prev : itens));
          }
        }
      })
      .finally(() => {
        if (active) setDetalhesCarregando(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, edital?.id]);

  if (!isOpen || !edital) return null;

  const urlOficialPncp = buildOfficialPncpPortalUrl(edital);
  const numeroExibido =
    edital.numeroEdital ||
    edital.numeroCompra ||
    edital.processo ||
    edital.numeroControlePNCP ||
    edital.id;

  const cnpjFormatado = formatCnpj(edital.cnpjOrgao || edital.cnpj);
  const dataDivulgacao = formatPncpDateSafe(edital.dataPublicacao || edital.data_publicacao, false);
  const dataInicioPropostas = formatPncpDateSafe(edital.dataAbertura || edital.data_abertura, true);
  const dataEncerramentoSessao = formatPncpDateSafe(edital.dataEncerramento || edital.data_encerramento, true);
  const prazoImpugnacao = calcularPrazoImpugnacao(
    edital.dataEncerramento || edital.data_encerramento || edital.dataAbertura || edital.data_abertura
  );

  const itensExibidos =
    edital.itens && edital.itens.length > 0
      ? edital.itens
      : edital.items && edital.items.length > 0
        ? edital.items
        : itensExtra;

  const somaItensCalculada = itensExibidos.reduce((acc, item) => {
    const qtd = Number(item.quantidade ?? item.quantity ?? 1) || 1;
    const unit = Number(
      item.valorUnitarioEstimado ?? item.valorEstimadoUnitario ?? item.valorReferencia ?? 0
    );
    const tot = Number(item.valorTotal ?? item.valorEstimadoTotal ?? qtd * unit);
    return acc + (Number.isFinite(tot) && tot > 0 ? tot : 0);
  }, 0);

  const valorBrutoEdital = edital.valorEstimado ?? edital.valor_estimado;
  const valorEfetivo =
    valorBrutoEdital && Number(valorBrutoEdital) > 0
      ? Number(valorBrutoEdital)
      : somaItensCalculada > 0
        ? somaItensCalculada
        : null;

  const valorTotalRef = formatBRL(valorEfetivo);
  const modoDisputaExibido =
    modoDisputaExtra || edital.modoDisputa || 'Aberto / Fechado (Conforme Edital)';
  const criterioExibido =
    criterioExtra || edital.criterioJulgamento || 'Menor Preço / Maior Desconto';
  const modalidadeExibida = edital.modalidade || 'Pregão Eletrônico';
  const amparoExibido = amparoLegalExtra || edital.amparoLegal || 'Lei Federal nº 14.133/2021';
  const localizacaoExibida =
    [edital.municipio, edital.uf].filter(Boolean).join(' / ') || 'Âmbito Nacional';

  const executarAuditoriaIa = async () => {
    setGerandoAnalise(true);
    try {
      const res = await lexApi.resumo({ edital_id: edital.id });
      const data = res.data?.data;
      const texto =
        data?.visao_geral ||
        data?.resposta ||
        data?.content ||
        'Análise estruturada concluída com base nos dados oficiais do PNCP.';
      setAnaliseProfunda(String(texto));
    } catch {
      setAnaliseProfunda(
        `RESUMO TÉCNICO DO EDITAL (${numeroExibido}):\n\n` +
          `1. OBJETO INTEGRAL: ${edital.objeto}\n` +
          `2. ÓRGÃO CONTRATANTE: ${edital.orgao} (CNPJ: ${cnpjFormatado}) — ${localizacaoExibida}\n` +
          `3. MODALIDADE E REGIME: ${modalidadeExibida} | Modo de Disputa: ${modoDisputaExibido} | Critério: ${criterioExibido}\n` +
          `4. CRONOGRAMA OFICIAL (HORÁRIO DE BRASÍLIA):\n` +
          `   - Divulgação no PNCP: ${dataDivulgacao}\n` +
          `   - Início de Recebimento de Propostas: ${dataInicioPropostas}\n` +
          `   - Limite de Impugnação e Esclarecimentos: ${prazoImpugnacao}\n` +
          `   - Encerramento de Propostas / Abertura da Sessão: ${dataEncerramentoSessao}\n` +
          `5. ORÇAMENTO DE REFERÊNCIA: ${valorTotalRef} (${itensExibidos.length} itens vinculados no PNCP).`
      );
    } finally {
      setGerandoAnalise(false);
    }
  };

  const etapasLicitante = [
    {
      passo: '01',
      titulo: 'Leitura do Objeto e Prazo de Impugnação',
      prazo: prazoImpugnacao,
      descricao:
        'Confira a descrição integral de cada item no Termo de Referência. Caso identifique exigência restritiva (marca exclusiva sem justificativa, atestado acima de 50% ou prazo curto demais), protocole pedido de esclarecimento ou impugnação até 3 dias úteis antes da abertura (Art. 164 da Lei 14.133/2021).',
      acaoLabel: 'Abrir Impugnação / Esclarecimento',
      rota: `/fornecedor/impugnacao?edital=${encodeURIComponent(edital.id)}`,
    },
    {
      passo: '02',
      titulo: 'Conferência de Certidões e Documentos',
      prazo: `Antes de ${dataEncerramentoSessao}`,
      descricao:
        'Verifique a validade das 5 certidões obrigatórias (Federal, FGTS, Trabalhista, Estadual e Municipal), Contrato Social e Balanço Patrimonial dos 2 últimos exercícios.',
      acaoLabel: 'Conferir Certidões e Documentos',
      rota: '/fornecedor/certidoes',
    },
    {
      passo: '03',
      titulo: 'Formação de Preços, Impostos e Valor Mínimo',
      prazo: 'Etapa de Precificação',
      descricao:
        'Informe o custo do produto ou serviço, frete e os impostos da sua empresa para definir o Valor Mínimo Seguro e nunca dar lance com prejuízo.',
      acaoLabel: 'Calcular Preço Mínimo',
      rota: `/fornecedor/precificacao?edital=${encodeURIComponent(edital.id)}`,
    },
    {
      passo: '04',
      titulo: 'Montagem da Proposta Comercial e Declarações',
      prazo: `Enviar até ${dataEncerramentoSessao}`,
      descricao:
        'Monte a proposta comercial com os itens oficiais do edital e gere todas as declarações obrigatórias da Lei 14.133/2021 prontas para envio.',
      acaoLabel: 'Montar Proposta Comercial',
      rota: `/fornecedor/propostas?edital=${encodeURIComponent(edital.id)}`,
    },
    {
      passo: '05',
      titulo: 'Cadastro da Proposta no Portal Oficial',
      prazo: `De ${dataInicioPropostas} até ${dataEncerramentoSessao}`,
      descricao:
        'Acesse o portal eletrônico indicado no edital, cadastre os valores iniciais e anexe a documentação solicitada.',
      acaoLabel: 'Acessar Contratação no PNCP',
      externalUrl: urlOficialPncp,
    },
    {
      passo: '06',
      titulo: 'Disputa de Lances com Tela Espelhada',
      prazo: `Sessão em ${dataEncerramentoSessao}`,
      descricao:
        'Abra a Sala de Disputa com o Valor Mínimo travado, ative os lances automáticos por item e acompanhe o portal oficial na Tela Espelhada.',
      acaoLabel: 'Abrir Sala de Disputa',
      rota: `/fornecedor/disputa-ao-vivo?id=${encodeURIComponent(edital.id)}`,
    },
    {
      passo: '07',
      titulo: 'Envio da Proposta Final Vencedora',
      prazo: 'Em até 2h após convocação do Pregoeiro',
      descricao:
        'Encerrada a disputa em 1º lugar, baixe com 1 clique a Proposta Comercial Final (.DOCX) e a Planilha de Custos (.XLSX) ajustadas ao valor vencedor.',
      acaoLabel: 'Ver Gestão Pós-Vitória',
      rota: '/fornecedor/pos-vitoria',
    },
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/65 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="px-6 py-4 bg-white border-b border-slate-200 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                  <FileText className="w-3.5 h-3.5 text-brand-blue" />
                  Resumo Completo do Edital
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-brand-blue border border-blue-200">
                  {modalidadeExibida}
                </span>
                {detalhesCarregando && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Carregando itens e anexos...
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {edital.orgao || 'Órgão Licitante Oficial'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-medium text-slate-600 tabular-nums">
                <span className="font-mono font-semibold text-slate-800">
                  Edital / Compra: {numeroExibido}
                </span>
                <span>CNPJ: {cnpjFormatado}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {localizacaoExibida}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={urlOficialPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link-pncp text-xs font-bold px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span>Abrir no PNCP Oficial</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                aria-label="Fechar resumo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'dossie', label: '1. Resumo e Prazos', icon: FileText },
              { id: 'itens', label: `2. Itens e Preços (${itensExibidos.length})`, icon: Package },
              { id: 'habilitacao', label: '3. Documentos Exigidos', icon: ShieldCheck },
              { id: 'etapas', label: '4. Passo a Passo (7 Etapas)', icon: ListChecks },
              { id: 'auditoria', label: '5. Análise Completa', icon: Gavel },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as ModalTab);
                    if (tab.id === 'auditoria' && !analiseProfunda && !gerandoAnalise) {
                      void executarAuditoriaIa();
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'border-brand-blue text-brand-blue bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1 bg-white">
            {activeTab === 'dossie' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
                    <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                      Valor Total Estimado
                    </span>
                    <span className="text-base font-bold text-slate-900 mt-1 block">
                      {valorTotalRef}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {itensExibidos.length > 0 ? `${itensExibidos.length} itens vinculados` : 'Conforme edital'}
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
                    <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                      Divulgação no PNCP
                    </span>
                    <span className="text-sm font-bold text-slate-900 mt-1 block">
                      {dataDivulgacao}
                    </span>
                    <span className="text-[11px] text-slate-500">Publicação oficial</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
                    <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                      Início das Propostas
                    </span>
                    <span className="text-sm font-bold text-slate-900 mt-1 block">
                      {dataInicioPropostas}
                    </span>
                    <span className="text-[11px] text-slate-500">Abertura de cadastro</span>
                  </div>

                  <div className="border border-amber-200 rounded-xl p-3.5 bg-amber-50/50">
                    <span className="text-[11px] font-semibold uppercase text-amber-800 block">
                      Encerramento / Sessão
                    </span>
                    <span className="text-sm font-bold text-amber-950 mt-1 block">
                      {dataEncerramentoSessao}
                    </span>
                    <span className="text-[11px] text-amber-800">Horário oficial de Brasília</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                      <FileText className="w-4 h-4 text-brand-blue" />
                      <span>Descrição Integral do Objeto</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">{amparoExibido}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-line">
                    {edital.objeto
                      ? edital.objeto.trim()
                      : 'Consulte o Termo de Referência oficial para a especificação completa.'}
                  </p>
                  {(infoComplementarExtra || edital.informacaoComplementar) && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-700 block mb-1">
                        Informações Complementares:
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                        {infoComplementarExtra || edital.informacaoComplementar}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                      <Building2 className="w-4 h-4 text-brand-blue" />
                      <span>Dados do Órgão Comprador</span>
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <dt className="text-slate-500">Órgão / Entidade:</dt>
                        <dd className="font-semibold text-slate-900 text-right">{edital.orgao}</dd>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <dt className="text-slate-500">CNPJ do Órgão:</dt>
                        <dd className="font-mono font-semibold text-slate-900">{cnpjFormatado}</dd>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <dt className="text-slate-500">Município / UF:</dt>
                        <dd className="font-semibold text-slate-900">{localizacaoExibida}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">ID Controle PNCP:</dt>
                        <dd className="font-mono font-semibold text-slate-800">
                          {edital.numeroControlePNCP || edital.id}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                      <Gavel className="w-4 h-4 text-brand-orange" />
                      <span>Regras da Disputa e Prazos</span>
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <dt className="text-slate-500">Modalidade:</dt>
                        <dd className="font-semibold text-slate-900">{modalidadeExibida}</dd>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <dt className="text-slate-500">Modo de Disputa:</dt>
                        <dd className="font-semibold text-slate-900">{modoDisputaExibido}</dd>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <dt className="text-slate-500">Critério de Julgamento:</dt>
                        <dd className="font-semibold text-slate-900">{criterioExibido}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Prazo de Impugnação:</dt>
                        <dd className="font-semibold text-amber-800 text-right">{prazoImpugnacao}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'itens' && (
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                    <Package className="w-4 h-4 text-brand-blue" />
                    <span>Relação Completa de Itens</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    Total apurado: {valorTotalRef}
                  </span>
                </div>

                {itensExibidos.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse tabular-nums">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3">Item</th>
                          <th className="py-2.5 px-3 min-w-[260px]">Especificação</th>
                          <th className="py-2.5 px-3 text-center">Qtd / Unid.</th>
                          <th className="py-2.5 px-3 text-right">Vlr. Unitário Ref.</th>
                          <th className="py-2.5 px-3 text-right">Vlr. Total Ref.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {itensExibidos.map((item, idx) => {
                          const num = item.numeroItem ?? item.itemNumber ?? item.numero ?? idx + 1;
                          const desc = item.descricao ?? item.description ?? 'Item da contratação';
                          const qtd = item.quantidade ?? item.quantity ?? 1;
                          const unid = item.unidadeMedida ?? item.unidade ?? 'UN';
                          const vUnit = Number(
                            item.valorUnitarioEstimado ??
                              item.valorEstimadoUnitario ??
                              item.valorReferencia ??
                              0
                          );
                          const vTot = Number(
                            item.valorTotal ?? item.valorEstimadoTotal ?? Number(qtd) * vUnit
                          );
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono font-bold">{num}</td>
                              <td className="py-2.5 px-3 leading-relaxed">{desc}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {qtd} {unid}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {vUnit > 0 ? formatBRL(vUnit) : 'No edital'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-brand-blue whitespace-nowrap">
                                {vTot > 0 ? formatBRL(vTot) : 'No edital'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Este órgão publicou os itens consolidados diretamente no arquivo PDF do edital.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDownloadEdital(edital)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-blue text-white text-xs font-bold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Termo de Referência Oficial
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'habilitacao' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-900">
                    1. Habilitação Jurídica (Art. 66, Lei 14.133/2021)
                  </h3>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                    <li>Contrato Social, Estatuto ou Requerimento de Empresário consolidado em vigor.</li>
                    <li>Compatibilidade do CNAE com o objeto licitado ({edital.objeto.slice(0, 70)}...).</li>
                    <li>Documento oficial com foto dos sócios/administradores ou procuração.</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-900">
                    2. Regularidade Fiscal, Social e Trabalhista (Art. 68)
                  </h3>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                    <li>Comprovante de Inscrição no CNPJ ativo e regularidade no SICAF.</li>
                    <li>CND Conjunta Federal (Receita Federal e Dívida Ativa da União / PGFN).</li>
                    <li>Certidão de Regularidade do FGTS (CRF) e CNDT Trabalhista.</li>
                    <li>Certidões Negativas Estadual e Municipal da sede da empresa.</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-900">
                    3. Qualificação Econômico-Financeira (Art. 69)
                  </h3>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                    <li>Certidão Negativa de Falência expedida pelo distribuidor da sede.</li>
                    <li>Balanço Patrimonial e DRE dos 2 últimos exercícios sociais (Art. 69, I).</li>
                    <li>Índices de liquidez exigidos no edital (quando aplicável).</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-900">
                    4. Qualificação Técnica e Declarações (Art. 67)
                  </h3>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                    <li>Atestado(s) de Capacidade Técnica compatível com o objeto (vedada exigência superior a 50% — Art. 67, § 2º).</li>
                    <li>Declarações obrigatórias de habilitação, não emprego de menores (Art. 7º, XXXIII) e reserva de cargos.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'etapas' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    Siga este roteiro de 7 etapas na ordem abaixo para preparar, precificar e disputar este edital com segurança:
                  </p>
                </div>

                <div className="space-y-2.5">
                  {etapasLicitante.map((etapa) => (
                    <div
                      key={etapa.passo}
                      className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[11px] font-bold">
                            ETAPA {etapa.passo}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {etapa.titulo}
                          </h4>
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            {etapa.prazo}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {etapa.descricao}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {etapa.externalUrl ? (
                          <a
                            href={etapa.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800"
                          >
                            {etapa.acaoLabel}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              if (etapa.rota) navigate(etapa.rota);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-blue hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                          >
                            <span>{etapa.acaoLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'auditoria' && (
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Análise Completa do Edital
                    </h3>
                    <p className="text-xs text-slate-500">
                      Baseada nos dados, itens e anexos oficiais sincronizados com o PNCP.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void executarAuditoriaIa()}
                    disabled={gerandoAnalise}
                    className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {gerandoAnalise ? 'Processando leitura...' : 'Atualizar Análise'}
                  </button>
                </div>

                {gerandoAnalise ? (
                  <div className="py-12 text-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-blue mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      Extraindo informações completas do edital...
                    </p>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {analiseProfunda}
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadEdital(edital)}
                className="btn-download-edital inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-800 hover:bg-white text-xs font-bold rounded-full transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Edital / Anexos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/fornecedor/precificacao?edital=${encodeURIComponent(edital.id)}`);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-full transition-all cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-brand-blue" />
                <span>Calcular Preço</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-xs font-bold text-slate-600 hover:bg-white rounded-full transition-colors cursor-pointer"
              >
                Fechar
              </button>

              {onSalvar && (
                <button
                  type="button"
                  onClick={() => onSalvar(edital)}
                  disabled={isSalvo || isSalvando}
                  className={`inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-bold rounded-full transition-all border ${
                    isSalvo
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                      : 'bg-brand-orange text-white hover:bg-orange-600 border-transparent shadow-xs cursor-pointer'
                  }`}
                >
                  {isSalvando ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isSalvo ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Salvo</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Salvar p/ Proposta e Disputa</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}