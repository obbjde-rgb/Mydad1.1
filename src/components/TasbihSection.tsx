import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Settings2, Moon, Sun, Sparkles, Share2, Copy } from 'lucide-react';
import { ReadAloud } from './ReadAloud';

const NAMES_OF_ALLAH = [
  "الرحمن", "الرحيم", "الملك", "القدوس", "السلام", "المؤمن", "المهيمن", "العزيز", "الجبار", "المتكبر",
  "الخالق", "البارئ", "المصور", "الغفار", "القهار", "الوهاب", "الرزاق", "الفتاح", "العليم", "القابض",
  "الباسط", "الخافض", "الرافع", "المعز", "المذل", "السميع", "البصير", "الحكم", "العدل", "اللطيف",
  "الخبير", "الحليم", "العظيم", "الغفور", "الشكور", "العلي", "الكبير", "الحفيظ", "المقيت", "الحسيب",
  "الجليل", "الكريم", "الرقيب", "المجيب", "الواسع", "الحكيم", "الودود", "المجيد", "الباعث", "الشهيد",
  "الحق", "الوكيل", "القوي", "المتين", "الولي", "الحميد", "المحصي", "المبدئ", "المعيد", "المحيي",
  "المميت", "الحي", "القيوم", "الواجد", "الماجد", "الواحد", "الأحد", "الصمد", "القادر", "المقتدر",
  "المقدم", "المؤخر", "الأول", "الآخر", "الظاهر", "الباطن", "الوالي", "المتعالي", "البر", "التواب",
  "المنتقم", "العفو", "الرؤوف", "مالك الملك", "ذو الجلال والإكرام", "المقسط", "الجامع", "الغني", "المغني", "المانع",
  "الضار", "النافع", "النور", "الهادي", "البديع", "الباقي", "الوارث", "الرشيد", "الصبور"
];

