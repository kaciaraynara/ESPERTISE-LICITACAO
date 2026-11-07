import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, Search, Loader2, AlertCircle,
  ExternalLink, DollarSign, TrendingUp,
  Award, ShieldCheck, Target, Zap, Info, Landmark, Lock, CheckCircle, Crown, Users, ArrowRight
} from 'lucide-react';
import { concorrentesApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { hasUserPlanFeature } from '../components/layout/Sidebar';
import { FORNECEDOR_ROUTES } from '@/routes';
import type { MalhaFinaLicitacao } from '@/types';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

interface ContratoConcorrente {
  id: string;
  fonte: 'pncp' | 'portal_transparencia';
  numeroContrato: string | null;
  numeroControlePncp: string | null;
  objeto: string | null;
  orgao: string | null;
  modalidade: string | null;
  valor: number;
  dataPublicacao: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  url: string | null;
}

interface DossieConcorrente {
  cnpj: string;
  periodo: {
    dataInicial: string;
    dataFinal: string;
  };
  estatisticas: {
    totalContratos: number;
    valorTotalContratado: number;
    ticketMedio: number;
    maiorContrato: number;
    orgaosContratantes: number;
    porOrgao?: Array<{ orgao: string; total: number; valorTotal: number }>;
    porModalidade?: Record<string, number>;
  };
  contratos: ContratoConcorrente[];
  fontes: Array<{
    fonte: string;
    status: string;
    totalRegistros: number;
  }>;
  geradoEm: string;
}

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(data: string | null | undefined): string {
  if (!data) return 'Não informada';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(data));
  } catch {
    return data;
  }
}

function normalizarCnpj(valor: string): string {
  return sanitizeCnpj(valor);
}

function formatarCnpj(cnpj: string): string {
  const digits = normalizarCnpj(cnpj);
  if (digits.length !== 14) return cnpj;
  return formatCnpjMask(digits);
}

