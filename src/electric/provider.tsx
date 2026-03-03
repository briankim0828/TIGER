import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { SimpleDataAccess } from '../db/queries/simple';
import { startBackgroundFlusher } from '../db/sync/flush';
import { startupSync } from '../db/sync/startup';
import { pullSnapshotForTable } from '../db/sync/pull';
import { supabase } from '../utils/supabaseClient';
import type { AppAuthMode } from '../auth/mode';
import { LOCAL_GUEST_USER_ID } from '../auth/mode';

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
  mode?: AppAuthMode;
}

export function ElectricProviderComponent({ children, mode = 'authenticated' }: ElectricProviderProps) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLiveReady, setIsLiveReady] = useState(false);
  const [tableVersions, setTableVersions] = useState<Record<string, number>>({});
  const stopFlusherRef = useRef<(() => void) | null>(null);
  const initStartedRef = useRef(false);
  const lastSyncUserIdRef = useRef<string | null>(null);
  const syncInProgressRef = useRef<Promise<void> | null>(null);

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
        console.log('Initializing database...', { mode });
        
        // Open SQLite database
        const dbName = mode === 'guest' ? 'pr_app_guest.db' : 'pr_app_auth.db';
        const database = await SQLite.openDatabaseAsync(dbName);
        setDb(database);
        
        // Initialize tables using SimpleDataAccess
  const dataAccess = new SimpleDataAccess(database);
  await dataAccess.initializeTables();
        
        setIsInitialized(true);
  // Local-only live capability is available immediately; real Electric wiring can replace this later.
  setIsLiveReady(true);
        console.log('Database initialized successfully');

        if (mode !== 'guest') {
          // Start background outbox flusher
          const stop = startBackgroundFlusher(database, { intervalMs: 3000 });
          stopFlusherRef.current = stop;
        }

        // After auth resolves, run startup snapshot pull.
        // In guest mode, only pull shared exercise catalog (source of truth).
        if (mode === 'guest') {
          try {
            await pullSnapshotForTable(database, 'exercise_catalog', LOCAL_GUEST_USER_ID, true);
            bump(['exercise_catalog']);
          } catch (e) {
            console.warn('[sync] guest exercise_catalog pull failed', e);
          }
        }

        if (mode !== 'guest') {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id;
            if (userId) {
              // Mark userId before starting sync so the onAuthStateChange
              // listener won't kick off a duplicate concurrent pull.
              lastSyncUserIdRef.current = userId;
              const syncPromise = startupSync(database, userId, { log: true });
              syncInProgressRef.current = syncPromise;
              await syncPromise;
              syncInProgressRef.current = null;
              // Reset any failed/processing outbox entries to pending now that we're authenticated, then trigger flush
              try {
                await database.runAsync(`UPDATE outbox SET status = 'pending' WHERE status IN ('failed','processing')`);
              } catch {}
              // Clean up orphaned outbox INSERT entries (rows that no longer exist locally)
              // This handles cases where user cancelled a workout but the INSERT entries remained
              try {
                await database.runAsync(`
                  DELETE FROM outbox WHERE op = 'insert' AND table_name = 'workout_sessions'
                  AND row_id NOT IN (SELECT id FROM workout_sessions)
                `);
                await database.runAsync(`
                  DELETE FROM outbox WHERE op = 'insert' AND table_name = 'workout_exercises'
                  AND row_id NOT IN (SELECT id FROM workout_exercises)
                `);
                await database.runAsync(`
                  DELETE FROM outbox WHERE op = 'insert' AND table_name = 'workout_sets'
                  AND row_id NOT IN (SELECT id FROM workout_sets)
                `);
                await database.runAsync(`
                  DELETE FROM outbox WHERE op = 'insert' AND table_name = 'splits'
                  AND row_id NOT IN (SELECT id FROM splits)
                `);
                await database.runAsync(`
                  DELETE FROM outbox WHERE op = 'insert' AND table_name = 'split_day_assignments'
                  AND row_id NOT IN (SELECT id FROM split_day_assignments)
                `);
                console.log('[sync] Cleaned up orphaned outbox entries');
              } catch (e) {
                console.warn('[sync] outbox cleanup failed', e);
              }
            } else {
              console.log('[sync] Skipping startup pull: no authenticated user');
            }
          } catch (e) {
            console.warn('[sync] startup pull failed', e);
          }
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
    return () => {
      // cleanup flusher on unmount
      try { stopFlusherRef.current?.(); } catch {}
    };
  }, [mode]);

  useEffect(() => {
    if (!db || !isInitialized || mode === 'guest') return;
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const userId = session?.user?.id ?? null;
      if (!userId) {
        lastSyncUserIdRef.current = null;
        return;
      }
      if (lastSyncUserIdRef.current === userId) return;
      // Wait for any in-flight sync to finish before starting a new one
      // to avoid concurrent transactions on the same SQLite connection.
      if (syncInProgressRef.current) {
        try { await syncInProgressRef.current; } catch {}
      }
      // Re-check after awaiting — the in-flight sync may have handled this user
      if (lastSyncUserIdRef.current === userId) return;
      lastSyncUserIdRef.current = userId;
      try {
        const syncPromise = startupSync(db, userId, { log: true });
        syncInProgressRef.current = syncPromise;
        await syncPromise;
        syncInProgressRef.current = null;
      } catch (e) {
        syncInProgressRef.current = null;
        console.warn('[sync] startup pull failed', e);
      }
    });

    return () => {
      try { (authListener as any)?.subscription?.unsubscribe?.(); } catch {}
    };
  }, [db, isInitialized, mode]);

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
