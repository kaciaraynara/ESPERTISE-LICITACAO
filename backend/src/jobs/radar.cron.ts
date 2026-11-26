import { syncPcaRecentDays } from '../services/pca-sync.service';
import { syncQueridoDiarioEditais } from '../services/querido-diario.service';
import { syncPortalTransparenciaEditais } from '../services/portal-transparencia-licitacoes.service';
import { emitEditaisAtualizados } from '../services/realtime-editais.service';
import {
  avaliarCompatibilidadeCnae,
  analisarEditalParaCnae,
  keywordsForCnae,
} from '../services/cnae-to-keywords.service';
import cron from 'node-cron';
import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import { buscarContratacoesPNCP, LicitacaoPNCP, PncpServiceError } from '../services/pncp.service';
import { buscarLicitacoesComprasGov, syncComprasGovRecentes } from '../services/comprasgov.service';
import { setupCndRenewalCron } from './cnd-renewal.cron';
import { setupPrivacyJob } from './privacy.job';
import { setupPlanResetCron } from './plan-reset.cron';
import { DataPlatformWorkerService } from '../services/data-platform';
import { CertificatesWorker } from '../workers/certificates.worker';
import { NotificationsWorker } from '../workers/notifications.worker';
import { enviarAlertaEditaisCnae } from '../services/resend.service';
import { listarLicitacoes } from '../services/licitacoes.service';
import {
  readIngestionCursor,
  recordIngestionJob,
  saveIngestionCursor,
} from '../services/ingestion-cursor.service';
import { processarFilaEditaisAbertos } from '../services/edital-queue.service';


const DEFAULT_CRON_SCHEDULE = '*/30 * * * *'; // A cada 30 minutos com cursor contínuo
const DEFAULT_DEADLINE_ALERT_SCHEDULE = '0 8 * * *'; // 8h todos os dias
const DEFAULT_CERTIFICATE_ALERT_SCHEDULE = '0 8 * * *'; // 8h todos os dias
const TIMEZONE = 'America/Sao_Paulo';
const PAGE_SIZE = 50;
const PERSIST_CONCURRENCY = 10;

export const MODALIDADES_PNCP = [
  { codigo: 6, nome: 'Pregão Eletrônico' },
  { codigo: 8, nome: 'Dispensa de Licitação' },
  { codigo: 4, nome: 'Concorrência Eletrônica' },
  { codigo: 12, nome: 'Credenciamento' },
  { codigo: 7, nome: 'Pregão Presencial' },
  { codigo: 5, nome: 'Concorrência Presencial' },
  { codigo: 1, nome: 'Leilão Eletrônico' },
  { codigo: 13, nome: 'Leilão Presencial' },
  { codigo: 11, nome: 'Pré-Qualificação' },
  { codigo: 10, nome: 'Manifestação de Interesse' },
  { codigo: 3, nome: 'Concurso' },
  { codigo: 9, nome: 'Inexigibilidade' },
] as const;

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

