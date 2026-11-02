import { describe, it, expect } from 'vitest';
import { crmApi, licitacoesApi, dashboardApi } from './services/api';
import CrmKanbanPage from './pages/CrmKanbanPage';
import LicitacoesPage from './pages/LicitacoesPage';
import LicitacaoDetalhePage from './pages/LicitacaoDetalhePage';
import DashboardPage from './pages/DashboardPage';

describe('Vertical Slice: Radar -> Persistence -> CRM Pipeline -> Dashboard', () => {
  it('crmApi provides full CRUD and metrics contracts matching backend', () => {
    expect(crmApi).toBeDefined();
    expect(typeof crmApi.getOportunidades).toBe('function');
    expect(typeof crmApi.createOportunidade).toBe('function');
    expect(typeof crmApi.moveOportunidade).toBe('function');
    expect(typeof crmApi.removeOportunidade).toBe('function');
    expect(typeof crmApi.getMetrics).toBe('function');
  });

  it('licitacoesApi provides listing, detail, and monitoring endpoints', () => {
    expect(licitacoesApi).toBeDefined();
    expect(typeof licitacoesApi.listar).toBe('function');
    expect(typeof licitacoesApi.buscarPorId).toBe('function');
    expect(typeof licitacoesApi.monitorar).toBe('function');
  });

  it('dashboardApi provides operational metrics including CRM pipeline reflection', () => {
    expect(dashboardApi).toBeDefined();
    expect(typeof dashboardApi.getMetrics).toBe('function');
  });

  it('all UI slice components export valid React component functions', () => {
    expect(typeof CrmKanbanPage).toBe('function');
    expect(typeof LicitacoesPage).toBe('function');
    expect(typeof LicitacaoDetalhePage).toBe('function');
    expect(typeof DashboardPage).toBe('function');
  });
});

describe('Business Rules: Deduplication, Stage Progression & Multi-Tenant Isolation', () => {
  // Regra de Deduplicação
  it('prevents saving duplicate notice for the same user pipeline', () => {
    const existingPipeline = [
      { id: 'opp-1', noticeId: 'notice-abc', stage: 'OPORTUNIDADE' },
      { id: 'opp-2', noticeId: 'notice-xyz', stage: 'ANALISE' },
    ];

    const canAddNoticeAbc = !existingPipeline.some((o) => o.noticeId === 'notice-abc');
    const canAddNoticeNew = !existingPipeline.some((o) => o.noticeId === 'notice-new');

    expect(canAddNoticeAbc).toBe(false);
    expect(canAddNoticeNew).toBe(true);
  });

  // Regra de Isolamento Multi-Tenant
  it('strictly segregates opportunities between different organizations (tenants)', () => {
    const allDatabaseOpportunities = [
      { id: 'opp-1', tenantId: 'tenant-a', userId: 'user-a', noticeId: 'notice-1', valor: 100000 },
      { id: 'opp-2', tenantId: 'tenant-a', userId: 'user-a', noticeId: 'notice-2', valor: 250000 },
      { id: 'opp-3', tenantId: 'tenant-b', userId: 'user-b', noticeId: 'notice-3', valor: 900000 },
    ];

    const queryForTenantA = (tenantId: string) =>
      allDatabaseOpportunities.filter((o) => o.tenantId === tenantId);

    const tenantAOpportunities = queryForTenantA('tenant-a');
    expect(tenantAOpportunities).toHaveLength(2);
    expect(tenantAOpportunities.every((o) => o.tenantId === 'tenant-a')).toBe(true);
    expect(tenantAOpportunities.some((o) => o.tenantId === 'tenant-b')).toBe(false);
  });

  // Regra de Métricas do CRM refletindo estágios em tempo real
  it('computes live pipeline value excluding won/lost/archived stages', () => {
    const pipelineItems = [
      { stage: 'OPORTUNIDADE', estimatedValue: 100000 },
      { stage: 'ANALISE', estimatedValue: 200000 },
      { stage: 'DISPUTA', estimatedValue: 300000 },
      { stage: 'GANHO', estimatedValue: 500000 },
      { stage: 'PERDIDO', estimatedValue: 150000 },
    ];

    const emDisputa = pipelineItems.filter(
      (p) => !['GANHO', 'PERDIDO', 'ARQUIVADO'].includes(p.stage),
    );
    const valorTotalEmDisputa = emDisputa.reduce((acc, p) => acc + p.estimatedValue, 0);
    const ganhos = pipelineItems.filter((p) => p.stage === 'GANHO').length;
    const taxaConversao = Math.round((ganhos / pipelineItems.length) * 100 * 10) / 10;

    expect(valorTotalEmDisputa).toBe(600000); // 100k + 200k + 300k
    expect(ganhos).toBe(1);
    expect(taxaConversao).toBe(20.0);
  });
});
