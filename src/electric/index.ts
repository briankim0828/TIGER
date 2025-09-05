export { 
  ElectricProviderComponent as ElectricProvider, 
  useElectric 
} from './provider';

// Local-only lightweight live-query emulation utilities
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useElectric as useElectricCtx } from './provider';
export type LiveDeps = Array<string | number | undefined | null>;

type LiveOptions = {
  watchTables: string[]; // e.g., ['workout_sets', 'workout_exercises']
  deps?: LiveDeps;       // additional deps to recompute
};

export function useLiveQuery<T>(compute: () => Promise<T> | T, options: LiveOptions) {
  const { isLiveReady, live } = useElectricCtx();
  const { watchTables, deps = [] } = options;
  const versionKey = useMemo(() => watchTables.map(t => `${t}:${live.tableVersions[t] ?? 0}`).join('|'), [watchTables, live.tableVersions]);
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Promise.resolve(compute());
      if (mountedRef.current) setData(res);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [compute]);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    // Whether live is ready or not, run once on mount/dep change
    // If live is ready, this will re-run whenever tableVersions bump via versionKey
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey, ...deps]);

  return { data, loading, isLive: isLiveReady } as const;
}

export function useLiveNotifier() {
  const { live } = useElectricCtx();
  return useCallback((tables: string[]) => live.bump(tables), [live]);
}