export function HistoricoConcorrentesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjsMalhaInput, setCnpjsMalhaInput] = useState('');
  const [dossie, setDossie] = useState<DossieConcorrente | null>(null);
  const [malhaFinaResult, setMalhaFinaResult] = useState<MalhaFinaLicitacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMalha, setLoadingMalha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Verifica se o usuário possui a permissão premium malha_fina_qsa (Plano Master)
  const hasMalhaFina = hasUserPlanFeature(user, 'malha_fina_qsa');
  const isMaster = hasMalhaFina || user?.planType === 'MASTER';

  const consultarCnpj = async (cnpjAlvo: string) => {
    const cnpjLimpo = normalizarCnpj(cnpjAlvo);

    if (cnpjLimpo.length === 0) {
      setError(null);
      return;
    }

    if (!isValidCnpj(cnpjLimpo, { optional: false })) {
      setError('Por favor, informe um CNPJ válido com 14 caracteres alfanuméricos (XX.XXX.XXX/XXXX-XX) para gerar o Dossiê de Inteligência.');
      return;
    }

    setLoading(true);
    setError(null);
    setConsultado(true);

    try {
      const response = await concorrentesApi.getDossie(cnpjLimpo);
      if (response.data?.success && response.data?.data) {
        setDossie(response.data.data);
      } else {
        setError('Não foi possível obter os dados do concorrente. Tente novamente.');
        setDossie(null);
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgradeModal(true);
        setDossie(null);
        return;
      }
      const msg = err?.response?.data?.message || 'Erro ao consultar bases oficiais do governo.';
      setError(msg);
      setDossie(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConsultar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    consultarCnpj(cnpjInput);
  };

  const handleAuditoriaProfunda = async () => {
    if (!hasMalhaFina) {
      setShowUpgradeModal(true);
      return;
    }

    const rawList = (cnpjsMalhaInput || cnpjInput)
      .split(/[,;\s\n]+/)
      .map((item) => normalizarCnpj(item))
      .filter((digits) => digits.length === 14);

    const uniqueCnpjs = Array.from(new Set(rawList));
    if (uniqueCnpjs.length < 2) {
      setError('Para executar a Auditoria Profunda (Malha Fina QSA), informe ao menos 2 CNPJs (14 dígitos) separados por vírgula.');
      return;
    }

    setLoadingMalha(true);
    setError(null);
    try {
      const response = await concorrentesApi.malhaFina({ cnpjs: uniqueCnpjs });
      if (response.data?.success && response.data?.data) {
        setMalhaFinaResult(response.data.data);
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgradeModal(true);
        return;
      }
      setError(err?.response?.data?.message || 'Não foi possível concluir a Auditoria Profunda QSA.');
    } finally {
      setLoadingMalha(false);
    }
  };

  const buscaParam = searchParams.get('busca');

  useEffect(() => {
    if (buscaParam) {
      const decoded = decodeURIComponent(buscaParam).trim();
      setCnpjInput(decoded);
      const digits = normalizarCnpj(decoded);
      if (digits.length === 14 && dossie?.cnpj !== digits) {
        consultarCnpj(digits);
      }
    }
  }, [buscaParam]);

  // Análise de Perfil de Desconto & Modalidade Dominante
  const pregaoCount = dossie?.contratos.filter(c =>
    (c.modalidade || '').toLowerCase().includes('pregão') ||
    (c.modalidade || '').toLowerCase().includes('pregao')
  ).length || 0;

  const dispensaCount = dossie?.contratos.filter(c =>
    (c.modalidade || '').toLowerCase().includes('dispensa')
  ).length || 0;

  const total = dossie?.contratos.length || 0;
  const perfilAgressivo = total > 0 && (pregaoCount / total) >= 0.5;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-slate-50 min-h-screen relative">
      {/* Header Executivo — Inteligência Competitiva */}
      <header className="flex flex-col gap-2 pb-8 border-b border-slate-200 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 pl-3 border-l-4 border-[#0A2540]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
                  Inteligência Competitiva B2B
                </span>
                {!isMaster && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                    <Lock size={10} /> Plano Master
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A2540]">
                Dossiê Estratégico de Concorrentes
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                Investigue o histórico de vitórias, ticket médio e órgãos dominados pelos seus concorrentes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              Bases Oficiais: PNCP & Compras.gov
            </span>
          </div>
        </div>
      </header>

      {/* Caixa de Busca com CNPJ */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-8">
        <form onSubmit={handleConsultar} className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label
              htmlFor="cnpj-concorrente-input"
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2"
            >
              CNPJ ou Identificador do Concorrente / Órgão
            </label>
            <div className="relative">
              <input
                id="cnpj-concorrente-input"
                type="text"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(formatCnpjMask(e.target.value))}
                placeholder="XX.XXX.XXX/XXXX-XX (letras e números)"
                maxLength={18}
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#0A2540] transition disabled:opacity-50"
              />
              <Building2 size={18} className="absolute right-4 top-3.5 text-slate-400" />
            </div>
          </div>
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="submit"
              disabled={loading || !cnpjInput.trim()}
              className="h-11 px-6 rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm bg-[#0A2540] hover:bg-slate-800 text-white cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Consultando...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Gerar Dossiê</span>
                </>
              )}
            </button>

            {/* Botão de Auditoria Profunda (Malha Fina QSA) — Ativo no Master ou Cinza com Cadeado no Básico/Avançado */}
            {hasMalhaFina ? (
              <button
                type="button"
                onClick={handleAuditoriaProfunda}
                disabled={loadingMalha}
                className="h-11 px-6 rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {loadingMalha ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Auditando QSA...</span>
                  </>
                ) : (
                  <>
                    <Users size={16} />
                    <span>Auditoria Profunda (Malha Fina QSA)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                title="Auditoria Profunda (Malha Fina QSA) — Exclusivo do Plano Master"
                className="h-11 px-5 rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-xs bg-slate-200 hover:bg-slate-300 text-slate-600 border border-slate-300 cursor-pointer"
              >
                <Lock size={15} className="text-slate-500 shrink-0" />
                <span>Auditoria Profunda · Desbloquear no Plano Master</span>
              </button>
            )}
          </div>
        </form>

        {/* Card de Recurso Premium: Malha Fina Societária & Anticartel (QSA) */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#0A2540]">
                Auditoria Profunda — Malha Fina Societária (QSA & Anticartel)
              </span>
              {!hasMalhaFina && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                  <Lock size={10} /> Exclusivo Master
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Cruze múltiplos CNPJs concorrentes na disputa para detectar sócios em comum, parentesco societário e indícios de conluio (Art. 14 e Art. 155 da Lei 14.133/2021).
            </p>
          </div>

          {hasMalhaFina ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <input
                type="text"
                value={cnpjsMalhaInput}
                onChange={(e) => setCnpjsMalhaInput(e.target.value)}
                placeholder="CNPJs separados por vírgula (ex: 00000000000191, ...)"
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg px-3.5 py-2.5 outline-none focus:border-[#0A2540] min-w-[280px]"
              />
              <button
                type="button"
                onClick={handleAuditoriaProfunda}
                disabled={loadingMalha}
                className="h-10 px-4 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition shrink-0 cursor-pointer"
              >
                <ShieldCheck size={15} />
                <span>Checar Vínculos</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="h-10 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border border-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition shrink-0 cursor-pointer"
            >
              <Lock size={14} className="text-slate-500 shrink-0" />
              <span>Desbloquear no Plano Master</span>
            </button>
          )}
        </div>

        {/* Resultado da Checagem de Vínculos Societários (Quando executado no Plano Master) */}
        {malhaFinaResult && (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-[#0A2540]">
                Resultado da Checagem de Vínculos QSA: Risco {malhaFinaResult.risco}
              </h4>
              <span className="text-xs font-bold text-slate-600">
                {malhaFinaResult.resumo.totalConcorrentes} empresas · {malhaFinaResult.resumo.totalVinculosSocietarios} vínculo(s) societário(s)
              </span>
            </div>
            {malhaFinaResult.recomendacoes?.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-700 list-disc pl-4">
                {malhaFinaResult.recomendacoes.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Alerta de Erro */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-800">{error}</p>
              <button
                onClick={() => handleConsultar()}
                className="mt-1 text-[11px] font-bold text-rose-600 underline hover:text-rose-800"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center flex flex-col items-center justify-center">
          <Loader2 size={36} className="animate-spin text-[#0A2540] mb-3" />
          <h3 className="text-sm font-black text-slate-900">Gerando Dossiê Estratégico do Concorrente...</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Cruzando dados abertos do PNCP e Portal da Transparência para apurar contratos homologados, órgãos dominados e perfil de disputa.
          </p>
        </div>
      )}

      {/* Empty State Inicial: Antes da Busca */}
      {!loading && !dossie && !consultado && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center">
          <div className="bg-slate-100 p-4 rounded-full inline-flex mb-4">
            <Target size={32} className="text-[#0A2540]" />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-2">
            Pesquise um concorrente para ver o dossiê de contratos
          </h3>
          <div className="max-w-xl mx-auto space-y-2 text-xs text-slate-500 leading-relaxed mb-6">
            <p>
              <strong>O que você vai descobrir:</strong> Quais órgãos públicos ele domina, qual o ticket médio de faturamento e se ele pratica descontos agressivos em pregões.
            </p>
            <p>
              <strong>Auditoria e Inteligência:</strong> Dados 100% oficiais capturados das bases públicas de compras federais, estaduais e municipais.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setCnpjInput('00000000000191');
              }}
              className="h-9 px-4 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs"
            >
              Testar com CNPJ de Banco do Brasil (Exemplo)
            </button>
          </div>
        </div>
      )}

      {/* Empty State Estratégico Amigável: Sem Contratos Registrados */}
      {!loading && consultado && dossie && dossie.contratos.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-700 mx-auto flex items-center justify-center mb-4">
            <Building2 size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">
            Nenhum contrato público federal localizado para este CNPJ
          </h3>
          <div className="max-w-xl mx-auto text-xs text-slate-600 leading-relaxed mb-6 space-y-2">
            <p>
              A consulta oficial às bases do PNCP e Portal da Transparência para o CNPJ{' '}
              <strong className="text-slate-900 font-bold">{formatarCnpj(dossie.cnpj)}</strong> não retornou contratos homologados no período analisado.
            </p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left mt-4 text-[11px] text-slate-600 space-y-1.5">
              <strong className="font-bold text-[#0A2540] flex items-center gap-1.5">
                <Info size={14} className="text-blue-600 shrink-0" />
                Interpretação Estratégica de Mercado:
              </strong>
              <p>Este concorrente pode ser novo no mercado de licitações públicas.</p>
              <p>Pode atuar prioritariamente via subcontratação ou consórcios onde não seja o líder.</p>
              <p>Pode concentrar operações em portais municipais ou estaduais proprietários ainda em transição para o PNCP.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span>Consulta concluída com sucesso em {formatarData(dossie.geradoEm)}</span>
          </div>
        </div>
      )}

      {/* Dossiê Estratégico Completo */}
      {!loading && dossie && dossie.contratos.length > 0 && (
        <div className="space-y-8">
          {/* Cabeçalho do Dossiê */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                Dossiê Oficial do Concorrente
              </span>
              <p className="text-lg font-black text-[#0A2540]">
                CNPJ {formatarCnpj(dossie.cnpj)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
                {dossie.contratos.length} contrato(s) homologado(s) identificado(s)
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                Gerado em {formatarData(dossie.geradoEm)}
              </p>
            </div>
          </div>

          {/* Cards de Métricas de Inteligência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total de Contratos */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total de Contratos
                </span>
                <Award size={18} className="text-slate-300" />
              </div>
              <div className="text-3xl font-black text-[#0A2540] mb-1">
                {dossie.estatisticas.totalContratos}
              </div>
              <p className="text-[10px] text-slate-400">Vitórias homologadas</p>
            </div>

            {/* Total Faturado */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Volume Contratado
                </span>
                <DollarSign size={18} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mb-1">
                {formatarMoeda(dossie.estatisticas.valorTotalContratado)}
              </div>
              <p className="text-[10px] text-slate-400">Soma dos contratos oficiais</p>
            </div>

            {/* Ticket Médio */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Ticket Médio
                </span>
                <TrendingUp size={18} className="text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {formatarMoeda(dossie.estatisticas.ticketMedio)}
              </div>
              <p className="text-[10px] text-slate-400">Valor médio por contrato ganho</p>
            </div>

            {/* Perfil de Competitividade */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Perfil de Disputa
                </span>
                <Zap size={18} className="text-amber-500" />
              </div>
              <div className="text-sm font-black text-[#0A2540] mb-1">
                {perfilAgressivo ? 'Disputa Agressiva em Pregão' : 'Fornecimento Direto / Dispensa'}
              </div>
              <p className="text-[10px] text-slate-400">
                {pregaoCount} pregões · {dispensaCount} dispensas
              </p>
            </div>
          </div>

          {/* Seção: Órgãos que o Concorrente Domina */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Landmark className="w-5 h-5 text-[#0A2540]" />
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Órgãos que Este Concorrente Mais Domina
                </h3>
                <p className="text-xs text-slate-500">
                  Ranking das entidades públicas que mais contratam esta empresa
                </p>
              </div>
            </div>

            {dossie.estatisticas.porOrgao && dossie.estatisticas.porOrgao.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dossie.estatisticas.porOrgao.slice(0, 6).map((org, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate" title={org.orgao}>
                          {org.orgao}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {org.total} {org.total === 1 ? 'contrato' : 'contratos'} homologado(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 block">
                        {formatarMoeda(org.valorTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Detalhamento por órgão sintetizado nos contratos individuais abaixo.
              </p>
            )}
          </div>

          {/* Lista de Contratos Homologados nas Bases Oficiais */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Contratos Homologados nas Bases Oficiais (Compras.gov / PNCP)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rastreabilidade com links para atas e portais de compras
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                {dossie.contratos.length} itens
              </span>
            </div>

            <div className="space-y-4">
              {dossie.contratos.map((contrato) => (
                <div
                  key={contrato.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-[#0A2540]">
                          {contrato.numeroContrato ? `Contrato nº ${contrato.numeroContrato}` : 'Contrato Administrativo'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                          {contrato.fonte === 'pncp' ? 'PNCP' : 'Portal Transparência'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        {contrato.orgao || 'Órgão contratante não especificado'}
                      </p>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <span className="text-sm font-black text-emerald-700 block">
                        {formatarMoeda(contrato.valor)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Publicação: {formatarData(contrato.dataPublicacao)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {contrato.objeto || 'Objeto não detalhado na base pública'}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px]">
                    <span className="text-slate-500">
                      {contrato.modalidade ? `Modalidade: ${contrato.modalidade}` : 'Modalidade padrão'}
                    </span>
                    {contrato.url && (
                      <a
                        href={contrato.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0A2540] hover:underline font-bold flex items-center gap-1"
                      >
                        Ver no portal oficial <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upgrade de Plano (Paywall Amigável — Plano Master) */}
      {showUpgradeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[#0A2540]/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="bg-white p-8 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden border border-slate-100">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-[#EA580C] to-amber-600" />

            <div className="flex justify-center mb-5">
              <div className="relative w-16 h-16 rounded-2xl bg-[#0A2540] text-white flex items-center justify-center shadow-lg">
                <Crown size={30} className="text-amber-400" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center border-2 border-white">
                  <Lock size={12} />
                </div>
              </div>
            </div>

            <div className="text-center mb-2">
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black uppercase tracking-wider">
                Exclusivo Plano Master
              </span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 text-center mb-2">
              Auditoria Profunda & Malha Fina QSA
            </h2>

            <p className="text-slate-600 text-center mb-6 leading-relaxed text-sm">
              Desbloqueie a investigação societária profunda para cruzar o Quadro de Sócios e Administradores (QSA) dos concorrentes e fundamentar pedidos de desclassificação por conluio na <strong>Lei 14.133/2021</strong>.
            </p>

            <ul className="space-y-3 mb-7 text-xs sm:text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <li className="flex items-start gap-2.5">
                <CheckCircle size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Malha Fina Societária (QSA):</strong> Detecta sócios em comum e empresas de fachada disputando o mesmo lote.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Referências para sua análise:</strong> Consulte os artigos 14 e 155 da Lei 14.133/2021 e decisões do TCU relacionadas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>20 CNPJs + Propostas Ilimitadas:</strong> Acesso total ao Robô de Lances, Robô de Reajuste e Assistente de Repactuação.</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors font-bold text-sm cursor-pointer"
              >
                Continuar no Plano Atual
              </button>
              <button
                type="button"
                onClick={() => navigate(FORNECEDOR_ROUTES.planos)}
                className="flex-1 px-5 py-3 bg-[#EA580C] hover:bg-orange-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <span>Fazer Upgrade</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}