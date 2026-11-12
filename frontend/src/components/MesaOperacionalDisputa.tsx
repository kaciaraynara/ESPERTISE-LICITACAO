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
  valorUnitarioEstimado: number | null; // Ref. PNCP
  valorTotalEstimado: number | null;
  unitCost: number; // Custo Direto (Insumos)
  despesasPercentual: number; // Padrão 5%
  margemAlvoPercentual: number; // Padrão 15%
  stopLossMinimo: number; // Piso mínimo unitário R$
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

  // Edital Ativo
  const [editalAtivo, setEditalAtivo] = useState<EditalOption | null>(null);
  const [isEditalSelectorOpen, setIsEditalSelectorOpen] = useState(false);

  // Socket & Conexão
  const [isConnected, setIsConnected] = useState(false);
  const [cronometroSegundos, setCronometroSegundos] = useState(165);
  const [cronometroAtivo, setCronometroAtivo] = useState(true);

  // Zona 2 — Grade de Itens
  const [itens, setItens] = useState<ItemDisputa[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Controles Globais do Robô
  const [modoEstrategia, setModoEstrategia] = useState<'SNIPER' | 'IMEDIATO'>('SNIPER');
  const [decrementoGlobal, setDecrementoGlobal] = useState<number>(1.0);
  const [automacaoGlobalAtiva, setAutomacaoGlobalAtiva] = useState(false);

  // Zona 3 — Fita de Lances
  const [tickerLances, setTickerLances] = useState<LiveTickerEntry[]>([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Item atualmente em foco para o painel lateral de BDI
  const itemEmFoco = useMemo(() => {
    if (itens.length === 0) return null;
    return itens[selectedItemIndex] || itens[0];
  }, [itens, selectedItemIndex]);

  // Cálculos determinísticos de BDI para o item em foco
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

    // Split Payment IVA Dual (CBS 11.3% + IBS 0.1% = 11.4%)
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

  // Cronômetro regressivo da sessão
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

  // Carrega itens reais do edital
  const carregarItensEdital = useCallback(
    async (idEdital: string, valorEstimadoFallback?: number | null) => {
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

            // Determina custo direto e piso de stop-loss
            const unitCost =
              Number(it.unitCost) > 0
                ? Number(it.unitCost)
                : valorRef
                ? Math.round(valorRef * 0.7 * 100) / 100
                : 35.0;

            const custoComDespesas = unitCost * 1.05;
            // Stop-Loss: piso com 5% de margem líquida após 11.4% de IVA Dual
            // P = Custo / (1 - 0.114 - 0.05) = Custo / 0.836
            const stopLossCalc = Number((custoComDespesas / 0.836).toFixed(2));
            const stopLossMinimo =
              precoLimiteParam > 0
                ? precoLimiteParam
                : Number(it.stopLossUnitario) > 0
                ? Number(it.stopLossUnitario)
                : stopLossCalc;

            const melhorLance = valorRef ? valorRef : Number((stopLossMinimo * 1.25).toFixed(2));

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
              margemLiquidaCalculada: 15,
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

        // Se não houver itens cadastrados na API, gera item consolidado do objeto
        if (mappedItens.length === 0) {
          const valorRef = valorEstimadoFallback && valorEstimadoFallback > 0 ? valorEstimadoFallback : null;
          const unitCost = valorRef ? Math.round(valorRef * 0.72 * 100) / 100 : 45.0;
          const stopLossMinimo = precoLimiteParam > 0 ? precoLimiteParam : Number((unitCost * 1.05 / 0.836).toFixed(2));
          const melhorLance = valorRef ? valorRef : Number((stopLossMinimo * 1.2).toFixed(2));

          mappedItens = [
            {
              id: `item-1-geral`,
              itemNumero: 1,
              descricao: editalAtivo?.objeto || 'Item Geral do Certame (Conforme Termo de Referência do Edital)',
              quantidade: 1,
              unidadeMedida: 'UN/LOTE',
              valorUnitarioEstimado: valorRef,
              valorTotalEstimado: valorRef,
              unitCost,
              despesasPercentual: 5,
              margemAlvoPercentual: 15,
              stopLossMinimo,
              margemLiquidaCalculada: 14.8,
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

  // Inicializa o edital com base na URL ou padrão
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
            void carregarItensEdital(editalOpt.id, editalOpt.valorEstimado);
            return;
          }
        }

        // Fallback inicial se não houver edital na URL
        if (isMounted) {
          const fallbackEdital: EditalOption = {
            id: 'PREGAO-2026-0842',
            numeroEdital: 'Pregão Eletrônico nº 042/2026',
            numeroControlePNCP: '07598634000137-1-000042/2026',
            orgao: 'Prefeitura Municipal de Sobral',
            modalidade: 'Pregão Eletrônico (Modo Aberto)',
            objeto: 'Aquisição de suprimentos e materiais com entrega parcelada conforme TR.',
            valorEstimado: precoLimiteParam ? precoLimiteParam * 1.25 : 185000,
            urlOficialPncp: 'https://pncp.gov.br/app/editais',
            fonte: 'salvo',
          };
          setEditalAtivo(fallbackEdital);
          void carregarItensEdital(fallbackEdital.id, fallbackEdital.valorEstimado);
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

  // Conexão WebSocket em Tempo Real
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

    // Confirmação de lance próprio
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
              margemLiquidaCalculada: bid.margemLiquida,
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

    // Lance de concorrente no mercado
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
            };

            // SE O ROBÔ ESTIVER ATIVO NESTE ITEM: Cobertura Automática Determinística
            if (item.autoLanceAtivo && wasLeading) {
              const stopLoss = item.stopLossMinimo;
              const decremento = item.decremento;
              const menorLance = remoteBid.bid_amount;

              // REGRA DE OURO: Bloqueio 403 Stop-Loss se o mercado já rompeu o piso
              if (menorLance <= stopLoss) {
                toast.error(
                  `[STOP-LOSS] Mercado rompeu seu piso (R$ ${stopLoss.toFixed(2)}). Cobertura automática cancelada no Item #${item.itemNumero}.`,
                );
                return { ...updatedItem, autoLanceAtivo: false };
              }

              // Fórmula Determinística: novoLance = Math.max(stopLossMinimo, menorLanceConcorrente - decrementoMinimo)
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

    // Erro de Stop-Loss emitido pelo backend
    socket.on('bid_error', (err: SocketBidError) => {
      toast.error(err.message || 'Bloqueio de segurança 403 Stop-Loss acionado.');
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

  // Seleção de novo edital pelo seletor
  const handleSelectEdital = (edital: EditalOption) => {
    setEditalAtivo(edital);
    setSearchParams({ id: edital.id });
    setIsEditalSelectorOpen(false);
    void carregarItensEdital(edital.id, edital.valorEstimado);
  };

  // Disparo manual de lance por item
  const handleEnviarLanceItem = (itemNumero: number, valorParam?: number) => {
    const item = itens.find((it) => it.itemNumero === itemNumero);
    if (!item) return;

    const valor = valorParam !== undefined ? valorParam : Number(item.inputManual.replace(',', '.'));

    if (!valor || valor <= 0) {
      toast.error('Informe um valor de lance válido.');
      return;
    }

    // Validação estrita do Stop-Loss no frontend
    if (valor < item.stopLossMinimo) {
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
      // Fallback local caso offline
      setItens((prev) =>
        prev.map((it) =>
          it.itemNumero === itemNumero
            ? {
                ...it,
                melhorLanceAtual: valor,
                seuUltimoLance: valor,
                isLeading: true,
                posicao: 1,
                inputManual: '',
              }
            : it,
        ),
      );
      toast.success(`Lance de R$ ${valor.toFixed(2)} registrado localmente.`);
    }

    // Limpa o input do item
    setItens((prev) =>
      prev.map((it) => (it.itemNumero === itemNumero ? { ...it, inputManual: '' } : it)),
    );
  };

  // Botão Rápido "Cobrir (-R$)"
  const handleCobrirItem = (itemNumero: number) => {
    const item = itens.find((it) => it.itemNumero === itemNumero);
    if (!item) return;

    const base = item.melhorLanceAtual || item.valorUnitarioEstimado || item.stopLossMinimo * 1.25;
    const novoValor = Number(Math.max(item.stopLossMinimo, base - item.decremento).toFixed(2));

    if (novoValor < item.stopLossMinimo) {
      toast.error(`Piso de Stop-Loss atingido (R$ ${item.stopLossMinimo.toFixed(2)}). Não é possível cobrir.`);
      return;
    }

    handleEnviarLanceItem(itemNumero, novoValor);
  };

  // Toggle do Auto-Lance por item
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

  // Toggle Global do Robô para todos os itens
  const handleToggleAutomacaoGlobal = () => {
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
        valorInicial: itens[0]?.melhorLanceAtual || 1000,
        lanceMinimoPermitido: itens[0]?.stopLossMinimo || 500,
        decrementoMinimo: decrementoGlobal,
        estrategia: modoEstrategia === 'SNIPER' ? 'sniper' : 'agressivo',
      });
    } else {
      toast('Automação do Robô pausada em todos os itens.');
      socketRef.current?.emit('pausar_robo');
    }
  };

  // Exportação da Proposta Readequada (.DOCX / .XLSX)
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
      // Fallback determinístico no client para garantir entrega imediata
      try {
        const rows = [
          ['Item', 'Descrição', 'Qtd', 'Unidade', 'Valor Ref. (PNCP)', 'Lance Vencedor (R$)', 'Valor Total (R$)', 'Status'],
          ...itens.map((it) => [
            String(it.itemNumero),
            `"${it.descricao.replace(/"/g, '""')}"`,
            String(it.quantidade),
            it.unidadeMedida,
            it.valorUnitarioEstimado ? it.valorUnitarioEstimado.toFixed(2) : 'Sigiloso',
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

        toast.success(`Quadro de proposta readequada exportado com sucesso!`, { id: toastId });
      } catch {
        toast.error('Erro ao gerar arquivo de exportação.', { id: toastId });
      }
    }
  };

  const portalOficialUrl = useMemo(() => {
    return (
      editalAtivo?.urlOficialPncp ||
      portalParam ||
      `https://pncp.gov.br/app/editais`
    );
  }, [editalAtivo, portalParam]);

  return (
    <div className="w-full bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col">
      {/* =====================================================================
          ZONA 1 — BARRA SUPERIOR DE COMANDO DO CERTAME (COMPACTA EM 1 LINHA)
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 py-2 sm:px-5 sm:py-2.5 shadow-md">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 max-w-[1920px] mx-auto">
          {/* Seletor do Edital + Órgão + Modalidade */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Botão Seletor de Edital */}
            <button
              type="button"
              onClick={() => setIsEditalSelectorOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700/90 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-white transition cursor-pointer shadow-xs shrink-0"
              title="Trocar Edital / Licitacao Ativa"
            >
              <Gavel className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-mono text-[11px] text-orange-300">
                {editalAtivo?.numeroEdital || 'Selecionar Edital'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {/* Nome do Órgão */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0 hidden sm:block" />
              <span className="text-xs font-bold text-slate-200 truncate max-w-[200px] sm:max-w-[280px]" title={editalAtivo?.orgao}>
                {editalAtivo?.orgao || 'Carregando Órgão...'}
              </span>
            </div>

            {/* Modalidade / Modo de Disputa */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-950/80 text-orange-300 border border-orange-800/60">
                {mode === 'robo' ? 'Robô de Lances' : 'Mesa de Disputa'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-800/60">
                Pregão Eletrônico
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                Modo Aberto
              </span>
            </div>
          </div>

          {/* Centro: Indicador de Conexão + Cronômetro da Sessão */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Conexão em Tempo Real */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-[11px] font-bold">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className={isConnected ? 'text-emerald-300' : 'text-amber-300'}>
                {isConnected ? 'Ao Vivo (Socket)' : 'Conectando'}
              </span>
            </div>

            {/* Cronômetro da Sessão */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-xs font-mono font-bold text-amber-300">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>{formatCronometro(cronometroSegundos)}</span>
              <button
                type="button"
                onClick={() => setCronometroAtivo(!cronometroAtivo)}
                className="text-slate-400 hover:text-white ml-0.5 cursor-pointer"
                title={cronometroAtivo ? 'Pausar Cronômetro' : 'Retomar Cronômetro'}
              >
                {cronometroAtivo ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Botões Diretos: Abrir Portal Oficial ↗ + Exportar Proposta Readequada */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={portalOficialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer"
            >
              <span>Abrir Portal Oficial</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>

            {/* Menu Dropdown de Exportar Proposta Readequada */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition shadow-sm cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Readequada</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl z-50">
                  <button
                    type="button"
                    onClick={() => void handleExportarReadequada('xlsx')}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition cursor-pointer text-left"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p>Planilha Excel (.XLSX)</p>
                      <p className="text-[10px] text-slate-400 font-normal">Quadro de itens e lances vencedores</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleExportarReadequada('docx')}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition cursor-pointer text-left"
                  >
                    <FileText className="h-4 w-4 text-blue-400" />
                    <div>
                      <p>Documento Word (.DOCX)</p>
                      <p className="text-[10px] text-slate-400 font-normal">Modelo formal timbrado com IVA Dual</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MODAL SELETOR DE EDITAL
          ===================================================================== */}
      {isEditalSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-orange-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Selecionar Edital Cadastrado / Monitorado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditalSelectorOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
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

      {/* =====================================================================
          CORPO PRINCIPAL (2 COLUNAS: 8 COLS GRADE DE ITENS + 4 COLS BDI/FEED)
          ===================================================================== */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1920px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ===================================================================
            ZONA 2 — GRADE OPERACIONAL DE ITENS (8 COLUNAS)
            =================================================================== */}
        <section className="lg:col-span-8 flex flex-col gap-3 min-w-0">
          {/* Barra de Controle Global do Robô no Topo */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5">
            {/* Modos do Robô */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Estratégia:
              </span>
              <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setModoEstrategia('SNIPER')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black transition cursor-pointer ${
                    modoEstrategia === 'SNIPER'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Crosshair className="h-3 w-3" />
                  <span>Modo Sniper Final</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModoEstrategia('IMEDIATO')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black transition cursor-pointer ${
                    modoEstrategia === 'IMEDIATO'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingDown className="h-3 w-3" />
                  <span>Cobertura Imediata</span>
                </button>
              </div>
            </div>

            {/* Decremento Padrão Global */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Decremento Padrão:
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
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer border ${
                      decrementoGlobal === val
                        ? 'bg-slate-800 text-orange-400 border-orange-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    -R$ {val.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>

            {/* Botão Mestre: Ativar / Pausar Todos os Itens */}
            <button
              type="button"
              onClick={handleToggleAutomacaoGlobal}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs ${
                automacaoGlobalAtiva
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{automacaoGlobalAtiva ? 'Robô Ativo em Todos' : 'Ativar Robô em Todos'}</span>
            </button>
          </div>

          {/* Tabela Limpa e Densa (tabular-nums) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Item # & Descrição</th>
                    <th className="py-2.5 px-2 text-right">Valor Ref. (PNCP)</th>
                    <th className="py-2.5 px-2 text-right">Melhor Lance (1º Lugar)</th>
                    <th className="py-2.5 px-2 text-center">Posição</th>
                    <th className="py-2.5 px-2 text-right">Piso Stop-Loss</th>
                    <th className="py-2.5 px-2 text-center">Decremento</th>
                    <th className="py-2.5 px-2 text-center">Auto-Lance</th>
                    <th className="py-2.5 px-3 text-right">Ação Rápida (1 Clique)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loadingItens ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs font-semibold text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin text-orange-500 mx-auto mb-2" />
                        Carregando itens reais do edital...
                      </td>
                    </tr>
                  ) : itens.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                        Nenhum item localizado para este edital.
                      </td>
                    </tr>
                  ) : (
                    itens.map((item, idx) => {
                      const isSelected = selectedItemIndex === idx;
                      const hasRef = item.valorUnitarioEstimado != null && item.valorUnitarioEstimado > 0;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItemIndex(idx)}
                          className={`transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-950/40 ring-1 ring-blue-500/40'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Coluna 1: Item # e Descrição */}
                          <td className="py-2.5 px-3 max-w-[220px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-orange-400 bg-orange-950/70 border border-orange-800/60 px-1.5 py-0.5 rounded text-[10px]">
                                #{item.itemNumero}
                              </span>
                              <span className="font-sans font-bold text-slate-200 truncate" title={item.descricao}>
                                {item.descricao}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                              Qtd: <strong className="text-slate-300">{item.quantidade}</strong> {item.unidadeMedida}
                            </span>
                          </td>

                          {/* Coluna 2: Valor Ref. Unitário (PNCP) - NO_DATA != ZERO */}
                          <td className="py-2.5 px-2 text-right tabular-nums">
                            {hasRef ? (
                              <span className="font-bold text-slate-300">
                                R$ {item.valorUnitarioEstimado!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-[10px] font-sans text-amber-400/90 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/40">
                                Sigiloso / Ver no TR
                              </span>
                            )}
                          </td>

                          {/* Coluna 3: Melhor Lance Atual */}
                          <td className="py-2.5 px-2 text-right tabular-nums">
                            <span className="font-black text-white text-sm">
                              R$ {item.melhorLanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {item.seuUltimoLance && (
                              <span className="block text-[10px] text-slate-400">
                                Seu: R$ {item.seuUltimoLance.toFixed(2)}
                              </span>
                            )}
                          </td>

                          {/* Coluna 4: Posição */}
                          <td className="py-2.5 px-2 text-center">
                            {item.isLeading ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-700/60">
                                <CheckCircle2 className="h-3 w-3" />
                                1º Lugar
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/60">
                                2º+ Lugar
                              </span>
                            )}
                          </td>

                          {/* Coluna 5: Piso Stop-Loss & Margem Líquida */}
                          <td className="py-2.5 px-2 text-right tabular-nums">
                            <span className="font-bold text-emerald-400 flex items-center justify-end gap-1">
                              <Shield className="h-3 w-3 text-emerald-500 shrink-0" />
                              R$ {item.stopLossMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-sans">
                              Margem: {item.margemLiquidaCalculada.toFixed(1)}%
                            </span>
                          </td>

                          {/* Coluna 6: Decremento Configurável */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              step="0.5"
                              value={item.decremento}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0.5;
                                setItens((prev) =>
                                  prev.map((it) => (it.itemNumero === item.itemNumero ? { ...it, decremento: val } : it)),
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-16 rounded bg-slate-950 border border-slate-700 py-1 px-1.5 text-center text-xs font-bold text-white outline-none focus:border-orange-500"
                            />
                          </td>

                          {/* Coluna 7: Chave Automática (Auto-Lance ON/OFF) */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAutoLanceItem(item.itemNumero);
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                item.autoLanceAtivo ? 'bg-emerald-500' : 'bg-slate-800'
                              }`}
                              title={item.autoLanceAtivo ? 'Auto-Lance LIGADO' : 'Auto-Lance DESLIGADO'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  item.autoLanceAtivo ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          {/* Coluna 8: Ação Rápida (1 Clique) */}
                          <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
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
                                className="w-20 rounded bg-slate-950 border border-slate-700 py-1 px-2 text-right text-xs font-bold text-white outline-none focus:border-orange-500"
                              />

                              <button
                                type="button"
                                onClick={() => handleCobrirItem(item.itemNumero)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-black uppercase text-orange-400 transition cursor-pointer shrink-0"
                                title={`Cobrir diminuindo R$ ${item.decremento.toFixed(2)}`}
                              >
                                Cobrir
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEnviarLanceItem(item.itemNumero)}
                                className="p-1 rounded bg-orange-600 hover:bg-orange-500 text-white transition cursor-pointer shrink-0"
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
              </table>
            </div>

            {/* Rodapé da Grade de Itens */}
            <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                Total de Itens: <strong className="text-white">{itens.length}</strong> | Itens Liderando:{' '}
                <strong className="text-emerald-400">{itens.filter((i) => i.isLeading).length}</strong>
              </span>
              <span className="text-[11px]">
                Clique em qualquer linha para auditar os parâmetros de BDI e tributos ao lado.
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================================
            ZONA 3 — PAINEL LATERAL DE PROTEÇÃO DE MARGEM & FEED (4 COLUNAS)
            =================================================================== */}
        <aside className="lg:col-span-4 flex flex-col gap-3 min-w-0">
          {/* Card Compacto de Parâmetros de Custo & Trava Stop-Loss */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Proteção de Margem & BDI
                </h3>
              </div>
              <span className="font-mono text-[10px] text-orange-400 font-bold bg-orange-950/60 border border-orange-800/60 px-1.5 py-0.5 rounded">
                Item #{itemEmFoco?.itemNumero || 1}
              </span>
            </div>

            {/* Destaque do Piso Inviolável Stop-Loss */}
            <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Piso Mínimo Inviolável
                </span>
                <span className="text-xl font-mono font-black text-emerald-300">
                  R$ {bdiCalculado.pisoStopLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right font-sans">
                <span className="text-[10px] text-emerald-400/80 block">Trava Ativa</span>
                <span className="text-xs font-black text-emerald-300">Stop-Loss 5%</span>
              </div>
            </div>

            {/* Quadro de Decomposição Financeira (Compacto e Direto) */}
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 font-sans">Custo Direto (Insumos):</span>
                <span>R$ {bdiCalculado.custoDireto.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 font-sans">Despesas Indiretas (5%):</span>
                <span>R$ {bdiCalculado.despesas.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 font-sans">Split Payment (IVA Dual 11.4%):</span>
                <span className="text-amber-400">-R$ {bdiCalculado.ivaDualRetido.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 font-bold text-white">
                <span className="text-slate-400 font-sans">Margem Líquida Real:</span>
                <span className={bdiCalculado.margemReal >= 5 ? 'text-emerald-400' : 'text-red-400'}>
                  {bdiCalculado.margemReal.toFixed(1)}% (R$ {bdiCalculado.lucroLiquido.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          {/* Fita de Lances em Tempo Real (Live Ticker) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm flex-1 flex flex-col min-h-[340px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-orange-400 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Fita de Lances ao Vivo
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {tickerLances.length} registros
              </span>
            </div>

            {/* Lista Cronológica Enxuta */}
            <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[420px] pr-1 font-mono text-xs">
              {tickerLances.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-sans text-xs">
                  <Clock className="h-6 w-6 mx-auto mb-1.5 text-slate-600" />
                  <p>Aguardando lances da sessão...</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Os movimentos de todos os participantes aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                tickerLances.map((lance) => (
                  <div
                    key={lance.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] transition ${
                      lance.isOwnBid
                        ? 'bg-orange-950/40 border-orange-700/60 text-orange-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-500 text-[10px] shrink-0">{lance.time}</span>
                      {lance.itemNumero !== undefined && (
                        <span className="text-[9px] font-bold text-orange-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-800 shrink-0">
                          #{lance.itemNumero}
                        </span>
                      )}
                      <span className="font-sans font-bold truncate max-w-[110px]" title={lance.licitante}>
                        {lance.licitante}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-white">
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

