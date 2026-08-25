export function formatPrice(price: number): string {
  return price.toFixed(2);
}

export function formatMs(ms: number): string {
  return `${Math.round(ms)}ms`;
}

export function formatTicks(ticks: number): string {
  const rounded = Math.round(ticks * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}`;
}

export function formatUnits(units: number): string {
  return Math.round(units).toLocaleString('en-US');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
