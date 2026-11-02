import cron from 'node-cron';
import { planResetWorker } from '../workers/plan-reset.worker';

// Dispara no 1º dia de cada mês à 00:00 (Fuso de Brasília)
const DEFAULT_RESET_SCHEDULE = '0 0 1 * *';
const TIMEZONE = 'America/Sao_Paulo';

export function setupPlanResetCron(): cron.ScheduledTask {
  const schedule = process.env.PLAN_RESET_CRON || DEFAULT_RESET_SCHEDULE;

  console.info(`[PlanResetCron] Cron agendado com expressão: "${schedule}" (${TIMEZONE}).`);

  return cron.schedule(
    schedule,
    async () => {
      try {
        await planResetWorker.resetMonthlyUsage();
      } catch (err: any) {
        console.error('[PlanResetCron] Falha ao executar reset mensal de planos:', err?.message || err);
      }
    },
    { timezone: TIMEZONE }
  );
}
