import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle2, Sparkles, Copy } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'compact',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedLiveLink, setCopiedLiveLink] = useState(false);

  const liveAiStudioUrl = 'https://mydad-live.ai.studio';
  const secondaryUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/mydad-live` 
    : '/mydad-live';

  const handleCopySecondaryUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(secondaryUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }).catch(() => {});
    }
  };

  const handleCopyLiveAiStudioUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(liveAiStudioUrl).then(() => {
        setCopiedLiveLink(true);
        setTimeout(() => setCopiedLiveLink(false), 3000);
      }).catch(() => {});
    }
  };

  // If already installed in standalone mode, don't show the prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (isInstallable) {
      setIsInstalling(true);
      const success = await install();
      setIsInstalling(false);
      if (success) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 4000);
      }
    } else {
      // In case beforeinstallprompt hasn't fired yet or browser requires manual menu install
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {installedSuccess ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>تم تثبيت التطبيق بنجاح</span>
        </div>
      ) : variant === 'banner' ? (
        <div className={`p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-600/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
          <div className="flex items-center gap-3.5 text-right w-full sm:w-auto">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-600/20 shrink-0">
              <Smartphone size={24} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold text-sm">
                <span>تثبيت تطبيق مداد الرحمن</span>
                <Sparkles size={14} className="text-amber-500" />
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-0.5">
                تصفح واستمع للقرآن ومواقيت الصلاة دون الحاجة للمتصفح مع دعم العمل بدون إنترنت.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
          >
            <Download size={16} />
            <span>{isInstalling ? 'جاري التثبيت...' : 'تثبيت التطبيق الآن'}</span>
          </button>
        </div>
      ) : variant === 'full' ? (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center justify-between w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold transition active:scale-98 ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Download size={16} />
            </div>
            <div className="text-right">
              <p className="font-bold">تثبيت التطبيق على جهازك</p>
              <p className="text-[10px] text-amber-700/70 dark:text-amber-300/60">يعمل كبرنامج أصيل وسريع</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold shadow-sm">
            تثبيت
          </span>
        </button>
      ) : (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="تثبيت التطبيق على جهازك (PWA)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold transition active:scale-95 shadow-sm ${className}`}
        >
          <Download size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
      )}

      {/* iOS Safari & Fallback Install Guide Modal */}
      {showIOSGuide && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowIOSGuide(false)}
          dir="rtl"
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-[#fdf8ee] dark:bg-[#1c1917] p-6 shadow-2xl border border-amber-500/30 text-stone-900 dark:text-stone-100 relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 transition"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Smartphone size={26} />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950 dark:text-amber-100">
                  {isIOS ? 'تثبيت على آيفون / آيباد' : 'تثبيت التطبيق على الجهاز'}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  خطوات سريعة لإضافة التطبيق لشاشتك الرئيسية
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      1
                    </span>
                    <div className="space-y-1">
                      <p className="font-semibold text-stone-800 dark:text-stone-200">
                        اضغط على أيقونة المشاركة في شريط سفاري:
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[11px] border border-stone-200 dark:border-stone-700">
                        <Share size={12} className="text-blue-500" />
                        <span>زر المشاركة (Share)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      2
                    </span>
                    <div className="space-y-1">
                      <p className="font-semibold text-stone-800 dark:text-stone-200">
                        مرّر لأسفل واختر:
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[11px] border border-stone-200 dark:border-stone-700">
                        <PlusSquare size={12} className="text-stone-600 dark:text-stone-400" />
                        <span>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      1
                    </span>
                    <p className="font-semibold text-stone-800 dark:text-stone-200">
                      اضغط على قائمة المتصفح (النقاط الثلاث <span className="font-mono">⋮</span> أعلى الشاشة).
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      2
                    </span>
                    <p className="font-semibold text-stone-800 dark:text-stone-200">
                      اختر <strong className="text-amber-700 dark:text-amber-400">"تثبيت التطبيق"</strong> أو <strong className="text-amber-700 dark:text-amber-400">"إضافة إلى الشاشة الرئيسية"</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Web Link: mydad-live.ai.studio */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-right">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  رابط الويب المخصص (AI Studio):
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                  mydad-live
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  dir="ltr"
                  value={liveAiStudioUrl} 
                  className="flex-1 bg-white dark:bg-stone-900 px-2.5 py-1.5 rounded-lg border border-amber-500/30 text-[11px] font-mono text-stone-700 dark:text-stone-300 select-all outline-none font-semibold text-left"
                />
                <button
                  type="button"
                  onClick={handleCopyLiveAiStudioUrl}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition shadow-sm active:scale-95"
                >
                  {copiedLiveLink ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedLiveLink ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            {/* Direct Cloud Route: /mydad-live */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-right">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  رابط السحابة المباشر:
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                  /mydad-live
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  dir="ltr"
                  value={secondaryUrl} 
                  className="flex-1 bg-white dark:bg-stone-900 px-2.5 py-1.5 rounded-lg border border-amber-500/30 text-[11px] font-mono text-stone-700 dark:text-stone-300 select-all outline-none text-left"
                />
                <button
                  type="button"
                  onClick={handleCopySecondaryUrl}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition shadow-sm active:scale-95"
                >
                  {copiedLink ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedLink ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition"
              >
                فهمت ذلك، تم
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
