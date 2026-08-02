import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url().optional(),
  VITE_GOVBR_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_GOVBR_CLIENT_ID: import.meta.env.VITE_GOVBR_CLIENT_ID,
});
