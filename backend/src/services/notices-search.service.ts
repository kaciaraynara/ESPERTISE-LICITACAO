import { createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { RBAC_PERMISSIONS, RbacService } from './rbac.service';
import { buscarLicitacaoPorIdOuControle, extractPncpAuditParams } from './licitacoes.service';
import { buscarItensPNCP, buscarArquivosPNCP, parsePncpControlNumber } from './pncp.service';
import { preencherTextoEditalAutomaticamente } from './pncp-parser.service';
import { LexCalculadoraService } from './lex-calculadora.service';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_CHUNKS_LIMIT = 20;
const MAX_CHUNKS_LIMIT = 100;
const SEARCH_ENGINES = ['postgres', 'opensearch', 'vector'] as const;
const SORT_VALUES = [
  'published_desc',
  'published_asc',
  'opening_desc',
  'opening_asc',
  'value_desc',
  'value_asc',
  'created_desc',
  'created_asc',
] as const;
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|email|ip|useragent|user_agent|ua|session|refresh)/i;
const SUMMARY_CHUNKS_LIMIT = 8;
const SHORT_DEADLINE_DAYS = 3;
const KEYWORD_STOPWORDS = new Set([
  'para',
  'com',
  'sem',
  'por',
  'das',
  'dos',
  'uma',
  'uns',
  'nas',
  'nos',
  'que',
  'ser',
  'sera',
  'sao',
  'sua',
  'seu',
  'suas',
  'seus',
  'de',
  'da',
  'do',
  'em',
  'na',
  'no',
  'ao',
  'as',
  'os',
  'e',
  'a',
  'o',
  'contratacao',
  'aquisicao',
  'fornecimento',
  'servico',
  'servicos',
  'objeto',
  'edital',
  'publica',
  'publico',
  'municipio',
  'prefeitura',
  'governo',
]);

const REQUIREMENT_RULES = [
  {
    code: 'legal_qualification',
    label: 'Habilitacao juridica',
    patterns: [/habilitacao juridica/i, /contrato social/i, /ato constitutivo/i, /estatuto social/i, /registro comercial/i],
  },
  {
    code: 'fiscal_regularidade',
    label: 'Regularidade fiscal',
    patterns: [/regularidade fiscal/i, /certidao/i, /\bcnd\b/i, /\bfgts\b/i, /receita federal/i, /fazenda/i, /\binss\b/i],
  },
  {
    code: 'economic_financial',
    label: 'Qualificacao economico-financeira',
    patterns: [/economico-financeira/i, /balanco patrimonial/i, /indices contabeis/i, /patrimonio liquido/i, /capital social/i],
  },
  {
    code: 'technical_qualification',
    label: 'Qualificacao tecnica',
    patterns: [/qualificacao tecnica/i, /atestado de capacidade/i, /responsavel tecnico/i, /\bcrea\b/i, /\bcat\b/i, /\bcra\b/i],
  },
  {
    code: 'commercial_proposal',
    label: 'Proposta comercial',
    patterns: [/proposta comercial/i, /planilha de custos/i, /composicao de custos/i, /preco ofertado/i, /proposta de precos/i],
  },
  {
    code: 'mandatory_declarations',
    label: 'Declaracoes obrigatorias',
    patterns: [/declaracao/i, /declaracoes/i, /trabalho infantil/i, /idoneidade/i, /cumprimento dos requisitos/i, /\blgpd\b/i],
  },
] as const;

const CHECKLIST_ITEMS = [
  {
    code: 'legal_qualification',
    label: 'Habilitacao juridica',
    guidance: 'Separar contrato social, ato constitutivo ou documento equivalente.',
  },
  {
    code: 'fiscal_regularidade',
    label: 'Regularidade fiscal',
    guidance: 'Conferir certidoes fiscais, trabalhistas, previdenciarias e FGTS.',
  },
  {
    code: 'economic_financial',
    label: 'Qualificacao economico-financeira',
    guidance: 'Validar balanco, indices contabeis e eventuais comprovacoes financeiras.',
  },
  {
    code: 'technical_qualification',
    label: 'Qualificacao tecnica',
    guidance: 'Reunir atestados, registros profissionais e comprovacoes tecnicas aplicaveis.',
  },
  {
    code: 'commercial_proposal',
    label: 'Proposta comercial',
    guidance: 'Preparar proposta, planilha de custos e memoria de composicao de preco.',
  },
  {
    code: 'mandatory_declarations',
    label: 'Declaracoes obrigatorias',
    guidance: 'Mapear declaracoes padrao exigidas no edital antes do envio.',
  },
] as const;

const optionalString = (max = 160) => z.preprocess(normalizeQueryValue, z.string().max(max).optional());
const optionalNumber = z.preprocess(normalizeNumberValue, z.number().finite().optional());
const optionalInteger = z.preprocess(normalizeNumberValue, z.number().int().optional());
const optionalBoolean = z.preprocess(normalizeBooleanValue, z.boolean().optional());

export const noticeSearchQuerySchema = z.object({
  q: optionalString(200),
  source: optionalString(80),
  uf: optionalString(2),
  municipality: optionalString(120),
  agency: optionalString(160),
  modality: optionalString(120),
  status: optionalString(80),
  from: optionalString(80),
  to: optionalString(80),
  minValue: optionalNumber,
  maxValue: optionalNumber,
  limit: optionalInteger,
  offset: optionalInteger,
  sort: z.preprocess(normalizeQueryValue, z.enum(SORT_VALUES).optional()),
});

export const noticeDetailQuerySchema = z.object({
  includeRaw: optionalBoolean,
});

export const noticeChunksQuerySchema = z.object({
  limit: optionalInteger,
  offset: optionalInteger,
});

type NoticeSearchQuery = z.infer<typeof noticeSearchQuerySchema>;
type NoticeDetailQuery = z.infer<typeof noticeDetailQuerySchema>;
type NoticeChunksQuery = z.infer<typeof noticeChunksQuerySchema>;

export interface NoticesUserContext {
  tenantId?: string | null;
  user?: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    isAdmin?: boolean;
    permissions?: string[];
  } | null;
  requestId?: string | string[] | null;
  ip?: string | null;
  userAgent?: string | string[] | null;
}

export class NoticesSearchService {
  constructor(
    private readonly client: any = prisma as any,
    private readonly rbac = new RbacService(),
  ) {}

