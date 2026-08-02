import { Response } from 'express';
import { AiGroundingService } from '../services/ai-grounding.service';
import { chatWithProvider } from '../services/ai.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

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
    };
    const pergunta = String(body.pergunta ?? body.prompt ?? '').trim();
    const contexto = typeof body.contexto === 'string' ? body.contexto : undefined;
    const noticeId = body.noticeId || body.licitacaoId || body.edital_id || null;

    if (!pergunta) {
      return res.status(400).json({
        success: false,
        message: 'Informe uma pergunta para o LEX IA.',
      });
    }

    try {
      const resposta = await this.grounding.runLex({
        pergunta,
        contexto,
        noticeId,
        purpose: 'ai_consultar',
        metadata: { endpoint: '/ai/consultar', role: req.user?.role ?? null },
      }, buildGroundingContext(req));

      if (resposta.blocked) {
        return res.status(422).json({
          success: false,
          message: resposta.content,
          data: resposta,
        });
      }

      return res.json({
        success: true,
        data: {
          resposta: resposta.content,
          provider: resposta.provider,
          aiRunId: resposta.aiRunId,
          retrievalSessionId: resposta.retrievalSessionId,
          legalAnalysisId: resposta.legalAnalysisId,
          citations: resposta.citations,
          sourceIds: resposta.sourceIds,
          chunkIds: resposta.chunkIds,
          ruleCodes: resposta.ruleCodes,
          confidence: resposta.confidence,
          limitations: resposta.limitations,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[LEX IA] Erro ao consultar provedor IA:', error);
      return res.status(500).json({
        success: false,
        message: 'O LEX IA está temporariamente indisponível.',
      });
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

