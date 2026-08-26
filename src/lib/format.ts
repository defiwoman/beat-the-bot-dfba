export function formatPrice(price: number): string {
  return price.toFixed(2);
}

/** Illustrative game prices, shown in the BTC-scale format the game uses. */
export function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** A signed dollar delta, for slippage and price gaps. */
export function formatUsdDelta(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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
