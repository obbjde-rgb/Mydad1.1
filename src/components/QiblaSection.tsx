import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Compass, MapPin, AlertCircle, Navigation, Share2 } from 'lucide-react';

export const QiblaSection = () => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState<number>(0);

  const KAABA_COORDS = { lat: 21.4225, lng: 39.8262 };

  useEffect(() => {
    let isMounted = true;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMounted) return;
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          calculateQibla(latitude, longitude);
          window.dispatchEvent(new CustomEvent('log_spiritual_event', {
            detail: {
              content: `حددت اتجاه القبلة من موقعك الحالي`,
              icon: '🧭',
              type: 'qibla'
            }
          }));
        },
        () => {
          if (!isMounted) return;
          setError("يرجى تفعيل صلاحيات الموقع الجغرافي لتحديد القبلة.");
        }
      );
    } else {
      setError("متصفحك لا يدعم تحديد الموقع الجغرافي.");
    }

    // Handle device orientation if available
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const webkitCompassHeading = (e as any).webkitCompassHeading;
      if (typeof webkitCompassHeading === 'number' && !Number.isNaN(webkitCompassHeading)) {
        setHeading(webkitCompassHeading);
      } else if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        setHeading((360 - e.alpha) % 360);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      isMounted = false;
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const calculateQibla = (lat: number, lng: number) => {
    const φ1 = lat * Math.PI / 180;
    const λ1 = lng * Math.PI / 180;
    const φ2 = KAABA_COORDS.lat * Math.PI / 180;
    const λ2 = KAABA_COORDS.lng * Math.PI / 180;

    const y = Math.sin(λ2 - λ1);
    const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(λ2 - λ1);
    let qibla = Math.atan2(y, x) * 180 / Math.PI;
    qibla = (qibla + 360) % 360;
    setQiblaAngle(qibla);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-4 relative">
        <h2 className="text-5xl font-black text-amber-900 dark:text-amber-100">اتجاه القبلة</h2>
        <p className="text-xl text-amber-800 dark:text-amber-400/60">تحديد اتجاه القبلة بناءً على موقعك الحالي</p>
        {navigator.share && coords && qiblaAngle !== null && (
          <button
            onClick={() => {
              navigator.share({
                title: 'اتجاه القبلة',
                text: `موقعي الحالي: ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E\nزاوية القبلة: ${qiblaAngle.toFixed(1)}° من الشمال`
              }).catch(console.error);
            }}
            className="absolute top-0 left-0 p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            title="مشاركة اتجاه القبلة"
          >
            <Share2 size={24} />
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#1c1917] p-12 rounded-[4rem] shadow-2xl border border-amber-100 dark:border-amber-900 flex flex-col items-center space-y-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none">
          <div className="grid grid-cols-4 gap-12 p-12">
            {Array.from({ length: 16 }).map((_, i) => <div key={i} className="text-7xl text-amber-900 font-quran">۞</div>)}
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center text-center space-y-4 text-red-600 dark:text-red-400 p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30">
            <AlertCircle size={48} />
            <p className="text-xl font-bold">{error}</p>
          </div>
        ) : !coords ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xl text-amber-800 dark:text-amber-200">جاري تحديد موقعك...</p>
          </div>
        ) : (
          <>
            <div className="relative w-72 h-72">
              {/* Compass Ring */}
              <div className="absolute inset-0 border-8 border-amber-100 dark:border-amber-900/30 rounded-full shadow-inner"></div>
              
              {/* Compass Needle Container */}
              <motion.div 
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: -heading }}
                transition={{ type: 'spring', stiffness: 50 }}
              >
                <Compass size={240} className="text-amber-200 dark:text-amber-900/20" strokeWidth={0.5} />
                
                {/* Qibla Indicator */}
                {qiblaAngle !== null && (
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ rotate: qiblaAngle }}
                  >
                    <div className="relative h-full w-1 flex justify-center">
                      <div className="absolute top-0 w-8 h-8 bg-amber-600 rounded-full shadow-lg flex items-center justify-center -translate-y-4">
                        <Navigation size={16} className="text-white fill-current -rotate-45" />
                      </div>
                      <div className="w-1 h-1/2 bg-gradient-to-b from-amber-600 to-transparent"></div>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Center Point */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-amber-800 dark:bg-amber-200 rounded-full shadow-lg z-10 border-2 border-white dark:border-black"></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full">
              <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/50 text-center">
                <div className="text-xs text-amber-700 dark:text-amber-400 mb-1 flex items-center justify-center gap-1">
                  <MapPin size={12} /> موقعك الحالي
                </div>
                <div className="font-bold text-amber-900 dark:text-amber-100">
                  {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                </div>
              </div>
              <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/50 text-center">
                <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">زاوية القبلة</div>
                <div className="font-bold text-amber-900 dark:text-amber-100">
                  {qiblaAngle?.toFixed(1)}° من الشمال
                </div>
              </div>
            </div>

            <p className="text-center text-amber-800 dark:text-amber-400/60 text-sm italic">
              * ملاحظة: دقة البوصلة تعتمد على حساسات جهازك. يرجى تحريك الجهاز بشكل (8) لمعايرة البوصلة.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
