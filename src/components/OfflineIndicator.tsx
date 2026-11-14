import React, { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [isOnline]);

  if (isOnline || !visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-900/90 dark:bg-amber-950/95 text-amber-100 border border-amber-500/40 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom duration-300 max-w-md mx-auto"
      role="status"
      aria-live="polite"
    >
      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 shrink-0">
        <WifiOff size={18} />
      </div>
      <div className="flex-1 text-xs">
        <p className="font-bold text-amber-200">وضع عدم الاتصال بالإنترنت</p>
        <p className="text-amber-100/80">المصحف والأذكار والميزات المخزنة تعمل دون انقطاع.</p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition"
        title="إغلاق"
        aria-label="إغلاق إشعار عدم الاتصال"
      >
        <X size={14} />
      </button>
    </div>
  );
};

