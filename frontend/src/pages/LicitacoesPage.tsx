import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
    Search, Filter, RefreshCw, Building2, Calendar,
    MapPin, AlertTriangle,
    ChevronDown, Clock, ExternalLink, Download, FileText,
    Plus, CheckCircle2,
} from '@components/icons/phosphor-compat';
import { lexApi, licitacoesApi, crmApi, propostasApi, noticesApi } from '../services/api';
import { useCompany } from '@/contexts/CompanyContext';
import EditalQuickViewModal, { type QuickViewNotice } from '@/components/EditalQuickViewModal';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';
import toast from 'react-hot-toast';

type Licitacao = {
    id: string;
    objeto: string;
    orgao: string;
    cnpjOrgao?: string | null;
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
    documento_url?: string | null;
    linkDownloadEdital?: string | null;
    numeroControlePNCP?: string;
    numeroEdital?: string | null;
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
    cnpj: string;
    cnae: string;
    uf: string;
    modalidade: string;
};

const MODALIDADES = [
    'Todos', 'Pregão Eletrônico', 'Dispensa Eletrônica', 'Concorrência', 'Credenciamento',
];
const UFS = [
    'Todos', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

function resolveEditalDownloadUrl(item: Licitacao): string | null {
    const explicit =
        item.linkDownloadEdital ||
        item.documento_url ||
        item.linkSistemaOrigem ||
        item.link;

    const numPncp = (item.numeroControlePNCP || (item as any).numero_controle_pncp || '').trim();
    const match = numPncp.match(/^(\d{14})-\d+-(\d+)[/-](\d{4})$/);
    if (match) {
        const [, cnpj, sequencial, ano] = match;
        return `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${Number(sequencial)}/arquivos/1`;
    }

    if (explicit && explicit.trim()) {
        return explicit.trim();
    }

    if (numPncp) {
        return `https://pncp.gov.br/app/editais/${encodeURIComponent(numPncp)}`;
    }

    return null;
}

function StatusBadge({ situacao }: { situacao?: string }) {
    const s = (situacao || '').toLowerCase();
    const isActive = s.includes('publicad') || s.includes('ativ') || s.includes('aberta') || s.includes('divulgad');
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${isActive
            ? 'bg-blue-50/70 text-brand-blue border border-brand-blue/20'
            : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-brand-blue animate-pulse' : 'bg-slate-400'}`} />
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
    const [cnpjFiltro, setCnpjFiltro] = useState('');
    const [cnaeFiltro, setCnaeFiltro] = useState('');
    const [ufSel, setUfSel] = useState('Todos');
    const [modalidadeSel, setModalidadeSel] = useState(modalidadeInicial);

    const [filtrosAplicados, setFiltrosAplicados] = useState<SearchFilters>({
        busca: '',
        cnpj: '',
        cnae: '',
        uf: 'Todos',
        modalidade: modalidadeInicial,
    });

    useEffect(() => {
        if (!modalidadeInicial) return;
        setModalidadeSel(modalidadeInicial);
        setFiltrosAplicados((prev) => {
            if (prev.modalidade === modalidadeInicial) return prev;
            return {
                ...prev,
                modalidade: modalidadeInicial,
            };
        });
    }, [modalidadeInicial]);

    const [showFiltros, setShowFiltros] = useState(true);
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
                    setErroDetalhesEdital('Não foi possível carregar os detalhes do edital.');
                    return;
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
            .catch(() => { });
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
                        cnpj: filtrosAplicados.cnpj || undefined,
                        cnae: filtrosAplicados.cnae || undefined,
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

            const params: Record<string, any> = {
                pagina: pg,
                tamanhoPagina: 20,
            };
            if (filtrosAplicados.busca.trim()) {
                params.busca = filtrosAplicados.busca.trim();
                params.palavraChave = filtrosAplicados.busca.trim();
            }
            if (filtrosAplicados.cnpj.trim()) {
                params.cnpj = filtrosAplicados.cnpj.trim();
            }
            if (filtrosAplicados.cnae.trim()) {
                params.cnae = filtrosAplicados.cnae.trim();
            }
            if (filtrosAplicados.uf !== 'Todos') {
                params.uf = filtrosAplicados.uf;
            }
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
        if (!isValidCnpj(cnpjFiltro, { optional: true })) {
            toast.error('CNPJ inválido. Se preenchido, informe os 14 caracteres alfanuméricos (XX.XXX.XXX/XXXX-XX).');
            return;
        }
        const nextFilters: SearchFilters = {
            busca: busca.trim(),
            cnpj: sanitizeCnpj(cnpjFiltro),
            cnae: cnaeFiltro.trim(),
            uf: ufSel,
            modalidade: modalidadeSel,
        };
        if (
            nextFilters.busca === filtrosAplicados.busca
            && nextFilters.cnpj === filtrosAplicados.cnpj
            && nextFilters.cnae === filtrosAplicados.cnae
            && nextFilters.uf === filtrosAplicados.uf
            && nextFilters.modalidade === filtrosAplicados.modalidade
        ) {
            void buscarLicitacoes(1, true);
            return;
        }
        setFiltrosAplicados(nextFilters);
    };

    const aplicarPerfilEmpresaAtiva = () => {
        if (!selectedCompany) {
            toast.error('Nenhuma empresa ativa selecionada.');
            return;
        }
        const nextCnpj = formatCnpjMask(selectedCompany.cnpj || '');
        const nextCnae = selectedCompany.cnaePrincipal || selectedCompany.cnae_principal || (meta?.perfilRadar?.cnaes?.[0] ?? '');
        const nextUf = selectedCompany.uf && UFS.includes(selectedCompany.uf.toUpperCase())
            ? selectedCompany.uf.toUpperCase()
            : ufSel;

        setCnpjFiltro(nextCnpj);
        setCnaeFiltro(nextCnae);
        setUfSel(nextUf);
        setFiltrosAplicados({
            busca: busca.trim(),
            cnpj: sanitizeCnpj(nextCnpj),
            cnae: nextCnae.trim(),
            uf: nextUf,
            modalidade: modalidadeSel,
        });
        toast.success('Filtros preenchidos com os dados reais da empresa ativa.');
    };

    const limparFiltros = () => {
        const defaultMod = modalidadeInicial || 'Todos';
        const nextFilters: SearchFilters = {
            busca: '',
            cnpj: '',
            cnae: '',
            uf: 'Todos',
            modalidade: defaultMod,
        };
        setBusca('');
        setCnpjFiltro('');
        setCnaeFiltro('');
        setUfSel('Todos');
        setModalidadeSel(defaultMod);
        if (
            nextFilters.busca === filtrosAplicados.busca
            && nextFilters.cnpj === filtrosAplicados.cnpj
            && nextFilters.cnae === filtrosAplicados.cnae
            && nextFilters.uf === filtrosAplicados.uf
            && nextFilters.modalidade === filtrosAplicados.modalidade
        ) {
            void buscarLicitacoes(1, true);
            return;
        }
        setFiltrosAplicados(nextFilters);
    };

    const formatVal = (v?: number | null) =>
        v != null && Number.isFinite(Number(v))
            ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : 'Sigiloso / Não informado';

    const formatDate = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    const diasRestantes = (d?: string | null) => {
        if (!d) return null;
        return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    };

    const tituloPagina = modalidadeInicial && modalidadeInicial !== 'Todos'
        ? `${modalidadeInicial} (Lei 14.133/21)`
        : 'Central de Radar e Oportunidades';

    return (
        <div className="flex flex-col h-full bg-brand-light">

            {/* HEADER E BUSCA DINÂMICA REAL */}
            <div className="bg-white border-b border-gray-100 px-6 lg:px-8 py-5 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{tituloPagina}</h1>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                {meta?.total != null ? (
                                    <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                                        <span className="font-bold text-brand-blue">{meta.total.toLocaleString('pt-BR')}</span> editais oficiais no PNCP
                                        {ultimaAtualizacao && (
                                            <span className="text-xs text-slate-400">· Sincronizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')}</span>
                                        )}
                                    </p>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-500">Alimentação oficial e diária via Portal Nacional de Contratações Públicas (PNCP)</p>
                                )}
                            </div>
                            {meta?.perfilRadar && !busca.trim() && !cnaeFiltro.trim() && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="rounded-lg border border-brand-blue/20 bg-blue-50/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                                        Radar alinhado ao CNAE da empresa
                                    </span>
                                    {(meta.perfilRadar.palavras_chave || []).slice(0, 5).map((tag) => (
                                        <span key={tag} className="rounded-lg border border-gray-100 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-blue/70">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5">
                            {selectedCompany && (
                                <button
                                    type="button"
                                    onClick={aplicarPerfilEmpresaAtiva}
                                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-brand-blue text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-brand-blue/20 shrink-0"
                                    title="Preencher filtros com CNPJ, CNAE e UF da empresa ativa"
                                >
                                    <Building2 className="w-3.5 h-3.5" weight="bold" />
                                    Usar Meu CNPJ/CNAE
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => void buscarLicitacoes(1, true)}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-dark hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} weight="bold" />
                                Sincronizar PNCP
                            </button>
                        </div>
                    </div>

                    {/* FORMULÁRIO DE FILTROS DINÂMICOS REAIS (Palavras-chave, CNPJ, CNAE, UF, Modalidade) */}
                    <form onSubmit={handleBuscar} className="space-y-3">
                        <div className="flex gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[260px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" weight="bold" />
                                <input
                                    type="text"
                                    value={busca}
                                    onChange={e => setBusca(e.target.value)}
                                    placeholder="Palavras-chave (ex: informática, engenharia, limpeza, medicamentos)..."
                                    className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all shadow-xs"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-7 py-3 bg-brand-orange hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-md shadow-brand-orange/20 cursor-pointer"
                            >
                                Consultar PNCP
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowFiltros(!showFiltros)}
                                className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:border-slate-300 transition-all"
                            >
                                <Filter className="w-4 h-4" />
                                Filtros Avançados
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {showFiltros && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 animate-in fade-in duration-150">
                                <div>
                                    <label htmlFor="licitacoes-cnpj-filter" className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        CNPJ (Opcional · Alfanumérico)
                                    </label>
                                    <input
                                        id="licitacoes-cnpj-filter"
                                        type="text"
                                        maxLength={18}
                                        value={cnpjFiltro}
                                        onChange={e => setCnpjFiltro(formatCnpjMask(e.target.value))}
                                        placeholder={selectedCompany?.cnpj ? formatCnpjMask(selectedCompany.cnpj) : 'XX.XXX.XXX/XXXX-XX'}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-blue"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="licitacoes-cnae-filter" className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        CNAE / Ramo de Atividade
                                    </label>
                                    <input
                                        id="licitacoes-cnae-filter"
                                        type="text"
                                        value={cnaeFiltro}
                                        onChange={e => setCnaeFiltro(e.target.value)}
                                        placeholder={selectedCompany?.cnaePrincipal || meta?.perfilRadar?.cnaes?.[0] || 'Ex: 6201-5/01 ou Engenharia'}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-blue"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="licitacoes-uf-filter" className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        UF (Estado)
                                    </label>
                                    <select
                                        id="licitacoes-uf-filter"
                                        aria-label="Filtrar licitações por UF"
                                        value={ufSel}
                                        onChange={e => setUfSel(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-blue"
                                    >
                                        {UFS.map(u => <option key={u} value={u}>{u === 'Todos' ? 'Todas as UFs (Brasil)' : u}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="licitacoes-modalidade-filter" className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        Modalidade
                                    </label>
                                    <select
                                        id="licitacoes-modalidade-filter"
                                        aria-label="Filtrar licitações por modalidade"
                                        value={modalidadeSel}
                                        onChange={e => setModalidadeSel(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-blue"
                                    >
                                        {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-end gap-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
                                    >
                                        Aplicar Filtros
                                    </button>
                                    <button
                                        type="button"
                                        onClick={limparFiltros}
                                        className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* ── CONTEÚDO PRINCIPAL ── */}
            <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
                <div className="max-w-7xl mx-auto">

                    {/* AVISO DE SINCRONIZAÇÃO */}
                    {meta?.aviso && !loading && (
                        <div className={`mb-5 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-200 ${meta.fonte === 'cache'
                            ? 'bg-blue-50/40 border border-brand-blue/20'
                            : 'bg-brand-orange/10 border border-brand-orange/50'
                            }`}>
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-brand-blue" />
                            <div>
                                <p className="text-sm font-bold text-brand-blue">
                                    {meta.fonte === 'cache' ? 'Sincronização PNCP' : 'Aviso de conectividade'}
                                </p>
                                <p className="text-xs mt-0.5 text-slate-600">
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
                                <p className="text-sm font-bold text-slate-800">Consultando Portal Nacional de Contratações Públicas (PNCP)...</p>
                                <p className="text-xs text-slate-500 mt-1">Aplicando filtros reais de CNPJ, CNAE, Palavras-chave e UF</p>
                            </div>
                        </div>
                    )}

                    {/* EMPTY STATE HONESTO E CORPORATIVO */}
                    {!loading && licitacoes.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-6 gap-5 text-center max-w-lg mx-auto bg-slate-50/80 rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="relative p-4 rounded-3xl bg-white shadow-md border border-slate-100">
                                <FileText className="w-14 h-14 text-[#0A2540]" weight="duotone" />
                            </div>

                            <div className="space-y-1.5">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                    Nenhum edital encontrado para os filtros informados.
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                                    A consulta é realizada diretamente na API oficial do PNCP. Ajuste os parâmetros de CNPJ, CNAE, Palavras-chave ou UF e clique em Sincronizar PNCP.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 pt-2 w-full justify-center">
                                <button
                                    type="button"
                                    onClick={limparFiltros}
                                    className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                                >
                                    Limpar Filtros
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void buscarLicitacoes(1, true)}
                                    className="px-5 py-2.5 bg-brand-blue hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xs"
                                >
                                    Sincronizar PNCP Agora
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TABELA CORPORATIVA LIMPA COM DADOS REAIS DO PNCP */}
                    {!loading && licitacoes.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                                            <th className="py-3.5 px-4 whitespace-nowrap">Número do Edital</th>
                                            <th className="py-3.5 px-4">Órgão</th>
                                            <th className="py-3.5 px-4 whitespace-nowrap">Data de Abertura</th>
                                            <th className="py-3.5 px-4 min-w-[280px]">Objeto</th>
                                            <th className="py-3.5 px-4 whitespace-nowrap text-right">Valor Estimado</th>
                                            <th className="py-3.5 px-4 whitespace-nowrap text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {licitacoes.map((item, i) => {
                                            const numeroEdital =
                                                item.numeroEdital ||
                                                item.numeroCompra ||
                                                item.processo ||
                                                item.numeroControlePNCP ||
                                                item.id;
                                            const dataAberturaExibida =
                                                item.dataAbertura ||
                                                item.data_abertura ||
                                                item.dataPublicacao ||
                                                item.data_publicacao;
                                            const dataRef =
                                                item.dataEncerramento ||
                                                item.data_encerramento ||
                                                dataAberturaExibida;
                                            const dias = diasRestantes(dataRef);
                                            const urgente = dias !== null && dias >= 0 && dias <= 3;
                                            const valorExibido = item.valorEstimado ?? item.valor_estimado;
                                            const downloadUrl = resolveEditalDownloadUrl(item);
                                            const pct = item.score?.pontuacao;

                                            return (
                                                <tr
                                                    key={item.id || i}
                                                    onClick={() => {
                                                        setEditalSelecionado(item);
                                                        setResumoRapido(null);
                                                    }}
                                                    className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                                                >
                                                    {/* 1. NÚMERO DO EDITAL */}
                                                    <td className="py-4 px-4 align-top whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md inline-block w-fit">
                                                                {numeroEdital}
                                                            </span>
                                                            {item.numeroControlePNCP && item.numeroControlePNCP !== numeroEdital && (
                                                                <span className="font-mono text-[10px] text-slate-400">
                                                                    PNCP: {item.numeroControlePNCP}
                                                                </span>
                                                            )}
                                                            <div className="mt-1">
                                                                <StatusBadge situacao={item.situacao} />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* 2. ÓRGÃO */}
                                                    <td className="py-4 px-4 align-top max-w-[240px]">
                                                        <div className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                                                            {item.orgao || 'Órgão Público'}
                                                        </div>
                                                        {item.cnpjOrgao && (
                                                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                                                CNPJ: {item.cnpjOrgao}
                                                            </div>
                                                        )}
                                                        {(item.municipio || item.uf) && (
                                                            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mt-1">
                                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" weight="bold" />
                                                                <span>{[item.municipio, item.uf].filter(Boolean).join(' / ')}</span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 3. DATA DE ABERTURA */}
                                                    <td className="py-4 px-4 align-top whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                            <Calendar className="w-4 h-4 text-brand-blue shrink-0" weight="bold" />
                                                            <span>{formatDate(dataAberturaExibida)}</span>
                                                        </div>
                                                        {urgente && (
                                                            <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black text-brand-orange bg-orange-50 border border-brand-orange/30 uppercase tracking-wider">
                                                                <Clock className="w-3 h-3" weight="bold" />
                                                                {dias === 0 ? 'Abre Hoje' : `${dias}d restantes`}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 4. OBJETO */}
                                                    <td className="py-4 px-4 align-top max-w-md">
                                                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                                            {item.modalidade && (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black text-slate-600 bg-slate-100 uppercase tracking-wider">
                                                                    {item.modalidade}
                                                                </span>
                                                            )}
                                                            {pct !== undefined && (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${pct >= 75
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                    : 'bg-blue-50 text-brand-blue border border-brand-blue/20'
                                                                    }`}>
                                                                    {pct}% Match
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-semibold text-slate-800 leading-relaxed line-clamp-3 group-hover:text-brand-blue transition-colors">
                                                            {item.objeto}
                                                        </p>
                                                    </td>

                                                    {/* 5. VALOR ESTIMADO */}
                                                    <td className="py-4 px-4 align-top whitespace-nowrap text-right">
                                                        <span className="text-sm font-black text-brand-blue">
                                                            {formatVal(valorExibido)}
                                                        </span>
                                                    </td>

                                                    {/* 6. AÇÕES (BAIXAR EDITAL + DISPUTAR) */}
                                                    <td className="py-4 px-4 align-top whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                        <div className="flex flex-col gap-2 items-stretch min-w-[145px]">
                                                            {downloadUrl ? (
                                                                <a
                                                                    href={downloadUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-blue hover:bg-blue-900 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-xs"
                                                                    title="Baixar Edital diretamente da fonte oficial governamental (PNCP)"
                                                                >
                                                                    <Download className="w-3.5 h-3.5" weight="bold" />
                                                                    Baixar Edital
                                                                </a>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider rounded-lg cursor-not-allowed">
                                                                    Sem Anexo
                                                                </span>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={e => void handleSalvarNoCrm(e, item)}
                                                                disabled={salvandoId === item.id}
                                                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all border ${salvosCrmIds.has(item.id)
                                                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                                    : 'bg-brand-orange text-white hover:bg-orange-600 shadow-xs cursor-pointer'
                                                                    }`}
                                                            >
                                                                {salvandoId === item.id ? (
                                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                ) : salvosCrmIds.has(item.id) ? (
                                                                    <>
                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" weight="bold" />
                                                                        <span>Na Esteira</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Plus className="w-3.5 h-3.5" weight="bold" />
                                                                        <span>Disputar</span>
                                                                    </>
                                                                )}
                                                            </button>

                                                            {item.numeroControlePNCP && (
                                                                <a
                                                                    href={`https://pncp.gov.br/app/editais/${encodeURIComponent(item.numeroControlePNCP)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 hover:text-brand-blue transition-colors"
                                                                >
                                                                    <span>Ver no Portal</span>
                                                                    <ExternalLink className="w-3 h-3" weight="bold" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* PAGINAÇÃO */}
                    {!loading && licitacoes.length > 0 && (
                        <div className="mt-6 flex items-center justify-between">
                            <p className="text-xs text-brand-blue/70 font-medium">
                                Página {pagina} · {licitacoes.length} resultados exibidos · {meta?.total?.toLocaleString('pt-BR') || '?'} total
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={pagina <= 1 || loading}
                                    onClick={() => void buscarLicitacoes(pagina - 1)}
                                    className="px-4 py-2 bg-white border border-gray-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all"
                                >
                                    Anterior
                                </button>
                                <button
                                    disabled={(meta?.totalPaginas || 1) <= pagina || loading}
                                    onClick={() => void buscarLicitacoes(pagina + 1)}
                                    className="px-4 py-2 bg-white border border-gray-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all"
                                >
                                    Próxima
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