function isCronEnabled(value?: string | null): boolean {
  if (value === undefined || value === null) return true; // Habilitado por padrão
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dateInBrazil(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}`;
}

function subtractCalendarDays(value: string, days: number): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const previous = new Date(Date.UTC(year, month - 1, day - days));
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, '0'),
    String(previous.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function previousCalendarDay(value: string): string {
  return subtractCalendarDays(value, 1);
}

export interface BackoffOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  context?: string;
}

/**
 * Executa uma chamada com backoff exponencial e jitter para contornar
 * limitações temporárias de IP (HTTP 429) e instabilidades (502/503/504) no PNCP.
 */
export async function fetchWithBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 16000;
  const backoffFactor = options.backoffFactor ?? 2;
  const context = options.context ?? 'PNCP Request';

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      // Erros definitivos do cliente (400 ou 404) não devem ser retentados
      const isClientError =
        error?.statusCode === 400 ||
        error?.code === 'INVALID_FILTER' ||
        error?.statusCode === 404;

      if (isClientError || attempt > maxRetries) {
        throw error;
      }

      const isRateLimited =
        error?.statusCode === 429 ||
        error?.code === 'PNCP_RATE_LIMITED' ||
        error?.response?.status === 429;

      const isGatewayIssue =
        error?.statusCode === 502 ||
        error?.statusCode === 503 ||
        error?.statusCode === 504 ||
        error?.code === 'PNCP_TIMEOUT' ||
        error?.code === 'PNCP_UNAVAILABLE' ||
        error?.response?.status === 502 ||
        error?.response?.status === 503 ||
        error?.response?.status === 504;

      // Cálculo de backoff exponencial: base * (fator ^ (tentativa - 1)) + jitter
      let delayMs = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(backoffFactor, attempt - 1)
      );

      // Adiciona jitter aleatório (200-800ms) para evitar rajadas sincronizadas
      const jitter = Math.floor(Math.random() * 600) + 200;
      delayMs += jitter;

      // Se for rate limit (HTTP 429), aplica resfriamento mais conservador
      if (isRateLimited) {
        delayMs = Math.max(delayMs, 3000 * attempt);
      }

      console.warn(JSON.stringify({
        event: 'PNCP_BACKOFF_RETRY',
        context,
        attempt,
        maxRetries,
        delayMs,
        errorCode: error?.code || error?.statusCode || error?.name,
        errorMessage: error?.message,
        isRateLimited,
        isGatewayIssue,
      }));

      await sleep(delayMs);
    }
  }
}

async function upsertPncpNoticeItem(item: LicitacaoPNCP, defaultModalityName: string): Promise<boolean> {
  if (!item.numeroControlePNCP) return false;
  const ctrl = item.numeroControlePNCP.trim();
  const isPncpControl = /^\d{14}-\d+-\d+\/\d{4}$/.test(ctrl);
  const dedupeKey = `pncp-${ctrl}`;
  const contentHash = createHash('sha256')
    .update(`${item.numeroControlePNCP}|${item.objeto || ''}|${item.valorTotalEstimado || ''}`)
    .digest('hex');

  const buyerName = item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || 'Órgão Licitante';
  const buyerDocument = item.orgaoEntidade?.cnpj?.replace(/\D/g, '') || null;
  const noticeNumber = item.numeroCompra || item.processo || item.numeroControlePNCP;
  const objectText = item.objeto || 'Objeto não detalhado pelo órgão convocador no PNCP';
  const estimatedValue = item.valorTotalEstimado != null && !isNaN(Number(item.valorTotalEstimado))
    ? Number(item.valorTotalEstimado)
    : null;

  const now = new Date();
  const rawPub = item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : null;
  const publishedAt = rawPub && !isNaN(rawPub.getTime()) ? (rawPub > now ? now : rawPub) : null;
  const openingAt = item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : null;
  const closingAt = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta) : null;

  const updateFields = {
    source: 'PNCP',
    noticeNumber,
    processoAdministrativo: item.processo || null,
    modality: item.modalidadeNome || defaultModalityName,
    buyerName,
    buyerDocument,
    object: objectText,
    uf: item.unidadeOrgao?.ufSigla || null,
    municipality: item.unidadeOrgao?.municipioNome || null,
    estimatedValue,
    status: item.situacaoCompraNome || 'Ativo',
    url: item.linkEditalPNCP || item.linkSistemaOrigem || null,
    publishedAt,
    openingAt,
    closingAt,
    srp: Boolean(item.srp),
    modoDisputa: item.modoDisputaNome || 'Aberto e Fechado',
    rawPayload: item as any,
    updatedAt: new Date(),
  };

  try {
    await prisma.procurementNotice.upsert({
      where: { dedupeKey },
      create: {
        source: 'PNCP',
        externalId: ctrl,
        ...(isPncpControl ? { numeroControlePncp: ctrl } : {}),
        dedupeKey,
        contentHash,
        noticeNumber,
        processoAdministrativo: item.processo || null,
        modality: item.modalidadeNome || defaultModalityName,
        buyerName,
        buyerDocument,
        object: objectText,
        uf: item.unidadeOrgao?.ufSigla || null,
        municipality: item.unidadeOrgao?.municipioNome || null,
        estimatedValue,
        status: item.situacaoCompraNome || 'Ativo',
        url: item.linkEditalPNCP || item.linkSistemaOrigem || null,
        publishedAt,
        openingAt,
        closingAt,
        srp: Boolean(item.srp),
        modoDisputa: item.modoDisputaNome || 'Aberto e Fechado',
        amparoLegal: 'Lei 14.133/2021',
        rawPayload: item as any,
      },
      update: updateFields,
    });
  } catch (err: any) {
    if (err?.code === 'P2002' && typeof prisma.procurementNotice.findFirst === 'function') {
      const existing = await prisma.procurementNotice.findFirst({
        where: {
          OR: [
            ...(isPncpControl ? [{ numeroControlePncp: ctrl }] : []),
            { externalId: ctrl },
          ],
        },
        select: { id: true },
      });
      if (existing?.id && typeof prisma.procurementNotice.update === 'function') {
        await prisma.procurementNotice.update({
          where: { id: existing.id },
          data: updateFields,
        });
        return true;
      }
    }
    throw err;
  }
  return true;
}

/**
 * Sincroniza editais das últimas 72 horas (/contratacoes/publicacao) via API oficial do PNCP
 * sondando a página 1 e percorrendo das últimas páginas para a 2 (captura D0/D-1 primeiro).
 */
export async function syncPncpLast24Hours(): Promise<{
  totalEncontrados: number;
  upsertados: number;
  erros: number;
}> {
  const startedAt = new Date();
  console.info(JSON.stringify({
    event: 'PNCP_CRON_JOB_STARTED',
    timestamp: startedAt.toISOString(),
    message: 'Iniciando sincronização de publicações PNCP (todas as 12 modalidades, D0 primeiro) com backoff exponencial...',
  }));

  const dataFinal = dateInBrazil(new Date());
  const lookbackDays = Math.max(1, Math.min(15, Number(process.env.PNCP_PUBLICACAO_DAYS_BACK || 3)));
  const dataInicial = subtractCalendarDays(dataFinal, lookbackDays);

  let totalEncontrados = 0;
  let upsertados = 0;
  let erros = 0;

  const maxPages = Math.max(1, Number(process.env.PNCP_MAX_PAGES_PER_RUN) || 100);
  const throttleDelayMs = Number(process.env.PNCP_PAGE_DELAY_MS) || 400;

  const persistPageItems = async (items: LicitacaoPNCP[], modalityName: string) => {
    for (let offset = 0; offset < items.length; offset += PERSIST_CONCURRENCY) {
      const batch = items.slice(offset, offset + PERSIST_CONCURRENCY);
      const results = await Promise.all(batch.map(async (item) => {
        try {
          return await upsertPncpNoticeItem(item, modalityName);
        } catch (itemErr) {
          erros++;
          console.warn(`[PNCP Cron] Erro ao persistir edital ${item.numeroControlePNCP}:`, itemErr);
          return false;
        }
      }));
      upsertados += results.filter(Boolean).length;
    }
  };

  for (const modalidade of MODALIDADES_PNCP) {
    console.info(`[PNCP Cron] Iniciando varredura paginada para ${modalidade.nome} (código ${modalidade.codigo})...`);

    try {
      const firstResult = await fetchWithBackoff(
        () => buscarContratacoesPNCP({
          dataInicial,
          dataFinal,
          codigoModalidadeContratacao: modalidade.codigo,
          pagina: 1,
          tamanhoPagina: PAGE_SIZE,
          endpoint: 'publicacao',
          incluirEncerrados: true,
        }),
        {
          context: `${modalidade.nome} (pág 1)`,
          maxRetries: 4,
          initialDelayMs: 1500,
        },
      );

      const firstItems: LicitacaoPNCP[] = firstResult.data || [];
      totalEncontrados += firstItems.length;

      if (firstItems.length === 0) {
        console.info(`[PNCP Cron] Sem registros para ${modalidade.nome} no período ${dataInicial}..${dataFinal}.`);
        continue;
      }

      await persistPageItems(firstItems, modalidade.nome);

      if (firstResult.totalRegistros !== null) {
        const totalPaginas = Math.ceil(firstResult.totalRegistros / PAGE_SIZE);
        if (totalPaginas > maxPages) {
          erros++;
          console.warn(
            `[PNCP Cron] Limite de ${maxPages} páginas atingido para ${modalidade.nome}; capturando as ${maxPages - 1} páginas finais (mais recentes) de ${totalPaginas}.`,
          );
        }

        const minTargetPage = Math.max(2, totalPaginas - (maxPages - 2));
        for (let pagina = totalPaginas; pagina >= minTargetPage; pagina--) {
          try {
            await sleep(throttleDelayMs);
            console.info(`[PNCP Cron] Consultando ${modalidade.nome} - Pág. ${pagina}/${totalPaginas} (${dataInicial} a ${dataFinal})...`);
            const resultado = await fetchWithBackoff(
              () => buscarContratacoesPNCP({
                dataInicial,
                dataFinal,
                codigoModalidadeContratacao: modalidade.codigo,
                pagina,
                tamanhoPagina: PAGE_SIZE,
                endpoint: 'publicacao',
                incluirEncerrados: true,
              }),
              {
                context: `${modalidade.nome} (pág ${pagina})`,
                maxRetries: 4,
                initialDelayMs: 1500,
              },
            );
            const items: LicitacaoPNCP[] = resultado.data || [];
            totalEncontrados += items.length;
            if (items.length > 0) {
              await persistPageItems(items, modalidade.nome);
            }
          } catch (pageErr: any) {
            erros++;
            console.error(`[PNCP Cron] Erro ao processar pág ${pagina} de ${modalidade.nome}:`, pageErr?.message || pageErr);
            break;
          }
        }
      } else if (firstItems.length === PAGE_SIZE) {
        for (let pagina = 2; pagina <= maxPages; pagina++) {
          try {
            await sleep(throttleDelayMs);
            const resultado = await fetchWithBackoff(
              () => buscarContratacoesPNCP({
                dataInicial,
                dataFinal,
                codigoModalidadeContratacao: modalidade.codigo,
                pagina,
                tamanhoPagina: PAGE_SIZE,
                endpoint: 'publicacao',
                incluirEncerrados: true,
              }),
              {
                context: `${modalidade.nome} (pág ${pagina})`,
                maxRetries: 4,
                initialDelayMs: 1500,
              },
            );
            const items: LicitacaoPNCP[] = resultado.data || [];
            totalEncontrados += items.length;
            if (items.length === 0) break;
            await persistPageItems(items, modalidade.nome);
            if (items.length < PAGE_SIZE) break;
          } catch (pageErr: any) {
            erros++;
            console.error(`[PNCP Cron] Erro ao processar pág ${pagina} de ${modalidade.nome}:`, pageErr?.message || pageErr);
            break;
          }
        }
      }
    } catch (firstErr: any) {
      erros++;
      console.error(`[PNCP Cron] Erro ao processar pág 1 de ${modalidade.nome}:`, firstErr?.message || firstErr);
    }
  }

  await saveIngestionCursor('PNCP', 'publicacao_diaria', {
    dataInicial,
    dataFinal,
    modalidades: MODALIDADES_PNCP.length,
    totalEncontrados,
    upsertados,
    erros,
  });
  await recordIngestionJob({
    source: 'PNCP',
    connector: 'syncPncpLast24Hours',
    status: erros > 0 && upsertados === 0 ? 'failed' : erros > 0 ? 'partial' : 'completed',
    recordsSeen: totalEncontrados,
    recordsAccepted: upsertados,
    recordsFailed: erros,
    startedAt,
    metadata: { dataInicial, dataFinal, modalidades: MODALIDADES_PNCP.length },
  });

  console.info(JSON.stringify({
    event: 'PNCP_CRON_JOB_COMPLETED',
    timestamp: new Date().toISOString(),
    totalEncontrados,
    upsertados,
    erros,
  }));

  return { totalEncontrados, upsertados, erros };
}

/**
 * Sincroniza editais com recebimento de propostas em aberto (/contratacoes/proposta)
 * combinando captura imediata dos mais recentes + varredura contínua por cursor em todas as modalidades
 * (com rotação por UF para Dispensa código 8, evitando timeout da consulta nacional sem filtro).
 */
export async function syncPncpPropostasAbertas(
  pagesPerModality = 15,
  options: {
    useCursor?: boolean;
    modalities?: ReadonlyArray<{ codigo: number; nome: string }>;
    dispensaUfCount?: number;
  } = {},
): Promise<{
  totalEncontrados: number;
  upsertados: number;
  erros: number;
  modalidadesProcessadas: number;
}> {
  const startedAt = new Date();
  let totalEncontrados = 0;
  let upsertados = 0;
  let erros = 0;
  let modalidadesProcessadas = 0;
  const useCursor = options.useCursor !== false;
  const targetModalities = options.modalities ?? MODALIDADES_PNCP;
  const maxPagesSweep = Math.max(1, pagesPerModality);

  const persistList = async (items: LicitacaoPNCP[], modName: string) => {
    for (let offset = 0; offset < items.length; offset += PERSIST_CONCURRENCY) {
      const batch = items.slice(offset, offset + PERSIST_CONCURRENCY);
      const done = await Promise.all(
        batch.map(async (item) => {
          try {
            return await upsertPncpNoticeItem(item, modName);
          } catch {
            erros += 1;
            return false;
          }
        }),
      );
      upsertados += done.filter(Boolean).length;
    }
  };

  for (const mod of targetModalities) {
    modalidadesProcessadas += 1;

    // Caso especial Dispensa (8): rota nacional sem UF frequentemente excede 15s no PNCP;
    // rotacionamos lotes de UF com cursor persistente (~6 UFs por ciclo cobrem todo o Brasil).
    if (mod.codigo === 8) {
      const cursorKey = 'proposta_sweep_mod_8_uf';
      const existingCursor = useCursor ? await readIngestionCursor('PNCP', cursorKey) : null;
      const startIdx = Math.max(
        0,
        Math.min(UFS_BRASIL.length - 1, Number(existingCursor?.cursorValue?.nextUfIndex || 0)),
      );
      const ufCount =
        options.dispensaUfCount ??
        Math.max(1, Math.min(27, Number(process.env.PNCP_DISPENSA_UFS_PER_RUN || 6)));
      const pagesPerUf = Math.max(1, Math.min(3, Math.ceil(maxPagesSweep / 4)));
      const processedUfs: string[] = [];

      for (let i = 0; i < ufCount; i++) {
        const uf = UFS_BRASIL[(startIdx + i) % UFS_BRASIL.length];
        processedUfs.push(uf);

        for (let pagina = 1; pagina <= pagesPerUf; pagina++) {
          try {
            const res = await fetchWithBackoff(
              () =>
                buscarContratacoesPNCP({
                  endpoint: 'proposta',
                  codigoModalidadeContratacao: 8,
                  uf,
                  pagina,
                  tamanhoPagina: PAGE_SIZE,
                  ordemOriginal: true,
                }),
              { context: `Propostas Dispensa UF ${uf} pág ${pagina}`, maxRetries: 1, initialDelayMs: 1000 },
            );
            const items = res.data || [];
            totalEncontrados += items.length;
            if (items.length === 0) break;
            await persistList(items, mod.nome);
            if (items.length < PAGE_SIZE) break;
            await sleep(200);
          } catch (err: any) {
            erros += 1;
            console.warn(`[PNCP Propostas] Dispensa UF ${uf} pág ${pagina}:`, err?.message || err);
            break;
          }
        }
      }

      if (useCursor) {
        const nextUfIndex = (startIdx + ufCount) % UFS_BRASIL.length;
        const covered = nextUfIndex === 0 ? UFS_BRASIL.length : nextUfIndex;
        const progressPct = Math.min(100, Math.round((covered / UFS_BRASIL.length) * 100));
        await saveIngestionCursor('PNCP', cursorKey, {
          modalidadeCodigo: 8,
          modalidadeNome: mod.nome,
          nextUfIndex,
          lastUfs: processedUfs,
          totalUfs: UFS_BRASIL.length,
          progressPct,
          ...(nextUfIndex === 0 ? { lastFullSweepAt: new Date().toISOString() } : {}),
        });
      }
      continue;
    }

    // Demais modalidades: Fase A (recência imediata via páginas finais) + Fase B (varredura contínua via cursor)
    let totalRegistros: number | null = null;
    const recentPages = mod.codigo === 9 ? 1 : Math.min(2, maxPagesSweep);

    for (let pagina = 1; pagina <= recentPages; pagina++) {
      try {
        const res = await fetchWithBackoff(
          () =>
            buscarContratacoesPNCP({
              endpoint: 'proposta',
              codigoModalidadeContratacao: mod.codigo,
              pagina,
              tamanhoPagina: PAGE_SIZE,
            }),
          { context: `Propostas ${mod.nome} recente pág ${pagina}`, maxRetries: 2, initialDelayMs: 1000 },
        );
        if (typeof res.totalRegistros === 'number' && res.totalRegistros >= 0) {
          totalRegistros = res.totalRegistros;
        }
        const items = res.data || [];
        totalEncontrados += items.length;
        if (items.length === 0) break;
        await persistList(items, mod.nome);
        if (items.length < PAGE_SIZE) break;
        await sleep(250);
      } catch (err: any) {
        erros += 1;
        console.warn(`[PNCP Propostas] Falha em ${mod.nome} pág ${pagina}:`, err?.message || err);
        break;
      }
    }

    if (!useCursor) continue;

    const cursorKey = `proposta_sweep_mod_${mod.codigo}`;
    const totalPages = totalRegistros !== null && totalRegistros > 0
      ? Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE))
      : 1;

    if (totalPages <= recentPages || mod.codigo === 9) {
      await saveIngestionCursor('PNCP', cursorKey, {
        modalidadeCodigo: mod.codigo,
        modalidadeNome: mod.nome,
        nextPage: 1,
        totalPages,
        totalRegistros: totalRegistros ?? 0,
        progressPct: 100,
        lastFullSweepAt: new Date().toISOString(),
      });
      continue;
    }

    const existingCursor = await readIngestionCursor('PNCP', cursorKey);
    const startPage = Math.max(
      1,
      Math.min(totalPages, Number(existingCursor?.cursorValue?.nextPage || 1)),
    );
    const endPage = Math.min(totalPages, startPage + maxPagesSweep - 1);
    let lastPageRead = startPage - 1;
    let reachedEnd = false;

    for (let pagina = startPage; pagina <= endPage; pagina++) {
      try {
        const res = await fetchWithBackoff(
          () =>
            buscarContratacoesPNCP({
              endpoint: 'proposta',
              codigoModalidadeContratacao: mod.codigo,
              pagina,
              tamanhoPagina: PAGE_SIZE,
              ordemOriginal: true,
            }),
          { context: `Propostas Sweep ${mod.nome} pág ${pagina}/${totalPages}`, maxRetries: 2, initialDelayMs: 1000 },
        );
        const items = res.data || [];
        lastPageRead = pagina;
        totalEncontrados += items.length;
        if (items.length === 0) {
          reachedEnd = true;
          break;
        }
        await persistList(items, mod.nome);
        if (pagina >= totalPages || items.length < PAGE_SIZE) {
          reachedEnd = true;
          break;
        }
        await sleep(250);
      } catch (err: any) {
        erros += 1;
        console.warn(`[PNCP Propostas Sweep] Falha em ${mod.nome} pág ${pagina}:`, err?.message || err);
        break;
      }
    }

    const finishedSweep = reachedEnd || lastPageRead >= totalPages;
    const nextPage = finishedSweep ? 1 : Math.max(1, lastPageRead + 1);
    const progressPct = finishedSweep
      ? 100
      : Math.min(99, Math.round((Math.max(1, lastPageRead) / totalPages) * 100));

    await saveIngestionCursor('PNCP', cursorKey, {
      modalidadeCodigo: mod.codigo,
      modalidadeNome: mod.nome,
      nextPage,
      lastPageRead,
      totalPages,
      totalRegistros: totalRegistros ?? 0,
      progressPct,
      ...(finishedSweep ? { lastFullSweepAt: new Date().toISOString() } : {}),
    });
  }

  await recordIngestionJob({
    source: 'PNCP',
    connector: 'syncPncpPropostasAbertas',
    status: erros > 0 && upsertados === 0 ? 'failed' : erros > 0 ? 'partial' : 'completed',
    recordsSeen: totalEncontrados,
    recordsAccepted: upsertados,
    recordsFailed: erros,
    startedAt,
    metadata: { pagesPerModality, modalidadesProcessadas },
  });

  console.info(
    `[PNCP Propostas] Sincronizados ${upsertados}/${totalEncontrados} editais abertos em ${modalidadesProcessadas} modalidades (${erros} erros).`,
  );
  return { totalEncontrados, upsertados, erros, modalidadesProcessadas };
}

/**
 * Sincroniza retificações e alterações recentes (/contratacoes/atualizacao) das últimas 48h.
 */
export async function syncPncpAtualizacoes(maxPagesPerModality = 4): Promise<{
  totalEncontrados: number;
  upsertados: number;
}> {
  const startedAt = new Date();
  const dataFinal = dateInBrazil(new Date());
  const dataInicial = subtractCalendarDays(dataFinal, 2);
  let totalEncontrados = 0;
  let upsertados = 0;
  let failed = 0;

  const persistBatch = async (items: LicitacaoPNCP[], modalityName: string) => {
    for (let offset = 0; offset < items.length; offset += PERSIST_CONCURRENCY) {
      const batch = items.slice(offset, offset + PERSIST_CONCURRENCY);
      const done = await Promise.all(
        batch.map((item) => upsertPncpNoticeItem(item, modalityName).catch(() => false)),
      );
      upsertados += done.filter(Boolean).length;
    }
  };

  for (const mod of MODALIDADES_PNCP) {
    try {
      const firstRes = await fetchWithBackoff(
        () => buscarContratacoesPNCP({
          endpoint: 'atualizacao',
          dataInicial,
          dataFinal,
          codigoModalidadeContratacao: mod.codigo,
          pagina: 1,
          tamanhoPagina: PAGE_SIZE,
          incluirEncerrados: true,
        }),
        { context: `Atualização ${mod.nome} pág 1`, maxRetries: 2, initialDelayMs: 1000 },
      );
      const firstItems = firstRes.data || [];
      totalEncontrados += firstItems.length;
      if (firstItems.length === 0) continue;

      await persistBatch(firstItems, mod.nome);

      const totalPaginas = firstRes.totalRegistros !== null
        ? Math.max(1, Math.ceil(firstRes.totalRegistros / PAGE_SIZE))
        : (firstItems.length === PAGE_SIZE ? maxPagesPerModality : 1);

      if (totalPaginas > 1 && maxPagesPerModality > 1) {
        const minPage = Math.max(2, totalPaginas - maxPagesPerModality + 2);
        for (let pagina = totalPaginas; pagina >= minPage; pagina--) {
          await sleep(300);
          const res = await fetchWithBackoff(
            () => buscarContratacoesPNCP({
              endpoint: 'atualizacao',
              dataInicial,
              dataFinal,
              codigoModalidadeContratacao: mod.codigo,
              pagina,
              tamanhoPagina: PAGE_SIZE,
              incluirEncerrados: true,
            }),
            { context: `Atualização ${mod.nome} pág ${pagina}`, maxRetries: 2, initialDelayMs: 1000 },
          );
          const items = res.data || [];
          totalEncontrados += items.length;
          if (items.length > 0) {
            await persistBatch(items, mod.nome);
          }
        }
      }
    } catch (err: any) {
      failed += 1;
      console.warn(`[PNCP Atualizacoes] Falha em ${mod.nome}:`, err?.message || err);
    }
  }

  await saveIngestionCursor('PNCP', 'atualizacao_48h', {
    dataInicial,
    dataFinal,
    totalEncontrados,
    upsertados,
  });
  await recordIngestionJob({
    source: 'PNCP',
    connector: 'syncPncpAtualizacoes',
    status: failed > 0 && upsertados === 0 ? 'failed' : failed > 0 ? 'partial' : 'completed',
    recordsSeen: totalEncontrados,
    recordsAccepted: upsertados,
    recordsFailed: failed,
    startedAt,
    metadata: { dataInicial, dataFinal },
  });

  console.info(`[PNCP Atualizacoes] Atualizados ${upsertados}/${totalEncontrados} editais modificados recentemente.`);
  return { totalEncontrados, upsertados };
}

let multiPortalSyncInFlight = false;

export async function runMultiPortalSync(): Promise<{
  totalUpsertados: number;
  porFonte?: Record<string, number>;
}> {
  if (multiPortalSyncInFlight) {
    return { totalUpsertados: 0 };
  }
  multiPortalSyncInFlight = true;
  let totalUpsertados = 0;

  try {
    const runPncpPipeline = async () => {
      const pub = await syncPncpLast24Hours();
      const atu = await syncPncpAtualizacoes(4);
      const prop = await syncPncpPropostasAbertas(12);
      return pub.upsertados + atu.upsertados + prop.upsertados;
    };

    const [pncpRes, cgRes, qdRes, ptRes] = await Promise.allSettled([
      runPncpPipeline(),
      syncComprasGovRecentes({ daysBack: 7, maxPages: 4 }),
      syncQueridoDiarioEditais({ daysBack: 10, size: 60, maxPages: 3 }),
      syncPortalTransparenciaEditais({ daysBack: 28 }),
      syncPcaRecentDays({ daysBack: 2, maxPagesPerDay: 4 }),
    ]);

    const pncpTotal = pncpRes.status === 'fulfilled' ? pncpRes.value : 0;
    const cgTotal = cgRes.status === 'fulfilled' ? cgRes.value.persisted : 0;
    const qdTotal = qdRes.status === 'fulfilled' ? qdRes.value.persisted : 0;
    const ptTotal = ptRes.status === 'fulfilled' ? ptRes.value.persisted : 0;

    totalUpsertados = pncpTotal + cgTotal + qdTotal + ptTotal;

    emitEditaisAtualizados({ fonte: 'multifonte', quantidade: totalUpsertados });
    console.info(
      `[MultiPortal Sync] Ciclo concluído. Total upsertados/atualizados: ${totalUpsertados} (PNCP=${pncpTotal}, ComprasGov=${cgTotal}, QueridoDiario=${qdTotal}, Transparencia=${ptTotal}).`,
    );
    return {
      totalUpsertados,
      porFonte: {
        PNCP: pncpTotal,
        ComprasGov: cgTotal,
        querido_diario: qdTotal,
        portal_transparencia: ptTotal,
      },
    };
  } finally {
    multiPortalSyncInFlight = false;
  }
}

/**
 * Inicializa o agendamento rotineiro do cron job do PNCP.
 */
export function setupPncpDailyCron(): cron.ScheduledTask | null {
  const schedule = process.env.PNCP_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(`[PNCP Cron] Expressão cron inválida: "${schedule}". Usando padrão "${DEFAULT_CRON_SCHEDULE}".`);
  }

  const validSchedule = cron.validate(schedule) ? schedule : DEFAULT_CRON_SCHEDULE;

  console.info(`[PNCP Cron] Cron Job configurado para executar na rotina: "${validSchedule}" (Fuso: ${TIMEZONE}).`);

  const task = cron.schedule(
    validSchedule,
    async () => {
      try {
        await runMultiPortalSync();
      } catch (err: any) {
        console.error('[PNCP Cron] Erro não capturado no ciclo do cron:', err);
      }
    },
    {
      timezone: TIMEZONE,
    }
  );

  setTimeout(() => {
    void runMultiPortalSync().catch((e) => console.warn('[MultiPortal Boot Sync] Aviso:', e?.message || e));
  }, 10000);

  return task;
}

/**
 * Inicializa o agendamento diário de alertas de prazos (24h e 48h) via NotificationsWorker.
 */
export function setupDeadlineAlertsCron(): cron.ScheduledTask | null {
  const schedule = process.env.DEADLINE_ALERT_CRON_SCHEDULE || DEFAULT_DEADLINE_ALERT_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(`[Deadline Cron] Expressão cron inválida: "${schedule}". Usando padrão "${DEFAULT_DEADLINE_ALERT_SCHEDULE}".`);
  }

  const validSchedule = cron.validate(schedule) ? schedule : DEFAULT_DEADLINE_ALERT_SCHEDULE;

  console.info(`[Deadline Cron] Cron Job configurado para executar na rotina: "${validSchedule}" (Fuso: ${TIMEZONE}).`);

  const task = cron.schedule(
    validSchedule,
    async () => {
      try {
        const notificationsWorker = new NotificationsWorker();
        await notificationsWorker.processUpcomingDeadlines();
      } catch (err: any) {
        console.error('[Deadline Cron] Erro não capturado no ciclo de alerta de prazos:', err);
      }
    },
    {
      timezone: TIMEZONE,
    }
  );

  return task;
}

export function setupCertificateAlertsCron(): cron.ScheduledTask {
  const schedule = process.env.CERTIFICATE_ALERT_CRON_SCHEDULE || DEFAULT_CERTIFICATE_ALERT_SCHEDULE;
  const validSchedule = cron.validate(schedule) ? schedule : DEFAULT_CERTIFICATE_ALERT_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(
      `[Certificates Cron] Expressão cron inválida: "${schedule}". Usando padrão "${DEFAULT_CERTIFICATE_ALERT_SCHEDULE}".`,
    );
  }

  console.info(
    `[Certificates Cron] Alertas de validade agendados para "${validSchedule}" (Fuso: ${TIMEZONE}).`,
  );

  return cron.schedule(
    validSchedule,
    async () => {
      try {
        const worker = new CertificatesWorker();
        const syncResult = await worker.syncFromInfoSimples();
        const expirationResult = await worker.checkExpirations();
        console.info('[Certificates Cron] Sincronização oficial e verificação de validade concluídas:', {
          syncResult,
          expirationResult,
        });
      } catch (error) {
        console.error('[Certificates Cron] Falha ao verificar certidões:', error);
      }
    },
    { timezone: TIMEZONE },
  );
}

/**
 * Inicializa todos os Cron Jobs de produção e automação exclusivamente no Worker.
 */
export function setupCronJobs(): void {
  const cronEnabled = isCronEnabled(process.env.CRON_JOBS_ENABLED) && isCronEnabled(process.env.ENABLE_CRON_JOBS);

  if (!cronEnabled) {
    console.info(JSON.stringify({
      event: 'CRON_JOBS_DISABLED',
      reason: 'CRON_JOBS_ENABLED_FALSE',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  console.info(JSON.stringify({
    event: 'CRON_JOBS_INITIALIZING',
    timestamp: new Date().toISOString(),
  }));

  setupPncpDailyCron();
  setupDeadlineAlertsCron();
  setupCertificateAlertsCron();
  setupCndRenewalCron();
  setupPrivacyJob();
  setupPlanResetCron();
  new DataPlatformWorkerService(undefined, undefined, undefined, undefined, undefined, {
    ...process.env,
    DATA_PLATFORM_PNCP_WORKER_ENABLED: 'false',
    DATA_PLATFORM_COMPRASGOV_WORKER_ENABLED: 'false',
  }).start();
  setupCnaeAlertCron();
  setupDailyOpportunityAlertsCron();
  setupEditalQueueCron();
}

export function setupEditalQueueCron(): cron.ScheduledTask | null {
  const schedule = process.env.EDITAL_QUEUE_CRON_SCHEDULE || '*/20 * * * *';
  const validSchedule = cron.validate(schedule) ? schedule : '*/20 * * * *';

  console.info(`[Fila Leitura Editais] Cron configurado para: "${validSchedule}" (Fuso: ${TIMEZONE}).`);

  // Executa primeiro ciclo após 45s de boot sem travar inicialização
  setTimeout(() => {
    void processarFilaEditaisAbertos().catch((err) =>
      console.warn('[Fila Leitura Editais] Erro no ciclo inicial:', err?.message),
    );
  }, 45000);

  return cron.schedule(
    validSchedule,
    async () => {
      try {
        await processarFilaEditaisAbertos();
      } catch (err: any) {
        console.error('[Fila Leitura Editais] Erro no ciclo agendado:', err?.message);
      }
    },
    { timezone: TIMEZONE },
  );
}
/**
 * Cron de Alerta Diário de Editais por CNAE (Resend + Agente Semântico de IA)
 * Horário: 08:00 AM (America/Sao_Paulo)
 * Regra: Validação rigorosa de relevância (Zero Alucinação), sem spam se não houver editais.
 */
export function setupCnaeAlertCron() {
  cron.schedule('0 8 * * *', async () => {
    const timestampInicio = new Date().toISOString();

    // 1 & 2. Trava de Execução por Variável de Ambiente
    if (process.env.CRON_CNAE_ALERTS_ENABLED === 'false') {
      console.info(`[Radar Cron][${timestampInicio}] ⏸️ Cron de editais por CNAE desabilitado (CRON_CNAE_ALERTS_ENABLED=false).`);
      return;
    }

    console.info(`[Radar Cron][${timestampInicio}] 🤖 Iniciando varredura diária de oportunidades por CNAE...`);

    try {
      // 3. Coleta de Empresas ativas com CNAE cadastrado
      const empresas = await prisma.company.findMany({
        where: {
          cnaePrincipal: { not: null },
          OR: [
            { status: null },
            { status: { in: ['ATIVO', 'ativo', 'ATIVA', 'ativa'] } },
          ],
          user: { deletedAt: null },
        },
        include: {
          user: {
            select: { email: true, nome: true },
          },
        },
      });

      console.info(`[Radar Cron][${new Date().toISOString()}] 🏢 ${empresas.length} empresa(s) ativa(s) carregada(s) para análise.`);

      // 4. Janela Temporal de 24 horas para filtro aderente por perfil de empresa
      const dataOntem = new Date();
      dataOntem.setDate(dataOntem.getDate() - 1);
      const dataPublicacaoIso = dataOntem.toISOString().slice(0, 10);

      const appUrl = (process.env.FRONTEND_URL || 'https://www.expertiselicitatoria.com.br').replace(/\/+$/, '');
      let totalDisparos = 0;

      // 5. Loop de Validação por Empresa respeitando UF, palavras-chave, CNAE e tipo de objeto
      for (const empresa of empresas) {
        const email = (empresa as any).email || empresa.user?.email;
        if (!email || !empresa.cnaePrincipal) continue;

        const regioesEmpresa = Array.isArray(empresa.regioes) && empresa.regioes.length > 0
          ? empresa.regioes.map((u: string) => String(u).trim().toUpperCase()).filter(Boolean)
          : (empresa.uf ? [String(empresa.uf).trim().toUpperCase()] : []);
        const palavrasEmpresa = Array.from(new Set([
          ...(Array.isArray(empresa.palavrasChave) ? empresa.palavrasChave : []),
          ...(Array.isArray(empresa.nicho) ? empresa.nicho : []),
          ...keywordsForCnae(empresa.cnaePrincipal),
        ].map((k) => String(k).trim()).filter(Boolean))).slice(0, 12);
        const tiposObjetoEmpresa = Array.isArray((empresa as any).radarTiposObjeto)
          ? (empresa as any).radarTiposObjeto.filter(Boolean)
          : [];

        const buscaEmpresa = await listarLicitacoes({
          apenasAbertos: true,
          dataPublicacao: dataPublicacaoIso,
          ...(regioesEmpresa.length > 0 ? { ufs: regioesEmpresa, uf: regioesEmpresa.join(',') } : {}),
          ...(palavrasEmpresa.length > 0 ? { palavras: palavrasEmpresa } : {}),
          ...(tiposObjetoEmpresa.length > 0 ? { tipoObjeto: tiposObjetoEmpresa.join(',') } : {}),
          incluirSemClassificacao: (empresa as any).radarIncluirSemClassificacao ?? true,
          tamanhoPagina: 15,
          pagina: 1,
          ordenarPor: 'recentes',
        }).catch(() => ({ data: [] as any[] }));

        const editaisCandidatos = Array.isArray(buscaEmpresa?.data) ? buscaEmpresa.data : [];
        if (editaisCandidatos.length === 0) continue;

        const editaisValidados = [];

        for (const edital of editaisCandidatos) {
          const objTexto = edital.objeto || (edital as any).object;
          if (!objTexto) continue;
          const valEstimado = edital.valorEstimado ?? edital.valorTotalEstimado ?? null;

          try {
            const analise = await avaliarCompatibilidadeCnae({
              objetoEdital: objTexto,
              cnaeCodigo: empresa.cnaePrincipal,
              razaoSocial: empresa.razaoSocial,
              valorEstimado: valEstimado ? Number(valEstimado) : null,
            });

            if (analise.aderente) {
              editaisValidados.push({
                titulo: `${edital.numeroEdital || edital.numeroCompra || 'Edital'} - ${analise.resumoObjeto}`,
                orgao: edital.orgao || 'Órgão Convocador',
                valorEstimado: valEstimado
                  ? `R$ ${Number(valEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : undefined,
                link: `${appUrl}/fornecedor/licitacoes/${edital.id}`,
                resumoExecutivo: analise.resumoObjeto,
                pontosDeAtencao: [analise.justificativa],
              });
            }
          } catch (agentErr) {
            console.warn(`[Radar Cron] Falha ao analisar edital ${edital.id} para CNAE ${empresa.cnaePrincipal}:`, agentErr);
          }

          // Limite de 5 editais mais relevantes por e-mail para evitar sobrecarga
          if (editaisValidados.length >= 5) break;
        }

        // 6. Disparo via Resend (Apenas se houver editais validados)
        if (editaisValidados.length > 0) {
          try {
            const emailResult = await enviarAlertaEditaisCnae({
              email,
              empresaNome: empresa.razaoSocial || 'Licitante',
              cnae: empresa.cnaePrincipal,
              editais: editaisValidados,
            });

            totalDisparos++;
            console.info(`[Radar Cron][${new Date().toISOString()}] 📧 ${editaisValidados.length} oportunidade(s) enviada(s) para ${email} (${empresa.razaoSocial}) - Email ID: ${emailResult?.id || 'N/A'}`);
          } catch (sendErr) {
            console.error(`[Radar Cron] Erro ao disparar e-mail para ${email}:`, sendErr);
          }
        }
      }

      // 7. Observabilidade e Fechamento
      console.info(`[Radar Cron][${new Date().toISOString()}] ✅ Rotina diária concluída: ${empresas.length} empresas processadas, ${totalDisparos} e-mail(s) oficial(is) disparado(s).`);
    } catch (error) {
      console.error(`[Radar Cron][${new Date().toISOString()}] ❌ Erro não tratado durante a rotina do radar:`, error);
    }
  }, { timezone: 'America/Sao_Paulo' });
}

