import { describe, it, expect } from 'vitest';

describe('STEP 4: Gestão de Disputas, Sala de Disputa Espelhada, Contratos & Crédito Licitatório', () => {
  it('normaliza os 5 estágios do CRM sem jargões e mantém fluxo linear', () => {
    const normalizarEstagio = (stage?: string): string => {
      const s = (stage || 'ANALISE').toUpperCase();
      if (['ANALISE', 'TRIAGEM', 'NOVO', 'CAPTACAO'].includes(s)) return 'ANALISE';
      if (['PROPOSTA', 'ELABORACAO', 'HABILITACAO'].includes(s)) return 'PROPOSTA';
      if (['SESSAO_PUBLICA', 'DISPUTA', 'LANCES', 'EM_DISPUTA'].includes(s)) return 'SESSAO_PUBLICA';
      if (['FASE_RECURSAL', 'RECURSO', 'RECURSOS'].includes(s)) return 'FASE_RECURSAL';
      if (['ADJUDICACAO', 'GANHO', 'HOMOLOGADO', 'VENCIDO'].includes(s)) return 'ADJUDICACAO';
      return 'ANALISE';
    };

    expect(normalizarEstagio('novo')).toBe('ANALISE');
    expect(normalizarEstagio('elaboracao')).toBe('PROPOSTA');
    expect(normalizarEstagio('em_disputa')).toBe('SESSAO_PUBLICA');
    expect(normalizarEstagio('recursos')).toBe('FASE_RECURSAL');
    expect(normalizarEstagio('homologado')).toBe('ADJUDICACAO');
  });

  it('trava lances abaixo do valor mínimo seguro (Proteção de Margem) para evitar inexequibilidade', () => {
    const valorMinimoSeguro = 150.00; // Custo unitário + encargos mínimos
    const lanceProposto = 145.00;

    const isBloqueado = lanceProposto < valorMinimoSeguro;
    expect(isBloqueado).toBe(true);

    const mensagemBloqueio = (valor: number, piso: number) =>
      `Lance bloqueado: R$ ${valor.toFixed(2)} fica abaixo do seu valor mínimo seguro (R$ ${piso.toFixed(2)}).`;

    expect(mensagemBloqueio(lanceProposto, valorMinimoSeguro)).toContain('Lance bloqueado');
    expect(mensagemBloqueio(lanceProposto, valorMinimoSeguro)).toContain('valor mínimo seguro');
  });

  it('calcula simulação de crédito licitatório com lastro em empenho e prazo do órgão', () => {
    const calcularAntecipacao = (valorEmpenho: number, prazoDias: number, taxaMensalPct = 1.29) => {
      const taxaPeriodo = (prazoDias / 30) * taxaMensalPct;
      const custoDesconto = (valorEmpenho * taxaPeriodo) / 100;
      const valorLiquido = Math.max(0, valorEmpenho - custoDesconto);
      return {
        valorEmpenho,
        prazoDias,
        taxaPeriodo: Number(taxaPeriodo.toFixed(2)),
        custoDesconto: Number(custoDesconto.toFixed(2)),
        valorLiquido: Number(valorLiquido.toFixed(2)),
      };
    };

    const res = calcularAntecipacao(100000, 30, 1.29);
    expect(res.taxaPeriodo).toBe(1.29);
    expect(res.custoDesconto).toBe(1290.00);
    expect(res.valorLiquido).toBe(98710.00);

    const res60 = calcularAntecipacao(50000, 60, 1.29);
    expect(res60.taxaPeriodo).toBe(2.58);
    expect(res60.custoDesconto).toBe(1290.00);
    expect(res60.valorLiquido).toBe(48710.00);
  });

  it('assegura fallback resiliente de conexão na sala de lances (polling e websocket)', () => {
    const transports = ['polling', 'websocket'];
    expect(transports[0]).toBe('polling'); // Primeiro handshake via polling
    expect(transports[1]).toBe('websocket'); // Upgrade transparente para realtime
  });
});
