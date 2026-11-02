import { RoboService, RoboSocketService } from './robo.service';
import { Socket } from 'socket.io';

describe('RoboService - Central de Estratégia e Decisões Táticas', () => {
  let service: RoboService;

  beforeEach(() => {
    service = new RoboService();
  });

  describe('calcularDecisao', () => {
    it('deve interromper operação (PARAR) se novo lance violar o piso de segurança (stop loss)', () => {
      const resultado = service.calcularDecisao({
        precoAtual: 1000,
        precoLimite: 990,
        estrategia: 'CONSERVADOR',
        decrementoMinimo: 15,
        souPrimeiro: false,
      });

      expect(resultado.acao).toBe('PARAR');
      expect(resultado.novoLance).toBeUndefined();
      expect(resultado.motivo).toContain('Margem minima atingida');
    });

    it('deve aguardar (AGUARDAR) se a empresa já estiver na primeira colocação', () => {
      const resultado = service.calcularDecisao({
        precoAtual: 1200,
        precoLimite: 800,
        estrategia: 'AGRESSIVO',
        decrementoMinimo: 20,
        souPrimeiro: true,
      });

      expect(resultado.acao).toBe('AGUARDAR');
      expect(resultado.novoLance).toBeUndefined();
      expect(resultado.motivo).toContain('Primeira colocacao mantida');
    });

    it('no modo SNIPER, deve aguardar se tempo restante for maior que 8 segundos', () => {
      const resultado = service.calcularDecisao({
        precoAtual: 1500,
        precoLimite: 1000,
        estrategia: 'SNIPER',
        decrementoMinimo: 25,
        tempoRestante: 20,
        souPrimeiro: false,
      });

      expect(resultado.acao).toBe('AGUARDAR');
      expect(resultado.novoLance).toBeUndefined();
      expect(resultado.motivo).toContain('Modo sniper aguardando janela final');
    });

    it('no modo SNIPER, deve propor lance se tempo restante for menor ou igual a 8 segundos', () => {
      const resultado = service.calcularDecisao({
        precoAtual: 1500,
        precoLimite: 1000,
        estrategia: 'SNIPER',
        decrementoMinimo: 25,
        tempoRestante: 5,
        souPrimeiro: false,
        scoreAderencia: 70,
      });

      expect(resultado.acao).toBe('LANCE');
      expect(resultado.novoLance).toBeDefined();
      expect(resultado.novoLance).toBe(1475);
      expect(resultado.motivo).toContain('Lance sniper disparado');
    });

    it('no modo AGRESSIVO, deve aplicar decremento proporcional mais forte sem violar o piso', () => {
      const resultado = service.calcularDecisao({
        precoAtual: 2000,
        precoLimite: 1500,
        estrategia: 'AGRESSIVO',
        decrementoMinimo: 100,
        souPrimeiro: false,
        scoreAderencia: 70,
      });

      expect(resultado.acao).toBe('LANCE');
      expect(resultado.novoLance).toBeDefined();
      // Decremento base: 100, agressivo: 100 * 1.35 = 135 -> novo lance: 1865
      expect(resultado.novoLance).toBe(1865);
      expect(resultado.motivo).toContain('Lance agressivo enviado');
    });

    it('deve ser 100% determinístico sem qualquer uso de aleatoriedade (zero Math.random)', () => {
      const execucoes = Array.from({ length: 50 }).map(() =>
        service.calcularDecisao({
          precoAtual: 5000,
          precoLimite: 3000,
          estrategia: 'CONSERVADOR',
          decrementoMinimo: 50,
          souPrimeiro: false,
          scoreAderencia: 75,
        })
      );

      const primeiroValor = execucoes[0].novoLance;
      const primeiroMotivo = execucoes[0].motivo;

      expect(primeiroValor).toBe(4950);
      for (const exec of execucoes) {
        expect(exec.novoLance).toBe(primeiroValor);
        expect(exec.motivo).toBe(primeiroMotivo);
        expect(exec.acao).toBe('LANCE');
      }
    });
  });
});

describe('RoboSocketService - Validação de Margem e Sugestões Táticas em Tempo Real', () => {
  let mockSocket: Partial<Socket>;
  let emittedEvents: Array<{ event: string; data: any }>;
  let socketService: RoboSocketService;

  beforeEach(() => {
    emittedEvents = [];
    mockSocket = {
      emit: jest.fn((event: string, data: any) => {
        emittedEvents.push({ event, data });
        return true;
      }) as any,
    };
    socketService = new RoboSocketService(mockSocket as Socket);
  });

  it('deve bloquear lance manual abaixo do limite mínimo e emitir log de alerta', () => {
    socketService.iniciar({
      pregaoId: 'pregao-101',
      valorInicial: 50000,
      lanceMinimoPermitido: 42000,
      estrategia: 'sniper',
    });

    socketService.processarLanceManual({ valor: 41999 });

    const lancesValidados = emittedEvents.filter((e) => e.event === 'lance_validado');
    expect(lancesValidados.length).toBe(0);

    const alertLogs = emittedEvents.filter(
      (e) => e.event === 'robo_log' && e.data.type === 'alert'
    );
    expect(alertLogs.some((l) => l.data.text.includes('viola o piso estipulado'))).toBe(true);
  });

  it('deve validar lance manual dentro da margem segura e instruir registro no portal oficial', () => {
    socketService.iniciar({
      pregaoId: 'pregao-102',
      valorInicial: 50000,
      lanceMinimoPermitido: 42000,
      estrategia: 'conservador',
    });

    socketService.processarLanceManual({ valor: 45000 });

    const lancesValidados = emittedEvents.filter((e) => e.event === 'lance_validado');
    expect(lancesValidados.length).toBe(1);
    expect(lancesValidados[0].data.valor).toBe(45000);

    const actionLogs = emittedEvents.filter(
      (e) => e.event === 'robo_log' && e.data.type === 'action'
    );
    expect(actionLogs.some((l) => l.data.text.includes('portal oficial da disputa'))).toBe(true);
  });

  it('deve pausar e emitir margem_atingida se lance concorrente informado atingir o limite mínimo', () => {
    socketService.iniciar({
      pregaoId: 'pregao-103',
      valorInicial: 10000,
      lanceMinimoPermitido: 8500,
      estrategia: 'sniper',
    });

    socketService.processarNovoLanceOponente(8500, 10);

    const margemEventos = emittedEvents.filter((e) => e.event === 'margem_atingida');
    expect(margemEventos.length).toBe(1);
    expect(margemEventos[0].data.valorMercado).toBe(8500);

    const statusPausado = emittedEvents.filter(
      (e) => e.event === 'robo_status' && e.data.ativo === false
    );
    expect(statusPausado.length).toBe(1);
  });

  it('deve emitir sugestao_lance determinística e orientar submissão manual no portal oficial', () => {
    socketService.iniciar({
      pregaoId: 'pregao-104',
      valorInicial: 10000,
      lanceMinimoPermitido: 8000,
      estrategia: 'sniper',
    });

    socketService.processarNovoLanceOponente(9500, 15);

    const sugestoes = emittedEvents.filter((e) => e.event === 'sugestao_lance');
    expect(sugestoes.length).toBe(1);
    // Sniper decrementa 5 no WebSocket service: 9500 - 5 = 9495
    expect(sugestoes[0].data.valor).toBe(9495);

    const systemLogs = emittedEvents.filter(
      (e) => e.event === 'robo_log' && e.data.type === 'system'
    );
    expect(
      systemLogs.some((l) =>
        l.data.text.includes('A submissão deve ser feita manualmente pelo operador no portal oficial')
      )
    ).toBe(true);
  });
});
