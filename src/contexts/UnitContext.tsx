import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnitSystem } from '../utils/units';

type UnitContextValue = {
  unit: UnitSystem;
  setUnit: (unit: UnitSystem) => void;
  isLoaded: boolean;
};

const UnitContext = createContext<UnitContextValue | undefined>(undefined);

const STORAGE_KEY = 'tiger:unit';

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
