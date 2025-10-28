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

// Special reconciler for exercise_catalog: canonicalize by slug so local IDs match remote IDs
// This avoids UNIQUE(slug) violations and prevents downstream FK failures when child rows reference remote IDs.
async function upsertExerciseCatalogCanonical(db: SQLite.SQLiteDatabase, rows: any[]) {
  if (!rows.length) return;
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const slug = (row as any)?.slug ?? null;
      if (slug) {
        const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM exercise_catalog WHERE slug = ?`, [slug]);
        if (existing && existing.id && existing.id !== row.id) {
          // Migrate FKs to the remote/canonical ID first
          try {
            await db.runAsync(`UPDATE split_exercises SET exercise_id = ? WHERE exercise_id = ?`, [row.id, existing.id]);
          } catch {}
          try {
            await db.runAsync(`UPDATE workout_exercises SET exercise_id = ? WHERE exercise_id = ?`, [row.id, existing.id]);
          } catch {}
          // Update the catalog row in-place, switching its PK to the remote ID and syncing all columns
          const keys = Object.keys(row);
          const setters = keys.map((k) => `${k} = ?`).join(',');
          const values = keys.map((k) => (row as any)[k]);
          await db.runAsync(`UPDATE exercise_catalog SET ${setters} WHERE id = ?`, [...values, existing.id]);
          continue;
        }
      }
      // No existing by slug or same id -> standard upsert by id
      const keys = Object.keys(row);
      const placeholders = keys.map(() => '?').join(',');
      const updates = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(',');
      const sql = `INSERT INTO exercise_catalog (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
      await db.runAsync(sql, keys.map(k => (row as any)[k]));
    }
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryWithRetry(table: string, userId: string, attempts = 3, baseDelayMs = 250) {
  let lastErr: any;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      let q = supabase.from(table).select('*');
      if (table === 'exercise_catalog') {
        q = q.or('is_public.eq.true,owner_user_id.eq.' + userId);
      } else if (table === 'splits' || table === 'split_day_assignments' || table === 'workout_sessions') {
        q = q.eq('user_id', userId);
      } else {
        // rely on RLS for child tables
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const isTransient = msg.includes('502') || msg.includes('Bad Gateway') || msg.includes('fetch') || msg.includes('Failed to fetch');
      if (i < attempts && isTransient) {
        const wait = baseDelayMs * Math.pow(2, i - 1) + Math.floor(Math.random() * 100);
        if (process?.env?.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn(`[sync] transient error on ${table}, retry ${i}/${attempts - 1} in ${wait}ms`);
        }
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function pullSnapshotForTable(db: SQLite.SQLiteDatabase, table: string, userId: string, log = false) {
  // Scope query per table shape; rely on RLS for child tables without user_id
  const data = await queryWithRetry(table, userId, 3, 250);
  if (table === 'exercise_catalog') {
    await upsertExerciseCatalogCanonical(db, data);
  } else {
    await upsertRows(db, table, data);
  }
  if (log) console.log(`[sync] pulled ${data.length} rows for ${table}`);

  // Reconcile deletions: remove local rows that no longer exist remotely.
  // Skip for exercise_catalog to avoid breaking local references.
  if (table !== 'exercise_catalog') {
    try {
      const remoteIds = new Set<string>((data as any[]).map((r) => String(r.id)));
      // Get local IDs for this table
      const localRows: Array<{ id: string }> = await db.getAllAsync(`SELECT id FROM ${table}`) as any;
      if (localRows && localRows.length) {
        let candidates = localRows.map(r => String(r.id)).filter(id => !remoteIds.has(id));
        if (candidates.length) {
          // Do not delete rows that are pending/processing in outbox as insert/update (haven't synced yet)
          const placeholders = candidates.map(() => '?').join(',');
          const pending: Array<{ row_id: string }> = await db.getAllAsync(
            `SELECT row_id FROM outbox WHERE table_name = ? AND row_id IN (${placeholders}) AND status IN ('pending','processing') AND op IN ('insert','update')`,
            [table, ...candidates]
          ) as any;
          const pendingSet = new Set(pending.map(p => String(p.row_id)));
          const toDelete = candidates.filter(id => !pendingSet.has(id));
          if (toDelete.length) {
            const delPh = toDelete.map(() => '?').join(',');
            await db.runAsync(`DELETE FROM ${table} WHERE id IN (${delPh})`, toDelete);
            if (log) console.log(`[sync] reconciled deletes on ${table}: removed ${toDelete.length}`);
          }
        }
      }
    } catch (e) {
      console.warn('[sync] deletion reconciliation skipped for table', table, e);
    }
  }
}

export async function pullAllSnapshots(db: SQLite.SQLiteDatabase, opts: PullOptions) {
  const tables = PULL_ORDER.filter(t => (SYNC_TABLES as readonly string[]).includes(t as any));
  let hadError = false;
  let lastError: any = null;
  for (const t of tables) {
    try {
      await pullSnapshotForTable(db, t, opts.userId, !!opts.log);
    } catch (e: any) {
      hadError = true;
      lastError = e;
      const msg = String(e?.message ?? e);
      console.warn(`[sync] pull failed for ${t}`, msg);
      // Continue with next table to avoid blocking the whole startup on a transient error
    }
  }
  await db.runAsync(`UPDATE sync_state SET last_pull_at = CURRENT_TIMESTAMP`);
  if (hadError) {
    try {
      const summary = JSON.stringify({ message: String(lastError?.message ?? lastError) }).slice(0, 500);
      await db.runAsync(`UPDATE sync_state SET last_error = ?`, [summary]);
    } catch {}
  } else {
    try {
      await db.runAsync(`UPDATE sync_state SET last_error = NULL`);
    } catch {}
  }
}
