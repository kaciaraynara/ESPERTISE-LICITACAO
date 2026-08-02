import { Response } from 'express';

import { FiltrosBusca } from '../interfaces/pncp.interface';
import {
  buscarLicitacaoPorNumeroControle,
  listarLicitacoes,
} from '../services/licitacoes.service';
import { PncpServiceError } from '../services/pncp.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

function stringParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

function buildFiltros(source: Record<string, unknown>): FiltrosBusca {
  return {
    palavraChave:
      stringParam(source.palavraChave)
      ?? stringParam(source.palavrasChave)
      ?? stringParam(source.busca),
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
    pagina: stringParam(source.pagina),
    tamanhoPagina:
      stringParam(source.tamanhoPagina)
      ?? stringParam(source.limite),
  };
}

function sendPncpError(
  res: Response,
  error: unknown,
): Response {
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
      if (userId && !filtros.palavraChave) {
        const { prisma } = require('../database/prisma');
        const company = await prisma.company.findFirst({ where: { userId } });
        if (company?.cnaePrincipal) {
           filtros.palavraChave = company.cnaePrincipal;
        }
      }

      const resultado = await listarLicitacoes(filtros);

      return res.json({
        success: true,
        data: resultado.data,
        meta: {
          fonte: 'PNCP',
          pagina: resultado.pagina,
          tamanhoPagina: resultado.tamanhoPagina,
          totalRegistros: resultado.totalRegistros,
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
      const company = await prisma.company.findFirst({ where: { userId } });
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
