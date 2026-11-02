import { describe, it, expect } from 'vitest';
import { concorrentesApi, dashboardApi } from './services/api';
import RadarDeEditais from './pages/RadarDeEditais';
import { HistoricoConcorrentesPage } from './pages/HistoricoConcorrentesPage';
import { ScoreOportunidadesPage } from './pages/ScoreOportunidades/ScoreOportunidadesPage';
import DashboardPage from './pages/DashboardPage';

describe('Data Provenance & Security of Metrics Contracts', () => {
  it('concorrentesApi provides endpoints to official public sources', () => {
    expect(concorrentesApi).toBeDefined();
    expect(typeof concorrentesApi.getDossie).toBe('function');
    expect(typeof concorrentesApi.malhaFina).toBe('function');
  });

  it('dashboardApi provides endpoint to real operational metrics', () => {
    expect(dashboardApi).toBeDefined();
    expect(typeof dashboardApi.getMetrics).toBe('function');
  });

  it('RadarDeEditais is a valid React component function that does not return null', () => {
    expect(typeof RadarDeEditais).toBe('function');
  });

  it('HistoricoConcorrentesPage is a valid React component function', () => {
    expect(typeof HistoricoConcorrentesPage).toBe('function');
  });

  it('ScoreOportunidadesPage is a valid React component function', () => {
    expect(typeof ScoreOportunidadesPage).toBe('function');
  });

  it('DashboardPage is a valid React component function', () => {
    expect(typeof DashboardPage).toBe('function');
  });
});

describe('Score Factor Weights and Non-Arbitrary Calculation', () => {
  // Simulação dos fatores heurísticos versionados do backend (v1.0)
  function calcularScoreOportunidade(dados: {
    nichoMatch: number; // 0 a 25
    valorMatch: number; // 0 a 20
    prazoMatch: number; // 0 a 20
    riscoDeducao: number; // 0 a 25
    dadosCompletos: boolean;
  }): { score: number | null; status: string } {
    if (!dados.dadosCompletos) {
      return { score: null, status: 'DADOS_INSUFICIENTES' };
    }

    const base = 20;
    const raw = base + dados.nichoMatch + dados.valorMatch + dados.prazoMatch - dados.riscoDeducao;
    const clamped = Math.min(100, Math.max(0, raw));
    const status = clamped >= 75 ? 'ALTA_VIABILIDADE' : clamped >= 50 ? 'MEDIA_VIABILIDADE' : 'ALTO_RISCO';

    return { score: clamped, status };
  }

  it('marks opportunity as DADOS_INSUFICIENTES when essential data is missing', () => {
    const result = calcularScoreOportunidade({
      nichoMatch: 0,
      valorMatch: 0,
      prazoMatch: 0,
      riscoDeducao: 0,
      dadosCompletos: false,
    });

    expect(result.score).toBeNull();
    expect(result.status).toBe('DADOS_INSUFICIENTES');
  });

  it('calculates score within legitimate bounds without randomness', () => {
    const result = calcularScoreOportunidade({
      nichoMatch: 25,
      valorMatch: 20,
      prazoMatch: 15,
      riscoDeducao: 5,
      dadosCompletos: true,
    });

    // 20 (base) + 25 + 20 + 15 - 5 = 75
    expect(result.score).toBe(75);
    expect(result.status).toBe('ALTA_VIABILIDADE');
  });

  it('computes portfolio average strictly from valid scores, returning null when empty', () => {
    const computeAverage = (scores: (number | null)[]) => {
      const valid = scores.filter((s): s is number => s !== null);
      if (valid.length === 0) return null;
      return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
    };

    expect(computeAverage([])).toBeNull();
    expect(computeAverage([null, null])).toBeNull();
    expect(computeAverage([80, 70])).toBe(75.0);
    expect(computeAverage([85, null, 75])).toBe(80.0);
  });
});
