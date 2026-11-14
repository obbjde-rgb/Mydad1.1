// Safe localStorage sandboxing/polyfill for iframes and third-party-cookie-blocked browsers
try {
  const testKey = '__storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn("localStorage is blocked or disabled in this environment. Using secure in-memory backup to prevent crash.", e);
  const memoryStore: Record<string, string> = {};
  const mockStorage: Storage = {
    get length() {
      return Object.keys(memoryStore).length;
    },
    clear: () => {
      for (const k in memoryStore) {
        delete memoryStore[k];
      }
    },
    getItem: (key: string) => {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    },
    key: (index: number) => {
      return Object.keys(memoryStore)[index] || null;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    setItem: (key: string, value: string) => {
      memoryStore[key] = String(value);
    }
  };
  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    console.error("Could not override localStorage:", err);
  }
}

import { registerSW } from 'virtual:pwa-register';

// Register Service Worker via VitePWA for full offline capability
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.log('[PWA] App core data & assets are ready for offline use.');
    },
    onRegisterError(error) {
      console.warn('[PWA] Service Worker registration error:', error);
    },
  });
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
