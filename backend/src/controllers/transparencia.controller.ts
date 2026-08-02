import { Request, Response } from 'express';
import { transparenciaApi } from '../services/transparencia/transparencia-api.service';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';

function getAuthenticatedUserId(req: AuthRequest) {
  return req.user?.id ?? null;
}

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    message: 'Usuário autenticado não identificado.',
  });
}

export class TransparenciaController {

  /**
   * GET /transparencia/empresa/:cnpj
   * Consulta dados de fornecedor no Portal da Transparência
   */
  async consultarEmpresa(req: AuthRequest, res: Response) {
    const { cnpj } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido. Informe um CNPJ com 14 dígitos.',
      });
    }

    const result = await transparenciaApi.consultarEmpresa(userId, cnpj);

    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Consulta indisponível no momento. Tente novamente em alguns minutos.',
        meta: result.meta,
      });
    }

    return res.json(result);
  }

  /**
   * GET /transparencia/penalidades?cnpj=xxx&pagina=1
   * Consulta penalidades/sanções (CEIS)
   */
  async consultarPenalidades(req: AuthRequest, res: Response) {
    const { cnpj, pagina } = req.query;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await transparenciaApi.consultarPenalidades(userId, {
      cnpj: cnpj as string | undefined,
      pagina: pagina ? Number(pagina) : undefined,
    });

    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Consulta de penalidades indisponível no momento.',
        meta: result.meta,
      });
    }

    return res.json(result);
  }

  /**
   * GET /transparencia/licitacoes?dataInicial=xxx&dataFinal=xxx&codigoOrgao=xxx&pagina=1
   * Consulta licitações
   */
  async consultarLicitacoes(req: AuthRequest, res: Response) {
    const { dataInicial, dataFinal, codigoOrgao, pagina } = req.query;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await transparenciaApi.consultarLicitacoes(userId, {
      dataInicial: dataInicial as string | undefined,
      dataFinal: dataFinal as string | undefined,
      codigoOrgao: codigoOrgao as string | undefined,
      pagina: pagina ? Number(pagina) : undefined,
    });

    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Consulta de licitações indisponível no momento.',
        meta: result.meta,
      });
    }

    return res.json(result);
  }

  /**
   * GET /transparencia/contratos?cnpj=xxx&dataInicial=xxx&dataFinal=xxx&pagina=1
   * Consulta contratos
   */
  async consultarContratos(req: AuthRequest, res: Response) {
    const { cnpj, dataInicial, dataFinal, pagina } = req.query;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await transparenciaApi.consultarContratos(userId, {
      cnpj: cnpj as string | undefined,
      dataInicial: dataInicial as string | undefined,
      dataFinal: dataFinal as string | undefined,
      pagina: pagina ? Number(pagina) : undefined,
    });

    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Consulta de contratos indisponível no momento.',
        meta: result.meta,
      });
    }

    return res.json(result);
  }

  /**
   * GET /transparencia/cepim/:cnpj
   * Consulta CEPIM
   */
  async consultarCepim(req: AuthRequest, res: Response) {
    const { cnpj } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido.',
      });
    }

    const result = await transparenciaApi.consultarCepim(userId, cnpj);

    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Consulta CEPIM indisponível no momento.',
        meta: result.meta,
      });
    }

    return res.json(result);
  }

  /**
   * GET /transparencia/cnep/:cnpj
   * Consulta CNEP (Empresas Punidas)
   */
  async consultarCnep(req: AuthRequest, res: Response) {
    const { cnpj } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido.',
      });
    }

    const result = await transparenciaApi.consultarCnep(userId, cnpj);

    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Consulta CNEP indisponível no momento.',
        meta: result.meta,
      });
    }

    return res.json(result);
  }

  /**
   * GET /transparencia/health
   * Status do token e métricas
   */
  async health(_req: Request, res: Response) {
    const tokenHealth = transparenciaApi.getTokenHealth();
    const metrics = transparenciaApi.getMetrics(60);
    const cacheStats = transparenciaApi.getCacheStats();

    return res.json({
      success: true,
      data: {
        token: tokenHealth,
        metrics,
        cache: cacheStats,
      },
    });
  }

  /**
   * GET /transparencia/metrics?window=60
   * Métricas detalhadas
   */
  async metrics(req: Request, res: Response) {
    const windowMinutes = req.query.window ? Number(req.query.window) : 60;
    const metrics = transparenciaApi.getMetrics(windowMinutes);
    const logs = transparenciaApi.getRecentLogs(20);

    return res.json({
      success: true,
      data: { metrics, recentLogs: logs },
    });
  }

  /**
   * POST /transparencia/cache/clean
   * Limpa caches expirados
   */
  async cleanCache(_req: Request, res: Response) {
    const removed = await transparenciaApi.cleanExpiredCache();
    return res.json({
      success: true,
      message: `${removed} registros expirados removidos do cache.`,
    });
  }
}
