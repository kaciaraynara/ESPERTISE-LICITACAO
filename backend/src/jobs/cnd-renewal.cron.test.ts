jest.mock('../database/prisma', () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../config/env', () => ({
  isDatabaseConfigured: jest.fn(),
}));

import { isDatabaseConfigured } from '../config/env';
import { prisma } from '../database/prisma';
import { runCndRenewalScan } from './cnd-renewal.cron';

const databaseConfiguredMock = isDatabaseConfigured as jest.MockedFunction<typeof isDatabaseConfigured>;
const findManyMock = prisma.document.findMany as jest.Mock;

describe('runCndRenewalScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('falha quando o PostgreSQL nao esta configurado', async () => {
    databaseConfiguredMock.mockReturnValue(false);

    await expect(runCndRenewalScan()).rejects.toThrow('DATABASE_URL_NOT_CONFIGURED');

    expect(findManyMock).not.toHaveBeenCalled();
  });

  test('propaga falha de consulta sem mascarar com lista vazia', async () => {
    databaseConfiguredMock.mockReturnValue(true);
    findManyMock.mockRejectedValue(new Error('postgres offline'));

    await expect(runCndRenewalScan()).rejects.toThrow('postgres offline');
  });

  test('retorna somente candidatos reais encontrados no banco', async () => {
    const validade = new Date('2026-08-10T12:00:00.000Z');
    databaseConfiguredMock.mockReturnValue(true);
    findManyMock.mockResolvedValue([
      {
        id: 'document-1',
        userId: 'user-1',
        companyId: 'company-1',
        nome: 'CND Federal',
        tipo: 'CND',
        validade,
      },
      {
        id: 'document-without-expiration',
        userId: 'user-1',
        companyId: 'company-1',
        nome: 'Documento sem validade',
        tipo: 'CND',
        validade: null,
      },
    ]);

    await expect(runCndRenewalScan()).resolves.toEqual([
      {
        userId: 'user-1',
        documentId: 'document-1',
        companyId: 'company-1',
        nome: 'CND Federal',
        tipo: 'CND',
        validade: validade.toISOString(),
      },
    ]);
  });
});
