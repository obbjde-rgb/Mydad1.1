import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Radio, Volume2, Globe, Cpu, Brain, Sparkles, Plus, Trash2, Wrench } from 'lucide-react';
import {
  GEMINI_LIVE_VOICES,
  GeminiLiveVoiceName,
  LiveVoiceSettings,
  addLearnedMemoryNote,
  clearLiveTranscriptMemory,
  fetchLiveModelsFromAPI,
  getCachedLiveModels,
  loadLiveVoiceSettings,
  removeLearnedMemoryNote,
  saveLiveVoiceSettings,
} from '../../services/liveMemoryService';

interface LiveVoiceSettingsSectionProps {
  compact?: boolean;
  onSettingsChange?: (settings: LiveVoiceSettings) => void;
  onClearTranscriptUI?: () => void;
}

export const LiveVoiceSettingsSection: React.FC<LiveVoiceSettingsSectionProps> = ({
  compact = false,
  onSettingsChange,
  onClearTranscriptUI,
}) => {
  const [settings, setSettings] = useState<LiveVoiceSettings>(() => loadLiveVoiceSettings());
  const [liveModels, setLiveModels] = useState<string[]>(() => getCachedLiveModels());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newMemoryNote, setNewMemoryNote] = useState('');
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTempStatus = (msg: string, durationMs = 4000) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    const onModels = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (Array.isArray(detail)) setLiveModels(detail);
      else setLiveModels(getCachedLiveModels());
    };
    const onSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as LiveVoiceSettings | undefined;
      if (detail) setSettings(detail);
    };
    window.addEventListener('live_models_updated', onModels);
    window.addEventListener('live_settings_updated', onSettingsUpdated);
    return () => {
      window.removeEventListener('live_models_updated', onModels);
      window.removeEventListener('live_settings_updated', onSettingsUpdated);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  // Automatically fetch latest Live models from API on first mount
  useEffect(() => {
    void fetchLiveModelsFromAPI()
      .then((res) => {
        if (res.models.length > 0) setLiveModels(res.models);
      })
      .catch(() => {});
  }, []);

  const updateSettings = (patch: Partial<LiveVoiceSettings>) => {
    const next: LiveVoiceSettings = { ...settings, ...patch };
    setSettings(next);
    saveLiveVoiceSettings(next);
    onSettingsChange?.(next);
  };

  const handleRefreshLiveModels = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setStatusMessage('جاري جلب نماذج Live من Gemini API...');
    try {
      const res = await fetchLiveModelsFromAPI();
      setLiveModels(res.models);
      showTempStatus(
        res.apiCount > 0
          ? `تم استدعاء ${res.models.length} نموذج بث مباشر من API بنجاح.`
          : `تم تحديث القائمة (${res.models.length} نماذج جاهزة للبث المباشر).`,
        4000
      );
    } catch (err: any) {
      showTempStatus(err?.message || 'تعذر جلب النماذج من API حالياً.', 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddMemory = () => {
    const clean = newMemoryNote.trim();
    if (!clean) return;
    const updated = addLearnedMemoryNote(clean, 'تفضيل شخصي');
    setSettings(updated);
    onSettingsChange?.(updated);
    setNewMemoryNote('');
  };

  const handleRemoveMemory = (idx: number) => {
    const updated = removeLearnedMemoryNote(idx);
    setSettings(updated);
    onSettingsChange?.(updated);
  };

  const formatModelLabel = (modelId: string) => {
    if (modelId === 'gemini-2.5-flash-native-audio-latest') {
      return 'gemini-2.5-flash-native-audio-latest (الصوتي المباشر الموصى به — صوت + بحث + أدوات)';
    }
    if (modelId === 'gemini-2.5-flash-native-audio-preview-12-2025') {
      return 'gemini-2.5-flash-native-audio-preview-12-2025 (صوت مباشر متقدم)';
    }
    if (modelId === 'gemini-2.5-flash-native-audio-preview-09-2025') {
      return 'gemini-2.5-flash-native-audio-preview-09-2025 (صوت مباشر + تفكير)';
    }
    if (modelId === 'gemini-robotics-er-2-streaming-preview') {
      return 'gemini-robotics-er-2-streaming-preview (بث تفاعلي ذكي بالمايك والنص + نطق صوتي)';
    }
    if (modelId === 'gemini-3.8-live') {
      return 'gemini-3.8-live (البث الصوتي المباشر السريع — يتطلب حصة 3.8)';
    }
    if (modelId === 'gemini-3.8-live-extended-thinking') {
      return 'gemini-3.8-live-extended-thinking (تفكير معمّق — يتطلب حصة 3.8)';
    }
    if (modelId === 'gemini-3.5-live-translate-preview') {
      return 'gemini-3.5-live-translate-preview (الترجمة الصوتية الفورية)';
    }
    if (modelId === 'gemini-3.5-transcribe-live') {
      return 'gemini-3.5-transcribe-live (التفريغ النصي المباشر)';
    }
    return modelId;
  };

  const renderToggle = (
    checked: boolean,
    onToggle: () => void,
    activeColorClass: string,
    label: string,
    icon: React.ReactNode
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
        checked
          ? 'bg-white dark:bg-[#1c1917] border-sky-300/80 dark:border-sky-700/60 text-amber-950 dark:text-amber-50 shadow-sm'
          : 'bg-white/50 dark:bg-[#1c1917]/40 border-amber-200/40 dark:border-white/5 text-amber-900/60 dark:text-amber-200/50'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        dir="ltr"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? activeColorClass : 'bg-stone-300 dark:bg-stone-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );

  return (
    <div
      className={`${compact ? 'p-4 rounded-2xl' : 'p-6 rounded-3xl'} bg-gradient-to-br from-sky-50/80 to-amber-50/50 dark:from-sky-950/20 dark:to-black/20 border border-sky-200/70 dark:border-sky-800/40 space-y-4 text-right`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-600 text-white shadow-sm">
            <Radio size={18} />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100 font-kufi">
              إعدادات المحادثة الصوتية المباشرة (Gemini Live)
            </h4>
            <p className="text-[11px] text-amber-800/70 dark:text-amber-200/70">
              تعمل مباشرة بالنموذج المختار دون تراجع تلقائي، مع حفظ السياق والتعلّم من محادثاتك.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefreshLiveModels}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1c1917] border border-sky-200 dark:border-sky-800 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 transition-all disabled:opacity-60"
          title="تحديث قائمة نماذج Live من API"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">تحديث من API</span>
        </button>
      </div>

      {statusMessage && (
        <div className="text-xs px-3 py-2 rounded-xl bg-sky-100/80 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 border border-sky-200/60 dark:border-sky-800/40">
          {statusMessage}
        </div>
      )}

      <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-4`}>
        {/* Dynamic Live Models Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Cpu size={14} className="text-sky-600" />
            نموذج البث المباشر (بدون تراجع تلقائي)
          </label>
          <select
            value={liveModels.includes(settings.model) ? settings.model : liveModels[0] || settings.model}
            onChange={(e) => updateSettings({ model: e.target.value })}
            className="p-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-xs sm:text-sm font-medium outline-none focus:border-sky-500"
            dir="ltr"
          >
            {liveModels.map((m) => (
              <option key={m} value={m}>
                {formatModelLabel(m)}
              </option>
            ))}
          </select>
          {settings.model.toLowerCase().includes('robotics') && (
            <span className="text-[11px] text-sky-700 dark:text-sky-300">
              يستقبل المايك والكتابة والبحث والأدوات، ويُخرج الرد نصياً مع نطق صوتي آلي عند تفعيل «رد صوتي مباشر».
            </span>
          )}
        </div>

        {/* Prebuilt Live Voice */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Volume2 size={14} className="text-sky-600" />
            نبرة الصوت الحي في الجلسة
          </label>
          <select
            value={settings.voiceName}
            onChange={(e) => updateSettings({ voiceName: e.target.value as GeminiLiveVoiceName })}
            className="p-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 text-xs sm:text-sm font-medium outline-none focus:border-sky-500"
          >
            {GEMINI_LIVE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} — {v.desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Capabilities & Thinking Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {renderToggle(
          settings.enableAudioOutput,
          () => updateSettings({ enableAudioOutput: !settings.enableAudioOutput }),
          'bg-sky-600',
          'رد صوتي مباشر',
          <Volume2 size={14} className="text-sky-600" />
        )}
        {renderToggle(
          settings.enableWebSearch,
          () => updateSettings({ enableWebSearch: !settings.enableWebSearch }),
          'bg-emerald-600',
          'البحث الحي فالويب',
          <Globe size={14} className="text-emerald-600" />
        )}
        {renderToggle(
          settings.enableAppControl,
          () => updateSettings({ enableAppControl: !settings.enableAppControl }),
          'bg-amber-600',
          'تنفيذ أوامر التطبيق',
          <Wrench size={14} className="text-amber-600" />
        )}
        {renderToggle(
          settings.autoLearnFromChats,
          () => updateSettings({ autoLearnFromChats: !settings.autoLearnFromChats }),
          'bg-purple-600',
          'التعلّم من محادثاتك',
          <Sparkles size={14} className="text-purple-600" />
        )}
      </div>

      {/* Thinking Depth & Custom Persona */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Brain size={14} className="text-amber-600" />
            مستوى التفكير للنماذج الداعمة
          </label>
          <select
            value={settings.thinkingLevel}
            onChange={(e) =>
              updateSettings({ thinkingLevel: e.target.value as LiveVoiceSettings['thinkingLevel'] })
            }
            className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-[#1c1917] text-xs font-bold text-amber-950 dark:text-amber-100 outline-none"
          >
            <option value="off">تلقائي / إيقاف</option>
            <option value="LOW">منخفض (أسرع استجابة)</option>
            <option value="MEDIUM">متوازن</option>
            <option value="HIGH">عميق (للتفكير المعقد)</option>
          </select>
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
            تخصيص أسلوب وشخصية المحادثة الصوتية المباشرة
          </label>
          <textarea
            value={settings.customPersona}
            onChange={(e) => updateSettings({ customPersona: e.target.value })}
            rows={2}
            placeholder="مثال: تحدث معي بالدارجة المغربية أو الفصحى المبسطة، ركز على التدبر العملي وربط الآيات بواقعي..."
            className="w-full p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-[#1c1917] text-xs text-amber-950 dark:text-amber-50 outline-none focus:border-sky-500 resize-none"
          />
        </div>
      </div>

      {/* Learned Memory & Preferences Manager */}
      <div className="p-3 rounded-2xl bg-white/70 dark:bg-black/25 border border-amber-200/50 dark:border-white/10 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-amber-950 dark:text-amber-100">
            الذاكرة الشخصية وتفضيلات المستخدم المتعلّمة ({settings.memoryNotes.length})
          </span>
          <button
            type="button"
            onClick={() => {
              clearLiveTranscriptMemory();
              onClearTranscriptUI?.();
              showTempStatus('تم مسح سجل الجلسات الصوتية السابقة مع الإبقاء على التفضيلات.', 3500);
            }}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            مسح سجل البث الصوتي
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newMemoryNote}
            onChange={(e) => setNewMemoryNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMemory();
              }
            }}
            placeholder="أضف تفضيلاً ليتذكره دائماً (مثال: أفضل رواية ورش، أحب الدارجة المغربية، ركز على ابن كثير)..."
            className="flex-1 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-[#1c1917] text-xs text-amber-950 dark:text-amber-50 outline-none"
          />
          <button
            type="button"
            onClick={handleAddMemory}
            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Plus size={14} />
            حفظ
          </button>
        </div>

        {settings.memoryNotes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
            {settings.memoryNotes.map((note, idx) => (
              <span
                key={`${idx}-${note.slice(0, 12)}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/80 dark:bg-amber-900/30 text-amber-950 dark:text-amber-100 text-[11px] border border-amber-200/60 dark:border-amber-800/40"
              >
                <span>{note}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMemory(idx)}
                  className="text-rose-500 hover:text-rose-700"
                  title="حذف من الذاكرة"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
