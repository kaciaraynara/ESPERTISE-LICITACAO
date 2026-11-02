const mockContractGuaranteeFindMany = jest.fn();
const mockContractGuaranteeUpdateMany = jest.fn();
const mockContractFindMany = jest.fn();
const mockContractAlertCreateMany = jest.fn();
const mockNotificationCreate = jest.fn();
const alertKeys = new Set<string>();
const guaranteeStatuses = new Map<string, string>();

jest.mock('../database/prisma', () => ({
  prisma: {
    contractGuarantee: {
      findMany: mockContractGuaranteeFindMany,
      updateMany: mockContractGuaranteeUpdateMany,
    },
    contract: {
      findMany: mockContractFindMany,
    },
    $transaction: jest.fn(async (callback) => callback({
      contractGuarantee: { updateMany: mockContractGuaranteeUpdateMany },
      contractMonitorAlert: { createMany: mockContractAlertCreateMany },
      notification: { create: mockNotificationCreate },
    })),
  },
}));

import { ContractMonitorWorker } from './contract-monitor.worker';

function addDays(date: Date, amount: number) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function guarantee(id: string, daysToExpiry: number, today: Date) {
  return {
    id,
    companyId: `company-${id}`,
    tipoGarantia: 'CONTRATO',
    modalidade: 'SEGURO',
    valorGarantido: 1250,
    dataVencimento: addDays(today, daysToExpiry),
    status: 'RETIDA',
    company: { userId: `user-${id}`, razaoSocial: 'Empresa de Teste' },
    contract: { id: `contract-${id}`, numeroContrato: `CT-${id}`, status: 'ATIVO' },
  };
}

