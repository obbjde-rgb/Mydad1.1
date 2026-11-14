import { useState, useEffect, useRef, useMemo, ChangeEvent, lazy, Suspense } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Mic, Square, Play, Moon, Sun, Volume2, BookOpen, Search, ChevronRight, ChevronLeft, Info, X, Settings2, Sparkles, Monitor, Copy, Share2, Navigation, Star, Image as ImageIcon, Loader2, Layout, Hash, Type, Maximize, Minimize, Terminal, PenTool, Heart, Compass, Bookmark, Calendar, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RECITERS, TAFASIR, TRANSLATIONS, SURAH_AYAH_COUNTS, QIRAAT, QURAN_TEXT_URLS } from './constants';
import { ViewMode, Surah, Verse, RecitationSettings } from './types';
import { PrayerTimesCard } from './components/PrayerTimes';
import { HijriClock } from './components/HijriClock';
import { DuaSection } from './components/DuaSection';
import { QiblaSection } from './components/QiblaSection';
import { TasbihSection } from './components/TasbihSection';
import { ReadAloud } from './components/ReadAloud';
import { SettingsPanel } from './components/SettingsPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlaybackControls } from './components/PlaybackControls';
import { UserGuide } from './components/UserGuide';
import { WelcomeDuaGate } from './components/WelcomeDuaGate';
import { Octagram } from './components/Octagram';
import { AI_PROVIDERS, AIProviderKey, callAI, callAIWithFailover, generateRecitation, resolveGeminiVoice, transcribeAudio, fetchAllProvidersModels, initModelUpdater } from './services/aiService';
import { applyTajweed, TAJWEED_RULES } from './services/tajweedService';
import { logNetworkRequest, logNetworkResponse } from './lib/diagnostics';
import { generateAudioId, getCachedAudio } from './services/audioCacheService';
import { useTheme } from './hooks/useTheme';
import { safeLocalStorageSet, safeLocalStorageGet, safeLocalStorageRemove, getSurahDisplayName, parseAIJson } from './lib/utils';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SleepTimerWidget } from './components/SleepTimerWidget';
import { useMediaSessionAndKeepAlive } from './hooks/useMediaSessionAndKeepAlive';
import { OfflineDownloadManager } from './components/OfflineDownloadManager';
import { extractValidAudioBlob, getBundledOfflineAudioUrl, getCanonicalAudioUrls, getLocalTafsir, OFFLINE_AUDIO_CACHE_NAME, OFFLINE_RECITERS, purgeStaleRuntimeCaches, syncBundledOfflineAssets } from './services/offlineAudioManager';

// Lazy loaded components for better performance
import { MidadAlRahman } from './components/MidadAlRahman';
const AIHub = lazy(() => import('./components/AIHub').then(module => ({ default: module.AIHub })));
const IslamicCalendar = lazy(() => import('./components/IslamicCalendar').then(module => ({ default: module.IslamicCalendar })));
const TypecastModal = lazy(() => import('./components/TypecastModal').then(module => ({ default: module.TypecastModal })));
const SpiritualVision = lazy(() => import('./components/SpiritualVision').then(module => ({ default: module.SpiritualVision })));
const ImageGenerator = lazy(() => import('./components/ImageGenerator').then(module => ({ default: module.ImageGenerator })));

// --- Utility Functions ---

const getGlobalAyahNumber = (surahNum: number, ayahNum: number) => {
  let total = 0;
  for (let i = 0; i < surahNum - 1; i++) {
    total += SURAH_AYAH_COUNTS[i];
  }
  return total + ayahNum;
};

const calculateMetadata = (verses: Verse[]) => {
  let words = 0;
  let letters = 0;
  let harakaat = 0;
  
  // Precise Quranic Diacritics and Marks (Harakaat)
  // Includes: Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun (064B-0652)
  // Superscript Alif / Dagger Alif (0670)
  // Maddah, Hamza Above/Below (0653-0655)
  // Small high signs and Quranic marks (0610-061A, 06D6-06DC, 06DF-06E4, 06E7-06E8, 06EA-06ED, 0656-065F)
  const harakaatRegex = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g;
  
  // Arabic Letters: Basic alphabet (0621-064A) + Alif Wasla (0671) + Small Ya/Waw (06E5-06E6)
  const lettersRegex = /[\u0621-\u064A\u0671\u06E5\u06E6]/g;

  verses.forEach(v => {
    const text = v.text.trim();
    if (text) {
      // Words: split by whitespace and filter empty strings
      words += text.split(/\s+/).filter(w => w.length > 0).length;
      
      // Harakaat: count all diacritic marks and Quranic signs
      const hMatches = text.match(harakaatRegex);
      if (hMatches) harakaat += hMatches.length;
      
      // Letters: count base alphabet characters and spoken small letters
      const lMatches = text.match(lettersRegex);
      if (lMatches) letters += lMatches.length;
    }
  });
  
  return { words, letters, harakaat };
};

const openIndexedDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open('TarteelDB', 1);
  req.onupgradeneeded = (e: any) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('quran')) {
      db.createObjectStore('quran');
    }
  };
  req.onsuccess = (e: any) => resolve(e.target.result);
  req.onerror = (e: any) => reject(e.target.error);
});

const saveToDB = async (db: IDBDatabase, key: string, value: any) => {
  const tx = db.transaction('quran', 'readwrite');
  tx.objectStore('quran').put(value, key);
};

const getFromDB = async (db: IDBDatabase, key: string): Promise<any> => {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('quran', 'readonly');
      const req = tx.objectStore('quran').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};


