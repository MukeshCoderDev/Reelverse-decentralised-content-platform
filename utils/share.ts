import { watchPath } from './routes';

/**
 * Generate share URL with current time parameter
 * @param id - Video ID
 * @param currentSec - Current time in seconds
 * @returns Share URL with time parameter
 */
export function shareUrlAtCurrentTime(id: string, currentSec: number): string {
  const url = new URL(window.location.origin + watchPath(id));
  url.searchParams.set('t', String(Math.floor(currentSec)));
  return url.toString();
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}