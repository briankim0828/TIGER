import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Drizzle config targeting ONLY the MVP sync schema slice (schema.sync.ts)
// Usage: npx drizzle-kit generate --config=drizzle.sync.config.ts
export default {
  schema: './src/db/schema.sync.ts',
  out: './drizzle/sync',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
