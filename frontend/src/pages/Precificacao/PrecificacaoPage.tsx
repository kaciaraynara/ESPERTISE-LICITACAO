import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Calculator, Zap, Percent, Loader2, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { precificacaoApi, licitacoesApi, propostasApi, catalogoApi } from '@services/api';
import { useCompany } from '@/contexts/CompanyContext';

export const PrecificacaoPage: React.FC = () => {
  const [custos, setCustos] = useState({
    custoProdutoServico: 0,
    impostosPercentual: 8.5,
    custoOperacionalPercentual: 5.0,
    margemDesejadaPercentual: 18.0,
  });

  const [custosDetalhados, setCustosDetalhados] = useState({
    prolabore: 0,
    dinheiroEmpresa: 0,
    funcionarios: 0,
    viagemEstadias: 0,
    fabricacao: 0,
    manutencaoSoftware: 0,
    despesasAdministrativas: 0,
  });

  const rotulosCustosDetalhados: Array<{ chave: keyof typeof custosDetalhados; rotulo: string; ajuda: string }> = [
    { chave: 'prolabore', rotulo: 'Pró-labore dos sócios', ajuda: 'Retirada mensal ou por proposta dos sócios.' },
    { chave: 'dinheiroEmpresa', rotulo: 'Reserva da empresa / capital de giro', ajuda: 'Valor que precisa ficar na empresa para operar.' },
    { chave: 'funcionarios', rotulo: 'Funcionários (salários + encargos)', ajuda: 'Custo real de mão de obra alocada nesta proposta.' },
    { chave: 'viagemEstadias', rotulo: 'Viagem e estadias', ajuda: 'Deslocamento, hospedagem e alimentação.' },
    { chave: 'fabricacao', rotulo: 'Fabricação / produção', ajuda: 'Custo de produzir o item ou executar o serviço.' },
    { chave: 'manutencaoSoftware', rotulo: 'Manutenção do software', ajuda: 'Licenças, infraestrutura e suporte do sistema.' },
    { chave: 'despesasAdministrativas', rotulo: 'Despesas administrativas', ajuda: 'Contabilidade, jurídico, internet, aluguel e afins.' },
  ];

  const [valorMaximoEdital, setValorMaximoEdital] = useState<number>(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [gerandoProposta, setGerandoProposta] = useState(false);
  const [termoRef, setTermoRef] = useState(() => searchParams.get('refNome') || '');
  const [codigoRef, setCodigoRef] = useState(() => searchParams.get('refCodigo') || '');
  const [tipoRef, setTipoRef] = useState<'TODOS' | 'MATERIAL' | 'SERVICO'>('TODOS');
  const [buscandoRef, setBuscandoRef] = useState(false);
  const [refMercado, setRefMercado] = useState<any>(null);

  useEffect(() => {
    const refValor = Number(searchParams.get('refValor') || 0);
    if (Number.isFinite(refValor) && refValor > 0) {
      setValorMaximoEdital((prev) => (prev > 0 ? prev : refValor));
    }
  }, [searchParams]);

  const buscarReferenciaMercado = async () => {
    if (termoRef.trim().length < 2 && !codigoRef.replace(/\D/g, '')) {
      toast.error('Digite ao menos 2 letras ou um código CATMAT/CATSER.');
      return;
    }
    setBuscandoRef(true);
    try {
      const r = await catalogoApi.referenciaMercado(termoRef.trim() || codigoRef.trim(), {
        codigo: codigoRef.replace(/\D/g, '') || undefined,
        tipo: tipoRef,
      });
      setRefMercado(r.data?.data || null);
    } catch { toast.error('Falha ao consultar referências CATMAT/CATSER e PNCP.'); } finally { setBuscandoRef(false); }
  };
  const noticeId = searchParams.get('noticeId') || searchParams.get('editalId') || searchParams.get('licitacaoId') || searchParams.get('id') || '';

  const { data: editalData } = useQuery({
    queryKey: ['precificacao-edital', noticeId],
    queryFn: async () => {
      if (!noticeId) return null;
      try {
        const [resNotice, resItens] = await Promise.all([
          licitacoesApi.buscarPorId(noticeId).catch(() => null),
          licitacoesApi.obterItens(noticeId).catch(() => null),
        ]);

        const notice = resNotice?.data?.data || null;
        const itens = (resItens?.data?.data || []) as any[];

        const somaItens = itens.reduce((acc: number, it: any) => {
          const vTot = Number(it.valorTotal ?? it.estimatedTotalValue) ||
            ((Number(it.quantidade ?? it.quantity) || 1) * (Number(it.valorUnitarioEstimado ?? it.estimatedUnitValue) || 0));
          return acc + vTot;
        }, 0);

        const rawVal = Number(notice?.valor_estimado ?? notice?.valorEstimado) || 0;
        const valorFinal = rawVal > 0 ? rawVal : somaItens;

        return {
          notice,
          itens,
          somaItens,
          valorFinal,
          isSigiloso: rawVal <= 0 && somaItens > 0,
        };
      } catch (err) {
        console.warn('[PrecificacaoPage] Erro ao carregar dados do edital:', err);
        return null;
      }
    },
    enabled: Boolean(noticeId),
  });

  useEffect(() => {
    if (editalData?.valorFinal && editalData.valorFinal > 0) {
      setValorMaximoEdital(editalData.valorFinal);
      setCustos((prev) => {
        if (prev.custoProdutoServico > 0) return prev;
        const custoItens = editalData.itens.reduce((acc: number, it: any) => {
          const custo = Number(it.custoBase ?? it.unitCost) || 0;
          const qtd = Number(it.quantidade ?? it.quantity) || 1;
          return acc + custo * qtd;
        }, 0);
        // Só usa custo real informado nos itens. Nunca estima um percentual
        // do valor do edital: custo estimado sem evidência é dado fictício.
        if (custoItens > 0) {
          return { ...prev, custoProdutoServico: custoItens };
        }
        return prev;
      });
    }
  }, [editalData]);

  const { data: resp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['precificacao', custos, custosDetalhados],
    queryFn: async () => {
      if (custos.custoProdutoServico <= 0) {
        return {
          data: {
            precoSugerido: 0,
            precoBreakeven: 0,
            lucroProjetado: 0,
            impostoProjetado: 0,
            custoOperacionalVal: 0,
            custosIndiretosFixos: 0,
            custosIndiretosValor: 0,
            custoBase: 0,
          },
        };
      }
      const res = await precificacaoApi.calcularViabilidade({
        ...custos,
        custosIndiretosDetalhados: custosDetalhados,
      });
      return res.data;
    },
  });

  const calculo = resp?.data || {
    precoSugerido: 0,
    precoBreakeven: 0,
    lucroProjetado: 0,
    impostoProjetado: 0,
    custoOperacionalVal: 0,
    custosIndiretosFixos: 0,
    custosIndiretosValor: 0,
    custoBase: 0,
  };

  const custoOperacionalVal = Number(calculo.custoOperacionalVal ?? 0);
  const custosIndiretosFixos = Number(calculo.custosIndiretosFixos ?? 0);
  const custoTotalPlanilha = Number(calculo.custoBase ?? 0);

  // Nunca apresenta zeros como se fossem resultado de cálculo.
  const calculoValido = Boolean(
    resp?.data &&
    !isError &&
    Number.isFinite(calculo.precoSugerido) &&
    calculo.precoSugerido > 0 &&
    calculo.statusViabilidade !== 'INVIAVEL',
  );

  const descontoFrenteEdital = valorMaximoEdital > 0 && calculoValido
    ? ((valorMaximoEdital - calculo.precoSugerido) / valorMaximoEdital) * 100
    : 0;

  const validarEntradas = (): boolean => {
    const valores = [
      custos.custoProdutoServico,
      custos.impostosPercentual,
      custos.custoOperacionalPercentual,
      custos.margemDesejadaPercentual,
      valorMaximoEdital,
      ...Object.values(custosDetalhados),
    ];
    if (valores.some((valor) => !Number.isFinite(valor) || valor < 0)) {
      toast.error('Revise a planilha: informe valores numéricos não negativos.');
      return false;
    }
    if (custos.impostosPercentual >= 100 || custos.margemDesejadaPercentual >= 100) {
      toast.error('Impostos e margem devem ser menores que 100%.');
      return false;
    }
    if (custos.impostosPercentual + custos.margemDesejadaPercentual >= 100) {
      toast.error('Impostos + margem não podem somar 100% ou mais.');
      return false;
    }
    if (!calculoValido) {
      toast.error('Não é possível gerar a proposta sem um cálculo válido. Verifique o erro informado acima.');
      return false;
    }
    return true;
  };

  const handleGerarProposta = async () => {
    if (!noticeId) {
      toast.error('Nenhum edital vinculado para gerar proposta comercial.');
      return;
    }
    if (!validarEntradas()) return;

    setGerandoProposta(true);
    try {
      const targetCompanyId =
        selectedCompany?.id && selectedCompany.id !== 'default'
          ? selectedCompany.id
          : undefined;
      const res = await propostasApi.preencherPropostaViaLex({
        noticeId,
        companyId: targetCompanyId,
        autoCreate: true,
        formacaoPreco: {
          ...custos,
          custosIndiretosDetalhados: custosDetalhados,
          custosIndiretosFixos,
          custosIndiretosValor: Number(calculo.custosIndiretosValor ?? 0),
          custoBase: custoTotalPlanilha,
          precoSugerido: calculo.precoSugerido,
          statusViabilidade: calculo.statusViabilidade,
        },
      });

      const proposalId = res.data?.data?.proposalId || res.data?.data?.proposal?.id;
      toast.success('Proposta criada com os itens reais do edital e a planilha de custos. Revise custos, margens e declarações antes de emitir.');
      if (proposalId) {
        navigate(`/fornecedor/propostas/${proposalId}`);
      } else {
        navigate('/fornecedor/propostas');
      }
    } catch (err: any) {
      console.error('[PrecificacaoPage] Erro ao gerar proposta comercial:', err);
      toast.error(err?.response?.data?.message || 'Falha ao gerar proposta comercial a partir dos itens.');
    } finally {
      setGerandoProposta(false);
    }
  };

  const formatarMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-4 sm:p-8">

      {/* CABEÇALHO DA PÁGINA */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-500 text-white rounded-lg shadow-md">
              <Calculator size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Precificação Estratégica & Formação de Lances
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulador para formação de preço segura, com margem segura e teto estratégico para pregão eletrônico.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Preço Mínimo sem Prejuízo</span>
            <span className="text-sm font-black text-rose-600">
              {isLoading ? <Loader2 size={16} className="animate-spin inline text-rose-600" /> : calculoValido ? formatarMoeda(calculo.precoBreakeven) : '—'}
            </span>
          </div>

          {noticeId && (
            <button
              type="button"
              id="btn-gerar-proposta-precificacao"
              onClick={handleGerarProposta}
              disabled={gerandoProposta || !calculoValido}
              title={calculoValido ? undefined : 'Calcule a planilha com sucesso antes de gerar a proposta'}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {gerandoProposta ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Gerando Proposta...
                </>
              ) : (
                <>
                  <FileText size={14} />
                  Gerar Proposta com a Planilha Calculada
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {isError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1 text-xs">
            <p className="font-bold">Não foi possível calcular a planilha de custos.</p>
            <p className="mt-1 text-rose-700">
              {(error as any)?.response?.data?.message || 'Verifique os valores informados e tente novamente.'} Nenhum preço foi calculado; não gere a proposta enquanto este aviso estiver visível.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-rose-400 px-3 py-1.5 font-bold hover:bg-rose-100"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* BANNER DO EDITAL VINCULADO (QUANDO ABERTO VIA RADAR OU DETALHE) */}
      {editalData && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Edital Conectado
                </span>
                {editalData.isSigiloso && (
                  <span className="rounded-lg bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Orçamento Sigiloso — Teto Calculado pelos Itens do TR
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                {editalData.notice?.objeto || editalData.notice?.object || 'Contratação Pública'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {editalData.notice?.orgao || editalData.notice?.buyerName || 'Órgão Licitante'} • {editalData.itens.length} {editalData.itens.length === 1 ? 'item oficial' : 'itens oficiais'} carregados do PNCP
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Teto Oficial Máximo</span>
                <span className="text-lg font-black text-brand-blue">
                  {formatarMoeda(editalData.valorFinal)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGerarProposta}
                disabled={gerandoProposta}
                className="hidden sm:inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {gerandoProposta ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText size={14} />
                    Gerar Proposta Comercial com Estes Preços
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANCO DE PREÇOS PRATICADOS NO GOVERNO (CATMAT / CATSER + PNCP) */}
      <div className="mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">Catálogo de Preços CATMAT / CATSER & PNCP</h3>
            <p className="text-xs text-slate-500">Pesquise preços homologados no Compras.gov.br e PNCP para guiar sua proposta.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
            <input
              type="text"
              value={termoRef}
              onChange={(e) => setTermoRef(e.target.value)}
              placeholder="Termo (ex: limpeza, notebook)..."
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 sm:w-48"
            />
            <input
              type="text"
              value={codigoRef}
              onChange={(e) => setCodigoRef(e.target.value)}
              placeholder="Cód. CATMAT/SER"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 sm:w-32"
            />
            <select
              value={tipoRef}
              onChange={(e) => setTipoRef(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
            >
              <option value="TODOS">Todos</option>
              <option value="MATERIAL">CATMAT</option>
              <option value="SERVICO">CATSER</option>
            </select>
            <button
              type="button"
              onClick={buscarReferenciaMercado}
              disabled={buscandoRef}
              className="rounded-lg bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {buscandoRef ? 'Buscando...' : 'Consultar Preços'}
            </button>
          </div>
        </div>
        {refMercado && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs">
                <span><strong>Amostras:</strong> {refMercado.totalAmostras}</span>
                <span><strong>Mínimo:</strong> {formatarMoeda(refMercado.estatisticas?.minimo || 0)}</span>
                <span className="text-emerald-700"><strong>Mediana:</strong> {formatarMoeda(refMercado.estatisticas?.mediana || 0)}</span>
                <span><strong>Média:</strong> {formatarMoeda(refMercado.estatisticas?.media || 0)}</span>
                <span><strong>Máximo:</strong> {formatarMoeda(refMercado.estatisticas?.maximo || 0)}</span>
              </div>
              {Number(refMercado.estatisticas?.mediana) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setValorMaximoEdital(Number(refMercado.estatisticas.mediana));
                    toast.success('Mediana aplicada como referência máxima do certame!');
                  }}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-bold cursor-pointer"
                >
                  Aplicar Mediana como Referência
                </button>
              )}
            </div>
            {Array.isArray(refMercado.amostras) && refMercado.amostras.length > 0 && (
              <div className="max-h-40 overflow-y-auto text-xs divide-y divide-slate-100">
                {refMercado.amostras.slice(0, 6).map((a: any) => (
                  <div key={a.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-slate-700">
                      <strong className="text-[10px] text-slate-500 mr-1">[{a.fonte}]</strong>
                      {a.descricao} — <em>{a.orgao} ({a.uf || 'BR'})</em>
                    </span>
                    <span className="font-bold text-slate-900 shrink-0">{formatarMoeda(a.valorUnitario)}/{a.unidade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* COLUNA ESQUERDA: PLANILHA COMPLETA DE CUSTOS */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Percent size={16} className="text-orange-500" />
              Planilha de Formação de Custos
            </h3>
            <span className="text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
              Base: {formatarMoeda(custos.custoProdutoServico)}
            </span>
          </div>

          {/* Custo direto do produto/serviço */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Custo direto do produto/serviço (R$)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={custos.custoProdutoServico}
              onChange={(e) => setCustos({ ...custos, custoProdutoServico: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">
              Aquisição, produção ou execução. Não inclua impostos nem custos fixos aqui.
            </p>
          </div>

          {/* Regime tributário */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Regime Tributário (preenche alíquota base)
            </label>
            <select
              value={String(custos.impostosPercentual)}
              onChange={(e) => setCustos({ ...custos, impostosPercentual: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
            >
              <option value="6">Simples Nacional — Comércio/Serviços Anexo III (6%)</option>
              <option value="8.5">Simples Nacional — Intermediário (8,5%)</option>
              <option value="11.5">Simples Nacional — Serviços/TI Anexo V (11,5%)</option>
              <option value="13.33">Lucro Presumido — Padrão (13,33%)</option>
              <option value="18">Lucro Real / ISS + PIS/COFINS + IRPJ/CSLL (18%)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alíquota Efetiva de Impostos (%)
              </label>
              <input
                type="number"
                min={0}
                max={99}
                step="0.1"
                value={custos.impostosPercentual}
                onChange={(e) => setCustos({ ...custos, impostosPercentual: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custos indiretos / logística / reserva (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={custos.custoOperacionalPercentual}
                onChange={(e) => setCustos({ ...custos, custoOperacionalPercentual: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Margem Líquida Alvo (%)
              </label>
              <input
                type="number"
                min={0}
                max={99}
                step="0.1"
                value={custos.margemDesejadaPercentual}
                onChange={(e) => setCustos({ ...custos, margemDesejadaPercentual: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Custos fixos detalhados */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            <div>
              <p className="text-xs font-black text-slate-800">Custos fixos da operação (R$)</p>
              <p className="text-[11px] text-slate-500">
                Informe o valor real por proposta. Esses custos entram no preço antes dos impostos e da margem.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rotulosCustosDetalhados.map((item) => (
                <div key={item.chave}>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {item.rotulo}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={custosDetalhados[item.chave]}
                    onChange={(e) =>
                      setCustosDetalhados({
                        ...custosDetalhados,
                        [item.chave]: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">{item.ajuda}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-xs font-bold text-slate-700">
              <span>Total de custos fixos</span>
              <span>{formatarMoeda(custosIndiretosFixos)}</span>
            </div>
          </div>

          {custos.custoProdutoServico <= 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
              Informe o custo direto real para calcular. O sistema não estima custo a partir do valor do edital.
            </p>
          )}

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Valor Máximo / Referência do Edital (R$)
            </label>
            <input
              type="number"
              value={valorMaximoEdital}
              onChange={(e) => setValorMaximoEdital(parseFloat(e.target.value) || 0)}
              className="w-full bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* COLUNA DIREITA: DRE SINTÉTICO E SIMULAÇÃO DE LANCE */}
        <div className="lg:col-span-7 space-y-6">

          {/* CARD PREÇO SUGERIDO */}
          <div className="bg-gradient-to-br from-[#0B1736] to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 size={32} className="animate-spin text-orange-500" />
              </div>
            )}

            <div>
              <span className="text-xs text-orange-400 font-bold uppercase tracking-wider block">
                Preço Ideal da Proposta Inicial
              </span>
              <h2 className="text-3xl font-black mt-1 text-white">
                {calculoValido ? formatarMoeda(calculo.precoSugerido) : '—'}
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                Margem alvo de <strong className="text-emerald-400">{custos.margemDesejadaPercentual}%</strong> sobre a receita, após impostos e custos informados. Resultado estimado, não garantido.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 text-center relative z-20">
              <span className="text-[10px] text-slate-300 font-bold uppercase block">Desconto Fixo vs Edital</span>
              <span className="text-xl font-extrabold text-emerald-400">
                {descontoFrenteEdital.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* BREAKDOWN DE CUSTOS (DRE) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10" />
            )}
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Demonstrativo de Resultado do Lance (DRE Projeção)
            </h3>

            <div className="space-y-2 text-xs relative z-20">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Receita Bruta (Preço da Proposta)</span>
                <span className="font-bold text-slate-900">{calculoValido ? formatarMoeda(calculo.precoSugerido) : '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-rose-600">
                <span>(-) Impostos ({custos.impostosPercentual}%)</span>
                <span className="font-bold">-{calculoValido ? formatarMoeda(calculo.impostoProjetado) : '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                <span>(-) Custo Direto (Aquisição / Produção)</span>
                <span className="font-bold">-{formatarMoeda(custos.custoProdutoServico)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                <span>(-) Logística / Frete ({custos.custoOperacionalPercentual}%)</span>
                <span className="font-bold">-{formatarMoeda(custoOperacionalVal)}</span>
              </div>
              {rotulosCustosDetalhados
                .filter((item) => Number(custosDetalhados[item.chave]) > 0)
                .map((item) => (
                  <div key={item.chave} className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>(-) {item.rotulo}</span>
                    <span className="font-bold">-{formatarMoeda(Number(custosDetalhados[item.chave]))}</span>
                  </div>
                ))}
              <div className="flex justify-between py-1 border-b border-slate-50 text-slate-700 bg-slate-50 px-2 rounded-md">
                <span className="font-bold">(=) Custo total da planilha</span>
                <span className="font-black">{formatarMoeda(custoTotalPlanilha)}</span>
              </div>
              <div className="flex justify-between py-2 pt-3 font-extrabold text-sm text-emerald-600 bg-emerald-50/50 px-2 rounded-lg">
                <span>(=) Lucro alvo (margem sobre a receita)</span>
                <span>{calculoValido ? formatarMoeda(calculo.lucroProjetado) : '—'}</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                Projeção calculada com os valores informados por você. Não é garantia de resultado nem validação contábil.
              </p>
            </div>
          </div>

          {/* REGRAS PARA O ENVIO AUTOMÁTICO DE LANCES */}
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4">
            <Zap className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-xs">
              <h4 className="font-bold text-amber-900">Parâmetro de Disputa (Sala de Disputa (Planilha de Lances))</h4>
              <p className="text-amber-700 mt-1">
                Ao exportar esta estratégia para o Envio Automático de Lances, o preço teto de parada será configurado em <strong>{formatarMoeda(calculo.precoBreakeven)}</strong>. O sistema desativará automaticamente os lances caso a disputa atinja esse limiar.
              </p>
            </div>
          </div>

          {noticeId && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <FileText size={16} className="text-emerald-600" />
                  Transformar Precificação em Proposta Oficial
                </h4>
                <p className="text-xs text-emerald-800 mt-1">
                  Transfere os itens reais do edital com o preço total formado na planilha. Revise custos, margens e declarações antes de emitir o documento oficial.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGerarProposta}
                disabled={gerandoProposta || !calculoValido}
                title={calculoValido ? undefined : 'Calcule a planilha com sucesso antes de gerar a proposta'}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer whitespace-nowrap"
              >
                {gerandoProposta ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Gerando Proposta...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Gerar Proposta com a Planilha Calculada
                  </>
                )}
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};