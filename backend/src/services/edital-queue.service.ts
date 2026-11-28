import { prisma } from '../database/prisma';
import { obterTextoEAnexosOficiais } from './pncp-parser.service';
import { EditalDeepAnalyzerService } from './edital-deep-analyzer.service';
import { keywordsForCnae } from './cnae-to-keywords.service';

const DEFAULT_WEB_BATCH_LIMIT = 3;
const DEFAULT_WEB_MAX_RSS_MB = 300;
const CURRENT_FICHA_VERSION = 6;

let isQueueRunning = false;

export interface ProcessarFilaOptions {
  batchLimit?: number;
  maxRssMb?: number;
  targetFichaVersion?: number;
}

export interface ProcessarFilaResult {
  processados: number;
  ignorados: number;
  memoriaRssMb: number;
  idsProcessados: string[];
}

function getRssMb(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

/**
 * Executa um ciclo controlado de leitura integral em segundo plano para editais abertos.
 * Prioriza: (1) editais monitorados por empresas, (2) aderentes aos CNAEs ativos, (3) mais recentes.
 */
export async function processarFilaEditaisAbertos(
  options: ProcessarFilaOptions = {},
): Promise<ProcessarFilaResult> {
  const batchLimit = Math.min(50, Math.max(1, Number(options.batchLimit ?? DEFAULT_WEB_BATCH_LIMIT)));
  const maxRssMb = Math.max(128, Number(options.maxRssMb ?? DEFAULT_WEB_MAX_RSS_MB));
  const targetFichaVersion = Math.max(1, Number(options.targetFichaVersion ?? CURRENT_FICHA_VERSION));

  const memInicialMb = getRssMb();
  if (memInicialMb > maxRssMb) {
    console.warn(`[Fila Leitura Editais] Pausada preventivamente por uso de memoria (${memInicialMb}MB > ${maxRssMb}MB).`);
    return { processados: 0, ignorados: 0, memoriaRssMb: memInicialMb, idsProcessados: [] };
  }
  if (isQueueRunning) {
    return { processados: 0, ignorados: 0, memoriaRssMb: memInicialMb, idsProcessados: [] };
  }

  isQueueRunning = true;
  let processados = 0;
  let ignorados = 0;
  const idsProcessados: string[] = [];

  try {
    const now = new Date();

    // 1. Coleta CNAEs/palavras-chave das empresas ativas e IDs monitorados (Prioridade 1 e 2)
    const [empresas, monitorados] = await Promise.all([
      prisma.company.findMany({
        select: {
          cnaePrincipal: true,
          palavrasChave: true,
        },
        take: 100,
      }),
      prisma.companyMonitoredNotice
        .findMany({
          select: { procurementNoticeId: true },
          orderBy: { createdAt: 'desc' },
          take: 250,
        })
        .catch(() => [] as Array<{ procurementNoticeId: string }>),
    ]);

    const monitoredSet = new Set(monitorados.map((m) => m.procurementNoticeId).filter(Boolean));
    const termosPrioritarios = new Set<string>();
    for (const emp of empresas) {
      if (emp.cnaePrincipal) {
        keywordsForCnae(emp.cnaePrincipal).forEach((k) => termosPrioritarios.add(k.toLowerCase()));
      }
      if (Array.isArray(emp.palavrasChave)) {
        emp.palavrasChave.forEach((p: string) => termosPrioritarios.add(String(p).toLowerCase()));
      }
    }

    // 2. Busca editais monitorados abertos + editais abertos gerais recentes
    const monitoredIdsArr = Array.from(monitoredSet);
    const [editaisMonitorados, editaisGerais] = await Promise.all([
      monitoredIdsArr.length > 0
        ? prisma.procurementNotice.findMany({
            where: {
              id: { in: monitoredIdsArr },
              OR: [{ closingAt: { gte: now } }, { openingAt: { gte: now } }],
            },
            orderBy: { publishedAt: 'desc' },
            take: 100,
            select: { id: true, object: true, metadata: true, externalId: true, publishedAt: true },
          })
        : Promise.resolve([]),
      prisma.procurementNotice.findMany({
        where: {
          OR: [{ closingAt: { gte: now } }, { openingAt: { gte: now } }],
        },
        orderBy: { publishedAt: 'desc' },
        take: Math.max(120, batchLimit * 5),
        select: { id: true, object: true, metadata: true, externalId: true, publishedAt: true },
      }),
    ]);

    const mergedMap = new Map<string, (typeof editaisGerais)[number]>();
    for (const ed of [...editaisMonitorados, ...editaisGerais]) {
      if (!mergedMap.has(ed.id)) mergedMap.set(ed.id, ed);
    }
    const editaisAbertos = Array.from(mergedMap.values());

    // Filtra os que ainda nao possuem leitura integral concluida ou estao em versao antiga do analisador
    const pendentes = editaisAbertos.filter((ed) => {
      const meta = (ed.metadata || {}) as Record<string, any>;
      return meta.deepReadStatus !== 'DONE' || Number(meta.fichaVersion || 0) < targetFichaVersion;
    });

    if (pendentes.length === 0) {
      return { processados: 0, ignorados: editaisAbertos.length, memoriaRssMb: getRssMb(), idsProcessados: [] };
    }

    // 3. Ordenacao em 3 niveis: Monitorado (peso 2) > Match CNAE (peso 1) > Mais recente
    const termosArr = Array.from(termosPrioritarios).filter((t) => t.length >= 4);
    const scoreEdital = (ed: (typeof pendentes)[number]): number => {
      if (monitoredSet.has(ed.id)) return 2;
      const obj = (ed.object || '').toLowerCase();
      if (termosArr.some((t) => obj.includes(t))) return 1;
      return 0;
    };

    const ordenados = [...pendentes].sort((a, b) => {
      const diff = scoreEdital(b) - scoreEdital(a);
      if (diff !== 0) return diff;
      const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tB - tA;
    });

    const lote = ordenados.slice(0, batchLimit);

    // 4. Processamento estritamente sequencial (1 edital por vez) com verificacao de RSS
    for (const ed of lote) {
      const memAtualMb = getRssMb();
      if (memAtualMb > maxRssMb) {
        console.warn(`[Fila Leitura Editais] Lote interrompido por seguranca de memoria (${memAtualMb}MB > ${maxRssMb}MB).`);
        break;
      }

      try {
        const meta = (ed.metadata || {}) as Record<string, any>;
        const forceReprocess = Number(meta.fichaVersion || 0) < targetFichaVersion;
        await obterTextoEAnexosOficiais(ed.id);
        await EditalDeepAnalyzerService.processarEditalPorId(ed.id, forceReprocess);
        processados += 1;
        idsProcessados.push(ed.id);
      } catch (err: any) {
        ignorados += 1;
        console.warn(`[EditalQueue] Aviso ao processar edital ${ed.id}:`, err?.message);
      }

      if (typeof global.gc === 'function') {
        try { global.gc(); } catch {}
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    return { processados, ignorados, memoriaRssMb: getRssMb(), idsProcessados };
  } catch (err: any) {
    console.error('[EditalQueue] Erro geral na fila de leitura:', err?.message);
    return { processados, ignorados, memoriaRssMb: getRssMb(), idsProcessados };
  } finally {
    isQueueRunning = false;
  }
}