const TASBIH_PHRASES = [
  "سبحان الله", "سبحان الله وبحمده", "سبحان الله العظيم", "سبحان الله وبحمده عدد خلقه",
  "سبحان الله وبحمده رضا نفسه", "سبحان الله وبحمده زنة عرشه", "سبحان الله وبحمده مداد كلماته",
  "سبحان الله الملك القدوس", "سبحان الله ذي الملكوت", "سبحان الله ذي العزة والجبروت",
  "سبحان الله ذي الكبرياء والعظمة", "سبحان الله والحمد لله", "سبحان الله بكرة وأصيلاً",
  "سبحان الله العلي العظيم", "سبحان الله رب العالمين", "سبحان الله رب العرش العظيم",
  "سبحان الله عدد ما خلق", "سبحان الله ملء ما خلق", "سبحان الله عدد ما في الأرض والسماء",
  "سبحان الله ملء ما في الأرض والسماء", "سبحان الله عدد ما أحصى كتابه", "سبحان الله ملء ما أحصى كتابه",
  "سبحان الله عدد كل شيء", "سبحان الله ملء كل شيء", "سبحان الملك القدوس", "سبحان ذي الجبروت والملكوت",
  "سبحان ذي العزة والقدرة", "سبحان الله وبحمده في كل وقت", "سبحان الله وبحمده في كل حين",
  "سبحان الله وبحمده أبد الأبدين", "سبحان الله وبحمده دائم الأيام", "سبحان الله وبحمده عدد الرمل والحصى",
  "سبحان الله وبحمده عدد قطر المطر", "سبحان الله وبحمده عدد ورق الشجر", "سبحان الله وبحمده عدد ما أظلم عليه الليل",
  "سبحان الله وبحمده عدد ما أشرق عليه النهار", "سبحان الله وبحمده عدد أنفاس الخلائق", "سبحان الله وبحمده عدد ما سبح به المسبحون",
  "سبحان الله وبحمده عدد ما غفل عن ذكره الغافلون", "سبحان الله وبحمده عدد كلمات ربي", "سبحان الله وبحمده ملء ميزان ربي",
  "سبحان الله وبحمده منتهى علم ربي", "سبحان الله وبحمده مبلغ ثناء ربي", "سبحان الله وبحمده عدد خلقه ورضا نفسه",
  "سبحان الله وبحمده زنة عرشه ومداد كلماته", "سبحان الله وبحمده في السموات والأرض", "سبحان الله وبحمده في البر والبحر",
  "سبحان الله وبحمده في الدنيا والآخرة", "سبحان الله وبحمده في كل لمحة ونفس", "سبحان الله وبحمده عدد ما وسعه علم الله",
  "سبحان الله وبحمده ملء ما وسعه علم الله", "سبحان الله وبحمده عدد ما جرى به القلم", "سبحان الله وبحمده ملء ما جرى به القلم",
  "سبحان الله وبحمده عدد ما كان وما يكون", "سبحان الله وبحمده عدد الحركات والسكون", "سبحان الله وبحمده عدد الذرات والمجرات",
  "سبحان الله وبحمده عدد النجوم والكواكب", "سبحان الله وبحمده عدد البحار والأنهار", "سبحان الله وبحمده عدد الجبال والتلال",
  "سبحان الله وبحمده عدد الطيور والحيوانات", "سبحان الله وبحمده عدد النباتات والأزهار", "سبحان الله وبحمده عدد البشر والملائكة",
  "سبحان الله وبحمده عدد الجن والشياطين", "سبحان الله وبحمده عدد ما في الجنة والنار", "سبحان الله وبحمده عدد ما في اللوح المحفوظ",
  "سبحان الله وبحمده عدد ما في العرش والكرسي", "سبحان الله وبحمده عدد ما في السموات السبع", "سبحان الله وبحمده عدد ما في الأرضين السبع",
  "سبحان الله وبحمده عدد ما في المشرق والمغرب", "سبحان الله وبحمده عدد ما في الشمال والجنوب", "سبحان الله وبحمده عدد ما في الماضي والحاضر",
  "سبحان الله وبحمده عدد ما في المستقبل والأزل", "سبحان الله وبحمده عدد ما في الأبد والخلود", "سبحان الله وبحمده عدد ما في الغيب والشهادة",
  "سبحان الله وبحمده عدد ما في السر والعلن", "سبحان الله وبحمده عدد ما في القلوب والصدور", "سبحان الله وبحمده عدد ما في العقول والأفكار",
  "سبحان الله وبحمده عدد ما في الأرواح والنفوس", "سبحان الله وبحمده عدد ما في الوجود والعدم", "سبحان الله وبحمده عدد ما في الحق والباطل",
  "سبحان الله وبحمده عدد ما في النور والظلمة", "سبحان الله وبحمده عدد ما في الخير والشر", "سبحان الله وبحمده عدد ما في الرحمة والعذاب",
  "سبحان الله وبحمده عدد ما في النعيم والجحيم", "سبحان الله وبحمده عدد ما في الدنيا الفانية", "سبحان الله وبحمده عدد ما في الآخرة الباقية",
  "سبحان الله وبحمده عدد ما في ملك الله الواسع", "سبحان الله وبحمده عدد ما في قدرة الله العظيمة", "سبحان الله وبحمده عدد ما في مشيئة الله النافذة",
  "سبحان الله وبحمده عدد ما في حكمة الله البالغة", "سبحان الله وبحمده عدد ما في عدل الله المطلق", "سبحان الله وبحمده عدد ما في فضل الله العميم",
  "سبحان الله وبحمده عدد ما في جود الله الوافر", "سبحان الله وبحمده عدد ما في كرم الله الواسع", "سبحان الله وبحمده عدد ما في حلم الله العظيم",
  "سبحان الله وبحمده عدد ما في عفو الله الشامل", "سبحان الله وبحمده عدد ما في ستر الله الجميل", "سبحان الله وبحمده عدد ما في لطف الله الخفي"
];

