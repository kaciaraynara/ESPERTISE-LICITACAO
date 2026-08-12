import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, RefreshCw, Building2, Calendar,
  DollarSign, MapPin, AlertTriangle,
  FileText, TrendingUp, ChevronDown, Clock, ExternalLink,
  Database, Wifi,
} from '@components/icons/phosphor-compat';
import { licitacoesApi } from '../services/api';

type Licitacao = {
  id: string;
  objeto: string;
  orgao: string;
  uf?: string;
  municipio?: string;
  valor_estimado?: number;
  data_abertura?: string;
  data_encerramento?: string;
  modalidade?: string;
  situacao?: string;
  link?: string;
  fonte?: string;
  score?: { pontuacao: number; nivel: string };
};

type Meta = {
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
  fonte?: 'cache' | 'pncp' | 'comprasgov' | 'mista' | 'vazio';
  aviso?: string;
  perfilRadar?: {
    cnae_principal?: string | null;
    palavras_chave?: string[];
    regioes?: string[];
  } | null;
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

export default function LicitacoesPage() {
  const navigate = useNavigate();

  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [ufSel, setUfSel] = useState('Todos');
  const [modalidadeSel, setModalidadeSel] = useState('Todos');
  const [showFiltros, setShowFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const buscarLicitacoes = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: any = {
        pagina: pg,
        tamanhoPagina: 20,
      };
      if (busca.trim())         params.busca = busca.trim();
      if (ufSel !== 'Todos')    params.uf = ufSel;
      if (modalidadeSel !== 'Todos') {
        const pncpModMap: Record<string, number> = {
          'Pregão Eletrônico': 6,
          'Dispensa Eletrônica': 4,
          'Concorrência': 5,
          'Credenciamento': 12,
        };
        params.modalidade = pncpModMap[modalidadeSel] || modalidadeSel;
      }

      const { data } = await licitacoesApi.listar(params);

      if (data && (data.items || data.data)) {
        setLicitacoes(data.items || data.data || []);
        setMeta({
          total: data.total || data.totalRegistros || 0,
          pagina: data.pagina || pg,
          tamanhoPagina: data.tamanhoPagina || 20,
          totalPaginas: data.totalPaginas || Math.ceil((data.total || data.totalRegistros || 0) / (data.tamanhoPagina || 20)) || 1,
          fonte: data.fontesComErro?.length === 0 ? 'mista' : 'vazio',
          aviso: data.fontesComErro?.length > 0 ? `Algumas fontes apresentaram erro: ${data.fontesComErro.join(', ')}` : undefined,
          perfilRadar: data.perfilRadar,
        });
        setPagina(pg);
        setUltimaAtualizacao(new Date());
      }
    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');
      const isOffline = err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error');
      const aviso = isTimeout
        ? 'PNCP demorou para responder. Os dados do cache serão exibidos assim que disponíveis — tente novamente em alguns instantes.'
        : isOffline
          ? 'Backend não encontrado. Verifique se o servidor está rodando na porta 3001.'
          : `Erro ao buscar editais: ${err?.response?.data?.message || err?.message || 'tente novamente.'}`;

      console.error('[Radar] Erro:', err?.message, { isTimeout, isOffline });
      setLicitacoes([]);
      setMeta({
        total: 0,
        pagina: pg,
        tamanhoPagina: 20,
        totalPaginas: 0,
        fonte: 'vazio',
        aviso,
      });
    } finally {
      setLoading(false);
    }
  }, [busca, ufSel, modalidadeSel]);

  useEffect(() => { buscarLicitacoes(1); }, [buscarLicitacoes]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    buscarLicitacoes(1);
  };

  const formatVal = (v?: number) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const diasRestantes = (d?: string) => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  };

  const fonteLabel = meta?.fonte === 'cache'
    ? { label: 'Base atualizada', icon: Database, color: 'text-brand-blue bg-white border-brand-blue/20' }
    : meta?.fonte === 'pncp'
    ? { label: 'Ao Vivo · PNCP', icon: Wifi, color: 'text-brand-blue bg-white border-brand-blue/20' }
    : meta?.fonte === 'comprasgov'
    ? { label: 'Ao Vivo · Compras.gov', icon: Wifi, color: 'text-brand-blue bg-white border-brand-blue/20' }
    : meta?.fonte === 'mista'
    ? { label: 'Fontes Oficiais · PNCP + Compras.gov', icon: Wifi, color: 'text-brand-blue bg-white border-brand-blue/20' }
    : null;

  return (
    <div className="flex flex-col h-full bg-white">

      {/* â”€â”€ HEADER â”€â”€ */}
      <div className="bg-white border-b border-gray-100 px-6 lg:px-8 py-5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 text-sm text-brand-orange font-black uppercase tracking-widest mb-3">
                <FileText className="w-5 h-5" weight="bold" />
                Portal Nacional de Contratações Públicas
                {fonteLabel && (
                  <span className={`flex items-center gap-2 ml-4 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${fonteLabel.color}`}>
                    <fonteLabel.icon className="w-4 h-4" weight="bold" />
                    {fonteLabel.label}
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Radar de Editais</h1>
              <div className="flex items-center gap-3 mt-4">
                {ultimaAtualizacao && (
                  <p className="text-lg font-semibold text-slate-500 flex items-center gap-2">
                    <Clock className="w-5 h-5" weight="bold" />
                    {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
                    {meta?.total != null && (
                      <> &bull; <span className="font-bold text-brand-blue">{meta.total.toLocaleString()} licitações minadas</span></>
                    )}
                  </p>
                )}
              </div>
              {meta?.perfilRadar && !busca.trim() && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-brand-blue/20 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue">
                    Radar automatico por CNAE
                  </span>
                  {(meta.perfilRadar.palavras_chave || []).slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-lg border border-gray-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-blue/70">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => buscarLicitacoes(1)}
              disabled={loading}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-brand-orange hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-2xl hover:shadow-brand-orange/40 active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} weight="bold" />
              Forçar Sincronização
            </button>
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
                  onClick={() => { setUfSel('Todos'); setModalidadeSel('Todos'); setBusca(''); }}
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
                <div className="w-12 h-12 border-4 border-brand-blue/20 rounded-lg" />
                <div className="w-12 h-12 border-4 border-brand-blue/20 border-t-transparent rounded-lg animate-spin absolute inset-0" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-brand-blue/70">Buscando editais...</p>
                <p className="text-xs text-brand-blue/70 mt-1">Consultando cache, PNCP e Compras.gov</p>
              </div>
            </div>
          )}

          {/* VAZIO */}
          {!loading && licitacoes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                <Search className="w-8 h-8 text-brand-blue/70" />
              </div>
              <div>
                <p className="text-base font-bold text-brand-blue">Nenhum edital encontrado</p>
                <p className="text-sm text-brand-blue/70 mt-1 max-w-sm">
                  {meta?.fonte === 'vazio'
                    ? 'As fontes oficiais nao retornaram dados agora. Tente novamente em instantes ou ajuste os filtros.'
                    : 'Tente outros termos ou remova os filtros aplicados.'
                  }
                </p>
              </div>
              <button
                onClick={() => { setBusca(''); setUfSel('Todos'); setModalidadeSel('Todos'); buscarLicitacoes(1); }}
                className="px-4 py-2 bg-brand-blue text-white text-sm font-bold rounded-lg hover:bg-brand-blue transition-all"
              >
                Ver todos os editais
              </button>
            </div>
          )}

          {/* LISTA */}
          {!loading && licitacoes.length > 0 && (
            <div className="space-y-3">
              {licitacoes.map((item, i) => {
                const dias = diasRestantes(item.data_encerramento || item.data_abertura);
                const urgente = dias !== null && dias >= 0 && dias <= 3;
                const pct = item.score?.pontuacao;
                return (
                  <div
                    key={item.id || i}
                    className="group bg-white border-2 border-slate-100 rounded-2xl p-6 md:p-8 hover:border-brand-blue/30 hover:shadow-xl transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                    onClick={() => navigate(`/licitante/licitacoes/${encodeURIComponent(item.id)}`)}
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
                          {item.data_abertura && (
                            <span className="flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-slate-400 shrink-0" weight="bold" />
                              {formatDate(item.data_abertura)}
                            </span>
                          )}
                          {item.valor_estimado && (
                            <span className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-slate-400 shrink-0" weight="bold" />
                              <span className="font-black text-brand-blue text-base">{formatVal(item.valor_estimado)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center gap-3 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/licitante/licitacoes/${encodeURIComponent(item.id)}`); }}
                          className="flex items-center justify-center gap-2 px-5 py-3.5 bg-brand-orange hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-md hover:shadow-lg w-full"
                        >
                          <TrendingUp className="w-4 h-4" weight="bold" />
                          Analisar
                        </button>
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white border-2 border-slate-200 hover:border-brand-blue text-slate-600 hover:text-brand-blue text-xs font-black uppercase tracking-widest rounded-xl transition-all w-full"
                          >
                            Portal
                            <ExternalLink className="w-4 h-4" weight="bold" />
                          </a>
                        )}
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
    </div>
  );
}

