import { prisma } from '../database/prisma';

const GLOBAL_CURSOR_TENANT_ID = 'global';

export async function readIngestionCursor(
  source: string,
  cursorKey: string,
): Promise<{ cursorValue: Record<string, any> | null; lastSyncedAt: Date | null } | null> {
  try {
    const repo = (prisma as any)?.dataSourceCursor;
    if (typeof repo?.findFirst !== 'function') return null;

    const row = await repo.findFirst({
      where: { source, tenantId: GLOBAL_CURSOR_TENANT_ID, cursorKey },
      select: { cursorValue: true, lastSyncedAt: true },
    });

    if (!row) return null;
    return {
      cursorValue:
        row.cursorValue && typeof row.cursorValue === 'object'
          ? (row.cursorValue as Record<string, any>)
          : null,
      lastSyncedAt: row.lastSyncedAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveIngestionCursor(
  source: string,
  cursorKey: string,
  cursorValue: Record<string, unknown>,
): Promise<void> {
  try {
    const repo = (prisma as any)?.dataSourceCursor;
    const now = new Date();
    if (typeof repo?.upsert === 'function') {
      await repo.upsert({
        where: {
          source_tenantId_cursorKey: {
            source,
            tenantId: GLOBAL_CURSOR_TENANT_ID,
            cursorKey,
          },
        },
        create: {
          tenantId: GLOBAL_CURSOR_TENANT_ID,
          source,
          cursorKey,
          cursorValue: cursorValue as any,
          lastSyncedAt: now,
        },
        update: {
          cursorValue: cursorValue as any,
          lastSyncedAt: now,
        },
      });
      return;
    }

    if (typeof repo?.findFirst === 'function') {
      const existing = await repo.findFirst({
        where: { source, tenantId: GLOBAL_CURSOR_TENANT_ID, cursorKey },
        select: { id: true },
      });
      if (existing?.id && typeof repo?.update === 'function') {
        await repo.update({
          where: { id: existing.id },
          data: { cursorValue: cursorValue as any, lastSyncedAt: now },
        });
      } else if (typeof repo?.create === 'function') {
        await repo.create({
          data: {
            tenantId: GLOBAL_CURSOR_TENANT_ID,
            source,
            cursorKey,
            cursorValue: cursorValue as any,
            lastSyncedAt: now,
          },
        });
      }
    }
  } catch {
    // Telemetria de cursor não deve interromper a ingestão
  }
}

export async function recordIngestionJob(params: {
  source: string;
  connector: string;
  status: 'completed' | 'partial' | 'failed';
  recordsSeen: number;
  recordsAccepted: number;
  recordsDuplicated?: number;
  recordsFailed?: number;
  startedAt: Date;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const repo = (prisma as any)?.dataIngestionJob;
    if (typeof repo?.create !== 'function') return;

    await repo.create({
      data: {
        tenantId: GLOBAL_CURSOR_TENANT_ID,
        source: params.source,
        connector: params.connector,
        status: params.status,
        pipelineStage: 'ingestion',
        startedAt: params.startedAt,
        finishedAt: new Date(),
        recordsSeen: params.recordsSeen,
        recordsAccepted: params.recordsAccepted,
        recordsDuplicated: params.recordsDuplicated ?? 0,
        recordsFailed: params.recordsFailed ?? 0,
        errorMessage: params.errorMessage ?? null,
        metadata: (params.metadata ?? {}) as any,
      },
    });
  } catch {
    // Telemetria de job não deve interromper a ingestão
  }
}
