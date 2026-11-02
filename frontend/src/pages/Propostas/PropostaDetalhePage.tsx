import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Download,
  Copy,
  DollarSign,
  Building2,
  ShieldCheck,
  Clock,
  Layers,
  Scale,
  Printer,
  Trash2,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  propostasApi,
  ProposalDto,
  ProposalItemDto,
  ProposalComplianceDto,
} from '@/services/api';
import { FORNECEDOR_ROUTES } from '@/routes';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';

// =============================================================================
// AS 6 DECLARAÇÕES OBRIGATÓRIAS DA LEI FEDERAL Nº 14.133/2021 & UTILITÁRIO PDF
// =============================================================================
import {
  DECLARACOES_OBRIGATORIAS_14133,
  DadosDocumentoProposta,
  formatarMoeda,
  imprimirPropostaPdf,
} from '@/utils/pdfGenerator';

export { DECLARACOES_OBRIGATORIAS_14133 };

type ProposalDeclarationField =
  | 'declaracaoIndependente'
  | 'declaracaoHabilitacao'
  | 'declaracaoMenor'
  | 'declaracaoMeEpp'
  | 'declaracaoInidoneidade'
  | 'declaracaoAcessibilidade';

const DECLARATION_FIELDS: Record<number, ProposalDeclarationField> = {
  1: 'declaracaoIndependente',
  2: 'declaracaoHabilitacao',
  3: 'declaracaoMenor',
  4: 'declaracaoInidoneidade',
  5: 'declaracaoAcessibilidade',
  6: 'declaracaoMeEpp',
};

