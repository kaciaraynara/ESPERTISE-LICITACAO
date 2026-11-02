import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowClockwise,
  CalendarCheck,
  CheckCircle,
  Clock,
  DownloadSimple,
  FileText,
  Lock,
  Scales,
  ShieldCheck,
  Warning,
} from '@phosphor-icons/react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  contratosApi,
  type ContractDto,
  type ContractGuaranteeDto,
} from '@/services/api';

type PanelTab = 'comparativo' | 'garantias';

interface PainelGestaoContratualProps {
  companyId?: string;
  contratoSelecionado: ContractDto | null;
  acessoGarantias: boolean;
  onUpgrade: () => void;
}

const institutos = [
  {
    name: 'Repactuação',
    legalBasis: 'Art. 135 da Lei 14.133/2021',
    trigger:
      'Serviço contínuo com dedicação exclusiva ou predominância de mão de obra: variação analítica dos custos, especialmente CCT, ACT ou dissídio coletivo.',
    frequency:
      'Anualidade mínima. Mão de obra: data de vigência do instrumento coletivo; demais custos: data do orçamento estimado.',
    documents:
      'CCT/ACT vigente, planilha de custos original e atualizada, memória analítica das variações e documentos comprobatórios.',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  {
    name: 'Reajuste por índice',
    legalBasis: 'Arts. 25, § 7º; 92, § 3º; e 136, I',
    trigger: 'Inflação medida pelo índice previsto no edital e no contrato.',
    frequency:
      'Após o interregno mínimo de 1 ano, contado da data-base do orçamento estimado.',
    documents:
      'Cláusula contratual do índice, série oficial do período e memória de cálculo do valor atualizado.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  {
    name: 'Revisão / reequilíbrio',
    legalBasis: 'Art. 124, II, “d”',
    trigger:
      'Teoria da imprevisão / álea extraordinária: fato imprevisível, ou previsível de consequências incalculáveis, que rompa a equação do contrato.',
    frequency:
      'A qualquer tempo, desde que o evento e o impacto sejam comprovados; não depende de anualidade.',
    documents:
      'Provas do evento, notas fiscais e contratos de fornecimento comparáveis, planilha antes/depois e demonstração do nexo causal.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getGuaranteeStatus(guarantee: ContractGuaranteeDto) {
  if (guarantee.status === 'RESGATADA') {
    return { label: 'Resgatada', className: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
  }
  if (guarantee.status === 'PRONTA_RESGATE') {
    return {
      label: 'Pronta para resgate',
      className: 'bg-emerald-100 text-emerald-800',
      dot: 'bg-emerald-500',
    };
  }

  if (!guarantee.dataVencimento) {
    return { label: 'Retida / ativa', className: 'bg-red-100 text-red-800', dot: 'bg-red-500' };
  }

  const expirationDate = new Date(`${guarantee.dataVencimento.slice(0, 10)}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysUntilExpiry = Math.round((expirationDate.getTime() - todayUtc) / 86_400_000);
  if (daysUntilExpiry < 0) {
    return { label: 'Apólice vencida', className: 'bg-red-100 text-red-800', dot: 'bg-red-500' };
  }
  if (daysUntilExpiry <= 30) {
    return {
      label: `Vence em ${daysUntilExpiry} dias`,
      className: 'bg-amber-100 text-amber-800',
      dot: 'bg-amber-500',
    };
  }
  return {
    label: 'Retida / ativa',
    className: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Vencimento não informado';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'Data inválida';
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

export function PainelGestaoContratual({
  companyId,
  contratoSelecionado,
  acessoGarantias,
  onUpgrade,
}: PainelGestaoContratualProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('comparativo');
  const [garantias, setGarantias] = useState<ContractGuaranteeDto[]>([]);
  const [totalRetido, setTotalRetido] = useState(0);
  const [loadingGarantias, setLoadingGarantias] = useState(false);
  const [erroGarantias, setErroGarantias] = useState('');
  const [baixandoGarantiaId, setBaixandoGarantiaId] = useState<string | null>(null);

  const carregarGarantias = useCallback(async () => {
    if (!acessoGarantias) return;
    setLoadingGarantias(true);
    setErroGarantias('');
    try {
      const response = await contratosApi.listarGarantias();
      setGarantias(response.data.data.garantias);
      setTotalRetido(response.data.data.totalRetido);
    } catch (error: unknown) {
      if (axios.isAxiosError<{ message?: string }>(error) && error.response?.status === 403) {
        onUpgrade();
        return;
      }
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || 'Não foi possível carregar as garantias da empresa.'
        : 'Não foi possível carregar as garantias da empresa.';
      setErroGarantias(message);
      toast.error(message);
    } finally {
      setLoadingGarantias(false);
    }
  }, [acessoGarantias, onUpgrade]);

  useEffect(() => {
    setGarantias([]);
    setTotalRetido(0);
    if (activeTab === 'garantias' && acessoGarantias) {
      void carregarGarantias();
    }
  }, [activeTab, companyId, acessoGarantias, carregarGarantias]);

  const contractLabel = useMemo(() => {
    if (!contratoSelecionado) return 'Selecione um contrato para ver a orientação aplicada.';
    if (contratoSelecionado.dedicacaoExclusiva) {
      return 'Contrato classificado com dedicação exclusiva de mão de obra: avalie Repactuação.';
    }
    if (contratoSelecionado.predominanciaMaoDeObra) {
      return 'Serviço contínuo com predominância de mão de obra: avalie se cabe Repactuação.';
    }
    return 'Sem dedicação exclusiva ou predominância informada: confira a cláusula de Reajuste por Índice.';
  }, [contratoSelecionado]);

  const handleSolicitarDevolucao = async (garantia: ContractGuaranteeDto) => {
    if (!acessoGarantias) {
      onUpgrade();
      return;
    }

    setBaixandoGarantiaId(garantia.id);
    try {
      const response = await contratosApi.gerarOficioRestituicaoGarantia(garantia.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restituicao_garantia_${garantia.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Ofício de restituição gerado para revisão e protocolo.');
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        onUpgrade();
        return;
      }
      toast.error('Não foi possível gerar o ofício de restituição. Tente novamente.');
    } finally {
      setBaixandoGarantiaId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-800">
              <Scales weight="duotone" className="h-4 w-4" />
              Guia de elegibilidade
            </span>
            <h2 className="mt-3 text-xl font-black text-[#0A2540]">
              Qual instrumento se aplica ao contrato?
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              A classificação orienta a análise, mas o instrumento depende das cláusulas
              contratuais e da documentação de cada caso.
            </p>
          </div>
          {contratoSelecionado && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:max-w-sm">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Contrato selecionado
              </p>
              <p className="mt-1 font-bold text-[#0A2540]">
                Nº {contratoSelecionado.numeroContrato}
              </p>
              <p className="mt-1 text-xs text-slate-600">{contractLabel}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2 border-b border-slate-200" role="tablist" aria-label="Painel contratual">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'comparativo'}
            onClick={() => setActiveTab('comparativo')}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition ${
              activeTab === 'comparativo'
                ? 'border-[#EA580C] text-[#0A2540]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            Comparativo jurídico
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'garantias'}
            onClick={() => {
              if (!acessoGarantias) {
                onUpgrade();
                return;
              }
              setActiveTab('garantias');
            }}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition ${
              activeTab === 'garantias'
                ? 'border-[#EA580C] text-[#0A2540]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {!acessoGarantias && <Lock weight="fill" className="h-4 w-4" />}
            <ShieldCheck weight="duotone" className="h-4 w-4" />
            Garantias
            {!acessoGarantias && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                Master
              </span>
            )}
          </button>
        </div>

        {activeTab === 'comparativo' ? (
          <div className="pt-5">
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <CheckCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <p className="text-sm font-medium text-blue-950">{contractLabel}</p>
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-4 font-black">Instituto Jurídico</th>
                    <th className="p-4 font-black">Fato Gerador</th>
                    <th className="p-4 font-black">Periodicidade</th>
                    <th className="p-4 font-black">Documento Exigido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {institutos.map((instituto) => (
                    <tr key={instituto.name} className="align-top">
                      <td className="p-4">
                        <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${instituto.className}`}>
                          {instituto.name}
                        </span>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {instituto.legalBasis}
                        </p>
                      </td>
                      <td className="p-4 leading-relaxed text-slate-700">{instituto.trigger}</td>
                      <td className="p-4 leading-relaxed text-slate-700">{instituto.frequency}</td>
                      <td className="p-4 leading-relaxed text-slate-700">{instituto.documents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {institutos.map((instituto) => (
                <details
                  key={instituto.name}
                  className="group rounded-xl border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <span>
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${instituto.className}`}>
                        {instituto.name}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                        {instituto.legalBasis}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-[#0A2540] group-open:hidden">Detalhes</span>
                    <span className="hidden text-xs font-bold text-[#0A2540] group-open:inline">Fechar</span>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-sm">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Fato gerador</p>
                      <p className="mt-1 text-slate-700">{instituto.trigger}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Periodicidade</p>
                      <p className="mt-1 text-slate-700">{instituto.frequency}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Documentos</p>
                      <p className="mt-1 text-slate-700">{instituto.documents}</p>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-5">
            {loadingGarantias ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                Carregando garantias da empresa ativa...
              </div>
            ) : erroGarantias ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                <Warning weight="fill" className="h-7 w-7 text-red-600" />
                <p className="text-sm font-semibold text-red-800">{erroGarantias}</p>
                <button
                  type="button"
                  onClick={() => void carregarGarantias()}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                >
                  <ArrowClockwise className="h-4 w-4" />
                  Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">Capital retido em garantias</p>
                    <p className="mt-1 text-xl font-black text-[#0A2540]">{formatCurrency(totalRetido)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">Garantias monitoradas</p>
                    <p className="mt-1 text-xl font-black text-[#0A2540]">{garantias.length}</p>
                  </div>
                </div>

                {garantias.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <ShieldCheck weight="duotone" className="mx-auto h-9 w-9 text-slate-400" />
                    <h3 className="mt-3 font-black text-[#0A2540]">Nenhuma garantia cadastrada</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      As garantias vinculadas a esta empresa aparecerão aqui com valor, contrato e validade da apólice.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {garantias.map((garantia) => {
                      const status = getGuaranteeStatus(garantia);
                      return (
                        <article
                          key={garantia.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                {garantia.tipoGarantia === 'CONTRATO' ? 'Garantia contratual' : 'Garantia de proposta'}
                              </p>
                              <h3 className="mt-1 font-black text-[#0A2540]">
                                {garantia.contrato?.numeroContrato
                                  ? `Contrato nº ${garantia.contrato.numeroContrato}`
                                  : garantia.modalidade}
                              </h3>
                              {garantia.contrato?.orgao && (
                                <p className="mt-0.5 text-xs text-slate-600">{garantia.contrato.orgao}</p>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black ${status.className}`}>
                              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Valor original</p>
                              <p className="mt-1 text-sm font-black text-[#0A2540]">{formatCurrency(garantia.valorOriginal)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Vencimento</p>
                              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700">
                                {status.dot === 'bg-red-500' ? (
                                  <Warning weight="fill" className="h-4 w-4 text-red-600" />
                                ) : (
                                  <CalendarCheck weight="duotone" className="h-4 w-4 text-slate-500" />
                                )}
                                {formatDate(garantia.dataVencimento)}
                              </p>
                            </div>
                          </div>
                          {garantia.status === 'PRONTA_RESGATE' && (
                            <button
                              type="button"
                              onClick={() => void handleSolicitarDevolucao(garantia)}
                              disabled={baixandoGarantiaId === garantia.id}
                              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                            >
                              <DownloadSimple weight="bold" className="h-4 w-4" />
                              {baixandoGarantiaId === garantia.id
                                ? 'Gerando PDF...'
                                : 'Solicitar Devolução (1 Clique)'}
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <Clock weight="duotone" className="mt-0.5 h-4 w-4 shrink-0" />
              A validade é indicada pela data de vencimento cadastrada. Confirme a apólice e as condições de liberação com o órgão contratante.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default PainelGestaoContratual;
