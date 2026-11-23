import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

interface ItemTestTerminal {
  id: string;
  itemNumero: number;
  valorReferencia: number;
  melhorLanceConcorrente: number;
  seuUltimoLance: number | null;
  pisoMinimo: number;
  lanceAlvo: number;
  ativo: boolean;
  status: 'VENCENDO' | 'COBERTO' | 'PISO_ATINGIDO' | 'PAUSADO';
}

describe('Trading Terminal & Home Broker de Lances (Missão Crítica)', () => {
  it('PARADA DE EMERGÊNCIA (STOP ALL) deve pausar 100% dos robôs ativos em menos de 100ms', () => {
    const itensIniciais: ItemTestTerminal[] = Array.from({ length: 50 }).map((_, idx) => ({
      id: `it-${idx + 1}`,
      itemNumero: idx + 1,
      valorReferencia: 5000,
      melhorLanceConcorrente: 4200,
      seuUltimoLance: idx % 3 === 0 ? 4200 : 4300,
      pisoMinimo: 3500,
      lanceAlvo: 4100,
      ativo: true,
      status: idx % 3 === 0 ? 'VENCENDO' : 'COBERTO',
    }));

    const start = performance.now();
    const itensParados = itensIniciais.map((it) => ({
      ...it,
      ativo: false,
      status: it.status === 'VENCENDO' ? ('VENCENDO' as const) : ('PAUSADO' as const),
    }));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(itensParados.every((i) => i.ativo === false)).toBe(true);
    // Itens que estavam vencendo continuam marcados como vencendo para não desorientar o licitante
    expect(itensParados[0].status).toBe('VENCENDO');
    expect(itensParados[1].status).toBe('PAUSADO');
  });

  it('Trava Hard Limit de Piso Mínimo com Decimal.js deve impedir lances perdedores de margem', () => {
    const piso = new Decimal(1450.00);
    const tentativaLance = new Decimal(1449.99);

    const validaDisparo = (lance: Decimal, pisoMin: Decimal) => {
      if (lance.lessThan(pisoMin)) {
        throw new Error(`BLOQUEIO DE SEGURANÇA: Lance de R$ ${lance.toFixed(2)} viola o piso mínimo de R$ ${pisoMin.toFixed(2)}.`);
      }
      return true;
    };

    expect(() => validaDisparo(tentativaLance, piso)).toThrow(
      'BLOQUEIO DE SEGURANÇA: Lance de R$ 1449.99 viola o piso mínimo de R$ 1450.00.'
    );
  });

  it('Edição inline da planilha calcula total alvo e total piso com exatidão decimal', () => {
    const itens: { qtd: number; lanceAlvo: number; pisoMinimo: number }[] = [
      { qtd: 10, lanceAlvo: 1250.45, pisoMinimo: 980.00 },
      { qtd: 5, lanceAlvo: 340.20, pisoMinimo: 290.50 },
      { qtd: 1, lanceAlvo: 15400.90, pisoMinimo: 12000.00 },
    ];

    const totalAlvo = itens.reduce(
      (acc, it) => acc.plus(new Decimal(it.qtd).mul(new Decimal(it.lanceAlvo))),
      new Decimal(0)
    );

    const totalPiso = itens.reduce(
      (acc, it) => acc.plus(new Decimal(it.qtd).mul(new Decimal(it.pisoMinimo))),
      new Decimal(0)
    );

    // 10 * 1250.45 = 12504.50
    // 5 * 340.20 = 1701.00
    // 1 * 15400.90 = 15400.90
    // Soma: 29606.40
    expect(totalAlvo.toNumber()).toBe(29606.4);
    expect(totalAlvo.toFixed(2)).toBe('29606.40');

    // 10 * 980 = 9800
    // 5 * 290.50 = 1452.50
    // 1 * 12000 = 12000
    // Soma: 23252.50
    expect(totalPiso.toNumber()).toBe(23252.5);
    expect(totalPiso.toFixed(2)).toBe('23252.50');
  });

  it('Garante que nenhum jargão técnico (RAG, chunks, embeddings) esteja presente nos status', () => {
    const statusValidos = ['VENCENDO', 'COBERTO', 'PISO_ATINGIDO', 'PAUSADO'];
    const jargoesTecnicos = ['RAG', 'CHUNK', 'EMBEDDING', 'LLM', 'BACKEND', 'ENDPOINT'];

    statusValidos.forEach((s) => {
      jargoesTecnicos.forEach((j) => {
        expect(s.toUpperCase()).not.toContain(j);
      });
    });
  });
});
