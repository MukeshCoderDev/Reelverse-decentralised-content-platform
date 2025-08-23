import { useEffect, useState } from 'react';
import { copyToClipboard, shareUrlAtCurrentTime } from '../utils/share';

/**
 * Custom hook for player keyboard shortcuts
 * @param ref - React ref to video element
 * @param videoId - Current video ID
 */
export function usePlayerShortcuts(
  ref: React.RefObject<HTMLVideoElement>,
  videoId?: string
) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const onKey = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'k':
        case ' ':
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;
        case 'j':
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'l':
          video.currentTime = Math.min(
            video.duration - 1,
            video.currentTime + 10
          );
          break;
        case 'arrowleft':
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'arrowright':
          video.currentTime = Math.min(
            video.duration - 1,
            video.currentTime + 5
          );
          break;
        case 'm':
          video.muted = !video.muted;
          break;
        case 'f':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            video.requestFullscreen?.();
          }
          break;
        case 'c':
          // Toggle captions if present
          break;
        case '?':
          e.preventDefault();
          setShowShortcuts(true);
          break;
        case 's':
          // Share current time
          if (videoId) {
            const link = shareUrlAtCurrentTime(videoId, video.currentTime);
            copyToClipboard(link);
          }
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref, videoId]);

  return { showShortcuts, setShowShortcuts };
}