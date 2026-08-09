import { Request, Response } from 'express';
import { AiGroundingService } from '../services/ai-grounding.service';
import { chatWithProvider } from '../services/ai.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

export class LexController {
  private readonly grounding: AiGroundingService;

  constructor(groundingService?: AiGroundingService) {
    // Permite injeção de dependência para testes unitários ou usa a instância padrão
    this.grounding = groundingService || new AiGroundingService(undefined, chatWithProvider);
  }

  async chat(req: AuthRequest, res: Response) {
    try {
      const { messages, contextoEdital, noticeId, licitacaoId, edital_id } = (req.body || {}) as {
        messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
        contextoEdital?: string;
        noticeId?: string;
        licitacaoId?: string;
        edital_id?: string;
      };

      const pergunta = lastUserMessage(messages);
      if (!pergunta) {
        return res.status(400).json({ success: false, message: 'Mensagens inválidas' });
      }

      const result = await this.grounding.runLex(
        {
          pergunta,
          contexto: contextoEdital,
          noticeId: noticeId || licitacaoId || edital_id || null,
          purpose: 'lex_chat',
          metadata: { endpoint: '/lex/chat' },
        },
        buildGroundingContext(req)
      );

      return groundedResponse(res, result);
    } catch (err) {
      console.error('[LEX] Erro no chat grounded:', err);
      return res.status(500).json({
        success: false,
        message: 'O LEX está temporariamente indisponível. Tente novamente.',
      });
    }
  }

  async auditar(req: AuthRequest, res: Response) {
    try {
      const result = await this.grounding.runLex(
        {
          pergunta:
            'Audite preliminarmente o edital recuperado e liste apenas pontos de atenção sustentados pelas fontes do banco.',
          noticeId: resolveNoticeId(req),
          purpose: 'lex_auditoria_preliminar',
          metadata: { endpoint: '/lex/auditar' },
        },
        buildGroundingContext(req)
      );

      return groundedResponse(res, result);
    } catch (err) {
      console.error('[LEX] Erro na auditoria grounded:', err);
      return res.status(500).json({ success: false, message: 'Erro na auditoria LEX' });
    }
  }

  async resumo(req: AuthRequest, res: Response) {
    try {
      const result = await this.grounding.runLex(
        {
          pergunta:
            'Resuma o edital recuperado com foco em objeto, prazos, documentos exigidos, riscos operacionais e limitações da base.',
          noticeId: resolveNoticeId(req),
          purpose: 'lex_resumo_grounded',
          metadata: { endpoint: '/lex/resumo' },
        },
        buildGroundingContext(req)
      );

      return groundedResponse(res, result);
    } catch (err) {
      console.error('[LEX] Erro no resumo grounded:', err);
      return res.status(500).json({ success: false, message: 'Erro no resumo do edital' });
    }
  }

  async proposta(req: AuthRequest, res: Response) {
    try {
      const { nome_empresa } = (req.body || {}) as { nome_empresa?: string };
      const result = await this.grounding.runLex(
        {
          pergunta: `Liste insumos para proposta comercial de ${
            nome_empresa || 'empresa licitante'
          } somente com base no edital recuperado. Não invente preço, margem ou requisito ausente.`,
          noticeId: resolveNoticeId(req),
          purpose: 'lex_proposta_insumos_grounded',
          metadata: { endpoint: '/lex/proposta', nomeEmpresa: nome_empresa ?? null },
        },
        buildGroundingContext(req)
      );

      return groundedResponse(res, result);
    } catch (err) {
      console.error('[LEX] Erro na proposta grounded:', err);
      return res.status(500).json({ success: false, message: 'Erro na proposta LEX' });
    }
  }

  async impugnacao(req: AuthRequest, res: Response) {
    try {
      const { contexto } = (req.body || {}) as { contexto?: string };
      const result = await this.grounding.runLex(
        {
          pergunta:
            'Liste pontos de atenção que podem exigir revisão jurídica para eventual impugnação. Não redija peça final e não afirme ilegalidade.',
          contexto,
          noticeId: resolveNoticeId(req),
          purpose: 'lex_impugnacao_precheck',
          metadata: { endpoint: '/lex/impugnacao' },
        },
        buildGroundingContext(req)
      );

      return groundedResponse(res, result);
    } catch (err) {
      console.error('[LEX] Erro na impugnação grounded:', err);
      return res.status(500).json({ success: false, message: 'Erro ao gerar análise prévia LEX' });
    }
  }

