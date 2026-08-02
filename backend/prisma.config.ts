import 'dotenv/config';

// Minimal ambient declaration for `process` to satisfy TypeScript
declare const process: { env: { DATABASE_URL?: string } };
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/expertise_dev',
  },
});
