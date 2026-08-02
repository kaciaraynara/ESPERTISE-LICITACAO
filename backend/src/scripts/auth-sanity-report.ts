import 'dotenv/config';
import { prisma, disconnectPrisma } from '../database/prisma';
import { isValidPasswordHash, normalizeAuthEmail } from '../services/auth.service';

type UserRow = {
  id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  createdAt: Date;
};

async function main() {
  const shouldFix = process.argv.includes('--fix');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      emailNormalized: true,
      passwordHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  }) as UserRow[];

  const emailIssues = users
    .map((user) => ({
      id: user.id,
      email: user.email,
      emailNormalized: user.emailNormalized,
      expected: normalizeAuthEmail(user.emailNormalized || user.email),
    }))
    .filter((item) => item.email !== item.expected || item.emailNormalized !== item.expected);

  const invalidPasswordHashes = users
    .filter((user) => !isValidPasswordHash(user.passwordHash))
    .map((user) => ({
      id: user.id,
      email: user.emailNormalized || user.email,
      reason: user.passwordHash ? 'invalid_bcrypt_hash' : 'missing_password_hash',
    }));

  const groups = new Map<string, UserRow[]>();
  for (const user of users) {
    const key = normalizeAuthEmail(user.emailNormalized || user.email);
    groups.set(key, [...(groups.get(key) ?? []), user]);
  }

  const duplicateEmails = [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([email, items]) => ({
      email,
      count: items.length,
      userIds: items.map((item) => item.id),
    }));

  let fixedEmailIssues = 0;
  if (shouldFix) {
    for (const issue of emailIssues) {
      if (duplicateEmails.some((duplicate) => duplicate.email === issue.expected)) {
        continue;
      }

      await prisma.user.update({
        where: { id: issue.id },
        data: {
          email: issue.expected,
          emailNormalized: issue.expected,
        },
      });
      fixedEmailIssues += 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: shouldFix ? 'fix' : 'report',
    totalUsers: users.length,
    emailIssues,
    duplicateEmails,
    invalidPasswordHashes,
    fixedEmailIssues,
    recommendation: invalidPasswordHashes.length
      ? 'Usuários com hash inválido precisam passar por recuperação de senha.'
      : 'Nenhum hash inválido encontrado.',
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      event: 'AUTH_SANITY_REPORT_FAILED',
      message: error?.message ?? 'unknown_error',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
