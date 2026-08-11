const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  const email = 'test-browser@example.com';
  const password = 'StrongPassword123!';
  const passwordHash = await bcrypt.hash(password, 12);
  
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, deletedAt: null },
    create: {
      email,
      emailNormalized: email.toLowerCase(),
      passwordHash,
      nome: 'Usuário Teste',
      tenantId: 'test-tenant',
      plano: 'free'
    }
  });
  console.log('Test user created/updated successfully.');
  await prisma.$disconnect();
}

createTestUser().catch(console.error);
