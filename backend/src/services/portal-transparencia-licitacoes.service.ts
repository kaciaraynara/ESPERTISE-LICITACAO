import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../database/prisma';
import { emitEditaisAtualizados } from './realtime-editais.service';

function extractToken(raw?: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('[') || t.startsWith('{')) {
    const m = t.match(/"value"\s*:\s*"([^"]+)"/i);
    if (m && m[1]) return m[1].trim();
  }
  return t;
}

const ORGAOS_SIAFI_PADRAO = ['26000', '36000', '25000', '30000', '52000'];

export async function syncPortalTransparenciaEditais(options: { daysBack?: number; pagina?: number; orgaos?: string[] } = {}) {
  const token = extractToken(process.env.PORTAL_TRANSPARENCIA_TOKEN || process.env.TRANSPARENCIA_API_TOKEN);
  if (!token) {
    return { fonte: 'portal_transparencia', persisted: 0, skipped: true };
  }

  const rawBase = (process.env.PORTAL_TRANSPARENCIA_BASE_URL || '').trim().replace(/\/+$/, '');
  const baseUrl = rawBase.includes('api.portaldatransparencia.gov.br') ? (rawBase.endsWith('/api-de-dados') ? rawBase : `${rawBase}/api-de-dados`) : 'https://api.portaldatransparencia.gov.br/api-de-dados';
  const timeout = Number(process.env.PORTAL_TRANSPARENCIA_TIMEOUT || 15000);
  const daysBack = Math.min(options.daysBack ?? 28, 28);
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const orgaos = options.orgaos && options.orgaos.length > 0 ? options.orgaos : ORGAOS_SIAFI_PADRAO;
  let persisted = 0;

  for (const codigoOrgao of orgaos) {
    try {
      const response = await axios.get(`${baseUrl}/licitacoes`, {
        timeout,
        headers: { 'chave-api-dados': token, Accept: 'application/json' },
        params: {
          codigoOrgao,
          dataInicial: fmt(start),
          dataFinal: fmt(end),
          pagina: options.pagina ?? 1,
        },
      });

      const items = Array.isArray(response.data) ? response.data : [];
      for (const item of items) {
        const idNum = String(item?.id || `${item?.unidadeGestora?.codigo || codigoOrgao}-${item?.licitacao?.numero || Date.now()}`);
        const externalId = `PT-${idNum}`;
        const dedupeKey = `portal_transparencia:${externalId}`;
        const objectText = String(item?.licitacao?.objeto || item?.objeto || 'Licitação Federal (Portal da Transparência)').trim();
        const contentHash = crypto.createHash('sha256').update(dedupeKey + objectText).digest('hex');

        await prisma.procurementNotice.upsert({
          where: { dedupeKey },
          create: {
            source: 'portal_transparencia',
            externalId,
            dedupeKey,
            contentHash,
            noticeNumber: item?.licitacao?.numero || null,
            processoAdministrativo: item?.licitacao?.numeroProcesso || null,
            modality: item?.modalidadeLicitacao || 'Licitação Federal',
            object: objectText,
            buyerName: item?.unidadeGestora?.nome || item?.unidadeGestora?.orgaoVinculado?.nome || null,
            uf: item?.municipio?.uf?.sigla || null,
            municipality: item?.municipio?.nomeIBGE || null,
            estimatedValue: item?.valor != null ? Number(item.valor) : null,
            status: item?.situacaoCompra || 'ABERTA',
            publishedAt: item?.dataPublicacao ? new Date(item.dataPublicacao.split('/').reverse().join('-')) : new Date(),
            openingAt: item?.dataAbertura ? new Date(item.dataAbertura.split('/').reverse().join('-')) : null,
            rawPayload: item as any,
            metadata: { origem: 'portal_transparencia', codigoOrgao },
          },
          update: {
            status: item?.situacaoCompra || 'ABERTA',
            rawPayload: item as any,
          },
        });
        persisted += 1;
      }
    } catch (err: any) {
      console.warn(`[PortalTransparencia] Orgao ${codigoOrgao} falhou:`, err?.response?.status || err?.message);
    }
  }

  if (persisted > 0) {
    emitEditaisAtualizados({ fonte: 'portal_transparencia', quantidade: persisted });
  }
  console.info(`[PortalTransparencia] Sincronizadas ${persisted} licitações federais.`);
  return { fonte: 'portal_transparencia', persisted };
}
