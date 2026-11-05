import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx ./prisma/seed.ts',
  },

  datasource: {
    // DIRECT_URL dedicada para migrations (bypass PgBouncer); fallback para DATABASE_URL
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',

    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});