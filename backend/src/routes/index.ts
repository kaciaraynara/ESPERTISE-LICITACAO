import { Router, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AIController } from '../controllers/ai.controller';
import { AuditAdminController } from '../controllers/audit-admin.controller';
import { ConcorrentesController } from '../controllers/concorrentes.controller';
import { DataPlatformAdminController } from '../controllers/data-platform-admin.controller';
import { IntegracoesController } from '../controllers/integracoes.controller';
import { ImpugnacaoController } from '../controllers/impugnacao.controller';
import { LegalRulesAdminController } from '../controllers/legal-rules-admin.controller';
import { LicitacoesController } from '../controllers/licitacoes.controller';
import { NoticesController } from '../controllers/notices.controller';
import { NotificacoesController } from '../controllers/notificacoes.controller';
import { PropostasController } from '../controllers/propostas.controller';
import { RbacAdminController } from '../controllers/rbac-admin.controller';
import { MercadoPagoController } from '../controllers/mercadopago.controller';
import { TransparenciaController } from '../controllers/transparencia.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { PipelineController } from '../controllers/pipeline.controller';
import { PricingController } from '../controllers/pricing.controller';
import documentosRoutes from './documentos.routes';
import documentTemplatesRoutes from './document-templates.routes';
import lexRoutes from './lex.routes';
import roboRoutes from './robo.routes';
import marketplaceRoutes from './marketplace.routes';
import empresasRoutes from './empresas.routes';
import authRoutes from './auth.routes';
import { AuthRequest, authMiddleware } from '../shared/middlewares/auth.middleware';
import { PostgresRateLimitStore } from '../shared/middlewares/postgres-rate-limit.store';
import { requireAuditRead, requireDataPlatformAdmin, requireLegalAdmin, requireLegalPublish, requireLegalReview, requireRbacAdmin } from '../shared/middlewares/data-platform-admin.middleware';

import { lexAIRateLimit } from '../shared/middlewares/lex-ai-rate-limit.middleware';
import { requireRole } from '../shared/middlewares/role.middleware';
import { requirePlanFeature } from '../shared/middlewares/plan-feature.middleware';
import { transparenciaRateLimit } from '../shared/middlewares/transparencia-rate-limit.middleware';
import { getBooleanEnv, isProduction } from '../config/env';


const router = Router();

const ai = new AIController();
const auditAdmin = new AuditAdminController();
const concorrentes = new ConcorrentesController();
const dataPlatformAdmin = new DataPlatformAdminController();
const integracoes = new IntegracoesController();
const impugnacao = new ImpugnacaoController();
const legalRulesAdmin = new LegalRulesAdminController();
const licitacoes = new LicitacoesController();
const notices = new NoticesController();
const notificacoes = new NotificacoesController();
const propostas = new PropostasController();
const rbacAdmin = new RbacAdminController();
const mercadopago = new MercadoPagoController();
const transparencia = new TransparenciaController();
const dashboard = new DashboardController();
const pipeline = new PipelineController();
const pricing = new PricingController();
const lexEnabled = getBooleanEnv('ENABLE_LEX', false);
const bidRobotEnabled = getBooleanEnv('ENABLE_BID_ROBOT', false);
const crmEnabled = getBooleanEnv('ENABLE_CRM', false);
const legacyMarketplaceEnabled = !isProduction()
  && getBooleanEnv('ENABLE_LEGACY_MARKETPLACE', false);
const legacyPricingStrategyEnabled = !isProduction()
  && getBooleanEnv('ENABLE_LEGACY_PRICING_STRATEGY', false);

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use('/auth', authRoutes);
router.get('/public/cnpj/:cnpj', handle(integracoes.consultarCnpj.bind(integracoes) as RequestHandler));
router.post('/pagamentos/webhook', handle(mercadopago.webhook.bind(mercadopago) as RequestHandler));
router.get('/pagamentos/planos', handle(mercadopago.listPlanos.bind(mercadopago) as RequestHandler));

