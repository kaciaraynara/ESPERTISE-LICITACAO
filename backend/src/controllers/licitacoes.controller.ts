import { enviarAlertaEditaisCnae } from '../services/resend.service';
import { queryPcaFromDb } from '../services/pca-sync.service';
import { expandirTermosCnae } from '../services/cnae-dictionary.service';
import { scaleCacheGet, scaleCacheSet, scaleSingleflight } from '../services/scale-cache.service';
import { prisma } from '../database/prisma';
import {
  buildCompanyCnaeTerms,
  evaluateNoticeViability,
  filtrarAvaliacoesAderentes,
} from '../services/cnae-compatibility.service';
const __radarFastCache = new Map<string, { ts: number; body: any }>();
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
  buscarPcasPNCP,
} from '../services/pncp.service';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';
import { proposalAutomationService } from '../services/proposal-automation.service';
import { ensureFreshPncpSync } from '../jobs/radar.cron';
import { syncComprasGovRecentes } from '../services/comprasgov.service';
import { syncQueridoDiarioEditais } from '../services/querido-diario.service';
import {
  estimarPerfilRadar,
  RADAR_RAMOS_CATALOG,
  sugerirPerfilRadar,
} from '../services/radar-profile-suggester.service';

const radarSyncState: {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lastTotalSincronizados: number | null;
  lastError: string | null;
} = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastTotalSincronizados: null,
  lastError: null,
};

