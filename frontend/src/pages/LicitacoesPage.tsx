import api from '@/services/api';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Search,
  Building2,
  MapPin,
  FileText,
  Calendar,
  SlidersHorizontal,
  RefreshCw,
  Check,
  Bookmark,
  ExternalLink,
  Gavel,
  Scale,
  Zap,
  Award,
  X,
  Target,
  LayoutList,
  LayoutGrid,
  Sliders,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { licitacoesApi, crmApi } from '../services/api';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import {
  RadarPerfilModal,
  type ObjectTypeOption,
  type RadarPerfilDraft,
} from '../components/radar/RadarPerfilModal';
import { buildOfficialPncpPortalUrl, formatCnpj } from '@/utils/pncp';
import type { RadarFacets } from '../types';
import toast from 'react-hot-toast';

export interface EditalItem {
  id: string;
  numeroControlePNCP?: string;
  numeroCompra?: string;
  numeroEdital?: string;
  processo?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  objetoCompra?: string;
  objeto?: string;
  modalidadeNome?: string;
  modalidade?: string;
  nomeModalidade?: string;
  orgao?: string;
  nomeOrgao?: string;
  buyerName?: string;
  orgaoEntidade?: {
    razaoSocial?: string;
    cnpj?: string;
  };
  orgaoNome?: string;
  orgaoCnpj?: string;
  cnpjOrgao?: string;
  buyerDocument?: string;
  unidadeOrgao?: {
    municipioNome?: string;
    ufSigla?: string;
  };
  municipio?: string;
  uf?: string;
  dataPublicacaoPncp?: string;
  dataPublicacao?: string;
  data_publicacao?: string;
  publishedAt?: string;
  createdAt?: string;
  dataAberturaProposta?: string;
  dataAbertura?: string;
  data_abertura?: string;
  dataEncerramentoProposta?: string;
  dataEncerramento?: string;
  data_encerramento?: string;
  dataLimiteProposta?: string;
  dataSessaoDisputa?: string;
  valorTotalEstimado?: number;
  valorEstimado?: number;
  valor_estimado?: number;
  estimatedValue?: number;
  linkSistemaOrigem?: string;
  urlOficial?: string;
  urlOficialPncp?: string;
  link?: string;
  srp?: boolean;
  fonte?: string;
  source?: string;
  tipoObjeto?: string | null;
  metadata?: Record<string, any> | null;
  viabilidade?: number;
  scoreViabilidade?: number;
  matchScore?: number;
  _scoreCalculado?: number;
}

interface LicitacoesPageProps {
  tituloCustomizado?: string;
  modalidadeInicial?: string;
}