const DailyInspiration = ({ quranData }: { quranData?: Surah[] | null }) => {
  const [verse, setVerse] = useState<{text: string, translation: string, surah: string, ayah: number} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyVerse = async () => {
      const surahNum = Math.floor(Math.random() * 114) + 1;
      const ayahCount = SURAH_AYAH_COUNTS[surahNum - 1] || 7;
      const ayahNum = Math.floor(Math.random() * ayahCount) + 1;

      // Instant local fallback helper (works 100% offline)
      const loadLocalDailyVerse = async () => {
        try {
          let sourceData = quranData;
          if (!sourceData) {
            const localRes = await fetch('/data/quran.json');
            if (localRes.ok) {
              sourceData = await localRes.json();
            }
          }
          const surahObj = sourceData?.find(s => s.id === surahNum);
          const ayahObj = surahObj?.verses?.find(v => v.id === ayahNum);
          const localTafsir = await getLocalTafsir(surahNum, ayahNum);
          if (surahObj && ayahObj) {
            setVerse({
              text: ayahObj.text,
              translation: localTafsir || 'تأمل في آيات الله البينات',
              surah: surahObj.name,
              ayah: ayahObj.id
            });
            return true;
          }
        } catch {
          // ignore
        }
        return false;
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await loadLocalDailyVerse();
        setLoading(false);
        return;
      }

      try {
        const url1 = `https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/ar.alafasy`;
        const options1 = { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000) };
        logNetworkRequest(url1, options1, 'QuranDailyVerse');
        const response = await fetch(url1, options1);
        logNetworkResponse(url1, response, 'QuranDailyVerse');
        const data = await response.json();
        
        const url2 = `https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/en.asad`;
        const options2 = { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000) };
        logNetworkRequest(url2, options2, 'QuranDailyVerseTrans');
        const transResponse = await fetch(url2, options2);
        logNetworkResponse(url2, transResponse, 'QuranDailyVerseTrans');
        const transData = await transResponse.json();
        
        setVerse({
          text: data.data.text,
          translation: transData.data.text,
          surah: data.data.surah.name,
          ayah: data.data.numberInSurah
        });
      } catch (e) {
        console.warn("Online daily verse unavailable, using local offline Quran:", e);
        await loadLocalDailyVerse();
      } finally {
        setLoading(false);
      }
    };
    fetchDailyVerse();
  }, [Boolean(quranData)]);

  if (loading || !verse) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto mt-12 p-8 rounded-[2.5rem] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-800/30 shadow-2xl shadow-amber-900/5 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles size={120} className="text-amber-600" />
      </div>
      
      <div className="relative z-10 text-center space-y-6">
        <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm tracking-widest uppercase">
          <Star size={16} fill="currentColor" />
          <span>آية اليوم للتأمل</span>
          <Star size={16} fill="currentColor" />
        </div>
        
        {verse && (
          <>
            <p className="text-3xl md:text-4xl font-quran leading-loose text-amber-950 dark:text-amber-50 drop-shadow-sm">
              {verse.text}
            </p>
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-amber-300 dark:via-amber-700 to-transparent mx-auto" />
            <p className="text-lg md:text-xl text-amber-900/70 dark:text-amber-200/60 font-sans italic leading-relaxed px-4">
              {verse.translation}
            </p>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 px-4 py-2 rounded-full inline-block">
              {getSurahDisplayName(verse.surah)} - آية {verse.ayah}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

const QuranVerse = () => (
  <span className="text-amber-500 font-amiri text-2xl font-bold tracking-widest drop-shadow-md">
    وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا
  </span>
);

const TajweedText = ({ text, isTajweed }: { text: string; isTajweed: boolean }) => {
  if (!isTajweed) return <span className="font-amiri">{text}</span>;

  const processedText = applyTajweed(text);

  return (
    <span 
      className="font-amiri" 
      dangerouslySetInnerHTML={{ __html: processedText }} 
    />
  );
};



const CommandActionButton = ({ 
  onClick, 
  className = "", 
  title = "أمر ذكي سريع", 
  size = 20
}: { 
  onClick: () => void; 
  className?: string; 
  title?: string;
  size?: number;
}) => (
  <motion.button
    whileHover={{ scale: 1.1, rotate: -5 }}
    whileTap={{ scale: 0.9 }}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-lg shadow-sky-900/20 hover:shadow-sky-500/40 transition-all border border-sky-400/30 group ${className}`}
    title={title}
  >
    <Terminal size={size} className="group-hover:animate-pulse" />
  </motion.button>
);

const SmartActionButton = ({ 
  onClick, 
  className = "", 
  title = "المساعد الذكي", 
  icon: Icon = Sparkles,
  size = 20
}: { 
  onClick: () => void; 
  className?: string; 
  title?: string;
  icon?: any;
  size?: number;
}) => (
  <motion.button
    whileHover={{ scale: 1.1, rotate: 5 }}
    whileTap={{ scale: 0.9 }}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-lg shadow-amber-900/20 hover:shadow-amber-500/40 transition-all border border-amber-400/30 group ${className}`}
    title={title}
  >
    <Icon size={size} className="group-hover:animate-pulse" />
  </motion.button>
);

function App() {
  // Purge stale legacy caches cleanly once per epoch and sync bundled offline assets
  useEffect(() => {
    purgeStaleRuntimeCaches().catch(() => {});
    const timer = setTimeout(() => {
      syncBundledOfflineAssets().catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // --- State ---
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const paramView = new URLSearchParams(window.location.search).get('view') as ViewMode | null;
      const validViews: ViewMode[] = ['search', 'browse', 'duas', 'qibla', 'tasbih', 'ai-hub', 'bookmarks', 'calendar', 'ai-chat', 'image_generator'];
      if (paramView && validViews.includes(paramView)) {
        return paramView;
      }
    } catch {
      // ignore invalid URL search params
    }
    return (safeLocalStorageGet('quran_viewMode') as ViewMode) || 'search';
  });
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return safeLocalStorageGet('quran_app_unlocked_v2') === 'true';
  });
  const { themeMode, toggleTheme } = useTheme();
  const [recentSurahs, setRecentSurahs] = useState<number[]>(() => {
    try {
      const saved = safeLocalStorageGet('recentSurahs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse recentSurahs:", e);
      return [];
    }
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = safeLocalStorageGet('quran_fontSize');
    return saved ? parseInt(saved, 10) : 17;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return safeLocalStorageGet('fontFamily') || 'font-amiri';
  });
  const [bookmarks, setBookmarks] = useState<{ surah: number; ayah: number; text: string; surahName: string }[]>(() => {
    try {
      const saved = safeLocalStorageGet('quran_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse bookmarks:", e);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [quranData, setQuranData] = useState<Surah[] | null>(null);
  
  // Search Mode State
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    safeLocalStorageSet('quran_viewMode', viewMode);
    setIsExpanded(false); // Reset expansion when changing views
  }, [viewMode]);

  useEffect(() => {
    safeLocalStorageSet('quran_fontSize', fontSize.toString());
  }, [fontSize]);

  const getReciterFolder = (reciter: string) => {
    const reciterMapping: Record<string, string> = {
      'ar.alafasy': 'Alafasy_128kbps',
      'ar.abdullahbasfar': 'Abdullah_Basfar_64kbps',
      'ar.abdurrahmaansudais': 'Abdurrahmaan_As-Sudais_192kbps',
      'ar.mahermuaiqly': 'Maher_AlMuaiqly_64kbps',
      'ar.husary': 'Husary_128kbps',
      'ar.husarymujawwad': 'Husary_Mujawwad_64kbps',
      'ar.minshawi': 'Minshawy_Murattal_128kbps',
      'ar.minshawimujawwad': 'Minshawy_Mujawwad_192kbps',
      'ar.shaatree': 'Abu_Bakr_Ash-Shaatree_128kbps',
      'ar.ahmedajamy': 'Ahmed_bin_Ali_Al-Ajmy_128kbps_64kbps',
      'ar.saoodshuraym': 'Saood_ash-Shuraym_128kbps',
      'ar.hudhaify': 'Hudhaify_128kbps',
      'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
      'ar.abdulsamad': 'Abdul_Basit_Mujawwad_128kbps',
      'ar.muhammadayyoub': 'Muhammad_Ayyoub_128kbps',
      'ar.muhammadjibreel': 'Muhammad_Jibreel_128kbps',
      'ar.aymanswoaid': 'Ayman_Sowaid_64kbps',
      'ar.hanirifai': 'Hani_Rifai_192kbps',
      'ar.ibrahimakhbar': 'Ibrahim_Al_Akhdar_128kbps',
      'ar.parhizgar': 'Parhizgar_48kbps',
      'ar.yasseraddussary': 'Yasser_Ad-Dussary_128kbps',
      'ar.faresabbad': 'Fares_Abbad_64kbps',
      'ar.nasseralqatami': 'Nasser_Alqatami_128kbps',
      'ar.salahalbudair': 'Salah_Al_Budair_128kbps',
      'ar.alijaber': 'Ali_Jaber_64kbps',
      'ar.mahmoudalialbanna': 'Mahmoud_Ali_Al_Banna_32kbps',
      'ar.mustafaismail': 'Mustafa_Ismail_48kbps',
      'en.walk': 'MultiLanguage/English/Ibrahim_Walk_192kbps_TR',
      'fa.hedayatfarfooladvand': 'MultiLanguage/Persian/Hedayatfar_40kbps',
      'fr.leclerc': 'French/Leclerc_128kbps',
      'ru.kuliev-audio': 'Russian/Russian_128kbps',
      'ur.khan': 'MultiLanguage/Urdu/Shamshad_Ali_Khan_48kbps',
      'zh.chinese': 'Chinese/Chinese_128kbps',
    };
    return reciterMapping[reciter];
  };

  const getReciterBitrate = (reciter: string) => {
    const bitrates: Record<string, string> = {
      'ar.abdullahbasfar': '192',
      'ar.abdurrahmaansudais': '192',
      'ar.minshawimujawwad': '64',
      'ar.saoodshuraym': '64',
      'ar.abdulbasitmurattal': '192',
      'ar.abdulsamad': '64',
      'ar.aymanswoaid': '64',
      'ar.hanirifai': '192',
      'ar.ibrahimakhbar': '32',
      'ar.parhizgar': '48',
      'en.walk': '192',
      'fa.hedayatfarfooladvand': '40',
      'ur.khan': '64',
    };
    return bitrates[reciter] || '128';
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 5;
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 5;
    }
  };

  const addRecentSurah = (surahId: number) => {
    setRecentSurahs(prev => {
      const updated = [surahId, ...prev.filter(id => id !== surahId)].slice(0, 5);
      return updated;
    });
  };

  const handleSurahSelect = (surah: Surah) => {
    addRecentSurah(surah.id);
    setSelectedSurah(surah);
    setCurrentPage(1);
    setAIContext({ surah: surah.name, timestamp: Date.now() });
    logAIEvent(`تصفح ${getSurahDisplayName(surah.name)}`, '📖', 'browse');
    stopRecitation();
    setViewMode('browse');
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSearchText(value);
    setActiveSuggestionIndex(-1);

    if (value.length > 1 && quranData) {
      const filtered = quranData
        .map(s => s.name)
        .filter(name => (name && typeof name === 'string' && name.includes(value.trim())) || (value && typeof value === 'string' && value.trim().includes(name)));
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
        e.preventDefault();
        setSearchText(suggestions[activeSuggestionIndex]);
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
      } else if (e.key === 'Escape') {
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearchAndCorrect();
    }
  };
  const [searchResult, setSearchResult] = useState<{ 
    type: 'surah' | 'ayah' | 'text', 
    data?: any, 
    contextVerses?: any[],
    text?: string, 
    explanation?: string,
    qiraatDifferences?: string,
    metadata?: {
      surahName?: string;
      juz?: number;
      hizb?: number;
      asbab?: string;
      words?: number;
      letters?: number;
      harakaat?: number;
      revelationType?: string;
      verseCount?: number;
      order?: number;
      translation?: string;
    }
  } | null>(null);
  const [showTajweedInfo, setShowTajweedInfo] = useState(false);
  const [showQiraatInfo, setShowQiraatInfo] = useState<{ surah: number; ayah: number; text: string; info: string } | null>(null);
  const [isTypecastOpen, setIsTypecastOpen] = useState(false);
  const [typecastText, setTypecastText] = useState('');
  const [visionText, setVisionText] = useState<string | null>(null);
  const [lastSearchedText, setLastSearchedText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Browse Mode State
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [confirmClearBookmarks, setConfirmClearBookmarks] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = safeLocalStorageGet('quran_currentPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const VERSES_PER_PAGE = 20;
  const [surahSearch, setSurahSearch] = useState('');
  const [isTajweed, setIsTajweed] = useState(() => {
    return safeLocalStorageGet('quran_isTajweed') !== 'false';
  });
  
  // Audio & Playback State
  const [selectedReciter, setSelectedReciter] = useState(() => {
    return safeLocalStorageGet('quran_selectedReciter') || 'ar.alafasy';
  });
  const [selectedQiraat, setSelectedQiraat] = useState(() => {
    return safeLocalStorageGet('quran_selectedQiraat') || 'hafs';
  });
  const [selectedTafsir, setSelectedTafsir] = useState(() => {
    return safeLocalStorageGet('quran_selectedTafsir') || 'ar.muyassar';
  });
  const [selectedTranslation, setSelectedTranslation] = useState(() => {
    return safeLocalStorageGet('quran_selectedTranslation') || 'en.sahih';
  });

  useEffect(() => {
    safeLocalStorageSet('quran_isTajweed', isTajweed.toString());
    safeLocalStorageSet('quran_selectedReciter', selectedReciter);
    safeLocalStorageSet('quran_selectedQiraat', selectedQiraat);
    safeLocalStorageSet('quran_selectedTafsir', selectedTafsir);
    safeLocalStorageSet('quran_selectedTranslation', selectedTranslation);
  }, [isTajweed, selectedReciter, selectedQiraat, selectedTafsir, selectedTranslation]);
  const [translationsData, setTranslationsData] = useState<{ [key: number]: string }>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAyah, setActiveAyah] = useState<{ surah: number; ayah: number; targetAyah?: number } | null>(() => {
    try {
      const saved = safeLocalStorageGet('quran_activeAyah');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Smart state persistence to save user position, view mode, and settings without battery drain
  useEffect(() => {
    const saveState = () => {
      try {
        safeLocalStorageSet('quran_viewMode', viewMode);
        if (selectedSurah) {
          safeLocalStorageSet('quran_selectedSurahId', selectedSurah.id.toString());
        }
        safeLocalStorageSet('quran_currentPage', currentPage.toString());
        if (activeAyah) {
          safeLocalStorageSet('quran_activeAyah', JSON.stringify(activeAyah));
        }
        safeLocalStorageSet('quran_selectedReciter', selectedReciter);
        safeLocalStorageSet('quran_selectedQiraat', selectedQiraat);
        safeLocalStorageSet('quran_selectedTafsir', selectedTafsir);
        safeLocalStorageSet('quran_selectedTranslation', selectedTranslation);
        safeLocalStorageSet('quran_fontSize', fontSize.toString());
        safeLocalStorageSet('fontFamily', fontFamily);
      } catch (e) {
        console.warn("Smart persistence save error:", e);
      }
    };

    const timer = setTimeout(saveState, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveState();
      }
    };
    const handleBeforeUnload = () => {
      saveState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [viewMode, selectedSurah, currentPage, activeAyah, selectedReciter, selectedQiraat, selectedTafsir, selectedTranslation, fontSize, fontFamily]);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentAudioData, setCurrentAudioData] = useState<Uint8Array | null>(null);
  const [currentMimeType, setCurrentMimeType] = useState<string>('audio/wav');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnalyzingQiraat, setIsAnalyzingQiraat] = useState(false);
  const [showAIHub, setShowAIHub] = useState(false);
  const [aiHubInitialInput, setAiHubInitialInput] = useState('');

  const openAIHubWithCommand = (command: string = '/') => {
    setAiHubInitialInput(command);
    setShowAIHub(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openAIHubWithCommand('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [showMidadAlRahman, setShowMidadAlRahman] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return resolveGeminiVoice(safeLocalStorageGet('ai_recitation_voice')).id;
  });
  const [ttsModel, setTtsModel] = useState<string>(() => {
    const saved = safeLocalStorageGet('ai_tts_model');
    return saved && saved.includes('tts') ? saved : 'gemini-3.8-flash-tts';
  });
  const [aiRecitationSettings, setAiRecitationSettings] = useState<RecitationSettings>(() => {
    try {
      const saved = safeLocalStorageGet('ai_recitation_settings');
      return saved ? JSON.parse(saved) : { pitch: 1.0, rate: 1.0 };
    } catch {
      return { pitch: 1.0, rate: 1.0 };
    }
  });
  const [humanRecitationSettings, setHumanRecitationSettings] = useState<RecitationSettings>(() => {
    try {
      const saved = safeLocalStorageGet('human_recitation_settings');
      return saved ? JSON.parse(saved) : { pitch: 1.0, rate: 1.0 };
    } catch {
      return { pitch: 1.0, rate: 1.0 };
    }
  });

  useEffect(() => {
    initModelUpdater();
    fetchAllProvidersModels().catch(console.error);
  }, []);

  useEffect(() => {
    safeLocalStorageSet('ai_recitation_voice', selectedVoice);
    safeLocalStorageSet('ai_tts_model', ttsModel);
    safeLocalStorageSet('ai_recitation_settings', JSON.stringify(aiRecitationSettings));
    safeLocalStorageSet('human_recitation_settings', JSON.stringify(humanRecitationSettings));
  }, [selectedVoice, ttsModel, aiRecitationSettings, humanRecitationSettings]);

  const [ayahContextMenu, setAyahContextMenu] = useState<{ 
    x: number; 
    y: number; 
    visible: boolean; 
    surahId: number; 
    ayahId: number; 
    text: string 
  } | null>(null);

  const playAudioWithSettings = (audio: HTMLAudioElement, settings: RecitationSettings) => {
    audio.playbackRate = settings.rate;
    return audio.play();
  };
  const [aiContext, setAIContext] = useState<{ 
    surah?: string; 
    ayah?: number; 
    text?: string;
    tafsir?: string;
    tafsirRequest?: string;
    timestamp?: number;
  } | undefined>(() => {
    try {
      const saved = safeLocalStorageGet('ai_context_memory');
      return saved ? JSON.parse(saved) : undefined;
    } catch (e) {
      console.error("Failed to parse ai_context_memory:", e);
      return undefined;
    }
  });

  useEffect(() => {
    const handleLogEvent = (e: any) => {
      const { content, icon, type } = e.detail;
      logAIEvent(content, icon, type);
    };
    const handleOpenTypecast = (e: any) => {
      const { text } = e.detail;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(console.error);
      }
      setTypecastText(text || '');
      setIsTypecastOpen(true);
    };
    const handleOpenVision = (e: any) => {
      const { text } = e.detail;
      if (text) setVisionText(text);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setViewMode('search');
        setTimeout(() => {
          document.getElementById('quran-search-input')?.focus();
        }, 100);
      }
    };
    window.addEventListener('log_spiritual_event', handleLogEvent);
    window.addEventListener('open_typecast', handleOpenTypecast);
    window.addEventListener('open_spiritual_vision', handleOpenVision);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('log_spiritual_event', handleLogEvent);
      window.removeEventListener('open_typecast', handleOpenTypecast);
      window.removeEventListener('open_spiritual_vision', handleOpenVision);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const logAIEvent = (content: string, icon?: string, type: 'search' | 'browse' | 'listen' | 'bookmark' | 'tafsir' | 'tasbih' | 'dua' | 'qibla' | 'prayer' | 'event' | 'settings' = 'event') => {
    let history: any[] = [];
    try {
      const saved = safeLocalStorageGet('ai_chat_history');
      history = saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse ai_chat_history:", e);
      history = [];
    }
    const event = {
      id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'assistant',
      content: typeof content === 'string' ? content : JSON.stringify(content),
      timestamp: Date.now(),
      type: 'event',
      eventType: type,
      eventIcon: icon
    };
    const updated = [...history, event].slice(-100); // Keep last 100 items for better memory
    safeLocalStorageSet('ai_chat_history', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('refresh_ai_history'));
  };

  const getEnrichedAIContext = (surahObj: any, ayahObj: any) => {
    let enrichedText = ayahObj.text;
    const wordCount = enrichedText.split(/\s+/).length;
    
    // If the verse is short (less than 7 words), include previous and next verses for context
    if (wordCount < 7 && surahObj && surahObj.verses) {
      const ayahIndex = surahObj.verses.findIndex((v: any) => v.id === ayahObj.id);
      if (ayahIndex !== -1) {
        const prevAyah = surahObj.verses[ayahIndex - 1];
        const nextAyah = surahObj.verses[ayahIndex + 1];
        
        let contextText = enrichedText;
        if (prevAyah) contextText = `[الآية السابقة: ${prevAyah.text}] ` + contextText;
        if (nextAyah) contextText = contextText + ` [الآية التالية: ${nextAyah.text}]`;
        enrichedText = contextText;
      }
    }
    
    return { surah: surahObj.name, ayah: ayahObj.id, text: enrichedText, timestamp: Date.now() };
  };

  useEffect(() => {
    if (aiContext) {
      safeLocalStorageSet('ai_context_memory', JSON.stringify(aiContext));
    }
  }, [aiContext]);

  useEffect(() => {
    safeLocalStorageSet('quran_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // AI Provider State
  const [showSettings, setShowSettings] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [provider, setProvider] = useState<AIProviderKey>('gemini');
  const [apiKeyInput, setApiKeyInput] = useState(safeLocalStorageGet(AI_PROVIDERS['gemini'].keyName) || '');

  const audioRef = useRef<HTMLAudioElement>(null);
  const virtuosoRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const playbackModeRef = useRef<'continuous' | 'single'>('single');
  const currentRecitationId = useRef<number>(0);

  // --- Effects ---
  
  useEffect(() => {
    if (selectedSurah) {
      safeLocalStorageSet('quran_selectedSurahId', selectedSurah.id.toString());
    }
  }, [selectedSurah]);

  const initialSurahLoaded = useRef(false);

  useEffect(() => {
    if (quranData) {
      if (!initialSurahLoaded.current) {
        const savedSurahId = safeLocalStorageGet('quran_selectedSurahId');
        if (savedSurahId) {
          const surah = quranData.find(s => s.id === parseInt(savedSurahId, 10));
          if (surah) {
            setSelectedSurah(surah);
          }
        }
        initialSurahLoaded.current = true;
      } else if (selectedSurah) {
        // Update selectedSurah if quranData changes (e.g. Qiraat change)
        const updatedSurah = quranData.find(s => s.id === selectedSurah.id);
        if (updatedSurah && updatedSurah !== selectedSurah) {
          setSelectedSurah(updatedSurah);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quranData]);

  useEffect(() => {
    const loadQuran = async () => {
      try {
        const db = await openIndexedDB();
        const cacheKey = `fullQuran_v2_${selectedQiraat}`;
        const saved = await getFromDB(db, cacheKey);
        if (saved) {
          setQuranData(saved);
          return;
        }

        setIsLoading(true);
        const url = QURAN_TEXT_URLS[selectedQiraat] || QURAN_TEXT_URLS['hafs'];
        console.log('Fetching Quran from:', url);
        
        // Show warning if not hafs
        if (selectedQiraat !== 'hafs') {
          setError('ملاحظة: النص المعروض هو النص العثماني القياسي (رواية حفص)، حيث لا تتوفر نصوص منفصلة حالياً لبقية الروايات.');
        }

        let data;
        let effectiveQiraat = selectedQiraat;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error('Failed to parse JSON for URL:', url, 'Text snippet:', text.substring(0, 50));
            throw e;
          }
        } catch (e) {
          console.error('Failed to load Qiraat, falling back to Hafs:', e);
          try {
            const res = await fetch(QURAN_TEXT_URLS['hafs']);
            const text = await res.text();
            data = JSON.parse(text);
            effectiveQiraat = 'hafs';
            if (selectedQiraat !== 'hafs') {
              setSelectedQiraat('hafs');
            }
          } catch (e2) {
            console.error('Failed to load Hafs fallback:', e2);
            throw e2;
          }
        }
        console.log('Quran Data Loaded:', data);
        
        let normalized: Surah[];

        if (effectiveQiraat === 'hafs' || (Array.isArray(data) && data[0]?.verses)) {
          // The new structure is already in Surah[] format
          normalized = data as Surah[];
        } else {
          // Normalize data to match our Surah[] interface
          // The structure is a flat array of verses
          const surahsMap: Record<number, any> = {};
          
          // Ensure data is iterable
          const verses = Array.isArray(data) ? data : (data.verses || []);
          
          verses.forEach((v: any) => {
            if (!surahsMap[v.sura_no]) {
              surahsMap[v.sura_no] = {
                id: v.sura_no,
                name: v.sura_name_ar,
                transliteration: v.sura_name_en,
                translation: '',
                type: '',
                total_verses: 0,
                verses: []
              };
            }
            surahsMap[v.sura_no].verses.push({
              id: v.aya_no,
              text: v.aya_no === 1 && v.sura_no !== 9 && (v.sura_no !== 1 || effectiveQiraat === 'warsh') && v.aya_text && typeof v.aya_text === 'string' && v.aya_text.startsWith('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ') ? v.aya_text.replace('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', '').trim() : v.aya_text,
              translation: '',
              transliteration: ''
            });
          });

          // Convert map to array and set total_verses
          normalized = Object.values(surahsMap).map((s: any) => ({
            ...s,
            total_verses: s.verses.length
          }));
        }
        
        setQuranData(normalized);
        await saveToDB(db, `fullQuran_v2_${effectiveQiraat}`, normalized);
      } catch (e) {
        console.error('فشل تحميل القرآن', e);
        setError('فشل تحميل قاعدة بيانات القرآن. يرجى التحقق من الاتصال.');
      } finally {
        setIsLoading(false);
      }
    };
    loadQuran();
  }, [selectedQiraat]);

  useEffect(() => {
    safeLocalStorageSet('recentSurahs', JSON.stringify(recentSurahs));
    safeLocalStorageSet('fontSize', fontSize.toString());
    safeLocalStorageSet('fontFamily', fontFamily);
  }, [recentSurahs, fontSize, fontFamily]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      
      if (activeAyah?.ayah === 0) {
        // Just finished Basmalah, play the target ayah (default to 1 if not specified)
        const targetAyah = activeAyah.targetAyah || 1;
        playRealRecitation(activeAyah.surah, targetAyah, false);
        return;
      }

      playNextAyah();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [selectedSurah, activeAyah, viewMode, selectedReciter, selectedTafsir, searchResult]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setActiveAyah(null);
    setAudioProgress(0);
  }, [viewMode]);

  useEffect(() => {
    if (activeAyah && activeAyah.ayah > 0) {
      fetchTafsir(activeAyah.surah, activeAyah.ayah);
    }
  }, [selectedTafsir]);

  useEffect(() => {
    if (activeAyah && selectedSurah && activeAyah.surah === selectedSurah.id) {
      if (virtuosoRef.current) {
        const indexToScroll = Math.max(0, activeAyah.ayah - 1);
        virtuosoRef.current.scrollToIndex({
          index: indexToScroll,
          align: 'center',
          behavior: 'smooth'
        });
      }
    }
  }, [activeAyah, selectedSurah]);

  useEffect(() => {
    if (selectedSurah) {
      fetchTranslation(selectedSurah.id);
    } else if (searchResult?.type === 'surah') {
      fetchTranslation(searchResult.data.id);
    }
  }, [selectedSurah, selectedTranslation, searchResult]);

  // --- Logic Functions ---

  const fetchTranslation = async (surahNum: number) => {
    if (selectedTranslation === 'none') {
      setTranslationsData({});
      return;
    }
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${selectedTranslation}`);
      const data = await res.json();
      if (data.code === 200) {
        const transMap: { [key: number]: string } = {};
        data.data.ayahs.forEach((ayah: any) => {
          transMap[ayah.numberInSurah] = ayah.text;
        });
        setTranslationsData(transMap);
      }
    } catch (e) {
      console.error('فشل جلب الترجمة', e);
    }
  };

  const fetchAyahTranslation = async (surahNum: number, ayahNum: number) => {
    if (selectedTranslation === 'none') return null;
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/${selectedTranslation}`);
      const data = await res.json();
      if (data.code === 200) {
        return data.data.text;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const fetchTafsir = async (surahNum: number, ayahNum: number) => {
    try {
      const surahObj = quranData?.find(s => s.id === surahNum);
      const ayahObj = surahObj?.verses.find(v => v.id === ayahNum);
      const surahName = surahObj?.name || surahNum;
      
      if (selectedTafsir === 'ai.explanation') {
        if (!navigator.onLine) {
          const localMuyassar = await getLocalTafsir(surahNum, ayahNum);
          if (localMuyassar) {
            setAIContext({
              surah: surahName.toString(),
              ayah: ayahNum,
              text: ayahObj?.text,
              tafsir: `${localMuyassar}\n\n(التفسير الميسر — وضع عدم الاتصال)`,
              timestamp: Date.now()
            });
          }
          return;
        }
        const prompt = `اشرح الآية رقم ${ayahNum} من ${getSurahDisplayName(surahName.toString())} شرحاً ميسراً ومختصراً باللغة العربية. الآية هي: ${ayahObj?.text}`;
        const aiTafsir = await callAI(provider, [{ role: 'user', content: prompt }]);
        setAIContext({ 
          surah: surahName.toString(), 
          ayah: ayahNum, 
          text: ayahObj?.text, 
          tafsir: aiTafsir.content,
          timestamp: Date.now() 
        });
        logAIEvent(`توليد تفسير ذكي للآية ${ayahNum} من ${getSurahDisplayName(surahName.toString())}`, '🤖', 'tafsir');
        return;
      }

      // Instant local offline lookup for Tafsir Al-Muyassar
      if (selectedTafsir === 'ar.muyassar') {
        const localText = await getLocalTafsir(surahNum, ayahNum);
        if (localText) {
          setAIContext({
            surah: surahName.toString(),
            ayah: ayahNum,
            text: ayahObj?.text,
            tafsir: localText,
            timestamp: Date.now()
          });
          logAIEvent(`قراءة تفسير الآية ${ayahNum} من ${getSurahDisplayName(surahName.toString())}`, '📝');
          return;
        }
      }

      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/${selectedTafsir}`);
      const data = await res.json();
      if (data.code === 200) {
        setAIContext({ 
          surah: surahName.toString(), 
          ayah: ayahNum, 
          text: ayahObj?.text, 
          tafsir: data.data.text,
          timestamp: Date.now() 
        });
        logAIEvent(`قراءة تفسير الآية ${ayahNum} من ${getSurahDisplayName(surahName.toString())}`, '📝');
      }
    } catch {
      const localFallback = await getLocalTafsir(surahNum, ayahNum);
      if (localFallback) {
        const surahObj = quranData?.find(s => s.id === surahNum);
        const ayahObj = surahObj?.verses.find(v => v.id === ayahNum);
        setAIContext({
          surah: (surahObj?.name || surahNum).toString(),
          ayah: ayahNum,
          text: ayahObj?.text,
          tafsir: `${localFallback}\n\n(التفسير الميسر — وضع عدم الاتصال)`,
          timestamp: Date.now()
        });
      }
    }
  };

  const playNextAyah = () => {
    if (playbackModeRef.current === 'single') {
      stopRecitation();
      return;
    }

    const isSurahMode = viewMode === 'browse' || (viewMode === 'search' && searchResult?.type === 'surah');
    const currentSurahObj = viewMode === 'browse' ? selectedSurah : (searchResult?.type === 'surah' ? searchResult.data : null);

    if (isSurahMode && currentSurahObj && activeAyah) {
      // Auto-play next ayah
      const nextAyahId = activeAyah.ayah + 1;
      if (nextAyahId <= currentSurahObj.verses.length) {
        playRealRecitation(currentSurahObj.id, nextAyahId, false);
      } else {
        stopRecitation();
      }
    } else {
      stopRecitation();
    }
  };

  useMediaSessionAndKeepAlive({
    isPlaying,
    surahName: selectedSurah?.name || (activeAyah ? `السورة رقم ${activeAyah.surah}` : undefined),
    ayahNumber: activeAyah?.ayah,
    reciterName: RECITERS.find(r => r.id === selectedReciter)?.name,
    onPlay: () => {
      if (audioRef.current && !isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      }
    },
    onPause: () => {
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    },
    onNext: () => {
      playNextAyah();
    },
    onPrevious: () => {
      if (activeAyah && activeAyah.ayah > 1) {
        playRealRecitation(activeAyah.surah, activeAyah.ayah - 1, false);
      }
    },
  });

  const speakText = (text: string, onEnd?: () => void) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    
    const startSpeech = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a high-quality Arabic voice
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(v => v.lang && typeof v.lang === 'string' && v.lang.startsWith('ar')) || voices.find(v => v.lang && typeof v.lang === 'string' && v.lang.includes('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }

      utterance.lang = 'ar-SA';
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    // Chrome/Safari sometimes need a small delay for voices to load
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        startSpeech();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      startSpeech();
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const analyzeQiraat = async (surah: number, ayah: number, text: string) => {
    if (!text || isAnalyzingQiraat) return;
    setIsAnalyzingQiraat(true);
    try {
      const prompt = `أنت خبير في القراءات العشر. اشرح باختصار أهم الاختلافات في القراءات العشر لهذه الآية الكريمة: 
      سورة رقم ${surah}، آية رقم ${ayah}
      النص: ${text}
      
      اذكر الاختلافات الرئيسية بين القراءات المشهورة (حفص، ورش، قالون، إلخ).`;
      
      const result = await callAIWithFailover('gemini', [
        { role: 'system', content: 'أنت خبير في القراءات العشر والقرآن الكريم.' },
        { role: 'user', content: prompt }
      ]);
      
      setSearchResult({
        type: 'text',
        text: text,
        qiraatDifferences: result.content,
        metadata: {
          surahName: selectedSurah?.name || ''
        }
      });
      setViewMode('search');
    } catch (error) {
      console.error('Qiraat analysis error:', error);
      setError('تعذر تحليل الفروق في القراءات العشر. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAnalyzingQiraat(false);
    }
  };

  const playAIRecitation = async (surahNum: number, ayahNum: number, includeBasmalah = false, retryCount = 0) => {
    if (!quranData) return;
    
    const surah = quranData.find(s => s.id === surahNum);
    if (!surah) return;
    
    const ayah = surah.verses.find(v => v.id === ayahNum);
    if (!ayah) return;

    setIsLoading(true);
    setError('');
    
    const userKey = safeLocalStorageGet(AI_PROVIDERS['gemini'].keyName);
    
    // Increment and capture recitation ID
    currentRecitationId.current += 1;
    const recitationId = currentRecitationId.current;

    let textToRead = ayah.text;
    if (includeBasmalah && ayahNum === 1 && (surahNum !== 1 || selectedQiraat === 'warsh') && surahNum !== 9) {
      textToRead = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ " + textToRead;
    }

    let scheduledRetry = false;

    try {
      // Use the new audio cache service
      const audioId = generateAudioId(surahNum, ayahNum, `ai-${selectedVoice}`);
      const cachedData = await getCachedAudio(audioId);
      
      let audioData: Uint8Array;
      let mimeType: string;

      if (cachedData) {
        audioData = cachedData.data;
        mimeType = cachedData.mimeType;
        setCurrentAudioData(audioData);
        setCurrentMimeType(mimeType);
      } else {
        const recitationData = await generateRecitation(textToRead, selectedVoice, userKey || undefined);
        if (currentRecitationId.current !== recitationId) return; // Abort if superseded
        
        if (!recitationData) {
          console.warn("AI Recitation generation failed, falling back to browser TTS.");
          setError("تم تجاوز حصة الذكاء الاصطناعي. جاري التبديل إلى القارئ الصوتي المدمج في المتصفح...");
          setIsPlaying(true);
          setActiveAyah({ surah: surahNum, ayah: ayahNum });
          fetchTafsir(surahNum, ayahNum);
          speakText(textToRead, playNextAyah);
          setIsLoading(false);
          return;
        }
        
        // Convert base64 to Uint8Array
        const binaryString = atob(recitationData.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioData = bytes;
        mimeType = recitationData.mimeType;
        setCurrentAudioData(audioData);
        setCurrentMimeType(mimeType);
      }

      let blob: Blob;
      if (mimeType && typeof mimeType === 'string' && mimeType.includes('pcm')) {
        // This shouldn't happen now as generateRecitation adds the header, but for safety:
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        const sampleRate = 24000;
        
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + audioData.length, true);
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, audioData.length, true);
        
        blob = new Blob([header, audioData], { type: 'audio/wav' });
      } else {
        blob = new Blob([audioData], { type: mimeType });
      }
      
      const audioUrl = URL.createObjectURL(blob);

      if (currentRecitationId.current !== recitationId) {
        URL.revokeObjectURL(audioUrl);
        return; // Abort if superseded
      }

      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        
        try {
          const playPromise = playAudioWithSettings(audioRef.current, aiRecitationSettings);
          if (playPromise !== undefined) {
            await playPromise;
            setIsPlaying(true);
            setActiveAyah({ surah: surahNum, ayah: ayahNum });
            fetchTafsir(surahNum, ayahNum);

            // Pre-fetch next ayah
            const nextAyahId = ayahNum + 1;
            const nextAyah = surah.verses.find(v => v.id === nextAyahId);
            if (nextAyah) {
              const nextAudioId = generateAudioId(surahNum, nextAyahId, `ai-${selectedVoice}`);
              getCachedAudio(nextAudioId).then(cached => {
                if (!cached) {
                  generateRecitation(nextAyah.text, selectedVoice, userKey || undefined);
                }
              });
            }
          }
        } catch (playError: any) {
          if (playError.name !== 'AbortError') {
            console.error("Playback failed:", playError);
            setError("فشل تشغيل الصوت. يرجى المحاولة مرة أخرى.");
          }
        }
      }
    } catch (e: any) {
      console.error("AI Recitation error:", e);
      
      const errorMessage = e.message || JSON.stringify(e);
      const isRateLimit = errorMessage && typeof errorMessage === 'string' && (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED'));
      const isInternalError = errorMessage && typeof errorMessage === 'string' && (errorMessage.includes('500') || errorMessage.includes('INTERNAL'));

      // Retry logic for 500 errors or empty responses, but NOT for rate limits
      if (retryCount < 2 && !isRateLimit) {
        console.log(`Retrying AI recitation... Attempt ${retryCount + 1}`);
        scheduledRetry = true;
        setTimeout(() => {
          if (currentRecitationId.current === recitationId) {
            playAIRecitation(surahNum, ayahNum, includeBasmalah, retryCount + 1);
          }
        }, 1000);
        return;
      }

      if (isRateLimit) {
        setError("تم تجاوز حصة الذكاء الاصطناعي. جاري التبديل إلى القارئ الصوتي المدمج في المتصفح...");
        setIsPlaying(true);
        setActiveAyah({ surah: surahNum, ayah: ayahNum });
        fetchTafsir(surahNum, ayahNum);
        speakText(textToRead, playNextAyah);
      } else if (isInternalError) {
        setError("عذراً، خادم الذكاء الاصطناعي مشغول حالياً. يرجى المحاولة بعد قليل.");
      } else {
        setError("عذراً، حدث خطأ أثناء توليد صوت الذكاء الاصطناعي.");
      }
    } finally {
      if (currentRecitationId.current === recitationId && !scheduledRetry) {
        setIsLoading(false);
      }
    }
  };

  const getCachedAudioUrl = async (
    url: string,
    fallbackUrl?: string,
    prefetchOnly: boolean = false,
    localBundledUrl?: string | null
  ): Promise<string> => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const candidateKeys: string[] = [];
      if (localBundledUrl) {
        candidateKeys.push(`${origin}${localBundledUrl}`, localBundledUrl);
      }
      if (url) candidateKeys.push(url);
      if (fallbackUrl) candidateKeys.push(fallbackUrl);

      // 1. Check CacheStorage first (works 100% offline & avoids Range request failures)
      if ('caches' in window) {
        const cacheNames = [OFFLINE_AUDIO_CACHE_NAME, 'mydad-audio-v1'];
        for (const cName of cacheNames) {
          const cache = await caches.open(cName);
          for (const key of candidateKeys) {
            const cachedResponse = await cache.match(key, { ignoreVary: true });
            if (cachedResponse) {
              const validBlob = await extractValidAudioBlob(cachedResponse.clone());
              if (validBlob) {
                if (prefetchOnly) return key;
                return URL.createObjectURL(validBlob);
              } else {
                // Purge corrupt/HTML/XML entry from cache
                await cache.delete(key);
              }
            }
          }
        }
      }

      // 2. If not in CacheStorage yet and local bundled MP3 exists, fetch & cache it into CacheStorage
      if (localBundledUrl) {
        try {
          const localRes = await fetch(localBundledUrl);
          const localBlob = await extractValidAudioBlob(localRes.clone());
          if (localBlob) {
            if ('caches' in window) {
              const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
              const cacheable = new Response(localBlob, {
                status: 200,
                headers: { 'Content-Type': 'audio/mpeg' },
              });
              await cache.put(`${origin}${localBundledUrl}`, cacheable.clone());
              if (url) await cache.put(url, cacheable.clone());
              if (fallbackUrl) await cache.put(fallbackUrl, cacheable.clone());
            }
            if (prefetchOnly) return localBundledUrl;
            return URL.createObjectURL(localBlob);
          }
        } catch {
          // Local bundled fetch failed (e.g. offline & not precached yet)
        }
      }

      // 3. If offline and not in any cache, avoid hanging on network/proxy calls
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return '';
      }

      const cache = 'caches' in window ? await caches.open(OFFLINE_AUDIO_CACHE_NAME) : null;

      const fetchWithRetry = async (targetUrl: string) => {
        let response;
        for (let i = 0; i < 2; i++) {
          try {
            response = await fetch(targetUrl);
            if (response.ok) return response;
          } catch (err) {
            if (i === 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
        if (response && !response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      };

      const sources = [url];
      if (fallbackUrl) sources.push(fallbackUrl);

      const additionalSources: string[] = [];
      for (const s of sources) {
        if (s.includes('everyayah.com')) {
          additionalSources.push(s.replace('everyayah.com', 'mirrors.quranicaudio.com/everyayah'));
          if (s.includes('/English/') || s.includes('/French/') || s.includes('/Russian/') || 
              s.includes('/Urdu/') || s.includes('/Chinese/') || s.includes('/Persian/')) {
            if (s.includes('MultiLanguage/')) {
              additionalSources.push(s.replace('MultiLanguage/', ''));
              additionalSources.push(s.replace('everyayah.com/data/MultiLanguage/', 'mirrors.quranicaudio.com/everyayah/'));
            } else {
              additionalSources.push(s.replace('data/', 'data/MultiLanguage/'));
              additionalSources.push(s.replace('everyayah.com/data/', 'mirrors.quranicaudio.com/everyayah/MultiLanguage/'));
            }
          }
        }
      }
      sources.push(...additionalSources);

      const proxiedSources = sources.map(s => `/api/proxy/audio?url=${encodeURIComponent(s)}`);
      sources.push(...proxiedSources);

      for (const source of sources) {
        try {
          const response = await fetchWithRetry(source);
          if (response) {
            const validBlob = await extractValidAudioBlob(response.clone());
            if (validBlob) {
              try {
                if (cache) {
                  const cacheable = new Response(validBlob, {
                    status: 200,
                    headers: { 'Content-Type': 'audio/mpeg' },
                  });
                  await cache.put(url, cacheable.clone());
                  if (fallbackUrl) await cache.put(fallbackUrl, cacheable.clone());
                }
              } catch (cacheErr) {
                console.warn("Failed to cache audio:", cacheErr);
              }
              if (prefetchOnly) return source;
              return URL.createObjectURL(validBlob);
            }
          }
        } catch (err) {
          console.warn(`Fetch failed for source: ${source}`, err);
          continue;
        }
      }
    } catch (e) {
      console.warn("Audio fetch/cache system failed:", e);
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return '';
    }
    const finalFallback = fallbackUrl || url;
    return `/api/proxy/audio?url=${encodeURIComponent(finalFallback)}`;
  };

  const handleTripleClick = async (surah: any, ayah: any) => {
    try {
      setStatus('جاري توليد وصف لسان حال الآية...');
      
      const prompt = `أنت خبير في علوم القرآن وتدبره. قم بتوليد وصف بليغ ومختصر جداً (لسان حال الآية) يعبر عن جوهر الآية وسياقها في القرآن الكريم. اجعل الوصف مؤثراً وكأنه لسان حال الآية نفسها تخاطب القارئ. لا تزد عن جملتين.
الآية: "${ayah.text}" من ${getSurahDisplayName(surah.name)}.`;

      const response = await callAIWithFailover(provider, [
        { role: 'system', content: 'أنت مساعد ذكي متخصص في البلاغة القرآنية والتدبر العميق.' },
        { role: 'user', content: prompt }
      ]);

      if (response && response.content) {
        const description = response.content.trim();
        
        // Dispatch event to update Image Generator and switch tab
        window.dispatchEvent(new CustomEvent('trigger_image_gen', { detail: { prompt: description } }));
        
        // Open AI Hub automatically
        setShowAIHub(true);
        
        await navigator.clipboard.writeText(description);
        setStatus('تم نقل لسان حال الآية إلى المولد الفني!');
        logAIEvent(`توليد وصف لسان حال الآية ${ayah.id} من ${getSurahDisplayName(surah.name)}`, '✨');
        
        // Auto-clear status after 3 seconds
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (err: any) {
      console.error("Triple click AI error:", err);
      setError('فشل في توليد الوصف التلقائي.');
      setStatus('');
    }
  };

  const playRealRecitation = async (surahNum: number, ayahNum: number = 1, playBasmalah = false) => {
    // Stop any other audio
    window.speechSynthesis.cancel();
    // Dispatch event to stop AI Hub audio
    window.dispatchEvent(new CustomEvent('stop_all_audio'));

    currentRecitationId.current += 1;
    const recitationId = currentRecitationId.current;

    const isForeign = selectedReciter.startsWith('en.') || 
                      selectedReciter.startsWith('fr.') || 
                      selectedReciter.startsWith('ru.') || 
                      selectedReciter.startsWith('ur.') || 
                      selectedReciter.startsWith('zh.') || 
                      selectedReciter.startsWith('fa.');

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (selectedReciter === 'ai.reciter.free') {
      const surah = quranData?.find(s => s.id === surahNum);
      const ayah = surah?.verses.find(v => v.id === ayahNum);
      if (ayah) {
        let textToRead = ayah.text;
        if (playBasmalah && ayahNum === 1 && (surahNum !== 1 || selectedQiraat === 'warsh') && surahNum !== 9) {
          textToRead = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ " + textToRead;
        }
        setIsPlaying(true);
        setActiveAyah({ surah: surahNum, ayah: ayahNum });
        fetchTafsir(surahNum, ayahNum);
        speakText(textToRead, playNextAyah);
      }
      return;
    }

    if (selectedReciter === 'ai.reciter.pro') {
      await playAIRecitation(surahNum, ayahNum, playBasmalah);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const bitrate = getReciterBitrate(selectedReciter);
      if (playBasmalah && ayahNum === 1 && (surahNum !== 1 || selectedQiraat === 'warsh') && surahNum !== 9) {
        let basmalahUrl = `https://cdn.islamic.network/quran/audio/${bitrate}/${selectedReciter}/1.mp3`;
        let basmalahFallback = '';
        const folder = getReciterFolder(selectedReciter);
        if (folder) {
          basmalahFallback = `https://everyayah.com/data/${folder}/001001.mp3`;
        }

        if (isForeign && basmalahFallback) {
          const temp = basmalahUrl;
          basmalahUrl = basmalahFallback;
          basmalahFallback = temp;
        }

        const localBasmalah = selectedReciter === 'ar.alafasy' ? getBundledOfflineAudioUrl(1, 1) : null;

        if (audioRef.current) {
          audioRef.current.pause();
          if (audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src);
            audioRef.current.removeAttribute('src');
          }
          let finalUrl = await getCachedAudioUrl(basmalahUrl, basmalahFallback, false, localBasmalah);
          if (!finalUrl && typeof navigator !== 'undefined' && !navigator.onLine) {
            for (const offReciter of OFFLINE_RECITERS) {
              if (offReciter.id === selectedReciter) continue;
              const altBundled = offReciter.id === 'ar.alafasy' ? getBundledOfflineAudioUrl(1, 1) : null;
              const altUrls = getCanonicalAudioUrls(offReciter.id, 1, 1);
              finalUrl = await getCachedAudioUrl(altUrls.primaryUrl, altUrls.everyAyahUrl, false, altBundled);
              if (finalUrl) break;
            }
          }
          if (recitationId !== currentRecitationId.current) {
            if (finalUrl.startsWith('blob:')) URL.revokeObjectURL(finalUrl);
            return;
          }
          if (!finalUrl) {
            playRealRecitation(surahNum, ayahNum, false);
            return;
          }
          audioRef.current.src = finalUrl;
          
          // Add error listener for Basmalah
          audioRef.current.onerror = () => {
            if (!audioRef.current) return;
            const currentSrc = audioRef.current.src;
            let nextSrc = '';
            
            if (navigator.onLine) {
              if (currentSrc !== basmalahFallback && basmalahFallback) {
                nextSrc = basmalahFallback;
              } else if (currentSrc.includes('everyayah.com')) {
                nextSrc = currentSrc.replace('everyayah.com', 'mirrors.quranicaudio.com/everyayah');
              }
            }
            
            if (nextSrc && nextSrc !== currentSrc) {
              console.warn(`Basmalah source failed (${currentSrc}), trying next: ${nextSrc}`);
              audioRef.current.src = nextSrc;
              audioRef.current.load();
              audioRef.current.play().catch(() => {
                playRealRecitation(surahNum, ayahNum, false);
              });
            } else {
              playRealRecitation(surahNum, ayahNum, false);
            }
          };

          audioRef.current.load();
          try {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              await playPromise;
              setIsPlaying(true);
              setActiveAyah({ surah: surahNum, ayah: 0, targetAyah: ayahNum }); // 0 represents Basmalah, store target
            }
          } catch (playError: any) {
            if (playError.name !== 'AbortError') {
              console.error("Basmalah play error:", playError);
              playRealRecitation(surahNum, ayahNum, false);
            }
          }
        }
        return;
      }

      const globalAyah = getGlobalAyahNumber(surahNum, ayahNum);
      let audioUrl = `https://cdn.islamic.network/quran/audio/${bitrate}/${selectedReciter}/${globalAyah}.mp3`;
      
      // Construct fallback URL for common reciters
      let fallbackUrl = '';
      const surahPadded = String(surahNum).padStart(3, '0');
      const ayahPadded = String(ayahNum).padStart(3, '0');
      const folder = getReciterFolder(selectedReciter);
      if (folder) {
        fallbackUrl = `https://everyayah.com/data/${folder}/${surahPadded}${ayahPadded}.mp3`;
      }

      // For foreign reciters (translations), prefer everyayah.com as it's more reliable for these
      if (isForeign && fallbackUrl) {
        const temp = audioUrl;
        audioUrl = fallbackUrl;
        fallbackUrl = temp;
      }

      if (!audioUrl || (audioUrl && typeof audioUrl === 'string' && audioUrl.includes('undefined'))) {
        console.warn("Invalid audio URL:", audioUrl);
        setError("عذراً، لا يتوفر ملف صوتي لهذا القارئ.");
        setIsLoading(false);
        return;
      }

      const directBundledUrl = selectedReciter === 'ar.alafasy' ? getBundledOfflineAudioUrl(surahNum, ayahNum) : null;

      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
          audioRef.current.removeAttribute('src');
        }
        let finalUrl = await getCachedAudioUrl(audioUrl, fallbackUrl, false, directBundledUrl);

        // If offline and current reciter isn't cached, fall back to any downloaded offline reciter (or bundled Alafasy) in CacheStorage
        if (!finalUrl && typeof navigator !== 'undefined' && !navigator.onLine) {
          for (const offReciter of OFFLINE_RECITERS) {
            if (offReciter.id === selectedReciter) continue;
            const altBundled = offReciter.id === 'ar.alafasy' ? getBundledOfflineAudioUrl(surahNum, ayahNum) : null;
            const altUrls = getCanonicalAudioUrls(offReciter.id, surahNum, ayahNum);
            finalUrl = await getCachedAudioUrl(altUrls.primaryUrl, altUrls.everyAyahUrl, false, altBundled);
            if (finalUrl) break;
          }
        }

        if (recitationId !== currentRecitationId.current) {
          if (finalUrl.startsWith('blob:')) URL.revokeObjectURL(finalUrl);
          return;
        }

        if (!finalUrl) {
          setError("هذه الآية غير محملة بعد للعمل بدون إنترنت. افتح «التلاوة بدون إنترنت» لتحميل السورة أو القرآن كاملاً، أو اختر القارئ الآلي المحلي.");
          setIsLoading(false);
          setIsPlaying(false);
          return;
        }

        audioRef.current.src = finalUrl;
        
        // Add error listener for debugging and fallback
        audioRef.current.onerror = () => {
          if (!audioRef.current) return;
          
          const currentSrc = audioRef.current.src;
          let nextSrc = '';
          
          if (navigator.onLine) {
            if (currentSrc !== fallbackUrl && fallbackUrl) {
              nextSrc = fallbackUrl;
            } else if (currentSrc.includes('everyayah.com')) {
              nextSrc = currentSrc.replace('everyayah.com', 'mirrors.quranicaudio.com/everyayah');
            }
          }
          
          if (nextSrc && nextSrc !== currentSrc) {
            console.warn(`Audio source failed (${currentSrc}), trying next source: ${nextSrc}`);
            audioRef.current.src = nextSrc;
            audioRef.current.load();
            audioRef.current.play().catch(err => {
              if (err.name !== 'AbortError') {
                console.warn("Next audio source also failed:", err);
                setError("تعذر تشغيل الصوت من جميع المصادر. يرجى التحقق من الاتصال.");
                setIsLoading(false);
              }
            });
          } else {
            console.warn("All audio sources failed (Real Recitation)");
            setError(
              navigator.onLine
                ? "تعذر تشغيل الصوت. يرجى التأكد من اتصال الإنترنت."
                : "هذه الآية غير محملة للعمل بدون إنترنت. يمكنك تحميل السورة من إدارة التلاوة بدون إنترنت."
            );
            setIsLoading(false);
          }
        };

        audioRef.current.load();
        try {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
            setIsPlaying(true);
            setActiveAyah({ surah: surahNum, ayah: ayahNum });
            fetchTafsir(surahNum, ayahNum);

            // Pre-fetch next ayah when online
            if (typeof navigator === 'undefined' || navigator.onLine) {
              const surah = quranData?.find(s => s.id === surahNum);
              const nextAyahId = ayahNum + 1;
              const nextAyah = surah?.verses.find(v => v.id === nextAyahId);
              if (nextAyah) {
                const nextLocalBundled = selectedReciter === 'ar.alafasy' ? getBundledOfflineAudioUrl(surahNum, nextAyahId) : null;
                if (!nextLocalBundled) {
                  const bitrate = getReciterBitrate(selectedReciter);
                  const globalNextAyah = getGlobalAyahNumber(surahNum, nextAyahId);
                  let nextAudioUrl = `https://cdn.islamic.network/quran/audio/${bitrate}/${selectedReciter}/${globalNextAyah}.mp3`;
                  let nextFallback = '';
                  const folder = getReciterFolder(selectedReciter);
                  if (folder) {
                    const sp = String(surahNum).padStart(3, '0');
                    const ap = String(nextAyahId).padStart(3, '0');
                    nextFallback = `https://everyayah.com/data/${folder}/${sp}${ap}.mp3`;
                  }

                  if (isForeign && nextFallback) {
                    const temp = nextAudioUrl;
                    nextAudioUrl = nextFallback;
                    nextFallback = temp;
                  }

                  getCachedAudioUrl(nextAudioUrl, nextFallback, true);
                }
              }
            }
          }
        } catch (playError: any) {
          if (playError.name !== 'AbortError') {
            console.warn("Play interrupted (Real Recitation):", playError);
            setError("تعذر تشغيل التلاوة. يرجى المحاولة مرة أخرى.");
          }
        }
      } else {
        setError("مشغل الصوت غير متوفر حالياً.");
      }
    } catch (e) {
      console.warn("Playback error (Real Recitation):", e);
      setError("عذراً، لم نتمكن من تشغيل التلاوة.");
    } finally {
      if (currentRecitationId.current === recitationId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const handleStopAll = () => {
      stopRecitation();
    };
    window.addEventListener('stop_all_audio', handleStopAll);
    return () => window.removeEventListener('stop_all_audio', handleStopAll);
  }, []);

  const stopRecitation = () => {
    currentRecitationId.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPlaying(false);
    setActiveAyah(null);
    setAudioProgress(0);
    setIsLoading(false);
  };

  useEffect(() => {
    const handleSleepStop = () => {
      stopRecitation();
    };
    window.addEventListener('sleep_timer_triggered', handleSleepStop);
    return () => window.removeEventListener('sleep_timer_triggered', handleSleepStop);
  }, []);

  const togglePlayPause = () => {
    if (isLoading) return;

    if (isSpeaking || window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsSpeaking(true);
        setIsPlaying(true);
      } else {
        window.speechSynthesis.pause();
        setIsSpeaking(false);
        setIsPlaying(false);
      }
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Play error:", e);
            setError("تعذر تشغيل الصوت.");
          }
        });
      }
    }
  };

  const startVoiceInput = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        recognitionRef.current?.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    // Try Web Speech API first
    if (SpeechRecognition && recognitionRef.current !== null) {
      try {
        if (!recognitionRef.current) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.lang = 'ar-SA';
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          
          let currentFinalTranscript = searchText;
          
          recognitionRef.current.onstart = () => {
            setIsListening(true);
            setError('');
          };
          
          recognitionRef.current.onend = () => {
            setIsListening(false);
          };
          
          recognitionRef.current.onerror = (e: any) => {
            console.warn("Speech recognition error:", e.error);
            if (e.error === 'network') {
              setError('تعذر الاتصال بخدمة التعرف على الصوت (خطأ في الشبكة). يرجى المحاولة مرة أخرى لاستخدام البديل.');
              recognitionRef.current = null; // Disable Web Speech API so next click uses MediaRecorder
            } else if (e.error !== 'no-speech') {
              setError('حدث خطأ أثناء التعرف على الصوت: ' + e.error);
            }
            setIsListening(false);
          };

          recognitionRef.current.onresult = (e: any) => {
            let interimTranscript = '';
            let newFinal = '';
            
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              if (e.results[i].isFinal) {
                newFinal += e.results[i][0].transcript;
              } else {
                interimTranscript += e.results[i][0].transcript;
              }
            }
            
            if (newFinal) {
              currentFinalTranscript += (currentFinalTranscript ? ' ' : '') + newFinal;
            }
            
            setSearchText(currentFinalTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
          };
        }
        
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn("Failed to start speech recognition, falling back to MediaRecorder", err);
      }
    }

    // Fallback to MediaRecorder + Gemini
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1];
          try {
            setIsProcessingAudio(true);
            const apiKey = safeLocalStorageGet('gemini_api_key') || undefined;
            const transcript = await transcribeAudio(base64Audio, 'audio/webm', apiKey);
            setSearchText(prev => prev + (prev ? ' ' : '') + transcript);
          } catch (error) {
            console.error("Transcription failed:", error);
            setError('فشل التعرف على الصوت عبر الذكاء الاصطناعي.');
          } finally {
            setIsProcessingAudio(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setError('');
    } catch (error) {
      console.warn("Error accessing microphone:", error);
      setError('تعذر الوصول إلى الميكروفون. يرجى التحقق من الصلاحيات.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() && searchText.trim() !== lastSearchedText && !isLoading && viewMode === 'search') {
        handleSearchAndCorrect();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchText, lastSearchedText, isLoading, viewMode]);

  useEffect(() => {
    setIsExpanded(false);
  }, [viewMode]);

  const handleSearchAndCorrect = async (query?: string) => {
    const textToSearch = query || searchText;
    if (!textToSearch.trim() || (textToSearch.trim() === lastSearchedText && !query)) return;
    setIsLoading(true);
    setError('');
    if (!query) setLastSearchedText(textToSearch.trim());
    logAIEvent(`بحث عن: ${textToSearch.trim()}`, '🔍', 'search');

    try {
      const prompt = `أنت خبير في القرآن الكريم وعلوم اللغة العربية. 
إذا كان الإدخال اسم سورة، أعد بياناتها.
إذا كان آية أو جزء من آية، صححها وأكملها بالتشكيل الصحيح.
إذا لم يكن نصاً قرآنياً، صححه لغوياً.

يجب أن يكون الرد بتنسيق JSON فقط كالتالي:
{
  "corrected": "النص المصحح بالتشكيل",
  "isQuran": true/false,
  "surahId": رقم السورة (إن وجد كعدد),
  "ayahId": رقم الآية (إن وجد كعدد),
  "explanation": "تفسير ميسر ومختصر جداً للنص",
  "qiraatDifferences": "ذكر أهم الاختلافات في القراءات العشر لهذه الآية إن وجدت باختصار",
  "metadata": {
    "surahName": "اسم السورة",
    "juz": رقم الجزء,
    "hizb": رقم الحزب,
    "asbab": "سبب النزول باختصار",
    "words": عدد الكلمات,
    "chars": عدد الحروف,
    "revelationType": "مكية / مدنية",
    "verseCount": عدد آيات السورة,
    "order": ترتيب السورة
  },
  "error": "رسالة خطأ في حال كان الإدخال غير واضح أو ناقص (مثل ذكر كلمة سورة دون اسم)"
}

الإدخال: ${textToSearch}`;
      
      const aiResponse = await callAI(provider, [{ role: 'user', content: prompt }], undefined, { responseMimeType: 'application/json' });
      const responseText = aiResponse.content;
      
      const fallbackResult = { corrected: responseText, isQuran: false, explanation: "", metadata: {}, error: undefined };
      let aiResult = parseAIJson<any>(responseText, null);
      
      if (!aiResult) {
        // Fallback for non-JSON responses
        if (responseText && typeof responseText === 'string' && responseText.includes("سورة") && responseText.length < 200) {
          setError(responseText);
          setIsLoading(false);
          return;
        }
        aiResult = fallbackResult;
      }
      
      if (aiResult.error && !aiResult.corrected) {
        setError(aiResult.error);
        setIsLoading(false);
        return;
      }

      if (quranData) {
        const stripTashkeel = (str: string) => str.replace(/[\u0617-\u061A\u064B-\u0652]/g, '').replace(/[^\u0600-\u06FF]/g, '').trim();
        
        let foundSurah = aiResult.surahId ? Number(aiResult.surahId) : null;
        let foundAyah = aiResult.ayahId ? Number(aiResult.ayahId) : null;
        let isFullSurah = (aiResult.isQuran || !!foundSurah) && !foundAyah && foundSurah;

        if (!foundSurah || !foundAyah) {
          const cleanCorrected = stripTashkeel(aiResult.corrected);
          if (cleanCorrected.length > 5) {
            for (const s of quranData) {
              for (const v of s.verses) {
                const cleanVerse = stripTashkeel(v.text);
                if ((cleanCorrected && typeof cleanCorrected === 'string' && cleanCorrected.includes(cleanVerse)) || (cleanVerse && typeof cleanVerse === 'string' && cleanVerse.includes(cleanCorrected))) {
                  foundSurah = Number(s.id);
                  foundAyah = Number(v.id);
                  break;
                }
              }
              if (foundSurah) break;
            }
          }
        }

        if (isFullSurah && foundSurah) {
          const s = quranData.find(s => Number(s.id) === foundSurah);
          const metadata = calculateMetadata(s.verses);
          setSearchResult({ type: 'surah', data: s, explanation: aiResult.explanation, qiraatDifferences: aiResult.qiraatDifferences, metadata: { ...aiResult.metadata, ...metadata } });
          playbackModeRef.current = 'continuous';
          playRealRecitation(foundSurah, 1, true);
        } else if (foundSurah && foundAyah) {
          const s = quranData.find(s => Number(s.id) === foundSurah);
          const v = s?.verses.find(v => Number(v.id) === foundAyah);
          
          let contextVerses: any[] = [];
          if (v && s) {
            const wordCount = v.text.split(/\s+/).length;
            if (wordCount < 7) {
              const ayahIndex = s.verses.findIndex(verse => verse.id === v.id);
              if (ayahIndex !== -1) {
                if (ayahIndex > 0) contextVerses.push(s.verses[ayahIndex - 1]);
                contextVerses.push(v);
                if (ayahIndex < s.verses.length - 1) contextVerses.push(s.verses[ayahIndex + 1]);
              }
            }
          }
          
          // Fetch translation for this specific ayah
          const translation = await fetchAyahTranslation(foundSurah, foundAyah);
          const metadata = v ? calculateMetadata([v]) : { words: 0, letters: 0, harakaat: 0 };
          
          setSearchResult({ 
            type: 'ayah', 
            data: { surah: s, ayah: v }, 
            contextVerses: contextVerses.length > 0 ? contextVerses : undefined,
            explanation: aiResult.explanation, 
            qiraatDifferences: aiResult.qiraatDifferences,
            metadata: { ...aiResult.metadata, ...metadata, translation } 
          });
          playbackModeRef.current = 'single';
          playRealRecitation(foundSurah, foundAyah, false);
        } else {
          setSearchResult({ type: 'text', text: aiResult.corrected, explanation: aiResult.explanation, qiraatDifferences: aiResult.qiraatDifferences, metadata: aiResult.metadata });
        }
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء المعالجة بالذكاء الاصطناعي.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClick = () => setAyahContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleTafsirSelect = async (tafsirId: string, surahId: number, ayahId: number) => {
    const surah = quranData?.find(s => s.id === surahId);
    const ayah = surah?.verses.find(v => v.id === ayahId);
    const surahName = surah?.name || surahId;
    const ayahText = ayah?.text || '';

    setSelectedTafsir(tafsirId);
    
    // Set context for AI Hub
    setAIContext({
      surah: surahName.toString(),
      ayah: ayahId,
      text: ayahText,
      tafsirRequest: tafsirId, // New field to trigger AI Hub
      timestamp: Date.now()
    });

    setShowAIHub(true);
    setAyahContextMenu(null);
    
    // We still fetch it if it's not AI, checking offline Tafsir Al-Muyassar first
    if (tafsirId !== 'ai.explanation') {
      if (tafsirId === 'ar.muyassar') {
        const localText = await getLocalTafsir(surahId, ayahId);
        if (localText) {
          setAIContext(prev => ({
            ...prev!,
            tafsir: localText,
            timestamp: Date.now()
          }));
          return;
        }
      }
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surahId}:${ayahId}/${tafsirId}`);
        const data = await res.json();
        if (data.code === 200) {
          setAIContext(prev => ({
            ...prev!,
            tafsir: data.data.text,
            timestamp: Date.now()
          }));
        }
      } catch (e) {
        const localFallback = await getLocalTafsir(surahId, ayahId);
        if (localFallback) {
          setAIContext(prev => ({
            ...prev!,
            tafsir: localFallback,
            timestamp: Date.now()
          }));
        } else {
          console.error("Error fetching tafsir:", e);
        }
      }
    }
  };

  const toggleThemeMode = () => {
    toggleTheme();
  };

  const filteredSurahs = useMemo(() => {
    if (!quranData) return [];
    return quranData.filter(s => 
      (s.name && typeof s.name === 'string' && s.name.includes(surahSearch)) || 
      (s.id && typeof s.id === 'number' && s.id.toString().includes(surahSearch))
    );
  }, [quranData, surahSearch]);

  // --- Render ---

  const handleAIAction = (action: string, data?: any) => {
    console.log(`AI Action Triggered: ${action}`, data);
    
    switch (action) {
      case 'BROWSE_SURAH':
        const surah = quranData?.find(s => s.id === parseInt(data) || (s.name && typeof s.name === 'string' && s.name.includes(data)));
        if (surah) {
          handleSurahSelect(surah);
          setShowAIHub(false);
          setShowMidadAlRahman(false);
        }
        break;
      case 'SEARCH':
        setSearchText(data);
        handleSearchAndCorrect(data);
        setViewMode('search');
        setShowAIHub(false);
        setShowMidadAlRahman(false);
        break;
      case 'VIEW':
        if (data && typeof data === 'string' && ['bookmarks', 'qibla', 'tasbih', 'calendar', 'duas', 'image_generator', 'midad', 'ai-chat', 'search'].includes(data)) {
          if (data === 'midad') {
            setShowMidadAlRahman(true);
            setShowAIHub(false);
          } else {
            setViewMode(data as ViewMode);
            setShowAIHub(false);
            setShowMidadAlRahman(false);
          }
        } else if (data === 'settings') {
          setShowAIHub(true);
        }
        break;
      case 'PLAY':
        if (data && typeof data === 'string' && data.includes(':')) {
          const [sNum, aNum] = data.split(':');
          playRealRecitation(parseInt(sNum), parseInt(aNum));
        } else if (data) {
          playRealRecitation(parseInt(data), 1);
        }
        break;
      case 'STOP':
        stopRecitation();
        break;
      case 'SET_RECITER':
        setSelectedReciter(data);
        logAIEvent(`تغيير القارئ إلى ${data}`, '🎙️', 'settings');
        break;
      case 'SET_QIRAAT':
        setSelectedQiraat(data);
        logAIEvent(`تغيير الرواية إلى ${data}`, '📖', 'settings');
        break;
      case 'TOGGLE_TAJWEED':
        setIsTajweed(!isTajweed);
        logAIEvent(`تبديل التجويد الملون`, '🎨', 'settings');
        break;
      case 'SET_FONT_SIZE':
        const size = parseInt(data);
        if (!isNaN(size)) setFontSize(size);
        break;
      case 'GENERATE_IMAGE':
        setViewMode('image_generator');
        setShowAIHub(false);
        setShowMidadAlRahman(false);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('trigger_image_gen', { detail: { prompt: data } }));
        }, 500);
        break;
    }
  };

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider);
    setApiKeyInput(safeLocalStorageGet(AI_PROVIDERS[newProvider].keyName) || '');
  };

  const handleApiKeyChange = (newKey: string) => {
    const trimmedKey = newKey.trim();
    setApiKeyInput(trimmedKey);
    safeLocalStorageSet(AI_PROVIDERS[provider].keyName, trimmedKey);
  };

  return (
    <ErrorBoundary>
      <>
          <Suspense fallback={null}>
            <SpiritualVision 
              text={visionText} 
              onClose={() => setVisionText(null)} 
            />
          </Suspense>
          <Suspense fallback={null}>
            <TypecastModal 
              isOpen={isTypecastOpen} 
              onClose={() => setIsTypecastOpen(false)} 
              text={typecastText} 
            />
          </Suspense>
      {!isUnlocked ? (
        <WelcomeDuaGate onUnlock={() => {
          setIsUnlocked(true);
          safeLocalStorageSet('quran_app_unlocked_v2', 'true');
        }} />
      ) : !quranData && isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdf8ee] dark:bg-[#0c0a09]">
          <Loader2 className="w-10 h-10 animate-spin text-amber-600 mb-4" />
          <p className="text-amber-900 dark:text-amber-100 font-bold text-xl animate-pulse">جاري تحميل المصحف الشريف...</p>
        </div>
      ) : (
      <div className={`min-h-screen-dynamic transition-colors duration-700 font-vazir relative overflow-x-hidden islamic-pattern ${themeMode === 'dark' ? 'dark bg-[#0c0a09]' : 'bg-[#fdf8ee] noor-mode'}`} style={{ fontSize: `${fontSize}px` }} dir="rtl">
        {/* Offline indicator for PWA */}
        <OfflineIndicator />
        {/* Floating Sleep Timer Countdown Widget */}
        <SleepTimerWidget />

        {/* Decorative Background Elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 blur-[120px] rounded-full animate-float" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/5 blur-[120px] rounded-full animate-float" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className={`relative z-10 ${viewMode === 'ai-chat' ? 'max-w-7xl h-screen-dynamic flex flex-col' : 'max-w-5xl'} mx-auto p-4 md:p-8 pb-32 transition-all duration-500`}>
        {/* Decorative Corner Ornaments */}
        {viewMode !== 'ai-chat' && (
          <>
            <div className="absolute top-0 left-0 w-24 h-24 border-t-4 border-l-4 border-amber-600/30 rounded-tl-3xl pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-24 h-24 border-t-4 border-r-4 border-amber-600/30 rounded-tr-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 border-b-4 border-l-4 border-amber-600/30 rounded-bl-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 border-b-4 border-r-4 border-amber-600/30 rounded-br-3xl pointer-events-none"></div>
          </>
        )}
        
        {/* Header */}
        <header className={`text-center relative transition-all duration-500 ${viewMode === 'ai-chat' ? 'mb-4 pt-4' : 'mb-16'}`}>
          {viewMode !== 'ai-chat' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="inline-block mb-6 pt-16"
            >
              <div className="flex justify-center mb-6">
                <Octagram />
              </div>
            </motion.div>
          )}
        </header>

          {viewMode !== 'ai-chat' && (
            <>
              <div className="text-center">
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.2 }} 
                  className="text-6xl md:text-8xl font-black text-amber-900 dark:text-amber-100 mb-4 tracking-tighter"
                >
                  <QuranVerse />
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: 0.4 }} 
                  className="text-2xl md:text-3xl text-amber-800 dark:text-amber-400 font-quran italic"
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </motion.p>
              </div>

              <div className="mt-10 space-y-6">
                <HijriClock />
                <div className="flex gap-3 justify-center">
                  <CommandActionButton onClick={() => openAIHubWithCommand('/')} />
                  <button 
                    onClick={() => setShowUserGuide(true)} 
                    className="p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all active:scale-95"
                    title="دليل المستخدم"
                  >
                    <BookOpen size={22} />
                  </button>
                  <button 
                    onClick={() => {
                      const randomVision = [
                        "رؤية روحية: الصبر مفتاح الفرج، والتوكل على الله هو قمة الإيمان.",
                        "تأمل: القرآن ربيع القلوب، ونور الصدور، وجلاء الأحزان.",
                        "نصيحة: اجعل لك خبيئة من عمل صالح لا يعلمها إلا الله.",
                        "إلهام: من وجد الله فماذا فقد؟ ومن فقد الله فماذا وجد؟",
                        "تذكير: سبحان الله وبحمده، سبحان الله العظيم."
                      ];
                      setVisionText(randomVision[Math.floor(Math.random() * randomVision.length)]);
                    }} 
                    className="p-3.5 rounded-2xl bg-sky-100 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800/40 transition-all active:scale-95"
                    title="رؤية روحية"
                  >
                    <Sparkles size={22} />
                  </button>
                  <button 
                    onClick={() => setShowSettings(!showSettings)} 
                    className="p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all active:scale-95"
                    title="الإعدادات"
                  >
                    <Settings2 size={22} />
                  </button>
                  <button 
                    onClick={toggleThemeMode} 
                    className="p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all active:scale-95"
                    title={
                      themeMode === 'dark' ? "الوضع الليلي" : 
                      themeMode === 'light' ? "الوضع النهاري" : 
                      "تلقائي (حسب النظام)"
                    }
                  >
                    {themeMode === 'dark' ? <Moon size={22} /> : 
                     themeMode === 'light' ? <Sun size={22} /> : 
                     <Monitor size={22} />}
                  </button>
                  <button
                    onClick={() => setShowOfflineModal(true)}
                    className="p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-all active:scale-95"
                    title="التحميل والعمل بدون إنترنت"
                  >
                    <WifiOff size={22} />
                  </button>
                  <PWAInstallButton variant="compact" />
                </div>
                <PWAInstallButton variant="banner" className="my-3" />
                <PrayerTimesCard />
                <DailyInspiration quranData={quranData} />
              </div>
            </>
          )}

        {/* Main Navigation Bar */}
        <div className={`sticky top-2 md:top-4 z-50 w-full max-w-5xl mx-auto mb-8 px-4 transition-all duration-500 ${viewMode === 'ai-chat' ? 'opacity-80 hover:opacity-100' : ''}`}>
          <div className="flex overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:justify-center">
            <div className="flex gap-2 md:gap-3 bg-white/80 dark:bg-[#1c1917]/80 p-2 rounded-3xl border border-amber-200/50 dark:border-amber-800/30 backdrop-blur-xl shadow-lg min-w-max">
              
              <button 
                onClick={() => { setViewMode('search'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'search' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <Search size={18} />
                <span>البحث</span>
              </button>

              <button 
                onClick={() => { setViewMode('browse'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'browse' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <BookOpen size={18} />
                <span>المصحف</span>
              </button>

              <button 
                onClick={() => setShowMidadAlRahman(true)} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${showMidadAlRahman ? 'bg-gradient-to-r from-amber-700 to-amber-900 text-white shadow-md shadow-amber-900/30 scale-105' : 'text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-800/40'}`}
              >
                <PenTool size={18} />
                <span>مداد الرحمن</span>
              </button>

              <button 
                onClick={() => { setViewMode('ai-chat'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'ai-chat' && !showMidadAlRahman ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20 scale-105' : 'text-sky-700 dark:text-sky-300 hover:bg-sky-200/50 dark:hover:bg-sky-800/40'}`}
              >
                <Sparkles size={18} className={viewMode === 'ai-chat' && !showMidadAlRahman ? 'animate-pulse' : ''} />
                <span>المساعد</span>
              </button>

              <div className="w-px h-8 bg-amber-300/50 dark:bg-amber-700/50 self-center mx-1"></div>

              <button 
                onClick={() => { setViewMode('duas'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'duas' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <Heart size={18} />
                <span>الأدعية</span>
              </button>

              <button 
                onClick={() => { setViewMode('qibla'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'qibla' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <Compass size={18} />
                <span>القبلة</span>
              </button>

              <button 
                onClick={() => { setViewMode('tasbih'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'tasbih' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <Hash size={18} />
                <span>السبحة</span>
              </button>

              <button 
                onClick={() => { setViewMode('bookmarks'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'bookmarks' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <Bookmark size={18} />
                <span>المحفوظات</span>
              </button>

              <button 
                onClick={() => { setViewMode('calendar'); setShowMidadAlRahman(false); }} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'calendar' && !showMidadAlRahman ? 'bg-amber-700 text-white shadow-md shadow-amber-900/20 scale-105' : 'text-amber-900/80 dark:text-amber-100/80 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 hover:text-amber-950 dark:hover:text-amber-50'}`}
              >
                <Calendar size={18} />
                <span>اليومية</span>
              </button>

            </div>
          </div>
        </div>

        <main className="space-y-10">
          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <SettingsPanel
                show={showSettings}
                onClose={() => setShowSettings(false)}
                provider={provider}
                apiKeyInput={apiKeyInput}
                selectedTranslation={selectedTranslation}
                selectedQiraat={selectedQiraat}
                fontSize={fontSize}
                fontFamily={fontFamily}
                onProviderChange={handleProviderChange}
                onApiKeyChange={handleApiKeyChange}
                onTranslationChange={setSelectedTranslation}
                onQiraatChange={setSelectedQiraat}
                onFontSizeChange={setFontSize}
                onFontFamilyChange={setFontFamily}
                selectedVoice={selectedVoice}
                onVoiceChange={setSelectedVoice}
                ttsModel={ttsModel}
                onTtsModelChange={setTtsModel}
                aiRecitationSettings={aiRecitationSettings}
                onAiRecitationSettingsChange={setAiRecitationSettings}
                humanRecitationSettings={humanRecitationSettings}
                onHumanRecitationSettingsChange={setHumanRecitationSettings}
                onResetApp={() => {
                  safeLocalStorageRemove('quran_app_unlocked_v2');
                  safeLocalStorageRemove('app_unlocked');
                  setIsUnlocked(false);
                  setShowSettings(false);
                }}
                onRefreshModels={async () => {
                  await fetchAllProvidersModels(true);
                }}
                quranData={quranData}
                selectedReciter={selectedReciter}
                onReciterChange={setSelectedReciter}
              />
            )}
          </AnimatePresence>

          {/* Offline Download Manager Modal */}
          {showOfflineModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowOfflineModal(false)}
              dir="rtl"
            >
              <div
                className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-[2rem] bg-[#fdf8ee] dark:bg-[#14110f] p-4 sm:p-6 shadow-2xl border border-amber-500/30 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowOfflineModal(false)}
                  className="absolute top-4 left-4 p-2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:scale-105 transition z-10"
                  title="إغلاق"
                >
                  <X size={18} />
                </button>
                <OfflineDownloadManager
                  quranData={quranData}
                  activeReciter={selectedReciter}
                  onSelectReciter={setSelectedReciter}
                />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {viewMode === 'search' ? (
              <motion.div key="search" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                {/* Recent Surahs */}
                {recentSurahs.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-3">آخر ما قرأت</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {recentSurahs.map(surahId => {
                        const surah = quranData?.find(s => s.id === surahId);
                        return surah ? (
                          <button
                            key={surahId}
                            onClick={() => handleSurahSelect(surah)}
                            className="px-4 py-2 bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 rounded-full whitespace-nowrap text-sm font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                          >
                            {surah.name}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Search Input */}
                <div className="relative group" role="search">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-amber-800 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative bg-white dark:bg-[#1c1917] rounded-[2.5rem] shadow-2xl overflow-hidden border border-amber-200 dark:border-amber-900/50">
                    <label htmlFor="quran-search-input" className="sr-only">البحث في القرآن الكريم</label>
                    <textarea
                      ref={searchInputRef}
                      id="quran-search-input"
                      value={searchText}
                      onChange={handleTextChange}
                      onKeyDown={handleKeyDown}
                      placeholder="ابحث في آيات الذكر الحكيم... اكتب آيةً كريمة، أو طرفاً منها، أو اسم السورة للبحث والتدبر (Ctrl+K)"
                      aria-label="خانة البحث في القرآن الكريم"
                      className="w-full h-48 p-8 text-3xl text-right bg-transparent border-none focus:ring-0 resize-none font-quran leading-relaxed text-black dark:text-[#f5f5f4] placeholder:text-amber-900/80 dark:placeholder:text-amber-100/40"
                      dir="rtl"
                      lang="ar"
                      aria-autocomplete="list"
                      aria-controls="search-suggestions"
                      aria-expanded={suggestions.length > 0}
                      aria-haspopup="listbox"
                      aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
                    />
                    
                    {suggestions.length > 0 && (
                      <ul 
                        id="search-suggestions"
                        className="absolute z-10 w-full bg-white dark:bg-[#292524] border-t border-amber-100 dark:border-amber-900 shadow-lg max-h-60 overflow-auto" 
                        dir="rtl" 
                        role="listbox"
                        aria-label="اقتراحات البحث"
                      >
                        {suggestions.map((sug, i) => (
                          <li
                            key={i}
                            id={`suggestion-${i}`}
                            role="option"
                            aria-selected={i === activeSuggestionIndex}
                            className={`p-4 text-2xl font-quran cursor-pointer text-amber-900 dark:text-amber-100 transition-colors ${i === activeSuggestionIndex ? 'bg-amber-200 dark:bg-amber-800' : 'hover:bg-amber-100 dark:hover:bg-amber-900'}`}
                            onClick={() => {
                              setSearchText(sug);
                              setSuggestions([]);
                              setActiveSuggestionIndex(-1);
                            }}
                          >
                            {sug}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
                      <div className="flex gap-3 w-full sm:w-auto justify-center sm:justify-start order-2 sm:order-1">
                        <button 
                          onClick={startVoiceInput} 
                          disabled={isProcessingAudio}
                          aria-label={isProcessingAudio ? 'جاري معالجة الصوت...' : isListening ? 'إيقاف الاستماع' : 'تحدث بالصوت'}
                          className={`p-4 rounded-2xl transition-all ${isProcessingAudio ? 'bg-amber-200 text-amber-500 cursor-wait' : isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-300 hover:bg-amber-200 shadow-sm'}`}
                          title={isProcessingAudio ? 'جاري معالجة الصوت...' : isListening ? 'إيقاف الاستماع' : 'تحدث بالصوت'}
                        >
                          {isProcessingAudio ? <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div> : <Mic size={28} />}
                        </button>
                        <button 
                          onClick={() => { setSearchText(''); setSuggestions([]); }} 
                          aria-label="مسح النص"
                          className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-300 hover:bg-amber-200 transition-all shadow-sm"
                        >
                          <Square size={24} />
                        </button>
                      </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-center w-full sm:w-auto order-1 sm:order-2">
                          <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <label htmlFor="reciter-select" className="text-xs text-amber-950/70 mr-2">القارئ</label>
                            <select 
                              id="reciter-select"
                              value={selectedReciter} 
                              onChange={(e) => setSelectedReciter(e.target.value)} 
                              className="w-full sm:w-auto bg-white dark:bg-gray-800 border-2 border-amber-100 dark:border-amber-900 rounded-2xl px-5 py-3 text-xl text-amber-950 dark:text-white font-bold focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                            >
                              {RECITERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          </div>
                          <button 
                            onClick={() => handleSearchAndCorrect()} 
                            disabled={isLoading || !searchText.trim()} 
                            aria-label="بدء التلاوة والبحث"
                            className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-2xl shadow-xl disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95 flex-shrink-0"
                          >
                            {isLoading ? <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin"></div> : <><Play size={24} fill="currentColor" /><span className="text-2xl font-bold">تلاوة</span></>}
                          </button>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Corrected Result */}
                <div aria-live="polite">
                  {searchResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className={`glass-effect p-8 md:p-12 rounded-[3rem] shadow-2xl border-2 border-amber-100 dark:border-amber-900/50 relative overflow-hidden custom-scrollbar ${isExpanded ? 'expanded-view' : 'max-h-[85vh] overflow-y-auto'}`}
                    >
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-700"></div>
                    <div className="flex justify-between items-center mb-12">
                      <h2 className="text-3xl font-bold text-amber-950 dark:text-amber-100 flex items-center gap-4">
                        <div className="bg-amber-100 dark:bg-amber-900/50 p-2.5 rounded-2xl">
                          <BookOpen size={28} className="text-amber-700 dark:text-amber-300" />
                        </div>
                        نتائج البحث
                      </h2>
                      <div className="flex gap-3">
                        <CommandActionButton onClick={() => openAIHubWithCommand('/')} />
                        <SmartActionButton onClick={() => setShowAIHub(true)} />
                        <button 
                          onClick={() => setIsExpanded(!isExpanded)} 
                          className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 p-3.5 rounded-2xl transition-all active:scale-95"
                          title={isExpanded ? "تصغير" : "ملء الشاشة"}
                        >
                          {isExpanded ? <Minimize size={26} /> : <Maximize size={26} />}
                        </button>
                        <button 
                          onClick={() => {
                            if (isPlaying) {
                              stopRecitation();
                            } else if (searchResult.type === 'ayah') {
                              playbackModeRef.current = 'single';
                              playRealRecitation(searchResult.data.surah.id, searchResult.data.ayah.id);
                            } else if (searchResult.type === 'surah') {
                              playbackModeRef.current = 'continuous';
                              playRealRecitation(searchResult.data.id, 1);
                            } else {
                              speakText(searchResult.text || '');
                            }
                          }} 
                          className={`p-3.5 rounded-2xl transition-all active:scale-95 ${isPlaying ? 'bg-amber-700 text-white shadow-lg shadow-amber-900/30 animate-pulse' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40'}`}
                          title="استماع"
                        >
                          <Volume2 size={26} />
                        </button>
                        <button 
                          onClick={() => {
                            const textToCopy = searchResult.type === 'text' ? searchResult.text : (searchResult.type === 'surah' ? searchResult.data.verses.map((v: any) => v.text).join(' ') : searchResult.data.ayah.text);
                            navigator.clipboard.writeText(textToCopy || '');
                          }} 
                          className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 p-3.5 rounded-2xl transition-all active:scale-95"
                          title="نسخ النص"
                        >
                          <BookOpen size={26} />
                        </button>
                        <button 
                          onClick={stopRecitation} 
                          className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 p-3.5 rounded-2xl transition-all active:scale-95"
                          title="إيقاف"
                        >
                          <Square size={26} />
                        </button>
                      </div>
                    </div>
                    
                    {searchResult.explanation && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 backdrop-blur-md p-10 rounded-[3rem] border border-emerald-200 dark:border-emerald-800/50 shadow-lg relative overflow-hidden group mb-8"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex items-center justify-between mb-6 relative z-10">
                          <h4 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
                            <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                              <Sparkles size={20} />
                            </div>
                            التفسير الميسر
                          </h4>
                          <div className="flex gap-2">
                            <SmartActionButton onClick={() => setShowAIHub(true)} size={18} />
                            <button 
                              onClick={() => isSpeaking ? stopSpeaking() : speakText(searchResult.explanation)}
                              className="p-4 rounded-2xl bg-white dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 hover:scale-110 transition-all shadow-md border border-emerald-200 dark:border-emerald-700 active:scale-95"
                            >
                              {isSpeaking ? <Square size={20} className="text-red-500" /> : <Volume2 size={20} />}
                            </button>
                          </div>
                        </div>
                        <div className="relative z-10">
                          <p className="text-2xl text-emerald-950 dark:text-emerald-50 leading-relaxed font-sans pr-6 border-r-4 border-emerald-400/50 dark:border-emerald-600/50 italic">
                            {searchResult.explanation}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {searchResult.qiraatDifferences && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 backdrop-blur-md p-10 rounded-[3rem] border border-blue-200 dark:border-blue-800/50 shadow-lg relative overflow-hidden group mb-8"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex items-center justify-between mb-6 relative z-10">
                          <h4 className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/30">
                              <Layout size={20} />
                            </div>
                            اختلاف القراءات
                          </h4>
                          <div className="flex gap-2">
                            <SmartActionButton onClick={() => setShowAIHub(true)} size={18} />
                            <button 
                              onClick={() => isSpeaking ? stopSpeaking() : speakText(searchResult.qiraatDifferences)}
                              className="p-4 rounded-2xl bg-white dark:bg-blue-800 text-blue-800 dark:text-blue-200 hover:scale-110 transition-all shadow-md border border-blue-200 dark:border-blue-700 active:scale-95"
                            >
                              {isSpeaking ? <Square size={20} className="text-red-500" /> : <Volume2 size={20} />}
                            </button>
                          </div>
                        </div>
                        <div className="relative z-10">
                          <p className="text-2xl text-blue-950 dark:text-blue-50 leading-relaxed font-sans pr-6 border-r-4 border-blue-400/50 dark:border-blue-600/50 italic">
                            {searchResult.qiraatDifferences}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {searchResult.metadata && Object.keys(searchResult.metadata).length > 0 && (
                      <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {[
                          { label: 'السورة', value: searchResult.metadata.surahName, icon: <BookOpen size={14} /> },
                          { label: 'الجزء', value: searchResult.metadata.juz, icon: <Layout size={14} /> },
                          { label: 'الحزب', value: searchResult.metadata.hizb, icon: <Hash size={14} /> },
                          { label: 'النزول', value: searchResult.metadata.revelationType, icon: <Sparkles size={14} /> },
                          { label: 'الكلمات', value: searchResult.metadata.words, icon: <Type size={14} /> },
                          { label: 'الحروف', value: searchResult.metadata.letters, icon: <Type size={14} /> },
                          { label: 'الحركات', value: searchResult.metadata.harakaat, icon: <Type size={14} /> },
                          { label: 'الآيات', value: searchResult.metadata.verseCount, icon: <Hash size={14} /> },
                          { label: 'الترتيب', value: searchResult.metadata.order, icon: <Hash size={14} /> },
                        ].filter(item => item.value).map((item, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white/60 dark:bg-amber-950/40 backdrop-blur-sm p-5 rounded-3xl border border-amber-100 dark:border-amber-900/50 flex flex-col items-center text-center hover:bg-amber-50 dark:hover:bg-amber-900/60 transition-colors shadow-sm"
                          >
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                              {item.icon}
                              {item.label}
                            </span>
                            <span className="font-bold text-amber-900 dark:text-amber-100 text-xl">{item.value}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {searchResult.metadata?.asbab && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 backdrop-blur-md p-10 rounded-[3rem] border border-blue-200 dark:border-blue-800/50 shadow-lg relative overflow-hidden group mb-8"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex items-center justify-between mb-6 relative z-10">
                          <h4 className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/30">
                              <Info size={20} />
                            </div>
                            سبب النزول
                          </h4>
                          <div className="flex gap-2">
                            <SmartActionButton onClick={() => setShowAIHub(true)} size={18} />
                            <button 
                              onClick={() => isSpeaking ? stopSpeaking() : speakText(searchResult.metadata?.asbab || '')}
                              className="p-4 rounded-2xl bg-white dark:bg-blue-800 text-blue-800 dark:text-blue-200 hover:scale-110 transition-all shadow-md border border-blue-200 dark:border-blue-700 active:scale-95"
                            >
                              {isSpeaking ? <Square size={20} className="text-red-500" /> : <Volume2 size={20} />}
                            </button>
                          </div>
                        </div>
                        <div className="relative z-10">
                          <p className="text-2xl text-blue-950 dark:text-blue-50 leading-relaxed font-sans pr-6 border-r-4 border-blue-400/50 dark:border-blue-600/50 italic">
                            {searchResult.metadata.asbab}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {searchResult.type === 'surah' && searchResult.data && (
                      <div className="space-y-12">
                        <div className="text-center mb-16">
                          <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative inline-block"
                          >
                            <h2 className="text-6xl md:text-8xl font-bold text-amber-900 dark:text-amber-100 font-quran mb-6 relative z-10 drop-shadow-sm">
                              {searchResult.data.name}
                            </h2>
                            <div className="absolute -inset-6 bg-amber-300/20 dark:bg-amber-800/10 blur-3xl rounded-full -z-0"></div>
                          </motion.div>
                          
                          <div className="flex flex-wrap justify-center items-center gap-4 mt-6">
                            <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/50 dark:bg-amber-900/20 backdrop-blur-sm rounded-full text-xl text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shadow-lg">
                              <span className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${(searchResult.data.type || searchResult.data.revelationType) === 'meccan' || (searchResult.data.type || searchResult.data.revelationType) === 'Meccan' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                {((searchResult.data.type || searchResult.data.revelationType) === 'meccan' || (searchResult.data.type || searchResult.data.revelationType) === 'Meccan') ? 'مكية' : 'مدنية'}
                              </span>
                              <span className="w-px h-6 bg-amber-200 dark:bg-amber-800"></span>
                              <span>{searchResult.data.verses.length} آية</span>
                            </div>
                            
                            {searchResult.metadata?.order && (
                              <div className="inline-flex items-center gap-3 px-8 py-3 bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur-sm rounded-full text-xl text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-lg">
                                <span className="font-bold">ترتيب النزول:</span>
                                <span>{searchResult.metadata.order}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Basmala for Surah search results (except Surah 9) */}
                        {Number(searchResult.data.id) !== 9 && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-16 mb-12 bg-gradient-to-b from-amber-50/80 to-transparent dark:from-amber-900/10 dark:to-transparent rounded-[4rem] border-t-2 border-amber-100 dark:border-amber-900/30 relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-400/5 rounded-full blur-3xl"></div>
                            <p className="font-quran text-5xl md:text-6xl text-amber-950/90 dark:text-amber-50/90 leading-relaxed relative z-10">
                              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                            </p>
                          </motion.div>
                        )}
                        
                        <Virtuoso
                          useWindowScroll
                          data={searchResult.data.verses}
                          itemContent={(index, ayah: any) => (
                              <div className="pb-8">
                              <div 
                                key={ayah.id} 
                                onClick={(e) => { 
                                  if (e.detail === 3) {
                                    handleTripleClick(searchResult.data, ayah);
                                  } else {
                                    playbackModeRef.current = 'single'; 
                                    playRealRecitation(searchResult.data.id, ayah.id, ayah.id === 1); 
                                    setAIContext(getEnrichedAIContext(searchResult.data, ayah));
                                    logAIEvent(`الاستماع للآية ${ayah.id} من ${getSurahDisplayName(searchResult.data.name)}`, '🔊');
                                  }
                                }}
                                className={`p-8 md:p-12 rounded-[3rem] cursor-pointer transition-all duration-500 group ${isPlaying && (activeAyah?.ayah === ayah.id || (activeAyah?.ayah === 0 && ayah.id === 1)) ? 'bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-300 dark:border-amber-700 shadow-2xl transform scale-[1.02] z-10 relative' : 'bg-white/80 dark:bg-amber-950/80 backdrop-blur-sm border-2 border-amber-100 dark:border-amber-800/50 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-xl relative'}`}
                              >
                              <div className="flex flex-col gap-4">
                                <p className="text-center md:text-right font-quran text-amber-950 dark:text-amber-50" style={{ fontSize: `${fontSize * 1.8}px`, lineHeight: '2.5' }} dir="rtl">
                                  <TajweedText text={ayah.text} isTajweed={isTajweed} />
                                  <span className="inline-flex items-center justify-center w-14 h-14 mx-4 text-2xl border-2 border-amber-300 dark:border-amber-700 rounded-full text-amber-700 dark:text-amber-300 font-bold bg-white dark:bg-amber-900/50 shadow-inner group-hover:border-amber-500 transition-colors">
                                    {ayah.id}
                                  </span>
                                </p>

                                {/* Action Bar */}
                                <div className="absolute top-6 left-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                  <ReadAloud text={ayah.text} />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(ayah.text);
                                    }}
                                    className="p-3 rounded-2xl bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-md"
                                    title="نسخ الآية"
                                  >
                                    <Copy size={18} />
                                  </button>
                                  {navigator.share && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.share({
                                          title: `${getSurahDisplayName(searchResult.data.name)} - آية ${ayah.id}`,
                                          text: `${ayah.text}\n[${getSurahDisplayName(searchResult.data.name)} - آية ${ayah.id}]`,
                                        }).catch(console.error);
                                      }}
                                      className="p-3 rounded-2xl bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-md"
                                      title="مشاركة الآية"
                                    >
                                      <Share2 size={18} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAIContext(getEnrichedAIContext(searchResult.data, ayah));
                                      logAIEvent(`طلب مساعدة ذكية للآية ${ayah.id} من سورة ${searchResult.data.name}`, '✨');
                                      setShowAIHub(true);
                                    }}
                                    className="p-3 rounded-2xl bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform shadow-md"
                                    title="اسأل الذكاء الاصطناعي"
                                  >
                                    <Sparkles size={18} />
                                  </button>
                                </div>

                                {selectedTranslation !== 'none' && translationsData[ayah.id] && (
                                  <div className="text-left font-sans text-xl text-amber-900 dark:text-amber-100/70 leading-relaxed border-l-4 border-amber-300 dark:border-amber-700 pl-6 py-4 bg-amber-50/80 dark:bg-amber-900/10 rounded-r-2xl relative group/trans">
                                    {translationsData[ayah.id]}
                                    <div className="absolute right-4 top-4 flex flex-col gap-2 opacity-0 group-hover/trans:opacity-100 transition-opacity duration-300">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          isSpeaking ? stopSpeaking() : speakText(translationsData[ayah.id]);
                                        }}
                                        className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-800 shadow-sm hover:scale-110 transition-transform"
                                        title="قراءة الترجمة"
                                      >
                                        {isSpeaking ? <Square size={16} className="text-red-600" /> : <Volume2 size={16} className="text-amber-700 dark:text-amber-300" />}
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAIContext(getEnrichedAIContext(searchResult.data, ayah));
                                          logAIEvent(`طلب مساعدة ذكية للآية ${ayah.id} من ${getSurahDisplayName(searchResult.data.name)}`, '✨');
                                          setShowAIHub(true);
                                        }}
                                        className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-800 shadow-sm text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform"
                                        title="اسأل الذكاء الاصطناعي"
                                      >
                                        <Sparkles size={16} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        />
                      </div>
                    )}

                    {searchResult.type === 'ayah' && searchResult.data && (
                      <div className="space-y-10">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/40 p-12 rounded-[4rem] border-2 border-amber-200 dark:border-amber-800/50 shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
                          <div className="flex items-center gap-8 relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-amber-700 rounded-[2rem] flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-amber-600/40 border-4 border-white/20 transform group-hover:rotate-6 transition-transform">
                              {searchResult.data.surah.id}
                            </div>
                            <div>
                              <h3 className="text-4xl font-bold text-amber-950 dark:text-amber-50 font-quran tracking-tight mb-2">
                                {getSurahDisplayName(searchResult.data.surah.name)}
                              </h3>
                              <div className="flex flex-wrap items-center gap-4">
                                <span className="px-5 py-2 bg-amber-600 text-white rounded-2xl text-lg font-bold shadow-lg shadow-amber-600/20">
                                  آية {searchResult.data.ayah.id}
                                </span>
                                <span className="w-2 h-2 bg-amber-300 rounded-full"></span>
                                <span className="text-lg font-medium text-amber-800/80 dark:text-amber-200/80">
                                  {((searchResult.data.surah.type || searchResult.data.surah.revelationType) === 'meccan' || (searchResult.data.surah.type || searchResult.data.surah.revelationType) === 'Meccan') ? 'مكية' : 'مدنية'} • {searchResult.data.surah.verses.length} آية
                                </span>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              playbackModeRef.current = 'single'; 
                              playRealRecitation(searchResult.data.surah.id, searchResult.data.ayah.id, searchResult.data.ayah.id === 1); 
                              setAIContext(getEnrichedAIContext(searchResult.data.surah, searchResult.data.ayah));
                              logAIEvent(`البحث عن آية في ${getSurahDisplayName(searchResult.data.surah.name)}`, '🔍');
                            }}
                            className="flex items-center gap-4 px-12 py-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-[2rem] font-bold text-xl transition-all shadow-2xl shadow-amber-600/30 hover:scale-105 active:scale-95 relative z-10 border-2 border-white/10"
                          >
                            <Play size={24} fill="currentColor" />
                            <span>استماع للآية</span>
                          </button>
                        </div>

                        {/* Basmala for first ayah results (except Surah 9) */}
                        {searchResult.data.ayah.id === 1 && searchResult.data.surah.id !== 9 && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-12 bg-amber-50/20 dark:bg-amber-900/5 rounded-[3rem] border border-amber-100/50 dark:border-amber-900/20"
                          >
                            <p className="font-quran text-4xl text-amber-900/50 dark:text-amber-100/50">
                              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                            </p>
                          </motion.div>
                        )}

                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`group relative p-12 md:p-20 rounded-[5rem] cursor-pointer transition-all duration-700 ${isPlaying && (activeAyah?.ayah === searchResult.data.ayah.id || (activeAyah?.ayah === 0 && searchResult.data.ayah.id === 1)) ? 'bg-amber-100/95 dark:bg-amber-900/40 border-4 border-amber-400 dark:border-amber-600 shadow-2xl transform scale-[1.01] z-10' : 'bg-white/95 dark:bg-amber-950/95 backdrop-blur-lg border-4 border-amber-100 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-2xl'}`}
                        >
                          {searchResult.contextVerses ? (
                            <div className="text-center md:text-right font-quran text-amber-950 dark:text-amber-50" style={{ fontSize: `${fontSize * 1.8}px`, lineHeight: '2.6' }} dir="rtl">
                              {searchResult.contextVerses.map((v: any) => (
                                <span key={v.id} className={v.id === searchResult.data.ayah.id ? "text-amber-800 dark:text-amber-200 font-bold drop-shadow-md" : "opacity-40 transition-all hover:opacity-100"}>
                                  <TajweedText text={v.text} isTajweed={isTajweed} />
                                  <span className={`inline-flex items-center justify-center w-14 h-14 mx-4 text-xl border-2 rounded-full transition-all ${v.id === searchResult.data.ayah.id ? 'border-amber-500 bg-amber-500 text-white shadow-lg' : 'border-amber-200 dark:border-amber-800'}`}>
                                    {v.id}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center md:text-right font-quran text-amber-950 dark:text-amber-50" style={{ fontSize: `${fontSize * 2.4}px`, lineHeight: '2.8' }} dir="rtl">
                              <TajweedText text={searchResult.data.ayah.text} isTajweed={isTajweed} />
                              <span className="inline-flex items-center justify-center w-24 h-24 mx-8 text-4xl border-4 border-amber-400 dark:border-amber-600 rounded-full text-amber-800 dark:text-amber-200 font-bold bg-white dark:bg-amber-900/50 shadow-2xl group-hover:scale-110 transition-transform">
                                {searchResult.data.ayah.id}
                              </span>
                            </p>
                          )}

                          {/* Action Bar */}
                          <div className="absolute top-6 left-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(searchResult.data.ayah.text);
                              }}
                              className="p-3 rounded-2xl bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-md"
                              title="نسخ الآية"
                            >
                              <Copy size={18} />
                            </button>
                            {navigator.share && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.share({
                                    title: `${getSurahDisplayName(searchResult.data.surah.name)} - آية ${searchResult.data.ayah.id}`,
                                    text: `${searchResult.data.ayah.text}\n[${getSurahDisplayName(searchResult.data.surah.name)} - آية ${searchResult.data.ayah.id}]`,
                                  }).catch(console.error);
                                }}
                                className="p-3 rounded-2xl bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-md"
                                title="مشاركة الآية"
                              >
                                <Share2 size={18} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const isBookmarked = bookmarks.some(b => b.surah === searchResult.data.surah.id && b.ayah === searchResult.data.ayah.id);
                                if (isBookmarked) {
                                  setBookmarks(prev => prev.filter(b => !(b.surah === searchResult.data.surah.id && b.ayah === searchResult.data.ayah.id)));
                                } else {
                                  setBookmarks(prev => [...prev, {
                                    surah: searchResult.data.surah.id,
                                    ayah: searchResult.data.ayah.id,
                                    text: searchResult.data.ayah.text,
                                    surahName: searchResult.data.surah.name
                                  }]);
                                }
                              }}
                              className={`p-3 rounded-2xl hover:scale-110 transition-transform shadow-md ${
                                bookmarks.some(b => b.surah === searchResult.data.surah.id && b.ayah === searchResult.data.ayah.id)
                                  ? 'bg-amber-500 dark:bg-amber-600 text-white'
                                  : 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'
                              }`}
                              title={bookmarks.some(b => b.surah === searchResult.data.surah.id && b.ayah === searchResult.data.ayah.id) ? "إزالة من المحفوظات" : "حفظ الآية"}
                            >
                              <Star size={18} className={bookmarks.some(b => b.surah === searchResult.data.surah.id && b.ayah === searchResult.data.ayah.id) ? "fill-current" : ""} />
                              {bookmarks.some(b => b.surah === searchResult.data.surah.id && b.ayah === searchResult.data.ayah.id) && (
                                <motion.div 
                                  layoutId={`glow-search-${searchResult.data.ayah.id}`}
                                  className="absolute inset-0 rounded-2xl bg-amber-400 blur-md -z-10"
                                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.3, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                />
                              )}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setAIContext(getEnrichedAIContext(searchResult.data.surah, searchResult.data.ayah));
                                logAIEvent(`طلب مساعدة ذكية للآية ${searchResult.data.ayah.id} من سورة ${searchResult.data.surah.name}`, '✨');
                                setShowAIHub(true);
                              }}
                              className="p-3 rounded-2xl bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform shadow-md"
                              title="اسأل الذكاء الاصطناعي"
                            >
                              <Sparkles size={18} />
                            </button>
                          </div>
                        </motion.div>

                        {/* Translation Section */}
                        {selectedTranslation !== 'none' && searchResult.metadata?.translation && (
                          <div className="p-8 rounded-[2.5rem] bg-sky-50/80 dark:bg-sky-900/10 backdrop-blur-sm border border-sky-200/50 dark:border-sky-800/30 relative group overflow-hidden">
                            <div className="absolute -right-4 -top-4 text-sky-500/5 dark:text-sky-400/5 group-hover:scale-110 transition-transform duration-500">
                              <BookOpen size={120} />
                            </div>
                            <div className="relative z-10">
                              <h4 className="text-sm font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="p-1.5 bg-sky-100 dark:bg-sky-800/50 rounded-lg">
                                  <BookOpen size={16} className="text-sky-600 dark:text-sky-400" />
                                </span>
                                الترجمة
                              </h4>
                              <div className="flex items-start gap-4">
                                <p className="font-sans text-xl text-sky-950 dark:text-sky-50 leading-relaxed flex-1 text-left" dir="ltr">
                                  {searchResult.metadata.translation}
                                </p>
                                <div className="flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(searchResult.metadata.translation);
                                    }}
                                    className="p-3 rounded-2xl bg-sky-100 dark:bg-sky-800 text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform shadow-sm"
                                    title="نسخ الترجمة"
                                  >
                                    <Copy size={18} />
                                  </button>
                                  <ReadAloud 
                                    text={searchResult.metadata.translation} 
                                    lang="en-US" 
                                    className="flex-col gap-3" 
                                    buttonClassName="p-3 rounded-2xl bg-sky-100 dark:bg-sky-800 text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform shadow-sm"
                                  />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAIContext(getEnrichedAIContext(searchResult.data.surah, searchResult.data.ayah));
                                      logAIEvent(`طلب مساعدة ذكية للآية ${searchResult.data.ayah.id} من ${getSurahDisplayName(searchResult.data.surah.name)}`, '✨');
                                      setShowAIHub(true);
                                    }}
                                    className="p-3 rounded-2xl bg-sky-100 dark:bg-sky-800 text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform shadow-sm"
                                    title="اسأل الذكاء الاصطناعي"
                                  >
                                    <Sparkles size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {searchResult.type === 'text' && searchResult.text && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/90 dark:bg-amber-950/90 backdrop-blur-md p-12 md:p-20 rounded-[5rem] border-2 border-amber-200 dark:border-amber-800/50 shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-400/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-400/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                        
                        <div className="relative z-10 space-y-8 text-center md:text-right font-quran text-amber-950 dark:text-amber-50" style={{ fontSize: `${fontSize * 2}px`, lineHeight: '2.4' }} dir="rtl">
                          {searchResult.text.split('\n').map((line, lIdx) => (
                            <motion.p 
                              key={lIdx} 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: lIdx * 0.1 }}
                              className="mb-6 last:mb-0 leading-relaxed"
                            >
                              <TajweedText text={line} isTajweed={isTajweed} />
                            </motion.p>
                          ))}
                        </div>
                        
                        <div className="mt-12 pt-8 border-t border-amber-100 dark:border-amber-900/30 flex justify-center">
                          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-full text-sm font-bold text-amber-700 dark:text-amber-400">
                            نص مصحح ومدقق لغوياً
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : viewMode === 'browse' ? (
              <motion.div key="browse" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                {!selectedSurah ? (
                  <div className="space-y-8">
                    {/* Surah Search Bar */}
                    <div className="relative max-w-xl mx-auto mb-10">
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-amber-600/60 dark:text-amber-400/60 pointer-events-none">
                        <Search size={22} />
                      </div>
                      <label htmlFor="surah-search-input" className="sr-only">البحث عن سورة</label>
                      <input 
                        id="surah-search-input"
                        type="text" 
                        placeholder="ابحث عن سورة بالاسم أو الرقم..." 
                        value={surahSearch}
                        onChange={(e) => setSurahSearch(e.target.value)}
                        className="w-full pr-14 pl-6 py-4 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md rounded-2xl shadow-sm border border-amber-200/60 dark:border-amber-800/50 text-xl text-amber-950 dark:text-amber-50 font-bold text-right focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all duration-300 placeholder:text-amber-900/30 dark:placeholder:text-amber-100/30"
                        dir="rtl"
                        lang="ar"
                      />
                      {surahSearch && (
                        <button 
                          onClick={() => setSurahSearch('')}
                          aria-label="مسح البحث"
                          className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-600/60 hover:text-amber-800 dark:text-amber-400/60 dark:hover:text-amber-200 transition-colors"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>

                    {/* Surah Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar p-2">
                      {filteredSurahs.map((surah, index) => (
                        <motion.button
                          key={surah.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02, duration: 0.3 }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            handleSurahSelect(surah);
                          }}
                          className="p-5 glass-effect rounded-[1.5rem] shadow-sm hover:shadow-md border border-amber-100/50 dark:border-amber-900/30 text-right flex justify-between items-center group relative overflow-hidden bg-white/60 dark:bg-[#1c1917]/60 transition-all duration-300"
                        >
                          <div className="absolute -left-6 -bottom-6 text-7xl text-amber-900/5 dark:text-amber-100/5 group-hover:text-amber-900/10 dark:group-hover:text-amber-100/10 transition-colors duration-500 rotate-12 group-hover:rotate-0">۞</div>
                          <div className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/60 dark:to-amber-900/20 w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-amber-800 dark:text-amber-200 shadow-inner border border-amber-200/50 dark:border-amber-700/30 group-hover:scale-110 transition-transform duration-300">{surah.id}</div>
                          <div className="text-right z-10">
                            <div className="text-xl font-kufi font-bold text-amber-950 dark:text-amber-50 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">{surah.name}</div>
                            <div className="text-xs font-medium text-amber-800/60 dark:text-amber-400/50 mt-1">{surah.total_verses} آية</div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Surah Header Controls */}
                    <div className="flex flex-col lg:flex-row items-center justify-between glass-effect p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-amber-100 dark:border-amber-900 gap-8 relative z-10">
                      
                      {/* Top/Right Controls: Back, Play, Share */}
                      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 w-full lg:w-auto order-2 lg:order-1">
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { 
                            e.preventDefault();
                            try { stopRecitation(); } catch (err) { console.error(err); }
                            safeLocalStorageRemove('quran_selectedSurahId');
                            setSelectedSurah(null); 
                          }} 
                          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl shadow-lg hover:shadow-amber-500/30 transition-all font-bold text-base sm:text-lg w-full sm:w-auto"
                        >
                          <ChevronRight size={24} /> عودة للقائمة
                        </motion.button>
                        
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.preventDefault();
                            if (isPlaying && playbackModeRef.current === 'continuous') {
                              stopRecitation();
                            } else {
                              playbackModeRef.current = 'continuous';
                              playRealRecitation(selectedSurah.id, 1, true);
                            }
                          }} 
                          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl transition-all font-bold text-base sm:text-lg w-full sm:w-auto ${isPlaying && playbackModeRef.current === 'continuous' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'}`}
                        >
                          {isPlaying && playbackModeRef.current === 'continuous' ? <Square fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
                          {isPlaying && playbackModeRef.current === 'continuous' ? 'إيقاف السورة' : 'تشغيل السورة'}
                        </motion.button>
                        
                        {navigator.share && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.preventDefault();
                              navigator.share({
                                title: `${getSurahDisplayName(selectedSurah.name)}`,
                                text: `اقرأ واستمع إلى ${getSurahDisplayName(selectedSurah.name)} من القرآن الكريم.`,
                                url: window.location.href,
                              }).catch(console.error);
                            }}
                            className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-2xl shadow-lg hover:shadow-sky-500/30 transition-all font-bold text-base sm:text-lg w-full sm:w-auto"
                            title="مشاركة السورة"
                          >
                            <Share2 size={24} /> مشاركة
                          </motion.button>
                        )}
                      </div>
                      
                      {/* Center: Surah Info */}
                      <div id="surah-header" className="text-center order-1 lg:order-2 w-full lg:w-auto">
                        <h2 className="text-4xl md:text-5xl font-bold text-amber-950 dark:text-amber-300 mb-2 font-quran">{selectedSurah.name}</h2>
                        <div className="text-amber-950/70 dark:text-amber-200/70 text-base md:text-lg flex items-center justify-center gap-2 flex-wrap">
                          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 rounded-full">{selectedSurah.type === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                          <span>•</span>
                          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 rounded-full">{selectedSurah.total_verses} آية</span>
                          <span>•</span>
                          <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 font-bold rounded-full">{QIRAAT.find(q => q.id === selectedQiraat)?.name}</span>
                        </div>
                      </div>

                      {/* Bottom/Left Controls: Selects and Toggles */}
                      <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 w-full lg:w-auto order-3">
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <label className="text-xs text-amber-950/70 dark:text-amber-200/70 mr-2 font-bold">القارئ</label>
                          <select value={selectedReciter} onChange={(e) => setSelectedReciter(e.target.value)} className="bg-white dark:bg-[#1c1917] border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm md:text-base text-amber-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer w-full">
                            {RECITERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <label className="text-xs text-amber-950/70 dark:text-amber-200/70 mr-2 font-bold">التفسير</label>
                          <select value={selectedTafsir} onChange={(e) => setSelectedTafsir(e.target.value)} className="bg-white dark:bg-[#1c1917] border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm md:text-base text-amber-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer w-full">
                            <option value="">بدون تفسير</option>
                            {TAFASIR.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <label className="text-xs text-amber-950/70 dark:text-amber-200/70 mr-2 font-bold">الترجمة</label>
                          <select value={selectedTranslation} onChange={(e) => setSelectedTranslation(e.target.value)} className="bg-white dark:bg-[#1c1917] border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm md:text-base text-amber-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer w-full">
                            <option value="none">بدون ترجمة</option>
                            {TRANSLATIONS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <label className="text-xs text-amber-950/70 dark:text-amber-200/70 mr-2 font-bold">القراءة</label>
                          <select value={selectedQiraat} onChange={(e) => setSelectedQiraat(e.target.value)} className="bg-white dark:bg-[#1c1917] border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm md:text-base text-amber-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer w-full">
                            {QIRAAT.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-2 sm:mt-6 w-full sm:w-auto">
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsTajweed(!isTajweed)} 
                            className={`px-5 py-2.5 rounded-xl border-2 transition-all font-bold text-sm md:text-base flex-1 sm:flex-none ${isTajweed ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-transparent text-white shadow-md' : 'bg-white dark:bg-[#1c1917] border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'}`}
                          >
                            تجويد ملون
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowTajweedInfo(true)} 
                            className="p-2.5 rounded-xl border-2 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors bg-white dark:bg-[#1c1917]"
                            title="معلومات التجويد"
                          >
                            <Info size={20} />
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Verse Display */}
                    <div className={`bg-white dark:bg-[#1c1917] p-8 md:p-16 rounded-t-[10rem] rounded-b-[2rem] shadow-2xl border-[12px] border-amber-100/50 dark:border-amber-900/30 relative overflow-hidden quran-bg islamic-border mihrab-arch ${isExpanded ? 'expanded-view' : ''}`}>
                      {/* Mihrab Arch Decoration */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 opacity-20 pointer-events-none">
                        <svg viewBox="0 0 400 200" className="w-full h-full fill-amber-900 dark:fill-amber-400">
                          <path d="M0,200 L0,100 C0,44.77 89.54,0 200,0 C310.46,0 400,44.77 400,100 L400,200 Z" />
                          <path d="M20,200 L20,110 C20,60.29 100.59,20 200,20 C299.41,20 380,60.29 380,110 L380,200 Z" opacity="0.5" />
                          <path d="M40,200 L40,120 C40,75.82 111.64,40 200,40 C288.36,40 360,75.82 360,120 L360,200 Z" opacity="0.3" />
                        </svg>
                      </div>

                      {/* Expand/Smart Buttons for Browse Mode */}
                      <div className="absolute top-8 left-8 flex gap-3 z-30">
                        <SmartActionButton onClick={() => setShowAIHub(true)} />
                        <button 
                          onClick={() => setIsExpanded(!isExpanded)} 
                          className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 p-3 rounded-xl backdrop-blur-sm border border-amber-200 dark:border-amber-800 shadow-sm hover:scale-110 transition-all"
                          title={isExpanded ? "تصغير" : "ملء الشاشة"}
                        >
                          {isExpanded ? <Minimize size={24} /> : <Maximize size={24} />}
                        </button>
                      </div>

                      {/* Side Pillars - More prominent */}
                      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-amber-900/20 via-amber-900/5 to-transparent pointer-events-none border-r border-amber-900/10"></div>
                      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-amber-900/20 via-amber-900/5 to-transparent pointer-events-none border-l border-amber-900/10"></div>
                      
                      {/* Top Ornament Decoration */}
                      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 opacity-40 pointer-events-none select-none flex items-center justify-center gap-6">
                        <div className="w-12 md:w-24 h-[2px] bg-gradient-to-r from-transparent to-amber-900 dark:to-amber-400"></div>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-amber-900 dark:text-amber-400 drop-shadow-md">
                          <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" fill="currentColor"/>
                        </svg>
                        <div className="w-12 md:w-24 h-[2px] bg-gradient-to-l from-transparent to-amber-900 dark:to-amber-400"></div>
                      </div>

                      {/* Top Glow */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-400/20 blur-[100px] pointer-events-none"></div>

                      <div className="absolute inset-0 opacity-[0.05] pointer-events-none select-none">
                        <div className="grid grid-cols-10 gap-8 p-12">
                          {Array.from({ length: 100 }).map((_, i) => <div key={i} className="text-5xl text-amber-900 font-quran">۞</div>)}
                        </div>
                      </div>

                      <div className="relative z-10 max-w-5xl mx-auto pt-32 pb-16 px-4 md:px-8">
                        {/* Prepend Basmala if it's the first page of a Surah (except At-Tawbah and Al-Fatiha) */}
                        {currentPage === 1 && Number(selectedSurah.id) !== 9 && (Number(selectedSurah.id) !== 1 || selectedQiraat === 'warsh') && (
                          <div className="text-center mb-12 py-8 border-b border-amber-100 dark:border-amber-900/30">
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-4xl md:text-6xl font-quran text-amber-900 dark:text-amber-200 drop-shadow-sm"
                            >
                              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                            </motion.div>
                          </div>
                        )}
                        <div 
                          className="font-quran text-amber-950 dark:text-amber-50" 
                          style={{ 
                            fontSize: `${fontSize * 2.2}px`, 
                            lineHeight: selectedTranslation === 'none' ? '2.2' : '2.8',
                            textAlign: selectedTranslation === 'none' ? 'justify' : 'right',
                            textJustify: selectedTranslation === 'none' ? 'inter-word' : 'auto'
                          }} 
                          dir="rtl"
                        >
                          {selectedTranslation === 'none' ? (
                            <div className="leading-loose" style={{ textJustify: 'inter-word' }}>
                              {selectedSurah.verses.slice((currentPage - 1) * VERSES_PER_PAGE, currentPage * VERSES_PER_PAGE).map((ayah) => (
                                <span 
                                  key={ayah.id}
                                  id={`ayah-${ayah.id}`}
                                  onClick={(e) => { 
                                    if (e.detail === 3) {
                                      handleTripleClick(selectedSurah, ayah);
                                    } else {
                                      playbackModeRef.current = 'single'; 
                                      playRealRecitation(selectedSurah.id, ayah.id); 
                                      setAIContext(getEnrichedAIContext(selectedSurah, ayah));
                                      logAIEvent(`الاستماع للآية ${ayah.id} من سورة ${selectedSurah.name}`, '🔊');
                                    }
                                  }}
                                  onContextMenu={(e) => { 
                                    e.preventDefault(); 
                                    setAyahContextMenu({
                                      x: e.clientX,
                                      y: e.clientY,
                                      visible: true,
                                      surahId: selectedSurah.id,
                                      ayahId: ayah.id,
                                      text: ayah.text
                                    });
                                  }}
                                  onTouchStart={(e) => {
                                    const touch = e.touches[0];
                                    const timer = setTimeout(() => {
                                      setAyahContextMenu({
                                        x: touch.clientX,
                                        y: touch.clientY,
                                        visible: true,
                                        surahId: selectedSurah.id,
                                        ayahId: ayah.id,
                                        text: ayah.text
                                      });
                                    }, 600);
                                    (e.currentTarget as any)._longPressTimer = timer;
                                  }}
                                  onTouchEnd={(e) => {
                                    clearTimeout((e.currentTarget as any)._longPressTimer);
                                  }}
                                  onTouchMove={(e) => {
                                    clearTimeout((e.currentTarget as any)._longPressTimer);
                                  }}
                                  className={`cursor-pointer transition-colors duration-300 ${activeAyah?.surah === selectedSurah.id && (activeAyah?.ayah === ayah.id || (activeAyah?.ayah === 0 && ayah.id === 1)) ? 'text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/40 rounded-lg' : 'hover:text-amber-700 dark:hover:text-amber-300'}`}
                                >
                                  <TajweedText text={ayah.text} isTajweed={isTajweed} />
                                  <span className="inline-flex items-center justify-center mx-2 text-[0.4em] border border-amber-600/50 rounded-full text-amber-800/70 dark:text-amber-400/70 font-bold bg-amber-50/50 dark:bg-amber-900/20" style={{ width: '2em', height: '2em', transform: 'translateY(-0.2em)' }}>
                                    {ayah.id}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-6">
                              {selectedSurah.verses.slice((currentPage - 1) * VERSES_PER_PAGE, currentPage * VERSES_PER_PAGE).map((ayah) => (
                                <span 
                                  key={ayah.id}
                                  id={`ayah-${ayah.id}`}
                                  onClick={(e) => { 
                                    if (e.detail === 3) {
                                      handleTripleClick(selectedSurah, ayah);
                                    } else {
                                      playbackModeRef.current = 'single'; 
                                      playRealRecitation(selectedSurah.id, ayah.id); 
                                      setAIContext(getEnrichedAIContext(selectedSurah, ayah));
                                      logAIEvent(`الاستماع للآية ${ayah.id} من سورة ${selectedSurah.name}`, '🔊');
                                    }
                                  }}
                                  onContextMenu={(e) => { 
                                    e.preventDefault(); 
                                    setAyahContextMenu({
                                      x: e.clientX,
                                      y: e.clientY,
                                      visible: true,
                                      surahId: selectedSurah.id,
                                      ayahId: ayah.id,
                                      text: ayah.text
                                    });
                                  }}
                                  onTouchStart={(e) => {
                                    const touch = e.touches[0];
                                    const timer = setTimeout(() => {
                                      setAyahContextMenu({
                                        x: touch.clientX,
                                        y: touch.clientY,
                                        visible: true,
                                        surahId: selectedSurah.id,
                                        ayahId: ayah.id,
                                        text: ayah.text
                                      });
                                    }, 600);
                                    (e.currentTarget as any)._longPressTimer = timer;
                                  }}
                                  onTouchEnd={(e) => {
                                    clearTimeout((e.currentTarget as any)._longPressTimer);
                                  }}
                                  onTouchMove={(e) => {
                                    clearTimeout((e.currentTarget as any)._longPressTimer);
                                  }}
                                  className={`group cursor-pointer px-4 py-4 rounded-3xl transition-all duration-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 block m-1.5 ${activeAyah?.surah === selectedSurah.id && (activeAyah?.ayah === ayah.id || (activeAyah?.ayah === 0 && ayah.id === 1)) ? 'bg-amber-200 dark:bg-amber-800 shadow-2xl ring-8 ring-amber-500/20 scale-[1.02] z-20 relative' : 'relative'}`}
                                >
                                  <div className="flex flex-col gap-4">
                                    <div className="text-right leading-[2.8] relative overflow-hidden rounded-3xl">
                                      {/* Active Ayah Glow in Mihrab */}
                                      {activeAyah?.surah === selectedSurah.id && activeAyah?.ayah === ayah.id && (
                                        <motion.div 
                                          layoutId="mihrab-active-glow"
                                          className="absolute inset-0 bg-amber-400/10 blur-xl rounded-full -z-10"
                                          animate={{ opacity: [0.2, 0.4, 0.2] }}
                                          transition={{ duration: 2, repeat: Infinity }}
                                        />
                                      )}
                                      <TajweedText text={ayah.text} isTajweed={isTajweed} />
                                      <span className="inline-flex items-center justify-center w-14 h-14 mx-4 text-2xl border-2 border-amber-600 rounded-full text-amber-800 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/30 shadow-inner">
                                        {ayah.id}
                                      </span>
                                    </div>
                                    
                                    {/* Action Bar */}
                                    <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          analyzeQiraat(selectedSurah.id, ayah.id, ayah.text);
                                        }}
                                        className="p-2 rounded-full bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-sm"
                                        title="تحليل القراءات"
                                      >
                                        <BookOpen size={16} />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTafsirSelect(selectedTafsir, selectedSurah.id, ayah.id);
                                        }}
                                        className="p-2 rounded-full bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-sm"
                                        title="تفسير"
                                      >
                                        <Info size={16} />
                                      </button>
                                      <ReadAloud 
                                        text={ayah.text} 
                                        buttonClassName="p-2 rounded-full bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-sm"
                                      />
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(ayah.text);
                                        }}
                                        className="p-2 rounded-full bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-sm"
                                        title="نسخ الآية"
                                      >
                                        <Copy size={16} />
                                      </button>
                                      {navigator.share && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.share({
                                              title: `${getSurahDisplayName(selectedSurah.name)} - آية ${ayah.id}`,
                                              text: `${ayah.text}\n[${getSurahDisplayName(selectedSurah.name)} - آية ${ayah.id}]`,
                                            }).catch(console.error);
                                          }}
                                          className="p-2 rounded-full bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 hover:scale-110 transition-transform shadow-sm"
                                          title="مشاركة الآية"
                                        >
                                          <Share2 size={16} />
                                        </button>
                                      )}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const isBookmarked = bookmarks.some(b => b.surah === selectedSurah.id && b.ayah === ayah.id);
                                          if (isBookmarked) {
                                            setBookmarks(prev => prev.filter(b => !(b.surah === selectedSurah.id && b.ayah === ayah.id)));
                                          } else {
                                            setBookmarks(prev => [...prev, { surah: selectedSurah.id, ayah: ayah.id, text: ayah.text, surahName: selectedSurah.name }]);
                                          }
                                        }}
                                        className={`p-2 rounded-full transition-transform shadow-sm hover:scale-110 ${bookmarks.some(b => b.surah === selectedSurah.id && b.ayah === ayah.id) ? 'bg-amber-600 text-white' : 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'}`}
                                        title="حفظ الآية"
                                      >
                                        <Star size={16} fill={bookmarks.some(b => b.surah === selectedSurah.id && b.ayah === ayah.id) ? 'currentColor' : 'none'} />
                                        {bookmarks.some(b => b.surah === selectedSurah.id && b.ayah === ayah.id) && (
                                          <motion.div 
                                            layoutId={`glow-surah-${ayah.id}`}
                                            className="absolute inset-0 rounded-full bg-amber-400 blur-md -z-10"
                                            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.3, 1] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                          />
                                        )}
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAIContext(getEnrichedAIContext(selectedSurah, ayah));
                                          logAIEvent(`طلب مساعدة ذكية للآية ${ayah.id} من سورة ${selectedSurah.name}`, '✨');
                                          setShowAIHub(true);
                                        }}
                                        className="p-2 rounded-full bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-200 hover:scale-110 transition-transform shadow-sm"
                                        title="اسأل الذكاء الاصطناعي"
                                      >
                                        <Sparkles size={16} />
                                      </button>
                                    </div>

                                    {selectedTranslation !== 'none' && translationsData[ayah.id] && (
                                      <div className={`text-left ${fontFamily} text-xl text-amber-900 dark:text-amber-100/70 leading-relaxed border-l-4 border-amber-300 dark:border-amber-700 pl-6 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-r-2xl relative group/trans`}>
                                        {translationsData[ayah.id]}
                                        <div className="absolute right-2 top-2 flex gap-2 opacity-0 group-hover/trans:opacity-100 transition-opacity">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigator.clipboard.writeText(translationsData[ayah.id]);
                                            }}
                                            className="p-2 rounded-lg bg-amber-100 dark:bg-amber-800 shadow-sm text-amber-700 dark:text-amber-300"
                                            title="نسخ الترجمة"
                                          >
                                            <Copy size={14} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              isSpeaking ? stopSpeaking() : speakText(translationsData[ayah.id]);
                                            }}
                                            className="p-2 rounded-lg bg-amber-100 dark:bg-amber-800 shadow-sm"
                                            title="قراءة الترجمة"
                                          >
                                            {isSpeaking ? <Square size={14} className="text-red-600" /> : <Volume2 size={14} className="text-amber-700 dark:text-amber-300" />}
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAIContext(getEnrichedAIContext(selectedSurah, ayah));
                                              logAIEvent(`طلب مساعدة ذكية للآية ${ayah.id} من ${getSurahDisplayName(selectedSurah.name)}`, '✨');
                                              setShowAIHub(true);
                                            }}
                                            className="p-2 rounded-lg bg-sky-100 dark:bg-sky-800 shadow-sm text-sky-700 dark:text-sky-200"
                                            title="اسأل الذكاء الاصطناعي"
                                          >
                                            <Sparkles size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Pagination Controls */}
                        {selectedSurah.verses.length > VERSES_PER_PAGE && (
                          <div className="flex justify-center items-center gap-6 mt-16 mb-8" dir="rtl">
                            <button
                              onClick={() => {
                                setCurrentPage(p => Math.min(Math.ceil(selectedSurah.verses.length / VERSES_PER_PAGE), p + 1));
                                document.getElementById('surah-header')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              disabled={currentPage === Math.ceil(selectedSurah.verses.length / VERSES_PER_PAGE)}
                              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 disabled:opacity-50 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors font-bold shadow-sm"
                            >
                              <span>الصفحة التالية</span>
                              <ChevronLeft size={20} />
                            </button>
                            
                            <span className="text-amber-900 dark:text-amber-100 font-bold bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800/50">
                              {currentPage} / {Math.ceil(selectedSurah.verses.length / VERSES_PER_PAGE)}
                            </span>

                            <button
                              onClick={() => {
                                setCurrentPage(p => Math.max(1, p - 1));
                                document.getElementById('surah-header')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              disabled={currentPage === 1}
                              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 disabled:opacity-50 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors font-bold shadow-sm"
                            >
                              <ChevronRight size={20} />
                              <span>الصفحة السابقة</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tafsir Panel removed as it now opens in AI Hub */}
                  </div>
                )}
              </motion.div>
            ) : viewMode === 'duas' ? (
              <motion.div key="duas" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <div className={`transition-all duration-500 ${isExpanded ? 'expanded-view p-8 md:p-16' : ''}`}>
                  <div className="absolute top-8 left-8 flex gap-3 z-30">
                    <SmartActionButton onClick={() => setShowAIHub(true)} />
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)} 
                      className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 p-3 rounded-xl backdrop-blur-sm border border-amber-200 dark:border-amber-800 shadow-sm hover:scale-110 transition-all"
                      title={isExpanded ? "تصغير" : "ملء الشاشة"}
                    >
                      {isExpanded ? <Minimize size={24} /> : <Maximize size={24} />}
                    </button>
                  </div>
                  <DuaSection speakText={speakText} stopSpeaking={stopSpeaking} isSpeaking={isSpeaking} />
                </div>
              </motion.div>
            ) : viewMode === 'qibla' ? (
              <motion.div key="qibla" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <QiblaSection />
              </motion.div>
            ) : viewMode === 'tasbih' ? (
              <motion.div key="tasbih" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <TasbihSection />
              </motion.div>
            ) : viewMode === 'bookmarks' ? (
              <motion.div key="bookmarks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className={`space-y-8 mx-auto transition-all duration-500 ${isExpanded ? 'expanded-view p-8 md:p-16' : 'max-w-4xl'}`}>
                  <div className="text-center space-y-4 relative">
                    <div className="absolute top-0 left-0 flex gap-3 z-30">
                      <SmartActionButton onClick={() => setShowAIHub(true)} />
                      <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 p-3 rounded-xl backdrop-blur-sm border border-amber-200 dark:border-amber-800 shadow-sm hover:scale-110 transition-all"
                        title={isExpanded ? "تصغير" : "ملء الشاشة"}
                      >
                        {isExpanded ? <Minimize size={24} /> : <Maximize size={24} />}
                      </button>
                    </div>
                    <h2 className="text-5xl font-black text-amber-900 dark:text-amber-100">المحفوظات</h2>
                    <p className="text-xl text-amber-800 dark:text-amber-400/60">الآيات التي قمت بحفظها للرجوع إليها لاحقاً</p>
                    {bookmarks.length > 0 && (
                      <div className="flex justify-center gap-4 mt-4">
                        {navigator.share && (
                          <button
                            onClick={() => {
                              const text = bookmarks.map(b => `${b.text}\n[${getSurahDisplayName(b.surahName)} - آية ${b.ayah}]`).join('\n\n');
                              navigator.share({
                                title: 'آياتي المحفوظة',
                                text: text,
                              }).catch(console.error);
                            }}
                            className="px-6 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors inline-flex items-center gap-2"
                          >
                            <Share2 size={18} />
                            <span>مشاركة الكل</span>
                          </button>
                        )}
                        {confirmClearBookmarks ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setBookmarks([]);
                                setConfirmClearBookmarks(false);
                              }}
                              className="px-5 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors font-bold text-sm"
                            >
                              تأكيد مسح الكل
                            </button>
                            <button
                              onClick={() => setConfirmClearBookmarks(false)}
                              className="px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 transition-colors text-sm"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmClearBookmarks(true)}
                            className="px-6 py-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors inline-flex items-center gap-2"
                          >
                            <X size={18} />
                            <span>مسح الكل</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {bookmarks.length === 0 ? (
                    <div className="bg-white dark:bg-[#1c1917] p-12 rounded-[3rem] shadow-xl border border-amber-100 dark:border-amber-900 text-center">
                      <Star size={64} className="mx-auto text-amber-300 dark:text-amber-600 mb-6" />
                      <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-2">لا توجد آيات محفوظة</h3>
                      <p className="text-amber-700 dark:text-amber-500">قم بحفظ الآيات من خلال الضغط على أيقونة الحفظ في أي آية.</p>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {bookmarks.map((bookmark, index) => (
                        <motion.div 
                          key={`${bookmark.surah}-${bookmark.ayah}-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white dark:bg-[#1c1917] p-8 rounded-[2.5rem] shadow-lg border border-amber-100 dark:border-amber-900 group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 dark:bg-amber-900/20 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110" />
                          
                          <div className="flex justify-between items-start mb-6">
                            <div className="bg-amber-100 dark:bg-amber-900/50 px-4 py-2 rounded-xl text-amber-800 dark:text-amber-200 font-bold text-sm flex items-center gap-2">
                              <BookOpen size={16} />
                              {getSurahDisplayName(bookmark.surahName)} - آية {bookmark.ayah}
                            </div>
                            <button 
                              onClick={() => setBookmarks(prev => prev.filter(b => !(b.surah === bookmark.surah && b.ayah === bookmark.ayah)))}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                              title="إزالة من المحفوظات"
                            >
                              <X size={20} />
                            </button>
                          </div>
                          
                          <div className="text-right leading-[2.8] mb-6">
                            <TajweedText text={bookmark.text} isTajweed={isTajweed} />
                          </div>
                          
                          <div className="flex gap-2 justify-end border-t border-amber-100 dark:border-amber-900/50 pt-4">
                            <ReadAloud 
                              text={bookmark.text} 
                              buttonClassName="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                            />
                            <button
                              onClick={() => {
                                const surahObj = quranData?.find(s => s.id === bookmark.surah);
                                if (surahObj) {
                                  setSelectedSurah(surahObj);
                                  setCurrentPage(Math.ceil(bookmark.ayah / VERSES_PER_PAGE));
                                  setViewMode('browse');
                                  // Scroll to ayah after a short delay to allow rendering
                                  setTimeout(() => {
                                    const element = document.getElementById(`ayah-${bookmark.ayah}`);
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      element.classList.add('bg-amber-100', 'dark:bg-amber-900/40');
                                      setTimeout(() => element.classList.remove('bg-amber-100', 'dark:bg-amber-900/40'), 2000);
                                    }
                                  }, 100);
                                }
                              }}
                              className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                              title="الذهاب للآية"
                            >
                              <Navigation size={18} />
                            </button>
                            <button 
                              onClick={() => navigator.clipboard.writeText(bookmark.text)}
                              className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                              title="نسخ الآية"
                            >
                              <Copy size={18} />
                            </button>
                            {navigator.share && (
                              <button 
                                onClick={() => {
                                  navigator.share({
                                    title: `${getSurahDisplayName(bookmark.surahName)} - آية ${bookmark.ayah}`,
                                    text: `${bookmark.text}\n[${getSurahDisplayName(bookmark.surahName)} - آية ${bookmark.ayah}]`,
                                  }).catch(console.error);
                                }}
                                className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                                title="مشاركة الآية"
                              >
                                <Share2 size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setAIContext({ surah: bookmark.surahName, ayah: bookmark.ayah, text: bookmark.text });
                                logAIEvent(`طلب مساعدة ذكية للآية ${bookmark.ayah} من ${getSurahDisplayName(bookmark.surahName)}`, '✨');
                                setShowAIHub(true);
                              }}
                              className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                              title="مساعدة ذكية"
                            >
                              <Sparkles size={18} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : viewMode === 'calendar' ? (
              <motion.div key="calendar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Suspense fallback={null}>
                  <IslamicCalendar />
                </Suspense>
              </motion.div>
            ) : viewMode === 'ai-chat' ? (
              <motion.div 
                key="ai-chat" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }} 
                className="flex-1 min-h-[80vh] bg-white dark:bg-[#0c0a09] rounded-[3rem] shadow-2xl border border-amber-200/20 overflow-hidden flex flex-col relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/10 pointer-events-none"></div>
                <Suspense fallback={null}>
                  <AIHub 
                    isOpen={true} 
                    onClose={() => setViewMode('search')} 
                    provider={provider} 
                    currentContext={aiContext}
                    isFullScreen={true}
                    onAction={handleAIAction}
                    selectedVoice={selectedVoice}
                    viewMode={viewMode}
                    lastSearchedText={lastSearchedText}
                    selectedReciter={selectedReciter}
                    selectedQiraat={selectedQiraat}
                    selectedTafsir={selectedTafsir}
                    selectedTranslation={selectedTranslation}
                  />
                </Suspense>
              </motion.div>
            ) : viewMode === 'image_generator' ? (
              <motion.div
                key="image_generator"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto bg-white dark:bg-[#1c1917] rounded-[3rem] shadow-2xl border border-amber-200/30 dark:border-amber-900/40 p-6 md:p-8"
              >
                <Suspense fallback={null}>
                  <ImageGenerator />
                </Suspense>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        {/* Midad Al-Rahman - Moved to end for better stacking context */}
        <AnimatePresence>
          {showMidadAlRahman && (
            <MidadAlRahman
              onClose={() => setShowMidadAlRahman(false)}
              selectedVoice={selectedVoice}
              currentContext={aiContext}
              onAction={handleAIAction}
            />
          )}
        </AnimatePresence>

        {/* Hidden Audio Element - Must remain in DOM */}
        <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} className="hidden" />

        {/* Global Audio Bar */}
        <PlaybackControls
          isPlaying={isPlaying}
          activeAyah={activeAyah}
          quranData={quranData}
          audioProgress={audioProgress}
          currentAudioData={currentAudioData}
          currentMimeType={currentMimeType}
          togglePlayPause={togglePlayPause}
          stopRecitation={stopRecitation}
          skipForward={skipForward}
          skipBackward={skipBackward}
        />

        {/* Status Toasts */}
        <AnimatePresence>
          {status && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 px-8 py-4 rounded-2xl shadow-2xl border border-sky-200 dark:border-sky-900/50 text-center z-[110] flex items-center gap-3">
              <Sparkles className="animate-pulse text-sky-500" size={20} />
              <span className="text-lg font-bold">{status}</span>
              <button onClick={() => setStatus('')} className="p-1 hover:bg-sky-100 dark:hover:bg-sky-900 rounded-lg transition-colors">✕</button>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-8 py-4 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/50 text-center z-[110] flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold">{error}</span>
                <button onClick={() => setError('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors">✕</button>
              </div>
              {(typeof error === 'string' && (error.includes('تجاوز الحد') || error.includes('مفتاح API'))) && (
                <button 
                  onClick={() => {
                    setShowSettings(true);
                    setError('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-xl text-sm font-bold hover:bg-amber-800 transition-colors"
                >
                  <Settings2 size={16} />
                  فتح الإعدادات لإضافة مفتاحك الخاص
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Hub Floating Button */}
        <motion.div
          drag
          dragMomentum={false}
          className="fixed bottom-32 right-6 z-50 cursor-grab"
        >
          <motion.button
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setAIContext(undefined);
              setShowAIHub(true);
            }}
            className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-2xl flex items-center justify-center border-2 border-white/20 touch-none overflow-hidden"
            title="المساعد الذكي (اسحب للتحريك)"
          >
            <Sparkles size={28} />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-amber-400 rounded-2xl -z-10"
            />
          </motion.button>
        </motion.div>

        {/* AI Hub Component */}
        <Suspense fallback={null}>
          <AIHub 
            isOpen={showAIHub} 
            onClose={() => {
              setShowAIHub(false);
              setAiHubInitialInput('');
            }} 
            currentContext={aiContext}
            provider={provider}
            onAction={handleAIAction}
            selectedVoice={selectedVoice}
            viewMode={viewMode}
            lastSearchedText={lastSearchedText}
            selectedReciter={selectedReciter}
            selectedQiraat={selectedQiraat}
            selectedTafsir={selectedTafsir}
            selectedTranslation={selectedTranslation}
            initialInput={aiHubInitialInput}
          />
        </Suspense>

        {/* User Guide Modal */}
        <Suspense fallback={null}>
          <UserGuide show={showUserGuide} onClose={() => setShowUserGuide(false)} />
        </Suspense>

        {/* Qiraat Info Modal */}
        <AnimatePresence>
          {isAnalyzingQiraat && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
            >
              <div className="bg-white dark:bg-[#1c1917] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-amber-100/20">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xl font-bold text-sky-900 dark:text-sky-100">جاري تحليل القراءات العشر...</p>
              </div>
            </motion.div>
          )}
          {showQiraatInfo && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowQiraatInfo(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20, opacity: 0 }} 
                animate={{ scale: 1, y: 0, opacity: 1 }} 
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                className="bg-white dark:bg-[#1c1917] rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl border border-amber-100/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-amber-100 dark:border-amber-900/30 flex justify-between items-center bg-sky-50/50 dark:bg-sky-900/10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-2xl shadow-inner">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-sky-900 dark:text-sky-100">اختلاف القراءات العشر</h2>
                      <p className="text-sm text-sky-800/60 dark:text-sky-200/60">{selectedSurah?.name} - آية {showQiraatInfo.ayah}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowQiraatInfo(null)}
                    className="p-2.5 hover:bg-sky-100 dark:hover:bg-sky-900/30 rounded-2xl transition-all text-sky-800 dark:text-sky-200 active:scale-90"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto max-h-[calc(85vh-100px)] custom-scrollbar text-right" dir="rtl">
                  <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-800/30 text-center">
                    <p className="text-3xl font-quran text-amber-950 dark:text-amber-100 leading-relaxed">
                      {showQiraatInfo.text}
                    </p>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-sky-900 dark:text-sky-200">البيان والتحليل:</h3>
                      <button 
                        onClick={() => isSpeaking ? stopSpeaking() : speakText(showQiraatInfo.info)}
                        className={`p-2 rounded-xl transition-colors ${isSpeaking ? 'bg-sky-200 dark:bg-sky-800 animate-pulse' : 'hover:bg-sky-100 dark:hover:bg-sky-800/50'}`}
                        title={isSpeaking ? "إيقاف القراءة" : "قراءة التحليل"}
                      >
                        {isSpeaking ? <Square size={20} className="text-red-600" /> : <Volume2 size={20} className="text-sky-900 dark:text-sky-300" />}
                      </button>
                    </div>
                    <p className="text-2xl text-sky-900 dark:text-sky-100 leading-relaxed italic whitespace-pre-wrap">
                      {showQiraatInfo.info}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tafsir Modal removed as it now opens in AI Hub */}


        {/* Tajweed Info Modal */}
        <AnimatePresence>
          {showTajweedInfo && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" 
              onClick={() => setShowTajweedInfo(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.9, y: 20 }} 
                className="bg-white dark:bg-[#1c1917] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-amber-200 dark:border-amber-900/50" 
                onClick={e => e.stopPropagation()} 
                dir="rtl"
              >
                <div className="flex justify-between items-center mb-6 border-b border-amber-100 dark:border-amber-900/50 pb-4">
                  <h3 className="text-2xl font-bold text-amber-950 dark:text-amber-400 font-quran">دليل ألوان التجويد</h3>
                  <button onClick={() => setShowTajweedInfo(false)} className="text-gray-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4 text-lg font-quran">
                  {TAJWEED_RULES.map(rule => (
                    <div key={rule.id} className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 shadow-md ${rule.class.replace(/text-/g, 'bg-')}`}></div>
                      <div>
                        <p className={`font-bold text-xl ${rule.class}`}>{rule.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rule.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ayah Context Menu */}
        <AnimatePresence>
          {ayahContextMenu && ayahContextMenu.visible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ 
                position: 'fixed', 
                top: Math.min(Math.max(ayahContextMenu.y, 20), window.innerHeight - 350),
                left: Math.min(Math.max(ayahContextMenu.x, 20), window.innerWidth - 300),
                zIndex: 300 
              }}
              className="bg-white dark:bg-[#1c1917] border-2 border-amber-200 dark:border-amber-900 rounded-3xl shadow-2xl overflow-hidden min-w-[280px] islamic-pattern"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="bg-amber-50/50 dark:bg-amber-900/20 p-4 border-b border-amber-100 dark:border-amber-900/50 flex items-center justify-between">
                <span className="text-amber-900 dark:text-amber-100 font-bold text-sm">خيارات الآية</span>
                <button onClick={() => setAyahContextMenu(null)} className="p-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/50 rounded-full transition-colors">
                  <X size={16} className="text-amber-700 dark:text-amber-300" />
                </button>
              </div>

              <div className="p-3 space-y-1">
                <button
                  onClick={() => {
                    analyzeQiraat(ayahContextMenu.surahId, ayahContextMenu.ayahId, ayahContextMenu.text);
                    setAyahContextMenu(null);
                  }}
                  className="w-full text-right px-4 py-3 rounded-2xl hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-all flex items-center gap-3 text-amber-950 dark:text-amber-100 font-bold"
                >
                  <BookOpen size={18} className="text-amber-600 dark:text-amber-400" />
                  <span>تحليل القراءات</span>
                </button>
                
                <button
                  onClick={() => {
                    setVisionText(ayahContextMenu.text);
                    setAyahContextMenu(null);
                  }}
                  className="w-full text-right px-4 py-3 rounded-2xl hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-all flex items-center gap-3 text-emerald-950 dark:text-emerald-100 font-bold"
                >
                  <ImageIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span>رؤية بصرية</span>
                </button>
                
                <div className="h-px bg-amber-100 dark:bg-amber-900/30 my-1" />
                
                <div className="px-4 py-2 text-[10px] text-amber-500 font-bold uppercase tracking-widest">التفسير</div>
                
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                  {TAFASIR.map((tafsir) => (
                    <button
                      key={tafsir.id}
                      onClick={() => handleTafsirSelect(tafsir.id, ayahContextMenu.surahId, ayahContextMenu.ayahId)}
                      className="w-full text-right px-4 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-3 text-amber-900/90 dark:text-amber-100/90 text-sm"
                    >
                      {tafsir.id === 'ai.explanation' ? <Sparkles size={14} className="text-amber-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {tafsir.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Decorative Footer */}
              <div className="p-2 bg-amber-50/50 dark:bg-amber-900/20 flex justify-center">
                <div className="text-[10px] text-amber-900/40 dark:text-amber-100/40 font-quran">مداد الرحمن - المساعد الذكي</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
      )}
      </>
    </ErrorBoundary>
  );
}

export default App;
