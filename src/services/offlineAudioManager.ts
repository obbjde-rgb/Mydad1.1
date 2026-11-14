import { SURAH_AYAH_COUNTS } from '../constants';
import { Surah } from '../types';
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/utils';

export const OFFLINE_AUDIO_CACHE_NAME = 'quran-audio-cache';
export const OFFLINE_DATA_CACHE_NAME = 'midad-offline-data';

export interface OfflineReciterOption {
  id: string;
  name: string;
  folder: string;
  bitrate: string;
  estimatedFullMB: number;
  qualityLabel: string;
}

export const OFFLINE_RECITERS: OfflineReciterOption[] = [
  {
    id: 'ar.alafasy',
    name: 'مشاري العفاسي',
    folder: 'Alafasy_128kbps',
    bitrate: '128',
    estimatedFullMB: 680,
    qualityLabel: 'جودة عالية (128kbps) — يشمل تلاوات أساسية مدمجة',
  },
  {
    id: 'ar.mahermuaiqly',
    name: 'ماهر المعيقلي',
    folder: 'Maher_AlMuaiqly_64kbps',
    bitrate: '128',
    estimatedFullMB: 360,
    qualityLabel: 'حجم متوازن (64kbps)',
  },
  {
    id: 'ar.husary',
    name: 'محمود خليل الحصري',
    folder: 'Husary_128kbps',
    bitrate: '128',
    estimatedFullMB: 720,
    qualityLabel: 'جودة عالية واضحة للتعليم (128kbps)',
  },
  {
    id: 'ar.mahmoudalialbanna',
    name: 'محمود علي البنا',
    folder: 'Mahmoud_Ali_Al_Banna_32kbps',
    bitrate: '128',
    estimatedFullMB: 210,
    qualityLabel: 'حجم اقتصادي موفر للمساحة (32kbps)',
  },
];

// Bundled offline MP3 files shipped inside /public/audio/offline/ (Alafasy)
export const isAyahBundledOffline = (surahNum: number, ayahNum: number): boolean => {
  if (surahNum === 1) return true;
  if (surahNum === 2 && ayahNum === 255) return true;
  if (surahNum >= 97 && surahNum <= 114) return true;
  return false;
};

export const getBundledOfflineAudioUrl = (surahNum: number, ayahNum: number): string | null => {
  if (!isAyahBundledOffline(surahNum, ayahNum)) return null;
  const sp = String(surahNum).padStart(3, '0');
  const ap = String(ayahNum).padStart(3, '0');
  return `/audio/offline/${sp}${ap}.mp3`;
};

export const getGlobalAyahIndex = (surahNum: number, ayahNum: number): number => {
  let total = 0;
  for (let i = 0; i < surahNum - 1; i++) {
    total += SURAH_AYAH_COUNTS[i] || 0;
  }
  return total + ayahNum;
};

export const getCanonicalAudioUrls = (
  reciterId: string,
  surahNum: number,
  ayahNum: number
): { primaryUrl: string; everyAyahUrl: string; mirrorUrl: string } => {
  const reciterOpt = OFFLINE_RECITERS.find((r) => r.id === reciterId);
  const bitrate = reciterOpt?.bitrate || '128';
  const globalAyah = getGlobalAyahIndex(surahNum, ayahNum);
  const sp = String(surahNum).padStart(3, '0');
  const ap = String(ayahNum).padStart(3, '0');

  const primaryUrl = `https://cdn.islamic.network/quran/audio/${bitrate}/${reciterId}/${globalAyah}.mp3`;
  const folder = reciterOpt?.folder || 'Alafasy_128kbps';
  const everyAyahUrl = `https://everyayah.com/data/${folder}/${sp}${ap}.mp3`;
  const mirrorUrl = `https://mirrors.quranicaudio.com/everyayah/${folder}/${sp}${ap}.mp3`;

  return { primaryUrl, everyAyahUrl, mirrorUrl };
};

// Local Tafsir Al-Muyassar cache (loaded from /data/tafsir-muyassar.json or CacheStorage)
let tafsirMapPromise: Promise<Record<string, string> | null> | null = null;
let tafsirMapMemory: Record<string, string> | null = null;