export const iniciarRadarDiarioCron = setupCnaeAlertCron;

/**
 * Cron diário às 06:00 (0 6 * * *)
 * 1. Consulta contratações das últimas 24h no PNCP e persiste no banco (syncPncpLast24Hours).
 * 2. Cruza com CNAEs, palavras-chave e UFs das empresas ativas.
 * 3. Grava notificação no banco (Notification com tipo: nova_oportunidade, título: "Novas Oportunidades Abertas no seu Segmento").
 */
export async function runDailyOpportunityAlertsScan(): Promise<{
  empresasNotificadas: number;
  totalNotificacoes: number;
}> {
  console.info('[Alerta Oportunidades 06:00] Iniciando sincronização e envio de alertas diários...');

  // 1. Sincroniza últimas 24h do PNCP
  await syncPncpLast24Hours().catch((err) => {
    console.error('[Alerta Oportunidades 06:00] Erro ao sincronizar PNCP:', err);
  });

  // 2. Busca empresas ativas
  const empresas = await prisma.company.findMany({
    where: {
      OR: [
        { status: null },
        { status: { in: ['ATIVO', 'ativo', 'ATIVA', 'ativa'] } },
      ],
      user: { deletedAt: null },
    },
    select: {
      id: true,
      userId: true,
      razaoSocial: true,
      cnaePrincipal: true,
      palavrasChave: true,
      uf: true,
    },
  });

  if (!empresas || empresas.length === 0) {
    console.info('[Alerta Oportunidades 06:00] Nenhuma empresa ativa encontrada.');
    return { empresasNotificadas: 0, totalNotificacoes: 0 };
  }

  // 3. Busca editais das últimas 24h
  const dataOntem = new Date();
  dataOntem.setDate(dataOntem.getDate() - 1);

  const editaisRecentes = await prisma.procurementNotice.findMany({
    where: {
      createdAt: { gte: dataOntem },
    },
    select: {
      id: true,
      noticeNumber: true,
      buyerName: true,
      object: true,
      uf: true,
      estimatedValue: true,
    },
    take: 200,
  });

  if (!editaisRecentes || editaisRecentes.length === 0) {
    console.info('[Alerta Oportunidades 06:00] Nenhum edital recente nas últimas 24h para cruzamento.');
    return { empresasNotificadas: 0, totalNotificacoes: 0 };
  }

  let empresasNotificadas = 0;
  let totalNotificacoes = 0;

  for (const empresa of empresas) {
    if (!empresa.userId) continue;

    // Palavras-chave do CNAE e customizadas
    const cnaeKeywords = empresa.cnaePrincipal ? keywordsForCnae(empresa.cnaePrincipal) : [];
    const customKeywords = Array.isArray(empresa.palavrasChave) ? empresa.palavrasChave : [];
    const allKeywords = Array.from(new Set([...cnaeKeywords, ...customKeywords].map(k => String(k).toLowerCase().trim()))).filter(k => k.length >= 3);

    const matches = editaisRecentes.filter((edital) => {
      // Filtro por UF (se empresa tiver UF cadastrada e edital tiver UF cadastrada)
      if (empresa.uf && edital.uf && empresa.uf.toUpperCase() !== edital.uf.toUpperCase()) {
        return false;
      }

      if (allKeywords.length === 0) {
        return true;
      }

      const objLower = (edital.object || '').toLowerCase();
      return allKeywords.some((kw) => objLower.includes(kw));
    });

    if (matches.length > 0) {
      await prisma.notification.create({
        data: {
          userId: empresa.userId,
          tipo: 'nova_oportunidade',
          titulo: 'Novas Oportunidades Abertas no seu Segmento',
          mensagem: `Encontramos ${matches.length} nova(s) oportunidade(s) aderente(s) ao seu segmento nas últimas 24h.`,
          canal: 'painel',
          status: 'enviada',
          enviadaEm: new Date(),
          link: '/licitacoes',
        },
      });

      empresasNotificadas++;
      totalNotificacoes++;
    }
  }

  console.info(`[Alerta Oportunidades 06:00] Finalizado: ${empresasNotificadas} empresas notificadas (${totalNotificacoes} notificações).`);
  return { empresasNotificadas, totalNotificacoes };
}