function stringParam(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

function buildFiltros(source: Record<string, unknown>): FiltrosBusca {
  const rawSrp = source.srp;
  const isExplicitTempoReal = source.tempoReal === true || source.tempoReal === 'true';
  const isLocalOnly = source.local === true || source.local === 'true';
  const rawApenasAbertos = source.apenasAbertos;
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
    cnae: stringParam(source.cnae),
    uf: stringParam(source.uf),
    ufs: Array.isArray(source.ufs) ? source.ufs.map(String) : undefined,
    palavras: Array.isArray(source.palavras)
      ? source.palavras.map(String)
      : stringParam(source.palavras),
    orgao:
      stringParam(source.orgao)
      ?? stringParam(source.orgaoNome)
      ?? stringParam(source.razaoSocial),
    dataInicial:
      stringParam(source.dataInicial)
      ?? stringParam(source.dataInicio),
    dataFinal:
      stringParam(source.dataFinal)
      ?? stringParam(source.dataFim),
    dataPublicacao: stringParam(source.dataPublicacao),
    codigoModalidadeContratacao:
      stringParam(source.codigoModalidadeContratacao)
      ?? stringParam(source.modalidade),
    pagina: stringParam(source.pagina) ?? stringParam(source.page),
    tamanhoPagina:
      stringParam(source.tamanhoPagina)
      ?? stringParam(source.limite)
      ?? stringParam(source.limit)
      ?? stringParam(source.size)
      ?? '100',
    valorMin:
      source.valorMin !== undefined && source.valorMin !== '' && Number.isFinite(Number(source.valorMin))
        ? Number(source.valorMin)
        : undefined,
    valorMax:
      source.valorMax !== undefined && source.valorMax !== '' && Number.isFinite(Number(source.valorMax))
        ? Number(source.valorMax)
        : undefined,
    srp: rawSrp === true || rawSrp === 'true',
    baixaProcura: source.baixaProcura === true || source.baixaProcura === 'true',
    tipoObjeto:
      stringParam(source.tipoObjeto)
      ?? stringParam(source.tipo_objeto)
      ?? stringParam(source.objectType),
    incluirSemClassificacao:
      source.incluirSemClassificacao === undefined
        ? undefined
        : (source.incluirSemClassificacao === true || source.incluirSemClassificacao === 'true'),
    modoRemoto: stringParam(source.modoRemoto) ?? stringParam(source.remoteMode),
    ordenarPor: (stringParam(source.ordenarPor) ?? stringParam(source.sort)) as FiltrosBusca['ordenarPor'],
    fonte: stringParam(source.fonte),
    apenasAbertos:
      rawApenasAbertos === true || rawApenasAbertos === 'true'
        ? true
        : rawApenasAbertos === false || rawApenasAbertos === 'false'
          ? false
          : undefined,
    local: isLocalOnly,
    endpoint: source.endpoint === 'publicacao' ? 'publicacao' : 'proposta',
    tempoReal: isExplicitTempoReal,
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
      // sync movido para cron em background
      const filtros = buildFiltros(req.query as Record<string, unknown>);
      const userId = req.user?.id;
      const cacheKey = `radar:list:${userId || 'anon'}:${req.user?.tenantId || 'global'}:${JSON.stringify(filtros)}`;
      const resultado = await scaleSingleflight(cacheKey, 20, () =>
        listarLicitacoes(filtros, userId, req.user?.tenantId),
      );

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
          facets: resultado.facets ?? null,
          tempoBuscaMs: resultado.tempoBuscaMs ?? null,
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

  private runFullSync = async (filtros: FiltrosBusca) => {
    const [pncpPropRes, pncpPubRes, comprasRes, queridoRes] = await Promise.allSettled([
      sincronizarLicitacoesPNCP({ ...filtros, endpoint: 'proposta' }),
      sincronizarLicitacoesPNCP({ ...filtros, endpoint: 'publicacao' }),
      syncComprasGovRecentes({ daysBack: 3, maxPages: 1 }),
      syncQueridoDiarioEditais({ daysBack: 7, size: 40 }),
    ]);

    if (pncpPropRes.status === 'rejected' && pncpPubRes.status === 'rejected') {
      throw pncpPropRes.reason;
    }

    const itemsMap = new Map<string, any>();
    let pncpTotal = 0;
    for (const resItem of [pncpPropRes, pncpPubRes]) {
      if (resItem.status === 'fulfilled') {
        pncpTotal += resItem.value.totalSincronizados;
        for (const it of resItem.value.items) {
          if (!itemsMap.has(it.numeroControlePNCP)) {
            itemsMap.set(it.numeroControlePNCP, it);
          }
        }
      }
    }

    const extrasCompras = comprasRes.status === 'fulfilled' ? comprasRes.value.persisted : 0;
    const extrasQuerido = queridoRes.status === 'fulfilled' ? queridoRes.value.persisted : 0;
    const totalSincronizados = pncpTotal + extrasCompras + extrasQuerido;

    return {
      totalSincronizados,
      items: Array.from(itemsMap.values()),
    };
  };

  public sincronizar = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const body = (req.body as Record<string, unknown>) || {};
      const filtros = buildFiltros(body);
      const isAsync = body.async === true || body.async === 'true';

      if (isAsync) {
        if (radarSyncState.running) {
          return res.status(202).json({
            success: true,
            status: 'already_running',
            message: 'Sincronização em andamento em segundo plano.',
            data: { ...radarSyncState },
          });
        }

        radarSyncState.running = true;
        radarSyncState.startedAt = new Date().toISOString();
        radarSyncState.lastError = null;

        void this.runFullSync(filtros)
          .then((result) => {
            radarSyncState.running = false;
            radarSyncState.finishedAt = new Date().toISOString();
            radarSyncState.lastTotalSincronizados = result.totalSincronizados;
          })
          .catch((err: any) => {
            radarSyncState.running = false;
            radarSyncState.finishedAt = new Date().toISOString();
            radarSyncState.lastError = err?.message || 'Falha na sincronização em segundo plano.';
          });

        return res.status(202).json({
          success: true,
          status: 'started',
          message: 'Sincronização iniciada em segundo plano.',
          data: { ...radarSyncState },
        });
      }

      const result = await this.runFullSync(filtros);

      return res.json({
        success: true,
        message: `${result.totalSincronizados} editais sincronizados com sucesso (PNCP + Compras.gov.br + Diários Oficiais).`,
        data: result,
        meta: {
          fonte: 'MULTIFONTE',
          atualizadoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public statusSincronizacao = async (
    _req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    return res.json({
      success: true,
      data: { ...radarSyncState },
    });
  };

  public listarRamos = async (
    _req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    return res.json({
      success: true,
      data: RADAR_RAMOS_CATALOG.map((r) => ({
        id: r.id,
        label: r.label,
        palavras: r.palavras,
        tiposObjeto: r.tiposObjeto,
      })),
    });
  };

  public sugerirPerfil = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const body = (req.body as Record<string, unknown>) || {};
      const data = await sugerirPerfilRadar({
        descricao: typeof body.descricao === 'string' ? body.descricao : undefined,
        cnae: typeof body.cnae === 'string' ? body.cnae : undefined,
        ramos: Array.isArray(body.ramos) ? body.ramos.map(String) : undefined,
        ufs: Array.isArray(body.ufs) ? body.ufs.map(String) : undefined,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public estimarPerfil = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const body = (req.body as Record<string, unknown>) || {};
      const data = await estimarPerfilRadar({
        palavras: Array.isArray(body.palavras) ? body.palavras.map(String) : undefined,
        tiposObjeto: Array.isArray(body.tiposObjeto) ? body.tiposObjeto.map(String) : undefined,
        incluirSemClassificacao:
          body.incluirSemClassificacao === undefined ? true : Boolean(body.incluirSemClassificacao),
        ufs: Array.isArray(body.ufs) ? body.ufs.map(String) : undefined,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };

  public avaliarViabilidade = async (
    req: AuthRequest,
    res: Response,
  ): Promise<Response> => {
    try {
      const body = (req.body as Record<string, unknown>) || {};
      const requestedCompanyId = typeof body.companyId === 'string' && body.companyId.trim()
        ? body.companyId.trim()
        : (req.user?.companyId || null);
      const ufParam = typeof body.uf === 'string' && body.uf.trim() && body.uf !== 'TODOS'
        ? body.uf.trim().toUpperCase()
        : null;
      const limit = Math.min(200, Math.max(20, Number(body.limit) || 120));

      const company = await prisma.company.findFirst({
        where: requestedCompanyId
          ? { id: requestedCompanyId }
          : req.user?.id
            ? { userId: req.user.id }
            : undefined,
        select: {
          id: true,
          razaoSocial: true,
          porte: true,
          uf: true,
          cnaePrincipal: true,
          palavrasChave: true,
          nicho: true,
        },
      });

      const companyProfile = {
        cnaePrincipal: company?.cnaePrincipal || (typeof body.cnaePrincipal === 'string' ? body.cnaePrincipal : null),
        cnaesSecundarios: Array.isArray(body.cnaesSecundarios)
          ? body.cnaesSecundarios.map(String)
          : [],
        palavrasChave: Array.isArray(company?.palavrasChave)
          ? company.palavrasChave
          : Array.isArray(body.palavrasChave)
            ? body.palavrasChave.map(String)
            : [],
        nicho: Array.isArray(company?.nicho) ? company.nicho : [],
        uf: company?.uf || (typeof body.companyUf === 'string' ? body.companyUf : null),
        porte: company?.porte || 'ME/EPP',
      };

      let docsStats = {
        carregado: false,
        documentosCofre: 0,
        certidoesValidas: 0,
        certidoesPendentes: 0,
      };

      if (company?.id) {
        const docs = await prisma.document.findMany({
          where: { companyId: company.id },
          select: { status: true, validade: true, tipo: true },
        });
        const now = new Date();
        const validos = docs.filter((d) => d.status === 'valido' && (!d.validade || new Date(d.validade) >= now));
        const pendentes = docs.filter((d) => d.status !== 'valido' || (d.validade && new Date(d.validade) < now));
        docsStats = {
          carregado: true,
          documentosCofre: docs.length,
          certidoesValidas: validos.length,
          certidoesPendentes: pendentes.length,
        };
      }

      const now = new Date();
      const termsInfo = buildCompanyCnaeTerms(companyProfile);
      const searchTerms = termsInfo.positiveTerms.slice(0, 8);

      const baseWhere: any = {
        closingAt: { gt: now },
        ...(ufParam ? { uf: ufParam } : {}),
      };

      const matchedNotices = searchTerms.length > 0
        ? await prisma.procurementNotice.findMany({
            where: {
              ...baseWhere,
              AND: [
                {
                  OR: searchTerms.map((t) => ({
                    object: { contains: t, mode: 'insensitive' as const },
                  })),
                },
              ],
            },
            include: { items: { select: { description: true }, take: 25 } },
            orderBy: { publishedAt: 'desc' },
            take: limit,
          })
        : [];

      const avaliacoes = matchedNotices
        .map((n) => {
          const meta = (typeof n.metadata === 'object' && n.metadata ? n.metadata : {}) as Record<string, any>;
          const extractedSpecs = meta.extractedSpecsJson || null;
          const extractedItems = Array.isArray(extractedSpecs?.secoes?.objetoContratacao?.itensDetalhados)
            ? extractedSpecs.secoes.objetoContratacao.itensDetalhados
            : Array.isArray(extractedSpecs?.itensDetalhados)
              ? extractedSpecs.itensDetalhados
              : [];

          const result = evaluateNoticeViability(
            {
              object: n.object,
              uf: n.uf,
              estimatedValue: n.estimatedValue ? Number(n.estimatedValue) : null,
              closingAt: n.closingAt,
              openingAt: n.openingAt,
              items: n.items,
              extractedItems,
            },
            companyProfile,
            docsStats,
          );

          return {
            edital: {
              id: n.id,
              numeroControlePNCP: n.numeroControlePncp || n.externalId || n.id,
              objetoCompra: n.object,
              objeto: n.object,
              nomeOrgao: n.buyerName,
              orgao: n.buyerName,
              uf: n.uf,
              municipio: n.municipality,
              modalidade: n.modality,
              valorTotalEstimado: n.estimatedValue ? Number(n.estimatedValue) : null,
              valorEstimado: n.estimatedValue ? Number(n.estimatedValue) : null,
              dataEncerramentoProposta: n.closingAt ? n.closingAt.toISOString() : null,
              dataAberturaProposta: n.openingAt ? n.openingAt.toISOString() : null,
              urlOficialPncp: n.url,
              metadata: n.metadata,
            },
            ...result,
            statusLeitura: meta.deepReadStatus === 'DONE' || meta.deepReadStatus === 'COMPLETO' || meta.extractedSpecsJson
              ? 'COMPLETO'
              : 'PENDENTE',
          };
        })
        .sort((a, b) => b.pontuacao - a.pontuacao);

      const { aderentes, foraDoPerfil } = filtrarAvaliacoesAderentes(avaliacoes);

      return res.json({
        success: true,
        data: aderentes,
        foraDoPerfil,
        totalAderentes: aderentes.length,
        filtroAplicado: {
          uf: ufParam || 'TODOS',
          cnaePrincipal: companyProfile.cnaePrincipal,
          cnaesSecundarios: companyProfile.cnaesSecundarios,
          termosBusca: searchTerms,
        },
        docsStatus: docsStats,
        empresa: company
          ? {
              id: company.id,
              razaoSocial: company.razaoSocial,
              cnaePrincipal: company.cnaePrincipal,
              uf: company.uf,
              porte: company.porte,
            }
          : null,
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

      let companyId = stringParam(req.query.companyId) || req.companyId;
      const tenantId = req.user?.tenantId;
      if (!companyId && req.user?.id) {
        try {
          const authCompany = await resolveAuthorizedCompany(req.user.id, tenantId);
          if (authCompany?.id) companyId = authCompany.id;
        } catch {}
      }

      try {
        const resultado = await proposalAutomationService.syncNoticeItemsWithCatalog(
          id,
          companyId,
          tenantId,
        );

        return res.json({
          success: true,
          data: resultado.items,
          total: resultado.total,
          valorTotalItens: resultado.valorTotalItens,
          totalComMatch: resultado.totalComMatch,
          notice: resultado.notice,
        });
      } catch (syncErr) {
        console.warn('[LicitacoesController.obterItens] Fallback para consulta direta PNCP:', syncErr);
        const licitacao = await buscarLicitacaoPorNumeroControle(id);
        const parsed = parsePncpControlNumber(licitacao?.numeroControlePNCP || id);

        let itens: any[] = [];
        if (parsed) {
          itens = await buscarItensPNCP(parsed.cnpj, parsed.ano, parsed.sequencial);
        } else if (licitacao?.cnpjOrgao && (licitacao as any).anoCompra && (licitacao as any).sequencialCompra) {
          itens = await buscarItensPNCP(licitacao.cnpjOrgao, (licitacao as any).anoCompra, (licitacao as any).sequencialCompra);
        }

        const valorTotalItens = itens.reduce((acc: number, it: any) => acc + (Number(it.valorTotal) || 0), 0);

        return res.json({
          success: true,
          data: itens,
          total: itens.length,
          valorTotalItens,
        });
      }
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
  listarPcas = async (req: AuthRequest, res: Response) => {
    try {
      const rawAno = req.query.ano ?? req.query.anoPca;
      const ano = rawAno ? Number(rawAno) : undefined;
      const pagina = req.query.pagina ? Number(req.query.pagina) : 1;
      const tamanhoPagina = req.query.tamanhoPagina ? Number(req.query.tamanhoPagina) : 20;
      const q = stringParam(req.query.q) ?? stringParam(req.query.termo);
      const uf = stringParam(req.query.uf);
      const cnae = stringParam(req.query.cnae);
      const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';

      const pcaArgs = {
        anoPca: ano,
        pagina,
        tamanhoPagina,
        palavraChave: q,
        uf,
        cnae,
        forceRefresh,
      };
      const resultado = forceRefresh
        ? await queryPcaFromDb(pcaArgs)
        : await scaleSingleflight(`pca:list:${JSON.stringify(pcaArgs)}`, 30, () => queryPcaFromDb(pcaArgs));

      return res.json({
        success: true,
        data: resultado.items,
        ...resultado,
      });
    } catch (error) {
      return sendPncpError(res, error);
    }
  };
  enviarAlertaAgora = async (req: AuthRequest, res: Response) => {
    try {
      const { prisma } = require('../database/prisma');
      const headerCid = String(req.headers['x-company-id'] || '').trim();
      const company = await prisma.company.findFirst({ where: { tenantId: req.user?.tenantId, ...(headerCid ? { id: headerCid } : {}) } });
      const email = (company as any)?.email || req.user?.email;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Cadastre um e-mail na sua conta ou empresa para receber alertas.' });
      }
      const cnae = company?.cnaePrincipal || '';
      const uf = company?.uf || undefined;
      const palavras = Array.isArray((company as any)?.palavrasChave) ? (company as any).palavrasChave.slice(0, 3).join(' ') : '';

      const busca = await listarLicitacoes({
        local: true,
        apenasAbertos: true,
        ...(cnae ? { cnae } : {}),
        ...(palavras ? { palavraChave: palavras } : {}),
        ...(uf ? { uf } : {}),
        tamanhoPagina: 8,
      }, req.user?.id, req.user?.tenantId);

      const editais = (busca.data || []).slice(0, 8).map((item: any) => ({
        titulo: item.objeto || item.objetoCompra || 'Licitação compatível',
        orgao: item.orgao || item.nomeOrgao || 'Órgão Público',
        valorEstimado: item.valorEstimado ?? item.valorTotalEstimado ?? undefined,
        link: `https://www.expertiselicitatoria.com.br/fornecedor/radar`,
      }));

      if (editais.length === 0) {
        return res.json({ success: true, sent: 0, message: 'Nenhum edital aberto encontrado para o seu CNAE/UF no momento.' });
      }

      const envio = await enviarAlertaEditaisCnae({
        email,
        empresaNome: company?.razaoSocial || 'Sua Empresa',
        cnae: cnae || 'Geral',
        editais,
      });

      return res.json({
        success: true,
        sent: editais.length,
        email,
        message: `${editais.length} edital(is) recomendado(s) enviado(s) para ${email}!`,
        id: envio?.id,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Erro ao enviar alertas por e-mail.' });
    }
  };
}