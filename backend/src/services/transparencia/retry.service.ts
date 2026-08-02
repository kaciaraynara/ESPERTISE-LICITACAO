import axios, { AxiosError } from 'axios';

// ─── Configuração ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 15000;

// Status codes que merecem retry
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

interface RetryResult<T> {
  data: T;
  attempts: number;
  totalTimeMs: number;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // Timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true;
    // Erros de rede
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return true;
    if (!error.response) return true; // Network error
    // Status codes retentáveis
    if (RETRYABLE_STATUS_CODES.has(error.response.status)) return true;
  }

  // Erros genéricos de rede
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset')) {
      return true;
    }
  }

  return false;
}

function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff com jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% de jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Retry Principal ──────────────────────────────────────────────────────────

/**
 * Executa uma função com retry exponencial e jitter.
 * Se o erro for 429 (rate limit), aguarda o tempo do header Retry-After.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    onRetry,
  } = options;

  const startTime = Date.now();
  let lastError: Error = new Error('Retry failed');

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const data = await fn();
      return {
        data,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Última tentativa — não retenta
      if (attempt > maxRetries) break;

      // Verifica se o erro é retentável
      if (!isRetryableError(error)) break;

      // Calcula delay
      let delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs);

      // Se for 429, respeitar Retry-After
      if (error instanceof AxiosError && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          const retryAfterMs = Number(retryAfter) * 1000;
          if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
            delayMs = Math.max(delayMs, retryAfterMs);
          }
        }
      }

      if (onRetry) {
        onRetry(attempt, lastError, delayMs);
      }

      console.log(
        `[RetryService] ♻️ Tentativa ${attempt}/${maxRetries} falhou. ` +
        `Retentando em ${Math.round(delayMs)}ms... (${lastError.message})`
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export { isRetryableError, calculateDelay };
export type { RetryOptions, RetryResult };
