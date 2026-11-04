import { analisarEditalParaCnae } from '../services/cnae-to-keywords.service';
import cron from 'node-cron';
import { createHash } from 'crypto';
import { prisma } from '../database/prisma';
import { buscarContratacoesPNCP, LicitacaoPNCP, PncpServiceError } from '../services/pncp.service';
import { setupCndRenewalCron } from './cnd-renewal.cron';
import { setupPrivacyJob } from './privacy.job';
import { setupPlanResetCron } from './plan-reset.cron';
import { setupDataPlatformWorkers } from '../services/data-platform';
import { CertificatesWorker } from '../workers/certificates.worker';
import { NotificationsWorker } from '../workers/notifications.worker';
import { enviarAlertaEditaisCnae } from '../services/resend.service';


const DEFAULT_CRON_SCHEDULE = '0 2,14 * * *'; // 2h e 14h todos os dias
const DEFAULT_DEADLINE_ALERT_SCHEDULE = '0 8 * * *'; // 8h todos os dias
const DEFAULT_CERTIFICATE_ALERT_SCHEDULE = '0 8 * * *'; // 8h todos os dias
const TIMEZONE = 'America/Sao_Paulo';
const PAGE_SIZE = 50;
const PERSIST_CONCURRENCY = 10;

const MODALIDADES_PNCP = [
  { codigo: 4, nome: 'Concorrência Eletrônica' },
  { codigo: 6, nome: 'Pregão Eletrônico' },
  { codigo: 8, nome: 'Dispensa de Licitação' },
  { codigo: 12, nome: 'Credenciamento' },
];

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

function previousCalendarDay(value: string): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, '0'),
    String(previous.getUTCDate()).padStart(2, '0'),
  ].join('');
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

/**
 * Sincroniza editais das últimas 24 horas via API oficial do PNCP utilizando
 * paginação completa e backoff exponencial contra Erro 429.
 * Realiza upsert idempotente no PostgreSQL (procurement_notices).
 */
export async function syncPncpLast24Hours(): Promise<{
  totalEncontrados: number;
  upsertados: number;
  erros: number;
}> {
  console.info(JSON.stringify({
    event: 'PNCP_CRON_JOB_STARTED',
    timestamp: new Date().toISOString(),
    message: 'Iniciando sincronização com paginação completa e backoff exponencial...',
  }));

  const dataFinal = dateInBrazil(new Date());
  const dataInicial = previousCalendarDay(dataFinal);

  let totalEncontrados = 0;
  let upsertados = 0;
  let erros = 0;

  const maxPages = Number(process.env.PNCP_MAX_PAGES_PER_RUN) || 50; // Até 2.500 editais por modalidade
  const throttleDelayMs = Number(process.env.PNCP_PAGE_DELAY_MS) || 400; // Intervalo para cortesia de tráfego

  for (const modalidade of MODALIDADES_PNCP) {
    let pagina = 1;
    let totalPaginas = 1;
    let hasMore = true;

    console.info(`[PNCP Cron] Iniciando varredura paginada para ${modalidade.nome} (código ${modalidade.codigo})...`);

    while (hasMore && pagina <= maxPages) {
      try {
        console.info(`[PNCP Cron] Consultando ${modalidade.nome} - Pág. ${pagina}/${totalPaginas > 1 ? totalPaginas : '?'} (período: ${dataInicial} a ${dataFinal})...`);

        const resultado = await fetchWithBackoff(
          () => buscarContratacoesPNCP({
            dataInicial,
            dataFinal,
            codigoModalidadeContratacao: modalidade.codigo,
            pagina,
            tamanhoPagina: PAGE_SIZE,
          }),
          {
            context: `${modalidade.nome} (pág ${pagina})`,
            maxRetries: 4,
            initialDelayMs: 1500,
          }
        );

        const items: LicitacaoPNCP[] = resultado.data || [];
        totalEncontrados += items.length;

        if (resultado.totalRegistros !== null) {
          totalPaginas = Math.ceil(resultado.totalRegistros / PAGE_SIZE);
        }

        if (items.length === 0) {
          console.info(`[PNCP Cron] Fim dos registros para ${modalidade.nome} na página ${pagina}.`);
          hasMore = false;
          break;
        }

        console.info(`[PNCP Cron] ${items.length} editais recebidos (pág ${pagina}). Persistindo no banco...`);

        for (let offset = 0; offset < items.length; offset += PERSIST_CONCURRENCY) {
          const batch = items.slice(offset, offset + PERSIST_CONCURRENCY);
          const results = await Promise.all(batch.map(async (item) => {
            if (!item.numeroControlePNCP) return false;

            try {
              const dedupeKey = `pncp-${item.numeroControlePNCP.trim()}`;
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

              const publishedAt = item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : null;
              const openingAt = item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : null;
              const closingAt = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta) : null;

              await prisma.procurementNotice.upsert({
                where: { dedupeKey },
                create: {
                  source: 'pncp',
                  externalId: item.numeroControlePNCP,
                  dedupeKey,
                  contentHash,
                  noticeNumber,
                  processoAdministrativo: item.processo || null,
                  modality: item.modalidadeNome || modalidade.nome,
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
                update: {
                  noticeNumber,
                  processoAdministrativo: item.processo || null,
                  modality: item.modalidadeNome || modalidade.nome,
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
                },
              });
              return true;
            } catch (itemErr) {
              erros++;
              console.warn(`[PNCP Cron] Erro ao persistir edital ${item.numeroControlePNCP}:`, itemErr);
              return false;
            }
          }));
          upsertados += results.filter(Boolean).length;
        }

        // Condições de término da paginação
        const hasMorePages = resultado.totalRegistros !== null
          ? pagina < totalPaginas
          : items.length === PAGE_SIZE;
        if (!hasMorePages) {
          hasMore = false;
        } else {
          pagina++;
          // Intervalo de cortesia entre requisições de página para não sobrecarregar o firewall
          await sleep(throttleDelayMs);
        }
      } catch (pageErr: any) {
        erros++;
        console.error(`[PNCP Cron] Erro ao processar pág ${pagina} de ${modalidade.nome}:`, pageErr?.message || pageErr);
        // Interrompe a paginação desta modalidade em falha grave para não gerar loops
        hasMore = false;
        break;
      }
    }

    if (hasMore && pagina > maxPages) {
      erros++;
      console.warn(
        `[PNCP Cron] Limite de ${maxPages} páginas atingido para ${modalidade.nome}; há mais registros publicados no período.`,
      );
    }
  }

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
        await syncPncpLast24Hours();
      } catch (err: any) {
        console.error('[PNCP Cron] Erro não capturado no ciclo do cron:', err);
      }
    },
    {
      timezone: TIMEZONE,
    }
  );

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
  setupDataPlatformWorkers();
  setupCnaeAlertCron();
}
/**
 * Cron de Alerta Diário de Editais por CNAE
 * Agendado para rodar todo dia às 08:00 da manhã (horário de Brasília)
 * No cron diário, o Agente de IA valida a relevância real antes de montar o e-mail
 */
