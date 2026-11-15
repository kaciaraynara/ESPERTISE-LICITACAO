import { useEffect, useMemo, useState, useCallback } from 'react';
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
  Sparkles,
  Gavel,
  Scale,
  Zap,
  Award,
  X,
} from 'lucide-react';
import { licitacoesApi, crmApi } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';
import DossieEditalModal from '../components/DossieEditalModal';
import { buildOfficialPncpPortalUrl, formatCnpj } from '@/utils/pncp';
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

function extrairPalavraChaveRamo(empresa: any): string {
  // Priorizar texto descritivo real da atividade e nunca retornar códigos numéricos de CNAE
  const textoBase =
    empresa?.cnaeDescricao ||
    empresa?.cnae_fiscal_descricao ||
    empresa?.ramoAtividade ||
    empresa?.atividadePrincipal ||
    empresa?.ramo ||
    '';

  if (!textoBase) return '';

  const stopWords = new Set([
    'comercio', 'varejista', 'atacadista', 'servicos', 'artigos',
    'outros', 'produtos', 'geral', 'ltda', 'me', 'epp', 'eireli',
    'nao', 'especificados', 'anteriormente', 'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para',
    'com', 'sem', 'sob', 'por', 'atividades', 'servico',
  ]);

  const palavras = String(textoBase)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 3 && !/^\d+$/.test(p) && !stopWords.has(p));

  return palavras[0] || '';
}

function calcularEscoreViabilidade(edital: EditalItem, empresa: any): number {
  const existente = edital.scoreViabilidade ?? edital.viabilidade ?? edital.matchScore;
  if (typeof existente === 'number' && existente > 0) {
    return Math.min(99, Math.max(20, Math.round(existente)));
  }

  let pontos = 68;
  const objeto = (edital.objetoCompra || edital.objeto || '').toLowerCase();
  const ramo = extrairPalavraChaveRamo(empresa);

  if (ramo && objeto.includes(ramo)) {
    pontos += 22;
  }

  const ufEmpresa = empresa?.uf || empresa?.estado;
  const ufEdital = edital.unidadeOrgao?.ufSigla || edital.uf;
  if (ufEmpresa && ufEdital && ufEmpresa.toUpperCase() === ufEdital.toUpperCase()) {
    pontos += 7;
  }

  const encerramento = edital.dataEncerramentoProposta || edital.dataEncerramento
    ? new Date(edital.dataEncerramentoProposta || edital.dataEncerramento || '').getTime()
    : 0;
  if (encerramento > Date.now()) {
    const dias = (encerramento - Date.now()) / (1000 * 60 * 60 * 24);
    if (dias >= 3) pontos += 3;
    else if (dias < 1) pontos -= 12;
  }

  return Math.min(98, Math.max(35, pontos));
}

