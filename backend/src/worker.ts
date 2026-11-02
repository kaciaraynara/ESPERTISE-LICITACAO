import 'dotenv/config';
import { assertProductionConfig } from './config/env';
import { prisma, disconnectPrisma } from './database/prisma';
import { setupCronJobs } from './jobs/radar.cron';
import { NotificationsWorker } from './workers/notifications.worker';
import {
  startContractMonitorWorker,
  type ContractMonitorRuntime,
} from './workers/contract-monitor.worker';

let contractMonitorRuntime: ContractMonitorRuntime | undefined;

async function startWorker() {
  assertProductionConfig();
  await prisma.$queryRaw`SELECT 1`;

  contractMonitorRuntime = await startContractMonitorWorker();

  // Inicializa todos os cron jobs no worker isolado
  setupCronJobs();

  // Executa uma varredura inicial de prazos no arranque do worker se configurado
  if (process.env.RUN_DEADLINE_SCAN_ON_STARTUP === 'true') {
    console.info(JSON.stringify({
      event: 'WORKER_STARTUP_DEADLINE_SCAN_TRIGGERED',
      timestamp: new Date().toISOString(),
    }));
    const notificationsWorker = new NotificationsWorker();
    notificationsWorker.processUpcomingDeadlines().catch((err) => {
      console.error('[Worker] Falha na verificação inicial de prazos:', err?.message || err);
    });
  }

  console.info(JSON.stringify({
    event: 'EXPERTISE_WORKER_STARTED',
    pid: process.pid,
    environment: process.env.NODE_ENV || 'development',
  }));
}

async function shutdown(signal: string) {
  console.info(JSON.stringify({ event: 'EXPERTISE_WORKER_STOPPING', signal }));
  let exitCode = 0;
  try {
    await contractMonitorRuntime?.close();
  } catch (error) {
    exitCode = 1;
    console.error('[Worker] Falha ao encerrar o monitor contratual:', error);
  }
  try {
    await disconnectPrisma();
  } catch (error) {
    exitCode = 1;
    console.error('[Worker] Falha ao desconectar o Prisma:', error);
  }
  process.exit(exitCode);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Worker] Uncaught Exception:', error);
});

startWorker().catch(async (error) => {
  console.error(JSON.stringify({
    event: 'EXPERTISE_WORKER_START_FAILED',
    error: error instanceof Error ? error.message : 'unknown',
  }));
  try {
    await contractMonitorRuntime?.close();
  } catch (closeError) {
    console.error('[Worker] Falha ao limpar o monitor após erro de inicialização:', closeError);
  }
  try {
    await disconnectPrisma();
  } catch (disconnectError) {
    console.error('[Worker] Falha ao desconectar o Prisma após erro de inicialização:', disconnectError);
  }
  process.exit(1);
});
