import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './config/openapi';
import { assertProductionConfig, getBooleanEnv } from './config/env';
import { prisma } from './database/prisma';
import routes from './routes/index';
import { errorMiddleware } from './shared/middlewares/error.middleware';
import { PostgresRateLimitStore } from './shared/middlewares/postgres-rate-limit.store';
import { isOriginAllowed } from './shared/runtime-config';
import setupSockets from './websocket';

const app = express();

// Configuração de Proxy para leitura de IP real na Vercel (1 salto)
app.set('trust proxy', 1);

app.disable('x-powered-by');
assertProductionConfig();

const bidRobotEnabled = getBooleanEnv('ENABLE_BID_ROBOT', false);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

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
  credentials: true,
}));

// Liveness check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness check
app.get('/health/readiness', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ready' });
  } catch {
    return res.status(503).json({
      status: 'not_ready',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'EXPERTISE API',
}));

// Rate Limiter com PostgreSQL Store
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore('api-ip'),
  passOnStoreError: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Muitas requisições deste IP. Tente novamente mais tarde.',
  },
}));

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buffer) => {
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buffer;
    }
  },
}));

app.use('/api/v1', routes);
app.use(errorMiddleware);

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
});