export function setupCnaeAlertCron() {
  cron.schedule('0 8 * * *', async () => {
    console.info('[Radar Cron] 🤖 Executando agente de inteligência para alertas de CNAE...');

    try {
      const empresas = await prisma.company.findMany({
        where: { cnaePrincipal: { not: null } },
        include: { user: { select: { email: true, nome: true } } },
      });

      const dataOntem = new Date();
      dataOntem.setDate(dataOntem.getDate() - 1);

      const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');

      for (const empresa of empresas) {
        const email = (empresa as any).email || empresa.user?.email;
        if (!email || !empresa.cnaePrincipal) continue;

        // 1. Busca editais recentes no banco de dados
        const editaisCandidatos = await prisma.procurementNotice.findMany({
          where: { createdAt: { gte: dataOntem } },
          take: 15,
          select: {
            id: true,
            noticeNumber: true,
            buyerName: true,
            object: true,
            estimatedValue: true,
          },
        });

        const editaisValidados = [];

        // 2. O Agente filtra e valida edital por edital sem alucinar
        for (const edital of editaisCandidatos) {
          if (!edital.object) continue;

          try {
            const analise = await analisarEditalParaCnae({
              objetoEdital: edital.object,
              cnaeCodigo: empresa.cnaePrincipal,
              cnaeDescricao: empresa.razaoSocial,
            });

            if (analise.aderente) {
              editaisValidados.push({
                titulo: `${edital.noticeNumber || 'Edital'} - ${analise.resumoExecutivo}`,
                orgao: edital.buyerName || 'Órgão Convocador',
                valorEstimado: edital.estimatedValue
                  ? `R$ ${Number(edital.estimatedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : undefined,
                link: `${appUrl}/licitacoes/${edital.id}`,
                resumoExecutivo: analise.resumoExecutivo,
                pontosDeAtencao: analise.pontosDeAtencao,
              });
            }
          } catch (agentErr) {
            console.warn(`[Radar Cron] Erro ao analisar edital ${edital.id}:`, agentErr);
          }

          if (editaisValidados.length >= 5) break; // Máximo 5 por e-mail para não sobrecarregar
        }

        // 3. Dispara o e-mail oficial apenas se houver oportunidades validadas
        if (editaisValidados.length > 0) {
          await enviarAlertaEditaisCnae({
            email,
            empresaNome: empresa.razaoSocial || 'Licitante',
            cnae: empresa.cnaePrincipal,
            editais: editaisValidados,
          });
          console.info(`[Radar Cron] 📧 ${editaisValidados.length} editais qualificados enviados para ${email}`);
        }
      }
    } catch (error) {
      console.error('[Radar Cron] ❌ Erro durante o disparo diário de editais:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });
}

export const iniciarRadarDiarioCron = setupCnaeAlertCron;
