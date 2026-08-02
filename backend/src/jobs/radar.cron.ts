import { setupDataPlatformWorkers } from '@services/data-platform';
import { setupCndRenewalCron } from './cnd-renewal.cron';
import { setupPrivacyJob } from './privacy.job';

function isCronEnabled(value?: string | null): boolean {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Configura apenas os jobs de produção suportados pelo sistema Expertise.
 * A ingestão de oportunidades pertence exclusivamente à Data Platform.
 */
export function setupCronJobs(): void {
  const cronJobsEnabled = isCronEnabled(process.env.CRON_JOBS_ENABLED)
    || isCronEnabled(process.env.ENABLE_CRON_JOBS);

  if (!cronJobsEnabled) {
    console.log(JSON.stringify({
      event: 'CRON_JOBS_DISABLED',
      reason: 'CRON_JOBS_ENABLED_NOT_TRUE',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  setupCndRenewalCron();
  setupPrivacyJob();
  setupDataPlatformWorkers();
}
