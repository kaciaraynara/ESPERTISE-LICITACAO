import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { isDatabaseConfigured, isProduction } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __expertisePrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __expertisePgPool: Pool | undefined;
}

export function getPrismaClient() {
  if (!isDatabaseConfigured()) {
    if (isProduction()) {
      throw new Error('DATABASE_URL nao configurada para uso do Prisma em producao.');
    }
    throw new Error('DATABASE_URL nao configurada para uso do Prisma.');
  }

  if (!global.__expertisePrisma) {
    const connectionString = process.env.DATABASE_URL as string;

    // Dimensionamento do Pool e Timeouts para Concorrência em Produção (PgBouncer)
    const maxConnections = Number(process.env.DB_POOL_MAX) || (isProduction() ? 25 : 10);
    const idleTimeoutMillis = Number(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000;
    const connectionTimeoutMillis = Number(process.env.DB_POOL_CONN_TIMEOUT_MS) || 10000;

    const pool = new Pool({
      connectionString,
      max: maxConnections,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      keepAlive: true,
    });

    pool.on('error', (err) => {
      console.error('[DATABASE_POOL_ERROR] Erro inesperado em cliente ocioso do pool PgBouncer:', err.message);
    });

    global.__expertisePgPool = pool;

    const adapter = new PrismaPg(pool);

    global.__expertisePrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    console.info(
      `[DATABASE_POOL] Conexão PgBouncer inicializada com sucesso (max: ${maxConnections}, idleTimeout: ${idleTimeoutMillis}ms, connTimeout: ${connectionTimeoutMillis}ms).`,
    );
  }

  return global.__expertisePrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient() as any;
    const value = client[prop as keyof PrismaClient];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export async function disconnectPrisma() {
  if (global.__expertisePrisma) {
    await global.__expertisePrisma.$disconnect();
    global.__expertisePrisma = undefined;
  }
  if (global.__expertisePgPool) {
    await global.__expertisePgPool.end();
    global.__expertisePgPool = undefined;
  }
}
