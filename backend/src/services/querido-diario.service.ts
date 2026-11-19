import https from 'https';
import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../database/prisma';
import { emitEditaisAtualizados } from './realtime-editais.service';

const QD_BASE_URL = process.env.QUERIDO_DIARIO_BASE_URL || 'https://api.queridodiario.ok.org.br';

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

export async function syncQueridoDiarioEditais(options: { daysBack?: number; size?: number } = {}) {
  const daysBack = options.daysBack ?? 2;
  const size = options.size ?? 30;
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const since = start.toISOString().slice(0, 10);
  const until = end.toISOString().slice(0, 10);

  try {
    const httpsAgent = new https.Agent({ minVersion: 'TLSv1.2' });
    const response = await axios.get(`${QD_BASE_URL}/gazettes`, {
      timeout: 20000,
      httpsAgent,
      headers: { 'User-Agent': 'Expertise-Licitatoria/1.0', Accept: 'application/json' },
      params: {
        querystring: '"pregão eletrônico" OR "edital de licitação" OR "concorrência pública"',
        published_since: since,
        published_until: until,
        excerpt_size: 400,
        number_of_excerpts: 2,
        size,
        sort_by: 'descending_date',
      },
    });

    const gazettes: GazetteItem[] = Array.isArray(response.data?.gazettes) ? response.data.gazettes : [];
    let persisted = 0;

    for (const g of gazettes) {
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
    }

    if (persisted > 0) {
      emitEditaisAtualizados({ fonte: 'querido_diario', quantidade: persisted });
    }
    console.info(`[QueridoDiario] Sincronizados ${persisted} atos municipais de licitação.`);
    return { fonte: 'querido_diario', persisted };
  } catch (err: any) {
    console.warn('[QueridoDiario] Falha na coleta:', err?.message || err);
    return { fonte: 'querido_diario', persisted: 0, error: err?.message };
  }
}