export const getLocalTafsir = async (surahNum: number, ayahNum: number): Promise<string | null> => {
  const key = `${surahNum}:${ayahNum}`;
  if (tafsirMapMemory) {
    return tafsirMapMemory[key] || null;
  }
  if (!tafsirMapPromise) {
    tafsirMapPromise = (async () => {
      try {
        if ('caches' in window) {
          const dataCache = await caches.open(OFFLINE_DATA_CACHE_NAME);
          const cached = await dataCache.match('/data/tafsir-muyassar.json');
          if (cached) {
            const json = await cached.json();
            if (json && typeof json === 'object') {
              tafsirMapMemory = json as Record<string, string>;
              return tafsirMapMemory;
            }
          }
        }
        const res = await fetch('/data/tafsir-muyassar.json');
        if (res.ok) {
          if ('caches' in window) {
            const dataCache = await caches.open(OFFLINE_DATA_CACHE_NAME);
            await dataCache.put('/data/tafsir-muyassar.json', res.clone());
          }
          const json = await res.json();
          if (json && typeof json === 'object') {
            tafsirMapMemory = json as Record<string, string>;
            return tafsirMapMemory;
          }
        }
      } catch {
        // ignore
      }
      tafsirMapPromise = null;
      return null;
    })();
  }
  const map = await tafsirMapPromise;
  return map ? map[key] || null : null;
};

// Cache validation helper: ensures a fetched Response is real audio (not HTML/XML/JSON error page)
export const extractValidAudioBlob = async (res: Response): Promise<Blob | null> => {
  if (!res || !res.ok) return null;
  const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
  if (
    contentType.includes('text/html') ||
    contentType.includes('application/json') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml') ||
    contentType.includes('text/plain')
  ) {
    return null;
  }
  const blob = await res.blob();
  if (!blob || blob.size < 1000) return null;
  try {
    const headText = (await blob.slice(0, 64).text()).trimStart();
    if (headText.startsWith('<') || headText.startsWith('{')) {
      return null;
    }
  } catch {
    // ignore slice read error
  }
  return blob;
};

// Track which Surahs are cached for a reciter (initially empty until verified in CacheStorage)
const storageKeyForReciter = (reciterId: string) => `offline_downloaded_surahs_v2_${reciterId}`;

