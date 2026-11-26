import https from 'https';
import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../database/prisma';
import { emitEditaisAtualizados } from './realtime-editais.service';
import { recordIngestionJob, saveIngestionCursor } from './ingestion-cursor.service';

const QD_BASE_URL = process.env.QUERIDO_DIARIO_BASE_URL || 'https://api.queridodiario.org.br';

interface GazetteItem {
  territory_id: string;
  territory_name: string;
  state_code: string;
  date: string;
  edition?: string;
  url: string;
  txt_url?: string;
  excerpts?: string[];
}

export async function syncQueridoDiarioEditais(
  options: { daysBack?: number; size?: number; maxPages?: number } = {},
) {
  const startedAt = new Date();
  const daysBack = options.daysBack ?? 10;
  const size = Math.min(100, Math.max(10, options.size ?? 60));
  const maxPages = Math.min(10, Math.max(1, options.maxPages ?? 3));
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const since = start.toISOString().slice(0, 10);
  const until = end.toISOString().slice(0, 10);

  let persisted = 0;
  let seen = 0;
  let failed = 0;
  let totalGazettes: number | null = null;
  let pagesRead = 0;

  try {
    const httpsAgent = new https.Agent({ minVersion: 'TLSv1.2' });

    for (let page = 0; page < maxPages; page++) {
      const offset = page * size;
      const response = await axios.get(`${QD_BASE_URL}/gazettes`, {
        timeout: 20000,
        httpsAgent,
        headers: { 'User-Agent': 'EXPERTISE-SaaS/1.0', Accept: 'application/json' },
        params: {
          querystring: '"pregão eletrônico" OR "edital de licitação" OR "concorrência pública" OR "dispensa de licitação"',
          published_since: since,
          published_until: until,
          excerpt_size: 400,
          number_of_excerpts: 2,
          size,
          offset,
          sort_by: 'descending_date',
        },
      });

      pagesRead += 1;
      if (typeof response.data?.total_gazettes === 'number') {
        totalGazettes = response.data.total_gazettes;
      }

      const gazettes: GazetteItem[] = Array.isArray(response.data?.gazettes) ? response.data.gazettes : [];
      if (gazettes.length === 0) break;
      seen += gazettes.length;

      for (const g of gazettes) {
        try {
          const externalId = `QD-${g.territory_id}-${g.date}-${g.edition || '0'}`;
          const dedupeKey = `querido_diario:${externalId}`;
          const excerpt = (g.excerpts || []).join(' ').replace(/\s+/g, ' ').trim();
          const objectText = excerpt
            ? `[Diário Oficial ${g.territory_name}/${g.state_code}] ${excerpt}`.slice(0, 1500)
            : `Aviso de licitação publicado no Diário Oficial de ${g.territory_name}/${g.state_code} em ${g.date}`;
          const contentHash = crypto.createHash('sha256').update(dedupeKey + objectText).digest('hex');
          const publishedAt = g.date ? new Date(g.date) : new Date();

          await prisma.procurementNotice.upsert({
            where: { dedupeKey },
            create: {
              source: 'querido_diario',
              externalId,
              dedupeKey,
              contentHash,
              noticeNumber: g.edition ? `Edição ${g.edition}` : g.date,
              modality: 'Diário Oficial Municipal',
              buyerName: `Prefeitura / Órgão Municipal de ${g.territory_name}`,
              object: objectText,
              uf: g.state_code || null,
              municipality: g.territory_name || null,
              status: 'ABERTA',
              url: g.url || null,
              publishedAt,
              rawPayload: g as any,
              metadata: { origem: 'querido_diario', txtUrl: g.txt_url || null },
            },
            update: {
              object: objectText,
              url: g.url || null,
              rawPayload: g as any,
            },
          });
          persisted += 1;
        } catch {
          failed += 1;
        }
      }

      if (gazettes.length < size || (totalGazettes !== null && offset + gazettes.length >= totalGazettes)) {
        break;
      }
    }

    if (persisted > 0) {
      emitEditaisAtualizados({ fonte: 'querido_diario', quantidade: persisted });
    }
    await saveIngestionCursor('querido_diario', 'gazettes_recentes', {
      since,
      until,
      pagesRead,
      seen,
      persisted,
      totalGazettes,
    });
    await recordIngestionJob({
      source: 'querido_diario',
      connector: 'syncQueridoDiarioEditais',
      status: failed > 0 && persisted === 0 ? 'failed' : failed > 0 ? 'partial' : 'completed',
      recordsSeen: seen,
      recordsAccepted: persisted,
      recordsFailed: failed,
      startedAt,
      metadata: { daysBack, pagesRead, totalGazettes },
    });
    console.info(`[QueridoDiario] Sincronizados ${persisted} atos municipais de licitação (${pagesRead} pág.).`);
    return { fonte: 'querido_diario', persisted, pagesRead };
  } catch (err: any) {
    await recordIngestionJob({
      source: 'querido_diario',
      connector: 'syncQueridoDiarioEditais',
      status: 'failed',
      recordsSeen: seen,
      recordsAccepted: persisted,
      recordsFailed: failed + 1,
      startedAt,
      errorMessage: err?.message || 'Falha na coleta Querido Diário',
      metadata: { daysBack, pagesRead },
    });
    console.warn('[QueridoDiario] Falha na coleta:', err?.message || err);
    return { fonte: 'querido_diario', persisted, pagesRead, error: err?.message };
  }
}
