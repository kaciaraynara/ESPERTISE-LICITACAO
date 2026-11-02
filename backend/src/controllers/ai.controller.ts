import { Response } from 'express';
import { AiGroundingService } from '../services/ai-grounding.service';
import { chatWithProvider, streamGroundedResultToSse } from '../services/ai.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { handleLexError, groundedResponse } from './lex.controller';

export class AIController {
  constructor(
    private readonly grounding = new AiGroundingService(undefined, chatWithProvider),
  ) {}

  async consultar(req: AuthRequest, res: Response) {
    const body = req.body as {
      pergunta?: string;
      prompt?: string;
      contexto?: string;
      noticeId?: string;
      licitacaoId?: string;
      edital_id?: string;
      stream?: boolean;
      options?: {
        timeoutMs?: number;
        modelName?: string;
        skipCalculation?: boolean;
      };
    };
    const pergunta = String(body.pergunta ?? body.prompt ?? '').trim();
    const contexto = typeof body.contexto === 'string' ? body.contexto : undefined;
    const noticeId = body.noticeId || body.licitacaoId || body.edital_id || null;

    if (!pergunta) {
      return res.status(400).json({
        success: false,
        message: 'Digite uma pergunta para o assistente.',
      });
    }

    const isStream =
      body.stream === true ||
      req.query.stream === 'true' ||
      req.headers.accept?.includes('text/event-stream');

    if (isStream) {
      return streamGroundedResultToSse(
        res,
        (onChunk) => this.grounding.runLex(
          {
            pergunta,
            contexto,
            noticeId,
            purpose: 'ai_consultar',
            metadata: { endpoint: '/ai/consultar', role: req.user?.role ?? null },
            options: { ...body.options, onChunk },
          },
          buildGroundingContext(req),
        ),
        { endpoint: '/ai/consultar', noticeId },
      );
    }

    try {
      const resposta = await this.grounding.runLex(
        {
          pergunta,
          contexto,
          noticeId,
          purpose: 'ai_consultar',
          metadata: { endpoint: '/ai/consultar', role: req.user?.role ?? null },
          options: body.options,
        },
        buildGroundingContext(req),
      );

      return groundedResponse(res, resposta);
    } catch (error: any) {
      return handleLexError(res, error);
    }
  }
}

function buildGroundingContext(req: AuthRequest) {
  return {
    tenantId: req.user?.tenantId ?? null,
    user: {
      id: req.user?.id ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
      isAdmin: Boolean(req.user?.isAdmin),
      permissions: req.user?.permissions ?? [],
    },
    requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  };
}

function clientIp(req: AuthRequest) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}
