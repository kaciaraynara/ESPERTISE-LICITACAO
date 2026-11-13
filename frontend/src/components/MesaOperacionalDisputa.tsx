import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  Zap,
  Shield,
  Lock,
  Radio,
  Play,
  Pause,
  RefreshCw,
  Clock,
  ExternalLink,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  TrendingDown,
  X,
  Building2,
  Gavel,
} from 'lucide-react';

import { useAuthStore } from '../store/auth.store';
import api, { noticesApi } from '../services/api';
import { taxService } from '../services/tax.service';
import { EditalSelector, EditalOption } from './EditalSelector';
import { BidRecord, SocketBidError } from '../types/war-room.types';

export interface ItemDisputa {
  id: string;
  itemNumero: number;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  valorUnitarioEstimado: number | null;
  valorTotalEstimado: number | null;
  unitCost: number;
  despesasPercentual: number;
  margemAlvoPercentual: number;
  stopLossMinimo: number;
  margemLiquidaCalculada: number;
  melhorLanceAtual: number;
  seuUltimoLance: number | null;
  isLeading: boolean;
  posicao: number;
  autoLanceAtivo: boolean;
  decremento: number;
  inputManual: string;
}

export interface LiveTickerEntry {
  id: string;
  time: string;
  itemNumero?: number;
  licitante: string;
  valor: number;
  isOwnBid: boolean;
  variacaoPercentual?: number;
  status?: string;
}

interface MesaOperacionalDisputaProps {
  mode?: 'disputa' | 'robo';
}

function calcularMargemLiquida(precoAtual: number, unitCost: number, despesasPercentual: number): number {
  if (!precoAtual || precoAtual <= 0) return 0;
  const custoTotal = unitCost * (1 + despesasPercentual / 100);
  const ivaDualRetido = precoAtual * 0.114;
  const lucroLiquido = precoAtual - ivaDualRetido - custoTotal;
  return Number(((lucroLiquido / precoAtual) * 100).toFixed(1));
}

