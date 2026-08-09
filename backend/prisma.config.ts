import 'dotenv/config';

// Declaração do process.env para evitar erros de TypeScript
declare const process: { env: { DATABASE_URL?: string } };

import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx ./prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/expertise_dev',
  },
});