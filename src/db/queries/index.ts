// Simple data access layer for local SQLite database
import * as SQLite from 'expo-sqlite';
import { useMemo } from 'react';
import { SimpleDataAccess } from './simple';
import { ProgramBuilderDataAccess } from './programBuilder.drizzle';

// Hook to access database from the Electric context
import { useElectric } from '../../electric';

export function useDatabase() {
  const { db } = useElectric();
  
  if (!db) {
    throw new Error('Database not initialized. Make sure ElectricProvider is wrapping your app.');
  }

  // Memoize the data access wrapper to keep a stable reference across renders
  const client = useMemo(() => new ProgramBuilderDataAccess(db), [db]);
  return client;
}

// Export the SimpleDataAccess class for direct use
export { SimpleDataAccess, ProgramBuilderDataAccess };
