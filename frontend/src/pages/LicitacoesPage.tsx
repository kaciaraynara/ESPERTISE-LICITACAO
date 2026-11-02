import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Search, Filter, RefreshCw, Building2, Calendar,
  DollarSign, MapPin, AlertTriangle,
  ChevronDown, Clock, ExternalLink,
  Plus, CheckCircle2,
} from '@components/icons/phosphor-compat';
import { lexApi, licitacoesApi, crmApi, propostasApi, noticesApi } from '../services/api';
import { useCompany } from '@/contexts/CompanyContext';
import EditalQuickViewModal, { type QuickViewNotice } from '@/components/EditalQuickViewModal';
import toast from 'react-hot-toast';

type Licitacao = {
  id: string;
  objeto: string;
  orgao: string;
  uf?: string;
  municipio?: string;
  valor_estimado?: number | null;
  valorEstimado?: number | null;
  data_abertura?: string | null;
  dataAbertura?: string | null;
  data_encerramento?: string | null;
  dataEncerramento?: string | null;
  data_publicacao?: string | null;
  dataPublicacao?: string | null;
  modalidade?: string;
  situacao?: string;
  link?: string;
  linkSistemaOrigem?: string;
  documento_url?: string;
  numeroControlePNCP?: string;
  fonte?: string;
  score?: { pontuacao: number; nivel: string };
  processo?: string;
  numeroCompra?: string;
};

type Meta = {
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
  fonte?: 'cache' | 'pncp' | 'comprasgov' | 'mista' | 'vazio';
  aviso?: string;
  perfilRadar?: {
    cnaes?: string[];
    cnae_principal?: string | null;
    palavras_chave?: string[];
    regioes?: string[];
  } | null;
};

type SearchFilters = {
  busca: string;
  uf: string;
  modalidade: string;
};

