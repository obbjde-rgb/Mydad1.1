import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Volume2, Square, Heart, Search, Copy, Share2, Sparkles, Loader2 } from 'lucide-react';
import { ReadAloud } from './ReadAloud';
import { generateDua } from '../services/aiService';

interface Dua {
  id: number | string;
  title: string;
  arabic: string;
  translation: string;
  source: string;
  category: string;
}

const DUAS: Dua[] = [
  {
    id: 1,
    category: 'أذكار الصباح',
    title: 'سيد الاستغفار',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.',
    translation: 'O Allah, You are my Lord, none has the right to be worshipped except You, You created me and I am Your servant and I abide to Your covenant and promise as best I can, I take refuge in You from the evil which I have committed. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for verily none can forgive sin except You.',
    source: 'صحيح البخاري'
  },
  {
    id: 2,
    category: 'أذكار المساء',
    title: 'دعاء الكرب',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَواتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ.',
    translation: 'There is no deity but Allah, the Great, the Forbearing. There is no deity but Allah, Lord of the Magnificent Throne. There is no deity but Allah, Lord of the heavens and Lord of the earth and Lord of the Noble Throne.',
    source: 'صحيح البخاري ومسلم'
  },
  {
    id: 3,
    category: 'الاستغفار والتوبة',
    title: 'دعاء يونس عليه السلام',
    arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ.',
    translation: 'None has the right to be worshipped but You (O Allah), Glorified (and Exalted) are You (above all that they associate with You). Truly, I have been of the wrong-doers.',
    source: 'جامع الترمذي'
  },
  {
    id: 4,
    category: 'الحماية والتحصين',
    title: 'الاستعاذة من الهم والحزن',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ، وَغَلَبَةِ الرِّجَالِ.',
    translation: 'O Allah, I take refuge in You from anxiety and sorrow, weakness and laziness, miserliness and cowardice, the burden of debts and from being overpowered by men.',
    source: 'صحيح البخاري'
  },
  {
    id: 5,
    category: 'أذكار الصباح',
    title: 'بسم الله الذي لا يضر مع اسمه شيء',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاء وَهُوَ السَّمِيعُ الْعَلِيمُ.',
    translation: 'In the Name of Allah, Who with His Name nothing can cause harm in the earth nor in the heavens, and He is the All-Hearing, the All-Knowing.',
    source: 'سنن أبي داود والترمذي'
  },
  {
    id: 6,
    category: 'أذكار النوم',
    title: 'باسمك ربي وضعت جنبي',
    arabic: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.',
    translation: 'In Your name my Lord, I lie down and in Your name I rise, so if You should take my soul then have mercy upon it, and if You should return my soul then protect it in the manner You do for Your righteous servants.',
    source: 'صحيح البخاري ومسلم'
  },
  {
    id: 7,
    category: 'أذكار النوم',
    title: 'اللهم قني عذابك',
    arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ.',
    translation: 'O Allah, protect me from Your punishment on the day You resurrect Your servants.',
    source: 'سنن أبي داود والترمذي'
  },
  {
    id: 8,
    category: 'أذكار المساء',
    title: 'أمسينا وأمسى الملك لله',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.',
    translation: 'We have reached the evening and at this very time unto Allah belongs all sovereignty, and all praise is for Allah. None has the right to be worshipped except Allah, alone, without partner, to Him belongs all sovereignty and praise and He is over all things omnipotent.',
    source: 'صحيح مسلم'
  },
  {
    id: 9,
    category: 'أذكار الصباح',
    title: 'اللهم بك أصبحنا',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.',
    translation: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the Final Return.',
    source: 'سنن الترمذي'
  },
  {
    id: 10,
    category: 'أذكار المساء',
    title: 'اللهم بك أمسينا',
    arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ.',
    translation: 'O Allah, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the final return.',
    source: 'سنن الترمذي'
  },
  {
    id: 11,
    category: 'أذكار النوم',
    title: 'آية الكرسي',
    arabic: 'اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۚ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ.',
    translation: 'Allah - there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
    source: 'سورة البقرة - آية 255'
  },
  {
    id: 12,
    category: 'تيسير الأمور',
    title: 'دعاء تيسير الأمور',
    arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزَنَ إِذَا شِئْتَ سَهْلًا.',
    translation: 'O Allah, there is no ease except in that which You have made easy, and You make the difficulty, if You wish, easy.',
    source: 'صحيح ابن حبان'
  },
  {
    id: 13,
    category: 'طلب العلم',
    title: 'دعاء طلب العلم',
    arabic: 'رَبِّ زِدْنِي عِلْمًا.',
    translation: 'My Lord, increase me in knowledge.',
    source: 'سورة طه - آية 114'
  },
  {
    id: 14,
    category: 'الوالدين',
    title: 'دعاء الوالدين',
    arabic: 'رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا.',
    translation: 'My Lord, forgive me and my parents and have mercy on them as they brought me up when I was small.',
    source: 'سورة الإسراء - آية 24'
  },
  {
    id: 15,
    category: 'طلب الرزق',
    title: 'دعاء الرزق',
    arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ.',
    translation: 'O Allah, suffice me with what You have allowed instead of what You have forbidden, and make me independent of all others besides You.',
    source: 'جامع الترمذي'
  },
  {
    id: 16,
    category: 'الثبات على الدين',
    title: 'دعاء الثبات',
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ.',
    translation: 'O Turner of the hearts, keep my heart firm upon Your religion.',
    source: 'جامع الترمذي'
  }
];