const MODALIDADES_RAPIDAS = [
  { id: 'TODAS', label: 'Todas', icon: FileText },
  { id: 'PREGAO', label: 'Pregão', icon: Gavel },
  { id: 'CONCORRENCIA', label: 'Concorrência', icon: Scale },
  { id: 'DISPENSA', label: 'Dispensa', icon: Zap },
  { id: 'CREDENCIAMENTO', label: 'Credenciamento', icon: Award },
  { id: 'SRP', label: 'Registro de Preços', icon: Bookmark },
  { id: 'BAIXA_PROCURA', label: 'Menor Porte (até R$ 80 mil)', icon: Zap },
];

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function formatarMoeda(valor?: number): string {
  if (!valor || Number.isNaN(valor)) return 'Sigiloso / Consultar';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function formatarDataHora(dataStr?: string | null): string {
  if (!dataStr) return 'Ver no edital';
  const d = new Date(dataStr);
  if (Number.isNaN(d.getTime())) return 'Ver no edital';
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const temHora = String(dataStr).includes('T') || String(dataStr).includes(':');
  if (!temHora) return data;
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return hora === '00:00' ? data : `${data} às ${hora}`;
}

function formatarData(dataStr?: string | null): string {
  if (!dataStr) return 'Ver no edital';
  const d = new Date(dataStr);
  if (Number.isNaN(d.getTime())) return 'Ver no edital';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function extrairPalavrasChaveCnaes(empresa: any, cnaesCache: string[] = []): string[] {
  const textos = [
    empresa?.cnaeDescricao,
    empresa?.ramoAtividade,
    empresa?.cnaePrincipal,
    empresa?.cnae_principal,
    empresa?.atividadePrincipal,
    ...(Array.isArray(empresa?.cnaesSecundarios) ? empresa.cnaesSecundarios : []),
    ...cnaesCache,
  ].filter(Boolean);

  const stopWords = new Set([
    'comercio', 'varejista', 'atacadista', 'servicos', 'artigos', 'outros',
    'produtos', 'geral', 'ltda', 'eireli', 'nao', 'especificados',
    'anteriormente', 'para', 'outras', 'atividades', 'exceto', 'partes', 'pecas',
  ]);

  const unicas: string[] = [];
  for (const t of textos) {
    const palavras = String(t)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 3 && !stopWords.has(p));
    for (const p of palavras) {
      if (!unicas.includes(p)) unicas.push(p);
    }
  }
  return unicas.slice(0, 8);
}

const SINONIMOS_RAMO: Record<string, string[]> = {
  vestuario: ['vestuario', 'uniforme', 'fardamento', 'confeccao', 'camiseta', 'calcados'],
  roupas: ['roupas', 'uniforme', 'fardamento', 'vestuario', 'confeccao', 'camiseta'],
  confeccao: ['confeccao', 'uniforme', 'vestuario', 'fardamento', 'enxoval'],
  calcados: ['calcados', 'tenis', 'sapato', 'bota', 'vestuario'],
  alimentos: ['alimentos', 'merenda', 'alimenticios', 'generos'],
  informatica: ['informatica', 'computador', 'notebook', 'impressora', 'software'],
  limpeza: ['limpeza', 'higiene', 'saneantes', 'descartaveis'],
  papelaria: ['papelaria', 'expediente', 'escolar', 'escritorio'],
  moveis: ['moveis', 'mobiliario', 'cadeira', 'mesa'],
};

function expandirSinonimosRamo(termo: string, empresa: any, cnaesCache: string[] = []): string[] {
  const base = extrairPalavrasChaveCnaes(empresa, cnaesCache);
  const limpo = (termo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const lista = new Set<string>();
  if (limpo) {
    lista.add(limpo);
    if (SINONIMOS_RAMO[limpo]) {
      SINONIMOS_RAMO[limpo].forEach((s) => lista.add(s));
    }
  }
  for (const p of base) {
    if (!limpo || p === limpo) {
      lista.add(p);
      if (SINONIMOS_RAMO[p]) {
        SINONIMOS_RAMO[p].forEach((s) => lista.add(s));
      }
    }
  }
  return Array.from(lista).slice(0, 8);
}

function getSourceBadgeLabel(rawSource?: string): string {
  const lower = String(rawSource || 'PNCP').toLowerCase();
  if (lower.includes('querido')) return 'Diário Oficial';
  if (lower.includes('compras')) return 'Compras.gov.br';
  if (lower.includes('transparencia')) return 'Transparência';
  return 'PNCP';
}

function getTipoObjetoLabel(tipo?: string | null): string | null {
  if (tipo === 'BENS') return 'Bens';
  if (tipo === 'SERVICOS') return 'Serviços';
  if (tipo === 'OBRAS') return 'Obras';
  return null;
}

export default function LicitacoesPage({
  tituloCustomizado,
  modalidadeInicial,
}: LicitacoesPageProps = {}) {
  const { selectedCompany } = useCompany();

  const [editais, setEditais] = useState<EditalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [facets, setFacets] = useState<RadarFacets | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const [palavraChave, setPalavraChave] = useState('');
  const [palavraChaveDebounced, setPalavraChaveDebounced] = useState('');
  const [palavrasPerfil, setPalavrasPerfil] = useState<string[]>([]);
  const [cnaeChipAtivo, setCnaeChipAtivo] = useState<string | null>(null);

  const [ufsSelecionadas, setUfsSelecionadas] = useState<string[]>([]);
  const [orgaoFiltro, setOrgaoFiltro] = useState('');
  const [orgaoDebounced, setOrgaoDebounced] = useState('');
  const [fonteAtiva, setFonteAtiva] = useState<'TODAS' | 'PNCP' | 'ComprasGov' | 'querido_diario'>('TODAS');
  const [apenasAbertos, setApenasAbertos] = useState(true);
  const [modalidadeAtiva, setModalidadeAtiva] = useState(() => {
    const m = (modalidadeInicial || '').toLowerCase();
    if (m.includes('pregão') || m.includes('pregao')) return 'PREGAO';
    if (m.includes('concorr')) return 'CONCORRENCIA';
    if (m.includes('dispensa')) return 'DISPENSA';
    if (m.includes('credenc')) return 'CREDENCIAMENTO';
    if (m.includes('srp') || m.includes('registro')) return 'SRP';
    return 'TODAS';
  });
  const [tipoObjetoAtivo, setTipoObjetoAtivo] = useState<'TODAS' | ObjectTypeOption>('TODAS');
  const [modoRemoto, setModoRemoto] = useState<'TODOS' | 'DISPUTA_ONLINE' | 'REMOTO_100'>('TODOS');
  const [incluirSemClassificacao, setIncluirSemClassificacao] = useState(true);
  const [dataPublicacao, setDataPublicacao] = useState('');
  const [ordenacao, setOrdenacao] = useState<'recentes' | 'encerramento' | 'maior_valor' | 'menor_valor' | 'relevancia'>('recentes');
  const [visualizacao, setVisualizacao] = useState<'detalhada' | 'compacta'>('detalhada');
  const [mostrarFiltrosExtras, setMostrarFiltrosExtras] = useState(false);

  const [perfilAtivo, setPerfilAtivo] = useState(false);
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);

  const navigate = useNavigate();
  const [salvosMap, setSalvosMap] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const abrirAnaliseCompletaEdital = (edital: EditalItem) => {
    const editalId = String(edital.numeroControlePNCP || edital.id || '');
    if (editalId) {
      navigate(`/fornecedor/leitor-editais?edital=${encodeURIComponent(editalId)}`);
    }
  };
  const [cnaesExtrasApi, setCnaesExtrasApi] = useState<string[]>([]);
  const [cnaesStorageCache, setCnaesStorageCache] = useState<string[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const syncPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'info' | 'erro'; texto: string } | null>(null);

  const exibirAviso = useCallback((tipo: 'sucesso' | 'info' | 'erro', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 5000);
  }, []);

  // Debounce palavra-chave e órgão comprador
  useEffect(() => {
    const t = setTimeout(() => {
      setPalavraChaveDebounced(palavraChave);
      setPagina(1);
    }, 250);
    return () => clearTimeout(t);
  }, [palavraChave]);

  useEffect(() => {
    const t = setTimeout(() => {
      setOrgaoDebounced(orgaoFiltro);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [orgaoFiltro]);

  // Limpa estados de CNAE ao trocar de empresa (zero vazamento de empresa anterior)
  useEffect(() => {
    setCnaesExtrasApi([]);
    setCnaesStorageCache([]);
    setCnaeChipAtivo(null);

    const cnpjLimpo = String(selectedCompany?.cnpj || '').replace(/\D/g, '');
    if (typeof window === 'undefined' || cnpjLimpo.length !== 14) return;

    const cacheKey = `@Expertise:cnaes_${cnpjLimpo}`;
    try {
      const saved = window.localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCnaesStorageCache(parsed);
          setCnaesExtrasApi(parsed);
          return;
        }
      }
    } catch {}

    let cancelled = false;
    fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const lista = [
          data.cnae_fiscal_descricao,
          ...(Array.isArray(data.cnaes_secundarios) ? data.cnaes_secundarios.map((c: any) => c.descricao) : []),
        ].filter(Boolean);
        if (lista.length > 0) {
          setCnaesStorageCache(lista);
          setCnaesExtrasApi(lista);
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(lista));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedCompany?.cnpj]);

  const listaCnaesEmpresa = useMemo(() => {
    const emp = selectedCompany as any;
    const todos = [
      emp?.cnaeDescricao || emp?.ramoAtividade || emp?.atividadePrincipal || emp?.cnaePrincipal || emp?.cnae_principal,
      ...(Array.isArray(emp?.cnaesSecundarios) ? emp.cnaesSecundarios : []),
      ...cnaesStorageCache,
      ...cnaesExtrasApi,
    ]
      .filter(Boolean)
      .map((item: any) => (typeof item === 'string' ? item : item?.descricao || item?.text || ''))
      .filter(Boolean);
    return Array.from(new Set(todos)).slice(0, 8);
  }, [selectedCompany, cnaesStorageCache, cnaesExtrasApi]);

  const companyProfileDraft: RadarPerfilDraft = useMemo(() => {
    const emp = selectedCompany as any;
    const ramos = Array.isArray(emp?.nicho) ? emp.nicho.filter(Boolean) : [];
    const palavras = Array.isArray(emp?.palavrasChave)
      ? emp.palavrasChave.filter(Boolean)
      : Array.isArray(emp?.palavras_chave)
        ? emp.palavras_chave.filter(Boolean)
        : [];
    const tipos = Array.isArray(emp?.radarTiposObjeto)
      ? emp.radarTiposObjeto.filter((t: string) => t === 'BENS' || t === 'SERVICOS' || t === 'OBRAS')
      : [];
    const regioes = Array.isArray(emp?.regioes) && emp.regioes.length > 0
      ? emp.regioes.filter(Boolean)
      : (emp?.uf ? [String(emp.uf).toUpperCase()] : []);

    return {
      ramos,
      palavras,
      tiposObjeto: tipos as ObjectTypeOption[],
      incluirSemClassificacao: emp?.radarIncluirSemClassificacao ?? true,
      ufs: regioes,
    };
  }, [selectedCompany]);

  const currentModalDraft: RadarPerfilDraft = useMemo(() => {
    return {
      ramos: companyProfileDraft.ramos,
      palavras: palavrasPerfil.length > 0 ? palavrasPerfil : companyProfileDraft.palavras,
      tiposObjeto:
        tipoObjetoAtivo !== 'TODAS'
          ? [tipoObjetoAtivo]
          : companyProfileDraft.tiposObjeto,
      incluirSemClassificacao,
      ufs: ufsSelecionadas.length > 0 ? ufsSelecionadas : companyProfileDraft.ufs,
    };
  }, [companyProfileDraft, palavrasPerfil, tipoObjetoAtivo, incluirSemClassificacao, ufsSelecionadas]);

  const carregarSalvos = useCallback(async () => {
    try {
      const resp = await crmApi.getOportunidades();
      const lista = resp?.data?.items || resp?.data?.data || resp?.data || [];
      if (Array.isArray(lista)) {
        const mapa: Record<string, string> = {};
        lista.forEach((op: any) => {
          const nId = op.noticeId || op.editalId || op.notice?.id;
          if (nId && op.id) {
            mapa[String(nId)] = String(op.id);
          }
        });
        setSalvosMap(mapa);
      }
    } catch {
      // Carregamento resiliente
    }
  }, []);

  const executarBusca = useCallback(async (paginaAlvo: number, tempoRealForcado = false) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestSeqRef.current;

    setCarregando(true);
    setErroBusca(null);

    try {
      const params: Record<string, any> = {
        limit: 50,
        tamanhoPagina: 50,
        pagina: paginaAlvo,
        page: paginaAlvo,
        apenasAbertos,
        ordenarPor: ordenacao,
        incluirSemClassificacao,
        ...(tempoRealForcado ? { tempoReal: true } : { local: true }),
      };

      if (palavraChaveDebounced.trim()) params.q = palavraChaveDebounced.trim();
      if (palavrasPerfil.length > 0) params.palavras = palavrasPerfil.join(',');
      if (ufsSelecionadas.length > 0) params.uf = ufsSelecionadas.join(',');
      if (orgaoDebounced.trim()) params.orgao = orgaoDebounced.trim();
      if (fonteAtiva !== 'TODAS') params.fonte = fonteAtiva;
      if (modalidadeAtiva !== 'TODAS' && modalidadeAtiva !== 'SRP' && modalidadeAtiva !== 'BAIXA_PROCURA') {
        params.modalidade = modalidadeAtiva;
      }
      if (modalidadeAtiva === 'SRP') params.srp = true;
      if (modalidadeAtiva === 'BAIXA_PROCURA') params.baixaProcura = true;
      if (tipoObjetoAtivo !== 'TODAS') params.tipoObjeto = tipoObjetoAtivo;
      if (modoRemoto !== 'TODOS') params.modoRemoto = modoRemoto;
      if (dataPublicacao) params.dataPublicacao = dataPublicacao;

      const resposta = await licitacoesApi.listar(params, { signal: controller.signal });
      if (controller.signal.aborted || reqId !== requestSeqRef.current) return;

      const lista: EditalItem[] =
        resposta?.data?.items || resposta?.data?.data || (Array.isArray(resposta?.data) ? resposta.data : []);
      const totalResp = Number(resposta?.data?.meta?.totalRegistros ?? resposta?.data?.total ?? lista.length);
      const totalPgsResp = Number(
        resposta?.data?.meta?.totalPaginas ?? Math.max(1, Math.ceil(totalResp / 50)),
      );
      const facetsResp: RadarFacets | null = resposta?.data?.meta?.facets ?? null;
      const avisoBackend = resposta?.data?.meta?.aviso || '';

      setEditais(lista);
      setTotal(totalResp);
      setTotalPaginas(Math.max(1, totalPgsResp));
      setFacets(facetsResp);
      if (avisoBackend) exibirAviso('info', avisoBackend);
    } catch (err: any) {
      if (
        controller.signal.aborted ||
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        reqId !== requestSeqRef.current
      ) {
        return;
      }
      setEditais([]);
      setTotal(0);
      setTotalPaginas(1);
      setFacets(null);
      const msg =
        err?.response?.data?.message ||
        'Não foi possível consultar os editais com esses filtros. Tente novamente.';
      setErroBusca(msg);
      exibirAviso('erro', msg);
    } finally {
      if (reqId === requestSeqRef.current && !controller.signal.aborted) {
        setCarregando(false);
      }
    }
  }, [
    apenasAbertos,
    ordenacao,
    incluirSemClassificacao,
    palavraChaveDebounced,
    palavrasPerfil,
    ufsSelecionadas,
    orgaoDebounced,
    fonteAtiva,
    modalidadeAtiva,
    tipoObjetoAtivo,
    modoRemoto,
    dataPublicacao,
    exibirAviso,
  ]);

  useEffect(() => {
    void carregarSalvos();
    return () => {
      abortControllerRef.current?.abort();
      if (syncPollTimerRef.current) clearInterval(syncPollTimerRef.current);
    };
  }, [carregarSalvos]);

  useEffect(() => {
    void executarBusca(pagina, false);
  }, [executarBusca, pagina, searchNonce]);

  const handleSincronizarPncp = async () => {
    setSincronizando(true);
    try {
      const resp = await licitacoesApi.sincronizar({
        async: true,
        q: palavraChave.trim() || undefined,
        uf: ufsSelecionadas.join(',') || undefined,
      });

      if (resp?.status === 202 || resp?.data?.status === 'started' || resp?.data?.status === 'already_running') {
        exibirAviso('info', 'Sincronização em segundo plano iniciada! Você pode continuar filtrando normalmente.');
        if (syncPollTimerRef.current) clearInterval(syncPollTimerRef.current);
        let ticks = 0;
        syncPollTimerRef.current = setInterval(async () => {
          ticks += 1;
          try {
            const st = await licitacoesApi.statusSincronizacao();
            const running = Boolean(st?.data?.data?.running);
            if (!running || ticks >= 12) {
              if (syncPollTimerRef.current) {
                clearInterval(syncPollTimerRef.current);
                syncPollTimerRef.current = null;
              }
              setSincronizando(false);
              setSearchNonce((n) => n + 1);
              if (!running) {
                const qtd = st?.data?.data?.lastTotalSincronizados;
                const txt = typeof qtd === 'number'
                  ? `Base atualizada (${qtd} editais processados)!`
                  : 'Base de editais atualizada com sucesso!';
                exibirAviso('sucesso', txt);
                toast.success(txt);
              }
            }
          } catch {
            if (ticks >= 12) {
              if (syncPollTimerRef.current) {
                clearInterval(syncPollTimerRef.current);
                syncPollTimerRef.current = null;
              }
              setSincronizando(false);
            }
          }
        }, 2500);
        return;
      }

      setSincronizando(false);
      setSearchNonce((n) => n + 1);
      toast.success('Base de editais atualizada com sucesso!');
    } catch {
      setSincronizando(false);
      exibirAviso('info', 'O portal nacional está com resposta lenta no momento. Tente novamente em instantes.');
    }
  };

  const handleLimparFiltros = () => {
    setPalavraChave('');
    setPalavraChaveDebounced('');
    setPalavrasPerfil([]);
    setCnaeChipAtivo(null);
    setUfsSelecionadas([]);
    setOrgaoFiltro('');
    setOrgaoDebounced('');
    setFonteAtiva('TODAS');
    setApenasAbertos(true);
    setModalidadeAtiva('TODAS');
    setTipoObjetoAtivo('TODAS');
    setModoRemoto('TODOS');
    setIncluirSemClassificacao(true);
    setDataPublicacao('');
    setOrdenacao('recentes');
    setPerfilAtivo(false);
    setPagina(1);
    setSearchNonce((n) => n + 1);
  };

  const handleToggleMeuPerfil = () => {
    if (perfilAtivo) {
      setPerfilAtivo(false);
      setPalavrasPerfil([]);
      setUfsSelecionadas([]);
      setTipoObjetoAtivo('TODAS');
      setCnaeChipAtivo(null);
      setPagina(1);
      return;
    }

    const kws = companyProfileDraft.palavras.length > 0
      ? companyProfileDraft.palavras
      : extrairPalavrasChaveCnaes(selectedCompany, cnaesStorageCache);

    if (kws.length === 0 && companyProfileDraft.ufs.length === 0 && companyProfileDraft.tiposObjeto.length === 0) {
      setModalPerfilAberto(true);
      return;
    }

    setPalavrasPerfil(kws);
    setUfsSelecionadas(companyProfileDraft.ufs);
    setTipoObjetoAtivo(
      companyProfileDraft.tiposObjeto.length === 1 ? companyProfileDraft.tiposObjeto[0] : 'TODAS',
    );
    setIncluirSemClassificacao(companyProfileDraft.incluirSemClassificacao);
    setOrdenacao('relevancia');
    setPerfilAtivo(true);
    setCnaeChipAtivo(null);
    setPagina(1);
  };

  const handleAplicarDraftPerfil = (draft: RadarPerfilDraft) => {
    setPalavrasPerfil(draft.palavras);
    setUfsSelecionadas(draft.ufs);
    setTipoObjetoAtivo(draft.tiposObjeto.length === 1 ? draft.tiposObjeto[0] : 'TODAS');
    setIncluirSemClassificacao(draft.incluirSemClassificacao);
    setPerfilAtivo(draft.palavras.length > 0 || draft.ufs.length > 0 || draft.tiposObjeto.length > 0);
    setCnaeChipAtivo(null);
    setPagina(1);
    setSearchNonce((n) => n + 1);
  };

  const handleAlternarSalvar = async (edital: EditalItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const idEdital = String(edital.id);
    const oportunidadeId = salvosMap[idEdital];
    setSalvandoId(idEdital);

    try {
      if (oportunidadeId) {
        await crmApi.removeOportunidade(oportunidadeId);
        setSalvosMap((prev) => {
          const novo = { ...prev };
          delete novo[idEdital];
          return novo;
        });
        exibirAviso('info', 'Edital removido das suas oportunidades salvas.');
        toast('Edital removido das oportunidades salvas.');
      } else {
        const urlOficialPncp = buildOfficialPncpPortalUrl(edital);
        const orgaoNome =
          edital.orgao ||
          edital.nomeOrgao ||
          edital.buyerName ||
          edital.orgaoEntidade?.razaoSocial ||
          edital.orgaoNome ||
          'Órgão Licitante';
        const orgaoCnpj =
          edital.cnpjOrgao ||
          edital.buyerDocument ||
          edital.orgaoEntidade?.cnpj ||
          edital.orgaoCnpj;

        const respSalvar = await licitacoesApi.salvar({
          id: idEdital,
          numeroControlePNCP: edital.numeroControlePNCP || edital.numeroEdital || idEdital,
          orgao: orgaoNome,
          cnpjOrgao: orgaoCnpj,
          modalidade: edital.modalidadeNome || edital.modalidade || 'Pregão Eletrônico',
          objeto: edital.objetoCompra || edital.objeto || 'Objeto da licitação',
          valorEstimado: edital.valorTotalEstimado ?? edital.valorEstimado ?? null,
          dataLimite: edital.dataEncerramentoProposta || edital.dataEncerramento || null,
          urlOficialPncp,
          uf: edital.unidadeOrgao?.ufSigla || edital.uf,
          municipio: edital.unidadeOrgao?.municipioNome || edital.municipio,
        }).catch(() =>
          crmApi.createOportunidade({
            noticeId: idEdital,
            stage: 'ANALISE',
            notes: edital.objetoCompra || edital.objeto || '',
          })
        );

        const novoId =
          (respSalvar as any)?.data?.data?.pipelineId ||
          (respSalvar as any)?.data?.id ||
          (respSalvar as any)?.data?.data?.id ||
          idEdital;
        setSalvosMap((prev) => ({
          ...prev,
          [idEdital]: String(novoId),
        }));
        exibirAviso('sucesso', 'Edital salvo na sua Gestão de Disputas!');
        toast.success('Edital salvo na sua Gestão de Disputas!');
      }
    } catch {
      exibirAviso('erro', 'Não foi possível atualizar este edital nos seus processos.');
    } finally {
      setSalvandoId(null);
    }
  };

  const temFiltroAtivo = Boolean(
    palavraChave ||
      palavrasPerfil.length > 0 ||
      ufsSelecionadas.length > 0 ||
      orgaoFiltro ||
      fonteAtiva !== 'TODAS' ||
      !apenasAbertos ||
      modalidadeAtiva !== 'TODAS' ||
      tipoObjetoAtivo !== 'TODAS' ||
      modoRemoto !== 'TODOS' ||
      dataPublicacao ||
      perfilAtivo,
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Cabeçalho */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#081C3A]">
              {tituloCustomizado || 'Radar de Editais'}
            </h1>
            <p className="mt-1 text-sm sm:text-base font-medium text-slate-600">
              Encontre oportunidades certas para o seu setor em órgãos públicos de todo o Brasil.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleMeuPerfil}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                perfilAtivo
                  ? 'border-[#0070C0] bg-[#0070C0] text-white shadow-sm'
                  : 'border-slate-200 bg-white text-[#081C3A] hover:border-[#0070C0]'
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              {perfilAtivo ? 'Meu Perfil ativo' : 'Filtrar pelo Meu Perfil'}
            </button>

            <button
              type="button"
              onClick={() => setModalPerfilAberto(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#081C3A] shadow-xs transition hover:border-[#FF6600] hover:text-[#FF6600] cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              Configurar Ramos & Alertas
            </button>

            <button
              type="button"
              onClick={handleSincronizarPncp}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 rounded-full bg-[#081C3A] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f2b56] disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? 'Atualizando em 2º plano...' : 'Atualizar editais'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await api.post('/licitacoes/enviar-alerta-agora');
                  exibirAviso('sucesso', r.data?.message || 'Alertas enviados para o seu e-mail!');
                } catch (e: any) {
                  exibirAviso('erro', e?.response?.data?.message || 'Não foi possível enviar o alerta por e-mail.');
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#0070C0] bg-white px-4 py-2 text-xs font-bold text-[#0070C0] hover:bg-blue-50 transition cursor-pointer"
            >
              Receber no E-mail
            </button>
          </div>
        </div>

        {/* Indicadores Reais do Radar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Editais no Radar</p>
              <p className="mt-1 text-2xl font-extrabold text-[#081C3A]">{total.toLocaleString('pt-BR')}</p>
            </div>
            <span className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0070C0]">Multi-Portal</span>
          </div>
          <div className="rounded-2xl border border-emerald-200/80 bg-white px-5 py-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Encerrando em 48h</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                {(facets?.encerrando48h ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <Clock className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-white px-5 py-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Encerrando em 5 dias</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-700">
                {(facets?.encerrando5Dias ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <span className="h-3 w-3 rounded-full bg-amber-500" />
          </div>
        </div>

        {/* Notificação Temporária */}
        {aviso && (
          <div
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${
              aviso.tipo === 'sucesso'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : aviso.tipo === 'erro'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} className="ml-4 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Barra de Filtros */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPalavraChaveDebounced(palavraChave);
              setOrgaoDebounced(orgaoFiltro);
              setPagina(1);
              setSearchNonce((n) => n + 1);
            }}
            className="flex flex-col gap-3 md:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={palavraChave}
                onChange={(e) => setPalavraChave(e.target.value)}
                placeholder="Buscar editais por produto, serviço, CNPJ ou objeto (ex: vestuário, informática, engenharia)..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-[#081C3A] outline-none transition focus:border-[#0070C0] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C2410C] px-7 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00] cursor-pointer"
            >
              Buscar editais
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={orgaoFiltro}
                onChange={(e) => setOrgaoFiltro(e.target.value)}
                placeholder="Órgão comprador (ex: Prefeitura, Tribunal)"
                className="rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none focus:border-[#0070C0]"
              />
            </div>

            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                aria-label="Filtrar por Estado"
                value={ufsSelecionadas.length === 1 ? ufsSelecionadas[0] : ufsSelecionadas.length > 1 ? '__MULTI__' : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) setUfsSelecionadas([]);
                  else if (v !== '__MULTI__') setUfsSelecionadas([v]);
                  setPagina(1);
                }}
                className="appearance-none rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-[#0070C0] cursor-pointer"
              >
                <option value="">Todos os Estados</option>
                {ufsSelecionadas.length > 1 && (
                  <option value="__MULTI__">Estados: {ufsSelecionadas.join(', ')}</option>
                )}
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    Estado: {uf}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setMostrarFiltrosExtras((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-[#0070C0] hover:text-[#0070C0] cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Data de publicação
            </button>

            <select
              aria-label="Portal de origem"
              value={fonteAtiva}
              onChange={(e) => {
                setFonteAtiva(e.target.value as any);
                setPagina(1);
              }}
              className="appearance-none rounded-full border border-slate-200 bg-white py-2 px-4 text-xs font-medium text-slate-700 outline-none focus:border-[#0070C0] cursor-pointer"
            >
              <option value="TODAS">Todos os Portais</option>
              <option value="PNCP">PNCP Oficial</option>
              <option value="ComprasGov">Compras.gov.br</option>
              <option value="querido_diario">Diários Oficiais (Municípios)</option>
            </select>

            <select
              value={modoRemoto}
              onChange={(e) => {
                setModoRemoto(e.target.value as 'TODOS' | 'DISPUTA_ONLINE' | 'REMOTO_100');
                setPagina(1);
              }}
              aria-label="Formato de disputa e entrega"
              className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#081C3A] outline-none focus:border-[#0070C0]"
            >
              <option value="TODOS">Todos os formatos</option>
              <option value="DISPUTA_ONLINE">Disputa Online (Sessão Eletrônica)</option>
              <option value="REMOTO_100">100% Remoto (Disputa e Entrega sem Presença Física)</option>
            </select>

            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:border-[#0070C0]">
              <input
                type="checkbox"
                checked={apenasAbertos}
                onChange={(e) => {
                  setApenasAbertos(e.target.checked);
                  setPagina(1);
                }}
                className="h-3.5 w-3.5 accent-[#0070C0]"
              />
              Somente abertos
            </label>

            {temFiltroAtivo && (
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="px-3 py-2 text-xs font-semibold text-[#FF6600] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Chips de estados e palavras do perfil ativos */}
          {(ufsSelecionadas.length > 0 || palavrasPerfil.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {ufsSelecionadas.map((uf) => (
                <span
                  key={`uf-${uf}`}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#0070C0]"
                >
                  UF: {uf}
                  <button
                    type="button"
                    onClick={() => {
                      setUfsSelecionadas((prev) => prev.filter((item) => item !== uf));
                      setPagina(1);
                    }}
                    className="hover:text-[#081C3A] cursor-pointer"
                    aria-label={`Remover estado ${uf}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {palavrasPerfil.map((kw) => (
                <span
                  key={`kw-${kw}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-[#081C3A]"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => {
                      const next = palavrasPerfil.filter((item) => item !== kw);
                      setPalavrasPerfil(next);
                      if (next.length === 0) setPerfilAtivo(false);
                      setPagina(1);
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                    aria-label={`Remover termo ${kw}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {mostrarFiltrosExtras && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Calendar className="h-4 w-4 text-[#0070C0]" />
                Publicado a partir de:
                <input
                  type="date"
                  value={dataPublicacao}
                  onChange={(e) => {
                    setDataPublicacao(e.target.value);
                    setPagina(1);
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0070C0]"
                />
              </label>
            </div>
          )}

          {listaCnaesEmpresa.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Atividades da Empresa (CNAEs) — clique para filtrar ou desativar
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {listaCnaesEmpresa.map((cnae, idx) => {
                  const ativo = cnaeChipAtivo === cnae;
                  return (
                    <motion.button
                      key={`${selectedCompany?.cnpj || 'default'}-${idx}`}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (ativo) {
                          setCnaeChipAtivo(null);
                          setPalavrasPerfil([]);
                          setPagina(1);
                          return;
                        }
                        const termos = expandirSinonimosRamo('', { cnaePrincipal: cnae }, []);
                        const fallback = extrairPalavrasChaveCnaes({ cnaePrincipal: cnae }, []);
                        const listaTermos = termos.length > 0 ? termos : fallback;
                        if (listaTermos.length === 0) return;
                        setCnaeChipAtivo(cnae);
                        setPalavrasPerfil(listaTermos);
                        setPalavraChave('');
                        setPalavraChaveDebounced('');
                        setPagina(1);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all border cursor-pointer ${
                        ativo
                          ? 'border-[#0070C0] bg-[#0070C0] text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-[#0070C0]/50 hover:bg-[#0070C0]/5'
                      }`}
                    >
                      {cnae}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {MODALIDADES_RAPIDAS.map((mod) => {
              const Icon = mod.icon;
              const ativa = modalidadeAtiva === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setModalidadeAtiva(mod.id);
                    setPagina(1);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold transition cursor-pointer ${
                    ativa
                      ? 'border-[#0070C0] bg-blue-50/70 text-[#0070C0] shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${ativa ? 'text-[#0070C0]' : 'text-slate-500'}`} />
                  <span className="text-center leading-tight">{mod.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Abas de Tipo de Objeto (Todas | Bens | Serviços | Obras) com contagens reais */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'TODAS', label: 'Todas', count: facets?.todas ?? total },
                { id: 'BENS', label: 'Bens', count: facets?.bens ?? 0 },
                { id: 'SERVICOS', label: 'Serviços', count: facets?.servicos ?? 0 },
                { id: 'OBRAS', label: 'Obras', count: facets?.obras ?? 0 },
              ] as const
            ).map((tab) => {
              const active = tipoObjetoAtivo === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTipoObjetoAtivo(tab.id);
                    setPagina(1);
                  }}
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition cursor-pointer ${
                    active
                      ? 'border-[#081C3A] text-[#081C3A]'
                      : 'border-transparent text-slate-500 hover:text-[#081C3A]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                      active ? 'bg-[#081C3A] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count.toLocaleString('pt-BR')}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {facets && facets.novas24h > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {facets.novas24h.toLocaleString('pt-BR')} novas em 24h
              </span>
            )}

            {tipoObjetoAtivo !== 'TODAS' && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirSemClassificacao}
                  onChange={(e) => {
                    setIncluirSemClassificacao(e.target.checked);
                    setPagina(1);
                  }}
                  className="h-3.5 w-3.5 accent-[#0070C0]"
                />
                + sem classificação ({(facets?.semClassificacao ?? 0).toLocaleString('pt-BR')})
              </label>
            )}

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setVisualizacao('detalhada')}
                className={`rounded-lg p-1.5 cursor-pointer ${
                  visualizacao === 'detalhada' ? 'bg-slate-100 text-[#081C3A]' : 'text-slate-400'
                }`}
                aria-label="Visualização detalhada"
                title="Visualização detalhada"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setVisualizacao('compacta')}
                className={`rounded-lg p-1.5 cursor-pointer ${
                  visualizacao === 'compacta' ? 'bg-slate-100 text-[#081C3A]' : 'text-slate-400'
                }`}
                aria-label="Visualização compacta"
                title="Visualização compacta"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quantidade e Ordenação (100% Server-Side) */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            <p>
              <span className="text-[#081C3A]">{total.toLocaleString('pt-BR')}</span>{' '}
              {total === 1 ? 'edital encontrado' : 'editais encontrados'}
              {editais.length > 0 && editais.length < total && (
                <span className="font-normal text-slate-500"> (exibindo {editais.length} nesta página)</span>
              )}
              {palavraChaveDebounced.trim() && (
                <span className="font-normal text-slate-400"> para “{palavraChaveDebounced.trim()}”</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Ordenar por</span>
            <select
              aria-label="Ordenar por"
              value={ordenacao}
              onChange={(e) => {
                setOrdenacao(e.target.value as any);
                setPagina(1);
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#081C3A] outline-none focus:border-[#0070C0] cursor-pointer"
            >
              <option value="recentes">Mais recentes</option>
              <option value="encerramento">Encerramento mais próximo</option>
              <option value="maior_valor">Maior valor estimado</option>
              <option value="menor_valor">Menor valor estimado</option>
              <option value="relevancia">Mais aderentes ao perfil</option>
            </select>
          </div>
        </div>

        {/* Lista de Editais */}
        {carregando ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
            ))}
          </div>
        ) : erroBusca ? (
          <div className="rounded-3xl border border-red-200 bg-red-50/70 p-10 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <h3 className="mt-3 text-base font-bold text-red-900">Falha ao consultar o Radar</h3>
            <p className="mt-1 text-sm text-red-700">{erroBusca}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setSearchNonce((n) => n + 1)}
                className="rounded-full bg-[#081C3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2b56] cursor-pointer"
              >
                Tentar novamente
              </button>
              {temFiltroAtivo && (
                <button
                  type="button"
                  onClick={handleLimparFiltros}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        ) : editais.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-[#081C3A]">
              {palavraChaveDebounced.trim()
                ? `Nenhum edital encontrado para “${palavraChaveDebounced.trim()}”`
                : 'Nenhum edital encontrado para esses filtros'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Ajuste os filtros aplicados, expanda os estados selecionados ou consulte o PNCP em tempo real.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {ufsSelecionadas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setUfsSelecionadas([]);
                    setPagina(1);
                  }}
                  className="rounded-full border border-[#0070C0] bg-blue-50 px-5 py-2.5 text-sm font-semibold text-[#0070C0] hover:bg-blue-100 cursor-pointer"
                >
                  Expandir para todo o Brasil
                </button>
              )}
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                onClick={() => void executarBusca(1, true)}
                className="rounded-full bg-[#0070C0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005ea3] cursor-pointer"
              >
                Buscar no PNCP agora
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {editais.map((edital) => {
              const idStr = String(edital.id);
              const estaSalvo = Boolean(salvosMap[idStr]);
              const salvandoEste = salvandoId === idStr;

              const orgao =
                edital.orgao ||
                edital.nomeOrgao ||
                edital.buyerName ||
                edital.orgaoEntidade?.razaoSocial ||
                edital.orgaoNome ||
                'Órgão Licitante';

              const cnpjOrgao =
                edital.cnpjOrgao ||
                edital.buyerDocument ||
                edital.orgaoEntidade?.cnpj ||
                edital.orgaoCnpj;

              const numeroEdital =
                edital.numeroEdital ||
                edital.numeroCompra ||
                edital.processo ||
                edital.numeroControlePNCP ||
                idStr;

              const dataPublicacaoReal =
                edital.dataPublicacao ||
                edital.data_publicacao ||
                edital.dataPublicacaoPncp ||
                edital.publishedAt ||
                edital.createdAt;

              const dataInicio =
                edital.dataAbertura ||
                edital.data_abertura ||
                edital.dataAberturaProposta;
              const dataEncerramento =
                edital.dataEncerramento ||
                edital.data_encerramento ||
                edital.dataEncerramentoProposta ||
                edital.dataLimiteProposta ||
                edital.dataSessaoDisputa;

              const uf = edital.unidadeOrgao?.ufSigla || edital.uf || 'BR';
              const municipio = edital.unidadeOrgao?.municipioNome || edital.municipio || '';
              const modalidade =
                edital.modalidadeNome ||
                edital.modalidade ||
                edital.nomeModalidade ||
                'Pregão Eletrônico';
              const objeto = edital.objetoCompra || edital.objeto || 'Objeto não informado';
              const valor =
                edital.valorTotalEstimado ??
                edital.valorEstimado ??
                edital.valor_estimado ??
                edital.estimatedValue;
              const tipoBadge = getTipoObjetoLabel(edital.tipoObjeto);

              const urlOficialPncp = buildOfficialPncpPortalUrl(edital);

              if (visualizacao === 'compacta') {
                return (
                  <div
                    key={idStr}
                    onClick={() => abrirAnaliseCompletaEdital(edital)}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs transition hover:border-[#0070C0] sm:flex-row sm:items-center cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-[#081C3A]">
                          {modalidade}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                          {getSourceBadgeLabel(edital.fonte || edital.source)}
                        </span>
                        {tipoBadge && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                            {tipoBadge}
                          </span>
                        )}
                        {edital.metadata?.executionMode === 'REMOTE' ? (
                          <span
                            title={edital.metadata?.executionEvidence || 'Execução remota comprovada no texto do edital'}
                            className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-[#0070C0]"
                          >
                            100% Remoto Comprovado
                          </span>
                        ) : edital.metadata?.isRemoteDispute === true ? (
                          <span
                            title={edital.metadata?.executionEvidence || 'Disputa eletrônica comprovada no texto do edital'}
                            className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700"
                          >
                            Disputa Online
                          </span>
                        ) : null}
                        <span className="font-semibold text-slate-600">
                          {municipio ? `${municipio} - ${uf}` : uf}
                        </span>
                      </div>
                      <h3 className="truncate text-sm font-bold text-[#081C3A]">{objeto}</h3>
                      <p className="truncate text-xs text-slate-500">
                        {orgao} • Encerramento: {formatarDataHora(dataEncerramento)} •{' '}
                        <strong className="text-[#0070C0]">{formatarMoeda(valor)}</strong>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={urlOficialPncp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-download-edital btn-link-pncp rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0070C0] hover:border-[#0070C0]"
                      >
                        Portal Oficial ↗
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleAlternarSalvar(edital, e)}
                        disabled={salvandoEste}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          estaSalvo
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-[#FF6600]'
                        }`}
                      >
                        {estaSalvo ? 'Salvo' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idStr}
                  onClick={() => abrirAnaliseCompletaEdital(edital)}
                  className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#FF6600]/60 hover:shadow-md cursor-pointer overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0070C0]" />

                  {/* Linha 1: Badges e Botões de Ação */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#081C3A]">
                        {modalidade}
                      </span>

                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 border border-indigo-100">
                        {getSourceBadgeLabel(edital.fonte || edital.source)}
                      </span>

                      {tipoBadge && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                          {tipoBadge}
                        </span>
                      )}

                      {edital.srp && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0070C0]">
                          Registro de Preços
                        </span>
                      )}

                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md">
                        {numeroEdital}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={urlOficialPncp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-download-edital btn-link-pncp inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0070C0] hover:border-[#0070C0] hover:bg-blue-50 transition"
                        title="Acessar Edital Oficial no PNCP ↗"
                      >
                        <span>Ver no Portal Oficial do PNCP ↗</span>
                        <span className="sr-only">Acessar Edital Oficial no PNCP ↗</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      <button
                        type="button"
                        onClick={(e) => handleAlternarSalvar(edital, e)}
                        disabled={salvandoEste}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                          estaSalvo
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-[#FF6600] hover:text-[#FF6600]'
                        }`}
                        title={estaSalvo ? 'Edital salvo nas suas oportunidades' : 'Salvar edital para gerar proposta'}
                      >
                        {salvandoEste ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : estaSalvo ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Salvo p/ Proposta</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-3.5 w-3.5" />
                            <span>Salvar p/ Proposta</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Linha 2: Objeto e Órgão */}
                  <div className="pl-2 space-y-1.5">
                    <h3 className="text-base font-bold text-[#081C3A] leading-snug group-hover:text-[#0070C0] transition-colors">
                      {objeto}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-1.5 text-[#081C3A] font-semibold">
                        <Building2 className="h-4 w-4 text-[#0070C0] shrink-0" />
                        <span>{orgao}</span>
                      </div>
                      {cnpjOrgao && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          • CNPJ: {formatCnpj(cnpjOrgao)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Linha 3: Informações Operacionais */}
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 pl-2 sm:grid-cols-5">
                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Localidade</p>
                      <p className="text-xs font-bold text-[#081C3A]">
                        {municipio ? `${municipio} - ${uf}` : uf}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Data de Publicação</p>
                      <p className="text-xs font-semibold text-slate-700">
                        {formatarDataHora(dataPublicacaoReal)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Início Propostas</p>
                      <p className="text-xs font-semibold text-slate-700">
                        {formatarData(dataInicio || dataPublicacaoReal)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Encerramento / Sessão</p>
                      <p className="text-xs font-semibold text-[#081C3A]">
                        {formatarDataHora(dataEncerramento)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Valor Estimado</p>
                      <p className="text-xs font-extrabold text-[#0070C0]">
                        {formatarMoeda(valor)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {totalPaginas > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
                <span className="text-xs font-semibold text-slate-600">
                  Página <strong className="text-[#081C3A]">{pagina}</strong> de{' '}
                  <strong className="text-[#081C3A]">{totalPaginas}</strong> • {total.toLocaleString('pt-BR')} editais disponíveis
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pagina <= 1 || carregando}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-[#081C3A] hover:border-[#0070C0] disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pagina >= totalPaginas || carregando}
                    onClick={() => setPagina((p) => p + 1)}
                    className="rounded-full bg-[#081C3A] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#0f2b56] disabled:opacity-40 cursor-pointer"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rodapé Transparente de Fontes Governamentais e Aviso Legal */}
        <footer className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-600 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black uppercase tracking-wider text-[#081C3A]">Fontes Oficiais Integradas:</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-[#081C3A]">PNCP (Lei 14.133/2021)</span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-[#0070C0]">Compras.gov.br (SIASG)</span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-700">Querido Diário (Diários Oficiais Municipais)</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700">Portal da Transparência (CGU)</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Sincronização contínua multiportal
            </span>
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500">
            <strong>Aviso Legal de Conferência Obrigatória:</strong> Os dados exibidos são consolidados automaticamente das bases públicas oficiais (PNCP, Compras.gov.br, CGU e Diários Oficiais). Antes de enviar proposta ou participar da sessão pública, confira sempre a íntegra do edital, anexos, retificações e prazos diretamente no portal oficial do órgão promotor.
          </p>
        </footer>
      </div>

      {/* Modal de Perfil Inteligente / Ramos & Alertas */}
      <RadarPerfilModal
        isOpen={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        company={selectedCompany}
        initialDraft={currentModalDraft}
        onApply={handleAplicarDraftPerfil}
      />
    </div>
  );
}
