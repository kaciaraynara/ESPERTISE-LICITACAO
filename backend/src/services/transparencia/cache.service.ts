import NodeCache from 'node-cache';
import { prisma } from '../../database/prisma';

// ─── TTL por categoria (em segundos) ─────────────────────────────────────────

const TTL_MAP: Record<string, number> = {
  licitacoes: 6 * 60 * 60,     // 6 horas
  empresas: 24 * 60 * 60,      // 24 horas
  penalidades: 24 * 60 * 60,   // 24 horas
  contratos: 12 * 60 * 60,     // 12 horas
  orgaos: 24 * 60 * 60,        // 24 horas
  default: 6 * 60 * 60,        // 6 horas
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CacheResult<T = unknown> {
  data: T;
  source: 'memory' | 'database' | 'api';
  cachedAt?: Date;
  expiresAt?: Date;
}

type CacheCategory = keyof typeof TTL_MAP;

// ─── Cache em Memória (NodeCache) ─────────────────────────────────────────────

const memoryCache = new NodeCache({
  stdTTL: TTL_MAP.default,
  checkperiod: 120,   // Limpa expirados a cada 2 min
  maxKeys: 5000,      // Previne vazamento de memória
  useClones: false,    // Performance: evita deep clone
});

// ─── Service ──────────────────────────────────────────────────────────────────

class CacheService {

  /**
   * Gera uma chave normalizada para o cache
   */
  public buildKey(endpoint: string, params: Record<string, unknown> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${String(params[k])}`)
      .join('&');
    return `transparencia:${endpoint}:${sortedParams}`;
  }

  /**
   * Detecta a categoria a partir do endpoint
   */
  private detectCategory(endpoint: string): CacheCategory {
    const lower = endpoint.toLowerCase();
    if (lower.includes('licitac') || lower.includes('contratac')) return 'licitacoes';
    if (lower.includes('empresa') || lower.includes('fornecedor') || lower.includes('cnpj')) return 'empresas';
    if (lower.includes('penalidad') || lower.includes('sancao') || lower.includes('punicao')) return 'penalidades';
    if (lower.includes('contrato')) return 'contratos';
    if (lower.includes('orgao')) return 'orgaos';
    return 'default';
  }

  /**
   * Retorna o TTL em segundos para a categoria
   */
  public getTTL(endpoint: string): number {
    const category = this.detectCategory(endpoint);
    return TTL_MAP[category] || TTL_MAP.default;
  }

  // ─── Fluxo Principal: get com fallback progressivo ────────────────────────

  /**
   * Tenta buscar do cache (memória → banco).
   * Se não encontrar, retorna null — o chamador deve buscar da API e depois salvar.
   */
  public async get<T = unknown>(key: string): Promise<CacheResult<T> | null> {
    // 1. Tentar memória
    const memResult = memoryCache.get<T>(key);
    if (memResult !== undefined) {
      return { data: memResult, source: 'memory' };
    }

    // 2. Tentar banco
    try {
      const dbResult = await prisma.apiCache.findUnique({ where: { chave: key } });
      if (dbResult && new Date(dbResult.expiresAt) > new Date()) {
        const data = dbResult.payload as T;
        // Repovoar memória para próxima consulta
        const remainingTTL = Math.max(
          1,
          Math.floor((new Date(dbResult.expiresAt).getTime() - Date.now()) / 1000)
        );
        memoryCache.set(key, data, remainingTTL);
        return {
          data,
          source: 'database',
          cachedAt: dbResult.createdAt,
          expiresAt: dbResult.expiresAt,
        };
      }
    } catch (err) {
      console.warn('[CacheService] Erro ao ler cache do banco:', (err as Error).message);
    }

    return null;
  }

  /**
   * Salva dados no cache (memória + banco)
   */
  public async set(
    key: string,
    endpoint: string,
    data: unknown,
  ): Promise<void> {
    const ttl = this.getTTL(endpoint);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // 1. Salvar na memória
    memoryCache.set(key, data, ttl);

    // 2. Salvar no banco (upsert)
    try {
      await prisma.apiCache.upsert({
        where: { chave: key },
        update: {
          endpoint,
          payload: data as any,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          chave: key,
          endpoint,
          payload: data as any,
          expiresAt,
        },
      });
    } catch (err) {
      console.warn('[CacheService] Erro ao salvar cache no banco:', (err as Error).message);
      // Cache em memória continua funcionando
    }
  }

  /**
   * Busca o último cache válido para fallback (mesmo expirado).
   * Útil quando a API está fora do ar.
   */
  public async getFallback<T = unknown>(key: string): Promise<CacheResult<T> | null> {
    // Memória (pode ter expirado, mas NodeCache remove)
    // Tentar banco sem checar expiração
    try {
      const dbResult = await prisma.apiCache.findUnique({ where: { chave: key } });
      if (dbResult) {
        return {
          data: dbResult.payload as T,
          source: 'database',
          cachedAt: dbResult.createdAt,
          expiresAt: dbResult.expiresAt,
        };
      }
    } catch (err) {
      console.warn('[CacheService] Erro ao ler fallback do banco:', (err as Error).message);
    }

    return null;
  }

  /**
   * Invalida cache específico
   */
  public async invalidate(key: string): Promise<void> {
    memoryCache.del(key);
    try {
      await prisma.apiCache.delete({ where: { chave: key } }).catch(() => {});
    } catch {
      // Ignora se não existe
    }
  }

  /**
   * Limpa caches expirados do banco (rodar via cron)
   */
  public async cleanExpired(): Promise<number> {
    try {
      const result = await prisma.apiCache.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      console.log(`[CacheService] 🧹 ${result.count} registros expirados removidos do banco`);
      return result.count;
    } catch (err) {
      console.warn('[CacheService] Erro ao limpar cache expirado:', (err as Error).message);
      return 0;
    }
  }

  /**
   * Estatísticas do cache em memória
   */
  public getMemoryStats(): { keys: number; hits: number; misses: number; hitRate: string } {
    const stats = memoryCache.getStats();
    const total = stats.hits + stats.misses;
    return {
      keys: memoryCache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: total > 0 ? `${((stats.hits / total) * 100).toFixed(1)}%` : '0%',
    };
  }
}

// ─── Export Singleton ─────────────────────────────────────────────────────────

export const cacheService = new CacheService();

export type { CacheResult, CacheCategory };
