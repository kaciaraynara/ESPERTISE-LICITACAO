import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../database/prisma';

const QUEUE_NAME = 'contract-monitor';
const SCHEDULE_ID = 'daily-contract-monitor';
const GUARANTEE_ALERT_DAYS = [60, 30, 15] as const;
const EQUILIBRIUM_ALERT_DAYS = [90, 60] as const;
const EQUILIBRIUM_INSTITUTES = ['REAJUSTE', 'REPACTUACAO'] as const;
const EQUILIBRIUM_ALERT_MESSAGE =
  'Prazo decadencial próximo. Inicie seu pedido de Reajuste/Repactuação';
const TIMEZONE = 'America/Sao_Paulo';

type MonitorAlert = {
  companyId: string;
  userId: string;
  targetType: 'GUARANTEE' | 'CONTRACT_EQUILIBRIUM';
  targetId: string;
  alertType: 'GUARANTEE_EXPIRATION' | 'GUARANTEE_RELEASE' | 'CONTRACT_ANNIVERSARY';
  daysBefore: number;
  dueDate: Date;
  dedupeKey: string;
  title: string;
  message: string;
  link: string;
};

type EquilibriumEntry = {
  id: string;
  institute: typeof EQUILIBRIUM_INSTITUTES[number];
  date: Date;
};

function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addYearsClamped(value: Date, years: number): Date {
  const year = value.getUTCFullYear() + years;
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfMonth)));
}

function upcomingAnniversary(anniversaryDate: Date, today: Date): Date {
  const anniversary = dateOnly(anniversaryDate);
  const currentDay = dateOnly(today);
  if (anniversary > currentDay) return anniversary;

  let nextDate = anniversary;
  while (nextDate <= currentDay) {
    nextDate = addYearsClamped(nextDate, 1);
  }
  return nextDate;
}

function nextContractAnniversary(baseDate: Date, today: Date): Date {
  return upcomingAnniversary(addYearsClamped(dateOnly(baseDate), 1), today);
}

function daysUntil(from: Date, to: Date): number {
  return Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000);
}

function alertKey(
  type: MonitorAlert['targetType'],
  id: string,
  alertType: MonitorAlert['alertType'],
  days: number,
  dueDate: Date,
) {
  return `${type}:${id}:${alertType}:${days}:${dateOnly(dueDate).toISOString().slice(0, 10)}`;
}

function closestMilestone(daysRemaining: number, milestones: readonly number[]) {
  return milestones.find((milestone) => daysRemaining <= milestone);
}

