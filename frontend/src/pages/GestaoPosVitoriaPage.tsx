import React, { useEffect, useState } from 'react';
import {
  Vault,
  ShieldCheck,
  Warning,
  Plus,
  CheckCircle,
  CurrencyCircleDollar,
  ArrowsClockwise,
  FileText,
  X,
  Buildings,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { guaranteesService } from '../services/guarantees.service';
import {
  GarantiaItem,
  GuaranteesSummary,
  TipoGarantia,
  ModalidadeGarantia,
  CreateGuaranteePayload,
} from '../types/guarantees.types';

export default function GestaoPosVitoriaPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [guarantees, setGuarantees] = useState<GarantiaItem[]>([]);
  const [summary, setSummary] = useState<GuaranteesSummary>({
    totalValorGarantido: 0,
    totalCaucaoDinheiroRetido: 0,
    totalSeguroGarantia: 0,
    totalFiancaBancaria: 0,
    ativasCount: 0,
    vencendo30dCount: 0,
    totalGarantias: 0,
  });

  const [filterModalidade, setFilterModalidade] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODAS');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Formulário de Nova Garantia
  const [formData, setFormData] = useState<CreateGuaranteePayload>({
    tipo: 'EXECUCAO_CONTRATUAL',
    modalidade: 'CAUCAO_DINHEIRO',
    instituicaoEmissora: '',
    numeroApolice: '',
    valor: 0,
    percentual: 5,
    dataEmissao: new Date().toISOString().split('T')[0],
    dataVencimento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    observacoes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await guaranteesService.getGuarantees();
      setGuarantees(res.items);
      setSummary(res.summary);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Não foi possível carregar as garantias contratuais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateGuarantee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.valor || formData.valor <= 0) {
      toast.error('Informe um valor válido para a garantia.');
      return;
    }
    if (!formData.instituicaoEmissora) {
      toast.error('Informe a instituição emissora ou órgão retentor.');
      return;
    }

    try {
      setSubmitting(true);
      await guaranteesService.createGuarantee({
        ...formData,
        valor: Number(formData.valor),
        percentual: formData.percentual ? Number(formData.percentual) : undefined,
      });
      toast.success('Garantia/Caução registrada com sucesso no cofre contratual!');
      setIsModalOpen(false);
      // Reset form
      setFormData({
        tipo: 'EXECUCAO_CONTRATUAL',
        modalidade: 'CAUCAO_DINHEIRO',
        instituicaoEmissora: '',
        numeroApolice: '',
        valor: 0,
        percentual: 5,
        dataEmissao: new Date().toISOString().split('T')[0],
        dataVencimento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        observacoes: '',
      });
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      toast.error('Falha ao registrar garantia. Verifique os dados.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLiberarOuBaixar = async (item: GarantiaItem) => {
    const confirmMessage =
      item.modalidade === 'CAUCAO_DINHEIRO'
        ? `Confirmar liberação/devolução da caução em dinheiro de ${formatMoney(item.valor)}?`
        : `Confirmar baixa da garantia ${item.instituicaoEmissora}?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await guaranteesService.updateGuarantee(item.id, { status: 'BAIXADA' });
      toast.success(
        item.modalidade === 'CAUCAO_DINHEIRO'
          ? 'Caução marcada como restituída/baixada!'
          : 'Garantia baixada com sucesso!'
      );
      await loadData();
    } catch {
      toast.error('Erro ao atualizar status da garantia.');
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const filteredGuarantees = guarantees.filter((g) => {
    if (filterModalidade !== 'TODAS' && g.modalidade !== filterModalidade) return false;
    if (filterStatus !== 'TODAS' && g.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto">
      {/* CABEÇALHO */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
              <ShieldCheck className="h-4 w-4" weight="bold" /> Art. 96 a 102 • Lei 14.133/2021
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
              Gestão Pós-Vitória
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-900 md:text-3xl">
            Garantias Contratuais & Cauções Retidas
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Monitore cauções em dinheiro, seguros-garantia e fianças bancárias para evitar retenções indevidas e garantir a devolução integral.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} weight="bold" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" weight="bold" />
            Registrar Garantia / Caução
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: CAUÇÃO EM DINHEIRO RETIDA (DESTAQUE MÁXIMO) */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Dinheiro Retido em Caução
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow">
              <CurrencyCircleDollar className="h-5 w-5" weight="bold" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-950">
            {formatMoney(summary.totalCaucaoDinheiroRetido)}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700">
            Valores a pleitear devolução com correção monetária após entrega final.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
            <Vault className="h-3.5 w-3.5" />
            <span>Retenção Art. 96, § 1º, I</span>
          </div>
        </div>

        {/* CARD 2: TOTAL GARANTIDO ATIVO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Garantido Ativo
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <ShieldCheck className="h-5 w-5" weight="bold" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {formatMoney(summary.totalValorGarantido)}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Distribuído em {summary.ativasCount} garantia(s) em vigência contratual.
          </p>
        </div>

        {/* CARD 3: SEGURO & FIANÇA BANCÁRIA */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Seguro & Fiança Bancária
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow">
              <Buildings className="h-5 w-5" weight="bold" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {formatMoney(summary.totalSeguroGarantia + summary.totalFiancaBancaria)}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Cobertura securitária e bancária sem impacto direto no fluxo de caixa.
          </p>
        </div>

        {/* CARD 4: VENCENDO EM 30 DIAS */}
        <div className={`rounded-2xl border p-5 shadow-sm ${
          summary.vencendo30dCount > 0
            ? 'border-red-300 bg-red-50/40 text-red-950'
            : 'border-slate-200 bg-white text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              summary.vencendo30dCount > 0 ? 'text-red-700' : 'text-slate-500'
            }`}>
              Vencendo em 30 Dias
            </span>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl shadow ${
              summary.vencendo30dCount > 0 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
            }`}>
              {summary.vencendo30dCount > 0 ? (
                <Warning className="h-5 w-5" weight="bold" />
              ) : (
                <CheckCircle className="h-5 w-5" weight="bold" />
              )}
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">
            {summary.vencendo30dCount} {summary.vencendo30dCount === 1 ? 'apólice' : 'apólices'}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {summary.vencendo30dCount > 0
              ? 'Exige renovação imediata para evitar glosa ou rescisão unilateral.'
              : 'Nenhuma apólice crítica com vencimento iminente.'}
          </p>
        </div>
      </div>

      {/* FILTROS E TABELA */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* BARRA DE FILTROS */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-black text-slate-800">
              Apólices, Títulos e Retenções Cadastradas ({filteredGuarantees.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterModalidade}
              onChange={(e) => setFilterModalidade(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm focus:border-brand-orange focus:outline-none"
            >
              <option value="TODAS">Todas as Modalidades</option>
              <option value="CAUCAO_DINHEIRO">Caução em Dinheiro (Retenção)</option>
              <option value="SEGURO_GARANTIA">Seguro-Garantia</option>
              <option value="FIANCA_BANCARIA">Fiança Bancária</option>
              <option value="TITULO_PUBLICO">Títulos da Dívida Pública</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm focus:border-brand-orange focus:outline-none"
            >
              <option value="TODAS">Todos os Status</option>
              <option value="ATIVA">Ativa / Vigente</option>
              <option value="BAIXADA">Baixada / Liberada</option>
              <option value="VENCIDA">Vencida</option>
              <option value="COTACAO">Em Cotação</option>
            </select>
          </div>
        </div>

        {/* LISTAGEM OU EMPTY STATE */}
        {filteredGuarantees.length === 0 ? (
          <div className="py-16 text-center">
            <Vault className="mx-auto h-12 w-12 text-slate-300" weight="thin" />
            <p className="mt-3 text-base font-black text-slate-800">
              Nenhuma garantia cadastrada neste filtro
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Cadastre suas cauções em dinheiro ou seguros-garantia para rastrear valores retidos.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-xs font-black text-white shadow transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" weight="bold" />
              Cadastrar Primeira Garantia
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Modalidade & Finalidade</th>
                  <th className="px-5 py-3.5">Instituição / Apólice</th>
                  <th className="px-5 py-3.5">Valor & % Contrato</th>
                  <th className="px-5 py-3.5">Vencimento</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredGuarantees.map((item) => {
                  const diasParaVencer = item.dataVencimento
                    ? Math.ceil((new Date(item.dataVencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {item.modalidade === 'CAUCAO_DINHEIRO' && '💰 Caução em Dinheiro'}
                            {item.modalidade === 'SEGURO_GARANTIA' && '🛡️ Seguro-Garantia'}
                            {item.modalidade === 'FIANCA_BANCARIA' && '🏦 Fiança Bancária'}
                            {item.modalidade === 'TITULO_PUBLICO' && '📜 Título da Dívida'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {item.tipo === 'EXECUCAO_CONTRATUAL'
                              ? 'Garantia de Execução (Art. 96)'
                              : 'Garantia de Proposta'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{item.instituicaoEmissora}</span>
                          <span className="text-[11px] text-slate-500">
                            {item.numeroApolice ? `Apólice: ${item.numeroApolice}` : 'Sem número / Retenção'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900">{formatMoney(item.valor)}</span>
                          {item.percentual && (
                            <span className="text-[11px] font-bold text-brand-orange">
                              {item.percentual}% do contrato
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">
                            {item.dataVencimento
                              ? new Date(item.dataVencimento).toLocaleDateString('pt-BR')
                              : 'Indeterminado'}
                          </span>
                          {diasParaVencer !== null && item.status === 'ATIVA' && (
                            <span
                              className={`text-[11px] font-bold ${
                                diasParaVencer <= 15
                                  ? 'text-red-600'
                                  : diasParaVencer <= 30
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {diasParaVencer <= 0 ? 'Expirada' : `${diasParaVencer} dias restantes`}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'ATIVA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'BAIXADA'
                              ? 'bg-slate-200 text-slate-700'
                              : item.status === 'VENCIDA'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {item.status === 'ATIVA' ? (
                          <button
                            type="button"
                            onClick={() => handleLiberarOuBaixar(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                          >
                            {item.modalidade === 'CAUCAO_DINHEIRO' ? 'Registrar Devolução' : 'Dar Baixa'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Finalizada</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: NOVA GARANTIA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-brand-orange">
                  <Vault className="h-5 w-5" weight="bold" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Nova Garantia ou Retenção de Caução
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGuarantee} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-600">Modalidade</label>
                  <select
                    value={formData.modalidade}
                    onChange={(e) =>
                      setFormData({ ...formData, modalidade: e.target.value as ModalidadeGarantia })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-brand-orange focus:outline-none"
                  >
                    <option value="CAUCAO_DINHEIRO">Caução em Dinheiro (Retenção)</option>
                    <option value="SEGURO_GARANTIA">Seguro-Garantia</option>
                    <option value="FIANCA_BANCARIA">Fiança Bancária</option>
                    <option value="TITULO_PUBLICO">Títulos da Dívida Pública</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-600">Finalidade</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) =>
                      setFormData({ ...formData, tipo: e.target.value as TipoGarantia })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-brand-orange focus:outline-none"
                  >
                    <option value="EXECUCAO_CONTRATUAL">Execução Contratual (Art. 96)</option>
                    <option value="PROPOSTA">Garantia de Proposta (Art. 58)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-600">
                  Instituição Emissora / Órgão Retentor
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Porto Seguro Seguradora, Caixa Econômica, Prefeitura..."
                  value={formData.instituicaoEmissora}
                  onChange={(e) => setFormData({ ...formData, instituicaoEmissora: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-brand-orange focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-600">
                    Número da Apólice / Comprovante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: AP-2026-99214"
                    value={formData.numeroApolice || ''}
                    onChange={(e) => setFormData({ ...formData, numeroApolice: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-600">
                    Percentual (%) do Contrato
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Ex: 5"
                    value={formData.percentual || ''}
                    onChange={(e) => setFormData({ ...formData, percentual: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-brand-orange focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-600">Valor Garantido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 45000.00"
                    value={formData.valor || ''}
                    onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-900 focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-600">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={formData.dataVencimento ? String(formData.dataVencimento).split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-brand-orange focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-600">Observações / Contrato</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Retenção contratual referente ao termo de empenho 2026/012..."
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-brand-orange focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-brand-orange px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-orange-600 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Garantia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

