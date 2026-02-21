/**
 * Convert basis points to human-readable percentage string.
 * 390 -> "3.90%", -150 -> "-1.50%"
 */
export function bpsToPercent(bps) {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

/**
 * Percentage change between two values.
 * percentChange(100, 120) = 20 (20% increase)
 * percentChange(100, 80) = -20 (20% decrease)
 * Returns 0 if both are 0, Infinity if previous is 0.
 */
export function percentChange(previous, current) {
  const prev = Number(previous);
  const curr = Number(current);
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return curr > 0 ? Infinity : -Infinity;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/**
 * Format a raw token amount given decimals into human readable.
 * e.g. 1500000000000 with decimals=6 -> "1.50M"
 */
export function formatTokenAmount(raw, decimals) {
  const value = Number(raw) / Math.pow(10, Number(decimals));
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}
