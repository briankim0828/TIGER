import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

// Create a Drizzle client directly from an expo-sqlite database instance.
export function createDrizzleClient(database: SQLite.SQLiteDatabase) {
  // Enable foreign key constraints (Expo SQLite requires PRAGMA per connection)
  try {
  database.execSync?.('PRAGMA foreign_keys = ON;');
  } catch {}
  return drizzle(database);
}
