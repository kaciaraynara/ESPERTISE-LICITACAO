import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit,
  Edit3,
  Eye,
  X,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { propostasApi, ProposalDto } from '@/services/api';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { useCompany } from '@/contexts/CompanyContext';

interface CalendarEvent {
  day: number;
  month: number; // 0-indexed
  year: number;
  type: 'PRAZO_PROPOSTA' | 'ABERTURA_PROPOSTAS' | 'SESSAO_PUBLICA' | 'ENVIO_PROPOSTA';
  title: string;
  orgao: string;
  time?: string;
}

export const PropostasPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany, companyId: activeCompanyId, companies } = useCompany();
  const [searchParams] = useSearchParams();
  const editalUrlParam = searchParams.get('edital') || searchParams.get('id');

  const [propostas, setPropostas] = useState<ProposalDto[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregandoDados, setCarregandoDados] = useState(true);

  // Modal Unificado Criar Proposta com Chave Seletora
  const [modalCriarAberto, setModalCriarAberto] = useState(Boolean(editalUrlParam));
  const [modoPreenchimento, setModoPreenchimento] = useState<'automatico' | 'manual'>('automatico');
  const [eventoSelecionado, setEventoSelecionado] = useState<CalendarEvent | null>(null);

  // Form Geral / Manual
  const [companyId, setCompanyId] = useState(selectedCompany?.id ?? '');
  const [titulo, setTitulo] = useState('Proposta Comercial Oficial');
  const [validadeDias, setValidadeDias] = useState(60);
  const [prazoEntregaDias, setPrazoEntregaDias] = useState(15);
  const [savingManual, setSavingManual] = useState(false);

  // Campos Modo Manual
  const [orgaoManual, setOrgaoManual] = useState('');
  const [numeroEditalManual, setNumeroEditalManual] = useState('');
  const [objetoManual, setObjetoManual] = useState('');
  const [criterioJulgamentoManual, setCriterioJulgamentoManual] = useState('menor_preco');

  // Form Extração Automática / IA
  const [editalSelecionado, setEditalSelecionado] = useState<EditalOption | null>(null);
  const [lexNoticeId, setLexNoticeId] = useState(editalUrlParam || '');
  const [extractingLex, setExtractingLex] = useState(false);
  const [erroIaOcorrido, setErroIaOcorrido] = useState(false);
  const [mensagemErroIa, setMensagemErroIa] = useState('');

  const hoje = new Date();
  const [mesAtualBase, setMesAtualBase] = useState(hoje.getMonth());
  const [anoAtualBase, setAnoAtualBase] = useState(hoje.getFullYear());

  const eventosCalendario = useMemo<CalendarEvent[]>(() => propostas.flatMap((proposta) => {
    const dataLimite = proposta.procurementNotice?.closingAt;
    if (!dataLimite) return [];

    const data = new Date(`${dataLimite.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(data.getTime())) return [];

    return [{
      day: data.getDate(),
      month: data.getMonth(),
      year: data.getFullYear(),
      type: 'PRAZO_PROPOSTA',
      title: `Prazo da proposta — ${proposta.procurementNotice?.noticeNumber || proposta.titulo}`,
      orgao: proposta.procurementNotice?.buyerName || 'Órgão não informado',
    }];
  }), [propostas]);

  // Carregamento de Propostas Reais
  const carregarDados = useCallback(async () => {
    setCarregandoDados(true);
    try {
      const resProp = await propostasApi.listar();
      const lista = resProp.data?.data || [];
      setPropostas(Array.isArray(lista) ? lista : []);

      if (Array.isArray(companies) && companies.length > 0) {
        setEmpresas(companies);
        if (activeCompanyId) {
          setCompanyId(activeCompanyId);
        } else {
          setCompanyId(companies[0].id);
        }
      }
    } catch (error) {
      console.error('[PropostasPage] Falha ao carregar propostas:', error);
      toast.error('Não foi possível carregar as propostas. Tente novamente.');
    } finally {
      setCarregandoDados(false);
    }
  }, [activeCompanyId, companies]);

  useEffect(() => {
    void carregarDados();
  }, [activeCompanyId]);

  // Seleção de Edital no Seletor
  const handleSelectEdital = (ed: EditalOption) => {
    setEditalSelecionado(ed);
    setLexNoticeId(ed.id || ed.numeroEdital);
    setErroIaOcorrido(false);
    if (ed.orgao) setOrgaoManual(ed.orgao);
    if (ed.numeroEdital) {
      setNumeroEditalManual(ed.numeroEdital);
      setTitulo(`Proposta Comercial - ${ed.numeroEdital}`);
    }
    if (ed.objeto) setObjetoManual(ed.objeto);
  };

  // Alternar com 1 clique para Modo Manual em caso de erro da IA
  const handleFallbackParaManual = () => {
    if (editalSelecionado) {
      if (editalSelecionado.orgao) setOrgaoManual(editalSelecionado.orgao);
      if (editalSelecionado.numeroEdital) {
        setNumeroEditalManual(editalSelecionado.numeroEdital);
        setTitulo(`Proposta Comercial - ${editalSelecionado.numeroEdital}`);
      }
      if (editalSelecionado.objeto) setObjetoManual(editalSelecionado.objeto);
    }
    setModoPreenchimento('manual');
    setErroIaOcorrido(false);
  };

  // Criação manual
  const handleCriarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetCompany = companyId;
    if (!targetCompany && empresas.length > 0) {
      targetCompany = empresas[0].id;
    }

    if (!targetCompany) {
      toast.error('Cadastre ou selecione uma empresa antes de criar a proposta.');
      return;
    }

    setSavingManual(true);
    try {
      const res = await propostasApi.criarRascunho({
        companyId: targetCompany,
        procurementNoticeId: editalSelecionado?.id || undefined,
        titulo: titulo.trim() || 'Proposta Comercial Oficial',
        validadeDias: Number(validadeDias) || 60,
        prazoEntregaDias: Number(prazoEntregaDias) || 15,
        criterioJulgamento: criterioJulgamentoManual,
      });

      toast.success('Rascunho de proposta criado! Agora você pode editar os itens livremente.');
      setModalCriarAberto(false);
      const newId = res.data?.data?.id;
      if (newId) {
        navigate(`/fornecedor/propostas/${newId}`);
      } else {
        await carregarDados();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar proposta.');
    } finally {
      setSavingManual(false);
    }
  };

  // Preenchimento via LEX IA (Modo Automático)
  const handlePreencherViaLex = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lexNoticeId.trim()) {
      toast.error('Selecione um edital salvo para o preenchimento automático.');
      return;
    }

    setExtractingLex(true);
    setErroIaOcorrido(false);
    setMensagemErroIa('');

    try {
      const res = await propostasApi.preencherPropostaViaLex({
        noticeId: lexNoticeId.trim(),
        companyId: companyId || undefined,
        autoCreate: true,
      });

      toast.success('Proposta gerada com sucesso com itens e cálculos automáticos!');
      setModalCriarAberto(false);
      const createdProposalId = res.data?.data?.proposalId || res.data?.data?.proposal?.id;
      if (createdProposalId) {
        navigate(`/fornecedor/propostas/${createdProposalId}`);
      } else {
        await carregarDados();
      }
    } catch (err: any) {
      console.error('[PropostasPage] Falha ao preencher proposta via LEX:', err);
      setErroIaOcorrido(true);
      const msg = err.response?.data?.message || 'Não foi possível conectar ao serviço de IA no momento.';
      setMensagemErroIa(msg);
      toast.error('Não foi possível gerar via IA. Alterne para o Modo Manual em 1 clique.');
    } finally {
      setExtractingLex(false);
    }
  };

  // Filtragem de propostas
  const propostasFiltradas = useMemo(() => {
    if (!termoBusca.trim()) return propostas;
    const termo = termoBusca.toLowerCase();
    return propostas.filter(
      (p) =>
        p.titulo?.toLowerCase().includes(termo) ||
        p.procurementNotice?.buyerName?.toLowerCase().includes(termo) ||
        p.procurementNotice?.noticeNumber?.toLowerCase().includes(termo)
    );
  }, [propostas, termoBusca]);

  // Contadores para os 4 KPI Cards Oficiais (dados reais do banco)
  const contagemEmAndamento = useMemo(
    () => propostas.filter((p) => !['SUBMETIDA', 'CANCELADA', 'ARQUIVADA'].includes(p.status)).length,
    [propostas]
  );
  const contagemEnviadas = useMemo(
    () => propostas.filter((p) => p.status === 'SUBMETIDA').length,
    [propostas]
  );
  const editaisVinculados = useMemo(
    () => new Set(propostas.map((proposta) => proposta.procurementNoticeId).filter(Boolean)).size,
    [propostas],
  );

  const formatarMoeda = (val: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const statusLabel: Record<string, string> = {
    RASCUNHO: 'Rascunho',
    EM_PREENCHIMENTO: 'Em preenchimento',
    PENDENTE_DE_DADOS: 'Dados pendentes',
    PENDENTE_DE_REVISAO: 'Pendente de revisão',
    EM_REVISAO: 'Em revisão',
    AJUSTES_SOLICITADOS: 'Ajustes solicitados',
    APROVADA: 'Aprovada',
    EXPORTADA: 'Exportada',
    SUBMETIDA: 'Submetida',
    CANCELADA: 'Cancelada',
    ARQUIVADA: 'Arquivada',
  };

  // Funções Auxiliares do Calendário
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getDiasDoMes = (ano: number, mes: number) => {
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 = Domingo
    return { totalDias, primeiroDiaSemana };
  };

  const mes1Info = getDiasDoMes(anoAtualBase, mesAtualBase);
  const mes2Info = getDiasDoMes(
    mesAtualBase === 11 ? anoAtualBase + 1 : anoAtualBase,
    (mesAtualBase + 1) % 12
  );

  const getEventosDia = (dia: number, mes: number, ano: number) => {
    return eventosCalendario.filter(
      (e) => e.day === dia && e.month === mes && e.year === ano
    );
  };

  const getDotClass = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'PRAZO_PROPOSTA':
        return 'bg-brand-blue'; // blue dot
      case 'ABERTURA_PROPOSTAS':
        return 'bg-brand-orange'; // orange dot
      case 'SESSAO_PUBLICA':
        return 'bg-brand-dark'; // dark navy dot
      case 'ENVIO_PROPOSTA':
        return 'border-2 border-brand-blue bg-white'; // hollow blue circle
    }
  };

  return (
    <div className="min-h-screen bg-brand-light text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ===================================================================
            1. CABEÇALHO & SEARCH BAR (IDÊNTICO À ARTE)
        =================================================================== */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Gerador de Propostas
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                Monte e gerencie suas propostas de forma rápida, segura e padronizada.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                id="btn-preencher-proposta-lex"
                onClick={() => {
                  setModoPreenchimento('automatico');
                  setModalCriarAberto(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-brand-dark hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Sparkles size={16} className="text-brand-orange" />
                Preencher proposta com assistência
              </button>

              <button
                id="btn-criar-proposta"
                onClick={() => {
                  setModoPreenchimento('automatico');
                  setModalCriarAberto(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} />
                Criar Proposta
              </button>
            </div>
          </div>

          {/* BARRA DE BUSCA EM DESTAQUE COM BOTÃO "BUSCAR" (ARTE OFICIAL) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-sm flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder="Buscar por licitação, edital ou número do processo..."
                className="w-full pl-11 pr-4 py-2.5 text-xs md:text-sm bg-transparent rounded-xl focus:outline-none text-slate-800 placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              onClick={() => { }}
              className="px-6 py-2.5 bg-brand-orange hover:bg-orange-600 text-white font-black text-xs md:text-sm rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* ===================================================================
            2. OS 4 KPI CARDS OFICIAIS DE DESEMPENHO
        =================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: Propostas em andamento */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-500">Propostas em andamento</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {contagemEmAndamento}
              </span>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Em elaboração
              </span>
            </div>
          </div>

          {/* CARD 2: Propostas enviadas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-500">Propostas enviadas</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black text-brand-dark tracking-tight">
                {contagemEnviadas}
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Últimos 30 dias
              </span>
            </div>
          </div>

          {/* CARD 3: Modelos padrão */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-500">Propostas cadastradas</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black text-brand-orange tracking-tight">
                {propostas.length}
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                Registradas
              </span>
            </div>
          </div>

          {/* CARD 4: Taxa de sucesso */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-500">Editais vinculados</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-700 tracking-tight">
                {editaisVinculados}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Nas propostas
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            3. TABELA "MINHAS PROPOSTAS" (EXATA À ARTE)
        =================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-base">Minhas Propostas</h3>
            <span className="text-xs font-bold text-slate-500">
              Mostrando {propostasFiltradas.length} propostas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50/70">
                  <th className="py-3.5 px-5">Edital / Licitação</th>
                  <th className="py-3.5 px-4">Órgão</th>
                  <th className="py-3.5 px-4">Prazo</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propostasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <p className="font-bold text-slate-700">
                        {carregandoDados
                          ? 'Carregando propostas...'
                          : termoBusca
                            ? 'Nenhuma proposta corresponde à busca.'
                            : 'Sua próxima venda pública começa com uma proposta estratégica.'}
                      </p>
                      {!carregandoDados && propostas.length === 0 && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                          <Link
                            to="/fornecedor/radar"
                            className="rounded-lg bg-brand-dark px-4 py-2 text-xs font-bold text-white"
                          >
                            Encontrar edital no Radar
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setModoPreenchimento('manual');
                              setModalCriarAberto(true);
                            }}
                            disabled={empresas.length === 0}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 cursor-pointer hover:bg-slate-50"
                          >
                            Criar proposta manual
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {propostasFiltradas.map((prop) => {
                  const enviada = prop.status === 'SUBMETIDA';
                  const statusAtual = statusLabel[prop.status] || prop.status;
                  return (
                    <tr key={prop.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <Link
                          to={`/fornecedor/propostas/${prop.id}`}
                          className="font-black text-slate-900 hover:text-brand-orange transition-colors block text-xs"
                        >
                          {prop.procurementNotice?.noticeNumber || prop.titulo}
                        </Link>
                        <span className="text-[11px] text-slate-400 font-medium block truncate max-w-md">
                          {prop.titulo} · <span className="font-bold text-slate-700">
                            {prop.valorTotalProposto == null ? 'Total pendente' : formatarMoeda(prop.valorTotalProposto)}
                          </span>
                        </span>
                      </td>

                      <td className="py-4 px-4 font-bold text-slate-700">
                        {prop.procurementNotice?.buyerName || 'Não vinculado'}
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {(prop.procurementNotice as any)?.closingAt
                          ? new Intl.DateTimeFormat('pt-BR').format(new Date((prop.procurementNotice as any).closingAt))
                          : 'Não informado'}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {!enviada ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                            {statusAtual}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {statusAtual}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/fornecedor/propostas/${prop.id}`}
                            className="px-3 py-1.5 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all"
                          >
                            <Edit size={12} />
                            Continuar
                          </Link>
                          <Link
                            to={`/fornecedor/propostas/${prop.id}`}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
                          >
                            <Eye size={12} />
                            Visualizar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================================================================
            4. WIDGET "CALENDÁRIO DE LICITAÇÕES" (EXATO À ARTE)
        =================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Calendar size={18} className="text-[#EA580C]" />
              Calendário de Licitações
            </h3>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (mesAtualBase === 0) {
                    setMesAtualBase(11);
                    setAnoAtualBase(anoAtualBase - 1);
                  } else {
                    setMesAtualBase(mesAtualBase - 1);
                  }
                }}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-700 min-w-[120px] text-center">
                {nomesMeses[mesAtualBase]} / {nomesMeses[(mesAtualBase + 1) % 12]} {anoAtualBase}
              </span>
              <button
                onClick={() => {
                  if (mesAtualBase === 11) {
                    setMesAtualBase(0);
                    setAnoAtualBase(anoAtualBase + 1);
                  } else {
                    setMesAtualBase(mesAtualBase + 1);
                  }
                }}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* GRID DUAL-MONTH DO CALENDÁRIO OPERACIONAL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* MÊS 1 */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-900 text-center uppercase tracking-wider">
                {nomesMeses[mesAtualBase]}
              </h4>
              <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase">
                <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-700">
                {Array.from({ length: mes1Info.primeiroDiaSemana }).map((_, i) => (
                  <div key={`empty-1-${i}`} className="p-2" />
                ))}
                {Array.from({ length: mes1Info.totalDias }).map((_, i) => {
                  const dia = i + 1;
                  const eventos = getEventosDia(dia, mesAtualBase, anoAtualBase);
                  const temEvento = eventos.length > 0;
                  return (
                    <button
                      key={`day-1-${dia}`}
                      onClick={() => temEvento && setEventoSelecionado(eventos[0])}
                      className={`p-2 rounded-xl transition-all relative flex flex-col items-center justify-center ${temEvento
                        ? 'bg-slate-100 hover:bg-orange-50 font-black text-slate-900 cursor-pointer shadow-2xs'
                        : 'hover:bg-slate-50'
                        }`}
                    >
                      <span>{dia}</span>
                      {temEvento && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {eventos.map((ev, evIdx) => (
                            <span
                              key={evIdx}
                              className={`h-1.5 w-1.5 rounded-full ${getDotClass(ev.type)}`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MÊS 2 */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-900 text-center uppercase tracking-wider">
                {nomesMeses[(mesAtualBase + 1) % 12]}
              </h4>
              <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase">
                <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-700">
                {Array.from({ length: mes2Info.primeiroDiaSemana }).map((_, i) => (
                  <div key={`empty-2-${i}`} className="p-2" />
                ))}
                {Array.from({ length: mes2Info.totalDias }).map((_, i) => {
                  const dia = i + 1;
                  const mes2 = (mesAtualBase + 1) % 12;
                  const ano2 = mesAtualBase === 11 ? anoAtualBase + 1 : anoAtualBase;
                  const eventos = getEventosDia(dia, mes2, ano2);
                  const temEvento = eventos.length > 0;
                  return (
                    <button
                      key={`day-2-${dia}`}
                      onClick={() => temEvento && setEventoSelecionado(eventos[0])}
                      className={`p-2 rounded-xl transition-all relative flex flex-col items-center justify-center ${temEvento
                        ? 'bg-slate-100 hover:bg-orange-50 font-black text-slate-900 cursor-pointer shadow-2xs'
                        : 'hover:bg-slate-50'
                        }`}
                    >
                      <span>{dia}</span>
                      {temEvento && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {eventos.map((ev, evIdx) => (
                            <span
                              key={evIdx}
                              className={`h-1.5 w-1.5 rounded-full ${getDotClass(ev.type)}`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEGENDA OFICIAL DOS 4 TIPOS DE EVENTOS (EXATA À ARTE) */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-600" />
              <span>Prazo de proposta</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#EA580C]" />
              <span>Abertura de propostas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#0A2540]" />
              <span>Sessão pública</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-blue-600 bg-white" />
              <span>Envio de proposta</span>
            </div>
          </div>
        </div>

      </div>

      {/* =======================================================================
          MODAL DETALHES DO EVENTO DO CALENDÁRIO
      ======================================================================= */}
      {eventoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${getDotClass(eventoSelecionado.type)}`} />
                <h3 className="font-black text-slate-900 text-sm">
                  {eventoSelecionado.type.replace('_', ' ')}
                </h3>
              </div>
              <button
                onClick={() => setEventoSelecionado(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Título do Evento</p>
                <p className="font-bold text-slate-900 text-sm">{eventoSelecionado.title}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Órgão Licitante</p>
                <p className="font-medium text-slate-700">{eventoSelecionado.orgao}</p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Data Agendada</p>
                  <p className="font-bold text-slate-800">
                    {eventoSelecionado.day} de {nomesMeses[eventoSelecionado.month]} de {eventoSelecionado.year}
                  </p>
                </div>
                {eventoSelecionado.time && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Horário Limite</p>
                    <p className="font-bold text-brand-orange">{eventoSelecionado.time}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setEventoSelecionado(null)}
                className="px-4 py-2 bg-brand-dark text-white text-xs font-bold rounded-xl hover:bg-slate-900"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL CRIAR PROPOSTA (UNIFICADO COM CHAVE SELETORA AUTOMÁTICO / MANUAL)
      ======================================================================= */}
      {modalCriarAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-brand-dark text-white rounded-xl shadow-xs">
                  {modoPreenchimento === 'automatico' ? (
                    <Sparkles size={18} className="text-brand-orange" />
                  ) : (
                    <Edit3 size={18} className="text-brand-orange" />
                  )}
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm md:text-base">
                    Criar Proposta Comercial
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Conformidade com a Lei Federal nº 14.133/2021
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalCriarAberto(false);
                  setErroIaOcorrido(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* CHAVE SELETORA CLARA: [Modo Automático] ou [Modo Manual] */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                Modo de Preenchimento
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  id="tab-modo-automatico"
                  onClick={() => setModoPreenchimento('automatico')}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    modoPreenchimento === 'automatico'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles size={15} className={modoPreenchimento === 'automatico' ? 'text-brand-orange' : 'text-slate-400'} />
                  Modo Automático
                </button>
                <button
                  type="button"
                  id="tab-modo-manual"
                  onClick={() => setModoPreenchimento('manual')}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    modoPreenchimento === 'manual'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 size={15} className={modoPreenchimento === 'manual' ? 'text-brand-orange' : 'text-slate-400'} />
                  Modo Manual
                </button>
              </div>
            </div>

            {/* SELEÇÃO DA EMPRESA EMITENTE (Comum para ambos os modos) */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Empresa Proponente / Emitente
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={empresas.length === 0}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
              >
                {empresas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razaoSocial || (c as any).razao_social} ({c.cnpj})
                  </option>
                ))}
                {empresas.length === 0 && (
                  <option value="">Nenhuma empresa cadastrada</option>
                )}
              </select>
              {empresas.length === 0 && (
                <p className="mt-1 text-[11px] text-red-600">
                  Cadastre uma empresa antes de criar a proposta.
                </p>
              )}
            </div>

            {/* CONTEÚDO ESPECÍFICO DO MODO AUTOMÁTICO */}
            {modoPreenchimento === 'automatico' && (
              <form onSubmit={handlePreencherViaLex} className="space-y-4">
                {/* Seletor de editais com os editais salvos */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Selecione o Edital Salvo ou Disputa
                  </label>
                  <EditalSelector
                    onSelectEdital={handleSelectEdital}
                    selectedId={lexNoticeId}
                  />
                </div>

                {/* Card de Preview de Dados Auto-Preenchidos */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-brand-orange" />
                      Preenchimento Automático do Sistema:
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Conectado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                    <div>
                      <strong className="text-slate-800">Órgão Licitante:</strong>{' '}
                      <span className="text-slate-900 font-medium">
                        {editalSelecionado?.orgao || 'Selecione um edital acima'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-800">Número da Licitação:</strong>{' '}
                      <span className="text-slate-900 font-medium">
                        {editalSelecionado?.numeroEdital || 'Selecione um edital acima'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-800">Empresa:</strong>{' '}
                      <span className="text-slate-900 font-medium">
                        {empresas.find((c) => c.id === companyId)?.razaoSocial || empresas[0]?.razaoSocial || 'Empresa ativa'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-800">Cálculo de Itens:</strong>{' '}
                      <span className="text-emerald-700 font-bold">
                        Puxa itens e valores calculados
                      </span>
                    </div>
                    {editalSelecionado?.objeto && (
                      <div className="sm:col-span-2">
                        <strong className="text-slate-800">Objeto:</strong>{' '}
                        <span className="text-slate-700 line-clamp-2">
                          {editalSelecionado.objeto}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ALERTA AMIGÁVEL SE OCORREU ERRO NA IA (COM 1 CLIQUE PARA MODO MANUAL) */}
                {erroIaOcorrido && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2 text-amber-800 font-bold">
                      <AlertCircle size={16} className="text-amber-600 shrink-0" />
                      <span>Não foi possível conectar ao serviço de IA no momento</span>
                    </div>
                    <p className="text-amber-700 text-[11px] leading-relaxed">
                      {mensagemErroIa || 'O serviço de extração automática não pôde processar este edital no momento.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleFallbackParaManual}
                      className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Edit3 size={14} />
                      Preencher no Modo Manual (1 clique)
                    </button>
                  </div>
                )}

                {/* Botões do Rodapé no Modo Automático */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCriarAberto(false);
                      setErroIaOcorrido(false);
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={extractingLex || !lexNoticeId.trim() || !companyId}
                    className="px-5 py-2.5 bg-brand-orange hover:bg-orange-600 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    {extractingLex ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Calculando e gerando proposta...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Gerar Proposta Automática
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* CONTEÚDO ESPECÍFICO DO MODO MANUAL */}
            {modoPreenchimento === 'manual' && (
              <form onSubmit={handleCriarManual} className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed font-medium">
                  <strong>Modo Manual Ativo:</strong> Todos os campos abaixo estão editáveis para você preencher ou alterar itens livremente.
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Título da Proposta
                  </label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    required
                    placeholder="Ex: Proposta Comercial - Pregão 45/2026"
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Órgão Licitante
                    </label>
                    <input
                      type="text"
                      value={orgaoManual}
                      onChange={(e) => setOrgaoManual(e.target.value)}
                      placeholder="Ex: Tribunal Regional Federal"
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Número do Edital / Licitação
                    </label>
                    <input
                      type="text"
                      value={numeroEditalManual}
                      onChange={(e) => setNumeroEditalManual(e.target.value)}
                      placeholder="Ex: Pregão Eletrônico 12/2026"
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Objeto da Licitação
                  </label>
                  <textarea
                    rows={2}
                    value={objetoManual}
                    onChange={(e) => setObjetoManual(e.target.value)}
                    placeholder="Descrição do objeto da contratação..."
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Critério de Julgamento
                  </label>
                  <select
                    value={criterioJulgamentoManual}
                    onChange={(e) => setCriterioJulgamentoManual(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  >
                    <option value="menor_preco">Menor Preço</option>
                    <option value="maior_desconto">Maior Desconto</option>
                    <option value="melhor_tecnica">Melhor Técnica</option>
                    <option value="tecnica_e_preco">Técnica e Preço</option>
                    <option value="maior_lance">Maior Lance</option>
                    <option value="maior_retorno_economico">Maior Retorno Econômico</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Validade da Proposta (Dias)
                    </label>
                    <input
                      type="number"
                      value={validadeDias}
                      onChange={(e) => setValidadeDias(Number(e.target.value))}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Prazo de Entrega (Dias)
                    </label>
                    <input
                      type="number"
                      value={prazoEntregaDias}
                      onChange={(e) => setPrazoEntregaDias(Number(e.target.value))}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Botões do Rodapé no Modo Manual */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCriarAberto(false);
                      setErroIaOcorrido(false);
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingManual || !titulo.trim() || !companyId}
                    className="px-5 py-2.5 bg-brand-orange hover:bg-orange-600 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    {savingManual ? 'Criando Rascunho...' : 'Criar Proposta Manual'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropostasPage;