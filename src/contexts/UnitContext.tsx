import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnitSystem } from '../utils/units';
import { useElectric } from '../electric';

type UnitContextValue = {
  unit: UnitSystem;
  setUnit: (unit: UnitSystem) => void;
  isLoaded: boolean;
};

const UnitContext = createContext<UnitContextValue | undefined>(undefined);

const STORAGE_KEY = 'tiger:unit';
const MIGRATION_KEY = 'tiger:migrate_set_weights_to_kg_v1';
const LEGACY_LB_PER_KG = 2.20462;

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { db, isInitialized } = useElectric();
  const [unit, setUnitState] = useState<UnitSystem>('kg');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (v === 'kg' || v === 'lb') setUnitState(v);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One-time migration: older builds treated workout_sets.weight_kg as lbs in the UI.
  // Convert stored weights to kg so storage matches field semantics going forward.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isLoaded) return;
        if (!isInitialized || !db) return;
        const done = await AsyncStorage.getItem(MIGRATION_KEY);
        if (cancelled || done === '1') return;
        await db.runAsync(
          `UPDATE workout_sets
           SET weight_kg = ROUND(weight_kg / ?, 2)
           WHERE weight_kg IS NOT NULL AND weight_kg > 0`,
          [LEGACY_LB_PER_KG]
        );
        await AsyncStorage.setItem(MIGRATION_KEY, '1');
      } catch {
        // If migration fails, do not block app usage.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isInitialized, isLoaded]);

  const setUnit = useCallback((next: UnitSystem) => {
    setUnitState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<UnitContextValue>(() => ({ unit, setUnit, isLoaded }), [unit, setUnit, isLoaded]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
};

export const useUnit = () => {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnit must be used within UnitProvider');
  return ctx;
};
