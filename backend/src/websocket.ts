import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { RoboSocketService, SetupRoboPayload, EstrategiaType } from './services/robo.service';
import { getAllowedOrigins, getJwtSecret } from './shared/runtime-config';
import { getBooleanEnv } from './config/env';

type PortalRole = 'fornecedor';

type SocketUser = {
  id?: string;
  email?: string;
  nome?: string | null;
  role: PortalRole;
  plano?: string;
};

function normalizeRole(decoded: any): PortalRole {
  return 'fornecedor';
}

function normalizeSocketUser(decoded: any): SocketUser {
  return {
    ...decoded,
    role: normalizeRole(decoded),
  };
}

/**
 * Bootstraps the WebSockets configuration and binds it to the HTTP server.
 */
export default function setupSockets(httpServer: http.Server) {
  if (!getBooleanEnv('ENABLE_BID_ROBOT', false)) {
    return undefined;
  }

  const allowedOrigins = getAllowedOrigins();

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const rawToken = socket.handshake.auth.token || socket.handshake.headers.authorization;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token) {
      return next(new Error('Autenticacao necessaria para o Cockpit'));
    }

    try {
      const decoded = jwt.verify(String(token).replace('Bearer ', ''), getJwtSecret()) as any;

      if (decoded.token_type && decoded.token_type !== 'access') {
        return next(new Error('Token incompativel com conexao em tempo real'));
      }

      (socket as any).user = normalizeSocketUser(decoded);
      return next();
    } catch {
      return next(new Error('Token invalido ou expirado'));
    }
  });

  io.on('connection', (socket) => {
    const socketUser = (socket as any).user as SocketUser | undefined;

    if (socketUser?.role !== 'fornecedor') {
      socket.emit('auth_error', {
        message: 'Arena de Disputa exclusiva para o portal do licitante.',
        role: socketUser?.role ?? 'fornecedor',
      });
      socket.disconnect(true);
      return;
    }

    console.log(`[Socket.io] Cliente conectado ao Cockpit: ${socket.id} | role=${socketUser.role}`);

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
      console.log(`[Socket.io] Cliente desconectado do Cockpit: ${socket.id}`);
      roboService.pausar();
    });
  });
}
