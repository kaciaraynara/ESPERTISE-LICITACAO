import cron from 'node-cron';
import { prisma } from '../database/prisma';
import { isDatabaseConfigured } from '../config/env';

export interface CndRenewalCandidate {
  userId: string;
  documentId: string;
  companyId: string | null;
  nome: string;
  tipo: string;
  validade: string;
}

const DEFAULT_CRON = '0 0 * * *';
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const RENEWAL_WINDOW_DAYS = 15;

export function setupCndRenewalCron(): void {
  const cronExpression = process.env.CND_RENEWAL_CRON || DEFAULT_CRON;
  const timezone = process.env.CRON_TZ || DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    throw new Error(`CND_RENEWAL_CRON invalido: ${cronExpression}`);
  }

  cron.schedule(
    cronExpression,
    async () => {
      await runCndRenewalScan();
    },
    { timezone },
  );

  console.log(JSON.stringify({
    event: 'CND_RENEWAL_CRON_CONFIGURED',
    cron: cronExpression,
    timezone,
    renewalWindowDays: RENEWAL_WINDOW_DAYS,
    timestamp: new Date().toISOString(),
  }));
}

export async function runCndRenewalScan(): Promise<CndRenewalCandidate[]> {
  const startedAt = new Date();
  const currentDate = startOfDay(startedAt);
  const thresholdDate = endOfDay(addDays(currentDate, RENEWAL_WINDOW_DAYS));

  if (!isDatabaseConfigured()) {
    const error = new Error('DATABASE_URL_NOT_CONFIGURED');
    console.error(JSON.stringify({
      event: 'CND_RENEWAL_SCAN_FAILED',
      reason: 'DATABASE_URL_NOT_CONFIGURED',
      thresholdDate: thresholdDate.toISOString(),
      timestamp: startedAt.toISOString(),
    }));
    throw error;
  }

  try {
    const documents = await prisma.document.findMany({
      where: {
        tipo: { equals: 'CND', mode: 'insensitive' },
        validade: { lte: thresholdDate },
      },
      select: {
        id: true,
        userId: true,
        companyId: true,
        nome: true,
        tipo: true,
        validade: true,
      },
      orderBy: [
        { validade: 'asc' },
        { criadoEm: 'asc' },
      ],
    });

    const candidates = documents.reduce<CndRenewalCandidate[]>((result, documento) => {
      if (!documento.validade) return result;

      result.push({
        userId: documento.userId,
        documentId: documento.id,
        companyId: documento.companyId,
        nome: documento.nome,
        tipo: documento.tipo,
        validade: documento.validade.toISOString(),
      });

      return result;
    }, []);

    console.log(JSON.stringify({
      event: 'CND_RENEWAL_SCAN_COMPLETED',
      currentDate: currentDate.toISOString(),
      thresholdDate: thresholdDate.toISOString(),
      total: candidates.length,
      candidates,
      documentsToRenew: candidates.map((candidate) => ({
        userId: candidate.userId,
        documentId: candidate.documentId,
        nome: candidate.nome,
      })),
      durationMs: Date.now() - startedAt.getTime(),
      timestamp: new Date().toISOString(),
    }));

    return candidates;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'CND_RENEWAL_SCAN_FAILED',
      thresholdDate: thresholdDate.toISOString(),
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    }));
    throw error;
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}