describe('ContractMonitorWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    alertKeys.clear();
    guaranteeStatuses.clear();
    mockContractGuaranteeFindMany.mockResolvedValue([]);
    mockContractGuaranteeUpdateMany.mockImplementation(
      async ({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
        const currentStatus = guaranteeStatuses.get(where.id) || 'RETIDA';
        if (currentStatus !== where.status) return { count: 0 };
        guaranteeStatuses.set(where.id, data.status);
        return { count: 1 };
      },
    );
    mockContractFindMany.mockResolvedValue([]);
    mockContractAlertCreateMany.mockImplementation(
      async ({ data }: { data: Array<{ dedupeKey: string }> }) => {
        const fresh = data.filter((item) => !alertKeys.has(item.dedupeKey));
        fresh.forEach((item) => alertKeys.add(item.dedupeKey));
        return { count: fresh.length };
      },
    );
    mockNotificationCreate.mockResolvedValue({});
  });

  it('alerta apólices nos marcos de 60, 30 e 15 dias sem alterar o status da garantia', async () => {
    const today = new Date('2026-10-03T12:00:00.000Z');
    mockContractGuaranteeFindMany.mockResolvedValue([
      guarantee('60', 60, today),
      guarantee('30', 30, today),
      guarantee('15', 15, today),
    ]);

    const result = await new ContractMonitorWorker().run(today);

    expect(result).toMatchObject({
      guaranteesScanned: 3,
      guaranteeStatusesUpdated: 0,
      alertsCreated: 3,
    });
    expect(mockNotificationCreate).toHaveBeenCalledTimes(3);
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: 'Garantia contratual vence em 60 dias',
        mensagem: expect.stringContaining('Renove o seguro'),
        userId: 'user-60',
      }),
    });
    expect(mockContractGuaranteeUpdateMany).not.toHaveBeenCalled();
  });

  it('marca garantia de contrato encerrado como pronta para resgate e alerta uma única vez', async () => {
    const today = new Date('2026-10-03T12:00:00.000Z');
    const endedGuarantee = {
      ...guarantee('ended', 45, today),
      contract: { id: 'contract-ended', numeroContrato: 'CT-ENCERRADO', status: 'ENCERRADO' },
    };
    mockContractGuaranteeFindMany.mockResolvedValue([endedGuarantee]);

    const monitor = new ContractMonitorWorker();
    const firstRun = await monitor.run(today);
    const secondRun = await monitor.run(today);

    expect(firstRun).toMatchObject({ guaranteeStatusesUpdated: 1, alertsCreated: 1 });
    expect(secondRun).toMatchObject({ guaranteeStatusesUpdated: 0, alertsCreated: 0 });
    expect(mockContractGuaranteeUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ended', status: 'RETIDA' },
      data: { status: 'PRONTA_RESGATE' },
    });
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: 'Garantia pronta para resgate — contrato CT-ENCERRADO',
        mensagem: expect.stringContaining('solicitação de devolução'),
        userId: 'user-ended',
      }),
    });
  });

  it('alerta nos 90 e 60 dias da dataAniversario e não duplica notificações', async () => {
    const today = new Date('2026-10-03T12:00:00.000Z');
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-90',
        companyId: 'company-90',
        numeroContrato: 'CT-90',
        dataBaseProposta: new Date('2025-01-01T00:00:00.000Z'),
        dataAssinatura: new Date('2025-01-01T00:00:00.000Z'),
        isMaoDeObraExclusiva: false,
        predominanciaMaoDeObra: false,
        isFornecimentoGeral: true,
        company: { id: 'company-90', userId: 'user-90', razaoSocial: 'Empresa 90' },
        equilibria: [{
          id: 'equilibrium-90',
          institutoJuridico: 'REAJUSTE',
          dataBase: new Date('2025-01-01T00:00:00.000Z'),
          dataAniversario: addDays(today, 90),
        }],
      },
      {
        id: 'contract-60',
        companyId: 'company-60',
        numeroContrato: 'CT-60',
        dataBaseProposta: new Date('2025-12-02T00:00:00.000Z'),
        dataAssinatura: new Date('2025-12-02T00:00:00.000Z'),
        isMaoDeObraExclusiva: true,
        predominanciaMaoDeObra: false,
        isFornecimentoGeral: false,
        company: { id: 'company-60', userId: 'user-60', razaoSocial: 'Empresa 60' },
        equilibria: [{
          id: 'equilibrium-60',
          institutoJuridico: 'REPACTUACAO',
          dataBase: new Date('2025-12-02T00:00:00.000Z'),
          dataAniversario: addDays(today, 60),
        }],
      },
    ]);

    const monitor = new ContractMonitorWorker();
    const firstRun = await monitor.run(today);
    const retryRun = await monitor.run(today);

    expect(firstRun).toMatchObject({
      contractsScanned: 2,
      equilibriumRecordsScanned: 2,
      alertsCreated: 2,
    });
    expect(retryRun.alertsCreated).toBe(0);
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-90',
        mensagem: expect.stringContaining(
          'Prazo decadencial próximo. Inicie seu pedido de Reajuste/Repactuação',
        ),
      }),
    });
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: 'Prazo de repactuação em 60 dias',
        userId: 'user-60',
      }),
    });
  });

  it('ignora apólices vencidas ou com mais de 60 dias para vencer', async () => {
    const today = new Date('2026-10-03T12:00:00.000Z');
    mockContractGuaranteeFindMany.mockResolvedValue([
      guarantee('expired', -1, today),
      guarantee('far', 61, today),
    ]);

    const result = await new ContractMonitorWorker().run(today);

    expect(result.alertsCreated).toBe(0);
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it('calcula aniversário anual quando o contrato ainda não tem registro de equilíbrio', async () => {
    const today = new Date('2026-10-03T12:00:00.000Z');
    mockContractFindMany.mockResolvedValue([{
      id: 'contract-fallback',
      companyId: 'company-fallback',
      numeroContrato: 'CT-FALLBACK',
      dataBaseProposta: new Date('2025-12-02T00:00:00.000Z'),
      dataAssinatura: new Date('2025-12-02T00:00:00.000Z'),
      isMaoDeObraExclusiva: false,
      predominanciaMaoDeObra: false,
      isFornecimentoGeral: true,
      company: { id: 'company-fallback', userId: 'user-fallback', razaoSocial: 'Empresa' },
      equilibria: [],
    }]);

    const result = await new ContractMonitorWorker().run(today);

    expect(result.alertsCreated).toBe(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: 'Prazo de reajuste em 60 dias',
        userId: 'user-fallback',
      }),
    });
  });
});
