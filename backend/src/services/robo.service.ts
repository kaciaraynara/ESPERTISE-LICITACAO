import { randomUUID } from 'crypto';
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
    
    this.emitLog(`[CENTRAL DE ESTRATÉGIA] Sessão iniciada. Piso de proteção configurado em R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}. Operação manual assistida.`, 'system');
    this.socket.emit('robo_status', { ativo: true, estrategia: this.estrategia });
  }

  public pausar() {
    if (!this.isActive) return;
    this.isActive = false;
    this.emitLog('[CENTRAL DE ESTRATÉGIA] Monitoramento tático pausado.', 'alert');
    this.socket.emit('robo_status', { ativo: false });
  }

  public atualizarEstrategia(payload: { estrategia: EstrategiaType }) {
    this.estrategia = payload.estrategia;
    this.emitLog(`[ESTRATÉGIA] Perfil tático atualizado para: ${this.estrategia.toUpperCase()}.`, 'system');
    this.socket.emit('robo_status', { ativo: this.isActive, estrategia: this.estrategia });
  }

  public processarLanceManual(payload: { valor: number }) {
    this.emitLog(`[ANÁLISE DE MARGEM] Avaliando proposta manual de R$ ${payload.valor.toLocaleString('pt-BR')}...`, 'info');
    
    if (payload.valor <= this.lanceMinimoPermitido) {
      this.emitLog(`[BLOQUEIO DE SEGURANÇA] Lance manual de R$ ${payload.valor.toLocaleString('pt-BR')} viola o piso estipulado de R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}.`, 'alert');
      return;
    }

    this.valorAtualDisputa = payload.valor;
    this.emitLog(`[LANCE VALIDADO] Oferta de R$ ${payload.valor.toLocaleString('pt-BR')} aprovada dentro da margem segura. Registre este valor no portal oficial da disputa.`, 'action');
    this.socket.emit('lance_validado', { valor: this.valorAtualDisputa });
  }

  public processarNovoLanceOponente(valorMercado: number, tempoRestante: number) {
    if (!this.isActive) return;

    this.emitLog(`[CENÁRIO INFORMADO] Valor concorrente informado: R$ ${valorMercado.toLocaleString('pt-BR')}. Tempo de rodada: ${tempoRestante}s`, 'info');
    this.valorAtualDisputa = valorMercado;

    if (valorMercado <= this.lanceMinimoPermitido) {
      this.pausar();
      this.emitLog(`[ALERTA DE MARGEM] O valor informado (R$ ${valorMercado.toLocaleString('pt-BR')}) atingiu o piso de segurança (R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}). Estratégia recomenda não cobrir para proteger a rentabilidade.`, 'alert');
      this.socket.emit('margem_atingida', { valorMercado, lanceMinimoPermitido: this.lanceMinimoPermitido });
      return;
    }

    let sugestaoLance = 0;

    switch (this.estrategia) {
      case 'agressivo':
        sugestaoLance = valorMercado - 10;
        break;
      case 'conservador':
        sugestaoLance = valorMercado - 0.01;
        break;
      case 'sniper':
        sugestaoLance = valorMercado - 5;
        break;
    }

    sugestaoLance = Number(sugestaoLance.toFixed(2));

    if (sugestaoLance <= this.lanceMinimoPermitido) {
      this.emitLog(`[ALERTA DE MARGEM] Sugestão de lance violaria o piso de segurança (R$ ${this.lanceMinimoPermitido.toLocaleString('pt-BR')}). Intervenção recomendada: manter posição ou avaliar lote.`, 'alert');
      return;
    }

    this.emitLog(`[SUGESTÃO TÁTICA (${this.estrategia.toUpperCase()})] Lance recomendado para cobrir: R$ ${sugestaoLance.toLocaleString('pt-BR')}. A submissão deve ser feita manualmente pelo operador no portal oficial.`, 'system');
    this.socket.emit('sugestao_lance', { valor: sugestaoLance, estrategia: this.estrategia });
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