export const MesaOperacionalDisputa: React.FC<MesaOperacionalDisputaProps> = ({ mode = 'disputa' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const noticeIdParam =
    searchParams.get('id') ||
    searchParams.get('licitacao') ||
    searchParams.get('noticeId') ||
    '';
  const precoLimiteParam =
    Number(searchParams.get('precoLimite') || searchParams.get('stopLoss') || searchParams.get('piso') || '0') || 0;
  const portalParam = searchParams.get('portal') || '';

  const { accessToken, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  const [editalAtivo, setEditalAtivo] = useState<EditalOption | null>(null);
  const [isEditalSelectorOpen, setIsEditalSelectorOpen] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [cronometroSegundos, setCronometroSegundos] = useState(165);
  const [cronometroAtivo, setCronometroAtivo] = useState(true);

  const [itens, setItens] = useState<ItemDisputa[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  const [modoEstrategia, setModoEstrategia] = useState<'SNIPER' | 'IMEDIATO'>('SNIPER');
  const [decrementoGlobal, setDecrementoGlobal] = useState<number>(1.0);
  const [automacaoGlobalAtiva, setAutomacaoGlobalAtiva] = useState(false);

  const [tickerLances, setTickerLances] = useState<LiveTickerEntry[]>([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const itemEmFoco = useMemo(() => {
    if (itens.length === 0) return null;
    return itens[selectedItemIndex] || itens[0];
  }, [itens, selectedItemIndex]);

  const bdiCalculado = useMemo(() => {
    if (!itemEmFoco) {
      return {
        custoDireto: 0,
        despesas: 0,
        custoTotal: 0,
        ivaDualRetido: 0,
        receitaLiquida: 0,
        lucroLiquido: 0,
        margemReal: 0,
        pisoStopLoss: precoLimiteParam || 0,
      };
    }

    const custoDireto = itemEmFoco.unitCost;
    const despesas = custoDireto * (itemEmFoco.despesasPercentual / 100);
    const custoTotal = custoDireto + despesas;
    const precoAtual = itemEmFoco.melhorLanceAtual || itemEmFoco.valorUnitarioEstimado || itemEmFoco.stopLossMinimo * 1.25;

    const ivaDualRetido = precoAtual * 0.114;
    const receitaLiquida = precoAtual - ivaDualRetido;
    const lucroLiquido = receitaLiquida - custoTotal;
    const margemReal = precoAtual > 0 ? (lucroLiquido / precoAtual) * 100 : 0;

    return {
      custoDireto,
      despesas,
      custoTotal,
      ivaDualRetido,
      receitaLiquida,
      lucroLiquido,
      margemReal,
      pisoStopLoss: itemEmFoco.stopLossMinimo,
    };
  }, [itemEmFoco, precoLimiteParam]);

  const totaisPlanilha = useMemo(() => {
    return itens.reduce(
      (acc, it) => {
        const valorTotalLance = it.melhorLanceAtual * it.quantidade;
        const custoTotalItem = it.unitCost * it.quantidade;
        return {
          totalLance: acc.totalLance + valorTotalLance,
          totalCusto: acc.totalCusto + custoTotalItem,
        };
      },
      { totalLance: 0, totalCusto: 0 },
    );
  }, [itens]);

  useEffect(() => {
    if (!cronometroAtivo) return;
    const interval = setInterval(() => {
      setCronometroSegundos((prev) => (prev > 0 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(interval);
  }, [cronometroAtivo]);

  const formatCronometro = (totalSegundos: number) => {
    const min = Math.floor(totalSegundos / 60);
    const seg = totalSegundos % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  const carregarItensEdital = useCallback(
    async (idEdital: string, valorEstimadoFallback?: number | null, objetoFallback?: string | null) => {
      if (!idEdital) return;
      setLoadingItens(true);

      try {
        const resp = await noticesApi.getItens(idEdital);
        const rawList = resp?.data?.data || resp?.data || [];

        let mappedItens: ItemDisputa[] = [];

        if (Array.isArray(rawList) && rawList.length > 0) {
          mappedItens = rawList.map((it: any, idx: number) => {
            const itemNumero = Number(it.itemNumero || it.numeroItem || idx + 1);
            const descricao = String(it.descricao || it.especificacao || `Item #${itemNumero}`).trim();
            const quantidade = Number(it.quantidade) || 1;
            const unidadeMedida = String(it.unidadeMedida || it.unidade || 'UN').toUpperCase();

            const valorRef =
              it.valorUnitarioEstimado != null && Number(it.valorUnitarioEstimado) > 0
                ? Number(it.valorUnitarioEstimado)
                : it.valorUnitario != null && Number(it.valorUnitario) > 0
                  ? Number(it.valorUnitario)
                  : null;

            const valorTotal =
              it.valorTotal != null && Number(it.valorTotal) > 0
                ? Number(it.valorTotal)
                : valorRef
                  ? valorRef * quantidade
                  : null;

            const unitCost =
              Number(it.unitCost) > 0
                ? Number(it.unitCost)
                : valorRef
                  ? Math.round(valorRef * 0.7 * 100) / 100
                  : 0;

            const custoComDespesas = unitCost * 1.05;
            const stopLossCalc = unitCost > 0 ? Number((custoComDespesas / 0.836).toFixed(2)) : 0;
            const stopLossMinimo =
              precoLimiteParam > 0
                ? precoLimiteParam
                : Number(it.stopLossUnitario) > 0
                  ? Number(it.stopLossUnitario)
                  : stopLossCalc;

            const melhorLance = valorRef ?? (stopLossMinimo > 0 ? Number((stopLossMinimo * 1.25).toFixed(2)) : 0);
            const margemCalc = calcularMargemLiquida(melhorLance, unitCost, 5);

            return {
              id: it.id || `item-${itemNumero}`,
              itemNumero,
              descricao,
              quantidade,
              unidadeMedida,
              valorUnitarioEstimado: valorRef,
              valorTotalEstimado: valorTotal,
              unitCost,
              despesasPercentual: 5,
              margemAlvoPercentual: 15,
              stopLossMinimo,
              margemLiquidaCalculada: margemCalc,
              melhorLanceAtual: melhorLance,
              seuUltimoLance: null,
              isLeading: false,
              posicao: 2,
              autoLanceAtivo: automacaoGlobalAtiva,
              decremento: decrementoGlobal,
              inputManual: '',
            };
          });
        }

        if (mappedItens.length === 0) {
          const valorRef = valorEstimadoFallback && valorEstimadoFallback > 0 ? valorEstimadoFallback : null;
          const unitCost = valorRef ? Math.round(valorRef * 0.72 * 100) / 100 : 0;
          const stopLossMinimo =
            precoLimiteParam > 0
              ? precoLimiteParam
              : unitCost > 0
                ? Number(((unitCost * 1.05) / 0.836).toFixed(2))
                : 0;
          const melhorLance = valorRef ?? (stopLossMinimo > 0 ? Number((stopLossMinimo * 1.2).toFixed(2)) : 0);

          mappedItens = [
            {
              id: `item-1-geral`,
              itemNumero: 1,
              descricao: objetoFallback || editalAtivo?.objeto || 'Item Geral do Certame (Conforme Termo de Referência)',
              quantidade: 1,
              unidadeMedida: 'UN/LOTE',
              valorUnitarioEstimado: valorRef,
              valorTotalEstimado: valorRef,
              unitCost,
              despesasPercentual: 5,
              margemAlvoPercentual: 15,
              stopLossMinimo,
              margemLiquidaCalculada: calcularMargemLiquida(melhorLance, unitCost, 5),
              melhorLanceAtual: melhorLance,
              seuUltimoLance: null,
              isLeading: false,
              posicao: 2,
              autoLanceAtivo: automacaoGlobalAtiva,
              decremento: decrementoGlobal,
              inputManual: '',
            },
          ];
        }

        setItens(mappedItens);
        setSelectedItemIndex(0);
      } catch (err) {
        console.warn('[MesaOperacional] Falha ao obter itens do edital:', err);
        toast.error('Não foi possível carregar os itens automáticos do edital.');
      } finally {
        setLoadingItens(false);
      }
    },
    [automacaoGlobalAtiva, decrementoGlobal, editalAtivo?.objeto, precoLimiteParam],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadEditalData() {
      try {
        if (noticeIdParam) {
          const resp = await api.get(`/licitacoes/${encodeURIComponent(noticeIdParam)}`).catch(() => null);
          const n = resp?.data?.data || resp?.data;

          if (n && isMounted) {
            const editalOpt: EditalOption = {
              id: n.id || noticeIdParam,
              numeroEdital: n.numeroEdital || n.processo || n.numeroControlePNCP || noticeIdParam,
              numeroControlePNCP: n.numeroControlePNCP || noticeIdParam,
              orgao: n.orgao || n.nomeOrgao || 'Órgão Licitante',
              cnpjOrgao: n.cnpjOrgao,
              modalidade: n.modalidade || 'Pregão Eletrônico',
              dataCertame: n.dataAbertura || n.dataAberturaProposta,
              objeto: n.objeto || n.objetoCompra,
              valorEstimado: n.valorEstimado || n.valorTotalEstimado || null,
              urlOficialPncp: n.link || n.urlOficialPncp || portalParam,
              fonte: 'salvo',
            };
            setEditalAtivo(editalOpt);
            void carregarItensEdital(editalOpt.id, editalOpt.valorEstimado, editalOpt.objeto);
            return;
          }
        }

        // Sem edital na URL: tenta carregar automaticamente o primeiro edital salvo do usuário (zero dados fictícios)
        const salvosResp = await api.get('/licitacoes/salvos').catch(() => null);
        const salvosList = salvosResp?.data?.data || [];
        if (Array.isArray(salvosList) && salvosList.length > 0 && isMounted) {
          const first = salvosList[0];
          const editalOpt: EditalOption = {
            id: first.id || first.noticeId,
            numeroEdital: first.numeroEdital || first.numeroControlePNCP || first.id,
            numeroControlePNCP: first.numeroControlePNCP || first.id,
            orgao: first.orgao || first.buyerName || 'Órgão Licitante',
            cnpjOrgao: first.cnpjOrgao,
            modalidade: first.modalidade || 'Pregão Eletrônico',
            dataCertame: first.dataLimite || first.dataAbertura,
            objeto: first.objeto,
            valorEstimado: first.valorEstimado ?? null,
            urlOficialPncp: first.urlOficialPncp || 'https://pncp.gov.br/app/editais',
            fonte: 'salvo',
          };
          setEditalAtivo(editalOpt);
          void carregarItensEdital(editalOpt.id, editalOpt.valorEstimado, editalOpt.objeto);
        }
      } catch {
        // Silencioso
      }
    }

    void loadEditalData();
    return () => {
      isMounted = false;
    };
  }, [noticeIdParam, precoLimiteParam, portalParam, carregarItensEdital]);

  useEffect(() => {
    if (!editalAtivo?.id) return;

    const socketUrl =
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') ||
      (import.meta.env.PROD && typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3001');

    const socket = io(socketUrl, {
      auth: { token: accessToken || 'anon-dev' },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 4,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_war_room', editalAtivo.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('bid_confirmed', (bid: BidRecord) => {
      setItens((prev) =>
        prev.map((item) => {
          if (bid.itemNumero === undefined || item.itemNumero === bid.itemNumero) {
            return {
              ...item,
              melhorLanceAtual: bid.bid_amount,
              seuUltimoLance: bid.bid_amount,
              isLeading: true,
              posicao: 1,
              margemLiquidaCalculada: bid.margemLiquida ?? calcularMargemLiquida(bid.bid_amount, item.unitCost, item.despesasPercentual),
            };
          }
          return item;
        }),
      );

      setTickerLances((prev) => [
        {
          id: bid.id,
          time: bid.timestamp,
          itemNumero: bid.itemNumero,
          licitante: bid.licitanteNome,
          valor: bid.bid_amount,
          isOwnBid: true,
          status: 'LIDERANDO',
        },
        ...prev.slice(0, 49),
      ]);

      toast.success(
        `Lance ${bid.itemNumero ? `Item #${bid.itemNumero} ` : ''}R$ ${bid.bid_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado!`,
      );
    });

    socket.on('bid_placed', (remoteBid: BidRecord) => {
      setItens((prev) =>
        prev.map((item) => {
          if (remoteBid.itemNumero === undefined || item.itemNumero === remoteBid.itemNumero) {
            const wasLeading = item.isLeading;
            const updatedItem = {
              ...item,
              melhorLanceAtual: remoteBid.bid_amount,
              isLeading: false,
              posicao: 2,
              margemLiquidaCalculada: calcularMargemLiquida(remoteBid.bid_amount, item.unitCost, item.despesasPercentual),
            };

            if (item.autoLanceAtivo && wasLeading) {
              const stopLoss = item.stopLossMinimo;
              const decremento = item.decremento;
              const menorLance = remoteBid.bid_amount;

              if (menorLance <= stopLoss) {
                toast.error(
                  `[STOP-LOSS] Mercado rompeu seu piso (R$ ${stopLoss.toFixed(2)}). Cobertura automática cancelada no Item #${item.itemNumero}.`,
                );
                return { ...updatedItem, autoLanceAtivo: false };
              }

              const novoLance = Number(Math.max(stopLoss, menorLance - decremento).toFixed(2));

              if (novoLance >= stopLoss) {
                socket.emit('place_bid', {
                  pregaoId: editalAtivo.id,
                  itemNumero: item.itemNumero,
                  bid_amount: novoLance,
                  custoInsumos: item.unitCost,
                  stop_loss_minimo: stopLoss,
                  licitanteNome: user?.nome || 'Minha Empresa (Você - Robô)',
                });
              }
            }

            return updatedItem;
          }
          return item;
        }),
      );

      setTickerLances((prev) => [
        {
          id: remoteBid.id,
          time: remoteBid.timestamp,
          itemNumero: remoteBid.itemNumero,
          licitante: remoteBid.licitanteNome,
          valor: remoteBid.bid_amount,
          isOwnBid: false,
          status: 'OPONENTE',
        },
        ...prev.slice(0, 49),
      ]);
    });

    socket.on('bid_error', (err: SocketBidError) => {
      toast.error(err.message || 'Bloqueio de segurança Stop-Loss acionado.');
      if (err.itemNumero !== undefined) {
        setItens((prev) =>
          prev.map((it) => (it.itemNumero === err.itemNumero ? { ...it, autoLanceAtivo: false } : it)),
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [editalAtivo?.id, accessToken, user?.nome]);

  const handleSelectEdital = (edital: EditalOption) => {
    setEditalAtivo(edital);
    setSearchParams({ id: edital.id });
    setIsEditalSelectorOpen(false);
    void carregarItensEdital(edital.id, edital.valorEstimado, edital.objeto);
  };

  const handleAtualizarCustoItem = (itemNumero: number, novoCusto: number) => {
    const custoVal = Number.isFinite(novoCusto) && novoCusto >= 0 ? novoCusto : 0;
    setItens((prev) =>
      prev.map((it) => {
        if (it.itemNumero !== itemNumero) return it;
        const custoComDespesas = custoVal * (1 + it.despesasPercentual / 100);
        const novoStopLoss = custoVal > 0 ? Number((custoComDespesas / 0.836).toFixed(2)) : 0;
        const precoRef = it.melhorLanceAtual > 0 ? it.melhorLanceAtual : Number((novoStopLoss * 1.2).toFixed(2));
        return {
          ...it,
          unitCost: custoVal,
          stopLossMinimo: novoStopLoss,
          melhorLanceAtual: precoRef,
          margemLiquidaCalculada: calcularMargemLiquida(precoRef, custoVal, it.despesasPercentual),
        };
      }),
    );
  };

  const handleAtualizarStopLossItem = (itemNumero: number, novoPiso: number) => {
    const pisoVal = Number.isFinite(novoPiso) && novoPiso >= 0 ? novoPiso : 0;
    setItens((prev) =>
      prev.map((it) => {
        if (it.itemNumero !== itemNumero) return it;
        return {
          ...it,
          stopLossMinimo: pisoVal,
        };
      }),
    );
  };

  const handleEnviarLanceItem = (itemNumero: number, valorParam?: number) => {
    const item = itens.find((it) => it.itemNumero === itemNumero);
    if (!item) return;

    const valor = valorParam !== undefined ? valorParam : Number(item.inputManual.replace(',', '.'));

    if (!valor || valor <= 0) {
      toast.error('Informe um valor de lance válido.');
      return;
    }

    if (item.stopLossMinimo > 0 && valor < item.stopLossMinimo) {
      toast.error(
        `Lance BLOQUEADO: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} viola o piso de Stop-Loss (R$ ${item.stopLossMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
      );
      return;
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('place_bid', {
        pregaoId: editalAtivo?.id || 'arena-geral',
        itemNumero: item.itemNumero,
        bid_amount: valor,
        custoInsumos: item.unitCost,
        stop_loss_minimo: item.stopLossMinimo,
        licitanteNome: user?.nome || 'Minha Empresa (Você)',
      });
    } else {
      setItens((prev) =>
        prev.map((it) =>
          it.itemNumero === itemNumero
            ? {
                ...it,
                melhorLanceAtual: valor,
                seuUltimoLance: valor,
                isLeading: true,
                posicao: 1,
                margemLiquidaCalculada: calcularMargemLiquida(valor, it.unitCost, it.despesasPercentual),
                inputManual: '',
              }
            : it,
        ),
      );
      toast.success(`Lance de R$ ${valor.toFixed(2)} registrado na planilha da disputa.`);
    }

    setItens((prev) =>
      prev.map((it) => (it.itemNumero === itemNumero ? { ...it, inputManual: '' } : it)),
    );
  };

  const handleCobrirItem = (itemNumero: number) => {
    const item = itens.find((it) => it.itemNumero === itemNumero);
    if (!item) return;

    const base = item.melhorLanceAtual || item.valorUnitarioEstimado || item.stopLossMinimo * 1.25;
    if (!base || base <= 0) {
      toast.error('Informe o custo ou valor inicial antes de cobrir.');
      return;
    }
    const novoValor = Number(Math.max(item.stopLossMinimo, base - item.decremento).toFixed(2));

    if (item.stopLossMinimo > 0 && novoValor < item.stopLossMinimo) {
      toast.error(`Piso de Stop-Loss atingido (R$ ${item.stopLossMinimo.toFixed(2)}). Não é possível cobrir.`);
      return;
    }

    handleEnviarLanceItem(itemNumero, novoValor);
  };

  const handleToggleAutoLanceItem = (itemNumero: number) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.itemNumero === itemNumero) {
          const novoEstado = !it.autoLanceAtivo;
          if (novoEstado) {
            toast.success(`Robô ativado para o Item #${itemNumero} (Piso: R$ ${it.stopLossMinimo.toFixed(2)})`);
            socketRef.current?.emit('iniciar_robo', {
              pregaoId: editalAtivo?.id || 'arena-geral',
              itemNumero,
              valorInicial: it.melhorLanceAtual,
              lanceMinimoPermitido: it.stopLossMinimo,
              decrementoMinimo: it.decremento,
              estrategia: modoEstrategia === 'SNIPER' ? 'sniper' : 'agressivo',
            });
          } else {
            toast(`Robô pausado no Item #${itemNumero}`);
            socketRef.current?.emit('pausar_robo', { itemNumero });
          }
          return { ...it, autoLanceAtivo: novoEstado };
        }
        return it;
      }),
    );
  };

  const handleToggleAutomacaoGlobal = () => {
    if (itens.length === 0) {
      toast.error('Selecione um edital antes de ativar o robô.');
      return;
    }

    const novoEstado = !automacaoGlobalAtiva;
    setAutomacaoGlobalAtiva(novoEstado);

    setItens((prev) =>
      prev.map((it) => ({
        ...it,
        autoLanceAtivo: novoEstado,
        decremento: decrementoGlobal,
      })),
    );

    if (novoEstado) {
      toast.success(`Robô ATIVADO em todos os ${itens.length} itens do edital!`);
      socketRef.current?.emit('iniciar_robo', {
        pregaoId: editalAtivo?.id || 'arena-geral',
        valorInicial: itens[0]?.melhorLanceAtual || 0,
        lanceMinimoPermitido: itens[0]?.stopLossMinimo || 0,
        decrementoMinimo: decrementoGlobal,
        estrategia: modoEstrategia === 'SNIPER' ? 'sniper' : 'agressivo',
      });
    } else {
      toast('Automação do Robô pausada em todos os itens.');
      socketRef.current?.emit('pausar_robo');
    }
  };

  const handleExportarReadequada = async (format: 'docx' | 'xlsx') => {
    setIsExportMenuOpen(false);
    const toastId = toast.loading(`Gerando proposta readequada (.${format.toUpperCase()})...`);

    try {
      await taxService.generateHydratedProposal({
        format,
        pregaoId: editalAtivo?.numeroEdital || editalAtivo?.id || 'PROPOSTA_READEQUADA',
        noticeId: editalAtivo?.id,
        orgao: editalAtivo?.orgao,
        objeto: editalAtivo?.objeto,
        custoInsumos: bdiCalculado.custoDireto,
        despesasOperacionais: bdiCalculado.despesas,
        margemLucroDesejada: itemEmFoco?.margemAlvoPercentual || 15,
        margemMinimaStopLoss: 5,
        bidAmount: itemEmFoco?.melhorLanceAtual || 0,
      });

      toast.success(`Proposta readequada (.${format.toUpperCase()}) exportada com sucesso!`, { id: toastId });
    } catch {
      try {
        const rows = [
          ['Item', 'Descrição', 'Qtd', 'Unidade', 'Valor Ref. (PNCP)', 'Custo Unit. (R$)', 'Lance Atual (R$)', 'Valor Total (R$)', 'Status'],
          ...itens.map((it) => [
            String(it.itemNumero),
            `"${it.descricao.replace(/"/g, '""')}"`,
            String(it.quantidade),
            it.unidadeMedida,
            it.valorUnitarioEstimado ? it.valorUnitarioEstimado.toFixed(2) : 'Sigiloso',
            it.unitCost.toFixed(2),
            it.melhorLanceAtual.toFixed(2),
            (it.melhorLanceAtual * it.quantidade).toFixed(2),
            it.isLeading ? '1º Lugar (Arrematado)' : 'Disputado',
          ]),
        ];

        const csvContent = '\uFEFF' + rows.map((e) => e.join(';')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Proposta_Readequada_${editalAtivo?.numeroEdital || 'Certame'}.${format === 'xlsx' ? 'csv' : 'txt'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Quadro de proposta readequada exportado com sucesso!', { id: toastId });
      } catch {
        toast.error('Erro ao gerar arquivo de exportação.', { id: toastId });
      }
    }
  };

  const portalOficialUrl = useMemo(() => {
    return editalAtivo?.urlOficialPncp || portalParam || 'https://pncp.gov.br/app/editais';
  }, [editalAtivo, portalParam]);

  return (
    <div className="w-full bg-[#F4F6F9] text-slate-800 min-h-screen font-sans flex flex-col">
      {/* ZONA 1 — CABEÇALHO CLARO ESTILO BLL / GOV.BR */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-[#081c3a] px-3 py-2.5 sm:px-5 shadow-xs">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsEditalSelectorOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#081c3a] hover:bg-[#0d2a56] px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer shadow-xs shrink-0"
              title="Trocar Edital / Licitação Ativa"
            >
              <Gavel className="h-3.5 w-3.5 text-[#ff6600]" />
              <span className="font-mono text-xs">
                {editalAtivo?.numeroEdital || 'Selecionar Edital'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-4 w-4 text-[#0070c0] shrink-0 hidden sm:block" />
              <span
                className="text-xs sm:text-sm font-bold text-[#081c3a] truncate max-w-[200px] sm:max-w-[300px]"
                title={editalAtivo?.orgao}
              >
                {editalAtivo?.orgao || 'Nenhum edital selecionado — clique ao lado para escolher'}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-orange-50 text-[#ff6600] border border-orange-200">
                {mode === 'robo' ? 'Sala de Disputa & Robô' : 'Sala de Disputa'}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Modo Aberto
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs font-bold">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
              />
              <span className={isConnected ? 'text-emerald-700' : 'text-amber-700'}>
                {isConnected ? 'Ao Vivo' : 'Modo Local'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs font-mono font-bold text-[#081c3a]">
              <Clock className="h-3.5 w-3.5 text-[#ff6600]" />
              <span>{formatCronometro(cronometroSegundos)}</span>
              <button
                type="button"
                onClick={() => setCronometroAtivo(!cronometroAtivo)}
                className="text-slate-500 hover:text-[#081c3a] ml-0.5 cursor-pointer"
                title={cronometroAtivo ? 'Pausar Cronômetro' : 'Retomar Cronômetro'}
              >
                {cronometroAtivo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={portalOficialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 text-xs font-bold text-[#081c3a] transition cursor-pointer"
            >
              <span>Abrir Portal Oficial</span>
              <ExternalLink className="h-3.5 w-3.5 text-[#0070c0]" />
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff6600] hover:bg-orange-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Readequada</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-300 bg-white p-1.5 shadow-xl z-50">
                  <button
                    type="button"
                    onClick={() => void handleExportarReadequada('xlsx')}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer text-left"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p>Planilha Excel (.XLSX)</p>
                      <p className="text-[11px] text-slate-500 font-normal">Quadro de itens e lances vencedores</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleExportarReadequada('docx')}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer text-left"
                  >
                    <FileText className="h-4 w-4 text-[#0070c0]" />
                    <div>
                      <p>Documento Word (.DOCX)</p>
                      <p className="text-[11px] text-slate-500 font-normal">Modelo formal timbrado com IVA Dual</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MODAL SELETOR DE EDITAL */}
      {isEditalSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-[#ff6600]" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#081c3a]">
                  Selecionar Edital Cadastrado / Monitorado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditalSelectorOpen(false)}
                className="text-slate-400 hover:text-slate-800 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <EditalSelector
              selectedId={editalAtivo?.id}
              onSelectEdital={handleSelectEdital}
              className="border-0 p-0 shadow-none bg-transparent"
            />
          </div>
        </div>
      )}

      {/* CORPO PRINCIPAL BRANCO RÚSTICO ESTILO BLL (8 COLS PLANILHA + 4 COLS PAINEL BDI/FEED) */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1920px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 flex flex-col gap-3 min-w-0">
          {/* Barra de Estratégia e Decremento */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Estratégia:
              </span>
              <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-300">
                <button
                  type="button"
                  onClick={() => setModoEstrategia('SNIPER')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    modoEstrategia === 'SNIPER'
                      ? 'bg-[#ff6600] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-[#081c3a]'
                  }`}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  <span>Modo Sniper Final</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModoEstrategia('IMEDIATO')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    modoEstrategia === 'IMEDIATO'
                      ? 'bg-[#ff6600] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-[#081c3a]'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span>Cobertura Imediata</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Decremento:
              </span>
              <div className="flex items-center gap-1">
                {[0.5, 1.0, 5.0, 10.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setDecrementoGlobal(val);
                      setItens((prev) => prev.map((it) => ({ ...it, decremento: val })));
                    }}
                    className={`px-2 py-1 rounded text-xs font-mono font-bold transition cursor-pointer border ${
                      decrementoGlobal === val
                        ? 'bg-[#081c3a] text-white border-[#081c3a]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    -R$ {val.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleAutomacaoGlobal}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-2xs ${
                automacaoGlobalAtiva
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-[#0070c0] hover:bg-blue-700 text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{automacaoGlobalAtiva ? 'Robô Ativo em Todos' : 'Ativar Robô em Todos'}</span>
            </button>
          </div>

          {/* PLANILHA DE DISPUTA ESTILO EXCEL / BLL */}
          <div className="rounded-lg border border-slate-300 bg-white overflow-hidden flex-1 flex flex-col shadow-xs">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#081c3a] text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-slate-700">Item & Descrição</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-center">Qtd / Unid</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-right">Custo Unit. (R$)</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-right">Piso Stop-Loss</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-right">Melhor Lance</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-right">Total Item (R$)</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-center">Posição</th>
                    <th className="py-2.5 px-2 border-r border-slate-700 text-center">Robô</th>
                    <th className="py-2.5 px-3 text-right">Lance / Cobrir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-mono text-slate-800">
                  {loadingItens ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs font-sans font-semibold text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin text-[#ff6600] mx-auto mb-2" />
                        Carregando itens reais do edital...
                      </td>
                    </tr>
                  ) : itens.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs font-sans text-slate-600">
                        <p className="font-bold text-[#081c3a] mb-2">
                          Nenhum edital vinculado à Sala de Disputa ainda.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsEditalSelectorOpen(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#ff6600] hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                        >
                          <Gavel className="h-3.5 w-3.5" />
                          <span>Selecionar Edital Salvo para Disputar</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    itens.map((item, idx) => {
                      const isSelected = selectedItemIndex === idx;
                      const totalDoItem = item.melhorLanceAtual * item.quantidade;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItemIndex(idx)}
                          className={`transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/90'
                              : idx % 2 === 0
                                ? 'bg-white hover:bg-slate-50'
                                : 'bg-slate-50/60 hover:bg-slate-100/70'
                          }`}
                        >
                          {/* Item e Descrição */}
                          <td className="py-2 px-3 border-r border-slate-200 max-w-[210px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#081c3a] bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                                #{item.itemNumero}
                              </span>
                              <span className="font-sans font-bold text-slate-900 truncate" title={item.descricao}>
                                {item.descricao}
                              </span>
                            </div>
                            {item.valorUnitarioEstimado != null && (
                              <span className="text-[11px] font-sans text-slate-500 block mt-0.5">
                                Ref. PNCP: R$ {item.valorUnitarioEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>

                          {/* Quantidade e Unidade */}
                          <td className="py-2 px-2 border-r border-slate-200 text-center tabular-nums">
                            <span className="font-bold text-slate-900">{item.quantidade}</span>
                            <span className="block text-[10px] font-sans text-slate-500">{item.unidadeMedida}</span>
                          </td>

                          {/* Célula Excel: Custo Unitário Editável */}
                          <td className="py-2 px-2 border-r border-slate-200 text-right" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitCost}
                              onChange={(e) => handleAtualizarCustoItem(item.itemNumero, Number(e.target.value))}
                              className="w-24 rounded border border-slate-300 bg-white py-1 px-2 text-right text-xs font-bold text-[#081c3a] focus:border-[#0070c0] focus:ring-2 focus:ring-blue-100 outline-none"
                              title="Digite o custo unitário para recalcular Stop-Loss e Margem"
                            />
                          </td>

                          {/* Célula Excel: Piso Stop-Loss Editável */}
                          <td className="py-2 px-2 border-r border-slate-200 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col items-end gap-0.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.stopLossMinimo}
                                onChange={(e) => handleAtualizarStopLossItem(item.itemNumero, Number(e.target.value))}
                                className="w-24 rounded border border-emerald-300 bg-emerald-50/50 py-1 px-2 text-right text-xs font-bold text-emerald-800 focus:border-emerald-600 outline-none"
                                title="Piso mínimo Stop-Loss (Editável)"
                              />
                              <span className="text-[10px] font-sans text-slate-500">
                                Margem: {item.margemLiquidaCalculada.toFixed(1)}%
                              </span>
                            </div>
                          </td>

                          {/* Melhor Lance Atual */}
                          <td className="py-2 px-2 border-r border-slate-200 text-right tabular-nums">
                            <span className="font-black text-[#081c3a] text-sm">
                              R$ {item.melhorLanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {item.seuUltimoLance != null && (
                              <span className="block text-[10px] text-[#0070c0] font-sans font-bold">
                                Seu: R$ {item.seuUltimoLance.toFixed(2)}
                              </span>
                            )}
                          </td>

                          {/* Total Calculado (Qtd x Lance) estilo Excel */}
                          <td className="py-2 px-2 border-r border-slate-200 text-right tabular-nums bg-slate-50/70">
                            <span className="font-bold text-slate-900">
                              R$ {totalDoItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Posição */}
                          <td className="py-2 px-2 border-r border-slate-200 text-center">
                            {item.isLeading ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                1º Lugar
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                2º+ Lugar
                              </span>
                            )}
                          </td>

                          {/* Toggle Auto-Lance */}
                          <td className="py-2 px-2 border-r border-slate-200 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleAutoLanceItem(item.itemNumero)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                                item.autoLanceAtivo ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                              title={item.autoLanceAtivo ? 'Auto-Lance LIGADO' : 'Auto-Lance DESLIGADO'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                                  item.autoLanceAtivo ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          {/* Lance Manual / Cobrir */}
                          <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                placeholder="R$..."
                                value={item.inputManual}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setItens((prev) =>
                                    prev.map((it) => (it.itemNumero === item.itemNumero ? { ...it, inputManual: text } : it)),
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEnviarLanceItem(item.itemNumero);
                                }}
                                className="w-20 rounded border border-slate-300 bg-white py-1 px-2 text-right text-xs font-bold text-[#081c3a] outline-none focus:border-[#ff6600]"
                              />

                              <button
                                type="button"
                                onClick={() => handleCobrirItem(item.itemNumero)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[10px] font-black uppercase text-[#081c3a] transition cursor-pointer shrink-0"
                                title={`Cobrir diminuindo R$ ${item.decremento.toFixed(2)}`}
                              >
                                Cobrir
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEnviarLanceItem(item.itemNumero)}
                                className="p-1.5 rounded bg-[#ff6600] hover:bg-orange-600 text-white transition cursor-pointer shrink-0"
                                title="Enviar Lance Imediato"
                              >
                                <Radio className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {itens.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-black text-[#081c3a]">
                      <td colSpan={2} className="py-2.5 px-3 font-sans">
                        TOTAIS DA PLANILHA ({itens.length} {itens.length === 1 ? 'item' : 'itens'})
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                        R$ {totaisPlanilha.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="py-2.5 px-2 text-right font-sans text-[11px] text-slate-500">
                        Total Global dos Lances:
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[#0070c0] text-sm">
                        R$ {totaisPlanilha.totalLance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={3} className="py-2.5 px-3 text-right font-sans text-[11px] text-emerald-700">
                        Liderando: {itens.filter((i) => i.isLeading).length}/{itens.length}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        {/* ZONA 3 — PAINEL LATERAL CLARO DE PROTEÇÃO DE MARGEM & FITA AO VIVO */}
        <aside className="lg:col-span-4 flex flex-col gap-3 min-w-0">
          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#081c3a]">
                  Proteção de Margem & BDI
                </h3>
              </div>
              <span className="font-mono text-[11px] text-[#ff6600] font-bold bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                Item #{itemEmFoco?.itemNumero || 1}
              </span>
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Piso Mínimo Inviolável
                </span>
                <span className="text-xl font-mono font-black text-emerald-700">
                  R$ {bdiCalculado.pisoStopLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right font-sans">
                <span className="text-[10px] text-emerald-700 block">Trava Ativa</span>
                <span className="text-xs font-black text-emerald-800">Stop-Loss 5%</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-sans">Custo Direto (Insumos):</span>
                <span>R$ {bdiCalculado.custoDireto.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-sans">Despesas Indiretas (5%):</span>
                <span>R$ {bdiCalculado.despesas.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-sans">Split Payment (IVA Dual 11.4%):</span>
                <span className="text-amber-700">-R$ {bdiCalculado.ivaDualRetido.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-bold text-[#081c3a]">
                <span className="text-slate-600 font-sans">Margem Líquida Real:</span>
                <span className={bdiCalculado.margemReal >= 5 ? 'text-emerald-700' : 'text-red-600'}>
                  {bdiCalculado.margemReal.toFixed(1)}% (R$ {bdiCalculado.lucroLiquido.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-2xs flex-1 flex flex-col min-h-[340px]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-[#ff6600] animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#081c3a]">
                  Fita de Lances ao Vivo
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {tickerLances.length} registros
              </span>
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[420px] pr-1 font-mono text-xs">
              {tickerLances.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-sans text-xs">
                  <Clock className="h-6 w-6 mx-auto mb-1.5 text-slate-400" />
                  <p className="font-semibold text-slate-700">Aguardando lances da sessão...</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Os lances enviados aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                tickerLances.map((lance) => (
                  <div
                    key={lance.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] transition ${
                      lance.isOwnBid
                        ? 'bg-orange-50 border-orange-300 text-[#081c3a]'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-500 text-[10px] shrink-0">{lance.time}</span>
                      {lance.itemNumero !== undefined && (
                        <span className="text-[10px] font-bold text-[#ff6600] bg-white px-1.5 py-0.5 rounded border border-orange-200 shrink-0">
                          #{lance.itemNumero}
                        </span>
                      )}
                      <span className="font-sans font-bold truncate max-w-[120px]" title={lance.licitante}>
                        {lance.licitante}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-[#081c3a]">
                        R$ {lance.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};