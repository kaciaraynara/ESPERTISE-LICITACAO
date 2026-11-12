import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Clock,
  Download,
  Plus,
  CheckCircle2,
  DollarSign,
  Gavel,
  Building2,
  MapPin,
  RefreshCw,
  Package,
  Printer,
  ExternalLink,
  ShieldCheck,
  Scale,
  ListOrdered,
  AlertTriangle,
  FolderCheck,
  Calculator,
  FileCheck,
  Send,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { noticesApi } from '../services/api';
import {
  buildOfficialPncpPortalUrl,
  handleDownloadEdital,
  formatCnpj,
  formatPncpDateBR,
} from '../utils/pncp';

export interface ResumoEditalItem {
  numeroItem?: number | string;
  itemNumber?: number | string;
  numero?: number | string;
  descricao?: string;
  description?: string;
  quantidade?: number | string;
  quantity?: number | string;
  unidadeMedida?: string;
  unidade?: string;
  unit?: string;
  valorReferencia?: number | string;
  valorUnitarioEstimado?: number | string;
  valorTotal?: number | string;
  valorTotalEstimado?: number | string;
  participacao?: string;
  codigoItemCatalogo?: string;
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
  valorTotalEstimado?: number | null;
  dataAbertura?: string | null;
  data_abertura?: string | null;
  dataAberturaProposta?: string | null;
  dataInicioRecebimento?: string | null;
  dataEncerramento?: string | null;
  data_encerramento?: string | null;
  dataEncerramentoProposta?: string | null;
  dataLimiteProposta?: string | null;
  dataFimRecebimento?: string | null;
  dataPublicacao?: string | null;
  data_publicacao?: string | null;
  dataPublicacaoPncp?: string | null;
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

function formatBRL(valor?: number | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
    return 'Valor consolidado no TR';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor));
}

type TabType = 'visao' | 'itens' | 'habilitacao' | 'passo_a_passo' | 'analise';

