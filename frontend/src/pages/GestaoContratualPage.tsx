import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Buildings,
  Calculator,
  CalendarCheck,
  CheckCircle,
  Clock,
  Copy,
  Crown,
  DownloadSimple,
  FileText,
  Lock,
  Plus,
  Receipt,
  Scales,
  ShieldCheck,
  Sparkle,
  TrendUp,
  Warning,
  X,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import {
  contratosApi,
  type ContractDto,
  type RelatorioReajusteResponse,
} from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { hasUserPlanFeature } from '@/components/layout/Sidebar';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '@/contexts/CompanyContext';
import { PainelGestaoContratual } from './PainelGestaoContratual';

type ActiveTab = 'alertas' | 'reajuste' | 'guia';

function formatCurrency(value: number | undefined | null): string {
  const num = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(num) ? num : 0);
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function GestaoContratualPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { selectedCompany, companyId } = useCompany();

  // Permissão exclusiva do Plano Master para o Assistente de Reequilíbrio/Repactuação e Robô de Reajuste
  const hasMasterReajuste =
    hasUserPlanFeature(user, 'assistente_repactuacao') ||
    hasUserPlanFeature(user, 'robo_reajuste');

  const [activeTab, setActiveTab] = useState<ActiveTab>('alertas');
  const [loading, setLoading] = useState<boolean>(true);
  const [contratos, setContratos] = useState<ContractDto[]>([]);
  const [kpis, setKpis] = useState({
    totalContratos: 0,
    contratosAtivos: 0,
    contratosCriticos: 0,
    contratosElegiveisReajuste: 0,
    valorTotalAtivo: 0,
  });

  // Modal de Upgrade (Plano Master)
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);

  // Modal de Novo Contrato
  const [showNewContractModal, setShowNewContractModal] = useState<boolean>(false);
  const [savingContract, setSavingContract] = useState<boolean>(false);
  const [formContrato, setFormContrato] = useState({
    numeroContrato: '',
    orgao: '',
    cnpjOrgao: '',
    objeto: '',
    valorInicial: '',
    indiceReajuste: 'IPCA',
    dataBaseOrcamento: '',
    dataAssinatura: new Date().toISOString().slice(0, 10),
    dataFim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    dedicacaoExclusiva: false,
    predominanciaMaoDeObra: false,
    status: 'ATIVO',
    observacoes: '',
  });

  // Estado do Assistente de Reequilíbrio / Repactuação (Exclusivo Master)
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [tipoPleito, setTipoPleito] = useState<'REAJUSTE' | 'REPACTUACAO' | 'REEQUILIBRIO'>('REAJUSTE');
  const [indiceAplicado, setIndiceAplicado] = useState<string>('IPCA');
  const [percentualReajuste, setPercentualReajuste] = useState<string>('4.83');
  const [variacaoMaoDeObra, setVariacaoMaoDeObra] = useState<string>('6.50');
  const [variacaoInsumos, setVariacaoInsumos] = useState<string>('4.20');
  const [pesoMaoDeObra, setPesoMaoDeObra] = useState<string>('70');
  const [mesesRetroativos, setMesesRetroativos] = useState<string>('3');
  const [justificativaAdicional, setJustificativaAdicional] = useState<string>('');
  const [registrarAditivo, setRegistrarAditivo] = useState<boolean>(true);
  const [calculandoReajuste, setCalculandoReajuste] = useState<boolean>(false);
  const [resultadoReajuste, setResultadoReajuste] = useState<RelatorioReajusteResponse['data'] | null>(null);
  const [salarioAtualCct, setSalarioAtualCct] = useState('');
  const [novoSalarioCct, setNovoSalarioCct] = useState('');
  const [quantidadePostosCct, setQuantidadePostosCct] = useState('1');
  const [gerandoOficioCct, setGerandoOficioCct] = useState(false);

  const carregarContratos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await contratosApi.listar();
      const payload = response.data?.data;
      if (payload) {
        setContratos(payload.contratos || []);
        setKpis(
          payload.kpis || {
            totalContratos: 0,
            contratosAtivos: 0,
            contratosCriticos: 0,
            contratosElegiveisReajuste: 0,
            valorTotalAtivo: 0,
          },
        );
        setSelectedContractId((prev) => {
          if (prev && payload.contratos?.some((contract) => contract.id === prev)) {
            return prev;
          }
          const selectedContract = payload.contratos?.[0];
          if (selectedContract) {
            setIndiceAplicado(selectedContract.indiceReajuste || 'IPCA');
            setTipoPleito(
              selectedContract.dedicacaoExclusiva || selectedContract.predominanciaMaoDeObra
                ? 'REPACTUACAO'
                : 'REAJUSTE',
            );
            return selectedContract.id;
          }
          return '';
        });
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Não foi possível carregar os contratos da empresa ativa.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyId) return;
    void carregarContratos();
  }, [companyId]);

  const contratoSelecionado = useMemo(
    () => contratos.find((c) => c.id === selectedContractId) || null,
    [contratos, selectedContractId],
  );
  const repactuacaoIndicada = Boolean(
    contratoSelecionado?.dedicacaoExclusiva || contratoSelecionado?.predominanciaMaoDeObra,
  );
  const opcoesPleito: Array<{
    id: 'REAJUSTE' | 'REPACTUACAO' | 'REEQUILIBRIO';
    label: string;
  }> = repactuacaoIndicada
    ? [
        { id: 'REPACTUACAO', label: 'Repactuação (CCT/ACT)' },
        { id: 'REEQUILIBRIO', label: 'Reequilíbrio' },
      ]
    : [
        { id: 'REAJUSTE', label: 'Reajuste por índice' },
        { id: 'REEQUILIBRIO', label: 'Reequilíbrio' },
      ];

  const salarioAtualNumerico = Number(salarioAtualCct.replace(',', '.'));
  const novoSalarioNumerico = Number(novoSalarioCct.replace(',', '.'));
  const quantidadePostosNumerica = Number(quantidadePostosCct);
  const impactoMensalCct =
      Number.isFinite(salarioAtualNumerico) &&
      Number.isFinite(novoSalarioNumerico) &&
      Number.isInteger(quantidadePostosNumerica)
        ? (novoSalarioNumerico - salarioAtualNumerico) * quantidadePostosNumerica
        : 0;
  const impactoAnualCct = impactoMensalCct * 12;

  const handleTabReajusteClick = () => {
    if (!hasMasterReajuste) {
      setShowUpgradeModal(true);
      return;
    }
    setActiveTab('reajuste');
  };

  const handleUpgrade = useCallback(() => setShowUpgradeModal(true), []);

  const handleOpenReajusteForContract = (contrato: ContractDto) => {
    if (!hasMasterReajuste) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedContractId(contrato.id);
    setIndiceAplicado(contrato.indiceReajuste || 'IPCA');
    setTipoPleito(
      contrato.dedicacaoExclusiva || contrato.predominanciaMaoDeObra
        ? 'REPACTUACAO'
        : 'REAJUSTE',
    );
    setResultadoReajuste(null);
    setActiveTab('reajuste');
  };

  const handleCriarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNumerico = Number(String(formContrato.valorInicial).replace(',', '.'));
    if (!formContrato.numeroContrato.trim() || !formContrato.orgao.trim() || !formContrato.objeto.trim()) {
      toast.error('Preencha Número do Contrato, Órgão Contratante e Objeto.');
      return;
    }
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      toast.error('Informe um Valor Inicial válido maior que zero.');
      return;
    }

    setSavingContract(true);
    try {
      const response = await contratosApi.criar({
        numeroContrato: formContrato.numeroContrato.trim(),
        orgao: formContrato.orgao.trim(),
        cnpjOrgao: formContrato.cnpjOrgao.trim() || undefined,
        objeto: formContrato.objeto.trim(),
        valorInicial: valorNumerico,
        indiceReajuste: formContrato.indiceReajuste || 'IPCA',
        dataBaseOrcamento: formContrato.dataBaseOrcamento || formContrato.dataAssinatura,
        dataAssinatura: formContrato.dataAssinatura,
        dataFim: formContrato.dataFim,
        dedicacaoExclusiva: formContrato.dedicacaoExclusiva,
        predominanciaMaoDeObra: formContrato.predominanciaMaoDeObra,
        status: formContrato.status,
        observacoes: formContrato.observacoes.trim() || undefined,
      });

      toast.success(response.data?.message || 'Contrato cadastrado com sucesso!');
      setShowNewContractModal(false);
      setFormContrato({
        numeroContrato: '',
        orgao: '',
        cnpjOrgao: '',
        objeto: '',
        valorInicial: '',
        indiceReajuste: 'IPCA',
        dataBaseOrcamento: '',
        dataAssinatura: new Date().toISOString().slice(0, 10),
        dataFim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dedicacaoExclusiva: false,
        predominanciaMaoDeObra: false,
        status: 'ATIVO',
        observacoes: '',
      });
      await carregarContratos();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar o contrato.');
    } finally {
      setSavingContract(false);
    }
  };

  const handleAlternarStatusContrato = async (contrato: ContractDto) => {
    const novoStatus = contrato.status === 'ATIVO' ? 'ENCERRADO' : 'ATIVO';
    try {
      await contratosApi.atualizar(contrato.id, { status: novoStatus });
      toast.success(`Status do contrato ${contrato.numeroContrato} atualizado para ${novoStatus}.`);
      await carregarContratos();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar status do contrato.');
    }
  };

  const handleGerarRelatorioReajuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMasterReajuste) {
      setShowUpgradeModal(true);
      return;
    }
    if (!selectedContractId) {
      toast.error('Selecione um contrato para calcular o reajuste ou repactuação.');
      return;
    }

    setCalculandoReajuste(true);
    try {
      const response = await contratosApi.gerarRelatorioReajuste(selectedContractId, {
        tipoPleito,
        indiceAplicado,
        percentualReajuste: Number(String(percentualReajuste).replace(',', '.')) || undefined,
        variacaoMaoDeObraPercentual: Number(String(variacaoMaoDeObra).replace(',', '.')) || undefined,
        variacaoInsumosPercentual: Number(String(variacaoInsumos).replace(',', '.')) || undefined,
        pesoMaoDeObra: Number(String(pesoMaoDeObra).replace(',', '.')) || 70,
        mesesRetroativos: Number(mesesRetroativos) || 0,
        justificativaAdicional: justificativaAdicional.trim() || undefined,
        registrarAditivo,
      });

      setResultadoReajuste(response.data.data);
      toast.success(response.data.message || 'Memória de cálculo e requerimento gerados com sucesso!');
      if (registrarAditivo) {
        await carregarContratos();
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgradeModal(true);
        return;
      }
      toast.error(
        err?.response?.data?.message || 'Erro ao processar o cálculo de reajuste contratual.',
      );
    } finally {
      setCalculandoReajuste(false);
    }
  };

  const handleGerarOficioCct = async () => {
    if (!hasMasterReajuste) {
      setShowUpgradeModal(true);
      return;
    }
    if (!selectedContractId || !repactuacaoIndicada) {
      toast.error('Selecione um contrato elegível à repactuação por mão de obra.');
      return;
    }
    if (
      !Number.isFinite(salarioAtualNumerico) ||
      salarioAtualNumerico <= 0 ||
      !Number.isFinite(novoSalarioNumerico) ||
      novoSalarioNumerico <= 0 ||
      !Number.isInteger(quantidadePostosNumerica) ||
      quantidadePostosNumerica <= 0
    ) {
      toast.error('Informe salários válidos e uma quantidade inteira de postos maior que zero.');
      return;
    }

    setGerandoOficioCct(true);
    try {
      const response = await contratosApi.gerarOficioRepactuacao(selectedContractId, {
        salarioAtual: salarioAtualNumerico,
        novoSalario: novoSalarioNumerico,
        quantidadePostos: quantidadePostosNumerica,
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `repactuacao_contrato_${contratoSelecionado?.numeroContrato || selectedContractId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Ofício de repactuação gerado. Revise e anexe a CCT/ACT antes do protocolo.');
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgradeModal(true);
        return;
      }
      toast.error(
        err?.response?.data?.message ||
          'Não foi possível gerar o ofício de repactuação. Confira a elegibilidade do contrato e tente novamente.',
      );
    } finally {
      setGerandoOficioCct(false);
    }
  };

  const handleCopiarRelatorio = () => {
    if (!resultadoReajuste?.relatorioTexto) return;
    navigator.clipboard.writeText(resultadoReajuste.relatorioTexto);
    toast.success('Relatório técnico e requerimento copiados para a área de transferência!');
  };

  const handleBaixarRelatorio = () => {
    if (!resultadoReajuste?.relatorioTexto) return;
    const blob = new Blob([resultadoReajuste.relatorioTexto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reajuste_Contrato_${resultadoReajuste.numeroContrato.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* CABEÇALHO EXECUTIVO */}
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#EA580C]">
                <Receipt weight="fill" className="h-3.5 w-3.5" />
                Módulo Pós-Vitória • Lei 14.133/2021
              </span>
              {selectedCompany?.razaoSocial && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {selectedCompany.razaoSocial}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0A2540] sm:text-3xl">
              Gestão Contratual
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Controle de prazos de vigência, alertas de renovação, termos aditivos e cálculo automático de reajuste, repactuação e reequilíbrio econômico-financeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNewContractModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0A2540] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-slate-800 cursor-pointer"
            >
              <Plus weight="bold" className="h-4 w-4 text-[#EA580C]" />
              Novo Contrato
            </button>
          </div>
        </header>

        {/* CARDS DE INDICADORES (KPIs) */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contratos Ativos
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0A2540]">
                <Buildings weight="duotone" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-[#0A2540]">{kpis.contratosAtivos}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              De {kpis.totalContratos} contrato(s) registrado(s) no CNPJ
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Carteira Vigente
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <TrendUp weight="duotone" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-emerald-700">
              {formatCurrency(kpis.valorTotalAtivo)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Volume financeiro em execução
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Alerta de Vencimento (≤ 60d)
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock weight="duotone" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-amber-600">{kpis.contratosCriticos}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Exigem manifestação de prorrogação
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Elegíveis a Reajuste Anual
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C]">
                <Calculator weight="duotone" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-[#EA580C]">
              {kpis.contratosElegiveisReajuste}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Anualidade atingida (Art. 92, § 3º)
            </p>
          </div>
        </section>

        {/* ABAS DE NAVEGAÇÃO DO MÓDULO */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 pt-4 rounded-t-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {/* ABA 1: ALERTAS DE VENCIMENTO (Disponível a partir do Plano Avançado) */}
            <button
              type="button"
              onClick={() => setActiveTab('alertas')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black transition cursor-pointer ${
                activeTab === 'alertas'
                  ? 'border-[#EA580C] text-[#0A2540]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarCheck weight="duotone" className="h-5 w-5 text-[#EA580C]" />
              Alertas de Vencimento
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
                {contratos.length}
              </span>
            </button>

            {/* ABA 2: ASSISTENTE DE REEQUILÍBRIO/REPACTUAÇÃO (Exclusivo Plano Master) */}
            {hasMasterReajuste ? (
              <button
                type="button"
                onClick={handleTabReajusteClick}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black transition cursor-pointer ${
                  activeTab === 'reajuste'
                    ? 'border-[#EA580C] text-[#0A2540]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Scales weight="duotone" className="h-5 w-5 text-[#EA580C]" />
                Assistente de Reequilíbrio/Repactuação
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">
                  Master
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center gap-2 rounded-t-xl border border-slate-300 bg-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-300 cursor-pointer"
                title="Exclusivo para assinantes do Plano Master"
              >
                <Lock weight="fill" className="h-4 w-4 text-slate-500" />
                <span>Assistente de Reequilíbrio/Repactuação</span>
                <span className="rounded-md bg-slate-300 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                  Desbloquear no Plano Master
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('guia')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black transition cursor-pointer ${
                activeTab === 'guia'
                  ? 'border-[#EA580C] text-[#0A2540]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck weight="duotone" className="h-5 w-5 text-[#EA580C]" />
              Guia e Garantias
            </button>
          </div>
        </div>

        {activeTab === 'guia' && (
          <PainelGestaoContratual
            companyId={selectedCompany?.id}
            contratoSelecionado={contratoSelecionado}
            acessoGarantias={hasUserPlanFeature(user, 'gestao_garantias')}
            onUpgrade={handleUpgrade}
          />
        )}

        {/* CONTEÚDO DA ABA 1: ALERTAS DE VENCIMENTO E CARTEIRA DE CONTRATOS */}
        {activeTab === 'alertas' && (
          <section className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
                <p className="text-sm font-bold text-slate-500">
                  Sincronizando contratos e vigências da empresa...
                </p>
              </div>
            ) : contratos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-[#0A2540]">
                  <Receipt weight="duotone" className="h-8 w-8" />
                </div>
                <h2 className="mt-4 text-lg font-black text-[#0A2540]">
                  Nenhum contrato administrativo cadastrado
                </h2>
                <p className="mx-auto mt-1 max-w-xl text-sm font-medium text-slate-500">
                  Registre seus contratos ganhos com a Administração Pública para monitorar prazos de renovação, aniversários de reajuste anual e termos aditivos.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewContractModal(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-orange-700 cursor-pointer"
                >
                  <Plus weight="bold" className="h-4 w-4" />
                  Cadastrar Primeiro Contrato
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {contratos.map((contrato) => {
                  const badgeVencimento =
                    contrato.nivelAlertaVencimento === 'VENCIDO'
                      ? {
                          label: `Vencido há ${Math.abs(contrato.diasParaVencimento)} dia(s)`,
                          cls: 'bg-red-100 text-red-800 border-red-200',
                        }
                      : contrato.nivelAlertaVencimento === 'CRITICO'
                        ? {
                            label: `Crítico • Vence em ${contrato.diasParaVencimento} dia(s)`,
                            cls: 'bg-amber-100 text-amber-800 border-amber-200',
                          }
                        : contrato.nivelAlertaVencimento === 'ATENCAO'
                          ? {
                              label: `Atenção • Vence em ${contrato.diasParaVencimento} dia(s)`,
                              cls: 'bg-blue-100 text-blue-800 border-blue-200',
                            }
                          : {
                              label: `Vigência Regular (${contrato.diasParaVencimento} dias restantes)`,
                              cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                            };

                  return (
                    <article
                      key={contrato.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300"
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-[#0A2540] px-3 py-1 text-xs font-black text-white">
                              Contrato nº {contrato.numeroContrato}
                            </span>
                            <span
                              className={`rounded-lg border px-2.5 py-1 text-xs font-black ${badgeVencimento.cls}`}
                            >
                              {badgeVencimento.label}
                            </span>
                            <span
                              className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                                contrato.status === 'ATIVO'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Status: {contrato.status}
                            </span>
                            {contrato.elegivelReajusteAnual && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-black text-[#EA580C]">
                                <Sparkle weight="fill" className="h-3.5 w-3.5" />
                                Elegível a Reajuste ({contrato.indiceReajuste || 'IPCA'})
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-black text-[#0A2540]">{contrato.orgao}</h3>
                          <p className="text-sm font-medium text-slate-600">{contrato.objeto}</p>

                          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-bold text-slate-500">
                            <span>
                              Assinatura:{' '}
                              <strong className="text-slate-800">
                                {formatDateBR(contrato.dataAssinatura)}
                              </strong>
                            </span>
                            <span>
                              Término da Vigência:{' '}
                              <strong className="text-slate-800">
                                {formatDateBR(contrato.dataFim)}
                              </strong>
                            </span>
                            <span>
                              Índice Contratual:{' '}
                              <strong className="text-slate-800">
                                {contrato.indiceReajuste || 'IPCA'}
                              </strong>
                            </span>
                            <span>
                              Aditivos Registrados:{' '}
                              <strong className="text-slate-800">
                                {contrato.aditivos?.length || 0}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-4 lg:items-end lg:border-t-0 lg:pt-0">
                          <div className="text-left lg:text-right">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Valor Atualizado do Contrato
                            </p>
                            <p className="text-xl font-black text-[#0A2540]">
                              {formatCurrency(contrato.valorAtual)}
                            </p>
                            {contrato.valorAtual !== contrato.valorInicial && (
                              <p className="text-xs font-medium text-slate-500">
                                Valor Inicial: {formatCurrency(contrato.valorInicial)}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAlternarStatusContrato(contrato)}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                            >
                              {contrato.status === 'ATIVO' ? 'Encerrar Contrato' : 'Reativar Contrato'}
                            </button>

                            {hasMasterReajuste ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReajusteForContract(contrato)}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-4 py-2 text-xs font-black text-white shadow-xs transition hover:bg-orange-700 cursor-pointer"
                              >
                                <Calculator weight="bold" className="h-4 w-4" />
                                Calcular Reajuste / Repactuação
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowUpgradeModal(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-300 cursor-pointer"
                              >
                                <Lock weight="fill" className="h-4 w-4 text-slate-500" />
                                Desbloquear no Plano Master
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CRONOGRAMA DE MARCOS DE VIGÊNCIA E ADITIVOS */}
                      {contrato.prazosVigencia && contrato.prazosVigencia.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                            Marcos de Vigência e Alertas Programados
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {contrato.prazosVigencia.map((prazo) => (
                              <div
                                key={prazo.id}
                                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                              >
                                <div>
                                  <p className="font-bold text-slate-800">{prazo.titulo}</p>
                                  <p className="text-[11px] text-slate-500">
                                    Alerta com {prazo.diasAntecedenciaAlerta} dias de antecedência
                                  </p>
                                </div>
                                <span className="rounded-lg bg-white px-2.5 py-1 font-black text-[#0A2540] shadow-2xs">
                                  {formatDateBR(prazo.dataFim)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* CONTEÚDO DA ABA 2: ASSISTENTE DE REEQUILÍBRIO / REPACTUAÇÃO (EXCLUSIVO MASTER) */}
        {activeTab === 'reajuste' && hasMasterReajuste && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* PAINEL DE PARÂMETROS DE CÁLCULO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C]">
                  <Calculator weight="duotone" className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-base font-black text-[#0A2540]">
                    Robô de Reajuste & Repactuação
                  </h2>
                  <p className="text-xs font-medium text-slate-500">
                    Cálculo exato + fundamentação jurídica (Arts. 92, 124, 135 e 136 da Lei 14.133/2021)
                  </p>
                </div>
              </div>

              <form onSubmit={handleGerarRelatorioReajuste} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    1. Contrato Administrativo
                  </label>
                  <select
                    value={selectedContractId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedContractId(id);
                      const found = contratos.find((c) => c.id === id);
                      if (found?.indiceReajuste) {
                        setIndiceAplicado(found.indiceReajuste);
                      }
                      if (found) {
                        setTipoPleito(
                          found.dedicacaoExclusiva || found.predominanciaMaoDeObra
                            ? 'REPACTUACAO'
                            : 'REAJUSTE',
                        );
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-[#EA580C] focus:outline-none"
                  >
                    <option value="">Selecione um contrato da carteira...</option>
                    {contratos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.numeroContrato} — {c.orgao} ({formatCurrency(c.valorAtual)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    2. Modalidade do Pleito
                  </label>
                  <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {opcoesPleito.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTipoPleito(item.id)}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-black transition cursor-pointer ${
                          tipoPleito === item.id
                            ? 'border-[#EA580C] bg-orange-50 text-[#EA580C]'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tipoPleito === 'REPACTUACAO' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Variação Mão de Obra (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={variacaoMaoDeObra}
                        onChange={(e) => setVariacaoMaoDeObra(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Variação Insumos (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={variacaoInsumos}
                        onChange={(e) => setVariacaoInsumos(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Peso Mão de Obra (%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={pesoMaoDeObra}
                        onChange={(e) => setPesoMaoDeObra(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600">
                        Índice Oficial de Correção
                      </label>
                      <select
                        value={indiceAplicado}
                        onChange={(e) => setIndiceAplicado(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                      >
                        <option value="IPCA">IPCA (IBGE) — 4,83% a.a.</option>
                        <option value="INPC">INPC (IBGE) — 4,60% a.a.</option>
                        <option value="IGP-M">IGP-M (FGV) — 5,14% a.a.</option>
                        <option value="INCC">INCC-DI (Obras/Engenharia) — 5,88% a.a.</option>
                        <option value="IST">IST (Anatel/TI & Telecom) — 4,45% a.a.</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600">
                        Percentual Acumulado (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={percentualReajuste}
                        onChange={(e) => setPercentualReajuste(e.target.value)}
                        placeholder="Ex: 4.83"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {tipoPleito === 'REPACTUACAO' && (
                  <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                        <Calculator weight="duotone" className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-[#0A2540]">Simulador de CCT</h3>
                        <p className="mt-1 text-xs text-slate-600">
                          Estimativa salarial bruta; encargos, benefícios e insumos devem ser apurados na planilha analítica.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600">Salário atual por posto (R$)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={salarioAtualCct}
                          onChange={(event) => setSalarioAtualCct(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600">Novo salário da CCT (R$)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={novoSalarioCct}
                          onChange={(event) => setNovoSalarioCct(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600">Quantidade de postos</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={quantidadePostosCct}
                          onChange={(event) => setQuantidadePostosCct(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-blue-100 bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Impacto salarial mensal</p>
                        <p className="mt-1 text-lg font-black text-[#0A2540]">{formatCurrency(impactoMensalCct)}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Impacto salarial anual estimado</p>
                        <p className="mt-1 text-lg font-black text-[#0A2540]">{formatCurrency(impactoAnualCct)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleGerarOficioCct()}
                      disabled={gerandoOficioCct}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60"
                    >
                      <FileText weight="bold" className="h-4 w-4" />
                      {gerandoOficioCct ? 'Gerando PDF...' : 'Gerar Ofício de Repactuação'}
                    </button>
                  </section>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600">
                      Meses de Atraso / Retroativo a Cobrar
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={mesesRetroativos}
                      onChange={(e) => setMesesRetroativos(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={registrarAditivo}
                        onChange={(e) => setRegistrarAditivo(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#EA580C] focus:ring-[#EA580C]"
                      />
                      Averbar Termo Aditivo / Apostilamento no contrato
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600">
                    Fatos Supervenientes / Convenção Coletiva / Notas Fiscais (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={justificativaAdicional}
                    onChange={(e) => setJustificativaAdicional(e.target.value)}
                    placeholder="Ex: Homologação da Convenção Coletiva de Trabalho 2026/2027 ou alta extraordinária de insumos comprovada por notas fiscais..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#EA580C] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={calculandoReajuste || !selectedContractId}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EA580C] px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                >
                  <Calculator weight="bold" className="h-4 w-4" />
                  {calculandoReajuste
                    ? 'Processando Memória de Cálculo...'
                    : 'Gerar Relatório de Reajuste Financeiro'}
                </button>
              </form>
            </div>

            {/* PAINEL DE RESULTADO E PARECER / REQUERIMENTO GERADO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
              {!resultadoReajuste ? (
                <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-[#0A2540]">
                    <FileText weight="duotone" className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-base font-black text-[#0A2540]">
                    Memória de Cálculo e Requerimento Administrativo
                  </h3>
                  <p className="mt-1 max-w-md text-xs font-medium text-slate-500">
                    Selecione um contrato ao lado e acione o assistente para calcular o impacto financeiro exato (incluindo valores retroativos devidos pelo órgão) e gerar a peça formal pronta para protocolo.
                  </p>
                  {contratoSelecionado && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs">
                      <p className="font-black text-[#0A2540]">
                        Contrato Selecionado: {contratoSelecionado.numeroContrato}
                      </p>
                      <p className="text-slate-600">
                        Órgão: {contratoSelecionado.orgao} • Valor Atual:{' '}
                        <strong>{formatCurrency(contratoSelecionado.valorAtual)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                        <CheckCircle weight="fill" className="h-3.5 w-3.5" />
                        Memória de Cálculo Homologada
                      </span>
                      <h3 className="mt-1 text-lg font-black text-[#0A2540]">
                        Contrato {resultadoReajuste.numeroContrato} — {resultadoReajuste.tipoPleito}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopiarRelatorio}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                      >
                        <Copy weight="bold" className="h-4 w-4" />
                        Copiar Peça
                      </button>
                      <button
                        type="button"
                        onClick={handleBaixarRelatorio}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2540] px-3.5 py-2 text-xs font-black text-white transition hover:bg-slate-800 cursor-pointer"
                      >
                        <DownloadSimple weight="bold" className="h-4 w-4" />
                        Baixar Relatório (.TXT)
                      </button>
                    </div>
                  </div>

                  {/* RESUMO FINANCEIRO DO REAJUSTE */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <p className="text-[10px] font-black uppercase text-slate-400">
                        Acréscimo Global ({resultadoReajuste.percentualAplicado}%)
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-700">
                        + {formatCurrency(resultadoReajuste.acrescimoGlobal)}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500">
                        Impacto mensal estimado: {formatCurrency(resultadoReajuste.impactoMensalEstimado)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <p className="text-[10px] font-black uppercase text-slate-400">
                        Novo Valor Contratual
                      </p>
                      <p className="mt-1 text-lg font-black text-[#0A2540]">
                        {formatCurrency(resultadoReajuste.novoValorContrato)}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500">
                        Base anterior: {formatCurrency(resultadoReajuste.valorAnterior)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3.5">
                      <p className="text-[10px] font-black uppercase text-[#EA580C]">
                        Total com Retroativo ({resultadoReajuste.mesesRetroativos}m)
                      </p>
                      <p className="mt-1 text-lg font-black text-[#EA580C]">
                        + {formatCurrency(resultadoReajuste.impactoFinanceiroTotal)}
                      </p>
                      <p className="text-[11px] font-medium text-slate-600">
                        Retroativo: {formatCurrency(resultadoReajuste.valorRetroativoEstimado)}
                      </p>
                    </div>
                  </div>

                  {/* TEXTO INTEGRAL DO REQUERIMENTO E MEMÓRIA DE CÁLCULO */}
                  <div>
                    <p className="mb-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
                      Requerimento Formal de Apostilamento / Termo Aditivo (Lei 14.133/2021)
                    </p>
                    <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
                      {resultadoReajuste.relatorioTexto}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* MODAL DE CADASTRO DE NOVO CONTRATO */}
      {showNewContractModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="novo-contrato-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 id="novo-contrato-title" className="text-lg font-black text-[#0A2540]">
                  Registrar Contrato Pós-Vitória
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Vinculado automaticamente à empresa ativa e monitorado pelo motor de vigências
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewContractModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X weight="bold" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCriarContrato} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Número do Contrato *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 042/2026"
                    value={formContrato.numeroContrato}
                    onChange={(e) =>
                      setFormContrato({ ...formContrato, numeroContrato: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Valor Inicial (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 480000.00"
                    value={formContrato.valorInicial}
                    onChange={(e) =>
                      setFormContrato({ ...formContrato, valorInicial: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Órgão Contratante *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Prefeitura Municipal / Ministério da Saúde"
                    value={formContrato.orgao}
                    onChange={(e) => setFormContrato({ ...formContrato, orgao: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    CNPJ do Órgão (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={formContrato.cnpjOrgao}
                    onChange={(e) =>
                      setFormContrato({ ...formContrato, cnpjOrgao: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Objeto Contratual *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Descrição resumida do fornecimento ou serviço continuado..."
                  value={formContrato.objeto}
                  onChange={(e) => setFormContrato({ ...formContrato, objeto: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-800"
                />
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-black text-[#0A2540]">
                    Contrato com Dedicação Exclusiva de Mão de Obra?
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Marque para indicar dedicação exclusiva. O sistema considera também a
                    predominância de mão de obra como possível base para Repactuação.
                  </p>
                  <p className="mt-2 text-xs font-bold text-[#0A2540]" aria-live="polite">
                    {formContrato.dedicacaoExclusiva
                      ? 'Elegibilidade indicada: Repactuação'
                      : formContrato.predominanciaMaoDeObra
                        ? 'Elegibilidade indicada: avaliar Repactuação por predominância de mão de obra'
                      : 'Elegibilidade indicada: Reajuste por Índice'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formContrato.dedicacaoExclusiva}
                  aria-label="Contrato com Dedicação Exclusiva de Mão de Obra?"
                  onClick={() =>
                    setFormContrato({
                      ...formContrato,
                      dedicacaoExclusiva: !formContrato.dedicacaoExclusiva,
                      predominanciaMaoDeObra: formContrato.dedicacaoExclusiva
                        ? formContrato.predominanciaMaoDeObra
                        : false,
                    })
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                    formContrato.dedicacaoExclusiva ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      formContrato.dedicacaoExclusiva ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {!formContrato.dedicacaoExclusiva && (
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={formContrato.predominanciaMaoDeObra}
                    onChange={(e) =>
                      setFormContrato({
                        ...formContrato,
                        predominanciaMaoDeObra: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#EA580C] focus:ring-[#EA580C]"
                  />
                  <span>
                    É serviço contínuo com predominância de mão de obra? Essa condição também
                    pode permitir análise de Repactuação (Art. 135).
                  </span>
                </label>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Data de Assinatura *
                  </label>
                  <input
                    type="date"
                    required
                    value={formContrato.dataAssinatura}
                    onChange={(e) =>
                      setFormContrato({ ...formContrato, dataAssinatura: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Data de Fim da Vigência *
                  </label>
                  <input
                    type="date"
                    required
                    value={formContrato.dataFim}
                    onChange={(e) => setFormContrato({ ...formContrato, dataFim: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Índice de Reajuste
                  </label>
                  <select
                    value={formContrato.indiceReajuste}
                    onChange={(e) =>
                      setFormContrato({ ...formContrato, indiceReajuste: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    <option value="IPCA">IPCA</option>
                    <option value="INPC">INPC</option>
                    <option value="IGP-M">IGP-M</option>
                    <option value="INCC">INCC</option>
                    <option value="IST">IST</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewContractModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingContract}
                  className="rounded-xl bg-[#EA580C] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                >
                  {savingContract ? 'Salvando...' : 'Salvar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE UPGRADE PARA O PLANO MASTER (QUANDO CLIENTE AVANÇADO/BÁSICO CLICA NO RECURSO COM CADEADO) */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-master-contrato-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-[#0A2540] to-slate-800 p-6 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Crown weight="fill" className="h-4 w-4" />
                  Exclusivo Plano Master
                </span>
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X weight="bold" className="h-5 w-5" />
                </button>
              </div>
              <h3 id="upgrade-master-contrato-title" className="mt-4 text-xl font-black">
                Ferramentas Pós-Vitória do Plano Master
              </h3>
              <p className="mt-1 text-xs font-medium text-blue-100/80">
                Desbloqueie simulações, ofícios e gestão de garantias na execução dos seus contratos.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-black text-[#0A2540]">
                      Cálculo Automático por Índices Oficiais (IPCA, INPC, IGP-M, INCC, IST)
                    </p>
                    <p className="text-xs text-slate-600">
                      Descubra exatamente quanto cobrar do órgão contratante a cada aniversário da data-base do orçamento, incluindo parcelas retroativas.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-black text-[#0A2540]">
                      Simulador CCT e ofícios de Repactuação em PDF
                    </p>
                    <p className="text-xs text-slate-600">
                      Calcule o impacto salarial estimado e gere uma minuta com memória de cálculo para revisão e protocolo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-black text-[#0A2540]">
                      Cofre de Garantias e Ofícios de Restituição
                    </p>
                    <p className="text-xs text-slate-600">
                      Acompanhe valores retidos, validade das apólices e gere o pedido de restituição quando a garantia estiver pronta para resgate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-900">
                <div className="flex items-center gap-2 font-black">
                  <Warning weight="fill" className="h-4 w-4 text-amber-600" />
                  Retorno Imediato sobre o Investimento
                </div>
                <p className="mt-1">
                  Um único pedido de reajuste ou repactuação deferido em contrato público já paga anos da assinatura do Plano Master.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Continuar no plano atual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgradeModal(false);
                    navigate(FORNECEDOR_ROUTES.planos);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition hover:bg-orange-700 cursor-pointer"
                >
                  <Crown weight="fill" className="h-4 w-4" />
                  Fazer Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestaoContratualPage;
