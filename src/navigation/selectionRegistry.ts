// Lightweight registry to pass selection results back to arbitrary callers
// without putting non-serializable callbacks into the navigation state.

export type ExerciseLite = { id: string; name: string };
export type SelectionCallback = (items: ExerciseLite[]) => void | Promise<void>;

const REGISTRY = new Map<string, SelectionCallback>();

export function registerSelectionCallback(requestId: string, cb: SelectionCallback) {
  REGISTRY.set(requestId, cb);
}

export function consumeSelectionCallback(requestId: string): SelectionCallback | undefined {
  const cb = REGISTRY.get(requestId);
  if (cb) REGISTRY.delete(requestId);
  return cb;
}

export function clearSelectionCallback(requestId: string) {
  REGISTRY.delete(requestId);
}
