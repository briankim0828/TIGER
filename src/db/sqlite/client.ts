import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

// Create a Drizzle client directly from an expo-sqlite database instance.
export function createDrizzleClient(database: SQLite.SQLiteDatabase) {
  return drizzle(database);
}
