import { Request, Response } from 'express';
import { prisma } from '../database/prisma';

export class GuaranteesController {
  /**
   * Resolve o ID da empresa a partir do contexto ou busca a primeira vinculada ao usuário
   */
  private async resolveCompanyId(req: Request): Promise<string | null> {
    const headerCompanyId = req.headers['x-company-id'] || req.headers['X-Company-Id'];
    if (headerCompanyId && typeof headerCompanyId === 'string') {
      return headerCompanyId;
    }

    const userId = (req as any).user?.id;
    if (userId) {
      const company = await prisma.company.findFirst({
        where: { userId },
        select: { id: true },
      });
      return company?.id || null;
    }

    return null;
  }

  /**
   * GET /api/guarantees
   * Lista as garantias da empresa com métricas agregadas de cauções ativas e dinheiro retido
   */
  public list = async (req: Request, res: Response): Promise<Response> => {
    try {
      const companyId = await this.resolveCompanyId(req);

      const whereClause = companyId ? { companyId } : {};

      const items = await prisma.garantiaLicitacao.findMany({
        where: whereClause,
        orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
        include: {
          company: {
            select: { id: true, razaoSocial: true, cnpj: true },
          },
        },
      });

      // Cálculo de métricas financeiras
      let totalValorGarantido = 0;
      let totalCaucaoDinheiroRetido = 0;
      let totalSeguroGarantia = 0;
      let totalFiancaBancaria = 0;
      let ativasCount = 0;
      let vencendo30dCount = 0;

      const now = new Date();
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);

      const formattedItems = items.map((g) => {
        const val = Number(g.valor);
        const vencimento = new Date(g.dataVencimento);

        if (g.status === 'ATIVA' || g.status === 'EMITIDA') {
          ativasCount++;
          totalValorGarantido += val;

          if (g.modalidade === 'CAUCAO_DINHEIRO') {
            totalCaucaoDinheiroRetido += val;
          } else if (g.modalidade === 'SEGURO_GARANTIA') {
            totalSeguroGarantia += val;
          } else if (g.modalidade === 'FIANCA_BANCARIA') {
            totalFiancaBancaria += val;
          }

          if (vencimento <= in30Days && vencimento >= now) {
            vencendo30dCount++;
          }
        }

        return {
          id: g.id,
          companyId: g.companyId,
          empresaNome: g.company?.razaoSocial,
          tipo: g.tipo,
          modalidade: g.modalidade,
          instituicaoEmissora: g.instituicaoEmissora,
          numeroApolice: g.numeroApolice,
          valor: val,
          percentual: g.percentual ? Number(g.percentual) : null,
          dataEmissao: g.dataEmissao ? g.dataEmissao.toISOString().split('T')[0] : null,
          dataVencimento: g.dataVencimento.toISOString().split('T')[0],
          status: g.status,
          documentoUrl: g.documentoUrl,
          observacoes: g.observacoes,
          createdAt: g.createdAt.toISOString(),
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          summary: {
            totalGarantias: items.length,
            ativasCount,
            totalValorGarantido,
            totalCaucaoDinheiroRetido, // Dinheiro bloqueado em conta garantia
            totalSeguroGarantia,
            totalFiancaBancaria,
            vencendo30dCount,
          },
          items: formattedItems,
        },
      });
    } catch (error: any) {
      console.error('[GuaranteesController] Erro ao listar garantias:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar garantias licitatórias.',
      });
    }
  };

  /**
   * POST /api/guarantees
   * Cadastra nova garantia licitatória (Seguro-Garantia, Fiança Bancária ou Caução em Dinheiro)
   */
  public create = async (req: Request, res: Response): Promise<Response> => {
    try {
      const companyId = await this.resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Empresa não identificada no contexto da requisição.',
        });
      }

      const {
        tipo,
        modalidade,
        instituicaoEmissora,
        numeroApolice,
        valor,
        percentual,
        dataEmissao,
        dataVencimento,
        documentoUrl,
        observacoes,
      } = req.body;

      if (!valor || !dataVencimento || !modalidade) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios ausentes: valor, modalidade e dataVencimento.',
        });
      }

      const newGuarantee = await prisma.garantiaLicitacao.create({
        data: {
          companyId,
          tipo: tipo || 'EXECUCAO_CONTRATUAL',
          modalidade: modalidade || 'SEGURO_GARANTIA',
          instituicaoEmissora: instituicaoEmissora || null,
          numeroApolice: numeroApolice || null,
          valor: Number(valor),
          percentual: percentual ? Number(percentual) : null,
          dataEmissao: dataEmissao ? new Date(dataEmissao) : null,
          dataVencimento: new Date(dataVencimento),
          status: 'ATIVA',
          documentoUrl: documentoUrl || null,
          observacoes: observacoes || null,
        },
      });

      return res.status(201).json({
        success: true,
        data: newGuarantee,
      });
    } catch (error: any) {
      console.error('[GuaranteesController] Erro ao cadastrar garantia:', error);
      return res.status(500).json({
        success: false,
        message: 'Não foi possível cadastrar a garantia no momento.',
      });
    }
  };

  /**
   * PUT /api/guarantees/:id
   * Atualiza status ou dados de uma garantia existente
   */
  public update = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      const { status, observacoes, dataVencimento, valor } = req.body;

      const updated = await prisma.garantiaLicitacao.update({
        where: { id },
        data: {
          status: status !== undefined ? status : undefined,
          observacoes: observacoes !== undefined ? observacoes : undefined,
          dataVencimento: dataVencimento ? new Date(dataVencimento) : undefined,
          valor: valor !== undefined ? Number(valor) : undefined,
        },
      });

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error('[GuaranteesController] Erro ao atualizar garantia:', error);
      return res.status(500).json({
        success: false,
        message: 'Falha ao atualizar registro de garantia.',
      });
    }
  };

  /**
   * GET /api/guarantees/alerts
   * Retorna certidões com validade crítica (< 15 dias ou expiradas) para o banner global
   */
  public getCertificateAlerts = async (req: Request, res: Response): Promise<Response> => {
    try {
      const companyId = await this.resolveCompanyId(req);

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + 15);

      const whereCompany = companyId ? { companyId } : {};

      const certs = await prisma.companyCertificate.findMany({
        where: {
          ...whereCompany,
          OR: [
            { expirationDate: { lte: thresholdDate } },
            { status: { in: ['WARNING', 'EXPIRED'] } },
          ],
        },
        orderBy: { expirationDate: 'asc' },
      });

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const criticalAlerts = certs.map((c) => {
        const expDate = new Date(c.expirationDate);
        const diffMs = expDate.getTime() - now.getTime();
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          tipo: c.type,
          dataValidade: expDate.toISOString().split('T')[0],
          diasRestantes,
          isExpired: diasRestantes <= 0,
          status: c.status,
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          hasCriticalAlert: criticalAlerts.length > 0,
          totalCriticas: criticalAlerts.length,
          alerts: criticalAlerts,
        },
      });
    } catch (error: any) {
      console.error('[GuaranteesController] Erro ao buscar alertas de CNDs:', error);
      return res.status(500).json({
        success: false,
        data: { hasCriticalAlert: false, totalCriticas: 0, alerts: [] },
      });
    }
  };
}

export const guaranteesController = new GuaranteesController();

