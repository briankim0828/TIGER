import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { createClient as createSQLiteProxyClient } from '@electric-sql/drizzle-orm-driver/sqlite-proxy';
import * as SQLite from 'expo-sqlite';

// Thin wrapper to make expo-sqlite usable with Drizzle via a proxy adapter.
// Note: This relies on a proxy driver capable of bridging Web/React Native; adjust if needed.

export function createDrizzleClient(database: SQLite.SQLiteDatabase) {
  const proxy = createSQLiteProxyClient({ database });
  const db = drizzle(proxy) as unknown as DrizzleD1Database; // use generic API
  return db;
}
