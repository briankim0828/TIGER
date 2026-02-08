export type UnitSystem = 'kg' | 'lb';

const KG_TO_LB = 2.2046226218;

function roundWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
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

export function toDisplayWeight(valueKg: number, unit: UnitSystem): number {
  const display = unit === 'lb' ? kgToLb(valueKg) : valueKg;
  return roundWeight(display);
}

export function toStorageKg(displayValue: number, unit: UnitSystem): number {
  const kg = unit === 'lb' ? lbToKg(displayValue) : displayValue;
  return roundWeight(kg);
}

export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  // Trim trailing .0
  const s = rounded.toFixed(decimals);
  if (decimals > 0) return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return s;
}

export function formatWeightFromKg(kg: number | null | undefined, unit: UnitSystem, decimals = 1): string {
  if (kg === null || kg === undefined) return '';
  // We always show weights as integers across the app.
  const displayInt = toDisplayWeight(kg, unit);
  return formatNumber(displayInt, 0);
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
