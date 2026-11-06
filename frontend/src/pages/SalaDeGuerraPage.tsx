import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  Gavel,
  ShieldWarning,
  TrendUp,
  Receipt,
  Lightning,
  Clock,
  XCircle,
  ArrowsDownUp,
  Broadcast,
  FileDoc,
  FileXls,
  DownloadSimple,
} from '@phosphor-icons/react';

import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import { taxService } from '@/services/tax.service';
import {
  SimulateBdiInput,
  SimulateBdiResult,
  PlaceBidPayload,
  BidRecord,
  SocketBidError,
} from '@/types/war-room.types';

export default function SalaDeGuerraPage() {
  const { accessToken, user } = useAuthStore();
  const { selectedCompany } = useCompany();
  const socketRef = useRef<Socket | null>(null);

  // Estado da Conexão Socket
  const [isConnected, setIsConnected] = useState(false);
  const [pregaoId, setPregaoId] = useState('PREGAO-2026-0842');
  const [generatingFormat, setGeneratingFormat] = useState<'docx' | 'xlsx' | null>(null);

  // Estado dos Inputs Financeiros (Calculadora BDI)
  const [custoInsumos, setCustoInsumos] = useState<number>(0);
  const [despesasOperacionais, setDespesasOperacionais] = useState<number>(0);
  const [margemDesejada, setMargemDesejada] = useState<number>(15);
  const [margemMinimaStopLoss, setMargemMinimaStopLoss] = useState<number>(5);
  const [bidAmountInput, setBidAmountInput] = useState<string>('');

  // Resultado da Simulação Tributária (BDI & Split Payment)
  const [simulation, setSimulation] = useState<SimulateBdiResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Lista de lances recebidos em tempo real pelo WebSocket (iniciada vazia)
  const [bids, setBids] = useState<BidRecord[]>([]);

  // Modal de Erro 403 (Stop-Loss Ativado)
  const [stopLossModalError, setStopLossModalError] = useState<SocketBidError | null>(null);

  // =========================================================================
  // 1. SIMULAÇÃO TRIBUTÁRIA EM TEMPO REAL (BDI & IVA DUAL / SPLIT PAYMENT)
  // =========================================================================
  const executarSimulacao = useCallback(async () => {
    if (!custoInsumos || custoInsumos <= 0) return;

    setIsSimulating(true);
    try {
      const payload: SimulateBdiInput = {
        custoInsumos,
        despesasOperacionais,
        margemLucroDesejada: margemDesejada,
        margemMinimaStopLoss: margemMinimaStopLoss,
        bidAmount: Number(bidAmountInput) || undefined,
      };

      const result = await taxService.simulateBdi(payload);
      setSimulation(result);
    } catch (err: any) {
      console.error('[SalaDeGuerra] Erro na simulação de BDI:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [custoInsumos, despesasOperacionais, margemDesejada, margemMinimaStopLoss, bidAmountInput]);

  // Debounce suave de 250ms para atualizar cálculos enquanto o usuário digita
  useEffect(() => {
    const timer = setTimeout(() => {
      void executarSimulacao();
    }, 250);
    return () => clearTimeout(timer);
  }, [executarSimulacao]);

  // =========================================================================
  // 2. CONEXÃO WEBSOCKET (SOCKET.IO) EM TEMPO REAL
  // =========================================================================
  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') ||
      (import.meta.env.PROD && typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3001');

    const socket = io(socketUrl, {
      auth: { token: accessToken || 'anon-dev' },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_war_room', pregaoId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Confirmação do próprio lance do usuário
    socket.on('bid_confirmed', (newBid: BidRecord) => {
      setBids((prev) => [newBid, ...prev.slice(0, 99)]);
      toast.success(
        `Lance de R$ ${newBid.bid_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado e validado!`,
        { duration: 4000 }
      );
    });

    // Lances de oponentes recebidos do mercado
    socket.on('bid_placed', (remoteBid: BidRecord) => {
      setBids((prev) => [remoteBid, ...prev.slice(0, 99)]);
    });

    // =========================================================================
    // 3. INTERCEPTAÇÃO DE ERRO 403 FORBIDDEN DO WEBSOCKET (STOP-LOSS)
    // =========================================================================
    socket.on('bid_error', (error: SocketBidError) => {
      if (error.statusCode === 403) {
        // Dispara Toast vermelho imediato
        toast.error(`⛔ BLOQUEIO 403: Stop-Loss violado! Lance recusado.`, {
          duration: 6000,
          style: {
            background: '#991B1B',
            color: '#FFFFFF',
            fontWeight: 'bold',
          },
        });

        // Abre o Modal Crítico de Alerta
        setStopLossModalError(error);
      } else {
        toast.error(error.message || 'Erro ao processar lance.');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, pregaoId]);

  // =========================================================================
  // 4. SUBMISSÃO DO LANCE VIA SOCKET
  // =========================================================================
  const handlePlaceBid = () => {
    const valor = Number(bidAmountInput);
    if (!valor || isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor de lance válido.');
      return;
    }

    if (!socketRef.current || !isConnected) {
      toast.error('Conexão com a Sala de Guerra indisponível. Tentando reconectar...');
      return;
    }

    const payload: PlaceBidPayload = {
      pregaoId,
      bid_amount: valor,
      custoInsumos,
      despesasOperacionais,
      margemMinimaPercentual: margemMinimaStopLoss,
      stop_loss_minimo: simulation?.precoMinimoStopLoss,
      licitanteNome: user?.nome || 'Minha Empresa',
    };

    // Dispara via WebSocket
    socketRef.current.emit('place_bid', payload);
  };

  // =========================================================================
  // 4.1 GERAÇÃO DE PROPOSTA COMERCIAL (.DOCX) E PLANILHA BDI (.XLSX) HIDRATADAS
  // =========================================================================
  const handleGenerateProposal = async (format: 'docx' | 'xlsx') => {
    if (!custoInsumos || custoInsumos <= 0) {
      toast.error('Informe o Custo Direto de Insumos na calculadora antes de gerar a proposta.');
      return;
    }

    setGeneratingFormat(format);
    try {
      const valorFinalLance =
        Number(bidAmountInput) > 0
          ? Number(bidAmountInput)
          : simulation?.bidSimulado || simulation?.precoSugeridoVenda;

      const { filename } = await taxService.generateHydratedProposal({
        format,
        companyId: selectedCompany?.id,
        pregaoId: pregaoId.trim() || 'PREGAO-2026',
        custoInsumos,
        despesasOperacionais,
        margemLucroDesejada: margemDesejada,
        margemMinimaStopLoss,
        bidAmount: valorFinalLance,
      });

      toast.success(
        format === 'docx'
          ? `Proposta Comercial (.docx) hidratada com sucesso: ${filename}`
          : `Planilha de Custos e BDI (.xlsx) gerada com sucesso: ${filename}`,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Erro ao gerar o documento hidratado da proposta.',
      );
    } finally {
      setGeneratingFormat(null);
    }
  };

  // =========================================================================
  // 5. CASCATA DE LANCES OTIMIZADA COM USEMEMO (60 FPS)
  // =========================================================================
  const lancesOrdenados = useMemo(() => {
    return [...bids].sort((a, b) => b.bid_amount - a.bid_amount);
  }, [bids]);

  const menorLanceAtual = useMemo(() => {
    if (bids.length === 0) return 0;
    return Math.min(...bids.map((b) => b.bid_amount));
  }, [bids]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8 bg-brand-light min-h-screen font-sans">
      {/* Header Executivo da Sala de Guerra */}
      <header className="mb-6 flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-900 border border-orange-200">
              <Lightning className="h-3.5 w-3.5 text-brand-orange" weight="fill" />
              Sala de Guerra & Operação ao Vivo
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  WebSocket Conectado (Socket.io)
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Conectando...
                </>
              )}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-dark">
            Cockpit de Disputa & Split Payment
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Simulador de BDI tributário sob a Reforma (IVA Dual: CBS 11,3% + IBS 0,1%) com trava anti-prejuízo Stop-Loss.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              ID da Disputa
            </span>
            <input
              type="text"
              value={pregaoId}
              onChange={(e) => setPregaoId(e.target.value)}
              className="text-xs font-black text-brand-dark outline-none bg-transparent"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleGenerateProposal('docx')}
            disabled={generatingFormat !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-orange hover:bg-orange-600 disabled:opacity-60 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition active:scale-95 cursor-pointer"
            title="Gerar Proposta Comercial em Word (.docx) hidratada com os dados reais da empresa e cálculos de BDI/IVA Dual"
          >
            <FileDoc className="h-4 w-4 text-white" weight="duotone" />
            {generatingFormat === 'docx' ? 'Gerando .DOCX...' : 'Gerar Proposta (.DOCX)'}
          </button>

          <button
            type="button"
            onClick={() => void handleGenerateProposal('xlsx')}
            disabled={generatingFormat !== null}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-800 shadow-xs transition active:scale-95 cursor-pointer"
            title="Exportar Planilha de Custos, BDI e Split Payment em Excel (.xlsx)"
          >
            <FileXls className="h-4 w-4 text-emerald-700" weight="duotone" />
            {generatingFormat === 'xlsx' ? 'Gerando .XLSX...' : 'Planilha BDI (.XLSX)'}
          </button>
        </div>
      </header>

      {/* Grid Principal: 2 Colunas (Calculadora Financeira + Cockpit Real-Time) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===================================================================
            COLUNA ESQUERDA: CALCULADORA BDI, IVA DUAL E STOP-LOSS (5 COLS)
            =================================================================== */}
        <section className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-brand-orange" weight="duotone" />
                <h2 className="text-sm font-black uppercase tracking-wider text-brand-dark">
                  Parâmetros de Custo & Margem
                </h2>
              </div>
              {isSimulating && (
                <span className="text-[10px] font-bold text-brand-orange animate-pulse">
                  Calculando BDI...
                </span>
              )}
            </div>

            <div className="space-y-4">
              {/* Custo Direto de Insumos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Custo Direto de Insumos / Materiais (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={custoInsumos}
                    onChange={(e) => setCustoInsumos(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
                  />
                </div>
              </div>

              {/* Despesas Operacionais */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Despesas Operacionais & Indiretas (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={despesasOperacionais}
                    onChange={(e) => setDespesasOperacionais(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
                  />
                </div>
              </div>

              {/* Margens: Desejada e Stop-Loss */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Margem Alvo (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={margemDesejada}
                    onChange={(e) => setMargemDesejada(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                    <ShieldWarning className="h-3.5 w-3.5" weight="bold" />
                    Stop-Loss (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={margemMinimaStopLoss}
                    onChange={(e) => setMargemMinimaStopLoss(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-red-200 bg-red-50/50 py-2 px-3 text-sm font-bold text-red-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>

            {/* Painel de Resultados do IVA Dual & Split Payment */}
            {simulation && (
              <div className="mt-6 space-y-3 pt-5 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                    <span className="flex items-center gap-1">
                      <Receipt className="h-4 w-4 text-[#EA580C]" />
                      Retenção Split Payment (11,4%)
                    </span>
                    <span className="text-orange-600 font-extrabold">
                      - R$ {simulation.splitPayment.totalRetidoFonte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <div>
                      <span>CBS União (11,3%):</span>
                      <strong className="block text-slate-700">
                        R$ {simulation.splitPayment.retencaoCbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span>IBS Estados/Mun. (0,1%):</span>
                      <strong className="block text-slate-700">
                        R$ {simulation.splitPayment.retencaoIbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card de Stop-Loss Inviolável */}
                <div className="rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-orange-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-800 flex items-center gap-1">
                        <ShieldWarning className="h-4 w-4 text-red-600" weight="fill" />
                        Piso Mínimo Inviolável (Stop-Loss)
                      </span>
                      <div className="text-xl font-black text-red-950 mt-0.5">
                        R$ {simulation.precoMinimoStopLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-xs">
                      Trava Ativa
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-red-700">
                    Qualquer lance abaixo deste valor será bloqueado com erro 403 Forbidden pelo WebSocket para proteger seu fluxo de caixa.
                  </p>
                </div>

                {/* Métricas do Lance Atual */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Receita Líquida na Conta
                    </span>
                    <span className="text-sm font-black text-slate-800">
                      R$ {simulation.receitaLiquidaAposSplit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Margem Líquida Real
                    </span>
                    <span
                      className={`text-sm font-black flex items-center gap-1 ${
                        simulation.violaStopLoss ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      <TrendUp className="h-4 w-4" />
                      {simulation.margemLiquidaPercentual}% (R$ {simulation.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                </div>

                {/* Exportação Hidratada em Tempo Real (.DOCX e .XLSX) */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>
                      Empresa Hidratada:{' '}
                      <strong className="text-brand-dark">
                        {selectedCompany?.razaoSocial || user?.company?.razaoSocial || 'Empresa Ativa'}
                      </strong>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {selectedCompany?.cnpj || user?.company?.cnpj || ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => void handleGenerateProposal('docx')}
                      disabled={generatingFormat !== null}
                      className="flex items-center justify-center gap-2 rounded-xl bg-brand-orange hover:bg-orange-600 disabled:opacity-60 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <DownloadSimple className="h-4 w-4 text-white" weight="bold" />
                      {generatingFormat === 'docx' ? 'Hidratando...' : 'Gerar Proposta (.DOCX)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateProposal('xlsx')}
                      disabled={generatingFormat !== null}
                      className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <DownloadSimple className="h-4 w-4 text-white" weight="bold" />
                      {generatingFormat === 'xlsx' ? 'Gerando...' : 'Baixar Planilha (.XLSX)'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ===================================================================
            COLUNA DIREITA: COCKPIT DE LANCES EM TEMPO REAL & WEBSOCKET (7 COLS)
            =================================================================== */}
        <section className="lg:col-span-7 space-y-6">
          {/* Caixa de Ação Rápida de Lance */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-brand-orange" weight="duotone" />
                <h2 className="text-sm font-black uppercase tracking-wider text-brand-dark">
                  Disparador de Lances (Cockpit ao Vivo)
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <ArrowsDownUp className="h-4 w-4 text-brand-orange" />
                Menor Lance de Mercado:{' '}
                <strong className="text-slate-900">
                  R$ {menorLanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  step="100"
                  value={bidAmountInput}
                  onChange={(e) => setBidAmountInput(e.target.value)}
                  placeholder="Valor do seu lance..."
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-base font-black text-slate-900 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 shadow-xs"
                />
              </div>

              <button
                type="button"
                onClick={handlePlaceBid}
                disabled={!isConnected}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange hover:bg-orange-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Broadcast className="h-4 w-4" weight="bold" />
                Submeter Lance na Disputa
              </button>
            </div>

            {/* Aviso de conformidade contra o Stop-Loss antes do clique */}
            {simulation && (
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>
                  Stop-Loss: R$ {simulation.precoMinimoStopLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={
                    Number(bidAmountInput) < simulation.precoMinimoStopLoss
                      ? 'text-red-600 font-black'
                      : 'text-emerald-600 font-bold'
                  }
                >
                  {Number(bidAmountInput) < simulation.precoMinimoStopLoss
                    ? '⚠️ Atenção: Valor viola a margem mínima!'
                    : '✓ Lance seguro contra Stop-Loss'}
                </span>
              </div>
            )}
          </div>

          {/* Cascata de Lances em Tempo Real (useMemo para alta performance) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-blue" weight="duotone" />
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-dark">
                  Histórico de Lances em Cascata ({bids.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Tempo real via WebSockets
              </span>
            </div>

            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 scrollbar-thin">
              {lancesOrdenados.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 my-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-brand-orange mb-2">
                    <Lightning className="h-5 w-5" weight="fill" />
                  </div>
                  <p className="text-xs font-black text-slate-800">
                    Nenhum lance registrado nesta sessão
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                    Conecte-se à disputa e envie lances estratégicos em tempo real respeitando a margem Stop-Loss e o Split Payment.
                  </p>
                </div>
              ) : (
                lancesOrdenados.map((lance, index) => {
                const isLeader = index === 0;

                return (
                  <div
                    key={lance.id}
                    className={`flex items-center justify-between rounded-xl p-3.5 transition-all ${
                      lance.isOwnBid
                        ? 'border-2 border-brand-orange bg-orange-50/40 shadow-xs'
                        : isLeader
                        ? 'border border-emerald-300 bg-emerald-50/50 shadow-xs'
                        : 'border border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs ${
                          lance.isOwnBid
                            ? 'bg-brand-orange text-white shadow-xs'
                            : isLeader
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{index + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-brand-dark">
                            {lance.licitanteNome}
                          </span>
                          {lance.isOwnBid && (
                            <span className="rounded bg-orange-100 px-1.5 py-0.2 text-[9px] font-black text-brand-orange uppercase">
                              Sua Oferta
                            </span>
                          )}
                          {isLeader && !lance.isOwnBid && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black text-emerald-800 uppercase">
                              Melhor Lance
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-semibold">
                          Horário: {lance.timestamp} · Split Retido: R$ {lance.splitPaymentRetido.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        R$ {lance.bid_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">
                        Margem: {lance.margemLiquida.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================================
          MODAL CRÍTICO DE ERRO 403 (STOP-LOSS BLOQUEADO PELO WEBSOCKET)
          ===================================================================== */}
      {stopLossModalError && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border-2 border-red-500 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-inner">
                <ShieldWarning className="h-7 w-7" weight="fill" />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    Erro 403 Forbidden · Stop-Loss
                  </span>
                  <button
                    onClick={() => setStopLossModalError(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                <h3 className="mt-2 text-lg font-black text-brand-dark">
                  Lance Bloqueado pelo Stop-Loss Tributário
                </h3>

                <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
                  {stopLossModalError.message}
                </p>

                {/* Box de Confronto de Valores */}
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-red-50 p-3 border border-red-200">
                  <div>
                    <span className="text-[10px] font-bold text-red-700 uppercase">
                      Lance Rejeitado
                    </span>
                    <strong className="block text-sm font-black text-red-900">
                      R$ {stopLossModalError.bid_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-red-700 uppercase">
                      Piso Mínimo Aceitável
                    </span>
                    <strong className="block text-sm font-black text-red-900">
                      R$ {stopLossModalError.stop_loss_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStopLossModalError(null);
                      if (simulation) {
                        setBidAmountInput(simulation.precoMinimoStopLoss.toString());
                      }
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Ajustar para o Piso (R$ {stopLossModalError.stop_loss_minimo.toFixed(2)})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStopLossModalError(null)}
                    className="rounded-xl bg-red-600 px-5 py-2 text-xs font-black uppercase text-white shadow-md hover:bg-red-700 transition"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