export function setupDailyOpportunityAlertsCron(): cron.ScheduledTask | null {
  const schedule = process.env.DAILY_OPPORTUNITIES_CRON_SCHEDULE || '0 6 * * *';
  const validSchedule = cron.validate(schedule) ? schedule : '0 6 * * *';

  console.info(`[Alerta Oportunidades Cron] Cron Job configurado para executar na rotina: "${validSchedule}" (Fuso: ${TIMEZONE}).`);

  return cron.schedule(
    validSchedule,
    async () => {
      try {
        await runDailyOpportunityAlertsScan();
      } catch (err: any) {
        console.error('[Alerta Oportunidades Cron] Erro não capturado no ciclo de alerta de oportunidades:', err);
      }
    },
    { timezone: TIMEZONE }
  );
}


let lastPncpBackgroundCheckAt = 0;
let pncpSyncInFlight = false;

export async function ensureFreshPncpSync(): Promise<void> {
  const now = Date.now();
  if (pncpSyncInFlight || now - lastPncpBackgroundCheckAt < 2 * 60 * 60 * 1000) {
    return;
  }
  lastPncpBackgroundCheckAt = now;
  try {
    const latest = await prisma.procurementNotice.findFirst({
      where: { source: { in: ['PNCP', 'pncp'] } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    const staleMs = 2 * 60 * 60 * 1000;
    if (!latest || now - new Date(latest.updatedAt).getTime() > staleMs) {
      pncpSyncInFlight = true;
      void syncPncpLast24Hours()
        .catch((err) => console.warn('[PNCP Background Sync] Falha:', err?.message || err))
        .finally(() => {
          pncpSyncInFlight = false;
        });
    }
  } catch {
    pncpSyncInFlight = false;
  }
}
