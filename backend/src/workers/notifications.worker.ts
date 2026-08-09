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