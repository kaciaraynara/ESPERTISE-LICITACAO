import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Calendar,
  Clock,
  Download,
  Plus,
  CheckCircle2,
  DollarSign,
  Gavel,
  ShieldCheck,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { noticesApi } from '../services/api';

export interface ResumoEditalData {
  id: string;
  objeto: string;
  orgao: string;
  cnpjOrgao?: string | null;
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
    return 'Não informado no edital';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor));
}

function formatDataHoraLimite(
  dataEncerramento?: string | null,
  dataAbertura?: string | null,
): string {
  const raw = dataEncerramento || dataAbertura;
  if (!raw) return 'Não informado no edital';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    // Se for string pura tipo "2026-11-20"
    const cleaned = String(raw).trim();
    return cleaned.length > 0 ? cleaned : 'Não informado no edital';
  }

  // Verifica se há horário especificado
  const hasTime =
    raw.includes('T') ||
    raw.includes(':') ||
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
  const [exigenciasExtra, setExigenciasExtra] = useState<{
    balanco?: string | null;
    atestados?: string | null;
    certidoes?: string | null;
  } | null>(null);

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
      setExigenciasExtra(null);
      return;
    }

    let active = true;
    setDetalhesCarregando(true);

    // Consulta detalhes do edital e basic-summary de forma não bloqueante
    Promise.allSettled([
      noticesApi.getById(edital.id),
      noticesApi.getBasicSummary(edital.id),
    ])
      .then(([detailRes, summaryRes]) => {
        if (!active) return;

        let crit: string | null = null;
        let bal: string | null = null;
        let atest: string | null = null;
        let cert: string | null = null;

        if (detailRes.status === 'fulfilled') {
          const detail = detailRes.value?.data?.data || detailRes.value?.data;
          if (detail) {
            crit =
              detail.judgmentCriterion ||
              detail.criterioJulgamento ||
              detail.modoDisputa ||
              null;

            if (Array.isArray(detail.requirements)) {
              for (const req of detail.requirements) {
                const tipo = String(req.tipo || req.requirementType || '').toLowerCase();
                const desc = req.descricao || req.description || req.titulo || req.title;
                if (!desc) continue;

                if (tipo.includes('economico') || tipo.includes('balanco')) {
                  bal = desc;
                } else if (tipo.includes('tecnica') || tipo.includes('atestado')) {
                  atest = desc;
                } else if (tipo.includes('fiscal') || tipo.includes('certidao')) {
                  cert = desc;
                }
              }
            }
          }
        }

        if (summaryRes.status === 'fulfilled') {
          const summary = summaryRes.value?.data?.data || summaryRes.value?.data;
          if (summary) {
            if (Array.isArray(summary.requirements?.documentsFound)) {
              for (const doc of summary.requirements.documentsFound) {
                const code = String(doc.code || '').toLowerCase();
                const label = doc.label || doc.evidence;
                if (!label) continue;

                if (code.includes('economic') && !bal) bal = label;
                if (code.includes('technical') && !atest) atest = label;
                if (code.includes('fiscal') && !cert) cert = label;
              }
            }
          }
        }

        if (crit) setCriterioExtra(crit);
        if (bal || atest || cert) {
          setExigenciasExtra({
            balanco: bal,
            atestados: atest,
            certidoes: cert,
          });
        }
      })
      .catch(() => {
        // Falhas na consulta adicional são absorvidas para nunca travar a tela
      })
      .finally(() => {
        if (active) setDetalhesCarregando(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, edital?.id]);

  if (!isOpen || !edital) return null;

  const numeroExibido =
    edital.numeroEdital ||
    edital.numeroCompra ||
    edital.processo ||
    edital.numeroControlePNCP ||
    edital.id;

  const dataHoraLimite = formatDataHoraLimite(
    edital.dataEncerramento || edital.data_encerramento,
    edital.dataAbertura || edital.data_abertura,
  );

  const valorTotalRef = formatBRL(
    edital.valorEstimado ?? edital.valor_estimado,
  );

  const criterioJulgamento =
    criterioExtra ||
    edital.criterioJulgamento ||
    edital.modoDisputa ||
    (edital.modalidade && edital.modalidade.toLowerCase().includes('dispensa')
      ? 'Menor Preço'
      : null);

  // Exigências com Regra de Ouro: Nunca inventar exigências. Se não constar, "Não informado no edital".
  const exigenciaBalanco =
    exigenciasExtra?.balanco ||
    edital.exigenciasHabilitacao?.balanco ||
    null;

  const exigenciaAtestados =
    exigenciasExtra?.atestados ||
    edital.exigenciasHabilitacao?.atestados ||
    null;

  const exigenciaCertidoes =
    exigenciasExtra?.certidoes ||
    edital.exigenciasHabilitacao?.certidoes ||
    null;

  const downloadUrl = edital.downloadUrl;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* CABEÇALHO LIMPO / LIGHT PREMIUM */}
          <header className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/80 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-brand-blue/20">
                  <FileText className="w-3.5 h-3.5" />
                  Resumo Estratégico do Edital
                </span>
                {detalhesCarregando && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sincronizando TR…
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-slate-900 leading-snug">
                {edital.orgao || 'Órgão Licitante'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-500">
                <span className="font-mono text-slate-700">Edital nº {numeroExibido}</span>
                {(edital.municipio || edital.uf) && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {[edital.municipio, edital.uf].filter(Boolean).join(' / ')}
                  </span>
                )}
                {edital.modalidade && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                    {edital.modalidade}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title="Fechar janela"
              aria-label="Fechar resumo estratégico"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* CORPO DO MODAL COM OS PONTOS-CHAVE OBRIGATÓRIOS */}
          <div className="p-6 overflow-y-auto space-y-5 text-sm">
            {/* 1. OBJETO RESUMIDO EM 2 LINHAS SIMPLES */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                <FileText className="w-4 h-4 text-brand-blue" />
                <span>Objeto do Edital (Termo de Referência)</span>
              </div>
              <p
                className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed line-clamp-2"
                title={edital.objeto}
              >
                {edital.objeto ? edital.objeto.trim() : 'Não informado no edital'}
              </p>
            </div>

            {/* 2. DATA E HORÁRIO LIMITE DE ENVIO DA PROPOSTA */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                <Clock className="w-4 h-4 text-brand-orange" />
                <span>Data e Horário Limite de Envio da Proposta</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-blue shrink-0" />
                <span className="text-sm font-black text-slate-900">
                  {dataHoraLimite}
                </span>
              </div>
            </div>

            {/* 3. EXIGÊNCIAS PRINCIPAIS DE HABILITAÇÃO */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Exigências Principais de Habilitação</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fonte Oficial PNCP
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {/* A) Balanço Patrimonial */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Balanço Patrimonial
                  </p>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {exigenciaBalanco || 'Não informado no edital'}
                  </p>
                </div>

                {/* B) Atestados de Capacidade Técnica */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Atestados de Capacidade
                  </p>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {exigenciaAtestados || 'Não informado no edital'}
                  </p>
                </div>

                {/* C) Certidões Específicas */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Certidões Específicas
                  </p>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {exigenciaCertidoes || 'Não informado no edital'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * Regra de verificação: Exibição estrita de requisitos confirmados na documentação oficial. Requisitos ausentes constam como "Não informado no edital".
              </p>
            </div>

            {/* 4. VALOR TOTAL DE REFERÊNCIA E CRITÉRIO DE JULGAMENTO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Valor Total */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Valor Total de Referência</span>
                </div>
                <p className="text-base font-black text-brand-blue">
                  {valorTotalRef}
                </p>
              </div>

              {/* Critério de Julgamento */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  <Gavel className="w-4 h-4 text-brand-blue" />
                  <span>Critério de Julgamento</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  {criterioJulgamento || 'Não informado no edital'}
                </p>
              </div>
            </div>
          </div>

          {/* RODAPÉ DO MODAL COM AÇÕES INTEGRADAS */}
          <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-brand-blue/40 text-brand-blue hover:bg-blue-50 bg-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
                  title="Baixar Edital oficial diretamente da fonte"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Edital
                </a>
              ) : (
                <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-400 bg-white text-xs font-bold uppercase tracking-wider rounded-lg cursor-not-allowed opacity-60">
                  <Download className="w-3.5 h-3.5" />
                  Sem Anexo
                </span>
              )}
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
                      <Plus className="w-3.5 h-3.5" />
                      <span>Salvar para Disputar</span>
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
