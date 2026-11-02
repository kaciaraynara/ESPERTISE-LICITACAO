import { Router, RequestHandler } from 'express';
import { PipelineController } from '../controllers/pipeline.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { requireRole } from '../shared/middlewares/role.middleware';
import { validate } from '../shared/middlewares/validate.middleware';
import { addToPipelineSchema, updatePipelineStageSchema } from '../schemas/crm.schema';

/**
 * CRM Routes — usa PipelineController com Prisma real (BiddingPipeline).
 * Suporta regras de negócio inegociáveis:
 * - Listagem de editais reais da persistência;
 * - Prevenção de duplicidade (409 Conflict);
 * - Isolamento multi-tenant por usuário e organização;
 * - Auditoria em tabela audit_events.
 */
const router = Router();
const pipeline = new PipelineController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(authMiddleware as RequestHandler);
router.use(requireRole('fornecedor') as RequestHandler);

// Lista todas as oportunidades do usuário no funil (BiddingPipeline)
router.get('/oportunidades', handle(pipeline.listStages as RequestHandler));

// Cria nova oportunidade no funil com validação Zod
router.post(
  '/oportunidades',
  validate(addToPipelineSchema),
  handle(pipeline.addToPipeline as RequestHandler),
);

// Move oportunidade de stage (drag-and-drop do Kanban)
router.patch(
  '/oportunidades/:id',
  validate(updatePipelineStageSchema),
  handle(pipeline.moveOpportunity as RequestHandler),
);

// Alias compatível com frontend: PATCH /crm/oportunidades/:id/etapa
router.patch('/oportunidades/:id/etapa', (req, res, next) => {
  // Normaliza body: frontend pode enviar { etapa } mas PipelineController espera { stage }
  if (req.body?.etapa && !req.body?.stage) {
    req.body.stage = String(req.body.etapa).trim().toUpperCase();
  }
  next();
}, validate(updatePipelineStageSchema), handle(pipeline.moveOpportunity as RequestHandler));

// Remove oportunidade do funil
router.delete('/oportunidades/:id', handle(pipeline.removeFromPipeline as RequestHandler));

