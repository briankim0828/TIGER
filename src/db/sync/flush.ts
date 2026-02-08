import * as SQLite from 'expo-sqlite';
import { supabase } from '../../utils/supabaseClient';

type FlushOptions = {
  log?: boolean;
  maxBatch?: number;
};

async function nextPending(db: SQLite.SQLiteDatabase, maxBatch: number) {
  const rows = await db.getAllAsync(`SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`, [maxBatch]);
  return rows as any[];
}

async function markProcessing(db: SQLite.SQLiteDatabase, ids: string[]) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`UPDATE outbox SET status = 'processing' WHERE id IN (${placeholders})`, ids);
}

async function markDone(db: SQLite.SQLiteDatabase, id: string) {
  await db.runAsync(`UPDATE outbox SET status = 'done' WHERE id = ?`, [id]);
}

async function markFailed(db: SQLite.SQLiteDatabase, id: string) {
  await db.runAsync(`UPDATE outbox SET status = 'failed', retry_count = retry_count + 1 WHERE id = ?`, [id]);
}

async function setOnline(db: SQLite.SQLiteDatabase, online: boolean, lastError?: string) {
  await db.runAsync(`UPDATE sync_state SET is_online = ?, last_error = ?, last_flush_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE last_flush_at END`, [online ? 1 : 0, lastError ?? null, online ? 1 : 0]);
}

async function fetchLocalExerciseById(db: SQLite.SQLiteDatabase, id: string): Promise<{ slug: string | null; name: string | null; modality: string | null; body_part: string | null } | null> {
  try {
    const row: any = await db.getFirstAsync(
      'SELECT slug, name, modality, body_part FROM exercise_catalog WHERE id = ?',
      [id]
    );
    if (!row) return null;
    return {
      slug: row.slug ?? null,
      name: row.name ?? null,
      modality: row.modality ?? null,
      body_part: row.body_part ?? null,
    };
  } catch {
    return null;
  }
}

async function ensureRemoteExerciseIdBySlug(local: { slug: string | null; name: string | null; modality: string | null; body_part: string | null }): Promise<string | null> {
  if (!local.slug) return null;
  // Try fetch by slug first
  try {
    const { data, error } = await supabase
      .from('exercise_catalog')
      .select('id')
      .eq('slug', local.slug)
      .limit(1);
    if (error) {
      // If RLS blocks or transient, surface null to let caller decide
      // eslint-disable-next-line no-console
      console.warn('[outbox] exercise lookup by slug failed', error);
    }
    if (data && data.length > 0) return (data[0] as any).id as string;
  } catch {}
  // If not found, try inserting a private copy owned by the user
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess?.session?.user?.id;
    const insertPayload: any = {
      name: local.name ?? local.slug,
      slug: local.slug,
      modality: local.modality ?? 'bodyweight',
      body_part: local.body_part ?? null,
      is_public: false,
      ...(uid ? { owner_user_id: uid } : {}),
    };
    const { data, error } = await supabase
      .from('exercise_catalog')
      .insert(insertPayload)
      .select('id');
    if (error) {
      // Unique violation on slug? Try to fetch again.
      const { data: again } = await supabase
        .from('exercise_catalog')
        .select('id')
        .eq('slug', local.slug)
        .limit(1);
      if (again && again.length > 0) return (again[0] as any).id as string;
      return null;
    }
    if (data && data.length > 0) return (data[0] as any).id as string;
  } catch {}
  return null;
}

