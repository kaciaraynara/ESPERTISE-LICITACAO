import { prisma } from '../database/prisma';

export class CertificatesWorker {
  public async checkExpirations() {
    const today = new Date();
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + 7);

    const expiringCertificates = await prisma.companyCertificate.findMany({
      where: {
        expirationDate: { lte: warningDate },
        status: 'VALID',
      },
    });

    for (const certificate of expiringCertificates) {
      await prisma.companyCertificate.update({
        where: { id: certificate.id },
        data: {
          status: certificate.expirationDate < today
            ? 'EXPIRED'
            : 'WARNING',
        },
      });
    }

    return { updated: expiringCertificates.length };
  }
}
