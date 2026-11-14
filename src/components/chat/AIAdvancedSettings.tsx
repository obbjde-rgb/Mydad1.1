import React, { useState } from 'react';
import { Sliders, Brain, Globe, Sparkles, ChevronDown, ChevronUp, RotateCcw, MessageSquare, Maximize2, Layers } from 'lucide-react';
import {
  AIAdvancedConfig,
  AI_PRESETS,
  AIPresetKey,
  DEFAULT_AI_ADVANCED_CONFIG,
  ReasoningEffort,
  ResponseDepth
} from '../../services/aiService';

interface AIAdvancedSettingsProps {
  config: AIAdvancedConfig;
  onChange: (next: AIAdvancedConfig) => void;
  extraTool?: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
  customPlaceholder?: string;
}

const TOKEN_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Auto-Max', value: 0 },
  { label: '4K', value: 4096 },
  { label: '8K', value: 8192 },
  { label: '16K', value: 16384 },
  { label: '32K', value: 32768 },
  { label: '64K', value: 65536 },
  { label: '128K', value: 131072 }
];

const REASONING_OPTIONS: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'off', label: 'إيقاف' },
  { value: 'low', label: 'خفيف' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'عميق' },
  { value: 'max', label: 'أقصى طاقة' }
];

const DEPTH_OPTIONS: Array<{ value: ResponseDepth; label: string }> = [
  { value: 'concise', label: 'موجز' },
  { value: 'balanced', label: 'متوازن' },
  { value: 'deep', label: 'معمّق' },
  { value: 'encyclopedic', label: 'موسوعي' }
];

