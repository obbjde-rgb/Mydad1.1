import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'midad-audio-cache';
const STORE_NAME = 'audio-blobs';
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_ITEMS = 50; // Max number of audio files to keep

let dbPromise: Promise<IDBPDatabase> | null = null;
let cleanupTimerId: ReturnType<typeof setTimeout> | null = null;

const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, { // upgrade version
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        } else if (oldVersion === 1) {
          // If we are upgrading from version 1, we clear the old raw blobs
          transaction.objectStore(STORE_NAME).clear();
        }
      },
    });
  }
  return dbPromise;
};

export const saveAudioToCache = async (key: string, blob: Blob) => {
  try {
    const db = await initDB();
    await db.put(STORE_NAME, {
      blob,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    }, key);
    
    // Trigger cleanup asynchronously with debounce without stacking concurrent IDB transactions
    if (cleanupTimerId) clearTimeout(cleanupTimerId);
    cleanupTimerId = setTimeout(() => {
      cleanupTimerId = null;
      void cleanupAudioCache();
    }, 5000);
  } catch (error) {
    console.error('Failed to save audio to cache:', error);
  }
};

export const getAudioFromCache = async (key: string): Promise<Blob | null> => {
  try {
    const db = await initDB();
    const entry = await db.get(STORE_NAME, key);
    
    if (!entry) return null;
    
    // Support legacy blobs from v1 just in case
    if (entry instanceof Blob) {
      return entry;
    }
    
    if (!(entry.blob instanceof Blob)) return null;

    // Update last accessed time
    entry.lastAccessed = Date.now();
    await db.put(STORE_NAME, entry, key);
    
    return entry.blob;
  } catch (error) {
    console.error('Failed to get audio from cache:', error);
    return null;
  }
};

export const clearAudioCache = async () => {
  try {
    const db = await initDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Failed to clear audio cache:', error);
  }
};

export const cleanupAudioCache = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const keys = await store.getAllKeys();
    
    const now = Date.now();
    let entries = [];
    
    for (const key of keys) {
      const entry = await store.get(key);
      if (entry && !(entry instanceof Blob)) {
        entries.push({ key, lastAccessed: entry.lastAccessed || 0 });
      }
    }
    
    // Delete items older than MAX_CACHE_AGE_MS
    let deletedCount = 0;
    for (const entry of entries) {
      if (now - entry.lastAccessed > MAX_CACHE_AGE_MS) {
        await store.delete(entry.key);
        deletedCount++;
      }
    }
    
    // If still too many, delete oldest
    entries = entries.filter(e => now - e.lastAccessed <= MAX_CACHE_AGE_MS);
    if (entries.length > MAX_CACHE_ITEMS) {
      entries.sort((a, b) => b.lastAccessed - a.lastAccessed); // Newest first
      const toDelete = entries.slice(MAX_CACHE_ITEMS);
      for (const entry of toDelete) {
        await store.delete(entry.key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old audio cache entries.`);
    }
    
    await tx.done;
  } catch (error) {
    console.error('Failed to cleanup audio cache:', error);
  }
};

// Run cleanup on initial load
if (typeof window !== 'undefined') {
  setTimeout(cleanupAudioCache, 10000); // 10 seconds after load
}
