import Bottleneck from 'bottleneck';
import { getStringEnv, getNumberEnv } from '../../config/env';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsageRecord {
  count: number;
  windowStart: number;
}

interface TokenHealth {
  token: string;
  maskedToken: string;
  isConfigured: boolean;
  currentWindow: 'diurno' | 'noturno';
  limitPerMinute: number;
  usedThisMinute: number;
  remainingThisMinute: number;
  isBlocked: boolean;
  blockedUntil: Date | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYTIME_LIMIT = 70;   // Margem de segurança (oficial: 90/min entre 06h–23:59)
const NIGHTTIME_LIMIT = 250; // Margem de segurança (oficial: 300/min entre 00h–05:59)
const BLOCK_DURATION_MS = 60_000; // Bloqueia por 1 minuto se exceder
const SPAM_THRESHOLD = 10;  // Máximo de chamadas iguais por usuário em 1 minuto

// ─── Singleton ────────────────────────────────────────────────────────────────

class TokenManagerService {
  private token: string = '';
  private baseUrl: string = '';
  private timeout: number = 15000;
  private limiter!: Bottleneck;
  private usage: UsageRecord = { count: 0, windowStart: Date.now() };
  private blockedUntil: number = 0;
  private userCallMap: Map<string, { count: number; windowStart: number }> = new Map();
  private initialized = false;

  constructor() {
    this.initialize();
  }

  // ─── Inicialização ────────────────────────────────────────────────────────

  private initialize(): void {
    this.token = getStringEnv('PORTAL_TRANSPARENCIA_TOKEN', '');
    this.baseUrl = getStringEnv(
      'PORTAL_TRANSPARENCIA_BASE_URL',
      'https://api.portaldatransparencia.gov.br/api-de-dados'
    );
    this.timeout = getNumberEnv('PORTAL_TRANSPARENCIA_TIMEOUT', 15000);

    // Limpa o token caso venha com formato JSON errado do .env
    if (this.token.startsWith('[') || this.token.startsWith('{')) {
      try {
        const parsed = JSON.parse(this.token);
        if (Array.isArray(parsed) && parsed[0]?.value) {
          this.token = parsed[0].value;
        } else if (parsed?.value) {
          this.token = parsed.value;
        }
      } catch {
        // Usa o token como está
      }
    }

    this.configureLimiter();
    this.initialized = true;

    if (this.token) {
      console.log('[TransparenciaTokenManager] ✅ Token configurado:', this.getMaskedToken());
    } else {
      console.warn('[TransparenciaTokenManager] ⚠️ Token não configurado. Consultas à API serão bloqueadas.');
    }
  }

  // ─── Bottleneck Limiter ───────────────────────────────────────────────────

  private configureLimiter(): void {
    const currentLimit = this.getCurrentLimit();

    this.limiter = new Bottleneck({
      maxConcurrent: 3,              // Máximo 3 chamadas simultâneas
      minTime: Math.ceil(60000 / currentLimit), // Intervalo mínimo entre chamadas
      reservoir: currentLimit,        // Chamadas disponíveis na janela
      reservoirRefreshInterval: 60000, // Reseta a cada 1 minuto
      reservoirRefreshAmount: currentLimit,
    });

    // Reconfigurar a cada 5 minutos para ajustar dia/noite
    setInterval(() => this.reconfigureLimiter(), 5 * 60_000);
  }

  private reconfigureLimiter(): void {
    const newLimit = this.getCurrentLimit();
    this.limiter.updateSettings({
      minTime: Math.ceil(60000 / newLimit),
      reservoir: newLimit,
      reservoirRefreshAmount: newLimit,
    });
  }

  // ─── Controle de Horário ──────────────────────────────────────────────────

  private getCurrentWindow(): 'diurno' | 'noturno' {
    const hour = new Date().getHours();
    return hour >= 6 ? 'diurno' : 'noturno';
  }

