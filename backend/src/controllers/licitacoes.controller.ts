import { Response } from 'express';

import { FiltrosBusca } from '../interfaces/pncp.interface';
import {
  buscarLicitacaoPorNumeroControle,
  listarLicitacoes,
  sincronizarLicitacoesPNCP,
  NoticePersistenceError,
} from '../services/licitacoes.service';
import { PncpServiceError } from '../services/pncp.service';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';

function stringParam(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

function buildFiltros(source: Record<string, unknown>): FiltrosBusca {
  const rawSrp = source.srp;
  return {
    palavraChave:
      stringParam(source.palavraChave)
      ?? stringParam(source.palavrasChave)
      ?? stringParam(source.busca)
      ?? stringParam(source.search)
      ?? stringParam(source.q)
      ?? stringParam(source.termo),
    uf: stringParam(source.uf),
    dataInicial:
      stringParam(source.dataInicial)
      ?? stringParam(source.dataInicio),
    dataFinal:
      stringParam(source.dataFinal)
      ?? stringParam(source.dataFim),
    codigoModalidadeContratacao:
      stringParam(source.codigoModalidadeContratacao)
      ?? stringParam(source.modalidade),
    pagina: stringParam(source.pagina) ?? stringParam(source.page),
    tamanhoPagina:
      stringParam(source.tamanhoPagina)
      ?? stringParam(source.limite)
      ?? stringParam(source.limit)
      ?? stringParam(source.size),
    srp: rawSrp === true || rawSrp === 'true',
  };
}

function sendPncpError(
  res: Response,
  error: unknown,
): Response {
  if (error instanceof NoticePersistenceError || (error as any)?.code === 'NOTICE_PERSISTENCE_FAILED') {
    return res.status(500).json({
      success: false,
      code: 'NOTICE_PERSISTENCE_FAILED',
      message: (error as Error).message || 'Falha ao persistir edital no banco local.',
    });
  }

  if (error instanceof PncpServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  console.error('[Radar PNCP] Falha inesperada ao consultar editais.', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });

  return res.status(503).json({
    success: false,
    code: 'PNCP_UNAVAILABLE',
    message: 'A fonte oficial do PNCP está temporariamente indisponível.',
  });
}

export class LicitacoesController {
  public listar = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const filtros = buildFiltros(req.query as Record<string, unknown>);
      const userId = req.user?.id;
      const resultado = await listarLicitacoes(filtros, userId, req.user?.tenantId);

      return res.json({
        success: true,
        data: resultado.data,
        meta: {
          fonte: 'PNCP',
          pagina: resultado.pagina,
          tamanhoPagina: resultado.tamanhoPagina,
          totalRegistros: resultado.totalRegistros,
          totalPaginas: resultado.totalPaginas,
          atualizadoEm: new Date().toISOString(),
          perfilRadar: resultado.perfilRadar
            ? {
                cnaes: resultado.perfilRadar.cnaes,
                palavras_chave: resultado.perfilRadar.palavras_chave,
              }
            : null,
          aviso: resultado.aviso,
        },
      });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public sincronizar = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const filtros = buildFiltros((req.body as Record<string, unknown>) || {});
      const resultado = await sincronizarLicitacoesPNCP(filtros);

      return res.json({
        success: true,
        message: `${resultado.totalSincronizados} editais sincronizados com sucesso do PNCP.`,
        data: {
          totalSincronizados: resultado.totalSincronizados,
          items: resultado.items,
        },
        meta: {
          fonte: 'PNCP',
          atualizadoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public buscarPorId = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const id = String(req.params.id ?? '');
      const licitacao = await buscarLicitacaoPorNumeroControle(id);

      return res.json({ success: true, data: licitacao });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public monitorar = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const id = String(req.body.id ?? '');
      const userId = req.user?.id;
      
      if (!id) return res.status(400).json({ success: false, message: 'ID (numeroControlePNCP) obrigatório' });
      if (!userId) return res.status(401).json({ success: false, message: 'Usuário não autenticado' });

      const { prisma } = require('../database/prisma');
      const company = await resolveAuthorizedCompany(userId, req.body?.companyId || req.companyId);
      if (!company) return res.status(404).json({ success: false, message: 'Empresa não encontrada' });

      // Search full details on PNCP
      const licitacao = await buscarLicitacaoPorNumeroControle(id);
      
      // Upsert ProcurementNotice to local DB
      const notice = await prisma.procurementNotice.upsert({
        where: { dedupeKey: `pncp-${licitacao.numeroControlePNCP}` },
        create: {
          source: 'PNCP',
          externalId: licitacao.numeroControlePNCP,
          dedupeKey: `pncp-${licitacao.numeroControlePNCP}`,
          contentHash: licitacao.numeroControlePNCP,
          noticeNumber: licitacao.processo || licitacao.numeroCompra || licitacao.numeroControlePNCP,
          modality: licitacao.modalidade,
          buyerName: licitacao.orgao,
          buyerDocument: licitacao.cnpjOrgao,
          object: licitacao.objeto,
          uf: licitacao.uf,
          municipality: licitacao.municipio,
          estimatedValue: licitacao.valorEstimado,
          status: licitacao.situacao,
          url: licitacao.link,
          publishedAt: licitacao.dataPublicacao ? new Date(licitacao.dataPublicacao) : null,
          openingAt: licitacao.dataAbertura ? new Date(licitacao.dataAbertura) : null,
          closingAt: licitacao.dataEncerramento ? new Date(licitacao.dataEncerramento) : null,
        },
        update: {
          estimatedValue: licitacao.valorEstimado,
          status: licitacao.situacao,
          url: licitacao.link,
          closingAt: licitacao.dataEncerramento ? new Date(licitacao.dataEncerramento) : null,
        }
      });

      // Link to CompanyMonitoredNotice
      const monitor = await prisma.companyMonitoredNotice.create({
        data: {
          companyId: company.id,
          userId: userId,
          procurementNoticeId: notice.id,
          status: 'monitoring'
        }
      });

      return res.json({ success: true, message: 'Edital monitorado com sucesso', data: monitor });
    } catch (error: any) {
      if (error?.code === 'P2002') {
         return res.json({ success: true, message: 'Edital já está sendo monitorado' });
      }
      return sendPncpError(res, error);
    }
  };
}
