import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  PauseCircle,
  Trash2,
  WifiOff,
  BookOpen,
  Volume2,
  Compass,
  RefreshCw,
} from 'lucide-react';
import { Surah } from '../types';
import {
  OFFLINE_RECITERS,
  OfflineDownloadProgress,
  clearOfflineAudioCache,
  downloadSurahsOffline,
  getDeviceStorageInfo,
  getDownloadedSurahsForReciter,
  requestPersistentStorage,
  syncBundledOfflineAssets,
  verifyDownloadedSurahsFromCache,
} from '../services/offlineAudioManager';
import { getSurahDisplayName } from '../lib/utils';

interface OfflineDownloadManagerProps {
  quranData: Surah[] | null;
  activeReciter: string;
  onSelectReciter?: (reciterId: string) => void;
}

export const OfflineDownloadManager: React.FC<OfflineDownloadManagerProps> = ({
  quranData,
  activeReciter,
  onSelectReciter,
}) => {
  const defaultReciter = OFFLINE_RECITERS.some((r) => r.id === activeReciter)
    ? activeReciter
    : 'ar.alafasy';

  const [selectedReciterId, setSelectedReciterId] = useState<string>(defaultReciter);
  const [downloadedSurahs, setDownloadedSurahs] = useState<number[]>(() =>
    getDownloadedSurahsForReciter(defaultReciter)
  );
  const [cachedAyahsCount, setCachedAyahsCount] = useState<number>(0);
  const [totalAyahsCount, setTotalAyahsCount] = useState<number>(6236);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState<number>(18);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<OfflineDownloadProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usageMB: number; quotaMB: number; persisted: boolean }>({
    usageMB: 0,
    quotaMB: 0,
    persisted: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const refreshStats = async (recId: string, syncBundled = false) => {
    if (!isMountedRef.current) return;
    setIsVerifying(true);
    try {
      if (syncBundled && navigator.onLine) {
        await syncBundledOfflineAssets();
      }
      const verified = await verifyDownloadedSurahsFromCache(recId, quranData);
      if (!isMountedRef.current) return;
      setDownloadedSurahs(verified.completedSurahs);
      setCachedAyahsCount(verified.cachedAyahsCount);
      setTotalAyahsCount(verified.totalAyahsCount);
      const info = await getDeviceStorageInfo();
      if (!isMountedRef.current) return;
      setStorageInfo(info);
    } finally {
      if (isMountedRef.current) {
        setIsVerifying(false);
      }
    }
  };

  const hasQuranData = Boolean(quranData && quranData.length > 0);
  useEffect(() => {
    void refreshStats(selectedReciterId, true);
  }, [selectedReciterId, hasQuranData]);

  const startDownload = async (surahIds: number[], label: string) => {
    if (!quranData || quranData.length === 0) {
      setStatusMessage('يرجى الانتظار حتى يكتمل تحميل نص المصحف أولاً.');
      return;
    }
    if (!navigator.onLine) {
      setStatusMessage('يتطلب تحميل ملفات التلاوة الجديدة اتصالاً بالإنترنت لمرة واحدة فقط.');
      return;
    }
    if (isDownloading) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsDownloading(true);
    setStatusMessage(`جاري تحميل ${label}...`);

    try {
      await requestPersistentStorage();
      const result = await downloadSurahsOffline({
        reciterId: selectedReciterId,
        surahIds,
        quranData,
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(p);
        },
      });

      if (result.cancelled) {
        setStatusMessage('تم إيقاف التحميل مؤقتاً. السور المكتملة محفوظة فعلياً وتعمل بدون إنترنت.');
      } else if (result.failedCount > 0) {
        setStatusMessage(
          `اكتمل التحميل مع تعذر ${result.failedCount} آية. يمكنك إعادة الضغط لاستكمال النواقص.`
        );
      } else {
        setStatusMessage(`تم حفظ ${label} في ذاكرة الجهاز بنجاح! يمكنك التجربة الآن بدون إنترنت.`);
      }

      if (onSelectReciter) {
        onSelectReciter(selectedReciterId);
      }
      await refreshStats(selectedReciterId, false);
    } catch (err: any) {
      setStatusMessage(`تعذر إكمال التحميل: ${err?.message || 'تحقق من الاتصال'}`);
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearCache = async () => {
    if (isDownloading) return;
    await clearOfflineAudioCache();
    setProgress(null);
    setStatusMessage('تم مسح جميع التلاوات الصوتية المحملة من ذاكرة الجهاز.');
    await refreshStats(selectedReciterId, false);
  };

  const selectedReciterObj = OFFLINE_RECITERS.find((r) => r.id === selectedReciterId) || OFFLINE_RECITERS[0];
  const progressPercent = progress && progress.totalAyahs > 0
    ? Math.min(100, Math.round((progress.completedAyahs / progress.totalAyahs) * 100))
    : 0;

  return (
    <div
      dir="rtl"
      className="space-y-5 bg-gradient-to-br from-amber-50/90 to-orange-50/70 dark:from-[#1c1917] dark:to-[#14110f] p-5 md:p-6 rounded-3xl border border-amber-200/70 dark:border-amber-800/50 shadow-sm text-right"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-700/20">
            <WifiOff size={20} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-amber-950 dark:text-amber-50 font-kufi">
              التشغيل الكامل بدون إنترنت (Offline)
            </h4>
            <p className="text-xs text-amber-800/75 dark:text-amber-300/70">
              بيانات المصحف والتفسير ومواقيت الصلاة مدمجة فعلياً، ويمكنك حفظ المصحف الصوتي كاملاً على جهازك.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-white/80 dark:bg-black/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200">
          <HardDrive size={14} className="text-amber-600" />
          <span>
            المستخدم: {storageInfo.usageMB} MB
            {storageInfo.quotaMB > 0 ? ` / ${Math.round(storageInfo.quotaMB)} MB` : ''}
          </span>
        </div>
      </div>

      {/* Bundled Ready Data Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold flex items-center gap-1.5">
              <BookOpen size={13} /> المصحف الشريف كاملاً (114 سورة)
            </p>
            <p className="text-[11px] opacity-80">محمل ومثبت داخل التطبيق بدون إنترنت</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold flex items-center gap-1.5">
              <BookOpen size={13} /> التفسير الميسر كاملاً (6236 آية)
            </p>
            <p className="text-[11px] opacity-80">يعمل فوراً بدون اتصال بالشبكة</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold flex items-center gap-1.5">
              <Compass size={13} /> مواقيت الصلاة والأذكار والقبلة
            </p>
            <p className="text-[11px] opacity-80">حساب فلكي محلي 100% دون إنترنت</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold flex items-center gap-1.5">
              <Volume2 size={13} /> التلاوات المحفوظة فعلياً
            </p>
            <p className="text-[11px] opacity-80">
              {cachedAyahsCount} من {totalAyahsCount} آية متوفرة الآن بدون إنترنت
            </p>
          </div>
        </div>
      </div>

      {/* Offline Audio Pack Downloader */}
      <div className="p-4 rounded-2xl bg-white/85 dark:bg-black/25 border border-amber-200/60 dark:border-amber-800/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h5 className="text-sm font-bold text-amber-950 dark:text-amber-100">
              تحميل المصحف الصوتي كاملاً على جهازك
            </h5>
            <p className="text-[11px] text-amber-800/70 dark:text-amber-300/60">
              {isVerifying
                ? `جاري فحص ومطابقة الملفات المحفوظة فعلياً بصوت ${selectedReciterObj.name}...`
                : `تم التحقق فعلياً من حفظ ${downloadedSurahs.length} من أصل 114 سورة (${cachedAyahsCount} آية) بصوت ${selectedReciterObj.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => refreshStats(selectedReciterId, true)}
              disabled={isVerifying || isDownloading}
              className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 transition disabled:opacity-50"
              title="فحص ومزامنة التلاوات المحفوظة"
            >
              <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
            </button>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
              {downloadedSurahs.length} / 114 سورة
            </span>
          </div>
        </div>

        {/* Reciter Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
            اختر القارئ للتحميل بدون إنترنت:
          </label>
          <select
            value={selectedReciterId}
            disabled={isDownloading}
            onChange={(e) => setSelectedReciterId(e.target.value)}
            className="w-full p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-sm outline-none focus:border-amber-500"
          >
            {OFFLINE_RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.qualityLabel} (~{r.estimatedFullMB} MB)
              </option>
            ))}
          </select>
        </div>

        {/* Download Actions */}
        {isDownloading && progress ? (
          <div className="space-y-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-100">
              <span className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin text-amber-600" />
                جاري تحميل {getSurahDisplayName(progress.currentSurahName)}...
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-amber-200/70 dark:bg-amber-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-800/80 dark:text-amber-300/80">
              <span>
                {progress.completedAyahs} / {progress.totalAyahs} آية ({progress.completedSurahs} / {progress.totalSurahs} سورة)
              </span>
              <span>{(progress.downloadedBytes / (1024 * 1024)).toFixed(1)} MB</span>
            </div>
            <button
              type="button"
              onClick={handleStopDownload}
              className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <PauseCircle size={15} /> إيقاف التحميل مؤقتاً (سيتم حفظ ما تم تنزيله)
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  startDownload(
                    Array.from({ length: 114 }, (_, i) => i + 1),
                    `المصحف الكامل (${selectedReciterObj.name})`
                  )
                }
                className="p-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition active:scale-98"
              >
                <Download size={16} />
                <span>تحميل المصحف كاملاً (114 سورة)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  startDownload(
                    Array.from({ length: 37 }, (_, i) => i + 78),
                    `جزء عمّ كاملاً (${selectedReciterObj.name})`
                  )
                }
                className="p-3 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100 border border-amber-300/60 dark:border-amber-700/50 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98"
              >
                <Download size={16} />
                <span>تحميل جزء عمّ كاملاً (78–114)</span>
              </button>
            </div>

            {/* Single Surah Download */}
            {quranData && quranData.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedSurahId}
                  onChange={(e) => setSelectedSurahId(Number(e.target.value))}
                  className="flex-1 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-[#1c1917] text-xs text-amber-950 dark:text-amber-50 outline-none"
                >
                  {quranData.map((s) => {
                    const isSaved = downloadedSurahs.includes(s.id);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.id}. {getSurahDisplayName(s.name)} {isSaved ? '✓ (محملة)' : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const surahName = quranData.find((s) => s.id === selectedSurahId)?.name || `${selectedSurahId}`;
                    startDownload([selectedSurahId], getSurahDisplayName(surahName));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 transition"
                >
                  <Download size={14} />
                  <span>تحميل السورة</span>
                </button>
              </div>
            )}
          </div>
        )}

        {statusMessage && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 font-medium">
            {statusMessage}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-amber-200/50 dark:border-amber-800/30 text-[11px] text-amber-800/70 dark:text-amber-300/60">
          <span>
            {storageInfo.persisted ? 'التخزين محمي من المسح التلقائي ✓' : 'يحفظ الصوت محلياً في Cache Storage'}
          </span>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleClearCache}
            className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
          >
            <Trash2 size={12} /> مسح التلاوات المحملة
          </button>
        </div>
      </div>
    </div>
  );
};
