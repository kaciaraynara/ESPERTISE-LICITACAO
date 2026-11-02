import { Response } from 'express';
import {
  ProposalServiceError,
  proposalService,
} from '../services/proposal.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import {
  createProposalDraftSchema,
  createProposalItemSchema,
  updateProposalSchema,
} from '../shared/validations/proposal.validation';
import { incrementPlanUsage } from '../shared/middlewares/plan-limits.middleware';

export class PropostasController {
  async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const companyId = (req.query.companyId as string | undefined) || req.companyId;
      const propostas = await proposalService.list(userId, { companyId });

      return res.json({
        success: true,
        data: propostas,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async criarRascunho(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const payload = {
        ...req.body,
        companyId: req.body?.companyId || req.companyId,
      };
      const input = createProposalDraftSchema.parse(payload);
      const proposta = await proposalService.createDraft(userId, input);
      void incrementPlanUsage(userId, 'proposals');

      return res.status(201).json({
        success: true,
        data: proposta,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async atualizarProposta(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const input = updateProposalSchema.parse(req.body ?? {});
      const proposal = await proposalService.updateProposal(userId, proposalId, input);

      return res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async adicionarItem(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const input = createProposalItemSchema.parse(req.body);
      const item = await proposalService.addItem(userId, proposalId, input);

      return res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async atualizarItem(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const itemId = req.params.itemId;
      const item = await proposalService.updateItem(userId, proposalId, itemId, req.body ?? {});

      return res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async removerItem(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const itemId = req.params.itemId;
      const result = await proposalService.removeItem(userId, proposalId, itemId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async obterProposta(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const proposal = await proposalService.getById(userId, proposalId);

      return res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async validarCompliance(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const report = await proposalService.validateCompliance(userId, proposalId);

      return res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  async gerarDocumentoOficial(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const proposalId = req.params.id;
      const result = await proposalService.generateOfficialProposalDocument(userId, proposalId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ProposalServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }
}