export const getDownloadedSurahsForReciter = (reciterId: string): number[] => {
  try {
    const raw = safeLocalStorageGet(storageKeyForReciter(reciterId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const markSurahDownloaded = (reciterId: string, surahId: number) => {
  const current = new Set(getDownloadedSurahsForReciter(reciterId));
  current.add(surahId);
  safeLocalStorageSet(storageKeyForReciter(reciterId), JSON.stringify(Array.from(current).sort((a, b) => a - b)));
};

export const clearDownloadedSurahsRecord = (reciterId: string) => {
  safeLocalStorageSet(storageKeyForReciter(reciterId), JSON.stringify([]));
};

// Verify REAL CacheStorage contents (no fake counts)
export const verifyDownloadedSurahsFromCache = async (
  reciterId: string,
  quranData: Surah[] | null
): Promise<{
  completedSurahs: number[];
  cachedAyahsCount: number;
  totalAyahsCount: number;
}> => {
  if (!('caches' in window) || !quranData || quranData.length === 0) {
    return {
      completedSurahs: getDownloadedSurahsForReciter(reciterId),
      cachedAyahsCount: 0,
      totalAyahsCount: 6236,
    };
  }

  try {
    const cachedUrlSet = new Set<string>();
    const cacheNames = [OFFLINE_AUDIO_CACHE_NAME, 'mydad-audio-v1'];
    for (const cName of cacheNames) {
      const cache = await caches.open(cName);
      const keys = await cache.keys();
      for (const req of keys) {
        cachedUrlSet.add(req.url);
      }
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const completedSurahs: number[] = [];
    let cachedAyahsCount = 0;
    let totalAyahsCount = 0;

    for (const surah of quranData) {
      const verses = surah.verses || [];
      totalAyahsCount += verses.length;
      let surahCached = 0;

      for (const verse of verses) {
        const { primaryUrl, everyAyahUrl } = getCanonicalAudioUrls(reciterId, surah.id, verse.id);
        const bundledPath = reciterId === 'ar.alafasy' ? getBundledOfflineAudioUrl(surah.id, verse.id) : null;
        const fullBundledUrl = bundledPath ? `${origin}${bundledPath}` : '';

        if (
          cachedUrlSet.has(everyAyahUrl) ||
          cachedUrlSet.has(primaryUrl) ||
          (fullBundledUrl && cachedUrlSet.has(fullBundledUrl))
        ) {
          surahCached++;
          cachedAyahsCount++;
        }
      }

      if (verses.length > 0 && surahCached === verses.length) {
        completedSurahs.push(surah.id);
      }
    }

    safeLocalStorageSet(storageKeyForReciter(reciterId), JSON.stringify(completedSurahs));
    return { completedSurahs, cachedAyahsCount, totalAyahsCount };
  } catch (e) {
    console.warn('Cache verification failed:', e);
    return {
      completedSurahs: getDownloadedSurahsForReciter(reciterId),
      cachedAyahsCount: 0,
      totalAyahsCount: 6236,
    };
  }
};

// Synchronize bundled core JSON & bundled offline MP3s into browser CacheStorage
// so they play reliably offline even in dev mode and across restarts without Range errors
let bundledSyncPromise: Promise<void> | null = null;

export const syncBundledOfflineAssets = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (bundledSyncPromise) return bundledSyncPromise;

  bundledSyncPromise = (async () => {
    try {
      const dataCache = await caches.open(OFFLINE_DATA_CACHE_NAME);
      for (const dataPath of ['/data/quran.json', '/data/tafsir-muyassar.json']) {
        const existing = await dataCache.match(dataPath);
        if (!existing) {
          try {
            const res = await fetch(dataPath);
            if (res.ok && (res.headers.get('Content-Type') || '').includes('json')) {
              await dataCache.put(dataPath, res);
            }
          } catch {
            // ignore
          }
        }
      }

      const audioCache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const bundledTargets: Array<{ surah: number; ayah: number; path: string }> = [];

      for (let a = 1; a <= 7; a++) {
        bundledTargets.push({ surah: 1, ayah: a, path: getBundledOfflineAudioUrl(1, a)! });
      }
      bundledTargets.push({ surah: 2, ayah: 255, path: getBundledOfflineAudioUrl(2, 255)! });
      for (let s = 97; s <= 114; s++) {
        const count = SURAH_AYAH_COUNTS[s - 1] || 0;
        for (let a = 1; a <= count; a++) {
          bundledTargets.push({ surah: s, ayah: a, path: getBundledOfflineAudioUrl(s, a)! });
        }
      }

      const origin = window.location.origin;
      for (let i = 0; i < bundledTargets.length; i += 6) {
        const batch = bundledTargets.slice(i, i + 6);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const { primaryUrl, everyAyahUrl } = getCanonicalAudioUrls('ar.alafasy', item.surah, item.ayah);
              const fullBundledUrl = `${origin}${item.path}`;
              const already =
                (await audioCache.match(fullBundledUrl, { ignoreVary: true })) &&
                (await audioCache.match(primaryUrl, { ignoreVary: true }));
              if (already) return;

              const res = await fetch(item.path);
              const blob = await extractValidAudioBlob(res);
              if (!blob) return;

              const cacheable = new Response(blob, {
                status: 200,
                headers: { 'Content-Type': 'audio/mpeg' },
              });
              await audioCache.put(fullBundledUrl, cacheable.clone());
              await audioCache.put(everyAyahUrl, cacheable.clone());
              await audioCache.put(primaryUrl, cacheable.clone());
            } catch {
              // ignore individual error
            }
          })
        );
      }
    } finally {
      bundledSyncPromise = null;
    }
  })();

  return bundledSyncPromise;
};

export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
};

export const getDeviceStorageInfo = async (): Promise<{
  usageMB: number;
  quotaMB: number;
  persisted: boolean;
}> => {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usageMB: Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10,
        quotaMB: Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10,
        persisted,
      };
    }
  } catch {
    // ignore
  }
  return { usageMB: 0, quotaMB: 0, persisted: false };
};

