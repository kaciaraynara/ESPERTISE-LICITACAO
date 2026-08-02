import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { isDatabaseConfigured, isProduction } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __expertisePrisma: PrismaClient | undefined;
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
    const adapter = new PrismaPg({ connectionString });

    global.__expertisePrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
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
}
