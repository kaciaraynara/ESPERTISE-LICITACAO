import axios from 'axios';
import { prisma } from '../database/prisma';
import { DeadlineStatus } from '@prisma/client';
import { enviarAlertaPrazo } from '../services/resend.service';

const DEADLINE_TYPE_LABELS: Record<string, string> = {
  SESSAO_PUBLICA: 'Sessão Pública de Disputa',
  DISPUTE_SESSION: 'Sessão Pública de Disputa',
  IMPUGNACAO: 'Impugnação ao Edital',
  IMPUGNATION: 'Impugnação ao Edital',
  RECURSO: 'Interposição de Recurso',
  APPEAL: 'Interposição de Recurso',
  ASSINATURA_CONTRATO: 'Assinatura do Contrato',
  CONTRACT_SIGNING: 'Assinatura do Contrato',
  PROPOSAL_SUBMISSION: 'Envio de Proposta',
  CLARIFICATION: 'Pedido de Esclarecimento',
  INTENTION_TO_APPEAL: 'Manifestação de Intenção de Recurso',
  COUNTER_ARGUMENT: 'Contrarrazões Recursais',
  HABILITATION_COMPLEMENT: 'Complementação de Habilitação',
  CERTIFICATE_EXPIRATION: 'Vencimento de Certidão',
  INTERNAL_REVIEW: 'Revisão Interna',
  OTHER: 'Outro Prazo Legal',
};

