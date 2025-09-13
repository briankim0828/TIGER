import * as SQLite from 'expo-sqlite';
import { pullAllSnapshots } from './pull';

export async function startupSync(db: SQLite.SQLiteDatabase, userId: string, opts?: { log?: boolean }) {
  await pullAllSnapshots(db, { userId, log: !!opts?.log });
  // last_pull_at updated by pullAllSnapshots; nothing else to do here for MVP
}
