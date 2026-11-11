import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileText,
  Layers,
  Loader2,
  MapPin,
  X,
} from 'lucide-react';
import { buildOfficialPncpPortalUrl, formatPncpDateBR } from '@/utils/pncp';

export interface QuickViewNotice {
  id: string;
  objeto: string;
  objetoCompra?: string;
  orgao: string;
  nomeOrgao?: string;
  modalidade?: string;
  nomeModalidade?: string;
  processo?: string;
  numeroCompra?: string;
  numeroEdital?: string;
  numeroControlePNCP?: string;
  externalId?: string;
  cnpj?: string | null;
  cnpjOrgao?: string | null;
  anoCompra?: number | string;
  sequencialCompra?: number | string;
  data_abertura?: string | null;
  dataAbertura?: string | null;
  dataAberturaProposta?: string | null;
  dataInicioRecebimento?: string | null;
  data_encerramento?: string | null;
  dataEncerramento?: string | null;
  dataEncerramentoProposta?: string | null;
  dataLimiteProposta?: string | null;
  dataFimRecebimento?: string | null;
  data_publicacao?: string | null;
  dataPublicacao?: string | null;
  dataPublicacaoPncp?: string | null;
  valor_estimado?: number | null;
  valorEstimado?: number | null;
  valorTotalEstimado?: number | null;
  uf?: string | null;
  municipio?: string | null;
  situacao?: string | null;
  fonte?: string | null;
  link?: string | null;
  urlOficialPncp?: string | null;
  downloadUrl?: string | null;
  score?: { pontuacao: number; nivel: string };
  itens?: Array<{
    id?: string;
    numero?: string | number;
    numeroItem?: string | number;
    descricao?: string;
    description?: string;
    quantidade?: number | string | null;
    unidade?: string | null;
    unidadeMedida?: string | null;
    valorEstimadoUnitario?: number | null;
    valorUnitarioEstimado?: number | null;
    valorTotal?: number | null;
  }>;
}

interface EditalQuickViewModalProps {
  notice: QuickViewNotice;
  summary: Record<string, unknown> | null;
  isGeneratingSummary: boolean;
  isCreatingProposal: boolean;
  isLoadingDetails: boolean;
  detailsError: string | null;
  hasActiveCompany: boolean;
  onClose: () => void;
  onExplain: () => void;
  onCreateProposal: () => void;
}

/**
 * Regra de Ouro #2:
 * Quando valor for null, undefined ou <= 0, JAMAIS retornar R$ 0,00. Retornar 'Sigiloso / Ver Itens no TR'.
 */