// Métricas agregadas do pipeline (calculadas em tempo real com isolamento de tenant)
router.get('/metricas', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const tenantId = user?.tenantId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Não autenticado' });
      return;
    }

    const { prisma } = await import('../database/prisma');

    const pipelines = await prisma.biddingPipeline.findMany({
      where: {
        userId,
        ...(tenantId ? { user: { tenantId } } : {}),
      },
      include: {
        notice: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const totalPipeline = pipelines.length;

    // Etapas ativas em disputa (antes do encerramento)
    const emDisputa = pipelines.filter(
      (p) => !['GANHO', 'PERDIDO', 'ARQUIVADO'].includes(p.stage),
    );

    const valorTotalEmDisputa = emDisputa.reduce((acc, p) => {
      const valor = p.notice?.estimatedValue ? Number(p.notice.estimatedValue) : 0;
      return acc + valor;
    }, 0);

    const ganhos = pipelines.filter((p) => p.stage === 'GANHO');
    const perdidos = pipelines.filter((p) => p.stage === 'PERDIDO');
    const arquivados = pipelines.filter((p) => p.stage === 'ARQUIVADO');

    const vitorias = ganhos.length;
    const derrotas = perdidos.length;

    const faturamentoAdjudicado = ganhos.reduce((acc, p) => {
      const valor = p.notice?.estimatedValue ? Number(p.notice.estimatedValue) : 0;
      return acc + valor;
    }, 0);

    const ticketMedio = vitorias > 0 ? Math.round(faturamentoAdjudicado / vitorias) : 0;

    // Taxa de conversão: Vitórias sobre total de processos finalizados ou total no funil
    const totalFinalizados = vitorias + derrotas;
    const taxaConversao =
      totalFinalizados > 0
        ? Math.round((vitorias / totalFinalizados) * 100 * 10) / 10
        : totalPipeline > 0
        ? Math.round((vitorias / totalPipeline) * 100 * 10) / 10
        : 0;

    // Sessões de disputa hoje (DISPUTA stage atualizado hoje)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const sessoesHoje = pipelines.filter(
      (p) => p.stage === 'DISPUTA' && new Date(p.updatedAt) >= hoje,
    ).length;

    // Agrupamento por etapa
    const STAGE_LABELS: Record<string, string> = {
      OPORTUNIDADE: 'Oportunidades Mapeadas',
      DOCUMENTACAO: 'Triagem Documental',
      PROPOSTA: 'Elaboração de Proposta',
      DISPUTA: 'Sessão de Disputa / Pregão',
      HABILITACAO: 'Fase de Habilitação',
      GANHO: 'Adjudicados / Vitórias',
      PERDIDO: 'Perdidos / Desclassificados',
      ARQUIVADO: 'Arquivados',
    };

    const etapasChaves = [
      'OPORTUNIDADE',
      'DOCUMENTACAO',
      'PROPOSTA',
      'DISPUTA',
      'HABILITACAO',
      'GANHO',
      'PERDIDO',
      'ARQUIVADO',
    ];

    const porEtapa = etapasChaves.map((stageKey) => {
      const itensEtapa = pipelines.filter((p) => p.stage === stageKey);
      const valorTotalEtapa = itensEtapa.reduce((acc, p) => {
        return acc + (p.notice?.estimatedValue ? Number(p.notice.estimatedValue) : 0);
      }, 0);
      return {
        stage: stageKey,
        label: STAGE_LABELS[stageKey] || stageKey,
        count: itensEtapa.length,
        valorTotal: valorTotalEtapa,
      };
    });

    // Desempenho por portal (baseado nos editais do usuário)
    const portaisMap = new Map<string, { total: number; vitorias: number; valorTotal: number }>();
    for (const item of pipelines) {
      const portal = item.notice?.source || 'Compras.gov.br';
      const atual = portaisMap.get(portal) || { total: 0, vitorias: 0, valorTotal: 0 };
      atual.total += 1;
      if (item.stage === 'GANHO') {
        atual.vitorias += 1;
      }
      atual.valorTotal += item.notice?.estimatedValue ? Number(item.notice.estimatedValue) : 0;
      portaisMap.set(portal, atual);
    }

    const desempenhoPorPortal = Array.from(portaisMap.entries()).map(([portal, stats]) => ({
      portal,
      total: stats.total,
      vitorias: stats.vitorias,
      valorTotal: stats.valorTotal,
      winRate: stats.total > 0 ? Math.round((stats.vitorias / stats.total) * 100 * 10) / 10 : 0,
    }));

    // Últimas movimentações
    const ultimasOportunidades = pipelines.slice(0, 10).map((p) => ({
      id: p.id,
      stage: p.stage,
      stageLabel: STAGE_LABELS[p.stage] || p.stage,
      updatedAt: p.updatedAt,
      notice: p.notice
        ? {
            id: p.notice.id,
            noticeNumber: p.notice.noticeNumber,
            buyerName: p.notice.buyerName,
            object: p.notice.object,
            estimatedValue: p.notice.estimatedValue ? Number(p.notice.estimatedValue) : 0,
            portalName: p.notice.source || 'Compras.gov.br',
            uf: p.notice.uf,
          }
        : null,
    }));

    res.json({
      success: true,
      data: {
        totalPipeline,
        valorTotalEmDisputa,
        taxaConversao,
        sessoesHoje,
        vitorias,
        derrotas,
        arquivados: arquivados.length,
        faturamentoAdjudicado,
        ticketMedio,
        porEtapa,
        desempenhoPorPortal,
        ultimasOportunidades,
      },
    });
  } catch (error) {
    next(error);
  }
});


export default router;