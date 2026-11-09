import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Clock,
  Download,
  Building2,
  MapPin,
  RefreshCw,
  Package,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Gavel,
  DollarSign,
  CheckSquare,
  Square,
  ListOrdered,
  Send,
  UploadCloud,
  Timer,
} from 'lucide-react';
import { licitacoesApi, noticesApi } from '../services/api';
import {
  buildOfficialPncpPortalUrl,
  extractPncpParams,
  formatCnpj,
} from '../utils/pncp';

export interface DossieItem {
  numeroItem?: number | string;
  itemNumber?: number | string;
  numero?: number | string;
  descricao?: string;
  description?: string;
  quantidade?: number | string;
  quantity?: number | string;
  unidadeMedida?: string;
  siglaUnidadeMedida?: string;
  unidade?: string;
  valorUnitarioEstimado?: number | string;
  valorReferencia?: number | string;
  precoUnitario?: number | string;
  valorTotal?: number | string;
  situacaoCompraItemNome?: string;
}

export interface DossieEditalData {
  id: string;
  objeto: string;
  objetoCompra?: string;
  informacaoComplementar?: string | null;
  orgao: string;
  nomeOrgao?: string;
  cnpjOrgao?: string | null;
  cnpj?: string | null;
  uf?: string | null;
  municipio?: string | null;
  valorEstimado?: number | null;
  valor_estimado?: number | null;
  valorTotalEstimado?: number | null;
  dataAbertura?: string | null;
  data_abertura?: string | null;
  dataEncerramento?: string | null;
  data_encerramento?: string | null;
  dataEncerramentoProposta?: string | null;
  dataLimiteProposta?: string | null;
  dataSessaoDisputa?: string | null;
  dataPublicacao?: string | null;
  data_publicacao?: string | null;
  modalidade?: string | null;
  nomeModalidade?: string | null;
  modalidadeNome?: string | null;
  modoDisputa?: string | null;
  criterioJulgamento?: string | null;
  numeroEdital?: string | null;
  numeroCompra?: string | null;
  processo?: string | null;
  numeroControlePNCP?: string | null;
  linkSistemaOrigem?: string | null;
  downloadUrl?: string | null;
  link?: string | null;
  itens?: DossieItem[];
  items?: DossieItem[];
  anoCompra?: number | string;
  sequencialCompra?: number | string;
  exigenciasHabilitacao?: {
    balanco?: string | null;
    atestados?: string | null;
    certidoes?: string | null;
  };
}

interface DossieEditalModalProps {
  isOpen: boolean;
  onClose: () => void;
  edital: DossieEditalData | null;
  isSalvo?: boolean;
  isSalvando?: boolean;
  onSalvar?: (edital: DossieEditalData) => void;
}

const CHECKLIST_HABILITACAO_PADRAO = [
  {
    id: 'juridica',
    titulo: 'Habilitação Jurídica',
    detalhe: 'Contrato Social consolidado, última alteração contratual ou Registro Comercial.',
  },
  {
    id: 'fiscal',
    titulo: 'Regularidade Fiscal',
    detalhe: 'CND Federal/INSS, CND Estadual, CND Municipal e Certidão de Regularidade do FGTS (CRF).',
  },
  {
    id: 'trabalhista',
    titulo: 'Regularidade Trabalhista',
    detalhe: 'Certidão Negativa de Débitos Trabalhistas (CNDT) emitida pelo TST.',
  },
  {
    id: 'economico',
    titulo: 'Qualificação Econômico-Financeira',
    detalhe: 'Certidão Negativa de Falência e Recuperação Judicial e Balanço Patrimonial (se exigido).',
  },
  {
    id: 'tecnica',
    titulo: 'Atestados de Capacidade Técnica',
    detalhe: 'Atestados emitidos por pessoas jurídicas comprovando fornecimento similar ao objeto.',
  },
  {
    id: 'declaracoes',
    titulo: 'Declarações da Lei 14.133/2021',
    detalhe: 'Cumprimento do art. 7º, XXXIII da CF (menor aprendiz) e inexistência de impedimentos.',
  },
] as const;

