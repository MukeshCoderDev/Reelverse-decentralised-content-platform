/**
 * Canonical route path helpers for video navigation
 * Supports both HashRouter and BrowserRouter
 */

/**
 * Generate watch page path for video content
 * @param id - Video ID to encode
 * @returns Encoded watch path
 */
export const watchPath = (id: string) => `/watch/${encodeURIComponent(id)}`;

/**
 * Generate live page path for live streams
 * @param id - Live stream ID to encode
 * @returns Encoded live path
 */
export const livePath = (id: string) => `/live/${encodeURIComponent(id)}`;

/**
 * Generate time parameter for deep linking to specific timestamp
 * @param sec - Seconds to jump to (optional)
 * @returns Query parameter string or empty string
 */
export const timeParam = (sec?: number) => (sec && sec > 0 ? `?t=${Math.floor(sec)}` : '');

/**
 * Combine watch path with time parameter
 * @param id - Video ID
 * @param startTime - Optional start time in seconds
 * @returns Complete watch URL with timecode
 */
export const watchPathWithTime = (id: string, startTime?: number) => 
  `${watchPath(id)}${timeParam(startTime)}`;

/**
 * Extract video ID from watch path
 * @param path - Watch path to parse
 * @returns Decoded video ID or null
 */
export const parseVideoId = (path: string): string | null => {
  const match = path.match(/\/watch\/(.+?)(?:\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
};