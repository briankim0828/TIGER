import * as SQLite from 'expo-sqlite';
import { supabase } from '../../utils/supabaseClient';
import { SYNC_TABLES } from './manifest';
import { PULL_ORDER } from './types';

export type PullOptions = {
  userId: string;
  log?: boolean;
};

async function upsertRows(db: SQLite.SQLiteDatabase, table: string, rows: any[]) {
  if (!rows.length) return;
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const keys = Object.keys(row);
      const placeholders = keys.map(() => '?').join(',');
      const updates = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(',');
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
      await db.runAsync(sql, keys.map(k => (row as any)[k]));
    }
  });
}

export async function pullSnapshotForTable(db: SQLite.SQLiteDatabase, table: string, userId: string, log = false) {
  // Scope query per table shape; rely on RLS for child tables without user_id
  let query = supabase.from(table).select('*');
  if (table === 'exercise_catalog') {
    // public catalog or owned
    query = query.or('is_public.eq.true,owner_user_id.eq.' + userId);
  } else if (table === 'splits' || table === 'split_day_assignments' || table === 'workout_sessions') {
    // user-owned rows (these tables have user_id)
    query = query.eq('user_id', userId);
  } else {
    // child tables (split_exercises, workout_exercises, workout_sets) don't have user_id
    // RLS should restrict visibility to rows owned via parent relationships
    // No additional filter applied here
  }
  const { data, error } = await query;
  if (error) throw error;
  await upsertRows(db, table, data || []);
  if (log) console.log(`[sync] pulled ${data?.length ?? 0} rows for ${table}`);
}

export async function pullAllSnapshots(db: SQLite.SQLiteDatabase, opts: PullOptions) {
  const tables = PULL_ORDER.filter(t => (SYNC_TABLES as readonly string[]).includes(t as any));
  for (const t of tables) {
    await pullSnapshotForTable(db, t, opts.userId, !!opts.log);
  }
  await db.runAsync(`UPDATE sync_state SET last_pull_at = CURRENT_TIMESTAMP`);
}