const CONTEXT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 10, label: '10 رسائل' },
  { value: 20, label: '20 رسالة' },
  { value: 40, label: '40 رسالة' },
  { value: 80, label: '80 رسالة' },
  { value: 0, label: 'كل السجل' }
];

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    dir="ltr"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
      checked ? 'bg-amber-600' : 'bg-amber-200 dark:bg-zinc-700'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export const AIAdvancedSettings: React.FC<AIAdvancedSettingsProps> = ({
  config,
  onChange,
  extraTool,
  customPlaceholder = 'أضف تعليمات دائمة للنموذج (الأسلوب، المراجع، اللغة، التفصيل...)'
}) => {
  const [showSampling, setShowSampling] = useState(false);

  const updateField = <K extends keyof AIAdvancedConfig>(key: K, value: AIAdvancedConfig[K]) => {
    onChange({
      ...config,
      preset: key === 'preset' ? (value as AIPresetKey) : 'custom',
      [key]: value
    });
  };

  const applyPreset = (presetKey: Exclude<AIPresetKey, 'custom'>) => {
    const preset = AI_PRESETS[presetKey];
    onChange({
      ...config,
      ...preset.values,
      preset: presetKey
    });
  };

  const formatMaxTokensDisplay = (val: number) => {
    if (val === 0) {
      return 'أقصى حد متاح للنموذج تلقائياً (حتى 128K رمز)';
    }
    const approxWords = Math.round(val * 0.7);
    return `${val.toLocaleString('en-US')} رمز · ≈ ${approxWords.toLocaleString('en-US')} كلمة`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Smart AI Profiles */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Sparkles size={14} /> أوضاع التشغيل العلمية
          </label>
          <span className="text-[11px] text-amber-700/70 dark:text-amber-300/70">
            {config.preset === 'custom' ? 'ضبط مخصص' : AI_PRESETS[config.preset].label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(AI_PRESETS) as Array<Exclude<AIPresetKey, 'custom'>>).map((key) => {
            const p = AI_PRESETS[key];
            const isActive = config.preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`text-right p-2.5 rounded-xl border transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/60 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 hover:border-amber-400'
                }`}
              >
                <div className="text-xs font-bold whitespace-nowrap truncate">{p.label}</div>
                <div className={`text-[10px] mt-0.5 leading-snug ${isActive ? 'text-amber-50' : 'text-amber-700/75 dark:text-amber-300/75'}`}>
                  {p.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-amber-200/40 dark:bg-amber-800/30" />

      {/* 2. Maximum Response Length */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Maximize2 size={14} /> طول الاستجابة الأقصى
          </label>
          <button
            type="button"
            onClick={() => updateField('maxTokens', 0)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              config.maxTokens === 0
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200'
            }`}
          >
            الأقصى تلقائياً
          </button>
        </div>

        <div className="text-xs font-bold text-amber-900 dark:text-amber-100 tabular-nums">
          {formatMaxTokensDisplay(config.maxTokens)}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {TOKEN_PRESETS.map((tp) => {
            const active = config.maxTokens === tp.value;
            return (
              <button
                key={tp.label}
                type="button"
                onClick={() => updateField('maxTokens', tp.value)}
                className={`py-2 px-1 rounded-lg text-[11px] font-bold tabular-nums border transition-all whitespace-nowrap ${
                  active
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-white dark:bg-black/20 border-amber-200/70 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 hover:border-amber-400'
                }`}
              >
                {tp.label}
              </button>
            );
          })}
        </div>

        <div className="pt-1">
          <input
            type="range"
            min={1024}
            max={131072}
            step={1024}
            value={config.maxTokens === 0 ? 131072 : config.maxTokens}
            onChange={(e) => updateField('maxTokens', Number(e.target.value))}
            className="w-full accent-amber-600 cursor-pointer"
            aria-label="تحديد الحد الأقصى لرموز الاستجابة"
          />
          <div className="flex justify-between text-[10px] text-amber-700/70 dark:text-amber-300/70 tabular-nums mt-0.5">
            <span>1K رمز</span>
            <span>32K</span>
            <span>64K</span>
            <span>128K رمز</span>
          </div>
        </div>
        <p className="text-[11px] text-amber-700/75 dark:text-amber-300/75 leading-relaxed">
          في وضع «الأقصى تلقائياً» يطلب النظام أعلى سقف يدعمه النموذج المختار مع التكيّف التلقائي دون أخطاء إذا كان حد النموذج أقل.
        </p>
      </section>

      <div className="h-px bg-amber-200/40 dark:bg-amber-800/30" />

      {/* 3. Reasoning Effort & Response Depth */}
      <section className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Brain size={14} /> محرك التفكير والاستدلال (Reasoning Effort)
          </label>
          <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-amber-100/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40">
            {REASONING_OPTIONS.map((opt) => {
              const active = config.reasoningEffort === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('reasoningEffort', opt.value)}
                  className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-800 dark:text-amber-200 hover:bg-white/70 dark:hover:bg-black/20'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Layers size={14} /> عمق الاستجابة والتفصيل
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-amber-100/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40">
            {DEPTH_OPTIONS.map((opt) => {
              const active = config.responseDepth === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('responseDepth', opt.value)}
                  className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-800 dark:text-amber-200 hover:bg-white/70 dark:hover:bg-black/20'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="h-px bg-amber-200/40 dark:bg-amber-800/30" />

      {/* 4. Tools & Display Behavior */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 py-1 min-h-[40px]">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-100">
            <Globe size={15} className="text-emerald-600 shrink-0" />
            <span>بحث الويب الحقيقي (Google Search)</span>
          </div>
          <ToggleSwitch checked={config.enableWebSearch} onChange={(v) => updateField('enableWebSearch', v)} />
        </div>

        <div className="flex items-center justify-between gap-3 py-1 min-h-[40px]">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-100">
            <Brain size={15} className="text-amber-600 shrink-0" />
            <span>فتح مسار التفكير تلقائياً</span>
          </div>
          <ToggleSwitch checked={config.autoOpenThoughts} onChange={(v) => updateField('autoOpenThoughts', v)} />
        </div>

        {extraTool && (
          <div className="flex items-center justify-between gap-3 py-1 min-h-[40px]">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-100">
              <span>{extraTool.label}</span>
              {extraTool.description && (
                <p className="text-[10px] font-normal text-amber-700/75 dark:text-amber-300/75 mt-0.5">
                  {extraTool.description}
                </p>
              )}
            </div>
            <ToggleSwitch checked={extraTool.checked} onChange={extraTool.onChange} />
          </div>
        )}
      </section>

      <div className="h-px bg-amber-200/40 dark:bg-amber-800/30" />

      {/* 5. Scientific Fine-Tuning Sampling Parameters */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowSampling(!showSampling)}
          className="w-full flex items-center justify-between py-2 text-right min-h-[44px]"
        >
          <div>
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Sliders size={14} /> الضبط العلمي الدقيق (Sampling & Memory)
            </div>
            <div className="text-[11px] text-amber-700/70 dark:text-amber-300/70 tabular-nums mt-0.5">
              Temp {config.temperature.toFixed(2)} · Top-P {config.topP.toFixed(2)} · ذاكرة {config.contextWindow === 0 ? 'كاملة' : config.contextWindow}
            </div>
          </div>
          {showSampling ? <ChevronUp size={18} className="text-amber-600" /> : <ChevronDown size={18} className="text-amber-600" />}
        </button>

        {showSampling && (
          <div className="space-y-4 pt-2 border-t border-amber-200/40 dark:border-amber-800/30">
            {/* Temperature */}
            <div>
              <div className="flex justify-between text-xs font-bold text-amber-900 dark:text-amber-100 mb-1 tabular-nums">
                <span>درجة الإبداع (Temperature)</span>
                <span>{config.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={config.temperature}
                onChange={(e) => updateField('temperature', Number(e.target.value))}
                className="w-full accent-amber-600"
              />
              <div className="flex justify-between text-[10px] text-amber-700/70 dark:text-amber-300/70">
                <span>0.0 حتمي دقيق</span>
                <span>0.65 متوازن</span>
                <span>1.5 إبداعي حر</span>
              </div>
            </div>

            {/* Top-P */}
            <div>
              <div className="flex justify-between text-xs font-bold text-amber-900 dark:text-amber-100 mb-1 tabular-nums">
                <span>نواة الاحتمالات (Top-P)</span>
                <span>{config.topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={config.topP}
                onChange={(e) => updateField('topP', Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            {/* Top-K */}
            <div>
              <div className="flex justify-between text-xs font-bold text-amber-900 dark:text-amber-100 mb-1 tabular-nums">
                <span>انتقاء المفردات (Top-K)</span>
                <span>{config.topK}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={config.topK}
                onChange={(e) => updateField('topK', Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            {/* Frequency Penalty */}
            <div>
              <div className="flex justify-between text-xs font-bold text-amber-900 dark:text-amber-100 mb-1 tabular-nums">
                <span>كبح تكرار الألفاظ (Frequency Penalty)</span>
                <span>{config.frequencyPenalty.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={config.frequencyPenalty}
                onChange={(e) => updateField('frequencyPenalty', Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            {/* Presence Penalty */}
            <div>
              <div className="flex justify-between text-xs font-bold text-amber-900 dark:text-amber-100 mb-1 tabular-nums">
                <span>تنوع الأفكار والمحاور (Presence Penalty)</span>
                <span>{config.presencePenalty.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={config.presencePenalty}
                onChange={(e) => updateField('presencePenalty', Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            {/* Context Window */}
            <div>
              <label className="text-xs font-bold text-amber-900 dark:text-amber-100 block mb-2">
                ذاكرة سياق المحادثة (Context Window)
              </label>
              <div className="grid grid-cols-5 gap-1">
                {CONTEXT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('contextWindow', opt.value)}
                    className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap tabular-nums ${
                      config.contextWindow === opt.value
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white dark:bg-black/20 border-amber-200/70 dark:border-amber-800/50 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="h-px bg-amber-200/40 dark:bg-amber-800/30" />

      {/* 6. Custom System Instructions */}
      <section className="space-y-2">
        <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <MessageSquare size={14} /> تعليمات النظام المخصصة (System Prompt)
        </label>
        <textarea
          value={config.customInstructions}
          onChange={(e) => updateField('customInstructions', e.target.value)}
          placeholder={customPlaceholder}
          className="w-full p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800/60 text-xs outline-none focus:ring-1 focus:ring-amber-500 h-24 resize-none leading-relaxed"
          dir="rtl"
        />
      </section>

      {/* 7. Reset AI Parameters Only */}
      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_AI_ADVANCED_CONFIG })}
        className="w-full py-2.5 px-4 rounded-xl border border-amber-300/70 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[42px]"
      >
        <RotateCcw size={14} /> استعادة معايير الذكاء الافتراضية (الأقصى)
      </button>
    </div>
  );
};
