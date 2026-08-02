import { Socket } from 'socket.io';
import { prisma } from '../database/prisma';

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
  valorInicial: number;
  lanceMinimoPermitido: number;
  estrategia?: EstrategiaType;
}

export class RoboSocketService {
  private socket: Socket;
  private isActive: boolean = false;
  private estrategia: EstrategiaType = 'sniper';
  private lanceMinimoPermitido: number = 0;
  private valorAtualDisputa: number = 0;
  
  constructor(socket: Socket) {
    this.socket = socket;
  }

  public iniciar(payload: SetupRoboPayload) {
    this.lanceMinimoPermitido = payload.lanceMinimoPermitido;
    this.valorAtualDisputa = payload.valorInicial;
    if (payload.estrategia) this.estrategia = payload.estrategia;
    this.isActive = true;
    
    this.emitLog(`[SISTEMA] Robô Expertise iniciado. Stop-loss ativado em R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}.`, 'system');
    this.socket.emit('robo_status', { ativo: true, estrategia: this.estrategia });
  }

  public pausar() {
    if (!this.isActive) return;
    this.isActive = false;
    this.emitLog('[EMERGÊNCIA] Robô foi pausado. Operação retornada para controle estritamente manual.', 'alert');
    this.socket.emit('robo_status', { ativo: false });
  }

  public atualizarEstrategia(payload: { estrategia: EstrategiaType }) {
    this.estrategia = payload.estrategia;
    this.emitLog(`[SISTEMA] Estratégia de Inteligência alterada para: ${this.estrategia.toUpperCase()}.`, 'system');
    this.socket.emit('robo_status', { ativo: this.isActive, estrategia: this.estrategia });
  }

  public processarLanceManual(payload: { valor: number }) {
    this.emitLog(`[MANUAL] Lance recebido do Cockpit: R$ ${payload.valor.toLocaleString('pt-BR')}. Analisando margem...`, 'info');
    
    if (payload.valor <= this.lanceMinimoPermitido) {
      this.emitLog(`[BLOQUEADO] Operação negada! O lance manual violaria o piso de R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}.`, 'alert');
      return;
    }

    this.enviarLance(payload.valor);
  }

  public processarNovoLanceOponente(valorMercado: number, tempoRestante: number) {
    if (!this.isActive) return;

    this.emitLog(`[SCAN] Concorrente cobriu a oferta para R$ ${valorMercado.toLocaleString('pt-BR')}. Tempo de rodada: ${tempoRestante}s`, 'info');
    this.valorAtualDisputa = valorMercado;

    if (valorMercado <= this.lanceMinimoPermitido) {
      this.pausar();
      this.emitLog(`[ALERTA DE MARGEM] O mercado (R$ ${valorMercado.toLocaleString('pt-BR')}) atingiu seu piso de proteção (R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}). O Robô parou a disputa para blindar seu lucro.`, 'alert');
      this.socket.emit('margem_atingida', { valorMercado, lanceMinimoPermitido: this.lanceMinimoPermitido });
      return;
    }

    let novoLance = 0;

    switch (this.estrategia) {
      case 'agressivo':
        novoLance = valorMercado - 10;
        this.emitLog(`[IA: AGRESSIVO] Preparando ataque instantâneo. Calculando cobertura agressiva para R$ ${novoLance.toLocaleString('pt-BR')}.`, 'system');
        this.enviarLance(novoLance);
        break;

      case 'conservador':
        novoLance = valorMercado - 0.01;
        this.emitLog(`[IA: CONSERVADOR] Margem segura. Cobrindo lance oponente com mínima dízima possível: R$ ${novoLance.toLocaleString('pt-BR')}.`, 'system');
        this.enviarLance(novoLance);
        break;

      case 'sniper':
        if (tempoRestante <= 3) {
          novoLance = valorMercado - 5;
          this.emitLog(`[IA: SNIPER] Últimos ${tempoRestante}s! Disparando tiro letal de precisão: R$ ${novoLance.toLocaleString('pt-BR')}.`, 'system');
          this.enviarLance(novoLance);
        } else {
          this.emitLog(`[IA: SNIPER] Tempo restante longo (${tempoRestante}s). Ocultando nosso interesse. Aguardando a zona de abate.`, 'info');
        }
        break;
    }
  }

  private enviarLance(valor: number) {
    if (valor <= this.lanceMinimoPermitido) {
      this.pausar();
      this.emitLog(`[ERRO CRÍTICO AFASTADO] Falha matemática detectada no cálculo da IA! Tentativa de oferta de R$ ${valor} violaria o stop-loss. Robô desativado em modo de emergência.`, 'alert');
      return;
    }
    
    setTimeout(() => {
      if (!this.isActive) return;
      this.valorAtualDisputa = valor;
      this.emitLog(`[AÇÃO] 🚀 Lance protocolado no provedor com sucesso: R$ ${valor.toLocaleString('pt-BR')}. Somos o primeiro lugar temporário.`, 'action');
      this.socket.emit('lance_enviado', { valor: this.valorAtualDisputa });
    }, 400);
  }

  private emitLog(mensagem: string, type: 'info' | 'system' | 'action' | 'alert' = 'info') {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    this.socket.emit('robo_log', {
      id: Date.now() + Math.random(),
      time,
      text: mensagem,
      type
    });
  }
}

