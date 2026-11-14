import { useState, useEffect } from 'react';
import { Coordinates, CalculationMethod, PrayerTimes, SunnahTimes } from 'adhan';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Clock, MapPin, ChevronDown, ChevronUp, Globe, Share2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReadAloud } from './ReadAloud';
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/utils';

const PRAYER_COORDS_KEY = 'user_prayer_coords';
const DEFAULT_COORDS = { lat: 33.5731, lng: -7.5898, name: 'الدار البيضاء' };

const PRAYER_NAMES_AR: Record<string, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
  imsak: 'الإمساك',
  midnight: 'منتصف الليل',
  lastthird: 'الثلث الأخير',
};

const MAJOR_CITIES = [
  { name: 'مكة المكرمة', country: 'السعودية', lat: 21.4225, lng: 39.8262 },
  { name: 'المدينة المنورة', country: 'السعودية', lat: 24.4672, lng: 39.6068 },
  { name: 'القاهرة', country: 'مصر', lat: 30.0444, lng: 31.2357 },
  { name: 'الدار البيضاء', country: 'المغرب', lat: 33.5731, lng: -7.5898 },
  { name: 'الجزائر', country: 'الجزائر', lat: 36.7538, lng: 3.0588 },
  { name: 'تونس', country: 'تونس', lat: 36.8065, lng: 10.1815 },
  { name: 'دبي', country: 'الإمارات', lat: 25.2048, lng: 55.2708 },
  { name: 'إسطنبول', country: 'تركيا', lat: 41.0082, lng: 28.9784 },
  { name: 'عمان', country: 'الأردن', lat: 31.9454, lng: 35.9284 },
  { name: 'بيروت', country: 'لبنان', lat: 33.8938, lng: 35.5018 },
  { name: 'بغداد', country: 'العراق', lat: 33.3152, lng: 44.3661 },
  { name: 'الكويت', country: 'الكويت', lat: 29.3759, lng: 47.9774 },
  { name: 'الدوحة', country: 'قطر', lat: 25.2854, lng: 51.5310 },
  { name: 'مسقط', country: 'عمان', lat: 23.5859, lng: 58.4059 },
  { name: 'المنامة', country: 'البحرين', lat: 26.2285, lng: 50.5860 },
  { name: 'القدس', country: 'فلسطين', lat: 31.7683, lng: 35.2137 },
];

