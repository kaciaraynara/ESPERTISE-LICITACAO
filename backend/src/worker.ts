import 'dotenv/config';
import { assertProductionConfig } from './config/env';
import { prisma, disconnectPrisma } from './database/prisma';
import { setupCronJobs } from './jobs/radar.cron';

async function startWorker() {
  assertProductionConfig();
  await prisma.$queryRaw`SELECT 1`;
  setupCronJobs();
  console.info(JSON.stringify({ event: 'EXPERTISE_WORKER_STARTED', pid: process.pid }));
}

async function shutdown(signal: string) {
  console.info(JSON.stringify({ event: 'EXPERTISE_WORKER_STOPPING', signal }));
  await disconnectPrisma();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

startWorker().catch(async (error) => {
  console.error(JSON.stringify({
    event: 'EXPERTISE_WORKER_START_FAILED',
    error: error instanceof Error ? error.message : 'unknown',
  }));
  await disconnectPrisma();
  process.exit(1);
});
