import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Sparkles, ChevronLeft, Heart } from 'lucide-react';

interface WelcomeDuaGateProps {
  onUnlock: () => void;
}

const PRAYERS = [
  [
    "اللَّهُمَّ اغْفِرْ لِأُمِّي مَرْيَم زَرُّوق وَارْحَمْهَا",
    "اللَّهُمَّ اغْفِرْ لِأَبِي مُحَمَّد سَرْدُونِي وَارْحَمْهُ"
  ],
  [
    "اللَّهُمَّ احْفَظْ وَالِدَتِي مَرْيَم زَرُّوق وَبَارِكْ فِيهَا",
    "اللَّهُمَّ احْفَظْ وَالِدِي مُحَمَّد سَرْدُونِي وَبَارِكْ فِيهِ"
  ],
  [
    "رَبِّ ارْحَمْ أُمِّي مَرْيَم زَرُّوق كَمَا رَبَّتْنِي صَغِيرًا",
    "رَبِّ ارْحَمْ أَبِي مُحَمَّد سَرْدُونِي كَمَا رَبَّانِي صَغِيرًا"
  ],
  [
    "اللَّهُمَّ اجْعَلْ أُمِّي مَرْيَم زَرُّوق مِنْ أَهْلِ الْجَنَّةِ",
    "اللَّهُمَّ اجْعَلْ أَبِي مُحَمَّد سَرْدُونِي مِنْ أَهْلِ الْجَنَّةِ"
  ],
  [
    "اللَّهُمَّ ارْزُقْ أُمِّي مَرْيَم زَرُّوق الصِّحَّةَ وَالْعَافِيَةَ",
    "اللَّهُمَّ ارْزُقْ أَبِي مُحَمَّد سَرْدُونِي الصِّحَّةَ وَالْعَافِيَةَ"
  ]
];

