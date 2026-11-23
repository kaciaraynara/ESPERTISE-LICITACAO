import { Response } from 'express';
import { DeadlineType } from '@prisma/client';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';
import { calcularPrazoDecadencialImpugnacao } from '../utils/prazos.util';
import { scaleCacheInvalidatePrefix, scaleSingleflight } from '../services/scale-cache.service';

const DEADLINE_TYPE_MAP: Record<string, DeadlineType> = {
  SESSAO_PUBLICA: DeadlineType.SESSAO_PUBLICA,
  SESSAO: DeadlineType.SESSAO_PUBLICA,
  CLARIFICATION: DeadlineType.CLARIFICATION,
  ESCLARECIMENTO: DeadlineType.CLARIFICATION,
  IMPUGNATION: DeadlineType.IMPUGNATION,
  IMPUGNACAO: DeadlineType.IMPUGNACAO,
  PROPOSAL_SUBMISSION: DeadlineType.PROPOSAL_SUBMISSION,
  PROPOSTA: DeadlineType.PROPOSAL_SUBMISSION,
  DISPUTE_SESSION: DeadlineType.DISPUTE_SESSION,
  DISPUTA: DeadlineType.DISPUTE_SESSION,
  APPEAL: DeadlineType.APPEAL,
  RECURSO: DeadlineType.APPEAL,
  COUNTER_ARGUMENT: DeadlineType.COUNTER_ARGUMENT,
  CONTRARRAZOES: DeadlineType.COUNTER_ARGUMENT,
  CERTIFICATE_EXPIRATION: DeadlineType.CERTIFICATE_EXPIRATION,
  CERTIDAO: DeadlineType.CERTIFICATE_EXPIRATION,
  INTERNAL_REVIEW: DeadlineType.INTERNAL_REVIEW,
  REVISAO_INTERNA: DeadlineType.INTERNAL_REVIEW,
  OTHER: DeadlineType.OTHER,
  OUTROS: DeadlineType.OTHER,
  INTENTION_TO_APPEAL: DeadlineType.INTENTION_TO_APPEAL,
  INTENCAO_RECURSO: DeadlineType.INTENTION_TO_APPEAL,
  INTENCAO_DE_RECURSO: DeadlineType.INTENTION_TO_APPEAL,
  HABILITATION_COMPLEMENT: DeadlineType.HABILITATION_COMPLEMENT,
  HABILITACAO_COMPLEMENTAR: DeadlineType.HABILITATION_COMPLEMENT,
  COMPLEMENTACAO_HABILITACAO: DeadlineType.HABILITATION_COMPLEMENT,
  DILIGENCIA: DeadlineType.HABILITATION_COMPLEMENT,
  CONTRACT_SIGNING: DeadlineType.CONTRACT_SIGNING,
  ASSINATURA_CONTRATO: DeadlineType.CONTRACT_SIGNING,
  CONTRATO: DeadlineType.CONTRACT_SIGNING,
  ASSINATURA: DeadlineType.CONTRACT_SIGNING,
};

function resolveDeadlineType(input?: string): DeadlineType {
  if (!input || typeof input !== 'string' || !input.trim()) {
    throw new ApiError('O campo "type" é obrigatório e deve ser uma string não vazia.', 400, 'MISSING_FIELD');
  }

  const normalized = input.trim().toUpperCase().replace(/Ç/g, 'C').replace(/Ã/g, 'A');
  const resolved = DEADLINE_TYPE_MAP[normalized]
    || (Object.values(DeadlineType).includes(normalized as any) ? (normalized as DeadlineType) : null);

  if (!resolved) {
    throw new ApiError(
      `Tipo de prazo ("type") inválido: "${input}". Valores aceitos: ${Object.values(DeadlineType).join(', ')} (ou sinônimos: SESSAO_PUBLICA, IMPUGNACAO, ESCLARECIMENTO, PROPOSTA, RECURSO, INTENCAO_RECURSO, HABILITACAO_COMPLEMENTAR, ASSINATURA_CONTRATO, DISPUTA, OUTROS).`,
      400,
      'INVALID_DEADLINE_TYPE',
    );
  }

  return resolved;
}

function resolveDeadlineStatus(input?: string): any {
  if (!input) return 'PENDENTE';
  const norm = String(input).trim().toUpperCase();
  if (norm === 'CONCLUIDO' || norm === 'DONE') return 'CONCLUIDO';
  if (norm === 'VENCIDO' || norm === 'OVERDUE') return 'VENCIDO';
  return 'PENDENTE';
}

