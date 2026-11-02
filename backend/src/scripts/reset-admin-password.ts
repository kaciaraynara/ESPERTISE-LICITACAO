import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../database/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const novaSenha = process.argv[2] || 'Admin@123456';
  const email = (process.argv[3] || 'admin@expertise.com.br').toLowerCase().trim();

  console.log(`Atualizando senha para o usuário: ${email}`);
  const passwordHash = await bcrypt.hash(novaSenha, 12);

  const user = await prisma.user.upsert({
    where: { emailNormalized: email },
    update: {
      passwordHash,
      emailVerificado: true,
      deletedAt: null,
    },
    create: {
      email,
      emailNormalized: email,
      nome: 'Administrador Expertise',
      plano: 'master',
      planType: 'MASTER',
      passwordHash,
      role: 'fornecedor',
      emailVerificado: true,
      aceiteLgpd: true,
      tenant: {
        create: {
          name: 'Expertise Licitatória Workspace',
          slug: `workspace-${Date.now()}`,
        }
      }
    }
  });

  console.log('✅ Usuário configurado com sucesso!');
  console.log(`- Email: ${user.email}`);
  console.log(`- Nova Senha: ${novaSenha}`);
  console.log(`- Plano: ${user.plano} (${user.planType})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

