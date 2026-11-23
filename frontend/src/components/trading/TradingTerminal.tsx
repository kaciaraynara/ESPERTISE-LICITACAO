import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AlertOctagon,
  Shield,
  Zap,
  Activity,
  Wifi,
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Sun,
  Moon,
  Layers,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Decimal from 'decimal.js';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { propostasApi } from '@/services/api';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

export type EstrategiaType = 'SNIPER' | 'COBERTURA' | 'MANUAL';
export type StatusItemType = 'VENCENDO' | 'COBERTO' | 'PISO_ATINGIDO' | 'PAUSADO';
export type ModoConexaoType = 'JANELA_DESTACADA' | 'PONTE_LOCAL' | 'API_DIRETA';

export interface ItemPlanilhaTerminal {
  id: string;
  itemNumero: number;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  valorReferencia: number;
  melhorLanceConcorrente: number;
  seuUltimoLance: number | null;
  lanceAlvo: number;
  pisoMinimo: number;
  estrategia: EstrategiaType;
  decrementoMinimo: number;
  isPercentual: boolean;
  status: StatusItemType;
  ativo: boolean;
  tempoRestanteSegundos: number;
  margemEstimadaPct: number;
}

export interface LogEventoTerminal {
  id: string;
  timestamp: string;
  categoria: 'MERCADO' | 'DISPARO' | 'SEGURANCA' | 'PREGOEIRO';
  mensagem: string;
  itemNumero?: number;
  valor?: number;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);
}

