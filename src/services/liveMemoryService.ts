import { safeLocalStorageGet, safeLocalStorageSet, getSurahDisplayName } from '../lib/utils';
import { AI_PROVIDERS, resolveGeminiVoice } from './aiService';

export type GeminiLiveVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface LiveVoiceSettings {
  model: string;
  voiceName: GeminiLiveVoiceName;
  enableAudioOutput: boolean;
  enableWebSearch: boolean;
  thinkingLevel: 'off' | 'LOW' | 'MEDIUM' | 'HIGH';
  enableAppControl: boolean;
  autoLearnFromChats: boolean;
  customPersona: string;
  memoryNotes: string[];
}

export interface LiveTranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system-action';
  text: string;
  thought?: string;
  timestamp: number;
  source?: 'mic' | 'text' | 'live' | 'action';
}

export const PRIORITY_LIVE_MODELS = [
  'gemini-2.5-flash-native-audio-latest',
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-robotics-er-2-streaming-preview',
  'gemini-3.8-live',
  'gemini-3.8-live-extended-thinking',
  'gemini-3.5-live-translate-preview',
  'gemini-3.5-transcribe-live',
];

const SETTINGS_KEY = 'live_voice_settings_v1';
const MODELS_CACHE_KEY = 'dynamic_models_gemini_live';
const TRANSCRIPT_KEY = 'live_voice_transcript_v1';
const ROLLING_SUMMARY_KEY = 'live_rolling_summary_v1';

export const GEMINI_LIVE_VOICES: Array<{ id: GeminiLiveVoiceName; label: string; desc: string }> = [
  { id: 'Zephyr', label: 'Zephyr (زفير)', desc: 'صوت دافئ متزن وهادئ يناسب التدبر والحوار العميق' },
  { id: 'Puck', label: 'Puck (باك)', desc: 'صوت حيوي واضح وسريع الاستجابة' },
  { id: 'Charon', label: 'Charon (شارون)', desc: 'صوت رخيم وقور وعميق النبرة' },
  { id: 'Kore', label: 'Kore (كوري)', desc: 'صوت أنثوي ناعم وصافٍ ومريح للأذن' },
  { id: 'Fenrir', label: 'Fenrir (فنرير)', desc: 'صوت جهوري رصين وحازم' },
];

export function loadLiveVoiceSettings(): LiveVoiceSettings {
  const defaultBaseVoice = resolveGeminiVoice(
    safeLocalStorageGet('ai_recitation_voice') || safeLocalStorageGet('selected_voice') || ''
  ).baseVoice as GeminiLiveVoiceName;
  const validVoice: GeminiLiveVoiceName = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(defaultBaseVoice)
    ? defaultBaseVoice
    : 'Zephyr';

  const defaults: LiveVoiceSettings = {
    model: 'gemini-2.5-flash-native-audio-latest',
    voiceName: validVoice,
    enableAudioOutput: true,
    enableWebSearch: true,
    thinkingLevel: 'MEDIUM',
    enableAppControl: true,
    autoLearnFromChats: true,
    customPersona: '',
    memoryNotes: [],
  };

  try {
    const raw = safeLocalStorageGet(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      model: (parsed?.model && String(parsed.model).trim()) || defaults.model,
      voiceName: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(parsed?.voiceName) ? parsed.voiceName : defaults.voiceName,
      memoryNotes: Array.isArray(parsed?.memoryNotes) ? parsed.memoryNotes.filter((n: any) => typeof n === 'string' && n.trim()) : [],
    };
  } catch {
    return defaults;
  }
}

export function saveLiveVoiceSettings(settings: LiveVoiceSettings): void {
  safeLocalStorageSet(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('live_settings_updated', { detail: settings }));
}

export function addLearnedMemoryNote(note: string, category?: string): LiveVoiceSettings {
  const clean = note.trim();
  if (!clean) return loadLiveVoiceSettings();
  const formatted = category ? `[${category}] ${clean}` : clean;
  const current = loadLiveVoiceSettings();
  const exists = current.memoryNotes.some((n) => n.toLowerCase() === formatted.toLowerCase() || n.toLowerCase() === clean.toLowerCase());
  if (exists) return current;
  const updated: LiveVoiceSettings = {
    ...current,
    memoryNotes: [formatted, ...current.memoryNotes].slice(0, 40),
  };
  saveLiveVoiceSettings(updated);
  return updated;
}