export const PrayerTimesCard = () => {
  const [coords, setCoords] = useState<{ lat: number; lng: number; name?: string } | null>(() => {
    try {
      const saved = safeLocalStorageGet(PRAYER_COORDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_COORDS;
  });
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [sunnahTimes, setSunnahTimes] = useState<SunnahTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: Date } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCityMenu, setShowCityMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateAndPersistCoords = (newCoords: { lat: number; lng: number; name?: string }) => {
    setCoords(newCoords);
    safeLocalStorageSet(PRAYER_COORDS_KEY, JSON.stringify(newCoords));
  };

  const detectLocation = (isManual = true) => {
    setError(null);
    if (!navigator.geolocation) {
      if (isManual) {
        setError('المتصفح لا يدعم تحديد الموقع. يمكنك اختيار المدينة من القائمة.');
      }
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateAndPersistCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'موقعي الحالي'
        });
        setShowCityMenu(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        if (isManual) {
          setError('تعذر تحديد الموقع تلقائياً. تم الاحتفاظ بآخر مدينة محفوظة.');
        }
      },
      { timeout: 8000, maximumAge: 600000 }
    );
  };

  useEffect(() => {
    const hasSavedCoords = Boolean(safeLocalStorageGet(PRAYER_COORDS_KEY));
    if (!hasSavedCoords && typeof navigator !== 'undefined' && navigator.onLine) {
      detectLocation(false);
    }
  }, []);

  useEffect(() => {
    if (!coords) return;

    const computePrayers = () => {
      const date = new Date();
      const coordinates = new Coordinates(coords.lat, coords.lng);
      const params = CalculationMethod.MuslimWorldLeague();
      const pt = new PrayerTimes(coordinates, date, params);
      const st = new SunnahTimes(pt);

      setPrayerTimes(pt);
      setSunnahTimes(st);

      const next = pt.nextPrayer();
      if (next !== 'none') {
        setNextPrayer({
          name: next,
          time: pt.timeForPrayer(next)!,
        });
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const ptTomorrow = new PrayerTimes(coordinates, tomorrow, params);
        setNextPrayer({
          name: 'fajr',
          time: ptTomorrow.fajr,
        });
      }
    };

    computePrayers();
    const interval = setInterval(computePrayers, 60000);

    return () => clearInterval(interval);
  }, [coords]);

  if (!prayerTimes || !nextPrayer) return null;

  const prayers = [
    { id: 'fajr', time: prayerTimes.fajr },
    { id: 'sunrise', time: prayerTimes.sunrise },
    { id: 'dhuhr', time: prayerTimes.dhuhr },
    { id: 'asr', time: prayerTimes.asr },
    { id: 'maghrib', time: prayerTimes.maghrib },
    { id: 'isha', time: prayerTimes.isha },
  ];

  return (
    <div className="w-full max-w-md mx-auto mb-8 relative">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#1c1917] rounded-3xl shadow-xl border border-amber-200 dark:border-amber-900 overflow-hidden"
      >
        <div className="flex items-center">
          <div 
            className="flex-1 p-4 flex items-center justify-between cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            onClick={() => {
              const newExpanded = !isExpanded;
              setIsExpanded(newExpanded);
              if (newExpanded) {
                window.dispatchEvent(new CustomEvent('log_spiritual_event', {
                  detail: {
                    content: `اطلعت على مواقيت الصلاة لمدينة ${coords?.name || 'موقعي الحالي'}`,
                    icon: '🕌',
                    type: 'prayer'
                  }
                }));
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-xl text-amber-700 dark:text-amber-300">
                <Clock size={20} />
              </div>
              <div className="text-right">
                <p className="text-xs text-amber-800 dark:text-amber-500 font-bold">
                  الصلاة القادمة: {PRAYER_NAMES_AR[nextPrayer.name]} 
                  <span className="mr-2 text-[10px] opacity-80">({coords?.name})</span>
                </p>
                <div className="text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2" dir="ltr">
                  <span>{format(nextPrayer.time, 'hh:mm')}</span>
                  <span>{format(nextPrayer.time, 'a') === 'AM' ? 'ص' : 'م'}</span>
                  <span className="text-xs font-normal opacity-70 mr-2" dir="rtl">
                    (بعد {formatDistanceToNow(nextPrayer.time, { locale: ar })})
                  </span>
                  <ReadAloud 
                    text={`الصلاة القادمة هي صلاة ${PRAYER_NAMES_AR[nextPrayer.name]} في تمام الساعة ${format(nextPrayer.time, 'hh:mm a')}`} 
                    className="p-1"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText(`الصلاة القادمة هي صلاة ${PRAYER_NAMES_AR[nextPrayer.name]} في تمام الساعة ${format(nextPrayer.time, 'hh:mm a')} بتوقيت ${coords?.name || 'موقعي الحالي'}`).catch(() => {});
                    }}
                    className="p-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full transition-colors"
                    title="نسخ"
                  >
                    <Copy size={16} />
                  </button>
                  {navigator.share && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.share({
                          title: 'مواقيت الصلاة',
                          text: `الصلاة القادمة هي صلاة ${PRAYER_NAMES_AR[nextPrayer.name]} في تمام الساعة ${format(nextPrayer.time, 'hh:mm a')} بتوقيت ${coords?.name || 'موقعي الحالي'}`,
                        }).catch(console.error);
                      }}
                      className="p-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full transition-colors"
                      title="مشاركة"
                    >
                      <Share2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {error && <MapPin size={16} className="text-red-500 animate-pulse" />}
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
          
          <button 
            onClick={() => setShowCityMenu(!showCityMenu)}
            className="p-4 border-r border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            title="اختيار المدينة"
          >
            <Globe size={20} />
          </button>
        </div>

        <AnimatePresence>
          {showCityMenu && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900 overflow-hidden"
            >
              <div className="p-4 max-h-60 overflow-y-auto grid grid-cols-2 gap-2">
                <button 
                  onClick={() => detectLocation(true)}
                  className="col-span-2 p-3 rounded-xl bg-amber-700 text-white font-bold flex items-center justify-center gap-2 mb-2"
                >
                  <MapPin size={16} /> تحديد تلقائي للموقع
                </button>
                {MAJOR_CITIES.map((city) => (
                  <button 
                    key={city.name}
                    onClick={() => {
                      updateAndPersistCoords({ lat: city.lat, lng: city.lng, name: city.name });
                      setShowCityMenu(false);
                    }}
                    className={`p-2 rounded-xl text-sm text-right border transition-all ${coords?.name === city.name ? 'border-amber-600 bg-amber-100 dark:bg-amber-900/40 font-bold' : 'border-amber-200 dark:border-amber-800 hover:bg-amber-100'}`}
                  >
                    <div className="text-amber-900 dark:text-amber-100">{city.name}</div>
                    <div className="text-[10px] opacity-80">{city.country}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-amber-100 dark:border-amber-900"
            >
              <div className="grid grid-cols-3 gap-2 p-4">
                {prayers.map((p) => (
                  <div 
                    key={p.id} 
                    className={`p-3 rounded-2xl text-center transition-all ${nextPrayer.name === p.id ? 'bg-amber-700 text-white shadow-lg scale-105' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'}`}
                  >
                    <p className="text-xs opacity-70 mb-1">{PRAYER_NAMES_AR[p.id]}</p>
                    <p className="font-bold flex items-center justify-center gap-1" dir="ltr">
                      <span>{format(p.time, 'hh:mm')}</span>
                      <span className="text-[10px]">{format(p.time, 'a') === 'AM' ? 'ص' : 'م'}</span>
                    </p>
                  </div>
                ))}
              </div>
              {sunnahTimes && (
                <div className="px-4 pb-4 flex justify-between text-[10px] text-amber-800 dark:text-amber-500 font-bold opacity-80">
                  <span className="flex items-center gap-1">
                    {PRAYER_NAMES_AR.lastthird}: <span dir="ltr">{format(sunnahTimes.lastThirdOfTheNight, 'hh:mm')} {format(sunnahTimes.lastThirdOfTheNight, 'a') === 'AM' ? 'ص' : 'م'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    {PRAYER_NAMES_AR.midnight}: <span dir="ltr">{format(sunnahTimes.middleOfTheNight, 'hh:mm')} {format(sunnahTimes.middleOfTheNight, 'a') === 'AM' ? 'ص' : 'م'}</span>
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
