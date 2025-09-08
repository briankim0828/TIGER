/**
 * applyBaseline.ts
 * Node-based baseline migration applier (Phase C) without requiring psql CLI.
 * Executes statements in drizzle/sync/0000_cp6_baseline.sql sequentially.
 * Safe to run ONLY on a fresh Supabase project (no prior app tables).
 *
 * ENV REQUIRED:
 *   DATABASE_URL=postgresql://user:password@host:5432/postgres
 *
 * SAFETY: Aborts if any target table already exists (exercise_catalog etc.).
 */
import { readFileSync } from 'fs';
import { Client } from 'pg';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const TARGET_TABLES = [
  'exercise_catalog',
  'splits',
  'split_day_assignments',
  'split_exercises',
  'workout_sessions',
  'workout_exercises',
  'workout_sets',
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[baseline] DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // Detect existing tables to prevent accidental re-run on a live DB
    const existingRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`,
      [TARGET_TABLES]
    );
    if (existingRes.rows.length > 0) {
      console.error('[baseline] Abort: some target tables already exist:', existingRes.rows.map((r: any) => r.table_name));
      process.exit(2);
    }

    const filePath = path.resolve('drizzle/sync/0000_cp6_baseline.sql');
    const raw = readFileSync(filePath, 'utf8');

    // Strip comments (lines starting with --) but preserve semicolons; then split into statements.
    const statements: string[] = [];
    let buffer = '';
    for (const line of raw.split(/\r?\n/)) {
      if (line.trim().startsWith('--')) continue; // drop pure comment lines
      const cleaned = line.replace(/--> statement-breakpoint.*/i, '').trimEnd();
      buffer += cleaned + '\n';
      if (cleaned.trim().endsWith(';')) {
        const stmt = buffer.trim();
        buffer = '';
        if (stmt !== ';') statements.push(stmt.replace(/;\s*$/,''));
      }
    }
    // Catch trailing buffer (unlikely)
    if (buffer.trim().length) statements.push(buffer.trim());

    console.log(`[baseline] Executing ${statements.length} statements...`);
    for (let i = 0; i < statements.length; i += 1) {
      const sql = statements[i]!;
      try {
        await client.query(sql);
      } catch (e:any) {
        console.error(`\n[baseline] Failed at statement ${i+1}/${statements.length}:\n${sql}\nError:`, e.message);
        throw e;
      }
    }
    console.log('[baseline] Schema creation complete. Verifying tables...');
    const verify = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1) ORDER BY table_name`,
      [TARGET_TABLES]
    );
  console.log('[baseline] Created tables:', verify.rows.map((r: any) => r.table_name).join(', '));
    if (verify.rows.length !== TARGET_TABLES.length) {
      console.warn('[baseline] WARNING: Missing some expected tables. Investigate.');
    } else {
      console.log('[baseline] All expected tables present.');
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[baseline] Fatal error:', err);
  process.exit(1);
});
