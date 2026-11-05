import { Router, RequestHandler } from 'express';
import { prisma } from '../database/prisma';
import { rateLimit } from 'express-rate-limit';
import { AIController } from '../controllers/ai.controller';
import { AuditAdminController } from '../controllers/audit-admin.controller';
import { DataPlatformAdminController } from '../controllers/data-platform-admin.controller';
import { IntegracoesController } from '../controllers/integracoes.controller';
import { ImpugnacaoController } from '../controllers/impugnacao.controller';
import { LegalRulesAdminController } from '../controllers/legal-rules-admin.controller';
import { LicitacaoController } from '../controllers/licitacao.controller';
import { LicitacoesController } from '../controllers/licitacoes.controller';
import { NoticesController } from '../controllers/notices.controller';
import { PropostasController } from '../controllers/propostas.controller';
import { RbacAdminController } from '../controllers/rbac-admin.controller';
import { superAdminController } from '../controllers/super-admin.controller';
import { TransparenciaController } from '../controllers/transparencia.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { PipelineController } from '../controllers/pipeline.controller';
import { PricingController } from '../controllers/pricing.controller';
import { GovBrController } from '../controllers/govbr.controller';
import { LexController } from '../controllers/lex.controller';

// Sub-roteadores
import certidoesRoutes from './certidoes.routes';
import documentosRoutes from './documentos.routes';
import documentTemplatesRoutes from './document-templates.routes';
import lexRoutes from './lex.routes';
import roboRoutes from './robo.routes';
import marketplaceRoutes from './marketplace.routes';
import catalogoRoutes from './catalogo.routes';
import prazosRoutes from './prazos.routes';
import empresasRoutes from './empresas.routes';
import authRoutes from './auth.routes';
import adminRoutes, { resolveAdminSecretPath } from './admin.routes';
import mercadoPagoRoutes from './mercadopago.routes';
import cofreRoutes from './cofre.routes';
import crmRoutes from './crm.routes';
import precificacaoRoutes from './precificacao.routes';
import analiseViabilidadeRoutes from './analise-viabilidade.routes';
import monitoredNoticesRoutes from './monitored-notices.routes';
import concorrentesRoutes from './concorrentes.routes';
import notificacoesRoutes from './notificacoes.routes';
import contratosRoutes from './contratos.routes';
import taxRoutes from './tax.routes';
import guaranteesRoutes from './guarantees.routes';
import proposalsRoutes from './proposals.routes';
import { proposalAutomationController } from '../controllers/proposal-automation.controller';
import { MercadoPagoController } from '../controllers/mercadopago.controller';

// Middlewares
import {
  AuthRequest,
  authMiddleware,
  companyContextMiddleware,
} from '../shared/middlewares/auth.middleware';

import {
  requireAuditRead,
  requireDataPlatformAdmin,
  requireLegalAdmin,
  requireLegalPublish,
  requireLegalReview,
  requireRbacAdmin,
} from '../shared/middlewares/data-platform-admin.middleware';

import { lexAIRateLimit } from '../shared/middlewares/lex-ai-rate-limit.middleware';
import { requireRole } from '../shared/middlewares/role.middleware';
import { requirePlanFeature } from '../shared/middlewares/plan-feature.middleware';
import { requirePlanLimit, requireMasterPlan } from '../shared/middlewares/plan-limits.middleware';
import { transparenciaRateLimit } from '../shared/middlewares/transparencia-rate-limit.middleware';
import { validate } from '../shared/middlewares/validate.middleware';
import { getBooleanEnv, isProduction } from '../config/env';

// Schemas Zod de Validação (ST-102)
import { createPropostaSchema } from '../schemas/proposta.schema';
import {
  gerarPecaImpugnacaoSchema,
  calcularPrazoImpugnacaoSchema,
} from '../schemas/impugnacao.schema';

const router = Router();

const ai = new AIController();
const auditAdmin = new AuditAdminController();
const dataPlatformAdmin = new DataPlatformAdminController();
const integracoes = new IntegracoesController();
const impugnacao = new ImpugnacaoController();
const legalRulesAdmin = new LegalRulesAdminController();
const licitacoes = new LicitacoesController();
const licitacaoIntel = new LicitacaoController();
const notices = new NoticesController();
const propostas = new PropostasController();
const rbacAdmin = new RbacAdminController();
const transparencia = new TransparenciaController();
const dashboard = new DashboardController();
const pipeline = new PipelineController();
const pricing = new PricingController();
const mercadoPago = new MercadoPagoController();
const govbr = new GovBrController();
const lex = new LexController();

