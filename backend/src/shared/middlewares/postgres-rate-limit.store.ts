import { createHash } from 'crypto';
import type { IncrementResponse, Options, Store } from 'express-rate-limit';
import { prisma } from '../../database/prisma';

export class PostgresRateLimitStore implements Store {
  private windowMs = 15 * 60 * 1000;

  constructor(private readonly namespace = 'api') {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async increment(rawKey: string): Promise<IncrementResponse> {
    const key = this.hashKey(rawKey);
    const resetAt = new Date(Date.now() + this.windowMs);
    const rows = await prisma.$queryRaw<Array<{ hits: number; reset_at: Date }>>`
      INSERT INTO "api_rate_limit_buckets" ("key", "hits", "reset_at", "updated_at")
      VALUES (${key}, 1, ${resetAt}, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE
          WHEN "api_rate_limit_buckets"."reset_at" <= NOW() THEN 1
          ELSE "api_rate_limit_buckets"."hits" + 1
        END,
        "reset_at" = CASE
          WHEN "api_rate_limit_buckets"."reset_at" <= NOW() THEN EXCLUDED."reset_at"
          ELSE "api_rate_limit_buckets"."reset_at"
        END,
        "updated_at" = NOW()
      RETURNING "hits", "reset_at"
    `;
    const bucket = rows[0];
    if (!bucket) throw new Error('Falha ao persistir rate limit no PostgreSQL.');
    return { totalHits: bucket.hits, resetTime: new Date(bucket.reset_at) };
  }

  async decrement(rawKey: string) {
    const key = this.hashKey(rawKey);
    await prisma.apiRateLimitBucket.updateMany({
      where: { key, hits: { gt: 0 } },
      data: { hits: { decrement: 1 } },
    });
  }

  async resetKey(rawKey: string) {
    const key = this.hashKey(rawKey);
    await prisma.apiRateLimitBucket.deleteMany({ where: { key } });
  }

  async resetAll() {
    await prisma.apiRateLimitBucket.deleteMany({
      where: { key: { startsWith: `${this.namespace}:` } },
    });
  }

  private hashKey(rawKey: string) {
    const digest = createHash('sha256').update(rawKey).digest('hex');
    return `${this.namespace}:${digest}`;
  }
}
