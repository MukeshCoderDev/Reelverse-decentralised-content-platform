/**
 * Parse timecode strings (e.g., 1h2m3s) into seconds
 * @param t - Timecode string
 * @returns Time in seconds
 */
export function parseTimecode(t: string): number {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  
  const match = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(t);
  if (!match) return 0;
  
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  
  return h * 3600 + m * 60 + s;
}

/**
 * Format view counts with compact notation
 * @param n - Number of views
 * @returns Formatted view count string
 */
export function formatViews(n?: number): string {
  if (!n) return '';
  return Intl.NumberFormat('en', { notation: 'compact' }).format(n);
}

/**
 * Format duration in seconds to MM:SS format
 * @param s - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(s?: number): string {
  if (!s && s !== 0) return '';
  const minutes = Math.floor((s || 0) / 60);
  const seconds = Math.floor((s || 0) % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}