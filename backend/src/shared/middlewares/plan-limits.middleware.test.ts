import {
  requirePlanLimit,
  requirePlanFeatureAccess,
  requireMasterPlan,
  PLAN_LIMITS,
  normalizePlanType,
  incrementPlanUsage,
} from './plan-limits.middleware';
import { PLAN_FEATURES_CONFIG } from '../../config/plan-features';
import { PlanType } from '@prisma/client';
import { prisma } from '../../database/prisma';

jest.mock('../../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    company: {
      count: jest.fn(),
    },
    subscription: {
      updateMany: jest.fn(),
    },
  },
}));

describe('PlanLimitsMiddleware — Controle de Franquia Contratual (Básico, Médio e Master)', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { id: 'usr-123' },
    };
    mockRes = {
      statusCode: 200,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        return this;
      },
    };
    mockNext = jest.fn();
  });

  describe('Normalização e Matriz de Limites', () => {
    it('deve normalizar aliases legados para o Enum oficial PlanType', () => {
      expect(normalizePlanType('free')).toBe(PlanType.BASIC);
      expect(normalizePlanType('basico')).toBe(PlanType.BASIC);
      expect(normalizePlanType('pro')).toBe(PlanType.MEDIUM);
      expect(normalizePlanType('medio')).toBe(PlanType.MEDIUM);
      expect(normalizePlanType('enterprise')).toBe(PlanType.MASTER);
      expect(normalizePlanType('master')).toBe(PlanType.MASTER);
    });

    it('deve respeitar as diretrizes de limites contratuais e permissões crescentes de plan-features.ts', () => {
      expect(PLAN_LIMITS.BASIC.maxCnpjs).toBe(5);
      expect(PLAN_LIMITS.BASIC.maxMonthlyProposals).toBe(15);

      expect(PLAN_LIMITS.MEDIUM.maxCnpjs).toBe(10);
      expect(PLAN_LIMITS.MEDIUM.maxMonthlyProposals).toBe(50);

      expect(PLAN_LIMITS.MASTER.maxCnpjs).toBe(20);
      expect(PLAN_LIMITS.MASTER.maxMonthlyProposals).toBe(Infinity);
      expect(PLAN_FEATURES_CONFIG.BASICO.valorMensalCentavos).toBe(9999);
      expect(PLAN_FEATURES_CONFIG.AVANCADO.valorMensalCentavos).toBe(19999);
      expect(PLAN_FEATURES_CONFIG.MASTER.valorMensalCentavos).toBe(49999);
      expect(PLAN_FEATURES_CONFIG.BASICO.features).toContain('academia_licitante');
      expect(PLAN_FEATURES_CONFIG.BASICO.features).toContain('dispensa_eletronica');
      expect(PLAN_FEATURES_CONFIG.AVANCADO.features).toContain('historico_concorrentes');
      expect(PLAN_FEATURES_CONFIG.AVANCADO.features).toContain('robo_lances');
      expect(PLAN_FEATURES_CONFIG.AVANCADO.features).not.toContain('gestao_garantias');
      expect(PLAN_FEATURES_CONFIG.MASTER.features).toContain('gestao_garantias');
      expect(PLAN_FEATURES_CONFIG.AVANCADO.features).toContain('lex_ia_avancada');

      // Valida herança crescente (Básico ⊂ Avançado ⊂ Master)
      for (const feat of PLAN_FEATURES_CONFIG.BASICO.features) {
        expect(PLAN_FEATURES_CONFIG.AVANCADO.features).toContain(feat);
        expect(PLAN_FEATURES_CONFIG.MASTER.features).toContain(feat);
      }
      for (const feat of PLAN_FEATURES_CONFIG.AVANCADO.features) {
        expect(PLAN_FEATURES_CONFIG.MASTER.features).toContain(feat);
      }

      // Valida exclusivos do Master
      for (const exclusive of [
        'malha_fina_qsa',
        'gestao_garantias',
        'robo_reajuste',
        'assistente_repactuacao',
        'assistente_reequilibrio',
        'revisao_assistida_contratos',
      ] as const) {
        expect(PLAN_FEATURES_CONFIG.BASICO.features).not.toContain(exclusive);
        expect(PLAN_FEATURES_CONFIG.AVANCADO.features).not.toContain(exclusive);
        expect(PLAN_FEATURES_CONFIG.MASTER.features).toContain(exclusive);
      }
    });
  });

  describe('Plano Básico (BASIC)', () => {
    it('deve permitir análise quando dentro do limite de 50', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.BASIC,
        monthlyAnalysesUsed: 49,
        monthlyProposalsUsed: 5,
        cnpjsRegistered: 1,
        companies: [{ id: 'comp-1' }],
        subscriptions: [{ plano: 'basic', periodoFim: new Date(Date.now() + 86_400_000) }],
      });

      const middleware = requirePlanLimit('analyses');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(200);
    });

    it('deve barrar com HTTP 403 quando atingir 50 análises mensais', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.BASIC,
        monthlyAnalysesUsed: 50,
        monthlyProposalsUsed: 5,
        cnpjsRegistered: 1,
        companies: [{ id: 'comp-1' }],
        subscriptions: [{ plano: 'basic', periodoFim: new Date(Date.now() + 86_400_000) }],
      });

      const middleware = requirePlanLimit('analyses');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toBe('Limite do plano atingido. Faça upgrade para continuar.');
      expect(mockRes.body.code).toBe('PLAN_LIMIT_REACHED');
    });

    it('deve barrar com HTTP 403 quando atingir 15 propostas mensais', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.BASIC,
        monthlyAnalysesUsed: 10,
        monthlyProposalsUsed: 15,
        cnpjsRegistered: 1,
        companies: [{ id: 'comp-1' }],
        subscriptions: [{ plano: 'basic', periodoFim: new Date(Date.now() + 86_400_000) }],
      });

      const middleware = requirePlanLimit('proposals');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toBe('Limite do plano atingido. Faça upgrade para continuar.');
    });

    it('deve barrar com HTTP 403 quando atingir 5 empresas no tenant', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        tenantId: 'tenant-123',
        planType: PlanType.BASIC,
        monthlyAnalysesUsed: 10,
        monthlyProposalsUsed: 5,
        cnpjsRegistered: 0,
        companies: [],
        subscriptions: [{ plano: 'basic', periodoFim: new Date(Date.now() + 86_400_000) }],
      });
      (prisma.company.count as jest.Mock).mockResolvedValue(5);

      const middleware = requirePlanLimit('cnpjs');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toBe(
        'Você atingiu o limite de 5 empresas do seu plano. Faça upgrade para cadastrar novos CNPJs.',
      );
      expect(prisma.company.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
      });
    });

    it('permite a criação quando ainda há espaço abaixo do limite de 5 empresas', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        tenantId: 'tenant-123',
        planType: PlanType.BASIC,
        monthlyAnalysesUsed: 10,
        monthlyProposalsUsed: 5,
        subscriptions: [{ plano: 'basic', periodoFim: new Date(Date.now() + 86_400_000) }],
      });
      (prisma.company.count as jest.Mock).mockResolvedValue(4);

      await requirePlanLimit('cnpjs')(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.statusCode).toBe(200);
    });
  });

  describe('Plano Avançado (MEDIUM)', () => {
    it('deve permitir até 150 análises e barrar na 150ª+', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.MEDIUM,
        monthlyAnalysesUsed: 150,
        monthlyProposalsUsed: 20,
        cnpjsRegistered: 2,
        companies: [{ id: 'c1' }, { id: 'c2' }],
        subscriptions: [{ plano: 'pro', periodoFim: new Date(Date.now() + 86_400_000) }],
      });

      const middleware = requirePlanLimit('analyses');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toBe('Limite do plano atingido. Faça upgrade para continuar.');
    });

    it('deve permitir até 50 propostas e barrar na 50ª+', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.MEDIUM,
        monthlyAnalysesUsed: 80,
        monthlyProposalsUsed: 50,
        cnpjsRegistered: 2,
        companies: [],
        subscriptions: [{ plano: 'pro', periodoFim: new Date(Date.now() + 86_400_000) }],
      });

      const middleware = requirePlanLimit('proposals');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
    });

    it('deve barrar o cadastro ao atingir 10 empresas do plano Avançado', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        tenantId: 'tenant-123',
        planType: PlanType.MEDIUM,
        monthlyAnalysesUsed: 10,
        monthlyProposalsUsed: 5,
        cnpjsRegistered: 0,
        companies: [],
        subscriptions: [{ plano: 'pro', periodoFim: new Date(Date.now() + 86_400_000) }],
      });
      (prisma.company.count as jest.Mock).mockResolvedValue(10);

      const middleware = requirePlanLimit('cnpjs');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toBe(
        'Você atingiu o limite de 10 empresas do seu plano. Faça upgrade para cadastrar novos CNPJs.',
      );
    });
  });

  describe('Plano Master (MASTER)', () => {
    it('deve permitir consumo ilimitado de análises e propostas e até 20 CNPJs', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        tenantId: 'tenant-123',
        planType: PlanType.MASTER,
        monthlyAnalysesUsed: 9999,
        monthlyProposalsUsed: 9999,
        cnpjsRegistered: 9,
        companies: [],
        subscriptions: [{ plano: 'master', periodoFim: new Date(Date.now() + 86_400_000) }],
      });
      (prisma.company.count as jest.Mock).mockResolvedValue(19);

      const middlewareAnalyses = requirePlanLimit('analyses');
      await middlewareAnalyses(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const middlewareProposals = requirePlanLimit('proposals');
      await middlewareProposals(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      const middlewareCnpjs = requirePlanLimit('cnpjs');
      await middlewareCnpjs(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);

      expect(mockRes.statusCode).toBe(200);
    });
  });

  describe('incrementPlanUsage', () => {
    it('deve chamar prisma.user.update com increment correto', async () => {
      await incrementPlanUsage('usr-123', 'analyses', 1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: { monthlyAnalysesUsed: { increment: 1 } },
      });

      await incrementPlanUsage('usr-123', 'proposals', 1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: { monthlyProposalsUsed: { increment: 1 } },
      });

      await incrementPlanUsage('usr-123', 'cnpjs', 1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: { cnpjsRegistered: { increment: 1 } },
      });
    });
  });

  describe('requirePlanFeatureAccess — Bloqueio de Funcionalidades por Plano (ex: Malha Fina QSA)', () => {
    it('deve barrar com HTTP 403 um usuário do Plano Básico que tenta acessar malha_fina_qsa', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.BASIC,
        plano: 'basic',
        subscriptions: [],
      });

      const middleware = requirePlanFeatureAccess('malha_fina_qsa');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.code).toBe('FEATURE_NOT_IN_PLAN');
      expect(mockRes.body.message).toContain('upgrade');
    });

    it('deve permitir o acesso quando a assinatura ativa do usuário é Plano Master', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.MASTER,
        plano: 'master',
        subscriptions: [{ plano: 'master', status: 'active', periodoFim: new Date(Date.now() + 86_400_000) }],
      });

      const middleware = requireMasterPlan;
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.statusCode).toBe(200);
    });

    it('não concede ferramentas do Básico usando somente o plano legado do usuário', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr-123',
        planType: PlanType.BASIC,
        plano: 'basic',
        subscriptions: [],
      });

      const middleware = requirePlanFeatureAccess('radar_editais');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.details.currentPlan).toBe('free');
    });
  });
});
