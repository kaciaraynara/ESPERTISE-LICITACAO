import { randomUUID } from 'crypto';
import { Socket } from 'socket.io';
import { prisma } from '../database/prisma';
import { calcularSimulacaoBdi } from './tax-bdi.service';
import { BidRecord, SocketBidError } from '../types/war-room.types';

export type EstrategiaRobo = 'SNIPER' | 'CONSERVADOR' | 'AGRESSIVO';

export interface RoboConfigRecord {
  id: string;
  user_id: string;
  licitacao_id: string;
  estrategia: EstrategiaRobo;
  precoInicial: number;
  precoLimite: number;
  decrementoMinimo: number;
  ativo: boolean;
  sessao_nome?: string;
  objeto?: string;
  portal_nome?: string;
  portal_url?: string;
  score_aderencia?: number;
  atualizado_em: string;
  criado_em: string;
}

export interface RoboLogRecord {
  id: string;
  user_id: string;
  config_id: string;
  licitacao_id: string;
  valor: number;
  acao: 'LANCE' | 'AGUARDAR' | 'PARAR';
  motivo: string;
  timestamp: string;
}

export class RoboService {
  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private buildSafeBid(precoAtual: number, decremento: number, precoLimite: number) {
    const novoLance = Number((precoAtual - decremento).toFixed(2));
    if (novoLance <= precoLimite) {
      return null;
    }
    return novoLance;
  }

  private async appendLog(log: RoboLogRecord) {
    await prisma.auditEvent.create({
      data: {
        userId: log.user_id,
        scope: 'BID_ROBOT',
        action: log.acao,
        outcome: 'SUCCESS',
        entityType: 'RoboSession',
        entityId: log.config_id,
        metadata: {
          licitacaoId: log.licitacao_id,
          valor: log.valor,
          motivo: log.motivo,
          timestamp: log.timestamp,
        },
      },
    });
  }

  public async getConfig(userId: string, licitacaoId: string): Promise<RoboConfigRecord | null> {
    const session = await prisma.roboSession.findUnique({
      where: {
        userId_licitacaoId: {
          userId,
          licitacaoId,
        },
      },
    });

    if (!session) return null;

    return {
      id: session.id,
      user_id: session.userId,
      licitacao_id: session.licitacaoId,
      estrategia: session.estrategia as EstrategiaRobo,
      precoInicial: Number(session.precoInicial),
      precoLimite: Number(session.precoLimite),
      decrementoMinimo: Number(session.decrementoMinimo),
      ativo: session.ativo,
      sessao_nome: session.sessaoNome ?? undefined,
      objeto: session.objeto ?? undefined,
      portal_nome: session.portalNome ?? undefined,
      portal_url: session.portalUrl ?? undefined,
      score_aderencia: session.scoreAderencia ?? undefined,
      atualizado_em: session.updatedAt.toISOString(),
      criado_em: session.createdAt.toISOString(),
    };
  }

