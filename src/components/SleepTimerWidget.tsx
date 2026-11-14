import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Plus, X, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { useSleepTimer } from '../hooks/useSleepTimer';

export const SleepTimerWidget: React.FC = () => {
  const { isActive, formattedTime, progress, addMinutes, cancelTimer, startTimer } = useSleepTimer();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] max-w-sm w-[92%] sm:w-auto"
        dir="rtl"
      >
        <div className="bg-gradient-to-r from-amber-950/95 via-stone-900/95 to-amber-900/95 text-amber-50 backdrop-blur-xl border border-amber-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.45)] rounded-3xl p-3 sm:px-5 sm:py-3.5 transition-all">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            
            {/* Pulsing Moon Icon */}
            <div className="relative flex items-center justify-center">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-400/30">
                <Moon size={18} className="animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>

            {/* Label and Live Countdown */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-200/80 font-medium">
                <Clock size={12} className="text-amber-400" />
                <span>مؤقت النوم نشط</span>
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono tracking-wider text-amber-300 drop-shadow-sm flex items-center gap-1">
                <span>{formattedTime}</span>
                <span className="text-[10px] font-sans font-normal text-amber-200/60 mr-1">متبقية</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 mr-auto">
              {/* +5 mins */}
              <button
                onClick={() => addMinutes(5)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white border border-amber-500/20 text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                title="إضافة 5 دقائق"
              >
                <Plus size={12} />
                <span>5د</span>
              </button>

              {/* Toggle Expand Options */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-xl bg-stone-800/60 hover:bg-stone-700/60 text-amber-200/70 hover:text-amber-100 transition-colors"
                title="تعديل الوقت"
              >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* Cancel */}
              <button
                onClick={cancelTimer}
                className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100 border border-rose-500/20 transition-all active:scale-95"
                title="إلغاء المؤقت"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Gradual Depletion Progress Bar (التنازل التدريجي المرئي) */}
          <div className="mt-2.5 w-full bg-stone-800/80 rounded-full h-1.5 overflow-hidden border border-amber-500/10 relative">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.6)]"
              style={{ width: `${Math.max(1, progress)}%` }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </div>

          {/* Expanded duration selector */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 mt-3 border-t border-amber-500/20 flex items-center justify-between gap-2"
              >
                <span className="text-xs text-amber-200/70 font-medium">تغيير المدة:</span>
                <div className="flex gap-1.5">
                  {[15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        startTimer(mins);
                        setIsExpanded(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition-all border border-amber-500/20 active:scale-95"
                    >
                      {mins} دقيقة
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
