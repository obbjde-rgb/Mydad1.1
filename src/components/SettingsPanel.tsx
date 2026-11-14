import React from 'react';
import { motion } from 'motion/react';
import { X, Settings2, RotateCcw, RefreshCw, Trash2 } from 'lucide-react';
import { AI_PROVIDERS, AIProviderKey, VOICES, VoiceCategory, getDynamicModelsList, resolveGeminiVoice } from '../services/aiService';
import { TRANSLATIONS, QIRAAT } from '../constants';
import { RecitationSettings, Surah } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineDownloadManager } from './OfflineDownloadManager';
import { LiveVoiceSettingsSection } from './live/LiveVoiceSettingsSection';
import { resetAppCaches, syncBundledOfflineAssets } from '../services/offlineAudioManager';

interface SettingsPanelProps {
  show: boolean;
  onClose: () => void;
  provider: AIProviderKey;
  onProviderChange: (provider: AIProviderKey) => void;
  apiKeyInput: string;
  onApiKeyChange: (key: string) => void;
  selectedTranslation: string;
  onTranslationChange: (id: string) => void;
  selectedQiraat: string;
  onQiraatChange: (id: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontFamily: string;
  onFontFamilyChange: (family: string) => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  ttsModel: string;
  onTtsModelChange: (model: string) => void;
  aiRecitationSettings: RecitationSettings;
  onAiRecitationSettingsChange: (settings: RecitationSettings) => void;
  humanRecitationSettings: RecitationSettings;
  onHumanRecitationSettingsChange: (settings: RecitationSettings) => void;
  onResetApp: () => void;
  onRefreshModels: () => Promise<void>;
  quranData?: Surah[] | null;
  selectedReciter?: string;
  onReciterChange?: (reciterId: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  show,
  onClose,
  provider,
  onProviderChange,
  apiKeyInput,
  onApiKeyChange,
  selectedTranslation,
  onTranslationChange,
  selectedQiraat,
  onQiraatChange,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  selectedVoice,
  onVoiceChange,
  ttsModel,
  onTtsModelChange,
  aiRecitationSettings,
  onAiRecitationSettingsChange,
  humanRecitationSettings,
  onHumanRecitationSettingsChange,
  onResetApp,
  onRefreshModels,
  quranData = null,
  selectedReciter = 'ar.alafasy',
  onReciterChange
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [voiceCategory, setVoiceCategory] = React.useState<'all' | VoiceCategory>('all');
  const [geminiModels, setGeminiModels] = React.useState<string[]>(() => {
    return getDynamicModelsList('gemini');
  });

  React.useEffect(() => {
    const handleUpdate = () => {
      setGeminiModels(getDynamicModelsList('gemini'));
    };
    window.addEventListener('models_updated', handleUpdate);
    return () => {
      window.removeEventListener('models_updated', handleUpdate);
    };
  }, []);

  const ttsModels = React.useMemo(() => {
    const defaults = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'];
    const discoveredTts = geminiModels.filter(m => m.includes('-tts'));
    return Array.from(new Set([...defaults, ...discoveredTts])).filter(Boolean);
  }, [geminiModels]);

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isResettingCache, setIsResettingCache] = React.useState(false);
  const [refreshMessage, setRefreshMessage] = React.useState<{ text: string; type: 'success' | 'error' | 'loading' } | null>(null);
  const refreshMsgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (refreshMsgTimerRef.current) clearTimeout(refreshMsgTimerRef.current);
    };
  }, []);

  const showTimedRefreshMessage = (msg: { text: string; type: 'success' | 'error' | 'loading' }, durationMs?: number) => {
    if (refreshMsgTimerRef.current) clearTimeout(refreshMsgTimerRef.current);
    setRefreshMessage(msg);
    if (durationMs) {
      refreshMsgTimerRef.current = setTimeout(() => {
        setRefreshMessage(null);
        refreshMsgTimerRef.current = null;
      }, durationMs);
    }
  };

  const handleClearRuntimeCache = async () => {
    if (isResettingCache) return;
    setIsResettingCache(true);
    showTimedRefreshMessage({ text: 'جاري تصفير ذاكرة الكاش المؤقتة وإعادة مزامنة البيانات...', type: 'loading' });
    try {
      await resetAppCaches({ includeOfflineAudio: false });
      await syncBundledOfflineAssets().catch(() => {});
      await onRefreshModels().catch(() => {});
      showTimedRefreshMessage({ text: 'تم تصفير الكاش بنجاح مع الحفاظ على السور الصوتية المحملة.', type: 'success' }, 5000);
    } catch {
      showTimedRefreshMessage({ text: 'تعذر تصفير جزء من الكاش، أعد المحاولة.', type: 'error' }, 5000);
    } finally {
      setIsResettingCache(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    showTimedRefreshMessage({ text: 'جاري تحديث نماذج الذكاء الاصطناعي من السحاب...', type: 'loading' });
    try {
      await onRefreshModels();
      showTimedRefreshMessage({ text: 'تم تحديث النماذج بنجاح من السحاب!', type: 'success' }, 4000);
    } catch (e: any) {
      console.error(e);
      showTimedRefreshMessage({ text: `فشل تحديث النماذج: ${e?.message || e || 'خطأ غير معروف'}`, type: 'error' }, 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredVoices = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return VOICES.filter(v => {
      const matchesCategory = voiceCategory === 'all' || v.category === voiceCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        v.name.toLowerCase().includes(term) ||
        v.desc.toLowerCase().includes(term) ||
        v.dialect.toLowerCase().includes(term) ||
        v.categoryLabel.toLowerCase().includes(term)
      );
    });
  }, [searchTerm, voiceCategory]);

  const activeVoiceProfile = React.useMemo(() => resolveGeminiVoice(selectedVoice), [selectedVoice]);

  if (!show) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0, y: -20 }} 
      animate={{ height: 'auto', opacity: 1, y: 0 }} 
      exit={{ height: 0, opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="mb-8 p-6 md:p-8 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-xl rounded-[2rem] border border-amber-200/60 dark:border-amber-800/50 shadow-xl overflow-hidden relative"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300 dark:from-amber-700 dark:via-amber-500 dark:to-amber-700"></div>
      
      <div className="flex justify-between items-center mb-8">
        <div className="flex flex-col gap-1 text-right">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-amber-700 dark:text-amber-400">
              <Settings2 size={24} />
            </div>
            <h3 className="text-2xl font-bold text-amber-950 dark:text-amber-50 font-kufi">إعدادات التطبيق</h3>
          </div>
          {refreshMessage && (
            <div className={`mt-2 text-xs font-sans px-3 py-1.5 rounded-xl border transition-all ${
              refreshMessage.type === 'loading' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40' :
              refreshMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/40' :
              'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/40'
            }`}>
              {refreshMessage.text}
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-2xl text-amber-700 dark:text-amber-400 transition-all hover:scale-105 active:scale-95">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-8">
        <div className="space-y-6 bg-amber-50/50 dark:bg-black/10 p-6 rounded-3xl border border-amber-100/50 dark:border-white/5">
          <h4 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
              إعدادات الذكاء الاصطناعي
            </span>
            <button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className={`p-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 rounded-full transition-all ${isRefreshing ? 'animate-spin opacity-50' : 'hover:scale-110 active:scale-95'}`} 
              title="تحديث النماذج"
            >
              <RefreshCw size={16} />
            </button>
          </h4>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">مزود الذكاء الاصطناعي</label>
            <select 
              value={provider} 
              onChange={(e) => onProviderChange(e.target.value as AIProviderKey)} 
              className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-base transition-all shadow-sm"
            >
              {Object.entries(AI_PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.name} {p.isFree ? '(مجاني)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">نموذج الصوت المتقدم (Gemini TTS)</label>
            <select 
              value={ttsModels.includes(ttsModel) ? ttsModel : (ttsModels[0] || 'gemini-3.8-flash-lite-tts')} 
              onChange={(e) => onTtsModelChange(e.target.value)} 
              className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-base transition-all shadow-sm"
            >
              {ttsModels.map(m => (
                <option key={m} value={m}>
                  {m === 'gemini-3.8-flash-tts' ? 'Gemini 3.8 Flash TTS (تصميم الصوت والتحبير الاحترافي)' :
                   m === 'gemini-3.8-flash-lite-tts' ? 'Gemini 3.8 Flash Lite TTS (سريع وعالي الكفاءة)' :
                   m === 'gemini-3.1-flash-tts-preview' ? 'Gemini 3.1 Flash TTS Preview' : m}
                </option>
              ))}
            </select>
          </div>
          
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-amber-800 dark:text-amber-300">سرعة الذكاء الاصطناعي: {aiRecitationSettings.rate.toFixed(1)}x</label>
              <input type="range" min="0.5" max="2.0" step="0.1" value={aiRecitationSettings.rate} onChange={(e) => onAiRecitationSettingsChange({...aiRecitationSettings, rate: parseFloat(e.target.value)})} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-amber-800 dark:text-amber-300">نبرة الذكاء الاصطناعي: {aiRecitationSettings.pitch.toFixed(1)}</label>
              <input type="range" min="0.5" max="2.0" step="0.1" value={aiRecitationSettings.pitch} onChange={(e) => onAiRecitationSettingsChange({...aiRecitationSettings, pitch: parseFloat(e.target.value)})} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-amber-800 dark:text-amber-300">سرعة التلاوة البشرية: {humanRecitationSettings.rate.toFixed(1)}x</label>
              <input type="range" min="0.5" max="2.0" step="0.1" value={humanRecitationSettings.rate} onChange={(e) => onHumanRecitationSettingsChange({...humanRecitationSettings, rate: parseFloat(e.target.value)})} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-amber-800 dark:text-amber-300">نبرة التلاوة البشرية: {humanRecitationSettings.pitch.toFixed(1)}</label>
              <input type="range" min="0.5" max="2.0" step="0.1" value={humanRecitationSettings.pitch} onChange={(e) => onHumanRecitationSettingsChange({...humanRecitationSettings, pitch: parseFloat(e.target.value)})} className="w-full" />
            </div>
          </div>
          
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1 flex justify-between items-center">
              <span>صوت القارئ — جيميني ({VOICES.length} صوتاً دون تكرار)</span>
              <span className="text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
                {filteredVoices.length} من {VOICES.length}
              </span>
            </label>

            {/* Category / Dialect Filter Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: `الكل (${VOICES.length})` },
                { id: 'fusha-tahbir', label: 'تحبير شجي (فصحى)' },
                { id: 'fusha-tartil', label: 'ترتيل الفصحى' },
                { id: 'moroccan-tartil', label: 'التلاوة المغربية' },
                { id: 'moroccan-darija', label: 'الدارجة المغربية' },
                { id: 'classic', label: 'القائمة السابقة' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setVoiceCategory(cat.id as 'all' | VoiceCategory)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    voiceCategory === cat.id
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white/80 dark:bg-[#1c1917] text-amber-900 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/50 hover:bg-amber-100/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <input 
              type="text"
              placeholder="🔍 ابحث بالاسم أو المقام أو اللهجة (مثال: مغربي، دارجة، الحجاز، الصبا)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-3 text-sm rounded-xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 transition-all shadow-sm placeholder:text-amber-900/40 dark:placeholder:text-amber-100/40"
            />
            <select 
              value={activeVoiceProfile.id} 
              onChange={(e) => onVoiceChange(e.target.value)} 
              className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-base transition-all shadow-sm"
            >
              {filteredVoices.length === 0 ? (
                <option value="" disabled>لا يوجد نتائج تطابق بحثك</option>
              ) : (
                filteredVoices.map(v => (
                  <option key={v.id} value={v.id} title={v.desc}>
                    {v.name} [{v.dialect}]
                  </option>
                ))
              )}
            </select>

            {/* Selected Voice Profile Card */}
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-black/25 border border-amber-200/70 dark:border-amber-800/40 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-amber-950 dark:text-amber-100">{activeVoiceProfile.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold">
                    {activeVoiceProfile.dialect}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-bold">
                    {activeVoiceProfile.baseVoice}
                  </span>
                </div>
              </div>
              <p className="text-amber-800/80 dark:text-amber-200/75 leading-relaxed">
                {activeVoiceProfile.desc}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">مفتاح API</label>
            <input
              type="password"
              placeholder={`أدخل مفتاح ${AI_PROVIDERS[provider].name}`}
              value={apiKeyInput}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="p-4 text-base rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 shadow-sm placeholder:text-amber-900/30 dark:placeholder:text-amber-100/30"
              dir="ltr"
            />
            <p className="text-[11px] text-amber-600 dark:text-amber-400/70 mt-1 mr-2 flex items-center gap-1">
              احصل على المفتاح مجاناً من ← 
              <a 
                href={
                  provider === 'gemini' ? 'https://aistudio.google.com/app/apikey' : 
                  provider === 'groq' ? 'https://console.groq.com/keys' : 
                  provider === 'deepseek' ? 'https://platform.deepseek.com/api_keys' : 
                  provider === 'openrouter' ? 'https://openrouter.ai/keys' : 
                  provider === 'mistral' ? 'https://console.mistral.ai' : 
                  provider === 'routeway' ? 'https://routeway.ai' : 
                  provider === 'stability' ? 'https://platform.stability.ai/account/keys' : 
                  'https://huggingface.co/settings/tokens'
                } 
                target="_blank" 

                rel="noopener noreferrer" 
                className="underline font-bold hover:text-amber-900 dark:hover:text-amber-100 ml-1"
              >
                {AI_PROVIDERS[provider].name}
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">حجم الخط ({fontSize}px)</label>
            <input 
              type="range" 
              min="12" 
              max="32" 
              value={fontSize} 
              onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10) || 18)}
              className="w-full h-2 bg-amber-200 dark:bg-amber-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>
        </div>

        <div className="space-y-6 bg-amber-50/50 dark:bg-black/10 p-6 rounded-3xl border border-amber-100/50 dark:border-white/5">
          <h4 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            إعدادات العرض والقراءة
          </h4>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">ترجمة معاني القرآن</label>
            <select 
              value={selectedTranslation} 
              onChange={(e) => onTranslationChange(e.target.value)} 
              className="w-full p-4 rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-base transition-all shadow-sm"
            >
              {TRANSLATIONS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">القراءة</label>
            <select 
              value={selectedQiraat} 
              onChange={(e) => onQiraatChange(e.target.value)} 
              className="w-full p-4 rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-base transition-all shadow-sm"
            >
              {QIRAAT.map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1">نوع الخط</label>
            <select 
              value={fontFamily} 
              onChange={(e) => onFontFamilyChange(e.target.value)} 
              className="w-full p-4 rounded-2xl border border-amber-200 dark:border-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-base transition-all shadow-sm"
            >
              <option value="font-amiri">أميري (Amiri)</option>
              <option value="font-sans">افتراضي (Sans)</option>
              <option value="font-mono">نصي (Mono)</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="text-sm font-bold text-amber-800 dark:text-amber-300 mr-1 block mb-2">تطبيق الويب التقدمي (PWA)</label>
            <PWAInstallButton variant="full" />
          </div>

          <div className="space-y-2.5 mt-4">
            <button
              type="button"
              onClick={handleClearRuntimeCache}
              disabled={isResettingCache}
              className="w-full flex items-center justify-center gap-2 p-4 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-amber-900/20 dark:hover:bg-amber-900/35 text-amber-900 dark:text-amber-200 rounded-2xl border border-amber-300/60 dark:border-amber-700/40 transition-all font-bold hover:scale-[1.01] active:scale-95 disabled:opacity-60"
            >
              <Trash2 size={18} />
              {isResettingCache ? 'جاري تصفير الكاش...' : 'تصفير الكاش المؤقت (مع حفظ التلاوات)'}
            </button>

            <button 
              onClick={() => {
                onResetApp();
              }}
              className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-200/50 dark:border-red-900/30 transition-all font-bold hover:scale-[1.02] active:scale-95"
            >
              <RotateCcw size={18} />
              إعادة تعيين التطبيق
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mb-8">
        <LiveVoiceSettingsSection />
      </div>

      <div className="max-w-5xl mx-auto">
        <OfflineDownloadManager
          quranData={quranData}
          activeReciter={selectedReciter}
          onSelectReciter={onReciterChange}
        />
      </div>
    </motion.div>
  );
};
