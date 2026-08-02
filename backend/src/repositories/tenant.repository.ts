import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';

export class TenantRepository {
  listCompaniesByUser(userId: string) {
    return prisma.company.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findCompanyByUserAndCnpj(userId: string, cnpj: string) {
    return prisma.company.findUnique({
      where: { userId_cnpj: { userId, cnpj } },
    });
  }

  countCompaniesByUser(userId: string) {
    return prisma.company.count({ where: { userId } });
  }

  async upsertCompanyForUser(
    userId: string,
    cnpj: string,
    data: Omit<Prisma.CompanyUncheckedCreateInput, 'id' | 'tenantId' | 'userId' | 'cnpj' | 'createdAt' | 'updatedAt'>,
  ) {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tenantId: true },
    });

    return prisma.company.upsert({
      where: { userId_cnpj: { userId, cnpj } },
      create: { ...data, tenantId: owner.tenantId, userId, cnpj },
      update: data,
    });
  }

  findUserById(userId: string) {
    return prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  }

  findUserByNormalizedEmail(emailNormalized: string) {
    return prisma.user.findFirst({ where: { emailNormalized, deletedAt: null } });
  }

  createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  touchUserLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { ultimoAcesso: new Date() },
    });
  }
}

export const tenantRepository = new TenantRepository();