// As rotas abaixo exigem uma sessão autenticada.
router.use(authMiddleware as RequestHandler);
router.use(rateLimit({
  windowMs: Number(process.env.USER_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.USER_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore('api-user'),
  passOnStoreError: false,
  keyGenerator: (req) => `user:${(req as AuthRequest).user!.id}`,
  message: {
    success: false,
    code: 'USER_RATE_LIMIT_EXCEEDED',
    message: 'Limite de requisições da conta excedido. Tente novamente mais tarde.',
  },
}));
const fornecedor = requireRole('fornecedor') as RequestHandler;
const advogado = requireRole('advogado') as RequestHandler;
const contador = requireRole('contador') as RequestHandler;
const fornecedorOuContador = requireRole('fornecedor', 'contador') as RequestHandler;
const fornecedorOuAdvogado = requireRole('fornecedor', 'advogado') as RequestHandler;
const auditReadOnly = requireAuditRead as RequestHandler;
const dataPlatformAdminOnly = requireDataPlatformAdmin as RequestHandler;
const legalAdminOnly = requireLegalAdmin as RequestHandler;
const legalReviewOnly = requireLegalReview as RequestHandler;
const legalPublishOnly = requireLegalPublish as RequestHandler;
const rbacAdminOnly = requireRbacAdmin as RequestHandler;

router.get('/dashboard/metrics', fornecedor, handle(dashboard.getMetrics.bind(dashboard) as RequestHandler));

if (lexEnabled) {
  router.post('/ai/consultar', lexAIRateLimit, handle(ai.consultar.bind(ai) as RequestHandler));
}


router.get('/admin/audit/events', auditReadOnly, handle(auditAdmin.listEvents.bind(auditAdmin) as RequestHandler));
router.get('/admin/audit/metrics', auditReadOnly, handle(auditAdmin.metrics.bind(auditAdmin) as RequestHandler));

router.get('/admin/data-platform/jobs', dataPlatformAdminOnly, handle(dataPlatformAdmin.listJobs.bind(dataPlatformAdmin) as RequestHandler));
router.get('/admin/data-platform/events', dataPlatformAdminOnly, handle(dataPlatformAdmin.listEvents.bind(dataPlatformAdmin) as RequestHandler));
router.get('/admin/data-platform/tasks', dataPlatformAdminOnly, handle(dataPlatformAdmin.listTasks.bind(dataPlatformAdmin) as RequestHandler));
router.get('/admin/data-platform/cursors', dataPlatformAdminOnly, handle(dataPlatformAdmin.listCursors.bind(dataPlatformAdmin) as RequestHandler));
router.get('/admin/data-platform/metrics', dataPlatformAdminOnly, handle(dataPlatformAdmin.metrics.bind(dataPlatformAdmin) as RequestHandler));
router.post('/admin/data-platform/ingest/pncp', dataPlatformAdminOnly, handle(dataPlatformAdmin.runPncpIngestion.bind(dataPlatformAdmin) as RequestHandler));
router.post('/admin/data-platform/ingest/comprasgov', dataPlatformAdminOnly, handle(dataPlatformAdmin.runComprasGovIngestion.bind(dataPlatformAdmin) as RequestHandler));
router.post('/admin/data-platform/index/consume', dataPlatformAdminOnly, handle(dataPlatformAdmin.consumeIndexTasks.bind(dataPlatformAdmin) as RequestHandler));
router.post('/admin/data-platform/requeue/skipped', dataPlatformAdminOnly, handle(dataPlatformAdmin.requeueSkipped.bind(dataPlatformAdmin) as RequestHandler));
router.post('/admin/data-platform/requeue/failed', dataPlatformAdminOnly, handle(dataPlatformAdmin.requeueFailed.bind(dataPlatformAdmin) as RequestHandler));
router.post('/admin/data-platform/tasks/cleanup', dataPlatformAdminOnly, handle(dataPlatformAdmin.cleanupOldTasks.bind(dataPlatformAdmin) as RequestHandler));

router.get('/admin/rbac/roles', rbacAdminOnly, handle(rbacAdmin.listRoles.bind(rbacAdmin) as RequestHandler));
router.post('/admin/rbac/roles', rbacAdminOnly, handle(rbacAdmin.createRole.bind(rbacAdmin) as RequestHandler));
router.get('/admin/rbac/permissions', rbacAdminOnly, handle(rbacAdmin.listPermissions.bind(rbacAdmin) as RequestHandler));
router.get('/admin/rbac/users/:userId/permissions', rbacAdminOnly, handle(rbacAdmin.listUserPermissions.bind(rbacAdmin) as RequestHandler));
router.post('/admin/rbac/user-roles', rbacAdminOnly, handle(rbacAdmin.assignRole.bind(rbacAdmin) as RequestHandler));
router.delete('/admin/rbac/user-roles', rbacAdminOnly, handle(rbacAdmin.revokeRole.bind(rbacAdmin) as RequestHandler));
router.post('/admin/rbac/user-roles/revoke', rbacAdminOnly, handle(rbacAdmin.revokeRole.bind(rbacAdmin) as RequestHandler));

router.get('/admin/legal-rules', legalAdminOnly, handle(legalRulesAdmin.listRules.bind(legalRulesAdmin) as RequestHandler));
router.get('/admin/legal-rules/:id', legalAdminOnly, handle(legalRulesAdmin.getRule.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules', legalAdminOnly, handle(legalRulesAdmin.createRule.bind(legalRulesAdmin) as RequestHandler));
router.patch('/admin/legal-rules/:id', legalAdminOnly, handle(legalRulesAdmin.updateRule.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/submit-review', legalAdminOnly, handle(legalRulesAdmin.submitReview.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/approve', legalReviewOnly, handle(legalRulesAdmin.approveRule.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/reject', legalReviewOnly, handle(legalRulesAdmin.rejectRule.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/activate-approved', legalPublishOnly, handle(legalRulesAdmin.activateApproved.bind(legalRulesAdmin) as RequestHandler));
router.get('/admin/legal-rules/:id/history', legalAdminOnly, handle(legalRulesAdmin.history.bind(legalRulesAdmin) as RequestHandler));
router.get('/admin/legal-rules/:id/diff/:compareId', legalAdminOnly, handle(legalRulesAdmin.diff.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/activate', legalPublishOnly, handle(legalRulesAdmin.activateRule.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/deactivate', legalAdminOnly, handle(legalRulesAdmin.deactivateRule.bind(legalRulesAdmin) as RequestHandler));
router.post('/admin/legal-rules/:id/new-version', legalAdminOnly, handle(legalRulesAdmin.createNewVersion.bind(legalRulesAdmin) as RequestHandler));

router.get('/notices/search', handle(notices.search.bind(notices) as RequestHandler));
router.get('/notices/:id/chunks', handle(notices.chunks.bind(notices) as RequestHandler));
router.get('/notices/:id/basic-summary', requirePlanFeature('notices.basic_summary'), handle(notices.basicSummary.bind(notices) as RequestHandler));
router.get('/notices/:id/summary', requirePlanFeature('notices.full_summary'), handle(notices.summary.bind(notices) as RequestHandler));
router.get('/notices/:id/legal-precheck', requirePlanFeature('notices.legal_precheck'), handle(notices.legalPrecheckReport.bind(notices) as RequestHandler));
router.get('/notices/:id/error-radar', requirePlanFeature('notices.error_radar'), handle(notices.errorRadarReport.bind(notices) as RequestHandler));
router.get('/notices/:id/opportunity-score', requirePlanFeature('notices.opportunity_score'), handle(notices.opportunityScoreReport.bind(notices) as RequestHandler));
router.get('/notices/:id/proposal-strategy', requirePlanFeature('proposal.strategy'), handle(notices.proposalStrategyReport.bind(notices) as RequestHandler));
router.get('/notices/:id/pricing-strategy', requirePlanFeature('pricing.strategy'), handle(notices.pricingStrategyReport.bind(notices) as RequestHandler));
router.get('/notices/:id', handle(notices.getById.bind(notices) as RequestHandler));

router.get('/licitacoes', fornecedor, handle(licitacoes.listar as RequestHandler));
router.get('/licitacoes/:id', fornecedor, handle(licitacoes.buscarPorId as RequestHandler));
router.post('/licitacoes/monitor', fornecedor, handle(licitacoes.monitorar as RequestHandler));

router.use('/documentos', documentosRoutes);
router.use('/templates', documentTemplatesRoutes);

router.post('/integracoes/sincronizar/pncp', fornecedor, handle(integracoes.sincronizarPncp.bind(integracoes) as RequestHandler));

router.use('/empresas', empresasRoutes);

router.post(
  '/propostas',
  fornecedor,
  requirePlanFeature('proposal.factory'),
  handle(propostas.criarRascunho.bind(propostas) as RequestHandler),
);

if (lexEnabled) {
  router.use('/lex', lexRoutes);
}

router.post('/impugnacoes/prazo', fornecedorOuAdvogado, requirePlanFeature('impugnation.simple'), handle(impugnacao.calcularPrazo.bind(impugnacao) as RequestHandler));
router.post('/impugnacoes/peca', fornecedorOuAdvogado, requirePlanFeature('impugnation.simple'), handle(impugnacao.gerarPeca.bind(impugnacao) as RequestHandler));
router.post('/concorrentes/malha-fina', fornecedorOuAdvogado, requirePlanFeature('investigation.cartel_signals'), handle(concorrentes.malhaFina.bind(concorrentes) as RequestHandler));
router.get('/concorrentes/:cnpj/dossie', fornecedorOuAdvogado, requirePlanFeature('investigation.competitor_intelligence'), handle(concorrentes.dossie.bind(concorrentes) as RequestHandler));


if (bidRobotEnabled) {
  router.use('/robo', roboRoutes);
}

if (legacyMarketplaceEnabled) {
  router.use('/marketplace', marketplaceRoutes);
}

router.get('/notificacoes', handle(notificacoes.listar.bind(notificacoes) as RequestHandler));
router.post('/notificacoes/marcar-todas-lidas', handle(notificacoes.marcarTodasComoLidas.bind(notificacoes) as RequestHandler));

router.post('/pagamentos/checkout', handle(mercadopago.criarCheckout.bind(mercadopago) as RequestHandler));
router.post('/pagamentos/checkout-auth', handle(mercadopago.criarCheckoutAutenticado.bind(mercadopago) as RequestHandler));
router.get('/pagamentos/assinatura', fornecedor, handle(mercadopago.minhaAssinatura.bind(mercadopago) as RequestHandler));

// Portal da Transparência
router.get('/transparencia/health', handle(transparencia.health.bind(transparencia) as RequestHandler));
router.get('/transparencia/metrics', handle(transparencia.metrics.bind(transparencia) as RequestHandler));
router.post('/transparencia/cache/clean', dataPlatformAdminOnly, handle(transparencia.cleanCache.bind(transparencia) as RequestHandler));
router.get('/transparencia/empresa/:cnpj', transparenciaRateLimit, fornecedor, handle(transparencia.consultarEmpresa.bind(transparencia) as RequestHandler));
router.get('/transparencia/penalidades', transparenciaRateLimit, fornecedor, handle(transparencia.consultarPenalidades.bind(transparencia) as RequestHandler));
router.get('/transparencia/licitacoes', transparenciaRateLimit, fornecedor, handle(transparencia.consultarLicitacoes.bind(transparencia) as RequestHandler));
router.get('/transparencia/contratos', transparenciaRateLimit, fornecedor, handle(transparencia.consultarContratos.bind(transparencia) as RequestHandler));
router.get('/transparencia/cepim/:cnpj', transparenciaRateLimit, fornecedor, handle(transparencia.consultarCepim.bind(transparencia) as RequestHandler));
router.get('/transparencia/cnep/:cnpj', transparenciaRateLimit, fornecedor, handle(transparencia.consultarCnep.bind(transparencia) as RequestHandler));

if (crmEnabled) {
  router.post('/pipeline', fornecedor, handle(pipeline.addToPipeline.bind(pipeline) as RequestHandler));
  router.get('/pipeline', fornecedor, handle(pipeline.listStages.bind(pipeline) as RequestHandler));
  router.patch('/pipeline/:id', fornecedor, handle(pipeline.moveOpportunity.bind(pipeline) as RequestHandler));
  router.delete('/pipeline/:id', fornecedor, handle(pipeline.removeFromPipeline.bind(pipeline) as RequestHandler));
}

if (legacyPricingStrategyEnabled) {
  router.post(
    '/pricing-strategy',
    fornecedor,
    handle(pricing.getPricingStrategy.bind(pricing) as RequestHandler),
  );
}

export default router;
