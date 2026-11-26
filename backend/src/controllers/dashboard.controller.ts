import { Response } from 'express';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { scaleSingleflight } from '../services/scale-cache.service';
import { expandirTermosCnae } from '../services/cnae-dictionary.service';
import { keywordsForCnae } from '../services/cnae-to-keywords.service';
import { habilitacaoService } from '../services/habilitacao.service';

export interface PortalDisputaInfo {
  nome: string;
  link: string;
  isOficial: boolean;
}

/**
 * Identifica o portal oficial de disputa do edital com base em links e metadados
 */
export function detectarPortalDisputa(notice: any): PortalDisputaInfo {
  const url = String(notice.url || '').toLowerCase();
  const raw = (notice.rawPayload || {}) as any;
  const meta = (notice.metadata || {}) as any;
  const linkSistemaOrigem = String(raw.linkSistemaOrigem || meta.linkSistemaOrigem || raw.linkOrigem || meta.linkOrigem || '').toLowerCase();
  const sistemaOrigemNome = String(raw.sistemaOrigem || meta.sistemaOrigem || raw.nomeSistema || meta.nomeSistema || '').toLowerCase();
  const source = String(notice.source || '').toLowerCase();

  const allText = `${url} ${linkSistemaOrigem} ${sistemaOrigemNome} ${source}`;

  if (allText.includes('compras.gov') || allText.includes('comprasnet') || allText.includes('uasg')) {
    return {
      nome: 'Compras.gov.br',
      link: raw.linkSistemaOrigem || notice.url || 'https://www.gov.br/compras/pt-br',
      isOficial: true,
    };
  }
  if (allText.includes('bll') || allText.includes('bllcompras')) {
    return {
      nome: 'BLL Compras',
      link: raw.linkSistemaOrigem || notice.url || 'https://bllcompras.com',
      isOficial: true,
    };
  }
  if (allText.includes('bnc') || allText.includes('bnccompras')) {
    return {
      nome: 'BNC Compras',
      link: raw.linkSistemaOrigem || notice.url || 'https://bnc.org.br',
      isOficial: true,
    };
  }
  if (allText.includes('licitanet')) {
    return {
      nome: 'Licitanet',
      link: raw.linkSistemaOrigem || notice.url || 'https://licitanet.com.br',
      isOficial: true,
    };
  }
  if (allText.includes('portaldecompraspublicas') || allText.includes('compras publicas') || allText.includes('compraspublicas')) {
    return {
      nome: 'Portal de Compras Públicas',
      link: raw.linkSistemaOrigem || notice.url || 'https://www.portaldecompraspublicas.com.br',
      isOficial: true,
    };
  }
  if (allText.includes('licitacoes-e') || allText.includes('licitacoes_e') || allText.includes('banco do brasil')) {
    return {
      nome: 'Licitações-e (BB)',
      link: raw.linkSistemaOrigem || notice.url || 'https://www.licitacoes-e.com.br',
      isOficial: true,
    };
  }
  if (allText.includes('queridodiario') || allText.includes('diario oficial') || allText.includes('imprensa nacional') || allText.includes('dou')) {
    return {
      nome: 'Diário Oficial',
      link: raw.linkSistemaOrigem || notice.url || 'https://queridodiario.ok.org.br',
      isOficial: true,
    };
  }

  const pncpUrl = notice.numeroControlePncp || notice.externalId
    ? `https://pncp.gov.br/app/editais/${notice.numeroControlePncp || notice.externalId}`
    : notice.url || 'https://pncp.gov.br';

  return {
    nome: 'PNCP Oficial',
    link: raw.linkSistemaOrigem || pncpUrl,
    isOficial: true,
  };
}

export class DashboardController {
  async getMetrics(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);