const ISTIGHFAR_PHRASES = [
  "أستغفر الله", "أستغفر الله العظيم", "أستغفر الله وأتوب إليه", "أستغفر الله الذي لا إله إلا هو الحي القيوم وأتوب إليه",
  "اللهم اغفر لي", "اللهم إني ظلمت نفسي فاغفر لي", "رب اغفر لي وتب علي", "اللهم اغفر لي ولوالدي",
  "اللهم اغفر للمؤمنين والمؤمنات", "اللهم اغفر للمسلمين والمسلمات", "اللهم اغفر لي خطيئتي وجهلي", "اللهم اغفر لي ما قدمت وما أخرت",
  "اللهم اغفر لي ما أسررت وما أعلنت", "اللهم اغفر لي ما أنت أعلم به مني", "اللهم اغفر لي ذنبي كله", "اللهم اغفر لي دقه وجله",
  "اللهم اغفر لي أوله وآخره", "اللهم اغفر لي علانيته وسره", "اللهم اغفر لي ذنبي واشرح لي صدري", "اللهم اغفر لي ذنبي ويسر لي أمري",
  "اللهم اغفر لي ذنبي وطهر قلبي", "اللهم اغفر لي ذنبي وحصن فرجي", "اللهم اغفر لي ذنبي ونور قبري", "اللهم اغفر لي ذنبي وثقل ميزاني",
  "اللهم اغفر لي ذنبي وبيض وجهي", "اللهم اغفر لي ذنبي وارفع درجتي", "اللهم اغفر لي ذنبي وتقبل توبتي", "اللهم اغفر لي ذنبي وأجب دعوتي",
  "اللهم اغفر لي ذنبي واقض حاجتي", "اللهم اغفر لي ذنبي وفرج همي", "اللهم اغفر لي ذنبي واكشف غمي", "اللهم اغفر لي ذنبي ونفس كربي",
  "اللهم اغفر لي ذنبي وأصلح بالي", "اللهم اغفر لي ذنبي واهد قلبي", "اللهم اغفر لي ذنبي وسدد لساني", "اللهم اغفر لي ذنبي وبارك لي في رزقي",
  "اللهم اغفر لي ذنبي وبارك لي في عمري", "اللهم اغفر لي ذنبي وبارك لي في أهلي", "اللهم اغفر لي ذنبي وبارك لي في ولدي", "اللهم اغفر لي ذنبي وبارك لي في عملي",
  "اللهم اغفر لي ذنبي وبارك لي في علمي", "اللهم اغفر لي ذنبي وبارك لي في ديني", "اللهم اغفر لي ذنبي وبارك لي في دنياي", "اللهم اغفر لي ذنبي وبارك لي في آخرتي",
  "اللهم اغفر لي ذنبي وبارك لي في كل شأني", "أستغفر الله عدد خلقه", "أستغفر الله رضا نفسه", "أستغفر الله زنة عرشه",
  "أستغفر الله مداد كلماته", "أستغفر الله عدد ما خلق", "أستغفر الله ملء ما خلق", "أستغفر الله عدد ما في الأرض والسماء",
  "أستغفر الله ملء ما في الأرض والسماء", "أستغفر الله عدد ما أحصى كتابه", "أستغفر الله ملء ما أحصى كتابه", "أستغفر الله عدد كل شيء",
  "أستغفر الله ملء كل شيء", "أستغفر الله من كل ذنب", "أستغفر الله من كل خطيئة", "أستغفر الله من كل معصية",
  "أستغفر الله من كل زلة", "أستغفر الله من كل غفلة", "أستغفر الله من كل سيئة", "أستغفر الله من كل ما يغضب الله",
  "أستغفر الله من كل ما لا يرضي الله", "أستغفر الله من كل ما يبعد عن الله", "أستغفر الله من كل ما يحجب عن الله", "أستغفر الله من كل ما يظلم القلب",
  "أستغفر الله من كل ما يقسي القلب", "أستغفر الله من كل ما يمرض القلب", "أستغفر الله من كل ما يميت القلب", "أستغفر الله من كل ما يفسد العمل",
  "أستغفر الله من كل ما ينقص الأجر", "أستغفر الله من كل ما يذهب البركة", "أستغفر الله من كل ما يجلب النقمة", "أستغفر الله من كل ما يمنع الرحمة",
  "أستغفر الله من كل ما يقطع الصلة بالله", "أستغفر الله من كل ما يوجب سخط الله", "أستغفر الله من كل ما يستحق عقاب الله", "أستغفر الله من كل ما يخالف أمر الله",
  "أستغفر الله من كل ما يضاد شرع الله", "أستغفر الله من كل ما ينافي توحيد الله", "أستغفر الله من كل ما يخدش إيمان الله", "أستغفر الله من كل ما يضعف يقين الله",
  "أستغفر الله من كل ما يشوش فكر الله", "أستغفر الله من كل ما يشتت شمل الله", "أستغفر الله من كل ما يفرق جمع الله", "أستغفر الله من كل ما يوهن عزم الله",
  "أستغفر الله من كل ما يثبط همة الله", "أستغفر الله من كل ما يقلل خشية الله", "أستغفر الله من كل ما يذهب حياء الله", "أستغفر الله من كل ما يفسد خلق الله",
  "أستغفر الله من كل ما يضر عباد الله", "أستغفر الله من كل ما يسيء لخلق الله", "أستغفر الله من كل ما يظلم أنفسنا", "أستغفر الله من كل ما يظلم غيرنا",
  "أستغفر الله من كل ما ندمنا عليه", "أستغفر الله من كل ما سنندم عليه", "أستغفر الله دائماً وأبداً", "أستغفر الله في كل حين"
];

