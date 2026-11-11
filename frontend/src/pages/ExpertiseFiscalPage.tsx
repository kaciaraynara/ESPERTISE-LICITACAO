import React, { useState, useEffect } from 'react';
import {
  Scales,
  ShieldCheck,
  Check,
  Warning,
  UploadSimple,
  FileText,
  Sparkle,
  LockKey,
  Calculator,
  CurrencyDollar,
  Buildings,
  Spinner,
  Info,
  X,
  CheckCircle,
  FileCode,
  TrendUp,
  ShieldCheck as ShieldIcon,
  Copy,
  ArrowsLeftRight,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { expertiseFiscalApi } from '../services/api';
import { EditalSelector, EditalOption } from '../components/EditalSelector';
import { useCompany } from '../contexts/CompanyContext';

type TabKey =
  | 'importacao'
  | 'creditos'
  | 'auditoria_fiscal'
  | 'perdcomp_compensacao'
  | 'reforma'
  | 'bdi_proposta';

interface CreditOpportunity {
  id: string;
  sourceDocumentId?: string;
  taxType: string;
  originCategory: string;
  status: 'POTENTIAL' | 'VALIDATED' | 'UTILIZED' | 'REJECTED';
  principalAmount: number;
  selicUpdatedAmount: number;
  calculationMemoryJson: any;
  legalBasis: string;
  isDocumented: boolean;
  isLegallyUsable: boolean;
  isAvailableForOffset: boolean;
  validatedByProfessionalName?: string;
  validatedByRegistryCrcOab?: string;
  createdAt: string;
}

export default function ExpertiseFiscalPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<TabKey>('importacao');

  // Estados da Aba 1 (Importação XML)
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importedDocuments, setImportedDocuments] = useState<any[]>([]);

  // Estados da Aba 2 (Créditos Tributários)
  const [credits, setCredits] = useState<CreditOpportunity[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [selectedCreditForMemory, setSelectedCreditForMemory] = useState<CreditOpportunity | null>(null);
  const [selectedCreditForValidation, setSelectedCreditForValidation] = useState<CreditOpportunity | null>(null);
  const [validationProfName, setValidationProfName] = useState('');
  const [validationCrcOab, setValidationCrcOab] = useState('');
  const [validationPerdcomp, setValidationPerdcomp] = useState('');
  const [validating, setValidating] = useState(false);

  // Estados da Aba 3 (Reforma Tributária)
  const [faturamentoAnual, setFaturamentoAnual] = useState<number>(1200000);
  const [operacaoReforma, setOperacaoReforma] = useState<'FORNECIMENTO_BENS' | 'SERVICOS_CONTINUOS' | 'SAUDE_EDUCACAO'>('FORNECIMENTO_BENS');
  const [simulandoReforma, setSimulandoReforma] = useState(false);
  const [reformaResult, setReformaResult] = useState<any>(null);

  // Estados da Aba 4 (BDI & Trava de 5 Etapas)
  const [selectedEdital, setSelectedEdital] = useState<EditalOption | null>(null);
  const [custoDireto, setCustoDireto] = useState<number>(50000);
  const [despesasOperacionais, setDespesasOperacionais] = useState<number>(5000);
  const [margemAlvo, setMargemAlvo] = useState<number>(15);
  const [selectedCreditIds, setSelectedCreditIds] = useState<string[]>([]);
  const [simulandoBdi, setSimulandoBdi] = useState(false);
  const [bdiResult, setBdiResult] = useState<any>(null);

  // Estados da Aba 3 (Auditoria Fiscal & Anexo IV - Módulo 05)
  const [selectedAuditEdital, setSelectedAuditEdital] = useState<EditalOption | null>(null);
  const [auditOrgaoNome, setAuditOrgaoNome] = useState('');
  const [auditOrgaoCnpj, setAuditOrgaoCnpj] = useState('');
  const [executandoAuditoria, setExecutandoAuditoria] = useState(false);
  const [auditoriaResult, setAuditoriaResult] = useState<any>(null);
  const [modalAnexoIvOpen, setModalAnexoIvOpen] = useState(false);
  const [declaracaoAnexoIvTexto, setDeclaracaoAnexoIvTexto] = useState('');

  // Estados da Aba 4 (PER/DCOMP & Compensação Cruzada DCTFWeb - Módulo 07)
  const [loadingPerdcomp, setLoadingPerdcomp] = useState(false);
  const [perdcompBatchResult, setPerdcompBatchResult] = useState<any>(null);
  const [selectedDebitoTipo, setSelectedDebitoTipo] = useState<
    'ESOCIAL_PREVIDENCIARIO' | 'REINF_RETENCOES' | 'DARF_FAZENDARIO' | 'DAS_SIMPLES'
  >('ESOCIAL_PREVIDENCIARIO');
  const [selectedDebitoCompetencia, setSelectedDebitoCompetencia] = useState('10/2026');
  const [selectedDebitoCodigo, setSelectedDebitoCodigo] = useState('1082-01');
  const [selectedDebitoValor, setSelectedDebitoValor] = useState<number>(3500);
  const [debitosList, setDebitosList] = useState<any[]>([]);
  const [novoProtocoloCreditId, setNovoProtocoloCreditId] = useState('');
  const [novoProtocoloNumero, setNovoProtocoloNumero] = useState('');
  const [salvandoProtocolo, setSalvandoProtocolo] = useState(false);

  // Carrega créditos e documentos ao montar a página
  useEffect(() => {
    void carregarCreditos();
    void carregarDocumentos();
  }, [selectedCompany?.id]);

  const carregarCreditos = async () => {
    setLoadingCredits(true);
    try {
      const res = await expertiseFiscalApi.listarCreditos();
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCredits(res.data.data);
      }
    } catch {
      // Ignora erro inicial
    } finally {
      setLoadingCredits(false);
    }
  };

  const carregarDocumentos = async () => {
    try {
      const res = await expertiseFiscalApi.listarDocumentos();
      if (res.data?.success && Array.isArray(res.data.data)) {
        setImportedDocuments(res.data.data);
      }
    } catch {
      // Ignora erro
    }
  };

  // Submissão do Upload de XML
  const handleImportXml = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !rawText.trim()) {
      toast.error('Selecione um arquivo .xml / .txt ou cole o conteúdo do XML.');
      return;
    }

    setImporting(true);
    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await expertiseFiscalApi.importarXml(formData);
      } else {
        res = await expertiseFiscalApi.importarXmlContent({
          filename: 'nota-fiscal.xml',
          fileContent: rawText,
        });
      }

      if (res.data?.success) {
        toast.success(res.data.message || 'XML importado e auditado com sucesso!');
        setImportResult(res.data.data);
        setFile(null);
        setRawText('');
        void carregarCreditos();
        void carregarDocumentos();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Falha ao importar XML.');
    } finally {
      setImporting(false);
    }
  };

  // Validação Formal do Crédito (CRC / OAB)
  const handleValidateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditForValidation) return;
    if (!validationProfName.trim() || !validationCrcOab.trim()) {
      toast.error('Informe o nome do profissional e o número de registro CRC/OAB.');
      return;
    }

    setValidating(true);
    try {
      const res = await expertiseFiscalApi.validarCredito(selectedCreditForValidation.id, {
        validatedByProfessionalName: validationProfName,
        validatedByRegistryCrcOab: validationCrcOab,
        perdcompProtocol: validationPerdcomp || undefined,
      });

      if (res.data?.success) {
        toast.success('Crédito validado com sucesso! Agora ele atende à Trava de 5 Etapas.');
        setSelectedCreditForValidation(null);
        setValidationProfName('');
        setValidationCrcOab('');
        setValidationPerdcomp('');
        void carregarCreditos();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Erro ao validar crédito.');
    } finally {
      setValidating(false);
    }
  };

  // Simulação da Reforma Tributária
  const handleSimularReforma = async () => {
    setSimulandoReforma(true);
    try {
      const res = await expertiseFiscalApi.simularReforma({
        grossRevenueAnnual: faturamentoAnual,
        operationType: operacaoReforma,
      });
      if (res.data?.success) {
        setReformaResult(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha na simulação da Reforma.');
    } finally {
      setSimulandoReforma(false);
    }
  };

  // Simulação BDI & Precificação com Trava de 5 Etapas
  const handleSimularBdi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (custoDireto <= 0) {
      toast.error('Informe um custo direto maior que zero.');
      return;
    }

    setSimulandoBdi(true);
    try {
      const res = await expertiseFiscalApi.simularPropostaBdi({
        noticeId: selectedEdital?.id || selectedEdital?.numeroControlePNCP,
        directCost: custoDireto,
        operationalExpenses: despesasOperacionais,
        targetMarginPercent: margemAlvo,
        creditOpportunityIds: selectedCreditIds,
      });

      if (res.data?.success) {
        setBdiResult(res.data.data);
        toast.success('Simulação concluída com auditoria da Trava de 5 Etapas!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha ao processar simulação.');
    } finally {
      setSimulandoBdi(false);
    }
  };

  // Execução de Auditoria Fiscal Inteligente (Módulo 05)
  const handleExecutarAuditoria = async () => {
    setExecutandoAuditoria(true);
    try {
      const res = await expertiseFiscalApi.executarAuditoriaFiscal({
        noticeId: selectedAuditEdital?.id || selectedAuditEdital?.numeroControlePNCP,
        orgaoDestinatarioNome: auditOrgaoNome || undefined,
        orgaoDestinatarioCnpj: auditOrgaoCnpj || undefined,
      });

      if (res.data?.success) {
        setAuditoriaResult(res.data.data);
        if (res.data.data?.declaracaoNaoRetencaoAnexoIV?.modeloTextoPreenchido) {
          setDeclaracaoAnexoIvTexto(res.data.data.declaracaoNaoRetencaoAnexoIV.modeloTextoPreenchido);
        }
        toast.success('Auditoria fiscal concluída com sucesso!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha ao executar auditoria fiscal.');
    } finally {
      setExecutandoAuditoria(false);
    }
  };

  // Preparação de PER/DCOMP e Compensação Cruzada DCTFWeb (Módulo 07)
  const handleCarregarPerdcomp = async (customDebitos?: any[], customProtocolos?: any[]) => {
    setLoadingPerdcomp(true);
    try {
      const res = await expertiseFiscalApi.prepararPerdcompCompensacaoCruzada({
        debitosParaCompensar: customDebitos || (debitosList.length > 0 ? debitosList : undefined),
        protocolosParaRegistrar: customProtocolos,
      });
      if (res.data?.success) {
        setPerdcompBatchResult(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha ao processar espelho PER/DCOMP.');
    } finally {
      setLoadingPerdcomp(false);
    }
  };

  const handleAddDebito = () => {
    if (selectedDebitoValor <= 0) {
      toast.error('Informe um valor de débito maior que zero.');
      return;
    }
    const novo = {
      tipoDebito: selectedDebitoTipo,
      competencia: selectedDebitoCompetencia,
      codigoReceita: selectedDebitoCodigo,
      valorOriginalDebito: selectedDebitoValor,
    };
    const updated = [...debitosList, novo];
    setDebitosList(updated);
    void handleCarregarPerdcomp(updated);
    toast.success('Débito adicionado para simulação de compensação cruzada!');
  };

  const handleSalvarProtocolo = async (creditId: string) => {
    if (!novoProtocoloNumero.trim()) {
      toast.error('Informe o número do protocolo do PER/DCOMP gerado no e-CAC.');
      return;
    }
    setSalvandoProtocolo(true);
    try {
      await handleCarregarPerdcomp(undefined, [{ creditId, protocolo: novoProtocoloNumero }]);
      setNovoProtocoloCreditId('');
      setNovoProtocoloNumero('');
      void carregarCreditos();
      toast.success('Protocolo do PER/DCOMP registrado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar protocolo.');
    } finally {
      setSalvandoProtocolo(false);
    }
  };

  // Métricas Consolidadas do Topo
  const totalCreditosPrincipal = credits.reduce((acc, c) => acc + Number(c.principalAmount), 0);
  const totalCreditosSelic = credits.reduce((acc, c) => acc + Number(c.selicUpdatedAmount), 0);
  const creditosValidadosCount = credits.filter((c) => c.status === 'VALIDATED').length;
  const creditosPotenciaisCount = credits.filter((c) => c.status === 'POTENTIAL').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans selection:bg-brand-orange selection:text-white">
      {/* CABEÇALHO PRINCIPAL COM IDENTIDADE CORPORATIVA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider mb-2">
            <Scales className="w-4 h-4 text-indigo-600" weight="fill" />
            Módulo Estratégico Oficial • Expertise Fiscal (Fase 1)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Inteligência Tributária & Blindagem Fiscal de Licitações
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Auditoria automatizada de notas fiscais, scanner de retenções indevidas (IN 1.234/12 & INSS), simulador da Reforma Tributária e BDI com Trava de 5 Etapas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-2">
            <Buildings className="w-4 h-4 text-slate-500" />
            <span>{selectedCompany?.razaoSocial || 'Empresa Ativa'}</span>
          </span>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">XMLs Auditados</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <FileCode className="w-5 h-5" weight="duotone" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{importedDocuments.length}</span>
            <span className="text-xs text-slate-500 block mt-0.5">documentos importados</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Créditos Identificados</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CurrencyDollar className="w-5 h-5" weight="duotone" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600">
              R$ {totalCreditosPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">
              R$ {totalCreditosSelic.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} com SELIC
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Status dos Créditos</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck className="w-5 h-5" weight="duotone" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{creditosValidadosCount}</span>
            <span className="text-xs font-bold text-emerald-600">Validados (CRC/OAB)</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium block mt-0.5">
            {creditosPotenciaisCount} pendentes de validação formal
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Trava de 5 Etapas</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <LockKey className="w-5 h-5" weight="duotone" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md uppercase">
              Ativa & Blindada
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Zero compensação sem documento auditado
            </span>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE ABAS DA FASE 1 */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('importacao')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'importacao'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UploadSimple className="w-4 h-4" weight="bold" />
            <span>1. Diagnóstico & XML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('creditos')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'creditos'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CurrencyDollar className="w-4 h-4" weight="bold" />
            <span>2. Scanner de Créditos ({credits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('auditoria_fiscal');
              if (!auditoriaResult) void handleExecutarAuditoria();
            }}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'auditoria_fiscal'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" weight="bold" />
            <span>3. Auditoria Fiscal & Anexo IV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('perdcomp_compensacao');
              if (!perdcompBatchResult) void handleCarregarPerdcomp();
            }}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'perdcomp_compensacao'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowsLeftRight className="w-4 h-4" weight="bold" />
            <span>4. PER/DCOMP & DCTFWeb</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('reforma');
              if (!reformaResult) void handleSimularReforma();
            }}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'reforma'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendUp className="w-4 h-4" weight="bold" />
            <span>5. Reforma Tributária (CBS/IBS)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bdi_proposta')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'bdi_proposta'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" weight="bold" />
            <span>6. BDI & Trava de 5 Etapas</span>
          </button>
        </nav>
      </div>

      {/* =====================================================================
          ABA 1: IMPORTAÇÃO E DIAGNÓSTICO FISCAL (MÓDULO 01)
          ===================================================================== */}
      {activeTab === 'importacao' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form de Upload */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <UploadSimple className="w-5 h-5 text-brand-blue" weight="bold" />
                Upload de Documento Fiscal (NF-e / SPED)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Envie o arquivo <strong>.xml</strong> da nota fiscal eletrônica (modelo 55) ou <strong>.txt</strong> da EFD/SPED. O sistema extrai automaticamente tributos, itens e alimenta os custos do catálogo.
              </p>

              <form onSubmit={handleImportXml} className="mt-5 space-y-4">
                {/* Drag and Drop Box */}
                <div className="border-2 border-dashed border-slate-300 hover:border-brand-blue rounded-2xl p-6 text-center transition bg-slate-50/50">
                  <input
                    type="file"
                    id="fiscal-file-input"
                    accept=".xml,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="fiscal-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue border border-blue-200">
                      <FileCode className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {file ? file.name : 'Clique para selecionar arquivo .xml ou .txt'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Tamanho máximo: 25MB • Blindagem SHA-256 contra duplicidade
                    </span>
                  </label>
                </div>

                <div className="text-center text-xs font-bold text-slate-400">OU</div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cole o conteúdo bruto do XML da NF-e:
                  </label>
                  <textarea
                    rows={4}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="<nfeProc xmlns=...><NFe><infNFe>..."
                    className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-blue bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={importing || (!file && !rawText.trim())}
                  className="w-full py-3.5 rounded-xl bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Spinner className="w-4 h-4 animate-spin" />
                      <span>Auditando e Importando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" weight="bold" />
                      <span>Processar Diagnóstico Fiscal</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Resultado do Diagnóstico Imediato */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sparkle className="w-5 h-5 text-amber-500" weight="fill" />
                Diagnóstico do Documento
              </h2>

              {importResult ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                      <CheckCircle className="w-4 h-4" weight="fill" />
                      <span>Documento Auditado com Sucesso</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Chave: <span className="font-mono font-bold text-slate-800">{importResult.importedDocument?.accessKeyOrPeriod}</span>
                    </p>
                    <div className="mt-2 text-xs flex flex-wrap gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                        Sentido: {importResult.direction}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                        Itens: {importResult.itemsCount}
                      </span>
                    </div>
                  </div>

                  {importResult.direction === 'ENTRADA' && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" weight="fill" />
                      <span>
                        <strong>Catálogo Sincronizado:</strong> Os custos unitários de entrada deste documento alimentaram automaticamente o custo base dos produtos para sua precificação de propostas.
                      </span>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <span className="text-xs font-black uppercase text-slate-500 block mb-2">
                      Oportunidades Tributárias Identificadas nesta Nota:
                    </span>
                    {importResult.scannedOpportunities?.length > 0 ? (
                      <ul className="space-y-2 text-xs text-slate-700">
                        {importResult.scannedOpportunities.map((opp: any, idx: number) => (
                          <li key={idx} className="flex items-center justify-between border-b border-slate-200 pb-1.5 last:border-0">
                            <span className="font-bold text-slate-800">{opp.taxType} ({opp.originCategory})</span>
                            <span className="font-black text-emerald-600">
                              + R$ {Number(opp.principalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-slate-500">Nenhuma irregularidade tributária detectada nesta nota.</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl mt-4">
                  <FileText className="w-10 h-10 text-slate-300 mb-2" />
                  <span className="text-xs font-bold text-slate-500">Nenhum diagnóstico recente</span>
                  <span className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Faça o upload do XML ao lado para inspecionar os tributos e auditar retenções na fonte.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Histórico de Documentos Importados */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
            <h3 className="text-base font-black text-slate-900 mb-3">
              Documentos Fiscais no Repositório ({importedDocuments.length})
            </h3>

            {importedDocuments.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum documento fiscal importado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Tipo / Chave</th>
                      <th className="py-2.5 px-3">Sentido</th>
                      <th className="py-2.5 px-3">Data Emissão</th>
                      <th className="py-2.5 px-3">Valor Total</th>
                      <th className="py-2.5 px-3">Hash SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {importedDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <span className="font-black text-slate-900 block">{doc.docType}</span>
                          <span className="font-mono text-[11px] text-slate-500">{doc.accessKeyOrPeriod}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            doc.direction === 'SAIDA' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {doc.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {new Date(doc.issueDate).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          R$ {Number(doc.totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                          {doc.fileHashSha256}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 2: SCANNER DE CRÉDITOS TRIBUTÁRIOS (MÓDULO 02)
          ===================================================================== */}
      {activeTab === 'creditos' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Créditos Tributários Auditados
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Retenções indevidas em órgãos públicos (IN 1.234/12), créditos de INSS (IN 2.110/22) e segregação monofásica no Simples.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void carregarCreditos()}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Spinner className={`w-3.5 h-3.5 ${loadingCredits ? 'animate-spin' : ''}`} />
              <span>Atualizar Scanner</span>
            </button>
          </div>

          {loadingCredits ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="w-6 h-6 animate-spin text-brand-blue" />
            </div>
          ) : credits.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <CurrencyDollar className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">Nenhum crédito tributário identificado ainda</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Importe os XMLs das suas notas fiscais de venda para o governo e compra de insumos na Aba 1 para que o scanner cruze com as regras da IN 1.234/2012 e LC 123/2006.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Origem / Categoria</th>
                    <th className="py-2.5 px-3">Tributo</th>
                    <th className="py-2.5 px-3">Valor Principal</th>
                    <th className="py-2.5 px-3">Valor Atualizado SELIC</th>
                    <th className="py-2.5 px-3">Status Trava</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {credits.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900 block">{c.originCategory}</span>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[260px]">{c.legalBasis}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-black text-slate-800">{c.taxType}</span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        R$ {Number(c.principalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3 font-black text-emerald-600">
                        R$ {Number(c.selicUpdatedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3">
                        {c.status === 'VALIDATED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                            <Check className="w-3 h-3" weight="bold" /> Validado CRC/OAB
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                            <Warning className="w-3 h-3" weight="bold" /> Potencial
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCreditForMemory(c)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer"
                        >
                          Memória
                        </button>
                        {c.status !== 'VALIDATED' && (
                          <button
                            type="button"
                            onClick={() => setSelectedCreditForValidation(c)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer"
                          >
                            Validar CRC/OAB
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal de Memória de Cálculo */}
          {selectedCreditForMemory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-blue" />
                    Memória de Cálculo do Crédito
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedCreditForMemory(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <p><strong>Base Legal:</strong> {selectedCreditForMemory.legalBasis}</p>
                  <p><strong>Valor Principal:</strong> R$ {Number(selectedCreditForMemory.principalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p><strong>Valor Atualizado SELIC:</strong> R$ {Number(selectedCreditForMemory.selicUpdatedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] overflow-x-auto max-h-48">
                    <pre>{JSON.stringify(selectedCreditForMemory.calculationMemoryJson, null, 2)}</pre>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCreditForMemory(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Modal de Validação Profissional CRC / OAB */}
          {selectedCreditForValidation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Validação Formal de Crédito (CRC / OAB)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedCreditForValidation(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Para que este crédito seja aceito na <strong>Trava de 5 Etapas</strong> da proposta, um profissional contábil ou jurídico deve atestar a documentação comprobatória.
                </p>

                <form onSubmit={handleValidateCredit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Contador ou Advogado Responsável:
                    </label>
                    <input
                      type="text"
                      required
                      value={validationProfName}
                      onChange={(e) => setValidationProfName(e.target.value)}
                      placeholder="Ex: Dra. Raynara Kácia / Dr. Carlos Silva"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Registro Profissional (CRC / OAB):
                    </label>
                    <input
                      type="text"
                      required
                      value={validationCrcOab}
                      onChange={(e) => setValidationCrcOab(e.target.value)}
                      placeholder="Ex: OAB/SP 123456 ou CRC/RJ 098765/O"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Protocolo PER/DCOMP Web ou DCTFWeb (Opcional):
                    </label>
                    <input
                      type="text"
                      value={validationPerdcomp}
                      onChange={(e) => setValidationPerdcomp(e.target.value)}
                      placeholder="Ex: 12345.67890.123456"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCreditForValidation(null)}
                      className="w-1/2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={validating}
                      className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {validating ? 'Validando...' : 'Aprovar Crédito'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA 3: AUDITORIA FISCAL INTELIGENTE & DECLARAÇÃO ANEXO IV (MÓDULO 05)
          ===================================================================== */}
      {activeTab === 'auditoria_fiscal' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" weight="bold" />
                  Auditoria Fiscal Inteligente de XMLs & Cruzamento de Editais
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Varredura de divergências fiscais críticas: NCM incompatível com CATMAT, CFOP incorreto em vendas para o poder público e retenções indevidas (IN RFB 1.234/12).
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleExecutarAuditoria()}
                disabled={executandoAuditoria}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {executandoAuditoria ? <Spinner className="w-4 h-4 animate-spin" /> : <Sparkle className="w-4 h-4" weight="fill" />}
                <span>{executandoAuditoria ? 'Auditando...' : 'Reauditar Notas'}</span>
              </button>
            </div>

            {/* Parâmetros Opcionais de Auditoria */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="md:col-span-1">
                <label className="block font-bold text-slate-700 mb-1">
                  Vincular Edital para Cruzamento com CATMAT:
                </label>
                <EditalSelector
                  label="Vincular Edital para Cruzamento com CATMAT:"
                  selectedId={selectedAuditEdital?.id}
                  onSelectEdital={(ed: EditalOption) => setSelectedAuditEdital(ed)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Órgão Público Destinatário:
                </label>
                <input
                  type="text"
                  value={auditOrgaoNome}
                  onChange={(e) => setAuditOrgaoNome(e.target.value)}
                  placeholder="Ex: Tribunal de Justiça / Prefeitura de Santos"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  CNPJ do Órgão Público (Opcional):
                </label>
                <input
                  type="text"
                  value={auditOrgaoCnpj}
                  onChange={(e) => setAuditOrgaoCnpj(e.target.value)}
                  placeholder="Ex: 00.394.460/0001-41"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Banner da Declaração de Não Retenção (Anexo IV da IN RFB 1.234/2012) */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase">
                  <FileText className="w-3.5 h-3.5" weight="bold" /> Modelo Oficial RFB
                </span>
                <h4 className="text-sm font-black text-amber-950">
                  Declaração de Não Retenção do Simples Nacional (Anexo IV da IN RFB 1.234/2012)
                </h4>
                <p className="text-xs text-amber-800 max-w-2xl">
                  Anexe esta declaração preenchida a cada nota fiscal emitida para órgãos públicos para impedir a glosa contábil e retenção indevida de até 5,85% no pagamento do empenho.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAnexoIvOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0"
              >
                <FileText className="w-4 h-4" />
                <span>Visualizar & Copiar Anexo IV</span>
              </button>
            </div>

            {/* Resultados da Auditoria */}
            {executandoAuditoria ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner className="w-8 h-8 animate-spin text-brand-blue" />
              </div>
            ) : auditoriaResult ? (
              <div className="space-y-5">
                {/* Resumo com Status Geral */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Status Geral da Auditoria</span>
                    <span className={`text-lg font-black block mt-1 ${
                      auditoriaResult.statusAuditoria === 'CRITICA'
                        ? 'text-rose-600'
                        : auditoriaResult.statusAuditoria === 'ATENCAO'
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}>
                      {auditoriaResult.statusAuditoria === 'CRITICA'
                        ? 'CRÍTICA • Risco de Glosa'
                        : auditoriaResult.statusAuditoria === 'ATENCAO'
                        ? 'ATENÇÃO • Ajustes Recomendados'
                        : 'REGULAR • Em Conformidade'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {auditoriaResult.totalDivergencias} divergência(s) encontrada(s)
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Risco Financeiro de Glosa</span>
                    <span className="text-lg font-black text-rose-600 block mt-1">
                      R$ {Number(auditoriaResult.resumoFinanceiro?.impactoFinanceiroRiscoGlosa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      retenções federais em risco no empenho
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Créditos de Segregação Monofásica</span>
                    <span className="text-lg font-black text-emerald-600 block mt-1">
                      R$ {Number(auditoriaResult.resumoFinanceiro?.creditosRecuperaveisIdentificados || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      PIS/COFINS recuperável via DAS
                    </span>
                  </div>
                </div>

                {/* Lista de Divergências */}
                <div>
                  <h3 className="text-sm font-black text-slate-900 mb-3">
                    Relatório Detalhado de Divergências ({auditoriaResult.divergencias?.length || 0})
                  </h3>

                  {auditoriaResult.divergencias?.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800 font-medium">
                      Nenhuma divergência tributária ou cadastral encontrada nos documentos auditados.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditoriaResult.divergencias.map((div: any) => (
                        <div
                          key={div.id}
                          className={`p-4 rounded-2xl border text-xs space-y-2 ${
                            div.severidade === 'ALTA'
                              ? 'bg-rose-50/50 border-rose-200'
                              : div.severidade === 'MEDIA'
                              ? 'bg-amber-50/50 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-slate-200/60">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                div.severidade === 'ALTA'
                                  ? 'bg-rose-600 text-white'
                                  : div.severidade === 'MEDIA'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-600 text-white'
                              }`}>
                                {div.severidade}
                              </span>
                              <span className="font-mono text-[11px] text-slate-600">{div.chaveAcesso}</span>
                            </div>
                            <span className="font-black text-slate-900">
                              Impacto: R$ {Number(div.impactoFinanceiroEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <p className="font-bold text-slate-900">{div.descricaoDivergencia}</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700">
                              <strong className="text-rose-700 block mb-0.5">Risco no Empenho / Contrato:</strong>
                              <span>{div.riscoNoEmpenho}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700">
                              <strong className="text-emerald-700 block mb-0.5">Orientação de Correção:</strong>
                              <span>{div.orientacaoCorrecao}</span>
                            </div>
                          </div>

                          <span className="text-[10px] text-slate-400 block pt-1">
                            <strong>Base Legal:</strong> {div.baseLegal}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Modal da Declaração Anexo IV */}
          {modalAnexoIvOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    Declaração de Não Retenção (Anexo IV da IN RFB nº 1.234/2012)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalAnexoIvOpen(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Modelo preenchido conforme os dados cadastrais da empresa e do órgão público. Imprima em papel timbrado ou assine digitalmente via Certificado Digital ICP-Brasil / Gov.br.
                </p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {declaracaoAnexoIvTexto || 'Carregando declaração...'}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(declaracaoAnexoIvTexto);
                      toast.success('Texto da Declaração copiado para a área de transferência!');
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar Declaração</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAnexoIvOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA 4: PER/DCOMP WEB & COMPENSAÇÃO CRUZADA DCTFWEB (MÓDULO 07)
          ===================================================================== */}
      {activeTab === 'perdcomp_compensacao' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ArrowsLeftRight className="w-5 h-5 text-indigo-600" weight="bold" />
                  PER/DCOMP Web & Compensação Cruzada na DCTFWeb
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Espelhos de preenchimento estruturados para o Portal e-CAC com atualização SELIC e abatimento cruzado entre débitos previdenciários (eSocial/Reinf) e créditos fazendários (Lei 13.670/18).
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleCarregarPerdcomp()}
                disabled={loadingPerdcomp}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Spinner className={`w-3.5 h-3.5 ${loadingPerdcomp ? 'animate-spin' : ''}`} />
                <span>Recalcular Lote</span>
              </button>
            </div>

            {loadingPerdcomp ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner className="w-8 h-8 animate-spin text-brand-blue" />
              </div>
            ) : perdcompBatchResult ? (
              <div className="space-y-6">
                {/* Resumo da Compensação Cruzada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Créditos Validados</span>
                    <span className="text-xl font-black text-slate-900 block mt-1">
                      {perdcompBatchResult.totalCreditosValidadosDisponiveis} créditos
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      R$ {Number(perdcompBatchResult.totalCreditosValidadosValor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total com Atualização SELIC</span>
                    <span className="text-xl font-black text-emerald-600 block mt-1">
                      R$ {Number(perdcompBatchResult.totalCreditosComSelicValor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-slate-500">Art. 39, § 4º Lei 9.250/95</span>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Abatimento Cruzado DCTFWeb</span>
                    <span className="text-xl font-black text-indigo-600 block mt-1">
                      R$ {Number(perdcompBatchResult.capacidadeAbatimentoCruzadoDctfWeb?.creditosFazendariosParaDebitosPrevidenciarios || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-slate-500">eSocial / Reinf abatidos</span>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Saldo Credor Remanescente</span>
                    <span className="text-xl font-black text-slate-900 block mt-1">
                      R$ {Number(perdcompBatchResult.capacidadeAbatimentoCruzadoDctfWeb?.saldoRestanteCreditosParaFuturasDcomp || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-slate-500">disponível para futuras DCOMPs</span>
                  </div>
                </div>

                {/* Simulador de Batimento de Débitos na DCTFWeb */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-indigo-600" />
                      Simular Batimento de Débitos Previdenciários / Fazendários (DCTFWeb)
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">Lei nº 13.670/2018</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tipo do Débito:</label>
                      <select
                        value={selectedDebitoTipo}
                        onChange={(e) => setSelectedDebitoTipo(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="ESOCIAL_PREVIDENCIARIO">eSocial (INSS Folha / Patronal)</option>
                        <option value="REINF_RETENCOES">EFD-Reinf (Retenções de Tomador)</option>
                        <option value="DARF_FAZENDARIO">DARF Fazendário (IRPJ / CSLL / PIS)</option>
                        <option value="DAS_SIMPLES">DAS (Simples Nacional)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Competência:</label>
                      <input
                        type="text"
                        value={selectedDebitoCompetencia}
                        onChange={(e) => setSelectedDebitoCompetencia(e.target.value)}
                        placeholder="MM/AAAA (ex: 10/2026)"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Código de Receita:</label>
                      <input
                        type="text"
                        value={selectedDebitoCodigo}
                        onChange={(e) => setSelectedDebitoCodigo(e.target.value)}
                        placeholder="Ex: 1082-01 ou 0561"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Valor do Débito (R$):</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={selectedDebitoValor}
                          onChange={(e) => setSelectedDebitoValor(Number(e.target.value))}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddDebito}
                          className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {debitosList.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Débitos Inclusos no Batimento:</span>
                      <div className="flex flex-wrap gap-2">
                        {debitosList.map((d, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200">
                            <strong>{d.tipoDebito}</strong> ({d.competencia} - {d.codigoReceita}): R$ {Number(d.valorOriginalDebito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Espelhos de Preenchimento para PER/DCOMP Web */}
                <div>
                  <h3 className="text-sm font-black text-slate-900 mb-3">
                    Espelhos Oficiais para o PER/DCOMP Web (Portal e-CAC)
                  </h3>

                  <div className="space-y-4">
                    {perdcompBatchResult.espelhosPerdcompWeb?.map((espelho: any) => (
                      <div key={espelho.creditId} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div>
                            <span className="font-black text-slate-900 text-sm">
                              Item #{espelho.numeroOrdem} • {espelho.tipoCreditoEcac}
                            </span>
                            <span className="text-xs text-slate-500 block">
                              Origem: {espelho.chaveAcessoDocumento} • Competência: {espelho.periodoApuracaoCompetencia}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs">
                              R$ {Number(espelho.valorAtualizadoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (com SELIC)
                            </span>

                            {espelho.statusTransmitido ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[11px] font-bold">
                                Protocolo: {espelho.protocoloPerdcomp}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setNovoProtocoloCreditId(espelho.creditId)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                              >
                                Registrar Protocolo e-CAC
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Formulário de registro do protocolo */}
                        {novoProtocoloCreditId === espelho.creditId && (
                          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-center gap-2 text-xs">
                            <span className="font-bold text-indigo-900 shrink-0">Número do Recibo/Protocolo transmitido no e-CAC:</span>
                            <input
                              type="text"
                              value={novoProtocoloNumero}
                              onChange={(e) => setNovoProtocoloNumero(e.target.value)}
                              placeholder="Ex: 12345.67890.123456"
                              className="w-full sm:w-64 p-2 rounded-lg border border-indigo-300 bg-white"
                            />
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSalvarProtocolo(espelho.creditId)}
                                disabled={salvandoProtocolo}
                                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setNovoProtocoloCreditId('')}
                                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Grid dos Campos para Cópia no e-CAC */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Campo 01 • Contribuinte</span>
                            <span className="font-bold text-slate-800">{espelho.espelhoFormularioEcac.campo01_IdentificacaoContribuinte}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Campo 02 • Grupo do Crédito</span>
                            <span className="font-bold text-slate-800">{espelho.espelhoFormularioEcac.campo02_GrupoCredito}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Campo 05 • Código da Receita DARF/DAS</span>
                            <span className="font-mono font-bold text-indigo-700">{espelho.espelhoFormularioEcac.campo05_CodigoReceitaPrincipal}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Campo 07 • Valor Original</span>
                            <span className="font-mono font-bold text-slate-900">{espelho.espelhoFormularioEcac.campo07_ValorOriginal}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Campo 08 • Atualização SELIC Acumulada</span>
                            <span className="font-mono font-bold text-emerald-700">{espelho.espelhoFormularioEcac.campo08_IndiceSelic}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Campo 09 • Valor Total Atualizado</span>
                            <span className="font-mono font-black text-emerald-700">{espelho.espelhoFormularioEcac.campo09_ValorTotalComSelic}</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between gap-2">
                          <span>
                            <strong>Responsável Técnico pela Validação:</strong> {espelho.responsavelTecnicoValidacao.nome} ({espelho.responsavelTecnicoValidacao.registroCrcOuOab}) em {espelho.responsavelTecnicoValidacao.dataValidacao}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(espelho.espelhoFormularioEcac, null, 2));
                              toast.success('Campos do formulário copiados!');
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copiar Campos
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                Nenhum crédito validado disponível para geração do PER/DCOMP. Valide os créditos identificados na Aba 2 para habilitar a compensação cruzada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 3: SIMULADOR DA REFORMA TRIBUTÁRIA (MÓDULO 03)
          ===================================================================== */}
      {activeTab === 'reforma' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendUp className="w-5 h-5 text-indigo-600" weight="bold" />
              Simulador da Reforma Tributária nas Licitações (EC 132/23 & LC 214/25)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Avalie como a substituição de PIS/COFINS/ICMS/ISS pelo IVA Dual (CBS + IBS) e o mecanismo de <strong>Split Payment</strong> afetarão o fluxo de caixa dos seus contratos com o governo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Faturamento Anual Estimado (R$):
                </label>
                <input
                  type="number"
                  value={faturamentoAnual}
                  onChange={(e) => setFaturamentoAnual(Number(e.target.value))}
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Operação nas Licitações:
                </label>
                <select
                  value={operacaoReforma}
                  onChange={(e) => setOperacaoReforma(e.target.value as any)}
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="FORNECIMENTO_BENS">Fornecimento de Bens em Geral (0% redutor)</option>
                  <option value="SERVICOS_CONTINUOS">Serviços Técnicos Regulamentados (30% redutor)</option>
                  <option value="SAUDE_EDUCACAO">Saúde, Medicamentos e Educação (60% redutor)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSimularReforma}
                  disabled={simulandoReforma}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {simulandoReforma ? <Spinner className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  <span>Calcular Impacto</span>
                </button>
              </div>
            </div>

            {reformaResult && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Cenário Atual */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                  <span className="text-xs font-black uppercase text-slate-400 block">Cenário Atual (2025)</span>
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-3xl font-black text-slate-900">
                      {reformaResult.cenarioAtual?.cargaTributariaPercent}%
                    </span>
                    <span className="text-xs text-slate-500 block">carga estimada (Simples/Presumido)</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>Tributos anuais: <strong>R$ {reformaResult.cenarioAtual?.tributosAnuais?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p>Sistema cumulativo parcial com retenções em guias separadas.</p>
                  </div>
                </div>

                {/* Transição 2026 */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
                  <span className="text-xs font-black uppercase text-brand-blue block">Alíquota-Teste 2026</span>
                  <div className="border-b border-blue-100 pb-3">
                    <span className="text-3xl font-black text-brand-blue">
                      {reformaResult.cenarioTransicao2026?.aliquotaTotalTestePercent}%
                    </span>
                    <span className="text-xs text-slate-600 block">CBS 0,90% + IBS 0,10%</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>Impacto: <strong>R$ {reformaResult.cenarioTransicao2026?.impactoTributarioAnual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p className="text-emerald-700 font-bold">100% compensável com PIS/COFINS devidos.</p>
                  </div>
                </div>

                {/* Cenário Pleno IVA Dual */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
                  <span className="text-xs font-black uppercase text-indigo-700 block">IVA Dual Pleno & Split Payment</span>
                  <div className="border-b border-indigo-100 pb-3">
                    <span className="text-3xl font-black text-indigo-900">
                      {reformaResult.cenarioPlenoIvaDual?.aliquotaEfetivaFinalPercent?.toFixed(2)}%
                    </span>
                    <span className="text-xs text-indigo-700 block">{reformaResult.cenarioPlenoIvaDual?.reducerDescription}</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-700">
                    <p>Retenção Split Payment: <strong>R$ {reformaResult.cenarioPlenoIvaDual?.retencaoSplitPaymentGoverno?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p>Crédito s/ Insumos: <strong className="text-emerald-600">- R$ {reformaResult.cenarioPlenoIvaDual?.creditoFinanceiroInsumos?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p className="pt-1 font-bold text-slate-900">Recebimento Líquido: R$ {reformaResult.cenarioPlenoIvaDual?.fluxoCaixaLiquidoPosSplitPayment?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 4: BDI & TRAVA DE 5 ETAPAS (MÓDULO 04 - CRUZAMENTO TRIBUTAÇÃO X LICITAÇÃO)
          ===================================================================== */}
      {activeTab === 'bdi_proposta' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-orange" weight="bold" />
              Precificação Estratégica & BDI com Trava de 5 Etapas
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Conecte a proposta a um edital da plataforma e simule lado a lado o <strong>Cenário A (Padrão)</strong> e o <strong>Cenário B (Otimizado com Crédito Validado)</strong>, mantendo a exequibilidade legal do Art. 59 da Lei 14.133/2021.
            </p>

            <form onSubmit={handleSimularBdi} className="mt-6 space-y-6">
              {/* Seletor de Edital Ativo */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <EditalSelector
                  label="Conectar Edital Ativo da Plataforma:"
                  selectedId={selectedEdital?.id}
                  onSelectEdital={(ed) => setSelectedEdital(ed)}
                />
                {selectedEdital && (
                  <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" weight="fill" />
                    <span>Edital Selecionado: <strong>{selectedEdital.numeroControlePNCP || selectedEdital.numeroEdital}</strong> — {selectedEdital.orgao}</span>
                  </div>
                )}
              </div>

              {/* Custos e Margem */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custo Direto dos Insumos (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={custoDireto}
                    onChange={(e) => setCustoDireto(Number(e.target.value))}
                    className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Despesas Indiretas / Operacionais (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={despesasOperacionais}
                    onChange={(e) => setDespesasOperacionais(Number(e.target.value))}
                    className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Margem Líquida Alvo Desejada (%):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={margemAlvo}
                    onChange={(e) => setMargemAlvo(Number(e.target.value))}
                    className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              {/* Seleção de Créditos para a Trava de 5 Etapas */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <span className="text-xs font-black uppercase text-slate-700 block mb-2 flex items-center gap-1.5">
                  <LockKey className="w-4 h-4 text-indigo-600" />
                  Selecione Créditos para Submeter à Trava de 5 Etapas:
                </span>
                {credits.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum crédito disponível no banco de dados.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {credits.map((c) => {
                      const isSelected = selectedCreditIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCreditIds([...selectedCreditIds, c.id]);
                                } else {
                                  setSelectedCreditIds(selectedCreditIds.filter((id) => id !== c.id));
                                }
                              }}
                              className="rounded-sm text-indigo-600"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{c.originCategory} ({c.taxType})</span>
                              <span className="text-[10px] text-slate-500 block truncate max-w-sm">{c.legalBasis}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-600 block">
                              R$ {Number(c.principalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`text-[10px] font-bold uppercase ${c.status === 'VALIDATED' ? 'text-emerald-700' : 'text-amber-600'}`}>
                              {c.status === 'VALIDATED' ? 'Validado CRC/OAB' : 'Pendente (POTENTIAL)'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={simulandoBdi}
                className="w-full py-4 rounded-2xl bg-brand-orange hover:bg-orange-600 text-white font-black text-sm uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-98"
              >
                {simulandoBdi ? <Spinner className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" weight="bold" />}
                <span>Executar Precificação Tributária com Trava de 5 Etapas</span>
              </button>
            </form>

            {/* Painel de Resultados Lado a Lado (Cenário A vs Cenário B) */}
            {bdiResult && (
              <div className="mt-8 space-y-6 pt-6 border-t border-slate-200">
                {/* Relatório da Trava de 5 Etapas */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
                  <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                    <ShieldIcon className="w-5 h-5 text-indigo-600" weight="fill" />
                    Resultado da Trava de 5 Etapas de Conformidade Fiscal
                  </h3>
                  <div className="mt-3 space-y-2">
                    {bdiResult.travaDeSeguranca5Etapas?.auditoriaDetalhada?.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                        <div className="flex items-center justify-between font-bold">
                          <span>{item.originCategory} ({item.taxType})</span>
                          <span className={item.validation.passed ? 'text-emerald-600' : 'text-rose-600'}>
                            {item.validation.passed ? 'APROVADO (5/5 Travas)' : 'REJEITADO'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{item.validation.reason}</p>
                        <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] text-center font-bold">
                          <span className={`p-1 rounded ${item.validation.lockResults.lock1Exists ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>1. Valor &gt; 0</span>
                          <span className={`p-1 rounded ${item.validation.lockResults.lock2Documented ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>2. Doc XML</span>
                          <span className={`p-1 rounded ${item.validation.lockResults.lock3LegallyUsable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>3. Legal</span>
                          <span className={`p-1 rounded ${item.validation.lockResults.lock4Validated ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>4. CRC/OAB</span>
                          <span className={`p-1 rounded ${item.validation.lockResults.lock5Available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>5. Disponível</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparativo de Cenários */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cenário A: Padrão */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <span className="text-[11px] font-black uppercase text-slate-400 block">Cenário A</span>
                      <h4 className="text-lg font-black text-slate-900">Proposta Padrão sem Créditos</h4>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Custo Total:</span>
                        <strong className="text-slate-900">R$ {bdiResult.cenarioA_Padrao?.custoTotalValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Tributos Estimados ({bdiResult.cenarioA_Padrao?.tributosPercent}%):</span>
                        <strong className="text-slate-900">R$ {bdiResult.cenarioA_Padrao?.tributosValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Margem Líquida Alvo:</span>
                        <strong className="text-emerald-600">{bdiResult.cenarioA_Padrao?.margemLiquidaPercent?.toFixed(2)}% (R$ {bdiResult.cenarioA_Padrao?.margemLiquidaValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</strong>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Preço de Venda da Proposta</span>
                      <span className="text-3xl font-black text-slate-900">
                        R$ {bdiResult.cenarioA_Padrao?.precoVenda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Piso de Exequibilidade (Art. 59, III - Lei 14.133/21):</strong> R$ {bdiResult.premissas?.pisoExequibilidadeLei14133Art59?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Preço mínimo que cobre custos e tributos).
                      </span>
                    </div>
                  </div>

                  {/* Cenário B: Inteligência Tributária */}
                  <div className="rounded-3xl border-2 border-emerald-500 bg-gradient-to-b from-emerald-50/40 via-white to-white p-6 shadow-md space-y-4">
                    <div className="border-b border-emerald-100 pb-3 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-black uppercase text-emerald-700 block">Cenário B</span>
                        <h4 className="text-lg font-black text-emerald-950">Inteligência Fiscal & Créditos</h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase">
                        Blindagem Total
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between">
                        <span>Tributo Devido na Nota:</span>
                        <strong className="text-slate-900">R$ {bdiResult.cenarioB_Otimizado?.tributoDevidoNota?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Crédito Validado Compensado:</span>
                        <span>- R$ {bdiResult.cenarioB_Otimizado?.creditoAproveitadoCompensacao?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tributo Efetivo a Pagar:</span>
                        <strong className="text-slate-900">R$ {bdiResult.cenarioB_Otimizado?.tributoEfetivoAPagar?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-black border-t border-slate-100 pt-1.5">
                        <span>Ganho Líquido de Caixa:</span>
                        <span>+ R$ {bdiResult.cenarioB_Otimizado?.ganhoFinanceiroLiquidoCaixa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-600 text-white text-center shadow-md">
                      <span className="text-[11px] font-bold uppercase opacity-80 block">Margem Efetiva Real de Caixa</span>
                      <span className="text-3xl font-black">
                        {bdiResult.cenarioB_Otimizado?.margemCaixaRealPercent?.toFixed(2)}%
                      </span>
                      <span className="text-xs opacity-90 block mt-0.5">
                        (R$ {bdiResult.cenarioB_Otimizado?.margemCaixaRealValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                      <p>
                        <strong>Preço Oficial Sugerido ao Órgão:</strong> R$ {bdiResult.cenarioB_Otimizado?.precoVendaOficialProposta?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Preserva piso legal do certame).
                      </p>
                      <p className="text-emerald-700 font-bold">
                        Margem Segura para Desconto Competitivo: até R$ {bdiResult.cenarioB_Otimizado?.descontoMaximoSeguro?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem gerar prejuízo ou desclassificação por inexequibilidade.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
