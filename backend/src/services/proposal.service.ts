import { prisma } from '../database/prisma';
import type { CreateProposalDraftInput } from '../shared/validations/proposal.validation';
import { getPlanLimits } from './plans/plan.constants';
import { planGuardService } from './plans/plan-guard.service';

export class ProposalServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProposalServiceError';
  }
}

export class ProposalService {
  async createDraft(userId: string, input: CreateProposalDraftInput) {
    const planId = await planGuardService.resolveUserPlan(userId);
    const proposalLimit = getPlanLimits(planId).maxProposalsMonth;

    return prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: {
          id: input.companyId,
          userId,
        },
        select: {
          id: true,
          tenantId: true,
        },
      });

      if (!company) {
        throw new ProposalServiceError(
          'company_not_found',
          404,
          'Empresa não encontrada para o usuário autenticado.',
        );
      }

      if (proposalLimit !== null) {
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);

        const proposalsCreatedThisMonth = await tx.proposal.count({
          where: {
            company: {
              tenantId: company.tenantId,
            },
            createdAt: {
              gte: monthStart,
            },
          },
        });

        if (proposalsCreatedThisMonth >= proposalLimit) {
          throw new ProposalServiceError(
            'proposal_monthly_limit_reached',
            403,
            `O plano ${planId} permite até ${proposalLimit} proposta(s) por mês.`,
          );
        }
      }

      if (
        input.responsibleUserId &&
        input.responsibleUserId !== userId
      ) {
        throw new ProposalServiceError(
          'invalid_responsible_user',
          403,
          'O responsável informado não pertence à conta autenticada.',
        );
      }

      if (input.procurementNoticeId) {
        const notice = await tx.procurementNotice.findUnique({
          where: {
            id: input.procurementNoticeId,
          },
          select: {
            id: true,
          },
        });

        if (!notice) {
          throw new ProposalServiceError(
            'procurement_notice_not_found',
            404,
            'Edital não encontrado.',
          );
        }
      }

      return tx.proposal.create({
        data: {
          companyId: company.id,
          procurementNoticeId: input.procurementNoticeId ?? null,
          titulo: input.titulo,
          status: 'RASCUNHO',
          moeda: input.moeda,
          validadeDias: input.validadeDias ?? null,
          validadeAte: input.validadeAte
            ? new Date(input.validadeAte)
            : null,
          prazoEntregaDias: input.prazoEntregaDias ?? null,
          condicoesPagamento: input.condicoesPagamento ?? null,
          garantia: input.garantia ?? null,
          observacoes: input.observacoes ?? null,
          createdById: userId,
          responsibleUserId: input.responsibleUserId ?? userId,
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });
  }
}

export const proposalService = new ProposalService();
