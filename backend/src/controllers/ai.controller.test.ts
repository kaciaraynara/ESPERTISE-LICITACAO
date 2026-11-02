import { AIController } from './ai.controller';
import { AiGroundingService } from '../services/ai-grounding.service';

describe('AIController', () => {
  it('usa grounding e envia resposta/citações no fluxo SSE', async () => {
    const runLex = jest.fn(async (input: any) => {
      await input.options.onChunk('Resposta parcial.');
      return {
        content: 'Resposta grounded.',
        provider: 'gemini (gemini-3.8-flash)',
        citations: [{ sourceId: 'source-1' }],
        confidence: 0.8,
      };
    });
    const controller = new AIController({ runLex } as unknown as AiGroundingService);
    const events: string[] = [];
    const res: any = {
      headersSent: false,
      writableEnded: false,
      writeHead: jest.fn(function (this: any) {
        this.headersSent = true;
      }),
      write: jest.fn((event: string) => events.push(event)),
      end: jest.fn(function (this: any) {
        this.writableEnded = true;
      }),
    };

    await controller.consultar({
      body: {
        pergunta: 'O edital exige qualificação técnica?',
        noticeId: 'notice-1',
        stream: true,
      },
      query: {},
      headers: {},
      user: { id: 'user-1', tenantId: 'tenant-1' },
    } as any, res);

    expect(runLex).toHaveBeenCalledWith(
      expect.objectContaining({
        pergunta: 'O edital exige qualificação técnica?',
        noticeId: 'notice-1',
        purpose: 'ai_consultar',
        options: expect.objectContaining({ onChunk: expect.any(Function) }),
      }),
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(events.some((event) => event.includes('Resposta parcial.'))).toBe(true);
    expect(events.some((event) => event.includes('"sourceId":"source-1"'))).toBe(true);
    expect(events.some((event) => event.includes('"fullText":"Resposta grounded."'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });
});
