import { Response } from 'express';

import { FiltrosBusca } from '../interfaces/pncp.interface';
import {
  buscarLicitacaoPorNumeroControle,
  listarLicitacoes,
  sincronizarLicitacoesPNCP,
  NoticePersistenceError,
} from '../services/licitacoes.service';
import {
  PncpServiceError,
  buscarItensPNCP,
  buscarArquivosPNCP,
  parsePncpControlNumber,
} from '../services/pncp.service';
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
  const isLocalOnly = source.local === true || source.local === 'true' || source.tempoReal === false || source.tempoReal === 'false';
  return {
    palavraChave:
      stringParam(source.palavraChave)
      ?? stringParam(source.palavrasChave)
      ?? stringParam(source.busca)
      ?? stringParam(source.search)
      ?? stringParam(source.q)
      ?? stringParam(source.termo),
    cnpj:
      stringParam(source.cnpj)
      ?? stringParam(source.cnpjOrgao)
      ?? stringParam(source.cnpj_orgao),
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
    endpoint: source.endpoint === 'publicacao' ? 'publicacao' : 'proposta',
    tempoReal: !isLocalOnly,
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

  public obterDownloadUrl = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const id = String(req.params.id ?? '').trim();
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID do edital obrigatório' });
      }

      const licitacao = await buscarLicitacaoPorNumeroControle(id);
      const parsed = parsePncpControlNumber(licitacao?.numeroControlePNCP || id);

      if (parsed) {
        const urlWebPncp = `https://pncp.gov.br/app/editais/${parsed.cnpj}/${parsed.ano}/${parsed.sequencial}`;
        return res.json({ success: true, downloadUrl: urlWebPncp, urlWebPncp });
      }

      if (licitacao) {
        const rawCnpj = String(licitacao.cnpjOrgao || '').replace(/\D/g, '');
        const rawAno = (licitacao as any).anoCompra || (licitacao.dataPublicacao ? new Date(licitacao.dataPublicacao).getFullYear() : null);
        const rawSeq = (licitacao as any).sequencialCompra || (licitacao.numeroCompra ? String(licitacao.numeroCompra).replace(/\D/g, '') : null);

        if (rawCnpj.length === 14 && rawAno && rawSeq) {
          const urlWebPncp = `https://pncp.gov.br/app/editais/${rawCnpj}/${Number(rawAno)}/${Number(rawSeq)}`;
          return res.json({ success: true, downloadUrl: urlWebPncp, urlWebPncp });
        }

        const downloadUrl = (licitacao as any).linkDownloadEdital || (licitacao as any).documento_url || (licitacao as any).link;
        if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
          return res.json({ success: true, downloadUrl });
        }
      }

      return res.status(404).json({
        success: false,
        message: 'Anexo indisponível no momento',
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'Servidor do governo instável',
      });
    }
  };

  public obterItens = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const id = String(req.params.id ?? '').trim();
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID do edital obrigatório' });
      }

      const licitacao = await buscarLicitacaoPorNumeroControle(id);
      const parsed = parsePncpControlNumber(licitacao?.numeroControlePNCP || id);

      let itens: any[] = [];
      if (parsed) {
        itens = await buscarItensPNCP(parsed.cnpj, parsed.ano, parsed.sequencial);
      } else if (licitacao?.cnpjOrgao && (licitacao as any).anoCompra && (licitacao as any).sequencialCompra) {
        itens = await buscarItensPNCP(licitacao.cnpjOrgao, (licitacao as any).anoCompra, (licitacao as any).sequencialCompra);
      }

      return res.json({
        success: true,
        data: itens,
        total: itens.length,
      });
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

  public salvar = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
      }

      const {
        id,
        noticeId,
        numeroControlePNCP,
        orgao,
        cnpjOrgao,
        objeto,
        valorEstimado,
        dataLimite,
        urlOficialPncp,
        modalidade,
        itens,
      } = req.body || {};

      const targetId = String(numeroControlePNCP || noticeId || id || '').trim();
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'numeroControlePNCP ou ID do edital é obrigatório' });
      }

      const { prisma } = require('../database/prisma');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

      let notice = await prisma.procurementNotice.findFirst({
        where: {
          OR: [
            ...(isUuid ? [{ id: targetId }] : []),
            { externalId: targetId },
            { dedupeKey: `pncp-${targetId}` },
            { dedupeKey: targetId },
          ],
        },
      });

      if (!notice) {
        let licitacaoPncp: any = null;
        if (!orgao || !objeto) {
          try {
            licitacaoPncp = await buscarLicitacaoPorNumeroControle(targetId, { requirePersistence: false });
          } catch {
            // Usa payload enviado pelo frontend
          }
        }

        const ctrl = licitacaoPncp?.numeroControlePNCP || targetId;
        const parsed = parsePncpControlNumber(ctrl);
        const computedUrl = urlOficialPncp
          || licitacaoPncp?.urlOficialPncp
          || (parsed ? `https://pncp.gov.br/app/editais/${parsed.cnpj}/${parsed.ano}/${parsed.sequencial}` : 'https://pncp.gov.br/app/editais');

        notice = await prisma.procurementNotice.upsert({
          where: { dedupeKey: `pncp-${ctrl}` },
          create: {
            source: 'PNCP',
            externalId: ctrl,
            dedupeKey: `pncp-${ctrl}`,
            contentHash: ctrl,
            noticeNumber: licitacaoPncp?.processo || licitacaoPncp?.numeroCompra || ctrl,
            modality: modalidade || licitacaoPncp?.modalidade || 'Pregão Eletrônico',
            buyerName: orgao || licitacaoPncp?.orgao || 'Órgão Licitante',
            buyerDocument: cnpjOrgao || licitacaoPncp?.cnpjOrgao || parsed?.cnpj || null,
            object: objeto || licitacaoPncp?.objeto || 'Objeto da contratação',
            uf: licitacaoPncp?.uf || '',
            municipality: licitacaoPncp?.municipio || '',
            estimatedValue: valorEstimado !== undefined && valorEstimado !== null
              ? Number(valorEstimado)
              : licitacaoPncp?.valorEstimado ?? null,
            status: licitacaoPncp?.situacao || 'Publicada',
            url: computedUrl,
            closingAt: dataLimite ? new Date(dataLimite) : (licitacaoPncp?.dataEncerramento ? new Date(licitacaoPncp.dataEncerramento) : null),
            rawPayload: Array.isArray(itens) ? { itens, urlOficialPncp: computedUrl } : { urlOficialPncp: computedUrl },
          },
          update: {
            ...(valorEstimado !== undefined && valorEstimado !== null ? { estimatedValue: Number(valorEstimado) } : {}),
            ...(urlOficialPncp ? { url: urlOficialPncp } : {}),
            ...(Array.isArray(itens) ? { rawPayload: { itens, urlOficialPncp: computedUrl } } : {}),
          },
        });
      } else if (Array.isArray(itens) && itens.length > 0) {
        const existingPayload = (notice.rawPayload && typeof notice.rawPayload === 'object') ? notice.rawPayload : {};
        notice = await prisma.procurementNotice.update({
          where: { id: notice.id },
          data: {
            rawPayload: { ...existingPayload, itens, ...(urlOficialPncp ? { urlOficialPncp } : {}) },
          },
        });
      }

      const existingPipeline = await prisma.biddingPipeline.findFirst({
        where: {
          userId,
          noticeId: notice.id,
        },
      });

      const savedPipeline = existingPipeline || await prisma.biddingPipeline.create({
        data: {
          userId,
          noticeId: notice.id,
          stage: 'OPORTUNIDADE',
          position: 0,
        },
      });

      return res.status(existingPipeline ? 200 : 201).json({
        success: true,
        message: 'Edital adicionado à sua lista de propostas',
        data: {
          id: notice.id,
          pipelineId: savedPipeline.id,
          numeroControlePNCP: notice.externalId || notice.noticeNumber,
          orgao: notice.buyerName,
          objeto: notice.object,
          valorEstimado: notice.estimatedValue ? Number(notice.estimatedValue) : null,
          dataLimite: notice.closingAt ? notice.closingAt.toISOString() : null,
          urlOficialPncp: urlOficialPncp || notice.url,
          itens: Array.isArray(itens) ? itens : (notice.rawPayload as any)?.itens || [],
        },
      });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public listarSalvos = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
      }

      const { prisma } = require('../database/prisma');
      const pipelines = await prisma.biddingPipeline.findMany({
        where: { userId },
        include: {
          notice: {
            include: {
              items: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = pipelines
        .filter((p: any) => Boolean(p.notice))
        .map((p: any) => {
          const n = p.notice;
          const ctrl = n.externalId || n.noticeNumber || n.id;
          const parsed = parsePncpControlNumber(ctrl);
          const urlOficialPncp =
            (n.rawPayload as any)?.urlOficialPncp
            || (parsed ? `https://pncp.gov.br/app/editais/${parsed.cnpj}/${parsed.ano}/${parsed.sequencial}` : n.url)
            || 'https://pncp.gov.br/app/editais';

          const rawItens = Array.isArray(n.items) && n.items.length > 0
            ? n.items.map((it: any, idx: number) => ({
                numeroItem: it.itemNumber ?? idx + 1,
                descricao: it.description || '',
                quantidade: it.quantity ? Number(it.quantity) : 1,
                unidadeMedida: it.unit || 'UN',
                valorUnitarioEstimado: it.estimatedUnitValue ? Number(it.estimatedUnitValue) : 0,
              }))
            : Array.isArray((n.rawPayload as any)?.itens)
              ? (n.rawPayload as any).itens
              : [];

          return {
            id: n.id,
            pipelineId: p.id,
            noticeId: n.id,
            numeroControlePNCP: ctrl,
            numeroEdital: n.noticeNumber || ctrl,
            orgao: n.buyerName || 'Órgão Licitante',
            cnpjOrgao: n.buyerDocument || parsed?.cnpj || null,
            modalidade: n.modality || 'Pregão Eletrônico',
            objeto: n.object || '',
            valorEstimado: n.estimatedValue ? Number(n.estimatedValue) : null,
            dataLimite: n.closingAt ? n.closingAt.toISOString() : null,
            dataAbertura: n.openingAt ? n.openingAt.toISOString() : null,
            urlOficialPncp,
            itens: rawItens,
          };
        });

      return res.json({
        success: true,
        data,
        total: data.length,
      });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };
}