const lexEnabled = getBooleanEnv('ENABLE_LEX', false);
const bidRobotEnabled = getBooleanEnv('ENABLE_BID_ROBOT', false);
const crmEnabled = getBooleanEnv('ENABLE_CRM', false);

const legacyMarketplaceEnabled =
  !isProduction() && getBooleanEnv('ENABLE_LEGACY_MARKETPLACE', false);

const legacyPricingStrategyEnabled =
  !isProduction() && getBooleanEnv('ENABLE_LEGACY_PRICING_STRATEGY', false);

const handle =
  (handler: RequestHandler): RequestHandler =>
    (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };

// ==========================================
// 1. ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// ==========================================

router.use('/auth', authRoutes);
router.use(adminRoutes);
router.use('/pagamentos', mercadoPagoRoutes);

router.get(
  '/public/cnpj/:cnpj',
  handle(
    integracoes.consultarCnpj.bind(
      integracoes,
    ) as RequestHandler,
  ),
);

router.post(
  '/webhooks/mercadopago',
  handle(mercadoPago.webhook.bind(mercadoPago) as RequestHandler),
);

// ==========================================
// HEALTH CHECKS PÚBLICOS
// ==========================================
//
// GET /api/v1/health
// GET /api/v1/health/readiness
//
// Essas rotas ficam antes do authMiddleware.
// /health verifica apenas se a API está viva.
// /health/readiness verifica API + banco.
// ==========================================

