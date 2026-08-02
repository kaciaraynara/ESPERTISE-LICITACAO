import {
  PLAN_DEFINITIONS,
  getMinimumPlanForFeature,
  getPlanDefinition,
  getPlanLimits,
  normalizePlanId,
  planHasFeature,
} from './plan.constants';

describe('plan.constants', () => {
  test('define valores oficiais dos planos da EXPERTISE', () => {
    expect(PLAN_DEFINITIONS.basic.valorMensalCentavos).toBe(6999);
    expect(PLAN_DEFINITIONS.pro.valorMensalCentavos).toBe(14999);
    expect(PLAN_DEFINITIONS.master.valorMensalCentavos).toBe(24999);
  });

  test('define limites principais por plano', () => {
    expect(getPlanLimits('basic')).toMatchObject({
      maxCompanies: 1,
      maxUsers: 2,
      maxMonitoredNotices: 10,
    });

    expect(getPlanLimits('pro')).toMatchObject({
      maxCompanies: 5,
      maxUsers: 5,
      maxMonitoredNotices: 50,
    });

    expect(getPlanLimits('master')).toMatchObject({
      maxCompanies: 10,
      maxUsers: 10,
      maxMonitoredNotices: 200,
    });
  });

  test('nao disponibiliza a fabrica de propostas no plano gratuito', () => {
    expect(planHasFeature('free', 'proposal.factory')).toBe(false);
  });

  test.each(['basic', 'pro', 'master'])(
    'disponibiliza a fabrica de propostas no plano %s',
    (plan) => {
      expect(planHasFeature(plan, 'proposal.factory')).toBe(true);
    },
  );

  test.each(['basic', 'pro', 'master'])(
    'preserva o radar inicial de nulidades no plano %s',
    (plan) => {
      expect(planHasFeature(plan, 'notices.error_radar')).toBe(true);
      expect(planHasFeature(plan, 'notices.legal_precheck')).toBe(true);
    },
  );

  test('libera investigacao concorrencial somente no Master', () => {
    expect(planHasFeature('basic', 'investigation.cartel_signals')).toBe(false);
    expect(planHasFeature('pro', 'investigation.cartel_signals')).toBe(false);
    expect(planHasFeature('master', 'investigation.cartel_signals')).toBe(true);
  });

  test('normaliza planos legados sem quebrar usuarios antigos', () => {
    expect(normalizePlanId('starter')).toBe('basic');
    expect(normalizePlanId('premium')).toBe('pro');
    expect(normalizePlanId('profissional')).toBe('pro');
    expect(normalizePlanId('enterprise')).toBe('master');
  });

  test('identifica plano minimo de uma funcionalidade', () => {
    expect(getMinimumPlanForFeature('proposal.factory')).toBe('basic');
    expect(getMinimumPlanForFeature('pricing.strategy')).toBe('pro');
    expect(getMinimumPlanForFeature('investigation.competitor_intelligence')).toBe('master');
  });

  test('retorna definicao normalizada do plano', () => {
    expect(getPlanDefinition('basico').id).toBe('basic');
    expect(getPlanDefinition('enterprise').id).toBe('master');
  });
});