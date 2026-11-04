import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { RoboSocketService, SetupRoboPayload, EstrategiaType } from './services/robo.service';
import { getAllowedOrigins, getJwtSecret } from './shared/runtime-config';
import { getBooleanEnv } from './config/env';
import { calcularSimulacaoBdi } from './services/tax-bdi.service';
import { PlaceBidPayload, BidRecord, SocketBidError } from './types/war-room.types';

type PortalRole = 'fornecedor';

type SocketUser = {
  id?: string;
  email?: string;
  nome?: string | null;
  role: PortalRole;
  plano?: string;
};

function normalizeRole(_decoded: any): PortalRole {
  return 'fornecedor';
}

function normalizeSocketUser(decoded: any): SocketUser {
  return {
    ...decoded,
    role: normalizeRole(decoded),
  };
}

/**
 * Inicializa e gerencia a infraestrutura de WebSockets em tempo real (Socket.io)
 * Inclui o Cockpit de Lances e a Sala de Guerra com proteção de Stop-Loss.
 */
export default function setupSockets(httpServer: http.Server) {
  const allowedOrigins = getAllowedOrigins();

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware de Autenticação da Conexão Socket
  io.use((socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token) {
      // Em desenvolvimento ou testes internos, permite conexão com credencial de convidado
      if (process.env.NODE_ENV !== 'production') {
        (socket as any).user = { id: 'dev-user', role: 'fornecedor', nome: 'Operador Sala de Guerra' };
        return next();
      }
      return next(new Error('Autenticacao necessaria para a Sala de Guerra'));
    }

    try {
      const cleanToken = String(token).replace('Bearer ', '');
      const decoded = jwt.verify(cleanToken, getJwtSecret()) as any;

      if (decoded.token_type && decoded.token_type !== 'access') {
        return next(new Error('Token incompativel com conexao em tempo real'));
      }

      (socket as any).user = normalizeSocketUser(decoded);
      return next();
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        (socket as any).user = { id: 'dev-user', role: 'fornecedor', nome: 'Operador Sala de Guerra' };
        return next();
      }
      return next(new Error('Token invalido ou expirado'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const socketUser = (socket as any).user as SocketUser | undefined;

    if (socketUser?.role !== 'fornecedor') {
      socket.emit('auth_error', {
        message: 'Sala de Guerra e Cockpit exclusivos para licitantes credenciados.',
        role: socketUser?.role ?? 'fornecedor',
      });
      socket.disconnect(true);
      return;
    }

    console.info(`[Socket.io] Operador conectado à Sala de Guerra: ${socket.id} | ${socketUser.nome || socketUser.email}`);

    // =========================================================================
    // MIDDLEWARE DE PACOTE: PROTEÇÃO INVIOLÁVEL DE STOP-LOSS (403 FORBIDDEN)
    // =========================================================================
    socket.use(([event, data], next) => {
      if (event === 'place_bid') {
        const payload = data as PlaceBidPayload;
        const bidAmount = Number(payload?.bid_amount);

        if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
          const errorPayload: SocketBidError = {
            statusCode: 403,
            error: 'Forbidden',
            code: 'STOP_LOSS_VIOLATION',
            message: 'O valor do lance informado é inválido.',
            bid_amount: 0,
            stop_loss_minimo: 0,
            margem_calculada: 0,
            timestamp: new Date().toISOString(),
          };
          socket.emit('bid_error', errorPayload);
          return next(new Error('403 Forbidden: Valor de lance inválido'));
        }

        // Calcula simulação tributária exata com base no custo de insumos e IVA Dual
        const simulation = calcularSimulacaoBdi({
          custoInsumos: payload.custoInsumos || 0,
          despesasOperacionais: payload.despesasOperacionais,
          margemMinimaStopLoss: payload.margemMinimaPercentual ?? 5,
          bidAmount: bidAmount,
        });

        const stopLossCalculado = payload.stop_loss_minimo
          ? Math.max(payload.stop_loss_minimo, simulation.precoMinimoStopLoss)
          : simulation.precoMinimoStopLoss;

        // Se o valor do lance for MENOR que a margem mínima da empresa (Stop-Loss):
        // BLOQUEIA A EMISSÃO e retorna erro 403 Forbidden pelo socket
        if (bidAmount < stopLossCalculado || simulation.violaStopLoss) {
          console.warn(`[War Room Stop-Loss] 🛑 BLOQUEIO 403: Lance R$ ${bidAmount.toFixed(2)} abaixo do piso de R$ ${stopLossCalculado.toFixed(2)}.`);

          const errorPayload: SocketBidError = {
            statusCode: 403,
            error: 'Forbidden',
            code: 'STOP_LOSS_VIOLATION',
            message: `BLOQUEIO DE SEGURANÇA (403 Forbidden): Lance de R$ ${bidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} viola o piso de Stop-Loss (R$ ${stopLossCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Operação geraria prejuízo após retenção do Split Payment (${simulation.aliquotas.ivaDualTotalPercentual}%).`,
            bid_amount: bidAmount,
            stop_loss_minimo: stopLossCalculado,
            margem_calculada: simulation.margemLiquidaPercentual,
            timestamp: new Date().toISOString(),
          };

          socket.emit('bid_error', errorPayload);
          return next(new Error('403 Forbidden: Lance abaixo do Stop-Loss'));
        }
      }

      return next();
    });

    // =========================================================================
    // LISTENER DA SALA DE GUERRA: `place_bid`
    // =========================================================================
    socket.on('place_bid', (data: PlaceBidPayload) => {
      try {
        const bidAmount = Number(data.bid_amount);
        const simulation = calcularSimulacaoBdi({
          custoInsumos: data.custoInsumos || 0,
          despesasOperacionais: data.despesasOperacionais,
          bidAmount,
        });

        const bidRecord: BidRecord = {
          id: `bid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          pregaoId: data.pregaoId || 'arena-geral',
          bid_amount: bidAmount,
          licitanteNome: data.licitanteNome || socketUser.nome || 'Minha Empresa (Você)',
          isOwnBid: true,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          splitPaymentRetido: simulation.splitPayment.totalRetidoFonte,
          receitaLiquida: simulation.receitaLiquidaAposSplit,
          lucroLiquido: simulation.lucroLiquido,
          margemLiquida: simulation.margemLiquidaPercentual,
          status: 'CONFIRMADO',
        };

        // Confirma o lance para o autor com métricas financeiras completas
        socket.emit('bid_confirmed', bidRecord);

        // Dispara para todos na sala de guerra (broadcasting de mercado)
        const publicBidRecord: BidRecord = {
          ...bidRecord,
          isOwnBid: false,
          status: 'LIDERANDO',
        };

        socket.broadcast.emit('bid_placed', publicBidRecord);
        io.emit('market_update', {
          melhorLance: bidAmount,
          licitanteLider: bidRecord.licitanteNome,
          timestamp: bidRecord.timestamp,
        });

        console.info(`[War Room] ✅ Lance aceito e validado: R$ ${bidAmount.toFixed(2)} por ${bidRecord.licitanteNome}`);
      } catch (err) {
        console.error('[War Room] Erro ao processar lance:', err);
        socket.emit('bid_error', {
          statusCode: 500,
          error: 'InternalServerError',
          message: 'Erro interno ao registrar lance na Sala de Guerra.',
        });
      }
    });

    // Permite que o cliente entre em uma sala específica de pregão
    socket.on('join_war_room', (pregaoId: string) => {
      socket.join(pregaoId);
      socket.emit('joined_room', { pregaoId, status: 'connected' });
    });

    // =========================================================================
    // SERVIÇO ANTERIOR DO ROBÔ DE LANCES (COMPATIBILIDADE PRESERVADA)
    // =========================================================================
    const roboService = new RoboSocketService(socket);

    socket.on('iniciar_robo', (data: SetupRoboPayload) => {
      roboService.iniciar(data);
    });

    socket.on('pausar_robo', () => {
      roboService.pausar();
    });

    socket.on('atualizar_estrategia', (data: { estrategia: EstrategiaType }) => {
      roboService.atualizarEstrategia(data);
    });

    socket.on('lance_manual', (data: { valor: number }) => {
      roboService.processarLanceManual(data);
    });

    socket.on('simular_lance_mercado', (data: { valor: number; tempoRestante: number }) => {
      roboService.processarNovoLanceOponente(data.valor, data.tempoRestante);
    });

    socket.on('disconnect', () => {
      console.info(`[Socket.io] Operador desconectado da Sala de Guerra: ${socket.id}`);
      roboService.pausar();
    });
  });

  return io;
}
