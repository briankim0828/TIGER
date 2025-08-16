// Simple data access layer for local SQLite database
import * as SQLite from 'expo-sqlite';
import { SimpleDataAccess } from './simple';

// Hook to access database from the Electric context
import { useElectric } from '../../electric';

export function useDatabase() {
  const { db } = useElectric();
  
  if (!db) {
    throw new Error('Database not initialized. Make sure ElectricProvider is wrapping your app.');
  }

  return new SimpleDataAccess(db);
}

// Export the SimpleDataAccess class for direct use
export { SimpleDataAccess };
