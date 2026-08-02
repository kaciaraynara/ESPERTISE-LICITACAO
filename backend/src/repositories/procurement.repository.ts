import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';

export interface ProcurementNoticeWrite {
  externalId: string;
  object: string;
  buyerDocument?: string | null;
  buyerName?: string | null;
  uf?: string | null;
  municipality?: string | null;
  estimatedValue?: number | null;
  publishedAt?: Date | null;
  openingAt?: Date | null;
  closingAt?: Date | null;
  modality?: string | null;
  status?: string | null;
  url?: string | null;
  source: string;
  metadata?: Prisma.InputJsonValue;
  rawPayload?: Prisma.InputJsonValue;
}

export interface ProcurementFilters {
  uf?: string;
  keywords?: string;
  minimumValue?: number;
  maximumValue?: number;
  page: number;
  pageSize: number;
}

export class ProcurementRepository {
  async hasFreshNotices(since: Date) {
    return (await prisma.procurementNotice.count({ where: { updatedAt: { gte: since } } })) > 0;
  }

  async search(filters: ProcurementFilters) {
    const where: Prisma.ProcurementNoticeWhereInput = {};
    if (filters.uf) where.uf = filters.uf.toUpperCase();
    if (filters.keywords) {
      const keyword = filters.keywords.trim().split(/\s+/)[0];
      if (keyword) where.object = { contains: keyword, mode: 'insensitive' };
    }
    if (filters.minimumValue !== undefined || filters.maximumValue !== undefined) {
      where.estimatedValue = {
        ...(filters.minimumValue !== undefined ? { gte: filters.minimumValue } : {}),
        ...(filters.maximumValue !== undefined ? { lte: filters.maximumValue } : {}),
      };
    }

    const [data, total] = await prisma.$transaction([
      prisma.procurementNotice.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.procurementNotice.count({ where }),
    ]);
    return { data, total };
  }

  async upsertMany(notices: ProcurementNoticeWrite[]) {
    await prisma.$transaction(notices.map((notice) => {
      const dedupeKey = `${notice.source}:${notice.externalId}`;
      const contentHash = createHash('sha256').update(JSON.stringify(notice)).digest('hex');
      const data: Prisma.ProcurementNoticeCreateInput = {
        source: notice.source,
        externalId: notice.externalId,
        dedupeKey,
        contentHash,
        noticeNumber: notice.externalId,
        modality: notice.modality,
        buyerName: notice.buyerName,
        buyerDocument: notice.buyerDocument,
        object: notice.object,
        uf: notice.uf,
        municipality: notice.municipality,
        estimatedValue: notice.estimatedValue,
        status: notice.status,
        url: notice.url,
        publishedAt: notice.publishedAt,
        openingAt: notice.openingAt,
        closingAt: notice.closingAt,
        metadata: notice.metadata,
        rawPayload: notice.rawPayload,
      };
      return prisma.procurementNotice.upsert({
        where: { dedupeKey },
        create: data,
        update: { ...data, source: undefined, dedupeKey: undefined },
      });
    }));
  }
}

export const procurementRepository = new ProcurementRepository();
