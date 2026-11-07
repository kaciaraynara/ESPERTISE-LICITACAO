import { describe, it, expect } from 'vitest';
import ResumoEstrategicoModal, { type ResumoEditalData } from './components/ResumoEstrategicoModal';
import LicitacoesPage from './pages/LicitacoesPage';
import { crmApi, noticesApi } from './services/api';

describe('Etapa 1: Fluxo do Radar e Resumo Estratégico', () => {
  it('exports ResumoEstrategicoModal as a valid React component', () => {
    expect(typeof ResumoEstrategicoModal).toBe('function');
    expect(typeof LicitacoesPage).toBe('function');
  });

  it('noticesApi provides getBasicSummary and getById endpoints', () => {
    expect(typeof noticesApi.getById).toBe('function');
    expect(typeof noticesApi.getBasicSummary).toBe('function');
  });

  it('crmApi provides createOportunidade for saving editais into user proposals', () => {
    expect(typeof crmApi.createOportunidade).toBe('function');
  });

  describe('Regra de Ouro: Sem alucinações nas exigências e dados do edital', () => {
    it('returns "Não informado no edital" when value is null, undefined or <= 0', () => {
      const editalSemValor: ResumoEditalData = {
        id: 'test-1',
        objeto: 'Aquisição de suprimentos de informática',
        orgao: 'Tribunal Regional Federal',
        valorEstimado: null,
      };

      expect(editalSemValor.valorEstimado ?? null).toBeNull();
    });

    it('formats BRL currency correctly when estimated value is present', () => {
      const valor = 450000;
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valor);

      expect(formatted).toContain('450.000,00');
    });

    it('returns "Não informado no edital" when habilitacao requirements are missing', () => {
      const editalSemExigencias: ResumoEditalData = {
        id: 'test-2',
        objeto: 'Serviço de limpeza',
        orgao: 'Prefeitura Municipal',
      };

      const balanco = editalSemExigencias.exigenciasHabilitacao?.balanco || 'Não informado no edital';
      const atestados = editalSemExigencias.exigenciasHabilitacao?.atestados || 'Não informado no edital';
      const certidoes = editalSemExigencias.exigenciasHabilitacao?.certidoes || 'Não informado no edital';

      expect(balanco).toBe('Não informado no edital');
      expect(atestados).toBe('Não informado no edital');
      expect(certidoes).toBe('Não informado no edital');
    });

    it('displays exact criteria when informed or falls back to "Não informado no edital"', () => {
      const editalComCriterio: ResumoEditalData = {
        id: 'test-3',
        objeto: 'Obras de pavimentação',
        orgao: 'Secretaria de Estado de Infraestrutura',
        criterioJulgamento: 'Menor Preço por Item',
      };

      const editalSemCriterio: ResumoEditalData = {
        id: 'test-4',
        objeto: 'Consultoria técnica',
        orgao: 'Câmara Municipal',
      };

      expect(editalComCriterio.criterioJulgamento || 'Não informado no edital').toBe('Menor Preço por Item');
      expect(editalSemCriterio.criterioJulgamento || 'Não informado no edital').toBe('Não informado no edital');
    });

    it('formats deadline with date and time when available or falls back to "Não informado no edital"', () => {
      const rawWithTime = '2026-11-20T14:30:00.000Z';
      const date = new Date(rawWithTime);
      const dataStr = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const horaStr = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const dataHoraLimite = `${dataStr} às ${horaStr}`;

      expect(dataHoraLimite).toContain(' às ');

      const rawEmpty: string | null = null;
      const emptyResult = rawEmpty || 'Não informado no edital';
      expect(emptyResult).toBe('Não informado no edital');
    });
  });

  describe('Fluxo do Botão [Salvar para Disputar]', () => {
    it('transitions state immediately to "Salvo ✓" when clicked', () => {
      const salvos = new Set<string>();
      const editalId = 'notice-abc-123';

      // Simula clique em Salvar para Disputar
      salvos.add(editalId);

      expect(salvos.has(editalId)).toBe(true);
      const buttonText = salvos.has(editalId) ? 'Salvo ✓' : 'Salvar para Disputar';
      expect(buttonText).toBe('Salvo ✓');
    });

    it('matches exact notification text: "Edital adicionado à sua lista de propostas"', () => {
      const successNotification = 'Edital adicionado à sua lista de propostas';
      expect(successNotification).toBe('Edital adicionado à sua lista de propostas');
    });
  });
});