export default function LicitacoesPage({
  tituloCustomizado,
  modalidadeInicial,
}: LicitacoesPageProps = {}) {
  const { selectedCompany } = useCompany();

  const [editais, setEditais] = useState<EditalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const [palavraChave, setPalavraChave] = useState('');
  const [ufSelecionada, setUfSelecionada] = useState('');
  const [orgaoFiltro, setOrgaoFiltro] = useState('');
  const [modalidadeAtiva, setModalidadeAtiva] = useState(() => {
    const m = (modalidadeInicial || '').toLowerCase();
    if (m.includes('pregão') || m.includes('pregao')) return 'PREGAO';
    if (m.includes('concorr')) return 'CONCORRENCIA';
    if (m.includes('dispensa')) return 'DISPENSA';
    if (m.includes('credenc')) return 'CREDENCIAMENTO';
    if (m.includes('srp') || m.includes('registro')) return 'SRP';
    return 'TODAS';
  });
  const [dataPublicacao, setDataPublicacao] = useState('');
  const [ordenacao, setOrdenacao] = useState<'relevancia' | 'recentes' | 'maior_valor'>('relevancia');
  const [mostrarFiltrosExtras, setMostrarFiltrosExtras] = useState(false);

  const [salvosMap, setSalvosMap] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [editalSelecionado, setEditalSelecionado] = useState<EditalItem | null>(null);
  const setEditalParaResumo = setEditalSelecionado;
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'info' | 'erro'; texto: string } | null>(null);

  const exibirAviso = (tipo: 'sucesso' | 'info' | 'erro', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 5000);
  };

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

  const buscarEditais = useCallback(
    async (termoOverride?: string) => {
      setCarregando(true);
      try {
        const q = termoOverride !== undefined ? termoOverride : palavraChave;
        const params: Record<string, any> = { limit: 100 };
        if (q.trim()) params.q = q.trim();
        if (ufSelecionada) params.uf = ufSelecionada;
        if (orgaoFiltro.trim()) params.orgao = orgaoFiltro.trim();
        if (modalidadeAtiva !== 'TODAS' && modalidadeAtiva !== 'SRP') {
          params.modalidade = modalidadeAtiva;
        }
        if (modalidadeAtiva === 'SRP') {
          params.srp = true;
        }
        if (dataPublicacao) {
          params.dataPublicacao = dataPublicacao;
        }

        const resposta = await licitacoesApi.listar(params);
        const lista =
          resposta?.data?.items ||
          resposta?.data?.data ||
          (Array.isArray(resposta?.data) ? resposta.data : []);

        setEditais(lista);
        setTotal(resposta?.data?.total || lista.length);
      } catch {
        exibirAviso('erro', 'Não foi possível carregar os editais agora. Tente atualizar em instantes.');
      } finally {
        setCarregando(false);
      }
    },
    [palavraChave, ufSelecionada, orgaoFiltro, modalidadeAtiva, dataPublicacao]
  );

  useEffect(() => {
    carregarSalvos();
    buscarEditais();
  }, [carregarSalvos, buscarEditais]);

  const handleSincronizarPncp = async () => {
    setSincronizando(true);
    try {
      await Promise.race([
        licitacoesApi.sincronizar({
          q: palavraChave.trim() || undefined,
          uf: ufSelecionada || undefined,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT_PNCP')), 15000)
        ),
      ]);
      await buscarEditais();
      exibirAviso('sucesso', 'Base de editais atualizada com sucesso!');
      toast.success('Base de editais atualizada com sucesso!');
    } catch {
      exibirAviso('info', 'O portal nacional está com resposta lenta no momento. Exibindo os editais mais recentes disponíveis na base.');
    } finally {
      setSincronizando(false);
    }
  };

  const handleUsarMeuRamo = () => {
    const termoRamo = extrairPalavraChaveRamo(selectedCompany);
    if (!termoRamo) {
      exibirAviso('info', 'Cadastre o ramo de atividade da sua empresa para usar o filtro automático.');
      return;
    }
    setPalavraChave(termoRamo);
    setOrgaoFiltro(''); // NUNCA preencher CNPJ da empresa usuária no filtro de órgão comprador!
    buscarEditais(termoRamo);
    exibirAviso('sucesso', `Filtrando oportunidades compatíveis com "${termoRamo}".`);
  };

  const handleLimparFiltros = () => {
    setPalavraChave('');
    setUfSelecionada('');
    setOrgaoFiltro('');
    setModalidadeAtiva('TODAS');
    setDataPublicacao('');
    buscarEditais('');
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

        await licitacoesApi.salvar({
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
        }).catch(() => {
          return crmApi.createOportunidade({
            noticeId: idEdital,
            stage: 'ANALISE',
            notes: edital.objetoCompra || edital.objeto || '',
          });
        });

        const resp = await crmApi.createOportunidade({
          noticeId: idEdital,
          stage: 'ANALISE',
          notes: edital.objetoCompra || edital.objeto || '',
        }).catch(() => ({ data: { id: idEdital } }));

        const novoId = (resp as any)?.data?.id || (resp as any)?.data?.data?.id || idEdital;
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

  const editaisOrdenados = useMemo(() => {
    const comScore = editais.map((item) => ({
      ...item,
      _scoreCalculado: calcularEscoreViabilidade(item, selectedCompany),
    }));

    if (ordenacao === 'relevancia') {
      return comScore.sort((a, b) => b._scoreCalculado - a._scoreCalculado);
    }
    if (ordenacao === 'maior_valor') {
      return comScore.sort(
        (a, b) =>
          (b.valorTotalEstimado || b.valorEstimado || 0) -
          (a.valorTotalEstimado || a.valorEstimado || 0)
      );
    }
    return comScore.sort((a, b) => {
      const da = new Date(
        a.dataPublicacao ||
        a.data_publicacao ||
        a.dataPublicacaoPncp ||
        a.publishedAt ||
        a.createdAt ||
        0
      ).getTime();
      const db = new Date(
        b.dataPublicacao ||
        b.data_publicacao ||
        b.dataPublicacaoPncp ||
        b.publishedAt ||
        b.createdAt ||
        0
      ).getTime();
      return db - da;
    });
  }, [editais, selectedCompany, ordenacao]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUsarMeuRamo}
              className="inline-flex items-center gap-2 rounded-full border border-[#0070C0]/30 bg-white px-4 py-2.5 text-xs font-bold text-[#0070C0] shadow-sm transition hover:bg-blue-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Filtrar pelo meu ramo
            </button>

            <button
              type="button"
              onClick={handleSincronizarPncp}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 rounded-full bg-[#081C3A] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f2b56] disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? 'Atualizando...' : 'Atualizar editais'}
            </button>
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
              buscarEditais();
            }}
            className="flex flex-col gap-3 md:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={palavraChave}
                onChange={(e) => setPalavraChave(e.target.value)}
                placeholder="Buscar editais por produto, serviço ou objeto (ex: materiais, informática, engenharia)..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-[#081C3A] outline-none transition focus:border-[#0070C0] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF6600] px-7 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00] cursor-pointer"
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
                value={ufSelecionada}
                onChange={(e) => setUfSelecionada(e.target.value)}
                className="appearance-none rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-[#0070C0] cursor-pointer"
              >
                <option value="">Todos os Estados</option>
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

            {(palavraChave || ufSelecionada || orgaoFiltro || modalidadeAtiva !== 'TODAS' || dataPublicacao) && (
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="px-3 py-2 text-xs font-semibold text-[#FF6600] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {mostrarFiltrosExtras && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Calendar className="h-4 w-4 text-[#0070C0]" />
                Publicado a partir de:
                <input
                  type="date"
                  value={dataPublicacao}
                  onChange={(e) => setDataPublicacao(e.target.value)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0070C0]"
                />
              </label>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {MODALIDADES_RAPIDAS.map((mod) => {
              const Icon = mod.icon;
              const ativa = modalidadeAtiva === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setModalidadeAtiva(mod.id)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold transition cursor-pointer ${
                    ativa
                      ? 'border-[#0070C0] bg-blue-50/70 text-[#0070C0] shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${ativa ? 'text-[#0070C0]' : 'text-slate-500'}`} />
                  <span>{mod.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantidade e Ordenação */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-slate-600">
            <span className="text-[#081C3A]">{total}</span> editais encontrados
          </p>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Ordenar por</span>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as any)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#081C3A] outline-none focus:border-[#0070C0] cursor-pointer"
            >
              <option value="relevancia">Maior viabilidade</option>
              <option value="recentes">Mais recentes</option>
              <option value="maior_valor">Maior valor estimado</option>
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
        ) : editaisOrdenados.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-[#081C3A]">
              Nenhum edital encontrado para esses filtros
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Tente limpar os filtros ou buscar novos editais diretamente no Portal Nacional.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                onClick={handleSincronizarPncp}
                className="rounded-full bg-[#0070C0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005ea3] cursor-pointer"
              >
                Buscar no PNCP agora
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {editaisOrdenados.map((edital) => {
              const idStr = String(edital.id);
              const estaSalvo = Boolean(salvosMap[idStr]);
              const salvandoEste = salvandoId === idStr;

              // Nome real do órgão comprador (prioridade estrita nos dados reais)
              const orgao =
                edital.orgao ||
                edital.nomeOrgao ||
                edital.buyerName ||
                edital.orgaoEntidade?.razaoSocial ||
                edital.orgaoNome ||
                'Órgão Licitante';

              // CNPJ do órgão comprador
              const cnpjOrgao =
                edital.cnpjOrgao ||
                edital.buyerDocument ||
                edital.orgaoEntidade?.cnpj ||
                edital.orgaoCnpj;

              // Número do edital / processo
              const numeroEdital =
                edital.numeroEdital ||
                edital.numeroCompra ||
                edital.processo ||
                edital.numeroControlePNCP ||
                idStr;

              // Data real de publicação
              const dataPublicacaoReal =
                edital.dataPublicacao ||
                edital.data_publicacao ||
                edital.dataPublicacaoPncp ||
                edital.publishedAt ||
                edital.createdAt;

              // Prazos de propostas / disputa
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

              // Localidade e Modalidade
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
              const score = edital._scoreCalculado || 75;

              // Link direto para o portal oficial do PNCP
              const urlOficialPncp = buildOfficialPncpPortalUrl(edital);

              const corScore =
                score >= 80
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : score >= 60
                  ? 'bg-blue-50 text-[#0070C0] border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200';

              const labelScore =
                score >= 80 ? 'Alta viabilidade' : score >= 60 ? 'Boa viabilidade' : 'Avaliar requisitos';

              return (
                <div
                  key={idStr}
                  onClick={() => setEditalSelecionado(edital)}
                  className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#FF6600]/60 hover:shadow-md cursor-pointer overflow-hidden"
                >
                  {/* Borda indicadora de escore */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      score >= 80 ? 'bg-[#FF6600]' : score >= 60 ? 'bg-[#0070C0]' : 'bg-slate-300'
                    }`}
                  />

                  {/* Linha 1: Badges e Botões de Ação */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#081C3A]">
                        {modalidade}
                      </span>

                      {edital.srp && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0070C0]">
                          Registro de Preços
                        </span>
                      )}

                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md">
                        {numeroEdital}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${corScore}`}
                      >
                        {score}% • {labelScore}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {/* Link direto para o Portal Oficial do PNCP */}
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

                      {/* Botão Salvar para Proposta */}
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
                        {formatarData(dataPublicacaoReal)}
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
                        {formatarData(dataEncerramento)}
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
          </div>
        )}
      </div>

      {/* Modal de Dossiê e Resumo do Edital (RESUMO DO EDITAL) */}
      {editalSelecionado && (
        <DossieEditalModal
          isOpen={Boolean(editalSelecionado)}
          onClose={() => {
            setEditalSelecionado(null);
            setEditalParaResumo(null);
          }}
          edital={editalSelecionado as any}
          isSalvo={Boolean(editalSelecionado && salvosMap[String(editalSelecionado.id)])}
          isSalvando={Boolean(editalSelecionado && salvandoId === String(editalSelecionado.id))}
          onSalvar={() => {
            if (editalSelecionado) {
              handleAlternarSalvar(editalSelecionado);
            }
          }}
        />
      )}
    </div>
  );
}