export function removeLearnedMemoryNote(index: number): LiveVoiceSettings {
  const current = loadLiveVoiceSettings();
  const updated: LiveVoiceSettings = {
    ...current,
    memoryNotes: current.memoryNotes.filter((_, i) => i !== index),
  };
  saveLiveVoiceSettings(updated);
  return updated;
}

export function getCachedLiveModels(): string[] {
  try {
    const raw = safeLocalStorageGet(MODELS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([...PRIORITY_LIVE_MODELS, ...parsed]));
      }
    }
  } catch {
    // ignore
  }
  return [...PRIORITY_LIVE_MODELS];
}

export async function fetchLiveModelsFromAPI(): Promise<{ models: string[]; apiCount: number; source: string }> {
  const geminiKey = safeLocalStorageGet(AI_PROVIDERS.gemini.keyName) || '';
  const response = await fetch('/api/models/gemini-live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: geminiKey }),
  });

  if (!response.ok) {
    throw new Error(`فشل جلب نماذج Live (${response.status})`);
  }

  const data = await response.json();
  const models: string[] = Array.isArray(data?.models) && data.models.length > 0
    ? Array.from(new Set([...PRIORITY_LIVE_MODELS, ...data.models]))
    : [...PRIORITY_LIVE_MODELS];

  safeLocalStorageSet(MODELS_CACHE_KEY, JSON.stringify(models));
  window.dispatchEvent(new CustomEvent('live_models_updated', { detail: models }));
  return {
    models,
    apiCount: Number(data?.apiCount || 0),
    source: data?.source || 'registry',
  };
}

