import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Share2, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { ReadAloud } from './ReadAloud';

export const HijriClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(time);

  const gregorianDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(time);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const ampm = hours >= 12 ? 'م' : 'ص';
  const hours12 = hours % 12 || 12;

  const padZero = (num: number) => num.toString().padStart(2, '0');

  const timeString = `${padZero(hours12)}:${padZero(minutes)}:${padZero(seconds)}`;

  const fullDateTimeText = `الوقت الآن هو ${timeString} ${ampm}، والتاريخ الهجري هو ${hijriDate}، والتاريخ الميلادي هو ${gregorianDate}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto mb-6 bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-xl rounded-[2rem] p-6 border border-amber-200/50 dark:border-amber-900/50 shadow-xl"
    >
      <div className="flex flex-col items-center gap-5">
        {/* Time Section */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center gap-4 text-amber-900 dark:text-amber-100 mb-3">
            <Clock size={32} className="animate-pulse text-amber-600 dark:text-amber-500" />
            <div className="flex items-baseline gap-2" dir="ltr">
              <span className="text-5xl font-bold font-mono tracking-wider drop-shadow-sm">{timeString}</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">{ampm}</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 bg-amber-50/50 dark:bg-amber-900/20 py-2 px-6 rounded-full border border-amber-100 dark:border-amber-900/30">
            <ReadAloud text={fullDateTimeText} />
            <div className="w-px h-6 bg-amber-200 dark:bg-amber-800/50 mx-1"></div>
            <button
              onClick={() => navigator.clipboard?.writeText(fullDateTimeText).catch(() => {})}
              className="p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full transition-colors"
              title="نسخ"
            >
              <Copy size={18} />
            </button>
            {navigator.share && (
              <>
                <div className="w-px h-6 bg-amber-200 dark:bg-amber-800/50 mx-1"></div>
                <button
                  onClick={() => {
                    navigator.share({
                      title: 'الوقت والتاريخ',
                      text: fullDateTimeText,
                    }).catch(console.error);
                  }}
                  className="p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full transition-colors"
                  title="مشاركة"
                >
                  <Share2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-200 dark:via-amber-800/50 to-transparent"></div>

        {/* Date Section */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex items-center justify-center gap-3 text-amber-900 dark:text-amber-200 font-bold bg-amber-100/50 dark:bg-amber-900/40 py-3 px-6 rounded-2xl w-full border border-amber-200/50 dark:border-amber-800/30">
            <CalendarIcon size={22} className="text-amber-600 dark:text-amber-500" />
            <span className="text-xl">{hijriDate}</span>
          </div>
          <div className="text-sm text-amber-700/80 dark:text-amber-500/80 font-medium mt-1">
            الموافق: {gregorianDate} م
          </div>
        </div>
      </div>
    </motion.div>
  );
};