export class PrazosController {
  public async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    let company = await resolveAuthorizedCompany(userId, req.companyId);
    if (!company) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        company = await prisma.company.create({
          data: {
            userId,
            tenantId: user.tenantId,
            cnpj: (user as any).document || '00000000000100',
            razaoSocial: (user as any).companyName || user.nome || 'Minha Empresa',
          },
        });
      }
    }
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const formatted = await scaleSingleflight(
      `prazos:list:${userId}:${company.id}`,
      15,
      async () => {
        const prazos = await prisma.deadline.findMany({
          where: {
            OR: [
              { companyId: company!.id },
              { userId },
              { responsibleUserId: userId },
            ],
          },
          include: { procurementNotice: true },
          orderBy: [
            { dueAt: 'asc' },
            { date: 'asc' },
          ],
        });

        return prazos.map((p) => ({
          ...p,
          date: p.date || p.dueAt,
          dueAt: p.dueAt || p.date,
        }));
      },
    );

    return res.json({ success: true, data: formatted });
  }

  public async concluir(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const { id } = req.params;

    const prazo = await prisma.deadline.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!prazo || prazo.company.userId !== userId) {
      throw new ApiError('Prazo não encontrado ou acesso negado', 404);
    }

    const atualizado = await prisma.deadline.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });
    scaleCacheInvalidatePrefix(`prazos:list:${userId}:`);
    scaleCacheInvalidatePrefix(`dashboard:metrics:${userId}:`);

    return res.json({
      success: true,
      data: {
        ...atualizado,
        date: atualizado.date || atualizado.dueAt,
        dueAt: atualizado.dueAt || atualizado.date,
      },
    });
  }

  public async criar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const {
      companyId,
      title,
      description,
      type,
      dueAt,
      date,
      status,
      procurementNoticeId,
      responsibleUserId,
      fundamentoLegal,
      diasUteisAntecedencia,
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new ApiError('O campo "title" é obrigatório e deve ser uma string não vazia.', 400, 'MISSING_FIELD');
    }

    const resolvedType = resolveDeadlineType(type);

    const rawDate = dueAt || date;
    if (!rawDate) {
      throw new ApiError('O campo "dueAt" (ou "date") é obrigatório.', 400, 'MISSING_FIELD');
    }

    const parsedDueAt = new Date(rawDate);
    if (isNaN(parsedDueAt.getTime()) || parsedDueAt.getFullYear() < 1970 || parsedDueAt.getFullYear() > 2200) {
      throw new ApiError(
        'Formato de data inválido para "dueAt". Envie uma data válida compatível com ISO 8601 (ex: YYYY-MM-DDTHH:mm:ssZ).',
        400,
        'INVALID_DATE_FORMAT',
      );
    }

    let targetCompanyId = companyId;
    if (!targetCompanyId) {
      const firstCompany = await prisma.company.findFirst({ where: { userId } });
      if (!firstCompany) throw new ApiError('Empresa não encontrada', 404);
      targetCompanyId = firstCompany.id;
    } else {
      const company = await prisma.company.findFirst({ where: { id: targetCompanyId, userId } });
      if (!company) throw new ApiError('Empresa não encontrada ou acesso negado', 404);
    }

    const deadlineData: Record<string, any> = {
      companyId: targetCompanyId,
      title: title.trim(),
      description: description ? String(description).trim() : null,
      type: resolvedType,
      dueAt: parsedDueAt,
      source: 'manual',
      procurementNoticeId: procurementNoticeId ? String(procurementNoticeId).trim() : null,
      responsibleUserId: responsibleUserId ? String(responsibleUserId).trim() : userId,
    };

    if (date !== undefined || dueAt === undefined) {
      deadlineData.date = parsedDueAt;
    }
    if (req.body?.userId !== undefined) {
      deadlineData.userId = String(req.body.userId).trim();
    }
    if (status !== undefined) {
      deadlineData.status = resolveDeadlineStatus(status);
    }

    if (fundamentoLegal !== undefined && fundamentoLegal !== null) {
      deadlineData.fundamentoLegal = String(fundamentoLegal).trim();
    }
    if (diasUteisAntecedencia !== undefined && diasUteisAntecedencia !== null) {
      deadlineData.diasUteisAntecedencia = Number(diasUteisAntecedencia);
    }
    if (req.body?.diasCorridosAtePrazo !== undefined) {
      deadlineData.diasCorridosAtePrazo = Number(req.body.diasCorridosAtePrazo);
    }
    if (req.body?.tempestivoHoje !== undefined) {
      deadlineData.tempestivoHoje = Boolean(req.body.tempestivoHoje);
    }

    const prazo = await prisma.deadline.create({
      data: deadlineData as any,
    });

    return res.status(201).json({
      success: true,
      data: {
        ...prazo,
        date: prazo.date || prazo.dueAt,
        dueAt: prazo.dueAt || prazo.date,
      },
    });
  }

  public async sincronizarMonitorados(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new ApiError('Não autenticado', 401);

    const company = await resolveAuthorizedCompany(userId, req.companyId)
      || await prisma.company.findFirst({ where: { userId } });
    if (!company) throw new ApiError('Empresa não encontrada', 404);

    const [monitored, pipeline] = await Promise.all([
      prisma.companyMonitoredNotice.findMany({
        where: { companyId: company.id },
        include: { procurementNotice: true },
      }).catch(() => []),
      prisma.biddingPipeline.findMany({
        where: { userId },
        include: { notice: true },
      }).catch(() => []),
    ]);

    const noticesMap = new Map<string, any>();
    for (const m of monitored as any[]) {
      if (m?.procurementNotice?.id) noticesMap.set(m.procurementNotice.id, m.procurementNotice);
    }
    for (const p of pipeline as any[]) {
      if (p?.notice?.id) noticesMap.set(p.notice.id, p.notice);
    }

    let criados = 0;
    let ignorados = 0;
    const limitePassado = Date.now() - 24 * 60 * 60 * 1000;

    for (const notice of noticesMap.values()) {
      const rawDate = notice.openingAt || notice.closingAt;
      if (!rawDate) {
        ignorados += 1;
        continue;
      }

      const sessaoDate = new Date(rawDate);
      if (isNaN(sessaoDate.getTime()) || sessaoDate.getTime() < limitePassado) {
        ignorados += 1;
        continue;
      }

      const editalRef = notice.noticeNumber || notice.externalId || notice.buyerName || 'Edital';
      const existeSessao = await prisma.deadline.findFirst({
        where: {
          companyId: company.id,
          procurementNoticeId: notice.id,
          type: DeadlineType.SESSAO_PUBLICA,
        },
      });

      if (!existeSessao) {
        await prisma.deadline.create({
          data: {
            companyId: company.id,
            procurementNoticeId: notice.id,
            responsibleUserId: userId,
            userId,
            title: `Sessão Pública — ${editalRef}`,
            description: String(notice.object || '').slice(0, 300) || null,
            type: DeadlineType.SESSAO_PUBLICA,
            status: 'OPEN',
            dueAt: sessaoDate,
            date: sessaoDate,
            source: 'auto_monitoramento',
          } as any,
        });
        criados += 1;
      } else {
        ignorados += 1;
      }

      try {
        const ymd = sessaoDate.toISOString().slice(0, 10);
        const impugInfo = calcularPrazoDecadencialImpugnacao(ymd);
        const impugDate = new Date(`${impugInfo.prazoDecadencial}T17:00:00Z`);
        if (!isNaN(impugDate.getTime()) && impugDate.getTime() > Date.now()) {
          const existeImpug = await prisma.deadline.findFirst({
            where: {
              companyId: company.id,
              procurementNoticeId: notice.id,
              type: DeadlineType.IMPUGNACAO,
            },
          });
          if (!existeImpug) {
            await prisma.deadline.create({
              data: {
                companyId: company.id,
                procurementNoticeId: notice.id,
                responsibleUserId: userId,
                userId,
                title: `Limite Impugnação (Art. 164) — ${editalRef}`,
                description: `3 dias úteis antes da abertura de ${notice.buyerName || 'Órgão Público'}.`,
                type: DeadlineType.IMPUGNACAO,
                status: 'OPEN',
                dueAt: impugDate,
                date: impugDate,
                fundamentoLegal: 'Art. 164, caput da Lei 14.133/2021',
                diasUteisAntecedencia: impugInfo.diasUteisAntes,
                diasCorridosAtePrazo: impugInfo.diasCorridosAtePrazo,
                tempestivoHoje: impugInfo.tempestivoHoje,
                source: 'auto_monitoramento',
              } as any,
            });
            criados += 1;
          }
        }
      } catch {
        // Data fora do intervalo válido de cálculo não interrompe os demais editais
      }
    }

    return res.json({
      success: true,
      data: {
        criados,
        ignorados,
        totalAnalisados: noticesMap.size,
      },
    });
  }
}
