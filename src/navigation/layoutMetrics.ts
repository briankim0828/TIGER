let bottomNavHeight = 64;
const listeners = new Set<(h: number) => void>();

export function setBottomNavHeight(h: number) {
  if (!Number.isFinite(h)) return;
  if (h === bottomNavHeight) return;
  bottomNavHeight = h;
  listeners.forEach((cb) => {
    try { cb(h); } catch {}
  });
}

export function getBottomNavHeight() {
  return bottomNavHeight;
}

export function onBottomNavHeightChange(cb: (h: number) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
