const mockCompanyFindFirst = jest.fn();
const mockDeadlineFindMany = jest.fn();
const mockDeadlineFindUnique = jest.fn();
const mockDeadlineCreate = jest.fn();
const mockDeadlineUpdate = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    company: {
      findFirst: mockCompanyFindFirst,
    },
    deadline: {
      findMany: mockDeadlineFindMany,
      findUnique: mockDeadlineFindUnique,
      create: mockDeadlineCreate,
      update: mockDeadlineUpdate,
    },
  },
}));

import { PrazosController } from './prazos.controller';
import { ApiError } from '../shared/errors/ApiError';

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

describe('PrazosController — ACH-02: Validação de Datas e Regras de Negócio', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const companyId = '22222222-2222-2222-2222-222222222222';
  let controller: PrazosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PrazosController();
  });

  describe('criar (Validação rigorosa de campos e formato de data)', () => {
    test('lança ApiError 401 se usuário não autenticado', async () => {
      const req: any = { body: {} };
      const res = mockResponse();

      await expect(controller.criar(req, res)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Não autenticado',
      });
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('rejeita campo title ausente ou vazio com 400', async () => {
      const req: any = {
        user: { id: userId },
        body: { type: 'ESCLARECIMENTO', dueAt: '2026-10-30T10:00:00Z' },
      };
      const res = mockResponse();

      await expect(controller.criar(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'MISSING_FIELD',
        message: expect.stringContaining('title'),
      });
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('rejeita campo type ausente ou vazio com 400', async () => {
      const req: any = {
        user: { id: userId },
        body: { title: 'Impugnação Edital 12', dueAt: '2026-10-30T10:00:00Z' },
      };
      const res = mockResponse();

      await expect(controller.criar(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'MISSING_FIELD',
        message: expect.stringContaining('type'),
      });
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('rejeita tipo de prazo não suportado com 400 e INVALID_DEADLINE_TYPE', async () => {
      const req: any = {
        user: { id: userId },
        body: { title: 'Prazo', type: 'TIPO_INVENTADO', dueAt: '2026-10-30T10:00:00Z' },
      };
      const res = mockResponse();

      await expect(controller.criar(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DEADLINE_TYPE',
        message: expect.stringContaining('Tipo de prazo ("type") inválido'),
      });
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('rejeita campo dueAt ausente com 400', async () => {
      const req: any = {
        user: { id: userId },
        body: { title: 'Impugnação Edital 12', type: 'IMPUGNACAO' },
      };
      const res = mockResponse();

      await expect(controller.criar(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'MISSING_FIELD',
        message: expect.stringContaining('dueAt'),
      });
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('rejeita string de data inválida com 400 e INVALID_DATE_FORMAT antes de tocar no Prisma', async () => {
      const invalidDates = [
        'data-invalida',
        '2026-99-99',
        'amanha de manha',
        'undefined',
        '0000-00-00',
      ];

      for (const invalidDate of invalidDates) {
        const req: any = {
          user: { id: userId },
          body: {
            title: 'Prazo Recursal',
            type: 'RECURSO',
            dueAt: invalidDate,
          },
        };
        const res = mockResponse();

        await expect(controller.criar(req, res)).rejects.toMatchObject({
          statusCode: 400,
          code: 'INVALID_DATE_FORMAT',
          message: expect.stringContaining('Formato de data inválido'),
        });
      }

      // Garante que o Prisma jamais foi executado com timestamp corrompido
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('persiste com sucesso quando data ISO 8601 válida é fornecida e resolve empresa do usuário', async () => {
      const isoDate = '2026-11-20T14:30:00.000Z';
      const req: any = {
        user: { id: userId },
        body: {
          title: 'Envio de Proposta Ajustada',
          description: 'Inserir proposta comercial final conforme lance vencedor',
          type: 'PROPOSTA',
          dueAt: isoDate,
          procurementNoticeId: 'notice-uuid-123',
        },
      };
      const res = mockResponse();

      mockCompanyFindFirst.mockResolvedValueOnce({ id: companyId, userId });
      const createdPrazo = {
        id: 'prazo-uuid-999',
        companyId,
        title: 'Envio de Proposta Ajustada',
        description: 'Inserir proposta comercial final conforme lance vencedor',
        type: 'PROPOSTA',
        dueAt: new Date(isoDate),
        source: 'manual',
        procurementNoticeId: 'notice-uuid-123',
        responsibleUserId: userId,
      };
      mockDeadlineCreate.mockResolvedValueOnce(createdPrazo);

      await controller.criar(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.payload).toMatchObject({
        success: true,
        data: createdPrazo,
      });

      expect(mockDeadlineCreate).toHaveBeenCalledWith({
        data: {
          companyId,
          title: 'Envio de Proposta Ajustada',
          description: 'Inserir proposta comercial final conforme lance vencedor',
          type: 'PROPOSAL_SUBMISSION',
          dueAt: new Date(isoDate),
          source: 'manual',
          procurementNoticeId: 'notice-uuid-123',
          responsibleUserId: userId,
        },
      });
    });

    test('rejeita com 404 se companyId for fornecido mas pertencer a outro usuário', async () => {
      const req: any = {
        user: { id: userId },
        body: {
          companyId: 'outra-empresa-alheia',
          title: 'Prazo',
          type: 'RECURSO',
          dueAt: '2026-11-20T14:30:00.000Z',
        },
      };
      const res = mockResponse();

      mockCompanyFindFirst.mockResolvedValueOnce(null);

      await expect(controller.criar(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Empresa não encontrada ou acesso negado',
      });
      expect(mockDeadlineCreate).not.toHaveBeenCalled();
    });

    test('persiste com sucesso prazo do tipo SESSAO_PUBLICA com campo date e status PENDENTE', async () => {
      const isoDate = '2026-11-15T09:00:00.000Z';
      const req: any = {
        user: { id: userId },
        body: {
          title: 'Abertura de Sessão Pública — Pregão 45/2026',
          type: 'SESSAO_PUBLICA',
          date: isoDate,
          status: 'PENDENTE',
          procurementNoticeId: 'notice-abc-999',
        },
      };
      const res = mockResponse();

      mockCompanyFindFirst.mockResolvedValueOnce({ id: companyId, userId });
      const createdPrazo = {
        id: 'prazo-sessao-1',
        companyId,
        title: 'Abertura de Sessão Pública — Pregão 45/2026',
        type: 'SESSAO_PUBLICA',
        status: 'PENDENTE',
        date: new Date(isoDate),
        dueAt: new Date(isoDate),
        source: 'manual',
        procurementNoticeId: 'notice-abc-999',
        responsibleUserId: userId,
      };
      mockDeadlineCreate.mockResolvedValueOnce(createdPrazo);

      await controller.criar(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.payload.success).toBe(true);
      expect(res.payload.data).toMatchObject({
        type: 'SESSAO_PUBLICA',
        status: 'PENDENTE',
      });
    });
  });

  describe('listar (Listagem ordenada de prazos da data mais próxima para a mais distante)', () => {
    test('retorna lista ordenada e formatada com date e dueAt', async () => {
      const req: any = { user: { id: userId } };
      const res = mockResponse();

      mockCompanyFindFirst.mockResolvedValueOnce({ id: companyId, userId });
      const rawPrazos = [
        {
          id: 'p1',
          companyId,
          title: 'Sessão Pública',
          type: 'SESSAO_PUBLICA',
          status: 'PENDENTE',
          dueAt: new Date('2026-10-25T10:00:00Z'),
          date: new Date('2026-10-25T10:00:00Z'),
        },
        {
          id: 'p2',
          companyId,
          title: 'Assinatura do Contrato',
          type: 'ASSINATURA_CONTRATO',
          status: 'PENDENTE',
          dueAt: new Date('2026-11-05T10:00:00Z'),
          date: new Date('2026-11-05T10:00:00Z'),
        },
      ];
      mockDeadlineFindMany.mockResolvedValueOnce(rawPrazos);

      await controller.listar(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload.success).toBe(true);
      expect(res.payload.data).toHaveLength(2);
      expect(res.payload.data[0].title).toBe('Sessão Pública');
      expect(mockDeadlineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ dueAt: 'asc' }, { date: 'asc' }],
        }),
      );
    });
  });
});