async function pushToServer(db: SQLite.SQLiteDatabase, item: any) {
  const table = item.table_name as string;
  const op = item.op as string;
  const rowId = item.row_id as string;
  const payload = item.payload ? JSON.parse(item.payload) : undefined;
  // Normalize numeric payloads (defensive): keep weights as integers across sync.
  if (table === 'workout_sets' && payload && typeof payload === 'object' && (payload as any).weight_kg !== undefined && (payload as any).weight_kg !== null) {
    const v = Number((payload as any).weight_kg);
    if (Number.isFinite(v)) (payload as any).weight_kg = Math.round(v);
  }
  // Schema sanitation for specific tables
  if (table === 'split_day_assignments' && payload && typeof payload === 'object') {
    // Remote schema does not have created_at/updated_at
    delete (payload as any).created_at;
    delete (payload as any).updated_at;
  }
  // Map local exercise_id to remote by slug for workout_exercises to satisfy FK
  if (table === 'workout_exercises' && payload && typeof payload === 'object' && (payload as any).exercise_id) {
    const localId = (payload as any).exercise_id as string;
    const local = await fetchLocalExerciseById(db, localId);
    if (local && local.slug) {
      const remoteId = await ensureRemoteExerciseIdBySlug(local);
      if (remoteId) {
        (payload as any).exercise_id = remoteId;
      }
    }
  }
  // Verbose trace for diagnostics
  try {
    const { data: authData } = await supabase.auth.getSession();
    const uid = authData?.session?.user?.id ?? null;
    console.debug('[outbox] push start', { id: item.id, table, op, rowId, hasPayload: !!payload, authUser: uid });
  } catch {
    console.debug('[outbox] push start', { id: item.id, table, op, rowId, hasPayload: !!payload, authUser: 'unknown' });
  }
  if (op === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', rowId);
    if (error) {
      console.error('[outbox] delete failed', { table, rowId, error });
      throw error;
    }
    return;
  }
  if (op === 'insert') {
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      console.error('[outbox] insert failed', { table, rowId, payload, error });
      throw error;
    }
    return;
  }
  if (op === 'update') {
    if (table === 'split_day_assignments') {
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', rowId)
        .select('id');
      if (error) {
        console.error('[outbox] update failed', { table, rowId, payload, error });
        throw error;
      }
      if (!data || (Array.isArray(data) && data.length === 0)) {
        const { error: insErr } = await supabase.from(table).insert(payload);
        if (insErr) {
          console.error('[outbox] update→insert fallback failed', { table, rowId, payload, error: insErr });
          throw insErr;
        }
      }
      return;
    }
    const { error } = await supabase.from(table).update(payload).eq('id', rowId);
    if (error) {
      console.error('[outbox] update failed', { table, rowId, payload, error });
      throw error;
    }
    return;
  }
}

export async function runFlushOnce(db: SQLite.SQLiteDatabase, opts: FlushOptions = {}) {
  // Skip processing if unauthenticated
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.user) {
      await setOnline(db, false, 'unauthenticated');
      return 0;
    }
  } catch {
    // if auth check fails, treat as offline
    await setOnline(db, false, 'auth-check-failed');
    return 0;
  }
  const batch = await nextPending(db, opts.maxBatch ?? 50);
  if (!batch.length) return 0;
  console.debug('[outbox] processing batch', { count: batch.length });
  await markProcessing(db, batch.map(b => b.id as string));
  let ok = 0;
  for (const item of batch) {
    try {
      await pushToServer(db, item);
      await markDone(db, item.id as string);
      ok++;
    } catch (e: any) {
      await markFailed(db, item.id as string);
      const errObj = e && typeof e === 'object' ? e : { message: String(e) };
      const summary = JSON.stringify({
        message: (errObj as any).message ?? String(e),
        code: (errObj as any).code,
        details: (errObj as any).details,
        hint: (errObj as any).hint,
        table: item.table_name,
        op: item.op,
        rowId: item.row_id,
      });
      console.error('[outbox] push failed', summary);
      await setOnline(db, false, summary);
      throw e; // stop early; backoff will handle retries
    }
  }
  await setOnline(db, true);
  return ok;
}

export function startBackgroundFlusher(db: SQLite.SQLiteDatabase, opts: FlushOptions & { intervalMs?: number } = {}) {
  const interval = opts.intervalMs ?? 3000;
  let timer: any;
  const tick = async () => {
    try {
      await runFlushOnce(db, opts);
    } catch {
      // suppressed; status already updated
    } finally {
      timer = setTimeout(tick, interval);
    }
  };
  timer = setTimeout(tick, interval);
  return () => clearTimeout(timer);
}
