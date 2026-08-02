import axios from 'axios';
import { prisma } from '../database/prisma';

export class NotificationsWorker {
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
      const searchableText = `${notice.object} ${notice.buyerName}`.toLowerCase();

      for (const company of activeCompanies) {
        const matches = company.palavrasChave.some((keyword) =>
          searchableText.includes(keyword.toLowerCase()),
        );

        if (!matches || !company.user.telefone) {
          continue;
        }

        const details = [
          '*EXPERTISE Radar*',
          '',
          'Nova oportunidade encontrada.',
          '',
          `*Órgão:* ${notice.buyerName}`,
          `*Objeto:* ${notice.object}`,
          notice.estimatedValue !== null
            ? `*Valor estimado:* R$ ${Number(notice.estimatedValue).toFixed(2)}`
            : null,
          notice.url ? `*Fonte oficial:* ${notice.url}` : null,
        ].filter((line): line is string => line !== null);

        await this.sendWhatsApp(company.user.telefone, details.join('\n'));
        sent += 1;
      }
    }

    return { sent };
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
