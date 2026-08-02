import { createHash } from 'crypto';
import { prisma } from '../database/prisma';

export type AuthLogEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'REGISTER_SUCCESS'
  | 'REGISTER_DUPLICATED_EMAIL'
  | 'TOKEN_REFRESH'
  | 'TOKEN_INVALID'
  | 'LOGOUT';

type AuthLogContext = {
  email?: string | null;
  userId?: string | null;
  role?: string | null;
  reason?: string;
  requestId?: string | string[];
  ip?: string | null;
  userAgent?: string | string[] | null;
};

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidPasswordHash(hash: unknown) {
  return typeof hash === 'string' && BCRYPT_HASH_PATTERN.test(hash);
}

export async function logAuthEvent(event: AuthLogEvent, context: AuthLogContext = {}) {
  const payload = {
    event,
    scope: 'auth',
    timestamp: new Date().toISOString(),
    emailHash: context.email ? hashAuditValue(normalizeAuthEmail(context.email)) : undefined,
    userId: context.userId ?? undefined,
    role: context.role ?? undefined,
    reason: context.reason,
    requestId: context.requestId,
  };

  const message = JSON.stringify(payload);
  if (event === 'LOGIN_FAILED' || event === 'TOKEN_INVALID' || event === 'REGISTER_DUPLICATED_EMAIL') {
    console.warn(message);
  } else {
    console.info(message);
  }

  try {
    await prisma.auditEvent.create({
      data: {
        scope: 'auth',
        action: event,
        outcome: getAuthAuditOutcome(event),
        userId: context.userId ?? null,
        requestId: normalizeHeaderValue(context.requestId),
        emailHash: payload.emailHash ?? null,
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: hashHeaderValue(context.userAgent),
        metadata: {
          role: context.role ?? null,
          reason: context.reason ?? null,
        },
      }
    });
  } catch (error: any) {
    console.warn(JSON.stringify({
      event: 'AUDIT_LOG_FAILED',
      scope: 'auth',
      action: event,
      reason: error?.message ?? 'unknown_error',
    }));
  }
}

function getAuthAuditOutcome(event: AuthLogEvent) {
  if (event === 'LOGIN_FAILED' || event === 'TOKEN_INVALID' || event === 'REGISTER_DUPLICATED_EMAIL') {
    return 'failure';
  }
  return 'success';
}

function hashHeaderValue(value: string | string[] | null | undefined) {
  const normalized = normalizeHeaderValue(value);
  return normalized ? hashAuditValue(normalized) : null;
}

function normalizeHeaderValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

function hashAuditValue(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
