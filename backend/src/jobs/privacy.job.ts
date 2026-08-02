import cron from 'node-cron';
import { randomBytes } from 'crypto';
import { prisma } from '../database/prisma';

const DEFAULT_RETENTION_DAYS = 30;

export async function anonymizeInactiveAccounts(now = new Date()) {
  const retentionDays = Number(process.env.LGPD_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('LGPD_RETENTION_DAYS deve ser um inteiro positivo.');
  }

  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  const accounts = await prisma.user.findMany({
    where: { deletedAt: { lte: cutoff }, anonymizedAt: null },
    select: { id: true },
    take: 500,
  });

  for (const account of accounts) {
    const anonymousEmail = `anon-${account.id}@privacy.invalid`;
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: account.id } }),
      prisma.user.update({
        where: { id: account.id },
        data: {
          email: anonymousEmail,
          emailNormalized: anonymousEmail,
          nome: null,
          telefone: null,
          passwordHash: `ANONYMIZED:${randomBytes(32).toString('hex')}`,
          emailVerificado: false,
          aceiteLgpd: false,
          oabNumero: null,
          oabUf: null,
          crcNumero: null,
          crcUf: null,
          anonymizedAt: now,
        },
      }),
    ]);
  }

  return { anonymized: accounts.length, cutoff };
}

export function setupPrivacyJob() {
  const expression = process.env.PRIVACY_CRON ?? '15 3 * * *';
  if (!cron.validate(expression)) throw new Error(`PRIVACY_CRON invalido: ${expression}`);

  cron.schedule(expression, async () => {
    try {
      const result = await anonymizeInactiveAccounts();
      console.info(JSON.stringify({ event: 'LGPD_ANONYMIZATION_COMPLETED', anonymized: result.anonymized }));
    } catch (error) {
      console.error(JSON.stringify({ event: 'LGPD_ANONYMIZATION_FAILED', error: error instanceof Error ? error.message : 'unknown' }));
    }
  });
}
