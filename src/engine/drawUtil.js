/**
 * Shared canvas helpers — color manipulation.
 */

export function shade(hex, amount) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + Math.round(255 * amount)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * amount)));
  const b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function withAlpha(hex, a) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return `rgba(0,0,0,${a})`;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