  private getCurrentLimit(): number {
    return this.getCurrentWindow() === 'diurno' ? DAYTIME_LIMIT : NIGHTTIME_LIMIT;
  }

  // ─── Controle de Uso ─────────────────────────────────────────────────────

  private trackUsage(): void {
    const now = Date.now();
    if (now - this.usage.windowStart > 60_000) {
      this.usage = { count: 0, windowStart: now };
    }
    this.usage.count++;
  }

  private isOverLimit(): boolean {
    const now = Date.now();
    if (now - this.usage.windowStart > 60_000) {
      this.usage = { count: 0, windowStart: now };
      return false;
    }
    return this.usage.count >= this.getCurrentLimit();
  }

  private isBlocked(): boolean {
    return Date.now() < this.blockedUntil;
  }

  private blockTemporarily(): void {
    this.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    console.warn('[TransparenciaTokenManager] 🚫 Token bloqueado temporariamente por excesso de requisições');
  }

  // ─── Anti-Spam por Usuário ────────────────────────────────────────────────

  private checkUserSpam(userId: string): boolean {
    const now = Date.now();
    const record = this.userCallMap.get(userId);

    if (!record || now - record.windowStart > 60_000) {
      this.userCallMap.set(userId, { count: 1, windowStart: now });
      return false;
    }

    record.count++;
    return record.count > SPAM_THRESHOLD;
  }

  // ─── API Pública ──────────────────────────────────────────────────────────

  /**
   * Agenda uma chamada à API respeitando o rate limit.
   * A função passada recebe (baseUrl, headers) e deve retornar o resultado.
   */
  public async schedule<T>(
    userId: string,
    fn: (baseUrl: string, headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    if (!this.token) {
      throw new Error('Token do Portal da Transparência não configurado.');
    }

    if (this.isBlocked()) {
      throw new Error('Serviço temporariamente indisponível. Tente novamente em 1 minuto.');
    }

    if (this.checkUserSpam(userId)) {
      throw new Error('Muitas consultas em pouco tempo. Aguarde antes de tentar novamente.');
    }

    if (this.isOverLimit()) {
      this.blockTemporarily();
      throw new Error('Limite de requisições atingido. Aguarde antes de tentar novamente.');
    }

    return this.limiter.schedule(async () => {
      this.trackUsage();

      const headers: Record<string, string> = {
        'chave-api-dados': this.token,
        'Accept': 'application/json',
        'User-Agent': 'Expertise-SaaS/1.0',
      };

      return fn(this.baseUrl, headers);
    });
  }

  // ─── Status / Health ──────────────────────────────────────────────────────

  public getHealth(): TokenHealth {
    const now = Date.now();
    const usedThisMinute = now - this.usage.windowStart < 60_000 ? this.usage.count : 0;
    const limit = this.getCurrentLimit();

    return {
      token: this.token ? '[CONFIGURADO]' : '[NÃO CONFIGURADO]',
      maskedToken: this.getMaskedToken(),
      isConfigured: !!this.token,
      currentWindow: this.getCurrentWindow(),
      limitPerMinute: limit,
      usedThisMinute,
      remainingThisMinute: Math.max(0, limit - usedThisMinute),
      isBlocked: this.isBlocked(),
      blockedUntil: this.isBlocked() ? new Date(this.blockedUntil) : null,
    };
  }

  public getToken(): string {
    return this.token;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getTimeout(): number {
    return this.timeout;
  }

  private getMaskedToken(): string {
    if (!this.token) return '***';
    if (this.token.length <= 8) return '****';
    return this.token.slice(0, 4) + '****' + this.token.slice(-4);
  }

  // Limpa registros antigos de spam a cada 10 minutos
  public startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.userCallMap.entries()) {
        if (now - record.windowStart > 120_000) {
          this.userCallMap.delete(key);
        }
      }
    }, 10 * 60_000);
  }
}

// ─── Export Singleton ─────────────────────────────────────────────────────────

export const tokenManager = new TokenManagerService();
tokenManager.startCleanupInterval();

export type { TokenHealth };
