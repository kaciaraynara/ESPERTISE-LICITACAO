import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { propostasApi, empresasApi, ProposalDto } from '@/services/api';
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
  const { selectedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const editalUrlParam = searchParams.get('edital') || searchParams.get('id');

  const [propostas, setPropostas] = useState<ProposalDto[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregandoDados, setCarregandoDados] = useState(true);

  // Modais
  const [modalManualAberto, setModalManualAberto] = useState(false);
  const [modalLexAberto, setModalLexAberto] = useState(Boolean(editalUrlParam));
  const [eventoSelecionado, setEventoSelecionado] = useState<CalendarEvent | null>(null);

  // Form Nova Proposta Manual
  const [companyId, setCompanyId] = useState(selectedCompany?.id ?? '');
  const [titulo, setTitulo] = useState('Proposta Comercial Oficial');
  const [validadeDias, setValidadeDias] = useState(60);
  const [prazoEntregaDias, setPrazoEntregaDias] = useState(15);
  const [savingManual, setSavingManual] = useState(false);

  // Form Extração LEX IA
  const [lexNoticeId, setLexNoticeId] = useState(editalUrlParam || '');
  const [extractingLex, setExtractingLex] = useState(false);

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
  const carregarDados = async () => {
    setCarregandoDados(true);
    try {
      const [resProp, resEmp] = await Promise.all([
        propostasApi.listar(),
        empresasApi.listar(),
      ]);

      const lista = resProp.data?.data || [];
      setPropostas(Array.isArray(lista) ? lista : []);

      const comps = resEmp.data?.data || resEmp.data || [];
      if (Array.isArray(comps)) {
        setEmpresas(comps);
        const activeCompany = comps.find((company) => company.id === selectedCompany?.id);
        if (activeCompany) {
          setCompanyId(activeCompany.id);
        } else if (comps.length > 0 && !companyId) {
          setCompanyId(comps[0].id);
        }
      }
    } catch (error) {
      console.error('[PropostasPage] Falha ao carregar propostas e empresas:', error);
      toast.error('Não foi possível carregar propostas e empresas. Tente novamente.');
    } finally {
      setCarregandoDados(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

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
        titulo: titulo.trim(),
        validadeDias: Number(validadeDias) || 60,
        prazoEntregaDias: Number(prazoEntregaDias) || 15,
      });

      toast.success('Rascunho de proposta criado!');
      setModalManualAberto(false);
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

  // Preenchimento via LEX IA
  const handlePreencherViaLex = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lexNoticeId.trim()) {
      toast.error('Selecione ou informe o edital a ser extraído.');
      return;
    }

    setExtractingLex(true);
    try {
      const res = await propostasApi.preencherPropostaViaLex({
        noticeId: lexNoticeId.trim(),
        companyId: companyId || undefined,
        autoCreate: true,
      });

      toast.success('Proposta gerada com sucesso via LEX com itens e catálogo cruzados!');
      setModalLexAberto(false);
      const createdProposalId = res.data?.data?.proposalId || res.data?.data?.proposal?.id;
      if (createdProposalId) {
        navigate(`/fornecedor/propostas/${createdProposalId}`);
      } else {
        await carregarDados();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha ao preencher proposta via LEX.');
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
                onClick={() => setModalLexAberto(true)}
                className="px-4 py-2.5 rounded-xl bg-brand-dark hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Sparkles size={16} className="text-brand-orange" />
                Preencher proposta com assistência
              </button>

              <button
                onClick={() => setModalManualAberto(true)}
                className="px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} />
                Nova Proposta
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
                            onClick={() => setModalManualAberto(true)}
                            disabled={empresas.length === 0}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
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
          MODAL EXTRAÇÃO LEX IA (GEMINI)
      ======================================================================= */}
      {modalLexAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-brand-dark text-white rounded-lg">
                  <Sparkles size={18} className="text-brand-orange" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Preencher Proposta via LEX
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O LEX extrai o Termo de Referência e cruza com seu Catálogo de Produtos.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalLexAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePreencherViaLex} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Selecione o Edital Monitorado ou Disputa
                </label>
                <EditalSelector
                  onSelectEdital={(ed: EditalOption) => {
                    setLexNoticeId(ed.id || ed.numeroEdital);
                  }}
                />
                {lexNoticeId && (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    Edital selecionado: <span className="font-mono text-slate-900">{lexNoticeId}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Empresa Emitente da Proposta
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={empresas.length === 0}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
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

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Mais agilidade para preparar sua proposta:</strong> A assistência ajuda a organizar as informações do edital e consultar os custos cadastrados no seu catálogo. Confira os dados e os preços antes de concluir.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalLexAberto(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={extractingLex || !lexNoticeId.trim() || !companyId}
                  className="px-5 py-2 bg-brand-orange hover:bg-orange-600 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {extractingLex ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Preparando sua proposta...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Preparar proposta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL NOVA PROPOSTA MANUAL
      ======================================================================= */}
      {modalManualAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-brand-orange text-white rounded-lg">
                  <Plus size={18} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Nova Proposta Manual (Lei 14.133/21)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Defina os parâmetros gerais da formulação da proposta de preços.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalManualAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCriarManual} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Empresa proponente
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  required
                  disabled={empresas.length === 0}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                >
                  {empresas.length === 0 && <option value="">Nenhuma empresa cadastrada</option>}
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.razaoSocial || empresa.razao_social} ({empresa.cnpj})
                    </option>
                  ))}
                </select>
                {empresas.length === 0 && (
                  <p className="mt-1 text-[11px] text-red-600">
                    Cadastre uma empresa antes de criar a proposta.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Título da Proposta
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
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
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
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
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalManualAberto(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManual || !titulo.trim() || !companyId}
                  className="px-5 py-2 bg-brand-orange hover:bg-orange-600 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2"
                >
                  {savingManual ? 'Criando...' : 'Criar Rascunho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropostasPage;