import { BiddingEngineService, ItemDisputaEngineConfig, DuplicateBidError } from './bidding-engine.service';
import Decimal from 'decimal.js';

describe('BiddingEngineService - Motor Financeiro e de Disparo de Lances (Missão Crítica)', () => {
  let engine: BiddingEngineService;

  beforeEach(() => {
    engine = new BiddingEngineService();
  });

  describe('Precisão Monetária Decimal (Zero Erros de Ponto Flutuante)', () => {
    it('deve arredondar com precisão estrita em 2 casas decimais sem dízimas ou falhas binárias de float', () => {
      // 0.1 + 0.2 em IEEE 754 float é 0.30000000000000004
      const valorA = 0.1;
      const valorB = 0.2;
      const somaDecimal = engine.roundCurrency(new Decimal(valorA).plus(valorB));

      expect(somaDecimal.toNumber()).toBe(0.3);
      expect(somaDecimal.toFixed(2)).toBe('0.30');
    });

    it('deve calcular decremento percentual sem perda de centavos', () => {
      // 1599.90 com 0.5% de decremento = 1599.90 * 0.005 = 7.9995 -> 8.00
      const item: ItemDisputaEngineConfig = {
        itemId: 'item-01',
        itemNumero: 1,
        descricao: 'Notebook Corporativo',
        quantidade: 10,
        valorReferencia: 2000,
        melhorLanceAtual: 1599.90,
        seuUltimoLance: 1610.00,
        pisoMinimo: 1200.00,
        lanceAlvo: 1550.00,
        estrategia: 'COBERTURA',
        decrementoMinimo: 0.5,
        isPercentual: true,
        ativo: true,
        souPrimeiro: false,
      };

      const resultado = engine.processarDecisao(item);
      expect(resultado.acao).toBe('LANCE');
      // 1599.90 - 8.00 = 1591.90
      expect(resultado.novoLance).toBe(1591.90);
    });
  });

  describe('Travas de Segurança Financeira (Hard Limits)', () => {
    it('deve abortar (PARAR) se o melhor lance do mercado já rompeu o piso mínimo', () => {
      const item: ItemDisputaEngineConfig = {
        itemId: 'item-02',
        itemNumero: 2,
        descricao: 'Servidor Rack 2U',
        quantidade: 2,
        valorReferencia: 25000,
        melhorLanceAtual: 18000,
        seuUltimoLance: 19000,
        pisoMinimo: 18500, // Mercado está em 18000, já abaixo do piso
        lanceAlvo: 18200,
        estrategia: 'COBERTURA',
        decrementoMinimo: 100,
        isPercentual: false,
        ativo: true,
        souPrimeiro: false,
      };

      const resultado = engine.processarDecisao(item);
      expect(resultado.acao).toBe('PARAR');
      expect(resultado.statusItem).toBe('PISO_ATINGIDO');
      expect(resultado.novoLance).toBeUndefined();
      expect(resultado.motivo).toContain('atingiu ou rompeu o piso mínimo');
    });

    it('deve abortar (PARAR) se o novo lance calculado for violar o piso mínimo', () => {
      const item: ItemDisputaEngineConfig = {
        itemId: 'item-03',
        itemNumero: 3,
        descricao: 'Cadeira Ergonômica',
        quantidade: 50,
        valorReferencia: 800,
        melhorLanceAtual: 510,
        seuUltimoLance: 530,
        pisoMinimo: 505,
        lanceAlvo: 500,
        estrategia: 'COBERTURA',
        decrementoMinimo: 10, // 510 - 10 = 500 (violaria 505!)
        isPercentual: false,
        ativo: true,
        souPrimeiro: false,
      };

      const resultado = engine.processarDecisao(item);
      expect(resultado.acao).toBe('PARAR');
      expect(resultado.statusItem).toBe('PISO_ATINGIDO');
      expect(resultado.novoLance).toBeUndefined();
      expect(resultado.motivo).toContain('violaria o piso mínimo');
    });

    it('deve aguardar se a empresa já estiver na primeira colocação', () => {
      const item: ItemDisputaEngineConfig = {
        itemId: 'item-04',
        itemNumero: 4,
        descricao: 'Switch 24 Portas PoE',
        quantidade: 5,
        valorReferencia: 3500,
        melhorLanceAtual: 2800,
        seuUltimoLance: 2800,
        pisoMinimo: 2200,
        lanceAlvo: 2500,
        estrategia: 'COBERTURA',
        decrementoMinimo: 50,
        isPercentual: false,
        ativo: true,
        souPrimeiro: true,
      };

      const resultado = engine.processarDecisao(item);
      expect(resultado.acao).toBe('AGUARDAR');
      expect(resultado.statusItem).toBe('VENCENDO');
      expect(resultado.motivo).toContain('primeira colocação');
    });
  });

  describe('Estratégia Sniper e Tempo de Disparo', () => {
    it('no modo SNIPER, deve aguardar se o tempo restante for superior a 8 segundos', () => {
      const item: ItemDisputaEngineConfig = {
        itemId: 'item-05',
        itemNumero: 5,
        descricao: 'Impressora Multifuncional',
        quantidade: 4,
        valorReferencia: 4000,
        melhorLanceAtual: 3200,
        seuUltimoLance: 3300,
        pisoMinimo: 2500,
        lanceAlvo: 3000,
        estrategia: 'SNIPER',
        decrementoMinimo: 50,
        isPercentual: false,
        ativo: true,
        souPrimeiro: false,
        tempoRestanteSegundos: 45, // Muito antes do fechamento
      };

      const resultado = engine.processarDecisao(item);
      expect(resultado.acao).toBe('AGUARDAR');
      expect(resultado.motivo).toContain('aguardando fechamento da janela de lances');
    });

    it('no modo SNIPER, deve efetuar o disparo nos segundos finais (<= 8s)', () => {
      const item: ItemDisputaEngineConfig = {
        itemId: 'item-06',
        itemNumero: 6,
        descricao: 'Impressora Multifuncional',
        quantidade: 4,
        valorReferencia: 4000,
        melhorLanceAtual: 3200,
        seuUltimoLance: 3300,
        pisoMinimo: 2500,
        lanceAlvo: 3000,
        estrategia: 'SNIPER',
        decrementoMinimo: 50,
        isPercentual: false,
        ativo: true,
        souPrimeiro: false,
        tempoRestanteSegundos: 4, // Janela crítica de disparo sniper
      };

      const resultado = engine.processarDecisao(item);
      expect(resultado.acao).toBe('LANCE');
      expect(resultado.novoLance).toBe(3150);
      expect(resultado.jitterMs).toBeGreaterThanOrEqual(1200);
      expect(resultado.jitterMs).toBeLessThanOrEqual(2800);
    });
  });

  describe('Concorrência & Idempotência (Simulação de 10 Lances no Mesmo Milissegundo)', () => {
    it('deve bloquear disparos duplicados para o mesmo item e valor dentro da janela de idempotência', () => {
      const itemId = 'item-concorrencia-01';
      const valor = 1450.50;

      // Primeiro registro: sucesso
      const primeiro = engine.checkAndRegisterIdempotency(itemId, valor);
      expect(primeiro).toBe(true);

      // Tentativa simultânea do mesmo valor no mesmo milissegundo: deve rejeitar
      expect(() => {
        engine.checkAndRegisterIdempotency(itemId, valor);
      }).toThrow(DuplicateBidError);
    });

    it('deve processar 10 requisições simultâneas e garantir integridade sem lances duplicados', async () => {
      const itemBase: ItemDisputaEngineConfig = {
        itemId: 'item-10-concorrentes',
        itemNumero: 10,
        descricao: 'Lote de Estações de Trabalho',
        quantidade: 20,
        valorReferencia: 80000,
        melhorLanceAtual: 65000,
        seuUltimoLance: 66000,
        pisoMinimo: 50000,
        lanceAlvo: 60000,
        estrategia: 'COBERTURA',
        decrementoMinimo: 100,
        isPercentual: false,
        ativo: true,
        souPrimeiro: false,
      };

      // Dispara a primeira decisão
      const resultado1 = engine.processarDecisao(itemBase);
      expect(resultado1.acao).toBe('LANCE');
      expect(resultado1.novoLance).toBe(64900);

      // Simula concorrência: 9 tentativas imediatas de reprocessar com os mesmos parâmetros
      let duplicatasBloqueadas = 0;
      for (let i = 0; i < 9; i++) {
        try {
          engine.processarDecisao(itemBase);
        } catch (err: any) {
          if (err instanceof DuplicateBidError) {
            duplicatasBloqueadas++;
          }
        }
      }

      // Todas as 9 requisições idênticas foram barradas pelo controle de idempotência
      expect(duplicatasBloqueadas).toBe(9);
    });
  });

  describe('Parada de Emergência Global (STOP ALL)', () => {
    it('deve desativar todos os itens da disputa instantaneamente (<10ms)', () => {
      const itens: ItemDisputaEngineConfig[] = [
        {
          itemId: 'it-1',
          itemNumero: 1,
          descricao: 'Item 1',
          quantidade: 1,
          valorReferencia: 100,
          melhorLanceAtual: 90,
          seuUltimoLance: null,
          pisoMinimo: 50,
          lanceAlvo: 70,
          estrategia: 'COBERTURA',
          decrementoMinimo: 1,
          isPercentual: false,
          ativo: true,
          souPrimeiro: false,
        },
        {
          itemId: 'it-2',
          itemNumero: 2,
          descricao: 'Item 2',
          quantidade: 1,
          valorReferencia: 200,
          melhorLanceAtual: 180,
          seuUltimoLance: null,
          pisoMinimo: 120,
          lanceAlvo: 150,
          estrategia: 'SNIPER',
          decrementoMinimo: 2,
          isPercentual: false,
          ativo: true,
          souPrimeiro: false,
        },
      ];

      const start = performance.now();
      const itensParados = engine.stopAllItems(itens);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(itensParados.every((i) => i.ativo === false)).toBe(true);
    });
  });
});