      // Se a empresa ainda não tiver sido criada para este usuário
      if (!company) {
        return res.json({
          success: true,
          data: {
            isContaNova: true,
            companyName: 'Sua Empresa',
            kpis: {
              oportunidadesAbertasCount: 0,
              oportunidadesAbertasValor: 0,
              encerram5DiasCount: 0,
              documentosTotal: 0,
              documentosValidos: 0,
              documentosPendentes: 0,
              documentosResumo: 'Nenhum documento cadastrado',
              propostasAtivasCount: 0,
              disputasAtivasCount: 0,
              totalAtivas: 0,
            },
            oportunidadesDestaque: [],
            proximosPrazos: [],
            documentosAtencao: [],
          },
        });
      }

      const metricsData = await scaleSingleflight(
        `dashboard:metrics:${userId}:${company.id}`,
        15,
        async () => {
          const now = new Date();
          const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
          const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

          // 1. Termos de aderência estrita por CNAE e palavras-chave da empresa
          const cnaeAlvo = company.cnaePrincipal;
          const palavrasEmpresa = Array.isArray(company.palavrasChave) ? company.palavrasChave : [];
          const termosCnae = cnaeAlvo ? expandirTermosCnae(cnaeAlvo) : [];
          const termosKws = cnaeAlvo ? keywordsForCnae(cnaeAlvo) : [];
          const termosBusca = Array.from(new Set([...palavrasEmpresa, ...termosCnae, ...termosKws]))
            .map((t) => String(t).trim())
            .filter((t) => t.length >= 4);

          // Condição rigorosa de data futura (ZERO EDITAL VENCIDO)
          const whereAbertosSegmento: any = {
            publishedAt: { lte: now },
            AND: [
              {
                OR: [
                  { closingAt: { gte: now } },
                  {
                    AND: [
                      { closingAt: null },
                      { openingAt: { gte: now } },
                    ],
                  },
                ],
              },
            ],
          };

          if (termosBusca.length > 0) {
            whereAbertosSegmento.AND.push({
              OR: termosBusca.slice(0, 12).map((termo) => ({
                object: { contains: termo, mode: 'insensitive' },
              })),
            });
          }

          // Execução paralela de consultas dedicadas para a empresa ativa
          const [
            oportunidadesAbertasCount,
            oportunidadesAbertasAggr,
            encerram5DiasCount,
            editaisDestaqueRaw,
            habStatus,
            propostasAtivasCount,
            editaisMonitoradosCount,
            deadlinesList,
            monitoredNoticesList,
          ] = await Promise.all([
            // KPI 1: Quantidade de editais abertos no segmento
            prisma.procurementNotice.count({ where: whereAbertosSegmento }),
            // KPI 1 (Valor): Soma em R$ dos editais abertos no segmento (filtra valores absurdos/outliers > 500M)
            prisma.procurementNotice.aggregate({
              where: {
                ...whereAbertosSegmento,
                AND: [
                  ...whereAbertosSegmento.AND,
                  { estimatedValue: { gt: 0, lte: 500000000 } },
                ],
              },
              _sum: { estimatedValue: true },
            }),
            // KPI 2: Encerram nos próximos 5 dias
            prisma.procurementNotice.count({
              where: {
                ...whereAbertosSegmento,
                AND: [
                  ...whereAbertosSegmento.AND,
                  {
                    OR: [
                      { closingAt: { gte: now, lte: in5Days } },
                      {
                        AND: [
                          { closingAt: null },
                          { openingAt: { gte: now, lte: in5Days } },
                        ],
                      },
                    ],
                  },
                ],
              },
            }),
            // Tabela: Oportunidades abertas em destaque do segmento (Top 12)
            prisma.procurementNotice.findMany({
              where: whereAbertosSegmento,
              take: 12,
              orderBy: [
                { closingAt: { sort: 'asc', nulls: 'last' } },
                { openingAt: { sort: 'asc', nulls: 'last' } },
                { publishedAt: { sort: 'desc', nulls: 'last' } },
              ],
              select: {
                id: true,
                buyerName: true,
                buyerDocument: true,
                uf: true,
                municipality: true,
                object: true,
                estimatedValue: true,
                modality: true,
                publishedAt: true,
                openingAt: true,
                closingAt: true,
                url: true,
                numeroControlePncp: true,
                externalId: true,
                rawPayload: true,
                metadata: true,
                source: true,
              },
            }),
            // KPI 3 & Painel Lateral B: Os 13 documentos reais da tela de Habilitação
            habilitacaoService.obterStatusDocumentos(userId, company.id).catch(() => null),
            // KPI 4: Propostas comerciais ativas
            prisma.proposal.count({
              where: {
                companyId: company.id,
                status: { not: 'CANCELADA' },
              },
            }),
            // KPI 4: Editais monitorados / em disputa
            prisma.companyMonitoredNotice.count({
              where: { companyId: company.id },
            }),
            // Painel Lateral A: Deadlines cadastradas
            prisma.deadline.findMany({
              where: {
                companyId: company.id,
                status: { notIn: ['DONE', 'CONCLUIDO'] },
                dueAt: { gte: now },
              },
              orderBy: { dueAt: 'asc' },
              take: 5,
              include: {
                procurementNotice: { select: { id: true, noticeNumber: true, object: true } },
              },
            }),
            // Painel Lateral A: Próximas sessões de editais monitorados
            prisma.companyMonitoredNotice.findMany({
              where: {
                companyId: company.id,
                procurementNotice: {
                  OR: [
                    { openingAt: { gte: now } },
                    { closingAt: { gte: now } },
                  ],
                },
              },
              take: 5,
              include: {
                procurementNotice: {
                  select: {
                    id: true,
                    noticeNumber: true,
                    buyerName: true,
                    object: true,
                    openingAt: true,
                    closingAt: true,
                  },
                },
              },
            }),
          ]);

          // Formatação dos editais em destaque com detecção do portal real e data futura estrita
          const oportunidadesDestaque = editaisDestaqueRaw.map((ed: any) => {
            const closeDate = ed.closingAt ? new Date(ed.closingAt) : null;
            const openDate = ed.openingAt ? new Date(ed.openingAt) : null;
            const dataSessao = closeDate && closeDate >= now
              ? ed.closingAt
              : (openDate && openDate >= now ? ed.openingAt : null);

            let diasRestantes: number | null = null;
            let prazoLabel = 'Data a consultar';

            if (dataSessao) {
              const sessaoDate = new Date(dataSessao);
              const fmtDiaBr = (d: Date) =>
                new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
              const hojeBr = fmtDiaBr(now);
              const sessaoBr = fmtDiaBr(sessaoDate);

              if (sessaoBr <= hojeBr) {
                diasRestantes = 0;
                prazoLabel = 'Encerra hoje';
              } else {
                const diffDays = Math.round(
                  (new Date(`${sessaoBr}T00:00:00Z`).getTime() - new Date(`${hojeBr}T00:00:00Z`).getTime()) /
                    (1000 * 60 * 60 * 24),
                );
                diasRestantes = Math.max(1, diffDays);
                if (diasRestantes === 1) {
                  prazoLabel = 'Encerra amanhã';
                } else {
                  prazoLabel = `Encerra em ${diasRestantes} dias`;
                }
              }
            }

            const portal = detectarPortalDisputa(ed);

            return {
              id: ed.id,
              orgao: ed.buyerName || 'Órgão Licitante Oficial',
              localizacao: `${ed.municipality ? `${ed.municipality} - ` : ''}${ed.uf || 'Nacional'}`,
              uf: ed.uf || 'BR',
              objeto: ed.object,
              valorEstimado: ed.estimatedValue && Number(ed.estimatedValue) <= 500000000 ? Number(ed.estimatedValue) : null,
              modalidade: ed.modality || 'Pregão Eletrônico',
              dataSessao,
              diasRestantes,
              prazoLabel,
              portalDisputa: portal,
            };
          });

          // Consolidação real dos 13 documentos da Habilitação
          const itensHab = Array.isArray(habStatus?.itens) ? habStatus.itens : [];
          const totalDocumentos = itensHab.length > 0 ? itensHab.length : 13;
          const documentosValidos = itensHab.filter(
            (it: any) => it.situacao === 'PRONTO' || it.situacao === 'VENCE_EM_BREVE',
          ).length;

          const documentosAtencao = itensHab
            .filter((it: any) => it.situacao !== 'PRONTO')
            .slice(0, 6)
            .map((doc: any) => {
              let diasRestantes: number | null = null;
              let statusLabel = doc.situacao === 'VENCIDO' ? 'Vencido' : 'Pendente';

              if (doc.validade) {
                const diffMs = new Date(doc.validade).getTime() - now.getTime();
                diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                if (diasRestantes <= 0) {
                  statusLabel = 'Vencido';
                } else if (diasRestantes <= 15) {
                  statusLabel = `Vence em ${diasRestantes} dias`;
                }
              }

              return {
                id: doc.documentoId || String(doc.codigo),
                nome: doc.nome || 'Documento de Habilitação',
                tipo: doc.etapaNome || 'Habilitação',
                validade: doc.validade || null,
                diasRestantes,
                statusLabel,
              };
            });

          // Consolidação dos próximos prazos e sessões da empresa
          const proximosPrazosMap = new Map<string, any>();

          for (const d of deadlinesList) {
            proximosPrazosMap.set(`deadline-${d.id}`, {
              id: d.id,
              titulo: d.title,
              data: d.dueAt,
              tipo: 'Prazo Legal',
              edital: d.procurementNotice?.noticeNumber || 'Certame',
              link: `/fornecedor/leitor-editais?edital=${d.procurementNotice?.id || ''}`,
            });
          }

          for (const m of monitoredNoticesList) {
            const ed = m.procurementNotice;
            if (ed && (ed.openingAt || ed.closingAt)) {
              const dataRef = ed.openingAt || ed.closingAt;
              proximosPrazosMap.set(`session-${ed.id}`, {
                id: ed.id,
                titulo: `Sessão Pública - ${ed.buyerName || 'Órgão'}`,
                data: dataRef,
                tipo: 'Sessão de Lances',
                edital: ed.noticeNumber || ed.id.slice(0, 8),
                link: `/fornecedor/leitor-editais?edital=${ed.id}`,
              });
            }
          }

          const proximosPrazos = Array.from(proximosPrazosMap.values())
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
            .slice(0, 6);

          const documentosPendentes = totalDocumentos - documentosValidos;
          const documentosResumo = documentosPendentes > 0
            ? `${documentosValidos} de ${totalDocumentos} documentos prontos (${documentosPendentes} pendentes)`
            : `${documentosValidos} de ${totalDocumentos} documentos em dia (100% regular)`;

          return {
            isContaNova: oportunidadesAbertasCount === 0 && propostasAtivasCount === 0 && totalDocumentos === 0,
            companyId: company.id,
            companyName: company.razaoSocial,
            cnaePrincipal: company.cnaePrincipal,
            kpis: {
              oportunidadesAbertasCount,
              oportunidadesAbertasValor: oportunidadesAbertasAggr._sum?.estimatedValue
                ? Number(oportunidadesAbertasAggr._sum.estimatedValue)
                : 0,
              encerram5DiasCount,
              documentosTotal: totalDocumentos,
              documentosValidos,
              documentosPendentes,
              documentosResumo,
              propostasAtivasCount,
              disputasAtivasCount: editaisMonitoradosCount,
              totalAtivas: propostasAtivasCount + editaisMonitoradosCount,
            },
            oportunidadesDestaque,
            proximosPrazos,
            documentosAtencao,
          };
        },
      );

      return res.json({
        success: true,
        data: metricsData,
      });
    } catch (error) {
      console.error('[DashboardController] Erro ao carregar métricas:', error);
      return res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
  }
}