const TAZEEM_PHRASES = [
  "الله أكبر", "لا إله إلا الله", "لا حول ولا قوة إلا بالله", "الحمد لله حمداً كثيراً",
  "الله أكبر كبيراً", "والحمد لله كثيراً", "وسبحان الله بكرة وأصيلاً", "لا إله إلا الله وحده لا شريك له",
  "له الملك وله الحمد", "وهو على كل شيء قدير", "لا إله إلا الله الملك الحق المبين", "لا إله إلا الله العظيم الحليم",
  "لا إله إلا الله رب العرش العظيم", "لا إله إلا الله رب السموات ورب الأرض", "ورب العرش الكريم", "يا حي يا قيوم",
  "يا ذا الجلال والإكرام", "يا بديع السموات والأرض", "يا نور السموات والأرض", "يا قيوم السموات والأرض",
  "يا مالك الملك", "يا من له الأسماء الحسنى", "يا من له الصفات العلى", "يا من له الكبرياء في السموات والأرض",
  "يا من هو العلي العظيم", "يا من هو الغفور الرحيم", "يا من هو التواب الكريم", "يا من هو اللطيف الخبير",
  "يا من هو السميع البصير", "يا من هو الواحد الأحد", "يا من هو الصمد الذي لم يلد ولم يولد", "ولم يكن له كفواً أحد",
  "تعالى الله عما يشركون", "تعالى الله الملك الحق", "سبحان الله عما يصفون", "الحمد لله رب العالمين",
  "الحمد لله الذي هدانا لهذا", "الحمد لله الذي بنعمته تتم الصالحات", "الحمد لله على كل حال", "الحمد لله في السراء والضراء",
  "الحمد لله عدد خلقه", "الحمد لله رضا نفسه", "الحمد لله زنة عرشه", "الحمد لله مداد كلماته",
  "الله أكبر عدد ما خلق", "الله أكبر ملء ما خلق", "الله أكبر عدد ما في الأرض والسماء", "الله أكبر ملء ما في الأرض والسماء",
  "لا إله إلا الله عدد ما أحصى كتابه", "لا إله إلا الله ملء ما أحصى كتابه", "لا حول ولا قوة إلا بالله عدد كل شيء", "لا حول ولا قوة إلا بالله ملء كل شيء",
  "عظم الله شأنه", "جل جلاله", "تقدست أسماؤه", "تبارك اسمه",
  "وتعالى جده", "ولا إله غيره", "عز وجل", "سبحانه وتعالى",
  "ما شاء الله لا قوة إلا بالله", "حسبي الله ونعم الوكيل", "نعم المولى ونعم النصير", "توكلت على الله",
  "اعتصمت بالله", "استعنت بالله", "فوضت أمري إلى الله", "إن الله بصير بالعباد",
  "يا رب لك الحمد كما ينبغي لجلال وجهك", "ولعظيم سلطانك", "رضيت بالله رباً", "وبالإسلام ديناً",
  "وبمحمد صلى الله عليه وسلم نبياً ورسولاً", "اللهم أنت ربي لا إله إلا أنت", "خلقتني وأنا عبدك", "وأنا على عهدك ووعدك ما استطعت",
  "أعوذ بك من شر ما صنعت", "أبوء لك بنعمتك علي", "وأبوء بذنبي فاغفر لي", "فإنه لا يغفر الذنوب إلا أنت",
  "اللهم صل وسلم على نبينا محمد", "اللهم بارك على نبينا محمد", "اللهم عظم قدر نبينا محمد", "اللهم ارفع ذكر نبينا محمد",
  "يا الله يا رحمن", "يا رحيم يا ملك", "يا قدوس يا سلام", "يا مؤمن يا مهيمن",
  "يا عزيز يا جبار", "يا متكبر يا خالق", "يا بارئ يا مصور", "يا غفار يا قهار",
  "يا وهاب يا رزاق", "يا فتاح يا عليم", "يا قابض يا باسط", "يا خافض يا رافع",
  "يا معز يا مذل", "يا سميع يا بصير", "يا حكم يا عدل", "يا لطيف يا خبير",
  "يا حليم يا عظيم", "يا غفور يا شكور", "يا علي يا كبير", "يا حفيظ يا مقيت"
];

type TasbihMode = 'names' | 'tasbih' | 'istighfar' | 'tazeem';