export const WelcomeDuaGate: React.FC<WelcomeDuaGateProps> = ({ onUnlock }) => {
  const [mode, setMode] = useState<'selection' | 'prayer'>('selection');
  const [clickedWords, setClickedWords] = useState<Set<string>>(new Set());
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

  const triggerUnlock = useCallback(() => {
    if (hasUnlockedRef.current) return;
    hasUnlockedRef.current = true;
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    onUnlock();
  }, [onUnlock]);

  const [prayer1, prayer2] = useMemo(() => {
    const randomPrayer = PRAYERS[Math.floor(Math.random() * PRAYERS.length)];
    return [randomPrayer[0].split(' '), randomPrayer[1].split(' ')];
  }, []);

  const allWords = useMemo(() => [
    ...prayer1.map((word, i) => ({ id: `p1_${i}`, word })),
    ...prayer2.map((word, i) => ({ id: `p2_${i}`, word }))
  ], [prayer1, prayer2]);

  const handleWordClick = (id: string) => {
    const newClicked = new Set(clickedWords);
    newClicked.add(id);
    setClickedWords(newClicked);

    if (newClicked.size === allWords.length && !hasUnlockedRef.current) {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = setTimeout(() => {
        triggerUnlock();
      }, 650);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0705] text-white p-4 overflow-y-auto select-none"
    >
      {/* Lightweight Static Ambient Background (battery-friendly) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-18%] left-[-10%] w-[520px] h-[520px] bg-emerald-900/20 rounded-full blur-[110px]" />
        <div className="absolute bottom-[-18%] right-[-10%] w-[520px] h-[520px] bg-amber-900/15 rounded-full blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.03] islamic-pattern scale-150" />
      </div>

      <AnimatePresence mode="wait">
        {mode === 'selection' ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="max-w-lg w-full bg-white/[0.03] backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 text-center relative z-10 overflow-hidden my-auto"
          >
            {/* Decorative Arch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-28 opacity-10 pointer-events-none">
              <svg viewBox="0 0 400 200" className="w-full h-full fill-amber-500">
                <path d="M0,200 L0,100 C0,44.77 89.54,0 200,0 C310.46,0 400,44.77 400,100 L400,200 Z" />
              </svg>
            </div>

            <div className="mb-8 relative">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                <BookOpen className="w-9 h-9 text-amber-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 text-amber-50 font-kufi tracking-wide">
                بوابة مداد الرحمن
              </h1>
              <p className="text-amber-200/80 text-base md:text-lg leading-relaxed font-arabic max-w-sm mx-auto">
                عملٌ خالص لوجه الله الكريم وصدقة جارية. ابدأ تلاوتك بدعاء مبارك أو ادخل مباشرة إلى المصحف الشريف.
              </p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode('prayer')}
                className="w-full group relative overflow-hidden flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white py-4 px-6 rounded-2xl font-bold text-lg md:text-xl transition-all duration-300 shadow-[0_10px_35px_rgba(217,119,6,0.3)] hover:shadow-[0_14px_45px_rgba(217,119,6,0.45)] hover:-translate-y-0.5 font-arabic"
              >
                <Sparkles className="w-6 h-6 text-amber-100" />
                <span>الدخول بالدعاء</span>
              </button>

              <button
                type="button"
                onClick={triggerUnlock}
                className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.12] text-amber-100 py-4 px-6 rounded-2xl font-bold text-base md:text-lg transition-all duration-200 border border-white/10 hover:border-amber-400/30 font-arabic"
              >
                <span>التخطي والبدء مباشرة</span>
                <ChevronLeft size={18} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="prayer"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="max-w-4xl w-full bg-white/[0.02] backdrop-blur-3xl p-6 sm:p-10 md:p-14 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border border-white/10 text-center relative z-10 my-auto"
          >
            <div className="mb-8 md:mb-12">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
                <Heart className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-2xl md:text-4xl font-bold text-amber-200 font-kufi mb-3">
                تلاوة الدعاء قبل البدء
              </h2>
              <p className="text-amber-200/60 font-arabic text-base md:text-lg">
                المس الكلمات تباعاً بقلبك ولسانك لفتح المصحف الشريف
              </p>
            </div>

            <div className="space-y-8 md:space-y-12 text-3xl sm:text-4xl md:text-5xl font-quran leading-[2] md:leading-[2.2]" dir="rtl">
              <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-5 sm:gap-y-7">
                {prayer1.map((word, i) => {
                  const id = `p1_${i}`;
                  const isClicked = clickedWords.has(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => handleWordClick(id)}
                      className={`transition-all duration-300 relative ${
                        isClicked
                          ? 'text-amber-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.7)] scale-105 font-bold'
                          : 'text-white/30 hover:text-white/65 cursor-pointer'
                      }`}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-5 sm:gap-y-7">
                {prayer2.map((word, i) => {
                  const id = `p2_${i}`;
                  const isClicked = clickedWords.has(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => handleWordClick(id)}
                      className={`transition-all duration-300 relative ${
                        isClicked
                          ? 'text-amber-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.7)] scale-105 font-bold'
                          : 'text-white/30 hover:text-white/65 cursor-pointer'
                      }`}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-12 md:mt-16 max-w-xl mx-auto">
              <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-500 transition-all duration-300"
                  style={{ width: `${Math.round((clickedWords.size / allWords.length) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-amber-500/60 text-xs font-bold">
                <span>اكتمال الدعاء</span>
                <span>{Math.round((clickedWords.size / allWords.length) * 100)}%</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setMode('selection')}
                className="text-white/40 hover:text-white/75 transition-colors text-sm font-arabic flex items-center gap-1.5"
              >
                <ChevronLeft size={16} className="rotate-180" />
                العودة
              </button>
              <button
                type="button"
                onClick={triggerUnlock}
                className="text-amber-400/75 hover:text-amber-300 transition-colors text-sm font-bold font-arabic flex items-center gap-1.5"
              >
                <span>تخطي وبدء التطبيق</span>
                <ChevronLeft size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
