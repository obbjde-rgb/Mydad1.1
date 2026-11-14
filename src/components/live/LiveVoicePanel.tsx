import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Settings2,
  Volume2,
  VolumeX,
  Trash2,
  Radio,
  Loader2,
  AlertTriangle,
  Sparkles,
  Brain,
} from 'lucide-react';
import { useGeminiLiveSession } from '../../hooks/useGeminiLiveSession';
import { LiveAppSnapshot, clearLiveTranscriptMemory } from '../../services/liveMemoryService';
import { LiveVoiceSettingsSection } from './LiveVoiceSettingsSection';

interface LiveVoicePanelProps {
  snapshot: LiveAppSnapshot;
  onAction?: (action: string, data?: any) => void;
  title?: string;
}

export const LiveVoicePanel: React.FC<LiveVoicePanelProps> = ({
  snapshot,
  onAction,
  title,
}) => {
  const {
    status,
    activeModel,
    errorMsg,
    isMicActive,
    isModelSpeaking,
    interimUserText,
    messages,
    setMessages,
    settings,
    connect,
    disconnect,
    toggleMic,
    sendText,
    clearAudioQueue,
  } = useGeminiLiveSession(snapshot, onAction);

  const [textInput, setTextInput] = useState('');
  const [showLiveSettings, setShowLiveSettings] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimUserText, isModelSpeaking]);

  const handleSendText = async () => {
    const clean = textInput.trim();
    if (!clean) return;
    setTextInput('');
    await sendText(clean);
  };

  const handleClearChat = () => {
    clearLiveTranscriptMemory();
    setMessages([]);
  };

  const displayTitle =
    title ||
    (snapshot.personaMode === 'midad'
      ? 'مداد الرحمن — البث الصوتي والنصي المباشر'
      : 'المحادثة الصوتية المباشرة الحية');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-sky-50/40 via-[#fcfaf7] to-amber-50/30 dark:from-[#0c0a09] dark:via-[#141210] dark:to-[#0c0a09]" dir="rtl">
      {/* Top Status & Quick Settings Bar */}
      <div className="px-4 py-3 border-b border-sky-200/40 dark:border-sky-900/30 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${
              status === 'connected'
                ? 'bg-emerald-600'
                : status === 'connecting'
                ? 'bg-amber-500'
                : status === 'error'
                ? 'bg-rose-600'
                : 'bg-sky-600'
            }`}
          >
            {status === 'connecting' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Radio size={18} className={status === 'connected' ? 'animate-pulse' : ''} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-50 font-kufi truncate">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-amber-800/70 dark:text-amber-200/70 truncate">
              <span className="font-mono" dir="ltr">
                {activeModel || settings.model}
              </span>
              <span>•</span>
              <span>
                {status === 'connected'
                  ? isModelSpeaking
                    ? 'يتحدث الآن...'
                    : isMicActive
                    ? 'متصل (الميكروفون يستمع)'
                    : 'متصل (جاهز للصوت والكتابة)'
                  : status === 'connecting'
                  ? 'جاري فتح الجلسة الحية...'
                  : status === 'error'
                  ? 'تعذر الاتصال بالنموذج المختار'
                  : 'غير متصل — اضغط بدء الجلسة أو اكتب مباشرة'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isModelSpeaking && (
            <button
              type="button"
              onClick={clearAudioQueue}
              className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-xs font-bold flex items-center gap-1 transition-colors"
              title="إسكات الصوت الحالي"
            >
              <VolumeX size={14} />
              <span className="hidden sm:inline">إيقاف الصوت</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLiveSettings(!showLiveSettings)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              showLiveSettings
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-white dark:bg-[#292524] text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/50 hover:bg-sky-50'
            }`}
            title="إعدادات المحادثة الصوتية المباشرة والذاكرة"
          >
            <Settings2 size={14} />
            <span>إعدادات الصوت المباشر</span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="تفريغ محادثة البث المباشر"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Live Settings Drawer */}
      {showLiveSettings && (
        <div className="p-3 sm:p-4 border-b border-sky-200/40 dark:border-sky-900/30 max-h-[55vh] overflow-y-auto shrink-0 bg-white/60 dark:bg-black/30">
          <LiveVoiceSettingsSection
            compact
            onClearTranscriptUI={() => setMessages([])}
          />
        </div>
      )}

      {/* Error Banner (No Silent Fallback Notice) */}
      {errorMsg && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2 shrink-0">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 space-y-1">
            <p className="font-bold">{errorMsg}</p>
            <p className="opacity-80">
              يمكنك اختيار نموذج Live آخر يدوياً من «إعدادات الصوت المباشر» بالأعلى إذا كان مفتاح API الحالي لا يدعم هذا النموذج.
            </p>
          </div>
        </div>
      )}

      {/* Live Streaming Transcript Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-amber-600 text-white flex items-center justify-center shadow-lg">
              <Sparkles size={28} />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-amber-950 dark:text-amber-100 font-kufi">
                تحدّث بصوتك أو اكتب مباشرة — استجابة صوتية ونصية فورية
              </h4>
              <p className="text-xs sm:text-sm text-amber-800/75 dark:text-amber-200/75 leading-relaxed">
                يستفيد النظام الصوتي المباشر من ذاكرة تطبيقك الكاملة: يعلم ما تقرؤه أو تبحث عنه الآن، ويتعلم من محادثاتك السابقة في «مداد الرحمن» و«المساعد الذكي»، وينفّذ أوامرك داخل التطبيق فوراً.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => connect(true)}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white text-sm font-bold shadow-md flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <PhoneCall size={16} />
                بدء محادثة صوتية حية بالميكروفون
              </button>
              <button
                type="button"
                onClick={() => connect(false)}
                className="px-4 py-2.5 rounded-2xl bg-white dark:bg-[#1c1917] border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm font-bold hover:bg-amber-50 transition-all"
              >
                فتح جلسة نص وصوت (بدون ميكروفون)
              </button>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            if (m.role === 'system-action') {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="px-3 py-1 rounded-xl bg-amber-100/90 dark:bg-amber-900/30 border border-amber-300/60 dark:border-amber-700/40 text-amber-900 dark:text-amber-200 text-xs font-bold">
                    {m.text}
                  </span>
                </div>
              );
            }
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm border ${
                    isUser
                      ? 'bg-gradient-to-br from-sky-600 to-blue-700 text-white border-sky-500/30 rounded-tr-none'
                      : 'bg-white dark:bg-[#1c1917] text-amber-950 dark:text-amber-50 border-amber-200/50 dark:border-amber-800/40 rounded-tl-none'
                  }`}
                >
                  {!isUser && m.thought && (
                    <details className="mb-2 text-[11px] bg-amber-50/70 dark:bg-black/25 p-2 rounded-xl border border-amber-200/40 dark:border-amber-800/30">
                      <summary className="cursor-pointer font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <Brain size={12} /> مسار التفكير المباشر
                      </summary>
                      <p className="mt-1.5 text-amber-900/80 dark:text-amber-100/80 whitespace-pre-wrap leading-relaxed">
                        {m.thought}
                      </p>
                    </details>
                  )}
                  <div className={`prose prose-sm max-w-none leading-relaxed ${isUser ? 'text-white prose-invert' : 'dark:prose-invert'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text || '...'}</ReactMarkdown>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] opacity-65">
                    <span>{m.source === 'mic' ? '🎙️ صوت' : m.source === 'text' ? '⌨️ نص' : '🔊 بث مباشر'}</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {interimUserText && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl rounded-tr-none px-4 py-2.5 bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100 text-xs italic border border-sky-300/50 animate-pulse">
              🎙️ {interimUserText}...
            </div>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Bottom Live Mic + Text Stream Controls */}
      <div className="p-3 sm:p-4 border-t border-sky-200/40 dark:border-sky-900/30 bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-xl shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Mic & Call Connection Controls */}
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            {status === 'connected' ? (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md ${
                    isMicActive
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-sky-600 hover:bg-sky-700 text-white'
                  }`}
                  title={isMicActive ? 'كتم الميكروفون' : 'تفعيل الميكروفون'}
                >
                  {isMicActive ? <Mic size={18} /> : <MicOff size={18} />}
                  <span>{isMicActive ? 'الميكروفون نشط' : 'تحدث بالمايك'}</span>
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="p-3 rounded-2xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 transition-colors"
                  title="إنهاء الجلسة الحية"
                >
                  <PhoneOff size={18} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => connect(true)}
                disabled={status === 'connecting'}
                className="px-4 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all disabled:opacity-60"
              >
                {status === 'connecting' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <PhoneCall size={18} />
                )}
                <span>{status === 'connecting' ? 'جاري الاتصال...' : 'اتصال صوتي حي'}</span>
              </button>
            )}

            {settings.enableAudioOutput && status === 'connected' && (
              <div
                className={`hidden md:flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold border ${
                  isModelSpeaking
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-50/70 dark:bg-black/20 border-amber-200/50 text-amber-800/70 dark:text-amber-200/70'
                }`}
              >
                <Volume2 size={14} className={isModelSpeaking ? 'animate-bounce' : ''} />
                <span>{isModelSpeaking ? 'يبث الصوت' : 'صوت جاهز'}</span>
              </div>
            )}
          </div>

          {/* Live Text Input */}
          <div className="flex-1 flex items-center gap-2 bg-amber-50/60 dark:bg-black/30 border border-amber-200/60 dark:border-white/10 rounded-2xl px-3 py-1.5 focus-within:border-sky-500 transition-colors">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendText();
                }
              }}
              rows={1}
              placeholder="اكتب رسالتك هنا أو تحدث بالمايك — سيرد عليك صوتياً ونصياً لحظياً..."
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-amber-950 dark:text-amber-50 placeholder:text-amber-900/40 dark:placeholder:text-amber-100/40 py-2 max-h-24"
              dir="rtl"
            />
            <button
              type="button"
              onClick={handleSendText}
              disabled={!textInput.trim()}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white transition-all shrink-0"
              title="إرسال في البث المباشر"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
