import { useEffect, useRef } from 'react';

interface MediaSessionProps {
  isPlaying: boolean;
  surahName?: string;
  ayahNumber?: number;
  reciterName?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export function useMediaSessionAndKeepAlive({
  isPlaying,
  surahName,
  ayahNumber,
  reciterName,
  onPlay,
  onPause,
  onNext,
  onPrevious,
}: MediaSessionProps) {
  const wakeLockRef = useRef<any>(null);

  // 1. Media Session API for lock screen controls and background playback
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (isPlaying && surahName) {
      const title = ayahNumber ? `سورة ${surahName} - الآية ${ayahNumber}` : `سورة ${surahName}`;
      const artist = reciterName ? `القارئ: ${reciterName}` : 'مداد الرحمن';

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: 'مداد الرحمن - القرآن الكريم وتلاوته',
        artwork: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = 'playing';
    } else {
      navigator.mediaSession.playbackState = 'paused';
    }

    if (onPlay) {
      navigator.mediaSession.setActionHandler('play', onPlay);
    }
    if (onPause) {
      navigator.mediaSession.setActionHandler('pause', onPause);
    }
    if (onNext) {
      navigator.mediaSession.setActionHandler('nexttrack', onNext);
    }
    if (onPrevious) {
      navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }
    };
  }, [isPlaying, surahName, ayahNumber, reciterName, onPlay, onPause, onNext, onPrevious]);

  // 2. Screen Wake Lock API during active recitation (prevents mobile screen cutoff)
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isPlaying) {
        try {
          if (!wakeLockRef.current) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
              wakeLockRef.current = null;
            });
          }
        } catch (err) {
          // Wake lock may fail if battery saver is on; silently catch
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {
          // Ignore
        }
        wakeLockRef.current = null;
      }
    };

    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isPlaying]);

  // 3. Keep-Alive Heartbeat: Periodically pings Service Worker to maintain background state
  useEffect(() => {
    const pingWorker = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'KEEP_ALIVE',
          timestamp: Date.now(),
        });
      }
    };

    // Ping every 90 seconds
    const interval = setInterval(pingWorker, 90000);
    // Initial ping
    pingWorker();

    return () => clearInterval(interval);
  }, []);
}
