import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, SkipBack, SkipForward, Download, Share2, Moon, X, Clock } from 'lucide-react';
import { downloadAudio, shareAudio } from '../services/audioCacheService';
import { useSleepTimer } from '../hooks/useSleepTimer';

interface PlaybackControlsProps {
  isPlaying: boolean;
  activeAyah: { surah: number; ayah: number } | null;
  quranData: any[] | null;
  audioProgress: number;
  currentAudioData: Uint8Array | null;
  currentMimeType: string;
  togglePlayPause: () => void;
  stopRecitation: () => void;
  skipForward: () => void;
  skipBackward: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  activeAyah,
  quranData,
  audioProgress,
  currentAudioData,
  currentMimeType,
  togglePlayPause,
  stopRecitation,
  skipForward,
  skipBackward,
}) => {
  const { isActive: isTimerActive, formattedTime, progress: timerProgress, startTimer, cancelTimer } = useSleepTimer();
  const [showTimerMenu, setShowTimerMenu] = useState(false);

  return (
    <AnimatePresence>
      {(isPlaying || activeAyah) && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-[100]"
        >
          <div className="bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-amber-900/30 flex flex-col sm:flex-row items-center gap-6 relative">
            
            {/* Sleep Timer Menu Popup */}
            {showTimerMenu && (
              <div className="absolute -top-44 right-6 bg-white dark:bg-[#292524] p-4 rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-800 z-50 flex flex-col gap-2 min-w-[220px]" dir="rtl">
                <div className="flex justify-between items-center text-xs font-bold text-amber-900 dark:text-amber-200 px-2 pb-2 border-b border-amber-100 dark:border-amber-800">
                  <span className="flex items-center gap-1.5"><Moon size={14} className="text-amber-600" /> مؤقت النوم التلقائي</span>
                  <button onClick={() => setShowTimerMenu(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                <div className="text-[11px] text-amber-800/60 dark:text-amber-200/60 px-2">إيقاف التلاوة وتوفير الطاقة بعد:</div>
                <button onClick={() => { startTimer(15); setShowTimerMenu(false); }} className="text-right px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 transition-colors flex justify-between items-center">
                  <span>15 دقيقة</span>
                  <Clock size={13} className="text-amber-500" />
                </button>
                <button onClick={() => { startTimer(30); setShowTimerMenu(false); }} className="text-right px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 transition-colors flex justify-between items-center">
                  <span>30 دقيقة</span>
                  <Clock size={13} className="text-amber-500" />
                </button>
                <button onClick={() => { startTimer(60); setShowTimerMenu(false); }} className="text-right px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 transition-colors flex justify-between items-center">
                  <span>60 دقيقة</span>
                  <Clock size={13} className="text-amber-500" />
                </button>
                {isTimerActive && (
                  <button onClick={() => { cancelTimer(); setShowTimerMenu(false); }} className="text-right px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">إلغاء المؤقت</button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={skipBackward}
                className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
                title="الآية السابقة"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-16 h-16 flex items-center justify-center bg-amber-700 text-white rounded-full hover:bg-amber-800 transition-all shadow-lg transform hover:scale-105 active:scale-95"
                title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
              >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
              </button>
              <button
                onClick={skipForward}
                className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
                title="الآية التالية"
              >
                <SkipForward size={20} />
              </button>
              <button
                onClick={stopRecitation}
                className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-all shadow-sm"
                title="إيقاف التلاوة"
              >
                <Square size={20} fill="currentColor" />
              </button>
            </div>

            <div className="flex-1 space-y-2 w-full">
              <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 font-bold">
                <span className="text-lg">الآية {activeAyah?.ayah === 0 ? 1 : activeAyah?.ayah}</span>
                <span className="text-xl">{quranData?.find(s => s.id === activeAyah?.surah)?.name}</span>
              </div>
              <div className="relative h-2 bg-amber-100 dark:bg-amber-900/50 rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 h-full bg-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.5)]"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-amber-600">
              {/* Sleep Timer Button with Live Gradual Countdown */}
              <button
                onClick={() => setShowTimerMenu(!showTimerMenu)}
                className={`p-3 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-bold relative overflow-hidden ${
                  isTimerActive 
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md ring-2 ring-amber-400/40' 
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200'
                }`}
                title="مؤقت النوم"
              >
                <Moon size={18} className={isTimerActive ? "animate-pulse text-amber-200" : ""} />
                {isTimerActive && (
                  <span className="font-mono tracking-wider font-bold text-[13px]">{formattedTime}</span>
                )}
                {/* Subtle bottom progress line */}
                {isTimerActive && (
                  <div className="absolute bottom-0 left-0 h-1 bg-amber-300 w-full">
                    <div 
                      className="h-full bg-amber-100 transition-all duration-1000 ease-linear" 
                      style={{ width: `${timerProgress}%` }} 
                    />
                  </div>
                )}
              </button>

              <button
                onClick={() => {
                  if (currentAudioData && activeAyah) {
                    const fileName = `recitation_${activeAyah.surah}_${activeAyah.ayah}.wav`;
                    downloadAudio(currentAudioData, fileName, currentMimeType);
                  }
                }}
                disabled={!currentAudioData}
                className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl hover:bg-amber-200 transition-all disabled:opacity-50 text-amber-800 dark:text-amber-300"
                title="تحميل التلاوة"
              >
                <Download size={18} />
              </button>

              <button
                onClick={() => {
                  if (currentAudioData && activeAyah) {
                    const fileName = `recitation_${activeAyah.surah}_${activeAyah.ayah}.wav`;
                    shareAudio(currentAudioData, fileName, currentMimeType);
                  }
                }}
                disabled={!currentAudioData}
                className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl hover:bg-amber-200 transition-all disabled:opacity-50 text-amber-800 dark:text-amber-300"
                title="مشاركة التلاوة"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