export class ContractMonitorWorker {
  public async run(todayInput = new Date()) {
    const today = dateOnly(todayInput);
    const [guarantees, contracts] = await Promise.all([
      prisma.contractGuarantee.findMany({
        where: { status: { in: ['RETIDA', 'PRONTA_RESGATE'] } },
        include: {
          company: { select: { userId: true, razaoSocial: true } },
          contract: { select: { id: true, numeroContrato: true, status: true } },
        },
      }),
      prisma.contract.findMany({
        where: { status: 'ATIVO' },
        include: {
          company: { select: { id: true, userId: true, razaoSocial: true } },
          equilibria: {
            where: { institutoJuridico: { in: [...EQUILIBRIUM_INSTITUTES] } },
            orderBy: { dataAniversario: 'asc' },
          },
        },
      }),
    ]);

    let alertsCreated = 0;
    let guaranteeStatusesUpdated = 0;

    for (const guarantee of guarantees) {
      if (guarantee.status === 'RESGATADA') continue;

      if (guarantee.contract.status === 'ENCERRADO') {
        const result = await this.createGuaranteeReleaseAlert({
          companyId: guarantee.companyId,
          userId: guarantee.company.userId,
          targetType: 'GUARANTEE',
          targetId: guarantee.id,
          alertType: 'GUARANTEE_RELEASE',
          daysBefore: 0,
          dueDate: today,
          dedupeKey: alertKey('GUARANTEE', guarantee.id, 'GUARANTEE_RELEASE', 0, today),
          title: `Garantia pronta para resgate — contrato ${guarantee.contract.numeroContrato}`,
          message: `O contrato ${guarantee.contract.numeroContrato} foi encerrado. A garantia de ${new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(Number(guarantee.valorGarantido))} está pronta para solicitação de devolução.`,
          link: '/fornecedor/contratos',
        });
        alertsCreated += result.alertsCreated;
        guaranteeStatusesUpdated += result.statusesUpdated;
        continue;
      }

      if (guarantee.status !== 'RETIDA' || !guarantee.dataVencimento) continue;

      const dueDate = dateOnly(guarantee.dataVencimento);
      const remaining = daysUntil(today, dueDate);
      if (remaining <= 0) continue;

      const milestone = closestMilestone(remaining, GUARANTEE_ALERT_DAYS);
      if (!milestone) continue;

      const contractNumber = guarantee.contract.numeroContrato;
      alertsCreated += await this.createAlert({
        companyId: guarantee.companyId,
        userId: guarantee.company.userId,
        targetType: 'GUARANTEE',
        targetId: guarantee.id,
        alertType: 'GUARANTEE_EXPIRATION',
        daysBefore: milestone,
        dueDate,
        dedupeKey: alertKey(
          'GUARANTEE',
          guarantee.id,
          'GUARANTEE_EXPIRATION',
          milestone,
          dueDate,
        ),
        title: `Garantia contratual vence em ${remaining} dias`,
        message: `A apólice do contrato ${contractNumber} vence em ${remaining} dias. Renove o seguro e atualize os dados da garantia.`,
        link: '/fornecedor/contratos',
      });
    }

    let equilibriumRecordsScanned = 0;
    for (const contract of contracts) {
      const applicableInstitutes = new Set<typeof EQUILIBRIUM_INSTITUTES[number]>();
      if (contract.isMaoDeObraExclusiva || contract.predominanciaMaoDeObra) {
        applicableInstitutes.add('REPACTUACAO');
      }
      if (
        contract.isFornecimentoGeral ||
        (!contract.isMaoDeObraExclusiva && !contract.predominanciaMaoDeObra)
      ) {
        applicableInstitutes.add('REAJUSTE');
      }

      const applicableRecords: EquilibriumEntry[] = [];
      for (const record of contract.equilibria) {
        if (
          record.institutoJuridico === 'REAJUSTE' &&
          applicableInstitutes.has('REAJUSTE')
        ) {
          applicableRecords.push({
            id: record.id,
            institute: 'REAJUSTE',
            date: record.dataAniversario,
          });
        } else if (
          record.institutoJuridico === 'REPACTUACAO' &&
          applicableInstitutes.has('REPACTUACAO')
        ) {
          applicableRecords.push({
            id: record.id,
            institute: 'REPACTUACAO',
            date: record.dataAniversario,
          });
        }
      }
      equilibriumRecordsScanned += applicableRecords.length;

      const anniversaryEntries = applicableRecords.length > 0
        ? applicableRecords
        : [{
            id: contract.id,
            institute: contract.isMaoDeObraExclusiva || contract.predominanciaMaoDeObra
              ? 'REPACTUACAO' as const
              : 'REAJUSTE' as const,
            date: nextContractAnniversary(
              contract.dataBaseProposta ?? contract.dataAssinatura,
              today,
            ),
          }];

      for (const entry of anniversaryEntries) {
        const anniversary = upcomingAnniversary(entry.date, today);
        const remaining = daysUntil(today, anniversary);
        const milestone = closestMilestone(remaining, EQUILIBRIUM_ALERT_DAYS);
        if (!milestone) continue;

        alertsCreated += await this.createAlert({
          companyId: contract.companyId,
          userId: contract.company.userId,
          targetType: 'CONTRACT_EQUILIBRIUM',
          targetId: entry.id,
          alertType: 'CONTRACT_ANNIVERSARY',
          daysBefore: milestone,
          dueDate: anniversary,
          dedupeKey: alertKey(
            'CONTRACT_EQUILIBRIUM',
            entry.id,
            'CONTRACT_ANNIVERSARY',
            milestone,
            anniversary,
          ),
          title: `Prazo de ${entry.institute === 'REPACTUACAO' ? 'repactuação' : 'reajuste'} em ${remaining} dias`,
          message: `${EQUILIBRIUM_ALERT_MESSAGE}. Faltam ${remaining} dias para o aniversário do contrato ${contract.numeroContrato}.`,
          link: '/fornecedor/contratos',
        });
      }
    }

    return {
      guaranteesScanned: guarantees.length,
      contractsScanned: contracts.length,
      equilibriumRecordsScanned,
      guaranteeStatusesUpdated,
      alertsCreated,
    };
  }

