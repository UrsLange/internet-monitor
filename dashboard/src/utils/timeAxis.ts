/**
 * Shared time-axis formatting for Recharts.
 *
 * XAxis is configured with `type="number" scale="time"` so data points
 * are positioned proportionally to their actual timestamps (epoch ms).
 */

/** Short format for axis ticks — adapts based on whether seconds matter. */
export function formatTickTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Longer format for tooltip labels — includes date when it helps. */
export function formatTooltipTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
