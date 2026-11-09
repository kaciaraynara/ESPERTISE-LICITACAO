const mockCreateDraft = jest.fn();
const mockAddItem = jest.fn();
const mockGetById = jest.fn();
const mockValidateCompliance = jest.fn();
const mockGenerateOfficialProposalDocument = jest.fn();
const mockIncrementPlanUsage = jest.fn();

jest.mock('../shared/middlewares/plan-limits.middleware', () => ({
  incrementPlanUsage: mockIncrementPlanUsage,
}));

jest.mock('../services/proposal.service', () => {
  const actual = jest.requireActual('../services/proposal.service');

  return {
    ...actual,
    proposalService: {
      createDraft: mockCreateDraft,
      addItem: mockAddItem,
      getById: mockGetById,
      validateCompliance: mockValidateCompliance,
      generateOfficialProposalDocument: mockGenerateOfficialProposalDocument,
      calcularPrecificacao: actual.proposalService.calcularPrecificacao.bind(actual.proposalService),
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

    expect(mockCreateDraft).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        companyId,
        titulo: 'Proposta comercial',
        moeda: 'BRL',
      }),
    );

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

  test('adiciona item na proposta e retorna 201', async () => {
    const proposalId = '44444444-4444-4444-8444-444444444444';
    mockAddItem.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      proposalId,
      numeroItem: 1,
      descricao: 'Servidor Dell PowerEdge R750',
      valorUnitario: 35000,
      quantidade: 2,
      valorTotal: 70000,
      inexequivel: false,
    });

    const req: any = {
      user: { id: userId },
      params: { id: proposalId },
      body: {
        numeroItem: 1,
        descricao: 'Servidor Dell PowerEdge R750',
        quantidade: 2,
        valorUnitario: 35000,
        marca: 'Dell',
        modelo: 'PowerEdge R750',
      },
    };
    const res = responseMock();
    const controller = new PropostasController();

    await controller.adicionarItem(req, res);

    expect(mockAddItem).toHaveBeenCalledWith(
      userId,
      proposalId,
      expect.objectContaining({
        numeroItem: 1,
        valorUnitario: 35000,
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        numeroItem: 1,
        valorTotal: 70000,
      },
    });
  });

  test('retorna relatorio de compliance da Lei 14.133', async () => {
    const proposalId = '44444444-4444-4444-8444-444444444444';
    mockValidateCompliance.mockResolvedValue({
      isCompliant: true,
      warnings: [],
      errors: [],
      validadeDias: 60,
      validadeSuficiente: true,
      itensInexequiveis: 0,
      declaracoesObrigatorias: {
        elaboracaoIndependente: true,
        habilitacaoCompleta: true,
        naoEmpregoMenor: true,
        inexistenciaImpedimento: true,
        reservaCargosPcd: true,
        meEpp: false,
      },
    });

    const req: any = {
      user: { id: userId },
      params: { id: proposalId },
    };
    const res = responseMock();
    const controller = new PropostasController();

    await controller.validarCompliance(req, res);

    expect(mockValidateCompliance).toHaveBeenCalledWith(userId, proposalId);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        isCompliant: true,
        validadeSuficiente: true,
      },
    });
  });

  test('gera documento oficial de proposta comercial sob Lei 14.133', async () => {
    const proposalId = '44444444-4444-4444-8444-444444444444';
    mockGenerateOfficialProposalDocument.mockResolvedValue({
      proposalId,
      document: 'PROPOSTA COMERCIAL CONFORME LEI FEDERAL Nº 14.133/2021',
      valorTotal: 70000,
      compliance: {
        isCompliant: true,
      },
    });

    const req: any = {
      user: { id: userId },
      params: { id: proposalId },
    };
    const res = responseMock();
    const controller = new PropostasController();

    await controller.gerarDocumentoOficial(req, res);

    expect(mockGenerateOfficialProposalDocument).toHaveBeenCalledWith(userId, proposalId);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        proposalId,
        valorTotal: 70000,
      },
    });
  });
});
