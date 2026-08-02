import { Request, Response } from 'express';

import { GovAPIController } from './govapi.controller';

const originalEnv = {
  SICAF_API_BASE_URL: process.env.SICAF_API_BASE_URL,
  GOVBR_CLIENT_ID: process.env.GOVBR_CLIENT_ID,
  GOVBR_CLIENT_SECRET: process.env.GOVBR_CLIENT_SECRET,
};

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

function createResponseMock() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;

  (response.status as jest.Mock).mockReturnValue(response);
  (response.json as jest.Mock).mockReturnValue(response);

  return response;
}

describe('GovAPIController — SICAF', () => {
  const controller = new GovAPIController();

  beforeEach(() => {
    delete process.env.SICAF_API_BASE_URL;
    delete process.env.GOVBR_CLIENT_ID;
    delete process.env.GOVBR_CLIENT_SECRET;
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreEnvironment();
  });

  it('retorna 503 e nenhum dado fictício ao consultar SICAF sem integração', async () => {
    const request = {
      params: {
        cnpj: '12.345.678/0001-90',
      },
    } as unknown as Request;

    const response = createResponseMock();

    await controller.consultarSicaf(request, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        source: 'SICAF',
        official: true,
        status: 'INTEGRATION_NOT_CONFIGURED',
        code: 'SICAF_INTEGRATION_NOT_CONFIGURED',
        data: null,
      }),
    );

    const payload = (response.json as jest.Mock).mock.calls[0][0];

    expect(payload).not.toHaveProperty('error');
    expect(payload.data).toBeNull();
  });

  it('retorna 503 e nenhuma certidão inventada ao listar certidões', async () => {
    const request = {
      params: {
        cnpj: '12.345.678/0001-90',
      },
    } as unknown as Request;

    const response = createResponseMock();

    await controller.listarCertidoes(request, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        source: 'SICAF',
        official: true,
        status: 'INTEGRATION_NOT_CONFIGURED',
        data: null,
      }),
    );

    const payload = (response.json as jest.Mock).mock.calls[0][0];

    expect(payload).not.toHaveProperty('certidoes');
    expect(payload).not.toHaveProperty('resumo');
    expect(payload).not.toHaveProperty('error');
  });

  it('rejeita CNPJ com tamanho inválido antes de consultar a integração', async () => {
    const request = {
      params: {
        cnpj: '123',
      },
    } as unknown as Request;

    const response = createResponseMock();

    await controller.consultarSicaf(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'CNPJ inválido',
    });
  });

  it('aceita a estrutura de 14 caracteres alfanuméricos', async () => {
    const request = {
      params: {
        cnpj: 'AB.CDE.123/0001-90',
      },
    } as unknown as Request;

    const response = createResponseMock();

    await controller.consultarSicaf(request, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SICAF_INTEGRATION_NOT_CONFIGURED',
        data: null,
      }),
    );
  });
});