export function loadLiveTranscriptHistory(): LiveTranscriptMessage[] {
  try {
    const raw = safeLocalStorageGet(TRANSCRIPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLiveTranscriptHistory(messages: LiveTranscriptMessage[]): void {
  const clean = messages.filter((m) => m.text && m.text.trim());
  if (clean.length > 60) {
    // Compress older turns into rolling summary so long conversations stay in memory
    const older = clean.slice(0, clean.length - 40);
    const prevSummary = safeLocalStorageGet(ROLLING_SUMMARY_KEY) || '';
    const snippet = older
      .filter((m) => m.role !== 'system-action')
      .slice(-16)
      .map((m) => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.text.replace(/\s+/g, ' ').slice(0, 140)}`)
      .join(' | ');
    const combinedSummary = `${prevSummary ? prevSummary + ' || ' : ''}${snippet}`.slice(-2200);
    safeLocalStorageSet(ROLLING_SUMMARY_KEY, combinedSummary);
    safeLocalStorageSet(TRANSCRIPT_KEY, JSON.stringify(clean.slice(-40)));
  } else {
    safeLocalStorageSet(TRANSCRIPT_KEY, JSON.stringify(clean));
  }
}

export function clearLiveTranscriptMemory(): void {
  try {
    localStorage.removeItem(TRANSCRIPT_KEY);
    localStorage.removeItem(ROLLING_SUMMARY_KEY);
  } catch {
    // ignore
  }
}

function safeParseArray(key: string): any[] {
  try {
    const raw = safeLocalStorageGet(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function extractLearnedProfileFromChats(): {
  preferencesSummary: string;
  midadRecentSummary: string;
  assistantRecentSummary: string;
  recentAppActivity: string;
} {
  const midadHistory = safeParseArray('midad_alrahman_history');
  const midadAllChats = safeParseArray('midad_all_chats');
  const aiHistory = safeParseArray('ai_chat_history');
  const midadGlobal = safeLocalStorageGet('midad_global_context') || '';

  // Collect all user messages from Midad (current + archived chats) and Smart Assistant
  const midadMsgs: Array<{ role: string; content: string }> = [...midadHistory];
  for (const ch of midadAllChats.slice(0, 5)) {
    if (Array.isArray(ch?.messages)) {
      midadMsgs.push(...ch.messages.slice(-8));
    }
  }

  const aiChatMsgs = aiHistory.filter((m: any) => m && m.type !== 'event' && typeof m.content === 'string');
  const aiEvents = aiHistory.filter((m: any) => m && m.type === 'event' && typeof m.content === 'string');

  const allUserTexts = [
    ...midadMsgs.filter((m) => m.role === 'user').map((m) => String(m.content || '')),
    ...aiChatMsgs.filter((m: any) => m.role === 'user').map((m: any) => String(m.content || '')),
  ].filter(Boolean);

  // Infer style, dialect, and thematic preferences from real chat history
  const joinedUser = allUserTexts.join('\n').toLowerCase();
  const traits: string[] = [];

  if (/دارج|مغرب|بغيت|عافاك|شحال|دير|واش|كيفاش|بزاف|دابا/.test(joinedUser)) {
    traits.push('يميل المستخدم أحياناً إلى الدارجة المغربية أو التواصل القريب المألوف.');
  } else if (allUserTexts.length > 0) {
    traits.push('يتواصل المستخدم باللغة العربية الواضحة ويقدّر البيان الدقيق.');
  }

  if (/تفسير|ابن كثير|السعدي|الطبري|تدبر|معنى|آية/.test(joinedUser)) {
    traits.push('يهتم بتفسير القرآن الكريم، أسباب النزول، والتدبر الروحي.');
  }
  if (/إعجاز|علمي|كون|نفس|فلسف|بلاغة|لغوي/.test(joinedUser)) {
    traits.push('يهتم بالربط البلاغي والعلمي والنفسي والفلسفي العميق للنصوص.');
  }
  if (/تجويد|مقام|تحبير|ورش|حفص|تلاوة|صوت|قارئ/.test(joinedUser)) {
    traits.push('يهتم بالقراءات القرآنية والتجويد والمقامات الصوتية وجودة التلاوة.');
  }
  if (/صورة|صمم|رسم|توليد|بصري/.test(joinedUser)) {
    traits.push('يستخدم ميزة توليد الصور الروحانية والتصاميم البصرية.');
  }
  if (/مفصل|توسع|واصل|أكثر|عميق/.test(joinedUser)) {
    traits.push('يفضّل الإجابات المتعمقة والغنية دون تكرار آلي أو اختصار مخل.');
  }

  const reciter = safeLocalStorageGet('quran_selectedReciter') || 'ar.alafasy';
  const qiraat = safeLocalStorageGet('quran_selectedQiraat') || 'hafs';
  const tafsir = safeLocalStorageGet('quran_selectedTafsir') || 'ar.muyassar';
  const translation = safeLocalStorageGet('quran_selectedTranslation') || 'en.sahih';
  const voice = safeLocalStorageGet('ai_recitation_voice') || safeLocalStorageGet('selected_voice') || '';

  traits.push(`إعدادات التفضيل المحفوظة: الرواية=${qiraat}، القارئ=${reciter}، التفسير=${tafsir}، الترجمة=${translation}${voice ? `، الصوت المفضل=${voice}` : ''}.`);
  if (midadGlobal) {
    traits.push(`ملخص سياق مداد المحفوظ: ${midadGlobal}`);
  }

  const formatTurns = (list: any[], count = 8) =>
    list
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .slice(-count)
      .map((m) => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content.replace(/\s+/g, ' ').slice(0, 220)}`)
      .join('\n');

  const midadRecentSummary = formatTurns(midadMsgs, 8);
  const assistantRecentSummary = formatTurns(aiChatMsgs, 8);
  const recentAppActivity = aiEvents
    .slice(-12)
    .map((e: any) => e.content)
    .join(' ← ');

  return {
    preferencesSummary: traits.join('\n- '),
    midadRecentSummary,
    assistantRecentSummary,
    recentAppActivity,
  };
}

export interface LiveAppSnapshot {
  personaMode: 'midad' | 'assistant';
  currentContext?: {
    surah?: string;
    ayah?: number;
    text?: string;
    tafsir?: string;
  };
  viewMode?: string;
  lastSearchedText?: string;
  selectedReciter?: string;
  selectedQiraat?: string;
  selectedTafsir?: string;
  selectedTranslation?: string;
}

export function buildLiveSystemContext(
  settings: LiveVoiceSettings,
  snapshot: LiveAppSnapshot
): {
  systemInstruction: string;
  seedTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const personaIntro =
    snapshot.personaMode === 'midad'
      ? `أنت «مداد الرحمن» في وضع البث الصوتي والنصي المباشر الحي — لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. تتحدث بصوت حي وتدبر عميق وإلهام قرآني رفيع متجدد.`
      : `أنت «مِداد الذكي» في وضع المحادثة الصوتية والنصية المباشرة الحية — المساعد القرآني والعلمي المتكامل داخل التطبيق.`;

  let currentReadingBlock = '';
  if (snapshot.currentContext?.surah) {
    currentReadingBlock = `ما يفتحه المستخدم الآن في التطبيق: سورة ${getSurahDisplayName(snapshot.currentContext.surah)}${snapshot.currentContext.ayah ? `، الآية ${snapshot.currentContext.ayah}` : ''}${snapshot.currentContext.text ? ` — نصها: "${snapshot.currentContext.text}"` : ''}${snapshot.currentContext.tafsir ? `\nالتفسير المعروض: ${snapshot.currentContext.tafsir.slice(0, 400)}` : ''}`;
  } else {
    try {
      const memRaw = safeLocalStorageGet('ai_context_memory');
      if (memRaw) {
        const mem = JSON.parse(memRaw);
        if (mem?.surah) {
          currentReadingBlock = `آخر آية تصفحها المستخدم في التطبيق: سورة ${getSurahDisplayName(mem.surah)} آية ${mem.ayah || 1}${mem.text ? ` — "${mem.text}"` : ''}`;
        }
      }
    } catch {
      // ignore
    }
  }

  const learned = settings.autoLearnFromChats ? extractLearnedProfileFromChats() : null;
  const rollingLiveSummary = safeLocalStorageGet(ROLLING_SUMMARY_KEY) || '';
  const notesBlock = settings.memoryNotes.length > 0 ? settings.memoryNotes.map((n) => `- ${n}`).join('\n') : '';

  const systemInstruction = `${personaIntro}

=== القواعد الصارمة للسلوك والتنفيذ ===
1. التنفيذ الكامل دون أعذار: **يُمنع منعاً باتاً** أن تتعلل أو تعتذر بعبارات مثل "أنا مجرد نموذج لغوي" أو "بصفتي ذكاءً اصطناعياً لا أستطيع". استجب لكل ما يطلبه المستخدم مباشرة، ونفّذ طلباته فعلياً وبمبادرة كاملة.
2. التحكم الفعلي في التطبيق: لديك أدوات مباشرة للتحكم في التطبيق (فتح السور، تشغيل/إيقاف التلاوة، البحث في القرآن، الانتقال للأقسام، توليد الصور، تغيير القارئ والرواية والخط، حفظ تفضيلات المستخدم، والبحث الحي في الويب). متى طلب المستخدم أي فعل منها، استدعِ الأداة المناسبة فوراً ونفّذه.
3. التفاعل الصوتي والنصي الطبيعي: أجب بوضوح وبلاغة تناسب الاستماع الصوتي المباشر والقراءة في الوقت نفسه، دون تكرار آلي أو قوالب مكررة.
4. التعلّم وحفظ السياق طويل الأمد: تذكّر دائماً كل ما قيل في هذه الجلسة، وما كان يفعله المستخدم في التطبيق، وما تعلّمته من محادثاته النصية السابقة في «مداد الرحمن» و«المساعد الذكي». استخدم أداة save_user_preference تلقائياً إذا ذكر المستخدم تفضيلاً جديداً دائماً.

=== الحالة الحالية للمستخدم داخل التطبيق ===
${currentReadingBlock || 'المستخدم يتصفح التطبيق حالياً.'}
القسم المفتوح الآن: ${snapshot.viewMode || (snapshot.personaMode === 'midad' ? 'مداد الرحمن' : 'المحادثة الذكية')}
${snapshot.lastSearchedText ? `آخر كلمة بحث عنها المستخدم: "${snapshot.lastSearchedText}"` : ''}
${learned?.recentAppActivity ? `تسلسل نشاط المستخدم الأخير في التطبيق: ${learned.recentAppActivity}` : ''}

=== الملف الشخصي والتفضيلات المتعلّمة ===
${learned?.preferencesSummary ? `- ${learned.preferencesSummary}` : ''}
${notesBlock ? `\nتفضيلات وملاحظات محفوظة عن المستخدم:\n${notesBlock}` : ''}
${settings.customPersona?.trim() ? `\nتخصيص إضافي من المستخدم للمحادثة الصوتية المباشرة:\n${settings.customPersona.trim()}` : ''}

=== ذاكرة المحادثات النصية السابقة (مداد الرحمن + المساعد الذكي) ===
${learned?.midadRecentSummary ? `[آخر نقاشات مداد الرحمن النصية]:\n${learned.midadRecentSummary}` : ''}
${learned?.assistantRecentSummary ? `\n[آخر نقاشات المساعد الذكي النصية]:\n${learned.assistantRecentSummary}` : ''}
${rollingLiveSummary ? `\n[ملخص الجلسات الصوتية الطويلة السابقة]:\n${rollingLiveSummary}` : ''}`.trim();

  // Seed recent live transcript turns directly into session turns so long conversations keep full continuity
  const recentLive = loadLiveTranscriptHistory()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-14);

  const seedTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = recentLive.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  return { systemInstruction, seedTurns };
}
