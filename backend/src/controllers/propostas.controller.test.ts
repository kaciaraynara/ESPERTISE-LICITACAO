const mockCreateDraft = jest.fn();

jest.mock('../services/proposal.service', () => {
  const actual = jest.requireActual('../services/proposal.service');

  return {
    ...actual,
    proposalService: {
      createDraft: mockCreateDraft,
    },
  };
});

import { ZodError } from 'zod';
import { PropostasController } from './propostas.controller';
import { ProposalServiceError } from '../services/proposal.service';

const userId = '11111111-1111-4111-8111-111111111111';
const companyId = '22222222-2222-4222-8222-222222222222';

function responseMock() {
  const res: any = {
    statusCode: 200,
    payload: undefined,
  };

  res.status = jest.fn((statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  });

  res.json = jest.fn((payload: unknown) => {
    res.payload = payload;
    return res;
  });

  return res;
}

describe('PropostasController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retorna 401 quando usuario nao esta autenticado', async () => {
    const req: any = {
      body: {},
    };
    const res = responseMock();
    const controller = new PropostasController();

    await controller.criarRascunho(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toMatchObject({
      success: false,
      code: 'unauthenticated',
    });
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  test('cria rascunho validado e retorna 201', async () => {
    mockCreateDraft.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      companyId,
      titulo: 'Proposta comercial',
      moeda: 'BRL',
      status: 'RASCUNHO',
    });

    const req: any = {
      user: {
        id: userId,
      },
      body: {
        companyId,
        titulo: '  Proposta comercial  ',
        moeda: 'brl',
      },
    };
    const res = responseMock();
    const controller = new PropostasController();

    await controller.criarRascunho(req, res);

    expect(mockCreateDraft).toHaveBeenCalledWith(userId, {
      companyId,
      titulo: 'Proposta comercial',
      moeda: 'BRL',
    });

    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        companyId,
        status: 'RASCUNHO',
      },
    });
  });

  test('converte erro conhecido do service em resposta HTTP', async () => {
    mockCreateDraft.mockRejectedValue(
      new ProposalServiceError(
        'company_not_found',
        404,
        'Empresa não encontrada para o usuário autenticado.',
      ),
    );

    const req: any = {
      user: {
        id: userId,
      },
      body: {
        companyId,
        titulo: 'Proposta comercial',
      },
    };
    const res = responseMock();
    const controller = new PropostasController();

    await controller.criarRascunho(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual({
      success: false,
      code: 'company_not_found',
      message: 'Empresa não encontrada para o usuário autenticado.',
    });
  });

  test('propaga ZodError quando a entrada e invalida', async () => {
    const req: any = {
      user: {
        id: userId,
      },
      body: {
        companyId: 'empresa-invalida',
        titulo: 'Proposta comercial',
      },
    };
    const res = responseMock();
    const controller = new PropostasController();

    await expect(
      controller.criarRascunho(req, res),
    ).rejects.toBeInstanceOf(ZodError);

    expect(mockCreateDraft).not.toHaveBeenCalled();
  });
});
