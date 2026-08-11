import { prisma } from '../database/prisma';

export class SuperAdminService {
  /**
   * Retrieves aggregated SaaS metrics.
   */
  async getMetrics() {
    const totalUsers = await prisma.user.count();
    
    // Group subscriptions by status
    const subsByStatus = await prisma.subscription.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    let activeSubscribers = 0;
    let trialUsers = 0;
    let cancellations = 0;

    for (const group of subsByStatus) {
      if (group.status === 'active' as any) activeSubscribers += group._count._all;
      if (group.status === 'trialing' as any) trialUsers += group._count._all;
      if (group.status === 'canceled' as any) cancellations += group._count._all;
    }

    // Assuming plan is $249.99 per active subscriber
    const PLAN_PRICE = 249.99;
    const mrr = activeSubscribers * PLAN_PRICE;

    return {
      totalUsers,
      activeSubscribers,
      trialUsers,
      cancellations,
      mrr: Number(mrr.toFixed(2)),
    };
  }

  /**
   * List users for the admin dashboard.
   */
  async listUsers(skip = 0, take = 50) {
    const users = await prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        plano: true,
        createdAt: true,
        ultimoAcesso: true,
        subscriptions: {
          select: {
            status: true,
            plano: true,
          }
        }
      }
    });

    const total = await prisma.user.count();
    
    return { users, total };
  }

  /**
   * Send an automated email to a specific user.
   * In a real application, this would integrate with AWS SES, SendGrid, etc.
   */
  async sendEmail(userId: string, subject: string, message: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');

    // MOCK EMAIL SENDING
    console.log(`[EMAIL DISPATCH] Para: ${user.email} | Assunto: ${subject}`);
    console.log(`Corpo:\n${message}\n---`);

    // Registra como notificação para o usuário (fallback in-app)
    await prisma.notification.create({
      data: {
        userId,
        tipo: 'alerta' as any,
        titulo: subject,
        mensagem: message,
        canal: 'email',
        status: 'enviada' as any,
        enviadaEm: new Date(),
      }
    });

    return { success: true, email: user.email, subject };
  }
}
