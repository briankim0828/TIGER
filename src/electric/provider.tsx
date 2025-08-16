import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { SimpleDataAccess } from '../db/queries/simple';

interface ElectricContextType {
  db: SQLite.SQLiteDatabase | null;
  isInitialized: boolean;
}

const ElectricContext = createContext<ElectricContextType>({
  db: null,
  isInitialized: false
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
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
  }, []);

  return (
    <ElectricContext.Provider value={{ db, isInitialized }}>
      {children}
    </ElectricContext.Provider>
  );
}
