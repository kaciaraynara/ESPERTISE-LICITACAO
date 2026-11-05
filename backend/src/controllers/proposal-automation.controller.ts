import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import {
  proposalAutomationService,
  ProposalExportFormat,
} from '../services/proposal-automation.service';

export class ProposalAutomationController {
  /**
   * POST /api/proposals/generate (e /api/v1/proposals/generate)
   * Hidrata os dados reais da empresa logada no Prisma + valores da calculadora de impostos
   * (Custo, IVA Dual, Margem, Stop-Loss) e retorna o binário (.docx ou .xlsx) gerado em memória.
   */
  public generate = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Usuário não autenticado.',
        });
      }

      const {
        format,
        companyId,
        pregaoId,
        noticeId,
        orgao,
        objeto,
        custoInsumos,
        despesasOperacionais,
        margemLucroDesejada,
        margemMinimaStopLoss,
        bidAmount,
        validadeDias,
      } = req.body ?? {};

      const parsedCusto = Number(custoInsumos);
      if (!Number.isFinite(parsedCusto) || parsedCusto <= 0) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_COST_INPUT',
          message: 'Informe um Custo Direto de Insumos maior que zero na calculadora antes de gerar a proposta.',
        });
      }

      const normalizedFormat: ProposalExportFormat =
        String(format || 'docx').toLowerCase() === 'xlsx' ? 'xlsx' : 'docx';

      const generated = await proposalAutomationService.generateHydratedProposal({
        userId,
        companyId: companyId || req.companyId,
        format: normalizedFormat,
        pregaoId,
        noticeId,
        orgao,
        objeto,
        custoInsumos: parsedCusto,
        despesasOperacionais:
          despesasOperacionais !== undefined ? Number(despesasOperacionais) : undefined,
        margemLucroDesejada:
          margemLucroDesejada !== undefined ? Number(margemLucroDesejada) : undefined,
        margemMinimaStopLoss:
          margemMinimaStopLoss !== undefined ? Number(margemMinimaStopLoss) : undefined,
        bidAmount:
          bidAmount !== undefined && Number(bidAmount) > 0 ? Number(bidAmount) : undefined,
        validadeDias: validadeDias !== undefined ? Number(validadeDias) : 60,
      });

      res.setHeader('Content-Type', generated.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${generated.filename}"`,
      );
      res.setHeader('Content-Length', String(generated.buffer.length));

      return res.status(200).send(generated.buffer);
    } catch (error: any) {
      console.error('[ProposalAutomationController] Erro ao gerar proposta hidratada:', error);
      return res.status(500).json({
        success: false,
        code: 'PROPOSAL_GENERATION_FAILED',
        message: error?.message || 'Não foi possível gerar o documento da proposta comercial.',
      });
    }
  };
}

export const proposalAutomationController = new ProposalAutomationController();