export const PropostaDetalhePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [proposta, setProposta] = useState<ProposalDto | null>(null);
  const [compliance, setCompliance] = useState<ProposalComplianceDto | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Dados da Licitação (Órgão Licitante e Objeto) Auto-preenchidos
  // ---------------------------------------------------------------------------
  const [orgaoLicitante, setOrgaoLicitante] = useState<string>('');
  const [objetoLicitacao, setObjetoLicitacao] = useState<string>('');
  const [numeroEdital, setNumeroEdital] = useState<string>('');
  const [modalidadeEdital, setModalidadeEdital] = useState<string>('');

  // ---------------------------------------------------------------------------
  // 2. Itens da Proposta com Matemática em Tempo Real
  // ---------------------------------------------------------------------------
  const [itens, setItens] = useState<ProposalItemDto[]>([]);

  // Modal Novo Item
  const [modalItemAberto, setModalItemAberto] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  // Form State do Modal
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [custoDireto, setCustoDireto] = useState<number | ''>('');
  const [encargosPercentual, setEncargosPercentual] = useState<number | ''>('');
  const [margemLucroPercentual, setMargemLucroPercentual] = useState<number | ''>('');

  // Modal Documento Oficial / PDF
  const [modalDocumentoAberto, setModalDocumentoAberto] = useState(false);
  const [gerandoDocumento, setGerandoDocumento] = useState(false);
  const [savingDeclaration, setSavingDeclaration] = useState<number | null>(null);
  const [documentoTexto, setDocumentoTexto] = useState<string>('');

  // Preenchimento Automático via LEX IA (Zero Engenharia de Prompt)
  const [preenchendoLex, setPreenchendoLex] = useState(false);
  const [modalSelecionarEditalLex, setModalSelecionarEditalLex] = useState(false);

  const handlePreencherViaLex = async (editalIdInformado?: string) => {
    const noticeIdAlvo =
      editalIdInformado ||
      proposta?.procurementNoticeId ||
      searchParams.get('edital') ||
      searchParams.get('noticeId');

    if (!noticeIdAlvo) {
      setModalSelecionarEditalLex(true);
      return;
    }

    setPreenchendoLex(true);
    try {
      const res = await propostasApi.preencherPropostaViaLex({
        proposalId: id,
        noticeId: noticeIdAlvo,
        companyId: proposta?.companyId,
      });

      await carregarDados();
      const itensComPreco = (res.data?.data?.items || []).filter(
        (item: ProposalItemDto) => item.precoUnitarioProposto !== null,
      ).length;
      toast.success(
        itensComPreco > 0
          ? `LEX vinculou os itens e encontrou preço cadastrado para ${itensComPreco} item(ns). Revise os dados antes de emitir.`
          : 'LEX extraiu os itens do edital. Informe os custos e preços antes de emitir a proposta.',
      );
      setModalSelecionarEditalLex(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha ao preencher proposta via LEX.');
    } finally {
      setPreenchendoLex(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Carregamento de Dados Reais & Auto-Preenchimento do Painel de Disputas
  // ---------------------------------------------------------------------------
  const carregarDados = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const resProp = await propostasApi.obterPorId(id);

      const propData = resProp.data?.data;
      if (propData) {
        setProposta(propData);
        setItens(propData.items || []);
        setOrgaoLicitante(propData.procurementNotice?.buyerName || '');
        setObjetoLicitacao(propData.procurementNotice?.object || '');
        setNumeroEdital(propData.procurementNotice?.noticeNumber || '');
        setModalidadeEdital(propData.procurementNotice?.modality || '');
      } else {
        setCompliance(null);
      }

      try {
        const resComp = await propostasApi.obterCompliance(id);
        setCompliance(resComp.data?.data || null);
      } catch (error) {
        console.error('[PropostaDetalhePage] Falha ao validar conformidade:', error);
        setCompliance(null);
        toast.error('Não foi possível atualizar a validação de conformidade da proposta.');
      }
    } catch (err: any) {
      console.error('[PropostaDetalhePage] Falha ao carregar proposta:', err);
      toast.error('Não foi possível carregar a proposta selecionada.');
      navigate(FORNECEDOR_ROUTES.propostas);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [id]);

  // ---------------------------------------------------------------------------
  // MATEMÁTICA EM TEMPO REAL + PERSISTÊNCIA NO BANCO: Alteração de Custo Direto, Encargos e Margem
  // ---------------------------------------------------------------------------
  const handleItemFieldChange = (
    itemId: string,
    field: 'custoDireto' | 'encargosPercentual' | 'margemLucroPercentual' | 'quantidade' | 'descricao' | 'precoUnitarioProposto',
    rawValue: string
  ) => {
    const item = itens.find((current) => current.id === itemId);
    if (!item) return;

    const updated = { ...item };
    if (field === 'descricao') {
      updated.descricao = rawValue;
    } else if (field === 'quantidade') {
      updated.quantidade = Number(rawValue) || 1;
    } else if (field === 'precoUnitarioProposto') {
      updated.precoUnitarioProposto = rawValue.trim() === '' ? null : Number(rawValue);
    } else {
      const value = rawValue.trim() === '' ? null : Number(rawValue);
      if (field === 'custoDireto') updated.custoDireto = value;
      if (field === 'encargosPercentual') updated.encargosPercentual = value;
      if (field === 'margemLucroPercentual') updated.margemLucroPercentual = value;
    }

    if (field !== 'descricao') {
      const quantidade = Number(updated.quantidade) || 1;
      if (field === 'precoUnitarioProposto') {
        const custo = Number(updated.custoDireto) || 0;
        const precoUnitario = updated.precoUnitarioProposto;
        updated.precoTotalProposto = precoUnitario === null
          ? null
          : Number((precoUnitario * quantidade).toFixed(2));
        updated.inexequivel = custo > 0 && precoUnitario !== null && precoUnitario <= custo;
      } else {
        const custo = Number(updated.custoDireto);
        const encargos = Number(updated.encargosPercentual ?? updated.bdiPercentual) || 0;
        const margem = Number(updated.margemLucroPercentual) || 0;
        const precoUnitario = custo > 0
          ? Number((custo * (1 + encargos / 100) * (1 + margem / 100)).toFixed(2))
          : null;

        updated.precoUnitarioProposto = precoUnitario;
        updated.precoTotalProposto = precoUnitario === null
          ? null
          : Number((precoUnitario * quantidade).toFixed(2));
        updated.inexequivel = precoUnitario !== null && precoUnitario <= custo;
      }
    }

    setItens((current) => current.map((entry) => entry.id === itemId ? updated : entry));
  };

  const handleSalvarItem = async (itemId: string) => {
    if (!id) return;
    const item = itens.find((current) => current.id === itemId);
    if (!item) return;

    try {
      await propostasApi.atualizarItem(id, itemId, {
        description: item.descricao,
        quantity: Number(item.quantidade) || 1,
        unit: item.unidade || 'UN',
        unitCost: item.custoDireto ?? null,
        encargosPercentual: item.encargosPercentual ?? item.bdiPercentual ?? null,
        marginPercent: item.margemLucroPercentual ?? null,
        proposedPrice: item.precoUnitarioProposto ?? null,
        marca: item.marca,
        modelo: item.modelo,
      });
      const complianceResponse = await propostasApi.obterCompliance(id);
      setCompliance(complianceResponse.data?.data || null);
    } catch (error: any) {
      console.error('[PropostaDetalhePage] Falha ao salvar item:', error);
      toast.error(error.response?.data?.message || 'Não foi possível salvar o item. Os dados serão recarregados.');
      await carregarDados();
    }
  };

  // Remover Linha (Persiste no Backend)
  const handleRemoverLinha = async (itemId: string) => {
    if (!id) return;
    try {
      await propostasApi.removerItem(id, itemId);
      setItens((prev) => prev.filter((it) => it.id !== itemId));
      const complianceResponse = await propostasApi.obterCompliance(id);
      setCompliance(complianceResponse.data?.data || null);
      toast.success('Item removido da proposta.');
    } catch (error) {
      console.error('[PropostaDetalhePage] Falha ao remover item:', error);
      toast.error('Não foi possível remover o item da proposta.');
    }
  };

  // ---------------------------------------------------------------------------
  // 3. REGRA DE VALIDAÇÃO RIGOROSA:
  // Se o "Valor de Venda" final de QUALQUER item ficar menor ou igual ao "Custo Direto",
  // o botão principal de "Gerar PDF da Proposta" deve ficar disabled (cinza/inativo).
  // ---------------------------------------------------------------------------
  const existeItemAbaixoOuIgualAoCusto = useMemo(() => {
    if (!itens || itens.length === 0) return false;
    return itens.some((it) => {
      const custo = Number(it.custoDireto) || 0;
      const venda = Number(it.precoUnitarioProposto) || 0;
      // Validação Art. 59, III da Lei 14.133/2021:
      // Preço de venda menor ou igual ao custo direto
      return custo > 0 && venda <= custo;
    });
  }, [itens]);

  const totalCalculado = useMemo(() => {
    return itens.reduce((acc, it) => acc + (Number(it.precoTotalProposto) || 0), 0);
  }, [itens]);

  const botaoPdfDesabilitado =
    existeItemAbaixoOuIgualAoCusto
    || !compliance?.isCompliant
    || itens.length === 0
    || gerandoDocumento;

  // ---------------------------------------------------------------------------
  // Adicionar Item via Modal Completo
  // ---------------------------------------------------------------------------
  const handleAdicionarItemModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !descricao.trim()) {
      toast.error('Informe a descrição do item.');
      return;
    }

    const custo = custoDireto === '' ? null : Number(custoDireto);
    const encargos = encargosPercentual === '' ? null : Number(encargosPercentual);
    const margem = margemLucroPercentual === '' ? null : Number(margemLucroPercentual);
    const qtd = Number(quantidade) || 1;

    const vendaUnit = custo !== null && custo > 0
      ? Number((custo * (1 + (encargos ?? 0) / 100) * (1 + (margem ?? 0) / 100)).toFixed(2))
      : null;
    const vendaTotal = vendaUnit === null ? null : Number((vendaUnit * qtd).toFixed(2));

    setSavingItem(true);
    try {
      await propostasApi.adicionarItem(id, {
        descricao: descricao.trim(),
        unidade: unidade.trim() || 'UN',
        quantidade: qtd,
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        custoDireto: custo,
        encargosPercentual: encargos,
        bdiPercentual: encargos,
        margemLucroPercentual: margem,
        precoUnitarioProposto: vendaUnit,
        precoTotalProposto: vendaTotal,
      });

      toast.success('Item adicionado à planilha com sucesso!');
      setModalItemAberto(false);
      setDescricao('');
      setQuantidade(1);
      setCustoDireto('');
      setEncargosPercentual('');
      setMargemLucroPercentual('');
      await carregarDados();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar item.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleAdicionarLinhaRapida = () => {
    setDescricao('');
    setUnidade('UN');
    setQuantidade(1);
    setCustoDireto('');
    setEncargosPercentual('');
    setMargemLucroPercentual('');
    setModalItemAberto(true);
  };

  const handleSalvarDeclaracao = async (
    field: ProposalDeclarationField,
    checked: boolean,
    declarationNumber: number,
  ) => {
    if (!id) return;
    setSavingDeclaration(declarationNumber);
    try {
      const response = await propostasApi.atualizarProposta(id, { [field]: checked });
      setProposta(response.data.data);
      const complianceResponse = await propostasApi.obterCompliance(id);
      setCompliance(complianceResponse.data?.data || null);
    } catch (error: any) {
      console.error('[PropostaDetalhePage] Falha ao salvar declaração:', error);
      toast.error(error.response?.data?.message || 'Não foi possível registrar a declaração.');
      await carregarDados();
    } finally {
      setSavingDeclaration(null);
    }
  };

  const obterDadosDocumento = (): DadosDocumentoProposta => ({
    proposta,
    orgaoLicitante,
    numeroEdital,
    objetoLicitacao,
    modalidadeEdital,
    itens,
    totalCalculado,
  });

  // ---------------------------------------------------------------------------
  // Geração do PDF da Proposta com Impressão Nativa (A4 / TCU / Lei 14.133/21)
  // ---------------------------------------------------------------------------
  const handleGerarPdfProposta = async () => {
    if (existeItemAbaixoOuIgualAoCusto) {
      toast.error('Não é possível emitir a proposta. Margem negativa detectada (preço inexequível - Art. 59, III).');
      return;
    }

    setGerandoDocumento(true);
    try {
      const dadosDoc = obterDadosDocumento();
      const response = await propostasApi.gerarDocumento(id!);
      const textoCompleto = response.data.data.document;
      setDocumentoTexto(textoCompleto);

      const printSuccess = imprimirPropostaPdf(dadosDoc);
      if (!printSuccess) {
        toast.error('Permita janelas popup no navegador para imprimir ou salvar em PDF.');
      } else {
        toast.success('Documento gerado após validação e sincronização com a proposta salva.');
      }
    } catch (err: any) {
      console.error('[PropostaDetalhePage] Falha ao validar/gerar proposta:', err);
      toast.error(err.response?.data?.message || 'Não foi possível validar e gerar a proposta.');
    } finally {
      setGerandoDocumento(false);
    }
  };

  const handleDownloadDoc = () => {
    if (!documentoTexto) {
      toast.error('Valide e gere a proposta antes de baixar o documento.');
      return;
    }
    const texto = documentoTexto;
    const blob = new Blob([texto], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Proposta_Comercial_${proposta?.company?.razaoSocial?.replace(/[^a-zA-Z0-9]/g, '_') || 'Oficial'}_${id?.slice(0, 8)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Download do arquivo oficial iniciado!');
  };

  const handleCopiarTexto = () => {
    if (!documentoTexto) {
      toast.error('Valide e gere a proposta antes de copiar o documento.');
      return;
    }
    const texto = documentoTexto;
    navigator.clipboard.writeText(texto);
    toast.success('Texto com as 6 declarações copiado com sucesso!');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center animate-pulse">
          <div className="h-10 w-10 border-4 border-[#0A2540] border-t-[#EA580C] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-[#0A2540]">Carregando seu gerador de propostas...</p>
          <p className="text-xs text-slate-500 mt-1">Conformidade e Inteligência sob a Lei 14.133/2021</p>
        </div>
      </div>
    );
  }

  if (!proposta) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* BREADCRUMB & BACK BUTTON */}
        <div className="flex items-center justify-between">
          <Link
            to={FORNECEDOR_ROUTES.propostas}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0A2540] transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
          >
            <ArrowLeft size={14} />
            Voltar para Gerador de Propostas
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
              {proposta.status}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-100 text-[#EA580C]">
              {proposta.criterioJulgamento?.replace('_', ' ') || 'Menor Preço'}
            </span>
          </div>
        </div>

        {/* HERO CARD DA PROPOSTA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 lg:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                  <FileText size={22} />
                </span>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {proposta.titulo}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    ID: <span className="font-mono">{proposta.id}</span> • Criada em{' '}
                    {new Date(proposta.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            {/* AÇÃO PRINCIPAL E ALERTA VERMELHO PRÓXIMO AO BOTÃO BLOQUEADO */}
            <div className="flex flex-col items-end gap-2 shrink-0 max-w-xl">

              {/* 4. ALERTA VERMELHO VISÍVEL PRÓXIMO AO BOTÃO */}
              {existeItemAbaixoOuIgualAoCusto && (
                <div
                  id="alerta-bloqueio-prejuizo"
                  className="w-full p-3.5 rounded-xl bg-red-600 text-white font-black text-xs flex items-center gap-2.5 shadow-lg border-2 border-red-700 animate-pulse"
                >
                  <AlertTriangle size={20} className="shrink-0 text-white" />
                  <span className="leading-snug">
                    Atenção: Margem negativa detectada. Risco de desclassificação por preço inexequível. Ajuste seus custos para liberar o documento.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {/* 1. BOTÃO DE AÇÃO PRIMÁRIA: PREENCHER PROPOSTA VIA LEX */}
                <button
                  type="button"
                  id="btn-preencher-proposta-lex"
                  onClick={() => handlePreencherViaLex()}
                  disabled={preenchendoLex}
                  className="px-5 py-3 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Extrai Termo de Referência e cruza com Catálogo de Produtos da empresa automaticamente"
                >
                  <Sparkles size={16} className="text-[#EA580C]" />
                  {preenchendoLex ? 'Cruzando Edital & Catálogo via LEX...' : 'Preencher Proposta via LEX'}
                </button>

                <button
                  type="button"
                  onClick={handleAdicionarLinhaRapida}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Plus size={16} />
                  Adicionar Item na Tabela
                </button>

                {/* 3. BOTÃO PRINCIPAL "GERAR PROPOSTA PDF" (DISABLED SE ITEM <= CUSTO) */}
                <button
                  type="button"
                  id="btn-gerar-pdf-proposta"
                  onClick={handleGerarPdfProposta}
                  disabled={botaoPdfDesabilitado}
                  title={
                    existeItemAbaixoOuIgualAoCusto
                      ? 'Proposta bloqueada: margem negativa detectada (preço inexequível - Art. 59, III da Lei 14.133/21).'
                      : itens.length === 0
                        ? 'Adicione itens na tabela para gerar o PDF da proposta.'
                        : 'Gerar Proposta PDF Oficial sob a Lei 14.133/21'
                  }
                  className={`px-5 py-3 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg ${botaoPdfDesabilitado
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none'
                    : 'bg-[#EA580C] hover:bg-orange-600 text-white cursor-pointer hover:shadow-xl'
                    }`}
                >
                  <Printer size={16} />
                  {gerandoDocumento ? 'Processando PDF...' : 'Gerar Proposta PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* 1. SEÇÃO DE INPUTS "ÓRGÃO LICITANTE" E "OBJETO" AUTO-PREENCHIDOS DO PAINEL DE DISPUTAS */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#0A2540] text-white rounded-lg">
                  <Building2 size={16} />
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Dados Oficiais da Licitação & Órgão Licitante
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Preenchidos com os dados do edital escolhido no painel de disputas.
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                <CheckCircle size={12} className="text-emerald-600" />
                Dados do edital vinculados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Input Órgão Licitante */}
              <div className="md:col-span-5 space-y-1">
                <label
                  htmlFor="input-orgao-licitante"
                  className="block text-[11px] font-black text-slate-700 uppercase tracking-wider"
                >
                  Órgão Licitante *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Building2 size={15} />
                  </span>
                  <input
                    id="input-orgao-licitante"
                    type="text"
                    value={orgaoLicitante}
                    onChange={(e) => setOrgaoLicitante(e.target.value)}
                    placeholder="Ex: Tribunal Regional Federal, Prefeitura Municipal..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0A2540] focus:border-[#0A2540] outline-none transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Input Número do Edital */}
              <div className="md:col-span-2 space-y-1">
                <label
                  htmlFor="input-numero-edital"
                  className="block text-[11px] font-black text-slate-700 uppercase tracking-wider"
                >
                  Edital / Aviso *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Scale size={15} />
                  </span>
                  <input
                    id="input-numero-edital"
                    type="text"
                    value={numeroEdital}
                    onChange={(e) => setNumeroEdital(e.target.value)}
                    placeholder="Ex: PE 104/2026"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0A2540] focus:border-[#0A2540] outline-none transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Input Objeto da Licitação */}
              <div className="md:col-span-5 space-y-1">
                <label
                  htmlFor="input-objeto-licitacao"
                  className="block text-[11px] font-black text-slate-700 uppercase tracking-wider"
                >
                  Objeto da Licitação *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <FileText size={15} />
                  </span>
                  <textarea
                    id="input-objeto-licitacao"
                    rows={2}
                    value={objetoLicitacao}
                    onChange={(e) => setObjetoLicitacao(e.target.value)}
                    placeholder="Descrição detalhada do objeto licitado..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#0A2540] focus:border-[#0A2540] outline-none transition shadow-2xs resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* INDICADORES RESUMO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign size={13} className="text-[#EA580C]" />
                Valor Total Homologado
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                {formatarMoeda(totalCalculado)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Soma de {itens.length} item(ns)</p>
            </div>

            <div className={`p-4 rounded-xl border transition-all ${!existeItemAbaixoOuIgualAoCusto
              ? 'bg-emerald-50/40 border-emerald-300'
              : 'bg-red-50/50 border-red-300'
              }`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Scale size={13} className={!existeItemAbaixoOuIgualAoCusto ? 'text-emerald-700' : 'text-red-700'} />
                Exequibilidade (Art. 59, III)
              </span>
              <div className="flex items-center gap-2 mt-1">
                {!existeItemAbaixoOuIgualAoCusto ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Sinal Verde (Lucro Seguro)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-800 bg-red-100 px-2.5 py-1 rounded-md border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    Trava Ativa (Preço &le; Custo)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {!existeItemAbaixoOuIgualAoCusto
                  ? 'Todos os itens com preço superior ao custo'
                  : 'Risco de desclassificação legal imediata'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock size={13} className="text-blue-600" />
                Validade da Proposta
              </span>
              <p className="text-base font-bold text-slate-900 mt-1">
                {proposta.validadeDias} dias corridos
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Padrão Art. 90 da Lei 14.133/21
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-600" />
                6 Declarações Lei 14.133
              </span>
              <div className="mt-1">
                {compliance?.isCompliant || compliance === null ? (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md">
                    <CheckCircle size={14} /> 6 Declarações Inclusas
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md">
                    <AlertTriangle size={14} /> Revisão Pendente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Elaboração independente, menores, etc.</p>
            </div>
          </div>
        </div>

        {/* 2. TABELA DE ITENS COM MATEMÁTICA EM TEMPO REAL */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Itens e preços da proposta
                </h2>
                <span className="bg-orange-100 text-[#EA580C] text-[10px] font-black uppercase px-2 py-0.5 rounded">
                  Lei 14.133/21
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Informe seus custos, tributos e margem de lucro. O valor final é atualizado conforme você preenche a proposta. Confira se o preço cobre seus custos antes do envio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handlePreencherViaLex()}
                disabled={preenchendoLex}
                className="text-xs bg-[#0A2540] hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={15} className="text-[#EA580C]" />
                {preenchendoLex ? 'Processando LEX...' : 'Preencher Proposta via LEX'}
              </button>
              <button
                type="button"
                onClick={handleAdicionarLinhaRapida}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={15} /> Adicionar Linha de Item
              </button>
            </div>
          </div>

          {preenchendoLex ? (
            /* ESQUELETO DE CARREGAMENTO (LOADING SKELETON) */
            <div className="space-y-4 py-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-4 bg-orange-50/70 border border-orange-200 rounded-xl text-orange-950 text-xs font-bold shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="font-black text-slate-900">
                      Preparando as informações da sua proposta...
                    </p>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Conferindo os itens do edital e consultando os custos cadastrados no seu catálogo.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-md bg-orange-200/60 text-orange-900 border border-orange-300">
                  Assistência para propostas
                </span>
              </div>

              {/* Skeleton da Tabela de Itens */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                <div className="p-3 bg-slate-50 flex items-center justify-between text-slate-400 text-[10px] uppercase font-black">
                  <span>Estruturando itens, lotes e formação de preço da proposta...</span>
                  <span className="animate-pulse">Isso pode levar alguns instantes</span>
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-4 bg-slate-200 rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                    <div className="w-16 h-4 bg-slate-100 rounded shrink-0 hidden sm:block" />
                    <div className="w-24 h-4 bg-slate-200 rounded shrink-0" />
                    <div className="w-20 h-4 bg-slate-100 rounded shrink-0 hidden md:block" />
                    <div className="w-20 h-4 bg-slate-100 rounded shrink-0 hidden md:block" />
                    <div className="w-28 h-4 bg-slate-200 rounded shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : itens.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Layers size={36} className="text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Nenhum item adicionado à proposta.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Clique no botão abaixo para preencher os itens automaticamente a partir do edital via LEX ou insira itens manualmente.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handlePreencherViaLex()}
                  className="text-xs bg-[#0A2540] hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Sparkles size={15} className="text-[#EA580C]" />
                  Preencher Proposta via LEX
                </button>
                <button
                  type="button"
                  onClick={handleAdicionarLinhaRapida}
                  className="text-xs bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-xs hover:bg-slate-100 cursor-pointer"
                >
                  <Plus size={14} /> Inserir Item Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50/90">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3 min-w-[220px]">Descrição do Item / Objeto</th>
                    <th className="p-3 text-center w-28">Qtd / Un</th>
                    <th className="p-3 text-right w-36">Custo Direto (R$)</th>
                    <th className="p-3 text-right w-32">Tributos/Encargos (%)</th>
                    <th className="p-3 text-right w-32">Margem de Lucro (%)</th>
                    <th className="p-3 text-right w-40">Valor Unitário Ofertado</th>
                    <th className="p-3 text-right w-36">Valor Final Ofertado Total</th>
                    <th className="p-3 text-center w-32">Exequibilidade (Art. 59, III)</th>
                    <th className="p-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {itens.map((it, idx) => {
                    const custo = Number(it.custoDireto) || 0;
                    const venda = Number(it.precoUnitarioProposto) || 0;
                    const isItemInexequivel = custo > 0 && venda <= custo;

                    return (
                      <tr
                        key={it.id || idx}
                        className={`transition-colors ${isItemInexequivel ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50/70'
                          }`}
                      >
                        {/* Posição */}
                        <td className="p-3 font-bold text-center text-slate-900">
                          {it.numero || idx + 1}
                        </td>

                        {/* Descrição */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={it.descricao}
                            onChange={(e) => handleItemFieldChange(it.id, 'descricao', e.target.value)}
                            onBlur={() => void handleSalvarItem(it.id)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#0A2540] font-bold text-slate-900 focus:bg-white px-1 py-1 rounded outline-none transition"
                            placeholder="Descrição do item licitado..."
                          />
                        </td>

                        {/* Quantidade & Unidade */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={it.quantidade}
                              onChange={(e) => handleItemFieldChange(it.id, 'quantidade', e.target.value)}
                              onBlur={() => void handleSalvarItem(it.id)}
                              className="w-16 px-1.5 py-1 text-center font-bold bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-[#0A2540] outline-none"
                            />
                            <span className="font-bold text-slate-500 uppercase text-[11px]">
                              {it.unidade || 'UN'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Custo Direto (Input Numérico) */}
                        <td className="p-3 text-right">
                          <div className="relative inline-block w-full">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.custoDireto ?? ''}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  it.id,
                                  'custoDireto',
                                  e.target.value
                                )
                              }
                              onBlur={() => void handleSalvarItem(it.id)}
                              placeholder="0,00"
                              className={`w-full pl-7 pr-2 py-1.5 bg-white border rounded-lg text-right font-black focus:ring-2 outline-none text-xs ${isItemInexequivel
                                ? 'border-red-400 text-red-900 focus:ring-red-500'
                                : 'border-slate-300 text-slate-900 focus:ring-[#0A2540]'
                                }`}
                            />
                          </div>
                        </td>

                        {/* 2. Encargos (%) (Input Numérico) */}
                        <td className="p-3 text-right">
                          <div className="relative inline-block w-full">
                            <input
                              type="number"
                              step="0.1"
                              value={it.encargosPercentual ?? it.bdiPercentual ?? ''}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  it.id,
                                  'encargosPercentual',
                                  e.target.value
                                )
                              }
                              onBlur={() => void handleSalvarItem(it.id)}
                              placeholder="0"
                              className="w-full pr-5 pl-2 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-black text-slate-900 focus:ring-2 focus:ring-[#0A2540] outline-none text-xs"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                              %
                            </span>
                          </div>
                        </td>

                        {/* 2. Margem de Lucro (%) (Input Numérico) */}
                        <td className="p-3 text-right">
                          <div className="relative inline-block w-full">
                            <input
                              type="number"
                              step="0.1"
                              value={it.margemLucroPercentual ?? ''}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  it.id,
                                  'margemLucroPercentual',
                                  e.target.value
                                )
                              }
                              onBlur={() => void handleSalvarItem(it.id)}
                              placeholder="0"
                              className={`w-full pr-5 pl-2 py-1.5 bg-white border rounded-lg text-right font-black focus:ring-2 outline-none text-xs ${Number(it.margemLucroPercentual) <= 0
                                ? 'border-amber-400 text-amber-900 focus:ring-amber-500'
                                : 'border-slate-300 text-slate-900 focus:ring-[#0A2540]'
                                }`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                              %
                            </span>
                          </div>
                        </td>

                        {/* Valor informado pelo licitante; referências ficam separadas do preço ofertado. */}
                        <td className="p-3 text-right font-black">
                          <div className="space-y-1">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={it.precoUnitarioProposto ?? ''}
                                onChange={(event) => handleItemFieldChange(it.id, 'precoUnitarioProposto', event.target.value)}
                                onBlur={() => void handleSalvarItem(it.id)}
                                placeholder="Informe o valor"
                                aria-label={`Valor unitário ofertado para ${it.descricao}`}
                                className={`w-full rounded-lg border bg-white py-1.5 pl-7 pr-2 text-right text-xs font-black outline-none focus:ring-2 ${
                                  isItemInexequivel
                                    ? 'border-red-400 text-red-900 focus:ring-red-500'
                                    : 'border-slate-300 text-slate-900 focus:ring-[#0A2540]'
                                }`}
                              />
                            </div>
                            {it.catalogoPrecoReferencia != null && (
                              <span className="block text-left text-[9px] font-semibold leading-tight text-amber-700">
                                Referência, não ofertada: {formatarMoeda(it.catalogoPrecoReferencia)}
                              </span>
                            )}
                            {isItemInexequivel && (
                              <span className="block text-[9px] font-black text-red-600 leading-none">
                                Preço &le; Custo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Valor de Venda Total (Calculado em Tempo Real) */}
                        <td className="p-3 text-right font-black text-[#0A2540] text-sm">
                          {formatarMoeda(it.precoTotalProposto)}
                        </td>

                        {/* Status de Exequibilidade */}
                        <td className="p-3 text-center">
                          {isItemInexequivel ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-black text-red-800 bg-red-100 border border-red-300 px-2 py-1 rounded-md shadow-2xs"
                              title="Art. 59, III da Lei 14.133/21: O preço final de venda é inferior ou igual ao custo direto."
                            >
                              <AlertTriangle size={12} className="text-red-600 shrink-0" />
                              Inexequível
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-1 rounded-md shadow-2xs">
                              <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                              Viável
                            </span>
                          )}
                        </td>

                        {/* Ação Excluir */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoverLinha(it.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Remover linha"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50/90 font-black text-slate-900">
                    <td colSpan={7} className="p-3 text-right text-xs uppercase tracking-wider">
                      Valor Global Homologado da Proposta:
                    </td>
                    <td className="p-3 text-right text-base text-[#EA580C]">
                      {formatarMoeda(totalCalculado)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ÁREA INFERIOR DE VALIDAÇÃO E DISPARO DO PDF */}
          <div className="pt-4 border-t border-slate-100 space-y-3">

            {/* 4. ALERTA VERMELHO VISÍVEL PRÓXIMO AO BOTÃO RODAPÉ */}
            {existeItemAbaixoOuIgualAoCusto && (
              <div
                id="alerta-bloqueio-prejuizo-rodape"
                className="w-full p-3.5 rounded-xl bg-red-600 text-white font-black text-xs flex items-center gap-2.5 shadow-lg border-2 border-red-700 animate-pulse"
              >
                <AlertTriangle size={20} className="shrink-0 text-white" />
                <span className="leading-snug">
                  Atenção: Margem negativa detectada. Risco de desclassificação por preço inexequível. Ajuste seus custos para liberar o documento.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-500">
                {!existeItemAbaixoOuIgualAoCusto && itens.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle size={15} /> Planilha orçamentária válida. Margem de segurança legal atendida.
                  </span>
                ) : itens.length === 0 ? (
                  <span>Insira itens na tabela para calcular a formação de preço.</span>
                ) : (
                  <span className="text-red-600 font-bold">
                    Ajuste o Custo Direto, Tributos/Encargos ou Margem de Lucro para liberar a emissão do documento.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="btn-gerar-pdf-proposta-rodape"
                  onClick={handleGerarPdfProposta}
                  disabled={botaoPdfDesabilitado}
                  className={`px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-md ${botaoPdfDesabilitado
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none'
                    : 'bg-[#EA580C] hover:bg-orange-600 text-white cursor-pointer hover:shadow-lg'
                    }`}
                >
                  <Printer size={16} />
                  {gerandoDocumento ? 'Emitindo PDF...' : 'Gerar Proposta PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. PAINEL DAS 6 DECLARAÇÕES OBRIGATÓRIAS (LEI 14.133/2021) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-600" />
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Bloco Oficial das 6 Declarações Obrigatórias (Lei 14.133/21)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Revise cada declaração e marque somente as afirmações verdadeiras para sua empresa antes de gerar o PDF.
              </p>
            </div>

            <span className={`inline-flex items-center gap-1 text-xs font-black border px-3 py-1.5 rounded-xl ${
              compliance?.isCompliant
                ? 'text-emerald-800 bg-emerald-100 border-emerald-200'
                : 'text-amber-800 bg-amber-100 border-amber-200'
            }`}>
              {compliance?.isCompliant ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              {compliance?.isCompliant ? 'Validação atual aprovada' : 'Revise e confirme os dados obrigatórios'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DECLARACOES_OBRIGATORIAS_14133.map((dec) => {
              const field = DECLARATION_FIELDS[dec.numero];
              const checked = Boolean(proposta[field]);
              return (
                <div
                  key={dec.numero}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-2 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={savingDeclaration === dec.numero}
                        onChange={(event) => void handleSalvarDeclaracao(field, event.target.checked, dec.numero)}
                        aria-label={`Confirmar ${dec.titulo}`}
                        className="mt-1 h-4 w-4 accent-emerald-600"
                      />
                      <h3 className="text-xs font-black text-slate-900 leading-snug">
                        {dec.titulo}
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      {dec.amparoLegal}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed text-justify line-clamp-4">
                      {dec.texto}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-bold">
                    <span className={checked ? 'text-emerald-700' : 'text-amber-700'}>
                      {checked ? 'Confirmada pelo usuário' : 'Pendente de confirmação'}
                    </span>
                    <span className="text-slate-500">Revise o edital</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* MODAL ADICIONAR ITEM AVANÇADO */}
      {modalItemAberto ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Inserir Novo Item na Planilha
                </h3>
                <p className="text-xs text-slate-500">
                  Formação de preço com validação de exequibilidade (Lei 14.133/21).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalItemAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={handleAdicionarItemModal} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Descrição do Item / Objeto Licitado *
                </label>
                <textarea
                  rows={2}
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Fornecimento de licenças de software corporativo com suporte técnico..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-[#0A2540] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unidade</label>
                  <input
                    type="text"
                    required
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    placeholder="UN, M, KG"
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Opcional"
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Opcional"
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="font-black text-slate-900 text-xs uppercase tracking-wider block">
                  Composição de Custos e Margem (R$)
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Custo Direto (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={custoDireto}
                      onChange={(e) => setCustoDireto(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Encargos (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={encargosPercentual}
                      onChange={(e) => setEncargosPercentual(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Margem Lucro (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={margemLucroPercentual}
                      onChange={(e) => setMargemLucroPercentual(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalItemAberto(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-black transition-all shadow-md disabled:opacity-50"
                >
                  {savingItem ? 'Salvando...' : 'Confirmar e Adicionar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL PREVIEW DO DOCUMENTO OFICIAL */}
      {modalDocumentoAberto ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-600 text-white rounded-lg">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Documento Oficial de Proposta Comercial
                  </h3>
                  <p className="text-xs text-slate-500">
                    Contém as 6 Declarações Obrigatórias e Planilha Orçamentária sob a Lei 14.133/21.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDocumentoAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-[60vh] overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap select-all">
              {documentoTexto}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCopiarTexto}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 text-xs"
              >
                <Copy size={15} /> Copiar Texto Integral
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalDocumentoAberto(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleGerarPdfProposta}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black transition-all shadow-md text-xs flex items-center gap-2"
                >
                  <Printer size={15} /> Validar e imprimir / Salvar em PDF
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDoc}
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-orange-600 text-white font-black transition-all shadow-md text-xs flex items-center gap-2"
                >
                  <Download size={15} /> Baixar Arquivo (.doc / Word)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL SELEÇÃO DIRETA DE EDITAL PARA PREENCHIMENTO VIA LEX (ZERO PROMPT) */}
      {modalSelecionarEditalLex ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#0A2540] text-white rounded-lg">
                  <Sparkles size={18} className="text-[#EA580C]" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Preencher Proposta via LEX
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Selecione o edital para o LEX extrair os itens e cruzar com seus produtos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSelecionarEditalLex(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Selecione o Edital Monitorado ou Disputa
                </label>
                <EditalSelector
                  onSelectEdital={(ed: EditalOption) => {
                    handlePreencherViaLex(ed.id || ed.numeroEdital);
                  }}
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
                O LEX fará a leitura vetorial do Termo de Referência, extraindo os lotes, itens e estimativas e cruzando automaticamente com os custos do seu Catálogo de Produtos.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalSelecionarEditalLex(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default PropostaDetalhePage;