  async gerarRecurso(req: AuthRequest, res: Response) {
    try {
      const { motivoDesclassificacao, contextoAdicional } = (req.body || {}) as {
        motivoDesclassificacao?: string;
        contextoAdicional?: string;
      };

      const instrucao = `
Aja como um advogado especialista em licitações públicas (Lei 14.133/2021). 
O cliente foi indevidamente desclassificado pelo seguinte motivo: "${motivoDesclassificacao || 'Motivo não especificado'}".
Contexto adicional: "${contextoAdicional || ''}".
Com base no edital recuperado e nas normativas do TCU aplicáveis, redija um esqueleto de RECURSO ADMINISTRATIVO fundamentado.
Cite os princípios da razoabilidade, proporcionalidade e vinculação ao instrumento convocatório, aplicados ao caso.
Gere a peça formatada em Markdown, pronta para o cliente revisar e assinar.
      `.trim();

      const result = await this.grounding.runLex(
        {
          pergunta: instrucao,
          noticeId: resolveNoticeId(req),
          purpose: 'lex_recurso_administrativo',
          metadata: { endpoint: '/lex/recurso' },
        },
        buildGroundingContext(req)
      );

      return groundedResponse(res, result);
    } catch (err) {
      console.error('[LEX] Erro ao gerar recurso grounded:', err);
      return res
        .status(500)
        .json({ success: false, message: 'Erro ao gerar recurso administrativo com LEX' });
    }
  }
}

function groundedResponse(
  res: Response,
  result: Awaited<ReturnType<AiGroundingService['runLex']>>
) {
  let parsedPayload: Record<string, any> = {};
  const rawText = (result.content || '').trim();

  // Tenta realizar o parse se a resposta for um JSON válido
  try {
    if (rawText.startsWith('{') || rawText.startsWith('[')) {
      parsedPayload = JSON.parse(rawText);
    } else {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsedPayload = JSON.parse(jsonMatch[1]);
      } else {
        // Se for texto/Markdown puro, encapsula na chave "resposta"
        parsedPayload = { resposta: rawText };
      }
    }
  } catch (e) {
    parsedPayload = { resposta: rawText };
  }

  // Garante que parsedPayload seja um objeto para evitar o bug do spread operator
  if (typeof parsedPayload !== 'object' || parsedPayload === null || Array.isArray(parsedPayload)) {
    parsedPayload = { resposta: parsedPayload };
  }

  const payload = {
    ...parsedPayload,
    _raw_resposta: result.content,
    aiRunId: result.aiRunId,
    retrievalSessionId: result.retrievalSessionId,
    legalAnalysisId: result.legalAnalysisId,
    provider: result.provider,
    citations: result.citations,
    sourceIds: result.sourceIds,
    chunkIds: result.chunkIds,
    ruleCodes: result.ruleCodes,
    confidence: result.confidence,
    limitations: result.limitations,
    timestamp: new Date().toISOString(),
  };

  if (result.blocked) {
    return res.status(422).json({
      success: false,
      message: result.content,
      data: payload,
    });
  }

  return res.json({ success: true, data: payload });
}

function lastUserMessage(messages?: Array<{ role: 'user' | 'assistant'; content: string }>) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }
  return null;
}

function resolveNoticeId(req: Request) {
  const params = req.params || {};
  const body = (req.body || {}) as {
    noticeId?: string;
    licitacaoId?: string;
    edital_id?: string;
    editalId?: string;
  };

  return (
    params.licitacaoId ||
    params.noticeId ||
    body.noticeId ||
    body.licitacaoId ||
    body.edital_id ||
    body.editalId ||
    null
  );
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
    requestId:
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      null,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'] || null,
  };
}

function clientIp(req: AuthRequest) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}