const mockCertificateFindMany = jest.fn();
const mockCertificateUpdate = jest.fn();
const mockNotificationCreate = jest.fn();
const mockSendCertificateAlert = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    companyCertificate: {
      findMany: mockCertificateFindMany,
      update: mockCertificateUpdate,
    },
    notification: { create: mockNotificationCreate },
  },
}));

jest.mock('../services/resend.service', () => ({
  enviarAlertaCertidao: mockSendCertificateAlert,
}));

import { CertificatesWorker } from './certificates.worker';

describe('CertificatesWorker', () => {
  let worker: CertificatesWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new CertificatesWorker();
    mockCertificateFindMany.mockResolvedValue([]);
    mockCertificateUpdate.mockResolvedValue({});
    mockNotificationCreate.mockResolvedValue({});
    mockSendCertificateAlert.mockResolvedValue({});
  });

  it('atualiza o status e cria alerta de painel/e-mail apenas uma vez na janela de 7 dias', async () => {
    const expirationDate = new Date();
    expirationDate.setUTCDate(expirationDate.getUTCDate() + 6);
    mockCertificateFindMany.mockResolvedValue([{
      id: 'certificate-1',
      type: 'RECEITA',
      status: 'VALID',
      expirationDate,
      metadata: {},
      company: {
        razaoSocial: 'Empresa Exemplo',
        user: { id: 'user-1', nome: 'Pessoa Exemplo', email: 'user@example.com' },
      },
    }]);

    const result = await worker.checkExpirations();

    expect(result).toEqual({ updated: 1, alertsCreated: 1, emailsSent: 1, emailFailures: 0 });
    expect(mockCertificateUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'certificate-1' },
      data: { status: 'WARNING' },
    });
    expect(mockSendCertificateAlert).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      certidao: 'Certidão Federal (Receita Federal/PGFN)',
      diasRestantes: 6,
    }));
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tipo: 'sistema',
        canal: 'painel',
      }),
    });
    expect(mockCertificateUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'certificate-1' },
      data: {
        metadata: {
          expiration_alert_7d_email_sent: true,
          expiration_alert_7d_panel_sent: true,
        },
      },
    });
  });

  it('não repete alertas já registrados e marca certificados vencidos', async () => {
    const expirationDate = new Date();
    expirationDate.setUTCDate(expirationDate.getUTCDate() - 2);
    mockCertificateFindMany.mockResolvedValue([{
      id: 'certificate-2',
      type: 'FGTS',
      status: 'WARNING',
      expirationDate,
      metadata: {
        expiration_alert_7d_email_sent: true,
        expiration_alert_7d_panel_sent: true,
      },
      company: {
        razaoSocial: 'Empresa Exemplo',
        user: { id: 'user-1', nome: 'Pessoa Exemplo', email: 'user@example.com' },
      },
    }]);

    const result = await worker.checkExpirations();

    expect(result).toEqual({ updated: 1, alertsCreated: 0, emailsSent: 0, emailFailures: 0 });
    expect(mockCertificateUpdate).toHaveBeenCalledWith({
      where: { id: 'certificate-2' },
      data: { status: 'EXPIRED' },
    });
    expect(mockSendCertificateAlert).not.toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});
