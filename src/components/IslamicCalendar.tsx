import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface Occasion {
  day: number;
  month: number;
  name: string;
  description?: string;
  type: 'holiday' | 'event' | 'sunnah';
}

const ISLAMIC_OCCASIONS: Occasion[] = [
  { day: 1, month: 1, name: 'رأس السنة الهجرية', type: 'holiday' },
  { day: 10, month: 1, name: 'يوم عاشوراء', type: 'sunnah' },
  { day: 12, month: 3, name: 'المولد النبوي الشريف', type: 'event' },
  { day: 27, month: 7, name: 'الإسراء والمعراج', type: 'event' },
  { day: 15, month: 8, name: 'ليلة النصف من شعبان', type: 'event' },
  { day: 1, month: 9, name: 'أول أيام رمضان المبارك', type: 'holiday' },
  { day: 17, month: 9, name: 'غزوة بدر الكبرى', type: 'event' },
  { day: 27, month: 9, name: 'ليلة القدر (تحري)', type: 'event' },
  { day: 1, month: 10, name: 'عيد الفطر السعيد', type: 'holiday' },
  { day: 8, month: 12, name: 'يوم التروية', type: 'event' },
  { day: 9, month: 12, name: 'يوم عرفة', type: 'holiday' },
  { day: 10, month: 12, name: 'عيد الأضحى المبارك', type: 'holiday' },
  { day: 11, month: 12, name: 'أيام التشريق', type: 'event' },
  { day: 12, month: 12, name: 'أيام التشريق', type: 'event' },
  { day: 13, month: 12, name: 'أيام التشريق', type: 'event' },
];

export const IslamicCalendar = () => {
  const [currentDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());

  const [selectedOccasion, setSelectedOccasion] = useState<{ occasion: Occasion; hijriDay: number; monthName: string } | null>(null);

  const getHijriInfo = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(date);
    
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    
    const monthName = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      month: 'long'
    }).format(date);

    return { day, month, year, monthName };
  };

  const getOccasion = (hijriDay: number, hijriMonth: number) => {
    return ISLAMIC_OCCASIONS.find(o => o.day === hijriDay && o.month === hijriMonth);
  };

  const hijriToday = getHijriInfo(currentDate);
  const todayOccasion = getOccasion(hijriToday.day, hijriToday.month);

  const renderCalendarDays = () => {
    const days = [];
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    
    // Get the day of the week for the first day of the month
    const startDay = startOfMonth.getDay();
    
    // Add empty slots for days before the start of the month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-12 md:h-16" />);
    }

    for (let d = 1; d <= endOfMonth.getDate(); d++) {
      const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const hijri = getHijriInfo(date);
      const occasion = getOccasion(hijri.day, hijri.month);
      const isToday = date.toDateString() === currentDate.toDateString();

      days.push(
        <motion.div
          key={d}
          whileHover={{ scale: 1.05 }}
          onClick={() => occasion && setSelectedOccasion({ occasion, hijriDay: hijri.day, monthName: hijri.monthName })}
          className={`relative h-16 md:h-20 flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer p-1
            ${isToday ? 'bg-amber-100 border-amber-400 dark:bg-amber-900/30 dark:border-amber-700 shadow-inner' : 'bg-white/50 border-amber-100 dark:bg-[#1c1917]/30 dark:border-amber-900/20'}
            ${occasion ? 'ring-2 ring-amber-500 ring-inset bg-amber-50/80 dark:bg-amber-900/20' : ''}
          `}
        >
          <span className="text-[10px] text-gray-400 dark:text-gray-500 absolute top-1 right-1 font-mono">{d}</span>
          <span className="text-lg font-bold text-amber-900 dark:text-amber-100">{hijri.day}</span>
          {occasion && (
            <div className="mt-1 w-full text-center">
              <span className={`text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded-md line-clamp-1 leading-tight
                ${occasion.type === 'holiday' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' : 
                  occasion.type === 'sunnah' ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300' : 
                  'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'}
              `}>
                {occasion.name}
              </span>
            </div>
          )}
        </motion.div>
      );
    }

    return days;
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const viewHijri = getHijriInfo(viewDate);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md rounded-3xl p-6 border border-amber-200 dark:border-amber-900/50 shadow-xl"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-amber-700 dark:text-amber-300">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100">اليومية الإسلامية</h2>
            <p className="text-sm text-amber-700 dark:text-amber-400">{viewHijri.monthName} {viewHijri.year} هـ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full transition-colors">
            <ChevronRight size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {todayOccasion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-4"
        >
          <div className="p-3 bg-amber-500 rounded-xl text-white">
            <Star size={20} className="fill-white" />
          </div>
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">مناسبة اليوم</p>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">{todayOccasion.name}</h3>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-7 gap-2 mb-4">
        {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(day => (
          <div key={day} className="text-center text-xs font-bold text-amber-600 dark:text-amber-500 py-2">
            {day}
          </div>
        ))}
        {renderCalendarDays()}
      </div>

      {selectedOccasion && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-950 dark:text-amber-100">{selectedOccasion.occasion.name}</p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {selectedOccasion.hijriDay} {selectedOccasion.monthName} هـ
              {selectedOccasion.occasion.description ? ` — ${selectedOccasion.occasion.description}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedOccasion(null)}
            className="px-3 py-1 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
          >
            إغلاق
          </button>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
          <Star size={18} className="text-amber-500" />
          أهم المناسبات في {viewHijri.monthName}
        </h3>
        <div className="grid gap-3">
          {ISLAMIC_OCCASIONS.filter(o => o.month === viewHijri.month).map((o, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${o.type === 'holiday' ? 'bg-red-500' : o.type === 'sunnah' ? 'bg-green-500' : 'bg-blue-500'}`} />
                <span className="font-bold text-amber-900 dark:text-amber-100">{o.name}</span>
              </div>
              <span className="text-sm font-mono bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-full text-amber-700 dark:text-amber-300">
                {o.day} {viewHijri.monthName}
              </span>
            </motion.div>
          ))}
          {ISLAMIC_OCCASIONS.filter(o => o.month === viewHijri.month).length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 italic">لا توجد مناسبات رئيسية في هذا الشهر</p>
          )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-amber-100 dark:border-amber-900/30 flex justify-between items-center text-xs text-amber-700 dark:text-amber-500">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>عطلة رسمية</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>سنة نبوية</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>حدث تاريخي</span>
          </div>
        </div>
        <div className="font-medium">المصدر: تقويم أم القرى</div>
      </div>
    </motion.div>
  );
};