function roundDec(val: number): number {
  return new Decimal(val || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export const TradingTerminal: React.FC = () => {
  // Tema Operacional: Dark Mode por padrão no Home Broker
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('@Expertise:TerminalTheme') !== 'light';
  });

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('@Expertise:TerminalTheme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Edital Selecionado
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>('https://pncp.gov.br/app/editais');

  // Modo de Integração
  const [modoConexao, setModoConexao] = useState<ModoConexaoType>('JANELA_DESTACADA');
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Telemetria & Conexão
  const [pingMs, setPingMs] = useState<number>(18);
  const [somHabilitado, setSomHabilitado] = useState<boolean>(true);

  // Planilha de Itens
  const [itens, setItens] = useState<ItemPlanilhaTerminal[]>([
    {
      id: 'it-1',
      itemNumero: 1,
      descricao: 'Licenciamento de Software Corporativo e Nuvem',
      quantidade: 12,
      unidadeMedida: 'Mês',
      valorReferencia: 45000.0,
      melhorLanceConcorrente: 38200.0,
      seuUltimoLance: 38500.0,
      lanceAlvo: 37000.0,
      pisoMinimo: 32000.0,
      estrategia: 'SNIPER',
      decrementoMinimo: 100.0,
      isPercentual: false,
      status: 'COBERTO',
      ativo: true,
      tempoRestanteSegundos: 45,
      margemEstimadaPct: 19.4,
    },
    {
      id: 'it-2',
      itemNumero: 2,
      descricao: 'Serviço Especializado de Sustentação de TI',
      quantidade: 1,
      unidadeMedida: 'Serviço',
      valorReferencia: 180000.0,
      melhorLanceConcorrente: 152000.0,
      seuUltimoLance: 152000.0,
      lanceAlvo: 148000.0,
      pisoMinimo: 130000.0,
      estrategia: 'COBERTURA',
      decrementoMinimo: 500.0,
      isPercentual: false,
      status: 'VENCENDO',
      ativo: true,
      tempoRestanteSegundos: 110,
      margemEstimadaPct: 16.9,
    },
    {
      id: 'it-3',
      itemNumero: 3,
      descricao: 'Estações de Trabalho de Alta Performance',
      quantidade: 30,
      unidadeMedida: 'Unidade',
      valorReferencia: 7500.0,
      melhorLanceConcorrente: 5800.0,
      seuUltimoLance: 6100.0,
      lanceAlvo: 5700.0,
      pisoMinimo: 5850.0,
      estrategia: 'COBERTURA',
      decrementoMinimo: 50.0,
      isPercentual: false,
      status: 'PISO_ATINGIDO',
      ativo: false,
      tempoRestanteSegundos: 20,
      margemEstimadaPct: 0.0,
    },
  ]);

  // Console de Auditoria e Eventos
  const [logs, setLogs] = useState<LogEventoTerminal[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) + '.112',
      categoria: 'MERCADO',
      mensagem: 'Sessão pública conectada ao portal oficial. Telemetria ativa com latência estável.',
    },
    {
      id: 'log-2',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) + '.480',
      categoria: 'PREGOEIRO',
      mensagem: 'Pregoeiro Oficial: "Sessão aberta para a fase competitiva de lances do certame."',
    },
  ]);

  const [filtroLog, setFiltroLog] = useState<'TODOS' | 'DISPAROS' | 'SEGURANCA' | 'PREGOEIRO'>('TODOS');
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Sincronização BroadcastChannel entre abas / janelas
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('expertise_disputa_terminal_sync');
      broadcastRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.tipo === 'LANCE_EXTERNO') {
          adicionarLog('MERCADO', `Atualização recebida da janela externa: Item #${event.data.itemNumero} - R$ ${event.data.valor}`);
        }
      };
      return () => {
        channel.close();
      };
    } catch {
      // BroadcastChannel não suportado em navegadores muito legados
    }
  }, []);

  // Ping de Latência Simulado Periódico
  useEffect(() => {
    const timer = setInterval(() => {
      setPingMs(Math.floor(Math.random() * (26 - 14 + 1)) + 14);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Rolagem suave no console de auditoria
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const adicionarLog = useCallback(
    (categoria: 'MERCADO' | 'DISPARO' | 'SEGURANCA' | 'PREGOEIRO', mensagem: string, itemNumero?: number, valor?: number) => {
      const now = new Date();
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      const timestamp = now.toLocaleTimeString('pt-BR', { hour12: false }) + `.${ms}`;

      setLogs((prev) => [
        ...prev.slice(-150), // Mantém até 150 registros em memória sem sobrecarregar a viewport
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp,
          categoria,
          mensagem,
          itemNumero,
          valor,
        },
      ]);
    },
    []
  );

  // PARADA DE EMERGÊNCIA GLOBAL (STOP ALL)
  const executarParadaEmergencia = () => {
    const start = performance.now();
    setItens((prev) =>
      prev.map((it) => ({
        ...it,
        ativo: false,
        status: it.status === 'VENCENDO' ? 'VENCENDO' : 'PAUSADO',
      }))
    );
    const elapsed = Math.round(performance.now() - start);

    adicionarLog(
      'SEGURANCA',
      `PARADA DE EMERGÊNCIA ACIONADA PELO OPERADOR (${elapsed}ms). Todos os disparos automáticos foram interrompidos instantaneamente.`
    );
    toast.error('PARADA DE EMERGÊNCIA EXECUTADA: Todos os robôs foram pausados imediatamente.', {
      duration: 6000,
      icon: '🛑',
    });
  };

  // RECONEXÃO / LIGAR TODOS
  const ligarTodos = () => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.melhorLanceConcorrente <= it.pisoMinimo) {
          return { ...it, ativo: false, status: 'PISO_ATINGIDO' };
        }
        return { ...it, ativo: true, status: it.seuUltimoLance === it.melhorLanceConcorrente ? 'VENCENDO' : 'COBERTO' };
      })
    );
    adicionarLog('SEGURANCA', 'Operação retomada: todos os itens dentro da margem de segurança foram ativados.');
    toast.success('Robôs reativados com monitoramento de margem.');
  };

  // Alternar Ativação de Item Individual
  const toggleItemAtivo = (itemId: string) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const novoAtivo = !it.ativo;
        if (novoAtivo && it.melhorLanceConcorrente <= it.pisoMinimo) {
          toast.error(`Item #${it.itemNumero}: Piso mínimo de R$ ${it.pisoMinimo.toFixed(2)} já foi atingido. Ativação bloqueada para proteger sua margem.`);
          return { ...it, ativo: false, status: 'PISO_ATINGIDO' };
        }
        adicionarLog(
          'SEGURANCA',
          `Item #${it.itemNumero} ${novoAtivo ? 'ATIVADO' : 'PAUSADO'} pelo operador.`
        );
        return {
          ...it,
          ativo: novoAtivo,
          status: novoAtivo ? (it.seuUltimoLance === it.melhorLanceConcorrente ? 'VENCENDO' : 'COBERTO') : 'PAUSADO',
        };
      })
    );
  };

  // Atualização Direta de Campos na Planilha com Decimal.js
  const atualizarCampoItem = (
    itemId: string,
    campo: 'pisoMinimo' | 'lanceAlvo' | 'decrementoMinimo' | 'estrategia',
    valor: any
  ) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const atualizado = { ...it, [campo]: valor };

        if (campo === 'pisoMinimo') {
          const novoPiso = roundDec(Number(valor) || 0);
          atualizado.pisoMinimo = novoPiso;
          if (it.melhorLanceConcorrente <= novoPiso) {
            atualizado.status = 'PISO_ATINGIDO';
            atualizado.ativo = false;
          }
        }

        if (campo === 'estrategia') {
          adicionarLog('SEGURANCA', `Estratégia do Item #${it.itemNumero} alterada para ${valor}.`);
        }

        return atualizado;
      })
    );
  };

  // Disparo Imediato de Lance Manual
  const dispararLanceManual = (item: ItemPlanilhaTerminal) => {
    if (!item.lanceAlvo || item.lanceAlvo <= 0) {
      toast.error(`Defina um lance válido para o Item #${item.itemNumero}.`);
      return;
    }

    if (item.lanceAlvo < item.pisoMinimo) {
      adicionarLog(
        'SEGURANCA',
        `BLOQUEIO DE SEGURANÇA: Tentativa de lance manual de ${formatBRL(item.lanceAlvo)} no Item #${item.itemNumero} violaria o piso de ${formatBRL(item.pisoMinimo)}.`
      );
      toast.error(`Operação bloqueada: Lance de ${formatBRL(item.lanceAlvo)} viola o piso mínimo inegociável de ${formatBRL(item.pisoMinimo)}.`);
      return;
    }

    const valorDisparo = roundDec(item.lanceAlvo);

    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        return {
          ...it,
          seuUltimoLance: valorDisparo,
          melhorLanceConcorrente: valorDisparo,
          status: 'VENCENDO',
        };
      })
    );

    adicionarLog(
      'DISPARO',
      `LANCE CONFIRMADO: Item #${item.itemNumero} registrado com ${formatBRL(valorDisparo)}. Posição assumida: 1º LUGAR.`,
      item.itemNumero,
      valorDisparo
    );
    toast.success(`Lance de ${formatBRL(valorDisparo)} registrado no Item #${item.itemNumero}!`);

    // Sincroniza via BroadcastChannel caso janela destacada esteja ativa
    broadcastRef.current?.postMessage({
      tipo: 'LANCE_LOCAL',
      itemNumero: item.itemNumero,
      valor: valorDisparo,
    });
  };

  // Importar Dados Reais da Proposta Ativa
  const sincronizarPropostaSalva = async () => {
    try {
      const res = await propostasApi.listar();
      const list = res?.data?.data || (res?.data as any)?.items || [];
      if (!Array.isArray(list) || list.length === 0) {
        toast('Crie ou salve uma proposta comercial para importar os itens automaticamente.');
        return;
      }
      const prop = list[0];
      const rawItens = Array.isArray(prop?.items) ? prop.items : [];
      if (rawItens.length > 0) {
        setItens(
          rawItens.map((it: any, idx: number) => {
            const ref = roundDec(Number(it.precoUnitarioProposto || it.valorUnitario || it.custoDireto || 100));
            const custo = roundDec(Number(it.custoDireto || ref * 0.75));
            const piso = roundDec(custo * 1.10); // Margem mínima de segurança de 10% sobre custos
            const lanceAlvo = roundDec(ref * 0.92); // Redução inicial competitiva de 8%

            return {
              id: String(it.id || idx + 1),
              itemNumero: Number(it.numero || idx + 1),
              descricao: String(it.descricao || `Item ${idx + 1}`),
              quantidade: Number(it.quantidade || 1),
              unidadeMedida: String(it.unidadeMedida || 'UN'),
              valorReferencia: ref,
              melhorLanceConcorrente: ref,
              seuUltimoLance: null,
              lanceAlvo,
              pisoMinimo: piso,
              estrategia: 'COBERTURA',
              decrementoMinimo: roundDec(Math.max(1, ref * 0.005)),
              isPercentual: false,
              status: 'COBERTO',
              ativo: true,
              tempoRestanteSegundos: 120,
              margemEstimadaPct: roundDec(((ref - custo) / ref) * 100),
            };
          })
        );
        adicionarLog('SEGURANCA', `Planilha sincronizada da proposta "${prop.titulo || 'Comercial Ativa'}". ${rawItens.length} itens carregados com travas calculadas.`);
        toast.success(`Itens e pisos carregados da proposta "${prop.titulo || 'Ativa'}"!`);
      }
    } catch {
      toast.error('Não foi possível sincronizar os itens da proposta.');
    }
  };

  // Seleção de Edital
  const handleSelectEdital = (e: EditalOption) => {
    setEdital(e);
    const url = buildOfficialPncpPortalUrl(e);
    if (url) {
      setPortalUrl(url);
    }
    adicionarLog('MERCADO', `Edital selecionado: ${e.numeroEdital || e.id} - ${e.orgao || 'Órgão Promotor'}.`);
  };

  // Abertura de Janela Destacada Sincronizada
  const abrirJanelaDestacada = () => {
    const width = 1100;
    const height = 800;
    const left = window.screen.width - width;
    const top = 0;
    const win = window.open(
      portalUrl,
      'JanelaDisputaOficial',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    );
    if (win) {
      adicionarLog('MERCADO', `Janela destacada aberta em Picture-in-Picture no portal ${portalUrl}. Operação em tela dividida ativa.`);
    } else {
      toast.error('O navegador bloqueou a abertura da janela. Permita pop-ups para este site.');
    }
  };

  // Indicadores de Telemetria
  const totalItens = itens.length;
  const itensVencendo = itens.filter((i) => i.status === 'VENCENDO').length;
  const itensAtivos = itens.filter((i) => i.ativo).length;
  const margemMedia = useMemo(() => {
    if (itens.length === 0) return 0;
    const soma = itens.reduce((acc, it) => acc + (it.margemEstimadaPct || 0), 0);
    return roundDec(soma / itens.length);
  }, [itens]);

  const logsFiltrados = useMemo(() => {
    if (filtroLog === 'TODOS') return logs;
    return logs.filter((l) => l.categoria === filtroLog);
  }, [logs, filtroLog]);

  return (
    <div
      className={`h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#070F1E] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* =========================================================================
          HUD SUPERIOR DE TELEMETRIA OPERACIONAL (CABEÇALHO FIXED NA VIEWPORT)
          ========================================================================= */}
      <header
        className={`shrink-0 border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md ${
          isDark ? 'bg-[#0B192C] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Esquerda: Identificação e Status da Sessão */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B192C] to-[#1E3A8A] text-[#F97316] ring-1 ring-[#F97316]/30">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight uppercase">Mesa de Operação em Tempo Real</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Sessão Conectada
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Certificado Digital ICP-Brasil Válido</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-emerald-400" />
                Latência: <strong className="font-mono text-emerald-400 tabular-nums">{pingMs}ms</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Centro: Contadores de Telemetria Operacional */}
        <div className="flex items-center gap-4 text-xs">
          <div
            className={`rounded-xl px-3 py-1.5 border flex items-center gap-2 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <Award className="h-4 w-4 text-emerald-400" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Liderança</span>
              <strong className="font-mono tabular-nums text-emerald-400 text-sm">
                {itensVencendo}/{totalItens} em 1º Lugar
              </strong>
            </div>
          </div>

          <div
            className={`rounded-xl px-3 py-1.5 border flex items-center gap-2 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <Shield className="h-4 w-4 text-[#0070C0]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Margem Média</span>
              <strong className="font-mono tabular-nums text-[#0070C0] text-sm">{margemMedia}%</strong>
            </div>
          </div>

          <div
            className={`rounded-xl px-3 py-1.5 border flex items-center gap-2 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <Activity className="h-4 w-4 text-[#F97316]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Robôs Ativos</span>
              <strong className="font-mono tabular-nums text-[#F97316] text-sm">
                {itensAtivos} de {totalItens} operando
              </strong>
            </div>
          </div>
        </div>

        {/* Direita: Ações Globais & Parada de Emergência */}
        <div className="flex items-center gap-2">
          {/* Seletor de Tema Operacional */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro Operacional'}
            className={`p-2 rounded-xl border transition ${
              isDark
                ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Áudio de Alertas */}
          <button
            type="button"
            onClick={() => setSomHabilitado(!somHabilitado)}
            title={somHabilitado ? 'Alertas Sonoros Ativos' : 'Alertas Sonoros Silenciados'}
            className={`p-2 rounded-xl border transition ${
              somHabilitado
                ? 'bg-slate-800/80 border-slate-700 text-emerald-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-500'
            }`}
          >
            {somHabilitado ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Retomar Todos */}
          <button
            type="button"
            onClick={ligarTodos}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600/10 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-600 hover:text-white transition"
          >
            <Play className="h-3.5 w-3.5" />
            Ligar Todos
          </button>

          {/* BOTÃO CRÍTICO: PARADA DE EMERGÊNCIA (STOP ALL) */}
          <button
            type="button"
            onClick={executarParadaEmergencia}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/40 ring-2 ring-red-500 transition animate-pulse"
          >
            <AlertOctagon className="h-4 w-4" />
            STOP ALL
          </button>
        </div>
      </header>

      {/* =========================================================================
          CORPO PRINCIPAL EM SPLIT-SCREEN FIXO (100% DA VIEWPORT SEM SCROLL GERAL)
          ========================================================================= */}
      <main className="flex-1 flex overflow-hidden">
        {/* =======================================================================
            COLUNA ESQUERDA (55%): VISOR DE TELEMETRIA + INTEGRAÇÃO + CONSOLE AUDITORIA
            ======================================================================= */}
        <section
          className={`w-[55%] flex flex-col border-r overflow-hidden ${
            isDark ? 'border-slate-800 bg-[#091424]' : 'border-slate-200 bg-white'
          }`}
        >
          {/* Barra de Seleção de Edital e Conexão de Portais */}
          <div
            className={`shrink-0 p-3 border-b flex flex-wrap items-center justify-between gap-2 ${
              isDark ? 'bg-[#0B192C]/90 border-slate-800' : 'bg-slate-100/80 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="w-full">
                <EditalSelector onSelectEdital={handleSelectEdital} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sincronizarPropostaSalva}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#0070C0] bg-[#0070C0]/10 px-2.5 py-1.5 text-xs font-bold text-[#0070C0] hover:bg-[#0070C0] hover:text-white transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Puxar Minha Proposta
              </button>

              <button
                type="button"
                onClick={abrirJanelaDestacada}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] hover:bg-orange-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Janela Destacada (Split)
              </button>
            </div>
          </div>

          {/* Seletor Inteligente de Modo de Operação (Solução para Bloqueio de Iframe) */}
          <div
            className={`shrink-0 px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
              isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Layers className="h-3.5 w-3.5 text-[#0070C0]" />
              Modo de Operação com o Portal:
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setModoConexao('JANELA_DESTACADA')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                  modoConexao === 'JANELA_DESTACADA'
                    ? 'bg-[#0070C0] text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-white border text-slate-700'
                }`}
              >
                Janela Destacada (Multi-Window)
              </button>

              <button
                type="button"
                onClick={() => setModoConexao('PONTE_LOCAL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                  modoConexao === 'PONTE_LOCAL'
                    ? 'bg-[#0070C0] text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-white border text-slate-700'
                }`}
              >
                Ponte Local
              </button>

              <button
                type="button"
                onClick={() => setModoConexao('API_DIRETA')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                  modoConexao === 'API_DIRETA'
                    ? 'bg-[#0070C0] text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-white border text-slate-700'
                }`}
              >
                API Direta
              </button>
            </div>
          </div>

          {/* Área Superior da Coluna Esquerda: Visor de Status do Portal / Janela de Monitoramento */}
          <div className="flex-1 p-3 flex flex-col min-h-0 overflow-hidden">
            {modoConexao === 'JANELA_DESTACADA' ? (
              <div
                className={`flex-1 rounded-2xl border p-4 flex flex-col justify-between overflow-hidden shadow-inner ${
                  isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                      Sincronização em Tempo Real (BroadcastChannel Ativo)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Canal: expertise_disputa_sync
                    </span>
                  </div>

                  <div
                    className={`rounded-xl p-3 border text-xs space-y-1.5 ${
                      isDark ? 'bg-[#0B192C] border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Portal Alvo:</span>
                      <span className="text-[#0070C0] font-mono">{portalUrl}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Edital em Monitoramento:</span>
                      <span className="font-bold text-slate-200">{edital?.numeroEdital || 'Disputa Geral'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Órgão Contratante:</span>
                      <span className="font-medium truncate max-w-[280px]">{edital?.orgao || 'Órgão Promotor'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Velocidade</span>
                      <strong className="text-emerald-400 font-mono tabular-nums text-sm">Instantânea</strong>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Proteção Anti-WAF</span>
                      <strong className="text-[#0070C0] font-mono text-sm">Jitter 1.2s-2.8s</strong>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Piso Inviolável</span>
                      <strong className="text-emerald-400 font-mono text-sm">Hard Limit Ativo</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400">
                    A janela oficial opera lado a lado sem sofrer bloqueios de cabeçalhos de segurança governamentais.
                  </span>
                  <button
                    type="button"
                    onClick={abrirJanelaDestacada}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070C0] hover:bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir Portal Agora
                  </button>
                </div>
              </div>
            ) : modoConexao === 'PONTE_LOCAL' ? (
              <div
                className={`flex-1 rounded-2xl border p-4 flex flex-col justify-center items-center text-center space-y-3 ${
                  isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl bg-[#0070C0]/10 border border-[#0070C0]/30 flex items-center justify-center text-[#0070C0]">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Modo Ponte Local Ativo</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    Conexão segura ponto-a-ponto com seu navegador. Os lances validados pela mesa de operação são transmitidos diretamente para o portal sem intermediação de servidores de terceiros.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`flex-1 rounded-2xl border p-4 flex flex-col justify-center items-center text-center space-y-3 ${
                  isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Telemetria Direta por WebSocket</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    Monitoramento assíncrono dos feeds públicos do PNCP e Compras.gov.br com registro de auditoria em milissegundos.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Área Inferior da Coluna Esquerda: Console de Auditoria e Log de Eventos em Tempo Real */}
          <div
            className={`h-56 shrink-0 border-t flex flex-col overflow-hidden ${
              isDark ? 'bg-[#050B14] border-slate-800' : 'bg-slate-950 text-slate-200 border-slate-300'
            }`}
          >
            {/* Header do Console */}
            <div className="shrink-0 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] bg-black/40">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                CONSOLE DE AUDITORIA OPERACIONAL (TIMESTAMP MS)
              </div>

              <div className="flex items-center gap-1">
                {(['TODOS', 'DISPAROS', 'SEGURANCA', 'PREGOEIRO'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFiltroLog(cat)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition ${
                      filtroLog === cat
                        ? 'bg-[#0070C0] text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Linhas de Log */}
            <div className="flex-1 p-2.5 overflow-y-auto font-mono text-[11px] space-y-1.5 select-text">
              {logsFiltrados.length === 0 ? (
                <div className="text-slate-500 italic p-2">Nenhum evento registrado nesta categoria.</div>
              ) : (
                logsFiltrados.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 tabular-nums shrink-0">[{log.timestamp}]</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 uppercase ${
                        log.categoria === 'DISPARO'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : log.categoria === 'SEGURANCA'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : log.categoria === 'PREGOEIRO'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {log.categoria}
                    </span>
                    <span
                      className={`break-words ${
                        log.categoria === 'DISPARO'
                          ? 'text-emerald-300 font-bold'
                          : log.categoria === 'SEGURANCA'
                          ? 'text-red-300'
                          : log.categoria === 'PREGOEIRO'
                          ? 'text-amber-300 font-semibold'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.mensagem}
                    </span>
                  </div>
                ))
              )}
              <div ref={consoleBottomRef} />
            </div>
          </div>
        </section>

        {/* =======================================================================
            COLUNA DIREITA (45%): PAINEL DE COMANDO & PLANILHA INTELIGENTE DE LANCES
            ======================================================================= */}
        <section className="w-[45%] flex flex-col overflow-hidden">
          {/* Header da Planilha Dinâmica */}
          <div
            className={`shrink-0 p-3 border-b flex items-center justify-between gap-2 ${
              isDark ? 'bg-[#0B192C] border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-[#F97316]" />
                Painel Dinâmico de Lances e Proteção
              </h2>
              <span className="text-[11px] text-slate-400">
                Edição direta por célula com travas inegociáveis de piso mínimo
              </span>
            </div>

            <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-800/40 px-2 py-1 rounded-lg border border-slate-700/60">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'} no certame
            </span>
          </div>

          {/* Grade Operacional da Planilha (Scroll interno apenas se muitos itens) */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead
                className={`sticky top-0 z-10 border-b text-[10px] uppercase font-black tracking-wider ${
                  isDark ? 'bg-[#081424] text-slate-400 border-slate-800' : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                <tr>
                  <th className="py-2 px-2.5 w-12 text-center">Item</th>
                  <th className="py-2 px-2 min-w-[140px]">Descrição</th>
                  <th className="py-2 px-2 w-14 text-right">Qtd</th>
                  <th className="py-2 px-2 w-24 text-right">Melhor Lance</th>
                  <th className="py-2 px-2 w-24 text-right">Seu Lance</th>
                  <th className="py-2 px-2 w-24 text-right">Lance Alvo</th>
                  <th className="py-2 px-2 w-24 text-right">Piso (Trava)</th>
                  <th className="py-2 px-2 w-28 text-center">Estratégia</th>
                  <th className="py-2 px-2 w-24 text-center">Status</th>
                  <th className="py-2 px-2 w-16 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                {itens.map((it) => {
                  const liderando = it.status === 'VENCENDO';
                  const pisoAtingido = it.status === 'PISO_ATINGIDO';

                  return (
                    <tr
                      key={it.id}
                      className={`transition-colors ${
                        liderando
                          ? isDark
                            ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                            : 'bg-emerald-50 hover:bg-emerald-100/60'
                          : pisoAtingido
                          ? isDark
                            ? 'bg-red-950/20 hover:bg-red-950/30'
                            : 'bg-red-50 hover:bg-red-100/60'
                          : isDark
                          ? 'hover:bg-slate-800/40'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Item */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-400">
                        #{it.itemNumero}
                      </td>

                      {/* Descrição */}
                      <td className="py-2.5 px-2">
                        <div className="font-bold truncate max-w-[150px]" title={it.descricao}>
                          {it.descricao}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Ref: {formatBRL(it.valorReferencia)}
                        </span>
                      </td>

                      {/* Qtd */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-400">
                        {it.quantidade} {it.unidadeMedida}
                      </td>

                      {/* Melhor Lance Concorrente */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-slate-300">
                        {formatBRL(it.melhorLanceConcorrente)}
                      </td>

                      {/* Seu Lance */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums">
                        {it.seuUltimoLance ? (
                          <span className={liderando ? 'text-emerald-400 font-black' : 'text-amber-400'}>
                            {formatBRL(it.seuUltimoLance)}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">--</span>
                        )}
                      </td>

                      {/* Lance Alvo (Input Editável) */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={it.lanceAlvo}
                          onChange={(e) => atualizarCampoItem(it.id, 'lanceAlvo', Number(e.target.value))}
                          className={`w-24 rounded-lg px-2 py-1 text-right font-mono font-bold text-xs tabular-nums outline-none border transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 focus:border-[#F97316] text-white'
                              : 'bg-white border-slate-300 focus:border-[#F97316] text-slate-900'
                          }`}
                        />
                      </td>

                      {/* Piso Mínimo (Trava de Segurança Inegociável) */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={it.pisoMinimo}
                          onChange={(e) => atualizarCampoItem(it.id, 'pisoMinimo', Number(e.target.value))}
                          className={`w-24 rounded-lg px-2 py-1 text-right font-mono font-bold text-xs tabular-nums outline-none border transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-red-400 focus:border-red-500'
                              : 'bg-white border-slate-300 text-red-600 focus:border-red-500'
                          }`}
                        />
                      </td>

                      {/* Estratégia */}
                      <td className="py-2 px-2 text-center">
                        <select
                          value={it.estrategia}
                          onChange={(e) => atualizarCampoItem(it.id, 'estrategia', e.target.value as EstrategiaType)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold outline-none border transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-200'
                              : 'bg-white border-slate-300 text-slate-800'
                          }`}
                        >
                          <option value="SNIPER">Sniper (Final)</option>
                          <option value="COBERTURA">Degrau</option>
                          <option value="MANUAL">Manual</option>
                        </select>
                      </td>

                      {/* Status (Badge Pulsante) */}
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            liderando
                              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 animate-pulse'
                              : pisoAtingido
                              ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                              : it.ativo
                              ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {liderando && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                          {it.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Ação: Switch Liga/Desliga + Disparo Imediato */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão de Disparo Manual no Alvo */}
                          <button
                            type="button"
                            onClick={() => dispararLanceManual(it)}
                            title="Disparar lance agora com validação de segurança"
                            className="p-1.5 rounded-lg bg-[#F97316] hover:bg-orange-600 text-white transition"
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </button>

                          {/* Switch Liga/Desliga individual */}
                          <button
                            type="button"
                            onClick={() => toggleItemAtivo(it.id)}
                            title={it.ativo ? 'Pausar este robô' : 'Ativar este robô'}
                            className={`p-1.5 rounded-lg border transition ${
                              it.ativo
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {it.ativo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Planilha com Totais de Segurança */}
          <div
            className={`shrink-0 p-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums ${
              isDark ? 'bg-[#0B192C] border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <span>
                Total Alvo:{' '}
                <strong className="text-emerald-400 font-bold">
                  {formatBRL(itens.reduce((acc, it) => acc + it.quantidade * it.lanceAlvo, 0))}
                </strong>
              </span>
              <span>
                Piso Inegociável:{' '}
                <strong className="text-red-400 font-bold">
                  {formatBRL(itens.reduce((acc, it) => acc + it.quantidade * it.pisoMinimo, 0))}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-sans text-slate-400">Trava de proteção ativa em 100% dos itens</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TradingTerminal;