  async search(input: unknown = {}, context: NoticesUserContext = {}) {
    const parsed = noticeSearchQuerySchema.parse(input);
    const pagination = normalizePagination(parsed, DEFAULT_LIMIT, MAX_LIMIT);
    const where = buildNoticeWhere(parsed, context.tenantId);
    const orderBy = buildNoticeOrderBy(parsed.sort);

    const rows = await this.client.procurementNotice.findMany({
      where,
      orderBy,
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: noticeSelect(false),
    });

    const result = paginate(rows.map((row: any) => mapNotice(row, false)), pagination);

    await this.auditNoticeAction('NOTICE_SEARCH_EXECUTED', 'success', context, {
      engine: 'postgres',
      filters: sanitizeSearchFilters(parsed),
      resultCount: result.data.length,
      hasMore: result.pagination.hasMore,
    });

    return {
      ...result,
      search: {
        engine: 'postgres',
        mode: 'postgres_text',
        availableEngines: [...SEARCH_ENGINES],
      },
    };
  }

  private async ensureNoticeHydrated(
    idOrControl: string,
    tenantId?: string | null,
    includeRaw = false,
  ) {
    const cleanId = String(idOrControl || '').trim();
    const select = noticeSelect(includeRaw, true);

    let row: any = await this.client.procurementNotice.findFirst({
      where: {
        AND: [
          tenantVisibilityWhere(tenantId),
          resolveNoticeWhere(cleanId),
        ],
      },
      select,
    });

    if (!row) {
      try {
        const fetched = await buscarLicitacaoPorIdOuControle(cleanId, { requirePersistence: false });
        if (fetched?.databaseId) {
          row = await this.client.procurementNotice.findFirst({
            where: { id: fetched.databaseId },
            select,
          });
        }
      } catch (err: any) {
        // Ignora falha de busca no PNCP caso não encontrado
      }
    }

    if (row && (!row.items || row.items.length === 0)) {
      try {
        const parsed = parsePncpControlNumber(row.externalId || cleanId);
        if (parsed) {
          const pncpItems = await buscarItensPNCP(parsed.cnpj, parsed.ano, parsed.sequencial);
          if (Array.isArray(pncpItems) && pncpItems.length > 0) {
            let soma = 0;
            let hasVal = false;
            for (const it of pncpItems) {
              const itemNumber = String(it.numeroItem ?? 1);
              const desc = String(it.descricao ?? 'Item da contratação').trim();
              const qtd = Number(it.quantidade) > 0 ? Number(it.quantidade) : 1;
              const vUnit = Number(it.valorUnitarioEstimado) > 0 ? Number(it.valorUnitarioEstimado) : null;
              const vTot = Number(it.valorTotal) > 0 ? Number(it.valorTotal) : (vUnit ? vUnit * qtd : null);
              const unit = String(it.unidadeMedida ?? 'UN').trim();
              const catCod = it.codigoItemCatalogo ?? it.catalogoCodigo ?? null;

              if (vTot != null && vTot > 0) {
                soma += vTot;
                hasVal = true;
              }

              await this.client.procurementItem.upsert({
                where: {
                  procurementNoticeId_itemNumber: {
                    procurementNoticeId: row.id,
                    itemNumber,
                  },
                },
                create: {
                  procurementNoticeId: row.id,
                  tenantId: row.tenantId ?? null,
                  itemNumber,
                  description: desc,
                  quantity: qtd,
                  unit,
                  estimatedUnitValue: vUnit,
                  estimatedTotalValue: vTot,
                  catalogoCodigo: catCod,
                  metadata: it,
                },
                update: {
                  description: desc,
                  quantity: qtd,
                  unit,
                  estimatedUnitValue: vUnit,
                  estimatedTotalValue: vTot,
                  catalogoCodigo: catCod,
                  metadata: it,
                },
              });
            }

            if ((row.estimatedValue == null || Number(row.estimatedValue) <= 0) && hasVal && soma > 0) {
              const finalVal = Number(soma.toFixed(2));
              await this.client.procurementNotice.update({
                where: { id: row.id },
                data: { estimatedValue: finalVal },
              });
              row.estimatedValue = finalVal;
            }

            row.items = await this.client.procurementItem.findMany({
              where: { procurementNoticeId: row.id },
              take: 200,
              orderBy: { itemNumber: 'asc' },
            });
          }
        }
      } catch {
        // Falha não impeditiva
      }
    }

    return row;
  }

  async getNoticeById(id: string, input: unknown = {}, context: NoticesUserContext = {}) {
    const noticeId = requiredId(id);
    const parsed = noticeDetailQuerySchema.parse(input);
    const rawAllowed = parsed.includeRaw ? await this.canIncludeRaw(context) : false;

    if (parsed.includeRaw && !rawAllowed) {
      await this.auditNoticeAction('NOTICE_RAW_PAYLOAD_DENIED', 'failure', context, {
        requested: true,
        permission: RBAC_PERMISSIONS.DATA_PLATFORM_ADMIN,
      }, 'procurement_notice', noticeId);
    }

    const row = await this.ensureNoticeHydrated(
      noticeId,
      context.tenantId,
      Boolean(parsed.includeRaw && rawAllowed),
    );
    if (!row) return null;

    const result = mapNotice(row, Boolean(parsed.includeRaw && rawAllowed));

    let files: any[] = [];
    const parsedCtrl = parsePncpControlNumber(row.externalId || noticeId);
    if (parsedCtrl) {
      try {
        files = await buscarArquivosPNCP(parsedCtrl.cnpj, parsedCtrl.ano, parsedCtrl.sequencial);
      } catch {}
    }

    (result as any).dossier = buildComprehensiveDescriptiveDossier(row, row.items, [], files);

    await this.auditNoticeAction('NOTICE_VIEWED', 'success', context, {
      includeRawRequested: Boolean(parsed.includeRaw),
      rawPayloadIncluded: Boolean(parsed.includeRaw && rawAllowed),
      source: (result as any).source,
    }, 'procurement_notice', row.id);

    return result;
  }

