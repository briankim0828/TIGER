import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { SimpleDataAccess } from '../db/queries/simple';

interface ElectricContextType {
  db: SQLite.SQLiteDatabase | null;
  isInitialized: boolean;
  isLiveReady: boolean; // live query capability ready (local-only emulation is fine)
  // Minimal live system (local-only): version map + bump function
  live: {
    tableVersions: Record<string, number>;
    bump: (tables: string[]) => void;
  };
}

const ElectricContext = createContext<ElectricContextType>({
  db: null,
  isInitialized: false,
  isLiveReady: false,
  live: { tableVersions: {}, bump: () => {} },
});

export function useElectric() {
  const context = useContext(ElectricContext);
  if (!context) {
    throw new Error('useElectric must be used within an ElectricProvider');
  }
  return context;
}

interface ElectricProviderProps {
  children: React.ReactNode;
}

export function ElectricProviderComponent({ children }: ElectricProviderProps) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLiveReady, setIsLiveReady] = useState(false);
  const [tableVersions, setTableVersions] = useState<Record<string, number>>({});

  const bump = (tables: string[]) => {
    if (!tables || tables.length === 0) return;
    setTableVersions((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const t of tables) next[t] = (next[t] ?? 0) + 1;
      return next;
    });
  };

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        console.log('Initializing database...');
        
        // Open SQLite database
        const database = await SQLite.openDatabaseAsync('pr_app.db');
        setDb(database);
        
        // Initialize tables using SimpleDataAccess
        const dataAccess = new SimpleDataAccess(database);
        await dataAccess.initializeTables();
        
        // Seed sample data
        await dataAccess.seedSampleData();
        
        setIsInitialized(true);
  // Local-only live capability is available immediately; real Electric wiring can replace this later.
  setIsLiveReady(true);
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
  }, []);

  // Avoid rendering children until DB is ready to prevent "Database not initialized" errors from hooks.
  if (!isInitialized || !db) {
    return (
      <ElectricContext.Provider value={{ db, isInitialized, isLiveReady, live: { tableVersions, bump } }}>
        {null}
      </ElectricContext.Provider>
    );
  }

  return (
    <ElectricContext.Provider value={{ db, isInitialized, isLiveReady, live: { tableVersions, bump } }}>
      {children}
    </ElectricContext.Provider>
  );
}
