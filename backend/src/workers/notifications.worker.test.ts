jest.mock('../database/prisma', () => ({
  prisma: {
    deadline: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    procurementNotice: {
      findMany: jest.fn(),
    },
    company: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../services/resend.service', () => ({
  enviarAlertaPrazo: jest.fn(),
}));

import { prisma } from '../database/prisma';
import { enviarAlertaPrazo } from '../services/resend.service';
import { NotificationsWorker } from './notifications.worker';
import { DeadlineStatus, DeadlineType } from '@prisma/client';

const findManyDeadlinesMock = prisma.deadline.findMany as jest.Mock;
const updateDeadlineMock = prisma.deadline.update as jest.Mock;
const createNotificationMock = prisma.notification.create as jest.Mock;
const enviarAlertaPrazoMock = enviarAlertaPrazo as jest.Mock;

describe('NotificationsWorker - processUpcomingDeadlines', () => {
  let worker: NotificationsWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    worker = new NotificationsWorker();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('dispara alerta de 24h e 48h para prazos dentro das janelas correspondentes', async () => {
    const now = new Date();
    const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    findManyDeadlinesMock.mockResolvedValue([
      {
        id: 'deadline-24h',
        title: 'Impugnação Pregão 10/2026',
        type: DeadlineType.IMPUGNACAO,
        status: DeadlineStatus.PENDENTE,
        dueAt: in12Hours,
        metadata: {},
        user: { id: 'user-1', email: 'empresa1@teste.com', nome: 'Licitante 1' },
        procurementNotice: { noticeNumber: '10/2026', buyerName: 'Prefeitura de SP' },
      },
      {
        id: 'deadline-48h',
        title: 'Sessão Pública Pregão 12/2026',
        type: DeadlineType.SESSAO_PUBLICA,
        status: DeadlineStatus.OPEN,
        dueAt: in36Hours,
        metadata: {},
        user: { id: 'user-2', email: 'empresa2@teste.com', nome: 'Licitante 2' },
        procurementNotice: { noticeNumber: '12/2026', buyerName: 'Ministério da Saúde' },
      },
    ]);

    enviarAlertaPrazoMock.mockResolvedValue({ success: true, id: 'email-123' });
    createNotificationMock.mockResolvedValue({});
    updateDeadlineMock.mockResolvedValue({});

    const result = await worker.processUpcomingDeadlines();

    expect(result.totalDeadlines).toBe(2);
    expect(result.alerted24h).toBe(1);
    expect(result.alerted48h).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    // Verificou o disparo dos 2 e-mails
    expect(enviarAlertaPrazoMock).toHaveBeenCalledTimes(2);

    // E-mail de 24h
    expect(enviarAlertaPrazoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'empresa1@teste.com',
        prazoTitulo: 'Impugnação Pregão 10/2026',
        horasRestantes: 12,
      })
    );

    // E-mail de 48h
    expect(enviarAlertaPrazoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'empresa2@teste.com',
        prazoTitulo: 'Sessão Pública Pregão 12/2026',
        horasRestantes: 36,
      })
    );

    // Verificou criação de notificação in-app
    expect(createNotificationMock).toHaveBeenCalledTimes(2);

    // Verificou marcação no metadata para idempotência
    expect(updateDeadlineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deadline-24h' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({ alerted_24h: true }),
        }),
      })
    );
    expect(updateDeadlineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deadline-48h' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({ alerted_48h: true }),
        }),
      })
    );
  });

  test('ignora prazos que já foram alertados no ciclo anterior (idempotência)', async () => {
    const now = new Date();
    const in10Hours = new Date(now.getTime() + 10 * 60 * 60 * 1000);

    findManyDeadlinesMock.mockResolvedValue([
      {
        id: 'deadline-ja-alertado',
        title: 'Recurso Pregão 05/2026',
        type: DeadlineType.RECURSO,
        status: DeadlineStatus.PENDENTE,
        dueAt: in10Hours,
        metadata: { alerted_24h: true, alerted_24h_at: new Date().toISOString() },
        user: { id: 'user-1', email: 'empresa1@teste.com', nome: 'Licitante 1' },
      },
    ]);

    const result = await worker.processUpcomingDeadlines();

    expect(result.totalDeadlines).toBe(1);
    expect(result.alerted24h).toBe(0);
    expect(result.alerted48h).toBe(0);
    expect(result.skipped).toBe(1);

    expect(enviarAlertaPrazoMock).not.toHaveBeenCalled();
    expect(updateDeadlineMock).not.toHaveBeenCalled();
  });
});
