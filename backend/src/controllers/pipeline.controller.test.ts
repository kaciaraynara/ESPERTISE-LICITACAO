const mockPipelineFindMany = jest.fn();
const mockPipelineFindFirst = jest.fn();
const mockPipelineFindUnique = jest.fn();
const mockPipelineCreate = jest.fn();
const mockPipelineUpdate = jest.fn();
const mockPipelineDelete = jest.fn();

const mockNoticeFindFirst = jest.fn();
const mockNoticeFindUnique = jest.fn();
const mockNoticeUpsert = jest.fn();

const mockAuditEventCreate = jest.fn();

const mockBuscarLicitacao = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    biddingPipeline: {
      findMany: mockPipelineFindMany,
      findFirst: mockPipelineFindFirst,
      findUnique: mockPipelineFindUnique,
      create: mockPipelineCreate,
      update: mockPipelineUpdate,
      delete: mockPipelineDelete,
    },
    procurementNotice: {
      findFirst: mockNoticeFindFirst,
      findUnique: mockNoticeFindUnique,
      upsert: mockNoticeUpsert,
    },
    auditEvent: {
      create: mockAuditEventCreate,
    },
  },
}));

jest.mock('../services/licitacoes.service', () => ({
  buscarLicitacaoPorIdOuControle: mockBuscarLicitacao,
}));

import { PipelineController } from './pipeline.controller';

function mockResponse() {
  const res: any = {
    statusCode: 200,
    payload: undefined,
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.payload = body;
    return res;
  });
  return res;
}

