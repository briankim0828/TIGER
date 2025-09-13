import * as SQLite from 'expo-sqlite';
import { newUuid } from '../../utils/ids';
import { OutboxItem, OutboxOp } from './types';

export async function enqueueOutbox(db: SQLite.SQLiteDatabase, params: {
  table: string;
  op: OutboxOp;
  rowId: string;
  payload?: unknown;
}) {
  const id = newUuid();
  await db.runAsync(
    `INSERT INTO outbox (id, table_name, op, row_id, payload, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [id, params.table, params.op, params.rowId, params.payload ? JSON.stringify(params.payload) : null]
  );
  return id;
}

export async function applyLocalMutation(db: SQLite.SQLiteDatabase, table: string, payload: Record<string, any>) {
  const keys = Object.keys(payload);
  const placeholders = keys.map(() => '?').join(',');
  const updates = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(',');
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  await db.runAsync(sql, keys.map(k => (payload as any)[k]));
}
