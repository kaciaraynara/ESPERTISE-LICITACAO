import { Request, Response } from 'express';
import { LexController } from './lex.controller';

// Mocking dependencies
jest.mock('../services/ai-grounding.service', () => {
  return {
    AiGroundingService: jest.fn().mockImplementation(() => {
      return {
        runLex: jest.fn().mockResolvedValue({
          content: 'Petição Gerada com base na Lei 14.133...',
        })
      };
    })
  };
});

describe('LexController — Inteligência Artificial Jurídica', () => {
  let controller: LexController;
  let mockReq: any;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    controller = new LexController();
    mockReq = {
      user: { id: 'user-1', tenantId: 'tenant-1' },
      body: { messages: [{ role: 'user', content: 'Inabilitação injusta' }] },
      headers: { 'x-tenant-id': 'tenant-1', 'authorization': 'Bearer token' }
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  it('deve gerar uma petição usando o serviço Lex e retornar o markdown', async () => {
    await controller.chat(mockReq as Request, mockRes as Response);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          resposta: expect.stringContaining('Petição Gerada')
        })
      })
    );
  });
});