const MODALIDADES = [
  'Todos', 'Pregão Eletrônico', 'Dispensa Eletrônica', 'Concorrência', 'Credenciamento',
];
const UFS = [
  'Todos','AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

function StatusBadge({ situacao }: { situacao?: string }) {
  const s = (situacao || '').toLowerCase();
  const isActive = s.includes('publicad') || s.includes('ativ') || s.includes('aberta');
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
      isActive
        ? 'bg-white text-brand-blue border border-brand-blue/20'
        : 'bg-white text-brand-blue/70 border border-gray-100'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-lg ${isActive ? 'bg-brand-blue animate-pulse' : 'bg-white'}`} />
      {situacao || 'Publicada'}
    </span>
  );
}

export default function LicitacoesPage({ modalidadeInicial = 'Todos' }: { modalidadeInicial?: string } = {}) {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [editalSelecionado, setEditalSelecionado] = useState<QuickViewNotice | null>(null);
  const [resumoRapido, setResumoRapido] = useState<Record<string, unknown> | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [criandoProposta, setCriandoProposta] = useState(false);
  const [carregandoDetalhesEdital, setCarregandoDetalhesEdital] = useState(false);
  const [erroDetalhesEdital, setErroDetalhesEdital] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [ufSel, setUfSel] = useState('Todos');
  const [modalidadeSel, setModalidadeSel] = useState(modalidadeInicial);
  const [filtrosAplicados, setFiltrosAplicados] = useState<SearchFilters>({
    busca: '',
    uf: 'Todos',
    modalidade: modalidadeInicial,
  });

  useEffect(() => {
    setModalidadeSel(modalidadeInicial);
    setFiltrosAplicados((prev) => ({
      ...prev,
      modalidade: modalidadeInicial,
    }));
  }, [modalidadeInicial]);
  const [showFiltros, setShowFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvosCrmIds, setSalvosCrmIds] = useState<Set<string>>(new Set());

  const explicarEdital = async () => {
    if (!editalSelecionado) return;
    setGerandoResumo(true);
    try {
      const response = await lexApi.resumo({ edital_id: editalSelecionado.id });
      const result = response.data?.data;
      if (!result || typeof result !== 'object') {
        throw new Error('A IA não retornou um resumo válido para este edital.');
      }
      setResumoRapido(result as Record<string, unknown>);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Não foi possível explicar este edital agora.');
    } finally {
      setGerandoResumo(false);
    }
  };

  const criarPropostaAutomatica = async () => {
    if (!editalSelecionado) return;
    if (!selectedCompany?.id) {
      toast.error('Selecione uma empresa antes de criar a proposta.');
      return;
    }

    setCriandoProposta(true);
    try {
      const response = await propostasApi.preencherPropostaViaLex({
        noticeId: editalSelecionado.id,
        companyId: selectedCompany.id,
        autoCreate: true,
      });
      const proposalId = response.data?.data?.proposalId || response.data?.data?.proposal?.id;
      if (!proposalId) {
        throw new Error('A proposta foi processada, mas o sistema não retornou o identificador para abri-la.');
      }
      toast.success('Tabela criada com itens e preços de referência. Revise custos e valores antes de enviar.');
      const noticeQuery = `?edital=${encodeURIComponent(editalSelecionado.id)}`;
      setEditalSelecionado(null);
      setResumoRapido(null);
      navigate(`/fornecedor/propostas/${proposalId}${noticeQuery}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Não foi possível montar a proposta deste edital.');
    } finally {
      setCriandoProposta(false);
    }
  };

  useEffect(() => {
    const noticeId = editalSelecionado?.id;
    if (!noticeId) return undefined;

    let active = true;
    setCarregandoDetalhesEdital(true);
    setErroDetalhesEdital(null);
    noticesApi.getById(noticeId)
      .then((response) => {
        if (!active) return;
        const detail = response.data?.data;
        if (!detail || typeof detail !== 'object') {
          throw new Error('Não foi possível carregar os detalhes do edital.');
        }
        setEditalSelecionado((current) => current?.id === noticeId
          ? {
              ...current,
              uf: detail.uf ?? current.uf,
              municipio: detail.municipality ?? current.municipio,
              situacao: detail.status ?? current.situacao,
              dataPublicacao: detail.publishedAt ?? current.dataPublicacao,
              dataEncerramento: detail.closingAt ?? current.dataEncerramento,
              fonte: detail.source ?? current.fonte,
              itens: Array.isArray(detail.items) ? detail.items : [],
            }
          : current);
      })
      .catch((error: any) => {
        if (!active) return;
        const message = error.response?.data?.message || error.message;
        setErroDetalhesEdital(message || 'Não foi possível carregar os detalhes e itens do edital.');
      })
      .finally(() => {
        if (active) setCarregandoDetalhesEdital(false);
      });

    return () => {
      active = false;
    };
  }, [editalSelecionado?.id]);

  // Carrega IDs dos editais já cadastrados no CRM para evitar duplicatas visuais
  useEffect(() => {
    crmApi.getOportunidades()
      .then((res) => {
        const ids = new Set<string>();
        const list = res.data?.data || [];
        list.forEach((item: any) => {
          if (item.noticeId) ids.add(item.noticeId);
          if (item.notice?.id) ids.add(item.notice.id);
          if (item.notice?.externalId) ids.add(item.notice.externalId);
        });
        setSalvosCrmIds(ids);
      })
      .catch(() => {});
  }, []);

  const handleSalvarNoCrm = async (e: React.MouseEvent, item: Licitacao) => {
    e.stopPropagation();
    if (salvosCrmIds.has(item.id)) {
      toast('Este edital já está na sua esteira de disputas.');
      return;
    }
    setSalvandoId(item.id);
    try {
      await crmApi.createOportunidade({ noticeId: item.id });
      setSalvosCrmIds((prev) => new Set([...prev, item.id]));
      toast.success('Edital adicionado à sua Gestão de Disputas!');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setSalvosCrmIds((prev) => new Set([...prev, item.id]));
        toast.error('Este edital já está na sua esteira de disputas.');
      } else {
        toast.error(err?.response?.data?.message || 'Erro ao adicionar edital à esteira de disputas.');
      }
    } finally {
      setSalvandoId(null);
    }
  };

  const buscarLicitacoes = useCallback(async (pg = 1, sincronizarPncp = false) => {
    setLoading(true);
    let avisoSincronizacao: string | undefined;
    const pncpModMap: Record<string, number> = {
      'Pregão Eletrônico': 6,
      'Dispensa Eletrônica': 8,
      'Concorrência': 4,
      'Credenciamento': 12,
    };
    try {
      if (sincronizarPncp) {
        try {
          await licitacoesApi.sincronizar({
            pagina: 1,
            tamanhoPagina: 50,
            palavraChave: filtrosAplicados.busca || undefined,
            uf: filtrosAplicados.uf !== 'Todos' ? filtrosAplicados.uf : undefined,
            modalidade: filtrosAplicados.modalidade !== 'Todos'
              ? pncpModMap[filtrosAplicados.modalidade]
              : undefined,
          });
        } catch (syncError: any) {
          avisoSincronizacao = syncError?.response?.data?.message
            || 'Não foi possível atualizar agora os dados oficiais do PNCP. Exibindo os últimos resultados salvos.';
        }
      }

      const params: any = {
        pagina: pg,
        tamanhoPagina: 20,
      };
      if (filtrosAplicados.busca.trim()) params.busca = filtrosAplicados.busca.trim();
      if (filtrosAplicados.uf !== 'Todos') params.uf = filtrosAplicados.uf;
      if (filtrosAplicados.modalidade !== 'Todos') {
        params.modalidade = pncpModMap[filtrosAplicados.modalidade] || filtrosAplicados.modalidade;
      }

      const { data } = await licitacoesApi.listar(params);

      if (data && (Array.isArray(data.items) || Array.isArray(data.data))) {
        const items = (Array.isArray(data.items) ? data.items : data.data) || [];
        const total = (data.meta?.totalRegistros ?? data.totalRegistros ?? data.total) ?? items.length;
        const totalPgs = data.meta?.totalPaginas ?? (Math.ceil(total / (data.meta?.tamanhoPagina || 20)) || 1);

        setLicitacoes(items);
        setMeta({
          total,
          pagina: data.meta?.pagina || data.pagina || pg,
          tamanhoPagina: data.meta?.tamanhoPagina || data.tamanhoPagina || 20,
          totalPaginas: totalPgs,
          fonte: 'cache',
          perfilRadar: data.meta?.perfilRadar ?? data.perfilRadar,
          aviso: avisoSincronizacao || data.meta?.aviso,
        });
        setPagina(pg);
        setUltimaAtualizacao(new Date());
      } else {
        setLicitacoes([]);
        setMeta({
          total: 0,
          pagina: pg,
          tamanhoPagina: 20,
          totalPaginas: 0,
          fonte: 'vazio',
        });
      }
    } catch (err: any) {
      const aviso = err?.response?.data?.message || 'Nossos servidores estão processando um alto volume de dados do governo. Tente novamente em alguns instantes.';
      setLicitacoes([]);
      setMeta({
        total: 0,
        pagina: pg,
        tamanhoPagina: 20,
        totalPaginas: 0,
        fonte: 'vazio',
        aviso: avisoSincronizacao || aviso,
      });
    } finally {
      setLoading(false);
    }
  }, [filtrosAplicados]);

  useEffect(() => {
    void buscarLicitacoes(1, true);
  }, [buscarLicitacoes]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    const nextFilters = { busca: busca.trim(), uf: ufSel, modalidade: modalidadeSel };
    if (
      nextFilters.busca === filtrosAplicados.busca
      && nextFilters.uf === filtrosAplicados.uf
      && nextFilters.modalidade === filtrosAplicados.modalidade
    ) {
      void buscarLicitacoes(1, true);
      return;
    }
    setFiltrosAplicados(nextFilters);
  };

  const limparFiltros = () => {
    const defaultMod = modalidadeInicial || 'Todos';
    const nextFilters = { busca: '', uf: 'Todos', modalidade: defaultMod };
    setBusca('');
    setUfSel('Todos');
    setModalidadeSel(defaultMod);
    if (
      nextFilters.busca === filtrosAplicados.busca
      && nextFilters.uf === filtrosAplicados.uf
      && nextFilters.modalidade === filtrosAplicados.modalidade
    ) {
      void buscarLicitacoes(1, true);
      return;
    }
    setFiltrosAplicados(nextFilters);
  };

  const formatVal = (v?: number) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const diasRestantes = (d?: string) => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  };

  const tituloPagina = modalidadeInicial && modalidadeInicial !== 'Todos'
    ? `${modalidadeInicial} (Lei 14.133/21)`
    : 'Radar de Editais';

  return (
    <div className="flex flex-col h-full bg-white">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-100 px-6 lg:px-8 py-5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{tituloPagina}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                {meta?.total != null ? (
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                    <span className="font-bold text-brand-blue">{meta.total.toLocaleString()}</span> oportunidades capturadas
                    {ultimaAtualizacao && (
                      <span className="text-xs text-slate-400">· Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Oportunidades consultadas em fontes oficiais</p>
                )}
              </div>
              {meta?.perfilRadar && !busca.trim() && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-brand-blue/20 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue">
                    Busca alinhada às atividades da empresa
                  </span>
                  {(meta.perfilRadar.palavras_chave || []).slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-blue/70">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => void buscarLicitacoes(1, true)}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} weight="bold" />
                Atualizar Lista
              </button>
            </div>
          </div>

          {/* BUSCA */}
          <form onSubmit={handleBuscar} className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" weight="bold" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por objeto, órgão, termo ou palavra-chave..."
                className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-200 rounded-xl text-base font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all shadow-sm hover:border-slate-300"
              />
            </div>
            <button type="submit" className="px-8 py-4 bg-brand-blue hover:bg-blue-900 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg">
              Buscar Editais
            </button>
            <button
              type="button"
              onClick={() => setShowFiltros(!showFiltros)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 text-brand-blue/70 text-sm font-bold rounded-lg hover:bg-white transition-all"
            >
              <Filter className="w-4 h-4" />
              Filtros
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
            </button>
          </form>

          {/* FILTROS */}
          {showFiltros && (
            <div className="mt-3 flex flex-wrap gap-3 pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label htmlFor="licitacoes-uf-filter" className="text-xs font-bold text-brand-blue/70 uppercase tracking-wider block mb-1">UF</label>
                <select
                  id="licitacoes-uf-filter"
                  aria-label="Filtrar licitações por UF"
                  value={ufSel}
                  onChange={e => setUfSel(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm font-medium text-brand-blue focus:outline-none focus:border-brand-blue/20"
                >
                  {UFS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="licitacoes-modalidade-filter" className="text-xs font-bold text-brand-blue/70 uppercase tracking-wider block mb-1">Modalidade</label>
                <select
                  id="licitacoes-modalidade-filter"
                  aria-label="Filtrar licitações por modalidade"
                  value={modalidadeSel}
                  onChange={e => setModalidadeSel(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm font-medium text-brand-blue focus:outline-none focus:border-brand-blue/20"
                >
                  {MODALIDADES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={limparFiltros}
                  className="px-4 py-2 text-xs font-bold text-brand-blue/70 hover:text-brand-blue bg-white hover:bg-white rounded-lg transition-all"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">

          {/* AVISO DE SINCRONIZAÇÃO */}
          {meta?.aviso && !loading && (
            <div className={`mb-5 rounded-lg p-4 flex items-start gap-3 animate-in fade-in duration-200 ${
              meta.fonte === 'cache'
                ? 'bg-white border border-brand-blue/20'
                : 'bg-brand-orange/10 border border-brand-orange/50'
            }`}>
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${meta.fonte === 'cache' ? 'text-brand-blue' : 'text-brand-blue'}`} />
              <div>
                <p className={`text-sm font-bold ${meta.fonte === 'cache' ? 'text-brand-blue' : 'text-brand-blue'}`}>
                  {meta.fonte === 'cache' ? 'Dados em cache' : 'Aviso de conectividade'}
                </p>
                <p className={`text-sm mt-0.5 ${meta.fonte === 'cache' ? 'text-brand-blue' : 'text-brand-blue'}`}>
                  {meta.aviso}
                </p>
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-[#0A2540]/20 rounded-lg" />
                <div className="w-12 h-12 border-4 border-[#0A2540] border-t-transparent rounded-lg animate-spin absolute inset-0" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">Localizando oportunidades estratégicas...</p>
                <p className="text-xs text-slate-500 mt-1">Carregando dados consolidados do mercado governamental</p>
              </div>
            </div>
          )}

          {/* VAZIO / EMPTY STATE ENGAJADOR */}
          {!loading && licitacoes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 gap-5 text-center max-w-lg mx-auto bg-slate-50/80 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="relative p-4 rounded-3xl bg-white shadow-md border border-slate-100">
                <svg className="w-20 h-20 text-[#0A2540]" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="opacity-20" />
                  <circle cx="48" cy="48" r="32" stroke="currentColor" strokeWidth="2" className="opacity-30" />
                  <circle cx="48" cy="48" r="18" stroke="currentColor" strokeWidth="2" className="opacity-50" />
                  <circle cx="48" cy="48" r="5" fill="#EA580C" />
                  <line x1="48" y1="8" x2="48" y2="88" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                  <line x1="8" y1="48" x2="88" y2="48" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                  <path d="M48 48 L72 24" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="72" cy="24" r="3.5" fill="#EA580C" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Nenhuma oportunidade encontrada nesta busca.
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  A consulta ao PNCP é atualizada ao abrir o Radar e ao executar uma busca. Ajuste os filtros ou tente novamente para consultar a fonte oficial.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2 w-full justify-center">
                <button
                  type="button"
                  onClick={() => void buscarLicitacoes(1, true)}
                  className="w-full sm:w-auto px-5 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xs"
                >
                  Atualizar oportunidades
                </button>
              </div>
            </div>
          )}

          {/* LISTA */}
          {!loading && licitacoes.length > 0 && (
            <div className="space-y-3">
              {licitacoes.map((item, i) => {
                const dataRef = item.data_encerramento || item.dataEncerramento || item.data_abertura || item.dataAbertura;
                const dias = diasRestantes(dataRef || undefined);
                const urgente = dias !== null && dias >= 0 && dias <= 3;
                const pct = item.score?.pontuacao;
                const valorExibido = item.valor_estimado ?? item.valorEstimado;
                const dataAberturaExibida = item.data_abertura || item.dataAbertura;
                return (
                  <div
                    key={item.id || i}
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir detalhes do edital: ${item.objeto}`}
                    className="group bg-white border-2 border-slate-100 rounded-2xl p-6 md:p-8 hover:border-brand-blue/30 hover:shadow-xl transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                    onClick={() => { setEditalSelecionado(item); setResumoRapido(null); }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                      event.preventDefault();
                      setEditalSelecionado(item);
                      setResumoRapido(null);
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-6 md:gap-8">
                      {/* SCORE CIRCLE */}
                      {pct !== undefined && (
                        <div className={`hidden lg:flex flex-col items-center justify-center w-20 h-20 rounded-2xl shrink-0 font-black text-2xl border-4 ${
                          pct >= 80 ? 'bg-blue-50/50 text-brand-blue border-brand-blue/20' :
                          pct >= 60 ? 'bg-slate-50 text-brand-blue border-slate-200' :
                          'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {pct}
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mt-0.5">match</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <StatusBadge situacao={item.situacao} />
                          {item.modalidade && (
                            <span className="px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-500 bg-slate-50 border-2 border-slate-100 uppercase tracking-widest">
                              {item.modalidade}
                            </span>
                          )}
                          {item.fonte && (
                            <span className="px-3 py-1.5 rounded-lg text-[10px] font-black text-brand-blue bg-blue-50/50 border-2 border-brand-blue/20 uppercase tracking-widest">
                              {item.fonte}
                            </span>
                          )}
                          {urgente && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black text-brand-orange bg-orange-50/50 border-2 border-brand-orange/30 uppercase tracking-widest animate-pulse">
                              <Clock className="w-3.5 h-3.5" weight="bold" />
                              {dias === 0 ? 'Hoje' : `${dias}d`}
                            </span>
                          )}
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-snug mb-5 group-hover:text-brand-blue transition-colors line-clamp-2">
                          {item.objeto}
                        </h2>
                        <p className="mb-3 text-xs font-semibold text-slate-500">
                          Clique para ver detalhes técnicos e itens do certame sem sair do Radar.
                        </p>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500 font-semibold">
                          <span className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-slate-400 shrink-0" weight="bold" />
                            <span className="truncate max-w-[250px]">{item.orgao}</span>
                          </span>
                          {(item.municipio || item.uf) && (
                            <span className="flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-slate-400 shrink-0" weight="bold" />
                              {[item.municipio, item.uf].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {dataAberturaExibida && (
                            <span className="flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-slate-400 shrink-0" weight="bold" />
                              {formatDate(dataAberturaExibida)}
                            </span>
                          )}
                          {valorExibido != null && (
                            <span className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-slate-400 shrink-0" weight="bold" />
                              <span className="font-black text-brand-blue text-base">{formatVal(valorExibido)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center gap-3 shrink-0 sm:w-44">
                        <button
                          onClick={e => handleSalvarNoCrm(e, item)}
                          disabled={salvandoId === item.id}
                          className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all w-full border-2 ${
                            salvosCrmIds.has(item.id)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 active:scale-95'
                          }`}
                          title={salvosCrmIds.has(item.id) ? 'Disputa já adicionada à esteira' : 'Adicionar à Gestão de Disputas'}
                        >
                          {salvandoId === item.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : salvosCrmIds.has(item.id) ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" weight="bold" />
                              <span>Na Esteira</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" weight="bold" />
                              <span>Disputar</span>
                            </>
                          )}
                        </button>
                        {(() => {
                          const numPncp = item.numeroControlePNCP || (item as any).numero_controle_pncp;
                          const portalUrl = (item as any).linkSistemaOrigem
                            || (item as any).documento_url
                            || item.link
                            || (numPncp ? `https://pncp.gov.br/app/editais/${encodeURIComponent(numPncp)}` : null);

                          if (!portalUrl) return null;

                          return (
                            <a
                              href={portalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-200 hover:border-brand-blue text-slate-600 hover:text-brand-blue text-[11px] font-black uppercase tracking-widest rounded-xl transition-all w-full"
                              title="Abrir no portal oficial externo (PNCP / Compras.gov)"
                            >
                              Portal
                              <ExternalLink className="w-3.5 h-3.5" weight="bold" />
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINAÇÃO */}
          {!loading && licitacoes.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-brand-blue/70 font-medium">
                Página {pagina} · {licitacoes.length} resultados · {meta?.total?.toLocaleString() || '?'} total
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pagina <= 1 || loading}
                  onClick={() => buscarLicitacoes(pagina - 1)}
                  className="px-4 py-2 bg-white border border-gray-100 text-sm font-bold text-brand-blue/70 rounded-lg hover:bg-white disabled:opacity-40 transition-all"
                >
                  Anterior
                </button>
                <button
                  disabled={(meta?.totalPaginas || 1) <= pagina || loading}
                  onClick={() => buscarLicitacoes(pagina + 1)}
                  className="px-4 py-2 bg-white border border-gray-100 text-sm font-bold text-brand-blue/70 rounded-lg hover:bg-white disabled:opacity-40 transition-all"
                >
                  Proxima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {editalSelecionado && (
          <EditalQuickViewModal
            key={editalSelecionado.id}
            notice={editalSelecionado}
            summary={resumoRapido}
            isGeneratingSummary={gerandoResumo}
            isCreatingProposal={criandoProposta}
            isLoadingDetails={carregandoDetalhesEdital}
            detailsError={erroDetalhesEdital}
            hasActiveCompany={Boolean(selectedCompany?.id)}
            onClose={() => {
              setEditalSelecionado(null);
              setResumoRapido(null);
            }}
            onExplain={() => void explicarEdital()}
            onCreateProposal={() => void criarPropostaAutomatica()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