export default function ResumoEstrategicoModal({
  isOpen,
  onClose,
  edital,
  isSalvo = false,
  isSalvando = false,
  onSalvar,
}: ResumoEstrategicoModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('visao');
  const [detalhesCarregando, setDetalhesCarregando] = useState(false);
  const [criterioExtra, setCriterioExtra] = useState<string | null>(null);
  const [modoDisputaExtra, setModoDisputaExtra] = useState<string | null>(null);
  const [itensExtra, setItensExtra] = useState<ResumoEditalItem[]>([]);
  const [dossier, setDossier] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Fecha com tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Busca detalhes adicionais do edital via API se existirem
  useEffect(() => {
    if (!isOpen || !edital?.id) {
      setCriterioExtra(null);
      setModoDisputaExtra(null);
      setItensExtra([]);
      setDossier(null);
      setSummaryData(null);
      setActiveTab('visao');
      return;
    }

    let active = true;
    setDetalhesCarregando(true);

    Promise.allSettled([
      noticesApi.getById(edital.id),
      noticesApi.getBasicSummary(edital.id),
      noticesApi.getSummary(edital.id),
      noticesApi.getItens(edital.id),
    ])
      .then(([detailRes, basicRes, summaryRes, itensRes]) => {
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
            if (Array.isArray(detail.items) && detail.items.length > 0) {
              setItensExtra(detail.items);
            }
            if (detail.dossier) {
              setDossier(detail.dossier);
            }
          }
        }

        if (basicRes.status === 'fulfilled') {
          const basic = basicRes.value?.data?.data || basicRes.value?.data;
          if (basic) {
            if (basic.dossier) {
              setDossier((prev: any) => prev || basic.dossier);
            }
            if (Array.isArray(basic.items) && basic.items.length > 0) {
              setItensExtra((prev) => (prev.length > 0 ? prev : basic.items));
            }
          }
        }

        if (summaryRes.status === 'fulfilled') {
          const sum = summaryRes.value?.data?.data || summaryRes.value?.data;
          if (sum) {
            setSummaryData(sum);
            if (sum.dossier) {
              setDossier((prev: any) => sum.dossier || prev);
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
      .catch(() => {
        // Falhas não bloqueiam a visualização do resumo
      })
      .finally(() => {
        if (active) setDetalhesCarregando(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, edital?.id]);

  if (!isOpen || !edital) return null;

  const urlOficialPncp = dossier?.fichaTecnica?.linkOficialPncp || buildOfficialPncpPortalUrl(edital);

  const numeroExibido =
    dossier?.fichaTecnica?.numeroEdital ||
    edital.numeroEdital ||
    edital.numeroCompra ||
    edital.processo ||
    edital.numeroControlePNCP ||
    edital.id;

  const cnpjFormatado = dossier?.fichaTecnica?.cnpjFormatado || formatCnpj(edital.cnpjOrgao || edital.cnpj);

  const rawItens = (edital.itens && edital.itens.length > 0)
    ? edital.itens
    : (edital.items && edital.items.length > 0)
      ? edital.items
      : itensExtra;

  const itensExibidos = (dossier?.quadroItensDetalhado && dossier.quadroItensDetalhado.length > 0)
    ? dossier.quadroItensDetalhado
    : rawItens;

  // Cálculo automático da soma dos itens quando valorEstimado for null ou <= 0
  const totalItensCalculado = itensExibidos.reduce((acc: number, it: any) => {
    const valTotal = Number(it.valorTotalEstimado ?? it.valorTotal);
    if (Number.isFinite(valTotal) && valTotal > 0) {
      return acc + valTotal;
    }
    const valUnit = Number(it.valorUnitarioEstimado ?? it.valorReferencia);
    const qtd = Number(it.quantidade ?? it.quantity ?? 1);
    if (Number.isFinite(valUnit) && valUnit > 0 && Number.isFinite(qtd) && qtd > 0) {
      return acc + (valUnit * qtd);
    }
    return acc;
  }, 0);

  const valorEstimadoBase = dossier?.fichaTecnica?.valorGlobalEstimado ?? edital.valorTotalEstimado ?? edital.valorEstimado ?? edital.valor_estimado;
  const temValorEstimadoBase = valorEstimadoBase !== undefined && valorEstimadoBase !== null && Number.isFinite(Number(valorEstimadoBase)) && Number(valorEstimadoBase) > 0;

  const valorFinal = temValorEstimadoBase
    ? Number(valorEstimadoBase)
    : (totalItensCalculado > 0 ? totalItensCalculado : null);

  const valorTotalRef = valorFinal !== null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFinal)
    : 'Sigiloso / Ver Itens no TR';

  // Datas oficiais
  const rawPublicacao =
    dossier?.cronogramaPrazosFatais?.publicacao ||
    edital.dataPublicacao ||
    edital.data_publicacao ||
    edital.dataPublicacaoPncp;

  const rawInicio =
    dossier?.cronogramaPrazosFatais?.inicioPropostas ||
    edital.dataAberturaProposta ||
    edital.dataInicioRecebimento ||
    edital.dataAbertura ||
    edital.data_abertura;

  const rawEncerramento =
    dossier?.cronogramaPrazosFatais?.encerramentoPropostas ||
    edital.dataEncerramentoProposta ||
    edital.dataLimiteProposta ||
    edital.dataFimRecebimento ||
    edital.dataEncerramento ||
    edital.data_encerramento;

  const dataPublicacaoPncp = rawPublicacao ? formatPncpDateBR(rawPublicacao, false) : '—';
  const dataInicioPropostas = rawInicio ? formatPncpDateBR(rawInicio, true) : 'Ver no edital';
  const dataLimiteEnvio = rawEncerramento ? formatPncpDateBR(rawEncerramento, true) : 'Conforme cronograma';

  const prazoImpugnacaoCalculado = dossier?.cronogramaPrazosFatais?.prazoLimiteImpugnacao
    ? formatPncpDateBR(dossier.cronogramaPrazosFatais.prazoLimiteImpugnacao, true)
    : 'Até 3 dias úteis antes da abertura (Art. 164, Lei 14.133/21)';

  const diasUteisRestantesImpugnacao = dossier?.cronogramaPrazosFatais?.diasUteisRestantesImpugnacao;
  const impugnacaoExpirada = dossier?.cronogramaPrazosFatais?.impugnacaoExpirada;

  const modoDisputaExibido =
    dossier?.fichaTecnica?.modoDisputa ||
    modoDisputaExtra ||
    edital.modoDisputa ||
    'Aberto / Fechado';

  const criterioJulgamentoExibido =
    dossier?.fichaTecnica?.criterioJulgamento ||
    criterioExtra ||
    edital.criterioJulgamento ||
    'Menor Preço';

  const modalidadeExibida = dossier?.fichaTecnica?.modalidade || edital.modalidade || 'Pregão Eletrônico';
  const localizacaoExibida = dossier?.fichaTecnica?.municipioUf || [edital.municipio, edital.uf].filter(Boolean).join(' - ') || 'Âmbito Nacional';

  const objetoTextoIntegral = dossier?.descricaoExplicativaObjeto?.objetoIntegral || edital.objeto || 'Consulte os anexos do certame para descrição detalhada.';

  const dispararDownloadSeguro = () => {
    void handleDownloadEdital(edital);
  };

  const dispararImpressao = () => {
    window.print();
  };

  const noticeTargetId = edital.id;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* CABEÇALHO SUPERIOR */}
          <header className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/20 border-b border-slate-200 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-brand-blue/20">
                  <FileText className="w-3.5 h-3.5" />
                  Dossiê Executivo do Edital
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Lei 14.133/2021
                </span>
                {detalhesCarregando && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sincronizando dados oficiais…
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#0B192C] leading-snug">
                {edital.orgao || 'Órgão Licitante'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-semibold text-slate-500">
                <span className="font-mono text-slate-700">Edital nº {numeroExibido}</span>
                <span className="font-mono text-slate-600">CNPJ: {cnpjFormatado}</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {localizacaoExibida}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={dispararImpressao}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Imprimir ou salvar PDF do Dossiê Completo"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Dossiê</span>
              </button>

              <a
                href={urlOficialPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link-pncp inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                title="Auditar contratação e autos diretamente no portal oficial do PNCP"
              >
                <span>Portal PNCP</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Fechar janela"
                aria-label="Fechar resumo estratégico"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* BARRA DE NAVEGAÇÃO DE ABAS */}
          <nav className="px-6 bg-slate-50/70 border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('visao')}
              className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${activeTab === 'visao'
                  ? 'border-brand-blue text-brand-blue bg-white shadow-2xs font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Visão Completa & Objeto</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('itens')}
              className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${activeTab === 'itens'
                  ? 'border-brand-blue text-brand-blue bg-white shadow-2xs font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Itens & Preços ({itensExibidos.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('habilitacao')}
              className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${activeTab === 'habilitacao'
                  ? 'border-brand-blue text-brand-blue bg-white shadow-2xs font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Habilitação Exigida</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('passo_a_passo')}
              className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${activeTab === 'passo_a_passo'
                  ? 'border-brand-blue text-brand-blue bg-white shadow-2xs font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Roteiro de Disputa (7 Etapas)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analise')}
              className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${activeTab === 'analise'
                  ? 'border-brand-blue text-brand-blue bg-white shadow-2xs font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Auditoria e Alertas</span>
            </button>
          </nav>

          {/* CORPO DO MODAL */}
          <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
            {/* ABA 1: VISÃO COMPLETA & OBJETO */}
            {activeTab === 'visao' && (
              <div className="space-y-5">
                {/* 1. OBJETO INTEGRAL DA CONTRATAÇÃO (SEM LINE CLAMP!) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                      <FileText className="w-4 h-4 text-brand-blue" />
                      <span>Objeto Integral da Contratação (Termo de Referência)</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">Texto Oficial</span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-line">
                    {objetoTextoIntegral}
                  </p>
                  {dossier?.descricaoExplicativaObjeto?.informacaoComplementar && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
                      <span className="font-bold text-slate-700">Informações Complementares: </span>
                      {dossier.descricaoExplicativaObjeto.informacaoComplementar}
                    </div>
                  )}
                </div>

                {/* 2. FICHA TÉCNICA E CRONOGRAMA EM 2 COLUNAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FICHA TÉCNICA DO CERTAME */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0B192C]">
                      <Building2 className="w-4 h-4 text-brand-blue" />
                      <span>Ficha Técnica do Certame</span>
                    </div>
                    <div className="space-y-2 text-xs divide-y divide-slate-100">
                      <div className="pt-1 first:pt-0">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Órgão Comprador</span>
                        <span className="font-semibold text-slate-800">{edital.orgao || 'Administração Pública'}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">CNPJ Oficial</span>
                        <span className="font-mono font-bold text-slate-800">{cnpjFormatado}</span>
                      </div>
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modalidade</span>
                          <span className="font-semibold text-slate-800">{modalidadeExibida}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modo de Disputa</span>
                          <span className="font-semibold text-slate-800">{modoDisputaExibido}</span>
                        </div>
                      </div>
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Critério de Julgamento</span>
                          <span className="font-semibold text-slate-800">{criterioJulgamentoExibido}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Regime / SRP</span>
                          <span className="font-semibold text-slate-800">{dossier?.fichaTecnica?.regimeExecucaoOuSrp || 'Fornecimento Ordinário'}</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Amparo Legal</span>
                        <span className="font-semibold text-slate-700">{dossier?.fichaTecnica?.amparoLegal || 'Lei nº 14.133/2021'}</span>
                      </div>
                    </div>
                  </div>

                  {/* CRONOGRAMA E PRAZOS FATAIS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0B192C]">
                      <Clock className="w-4 h-4 text-brand-orange" />
                      <span>Cronograma & Prazos Fatais</span>
                    </div>
                    <div className="space-y-2 text-xs divide-y divide-slate-100">
                      <div className="pt-1 first:pt-0">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Divulgação no PNCP</span>
                        <span className="font-semibold text-slate-700">{dataPublicacaoPncp}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Início de Recebimento de Propostas</span>
                        <span className="font-semibold text-slate-800">{dataInicioPropostas}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Limite de Envio / Abertura da Sessão</span>
                        <span className="font-bold text-brand-blue flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                          {dataLimiteEnvio}
                        </span>
                      </div>
                      <div className="pt-2 bg-amber-50/60 rounded-lg p-2.5 border border-amber-200/80">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-amber-900 text-[10px] uppercase font-black tracking-wider flex items-center gap-1">
                            <Scale className="w-3.5 h-3.5 text-amber-700" />
                            Prazo Limite para Impugnação (Art. 164)
                          </span>
                          {diasUteisRestantesImpugnacao !== undefined && diasUteisRestantesImpugnacao !== null && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${impugnacaoExpirada ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>
                              {impugnacaoExpirada ? 'Encerrado' : `${diasUteisRestantesImpugnacao} dias úteis restantes`}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 block text-xs">
                          {prazoImpugnacaoCalculado}
                        </span>
                        <p className="text-[10px] text-amber-800/90 mt-1">
                          Conforme a Lei 14.133/21, petições de impugnação ou esclarecimento devem ser protocoladas até 3 dias úteis antes da abertura.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. VALOR TOTAL DE REFERÊNCIA & BOTÕES DE AÇÃO RÁPIDA */}
                <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/40 border border-blue-200/80 rounded-xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
                      Valor Total de Referência Estimado
                      {!temValorEstimadoBase && totalItensCalculado > 0 && (
                        <span className="ml-2 text-brand-blue font-bold lowercase">(soma calculada dos itens oficiais)</span>
                      )}
                    </span>
                    <p className="text-2xl font-black text-brand-blue">
                      {valorTotalRef}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {temValorEstimadoBase ? 'Valor oficial estimado pelo órgão licitante' : 'Consulte a composição unitária na aba de Itens'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/precificacao?edital=${noticeTargetId}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Simular Precificação</span>
                    </a>
                    <a
                      href={`/propostas/criar?edital=${noticeTargetId}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Gerar Proposta</span>
                    </a>
                  </div>
                </div>

                {/* 4. ARQUIVOS OFICIAIS DO PNCP */}
                {dossier?.arquivosOficiaisPncp && dossier.arquivosOficiaisPncp.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                      <Download className="w-4 h-4 text-brand-blue" />
                      <span>Arquivos e Documentos Oficiais ({dossier.arquivosOficiaisPncp.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dossier.arquivosOficiaisPncp.map((arq: any, idx: number) => (
                        <a
                          key={idx}
                          href={arq.urlDownload || urlOficialPncp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-brand-blue hover:bg-blue-50/30 transition-all text-xs group"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-800 block truncate group-hover:text-brand-blue">
                              {arq.titulo}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {arq.tipoDocumentoNome || 'Anexo do Edital'}
                            </span>
                          </div>
                          <Download className="w-4 h-4 text-slate-400 group-hover:text-brand-blue shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: ITENS & PREÇOS */}
            {activeTab === 'itens' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-brand-blue" />
                      Quadro de Itens Catalogados ({itensExibidos.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Relação de produtos e serviços licitados com quantidades e valores de referência.
                    </p>
                  </div>
                  <a
                    href={`/precificacao?edital=${noticeTargetId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Calcular Preço Stop-Loss</span>
                  </a>
                </div>

                {itensExibidos.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 whitespace-nowrap text-center">Item</th>
                          <th className="py-2.5 px-3 min-w-[240px]">Descrição Completa</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-center">Qtd. / Unid.</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor Unit. Est.</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor Total Est.</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-center">Participação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium bg-white">
                        {itensExibidos.map((item: any, idx: number) => {
                          const num = item.numeroItem ?? item.itemNumber ?? item.numero ?? idx + 1;
                          const desc = item.descricaoCompleta ?? item.descricao ?? item.description ?? 'Item da contratação';
                          const qtd = item.quantidade ?? item.quantity ?? 1;
                          const unid = item.unidadeMedida ?? item.unidade ?? item.unit ?? 'UN';
                          const vUnit = Number(item.valorUnitarioEstimado ?? item.valorReferencia);
                          const vTot = Number(item.valorTotalEstimado ?? item.valorTotal);
                          const part = item.participacao ?? 'Ampla Concorrência';

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 font-mono font-bold text-slate-800 text-center">{num}</td>
                              <td className="py-3 px-3 leading-relaxed text-slate-800">
                                <span className="font-semibold block">{desc}</span>
                                {item.codigoCatalogo && (
                                  <span className="text-[10px] text-slate-400 font-mono">CATMAT: {item.codigoCatalogo}</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap font-semibold">
                                {qtd} <span className="text-slate-400 text-[10px] font-normal">{unid}</span>
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-slate-700">
                                {formatBRL(vUnit)}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-brand-blue">
                                {formatBRL(vTot > 0 ? vTot : (vUnit > 0 && qtd > 0 ? vUnit * qtd : null))}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {part}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <Package className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Valores globais consolidados no Termo de Referência oficial
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Este certame foi publicado com valores por lote global ou orçamento sigiloso. Consulte os arquivos do edital.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: HABILITAÇÃO EXIGIDA */}
            {activeTab === 'habilitacao' && (
              <div className="space-y-4">
                <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-black text-brand-blue text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-blue" />
                      Requisitos de Habilitação da Lei nº 14.133/2021 (Arts. 62 a 70)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Verifique a documentação necessária para não ser inabilitado sumariamente na sessão.
                    </p>
                  </div>
                  <a
                    href="/cofre"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-blue hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>Conferir no Cofre</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* HABILITAÇÃO JURÍDICA */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0B192C] uppercase tracking-wider flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-brand-blue" />
                        Habilitação Jurídica
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Art. 66</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                      <li>Registro comercial ou Contrato Social consolidado em vigor;</li>
                      <li>Inscrição no CNPJ ativa e regular;</li>
                      <li>Decreto de autorização (quando se tratar de empresa estrangeira);</li>
                      <li>Procuração do representante legal credenciado para assinar a proposta.</li>
                    </ul>
                  </div>

                  {/* REGULARIDADE FISCAL E TRABALHISTA */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0B192C] uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Regularidade Fiscal & Trabalhista
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Art. 68</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                      <li>Certidão Conjunta Negativa Federal (Receita Federal / PGFN);</li>
                      <li>Certificado de Regularidade do FGTS (CRF Caixa);</li>
                      <li>Certidão Negativa de Débitos Trabalhistas (CNDT);</li>
                      <li>Certidão de Regularidade perante a Fazenda Estadual;</li>
                      <li>Certidão de Regularidade perante a Fazenda Municipal da sede.</li>
                    </ul>
                  </div>

                  {/* QUALIFICAÇÃO ECONÔMICO-FINANCEIRA */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0B192C] uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-brand-orange" />
                        Qualificação Econômico-Financeira
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Art. 69</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                      <li>Balanço Patrimonial e DRE do último exercício social exigível;</li>
                      <li>Comprovação de índices contábeis (LG, SG, LC superiores ou iguais a 1,0);</li>
                      <li>Certidão Negativa de Falência e Recuperação Judicial;</li>
                      <li>Patrimônio Líquido mínimo (máximo legal de 10% do valor estimado).</li>
                    </ul>
                  </div>

                  {/* QUALIFICAÇÃO TÉCNICA */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0B192C] uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                        Qualificação Técnica
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Art. 67</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                      <li>Atestado(s) de Capacidade Técnica (CAT) compatível(is) em quantidade e prazo;</li>
                      <li>Registro ou inscrição na entidade profissional competente (quando aplicável);</li>
                      <li>Declaração de conhecimento das condições locais de fornecimento ou execução.</li>
                    </ul>
                  </div>
                </div>

                {/* DECLARAÇÕES OBRIGATÓRIAS */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="font-black text-xs text-slate-800 uppercase tracking-wider block">
                    Declarações Obrigatórias do Licitante
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Declaração de não emprego de menores (Art. 7º, XXXIII da CF/88);</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Declaração de inexistência de fatos impeditivos da habilitação;</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Declaração de elaboração independente de proposta;</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Declaração de enquadramento ME/EPP para obtenção do benefício da LC 123/06.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 4: ROTEIRO DE DISPUTA (7 ETAPAS) */}
            {activeTab === 'passo_a_passo' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 p-4 rounded-xl">
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-brand-blue" />
                    Passo a Passo Estruturado para Disputar e Vencer (7 Etapas)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Siga o roteiro operacional da plataforma para preparar propostas competitivas e seguras.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      etapa: 1,
                      titulo: 'Etapa 1 - Leitura Crítica e Diagnóstico de Riscos',
                      desc: 'Analise o edital no Leitor Inteligente para identificar cláusulas restritivas, prazos e penalidades.',
                      rota: `/leitor-editais?edital=${noticeTargetId}`,
                      btnTexto: 'Abrir Leitor de Editais',
                      icone: FileText,
                    },
                    {
                      etapa: 2,
                      titulo: 'Etapa 2 - Conferência Documental no Cofre',
                      desc: 'Confira a validade das 5 certidões obrigatórias e do Balanço Patrimonial antes do credenciamento.',
                      rota: '/cofre',
                      btnTexto: 'Verificar Certidões no Cofre',
                      icone: FolderCheck,
                    },
                    {
                      etapa: 3,
                      titulo: 'Etapa 3 - Formulação de Impugnação ou Esclarecimento',
                      desc: 'Se encontrar exigências ilegais ou omissões, protocole impugnação em até 3 dias úteis antes da abertura.',
                      rota: `/impugnacao?edital=${noticeTargetId}`,
                      btnTexto: 'Elaborar Impugnação',
                      icone: Scale,
                    },
                    {
                      etapa: 4,
                      titulo: 'Etapa 4 - Formação de Custos e Precificação Estratégica',
                      desc: 'Simule custos, margens e determine o Preço Stop-Loss (preço mínimo seguro) para a disputa.',
                      rota: `/precificacao?edital=${noticeTargetId}`,
                      btnTexto: 'Simular Precificação',
                      icone: Calculator,
                    },
                    {
                      etapa: 5,
                      titulo: 'Etapa 5 - Geração e Validação da Proposta Comercial',
                      desc: 'Emita a proposta formal detalhada com prazos, marcas, modelos e declarações obrigatórias.',
                      rota: `/propostas/criar?edital=${noticeTargetId}`,
                      btnTexto: 'Criar Proposta Oficial',
                      icone: FileCheck,
                    },
                    {
                      etapa: 6,
                      titulo: 'Etapa 6 - Cadastro no Portal Oficial do Certame',
                      desc: 'Envie a proposta eletrônica e os documentos de habilitação no sistema oficial até o horário limite.',
                      rota: urlOficialPncp,
                      externo: true,
                      btnTexto: 'Acessar Portal do Certame ↗',
                      icone: Send,
                    },
                    {
                      etapa: 7,
                      titulo: 'Etapa 7 - Sessão Pública de Lances e Fase Recursal',
                      desc: 'Dispute lances respeitando o stop-loss e esteja pronto para interpor recurso contra irregularidades.',
                      rota: `/disputa?edital=${noticeTargetId}`,
                      btnTexto: 'Entrar na Sala de Disputa',
                      icone: Gavel,
                    },
                  ].map((step) => {
                    const StepIcon = step.icone;
                    return (
                      <div
                        key={step.etapa}
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-blue-50 text-brand-blue rounded-lg font-black text-xs shrink-0 mt-0.5">
                            <StepIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                              {step.titulo}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                              {step.desc}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 self-end sm:self-center">
                          {step.externo ? (
                            <a
                              href={step.rota}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                            >
                              <span>{step.btnTexto}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <a
                              href={step.rota}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-brand-blue hover:text-white text-slate-800 rounded-lg text-xs font-bold transition-all"
                            >
                              <span>{step.btnTexto}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ABA 5: AUDITORIA E ALERTAS */}
            {activeTab === 'analise' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-blue" />
                    Diagnóstico Estruturado e Alertas Operacionais
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Avaliação automática de completude, conformidade e prazos críticos gerados pelo motor determinístico.
                  </p>
                </div>

                {/* ALERTAS OPERACIONAIS */}
                {summaryData?.alerts && summaryData.alerts.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider block">
                      Pontos de Atenção Identificados
                    </span>
                    <div className="space-y-2">
                      {summaryData.alerts.map((al: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">{al.message}</span>
                            {al.daysRemaining !== undefined && (
                              <span className="text-[11px] text-amber-700">
                                Prazo operacional de apenas {al.daysRemaining} dia(s).
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CHECKLIST DE CONFORMIDADE */}
                {summaryData?.checklist && summaryData.checklist.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider block">
                      Checklist Documental do Certame
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {summaryData.checklist.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-start gap-2.5 text-xs"
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 mt-0.5 ${item.status === 'found' ? 'text-emerald-600' : 'text-slate-300'}`}
                          />
                          <div>
                            <span className="font-bold text-slate-800 block">{item.label}</span>
                            <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                              {item.guidance}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOTÃO PARA LEITOR DE EDITAIS */}
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="font-black text-xs text-brand-blue uppercase tracking-wider block">
                      Deseja uma análise jurídica minuciosa das cláusulas?
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Submeta o edital ao Leitor de Editais para mapear riscos específicos e subsidiar recursos.
                    </p>
                  </div>
                  <a
                    href={`/leitor-editais?edital=${noticeTargetId}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-blue hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
                  >
                    <span>Abrir no Leitor de Editais</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* RODAPÉ DO MODAL */}
          <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={dispararDownloadSeguro}
                  className="btn-download-edital inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-[#0B192C] text-[#0B192C] hover:bg-[#0B192C]/5 bg-transparent text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  title="Acessar Edital Oficial no PNCP"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Acessar Edital Oficial no PNCP ↗</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                {onSalvar && (
                  <button
                    type="button"
                    onClick={() => onSalvar(edital)}
                    disabled={isSalvo || isSalvando}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all border ${isSalvo
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                        : 'bg-brand-orange text-white hover:bg-orange-600 border-transparent shadow-xs cursor-pointer'
                      }`}
                  >
                    {isSalvando ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isSalvo ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Salvo ✓</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Salvar para Disputar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-medium text-center border-t border-slate-200/60 pt-2.5">
              Dados verificados e sincronizados via PNCP / Governo Federal. Acesse a fonte oficial para auditoria completa dos autos.
            </p>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