  async listChunks(noticeId: string, input: unknown = {}, context: NoticesUserContext = {}) {
    const id = requiredId(noticeId);
    const parsed = noticeChunksQuerySchema.parse(input);
    const pagination = normalizePagination(parsed, DEFAULT_CHUNKS_LIMIT, MAX_CHUNKS_LIMIT);
    const notice = await this.ensureNoticeHydrated(id, context.tenantId);

    if (!notice) return null;

    let rows = await this.client.documentChunk.findMany({
      where: {
        AND: [
          tenantVisibilityWhere(context.tenantId),
          {
            sourceType: 'procurement_notice',
            sourceId: notice.id,
          },
        ],
      },
      orderBy: { chunkIndex: 'asc' },
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: {
        id: true,
        tenantId: true,
        sourceType: true,
        sourceId: true,
        chunkIndex: true,
        content: true,
        tokenCount: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (rows.length === 0 && pagination.offset === 0) {
      try {
        await preencherTextoEditalAutomaticamente(notice.id);
        rows = await this.client.documentChunk.findMany({
          where: {
            AND: [
              tenantVisibilityWhere(context.tenantId),
              {
                sourceType: 'procurement_notice',
                sourceId: notice.id,
              },
            ],
          },
          orderBy: { chunkIndex: 'asc' },
          skip: pagination.offset,
          take: pagination.limit + 1,
          select: {
            id: true,
            tenantId: true,
            sourceType: true,
            sourceId: true,
            chunkIndex: true,
            content: true,
            tokenCount: true,
            metadata: true,
            createdAt: true,
          },
        });
      } catch {}
    }

    const result = paginate(rows.map(mapChunk), pagination);

    await this.auditNoticeAction('NOTICE_CHUNKS_VIEWED', 'success', context, {
      source: notice.source,
      resultCount: result.data.length,
      hasMore: result.pagination.hasMore,
    }, 'procurement_notice', notice.id);

    return result;
  }

  async getNoticeBasicSummary(noticeId: string, context: NoticesUserContext = {}) {
    const id = requiredId(noticeId);

    try {
      const notice = await this.ensureNoticeHydrated(id, context.tenantId);

      if (!notice) {
        await this.auditNoticeAction('NOTICE_BASIC_SUMMARY_NOT_FOUND', 'failure', context, {
          reason: 'notice_not_found',
        }, 'procurement_notice', id);

        return null;
      }

      let files: any[] = [];
      const parsedCtrl = parsePncpControlNumber(notice.externalId || id);
      if (parsedCtrl) {
        try {
          files = await buscarArquivosPNCP(parsedCtrl.cnpj, parsedCtrl.ano, parsedCtrl.sequencial);
        } catch {}
      }

      const dossier = buildComprehensiveDescriptiveDossier(notice, notice.items, [], files);

      const summary = {
        id: notice.id,
        identification: {
          id: notice.id,
          externalId: notice.externalId ?? null,
          noticeNumber: notice.noticeNumber ?? null,
          url: notice.url ?? null,
        },
        source: notice.source,
        agency: notice.buyerName ?? null,
        buyerName: notice.buyerName ?? null,
        uf: notice.uf ?? null,
        municipality: notice.municipality ?? null,
        modality: notice.modality ?? null,
        modoDisputa: notice.modoDisputa ?? null,
        criterioJulgamento: notice.judgmentCriterion ?? null,
        status: notice.status ?? null,
        object: safeString(notice.object, 2000) ?? null,
        estimatedValue: decimalToNumber(notice.estimatedValue),
        importantDates: {
          publishedAt: toIso(notice.publishedAt),
          openingAt: toIso(notice.openingAt),
          closingAt: toIso(notice.closingAt),
        },
        items: Array.isArray(notice.items)
          ? notice.items.map((item: any) => ({
              id: item.id,
              numero: item.itemNumber,
              numeroItem: item.itemNumber,
              descricao: item.description,
              quantidade: decimalToNumber(item.quantity),
              unidade: item.unit ?? null,
              valorEstimadoUnitario: decimalToNumber(item.estimatedUnitValue),
              valorEstimadoTotal: decimalToNumber(item.estimatedTotalValue),
            }))
          : [],
        dossier,
        method: 'basic_projection_v1',
        generatedAt: new Date().toISOString(),
      };

      await this.auditNoticeAction('NOTICE_BASIC_SUMMARY_VIEWED', 'success', context, {
        source: notice.source,
        status: notice.status ?? null,
        hasEstimatedValue: notice.estimatedValue != null,
      }, 'procurement_notice', notice.id);

      return summary;
    } catch (error: any) {
      await this.auditNoticeAction('NOTICE_BASIC_SUMMARY_GENERATION_FAILED', 'failure', context, {
        reason: safeString(error?.message, 300) ?? 'basic_summary_generation_failed',
      }, 'procurement_notice', id);

      throw error;
    }
  }

  async getNoticeSummary(noticeId: string, context: NoticesUserContext = {}) {
    const id = requiredId(noticeId);

    try {
      const notice = await this.ensureNoticeHydrated(id, context.tenantId);

      if (!notice) {
        await this.auditNoticeAction('NOTICE_SUMMARY_NOT_FOUND', 'failure', context, {
          reason: 'notice_not_found',
        }, 'procurement_notice', id);
        return null;
      }

      let chunks = await this.client.documentChunk.findMany({
        where: {
          AND: [
            tenantVisibilityWhere(context.tenantId),
            {
              sourceType: 'procurement_notice',
              sourceId: notice.id,
            },
          ],
        },
        orderBy: { chunkIndex: 'asc' },
        take: SUMMARY_CHUNKS_LIMIT,
        select: {
          id: true,
          tenantId: true,
          sourceType: true,
          sourceId: true,
          chunkIndex: true,
          content: true,
          tokenCount: true,
          metadata: true,
          createdAt: true,
        },
      });

      if (chunks.length === 0) {
        try {
          await preencherTextoEditalAutomaticamente(notice.id);
          chunks = await this.client.documentChunk.findMany({
            where: {
              AND: [
                tenantVisibilityWhere(context.tenantId),
                {
                  sourceType: 'procurement_notice',
                  sourceId: notice.id,
                },
              ],
            },
            orderBy: { chunkIndex: 'asc' },
            take: SUMMARY_CHUNKS_LIMIT,
            select: {
              id: true,
              tenantId: true,
              sourceType: true,
              sourceId: true,
              chunkIndex: true,
              content: true,
              tokenCount: true,
              metadata: true,
              createdAt: true,
            },
          });
        } catch {}
      }

      let files: any[] = [];
      const parsedCtrl = parsePncpControlNumber(notice.externalId || id);
      if (parsedCtrl) {
        try {
          files = await buscarArquivosPNCP(parsedCtrl.cnpj, parsedCtrl.ano, parsedCtrl.sequencial);
        } catch {}
      }

      const summary = buildDeterministicSummary(notice, chunks);
      const dossier = buildComprehensiveDescriptiveDossier(notice, notice.items, chunks, files);

      const result = {
        ...summary,
        dossier,
      };

      await this.auditNoticeAction('NOTICE_SUMMARY_VIEWED', 'success', context, {
        source: notice.source,
        completenessScore: summary.completeness.score,
        chunksUsed: summary.chunksUsed.count,
        alerts: summary.alerts.map((alert) => alert.code),
      }, 'procurement_notice', notice.id);

      return result;
    } catch (error: any) {
      await this.auditNoticeAction('NOTICE_SUMMARY_GENERATION_FAILED', 'failure', context, {
        reason: safeString(error?.message, 300) ?? 'summary_generation_failed',
      }, 'procurement_notice', id);
      throw error;
    }
  }

  private async canIncludeRaw(context: NoticesUserContext) {
    if (context.user?.isAdmin) return true;
    if (context.user?.permissions?.includes(RBAC_PERMISSIONS.DATA_PLATFORM_ADMIN)) return true;

    const userId = safeString(context.user?.id, 80);
    if (!userId) return false;

    try {
      return await this.rbac.hasPermission(userId, RBAC_PERMISSIONS.DATA_PLATFORM_ADMIN, context.tenantId ?? null);
    } catch {
      return false;
    }
  }

  private async auditNoticeAction(
    action: string,
    outcome: string,
    context: NoticesUserContext,
    metadata: Record<string, unknown>,
    entityType?: string | null,
    entityId?: string | null,
  ) {
    await this.client.auditEvent.create({
      data: {
        userId: normalizeNullableString(context.user?.id, 80),
        scope: 'notices',
        action,
        outcome,
        entityType: entityType ?? null,
        entityId: normalizeNullableString(entityId, 120),
        requestId: normalizeHeader(context.requestId),
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: normalizeHeader(context.userAgent) ? hashAuditValue(normalizeHeader(context.userAgent) as string) : null,
        emailHash: context.user?.email ? hashAuditValue(context.user.email) : null,
        metadata: sanitizeMetadataObject({
          actorRole: context.user?.role ?? null,
          tenantId: normalizeNullableString(context.tenantId, 120),
          ...metadata,
        }) as any,
      }
    });
  }
}

function buildNoticeWhere(input: NoticeSearchQuery, tenantId?: string | null) {
  const and: any[] = [tenantVisibilityWhere(tenantId)];
  const q = safeString(input.q, 200);

  if (q) {
    and.push({
      OR: [
        { object: { contains: q, mode: 'insensitive' } },
        { noticeNumber: { contains: q, mode: 'insensitive' } },
        { buyerName: { contains: q, mode: 'insensitive' } },
        { buyerDocument: { contains: q, mode: 'insensitive' } },
        { externalId: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  const source = safeString(input.source, 80);
  const uf = safeString(input.uf, 2)?.toUpperCase();
  const municipality = safeString(input.municipality, 120);
  const agency = safeString(input.agency, 160);
  const modality = safeString(input.modality, 120);
  const status = safeString(input.status, 80);
  const publishedAt = compact({
    gte: dateValue(input.from),
    lte: dateValue(input.to),
  });
  const estimatedValue = compact({
    gte: numberValue(input.minValue),
    lte: numberValue(input.maxValue),
  });

  if (source) and.push({ source });
  if (uf) and.push({ uf });
  if (municipality) and.push({ municipality: { contains: municipality, mode: 'insensitive' } });
  if (agency) and.push({ buyerName: { contains: agency, mode: 'insensitive' } });
  if (modality) and.push({ modality: { contains: modality, mode: 'insensitive' } });
  if (status) and.push({ status });
  if (Object.keys(publishedAt).length) and.push({ publishedAt });
  if (Object.keys(estimatedValue).length) and.push({ estimatedValue });

  return { AND: and };
}

function buildNoticeOrderBy(sort: NoticeSearchQuery['sort']) {
  switch (sort ?? 'published_desc') {
    case 'published_asc':
      return [{ publishedAt: 'asc' }, { createdAt: 'desc' }];
    case 'opening_desc':
      return [{ openingAt: 'desc' }, { publishedAt: 'desc' }];
    case 'opening_asc':
      return [{ openingAt: 'asc' }, { publishedAt: 'desc' }];
    case 'value_desc':
      return [{ estimatedValue: 'desc' }, { publishedAt: 'desc' }];
    case 'value_asc':
      return [{ estimatedValue: 'asc' }, { publishedAt: 'desc' }];
    case 'created_asc':
      return [{ createdAt: 'asc' }];
    case 'created_desc':
      return [{ createdAt: 'desc' }];
    case 'published_desc':
    default:
      return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }
}

function noticeSelect(includeRawPayload: boolean, includeItems = false) {
  const select: any = {
    id: true,
    tenantId: true,
    source: true,
    externalId: true,
    noticeNumber: true,
    modality: true,
    judgmentCriterion: true,
    modoDisputa: true,
    buyerName: true,
    buyerDocument: true,
    object: true,
    uf: true,
    municipality: true,
    estimatedValue: true,
    status: true,
    url: true,
    publishedAt: true,
    openingAt: true,
    closingAt: true,
    classification: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
  };

  if (includeItems) {
    select.requirements = {
      take: 100,
      select: {
        id: true,
        requirementType: true,
        title: true,
        description: true,
        mandatory: true,
        detectedFrom: true,
      },
    };
    select.items = {
      take: 100,
      orderBy: { itemNumber: 'asc' },
      select: {
        id: true,
        itemNumber: true,
        description: true,
        quantity: true,
        unit: true,
        estimatedUnitValue: true,
        estimatedTotalValue: true,
      },
    };
  }

  if (includeRawPayload) select.rawPayload = true;
  return select;
}

function summaryNoticeSelect() {
  return {
    ...noticeSelect(false),
    rawPayload: true,
  };
}

function mapNotice(row: any, includeRawPayload: boolean) {
  const mapped: Record<string, unknown> = {
    id: row.id,
    tenantId: row.tenantId ?? null,
    source: row.source,
    externalId: row.externalId ?? null,
    noticeNumber: row.noticeNumber ?? null,
    modality: row.modality ?? null,
    judgmentCriterion: row.judgmentCriterion ?? null,
    criterioJulgamento: row.judgmentCriterion ?? null,
    modoDisputa: row.modoDisputa ?? null,
    agency: row.buyerName ?? null,
    buyerName: row.buyerName ?? null,
    buyerDocument: row.buyerDocument ?? null,
    object: row.object,
    uf: row.uf ?? null,
    municipality: row.municipality ?? null,
    estimatedValue: decimalToNumber(row.estimatedValue),
    status: row.status ?? null,
    url: row.url ?? null,
    publishedAt: toIso(row.publishedAt),
    openingAt: toIso(row.openingAt),
    closingAt: toIso(row.closingAt),
    classification: sanitizeMetadata(row.classification),
    metadata: sanitizeMetadata(row.metadata),
    rawPayloadIncluded: false,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    requirements: Array.isArray(row.requirements)
      ? row.requirements.map((req: any) => ({
          id: req.id,
          tipo: req.requirementType,
          titulo: req.title,
          descricao: req.description,
          obrigatorio: req.mandatory,
          detectadoDe: req.detectedFrom,
        }))
      : [],
    items: Array.isArray(row.items)
      ? row.items.map((item: any) => ({
          id: item.id,
          numero: item.itemNumber,
          descricao: item.description,
          quantidade: decimalToNumber(item.quantity),
          unidade: item.unit ?? null,
          valorEstimadoUnitario: decimalToNumber(item.estimatedUnitValue),
          valorEstimadoTotal: decimalToNumber(item.estimatedTotalValue),
        }))
      : [],
  };

  if (includeRawPayload && Object.prototype.hasOwnProperty.call(row, 'rawPayload')) {
    mapped.rawPayload = sanitizeMetadata(row.rawPayload);
    mapped.rawPayloadIncluded = true;
  }

  return mapped;
}

function mapChunk(row: any) {
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    chunkIndex: row.chunkIndex,
    content: typeof row.content === 'string' ? row.content.slice(0, 15000) : '',
    tokenCount: row.tokenCount ?? null,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: toIso(row.createdAt),
  };
}

function buildDeterministicSummary(notice: any, chunks: any[]) {
  const combinedText = buildCombinedSummaryText(notice, chunks);
  const documentsFound = detectRequirements(combinedText);
  const checklist = buildChecklist(documentsFound);
  const alerts = buildOperationalAlerts(notice, chunks, documentsFound);
  const completeness = calculateCompleteness(notice, chunks);

  return {
    id: notice.id,
    identification: {
      id: notice.id,
      externalId: notice.externalId ?? null,
      noticeNumber: notice.noticeNumber ?? null,
      url: notice.url ?? null,
    },
    source: notice.source,
    agency: notice.buyerName ?? null,
    buyerName: notice.buyerName ?? null,
    uf: notice.uf ?? null,
    municipality: notice.municipality ?? null,
    modality: notice.modality ?? null,
    status: notice.status ?? null,
    object: safeString(notice.object, 2000) ?? null,
    estimatedValue: decimalToNumber(notice.estimatedValue),
    importantDates: {
      publishedAt: toIso(notice.publishedAt),
      openingAt: toIso(notice.openingAt),
      closingAt: toIso(notice.closingAt),
    },
    keywords: extractKeywords(combinedText),
    requirements: {
      documentsFound,
      totalDetected: documentsFound.length,
    },
    alerts,
    checklist,
    chunksUsed: {
      count: chunks.length,
      items: chunks.map(mapSummaryChunk),
    },
    completeness,
    method: 'deterministic_rules_v1',
    generatedAt: new Date().toISOString(),
  };
}

function buildCombinedSummaryText(notice: any, chunks: any[]) {
  return [
    notice.noticeNumber,
    notice.source,
    notice.buyerName,
    notice.object,
    notice.uf,
    notice.municipality,
    notice.modality,
    notice.status,
    ...chunks.map((chunk) => chunk.content),
    ...extractRawPayloadText(notice.rawPayload),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .slice(0, 50000);
}

function extractRawPayloadText(value: unknown, depth = 0): string[] {
  if (value === null || value === undefined || depth > 3) return [];
  if (Array.isArray(value)) return value.slice(0, 30).flatMap((item) => extractRawPayloadText(item, depth + 1));
  if (typeof value === 'string') return [value.slice(0, 1000)];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>)
    .filter(([key, entryValue]) => !SENSITIVE_KEY_PATTERN.test(key) && entryValue !== undefined)
    .slice(0, 50)
    .flatMap(([, entryValue]) => extractRawPayloadText(entryValue, depth + 1));
}

function detectRequirements(text: string) {
  const requirements: Array<{ code: string; label: string; evidence: string }> = [];

  for (const rule of REQUIREMENT_RULES) {
    const matchedPattern = rule.patterns.find((pattern) => pattern.test(text));
    if (!matchedPattern) continue;

    requirements.push({
      code: rule.code,
      label: rule.label,
      evidence: normalizeRequirementEvidence(matchedPattern.source),
    });
  }

  return requirements;
}

function normalizeRequirementEvidence(patternSource: string) {
  return patternSource
    .replace(/\\/g, '')
    .replace(/\^|\$/g, '')
    .replace(/\bb\b/g, '')
    .replace(/\(\?:/g, '(')
    .slice(0, 120);
}

function buildChecklist(documentsFound: Array<{ code: string; label: string }>) {
  const foundCodes = new Set(documentsFound.map((item) => item.code));
  return CHECKLIST_ITEMS.map((item) => ({
    code: item.code,
    label: item.label,
    status: foundCodes.has(item.code) ? 'found' : 'pending',
    guidance: item.guidance,
  }));
}

function buildOperationalAlerts(notice: any, chunks: any[], documentsFound: Array<{ code: string }>) {
  const alerts: Array<Record<string, unknown>> = [];
  const deadline = nearestDeadline(notice);

  if (deadline && deadline.daysRemaining >= 0 && deadline.daysRemaining <= SHORT_DEADLINE_DAYS) {
    alerts.push({
      code: 'short_deadline',
      level: 'attention',
      message: 'Prazo operacional curto para preparar documentos e proposta.',
      daysRemaining: deadline.daysRemaining,
      date: deadline.date,
    });
  }

  if (decimalToNumber(notice.estimatedValue) === null) {
    alerts.push({
      code: 'missing_estimated_value',
      level: 'attention',
      message: 'Valor estimado nao informado nos dados estruturados.',
    });
  }

  if (!safeString(notice.object, 2000)) {
    alerts.push({
      code: 'missing_object',
      level: 'attention',
      message: 'Objeto do edital ausente ou vazio nos dados estruturados.',
    });
  }

  if (!chunks.length) {
    alerts.push({
      code: 'no_chunks',
      level: 'attention',
      message: 'Edital ainda nao possui chunks documentais para leitura detalhada.',
    });
  }

  if (documentsFound.length < 2) {
    alerts.push({
      code: 'insufficient_documentation',
      level: 'info',
      message: 'Poucos requisitos documentais foram identificados por regras simples.',
    });
  }

  if (!safeString(notice.modality, 120)) {
    alerts.push({
      code: 'missing_modality',
      level: 'attention',
      message: 'Modalidade ausente nos dados estruturados.',
    });
  }

  return alerts;
}

function nearestDeadline(notice: any) {
  const candidates = [notice.closingAt, notice.openingAt]
    .map((value) => {
      const iso = toIso(value);
      if (!iso) return null;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    })
    .filter(Boolean) as Date[];

  if (!candidates.length) return null;

  const now = Date.now();
  const closest = candidates.sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    date: closest.toISOString(),
    daysRemaining: Math.ceil((closest.getTime() - now) / 86400000),
  };
}

function calculateCompleteness(notice: any, chunks: any[]) {
  const fields = [
    { key: 'source', label: 'Fonte', weight: 8, present: Boolean(safeString(notice.source, 80)) },
    { key: 'agency', label: 'Orgao', weight: 12, present: Boolean(safeString(notice.buyerName, 160)) },
    { key: 'uf', label: 'UF', weight: 7, present: Boolean(safeString(notice.uf, 2)) },
    { key: 'municipality', label: 'Municipio', weight: 7, present: Boolean(safeString(notice.municipality, 120)) },
    { key: 'modality', label: 'Modalidade', weight: 10, present: Boolean(safeString(notice.modality, 120)) },
    { key: 'status', label: 'Status', weight: 6, present: Boolean(safeString(notice.status, 80)) },
    { key: 'object', label: 'Objeto', weight: 16, present: Boolean(safeString(notice.object, 2000)) },
    { key: 'estimatedValue', label: 'Valor estimado', weight: 10, present: decimalToNumber(notice.estimatedValue) !== null },
    { key: 'publishedAt', label: 'Data de publicacao', weight: 6, present: Boolean(toIso(notice.publishedAt)) },
    { key: 'deadline', label: 'Data de abertura ou encerramento', weight: 8, present: Boolean(toIso(notice.openingAt) || toIso(notice.closingAt)) },
    { key: 'chunks', label: 'Chunks documentais', weight: 10, present: chunks.length > 0 },
  ];
  const score = fields.reduce((total, field) => total + (field.present ? field.weight : 0), 0);
  const missingFields = fields
    .filter((field) => !field.present)
    .map((field) => ({
      key: field.key,
      label: field.label,
      impact: field.weight,
      reason: `${field.label} ausente ou vazio.`,
    }));
  const presentFields = fields
    .filter((field) => field.present)
    .map((field) => ({ key: field.key, label: field.label, weight: field.weight }));

  return {
    score,
    level: score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low',
    missingFields,
    presentFields,
  };
}

function extractKeywords(text: string) {
  const counts = new Map<string, number>();
  const tokens = normalizeText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !KEYWORD_STOPWORDS.has(token))
    .slice(0, 2000);

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([keyword, count]) => ({ keyword, count }));
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function mapSummaryChunk(row: any) {
  return {
    id: row.id,
    chunkIndex: row.chunkIndex,
    tokenCount: row.tokenCount ?? null,
    excerpt: typeof row.content === 'string' ? row.content.slice(0, 700) : '',
    metadata: sanitizeMetadata(row.metadata),
    createdAt: toIso(row.createdAt),
  };
}

function tenantVisibilityWhere(tenantId?: string | null) {
  const normalizedTenantId = normalizeNullableString(tenantId, 120);
  if (!normalizedTenantId) return { tenantId: null };
  return { OR: [{ tenantId: null }, { tenantId: normalizedTenantId }] };
}

function normalizePagination(input: { limit?: number; offset?: number }, defaultLimit: number, maxLimit: number) {
  const limit = Math.max(1, Math.min(numberValue(input.limit) ?? defaultLimit, maxLimit));
  const offset = Math.max(0, numberValue(input.offset) ?? 0);
  return { limit, offset };
}

function paginate<T>(rows: T[], pagination: { limit: number; offset: number }) {
  const hasMore = rows.length > pagination.limit;
  return {
    data: rows.slice(0, pagination.limit),
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      nextOffset: hasMore ? pagination.offset + pagination.limit : null,
      hasMore,
    },
  };
}

function sanitizeSearchFilters(input: NoticeSearchQuery) {
  return sanitizeMetadataObject({
    q: input.q,
    source: input.source,
    uf: input.uf,
    municipality: input.municipality,
    agency: input.agency,
    modality: input.modality,
    status: input.status,
    from: input.from,
    to: input.to,
    minValue: input.minValue,
    maxValue: input.maxValue,
    limit: input.limit,
    offset: input.offset,
    sort: input.sort,
  });
}

function requiredId(value: unknown) {
  const normalized = safeString(value, 120);
  if (!normalized) throw new Error('id do edital e obrigatorio.');
  return normalized;
}

function normalizeQueryValue(value: unknown) {
  if (Array.isArray(value)) return normalizeQueryValue(value[0]);
  if (typeof value !== 'string') return value === null ? undefined : value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNumberValue(value: unknown) {
  const normalized = normalizeQueryValue(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized === 'number') return normalized;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : normalized;
}

function normalizeBooleanValue(value: unknown) {
  const normalized = normalizeQueryValue(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized === 'boolean') return normalized;
  if (typeof normalized !== 'string') return normalized;
  if (normalized.toLowerCase() === 'true') return true;
  if (normalized.toLowerCase() === 'false') return false;
  return normalized;
}

function safeString(value: unknown, max = 120) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function normalizeNullableString(value: unknown, max = 120) {
  return safeString(value, max) ?? null;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.slice(0, 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value).slice(0, 1000);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .slice(0, 80)
      .map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeMetadata(entryValue, depth + 1),
      ]),
  );
}

function sanitizeMetadataObject(value: Record<string, unknown>) {
  const sanitized = sanitizeMetadata(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {};
  return sanitized as Record<string, unknown>;
}

function normalizeHeader(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function hashAuditValue(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function resolveNoticeWhere(idOrControl: string) {
  const clean = String(idOrControl || '').trim();
  const isPncpControl = /^\d{14}/.test(clean) || clean.startsWith('pncp-');
  if (!isPncpControl) {
    return { id: clean };
  }
  return {
    OR: [
      { id: clean },
      { externalId: clean },
      { dedupeKey: clean.startsWith('pncp-') ? clean : `pncp-${clean}` },
      { dedupeKey: clean },
      { noticeNumber: clean },
    ],
  };
}

export function buildComprehensiveDescriptiveDossier(
  notice: any,
  items: any[] = [],
  chunks: any[] = [],
  files: any[] = [],
) {
  const cnpjRaw = notice.buyerDocument || '';
  const cleanCnpj = cnpjRaw.replace(/\D/g, '');
  const cnpjFormatado = cleanCnpj.length === 14
    ? cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : (notice.buyerDocument || 'Não informado');

  const auditParams = extractPncpAuditParams(
    notice.externalId || notice.noticeNumber || notice.id,
    notice.buyerDocument,
    null,
    null,
  );

  const urlPncpOficial = auditParams?.urlOficialPncp || notice.url || 'https://pncp.gov.br/app/editais';

  // 1. Ficha Técnica
  const fichaTecnica = {
    razaoSocial: notice.buyerName || 'Órgão Licitante Não Informado',
    cnpjFormatado,
    cnpj: cleanCnpj || notice.buyerDocument || null,
    unidadeCompradora: notice.rawPayload?.unidadeOrgao?.nomeUnidade || notice.buyerName || 'Unidade Compradora',
    municipioUf: [notice.municipality, notice.uf].filter(Boolean).join(' - ') || 'Âmbito Nacional',
    municipio: notice.municipality || null,
    uf: notice.uf || null,
    numeroEdital: notice.noticeNumber || notice.externalId || notice.id,
    numeroControlePNCP: notice.externalId || null,
    processo: notice.noticeNumber || null,
    modalidade: notice.modality || 'Pregão Eletrônico',
    modoDisputa: notice.modoDisputa || notice.rawPayload?.modoDisputaNome || 'Aberto / Fechado',
    criterioJulgamento: notice.judgmentCriterion || notice.rawPayload?.criterioJulgamentoNome || 'Menor Preço / Maior Desconto',
    amparoLegal: notice.rawPayload?.amparoLegal?.nome || 'Lei nº 14.133/2021 (Nova Lei de Licitações)',
    regimeExecucaoOuSrp: (notice.srp || notice.rawPayload?.srp)
      ? 'Sistema de Registro de Preços (SRP)'
      : 'Contratação Direta / Fornecimento Contínuo',
    valorGlobalEstimado: decimalToNumber(notice.estimatedValue),
    valorGlobalFormatado: decimalToNumber(notice.estimatedValue) !== null && Number(notice.estimatedValue) > 0
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(notice.estimatedValue))
      : 'Sigiloso / Ver Itens no TR',
    linkOficialPncp: urlPncpOficial,
  };

  // 2. Descrição Explicativa do Objeto
  const descricaoExplicativaObjeto = {
    objetoIntegral: notice.object ? String(notice.object).trim() : 'Objeto não informado no edital.',
    informacaoComplementar: notice.rawPayload?.informacaoComplementar || notice.metadata?.informacaoComplementar || null,
    finalidadeContratacao: `Atendimento às necessidades operacionais e institucionais de ${notice.buyerName || 'Órgão Licitante'}, conforme especificações constantes do Termo de Referência.`,
    localExecucao: [notice.municipality, notice.uf].filter(Boolean).join(' - ') || 'Conforme estipulado no Termo de Referência e Edital.',
    resumoExecutivo: notice.object
      ? String(notice.object).slice(0, 500)
      : 'Consulte os anexos e o Termo de Referência oficial para especificações técnicas.',
  };

  // 3. Cronograma e Prazos Fatais
  const dataPubIso = toIso(notice.publishedAt);
  const dataAberturaIso = toIso(notice.openingAt);
  const dataEncerramentoIso = toIso(notice.closingAt);

  let calculoImpugnacao: any = null;
  if (dataAberturaIso) {
    try {
      calculoImpugnacao = LexCalculadoraService.calcularPrazoImpugnacao(dataAberturaIso);
    } catch {
      // ignore
    }
  }

  const cronogramaPrazosFatais = {
    publicacao: dataPubIso,
    inicioPropostas: dataAberturaIso,
    aberturaSessaoPublica: dataAberturaIso,
    encerramentoPropostas: dataEncerramentoIso,
    prazoLimiteImpugnacao: calculoImpugnacao?.resultado?.dataLimite || null,
    prazoLimiteEsclarecimento: calculoImpugnacao?.resultado?.dataLimite || null,
    fundamentacaoImpugnacao: 'Art. 164 da Lei 14.133/2021 (até 3 dias úteis anteriores à data de abertura do certame)',
    diasUteisRestantesImpugnacao: calculoImpugnacao?.resultado?.diasUteisRestantes ?? null,
    impugnacaoExpirada: calculoImpugnacao?.resultado?.expirado ?? false,
    diasCorridosAteAbertura: calculoImpugnacao?.resultado?.diasCorridosAteAbertura ?? null,
  };

  // 4. Quadro de Itens Detalhado
  const rawItemsList = Array.isArray(items) && items.length > 0 ? items : (notice.items || []);
  let somaCalculada = 0;
  let hasValidVal = false;
  const quadroItensDetalhado = rawItemsList.map((item: any, idx: number) => {
    const num = item.itemNumber ?? item.numeroItem ?? item.numero ?? idx + 1;
    const desc = item.description ?? item.descricao ?? 'Item da contratação';
    const qtd = Number(item.quantity ?? item.quantidade ?? 1);
    const vUnit = decimalToNumber(item.estimatedUnitValue ?? item.valorUnitarioEstimado ?? item.valorReferencia);
    const vTot = decimalToNumber(item.estimatedTotalValue ?? item.valorTotalEstimado ?? item.valorTotal) ?? (vUnit != null ? vUnit * qtd : null);
    if (vTot != null && vTot > 0) {
      somaCalculada += vTot;
      hasValidVal = true;
    }
    return {
      numeroItem: num,
      descricaoCompleta: desc,
      quantidade: qtd,
      unidadeMedida: item.unit ?? item.unidadeMedida ?? item.unidade ?? 'UN',
      valorUnitarioEstimado: vUnit,
      valorTotalEstimado: vTot,
      participacao: item.participacao ?? item.tipoParticipacao ?? 'Ampla Concorrência',
      codigoCatalogo: item.catalogoCodigo ?? item.codigoItemCatalogo ?? null,
    };
  });

  const totalizadoresItens = {
    totalItens: quadroItensDetalhado.length,
    valorTotalCalculado: hasValidVal ? Number(somaCalculada.toFixed(2)) : null,
    possuiItensSigilosos: quadroItensDetalhado.some((it: any) => it.valorUnitarioEstimado === null || it.valorUnitarioEstimado <= 0),
  };

  // 5. Requisitos de Habilitação Detalhados (Arts. 62 a 70 da Lei 14.133/2021)
  const requisitosHabilitacaoDetalhados = {
    habilitacaoJuridica: {
      artigoLei: 'Art. 66 da Lei nº 14.133/2021',
      descricao: 'Comprovação da existência jurídica e capacidade de representação legal.',
      documentosExigidos: [
        'Registro comercial, no caso de empresa individual;',
        'Ato constitutivo, estatuto ou contrato social em vigor, devidamente registrado;',
        'Documento de eleição ou posse dos administradores;',
        'Procuração pública ou particular conferindo poderes ao representante legal para atuar no certame.',
      ],
    },
    regularidadeFiscalTrabalhista: {
      artigoLei: 'Art. 68 da Lei nº 14.133/2021',
      descricao: 'Comprovação de regularidade fiscal, social e trabalhista perante os órgãos fazendários.',
      documentosExigidos: [
        'Certidão Negativa de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União (CND Federal / PGFN);',
        'Certificado de Regularidade do FGTS (CRF Caixa Econômica Federal);',
        'Certidão Negativa de Débitos Trabalhistas (CNDT - Justiça do Trabalho);',
        'Certidão de Regularidade Fiscal perante a Fazenda Estadual;',
        'Certidão de Regularidade Fiscal perante a Fazenda Municipal da sede da empresa.',
      ],
    },
    qualificacaoEconomicoFinanceira: {
      artigoLei: 'Art. 69 da Lei nº 14.133/2021',
      descricao: 'Demonstração da capacidade financeira para a execução integral do objeto contratado.',
      documentosExigidos: [
        'Balanço patrimonial e demonstrações contábeis do último exercício social;',
        'Comprovação de boa situação financeira com índices de liquidez (LG, SG, LC >= 1,0);',
        'Certidão Negativa de Falência, Concordata, Recuperação Judicial e Extrajudicial;',
        'Patrimônio Líquido ou Capital Social mínimo integralizado (limitado ao máximo de 10% do valor estimado da contratação).',
      ],
    },
    qualificacaoTecnica: {
      artigoLei: 'Art. 67 da Lei nº 14.133/2021',
      descricao: 'Comprovação de aptidão e capacidade operacional para execução do objeto em prazo e qualidade.',
      documentosExigidos: [
        'Atestado(s) de Capacidade Técnica (CAT) emitido(s) por pessoa jurídica de direito público ou privado comprovando fornecimento ou prestação de serviços similares;',
        'Certidão de Registro ou Inscrição no Conselho Profissional competente (CREA, CRA, CRM, etc.), quando aplicável;',
        'Indicação das instalações, aparelhamento e pessoal técnico especializado adequados e disponíveis.',
      ],
    },
    declaracoesObrigatorias: [
      'Declaração de cumprimento do inciso XXXIII do art. 7º da CF (não emprego de menor de idade em trabalho noturno, perigoso ou insalubre);',
      'Declaração de inexistência de fatos supervenientes impeditivos da habilitação (Art. 63, IV, Lei 14.133/2021);',
      'Declaração de enquadramento como Microempresa (ME) ou Empresa de Pequeno Porte (EPP), se aplicável para obtenção dos benefícios da LC 123/2006;',
      'Declaração de elaboração independente de proposta e conduta ética;',
      'Declaração de atendimento aos requisitos de acessibilidade e sustentabilidade ambiental, quando exigidos no edital.',
    ],
  };

  // 6. Roteiro Passo a Passo do Licitante (7 Etapas Obrigatórias)
  const noticeTargetId = notice.id || notice.externalId || '';
  const roteiroPassoAPassoLicitante = [
    {
      etapa: 1,
      titulo: 'Etapa 1 - Leitura Crítica e Diagnóstico de Riscos',
      descricao: 'Examine detalhadamente as regras do edital, termo de referência e exigências editalícias para detectar pontos críticos e cláusulas restritivas.',
      acaoRecomendada: 'Auditar cláusulas e conformidade no Leitor de Editais.',
      rotaAcao: `/leitor-editais?edital=${noticeTargetId}`,
      icone: 'FileText',
    },
    {
      etapa: 2,
      titulo: 'Etapa 2 - Conferência Documental no Cofre',
      descricao: 'Verifique se todas as 5 certidões obrigatórias (CND Federal, FGTS, CNDT, Estadual, Municipal) e o Balanço Patrimonial estão válidos no cofre documental.',
      acaoRecomendada: 'Acessar o Cofre de Documentos e Certidões.',
      rotaAcao: '/cofre',
      icone: 'FolderCheck',
    },
    {
      etapa: 3,
      titulo: 'Etapa 3 - Formulação de Impugnação ou Pedido de Esclarecimento',
      descricao: 'Caso identifique cláusulas abusivas, restrições à competitividade ou dúvidas técnicas, protocole pedido de esclarecimento ou impugnação até 3 dias úteis antes da abertura.',
      acaoRecomendada: 'Gerar Minuta de Impugnação / Esclarecimento.',
      rotaAcao: `/impugnacao?edital=${noticeTargetId}`,
      icone: 'Scale',
    },
    {
      etapa: 4,
      titulo: 'Etapa 4 - Formação de Custos e Precificação Estratégica',
      descricao: 'Cruze os itens do edital com o catálogo da empresa, projete custos de aquisição, frete, impostos (Simples/Lucro Presumido), margem líquida e defina o Preço Stop-Loss (preço mínimo viável).',
      acaoRecomendada: 'Simular Custos e Precificação Stop-Loss.',
      rotaAcao: `/precificacao?edital=${noticeTargetId}`,
      icone: 'Calculator',
    },
    {
      etapa: 5,
      titulo: 'Etapa 5 - Geração e Validação da Proposta Comercial',
      descricao: 'Gere a proposta formal em PDF contendo marca, modelo, prazo de validade (mínimo de 60 dias), declarações obrigatórias e valores unitários e totais.',
      acaoRecomendada: 'Gerar Proposta Comercial Oficial.',
      rotaAcao: `/propostas/criar?edital=${noticeTargetId}`,
      icone: 'FileCheck',
    },
    {
      etapa: 6,
      titulo: 'Etapa 6 - Cadastro da Proposta no Portal Oficial de Disputa',
      descricao: 'Faça o upload da proposta e documentos de habilitação no sistema eletrônico do certame (Compras.gov.br, Comprasnet, BBMnet, Licitações-e ou portal próprio) antes do horário de corte.',
      acaoRecomendada: 'Acessar o Portal Oficial do Certame.',
      rotaAcao: urlPncpOficial,
      externo: true,
      icone: 'Send',
    },
    {
      etapa: 7,
      titulo: 'Etapa 7 - Sessão Pública de Lances e Fase Recursal',
      descricao: 'Acompanhe a sessão de lances no modo aberto ou fechado, monitore os concorrentes respeitando a margem stop-loss e esteja preparado para interpor intenção de recurso fundamentada.',
      acaoRecomendada: 'Entrar na Sala de Disputa / Monitor de Lances.',
      rotaAcao: `/disputa?edital=${noticeTargetId}`,
      icone: 'Gavel',
    },
  ];

  // 7. Arquivos Oficiais do PNCP
  const arquivosOficiaisPncp = Array.isArray(files) && files.length > 0
    ? files.map((f: any) => ({
        titulo: f.titulo || f.documentoNome || f.nomeArquivo || 'Documento Oficial do Certame',
        tipoDocumentoNome: f.tipoDocumentoNome || f.tipoDocumento || 'Anexo',
        urlDownload: f.url || f.link || f.uri || '',
        sequencialDocumento: f.sequencialDocumento ?? undefined,
      }))
    : [
        {
          titulo: 'Página e Documentos Oficiais no Portal do PNCP',
          tipoDocumentoNome: 'Portal PNCP',
          urlDownload: urlPncpOficial,
        },
      ];

  return {
    fichaTecnica,
    descricaoExplicativaObjeto,
    cronogramaPrazosFatais,
    quadroItensDetalhado,
    totalizadoresItens,
    requisitosHabilitacaoDetalhados,
    roteiroPassoAPassoLicitante,
    arquivosOficiaisPncp,
  };
}
