export type UnitSystem = 'kg' | 'lb';

const KG_TO_LB = 2.2046226218;

function roundWeight(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return 0;
  const p = Math.pow(10, decimals);
  return Math.round(value * p) / p;
}

export function unitLabel(unit: UnitSystem): string {
  return unit === 'lb' ? 'lbs' : 'kg';
}

export function kgToLb(kg: number): number {
  return kg * KG_TO_LB;
}

export function lbToKg(lb: number): number {
  return lb / KG_TO_LB;
}

// Legacy name retained for compatibility with existing call sites.
// Storage is now pounds by default.
export function toDisplayWeight(valueLb: number, unit: UnitSystem): number {
  const display = unit === 'lb' ? valueLb : lbToKg(valueLb);
  return roundWeight(display, 1);
}

// Legacy name retained for compatibility with existing call sites.
// Returns storage value in pounds.
export function toStorageKg(displayValue: number, unit: UnitSystem): number {
  const lb = unit === 'lb' ? displayValue : kgToLb(displayValue);
  return roundWeight(lb, 1);
}

export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  // Trim trailing .0
  const s = rounded.toFixed(decimals);
  if (decimals > 0) return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return s;
}

export function formatWeightFromKg(lb: number | null | undefined, unit: UnitSystem, decimals = 1): string {
  if (lb === null || lb === undefined) return '';
  const display = toDisplayWeight(lb, unit);
  return formatNumber(display, decimals);
}

export function formatVolumeFromKg(totalVolumeKg: number | null | undefined, unit: UnitSystem, decimals = 0): string {
  const v = totalVolumeKg ?? 0;
  const display = unit === 'lb' ? kgToLb(v) : v;
  // For volume, default to integer-like display
  if (decimals === 0) return Math.round(display).toLocaleString();
  return formatNumber(display, decimals);
}

export function nearlyEqual(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) <= eps;
}
