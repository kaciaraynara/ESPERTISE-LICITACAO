import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';

export type SecurityAuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ADMIN_LOGIN_FORBIDDEN'
  | (string & {});

/**
 * Motor de Auditoria e Detecção de Ameaças (Fire-and-Forget).
 *
 * - `logAction`: despacha a gravação em `prisma.auditLog.create` de forma
 *   totalmente assíncrona dentro de `setImmediate(...)`, garantindo zero impacto
 *   de latência na thread principal da requisição HTTP (ex: login).
 * - `analyzeSecurityThreat`: avalia falhas consecutivas de autenticação (`LOGIN_FAILED`)
 *   por endereço IP na janela do último 1 minuto e dispara alerta `FATAL` se > 5.
 */
export class AuditService {
  private static readonly THREAT_WINDOW_MS = 60 * 1000; // 1 minuto
  private static readonly THREAT_THRESHOLD = 5; // > 5 falhas em 1 minuto

  /**
   * Registra uma ação de auditoria em modo Fire-and-Forget via `setImmediate`.
   */
  public static logAction(
    action: SecurityAuditAction,
    ipAddress: string,
    userAgent?: string | null,
    userId?: string | null,
    payload?: Prisma.InputJsonValue | Record<string, unknown> | null,
  ): void {
    const normalizedAction = String(action || 'UNKNOWN_ACTION').trim();
    const normalizedIp = String(ipAddress || 'unknown-ip').trim();
    const normalizedUserAgent = userAgent ? String(userAgent).trim() : null;
    const normalizedUserId = userId ? String(userId).trim() : null;

    setImmediate(() => {
      void (async () => {
        try {
          await prisma.auditLog.create({
            data: {
              userId: normalizedUserId,
              action: normalizedAction,
              ipAddress: normalizedIp,
              userAgent: normalizedUserAgent,
              payload:
                payload !== undefined && payload !== null
                  ? (payload as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            },
          });

          if (normalizedAction === 'LOGIN_FAILED') {
            await AuditService.analyzeSecurityThreat(normalizedIp);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[AUDIT_SERVICE_ERROR] Falha assíncrona ao persistir AuditLog:', message);
        }
      })();
    });
  }

  /**
   * Threat Engine: contabiliza eventos `LOGIN_FAILED` para o IP no último 1 minuto.
   * Caso exceda 5 ocorrências (`count > 5`), emite um alerta estruturado de nível `FATAL`.
   */
  public static async analyzeSecurityThreat(ipAddress: string): Promise<void> {
    const normalizedIp = String(ipAddress || '').trim();
    if (!normalizedIp) {
      return;
    }

    const oneMinuteAgo = new Date(Date.now() - AuditService.THREAT_WINDOW_MS);

    try {
      const failedAttemptsCount = await prisma.auditLog.count({
        where: {
          action: 'LOGIN_FAILED',
          ipAddress: normalizedIp,
          timestamp: {
            gte: oneMinuteAgo,
          },
        },
      });

      if (failedAttemptsCount > AuditService.THREAT_THRESHOLD) {
        console.error(
          JSON.stringify({
            level: 'FATAL',
            event: 'SECURITY_THREAT_BRUTE_FORCE_DETECTED',
            ipAddress: normalizedIp,
            failedAttemptsLastMinute: failedAttemptsCount,
            threshold: AuditService.THREAT_THRESHOLD,
            windowMs: AuditService.THREAT_WINDOW_MS,
            timestamp: new Date().toISOString(),
            message: `[FATAL][THREAT_ENGINE] Ataque de força bruta detectado a partir do IP ${normalizedIp} (${failedAttemptsCount} falhas de login no último minuto).`,
          }),
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[THREAT_ENGINE_ERROR] Falha ao analisar ameaça de segurança por IP:', message);
    }
  }
}

export const auditService = new AuditService();