  public async salvarConfig(userId: string, licitacaoId: string, payload: Partial<RoboConfigRecord>): Promise<RoboConfigRecord> {
    const session = await prisma.roboSession.upsert({
      where: {
        userId_licitacaoId: {
          userId,
          licitacaoId,
        },
      },
      update: {
        estrategia: payload.estrategia,
        precoInicial: payload.precoInicial !== undefined ? payload.precoInicial : undefined,
        precoLimite: payload.precoLimite !== undefined ? payload.precoLimite : undefined,
        decrementoMinimo: payload.decrementoMinimo !== undefined ? payload.decrementoMinimo : undefined,
        ativo: payload.ativo,
        sessaoNome: payload.sessao_nome,
        objeto: payload.objeto,
        portalNome: payload.portal_nome,
        portalUrl: payload.portal_url,
        scoreAderencia: payload.score_aderencia,
      },
      create: {
        userId,
        licitacaoId,
        estrategia: payload.estrategia || 'SNIPER',
        precoInicial: payload.precoInicial ?? 0,
        precoLimite: payload.precoLimite ?? 0,
        decrementoMinimo: payload.decrementoMinimo ?? 10,
        ativo: payload.ativo ?? false,
        sessaoNome: payload.sessao_nome ?? `Sessao ${licitacaoId}`,
        objeto: payload.objeto ?? '',
        portalNome: payload.portal_nome ?? '',
        portalUrl: payload.portal_url ?? '',
        scoreAderencia: payload.score_aderencia ?? 70,
      },
    });

    return {
      id: session.id,
      user_id: session.userId,
      licitacao_id: session.licitacaoId,
      estrategia: session.estrategia as EstrategiaRobo,
      precoInicial: Number(session.precoInicial),
      precoLimite: Number(session.precoLimite),
      decrementoMinimo: Number(session.decrementoMinimo),
      ativo: session.ativo,
      sessao_nome: session.sessaoNome ?? undefined,
      objeto: session.objeto ?? undefined,
      portal_nome: session.portalNome ?? undefined,
      portal_url: session.portalUrl ?? undefined,
      score_aderencia: session.scoreAderencia ?? undefined,
      atualizado_em: session.updatedAt.toISOString(),
      criado_em: session.createdAt.toISOString(),
    };
  }

  public calcularDecisao(params: {
    precoAtual: number;
    precoLimite: number;
    estrategia: EstrategiaRobo;
    decrementoMinimo: number;
    tempoRestante?: number;
    souPrimeiro: boolean;
    scoreAderencia?: number;
  }): { acao: 'LANCE' | 'AGUARDAR' | 'PARAR'; novoLance?: number; motivo: string } {
    const {
      precoAtual,
      precoLimite,
      estrategia,
      decrementoMinimo,
      tempoRestante,
      souPrimeiro,
      scoreAderencia = 70,
    } = params;

    const decrementoBase = this.clamp(
      scoreAderencia >= 85
        ? decrementoMinimo * 1.2
        : scoreAderencia < 60
          ? decrementoMinimo * 0.8
          : decrementoMinimo,
      decrementoMinimo * 0.75,
      decrementoMinimo * 1.6,
    );

    if (precoAtual - decrementoBase <= precoLimite) {
      return { acao: 'PARAR', motivo: 'Margem minima atingida. Robo parado para proteger a operacao.' };
    }

    if (souPrimeiro) {
      return { acao: 'AGUARDAR', motivo: 'Primeira colocacao mantida. Aguardando novo movimento do concorrente.' };
    }

    switch (estrategia) {
      case 'SNIPER':
        if (tempoRestante !== undefined && tempoRestante > 8) {
          return {
            acao: 'AGUARDAR',
            motivo: `Modo sniper aguardando janela final. Restam ${tempoRestante}s para agir.`,
          };
        }
        {
          const novoLance = this.buildSafeBid(precoAtual, decrementoBase, precoLimite);
          if (!novoLance) {
            return { acao: 'PARAR', motivo: 'Lance sniper violaria a margem minima. Robo parado para proteger a operacao.' };
          }

          return {
            acao: 'LANCE',
            novoLance,
            motivo: 'Lance sniper disparado no momento de maior eficiencia competitiva.',
          };
        }

      case 'AGRESSIVO':
        {
          const novoLance = this.buildSafeBid(precoAtual, decrementoBase * 1.35, precoLimite);
          if (!novoLance) {
            return { acao: 'PARAR', motivo: 'Lance agressivo violaria a margem minima. Robo parado para proteger a operacao.' };
          }

          return {
            acao: 'LANCE',
            novoLance,
            motivo: 'Lance agressivo enviado para pressionar o concorrente com mais velocidade.',
          };
        }

      case 'CONSERVADOR':
      default:
        {
          const novoLance = this.buildSafeBid(precoAtual, decrementoBase, precoLimite);
          if (!novoLance) {
            return { acao: 'PARAR', motivo: 'Lance conservador violaria a margem minima. Robo parado para proteger a operacao.' };
          }

          return {
            acao: 'LANCE',
            novoLance,
            motivo: 'Lance conservador enviado com foco em preservar margem e aderencia.',
          };
        }
    }
  }

