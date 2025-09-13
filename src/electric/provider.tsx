import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { SimpleDataAccess } from '../db/queries/simple';
import { seedExerciseCatalog } from '../db/seed/exerciseCatalogSeed';
import { startBackgroundFlusher } from '../db/sync/flush';
import { startupSync } from '../db/sync/startup';
import { supabase } from '../utils/supabaseClient';

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
  const [stopFlusher, setStopFlusher] = useState<(() => void) | null>(null);
  const initStartedRef = useRef(false);

  const bump = (tables: string[]) => {
    if (!tables || tables.length === 0) return;
    setTableVersions((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const t of tables) next[t] = (next[t] ?? 0) + 1;
      return next;
    });
  };

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    const initializeDatabase = async () => {
      try {
        console.log('Initializing database...');
        
        // Open SQLite database
        const database = await SQLite.openDatabaseAsync('pr_app.db');
        setDb(database);
        
        // Initialize tables using SimpleDataAccess
  const dataAccess = new SimpleDataAccess(database);
  await dataAccess.initializeTables();
        
  // Seed canonical exercise catalog (idempotent)
  await seedExerciseCatalog(database, { log: true });
        
        setIsInitialized(true);
  // Local-only live capability is available immediately; real Electric wiring can replace this later.
  setIsLiveReady(true);
        console.log('Database initialized successfully');

        // Start background outbox flusher
  const stop = startBackgroundFlusher(database, { intervalMs: 3000 });
        setStopFlusher(() => stop);

        // After auth resolves, run startup snapshot pull
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const userId = user?.id;
          if (userId) {
            await startupSync(database, userId, { log: true });
            // If any local-first data was created before auth using placeholder 'local-user', reassign it to real user
            try {
              await database.withTransactionAsync(async () => {
                await database.runAsync(`UPDATE splits SET user_id = ? WHERE user_id = 'local-user'`, [userId]);
                await database.runAsync(`UPDATE split_day_assignments SET user_id = ? WHERE user_id = 'local-user'`, [userId]);
                await database.runAsync(`UPDATE workout_sessions SET user_id = ? WHERE user_id = 'local-user'`, [userId]);
                // Fix outbox payloads containing the placeholder user_id
                await database.runAsync(
                  `UPDATE outbox SET payload = REPLACE(payload, '"user_id":"local-user"', '"user_id":"${userId}"') WHERE payload LIKE '%"user_id":"local-user"%'`
                );
              });
            } catch (e) {
              console.warn('[sync] local-user reassignment failed', e);
            }
            // Reset any failed/processing outbox entries to pending now that we're authenticated, then trigger flush
            try {
              await database.runAsync(`UPDATE outbox SET status = 'pending' WHERE status IN ('failed','processing')`);
            } catch {}
          } else {
            console.log('[sync] Skipping startup pull: no authenticated user');
          }
        } catch (e) {
          console.warn('[sync] startup pull failed', e);
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
    return () => {
      // cleanup flusher on unmount
      try { stopFlusher?.(); } catch {}
    };
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