export interface OfflineDownloadProgress {
  completedAyahs: number;
  totalAyahs: number;
  completedSurahs: number;
  totalSurahs: number;
  currentSurahId: number;
  currentSurahName: string;
  downloadedBytes: number;
  failedCount: number;
}

export const downloadSurahsOffline = async ({
  reciterId,
  surahIds,
  quranData,
  onProgress,
  signal,
}: {
  reciterId: string;
  surahIds: number[];
  quranData: Surah[];
  onProgress: (progress: OfflineDownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<{ completedSurahs: number[]; failedCount: number; cancelled: boolean }> => {
  if (!('caches' in window)) {
    throw new Error('المتصفح لا يدعم Cache Storage للتخزين المحلي.');
  }

  await requestPersistentStorage();
  const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const selectedSurahs = surahIds
    .map((id) => quranData.find((s) => s.id === id))
    .filter((s): s is Surah => Boolean(s));

  const totalAyahs = selectedSurahs.reduce((acc, s) => acc + (s.verses?.length || 0), 0);
  let completedAyahs = 0;
  let completedSurahsCount = 0;
  let downloadedBytes = 0;
  let failedCount = 0;
  const newlyCompletedSurahs: number[] = [];

  for (const surah of selectedSurahs) {
    if (signal?.aborted) {
      return { completedSurahs: newlyCompletedSurahs, failedCount, cancelled: true };
    }

    const ayahs = surah.verses || [];
    let surahFailures = 0;
    const concurrency = 6;

    for (let i = 0; i < ayahs.length; i += concurrency) {
      if (signal?.aborted) {
        return { completedSurahs: newlyCompletedSurahs, failedCount, cancelled: true };
      }

      const batch = ayahs.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (ayah) => {
          if (signal?.aborted) return;

          const { primaryUrl, everyAyahUrl, mirrorUrl } = getCanonicalAudioUrls(reciterId, surah.id, ayah.id);
          const bundledPath = reciterId === 'ar.alafasy' ? getBundledOfflineAudioUrl(surah.id, ayah.id) : null;
          const fullBundledUrl = bundledPath ? `${origin}${bundledPath}` : '';

          try {
            const existing =
              (await cache.match(everyAyahUrl, { ignoreVary: true })) ||
              (await cache.match(primaryUrl, { ignoreVary: true })) ||
              (fullBundledUrl ? await cache.match(fullBundledUrl, { ignoreVary: true }) : undefined);

            if (existing) {
              const existingBlob = await extractValidAudioBlob(existing.clone());
              if (existingBlob) {
                completedAyahs++;
                return;
              }
            }

            const sources: string[] = [];
            if (bundledPath) sources.push(bundledPath);
            sources.push(
              `/api/proxy/audio?url=${encodeURIComponent(everyAyahUrl)}`,
              everyAyahUrl,
              primaryUrl,
              mirrorUrl
            );

            let validBlob: Blob | null = null;
            for (const src of sources) {
              if (signal?.aborted) return;
              try {
                const res = await fetch(src, { signal });
                validBlob = await extractValidAudioBlob(res);
                if (validBlob) break;
              } catch {
                // try next source
              }
            }

            if (validBlob) {
              downloadedBytes += validBlob.size;
              const cacheable = new Response(validBlob, {
                status: 200,
                headers: { 'Content-Type': 'audio/mpeg' },
              });
              await cache.put(everyAyahUrl, cacheable.clone());
              await cache.put(primaryUrl, cacheable.clone());
              if (fullBundledUrl) {
                await cache.put(fullBundledUrl, cacheable.clone());
              }
            } else {
              surahFailures++;
              failedCount++;
            }
          } catch {
            surahFailures++;
            failedCount++;
          } finally {
            completedAyahs++;
          }
        })
      );

      onProgress({
        completedAyahs,
        totalAyahs,
        completedSurahs: completedSurahsCount,
        totalSurahs: selectedSurahs.length,
        currentSurahId: surah.id,
        currentSurahName: surah.name,
        downloadedBytes,
        failedCount,
      });
    }

    if (surahFailures === 0 && !signal?.aborted) {
      markSurahDownloaded(reciterId, surah.id);
      newlyCompletedSurahs.push(surah.id);
    }
    completedSurahsCount++;
    onProgress({
      completedAyahs,
      totalAyahs,
      completedSurahs: completedSurahsCount,
      totalSurahs: selectedSurahs.length,
      currentSurahId: surah.id,
      currentSurahName: surah.name,
      downloadedBytes,
      failedCount,
    });
  }

  return { completedSurahs: newlyCompletedSurahs, failedCount, cancelled: Boolean(signal?.aborted) };
};

export const clearOfflineAudioCache = async () => {
  if ('caches' in window) {
    await caches.delete(OFFLINE_AUDIO_CACHE_NAME);
    await caches.delete('mydad-audio-v1');
  }
  OFFLINE_RECITERS.forEach((r) => clearDownloadedSurahsRecord(r.id));
};

const CACHE_EPOCH_KEY = 'midad_cache_epoch_v3';

/**
 * Purges stale legacy caches once per cache epoch without touching
 * the user's downloaded Quran text, audio, bookmarks, or settings.
 */
export const purgeStaleRuntimeCaches = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    if (safeLocalStorageGet(CACHE_EPOCH_KEY) === 'done') return;

    if ('caches' in window) {
      await caches.delete('mydad-audio-v1').catch(() => {});
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        (k.startsWith('offline_downloaded_surahs_') && !k.startsWith('offline_downloaded_surahs_v2_')) ||
        k.startsWith('dynamic_models_') ||
        k === 'models_last_updated'
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });

    safeLocalStorageSet(CACHE_EPOCH_KEY, 'done');
  } catch {
    // ignore storage access issues
  }
};

