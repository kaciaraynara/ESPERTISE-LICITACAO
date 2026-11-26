import { prisma } from '../database/prisma';
import { obterTextoEAnexosOficiais } from './pncp-parser.service';
import { EditalDeepAnalyzerService } from './edital-deep-analyzer.service';
import { keywordsForCnae } from './cnae-to-keywords.service';

const MAX_CONCURRENCY = 2; // Proteção rigorosa de memória (512MB RAM)
const BATCH_LIMIT = 20;

let isQueueRunning = false;

/**
 * Executa um ciclo controlado de leitura integral em segundo plano para editais abertos.
 * Prioriza editais compatíveis com os segmentos (CNAEs) das empresas ativas.
 */
export async function processarFilaEditaisAbertos(): Promise<{ processados: number; ignorados: number }> {
  if (isQueueRunning) {
    return { processados: 0, ignorados: 0 };
  }

  isQueueRunning = true;
  let processados = 0;
  let ignorados = 0;

  try {
    const now = new Date();

    // 1. Coleta CNAEs/palavras-chave das empresas ativas para priorização
    const empresas = await prisma.company.findMany({
      select: {
        cnaePrincipal: true,
        palavrasChave: true,
      },
      take: 50,
    });

    const termosPrioritarios = new Set<string>();
    for (const emp of empresas) {
      if (emp.cnaePrincipal) {
        keywordsForCnae(emp.cnaePrincipal).forEach((k) => termosPrioritarios.add(k.toLowerCase()));
      }
      if (Array.isArray(emp.palavrasChave)) {
        emp.palavrasChave.forEach((p: string) => termosPrioritarios.add(String(p).toLowerCase()));
      }
    }

    // 2. Busca editais estritamente abertos (encerramento ou abertura >= agora)
    const editaisAbertos = await prisma.procurementNotice.findMany({
      where: {
        OR: [
          { closingAt: { gte: now } },
          { openingAt: { gte: now } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        object: true,
        metadata: true,
        externalId: true,
      },
    });

    // Filtra os que ainda não possuem leitura integral concluída (deepReadStatus !== 'DONE')
    const pendentes = editaisAbertos.filter((ed) => {
      const meta = (ed.metadata || {}) as Record<string, any>;
      return meta.deepReadStatus !== 'DONE';
    });

    if (pendentes.length === 0) {
      return { processados: 0, ignorados: editaisAbertos.length };
    }

    // Prioriza editais que dão match com CNAE das empresas
    const termosArr = Array.from(termosPrioritarios).filter((t) => t.length >= 4);
    const ordenados = [...pendentes].sort((a, b) => {
      const objA = (a.object || '').toLowerCase();
      const objB = (b.object || '').toLowerCase();
      const matchA = termosArr.some((t) => objA.includes(t)) ? 1 : 0;
      const matchB = termosArr.some((t) => objB.includes(t)) ? 1 : 0;
      return matchB - matchA;
    });

    const lote = ordenados.slice(0, BATCH_LIMIT);

    // 3. Processa com concorrência máxima de 2 editais por vez
    for (let i = 0; i < lote.length; i += MAX_CONCURRENCY) {
      const chunkLote = lote.slice(i, i + MAX_CONCURRENCY);
      await Promise.allSettled(
        chunkLote.map(async (ed) => {
          try {
            await obterTextoEAnexosOficiais(ed.id);
            await EditalDeepAnalyzerService.processarEditalPorId(ed.id);
            processados += 1;
          } catch (err: any) {
            ignorados += 1;
            console.warn(`[EditalQueue] Aviso ao processar edital ${ed.id}:`, err?.message);
          }
        }),
      );
      // Pausa breve entre micro-lotes para liberar event loop e GC
      await new Promise((r) => setTimeout(r, 800));
    }

    return { processados, ignorados };
  } catch (err: any) {
    console.error('[EditalQueue] Erro geral na fila de leitura:', err?.message);
    return { processados, ignorados };
  } finally {
    isQueueRunning = false;
  }
}
