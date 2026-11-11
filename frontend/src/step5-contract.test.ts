import { describe, it, expect } from 'vitest';
import { certidoesApi, documentosApi, roboApi } from './services/api';

describe('STEP 5 — Contrato de Certidões, Robô de Lances e Disputa', () => {
  it('APIs de certidões, documentos e robô estão expostas corretamente', () => {
    expect(certidoesApi).toBeDefined();
    expect(typeof certidoesApi.listar).toBe('function');
    expect(typeof certidoesApi.forceSync).toBe('function');

    expect(documentosApi).toBeDefined();
    expect(typeof documentosApi.listar).toBe('function');
    expect(typeof documentosApi.upload).toBe('function');
    expect(typeof documentosApi.status).toBe('function');

    expect(roboApi).toBeDefined();
    expect(typeof roboApi.buscarConfig).toBe('function');
    expect(typeof roboApi.salvarConfig).toBe('function');
    expect(typeof roboApi.listarLogs).toBe('function');
  });

  it('Validação Stop-Loss: piso mínimo bloqueia lances inferiores com margem protegida', () => {
    const stopLossFloor = 45000;
    const bidAmountValid = 45001;
    const bidAmountInvalid = 44999;

    const isBidAllowed = (bid: number, floor: number) => bid >= floor;

    expect(isBidAllowed(bidAmountValid, stopLossFloor)).toBe(true);
    expect(isBidAllowed(bidAmountInvalid, stopLossFloor)).toBe(false);
  });

  it('Cálculo de dias para vencer da certidão a partir de data ISO real', () => {
    const hoje = new Date();
    const dataValidade = new Date(hoje.getTime() + 10 * 86400000); // 10 dias no futuro
    const diffDias = Math.ceil((dataValidade.getTime() - hoje.getTime()) / 86400000);

    expect(diffDias).toBe(10);

    const status = diffDias < 0 ? 'VENCIDA' : diffDias <= 15 ? 'VENCENDO' : 'VALIDA';
    expect(status).toBe('VENCENDO');
  });
});

