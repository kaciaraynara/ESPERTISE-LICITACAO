import { Request, Response } from 'express';
import { MercadoPagoController } from './mercadopago.controller';

const mockEventUpsert = jest.fn();
const mockEventUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockSubscriptionFindFirst = jest.fn();
const mockSubscriptionCreate = jest.fn();
const mockSubscriptionUpdate = jest.fn();
const mockSubscriptionUpsert = jest.fn();
const mockCompanyFindFirst = jest.fn();
const mockTransaction = jest.fn(async (run: (tx: unknown) => Promise<unknown>) =>
  run({
    user: { update: mockUserUpdate },
    subscription: {
      findFirst: mockSubscriptionFindFirst,
      create: mockSubscriptionCreate,
      update: mockSubscriptionUpdate,
      upsert: mockSubscriptionUpsert,
    },
  }),
);

jest.mock('../database/prisma', () => ({
  prisma: {
    mercadoPagoWebhookEvent: {
      upsert: (...args: unknown[]) => mockEventUpsert(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    subscription: {
      findFirst: (...args: unknown[]) => mockSubscriptionFindFirst(...args),
      create: (...args: unknown[]) => mockSubscriptionCreate(...args),
      update: (...args: unknown[]) => mockSubscriptionUpdate(...args),
      upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args),
    },
    company: {
      findFirst: (...args: unknown[]) => mockCompanyFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => (mockTransaction as any)(...args),
  },
}));

const mockSignatureValidate = jest.fn();
const mockPreApprovalGet = jest.fn();
const mockPreApprovalCreate = jest.fn();
const mockInvoiceGet = jest.fn();

jest.mock('mercadopago', () => {
  class InvalidWebhookSignatureError extends Error {}

  return {
    MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
    PreApproval: jest.fn().mockImplementation(() => ({
      create: (...args: unknown[]) => mockPreApprovalCreate(...args),
      get: (...args: unknown[]) => mockPreApprovalGet(...args),
    })),
    Invoice: jest.fn().mockImplementation(() => ({
      get: (...args: unknown[]) => mockInvoiceGet(...args),
    })),
    WebhookSignatureValidator: {
      validate: (...args: unknown[]) => mockSignatureValidate(...args),
    },
    InvalidWebhookSignatureError,
  };
});

function webhookResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function signedWebhookRequest(
  type = 'subscription_preapproval',
  dataId = 'preapproval_id_123',
) {
  return {
    headers: {
      'x-signature': 'ts=1704908010,v1=assinatura',
      'x-request-id': 'request-id-123',
    },
    query: {
      'data.id': dataId,
    },
    body: {
      id: 'event-id-123',
      type,
      data: { id: dataId },
    },
  } as unknown as Request;
}

describe('MercadoPagoController', () => {
  let controller: MercadoPagoController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MercadoPagoController();
    process.env.MP_ACCESS_TOKEN = 'test-token';
    process.env.MP_WEBHOOK_SECRET = 'test-secret';
    process.env.MP_PLAN_BASIC = 'plan_basic';
    process.env.MP_PLAN_PRO = 'plan_pro';
    process.env.MP_PLAN_MASTER = 'plan_master';
    process.env.MP_BACK_URL = 'http://localhost:5173/planos';

    mockEventUpsert.mockResolvedValue({
      id: 'event-id-123',
      status: 'processing',
    });
    mockEventUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: 'user_id_123',
      email: 'conta@empresa.test',
    });
    mockUserUpdate.mockResolvedValue({});
    mockSubscriptionUpsert.mockResolvedValue({});
    mockPreApprovalGet.mockResolvedValue({
      id: 'preapproval_id_123',
      status: 'authorized',
      external_reference: 'user_id_123:pro',
      payer_id: 999999,
      preapproval_plan_id: 'plan_pro',
      date_created: '2026-07-01T12:00:00.000Z',
      next_payment_date: '2026-08-01T12:00:00.000Z',
      auto_recurring: {
        transaction_amount: 199.99,
        currency_id: 'BRL',
      },
      summarized: {
        charged_quantity: 1,
        charged_amount: 199.99,
      },
    });
  });

  afterEach(() => {
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.MP_PLAN_BASIC;
    delete process.env.MP_PLAN_PRO;
    delete process.env.MP_PLAN_MASTER;
    delete process.env.MP_BACK_URL;
  });

  it('lista os três planos comerciais definidos no contrato', async () => {
    const response = webhookResponse();

    await controller.listPlanos({} as Request, response);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'basic',
            nome: 'Plano Básico',
            valor: 99.99,
            mercadoPagoConfigurado: true,
          }),
          expect.objectContaining({ id: 'pro', nome: 'Plano Avançado', valor: 199.99 }),
          expect.objectContaining({ id: 'master', nome: 'Plano Master', valor: 499.99 }),
        ]),
      }),
    );
  });

  it('cria checkout recorrente para o plano escolhido usando Mercado Pago', async () => {
    mockPreApprovalCreate.mockResolvedValueOnce({
      init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval=123',
    });

    const request = {
      user: { id: 'user_id_123', email: 'conta@empresa.test' },
      body: { plano: 'pro' },
    } as any;
    const response = webhookResponse();

    await controller.criarCheckoutAutenticado(request, response);

    expect(mockPreApprovalCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        preapproval_plan_id: 'plan_pro',
        payer_email: 'conta@empresa.test',
        external_reference: 'user_id_123:pro',
        back_url: 'http://localhost:5173/planos?status=success',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 199.99,
          currency_id: 'BRL',
        },
      }),
    });
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: {
        url: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval=123',
        plano: 'pro',
      },
    });
  });

  it('confirma plano somente após validar assinatura e cobrança real', async () => {
    const request = signedWebhookRequest();
    const response = webhookResponse();

    await controller.webhook(request, response);

    expect(mockSignatureValidate).toHaveBeenCalledWith({
      xSignature: 'ts=1704908010,v1=assinatura',
      xRequestId: 'request-id-123',
      dataId: 'preapproval_id_123',
      secret: 'test-secret',
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user_id_123' },
      data: { plano: 'pro', planType: 'MEDIUM' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_categoria: {
            userId: 'user_id_123',
            categoria: 'plataforma',
          },
        },
        create: expect.objectContaining({
          plano: 'pro',
          status: 'active',
          mpPlanId: 'plan_pro',
        }),
      }),
    );
    expect(mockEventUpdate).toHaveBeenLastCalledWith({
      where: { id: 'event-id-123' },
      data: expect.objectContaining({
        status: 'processed',
        lastError: null,
      }),
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith('OK');
  });

  it('não ativa plano quando a assinatura ainda não tem cobrança confirmada', async () => {
    mockPreApprovalGet.mockResolvedValue({
      id: 'preapproval_id_123',
      status: 'authorized',
      external_reference: 'user_id_123:pro',
      preapproval_plan_id: 'plan_pro',
      date_created: '2026-07-01T12:00:00.000Z',
      next_payment_date: '2026-08-01T12:00:00.000Z',
      auto_recurring: {
        transaction_amount: 199.99,
        currency_id: 'BRL',
      },
      summarized: {
        charged_quantity: 0,
        charged_amount: 0,
      },
    });

    const response = webhookResponse();
    await controller.webhook(signedWebhookRequest(), response);

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('rejeita webhook sem assinatura válida antes de tocar no banco', async () => {
    const { InvalidWebhookSignatureError } = jest.requireMock('mercadopago');
    mockSignatureValidate.mockImplementationOnce(() => {
      throw new InvalidWebhookSignatureError('invalid');
    });

    const response = webhookResponse();
    await controller.webhook(signedWebhookRequest(), response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(mockEventUpsert).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('minhaAssinatura: retorna free e inativa quando o período da assinatura expirou', async () => {
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      userId: 'user-1',
      plano: 'pro',
      status: 'active',
      mpPreapprovalId: 'preapp-1',
      periodoFim: new Date(Date.now() - 3600_000), // Expirou no passado
    });

    const req = {
      user: { id: 'user-1', email: 'user@test.com', plano: 'pro' },
    } as any;
    const res = webhookResponse();

    await controller.minhaAssinatura(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        plano: 'free',
        ativa: false,
        status: 'expired',
      }),
    });
  });

  it('ativarTrial: ativa 7 dias de Pro quando conta e CNPJ são elegíveis', async () => {
    mockSubscriptionFindFirst.mockResolvedValue(null);
    mockCompanyFindFirst.mockResolvedValueOnce({ cnpj: '11222333000181' });

    const req = {
      user: { id: 'user-1', email: 'user@test.com' },
    } as any;
    const res = webhookResponse();

    await controller.ativarTrial(req, res);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { plano: 'pro', planType: 'MEDIUM' },
    });
    expect(mockSubscriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          plano: 'pro',
          status: 'trialing',
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          plano: 'pro',
          status: 'trialing',
          dias: 7,
        }),
      }),
    );
  });

  it('ativarTrial: rejeita ativação com 409 se usuário já teve assinatura', async () => {
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      id: 'sub-antiga',
      userId: 'user-1',
      status: 'canceled',
    });

    const req = {
      user: { id: 'user-1', email: 'user@test.com' },
    } as any;
    const res = webhookResponse();

    await controller.ativarTrial(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TRIAL_ALREADY_USED',
      }),
    );
    expect(mockSubscriptionCreate).not.toHaveBeenCalled();
  });

  it('ativarTrial: rejeita ativação com 409 se CNPJ da empresa já utilizou trial', async () => {
    mockSubscriptionFindFirst
      .mockResolvedValueOnce(null) // para o usuário
      .mockResolvedValueOnce({ id: 'sub-cnpj' }); // para a empresa
    mockCompanyFindFirst.mockResolvedValueOnce({ cnpj: '11222333000181' });

    const req = {
      user: { id: 'user-2', email: 'outro@test.com' },
    } as any;
    const res = webhookResponse();

    await controller.ativarTrial(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TRIAL_CNPJ_ALREADY_USED',
      }),
    );
    expect(mockSubscriptionCreate).not.toHaveBeenCalled();
  });

  it('webhook: cancela assinatura e rebaixa usuário para free se invoice for estornada (refunded)', async () => {
    mockInvoiceGet.mockResolvedValueOnce({
      id: 'inv-123',
      preapproval_id: 'preapproval_id_123',
      status: 'processed',
      payment: {
        status: 'refunded',
      },
    });
    mockSubscriptionFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      userId: 'user-1',
      mpPreapprovalId: 'preapproval_id_123',
    });

    const request = signedWebhookRequest('subscription_authorized_payment', 'inv-123');
    const response = webhookResponse();

    await controller.webhook(request, response);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { plano: 'free', planType: 'BASIC' },
    });
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'canceled' },
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
