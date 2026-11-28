import 'dotenv/config';
import { prisma } from '../database/prisma';
import { processarFilaEditaisAbertos } from '../services/edital-queue.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stopRequested = false;

function registerShutdownHandlers() {
  const handleSignal = (signal: string) => {
    console.info(`[EditalReaderWorker] Sinal ${signal} recebido. Finalizando ciclo atual com seguranca...`);
    stopRequested = true;
  };
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const once = args.includes('--once');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchFromArg = batchArg ? Number(batchArg.split('=')[1]) : undefined;
  const batchLimit = Math.min(
    50,
    Math.max(1, Number(batchFromArg || process.env.EDITAL_WORKER_BATCH_LIMIT || 25)),
  );
  const maxRssMb = Math.max(200, Number(process.env.EDITAL_WORKER_MAX_RSS_MB || 420));
  const intervalMs = Math.max(3000, Number(process.env.EDITAL_WORKER_INTERVAL_MS || 15000));
  const maxIterations = Number(process.env.EDITAL_WORKER_MAX_ITERATIONS || 0);
  return { once, batchLimit, maxRssMb, intervalMs, maxIterations };
}

async function main() {
  registerShutdownHandlers();
  const { once, batchLimit, maxRssMb, intervalMs, maxIterations } = parseArgs();

  console.info(
    `[EditalReaderWorker] Iniciado (modo=${once ? 'ONCE' : 'CONTINUO'}, batchLimit=${batchLimit}, maxRssMb=${maxRssMb}).`,
  );

  let iteracao = 0;
  try {
    while (!stopRequested) {
      iteracao += 1;
      const inicio = Date.now();
      const res = await processarFilaEditaisAbertos({
        batchLimit,
        maxRssMb,
      });
      const duracaoSeg = ((Date.now() - inicio) / 1000).toFixed(1);

      console.info(
        `[EditalReaderWorker] Ciclo #${iteracao} concluido em ${duracaoSeg}s | processados=${res.processados} | ignorados=${res.ignorados} | rss=${res.memoriaRssMb}MB`,
      );

      if (once) break;
      if (maxIterations > 0 && iteracao >= maxIterations) break;
      if (stopRequested) break;

      const esperaMs = res.processados === 0 ? Math.max(intervalMs, 60000) : intervalMs;
      await sleep(esperaMs);
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    console.info('[EditalReaderWorker] Conexao Prisma encerrada. Worker finalizado.');
  }
}

void main().catch((err) => {
  console.error('[EditalReaderWorker] Falha fatal:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