/**
 * Resets runtime browser caches, IndexedDB Quran store, cached model lists,
 * and server-side cooldowns. Preserves user's downloaded offline audio by default.
 */
export const resetAppCaches = async ({
  includeOfflineAudio = false,
}: { includeOfflineAudio?: boolean } = {}): Promise<{
  clearedCachesCount: number;
  clearedStorageKeysCount: number;
  serverResetOk: boolean;
}> => {
  let clearedCachesCount = 0;
  let clearedStorageKeysCount = 0;
  let serverResetOk = false;

  // 1. Reset in-memory caches
  tafsirMapMemory = null;
  tafsirMapPromise = null;
  bundledSyncPromise = null;

  // 2. Clear IndexedDB 'TarteelDB' -> 'quran' store
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.open('TarteelDB', 1);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('quran')) {
            db.createObjectStore('quran');
          }
        };
        req.onsuccess = (e: any) => {
          try {
            const db = e.target.result as IDBDatabase;
            if (db.objectStoreNames.contains('quran')) {
              const tx = db.transaction('quran', 'readwrite');
              tx.objectStore('quran').clear();
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onerror = () => {
                db.close();
                resolve();
              };
            } else {
              db.close();
              resolve();
            }
          } catch {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // 3. Clear runtime CacheStorage entries
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const names = await caches.keys();
      for (const name of names) {
        if (!includeOfflineAudio && (name === OFFLINE_AUDIO_CACHE_NAME || name === OFFLINE_DATA_CACHE_NAME)) {
          continue;
        }
        const deleted = await caches.delete(name).catch(() => false);
        if (deleted) clearedCachesCount++;
      }
    } catch {
      // ignore
    }
  }

  // 4. Clear stale model & legacy localStorage keys
  if (typeof localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('dynamic_models_') ||
        k === 'models_last_updated' ||
        (k.startsWith('offline_downloaded_surahs_') && !k.startsWith('offline_downloaded_surahs_v2_')) ||
        (includeOfflineAudio && k.startsWith('offline_downloaded_surahs_v2_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
        clearedStorageKeysCount++;
      } catch {
        // ignore
      }
    });
  }

  // 5. Reset server in-memory cooldowns if online
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch('/api/cache/reset', { method: 'POST' });
      serverResetOk = res.ok;
    } catch {
      serverResetOk = false;
    }
  }

  return { clearedCachesCount, clearedStorageKeysCount, serverResetOk };
};

