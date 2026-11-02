import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { InfoSimplesError, infosimplesService } from '../services/infosimples.service';
import { enviarAlertaCertidao } from '../services/resend.service';

const DAY_IN_MS = 86_400_000;

const CERTIFICATE_LABELS: Record<string, string> = {
  RECEITA: 'Certidão Federal (Receita Federal/PGFN)',
  FGTS: 'Certificado de Regularidade do FGTS',
  TRABALHISTA: 'Certidão Negativa de Débitos Trabalhistas (CNDT)',
  ESTADUAL: 'Certidão Estadual',
  MUNICIPAL: 'Certidão Municipal',
};

function getCalendarDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function getMetadata(value: unknown): Prisma.InputJsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Prisma.InputJsonObject
    : {};
}

export class CertificatesWorker {
  public async syncFromInfoSimples() {
    if (!infosimplesService.isConfigured()) {
      return { skipped: true, reason: 'INFOSIMPLES_TOKEN_NOT_CONFIGURED' };
    }

    const companies = await prisma.company.findMany({
      select: { id: true, cnpj: true },
      orderBy: { createdAt: 'asc' },
    });
    let synchronized = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        await infosimplesService.sincronizarCertidoes(company.id, company.cnpj);
        synchronized++;
      } catch (error) {
        failed++;
        console.error('[CertificatesWorker] Falha na sincronização Infosimples da empresa.', {
          companyId: company.id,
          code: error instanceof InfoSimplesError ? error.code : 'UNEXPECTED_ERROR',
        });
      }
    }

    return { skipped: false, companies: companies.length, synchronized, failed };
  }

  public async checkExpirations() {
    const today = new Date();
    const alertWindowEnd = new Date(today);
    alertWindowEnd.setUTCDate(alertWindowEnd.getUTCDate() + 15);

    const expiringCertificates = await prisma.companyCertificate.findMany({
      where: {
        expirationDate: { lte: alertWindowEnd },
        status: { in: ['VALID', 'WARNING'] },
      },
      include: {
        company: {
          include: { user: true },
        },
      },
    });

    let updated = 0;
    let alertsCreated = 0;
    let emailsSent = 0;
    let emailFailures = 0;

    for (const certificate of expiringCertificates) {
      const daysRemaining = Math.ceil(
        (getCalendarDay(certificate.expirationDate) - getCalendarDay(today)) / DAY_IN_MS,
      );
      const status = daysRemaining < 0
        ? 'EXPIRED'
        : daysRemaining <= 7
          ? 'WARNING'
          : 'VALID';
      let metadata = getMetadata(certificate.metadata);
      let metadataChanged = certificate.status !== status;

      if (certificate.status !== status) {
        await prisma.companyCertificate.update({
          where: { id: certificate.id },
          data: { status },
        });
        updated++;
      }

      if (daysRemaining < 0 || daysRemaining > 15) {
        continue;
      }

      const alertWindow = daysRemaining <= 7 ? '7d' : '15d';
      const panelAlertKey = `expiration_alert_${alertWindow}_panel_sent`;
      const emailAlertKey = `expiration_alert_${alertWindow}_email_sent`;
      const certificateName = CERTIFICATE_LABELS[certificate.type] || certificate.type;
      const user = certificate.company.user;

      if (metadata[emailAlertKey] !== true && user.email) {
        try {
          await enviarAlertaCertidao({
            email: user.email,
            nome: user.nome || certificate.company.razaoSocial,
            certidao: certificateName,
            diasRestantes: daysRemaining,
            validade: certificate.expirationDate.toISOString(),
            linkRenovacao: `${(process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '')}/certidoes`,
          });
          metadata = { ...metadata, [emailAlertKey]: true };
          metadataChanged = true;
          emailsSent++;
        } catch (error) {
          emailFailures++;
          console.error(
            `[CertificatesWorker] Falha ao enviar alerta de vencimento da certidão ${certificate.id}:`,
            error,
          );
        }
      }

      if (metadata[panelAlertKey] !== true) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            tipo: 'sistema',
            titulo: `Certidão vencendo: ${certificateName}`,
            mensagem: `A validade informada para esta certidão termina em ${daysRemaining} dia(s). Confirme a situação no órgão emissor e atualize o documento no cofre.`,
            canal: 'painel',
            status: 'enviada',
            enviadaEm: new Date(),
            link: '/certidoes',
          },
        });
        metadata = { ...metadata, [panelAlertKey]: true };
        metadataChanged = true;
        alertsCreated++;
      }

      if (metadataChanged) {
        await prisma.companyCertificate.update({
          where: { id: certificate.id },
          data: { metadata },
        });
      }
    }

    return { updated, alertsCreated, emailsSent, emailFailures };
  }
}