  private async createGuaranteeReleaseAlert(alert: MonitorAlert) {
    return prisma.$transaction(async (tx) => {
      const statusUpdate = await tx.contractGuarantee.updateMany({
        where: { id: alert.targetId, status: 'RETIDA' },
        data: { status: 'PRONTA_RESGATE' },
      });

      const inserted = await tx.contractMonitorAlert.createMany({
        data: [{
          dedupeKey: alert.dedupeKey,
          companyId: alert.companyId,
          userId: alert.userId,
          targetType: alert.targetType,
          targetId: alert.targetId,
          alertType: alert.alertType,
          daysBefore: alert.daysBefore,
          dueDate: dateOnly(alert.dueDate),
        }],
        skipDuplicates: true,
      });

      if (inserted.count === 0) {
        return { alertsCreated: 0, statusesUpdated: statusUpdate.count };
      }

      await tx.notification.create({
        data: {
          userId: alert.userId,
          tipo: 'sistema',
          titulo: alert.title,
          mensagem: alert.message,
          canal: 'painel',
          status: 'enviada',
          enviadaEm: new Date(),
          link: alert.link,
        },
      });
      return { alertsCreated: 1, statusesUpdated: statusUpdate.count };
    });
  }

  private async createAlert(alert: MonitorAlert): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const inserted = await tx.contractMonitorAlert.createMany({
        data: [{
          dedupeKey: alert.dedupeKey,
          companyId: alert.companyId,
          userId: alert.userId,
          targetType: alert.targetType,
          targetId: alert.targetId,
          alertType: alert.alertType,
          daysBefore: alert.daysBefore,
          dueDate: dateOnly(alert.dueDate),
        }],
        skipDuplicates: true,
      });

      if (inserted.count === 0) return 0;

      await tx.notification.create({
        data: {
          userId: alert.userId,
          tipo: 'sistema',
          titulo: alert.title,
          mensagem: alert.message,
          canal: 'painel',
          status: 'enviada',
          enviadaEm: new Date(),
          link: alert.link,
        },
      });
      return 1;
    });
  }
}

export interface ContractMonitorRuntime {
  close(): Promise<void>;
}

export async function startContractMonitorWorker(): Promise<ContractMonitorRuntime> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL é obrigatória para iniciar o worker de monitoramento contratual.');
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  const monitor = new ContractMonitorWorker();
  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => monitor.run(),
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, error) => {
    console.error('[ContractMonitorWorker] Job falhou e será retentado conforme a política da fila.', {
      jobId: job?.id,
      error: error.message,
    });
  });
  worker.on('error', (error) => {
    console.error('[ContractMonitorWorker] Erro no worker BullMQ.', error);
  });

  try {
    await worker.waitUntilReady();
    await queue.upsertJobScheduler(
      SCHEDULE_ID,
      { pattern: process.env.CONTRACT_MONITOR_CRON || '0 8 * * *', tz: TIMEZONE },
      { name: 'monitor-contracts', data: {} },
    );

    const today = dateOnly(new Date()).toISOString().slice(0, 10).replace(/-/g, '');
    await queue.add('monitor-contracts', { trigger: 'startup' }, { jobId: `startup-${today}` });
  } catch (error) {
    await worker.close();
    await queue.close();
    await connection.quit();
    throw error;
  }

  console.info('[ContractMonitorWorker] Fila diária ativa no Redis.', {
    queue: QUEUE_NAME,
    timezone: TIMEZONE,
    schedule: process.env.CONTRACT_MONITOR_CRON || '0 8 * * *',
  });

  return {
    async close() {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