  public async processarLance(
    userId: string,
    licitacaoId: string,
    precoAtual: number,
    tempoRestante: number | undefined,
    souPrimeiro: boolean
  ) {
    const config = await this.getConfig(userId, licitacaoId);

    if (!config) {
      throw new Error('NOT_FOUND:Robô não configurado para esta licitação');
    }

    const decisao = this.calcularDecisao({
      precoAtual,
      precoLimite: config.precoLimite,
      estrategia: config.estrategia,
      decrementoMinimo: config.decrementoMinimo,
      tempoRestante,
      souPrimeiro,
      scoreAderencia: config.score_aderencia,
    });

    const log: RoboLogRecord = {
      id: Date.now().toString(),
      user_id: userId,
      config_id: config.id,
      licitacao_id: licitacaoId,
      valor: decisao.novoLance || precoAtual,
      acao: decisao.acao,
      motivo: decisao.motivo,
      timestamp: new Date().toISOString(),
    };
    await this.appendLog(log);

    return { ...decisao, log, config };
  }

  public async getLogs(userId: string, licitacaoId: string): Promise<RoboLogRecord[]> {
    const events = await prisma.auditEvent.findMany({
      where: {
        userId,
        scope: 'BID_ROBOT',
        metadata: {
          path: ['licitacaoId'],
          equals: licitacaoId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    return events.reverse().map((e) => {
      const meta = e.metadata as any;
      return {
        id: e.id,
        user_id: e.userId!,
        config_id: e.entityId!,
        licitacao_id: meta?.licitacaoId,
        valor: meta?.valor,
        acao: e.action as 'LANCE' | 'AGUARDAR' | 'PARAR',
        motivo: meta?.motivo,
        timestamp: meta?.timestamp,
      };
    });
  }

  public async toggleRobo(userId: string, licitacaoId: string) {
    const config = await this.getConfig(userId, licitacaoId);

    if (!config) {
      throw new Error('NOT_FOUND:Configuração não encontrada');
    }

    const ativo = !config.ativo;
    const atualizado = await this.salvarConfig(userId, licitacaoId, { ativo });

    await this.appendLog({
      id: `${Date.now()}-toggle`,
      user_id: userId,
      config_id: atualizado.id,
      licitacao_id: licitacaoId,
      valor: atualizado.precoInicial,
      acao: ativo ? 'AGUARDAR' : 'PARAR',
      motivo: ativo
        ? 'Sala do robo ativada para monitoramento e disparo assistido.'
        : 'Sala do robo pausada manualmente pelo usuario.',
      timestamp: new Date().toISOString(),
    });

    return { ativo, config: atualizado };
  }
}

export const roboService = new RoboService();

/* =======================================
   WEBSOCKET ROBO SERVICE
======================================= */
export type EstrategiaType = 'sniper' | 'agressivo' | 'conservador';

export interface SetupRoboPayload {
  pregaoId: string;
  itemNumero?: number;
  valorInicial: number;
  lanceMinimoPermitido: number;
  estrategia?: EstrategiaType;
  decrementoMinimo?: number;
  custoInsumos?: number;
}

export interface ItemRoboConfig {
  itemNumero: number;
  ativo: boolean;
  estrategia: EstrategiaType;
  lanceMinimoPermitido: number;
  valorAtualDisputa: number;
  decrementoMinimo: number;
  custoInsumos?: number;
}

export class RoboSocketService {
  private socket: Socket;
  private isActive: boolean = false;
  private estrategia: EstrategiaType = 'sniper';
  private lanceMinimoPermitido: number = 0;
  private valorAtualDisputa: number = 0;
  private decrementoMinimo: number = 1;
  private itemConfigs: Map<number, ItemRoboConfig> = new Map();

  constructor(socket: Socket) {
    this.socket = socket;
  }

  public iniciar(payload: SetupRoboPayload) {
    const itemNum = payload.itemNumero !== undefined ? Number(payload.itemNumero) : undefined;
    const estrategia = payload.estrategia || this.estrategia;
    const decremento = payload.decrementoMinimo ?? (this.decrementoMinimo || 1);

    if (itemNum !== undefined) {
      const itemCfg: ItemRoboConfig = {
        itemNumero: itemNum,
        ativo: true,
        estrategia,
        lanceMinimoPermitido: payload.lanceMinimoPermitido,
        valorAtualDisputa: payload.valorInicial,
        decrementoMinimo: decremento,
        custoInsumos: payload.custoInsumos,
      };
      this.itemConfigs.set(itemNum, itemCfg);
      this.emitLog(
        `[CENTRAL DE ESTRATÉGIA] Robô ativado para o Item #${itemNum}. Piso Stop-Loss: R$ ${payload.lanceMinimoPermitido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Decremento: R$ ${decremento.toFixed(2)}.`,
        'system'
      );
      this.socket.emit('robo_status', { ativo: true, itemNumero: itemNum, estrategia });
    } else {
      this.lanceMinimoPermitido = payload.lanceMinimoPermitido;
      this.valorAtualDisputa = payload.valorInicial;
      this.estrategia = estrategia;
      this.decrementoMinimo = decremento;
      this.isActive = true;

      this.emitLog(
        `[CENTRAL DE ESTRATÉGIA] Sessão iniciada. Piso de proteção configurado em R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Operação automatizada assistida.`,
        'system'
      );
      this.socket.emit('robo_status', { ativo: true, estrategia: this.estrategia });
    }
  }

  public pausar(itemNumero?: number) {
    if (itemNumero !== undefined) {
      const cfg = this.itemConfigs.get(Number(itemNumero));
      if (cfg) {
        cfg.ativo = false;
        this.itemConfigs.set(Number(itemNumero), cfg);
      }
      this.emitLog(`[CENTRAL DE ESTRATÉGIA] Automação do Item #${itemNumero} pausada.`, 'alert');
      this.socket.emit('robo_status', { ativo: false, itemNumero: Number(itemNumero) });
      return;
    }

    if (!this.isActive && this.itemConfigs.size === 0) return;
    this.isActive = false;
    for (const [num, cfg] of this.itemConfigs.entries()) {
      cfg.ativo = false;
      this.itemConfigs.set(num, cfg);
    }
    this.emitLog('[CENTRAL DE ESTRATÉGIA] Monitoramento tático pausado em todos os itens.', 'alert');
    this.socket.emit('robo_status', { ativo: false });
  }

  public atualizarEstrategia(payload: { estrategia: EstrategiaType; itemNumero?: number }) {
    this.estrategia = payload.estrategia;
    if (payload.itemNumero !== undefined) {
      const cfg = this.itemConfigs.get(Number(payload.itemNumero));
      if (cfg) {
        cfg.estrategia = payload.estrategia;
        this.itemConfigs.set(Number(payload.itemNumero), cfg);
      }
      this.emitLog(`[ESTRATÉGIA] Perfil do Item #${payload.itemNumero} atualizado para: ${this.estrategia.toUpperCase()}.`, 'system');
      this.socket.emit('robo_status', { ativo: cfg?.ativo ?? true, itemNumero: Number(payload.itemNumero), estrategia: this.estrategia });
      return;
    }

    this.emitLog(`[ESTRATÉGIA] Perfil tático geral atualizado para: ${this.estrategia.toUpperCase()}.`, 'system');
    this.socket.emit('robo_status', { ativo: this.isActive, estrategia: this.estrategia });
  }

  public processarLanceManual(payload: { valor: number; itemNumero?: number; pregaoId?: string }) {
    const itemNum = payload.itemNumero !== undefined ? Number(payload.itemNumero) : undefined;
    const itemCfg = itemNum !== undefined ? this.itemConfigs.get(itemNum) : undefined;
    const pisoMinimo = itemCfg?.lanceMinimoPermitido ?? this.lanceMinimoPermitido;

    this.emitLog(
      `[ANÁLISE DE MARGEM] Avaliando proposta manual de R$ ${payload.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${itemNum ? ` (Item #${itemNum})` : ''}...`,
      'info'
    );

    if (payload.valor <= pisoMinimo) {
      this.emitLog(
        `[BLOQUEIO DE SEGURANÇA] Lance manual de R$ ${payload.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} viola o piso de Stop-Loss de R$ ${pisoMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        'alert'
      );
      const errorPayload: SocketBidError = {
        statusCode: 403,
        error: 'Forbidden',
        code: 'STOP_LOSS_VIOLATION',
        message: `Lance manual de R$ ${payload.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} viola o piso de Stop-Loss (R$ ${pisoMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        itemNumero: itemNum,
        bid_amount: payload.valor,
        stop_loss_minimo: pisoMinimo,
        margem_calculada: 0,
        timestamp: new Date().toISOString(),
      };
      this.socket.emit('bid_error', errorPayload);
      return;
    }

    this.valorAtualDisputa = payload.valor;
    if (itemCfg) itemCfg.valorAtualDisputa = payload.valor;

    this.emitLog(
      `[LANCE VALIDADO] Oferta de R$ ${payload.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aprovada dentro da margem segura.`,
      'action'
    );
    this.socket.emit('lance_validado', {
      pregaoId: payload.pregaoId || 'arena-geral',
      itemNumero: itemNum,
      valor: this.valorAtualDisputa,
    });
  }

  public processarNovoLanceOponente(
    valorOuParams:
      | number
      | {
          pregaoId?: string;
          itemNumero?: number;
          valor?: number;
          valorMercado?: number;
          menorLanceConcorrente?: number;
          tempoRestante?: number;
          decrementoMinimo?: number;
          stopLossMinimo?: number;
          socketUser?: any;
        },
    tempoRestanteFallback?: number
  ) {
    let valorMercado = 0;
    let tempoRestante = 120;
    let itemNumero: number | undefined;
    let pregaoId: string | undefined;
    let decrementoParam: number | undefined;
    let stopLossParam: number | undefined;
    let socketUser: any;

    if (typeof valorOuParams === 'number') {
      valorMercado = valorOuParams;
      tempoRestante = tempoRestanteFallback ?? 120;
    } else if (typeof valorOuParams === 'object' && valorOuParams !== null) {
      valorMercado = Number(
        valorOuParams.menorLanceConcorrente ?? valorOuParams.valorMercado ?? valorOuParams.valor ?? 0
      );
      tempoRestante = Number(valorOuParams.tempoRestante ?? 120);
      itemNumero = valorOuParams.itemNumero !== undefined ? Number(valorOuParams.itemNumero) : undefined;
      pregaoId = valorOuParams.pregaoId;
      decrementoParam = valorOuParams.decrementoMinimo;
      stopLossParam = valorOuParams.stopLossMinimo;
      socketUser = valorOuParams.socketUser;
    }

    const itemCfg = itemNumero !== undefined ? this.itemConfigs.get(itemNumero) : undefined;
    const isItemActive = itemCfg ? itemCfg.ativo : this.isActive;

    if (!isItemActive && !this.isActive) return;

    const stopLossMinimo = Number(
      stopLossParam ?? itemCfg?.lanceMinimoPermitido ?? this.lanceMinimoPermitido ?? 0
    );
    const decrementoMinimo = Number(
      decrementoParam ?? itemCfg?.decrementoMinimo ?? this.decrementoMinimo ?? 1
    );
    const menorLanceConcorrente = valorMercado;

    this.emitLog(
      `[MERCADO] Concorrente cobriu oferta: R$ ${menorLanceConcorrente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${itemNumero !== undefined ? ` (Item #${itemNumero})` : ''}. Restam ${tempoRestante}s`,
      'info'
    );

    // REGRA DE OURO #1: Caso o menor lance do mercado já tenha rompido o piso mínimo da empresa:
    // Emite bloqueio 403 Stop-Loss e não cobre!
    if (menorLanceConcorrente <= stopLossMinimo) {
      if (itemNumero !== undefined) {
        this.pausar(itemNumero);
      } else {
        this.pausar();
      }

      const errorPayload: SocketBidError = {
        statusCode: 403,
        error: 'Forbidden',
        code: 'STOP_LOSS_VIOLATION',
        message: `BLOQUEIO DE SEGURANÇA (403 Stop-Loss): O menor lance do mercado (R$ ${menorLanceConcorrente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) rompeu ou igualou seu piso de Stop-Loss (R$ ${stopLossMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${itemNumero !== undefined ? ` no Item #${itemNumero}` : ''}. Cobertura bloqueada para proteger a rentabilidade.`,
        itemNumero,
        bid_amount: menorLanceConcorrente,
        stop_loss_minimo: stopLossMinimo,
        margem_calculada: 0,
        timestamp: new Date().toISOString(),
      };

      this.socket.emit('bid_error', errorPayload);
      this.socket.emit('margem_atingida', {
        itemNumero,
        valorMercado: menorLanceConcorrente,
        lanceMinimoPermitido: stopLossMinimo,
      });

      this.emitLog(
        `[BLOQUEIO 403 STOP-LOSS] Menor lance concorrente (R$ ${menorLanceConcorrente.toFixed(2)}) violou o piso mínimo (R$ ${stopLossMinimo.toFixed(2)}). Automação interrompida.`,
        'alert'
      );
      return;
    }

    // REGRA DE OURO #2: Cobertura Automática Determinística:
    // novoLance = Math.max(stopLossMinimo, menorLanceConcorrente - decrementoMinimo)
    const novoLance = Number(
      Math.max(stopLossMinimo, menorLanceConcorrente - decrementoMinimo).toFixed(2)
    );

    if (novoLance < stopLossMinimo) {
      this.emitLog(
        `[BLOQUEIO 403 STOP-LOSS] Lance calculado violaria o piso de Stop-Loss (R$ ${stopLossMinimo.toFixed(2)}). Operação abortada.`,
        'alert'
      );
      return;
    }

    const simulation = calcularSimulacaoBdi({
      custoInsumos: itemCfg?.custoInsumos || 0,
      bidAmount: novoLance,
      margemMinimaStopLoss: 5,
    });

    const bidRecord: BidRecord = {
      id: `bid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pregaoId: pregaoId || 'arena-geral',
      itemNumero,
      bid_amount: novoLance,
      licitanteNome: socketUser?.nome || 'Minha Empresa (Você - Robô)',
      isOwnBid: true,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      splitPaymentRetido: simulation.splitPayment.totalRetidoFonte,
      receitaLiquida: simulation.receitaLiquidaAposSplit,
      lucroLiquido: simulation.lucroLiquido,
      margemLiquida: simulation.margemLiquidaPercentual,
      status: 'CONFIRMADO',
    };

    // Emite imediatamente bid_confirmed e lance_validado
    this.socket.emit('bid_confirmed', bidRecord);
    this.socket.emit('lance_validado', {
      pregaoId: bidRecord.pregaoId,
      itemNumero,
      valor: novoLance,
      bidRecord,
    });

    this.socket.broadcast.emit('bid_placed', {
      ...bidRecord,
      isOwnBid: false,
      status: 'LIDERANDO',
    });

    this.emitLog(
      `[COBERTURA AUTOMÁTICA] Lance disparado: R$ ${novoLance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${itemNumero !== undefined ? ` (Item #${itemNumero})` : ''} cobrindo menor lance de R$ ${menorLanceConcorrente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      'action'
    );
  }

  private emitLog(mensagem: string, type: 'info' | 'system' | 'action' | 'alert' = 'info') {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    this.socket.emit('robo_log', {
      id: `${Date.now()}-${randomUUID()}`,
      time,
      text: mensagem,
      type,
    });
  }
}