describe('PipelineController — Fatia Vertical CRM / Persistência / Multi-Tenant / Auditoria', () => {
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  const noticeId = '33333333-3333-3333-3333-333333333333';
  const pipelineId = '44444444-4444-4444-4444-444444444444';

  let controller: PipelineController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PipelineController();
  });

  describe('listStages (Listagem de editais reais e isolamento multi-tenant)', () => {
    test('retorna 401 se usuário não autenticado', async () => {
      const req: any = {};
      const res = mockResponse();

      await controller.listStages(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.payload).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
      expect(mockPipelineFindMany).not.toHaveBeenCalled();
    });

    test('lista oportunidades filtrando estritamente por userId e tenantId', async () => {
      const req: any = {
        user: { id: userA, tenantId: tenantA, role: 'fornecedor' },
      };
      const res = mockResponse();

      const fakeNotices = [
        {
          id: pipelineId,
          userId: userA,
          stage: 'OPORTUNIDADE',
          position: 0,
          notice: {
            id: noticeId,
            noticeNumber: 'PE 001/2026',
            buyerName: 'Prefeitura de Teste',
            source: 'PNCP',
            estimatedValue: 150000,
          },
        },
      ];

      mockPipelineFindMany.mockResolvedValueOnce(fakeNotices);

      await controller.listStages(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        data: fakeNotices,
      });

      // Valida cláusula de isolamento estrito
      expect(mockPipelineFindMany).toHaveBeenCalledWith({
        where: {
          userId: userA,
          user: { tenantId: tenantA },
        },
        include: { notice: true },
        orderBy: { position: 'asc' },
      });
    });
  });

  describe('addToPipeline (Persistência, Deduplicação e Auditoria)', () => {
    test('retorna 400 se noticeId não informado', async () => {
      const req: any = {
        user: { id: userA, tenantId: tenantA },
        body: {},
      };
      const res = mockResponse();

      await controller.addToPipeline(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.payload).toMatchObject({ success: false, code: 'NOTICE_ID_REQUIRED' });
    });

    test('impede duplicação do mesmo edital para o mesmo pipeline (409 Conflict)', async () => {
      const req: any = {
        user: { id: userA, tenantId: tenantA },
        body: { noticeId },
      };
      const res = mockResponse();

      // Edital localizado na persistência
      mockNoticeFindFirst.mockResolvedValueOnce({
        id: noticeId,
        noticeNumber: 'PE 001/2026',
        buyerName: 'Prefeitura Municipal',
      });

      // Já existe no pipeline do usuário
      mockPipelineFindFirst.mockResolvedValueOnce({
        id: pipelineId,
        userId: userA,
        noticeId,
        stage: 'OPORTUNIDADE',
      });

      await controller.addToPipeline(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.payload).toMatchObject({
        success: false,
        code: 'OPPORTUNITY_ALREADY_EXISTS',
        message: expect.stringContaining('já está cadastrado'),
      });
      expect(mockPipelineCreate).not.toHaveBeenCalled();
      expect(mockAuditEventCreate).not.toHaveBeenCalled();
    });

    test('salva oportunidade real no pipeline e registra auditoria CRM_OPPORTUNITY_CREATED', async () => {
      const req: any = {
        user: { id: userA, tenantId: tenantA, email: 'user@tenant-a.com', role: 'fornecedor' },
        body: { noticeId, stage: 'OPORTUNIDADE', notes: 'Prioridade alta para o pregão' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'JestClient', 'x-request-id': 'req-123' },
      };
      const res = mockResponse();

      mockNoticeFindFirst.mockResolvedValueOnce({
        id: noticeId,
        noticeNumber: 'PE 001/2026',
        externalId: '00394460000141-1-000001/2026',
        buyerName: 'Prefeitura Municipal',
        estimatedValue: 250000.5,
        source: 'PNCP',
      });

      // Não existe duplicata
      mockPipelineFindFirst
        .mockResolvedValueOnce(null) // para deduplicação
        .mockResolvedValueOnce({ position: 2 }); // para lastItem

      const fakeCreated = {
        id: pipelineId,
        userId: userA,
        noticeId,
        stage: 'OPORTUNIDADE',
        position: 3,
        notes: 'Prioridade alta para o pregão',
        notice: {
          id: noticeId,
          noticeNumber: 'PE 001/2026',
          buyerName: 'Prefeitura Municipal',
        },
      };

      mockPipelineCreate.mockResolvedValueOnce(fakeCreated);
      mockAuditEventCreate.mockResolvedValueOnce({ id: 'audit-1' });

      await controller.addToPipeline(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.payload).toMatchObject({
        success: true,
        data: fakeCreated,
      });

      // Verifica criação no banco com vínculo estrito
      expect(mockPipelineCreate).toHaveBeenCalledWith({
        data: {
          userId: userA,
          noticeId,
          stage: 'OPORTUNIDADE',
          position: 3,
          notes: 'Prioridade alta para o pregão',
        },
        include: { notice: true },
      });

      // Verifica registro de auditoria
      expect(mockAuditEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: userA,
          scope: 'crm',
          action: 'CRM_OPPORTUNITY_CREATED',
          outcome: 'success',
          entityType: 'bidding_pipeline',
          entityId: pipelineId,
          metadata: expect.objectContaining({
            tenantId: tenantA,
            noticeId,
            noticeNumber: 'PE 001/2026',
            stage: 'OPORTUNIDADE',
            source: 'PNCP',
          }),
        }),
      });
    });

    test('busca edital externo e persiste com sucesso quando não localizado previamente no banco local', async () => {
      const externalNoticeId = '00394460000141-1-000099/2026';
      const createdDbNoticeId = '99999999-9999-9999-9999-999999999999';
      const req: any = {
        user: { id: userA, tenantId: tenantA, email: 'user@tenant-a.com', role: 'fornecedor' },
        body: { noticeId: externalNoticeId, stage: 'OPORTUNIDADE' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'JestClient' },
      };
      const res = mockResponse();

      // 1ª busca: edital não está no banco local
      mockNoticeFindFirst
        .mockResolvedValueOnce(null)
        // 2ª busca: após buscarLicitacaoPorIdOuControle persistir, encontra pelo databaseId
        .mockResolvedValueOnce({
          id: createdDbNoticeId,
          noticeNumber: 'PE 099/2026',
          externalId: externalNoticeId,
          buyerName: 'Ministério da Saúde',
        });

      mockBuscarLicitacao.mockResolvedValueOnce({
        id: createdDbNoticeId,
        databaseId: createdDbNoticeId,
        numeroControlePNCP: externalNoticeId,
        objeto: 'Equipamentos médicos',
      });

      mockPipelineFindFirst
        .mockResolvedValueOnce(null) // sem duplicata
        .mockResolvedValueOnce(null); // lastItem

      mockPipelineCreate.mockResolvedValueOnce({
        id: 'new-pipe-id',
        userId: userA,
        noticeId: createdDbNoticeId,
        stage: 'OPORTUNIDADE',
        position: 0,
        notice: { id: createdDbNoticeId, noticeNumber: 'PE 099/2026' },
      });
      mockAuditEventCreate.mockResolvedValueOnce({ id: 'audit-ext-1' });

      await controller.addToPipeline(req, res);

      expect(res.statusCode).toBe(201);
      expect(mockBuscarLicitacao).toHaveBeenCalledWith(externalNoticeId, { requirePersistence: true });
      expect(mockPipelineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ noticeId: createdDbNoticeId }),
        }),
      );
    });

    test('retorna 500 NOTICE_PERSISTENCE_ERROR quando busca externa ocorre mas persistência no banco local falha', async () => {
      const externalNoticeId = '00394460000141-1-000088/2026';
      const req: any = {
        user: { id: userA, tenantId: tenantA },
        body: { noticeId: externalNoticeId },
      };
      const res = mockResponse();

      mockNoticeFindFirst.mockResolvedValueOnce(null);
      const persistError: any = new Error('Database down');
      persistError.code = 'NOTICE_PERSISTENCE_FAILED';
      persistError.isPersistenceError = true;
      mockBuscarLicitacao.mockRejectedValueOnce(persistError);

      await controller.addToPipeline(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.payload).toMatchObject({
        success: false,
        code: 'NOTICE_PERSISTENCE_ERROR',
      });
      expect(mockPipelineCreate).not.toHaveBeenCalled();
    });

    test('retorna 404 NOTICE_NOT_FOUND quando edital não existe localmente nem na fonte oficial', async () => {
      const nonExistentId = '00000000000000-0-000000/2026';
      const req: any = {
        user: { id: userA, tenantId: tenantA },
        body: { noticeId: nonExistentId },
      };
      const res = mockResponse();

      mockNoticeFindFirst.mockResolvedValueOnce(null);
      const notFoundError: any = new Error('Contratação não encontrada no PNCP');
      notFoundError.statusCode = 404;
      mockBuscarLicitacao.mockRejectedValueOnce(notFoundError);

      await controller.addToPipeline(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.payload).toMatchObject({
        success: false,
        code: 'NOTICE_NOT_FOUND',
      });
      expect(mockPipelineCreate).not.toHaveBeenCalled();
    });
  });

  describe('moveOpportunity (Atualização de estágio e isolamento)', () => {
    test('impede movimentação de oportunidade de outro tenant/usuário (404 Not Found)', async () => {
      const req: any = {
        user: { id: userB, tenantId: tenantB },
        params: { id: pipelineId },
        body: { stage: 'ANALISE' },
      };
      const res = mockResponse();

      // Busca com userId = userB e tenant = tenantB retorna null pois pertence ao Tenant A
      mockPipelineFindFirst.mockResolvedValueOnce(null);

      await controller.moveOpportunity(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.payload).toMatchObject({ success: false, code: 'NOT_FOUND' });
      expect(mockPipelineUpdate).not.toHaveBeenCalled();
      expect(mockAuditEventCreate).not.toHaveBeenCalled();
    });

    test('atualiza estágio com sucesso e registra auditoria CRM_STAGE_UPDATED', async () => {
      const req: any = {
        user: { id: userA, tenantId: tenantA, email: 'user@tenant-a.com' },
        params: { id: pipelineId },
        body: { stage: 'ANALISE', position: 1 },
      };
      const res = mockResponse();

      mockPipelineFindFirst.mockResolvedValueOnce({
        id: pipelineId,
        userId: userA,
        noticeId,
        stage: 'OPORTUNIDADE',
        position: 0,
        notice: { id: noticeId, noticeNumber: 'PE 001/2026' },
      });

      const updatedRow = {
        id: pipelineId,
        userId: userA,
        noticeId,
        stage: 'ANALISE',
        position: 1,
        notice: { id: noticeId, noticeNumber: 'PE 001/2026' },
      };

      mockPipelineUpdate.mockResolvedValueOnce(updatedRow);
      mockAuditEventCreate.mockResolvedValueOnce({ id: 'audit-2' });

      await controller.moveOpportunity(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toMatchObject({
        success: true,
        data: updatedRow,
      });

      expect(mockAuditEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: userA,
          scope: 'crm',
          action: 'CRM_STAGE_UPDATED',
          outcome: 'success',
          entityId: pipelineId,
          metadata: expect.objectContaining({
            previousStage: 'OPORTUNIDADE',
            newStage: 'ANALISE',
            noticeId,
          }),
        }),
      });
    });
  });

  describe('removeFromPipeline (Remoção segura e auditoria)', () => {
    test('não permite deletar oportunidade pertencente a outro tenant (404)', async () => {
      const req: any = {
        user: { id: userB, tenantId: tenantB },
        params: { id: pipelineId },
      };
      const res = mockResponse();

      mockPipelineFindFirst.mockResolvedValueOnce(null);

      await controller.removeFromPipeline(req, res);

      expect(res.statusCode).toBe(404);
      expect(mockPipelineDelete).not.toHaveBeenCalled();
    });

    test('deleta oportunidade própria e registra auditoria CRM_OPPORTUNITY_REMOVED', async () => {
      const req: any = {
        user: { id: userA, tenantId: tenantA },
        params: { id: pipelineId },
      };
      const res = mockResponse();

      mockPipelineFindFirst.mockResolvedValueOnce({
        id: pipelineId,
        userId: userA,
        noticeId,
        stage: 'OPORTUNIDADE',
        notice: { id: noticeId, noticeNumber: 'PE 001/2026' },
      });

      mockPipelineDelete.mockResolvedValueOnce({ id: pipelineId });
      mockAuditEventCreate.mockResolvedValueOnce({ id: 'audit-3' });

      await controller.removeFromPipeline(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toMatchObject({ success: true, message: expect.stringContaining('removida') });
      expect(mockPipelineDelete).toHaveBeenCalledWith({ where: { id: pipelineId } });
      expect(mockAuditEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CRM_OPPORTUNITY_REMOVED',
          entityId: pipelineId,
        }),
      });
    });
  });
});
