import { Response } from 'express';
import {
  ProposalServiceError,
  proposalService,
} from '../services/proposal.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { createProposalDraftSchema } from '../shared/validations/proposal.validation';

export class PropostasController {
  async criarRascunho(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'unauthenticated',
        message: 'Usuário não autenticado.',
      });
    }

    const input = createProposalDraftSchema.parse(req.body);

    try {
      const proposta = await proposalService.createDraft(userId, input);

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
}
