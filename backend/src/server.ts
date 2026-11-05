import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './config/openapi';
import { assertProductionConfig, getBooleanEnv } from './config/env';
import { prisma } from './database/prisma';
import routes from './routes/index';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './shared/middlewares/error-handler.middleware';
import { isOriginAllowed } from './shared/runtime-config';
import setupSockets from './websocket';
import { correlationIdMiddleware } from './shared/middlewares/correlation-id.middleware';
import { iniciarRadarDiarioCron } from './jobs/radar.cron';
import { setupCndRenewalCron } from './jobs/cnd-renewal.cron';
import { securityHeadersMiddleware } from './middlewares/security';

const app = express();

app.use(correlationIdMiddleware);
app.set('trust proxy', 1);
app.disable('x-powered-by');
assertProductionConfig();

const bidRobotEnabled = getBooleanEnv('ENABLE_BID_ROBOT', false);

// 1. Segurança e CORS (Remoção de Fingerprinting + MIME NoSniff + Filtros XSS Globais)
app.use(securityHeadersMiddleware);

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error('Origem não permitida pelo CORS.') as Error & {
      statusCode?: number;
      code?: string;
    };
    error.statusCode = 403;
    error.code = 'CORS_ORIGIN_DENIED';
    callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-company-id',
    'X-Company-Id',
    'x-request-id',
    'x-correlation-id',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['x-request-id', 'x-correlation-id', 'Content-Disposition'],
  credentials: true,
  optionsSuccessStatus: 204,
}));

// 2. Health Checks
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
};

const readinessHandler = async (_req: express.Request, res: express.Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch {
    return res.status(503).json({
      status: 'not_ready',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);
app.get('/health/readiness', readinessHandler);
app.get('/api/v1/health/readiness', readinessHandler);

// 3. Documentação Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'EXPERTISE API',
}));

// 4. Rate Limiter Global
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Muitas requisições deste IP. Tente novamente mais tarde.',
  },
}));

// 5. Parser de Body (DEVE vir antes do registro das rotas)
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buffer) => {
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buffer;
    }
  },
}));

// 6. Roteador Principal da API e Aliases de Compatibilidade
app.use('/api/v1', routes);
app.use('/api', routes);
app.use('/auth', authRoutes);

// 7. TRATAMENTO CENTRALIZADO DE ERROS (Sempre o último middleware antes do servidor)
app.use(errorHandler);

// 8. Inicialização do Servidor HTTP / WebSockets
const port = Number(process.env.PORT) || 3001;
const server = http.createServer(app);

if (bidRobotEnabled) {
  setupSockets(server);
}

server.listen(port, () => {
  console.info(JSON.stringify({
    event: 'EXPERTISE_API_STARTED',
    port,
    environment: process.env.NODE_ENV || 'development',
    bidRobotEnabled,
  }));
  iniciarRadarDiarioCron();
  setupCndRenewalCron();
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EADDRINUSE') {
    console.error('[EXPERTISE_API_START_FAILED]', error);
    process.exit(1);
  }

  const probe = http.get(
    { hostname: '127.0.0.1', port, path: '/health', timeout: 2000 },
    (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode === 200 && body.trim() === '{"status":"ok"}') {
          console.info(JSON.stringify({
            event: 'EXPERTISE_API_ALREADY_RUNNING',
            port,
            message: `A API já está ativa na porta ${port}. Use npm run dev:status para verificar ou npm run dev:restart para reiniciar.`,
          }));
          process.exit(0);
        }

        console.error(`[EXPERTISE_API_START_FAILED] A porta ${port} está ocupada por outro serviço.`);
        process.exit(1);
      });
    },
  );

  probe.on('timeout', () => {
    probe.destroy(new Error('Health check timed out.'));
  });
  probe.on('error', () => {
    console.error(`[EXPERTISE_API_START_FAILED] A porta ${port} está ocupada e o serviço existente não respondeu ao health check.`);
    process.exit(1);
  });
});

export default app;