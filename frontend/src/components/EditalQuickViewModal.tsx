import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, CalendarDays, CheckCircle2, FilePlus2, Loader2, Sparkles, X } from 'lucide-react';

export interface QuickViewNotice {
  id: string;
  objeto: string;
  orgao: string;
  modalidade?: string;
  processo?: string;
  numeroCompra?: string;
  data_abertura?: string | null;
  dataAbertura?: string | null;
  valor_estimado?: number | null;
  valorEstimado?: number | null;
  uf?: string | null;
  municipio?: string | null;
  situacao?: string | null;
  data_publicacao?: string | null;
  dataPublicacao?: string | null;
  data_encerramento?: string | null;
  dataEncerramento?: string | null;
  fonte?: string | null;
  link?: string | null;
  score?: { pontuacao: number; nivel: string };
  itens?: Array<{
    id?: string;
    numero?: string | number;
    descricao?: string;
    quantidade?: number | string | null;
    unidade?: string | null;
    valorEstimadoUnitario?: number | null;
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

function formatCurrency(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatDate(value?: string | null): string {
  if (!value) return 'Não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Não informada'
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
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
      className="fixed inset-0 z-[100] flex justify-end bg-slate-950/55 backdrop-blur-sm"
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
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-7">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-brand-orange">
              Detalhes da oportunidade
            </p>
            <h2 id="quick-notice-title" className="text-xl font-black leading-snug text-slate-900 sm:text-2xl">
              {notice.objeto}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {notice.orgao}
              {notice.processo || notice.numeroCompra
                ? ` · Processo ${notice.processo || notice.numeroCompra}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Fechar visualização rápida"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid gap-3 border-b border-slate-100 bg-white p-5 sm:grid-cols-2 sm:px-7">
          <button
            type="button"
            onClick={onExplain}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-black text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingSummary ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {isGeneratingSummary ? 'Analisando o edital…' : 'Explicar edital'}
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
          <section aria-label="Resumo do edital" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Órgão responsável</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{notice.orgao || 'Órgão não informado'}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl bg-white p-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data de abertura</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{formatDate(notice.data_abertura || notice.dataAbertura)}</p>
                </div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor estimado</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(notice.valor_estimado ?? notice.valorEstimado)}</p>
              </div>
            </div>
          </section>

          <section aria-label="Compatibilidade com o perfil da empresa" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-brand-blue" aria-hidden="true" />
              <h3 className="text-sm font-black text-slate-900">Termômetro de Oportunidade</h3>
            </div>
            {scoreIsValid ? (
              <div className="mt-4 flex items-center gap-4">
                <div
                  role="progressbar"
                  aria-label="Aderência do edital ao perfil da empresa"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={score}
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-full p-2"
                  style={{ background: `conic-gradient(${scoreColor} ${score}%, #E2E8F0 ${score}% 100%)` }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full bg-white text-lg font-black" style={{ color: scoreColor }}>
                    {Math.round(score)}%
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{notice.score?.nivel || 'Aderência ao perfil'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Compatibilidade calculada pelo Radar com base no perfil da empresa.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                Ainda não há informações suficientes para avaliar a compatibilidade deste edital.
              </p>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Modalidade</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{notice.modalidade || 'Não informada'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Abertura</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatDate(notice.data_abertura || notice.dataAbertura)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor estimado</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatCurrency(notice.valor_estimado ?? notice.valorEstimado)}
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900">Detalhes técnicos e itens do certame</h3>
              {notice.fonte && <span className="text-[10px] font-bold uppercase text-slate-500">{notice.fonte}</span>}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="rounded-xl bg-slate-50 p-3 text-slate-700">
                <strong className="block text-[10px] uppercase text-slate-500">Situação</strong>
                {notice.situacao || 'Não informada'}
              </p>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-700">
                <strong className="block text-[10px] uppercase text-slate-500">Local</strong>
                {[notice.municipio, notice.uf].filter(Boolean).join(' / ') || 'Não informado'}
              </p>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-700">
                <strong className="block text-[10px] uppercase text-slate-500">Publicação</strong>
                {formatDate(notice.data_publicacao || notice.dataPublicacao)}
              </p>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-700">
                <strong className="block text-[10px] uppercase text-slate-500">Encerramento</strong>
                {formatDate(notice.data_encerramento || notice.dataEncerramento)}
              </p>
            </div>
            {isLoadingDetails ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Carregando itens oficiais do edital…</p>
            ) : detailsError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-900">
                Não foi possível consultar os detalhes técnicos: {detailsError}
              </p>
            ) : notice.itens?.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Quantidade</th>
                      <th className="px-3 py-2">Valor estimado unitário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notice.itens.map((item, index) => (
                      <tr key={item.id || `${item.numero || index}-${index}`}>
                        <td className="px-3 py-2 font-bold">{item.numero || index + 1}</td>
                        <td className="px-3 py-2">{item.descricao || 'Descrição não informada'}</td>
                        <td className="px-3 py-2">{item.quantidade ?? '—'} {item.unidade || ''}</td>
                        <td className="px-3 py-2">{formatCurrency(item.valorEstimadoUnitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                O PNCP não disponibilizou itens estruturados para este edital. A criação rápida tentará extrair os itens
                dos documentos disponíveis e informará se não houver dados suficientes.
              </p>
            )}
          </section>

          {summary ? (
            <div className="space-y-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
              <h3 className="flex items-center gap-2 text-sm font-black text-violet-950">
                <Sparkles size={17} /> Resumo do edital
              </h3>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                {String(summary.visao_geral || summary.resposta || 'A análise não trouxe um resumo em linguagem simples.')}
              </p>
              {typeof summary.objeto_resumido === 'string' && (
                <p className="text-sm leading-6 text-slate-700">
                  <strong>O que será comprado:</strong> {summary.objeto_resumido}
                </p>
              )}
              {Array.isArray(summary.datas_criticas) && summary.datas_criticas.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-600">Prazos e datas críticas</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                    {summary.datas_criticas.map((date, index) => <li key={`${String(date)}-${index}`}>{String(date)}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(summary.alertas) && summary.alertas.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-wide text-amber-800">Riscos e limitações</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
                    {summary.alertas.map((alert, index) => <li key={`${String(alert)}-${index}`}>{String(alert)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
              Gere uma explicação para entender em linguagem simples o objeto, os prazos e os pontos de atenção
              identificados nas fontes disponíveis.
            </p>
          )}

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            Os itens e quantidades são extraídos do edital e cruzados com o catálogo da empresa. O rascunho usa
            preços do catálogo ou valores estimados no PNCP como referências iniciais, sempre identificadas para
            revisão. Quando não houver referência confiável, o preço fica pendente em vez de ser inventado.
          </p>
        </div>

        <footer className="border-t border-slate-100 bg-white p-5 sm:p-6">
          <button
            type="button"
            onClick={onCreateProposal}
            disabled={isBusy || !hasActiveCompany}
            title={!hasActiveCompany ? 'Selecione uma empresa ativa para criar a proposta' : undefined}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingProposal ? <Loader2 className="animate-spin" size={18} /> : <FilePlus2 size={18} />}
            {isCreatingProposal ? 'Extraindo itens do edital…' : 'Gerar Proposta'}
          </button>
        </footer>
      </motion.section>
    </motion.div>
  );
}