export class NotificationsWorker {
  /**
   * Monitora oportunidades recém-divulgadas e envia alerta via WhatsApp
   * aos clientes que possuem palavras-chave compatíveis cadastradas.
   */
  public async processNewNotices() {
    const recentNotices = await prisma.procurementNotice.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      where: { status: 'Divulgada' },
    });

    if (recentNotices.length === 0) {
      return { sent: 0 };
    }

    const activeCompanies = await prisma.company.findMany({
      where: { status: { in: ['ACTIVE', 'ATIVA'] } },
      include: { user: true },
    });

    let sent = 0;

    for (const notice of recentNotices) {
      const buyerName = notice.buyerName ?? '';
      const objectText = notice.object ?? '';
      const searchableText = `${objectText} ${buyerName}`.toLowerCase();

      for (const company of activeCompanies) {
        const userPhone = company.user?.telefone;
        const matches = company.palavrasChave.some((keyword) =>
          searchableText.includes(keyword.toLowerCase()),
        );

        if (!matches || !userPhone) {
          continue;
        }

        const details = [
          '*EXPERTISE Radar*',
          '',
          'Nova oportunidade encontrada.',
          '',
          `*Órgão:* ${buyerName || 'Não informado'}`,
          `*Objeto:* ${objectText || 'Não informado'}`,
          notice.estimatedValue !== null
            ? `*Valor estimado:* R$ ${Number(notice.estimatedValue).toFixed(2)}`
            : null,
          notice.url ? `*Fonte oficial:* ${notice.url}` : null,
        ].filter((line): line is string => line !== null);

        await this.sendWhatsApp(userPhone, details.join('\n'));
        sent += 1;
      }
    }

    return { sent };
  }

  /**
   * Varre a tabela Deadlines em busca de prazos com vencimento nas próximas 24h e 48h.
   * Dispara e-mails via Resend e registra alertas no painel com garantia de idempotência.
   */
  public async processUpcomingDeadlines(): Promise<{
    totalDeadlines: number;
    alerted24h: number;
    alerted48h: number;
    skipped: number;
    errors: number;
  }> {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    console.info(JSON.stringify({
      event: 'DEADLINE_ALERTS_SCAN_STARTED',
      startedAt: now.toISOString(),
      windowEnd: in48h.toISOString(),
    }));

    // Busca prazos pendentes cuja data limite esteja na janela das próximas 48h
    const upcomingDeadlines = await prisma.deadline.findMany({
      where: {
        status: {
          in: [DeadlineStatus.OPEN, DeadlineStatus.PENDENTE],
        },
        OR: [
          {
            dueAt: {
              gte: now,
              lte: in48h,
            },
          },
          {
            date: {
              gte: now,
              lte: in48h,
            },
          },
        ],
      },
      include: {
        user: true,
        responsibleUser: true,
        company: {
          include: {
            user: true,
          },
        },
        procurementNotice: true,
      },
      orderBy: {
        dueAt: 'asc',
      },
    });

    let alerted24h = 0;
    let alerted48h = 0;
    let skipped = 0;
    let errors = 0;

    for (const deadline of upcomingDeadlines) {
      try {
        const targetDate = deadline.dueAt || deadline.date;
        const diffMs = targetDate.getTime() - now.getTime();
        const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

        // Determina o destinatário
        const recipientUser = deadline.user || deadline.responsibleUser || deadline.company?.user;
        const email = recipientUser?.email;
        const nome = recipientUser?.nome || deadline.company?.razaoSocial || 'Gestor de Licitações';

        if (!email) {
          console.warn(`[NotificationsWorker] Prazo ${deadline.id} (${deadline.title}) não possui e-mail de usuário vinculado.`);
          skipped++;
          continue;
        }

        const metadata = (typeof deadline.metadata === 'object' && deadline.metadata !== null)
          ? { ...(deadline.metadata as Record<string, any>) }
          : {};

        const tipoFormatado = DEADLINE_TYPE_LABELS[deadline.type] || String(deadline.type);

        if (diffHours <= 24) {
          // Janela crítica de 24h
          if (metadata.alerted_24h) {
            skipped++;
            continue;
          }

          try {
            await enviarAlertaPrazo({
              email,
              nome,
              prazoTitulo: deadline.title,
              tipo: tipoFormatado,
              dataLimite: targetDate,
              horasRestantes: Math.max(1, diffHours),
              editalNumero: deadline.procurementNotice?.noticeNumber || null,
              orgao: deadline.procurementNotice?.buyerName || null,
              link: deadline.procurementNotice?.url || null,
            });
          } catch (mailErr: any) {
            if (mailErr?.message === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
              console.warn(`[NotificationsWorker] Provedor de e-mail não configurado. Alerta 24h logado para ${email}.`);
            } else {
              throw mailErr;
            }
          }

          if (recipientUser?.id) {
            await prisma.notification.create({
              data: {
                userId: recipientUser.id,
                tipo: 'prazo_proximo',
                titulo: `🚨 Prazo Crítico em ${diffHours}h: ${deadline.title}`,
                mensagem: `O prazo "${deadline.title}" (${tipoFormatado}) vence em ${diffHours}h. Aja tempestivamente para garantir a participação no certame.`,
                canal: 'email+painel',
                status: 'enviada',
                enviadaEm: new Date(),
                licitacaoId: deadline.procurementNoticeId,
                link: deadline.procurementNotice?.url || '/prazos',
              },
            });
          }

          await prisma.deadline.update({
            where: { id: deadline.id },
            data: {
              metadata: {
                ...metadata,
                alerted_24h: true,
                alerted_24h_at: new Date().toISOString(),
              },
            },
          });

          alerted24h++;
        } else if (diffHours <= 48) {
          // Janela de atenção de 48h
          if (metadata.alerted_48h) {
            skipped++;
            continue;
          }

          try {
            await enviarAlertaPrazo({
              email,
              nome,
              prazoTitulo: deadline.title,
              tipo: tipoFormatado,
              dataLimite: targetDate,
              horasRestantes: diffHours,
              editalNumero: deadline.procurementNotice?.noticeNumber || null,
              orgao: deadline.procurementNotice?.buyerName || null,
              link: deadline.procurementNotice?.url || null,
            });
          } catch (mailErr: any) {
            if (mailErr?.message === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
              console.warn(`[NotificationsWorker] Provedor de e-mail não configurado. Alerta 48h logado para ${email}.`);
            } else {
              throw mailErr;
            }
          }

          if (recipientUser?.id) {
            await prisma.notification.create({
              data: {
                userId: recipientUser.id,
                tipo: 'prazo_proximo',
                titulo: `⏰ Prazo em 48h: ${deadline.title}`,
                mensagem: `O prazo "${deadline.title}" (${tipoFormatado}) vence em ${diffHours}h. Verifique a documentação e requisitos.`,
                canal: 'email+painel',
                status: 'enviada',
                enviadaEm: new Date(),
                licitacaoId: deadline.procurementNoticeId,
                link: deadline.procurementNotice?.url || '/prazos',
              },
            });
          }

          await prisma.deadline.update({
            where: { id: deadline.id },
            data: {
              metadata: {
                ...metadata,
                alerted_48h: true,
                alerted_48h_at: new Date().toISOString(),
              },
            },
          });

          alerted48h++;
        }
      } catch (err: any) {
        errors++;
        console.error(`[NotificationsWorker] Erro ao processar alerta para o prazo ${deadline.id}:`, err?.message || err);
      }
    }

    const summary = {
      totalDeadlines: upcomingDeadlines.length,
      alerted24h,
      alerted48h,
      skipped,
      errors,
    };

    console.info(JSON.stringify({
      event: 'DEADLINE_ALERTS_SCAN_COMPLETED',
      timestamp: new Date().toISOString(),
      ...summary,
    }));

    return summary;
  }

  private async sendWhatsApp(phone: string, message: string) {
    const apiUrl = process.env.WHATSAPP_API_URL?.trim();
    const clientToken = process.env.WHATSAPP_CLIENT_TOKEN?.trim();

    if (!apiUrl || !clientToken) {
      throw new Error('WHATSAPP_PROVIDER_NOT_CONFIGURED');
    }

    await axios.post(
      apiUrl,
      { phone, message },
      {
        headers: { 'Client-Token': clientToken },
        timeout: 10_000,
      },
    );
  }
}