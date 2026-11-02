import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { DeadlineType, DeadlineStatus } from '@prisma/client';
import { prisma } from '../database/prisma';
import { buscarLicitacaoPorIdOuControle } from '../services/licitacoes.service';

function hashAuditValue(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

async function logCrmAuditEvent(
  req: Request,
  params: {
    action: string;
    outcome?: 'success' | 'failure';
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const user = (req as any)?.user;
    const ip = req.ip || (req.socket?.remoteAddress ?? '');
    const userAgent = req.headers?.['user-agent'] || '';
    const requestId = (req.headers?.['x-request-id'] as string) || (req.headers?.['x-correlation-id'] as string) || null;

    await prisma.auditEvent.create({
      data: {
        userId: user?.id ?? null,
        scope: 'crm',
        action: params.action,
        outcome: params.outcome || 'success',
        entityType: 'bidding_pipeline',
        entityId: params.entityId ?? null,
        requestId,
        ipHash: ip ? hashAuditValue(ip) : null,
        userAgentHash: userAgent ? hashAuditValue(userAgent) : null,
        emailHash: user?.email ? hashAuditValue(user.email) : null,
        metadata: {
          tenantId: user?.tenantId ?? null,
          role: user?.role ?? null,
          ...(params.metadata || {}),
        },
      },
    });
  } catch (auditError) {
    // Falha em registrar auditoria nunca deve quebrar a transação de negócio
    console.error('[CRM_AUDIT] Erro ao gravar evento de auditoria:', auditError);
  }
}

export class PipelineController {
  /**
   * Lista todas as oportunidades no funil do usuário logado,
   * garantindo isolamento estrito de tenant (organização).
   */
  public listStages = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const userId = user?.id;
      const tenantId = user?.tenantId;

      if (!userId) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Não autenticado' });
        return;
      }

      const pipelines = await prisma.biddingPipeline.findMany({
        where: {
          userId,
          ...(tenantId ? { user: { tenantId } } : {}),
        },
        include: {
          notice: true,
        },
        orderBy: { position: 'asc' },
      });

      res.status(200).json({
        success: true,
        data: pipelines,
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao listar pipeline:', error);
      res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Erro ao carregar oportunidades do funil' });
    }
  };

  /**
   * Adiciona uma nova oportunidade ao funil (etapa padrão: OPORTUNIDADE).
   * Resolve o edital na persistência ou busca/upsert no PNCP oficial.
   * Impede estritamente duplicidade do mesmo edital para o mesmo pipeline.
   */
  public addToPipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const userId = user?.id;
      const tenantId = user?.tenantId;
      const { noticeId, stage = 'OPORTUNIDADE', notes } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Não autenticado' });
        return;
      }

      if (!noticeId || typeof noticeId !== 'string' || !noticeId.trim()) {
        res.status(400).json({ success: false, code: 'NOTICE_ID_REQUIRED', message: 'O ID do edital é obrigatório' });
        return;
      }

      const cleanId = noticeId.trim();

      // 1. Resolve o edital no banco de dados local
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
      const whereConditions: any[] = [
        { externalId: cleanId },
        { dedupeKey: `pncp-${cleanId}` },
        { dedupeKey: cleanId },
      ];
      if (isUuid) {
        whereConditions.unshift({ id: cleanId });
      }

      let notice = await prisma.procurementNotice.findFirst({
        where: { OR: whereConditions },
      });

      // Se não encontrou pelo identificador direto, busca na fonte oficial e persiste
      if (!notice) {
        try {
          const fetched = await buscarLicitacaoPorIdOuControle(cleanId, { requirePersistence: true });
          const targetNoticeId = fetched?.databaseId || fetched?.id;
          if (targetNoticeId) {
            notice = await prisma.procurementNotice.findFirst({
              where: {
                OR: [
                  { id: targetNoticeId },
                  { externalId: fetched.numeroControlePNCP },
                  { dedupeKey: `pncp-${fetched.numeroControlePNCP}` },
                ],
              },
            });
          }
        } catch (pncpError: any) {
          console.warn('[PipelineController] Erro ao obter/persistir edital para o pipeline:', cleanId, pncpError?.message);

          if (pncpError?.code === 'NOTICE_PERSISTENCE_FAILED' || pncpError?.isPersistenceError) {
            res.status(500).json({
              success: false,
              code: 'NOTICE_PERSISTENCE_ERROR',
              message: 'Não foi possível salvar o edital no banco local para inclusão no pipeline.',
            });
            return;
          }

          if (pncpError?.statusCode === 404 || pncpError?.message?.includes('não encontrada')) {
            res.status(404).json({
              success: false,
              code: 'NOTICE_NOT_FOUND',
              message: 'Edital não encontrado na base de dados nem na fonte oficial.',
            });
            return;
          }

          res.status(502).json({
            success: false,
            code: 'INTEGRATION_ERROR',
            message: 'Falha na comunicação com a fonte oficial ao buscar o edital.',
          });
          return;
        }
      }

      if (!notice) {
        res.status(404).json({
          success: false,
          code: 'NOTICE_NOT_FOUND',
          message: 'Edital não encontrado na base de dados nem na fonte oficial.',
        });
        return;
      }

      // 2. Regra de negócio inegociável: IMPEDIR DUPLICAÇÃO do mesmo edital no mesmo pipeline
      const existing = await prisma.biddingPipeline.findFirst({
        where: {
          userId,
          noticeId: notice.id,
          ...(tenantId ? { user: { tenantId } } : {}),
        },
        include: {
          notice: true,
        },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          code: 'OPPORTUNITY_ALREADY_EXISTS',
          message: 'Este edital já está cadastrado no seu pipeline de oportunidades.',
          data: existing,
        });
        return;
      }

      // 3. Obtém a última posição no estágio para ordenação do Kanban
      const lastItem = await prisma.biddingPipeline.findFirst({
        where: { userId, stage },
        orderBy: { position: 'desc' },
      });

      const position = lastItem ? lastItem.position + 1 : 0;

      // 4. Cria a oportunidade vinculando estritamente o usuário e edital persistido
      const pipeline = await prisma.biddingPipeline.create({
        data: {
          userId,
          noticeId: notice.id,
          stage,
          position,
          notes: notes ? String(notes).trim().slice(0, 2000) : null,
        },
        include: {
          notice: true,
        },
      });

      // 5. Gera automaticamente os prazos correspondentes vinculados ao edital
      try {
        let company = await prisma.company.findFirst({ where: { userId } });
        if (!company && tenantId) {
          company = await prisma.company.findFirst({ where: { tenantId } });
        }
        if (!company) {
          const userRecord = await prisma.user.findUnique({ where: { id: userId } });
          if (userRecord) {
            company = await prisma.company.create({
              data: {
                userId,
                tenantId: userRecord.tenantId,
                cnpj: (userRecord as any).document || '00000000000100',
                razaoSocial: (userRecord as any).companyName || userRecord.nome || 'Minha Empresa',
              },
            });
          }
        }

        if (company) {
          const deadlinesToCreate: any[] = [];
          const raw = (notice.rawPayload as any) || {};

          // Extração da data de sessão (data_sessao / abertura / encerramento)
          const sessionRaw = notice.openingAt
            || (notice as any).data_sessao
            || raw.data_sessao
            || raw.dataAberturaProposta
            || raw.dataEncerramentoProposta
            || notice.closingAt
            || notice.publishedAt;

          const sessionDateParsed = sessionRaw ? new Date(sessionRaw) : null;
          const validSessionDate = sessionDateParsed && !isNaN(sessionDateParsed.getTime())
            ? sessionDateParsed
            : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

          // Prazo da Sessão de Disputa (Obrigatório — SESSAO_PUBLICA)
          deadlinesToCreate.push({
            companyId: company.id,
            procurementNoticeId: notice.id,
            responsibleUserId: userId,
            userId,
            title: `Sessão de Disputa — ${notice.noticeNumber || notice.externalId || 'Edital'}`.slice(0, 150),
            description: `Abertura oficial da disputa no órgão ${notice.buyerName || 'Licitante'}.`,
            type: DeadlineType.SESSAO_PUBLICA,
            status: DeadlineStatus.PENDENTE,
            dueAt: validSessionDate,
            date: validSessionDate,
            source: 'crm_pipeline_auto',
          });

          // Prazo Limite para Impugnação (3 dias úteis antes — Lei 14.133/2021)
          const impugnacaoDate = new Date(validSessionDate.getTime() - 3 * 24 * 60 * 60 * 1000);
          if (impugnacaoDate.getTime() > Date.now()) {
            deadlinesToCreate.push({
              companyId: company.id,
              procurementNoticeId: notice.id,
              responsibleUserId: userId,
              title: `Prazo Limite de Impugnação — ${notice.noticeNumber || notice.externalId || 'Edital'}`.slice(0, 150),
              description: `Prazo fatal para protocolar impugnação ao edital perante o órgão (Art. 164 da Lei 14.133/2021).`,
              type: DeadlineType.IMPUGNATION,
              dueAt: impugnacaoDate,
              source: 'crm_pipeline_auto',
            });
          }

          if (notice.closingAt && notice.closingAt.getTime() !== validSessionDate.getTime()) {
            const closing = new Date(notice.closingAt);
            if (!isNaN(closing.getTime())) {
              deadlinesToCreate.push({
                companyId: company.id,
                procurementNoticeId: notice.id,
                responsibleUserId: userId,
                title: `Envio de Proposta Comercial — ${notice.noticeNumber || notice.externalId || 'Edital'}`.slice(0, 150),
                description: `Limite final para inserção da proposta comercial no sistema oficial.`,
                type: DeadlineType.PROPOSAL_SUBMISSION,
                dueAt: closing,
                source: 'crm_pipeline_auto',
              });
            }
          }

          for (const deadlineData of deadlinesToCreate) {
            const exists = await prisma.deadline.findFirst({
              where: {
                companyId: company.id,
                procurementNoticeId: notice.id,
                type: deadlineData.type,
              },
            });
            if (!exists) {
              await prisma.deadline.create({ data: deadlineData });
            }
          }
        }
      } catch (deadlineErr) {
        console.warn('[PipelineController] Aviso ao gerar prazos automáticos do edital:', deadlineErr);
      }

      // 6. Registra auditoria da inclusão de oportunidade
      await logCrmAuditEvent(req, {
        action: 'CRM_OPPORTUNITY_CREATED',
        outcome: 'success',
        entityId: pipeline.id,
        metadata: {
          noticeId: notice.id,
          noticeNumber: notice.noticeNumber,
          externalId: notice.externalId,
          buyerName: notice.buyerName,
          stage: pipeline.stage,
          estimatedValue: notice.estimatedValue ? Number(notice.estimatedValue) : null,
          source: notice.source,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Oportunidade adicionada ao pipeline com sucesso.',
        data: pipeline,
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao adicionar ao pipeline:', error);
      res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Erro interno ao salvar oportunidade' });
    }
  };

  /**
   * Move uma oportunidade para outro estágio (ex: ANALISE, PROPOSTA, DISPUTA, GANHO).
   * Respeita isolamento de tenant e registra auditoria da transição.
   */
  public moveOpportunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const userId = user?.id;
      const tenantId = user?.tenantId;
      const { id } = req.params;
      const { stage, position } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Não autenticado' });
        return;
      }

      // Validação de isolamento: usuário só altera oportunidade própria dentro de seu tenant
      const existing = await prisma.biddingPipeline.findFirst({
        where: {
          id,
          userId,
          ...(tenantId ? { user: { tenantId } } : {}),
        },
        include: {
          notice: true,
        },
      });

      if (!existing) {
        res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Oportunidade não encontrada no pipeline' });
        return;
      }

      const previousStage = existing.stage;
      const newStage = stage !== undefined ? String(stage).trim().toUpperCase() : existing.stage;
      const newPosition = position !== undefined ? Number(position) : existing.position;

      const updated = await prisma.biddingPipeline.update({
        where: { id },
        data: {
          stage: newStage,
          position: newPosition,
        },
        include: {
          notice: true,
        },
      });

      // Registra auditoria da transição de etapa
      await logCrmAuditEvent(req, {
        action: 'CRM_STAGE_UPDATED',
        outcome: 'success',
        entityId: updated.id,
        metadata: {
          previousStage,
          newStage: updated.stage,
          noticeId: existing.noticeId,
          noticeNumber: existing.notice?.noticeNumber,
        },
      });

      res.status(200).json({
        success: true,
        message: `Oportunidade movida para a etapa ${updated.stage} com sucesso.`,
        data: updated,
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao mover oportunidade:', error);
      res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Erro ao mover oportunidade' });
    }
  };

  /**
   * Remove uma oportunidade do funil com isolamento e auditoria.
   */
  public removeFromPipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const userId = user?.id;
      const tenantId = user?.tenantId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Não autenticado' });
        return;
      }

      const existing = await prisma.biddingPipeline.findFirst({
        where: {
          id,
          userId,
          ...(tenantId ? { user: { tenantId } } : {}),
        },
        include: {
          notice: true,
        },
      });

      if (!existing) {
        res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Oportunidade não encontrada' });
        return;
      }

      await prisma.biddingPipeline.delete({ where: { id } });

      // Registra auditoria da remoção
      await logCrmAuditEvent(req, {
        action: 'CRM_OPPORTUNITY_REMOVED',
        outcome: 'success',
        entityId: id,
        metadata: {
          stage: existing.stage,
          noticeId: existing.noticeId,
          noticeNumber: existing.notice?.noticeNumber,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Oportunidade removida do funil com sucesso',
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao remover do pipeline:', error);
      res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Erro ao remover oportunidade' });
    }
  };
}