router.get('/health', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'expertise-api',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/readiness', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[HEALTH_READINESS] Banco de dados indisponível:',
      error,
    );

    return res.status(503).json({
      status: 'not_ready',
      database: 'unavailable',
      code: 'DATABASE_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// 2. MIDDLEWARE DE AUTENTICAÇÃO E RATE LIMIT
// ==========================================

router.use(authMiddleware as RequestHandler);
router.use(companyContextMiddleware as RequestHandler);

router.use(
  rateLimit({
    windowMs:
      Number(process.env.USER_RATE_LIMIT_WINDOW_MS) ||
      15 * 60 * 1000,

    max:
      Number(process.env.USER_RATE_LIMIT_MAX) ||
      300,

    standardHeaders: true,
    legacyHeaders: false,

    // Store em memória nativo de alta performance (Zero escritas no PostgreSQL)
    keyGenerator: (req) =>
      `user:${(req as AuthRequest).user!.id}`,

    message: {
      success: false,
      code: 'USER_RATE_LIMIT_EXCEEDED',
      message:
        'Limite de requisições da conta excedido. Tente novamente mais tarde.',
    },
  }),
);

// ==========================================
// ROLES HELPERS
// ==========================================

const fornecedor =
  requireRole('fornecedor') as RequestHandler;

const fornecedorOuAdvogado =
  requireRole('fornecedor') as RequestHandler;

const auditReadOnly =
  requireAuditRead as RequestHandler;

const dataPlatformAdminOnly =
  requireDataPlatformAdmin as RequestHandler;

const legalAdminOnly =
  requireLegalAdmin as RequestHandler;

const legalReviewOnly =
  requireLegalReview as RequestHandler;

const legalPublishOnly =
  requireLegalPublish as RequestHandler;

const rbacAdminOnly =
  requireRbacAdmin as RequestHandler;

// ==========================================
// 3. ROTAS PROTEGIDAS POR MÓDULO
// ==========================================

// ==========================================
// DASHBOARD
// ==========================================

router.get(
  '/dashboard/metrics',
  fornecedor,
  handle(
    dashboard.getMetrics.bind(
      dashboard,
    ) as RequestHandler,
  ),
);

// ==========================================
// MÓDULOS DO SISTEMA (status de entrega)
// ==========================================

const MODULE_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponível',
  IN_IMPLANTATION: 'Em implantação',
  INTEGRATION_PENDING: 'Integração pendente',
  HIDDEN: 'Oculto',
  DISABLED: 'Desabilitado',
};

router.get('/modules', fornecedor, handle(async (_req, res) => {
  const modules = await prisma.systemModule.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const data = modules.map((module) => ({
    id: module.id,
    key: module.key,
    name: module.name,
    description: module.description,
    route: module.route,
    icon: module.icon,
    status: module.status,
    statusLabel: MODULE_STATUS_LABELS[module.status] || module.status,
    isAvailable: module.status === 'AVAILABLE',
    sortOrder: module.sortOrder,
    isVisible: module.isVisible,
  }));

  return res.json({
    success: true,
    data: {
      modules: data,
      total: data.length,
    },
  });
}));

// Alias do Radar → mesma fonte canônica de /licitacoes
router.get(
  '/radar/editais',
  fornecedor,
  requirePlanFeature('radar_editais'),
  handle(licitacoes.listar as RequestHandler),
);

// ==========================================
// MÓDULOS RECENTES
// ==========================================

router.use('/catalogo', requirePlanFeature('catalogo_produtos'), catalogoRoutes);
router.use('/concorrentes', concorrentesRoutes);
router.use('/notificacoes', notificacoesRoutes);
router.use('/contratos', contratosRoutes);
router.use('/tax', taxRoutes);
router.use('/guarantees', guaranteesRoutes);
router.use('/proposals', proposalsRoutes);

router.post(
  '/propostas/generate',
  fornecedor,
  handle(proposalAutomationController.generate as unknown as RequestHandler),
);

router.use('/cofre', requirePlanFeature('cofre_documentos'), cofreRoutes);

router.use('/monitored-notices', requirePlanFeature('radar_editais'), monitoredNoticesRoutes);

router.use('/propostas', requirePlanFeature('fabrica_propostas'));

router.get(
  '/propostas',
  fornecedor,
  handle(
    propostas.listar.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.post(
  '/propostas',
  fornecedor,
  requirePlanLimit('proposals'),
  handle(
    propostas.criarRascunho.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.get(
  '/propostas/:id',
  fornecedor,
  handle(
    propostas.obterProposta.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.patch(
  '/propostas/:id',
  fornecedor,
  handle(
    propostas.atualizarProposta.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.post(
  '/propostas/:id/itens',
  fornecedor,
  handle(
    propostas.adicionarItem.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.patch(
  '/propostas/:id/itens/:itemId',
  fornecedor,
  handle(
    propostas.atualizarItem.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.delete(
  '/propostas/:id/itens/:itemId',
  fornecedor,
  handle(
    propostas.removerItem.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.get(
  '/propostas/:id/compliance',
  fornecedor,
  handle(
    propostas.validarCompliance.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.post(
  '/propostas/:id/documento',
  fornecedor,
  handle(
    propostas.gerarDocumentoOficial.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.get(
  '/propostas/:id/documento',
  fornecedor,
  handle(
    propostas.gerarDocumentoOficial.bind(
      propostas,
    ) as RequestHandler,
  ),
);

router.use(
  '/precificacao',
  requirePlanFeature('pricing.strategy'),
  precificacaoRoutes,
);

router.use(
  '/analise-viabilidade',
  requirePlanFeature('analise_viabilidade'),
  analiseViabilidadeRoutes,
);

// ==========================================
// CRM
// ==========================================

if (crmEnabled) {
  router.use('/crm', requirePlanFeature('crm_kanban'), crmRoutes);

  router.post(
    '/pipeline',
    fornecedor,
    requirePlanFeature('crm_kanban'),
    handle(
      pipeline.addToPipeline.bind(
        pipeline,
      ) as RequestHandler,
    ),
  );

  router.get(
    '/pipeline',
    fornecedor,
    requirePlanFeature('crm_kanban'),
    handle(
      pipeline.listStages.bind(
        pipeline,
      ) as RequestHandler,
    ),
  );

  router.patch(
    '/pipeline/:id',
    fornecedor,
    requirePlanFeature('crm_kanban'),
    handle(
      pipeline.moveOpportunity.bind(
        pipeline,
      ) as RequestHandler,
    ),
  );

  // Alias compatível com clientes que usam /pipeline/:id/stage
  router.patch(
    '/pipeline/:id/stage',
    fornecedor,
    requirePlanFeature('crm_kanban'),
    (req, _res, next) => {
      if (req.body?.etapa && !req.body?.stage) {
        req.body.stage = String(req.body.etapa).trim().toUpperCase();
      }
      next();
    },
    handle(
      pipeline.moveOpportunity.bind(
        pipeline,
      ) as RequestHandler,
    ),
  );

  router.delete(
    '/pipeline/:id',
    fornecedor,
    requirePlanFeature('crm_kanban'),
    handle(
      pipeline.removeFromPipeline.bind(
        pipeline,
      ) as RequestHandler,
    ),
  );
}

// ==========================================
// LEX / IA
// ==========================================

if (lexEnabled) {
  router.post(
    '/ai/consultar',
    requirePlanFeature('lex.advanced'),
    lexAIRateLimit,
    handle(
      ai.consultar.bind(
        ai,
      ) as RequestHandler,
    ),
  );

  router.use('/lex', requirePlanFeature('lex.advanced'), lexRoutes);

  // Alias legado: POST /auditoria/:licitacaoId → /lex/auditar
  router.post(
    '/auditoria/:licitacaoId',
    requirePlanFeature('lex.advanced'),
    lexAIRateLimit,
    (req, _res, next) => {
      const body = (req.body && typeof req.body === 'object') ? req.body : {};
      req.body = {
        ...body,
        edital_id: body.edital_id || req.params.licitacaoId,
        noticeId: body.noticeId || req.params.licitacaoId,
        texto_edital: body.texto_edital || body.textoEdital,
      };
      next();
    },
    handle(lex.auditar.bind(lex) as RequestHandler),
  );
}

// ==========================================
// GOV.BR (confiabilidade / perfil)
// ==========================================

router.get(
  '/govbr/perfil/:cpf',
  fornecedor,
  handle(govbr.consultarPerfilCompleto.bind(govbr) as RequestHandler),
);

router.get(
  '/govbr/conta/:cpf',
  fornecedor,
  handle(govbr.consultarConta.bind(govbr) as RequestHandler),
);

router.get(
  '/govbr/confiabilidade/:cpf',
  fornecedor,
  handle(govbr.consultarConfiabilidade.bind(govbr) as RequestHandler),
);

// ==========================================
// ROTAS ADMINISTRATIVAS OFUSCADAS (process.env.ADMIN_SECRET_PATH)
// O prefixo estático '/admin' foi substituído pelo caminho secreto dinâmico.
// ==========================================
const dynamicAdminPrefix = `/${resolveAdminSecretPath().trim()}`;

router.get(
  `${dynamicAdminPrefix}/audit/events`,
  auditReadOnly,
  handle(
    auditAdmin.listEvents.bind(
      auditAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/audit/metrics`,
  auditReadOnly,
  handle(
    auditAdmin.metrics.bind(
      auditAdmin,
    ) as RequestHandler,
  ),
);

// ==========================================
// SUPER ADMIN (OFUSCADO)
// ==========================================

router.get(
  `${dynamicAdminPrefix}/super/metrics`,
  rbacAdminOnly,
  handle(
    superAdminController.getMetrics.bind(
      superAdminController,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/super/users`,
  rbacAdminOnly,
  handle(
    superAdminController.listUsers.bind(
      superAdminController,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/super/email`,
  rbacAdminOnly,
  handle(
    superAdminController.sendEmail.bind(
      superAdminController,
    ) as RequestHandler,
  ),
);

// ==========================================
// DATA PLATFORM ADMIN (OFUSCADO)
// ==========================================

router.get(
  `${dynamicAdminPrefix}/data-platform/jobs`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.listJobs.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/data-platform/events`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.listEvents.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/data-platform/tasks`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.listTasks.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/data-platform/cursors`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.listCursors.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/data-platform/metrics`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.metrics.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/ingest/pncp`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.runPncpIngestion.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/ingest/comprasgov`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.runComprasGovIngestion.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/ingest/tcu`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.runTcuIngestion.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/index/consume`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.consumeIndexTasks.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/requeue/skipped`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.requeueSkipped.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/requeue/failed`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.requeueFailed.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/data-platform/tasks/cleanup`,
  dataPlatformAdminOnly,
  handle(
    dataPlatformAdmin.cleanupOldTasks.bind(
      dataPlatformAdmin,
    ) as RequestHandler,
  ),
);

// ==========================================
// RBAC ADMIN (OFUSCADO)
// ==========================================

router.get(
  `${dynamicAdminPrefix}/rbac/roles`,
  rbacAdminOnly,
  handle(
    rbacAdmin.listRoles.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/rbac/roles`,
  rbacAdminOnly,
  handle(
    rbacAdmin.createRole.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/rbac/permissions`,
  rbacAdminOnly,
  handle(
    rbacAdmin.listPermissions.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/rbac/users/:userId/permissions`,
  rbacAdminOnly,
  handle(
    rbacAdmin.listUserPermissions.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/rbac/user-roles`,
  rbacAdminOnly,
  handle(
    rbacAdmin.assignRole.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

router.delete(
  `${dynamicAdminPrefix}/rbac/user-roles`,
  rbacAdminOnly,
  handle(
    rbacAdmin.revokeRole.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/rbac/user-roles/revoke`,
  rbacAdminOnly,
  handle(
    rbacAdmin.revokeRole.bind(
      rbacAdmin,
    ) as RequestHandler,
  ),
);

// ==========================================
// LEGAL RULES ADMIN (OFUSCADO)
// ==========================================

router.get(
  `${dynamicAdminPrefix}/legal-rules`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.listRules.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/legal-rules/:id`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.getRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.createRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.patch(
  `${dynamicAdminPrefix}/legal-rules/:id`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.updateRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/submit-review`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.submitReview.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/approve`,
  legalReviewOnly,
  handle(
    legalRulesAdmin.approveRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/reject`,
  legalReviewOnly,
  handle(
    legalRulesAdmin.rejectRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/activate-approved`,
  legalPublishOnly,
  handle(
    legalRulesAdmin.activateApproved.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/legal-rules/:id/history`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.history.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.get(
  `${dynamicAdminPrefix}/legal-rules/:id/diff/:compareId`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.diff.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/activate`,
  legalPublishOnly,
  handle(
    legalRulesAdmin.activateRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/deactivate`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.deactivateRule.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

router.post(
  `${dynamicAdminPrefix}/legal-rules/:id/new-version`,
  legalAdminOnly,
  handle(
    legalRulesAdmin.createNewVersion.bind(
      legalRulesAdmin,
    ) as RequestHandler,
  ),
);

// ==========================================
// EDITAIS / NOTICES
// ==========================================

router.get(
  '/notices/search',
  requirePlanFeature('radar_editais'),
  handle(
    notices.search.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/chunks',
  requirePlanFeature('radar_editais'),
  handle(
    notices.chunks.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/basic-summary',
  requirePlanFeature(
    'notices.basic_summary',
  ),
  handle(
    notices.basicSummary.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/summary',
  requirePlanFeature(
    'notices.full_summary',
  ),
  handle(
    notices.summary.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/legal-precheck',
  requirePlanFeature(
    'notices.legal_precheck',
  ),
  handle(
    notices.legalPrecheckReport.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/error-radar',
  requirePlanFeature(
    'notices.error_radar',
  ),
  handle(
    notices.errorRadarReport.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/minuta-impugnacao',
  requirePlanFeature('impugnation.simple'),
  handle(
    notices.minutaImpugnacaoReport.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.post(
  '/notices/batch-score',
  requirePlanFeature(
    'notices.opportunity_score',
  ),
  handle(
    notices.batchOpportunityScore.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/opportunity-score',
  requirePlanFeature(
    'notices.opportunity_score',
  ),
  handle(
    notices.opportunityScoreReport.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/proposal-strategy',
  requirePlanFeature(
    'proposal.strategy',
  ),
  handle(
    notices.proposalStrategyReport.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.post(
  '/notices/:id/proposal-document',
  requirePlanFeature(
    'proposal.strategy',
  ),
  handle(
    notices.generateProposalDocument.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id/pricing-strategy',
  requirePlanFeature(
    'pricing.strategy',
  ),
  handle(
    notices.pricingStrategyReport.bind(
      notices,
    ) as RequestHandler,
  ),
);

router.get(
  '/notices/:id',
  requirePlanFeature('radar_editais'),
  handle(
    notices.getById.bind(
      notices,
    ) as RequestHandler,
  ),
);

// ==========================================
// LICITAÇÕES E SINCRONIZAÇÃO
// ==========================================

router.get(
  '/licitacoes',
  fornecedor,
  handle(
    licitacoes.listar as RequestHandler,
  ),
);

router.post(
  '/licitacoes/sincronizar',
  fornecedor,
  handle(
    licitacoes.sincronizar as RequestHandler,
  ),
);

router.get(
  '/licitacoes/preco-referencia',
  fornecedor,
  handle(
    licitacaoIntel.precoReferencia.bind(
      licitacaoIntel,
    ) as RequestHandler,
  ),
);

router.get(
  '/licitacoes/fornecedores/:cnpj/risco',
  transparenciaRateLimit,
  fornecedor,
  handle(
    licitacaoIntel.checarRiscoFornecedor.bind(
      licitacaoIntel,
    ) as RequestHandler,
  ),
);

router.get(
  '/licitacoes/:id',
  fornecedor,
  handle(
    licitacoes.buscarPorId as RequestHandler,
  ),
);

router.post(
  '/licitacoes/monitor',
  fornecedor,
  handle(
    licitacoes.monitorar as RequestHandler,
  ),
);

router.get(
  '/integracoes/cnpj/:cnpj',
  fornecedor,
  handle(
    integracoes.consultarCnpj.bind(
      integracoes,
    ) as RequestHandler,
  ),
);

router.get(
  '/integracoes/catalogo',
  fornecedor,
  handle(
    integracoes.catalogo.bind(
      integracoes,
    ) as RequestHandler,
  ),
);

router.get(
  '/integracoes/health',
  fornecedor,
  handle(
    integracoes.health.bind(
      integracoes,
    ) as RequestHandler,
  ),
);

router.post(
  '/integracoes/sincronizar/pncp',
  fornecedor,
  handle(
    integracoes.sincronizarPncp.bind(
      integracoes,
    ) as RequestHandler,
  ),
);

// ==========================================
// DOCUMENTOS / EMPRESAS / CATÁLOGO
// ==========================================

router.use(
  '/certidoes',
  requirePlanFeature('certidoes'),
  certidoesRoutes,
);

router.use(
  '/documentos',
  requirePlanFeature('cofre_documentos'),
  documentosRoutes,
);

router.use(
  '/templates',
  requirePlanFeature('fabrica_propostas'),
  documentTemplatesRoutes,
);

router.use(
  '/empresas',
  empresasRoutes,
);


router.use(
  '/prazos',
  requirePlanFeature('prazos_alertas'),
  prazosRoutes,
);


// ==========================================
// IMPUGNAÇÕES
// ==========================================

router.post(
  '/impugnacoes/prazo',
  fornecedorOuAdvogado,
  requirePlanFeature(
    'impugnation.simple',
  ),
  validate(
    calcularPrazoImpugnacaoSchema,
  ),
  handle(
    impugnacao.calcularPrazo.bind(
      impugnacao,
    ) as RequestHandler,
  ),
);

router.post(
  '/impugnacoes/peca',
  fornecedorOuAdvogado,
  requirePlanFeature(
    'impugnation.simple',
  ),
  validate(
    gerarPecaImpugnacaoSchema,
  ),
  handle(
    impugnacao.gerarPeca.bind(
      impugnacao,
    ) as RequestHandler,
  ),
);

// ==========================================
// ROBÔ DE LANCES
// ==========================================

if (bidRobotEnabled) {
  router.use(
    '/robo',
    roboRoutes,
  );
}

// ==========================================
// MARKETPLACE LEGADO
// ==========================================

if (legacyMarketplaceEnabled) {
  router.use(
    '/marketplace',
    marketplaceRoutes,
  );
}

// ==========================================
// PORTAL DA TRANSPARÊNCIA
// ==========================================

router.get(
  '/transparencia/health',
  handle(
    transparencia.health.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/metrics',
  handle(
    transparencia.metrics.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.post(
  '/transparencia/cache/clean',
  dataPlatformAdminOnly,
  handle(
    transparencia.cleanCache.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/empresa/:cnpj',
  transparenciaRateLimit,
  fornecedor,
  handle(
    transparencia.consultarEmpresa.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/penalidades',
  transparenciaRateLimit,
  fornecedor,
  handle(
    transparencia.consultarPenalidades.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/licitacoes',
  transparenciaRateLimit,
  fornecedor,
  handle(
    transparencia.consultarLicitacoes.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/contratos',
  transparenciaRateLimit,
  fornecedor,
  handle(
    transparencia.consultarContratos.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/cepim/:cnpj',
  transparenciaRateLimit,
  fornecedor,
  handle(
    transparencia.consultarCepim.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

router.get(
  '/transparencia/cnep/:cnpj',
  transparenciaRateLimit,
  fornecedor,
  handle(
    transparencia.consultarCnep.bind(
      transparencia,
    ) as RequestHandler,
  ),
);

// ==========================================
// LEGACY PRICING
// ==========================================

if (legacyPricingStrategyEnabled) {
  router.post(
    '/pricing-strategy',
    fornecedor,
    handle(
      pricing.getPricingStrategy.bind(
        pricing,
      ) as RequestHandler,
    ),
  );
}

export default router;