export const TasbihSection: React.FC = () => {
  const [mode, setMode] = useState<TasbihMode>('names');
  const [count, setCount] = useState(0);
  const [shuffledList, setShuffledList] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const shuffle = (array: string[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const initList = useCallback((targetMode: TasbihMode) => {
    let list: string[] = [];
    switch (targetMode) {
      case 'names': list = NAMES_OF_ALLAH; break;
      case 'tasbih': list = TASBIH_PHRASES; break;
      case 'istighfar': list = ISTIGHFAR_PHRASES; break;
      case 'tazeem': list = TAZEEM_PHRASES; break;
    }
    const shuffled = shuffle(list);
    setShuffledList(shuffled);
    setCurrentItem(shuffled[0]);
    setCount(0);
  }, []);

  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initList(mode);
  }, [mode, initList]);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  const handlePress = () => {
    if (isAnimating || shuffledList.length === 0) return;
    setIsAnimating(true);
    
    const nextCount = count + 1;
    if (nextCount >= 99) {
      // Reset or cycle
      setCount(0);
      initList(mode);
      window.dispatchEvent(new CustomEvent('log_spiritual_event', {
        detail: {
          content: `أتممت دورة تسبيح كاملة (99 مرة) في وضع ${mode === 'names' ? 'الأسماء الحسنى' : mode === 'tasbih' ? 'التسبيح' : mode === 'istighfar' ? 'الاستغفار' : 'التعظيم'}`,
          icon: '📿',
          type: 'tasbih'
        }
      }));
    } else {
      setCount(nextCount);
      setCurrentItem(shuffledList[nextCount % shuffledList.length]);
    }

    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => setIsAnimating(false), 300);
  };

  const reset = () => {
    initList(mode);
  };

  // Calculate rotation for sun/moon cycle
  const rotation = (count / 99) * 360;
  const isDay = count < 50;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 min-h-[700px] relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-amber-400/10 dark:bg-amber-600/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-orange-400/10 dark:bg-orange-600/5 blur-[120px] animate-pulse delay-1000" />
      </div>

      {/* Header Controls */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-16 z-10">
        <div className="flex gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-4 rounded-[1.5rem] bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-amber-200/50 dark:border-white/10 text-amber-900 dark:text-amber-100 hover:scale-110 hover:rotate-12 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
            title="الإعدادات"
          >
            <Settings2 size={26} />
          </button>
          {navigator.share && (
            <button 
              onClick={() => {
                navigator.share({
                  title: 'السبحة الإلكترونية',
                  text: currentItem,
                }).catch(console.error);
              }}
              className="p-4 rounded-[1.5rem] bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-amber-200/50 dark:border-white/10 text-amber-900 dark:text-amber-100 hover:scale-110 hover:-rotate-12 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
              title="مشاركة"
            >
              <Share2 size={26} />
            </button>
          )}
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-4xl font-black text-amber-950 dark:text-amber-50 mb-2 tracking-tight">السبحة الإلكترونية</h2>
          <div className="h-1.5 w-16 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full shadow-sm shadow-amber-500/50" />
        </div>
        <button 
          onClick={reset}
          className="p-4 rounded-[1.5rem] bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-amber-200/50 dark:border-white/10 text-amber-900 dark:text-amber-100 hover:scale-110 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
          title="إعادة ضبط"
        >
          <RefreshCw size={26} className={isAnimating ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Mode Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="w-full max-w-xl mb-12 overflow-hidden z-20"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-white/60 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-amber-200/50 dark:border-white/10 shadow-xl">
              {[
                { id: 'names', label: 'الأسماء الحسنى' },
                { id: 'tasbih', label: 'تسبيح' },
                { id: 'istighfar', label: 'استغفار' },
                { id: 'tazeem', label: 'تعظيم' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id as TasbihMode); setShowSettings(false); }}
                  className={`p-4 rounded-2xl font-black text-sm transition-all duration-300 ${mode === m.id ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 scale-105' : 'bg-white/80 dark:bg-white/5 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-100 dark:border-white/5'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tasbih Display */}
      <div className="relative w-96 h-96 flex items-center justify-center mb-16">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        
        {/* Agate Chain (Circular Beads) */}
        <div className="absolute inset-0 rounded-full border-[6px] border-dashed border-amber-900/5 dark:border-amber-100/5" />
        
        {/* Animated Beads */}
        {Array.from({ length: 33 }).map((_, i) => {
          const angle = (i / 33) * 360 + rotation;
          const isActive = i === Math.floor((count % 33));
          return (
            <motion.div
              key={i}
              className={`absolute w-5 h-5 rounded-full shadow-lg ${isActive ? 'bg-gradient-to-br from-amber-400 to-amber-700 scale-150 z-20 shadow-amber-500/50 border-2 border-white/50' : 'bg-amber-900/20 dark:bg-amber-100/10'}`}
              style={{
                left: `calc(50% + ${Math.cos((angle * Math.PI) / 180) * 160}px - 10px)`,
                top: `calc(50% + ${Math.sin((angle * Math.PI) / 180) * 160}px - 10px)`,
                backgroundColor: isActive ? undefined : `rgba(${139 + i * 2}, ${69 + i}, 19, 0.4)` // Agate-like variations
              }}
              animate={{
                scale: isActive ? 1.5 : 1,
                opacity: isActive ? 1 : 0.6
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          );
        })}

        {/* Sun/Moon Central Cycle */}
        <motion.div 
          className="relative w-64 h-64 rounded-full bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center p-10 text-center cursor-pointer border-[6px] border-white dark:border-white/5 group overflow-hidden transition-all duration-500"
          onClick={handlePress}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
        >
          {/* Sun/Moon Icon Background */}
          <motion.div 
            className="absolute top-6 right-6 text-amber-500/10 dark:text-amber-300/5"
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 50 }}
          >
            {isDay ? <Sun size={140} /> : <Moon size={140} />}
          </motion.div>

          {/* Current Item Text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem}
              initial={{ y: 30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="z-10 flex flex-col items-center"
            >
              <h3 className="text-4xl font-black text-amber-950 dark:text-amber-50 mb-4 font-amiri leading-relaxed drop-shadow-sm">
                {currentItem}
              </h3>
              <div className="flex items-center justify-center gap-2.5 px-4 py-1.5 bg-amber-100/50 dark:bg-amber-900/30 rounded-full text-amber-800 dark:text-amber-300 mb-6 border border-amber-200/50 dark:border-amber-700/30">
                <Sparkles size={14} className="animate-pulse" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">
                  {mode === 'names' ? 'اسم الله' : mode === 'tasbih' ? 'تسبيح' : mode === 'istighfar' ? 'استغفار' : 'تعظيم'}
                </span>
              </div>
              <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                <ReadAloud 
                  text={currentItem} 
                  buttonClassName="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:scale-110 transition-transform shadow-sm"
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(currentItem).catch(() => {});
                  }}
                  className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:scale-110 transition-transform shadow-sm"
                  title="نسخ"
                >
                  <Copy size={18} />
                </button>
                {navigator.share && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.share({
                        title: 'الذكر الحكيم',
                        text: currentItem,
                      }).catch(console.error);
                    }}
                    className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:scale-110 transition-transform shadow-sm"
                    title="مشاركة"
                  >
                    <Share2 size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Press Feedback */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: isAnimating ? 1 : 0 }}
          />
        </motion.div>

        {/* Counter Badge */}
        <motion.div 
          className="absolute -bottom-6 bg-gradient-to-br from-amber-800 to-amber-950 text-white px-8 py-3 rounded-[1.5rem] font-black text-3xl shadow-2xl border-2 border-white/20 z-30 flex items-baseline gap-2"
          key={count}
          initial={{ scale: 0.8, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <span>{count + 1}</span>
          <span className="text-sm opacity-40 font-medium">/ 99</span>
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="text-center max-w-md relative z-10">
        <p className="text-amber-900/50 dark:text-amber-200/30 text-xl font-medium italic leading-relaxed">
          انقر على المركز للتسبيح. سيتم توليد أذكار مختلفة دون تكرار حتى تكتمل الدورة.
        </p>
      </div>

      {/* Decorative Chain Tails */}
      <div className="mt-12 flex flex-col items-center gap-3 opacity-20 group-hover:opacity-40 transition-opacity duration-1000">
        <div className="w-1.5 h-12 bg-gradient-to-b from-amber-800 to-transparent rounded-full" />
        <div className="w-8 h-8 rounded-full bg-amber-900 border-4 border-amber-600 shadow-inner" />
        <div className="flex gap-2">
          <div className="w-2.5 h-16 bg-amber-800 rounded-full rotate-12 origin-top animate-bounce" />
          <div className="w-2.5 h-16 bg-amber-800 rounded-full -rotate-12 origin-top animate-bounce delay-150" />
        </div>
      </div>
    </div>
  );
};