function formatCurrency(value?: number | string | null): string {
  if (value === undefined || value === null || value === '') return 'Sigiloso / Ver Itens no TR';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 'Sigiloso / Ver Itens no TR';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export default function EditalQuickViewModal({
  notice,
  summary,
  isGeneratingSummary,
  isCreatingProposal,
  isLoadingDetails,
  detailsError,
  hasActiveCompany,
  onClose,
  onExplain,
  onCreateProposal,
}: EditalQuickViewModalProps) {
  const isBusy = isGeneratingSummary || isCreatingProposal;
  const score = notice.score?.pontuacao;
  const scoreIsValid = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
  const scoreColor = scoreIsValid
    ? score >= 75 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'
    : '#94A3B8';

  const valorTotal = notice.valorTotalEstimado ?? notice.valorEstimado ?? notice.valor_estimado ?? null;
  const isValorSigiloso = valorTotal === null || valorTotal === undefined || Number(valorTotal) <= 0;

  // 3 Datas Oficiais PNCP (Regra de Ouro #3)
  const dataPublicacao = notice.dataPublicacaoPncp || notice.dataPublicacao || notice.data_publicacao || null;
  const dataInicioProposta = notice.dataAberturaProposta || notice.dataInicioRecebimento || notice.dataAbertura || notice.data_abertura || null;
  const dataFimProposta = notice.dataEncerramentoProposta || notice.dataFimRecebimento || notice.dataLimiteProposta || notice.dataEncerramento || notice.data_encerramento || null;

  // Link Oficial do Portal PNCP (Regra de Ouro #4)
  const officialPncpUrl = notice.urlOficialPncp || buildOfficialPncpPortalUrl(notice);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-notice-title"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
      >
        {/* HEADER LIMPO CORPORATIVO */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/50 p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-brand-orange/10 text-brand-orange">
                Edital PNCP
              </span>
              {notice.situacao && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                  {notice.situacao}
                </span>
              )}
            </div>
            <h2 id="quick-notice-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
              {notice.objeto || notice.objetoCompra || 'Objeto não especificado'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-600 font-medium">
              <span className="inline-flex items-center gap-1">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                {notice.nomeOrgao || notice.orgao || 'Órgão Licitante'}
              </span>
              {(notice.processo || notice.numeroCompra || notice.numeroEdital) && (
                <span className="text-slate-400">
                  • Processo: <strong className="text-slate-700">{notice.processo || notice.numeroCompra || notice.numeroEdital}</strong>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Fechar visualização rápida"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        {/* BARRA DE AÇÕES OPERACIONAIS */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onExplain}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 shadow-2xs"
          >
            {isGeneratingSummary ? <Loader2 className="animate-spin" size={15} /> : <FileText size={15} />}
            {isGeneratingSummary ? 'Analisando o edital…' : 'Explicar edital'}
          </button>

          <a
            href={officialPncpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <ExternalLink size={14} className="text-slate-500" />
            Portal Oficial PNCP
          </a>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6 text-slate-800">
          {/* CARDS PRINCIPAIS: VALOR & MODALIDADE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor Total Estimado</p>
              <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                {formatCurrency(valorTotal)}
              </p>
              {isValorSigiloso && (
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  Orçamento sigiloso pelo órgão no PNCP. Verifique a soma dos itens no Termo de Referência.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Modalidade & Local</p>
              <p className="mt-1 text-sm font-bold text-slate-900 truncate">
                {notice.modalidade || notice.nomeModalidade || 'Não informada'}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                {[notice.municipio, notice.uf].filter(Boolean).join(' / ') || 'Local não informado'}
              </p>
            </div>
          </div>

          {/* CRONOGRAMA OFICIAL PNCP (FUSO BRASÍLIA - AMERICA/SAO_PAULO) */}
          <section aria-label="Cronograma de Prazos do PNCP" className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-slate-600" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Cronograma Oficial (Horário de Brasília)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Publicação no PNCP</p>
                <p className="mt-1 text-xs font-bold text-slate-900 tabular-nums">
                  {formatPncpDateBR(dataPublicacao, false)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Início Envio Propostas</p>
                <p className="mt-1 text-xs font-bold text-slate-900 tabular-nums">
                  {formatPncpDateBR(dataInicioProposta, true)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fim Propostas / Abertura</p>
                <p className="mt-1 text-xs font-bold text-slate-900 tabular-nums">
                  {formatPncpDateBR(dataFimProposta, true)}
                </p>
              </div>
            </div>
          </section>

          {/* ADERÊNCIA / TERMÔMETRO */}
          <section aria-label="Aderência ao perfil da empresa" className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand-blue" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Aderência ao Perfil</h3>
            </div>
            {scoreIsValid ? (
              <div className="mt-3 flex items-center gap-4">
                <div
                  role="progressbar"
                  aria-label="Aderência do edital ao perfil da empresa"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={score}
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full p-1.5"
                  style={{ background: `conic-gradient(${scoreColor} ${score}%, #E2E8F0 ${score}% 100%)` }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-black tabular-nums" style={{ color: scoreColor }}>
                    {Math.round(score)}%
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{notice.score?.nivel || 'Aderência calculada'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Calculado cruzando CNAEs e catálogo cadastrado da empresa ativa com o edital.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Ainda não há dados suficientes para calcular a aderência automatizada com a empresa ativa.
              </p>
            )}
          </section>

          {/* ITENS DO CERTAME (DADOS REAIS DO PNCP) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-600" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Itens Oficiais do Edital
                </h3>
              </div>
              {notice.itens?.length ? (
                <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                  {notice.itens.length} {notice.itens.length === 1 ? 'item' : 'itens'}
                </span>
              ) : null}
            </div>

            {isLoadingDetails ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-6 text-xs text-slate-500">
                <Loader2 className="animate-spin" size={16} />
                Consultando itens reais na API do PNCP…
              </div>
            ) : detailsError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
                Não foi possível consultar os detalhes técnicos no PNCP: {detailsError}
              </p>
            ) : notice.itens?.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 w-14">Item</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2 w-24 text-right">Qtd</th>
                      <th className="px-3 py-2 w-32 text-right">Valor Unit. Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notice.itens.map((item, index) => {
                      const num = item.numero ?? item.numeroItem ?? index + 1;
                      const desc = item.descricao || item.description || 'Descrição não informada';
                      const qtd = item.quantidade ?? '—';
                      const un = item.unidade || item.unidadeMedida || '';
                      const unitVal = item.valorEstimadoUnitario ?? item.valorUnitarioEstimado ?? null;

                      return (
                        <tr key={item.id || `${num}-${index}`} className="hover:bg-slate-50/60 transition">
                          <td className="px-3 py-2 font-bold tabular-nums text-slate-700">{num}</td>
                          <td className="px-3 py-2 text-slate-800 break-words">{desc}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {qtd} {un}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                            {formatCurrency(unitVal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                Os itens não constam na listagem preliminar do PNCP para este edital. Ao gerar a proposta, o motor fará a extração direta dos arquivos do Termo de Referência.
              </div>
            )}
          </section>

          {/* RESUMO EXPLICATIVO (SE SOLICITADO) */}
          {summary ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <FileText size={15} className="text-slate-600" />
                Resumo Operacional do Edital
              </h3>
              <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                {String(summary.visao_geral || summary.resposta || 'Resumo analítico extraído dos documentos.')}
              </p>
              {typeof summary.objeto_resumido === 'string' && (
                <p className="text-xs leading-relaxed text-slate-700">
                  <strong className="text-slate-900">Objeto resumido:</strong> {summary.objeto_resumido}
                </p>
              )}
              {Array.isArray(summary.datas_criticas) && summary.datas_criticas.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Prazos e Datas Críticas</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-700">
                    {summary.datas_criticas.map((date, index) => <li key={`${String(date)}-${index}`}>{String(date)}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(summary.alertas) && summary.alertas.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">Pontos de Atenção e Riscos</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-900">
                    {summary.alertas.map((alert, index) => <li key={`${String(alert)}-${index}`}>{String(alert)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* RODAPÉ OPERACIONAL */}
        <footer className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
          <button
            type="button"
            onClick={onCreateProposal}
            disabled={isBusy || !hasActiveCompany}
            title={!hasActiveCompany ? 'Selecione uma empresa ativa para criar a proposta' : undefined}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingProposal ? <Loader2 className="animate-spin" size={16} /> : <FilePlus2 size={16} />}
            {isCreatingProposal ? 'Extraindo itens do edital…' : 'Gerar Proposta Comercial'}
          </button>
        </footer>
      </motion.section>
    </motion.div>
  );
}
