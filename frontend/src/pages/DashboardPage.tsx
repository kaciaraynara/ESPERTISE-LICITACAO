import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Briefcase,
  Clock,
  ShieldCheck,
  FileCheck2,
  FileText,
  AlertTriangle,
  Gavel,
  ArrowRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Calculator,
  TrendingUp,
  Package,
  Info,
  X,
} from 'lucide-react';
import { dashboardApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import { FORNECEDOR_ROUTES } from '@/routes';

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === undefined || valor === null || Number.isNaN(Number(valor)) || Number(valor) <= 0) {
    return 'Sigiloso / Conforme TR';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

function formatarDataHora(raw?: string | null): string {
  if (!raw) return 'Data a consultar';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Data a consultar';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { selectedCompany } = useCompany();

  // Saudação personalizada e amigável
  const horaAtual = new Date().getHours();
  const saudacao = horaAtual < 12 ? 'Bom dia' : horaAtual < 18 ? 'Boa tarde' : 'Boa noite';
  const nomeCompleto = (user as any)?.name || (user as any)?.nome || 'Empresário';
  const primeiroNome = String(nomeCompleto).trim().split(' ')[0];

  const [metrics, setMetrics] = useState<any>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [portalFiltro, setPortalFiltro] = useState<string>('TODOS');
  const [modalGuiaAberto, setModalGuiaAberto] = useState<boolean>(false);

  useEffect(() => {
    document.title = 'Painel Principal | Expertise Licitatória';
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setCarregando(true);
        const resp = await dashboardApi.getMetrics();
        if (!ativo) return;
        if (resp?.data?.success && resp.data.data) {
          setMetrics(resp.data.data);
        }
      } catch (err) {
        console.warn('[DashboardPage] Falha ao carregar métricas:', err);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [selectedCompany?.id]);

  const kpis = metrics?.kpis || {
    oportunidadesAbertasCount: 0,
    oportunidadesAbertasValor: 0,
    encerram5DiasCount: 0,
    documentosTotal: 0,
    documentosValidos: 0,
    documentosPendentes: 0,
    documentosResumo: 'Carregando dados da empresa...',
    propostasAtivasCount: 0,
    disputasAtivasCount: 0,
    totalAtivas: 0,
  };

  const oportunidadesDestaque: any[] = metrics?.oportunidadesDestaque || [];
  const proximosPrazos: any[] = metrics?.proximosPrazos || [];
  const documentosAtencao: any[] = metrics?.documentosAtencao || [];

  // Filtragem multi-portal
  const portaisDisponiveis = [
    'TODOS',
    'Compras.gov.br',
    'BLL Compras',
    'BNC Compras',
    'Portal de Compras Públicas',
    'Licitanet',
    'PNCP Oficial',
  ];

  const oportunidadesFiltradas = useMemo(() => {
    if (portalFiltro === 'TODOS') return oportunidadesDestaque;
    return oportunidadesDestaque.filter((ed) => {
      const nomeP = ed.portalDisputa?.nome || '';
      return nomeP.toLowerCase().includes(portalFiltro.toLowerCase());
    });
  }, [oportunidadesDestaque, portalFiltro]);

  const ferramentas = [
    { titulo: 'Radar de Oportunidades', desc: 'Busca inteligente unificada', icon: Briefcase, rota: FORNECEDOR_ROUTES.radar },
    { titulo: 'Leitor & Auditor de Editais', desc: 'Extração e vícios jurídicos', icon: FileText, rota: FORNECEDOR_ROUTES.lex },
    { titulo: 'Sala de Disputa & Lances', desc: 'Mesa de lances sem prejuízo', icon: Gavel, rota: FORNECEDOR_ROUTES.disputa_ao_vivo },
    { titulo: 'Precificação Estratégica', desc: 'Motor tributário por CNAE', icon: Calculator, rota: FORNECEDOR_ROUTES.precificacao_estrategica },
    { titulo: 'Habilitação & Documentos', desc: 'Validade de CNDs e certidões', icon: ShieldCheck, rota: FORNECEDOR_ROUTES.cofre },
    { titulo: 'Elaboração de Propostas', desc: 'Minutas oficiais Lei 14.133', icon: FileCheck2, rota: FORNECEDOR_ROUTES.propostas },
    { titulo: 'Análise de Viabilidade', desc: 'Aderência e probabilidade', icon: TrendingUp, rota: FORNECEDOR_ROUTES.score_viabilidade },
    { titulo: 'Catálogo de Itens & Preços', desc: 'Bancos oficiais de preços', icon: Package, rota: FORNECEDOR_ROUTES.catalogo },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 font-sans text-slate-800">

      {/* =========================================================================
          PASSO 1: TOPO LIMPO & SAUDAÇÃO PERSONALIZADA (SEM BLOCO AZUL GIGANTE)
          ========================================================================= */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#0B192C]">
              {saudacao}, {primeiroNome}!
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Painel executivo de vendas públicas da empresa{' '}
            <strong className="text-slate-700">
              {selectedCompany?.razaoSocial || selectedCompany?.nomeFantasia || 'ativa'}
            </strong>
            .
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setModalGuiaAberto(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Info size={14} className="text-[#0070C0]" />
            Guia Rápido
          </button>

          <button
            type="button"
            onClick={() => navigate(FORNECEDOR_ROUTES.radar)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            Buscar Oportunidades no Radar <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          PASSO 2: 4 CARTÕES DO TOPO (100% REAIS DA EMPRESA ATIVA)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cartão 1: Oportunidades Abertas no Seu Segmento */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Oportunidades no Seu Segmento
              </span>
              <span className="p-2 bg-slate-100 rounded-xl text-[#0B192C]">
                <Briefcase size={16} />
              </span>
            </div>
            <div className="mt-3">
              <strong className="text-xl sm:text-2xl font-black text-[#0B192C] font-mono tracking-tight block">
                {carregando ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  `${kpis.oportunidadesAbertasCount.toLocaleString('pt-BR')} editais`
                )}
              </strong>
              <span className="text-xs font-bold text-[#14532D] block mt-0.5">
                {carregando ? 'Calculando valor...' : formatarMoeda(kpis.oportunidadesAbertasValor)} em disputa
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-3">
            Abertos e aderentes à atividade da empresa
          </p>
        </div>

        {/* Cartão 2: Encerram nos Próximos 5 Dias */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Encerram em até 5 Dias
              </span>
              <span className="p-2 bg-amber-50 rounded-xl text-amber-700">
                <Clock size={16} />
              </span>
            </div>
            <div className="mt-3">
              <strong className="text-xl sm:text-2xl font-black text-[#0B192C] font-mono tracking-tight block">
                {carregando ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  `${kpis.encerram5DiasCount} editais`
                )}
              </strong>
              <span className="text-xs font-medium text-amber-800 block mt-0.5">
                {kpis.encerram5DiasCount > 0 ? 'Exigem proposta imediata' : 'Nenhum prazo crítico hoje'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-3">
            Prazo curto para envio de propostas
          </p>
        </div>

        {/* Cartão 3: Situação da Documentação */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Situação da Documentação
              </span>
              <span className="p-2 bg-[#14532D]/10 rounded-xl text-[#14532D]">
                <ShieldCheck size={16} />
              </span>
            </div>
            <div className="mt-3">
              <strong className="text-base sm:text-lg font-black text-[#0B192C] tracking-tight block">
                {carregando ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : kpis.documentosTotal > 0 ? (
                  `${kpis.documentosValidos} de ${kpis.documentosTotal} em dia`
                ) : (
                  'Nenhum documento'
                )}
              </strong>
              <span className="text-xs font-bold block mt-0.5">
                {kpis.documentosPendentes > 0 ? (
                  <span className="text-amber-700">
                    {kpis.documentosPendentes} pendente(s) de atualização
                  </span>
                ) : (
                  <span className="text-[#14532D]">Regularidade fiscal confirmada</span>
                )}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-3">
            Conformidade jurídica e certidões
          </p>
        </div>

        {/* Cartão 4: Propostas e Disputas Ativas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Propostas & Acompanhados
              </span>
              <span className="p-2 bg-blue-50 rounded-xl text-[#0070C0]">
                <FileCheck2 size={16} />
              </span>
            </div>
            <div className="mt-3">
              <strong className="text-xl sm:text-2xl font-black text-[#0B192C] font-mono tracking-tight block">
                {carregando ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  `${kpis.totalAtivas} ativos`
                )}
              </strong>
              <span className="text-xs font-medium text-slate-600 block mt-0.5">
                {kpis.propostasAtivasCount} proposta(s) e {kpis.disputasAtivasCount} certame(s)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-3">
            Acompanhados pela sua equipe
          </p>
        </div>
      </div>

      {/* =========================================================================
          PASSO 3 E 4: ÁREA CENTRAL (8 COLUNAS) + PAINEL LATERAL (4 COLUNAS)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA ESQUERDA (8 COLUNAS): TABELA DE OPORTUNIDADES EM DESTAQUE */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-[#0B192C]">
                  Oportunidades em Destaque no Seu Segmento
                </h2>
                <p className="text-xs text-slate-500">
                  Certames com prazo futuro aberto e aderência à sua empresa.
                </p>
              </div>

              <Link
                to={FORNECEDOR_ROUTES.radar}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0] hover:text-[#0B192C] transition shrink-0"
              >
                Ver todos no Radar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* SELETOR DE PORTAIS DE DISPUTA UNIFICADOS */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
                Portal:
              </span>
              {portaisDisponiveis.map((portal) => (
                <button
                  key={portal}
                  type="button"
                  onClick={() => setPortalFiltro(portal)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${portalFiltro === portal
                    ? 'bg-[#0B192C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                    }`}
                >
                  {portal === 'TODOS' ? 'Todos os Portais' : portal}
                </button>
              ))}
            </div>

            {/* LISTAGEM DE EDITAIS */}
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#EA580C]" />
                Carregando certames abertos do seu segmento...
              </div>
            ) : oportunidadesFiltradas.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {oportunidadesFiltradas.map((ed) => (
                  <div
                    key={ed.id}
                    className="py-3.5 first:pt-0 last:pb-0 hover:bg-slate-50/60 transition-all rounded-xl p-2.5 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-[#0B192C]">
                            {ed.orgao}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {ed.localizacao}
                          </span>
                          <a
                            href={ed.portalDisputa?.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0070C0] hover:underline"
                            title="Abrir página oficial do portal"
                          >
                            <ExternalLink size={10} />
                            {ed.portalDisputa?.nome}
                          </a>
                        </div>
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-medium">
                          {ed.objeto}
                        </p>
                      </div>

                      <div className="text-right sm:shrink-0">
                        <strong className="text-xs sm:text-sm font-black text-[#14532D] font-mono block">
                          {formatarMoeda(ed.valorEstimado)}
                        </strong>
                        <span
                          className={`text-[11px] font-bold inline-block mt-0.5 ${ed.diasRestantes !== null && ed.diasRestantes <= 5
                            ? 'text-amber-700 font-extrabold'
                            : 'text-slate-500'
                            }`}
                        >
                          {ed.prazoLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500">
                        Sessão:{' '}
                        <strong className="text-slate-700">
                          {formatarDataHora(ed.dataSessao)}
                        </strong>
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/fornecedor/leitor-editais?edital=${ed.id}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-xs inline-flex items-center gap-1"
                        >
                          <FileText size={13} className="text-[#0B192C]" />
                          Analisar
                        </Link>
                        <Link
                          to={`/propostas/criar?edital=${ed.id}`}
                          className="px-3 py-1.5 rounded-lg bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1"
                        >
                          <FileCheck2 size={13} className="text-[#EA580C]" />
                          Preparar Proposta
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center space-y-2">
                <p className="text-xs text-slate-600 font-medium">
                  Nenhum edital aberto encontrado no portal selecionado para o segmento desta empresa.
                </p>
                <Link
                  to={FORNECEDOR_ROUTES.radar}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"
                >
                  Fazer busca ampla por palavras-chave no Radar <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (4 COLUNAS): PAINEL LATERAL DE PENDÊNCIAS E AGENDA CRÍTICA */}
        <div className="lg:col-span-4 space-y-4">

          {/* BLOCO A: PRÓXIMOS PRAZOS E SESSÕES */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[#0B192C]">
                <Clock className="h-4 w-4 text-[#EA580C]" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Próximos Prazos & Sessões
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {proximosPrazos.length} agendado(s)
              </span>
            </div>

            {proximosPrazos.length > 0 ? (
              <div className="space-y-2">
                {proximosPrazos.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-900 font-bold truncate block">
                        {item.titulo}
                      </strong>
                      <span className="text-[10px] font-bold text-[#0070C0] bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                        {item.tipo}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Data: {formatarDataHora(item.data)}</span>
                      {item.link && (
                        <Link
                          to={item.link}
                          className="font-bold text-[#0B192C] hover:underline"
                        >
                          Ver certame ↗
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">
                Nenhuma sessão agendada para os próximos dias. Acompanhe certames no Radar para adicioná-los à sua agenda.
              </p>
            )}
          </div>

          {/* BLOCO B: DOCUMENTOS QUE EXIGEM ATENÇÃO */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[#0B192C]">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Documentos com Atenção
                </h3>
              </div>
              <Link
                to={FORNECEDOR_ROUTES.cofre}
                className="text-[11px] font-bold text-[#0070C0] hover:underline"
              >
                Ver cofre
              </Link>
            </div>

            {documentosAtencao.length > 0 ? (
              <div className="space-y-2">
                {documentosAtencao.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <strong className="text-slate-800 block truncate text-xs">
                        {doc.nome}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">
                        {doc.tipo}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${doc.statusLabel === 'Vencido'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-900'
                        }`}
                    >
                      {doc.statusLabel}
                    </span>
                  </div>
                ))}

                <Link
                  to={FORNECEDOR_ROUTES.cofre}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs mt-2"
                >
                  <ShieldCheck size={14} className="text-[#EA580C]" />
                  Regularizar Documentos
                </Link>
              </div>
            ) : (
              <div className="space-y-3 py-2 text-center">
                <div className="inline-flex p-2.5 bg-[#14532D]/10 rounded-full text-[#14532D]">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs text-slate-600">
                  {kpis.documentosTotal > 0
                    ? 'Todas as certidões e documentos cadastrados estão em dia e válidos.'
                    : 'Nenhum documento cadastrado no cofre. Cadastre suas certidões para garantir habilitação.'}
                </p>
                <Link
                  to={FORNECEDOR_ROUTES.cofre}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0] hover:underline"
                >
                  Cadastrar Certidões no Cofre <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          FERRAMENTAS ESTRATÉGICAS (RODAPÉ CORPORATIVO LIMPO)
          ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-base font-black text-[#0B192C]">
          Ferramentas Estratégicas da Plataforma
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ferramentas.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.titulo}
                type="button"
                onClick={() => navigate(f.rota)}
                className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#0B192C] transition-all text-left group shadow-2xs cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-white border border-slate-200 text-[#0B192C] group-hover:text-[#EA580C] shadow-2xs transition mb-2">
                  <Icon size={16} />
                </div>
                <strong className="text-xs font-bold text-slate-900 group-hover:text-[#0B192C]">
                  {f.titulo}
                </strong>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  {f.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODAL DISCRETO: GUIA RÁPIDO DO LICITANTE */}
      {modalGuiaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[#0B192C]">
                <Info className="h-4 w-4 text-[#EA580C]" />
                <h3 className="text-sm font-black uppercase">Guia Rápido de Vendas Públicas</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-slate-700 leading-relaxed">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="text-slate-900 block font-bold">1. Encontre Editais no Radar</strong>
                <p className="text-[11px] text-slate-600">
                  Filtre certames abertos do seu segmento e salve os que deseja disputar.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="text-slate-900 block font-bold">2. Audite Regras e Forme seu Preço</strong>
                <p className="text-[11px] text-slate-600">
                  Use o Leitor de Editais para checar exigências e a Precificação para definir seu piso seguro de lucro.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="text-slate-900 block font-bold">3. Gere a Proposta e Dispute com Segurança</strong>
                <p className="text-[11px] text-slate-600">
                  Emita a proposta oficial em minutos e acompanhe os lances na Sala de Disputa sem ter prejuízo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalGuiaAberto(false)}
              className="w-full py-2 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export const FornecedorDashboardPage = DashboardPage;
export default DashboardPage;
