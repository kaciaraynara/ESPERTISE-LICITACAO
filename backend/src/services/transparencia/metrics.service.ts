// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MetricEntry {
  endpoint: string;
  userId: string;
  responseTimeMs: number;
  status: 'success' | 'error' | 'cache_hit' | 'fallback';
  source: 'memory' | 'database' | 'api';
  timestamp: Date;
  errorMessage?: string;
}

interface MetricsSummary {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  cacheHits: number;
  fallbackCalls: number;
  avgResponseMs: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  callsPerMinute: number;
  uptimeMinutes: number;
}

// ─── LGPD: Mascaramento ─────────────────────────────────────────────────────

function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  return '***.***.***-**';
}

function maskCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    return `**${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
  }
  return '**.***.***/****..**';
}

function maskUserId(userId: string): string {
  if (!userId || userId.length < 8) return '***';
  return userId.slice(0, 4) + '...' + userId.slice(-4);
}

/**
 * Sanitiza dados sensíveis de qualquer string
 */
function sanitizeLogData(text: string): string {
  // Mascarar CPFs (xxx.xxx.xxx-xx)
  let result = text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '***.***.***-**');
  // Mascarar CPFs sem formatação (11 dígitos consecutivos)
  result = result.replace(/(?<!\d)\d{11}(?!\d)/g, (match) => maskCpf(match));
  // Mascarar CNPJs (xx.xxx.xxx/xxxx-xx)
  result = result.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '**.***.***/****..**');
  // Mascarar CNPJs sem formatação (14 dígitos consecutivos)
  result = result.replace(/(?<!\d)\d{14}(?!\d)/g, (match) => maskCnpj(match));
  return result;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MetricsService {
  private entries: MetricEntry[] = [];
  private maxEntries = 10_000;
  private startedAt = Date.now();

  /**
   * Registra uma métrica de chamada à API
   */
  public record(entry: Omit<MetricEntry, 'timestamp'>): void {
    const sanitized: MetricEntry = {
      ...entry,
      endpoint: sanitizeLogData(entry.endpoint),
      userId: maskUserId(entry.userId),
      errorMessage: entry.errorMessage ? sanitizeLogData(entry.errorMessage) : undefined,
      timestamp: new Date(),
    };

    this.entries.push(sanitized);

    // Manter limite de entradas
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-Math.floor(this.maxEntries * 0.8));
    }

    // Log no console (sem dados sensíveis)
    const icon = entry.status === 'success' ? '✅' :
                 entry.status === 'cache_hit' ? '💾' :
                 entry.status === 'fallback' ? '⚠️' : '❌';

    console.log(
      `[Transparencia] ${icon} ${sanitized.endpoint} | ` +
      `${sanitized.responseTimeMs}ms | ${sanitized.source} | ${sanitized.userId}`
    );
  }

  /**
   * Retorna um resumo das métricas
   */
  public getSummary(windowMinutes: number = 60): MetricsSummary {
    const cutoff = Date.now() - windowMinutes * 60_000;
    const recent = this.entries.filter(e => e.timestamp.getTime() > cutoff);

    const endpointCounts = new Map<string, number>();
    const userCounts = new Map<string, number>();
    let totalMs = 0;
    let successCount = 0;
    let errorCount = 0;
    let cacheHits = 0;
    let fallbackCount = 0;

    for (const entry of recent) {
      totalMs += entry.responseTimeMs;
      endpointCounts.set(entry.endpoint, (endpointCounts.get(entry.endpoint) || 0) + 1);
      userCounts.set(entry.userId, (userCounts.get(entry.userId) || 0) + 1);

      switch (entry.status) {
        case 'success': successCount++; break;
        case 'error': errorCount++; break;
        case 'cache_hit': cacheHits++; break;
        case 'fallback': fallbackCount++; break;
      }
    }

    const topEndpoints = [...endpointCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    const topUsers = [...userCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    return {
      totalCalls: recent.length,
      successCalls: successCount,
      errorCalls: errorCount,
      cacheHits,
      fallbackCalls: fallbackCount,
      avgResponseMs: recent.length > 0 ? Math.round(totalMs / recent.length) : 0,
      topEndpoints,
      topUsers,
      callsPerMinute: windowMinutes > 0 ? Math.round(recent.length / windowMinutes) : 0,
      uptimeMinutes: Math.round((Date.now() - this.startedAt) / 60_000),
    };
  }

  /**
   * Retorna entradas recentes para debug (sem dados sensíveis)
   */
  public getRecentLogs(limit: number = 50): MetricEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Limpa todas as métricas
   */
  public clear(): void {
    this.entries = [];
  }
}

// ─── Utilitários Públicos LGPD ──────────────────────────────────────────────

export { maskCpf, maskCnpj, maskUserId, sanitizeLogData };

// ─── Export Singleton ─────────────────────────────────────────────────────────

export const metricsService = new MetricsService();

export type { MetricEntry, MetricsSummary };