function formatCurrency(value?: number | string | null): string {
  if (value === undefined || value === null || value === '') return 'R$ 0,00';
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return 'Valor no TR';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatDataHora(isoString?: string | null): string {
  if (!isoString) return 'Conforme cronograma';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    const cleaned = String(isoString).trim();
    return cleaned || 'Conforme cronograma';
  }
  const hasTime =
    isoString.includes('T') ||
    isoString.includes(':') ||
    date.getUTCHours() > 0 ||
    date.getUTCMinutes() > 0;

  const dataStr = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (hasTime) {
    const horaStr = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dataStr} às ${horaStr}`;
  }
  return dataStr;
}

export default function DossieEditalModal({
  isOpen,
  onClose,
  edital,
  isSalvo = false,
  isSalvando = false,
  onSalvar,
}: DossieEditalModalProps) {
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [itens, setItens] = useState<DossieItem[]>([]);
  const [criterioJulgamento, setCriterioJulgamento] = useState<string | null>(null);
  const [modoDisputa, setModoDisputa] = useState<string | null>(null);

  // Checklist interativo persistido por edital no localStorage
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Carrega estado do checklist para o edital atual
  useEffect(() => {
    if (!edital?.id) {
      setChecklist({});
      return;
    }
    try {
      const storageKey = `expertise_dossie_chk_${edital.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setChecklist(JSON.parse(saved));
      } else {
        setChecklist({});
      }
    } catch {
      setChecklist({});
    }
  }, [edital?.id]);

  const toggleChecklistItem = useCallback((id: string) => {
    if (!edital?.id) return;
    setChecklist((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(`expertise_dossie_chk_${edital.id}`, JSON.stringify(updated));
      } catch {
        // Ignora erros de localStorage
      }
      return updated;
    });
  }, [edital?.id]);

  // Tecla ESC para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Busca oficial de itens do PNCP
  useEffect(() => {
    if (!isOpen || !edital?.id) {
      setItens([]);
      setCriterioJulgamento(null);
      setModoDisputa(null);
      return;
    }

    let active = true;
    setCarregandoItens(true);

    // Carrega itens existentes no edital se houver
    const itensIniciais = edital.itens || edital.items || [];
    if (itensIniciais.length > 0) {
      setItens(itensIniciais);
    }

    const fetchItens = async () => {
      try {
        // 1ª Tentativa: Endpoint de itens do backend (licitacoesApi)
        try {
          const res = await licitacoesApi.obterItens(edital.id);
          const data = res.data?.data || res.data;
          if (Array.isArray(data) && data.length > 0 && active) {
            setItens(data);
            setCarregandoItens(false);
            return;
          }
        } catch {
          // Continua para próxima tentativa
        }

        // 2ª Tentativa: Endpoint noticesApi.getItens
        try {
          const res = await noticesApi.getItens(edital.id);
          const data = res.data?.data || res.data;
          if (Array.isArray(data) && data.length > 0 && active) {
            setItens(data);
            setCarregandoItens(false);
            return;
          }
        } catch {
          // Continua para próxima tentativa
        }

        // 3ª Tentativa: Consulta direta aos endpoints oficiais do PNCP
        const pncpParams = extractPncpParams(edital);
        if (pncpParams?.cnpj && pncpParams.anoCompra && pncpParams.sequencialCompra) {
          const { cnpj, anoCompra, sequencialCompra } = pncpParams;
          
          // pncp/v1
          try {
            const urlPncpV1 = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${anoCompra}/${sequencialCompra}/itens`;
            const resp = await fetch(urlPncpV1, { headers: { Accept: 'application/json' } });
            if (resp.ok) {
              const itemsPncp = await resp.json();
              if (Array.isArray(itemsPncp) && itemsPncp.length > 0 && active) {
                setItens(itemsPncp);
                setCarregandoItens(false);
                return;
              }
            }
          } catch {
            // Continua para fallback consulta/v1
          }

          // consulta/v1
          try {
            const urlConsultaV1 = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${anoCompra}/${sequencialCompra}/itens`;
            const resp = await fetch(urlConsultaV1, { headers: { Accept: 'application/json' } });
            if (resp.ok) {
              const itemsConsulta = await resp.json();
              const arrayFinal = Array.isArray(itemsConsulta) ? itemsConsulta : itemsConsulta?.data;
              if (Array.isArray(arrayFinal) && arrayFinal.length > 0 && active) {
                setItens(arrayFinal);
                setCarregandoItens(false);
                return;
              }
            }
          } catch {
            // Falhas tratadas no bloco principal
          }
        }

        // Busca metadados adicionais via noticesApi.getById
        try {
          const resDetalhe = await noticesApi.getById(edital.id);
          const detalhe = resDetalhe.data?.data || resDetalhe.data;
          if (detalhe && active) {
            if (detalhe.judgmentCriterion || detalhe.criterioJulgamento) {
              setCriterioJulgamento(detalhe.judgmentCriterion || detalhe.criterioJulgamento);
            }
            if (detalhe.modoDisputa || detalhe.disputeMode) {
              setModoDisputa(detalhe.modoDisputa || detalhe.disputeMode);
            }
            if (Array.isArray(detalhe.items) && detalhe.items.length > 0) {
              setItens((prev) => (prev.length > 0 ? prev : detalhe.items));
            }
          }
        } catch {
          // Metadados opcionais
        }
      } finally {
        if (active) setCarregandoItens(false);
      }
    };

    void fetchItens();

    return () => {
      active = false;
    };
  }, [isOpen, edital]);

  const checklistTotal = CHECKLIST_HABILITACAO_PADRAO.length;
  const checklistCheckedCount = useMemo(() => {
    return CHECKLIST_HABILITACAO_PADRAO.filter((item) => checklist[item.id]).length;
  }, [checklist]);

  const checklistPorcentagem = Math.round((checklistCheckedCount / checklistTotal) * 100);

  if (!isOpen || !edital) return null;

  const urlOficialPncp = buildOfficialPncpPortalUrl(edital);
  const cnpjFormatado = formatCnpj(edital.cnpjOrgao || edital.cnpj);
  const numeroPncp =
    edital.numeroControlePNCP ||
    edital.numeroEdital ||
    edital.numeroCompra ||
    edital.processo ||
    edital.id;

  const modalidadeExibida =
    edital.nomeModalidade ||
    edital.modalidadeNome ||
    edital.modalidade ||
    'Pregão Eletrônico';

  const modoDisputaExibido =
    modoDisputa ||
    edital.modoDisputa ||
    criterioJulgamento ||
    edital.criterioJulgamento ||
    'Aberto / Fechado';

  const prazoLimiteEnvio =
    edital.dataLimiteProposta ||
    edital.dataEncerramentoProposta ||
    edital.dataEncerramento ||
    edital.data_encerramento;

  const prazoSessaoDisputa =
    edital.dataSessaoDisputa ||
    edital.dataAbertura ||
    edital.data_abertura ||
    prazoLimiteEnvio;

  const valorTotalExibido =
    edital.valorTotalEstimado ??
    edital.valorEstimado ??
    edital.valor_estimado;

  const localizacaoExibida =
    [edital.municipio, edital.uf].filter(Boolean).join(' - ') || 'Âmbito Nacional';

  const objetoCompleto =
    edital.objeto ||
    edital.objetoCompra ||
    edital.informacaoComplementar ||
    'Consulte a íntegra do Termo de Referência no edital.';

  const handleBaixarPdf = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:my-0 print:w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* CABEÇALHO DO DOSSIÊ */}
          <header className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:border-b-2 print:border-slate-800 print:bg-white">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-brand-blue/20 print:border-slate-400 print:text-slate-900">
                  <FileText className="w-3.5 h-3.5" />
                  Dossiê Estratégico do Edital
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                  Lei 14.133/2021
                </span>
                {carregandoItens && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 print:hidden">
                    <RefreshCw className="w-3 h-3 animate-spin text-brand-blue" />
                    Sincronizando itens oficiais do PNCP…
                  </span>
                )}
              </div>
              <h1 className="text-xl font-black text-[#0B192C] leading-snug tracking-tight">
                {edital.orgao || edital.nomeOrgao || 'Órgão Licitante'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-500">
                <span className="font-mono text-slate-700">Controle: {numeroPncp}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {localizacaoExibida}
                </span>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO DO CABEÇALHO */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end print:hidden">
              {/* BOTÃO [Baixar em PDF] */}
              <button
                type="button"
                onClick={handleBaixarPdf}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg shadow-2xs transition-all cursor-pointer"
                title="Imprimir ou salvar dossiê em formato PDF oficial"
              >
                <Download className="w-3.5 h-3.5 text-brand-blue" />
                <span>Baixar em PDF</span>
              </button>

              {/* BOTÃO [Ver no Portal Oficial do PNCP ↗] */}
              <a
                href={urlOficialPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link-pncp inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-2xs transition-all cursor-pointer"
                title="Auditar contratação e autos diretamente no portal oficial do PNCP"
              >
                <span>Ver no Portal Oficial do PNCP ↗</span>
              </a>

              {/* BOTÃO FECHAR */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Fechar janela"
                aria-label="Fechar dossiê"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* CORPO DO DOSSIÊ COM AS 4 SEÇÕES OFICIAIS */}
          <div className="p-6 overflow-y-auto space-y-6 text-sm print:overflow-visible print:p-2 print:space-y-4">
            {/* SEÇÃO 1: IDENTIFICAÇÃO DO CERTAME */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Building2 className="w-4 h-4 text-brand-blue" />
                <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  Seção 1: Identificação do Certame
                </h2>
              </div>

              {/* GRADE DE METADADOS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* ÓRGÃO COMPRADOR */}
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                    Órgão Comprador
                  </span>
                  <p className="font-bold text-slate-900 leading-snug">
                    {edital.orgao || edital.nomeOrgao || 'Administração Pública'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {localizacaoExibida}
                  </p>
                </div>

                {/* CNPJ OFICIAL & ID PNCP */}
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                    CNPJ Oficial & Registro
                  </span>
                  <p className="font-mono font-bold text-slate-900">
                    {cnpjFormatado}
                  </p>
                  <p className="text-xs font-mono text-slate-500 truncate" title={numeroPncp}>
                    ID PNCP: {numeroPncp}
                  </p>
                </div>

                {/* AMPARO LEGAL & MODALIDADE */}
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                    Amparo Legal & Modalidade
                  </span>
                  <p className="font-bold text-slate-900">
                    {modalidadeExibida}
                  </p>
                  <p className="text-xs font-semibold text-brand-blue flex items-center gap-1">
                    <Gavel className="w-3.5 h-3.5 shrink-0" />
                    Lei 14.133/2021 ({modoDisputaExibido})
                  </p>
                </div>
              </div>

              {/* LINHA DE PRAZOS CRÍTICOS & VALOR TOTAL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2 bg-orange-50 text-brand-orange rounded-lg shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                      Prazo Limite para Envio
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {formatDataHora(prazoLimiteEnvio)}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-brand-blue rounded-lg shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                      Sessão de Disputa / Lances
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {formatDataHora(prazoSessaoDisputa)}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                      Valor Total Estimado
                    </span>
                    <span className="text-base font-black text-brand-blue">
                      {formatCurrency(valorTotalExibido)}
                    </span>
                  </div>
                  <DollarSign className="w-5 h-5 text-brand-blue" />
                </div>
              </div>

              {/* OBJETO INTEGRAL DA CONTRATAÇÃO (SEM CORTES OU RETICÊNCIAS) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#0B192C] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-blue" />
                    Objeto Integral da Contratação
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Termo de Referência
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                  {objetoCompleto}
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: TABELA OFICIAL DE ITENS E VALORES */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-blue" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                    Seção 2: Tabela Oficial de Itens e Valores
                  </h2>
                </div>
                {itens.length > 0 && (
                  <span className="text-[11px] font-bold text-slate-500">
                    {itens.length} {itens.length === 1 ? 'item oficial' : 'itens oficiais'}
                  </span>
                )}
              </div>

              {itens.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-2.5 px-3 whitespace-nowrap text-center w-16">Item #</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Descrição Detalhada</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Quantidade</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Unidade</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor Unitário Estimado</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {itens.map((it, idx) => {
                        const itemNum = it.numeroItem ?? it.itemNumber ?? it.numero ?? idx + 1;
                        const descricao = it.descricao ?? it.description ?? 'Item do edital';
                        const qtd = it.quantidade ?? it.quantity ?? 1;
                        const unidade = it.unidadeMedida ?? it.siglaUnidadeMedida ?? it.unidade ?? 'UN';
                        const unitario = it.valorUnitarioEstimado ?? it.valorReferencia ?? it.precoUnitario ?? 0;
                        const total = it.valorTotal ?? ((Number(qtd) || 1) * (Number(unitario) || 0));

                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900 text-center">
                              {itemNum}
                            </td>
                            <td className="py-3 px-3 leading-relaxed text-slate-800">
                              {descricao}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap font-semibold">
                              {typeof qtd === 'number' ? qtd.toLocaleString('pt-BR') : qtd}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[11px] text-slate-600 uppercase">
                              {unidade}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-semibold text-slate-700">
                              {formatCurrency(unitario)}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-brand-blue">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : carregandoItens ? (
                <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-blue mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    Carregando tabela oficial de itens e valores da contratação…
                  </p>
                </div>
              ) : (
                <div className="p-5 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    Valores globais consolidados no Termo de Referência oficial
                  </p>
                  <p className="text-[11px] text-slate-500">
                    O órgão licitante não desmembrou itens avulsos no catálogo do PNCP. Consulte os anexos do certame.
                  </p>
                </div>
              )}
            </section>

            {/* SEÇÃO 3: CHECKLIST DE HABILITAÇÃO DOCUMENTAL */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                    Seção 3: Checklist de Habilitação Documental
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">
                    {checklistCheckedCount} de {checklistTotal} conferidos ({checklistPorcentagem}%)
                  </span>
                </div>
              </div>

              {/* BARRA DE PROGRESSO DO CHECKLIST */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden print:hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    checklistPorcentagem === 100
                      ? 'bg-emerald-500'
                      : checklistPorcentagem > 50
                        ? 'bg-blue-600'
                        : 'bg-brand-orange'
                  }`}
                  style={{ width: `${checklistPorcentagem}%` }}
                />
              </div>

              {/* LISTA INTERATIVA DE REQUISITOS DOCUMENTAIS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {CHECKLIST_HABILITACAO_PADRAO.map((item) => {
                  const isChecked = Boolean(checklist[item.id]);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklistItem(item.id)}
                      className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                        isChecked
                          ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className={`text-xs font-bold leading-snug ${isChecked ? 'text-emerald-900 line-through' : 'text-slate-900'}`}>
                          {item.titulo}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {item.detalhe}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* SEÇÃO 4: PASSO A PASSO OPERACIONAL */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <ListOrdered className="w-4 h-4 text-brand-blue" />
                <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  Seção 4: Passo a Passo Operacional para Disputar
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* PASSO 1 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-black text-xs">
                      1
                    </span>
                    <Send className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-[#0B192C] leading-snug">
                    Cadastrar proposta de preços
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Acesse o sistema eletrônico indicado no edital (ex: Compras.gov.br, BBMNet ou portal próprio) e cadastre sua proposta inicial de preços e marcas/modelos.
                  </p>
                </div>

                {/* PASSO 2 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-black text-xs">
                      2
                    </span>
                    <UploadCloud className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-[#0B192C] leading-snug">
                    Inserir declarações e documentos
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Faça o upload dos documentos de habilitação (jurídica, fiscal, técnica e econômica) e marque as declarações legais obrigatórias antes do encerramento do prazo.
                  </p>
                </div>

                {/* PASSO 3 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-brand-orange flex items-center justify-center font-black text-xs">
                      3
                    </span>
                    <Timer className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-[#0B192C] leading-snug">
                    Acessar sala de lances com antecedência
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Conecte-se com pelo menos 15 a 30 minutos de antecedência ao horário da sessão pública para acompanhar os lances e a etapa competitiva sem imprevistos.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RODAPÉ DO MODAL COM CONTROLE E AÇÕES */}
          <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href={urlOficialPncp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-[#0B192C] text-[#0B192C] hover:bg-[#0B192C]/5 bg-transparent text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Autos no PNCP</span>
                </a>
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
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all border ${
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
                        <span>Salvo ✓</span>
                      </>
                    ) : (
                      <>
                        <span>Salvar para Disputar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium text-center border-t border-slate-200/60 pt-2">
              Dossiê gerado com base em dados sincronizados do PNCP e Lei nº 14.133/2021. Verifique sempre o instrumento convocatório original.
            </p>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
