import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Zap,
  Activity,
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
  Gavel,
  CheckCircle2,
  Lock,
  AlertOctagon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Decimal from 'decimal.js';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { propostasApi } from '@/services/api';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

export type EstrategiaType = 'SNIPER' | 'COBERTURA' | 'MANUAL';
export type StatusItemType = 'VENCENDO' | 'COBERTO' | 'PISO_ATINGIDO' | 'PAUSADO';

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
  status: StatusItemType;
  ativo: boolean;
  margemEstimadaPct: number;
}

export interface MensagemDisputa {
  id: string;
  hora: string;
  autor: 'PREGOEIRO' | 'SISTEMA' | 'LANCE' | 'ALERTA';
  texto: string;
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
  // Edital Selecionado e Portal
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>('https://pncp.gov.br/app/editais');

  // Áudio de Alertas do Pregoeiro
  const [somHabilitado, setSomHabilitado] = useState<boolean>(true);

  // Aba Ativa no Mobile (para nunca quebrar em telas pequenas)
  const [abaMobile, setAbaMobile] = useState<'ITENS' | 'PREPARACAO' | 'AVISOS'>('ITENS');

  // Contagem Regressiva para a Abertura da Sessão
  const [tempoRestanteMinutos, setTempoRestanteMinutos] = useState<number>(14);
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = useState<number>(30);
  const [disputaEmAndamento] = useState<boolean>(true);

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
      lanceAlvo: 37500.0,
      pisoMinimo: 32000.0,
      estrategia: 'SNIPER',
      decrementoMinimo: 100.0,
      status: 'COBERTO',
      ativo: true,
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
      status: 'VENCENDO',
      ativo: true,
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
      status: 'PISO_ATINGIDO',
      ativo: false,
      margemEstimadaPct: 0.0,
    },
  ]);

  // Mensagens do Pregoeiro e Avisos Oficiais
  const [mensagens, setMensagens] = useState<MensagemDisputa[]>([
    {
      id: 'msg-1',
      hora: '10:00:15',
      autor: 'PREGOEIRO',
      texto: 'Bom dia aos senhores licitantes. Sessão pública aberta para lances na modalidade Pregão Eletrônico (Lei nº 14.133/2021).',
    },
    {
      id: 'msg-2',
      hora: '10:02:40',
      autor: 'LANCE',
      texto: 'Oponente cobriu o Item #1 com oferta de R$ 38.200,00.',
      itemNumero: 1,
      valor: 38200.0,
    },
    {
      id: 'msg-3',
      hora: '10:04:10',
      autor: 'SISTEMA',
      texto: 'Sua empresa assumiu o 1º Lugar no Item #2 com lance de R$ 152.000,00.',
      itemNumero: 2,
      valor: 152000.0,
    },
    {
      id: 'msg-4',
      hora: '10:06:55',
      autor: 'ALERTA',
      texto: 'Trava de proteção ativada no Item #3: O menor lance do mercado atingiu o seu piso de segurança. Disparo suspenso para garantir seu lucro.',
      itemNumero: 3,
    },
  ]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Rolagem automática nas mensagens
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Cronômetro Regressivo da Sessão
  useEffect(() => {
    const timer = setInterval(() => {
      setTempoRestanteSegundos((seg) => {
        if (seg > 0) return seg - 1;
        setTempoRestanteMinutos((min) => (min > 0 ? min - 1 : 0));
        return 59;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const adicionarMensagem = useCallback(
    (autor: 'PREGOEIRO' | 'SISTEMA' | 'LANCE' | 'ALERTA', texto: string, itemNumero?: number, valor?: number) => {
      const now = new Date();
      const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMensagens((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          hora,
          autor,
          texto,
          itemNumero,
          valor,
        },
      ]);
    },
    []
  );

  // PARADA DE EMERGÊNCIA GLOBAL (STOP ALL)
  const executarParadaEmergencia = () => {
    setItens((prev) =>
      prev.map((it) => ({
        ...it,
        ativo: false,
        status: it.status === 'VENCENDO' ? 'VENCENDO' : 'PAUSADO',
      }))
    );

    adicionarMensagem(
      'ALERTA',
      'PARADA DE EMERGÊNCIA ACIONADA: Todos os robôs e disparos automáticos foram interrompidos imediatamente.'
    );
    toast.error('PARADA DE EMERGÊNCIA EXECUTADA: Todos os robôs foram pausados com segurança.', {
      duration: 5000,
      icon: '🛑',
    });
  };

  // RETOMAR TODOS OS ROBÔS
  const ligarTodos = () => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.melhorLanceConcorrente <= it.pisoMinimo) {
          return { ...it, ativo: false, status: 'PISO_ATINGIDO' };
        }
        return {
          ...it,
          ativo: true,
          status: it.seuUltimoLance === it.melhorLanceConcorrente ? 'VENCENDO' : 'COBERTO',
        };
      })
    );
    adicionarMensagem('SISTEMA', 'Monitoramento ativado em todos os itens com margem de segurança preservada.');
    toast.success('Robôs ativos e monitorando a disputa.');
  };

  // Alternar Ativação Individual
  const toggleItemAtivo = (itemId: string) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const novoAtivo = !it.ativo;
        if (novoAtivo && it.melhorLanceConcorrente <= it.pisoMinimo) {
          toast.error(
            `Item #${it.itemNumero}: Piso mínimo de ${formatBRL(it.pisoMinimo)} já atingido. Ativação bloqueada para proteger sua empresa.`
          );
          return { ...it, ativo: false, status: 'PISO_ATINGIDO' };
        }
        adicionarMensagem(
          'SISTEMA',
          `Robô do Item #${it.itemNumero} ${novoAtivo ? 'ATIVADO' : 'PAUSADO'} pelo operador.`
        );
        return {
          ...it,
          ativo: novoAtivo,
          status: novoAtivo ? (it.seuUltimoLance === it.melhorLanceConcorrente ? 'VENCENDO' : 'COBERTO') : 'PAUSADO',
        };
      })
    );
  };

  // Atualização Direta de Campos com Decimal.js
  const atualizarCampoItem = (
    itemId: string,
    campo: 'pisoMinimo' | 'lanceAlvo' | 'estrategia',
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
          adicionarMensagem('SISTEMA', `Estratégia do Item #${it.itemNumero} alterada para ${valor}.`);
        }

        return atualizado;
      })
    );
  };

  // Disparo Imediato de Lance com Validação de Segurança
  const dispararLanceManual = (item: ItemPlanilhaTerminal) => {
    if (!item.lanceAlvo || item.lanceAlvo <= 0) {
      toast.error(`Informe um valor de lance válido para o Item #${item.itemNumero}.`);
      return;
    }

    if (item.lanceAlvo < item.pisoMinimo) {
      adicionarMensagem(
        'ALERTA',
        `BLOQUEIO DE SEGURANÇA: Lance de ${formatBRL(item.lanceAlvo)} no Item #${item.itemNumero} rejeitado por violar o piso mínimo de ${formatBRL(item.pisoMinimo)}.`
      );
      toast.error(`Operação bloqueada: Lance de ${formatBRL(item.lanceAlvo)} viola seu piso de segurança (${formatBRL(item.pisoMinimo)}).`);
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

    adicionarMensagem(
      'LANCE',
      `LANCE CONFIRMADO: Item #${item.itemNumero} registrado com ${formatBRL(valorDisparo)}. Posição assumida: 1º LUGAR.`,
      item.itemNumero,
      valorDisparo
    );
    toast.success(`Lance de ${formatBRL(valorDisparo)} registrado no Item #${item.itemNumero}!`);
  };

  // Importar Dados da Proposta Comercial Salva
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
            const piso = roundDec(custo * 1.10);
            const lanceAlvo = roundDec(ref * 0.92);

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
              status: 'COBERTO',
              ativo: true,
              margemEstimadaPct: roundDec(((ref - custo) / ref) * 100),
            };
          })
        );
        adicionarMensagem('SISTEMA', `Itens da proposta "${prop.titulo || 'Ativa'}" carregados com sucesso.`);
        toast.success(`Itens carregados da proposta "${prop.titulo || 'Ativa'}"!`);
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
    adicionarMensagem('SISTEMA', `Edital selecionado: ${e.numeroEdital || e.id} - ${e.orgao || 'Órgão Promotor'}.`);
  };

  // Abrir Sala de Disputa no Portal Oficial
  const abrirSalaOficial = () => {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
    adicionarMensagem('SISTEMA', `Acesso à sala oficial acionado no portal: ${portalUrl}`);
  };

  // Indicadores de Liderança
  const totalItens = itens.length;
  const itensVencendo = itens.filter((i) => i.status === 'VENCENDO').length;
  const itensAtivos = itens.filter((i) => i.ativo).length;
  const totalAlvo = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.lanceAlvo, 0), [itens]);
  const totalPiso = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.pisoMinimo, 0), [itens]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 space-y-4">
        {/* =========================================================================
            1. BANNER ESTRATÉGICO: ALERTA DE PROXIMIDADE & CONEXÃO COM O PORTAL
            ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316] shadow-sm">
                <Gavel className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-[#081C3A]">
                    Sala de Disputa & Robô de Lances
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    Sessão Conectada
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhe a disputa em tempo real, proteja sua margem contra lances inexequíveis e receba avisos do pregoeiro.
                </p>
              </div>
            </div>

            {/* Ações Globais: Ligar Todos & Parada de Emergência */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSomHabilitado(!somHabilitado)}
                title={somHabilitado ? 'Alertas sonoros ativados' : 'Alertas sonoros silenciados'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                {somHabilitado ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
                <span className="hidden sm:inline">{somHabilitado ? 'Som Ativo' : 'Mudo'}</span>
              </button>

              <button
                type="button"
                onClick={ligarTodos}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
              >
                <Play className="h-4 w-4 text-emerald-600" />
                Ligar Todos
              </button>

              <button
                type="button"
                onClick={executarParadaEmergencia}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 px-4 py-2 text-xs font-extrabold uppercase text-white shadow-sm transition"
              >
                <AlertOctagon className="h-4 w-4" />
                PARAR TUDO (STOP ALL)
              </button>
            </div>
          </div>

          {/* CARD DE CONEXÃO & ALERTA DE PROXIMIDADE DA DISPUTA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            {/* Bloco 1: Alerta de Início / Disputa */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase block">Horário da Disputa</span>
                  <span className="text-xs font-extrabold text-[#081C3A]">
                    {disputaEmAndamento ? 'Fase de Lances em Andamento' : `Inicia em ${tempoRestanteMinutos}m ${tempoRestanteSegundos}s`}
                  </span>
                </div>
              </div>
              <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-mono font-bold text-amber-800">
                Hoje, 10:00h
              </span>
            </div>

            {/* Bloco 2: Edital Selecionado */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 flex items-center justify-between">
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Edital Selecionado</span>
                  {edital && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {edital.numeroEdital || 'Conectado'}
                    </span>
                  )}
                </div>
                <EditalSelector onSelectEdital={handleSelectEdital} />
              </div>
            </div>

            {/* Bloco 3: Botão de Acesso Direto à Sala Oficial do Governo */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#0070C0] uppercase block">Sala Oficial</span>
                <span className="text-xs font-medium text-slate-600 truncate block max-w-[160px]">
                  {portalUrl.replace('https://', '')}
                </span>
              </div>
              <button
                type="button"
                onClick={abrirSalaOficial}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070C0] hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition shrink-0"
              >
                Acessar Sala <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. CARDS DE RESUMO OPERACIONAL (KPIs LIMPOS E CLAROS)
            ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block">Posição no Certame</span>
            <div className="flex items-baseline gap-2 mt-1">
              <strong className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                {itensVencendo}/{totalItens}
              </strong>
              <span className="text-xs font-bold text-emerald-700">em 1º Lugar</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block">Robôs em Operação</span>
            <div className="flex items-baseline gap-2 mt-1">
              <strong className="text-xl sm:text-2xl font-black text-[#081C3A] font-mono">
                {itensAtivos}
              </strong>
              <span className="text-xs text-slate-500">de {totalItens} ativos</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block">Faturamento Alvo</span>
            <div className="mt-1">
              <strong className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono">
                {formatBRL(totalAlvo)}
              </strong>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-red-500" /> Piso Total Seguro
            </span>
            <div className="mt-1">
              <strong className="text-sm sm:text-base font-extrabold text-red-600 font-mono">
                {formatBRL(totalPiso)}
              </strong>
            </div>
          </div>
        </div>

        {/* ABAS NO MOBILE (Evita quebras ou sobreposição de colunas em telas de celular) */}
        <div className="flex lg:hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setAbaMobile('ITENS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'ITENS' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Itens da Disputa ({itens.length})
          </button>
          <button
            type="button"
            onClick={() => setAbaMobile('AVISOS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'AVISOS' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Avisos do Pregoeiro
          </button>
          <button
            type="button"
            onClick={() => setAbaMobile('PREPARACAO')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'PREPARACAO' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Preparação
          </button>
        </div>

        {/* =========================================================================
            3. ÁREA PRINCIPAL: PLANILHA DE LANCES & PAINEL DE AVISOS DO PREGOEIRO
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* COLUNA PRINCIPAL (8 Colunas no Desktop): PLANILHA DE ITENS E LANCES */}
          <div
            className={`lg:col-span-8 space-y-3 ${
              abaMobile !== 'ITENS' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-[#081C3A] flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#F97316]" />
                    Controle de Lances por Item (Trava de Segurança Ativa)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Defina o valor alvo e o piso mínimo inegociável. O robô nunca dispara lances com prejuízo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={sincronizarPropostaSalva}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:bg-slate-100 transition shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#0070C0]" />
                  Puxar Minha Proposta
                </button>
              </div>

              {/* Tabela Limpa de Lances */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                  <thead className="bg-[#081C3A] text-white text-[11px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Item</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Descrição</th>
                      <th className="py-2.5 px-3 w-28 text-right">Melhor Oferta</th>
                      <th className="py-2.5 px-3 w-28 text-right">Seu Lance</th>
                      <th className="py-2.5 px-3 w-28 text-right">Lance Alvo</th>
                      <th className="py-2.5 px-3 w-28 text-right">Piso Seguro</th>
                      <th className="py-2.5 px-3 w-28 text-center">Estratégia</th>
                      <th className="py-2.5 px-3 w-28 text-center">Status</th>
                      <th className="py-2.5 px-3 w-20 text-center">Operar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {itens.map((it) => {
                      const liderando = it.status === 'VENCENDO';
                      const pisoAtingido = it.status === 'PISO_ATINGIDO';

                      return (
                        <tr
                          key={it.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            liderando ? 'bg-emerald-50/40' : pisoAtingido ? 'bg-red-50/40' : ''
                          }`}
                        >
                          {/* Item */}
                          <td className="py-2.5 px-3 text-center font-bold text-[#081C3A]">
                            #{it.itemNumero}
                          </td>

                          {/* Descrição */}
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block truncate max-w-[180px]" title={it.descricao}>
                              {it.descricao}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Ref: {formatBRL(it.valorReferencia)} • Qtd: {it.quantidade}
                            </span>
                          </td>

                          {/* Melhor Oferta do Mercado */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {formatBRL(it.melhorLanceConcorrente)}
                          </td>

                          {/* Seu Lance Atual */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.seuUltimoLance ? (
                              <span className={liderando ? 'text-emerald-700 font-extrabold' : 'text-amber-700'}>
                                {formatBRL(it.seuUltimoLance)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">--</span>
                            )}
                          </td>

                          {/* Lance Alvo (Editável) */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={it.lanceAlvo}
                              onChange={(e) => atualizarCampoItem(it.id, 'lanceAlvo', Number(e.target.value))}
                              className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono font-bold text-xs text-slate-800 outline-none focus:border-[#F97316]"
                            />
                          </td>

                          {/* Piso Seguro (Stop-Loss) */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={it.pisoMinimo}
                              onChange={(e) => atualizarCampoItem(it.id, 'pisoMinimo', Number(e.target.value))}
                              className="w-24 rounded-lg border border-red-200 bg-red-50/50 px-2 py-1 text-right font-mono font-bold text-xs text-red-700 outline-none focus:border-red-500"
                            />
                          </td>

                          {/* Estratégia */}
                          <td className="py-2 px-2 text-center">
                            <select
                              value={it.estrategia}
                              onChange={(e) => atualizarCampoItem(it.id, 'estrategia', e.target.value as EstrategiaType)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none"
                            >
                              <option value="SNIPER">Sniper (Final)</option>
                              <option value="COBERTURA">Degrau</option>
                              <option value="MANUAL">Manual</option>
                            </select>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                liderando
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : pisoAtingido
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : it.ativo
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {liderando && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                              {it.status === 'VENCENDO'
                                ? '1º Lugar'
                                : it.status === 'PISO_ATINGIDO'
                                ? 'Piso Atingido'
                                : it.status === 'COBERTO'
                                ? 'Coberto'
                                : 'Pausado'}
                            </span>
                          </td>

                          {/* Ação: Disparar e Pausar */}
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => dispararLanceManual(it)}
                                title="Enviar este lance com validação de piso"
                                className="rounded-lg bg-[#F97316] hover:bg-orange-600 p-1.5 text-white shadow-xs transition"
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleItemAtivo(it.id)}
                                title={it.ativo ? 'Pausar automação deste item' : 'Ligar automação'}
                                className={`rounded-lg border p-1.5 transition ${
                                  it.ativo
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-300 bg-slate-100 text-slate-500'
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
            </div>
          </div>

          {/* COLUNA LATERAL (4 Colunas no Desktop): AVISOS DO PREGOEIRO & PREPARAÇÃO */}
          <div
            className={`lg:col-span-4 space-y-4 ${
              abaMobile === 'ITENS' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* BOX 1: AVISOS OFICIAIS & CHAT DO PREGOEIRO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-80">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-[#081C3A] flex items-center gap-1.5">
                  <Gavel className="h-4 w-4 text-[#0070C0]" />
                  Avisos do Pregoeiro & Eventos
                </h3>
                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Ao Vivo
                </span>
              </div>

              {/* Feed de Mensagens */}
              <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
                {mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2.5 border text-xs leading-relaxed ${
                      msg.autor === 'PREGOEIRO'
                        ? 'bg-blue-50/70 border-blue-200 text-slate-800'
                        : msg.autor === 'ALERTA'
                        ? 'bg-red-50/70 border-red-200 text-red-900 font-semibold'
                        : msg.autor === 'LANCE'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[10px] text-slate-500 mb-1">
                      <span className="uppercase">
                        {msg.autor === 'PREGOEIRO'
                          ? 'Aviso do Pregoeiro Oficial'
                          : msg.autor === 'ALERTA'
                          ? 'Segurança Financeira'
                          : msg.autor === 'LANCE'
                          ? 'Movimento da Disputa'
                          : 'Notificação do Sistema'}
                      </span>
                      <span>{msg.hora}</span>
                    </div>
                    <p>{msg.texto}</p>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            </div>

            {/* BOX 2: PREPARAÇÃO TÁTICA ANTES DA DISPUTA (CHECKLIST DO LICITANTE) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase text-[#081C3A] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Checklist de Prontidão da Empresa
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Certidões e CNDs Fiscais
                  </span>
                  <span className="font-bold text-emerald-700">100% Válidas</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Proposta Comercial
                  </span>
                  <span className="font-bold text-emerald-700">Importada</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Travas de Stop-Loss
                  </span>
                  <span className="font-bold text-emerald-700">Ativas por Item</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Modo de Disputa:</span>
                <strong className="text-[#081C3A]">Aberto-Fechado (IN 73/2022)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingTerminal;
