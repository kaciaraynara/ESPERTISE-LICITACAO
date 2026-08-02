const mockCompanyFindFirst = jest.fn();
const mockNoticeFindUnique = jest.fn();
const mockProposalCreate = jest.fn();
const mockProposalCount = jest.fn();

const mockTx = {
  company: {
    findFirst: mockCompanyFindFirst,
  },
  procurementNotice: {
    findUnique: mockNoticeFindUnique,
  },
  proposal: {
    count: mockProposalCount,
    create: mockProposalCreate,
  },
};

const mockTransaction = jest.fn(
  async (run: (tx: typeof mockTx) => Promise<unknown>) => run(mockTx),
);

jest.mock('../database/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

jest.mock('./plans/plan-guard.service', () => ({
  planGuardService: {
    resolveUserPlan: jest.fn().mockResolvedValue('basic'),
  },
}));

import {
  ProposalService,
  ProposalServiceError,
} from './proposal.service';

const userId = '11111111-1111-4111-8111-111111111111';
const companyId = '22222222-2222-4222-8222-222222222222';
const noticeId = '33333333-3333-4333-8333-333333333333';

describe('ProposalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProposalCount.mockResolvedValue(0);
  });

  test('cria rascunho somente para empresa do usuario autenticado', async () => {
    mockCompanyFindFirst.mockResolvedValue({
      id: companyId,
      tenantId: '66666666-6666-4666-8666-666666666666',
    });
    mockProposalCreate.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      companyId,
      status: 'RASCUNHO',
    });

    const service = new ProposalService();

    const result = await service.createDraft(userId, {
      companyId,
      titulo: 'Proposta comercial',
      moeda: 'BRL',
    });

    expect(mockCompanyFindFirst).toHaveBeenCalledWith({
      where: {
        id: companyId,
        userId,
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    expect(mockProposalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId,
        titulo: 'Proposta comercial',
        status: 'RASCUNHO',
        moeda: 'BRL',
        createdById: userId,
        responsibleUserId: userId,
      }),
    });

    expect(result).toMatchObject({
      companyId,
      status: 'RASCUNHO',
    });
  });

  test('rejeita empresa que nao pertence ao usuario', async () => {
    mockCompanyFindFirst.mockResolvedValue(null);

    const service = new ProposalService();

    await expect(
      service.createDraft(userId, {
        companyId,
        titulo: 'Proposta comercial',
        moeda: 'BRL',
      }),
    ).rejects.toMatchObject({
      code: 'company_not_found',
      statusCode: 404,
    });

    expect(mockProposalCreate).not.toHaveBeenCalled();
  });

  test('rejeita responsavel diferente do usuario autenticado', async () => {
    mockCompanyFindFirst.mockResolvedValue({
      id: companyId,
      tenantId: '66666666-6666-4666-8666-666666666666',
    });

    const service = new ProposalService();

    await expect(
      service.createDraft(userId, {
        companyId,
        titulo: 'Proposta comercial',
        moeda: 'BRL',
        responsibleUserId: '55555555-5555-4555-8555-555555555555',
      }),
    ).rejects.toBeInstanceOf(ProposalServiceError);

    expect(mockProposalCreate).not.toHaveBeenCalled();
  });

  test('rejeita edital inexistente', async () => {
    mockCompanyFindFirst.mockResolvedValue({
      id: companyId,
      tenantId: '66666666-6666-4666-8666-666666666666',
    });
    mockNoticeFindUnique.mockResolvedValue(null);

    const service = new ProposalService();

    await expect(
      service.createDraft(userId, {
        companyId,
        procurementNoticeId: noticeId,
        titulo: 'Proposta vinculada ao edital',
        moeda: 'BRL',
      }),
    ).rejects.toMatchObject({
      code: 'procurement_notice_not_found',
      statusCode: 404,
    });

    expect(mockNoticeFindUnique).toHaveBeenCalledWith({
      where: {
        id: noticeId,
      },
      select: {
        id: true,
      },
    });

    expect(mockProposalCreate).not.toHaveBeenCalled();
  });
});