export const DuaSection = ({ speakText, stopSpeaking, isSpeaking }: { speakText: (t: string) => void, stopSpeaking: () => void, isSpeaking: boolean }) => {
  const [search, setSearch] = useState('');
  const [activeDua, setActiveDua] = useState<number | string | null>(null);
  const [duaOfTheDay, setDuaOfTheDay] = useState<Dua | null>(null);
  const [isGeneratingDua, setIsGeneratingDua] = useState(false);

  const fetchDuaOfTheDay = async (isMountedRef?: { current: boolean }) => {
    setIsGeneratingDua(true);
    try {
      const generated = await generateDua('gemini');
      if (isMountedRef && !isMountedRef.current) return;
      setDuaOfTheDay({
        id: Date.now() + Math.floor(Math.random() * 100000),
        ...generated,
        category: 'دعاء اليوم'
      });
    } catch (e) {
      if (!isMountedRef || isMountedRef.current) {
        console.error("Failed to generate dua:", e);
      }
    } finally {
      if (!isMountedRef || isMountedRef.current) {
        setIsGeneratingDua(false);
      }
    }
  };

  useEffect(() => {
    const isMountedRef = { current: true };
    void fetchDuaOfTheDay(isMountedRef);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getCurrentTimeCategory = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'أذكار الصباح';
    if (hour >= 12 && hour < 17) return 'الاستغفار والتوبة';
    if (hour >= 17 && hour < 22) return 'أذكار المساء';
    return 'أذكار النوم';
  };

  const timeCategory = getCurrentTimeCategory();

  const allDuas = duaOfTheDay ? [duaOfTheDay, ...DUAS] : DUAS;

  const filteredDuas = allDuas.filter(d => 
    (d.title && typeof d.title === 'string' && d.title.includes(search)) || 
    (d.arabic && typeof d.arabic === 'string' && d.arabic.includes(search)) || 
    (d.category && typeof d.category === 'string' && d.category.includes(search))
  ).sort((a, b) => {
    if (a.category === 'دعاء اليوم') return -1;
    if (b.category === 'دعاء اليوم') return 1;
    if (a.category === timeCategory && b.category !== timeCategory) return -1;
    if (a.category !== timeCategory && b.category === timeCategory) return 1;
    return 0;
  });

  const handleRandomDua = () => {
    const randomDua = allDuas[Math.floor(Math.random() * allDuas.length)];
    setSearch(randomDua.title);
  };

  return (
    <div className="space-y-12">
      <div className="text-center space-y-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-400/10 dark:bg-amber-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <h2 className="text-6xl font-black text-amber-950 dark:text-amber-50 drop-shadow-sm relative z-10">الأدعية المأثورة</h2>
        <p className="text-2xl text-amber-800/80 dark:text-amber-400/60 font-medium relative z-10">من صحيح السنة النبوية والمصادر الموثوقة</p>
        <div className="flex flex-wrap justify-center gap-4 relative z-10">
          <button 
            onClick={() => void fetchDuaOfTheDay()}
            disabled={isGeneratingDua}
            className="inline-flex items-center gap-3 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl border border-emerald-500 shadow-lg shadow-emerald-900/20 transition-all active:scale-95 font-bold text-lg disabled:opacity-50"
          >
            {isGeneratingDua ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            دعاء اليوم
          </button>
          <button 
            onClick={handleRandomDua}
            className="inline-flex items-center gap-3 px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl border border-amber-500 shadow-lg shadow-amber-900/20 transition-all active:scale-95 font-bold text-lg"
          >
            <Sparkles size={20} />
            دعاء عشوائي
          </button>
        </div>
      </div>

      <div className="relative max-w-2xl mx-auto">
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-amber-600/60 dark:text-amber-400/60 pointer-events-none">
          <Search size={24} />
        </div>
        <input 
          type="text" 
          placeholder="ابحث عن دعاء بالاسم أو المحتوى..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-16 pl-6 py-5 bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-amber-200/60 dark:border-white/10 text-2xl text-amber-950 dark:text-amber-50 font-bold text-right focus:ring-4 focus:ring-amber-500/20 focus:border-amber-400 dark:focus:border-amber-600 outline-none transition-all duration-500 placeholder:text-amber-900/30 dark:placeholder:text-amber-100/30"
          dir="rtl"
          lang="ar"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredDuas.map((dua, index) => (
          <motion.div
            key={dua.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.5 }}
            className="bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-xl p-10 rounded-[3rem] shadow-xl hover:shadow-2xl border border-amber-200/60 dark:border-white/10 relative overflow-hidden group transition-all duration-500"
          >
            <div className="absolute -left-12 -bottom-12 text-[12rem] text-amber-900/5 dark:text-amber-100/5 rotate-12 pointer-events-none font-quran group-hover:rotate-0 transition-transform duration-700">🤲</div>
            
            <div className="absolute top-0 right-0 p-6 flex gap-3 z-20">
              {dua.category === timeCategory && (
                <span className="px-4 py-1.5 bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-black animate-pulse border border-emerald-200/50 dark:border-emerald-700/30 shadow-sm">
                  مقترح
                </span>
              )}
              <span className="px-5 py-1.5 bg-amber-100/80 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 rounded-full text-sm font-bold border border-amber-200/50 dark:border-amber-700/30 shadow-sm">
                {dua.category}
              </span>
            </div>

            <div className="mt-8 space-y-8 relative z-10">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-3xl font-bold text-amber-950 dark:text-amber-50 leading-tight">{dua.title}</h3>
                <div className="flex gap-2 shrink-0">
                  <ReadAloud 
                    text={dua.arabic} 
                    buttonClassName="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all hover:scale-110 shadow-sm"
                  />
                  <button 
                    onClick={() => navigator.clipboard?.writeText(dua.arabic).catch(() => {})}
                    className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all hover:scale-110 shadow-sm"
                    title="نسخ الدعاء"
                  >
                    <Copy size={20} />
                  </button>
                  {navigator.share && (
                    <button 
                      onClick={() => navigator.share({
                        title: dua.title,
                        text: `${dua.arabic}\n\n${dua.translation}`,
                      }).catch(console.error)}
                      className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all hover:scale-110 shadow-sm"
                      title="مشاركة الدعاء"
                    >
                      <Share2 size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (isSpeaking && activeDua === dua.id) {
                        stopSpeaking();
                        setActiveDua(null);
                      } else {
                        speakText(dua.arabic);
                        setActiveDua(dua.id);
                        window.dispatchEvent(new CustomEvent('log_spiritual_event', {
                          detail: {
                            content: `قرأت دعاء: ${dua.title}`,
                            icon: '🤲',
                            type: 'dua'
                          }
                        }));
                      }
                    }}
                    className={`p-3 rounded-2xl transition-all hover:scale-110 shadow-sm ${isSpeaking && activeDua === dua.id ? 'bg-amber-700 text-white animate-pulse' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800'}`}
                  >
                    {isSpeaking && activeDua === dua.id ? <Square size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>
              </div>

              <p className="text-4xl font-quran leading-[2.2] text-right text-amber-950 dark:text-amber-50 drop-shadow-sm" dir="rtl">
                {dua.arabic}
              </p>

              <div className="pt-8 border-t border-amber-100/60 dark:border-white/5">
                <div className="flex items-start gap-6">
                  <p className="text-xl text-amber-900/70 dark:text-amber-200/60 italic leading-relaxed flex-1 text-left" dir="ltr">
                    {dua.translation}
                  </p>
                  <div className="flex flex-col gap-3 shrink-0">
                    <button 
                      onClick={() => navigator.clipboard?.writeText(dua.translation).catch(() => {})}
                      className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all shadow-sm"
                      title="نسخ الترجمة"
                    >
                      <Copy size={18} />
                    </button>
                    <ReadAloud text={dua.translation} lang="en-US" buttonClassName="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all shadow-sm" />
                  </div>
                </div>
                <div className="mt-8 flex items-center gap-3 text-base text-amber-800/60 dark:text-amber-400/40 font-medium">
                  <div className="p-1.5 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg">
                    <Heart size={16} className="fill-current" />
                  </div>
                  <span>المصدر: {dua.source}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
