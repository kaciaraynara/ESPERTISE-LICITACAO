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
  valorReferencia?: number | string;
  valorUnitarioEstimado?: number | string;
  valorTotal?: number | string;
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



export default function ResumoEstrategicoModal({
  isOpen,
  onClose,
  edital,
  isSalvo = false,
  isSalvando = false,
  onSalvar,
}: ResumoEstrategicoModalProps) {
  const [detalhesCarregando, setDetalhesCarregando] = useState(false);
  const [criterioExtra, setCriterioExtra] = useState<string | null>(null);
  const [modoDisputaExtra, setModoDisputaExtra] = useState<string | null>(null);
  const [itensExtra, setItensExtra] = useState<ResumoEditalItem[]>([]);

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

  const urlOficialPncp = buildOfficialPncpPortalUrl(edital);

  const numeroExibido =
    edital.numeroEdital ||
    edital.numeroCompra ||
    edital.processo ||
    edital.numeroControlePNCP ||
    edital.id;

  const cnpjFormatado = formatCnpj(edital.cnpjOrgao || edital.cnpj);

  const itensExibidos = (edital.itens && edital.itens.length > 0)
    ? edital.itens
    : (edital.items && edital.items.length > 0)
      ? edital.items
      : itensExtra;

  // Calculo automatico da soma dos itens quando valorEstimado for null ou <= 0
  const totalItensCalculado = itensExibidos.reduce((acc, it) => {
    const valTotal = Number(it.valorTotal);
    if (Number.isFinite(valTotal) && valTotal > 0) {
      return acc + valTotal;
    }
    const valUnit = Number(it.valorUnitarioEstimado ?? it.valorReferencia);
    const qtd = Number(it.quantidade ?? it.quantity);
    if (Number.isFinite(valUnit) && valUnit > 0 && Number.isFinite(qtd) && qtd > 0) {
      return acc + (valUnit * qtd);
    }
    return acc;
  }, 0);

  const valorEstimadoBase = edital.valorTotalEstimado ?? edital.valorEstimado ?? edital.valor_estimado;
  const temValorEstimadoBase = valorEstimadoBase !== undefined && valorEstimadoBase !== null && Number.isFinite(Number(valorEstimadoBase)) && Number(valorEstimadoBase) > 0;

  const valorFinal = temValorEstimadoBase
    ? Number(valorEstimadoBase)
    : (totalItensCalculado > 0 ? totalItensCalculado : null);

  const valorTotalRef = valorFinal !== null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFinal)
    : 'Sigiloso / Ver Itens no TR';

  // 3 Datas oficiais formatadas com formatPncpDateBR
  const rawPublicacao =
    edital.dataPublicacao ||
    edital.data_publicacao ||
    edital.dataPublicacaoPncp;

  const rawInicio =
    edital.dataAberturaProposta ||
    edital.dataInicioRecebimento ||
    edital.dataAbertura ||
    edital.data_abertura;

  const rawEncerramento =
    edital.dataEncerramentoProposta ||
    edital.dataLimiteProposta ||
    edital.dataFimRecebimento ||
    edital.dataEncerramento ||
    edital.data_encerramento;

  const dataPublicacaoPncp = rawPublicacao ? formatPncpDateBR(rawPublicacao, false) : '—';
  const dataInicioPropostas = rawInicio ? formatPncpDateBR(rawInicio, true) : 'Ver no edital';
  const dataLimiteEnvio = rawEncerramento ? formatPncpDateBR(rawEncerramento, true) : 'Conforme cronograma';

  const modoDisputaExibido =
    modoDisputaExtra ||
    edital.modoDisputa ||
    criterioExtra ||
    edital.criterioJulgamento ||
    'Aberto / Fechado';

  const modalidadeExibida = edital.modalidade || 'Pregão Eletrônico';

  const localizacaoExibida = [edital.municipio, edital.uf].filter(Boolean).join(' - ') || 'Âmbito Nacional';

  const dispararDownloadSeguro = () => {
    void handleDownloadEdital(edital);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* CABEÇALHO COM BOTÃO DE AUDITORIA OFICIAL PNCP */}
          <header className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/20 border-b border-slate-200/80 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-brand-blue/20">
                  <FileText className="w-3.5 h-3.5" />
                  Resumo Estratégico do Edital
                </span>
                {detalhesCarregando && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sincronizando dados oficiais…
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-[#0B192C] leading-snug">
                {edital.orgao || 'Órgão Licitante'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-500">
                <span className="font-mono text-slate-700">Edital nº {numeroExibido}</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {localizacaoExibida}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* BOTÃO DE AUDITORIA OFICIAL (LINK VERÍDICO PNCP) */}
              <a
                href={urlOficialPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link-pncp"
                title="Auditar contratação e autos diretamente no portal oficial do PNCP"
              >
                <span>Ver no Portal Oficial do PNCP ↗</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Fechar janela"
                aria-label="Fechar resumo estratégico"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* CORPO DO MODAL (GRADE ESTRUTURADA DE DADOS REAIS) */}
          <div className="p-6 overflow-y-auto space-y-5 text-sm">
            {/* 1. OBJETO RESUMIDO EM 2 LINHAS */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                <FileText className="w-4 h-4 text-brand-blue" />
                <span>Objeto da Contratação (Termo de Referência)</span>
              </div>
              <p
                className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed line-clamp-2"
                title={edital.objeto}
              >
                {edital.objeto ? edital.objeto.trim() : 'Consulte os anexos do certame para descrição detalhada.'}
              </p>
            </div>

            {/* 2. IDENTIFICAÇÃO DO ÓRGÃO E DETALHES DO CERTAME */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BLOCO: IDENTIFICAÇÃO DO ÓRGÃO */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  <Building2 className="w-4 h-4 text-brand-blue" />
                  <span>Identificação do Órgão</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Razão Social</span>
                    <span className="font-semibold text-slate-800 leading-snug">{edital.orgao || 'Administração Pública'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">CNPJ Oficial</span>
                    <span className="font-mono font-bold text-slate-800">{cnpjFormatado}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Município / UF</span>
                    <span className="font-semibold text-slate-700">{localizacaoExibida}</span>
                  </div>
                </div>
              </div>

              {/* BLOCO: DETALHES DO CERTAME */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  <Gavel className="w-4 h-4 text-brand-orange" />
                  <span>Detalhes do Certame</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Número no PNCP</span>
                    <span className="font-mono font-bold text-slate-800 truncate block" title={numeroExibido}>
                      {numeroExibido}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modalidade</span>
                      <span className="font-semibold text-slate-800">{modalidadeExibida}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modo de Disputa</span>
                      <span className="font-semibold text-slate-800">{modoDisputaExibido}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Divulgação no PNCP</span>
                      <span className="font-semibold text-slate-700">{dataPublicacaoPncp}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Início de Recebimento de Propostas</span>
                      <span className="font-semibold text-slate-800">{dataInicioPropostas}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Limite de Envio / Abertura da Sessão</span>
                      <span className="font-bold text-brand-blue flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                        {dataLimiteEnvio}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. VALOR TOTAL DE REFERÊNCIA */}
            <div className="bg-gradient-to-r from-blue-50/60 to-slate-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
                  Valor Total de Referência
                  {!temValorEstimadoBase && totalItensCalculado > 0 && (
                    <span className="ml-2 text-brand-blue font-bold lowercase">(soma calculada dos itens oficiais)</span>
                  )}
                </span>
                <p className="text-xl font-black text-brand-blue">
                  {valorTotalRef}
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-blue-100 shadow-2xs text-brand-blue">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* 4. ITENS DA CONTRATAÇÃO */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  <Package className="w-4 h-4 text-brand-blue" />
                  <span>Itens da Contratação</span>
                </div>
                {itensExibidos.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {itensExibidos.length} {itensExibidos.length === 1 ? 'item catalogado' : 'itens catalogados'}
                  </span>
                )}
              </div>

              {itensExibidos.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3 whitespace-nowrap">Item #</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Descrição</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Quantidade</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor de Referência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {itensExibidos.map((item, idx) => {
                        const num = item.numeroItem ?? item.itemNumber ?? item.numero ?? idx + 1;
                        const desc = item.descricao ?? item.description ?? 'Item da contratação';
                        const qtd = item.quantidade ?? item.quantity ?? '—';
                        const val = formatBRL(Number(item.valorReferencia ?? item.valorUnitarioEstimado ?? item.valorTotal));
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{num}</td>
                            <td className="py-2.5 px-3 leading-relaxed text-slate-800">{desc}</td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">{qtd}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-brand-blue whitespace-nowrap">{val}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                  <p className="text-xs font-semibold text-slate-600">
                    Valores globais consolidados no Termo de Referência oficial
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RODAPÉ DO MODAL COM DOWNLOAD CONTROLADO E TEXTO DE AUDITORIA */}
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

            {/* TEXTO DE AUDITORIA OBRIGATÓRIO NO RODAPÉ */}
            <p className="text-[11px] text-slate-500 font-medium text-center border-t border-slate-200/60 pt-2.5">
              Dados verificados e sincronizados via PNCP / Governo Federal. Acesse a fonte oficial para auditoria completa dos autos.
            </p>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
