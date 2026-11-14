import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Volume2, Copy, 
  RefreshCw, Settings, History, Trash2, Check,
  Cpu, Zap, Brain, ShieldCheck, Search, Download, Upload,
  Image as ImageIcon, HelpCircle,
  Lightbulb, BookOpen, Pin, Edit2, Calendar, Loader2, Globe,
  Minimize2, Maximize2, Moon, Radio
} from 'lucide-react';
import { MessageList } from './chat/MessageList';
import { ChatInput, ChatInputRef } from './chat/ChatInput';
import { AIAdvancedSettings } from './chat/AIAdvancedSettings';
import { LiveVoicePanel } from './live/LiveVoicePanel';
import { callAIWithFailover, callAI, AIMessage, AI_PROVIDERS, AIProviderKey, generateRecitationStream, transcribeAudio, callAIStream, getDynamicModelsList, fetchAndUpdateModels, fetchAllProvidersModels, detectAndCleanRepetitionLoop, classifyModelPricing, AIAdvancedConfig, loadAIAdvancedConfig, saveAIAdvancedConfig, getResponseDepthDirective } from '../services/aiService';
import { safeLocalStorageSet, safeLocalStorageGet, safeLocalStorageRemove } from '../lib/utils';
import { saveAudioToCache, getAudioFromCache } from '../lib/audioCache';
import { useSleepTimer } from '../hooks/useSleepTimer';

interface ChatHistory {
  id: string;
  title: string;
  timestamp: number;
  messages: AIMessage[];
  pinned?: boolean;
}

// Global cache for Midad audio URLs to persist across unmounts
const globalAudioUrls: Record<string, string> = {};
const globalAudioTimestamps: Record<string, number> = {};

const pruneGlobalAudioCache = () => {
  const keys = Object.keys(globalAudioTimestamps);
  if (keys.length > 5) {
    keys.sort((a, b) => globalAudioTimestamps[a] - globalAudioTimestamps[b]);
    const toRemove = keys.slice(0, keys.length - 5);
    toRemove.forEach(key => {
      if (globalAudioUrls[key]) {
        URL.revokeObjectURL(globalAudioUrls[key]);
        delete globalAudioUrls[key];
        delete globalAudioTimestamps[key];
      }
    });
  }
};

export const MidadAlRahman = ({ 
  onClose, 
  selectedVoice,
  currentContext,
  onAction
}: { 
  onClose: () => void, 
  selectedVoice: string,
  currentContext?: {
    surah?: string;
    ayah?: number;
    text?: string;
    tafsir?: string;
    tafsirRequest?: string;
    timestamp?: number;
  },
  onAction?: (action: string, data?: any) => void
}) => {
  const [currentChatId, setCurrentChatId] = useState<string>(() => {
    return safeLocalStorageGet('midad_current_chat_id') || Date.now().toString();
  });

  const [allChats, setAllChats] = useState<ChatHistory[]>(() => {
    try {
      const saved = safeLocalStorageGet('midad_all_chats');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse midad chats:", e);
      return [];
    }
  });

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try {
      const saved = safeLocalStorageGet('midad_alrahman_history');
      return saved ? JSON.parse(saved) : [{
        role: 'assistant',
        content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
      }];
    } catch (e) {
      console.error("Failed to parse midad history:", e);
      return [{
        role: 'assistant',
        content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
      }];
    }
  });

  const [audioUrls, setAudioUrls] = useState<Record<string, string>>(globalAudioUrls);

  const [selectedProvider, setSelectedProvider] = useState<AIProviderKey>(() => {
    const saved = safeLocalStorageGet('midad_provider') as AIProviderKey;
    return (saved && AI_PROVIDERS[saved]) ? saved : 'gemini';
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const savedProvider = (safeLocalStorageGet('midad_provider') as AIProviderKey) || 'gemini';
    const safeProvider = AI_PROVIDERS[savedProvider] ? savedProvider : 'gemini';
    const savedModel = safeLocalStorageGet('midad_model');

    let modelName = savedModel || '';
    if (modelName.includes('|')) {
      modelName = modelName.split('|')[1];
    }

    const availableModels = getDynamicModelsList(safeProvider);
    if (modelName && availableModels && availableModels.includes(modelName)) {
      return `${safeProvider}|${modelName}`;
    }

    const defaultModel = AI_PROVIDERS[safeProvider]?.defaultModel || (availableModels && availableModels[0]) || 'gemini-3.7-flash';
    return `${safeProvider}|${defaultModel}`;
  });

  const [aiConfig, setAiConfig] = useState<AIAdvancedConfig>(() =>
    loadAIAdvancedConfig('midad_ai_settings_v2', 'midad')
  );

  const enableWebSearch = aiConfig.enableWebSearch;
  const enableDeepThinking = aiConfig.reasoningEffort !== 'off';
  const setEnableWebSearch = useCallback((val: boolean) => {
    setAiConfig(prev => ({ ...prev, preset: 'custom', enableWebSearch: val }));
  }, []);
  const setEnableDeepThinking = useCallback((val: boolean) => {
    setAiConfig(prev => ({ ...prev, preset: 'custom', reasoningEffort: val ? 'high' : 'off' }));
  }, []);

  const [enableSpiritualImage, setEnableSpiritualImage] = useState<boolean>(() => {
    return safeLocalStorageGet('midad_spiritual_image') === 'true';
  });

  const [isZenMode, setIsZenMode] = useState<boolean>(() => {
    return safeLocalStorageGet('midad_zen_mode') === 'true';
  });

  useEffect(() => {
    safeLocalStorageSet('midad_zen_mode', isZenMode.toString());
  }, [isZenMode]);

  const [showSettings, setShowSettings] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { isActive: isTimerActive, formattedTime, startTimer, cancelTimer } = useSleepTimer();
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);

  useEffect(() => {
    const handleSleepStop = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsGeneratingAudio(null);
    };
    window.addEventListener('sleep_timer_triggered', handleSleepStop);
    return () => window.removeEventListener('sleep_timer_triggered', handleSleepStop);
  }, []);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showFactoryResetConfirm, setShowFactoryResetConfirm] = useState(false);
  const chatInputRef = useRef<ChatInputRef>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<string | null>(null);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const isAtBottom = useRef(true);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsUpdatedMessage, setModelsUpdatedMessage] = useState<string | null>(null);
  const [modelsVersion, setModelsVersion] = useState(0);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);
  const [lastSuggestedMessageIndex, setLastSuggestedMessageIndex] = useState<number>(-1);

  const handleRefreshModels = async () => {
    setIsUpdatingModels(true);
    setModelsUpdatedMessage(null);
    try {
      const results = await fetchAllProvidersModels(true);
      setIsUpdatingModels(false);
      setModelsVersion(prev => prev + 1);
      
      const totalUpdated = Object.values(results).reduce((acc, models) => acc + models.length, 0);
      setModelsUpdatedMessage(`تم تحديث ${totalUpdated} نموذج بنجاح من جميع المزودين.`);
      
      const [currentProvider, currentModel] = selectedModel.split('|');
      const providerModels = results[currentProvider as AIProviderKey] || getDynamicModelsList(currentProvider as AIProviderKey);
      
      if (!providerModels.includes(currentModel)) {
        const defaultModel = AI_PROVIDERS[currentProvider as keyof typeof AI_PROVIDERS]?.defaultModel;
        const newModel = defaultModel && providerModels.includes(defaultModel) ? defaultModel : providerModels[0];
        if (newModel) {
          setSelectedModel(`${currentProvider}|${newModel}`);
          safeLocalStorageSet('midad_model', newModel);
        }
      }
      setTimeout(() => setModelsUpdatedMessage(null), 4000);
    } catch (err: any) {
      setIsUpdatingModels(false);
      setModelsUpdatedMessage(`فشل التحديث: ${err.message || 'خطأ غير معروف'}`);
      setTimeout(() => setModelsUpdatedMessage(null), 5000);
    }
  };
  const currentRecitationIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchAllProvidersModels(true).catch(console.error);
    const handleModelsUpdated = () => setModelsVersion(v => v + 1);
    window.addEventListener('models_updated', handleModelsUpdated);
    return () => window.removeEventListener('models_updated', handleModelsUpdated);
  }, []);

  const downloadAudioFile = async (url: string, prefix: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = blob.type && typeof blob.type === 'string' && (blob.type.includes('wav') ? 'wav' : (blob.type.includes('mpeg') ? 'mp3' : 'wav'));
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed", e);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Optimized localStorage saving
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  
  const latestMessages = useRef<AIMessage[]>(messages);
  const latestChatId = useRef<string>(currentChatId);

  // Synchronously update refs during render to prevent race conditions during unmount
  latestMessages.current = messages;
  latestChatId.current = currentChatId;

  const saveMessagesImmediately = (msgs: AIMessage[], chatId: string, skipStateUpdate: boolean = false) => {
    if (!msgs || msgs.length === 0) return;
    const messagesToSave = msgs.slice(-50);
    safeLocalStorageSet('midad_alrahman_history', JSON.stringify(messagesToSave));
    safeLocalStorageSet('midad_current_chat_id', chatId);
    
    const buildUpdatedChats = (prev: ChatHistory[]) => {
      const existingIndex = prev.findIndex(c => c.id === chatId);
      const existingChat = existingIndex >= 0 ? prev[existingIndex] : null;
      
      const isDefaultTitle = !existingChat || existingChat.title === 'محادثة جديدة';
      const autoTitle = messagesToSave.find(m => m.role === 'user')?.content.substring(0, 30) || 'محادثة جديدة';
      const title = isDefaultTitle ? autoTitle : existingChat.title;
      
      const updatedChat: ChatHistory = {
        id: chatId,
        title: title,
        timestamp: existingChat ? existingChat.timestamp : Date.now(),
        messages: messagesToSave,
        pinned: existingChat?.pinned
      };

      let newChats = [...prev];
      if (existingIndex >= 0) {
        newChats[existingIndex] = updatedChat;
      } else if (messagesToSave.length > 1) {
        newChats = [updatedChat, ...prev];
      }
      
      return newChats.slice(0, 20);
    };

    if (skipStateUpdate || !isMountedRef.current) {
      try {
        const raw = safeLocalStorageGet('midad_all_chats');
        const prev = raw ? JSON.parse(raw) : [];
        if (Array.isArray(prev)) {
          safeLocalStorageSet('midad_all_chats', JSON.stringify(buildUpdatedChats(prev)));
        }
      } catch {
        // ignore parse error during unmount
      }
      return;
    }

    setAllChats(buildUpdatedChats);
  };

  useEffect(() => {
    isMountedRef.current = true;
    const handleBeforeUnload = () => {
      saveMessagesImmediately(latestMessages.current, latestChatId.current, true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      currentRecitationIdRef.current = null;
      isReadingAllRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // ignore
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      saveMessagesImmediately(messages, currentChatId);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Force immediate storage save on cleanup without calling setState after unmount
        saveMessagesImmediately(latestMessages.current, latestChatId.current, !isMountedRef.current);
      }
    };
  }, [messages, currentChatId]);

  useEffect(() => {
    safeLocalStorageSet('midad_all_chats', JSON.stringify(allChats));
  }, [allChats]);

  useEffect(() => {
    safeLocalStorageSet('midad_provider', selectedProvider);
    const modelOnly = selectedModel.includes('|') ? selectedModel.split('|')[1] : selectedModel;
    safeLocalStorageSet('midad_model', modelOnly);
    saveAIAdvancedConfig('midad_ai_settings_v2', aiConfig, 'midad');
    safeLocalStorageSet('midad_spiritual_image', enableSpiritualImage ? 'true' : 'false');
  }, [selectedProvider, selectedModel, aiConfig, enableSpiritualImage]);

  // Helper to generate context-aware suggestions locally when the AI API fails or is rate-limited
  const getLocalSmartSuggestions = (content: string): string[] => {
    const c = content || '';
    
    if (c.includes('صبر') || c.includes('الصبر') || c.includes('ابتلاء') || c.includes('بلاء') || c.includes('ضيق') || c.includes('حزن')) {
      return [
        'ما هي مراتب الصبر الجميل وبشاراته في القرآن؟',
        'كيف يعيننا التدبر والذكر على تخفيف أثقال الابتلاء؟',
        'ابحث لي عن آيات تبث الطمأنينة والسكينة في القلوب'
      ];
    }
    
    if (c.includes('صلاة') || c.includes('الصلاة') || c.includes('عبادة') || c.includes('تقوى') || c.includes('التقوى') || c.includes('خشوع')) {
      return [
        'كيف نصل لدرجة الخشوع واليقين في صلواتنا اليومية؟',
        'ما هو أثر التقوى والعمل الصالح الخفي في تيسير الأرزاق؟',
        'استخرج لي من القرآن هدي الأنبياء في تدبر آيات الله'
      ];
    }

    if (c.includes('دعاء') || c.includes('الدعاء') || c.includes('استغفار') || c.includes('الاستغفار') || c.includes('توبة') || c.includes('التوبة') || c.includes('مغفرة')) {
      return [
        'ما هي مفاتيح وأوقات إجابة الدعاء من القصص القرآني؟',
        'كيف يفتح لنا الاستغفار والتوبة النصوح أبواب السماء؟',
        'أريد أدعية قرآنية مأثورة لجلب السكينة وتفريج الكرب'
      ];
    }

    if (c.includes('علم') || c.includes('العلم') || c.includes('حكمة') || c.includes('الحكمة') || c.includes('تفكر') || c.includes('إيمان') || c.includes('عقل')) {
      return [
        'كيف ننمي ملكة التفكر العميق في الآيات الكونية والقرآنية؟',
        'ما هو الفرق بين العلم والحكمة في القرآن الكريم؟',
        'كيف يؤثر الإيمان الصادق على سكينة النفس وصحتها؟'
      ];
    }

    if (c.includes('جنة') || c.includes('الجنة') || c.includes('رحمة') || c.includes('الرحمة') || c.includes('فضل') || c.includes('نعيم')) {
      return [
        'ما هي صفات عباد الرحمن الذين يرثون الفردوس الأعلى؟',
        'كيف نستشعر سعة رحمة الله في تفاصيل حياتنا اليومية؟',
        'أريد آيات تتحدث عن نعيم الجنة لتشويق النفوس للعمل'
      ];
    }

    if (c.includes('قرآن') || c.includes('سورة') || c.includes('آية') || c.includes('تفسير') || c.includes('إعجاز') || c.includes('تدبر')) {
      return [
        'ما هي مفاتيح التدبر العملي التي تمنع قسوة القلوب؟',
        'حدثني عن الإعجاز البلاغي أو الروحي في هذه السورة',
        'كيف نعيش بالقرآن ونجعله ربيعاً حقيقياً لقلوبنا؟'
      ];
    }

    return [
      'واصل يا مداد الرحمن وتعمق أكثر في هذا المعنى الروحاني',
      'كيف نطبق هذه الهدايات والآداب القرآنية في واقعنا المعاصر؟',
      'ابحث لي عن إشارات وأسرار بلاغية أخرى تتصل بهذا المفهوم'
    ];
  };

  // Generate dynamic follow-up suggestions using Gemini 3
  useEffect(() => {
    if (isLoading) {
      setSuggestions([]);
      return;
    }

    const lastMsgIndex = messages.length - 1;
    if (lastMsgIndex >= 0) {
      const lastMsg = messages[lastMsgIndex];
      if (lastMsg.role === 'assistant' && lastMsgIndex !== lastSuggestedMessageIndex) {
        setLastSuggestedMessageIndex(lastMsgIndex);
        
        const generateDynamicSuggestions = async () => {
          setSuggestionsLoading(true);
          try {
            const prompt: AIMessage[] = [
              {
                role: 'system',
                content: `تعليمات هامة للنموذج: أنت مساعد ذكي لتطبيق "مداد الرحمن" التدبري القرآني. 
مهمتك هي قراءة آخر رسالة لمداد الرحمن وتوليد 3 اقتراحات لأسئلة أو عبارات لمواصلة الحديث وتعميق التدبر والبحث.
يجب أن تكون الاقتراحات روحانية، راقية، مقتضبة وجذابة.
شروط صارمة: 
1. يجب أن تكون الإجابة بصيغة مصفوفة JSON تحتوي على 3 نصوص قصيرة فقط (طول كل نص 4-8 كلمات كحد أقصى).
2. لا تستخدم علامات اقتباس مكررة داخل العناصر.
3. لا تضع أي علامات ماركداون (مثل \`\`\`json) أو شرح، أرسل نص الـ JSON الخام مباشرة.
مثال للإرجاع:
["ما هي الآيات المشابهة في هذا المعنى؟", "كيف نطبق هذه الهداية في واقعنا؟", "استخرج لي لمحة لغوية من النص"]`
              },
              {
                role: 'user',
                content: lastMsg.content
              }
            ];

            const response = await callAIWithFailover('gemini', prompt, 'gemini-3.8-flash', {
              allowProviderFallback: true,
              temperature: 0.7
            });

            if (response && response.content) {
              let cleanText = response.content.trim();
              if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
              }
              
              // Extract array if the model added any wrapper text
              if (!cleanText.startsWith('[')) {
                const arrayMatch = cleanText.match(/\[\s*[\s\S]*?\s*\]/);
                if (arrayMatch) {
                  cleanText = arrayMatch[0];
                }
              }

              const parsed = JSON.parse(cleanText);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSuggestions(parsed.slice(0, 3).map(s => String(s).trim()));
              } else {
                throw new Error("Invalid array format");
              }
            } else {
              throw new Error("Empty response from AI");
            }
          } catch (err) {
            console.warn("Failed to generate custom suggestions via API, using smart local fallback:", err);
            // Dynamic fallback based on keywords in the last message
            const localSugs = getLocalSmartSuggestions(lastMsg.content);
            setSuggestions(localSugs);
          } finally {
            setSuggestionsLoading(false);
          }
        };

        generateDynamicSuggestions();
      }
    } else {
      setSuggestions([]);
      setLastSuggestedMessageIndex(-1);
    }
  }, [messages, isLoading, lastSuggestedMessageIndex]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ar-SA';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        chatInputRef.current?.append(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'network') {
          chatInputRef.current?.append('[تعذر الاتصال بخدمة الصوت، يرجى المحاولة مرة أخرى لاستخدام البديل]');
          recognitionRef.current = null; // Disable Web Speech API so next click uses MediaRecorder
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        recognitionRef.current?.stop();
      }
      setIsListening(false);
    } else {
      // Try Web Speech API first
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          return;
        } catch (e) {
          console.warn("SpeechRecognition start failed, falling back to MediaRecorder", e);
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
              const transcript = await transcribeAudio(base64Audio, 'audio/webm');
              chatInputRef.current?.append(transcript);
            } catch (error) {
              console.error("Transcription failed:", error);
              chatInputRef.current?.append('[فشل التعرف على الصوت]');
            } finally {
              setIsProcessingAudio(false);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (error) {
        if (error instanceof Error && error.name === 'NotAllowedError') {
          setMicrophoneError("تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن في إعدادات المتصفح.");
          setTimeout(() => setMicrophoneError(null), 5000);
        } else {
          console.error("Error accessing microphone:", error);
          chatInputRef.current?.append('[تعذر الوصول إلى الميكروفون]');
        }
        setIsListening(false);
      }
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior
        });
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
      }
    });
  };

  // Scroll to bottom on mount and when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAtBottom.current) {
      scrollToBottom(isLoading ? 'auto' : 'smooth');
    }
  }, [messages, isLoading]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentChatId(newId);
    setMessages([{
      role: 'assistant',
      content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
    }]);
    setShowHistory(false);
    setSuggestions([]);
    setLastSuggestedMessageIndex(-1);
  };

  const loadChat = (chat: ChatHistory) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setShowHistory(false);
    setSuggestions([]);
    setLastSuggestedMessageIndex(-1);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllChats(prev => prev.filter(c => c.id !== id));
    if (id === currentChatId) {
      startNewChat();
    }
  };

  const togglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllChats(prev => prev.map(chat => 
      chat.id === id ? { ...chat, pinned: !chat.pinned } : chat
    ));
  };

  const startEditTitle = (chat: ChatHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitleValue(chat.title);
  };

  const saveEditTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (editTitleValue.trim()) {
      setAllChats(prev => prev.map(chat => 
        chat.id === id ? { ...chat, title: editTitleValue.trim() } : chat
      ));
    }
    setEditingChatId(null);
  };

  // Collective Memory: Load global context summary
  const [globalContext, setGlobalContext] = useState<string>(() => {
    return safeLocalStorageGet('midad_global_context') || '';
  });

  // Update global context periodically
  useEffect(() => {
    if (messages.length > 5) {
      const lastMessages = messages.slice(-4).map(m => m.content).join(' ');
      if (lastMessages.length > 200) {
        const newContext = `المستخدم مهتم بـ: ${lastMessages.substring(0, 300)}...`;
        setGlobalContext(newContext);
        safeLocalStorageSet('midad_global_context', newContext);
      }
    }
  }, [messages]);

  const handleEdit = (index: number) => {
    const message = messages[index];
    if (message.role === 'user') {
      chatInputRef.current?.set(message.content);
      // Remove messages from this index onwards
      setMessages(prev => prev.slice(0, index));
    }
  };

  const handleRegenerate = async (index: number) => {
    // Find the last user message before this assistant message
    let lastUserMessageIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex !== -1) {
      const userContent = messages[lastUserMessageIndex].content;
      // Remove messages from user message onwards
      setMessages(prev => prev.slice(0, lastUserMessageIndex));
      // Send user message again
      await sendMessage(userContent);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    setAudioUrls(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k === 'all' || k.startsWith('all_')) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
          delete globalAudioUrls[k];
          delete globalAudioTimestamps[k];
        }
      });
      return next;
    });
    const userMessage: AIMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const historyLimit = aiConfig.contextWindow === 0 ? messages.length : aiConfig.contextWindow;
      const recentLimit = Math.min(12, historyLimit);
      const limitedMessages = messages.slice(-historyLimit).map((msg, idx, arr) => {
        if (arr.length - idx > recentLimit && typeof msg.content === 'string' && msg.content.length > 1200) {
          return { ...msg, content: msg.content.substring(0, 1000) + '... [محتوى مقتضب لتوفير السياق]' };
        }
        return msg;
      });

      const trimmedText = text.trim();
      const continuationKeywords = [
        'واصل', 'تابع', 'أكمل', 'المزيد', 'أكثر', 'أكمل الحديث', 'تابع الحديث', 'واصل الحديث', 
        'أكثر يا مداد الرحمن', 'استمر', 'استرسل', 'أضف المزيد', 'زدني', 'زدني علمًا', 'تحدث أكثر',
        'تفصيل أكثر', 'أريد المزيد', 'توسع في هذا', 'توسع'
      ];
      
      const isContinuation = continuationKeywords.some(keyword => 
        trimmedText === keyword || 
        trimmedText === `يا مداد الرحمن ${keyword}` ||
        trimmedText === `${keyword} يا مداد الرحمن` ||
        trimmedText.toLowerCase() === keyword.toLowerCase()
      ) || (trimmedText.length < 15 && continuationKeywords.some(keyword => trimmedText.includes(keyword)));

      let apiUserContent = text;
      if (isContinuation) {
        const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMsg && lastAssistantMsg.content) {
          const lastSummary = lastAssistantMsg.content.substring(0, 150).replace(/[\r\n]+/g, ' ').trim();
          apiUserContent = `${text}

[تنبيه حاسم من النظام للذكاء الاصطناعي]: لقد طلب المستخدم مواصلة أو استكمال الحديث. إجابتك السابقة كانت تتحدث عن هذا المحتوى أو بدأت بـ: ("${lastSummary}..."). يمنع منعاً باتاً تكرار نفس النقاط، أو الآيات، أو الأحاديث، أو العناوين التي طرحتها في رسالتك السابقة، أو إعادة صياغتها بأسلوب مختلف. يجب أن تواصل فوراً ومباشرة بطرح أفكار تكميلية، أو محاور جديدة، أو زوايا لغوية/علمية/روحية لم تتطرق إليها مطلقاً في هذا النقاش. ابدأ إجابتك فوراً بصلب الموضوع الجديد والعميق دون أي تمهيد مكرر واجعله منطلقاً لأبعاد جديدة.`;
        }
      }

      const apiUserMessage: AIMessage = { role: 'user', content: apiUserContent };

      const [provider, model] = selectedModel.split('|');
      const systemInstruction = `أنت «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾.

أنت منصة للإلهام العميق والغوص في بحار القرآن والسنة. لا تكرر أبدا نفس الآيات والأحاديث التي استشهدت بها سابقاً. نوّع مصادرك ومناهجك في كل رسالة؛ مرة تناول الموضوع من زاوية لغوية، ومرة من زاوية علمية/كونية، ومرة من زاوية روحية أو نفسية، لتثبت أن القرآن بحر لا ينفد.

${enableWebSearch ? 'تنبيه: خاصية البحث في الويب مفعلة. استخدمها للبحث عن أحدث الاكتشافات العلمية، المقالات الأكاديمية الموثوقة، والارتباطات التاريخية الدقيقة التي تعزز إعجاز النص القرآني وتكشف أسرار الكون.' : ''}

${enableDeepThinking ? 'تنبيه: خاصية التفكير العميق مفعلة. خذ وقتك في تحليل الأبعاد الخفية للنصوص، والربط بين الآيات بطرق غير تقليدية، وتقديم استنتاجات فلسفية وروحية رصينة بعيداً عن السطحية.' : ''}

تنبيه حاسم: تجنب القوالب الثابتة والأساليب المكررة في بدايات ونهايات الرسائل. كن متجدداً، ملهماً، بليغاً، ومتدبراً بعمق يخلو تماماً من التكرار الآلي المزعج. 

قاعدة الاستمرار والمواصلة (هام جداً): إذا طلب المستخدم (واصل، أكمل، المزيد، تابع، وما شابه) إياك أن تكرر ما ذكرته في الرسالة السابقة بأي شكل من الأشكال أو بأسلوب مختلف. يجب أن تنطلق مباشرة إلى أفكار وزوايا جديدة كلياً تبني على ما سبق ولا تعيده أبداً.

الاستشهاد: القرآن فيه آلاف الآيات والسنة فيها مئات الآلاف من الأحاديث، لذا استكشف سوراً ومواضيع بعيدة، واذكر الآية مرة واحدة فقط وتجنب الإعادة والهلوسة.

${globalContext ? `للمستخدم اهتمامات سابقة بـ: ${globalContext}، ابنِ عليها ولا تعد من الصفر.` : ''}

${getResponseDepthDirective(aiConfig.responseDepth)}

${aiConfig.customInstructions ? `تعليمة خاصة من المستخدم: ${aiConfig.customInstructions}` : ''}`;

      const aiMessages: AIMessage[] = [
        { role: 'system', content: systemInstruction },
        ...limitedMessages,
        apiUserMessage
      ];

      const assistantMessage: AIMessage = { role: 'assistant', content: '', model: model };
      setMessages(prev => [...prev, assistantMessage]);
      
      let fullContent = '';
      let fullThought = '';
      let lastUpdateTime = 0;
      let finalMetadata: any = null;
      const UPDATE_INTERVAL = 250; // ms - batch updates for smoothness and stability

      try {
        await callAIStream(provider as AIProviderKey, aiMessages, model, {
          temperature: aiConfig.temperature,
          topP: aiConfig.topP,
          topK: aiConfig.topK,
          frequencyPenalty: aiConfig.frequencyPenalty,
          presencePenalty: aiConfig.presencePenalty,
          maxOutputTokens: aiConfig.maxTokens,
          enableWebSearch: enableWebSearch,
          enableDeepThinking: enableDeepThinking,
          reasoningEffort: aiConfig.reasoningEffort,
          responseDepth: aiConfig.responseDepth,
          signal: abortControllerRef.current?.signal
        }, (chunk, groundingMetadata, thought) => {
          if (chunk) {
            fullContent += chunk;
            const loopCheck = detectAndCleanRepetitionLoop(fullContent);
            if (loopCheck.isLoop) {
              fullContent = loopCheck.cleanText;
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: finalMetadata || m.groundingMetadata } : m));
              stopGeneration();
              return;
            }
          }
          if (thought) {
            fullThought += thought;
          }
          if (groundingMetadata) {
            finalMetadata = groundingMetadata;
          }
          
          const now = Date.now();
          if (now - lastUpdateTime > UPDATE_INTERVAL) {
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: finalMetadata || m.groundingMetadata } : m));
            lastUpdateTime = now;
          }
        });

        // Loop check on finished text
        const finalLoopCheck = detectAndCleanRepetitionLoop(fullContent);
        if (finalLoopCheck.isLoop) {
          fullContent = finalLoopCheck.cleanText;
        }

        // Final update to ensure everything is captured
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: finalMetadata || m.groundingMetadata } : m));

        // Auto image generation if activated
        if (enableSpiritualImage && fullContent.trim() && !abortControllerRef.current?.signal.aborted) {
          try {
            const imageDescriptionPrompt = `Based on the following Arabic text, generate a beautiful, highly detailed, serene, and symbolic visual prompt in English for an image generator (like Midjourney or Stable Diffusion) that captures the core spiritual, peaceful, cosmic, or historical essence of the text.
IMPORTANT:
- Output ONLY the prompt in English.
- Do NOT include conversational filler, introductions, explanations, or quotes.
- Keep the prompt under 55 words.
- Focus on serene, magnificent elements (e.g. glowing lighting, ancient Islamic architecture, cosmic stardust, warm golden lights, realistic rendering, peaceful atmosphere).
Text:
${fullContent}`;

            const imageDescriptionResponse = await callAI('gemini', [
              { role: 'user', content: imageDescriptionPrompt }
            ], 'gemini-3.8-flash', { signal: abortControllerRef.current?.signal });

            if (imageDescriptionResponse && imageDescriptionResponse.content) {
              const cleanPrompt = imageDescriptionResponse.content.trim()
                .replace(/["']/g, '')
                .replace(/[\r\n]+/g, ' ')
                .substring(0, 300);
              const randomSeed = Math.floor(Math.random() * 1000000);
              const imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
              
              // Attach the image URL to the message
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, imageUrl, imageModel: 'Pollinations AI (Flux)' } : m));
            }
          } catch (imgErr) {
            console.error("Failed to generate spiritual image:", imgErr);
          }
        }
      } catch (streamError: any) {
        if (abortControllerRef.current?.signal.aborted || streamError?.name === 'AbortError' || streamError?.message?.includes('aborted')) {
          console.log('Stream generation aborted gracefully by user or loop breaker.');
          if (fullContent || fullThought) {
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: finalMetadata || m.groundingMetadata } : m));
          }
          setIsLoading(false);
          return;
        }

        console.warn('Streaming failed, trying non-streamed failover:', streamError);
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: '⚡ جاري الاتصال بخادم بديل للحصول على الإجابة وتجاوز القيود...' } : m));
        
        try {
          const response = await callAIWithFailover(provider as AIProviderKey, aiMessages, model, {
            temperature: aiConfig.temperature,
            topP: aiConfig.topP,
            topK: aiConfig.topK,
            frequencyPenalty: aiConfig.frequencyPenalty,
            presencePenalty: aiConfig.presencePenalty,
            maxOutputTokens: aiConfig.maxTokens,
            enableWebSearch: enableWebSearch,
            enableDeepThinking: enableDeepThinking,
            reasoningEffort: aiConfig.reasoningEffort,
            responseDepth: aiConfig.responseDepth
          });
          
          let responseContent = response.content;
          const loopCheck = detectAndCleanRepetitionLoop(responseContent);
          if (loopCheck.isLoop) {
            responseContent = loopCheck.cleanText;
          }

          let imageUrl: string | undefined = undefined;
          if (enableSpiritualImage && responseContent.trim()) {
            try {
              const imageDescriptionPrompt = `Based on the following Arabic text, generate a beautiful, highly detailed, serene, and symbolic visual prompt in English for an image generator (like Midjourney or Stable Diffusion) that captures the core spiritual, peaceful, cosmic, or historical essence of the text.
IMPORTANT:
- Output ONLY the prompt in English.
- Do NOT include conversational filler, introductions, explanations, or quotes.
- Keep the prompt under 55 words.
- Focus on serene, magnificent elements (e.g. glowing lighting, ancient Islamic architecture, cosmic stardust, warm golden lights, realistic rendering, peaceful atmosphere).
Text:
${responseContent}`;

              const imageDescriptionResponse = await callAI('gemini', [
                { role: 'user', content: imageDescriptionPrompt }
              ], 'gemini-3.8-flash');

              if (imageDescriptionResponse && imageDescriptionResponse.content) {
                const cleanPrompt = imageDescriptionResponse.content.trim()
                  .replace(/["']/g, '')
                  .replace(/[\r\n]+/g, ' ')
                  .substring(0, 300);
                const randomSeed = Math.floor(Math.random() * 1000000);
                imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
              }
            } catch (imgErr) {
              console.error("Failed to generate spiritual image in fallback:", imgErr);
            }
          }

          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: responseContent, model: response.model, imageUrl, groundingMetadata: response.groundingMetadata, thought: response.thought } : m));
        } catch (fallbackError) {
          setMessages(prev => prev.slice(0, -1));
          throw fallbackError;
        }
      }
      
      // Input is cleared by ChatInput itself
    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : (error?.message || String(error) || 'عذراً، حدث خطأ في الاتصال. حاول مرة أخرى.');
      
      const isQuota = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('RESOURCE_EXHAUSTED');
      const isServiceUnavailable = errorMessage.includes('503') || errorMessage.includes('Service Unavailable') || errorMessage.includes('demand');

      if (errorMessage.includes('404') || errorMessage.includes('Requested entity was not found') || errorMessage.includes('API key')) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ يرجى التأكد من إدخال مفتاح API صحيح والمحاولة مرة أخرى.` } as AIMessage]);
      } else if (isQuota) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `⚠️ **تنبيه: تم تجاوز حصة الاستخدام المؤقتة.**
          
يبدو أن جميع الخوادم المتاحة حالياً تحت ضغط كبير أو أن الحصة المجانية قد نفدت مؤقتاً.

**ماذا يمكنك أن تفعل؟**
1. الانتظار لمدة 60 ثانية والمحاولة مرة أخرى.
2. استخدام مفتاح API الخاص بك من **الإعدادات ⚙️** لضمان استمرارية الخدمة.
3. تغيير النموذج المستخدم من الإعدادات قد يساعد أحياناً.` 
        } as AIMessage]);
      } else if (isServiceUnavailable) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `⚠️ **الخدمة غير متوفرة حالياً.**
          
نواجه صعوبة في الاتصال بالنماذج الذكية بسبب ضغط مفاجئ على الخدمة. يرجى إعادة المحاولة بعد لحظات قليلة.` 
        } as AIMessage]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `عذراً، حدث خطأ: ${errorMessage}` } as AIMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, messageId: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(console.error);
    }
    setCopyFeedback(messageId);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const copyChatAsMarkdown = () => {
    const markdown = messages.map(m => `**${m.role === 'user' ? 'المستخدم' : 'مداد الرحمن'}**:\n\n${m.content}\n\n---`).join('\n\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(markdown).catch(console.error);
    }
  };

  const exportChats = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allChats));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "midad_rahman_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importChats = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          const validChats: ChatHistory[] = imported.filter((c: any) =>
            c &&
            typeof c === 'object' &&
            typeof c.id === 'string' &&
            typeof c.title === 'string' &&
            Array.isArray(c.messages) &&
            c.messages.every((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          ).map((c: any) => ({
            ...c,
            timestamp: typeof c.timestamp === 'number' && !Number.isNaN(c.timestamp) ? c.timestamp : Date.now(),
          }));

          if (validChats.length > 0) {
            setAllChats(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const dedupedNew = validChats.filter(c => !existingIds.has(c.id));
              return [...dedupedNew, ...prev].slice(0, 20);
            });
          }
        }
      } catch (err) {
        console.error('Import failed:', err);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const clearAllHistory = () => {
    setAllChats([]);
    safeLocalStorageRemove('midad_all_chats');
    startNewChat();
    setShowClearAllConfirm(false);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredHistory = allChats.filter(chat => {
    if (!normalizedQuery) return true;
    const titleMatches = Boolean(chat.title && typeof chat.title === 'string' && chat.title.toLowerCase().includes(normalizedQuery));
    const messageMatches = Boolean(
      chat.messages &&
      Array.isArray(chat.messages) &&
      chat.messages.some(m => m.content && typeof m.content === 'string' && m.content.toLowerCase().includes(normalizedQuery))
    );
    return titleMatches || messageMatches;
  });

  const groupedChats = React.useMemo(() => {
    const groups: { [key: string]: ChatHistory[] } = {
      'المثبتة': [],
      'اليوم': [],
      'أمس': [],
      'الأسبوع الماضي': [],
      'أقدم': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    filteredHistory.forEach(chat => {
      if (chat.pinned) {
        groups['المثبتة'].push(chat);
        return;
      }

      const chatDate = new Date(chat.timestamp);
      chatDate.setHours(0, 0, 0, 0);

      if (chatDate.getTime() === today.getTime()) {
        groups['اليوم'].push(chat);
      } else if (chatDate.getTime() === yesterday.getTime()) {
        groups['أمس'].push(chat);
      } else if (chatDate.getTime() > lastWeek.getTime()) {
        groups['الأسبوع الماضي'].push(chat);
      } else {
        groups['أقدم'].push(chat);
      }
    });

    // Sort each group by timestamp descending
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => b.timestamp - a.timestamp);
    });

    return groups;
  }, [filteredHistory]);

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'مداد الرحمن',
        text: text,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      });
    }
  };

  const stopRecitation = () => {
    currentRecitationIdRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsGeneratingAudio(null);
  };

  const handleAIRecitation = async (text: string, index: number) => {
    const currentId = index.toString();
    
    if (isGeneratingAudio) {
      stopRecitation();
    }
    
    // Stop any browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    const playNextMessage = async () => {
      const msgs = latestMessages.current;
      const nextAssistantMessageIndex = msgs.findIndex((m, i) => i > index && m.role === 'assistant');
      
      if (nextAssistantMessageIndex !== -1) {
        await handleAIRecitation(msgs[nextAssistantMessageIndex].content, nextAssistantMessageIndex);
      } else {
        setIsGeneratingAudio(null);
        currentRecitationIdRef.current = null;
      }
    };
    
    // Check if we already have this audio cached in memory
    if (audioUrls[currentId]) {
      setIsGeneratingAudio(currentId);
      currentRecitationIdRef.current = currentId;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrls[currentId]);
      audioRef.current = audio;
      audio.onended = () => { playNextMessage(); };
      audio.onerror = (e) => { console.error("Audio playback error:", e); playNextMessage(); };
      await audio.play().catch(e => { 
        if (e.name !== 'AbortError') console.error(e); 
        playNextMessage(); 
      });
      return;
    }

    // Create text hash for robust caching
    const hashText = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    };
    
    // Check IndexedDB cache
    const cacheKey = `${currentId}_${selectedVoice}_${hashText(text)}`;
    const cachedBlob = await getAudioFromCache(cacheKey);
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      globalAudioTimestamps[currentId] = Date.now();
        globalAudioUrls[currentId] = url;
      setAudioUrls(prev => ({ ...prev, [currentId]: url }));
      
      setIsGeneratingAudio(currentId);
      currentRecitationIdRef.current = currentId;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { playNextMessage(); };
      audio.onerror = (e) => { console.error("Audio playback error:", e); playNextMessage(); };
      await audio.play().catch(e => { 
        if (e.name !== 'AbortError') console.error(e); 
        playNextMessage(); 
      });
      return;
    }
    
    setIsGeneratingAudio(currentId);
    currentRecitationIdRef.current = currentId;
    
    const audioQueue: string[] = [];
    let isPlaying = false;
    let isFinishedGenerating = false;
    let fallbackTriggered = false;

    const playNextChunk = () => {
      if (fallbackTriggered || currentRecitationIdRef.current !== currentId) {
        while(audioQueue.length > 0) {
          URL.revokeObjectURL(audioQueue.shift()!);
        }
        return;
      }
      
      if (audioQueue.length > 0) {
        isPlaying = true;
        const url = audioQueue.shift()!;
        const audio = new Audio(url);
        audioRef.current = audio;
        
        let nextCalled = false;
        const callNext = () => {
          if (!nextCalled) {
            nextCalled = true;
            URL.revokeObjectURL(url);
            playNextChunk();
          }
        };

        audio.onended = callNext;
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          callNext();
        };

        audio.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Audio play error", e);
          }
          callNext();
        });
      } else {
        isPlaying = false;
        if (isFinishedGenerating) {
          playNextMessage();
        }
      }
    };

    const pcmBlobs: Blob[] = [];

    try {
      for await (const chunk of generateRecitationStream(text, selectedVoice)) {
        if (fallbackTriggered || currentRecitationIdRef.current !== currentId) {
          while(audioQueue.length > 0) {
            URL.revokeObjectURL(audioQueue.shift()!);
          }
          break;
        }
        
        // Accumulate raw PCM data for the final downloadable file
        if (chunk.pcmBytes) {
          const rawPcmBytes = chunk.pcmBytes;
          
          // Check if it has a WAV header and strip it
          const hasWavHeader = rawPcmBytes.length >= 44 && 
                               rawPcmBytes[0] === 0x52 && 
                               rawPcmBytes[1] === 0x49 && 
                               rawPcmBytes[2] === 0x46 && 
                               rawPcmBytes[3] === 0x46;
          
          const actualPcmBytes = hasWavHeader ? rawPcmBytes.slice(44) : rawPcmBytes;
          pcmBlobs.push(new Blob([actualPcmBytes]));
        }

        const blob = new Blob([chunk.audioBytes], { type: chunk.mimeType });
        const url = URL.createObjectURL(blob);
        
        audioQueue.push(url);
        
        if (!isPlaying) {
          playNextChunk();
        }
      }
      
      isFinishedGenerating = true;
      
      // Create final combined WAV for downloading
      if (pcmBlobs.length > 0 && !fallbackTriggered) {
        const pcmBlob = new Blob(pcmBlobs);
        const pcmArrayBuffer = await pcmBlob.arrayBuffer();
        const len = pcmArrayBuffer.byteLength;
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        view.setUint32(0, 0x52494646, false); // RIFF
        view.setUint32(4, 36 + len, true); // file length
        view.setUint32(8, 0x57415645, false); // WAVE
        view.setUint32(12, 0x666d7420, false); // fmt 
        view.setUint32(16, 16, true); // format chunk length
        view.setUint16(20, 1, true); // sample format (raw)
        view.setUint16(22, 1, true); // channel count
        view.setUint32(24, 24000, true); // sample rate
        view.setUint32(28, 24000 * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        view.setUint32(36, 0x64617461, false); // data
        view.setUint32(40, len, true); // data chunk length
        
        const finalBlob = new Blob([wavHeader, pcmArrayBuffer], { type: 'audio/wav' });
        const finalUrl = URL.createObjectURL(finalBlob);
        
        globalAudioTimestamps[currentId] = Date.now();
        globalAudioUrls[currentId] = finalUrl;
        pruneGlobalAudioCache();
        setAudioUrls(prev => ({ ...prev, [currentId]: finalUrl }));
        
        // Save to IndexedDB cache
        const hashText = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return hash.toString(36);
        };
        const cacheKey = `${currentId}_${selectedVoice}_${hashText(text)}`;
        saveAudioToCache(cacheKey, finalBlob);
      }

      if (!isPlaying && audioQueue.length === 0) {
        setIsGeneratingAudio(null);
      }
    } catch (error) {
      const isHardQuota = error === "HARD_QUOTA_LIMIT" || (error instanceof Error && error.message === "HARD_QUOTA_LIMIT");
      if (isHardQuota) {
        console.warn('Recitation quota limit reached. Falling back to browser TTS.');
        setQuotaError("تم الوصول إلى الحد الأقصى لحصة الاستخدام. سيتم استخدام القراءة التلقائية للمتصفح.");
        setTimeout(() => setQuotaError(null), 5000);
      } else {
        console.error('Recitation error:', error);
      }
      fallbackTriggered = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsGeneratingAudio(null);
      fallbackToBrowserTTS(text, currentId);
    }
  };

  const fallbackToBrowserTTS = (text: string, id: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      
      utterance.onstart = () => setIsGeneratingAudio(id);
      utterance.onend = () => setIsGeneratingAudio(null);
      utterance.onerror = () => setIsGeneratingAudio(null);
      
      window.speechSynthesis.speak(utterance);
    } else {
      setIsGeneratingAudio(null);
    }
  };

  const isReadingAllRef = useRef(false);

  const handleReadAllRecitation = async () => {
    if (isGeneratingAudio === 'all') {
      setIsGeneratingAudio(null);
      isReadingAllRef.current = false;
      stopRecitation();
      return;
    }
    
    // Stop any browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) return;
    
    const fullText = assistantMessages.map(m => m.content).join('\n\n');
    // Simple hash for the full text to invalidate cache when new messages arrive
    const textHash = 'all_' + fullText.length + '_' + fullText.substring(0, 20).replace(/\s/g, '');
    
    // Check memory first
    if (audioUrls[textHash]) {
        setIsGeneratingAudio('all');
        isReadingAllRef.current = true;
        currentRecitationIdRef.current = 'all';
        // Play existing
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(audioUrls[textHash]);
        audioRef.current = audio;
        audio.onended = () => { setIsGeneratingAudio(null); isReadingAllRef.current = false; currentRecitationIdRef.current = null; };
      audio.onerror = (e) => { console.error("Audio playback error:", e); setIsGeneratingAudio(null); isReadingAllRef.current = false; currentRecitationIdRef.current = null; };
      await audio.play().catch(e => { 
        if (e.name !== 'AbortError') console.error(e); 
        setIsGeneratingAudio(null); 
        isReadingAllRef.current = false; 
        currentRecitationIdRef.current = null; 
      });
      return;
    }
    
    setIsGeneratingAudio('all');
    isReadingAllRef.current = true;
    currentRecitationIdRef.current = 'all';
    
    const audioQueue: string[] = [];
    let isPlaying = false;
    let isFinishedGenerating = false;
    let fallbackTriggered = false;

    const playNextAll = () => {
      if (!isReadingAllRef.current || fallbackTriggered || currentRecitationIdRef.current !== 'all') {
        while(audioQueue.length > 0) {
          URL.revokeObjectURL(audioQueue.shift()!);
        }
        return;
      }
      
      if (audioQueue.length > 0) {
        isPlaying = true;
        const url = audioQueue.shift()!;
        const audio = new Audio(url);
        audioRef.current = audio;
        
        let nextCalled = false;
        const callNext = () => {
          if (!nextCalled) {
            nextCalled = true;
            URL.revokeObjectURL(url);
            playNextAll();
          }
        };

        audio.onended = callNext;
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          callNext();
        };
        
        audio.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Audio play failed:", e);
          }
          callNext();
        });
      } else if (isFinishedGenerating) {
        setIsGeneratingAudio(null);
        isReadingAllRef.current = false;
        currentRecitationIdRef.current = null;
      } else {
        isPlaying = false;
      }
    };

    let combinedPcmBytes = new Uint8Array(0);

    try {
      for await (const chunk of generateRecitationStream(fullText, selectedVoice)) {
        if (fallbackTriggered || currentRecitationIdRef.current !== 'all') {
          while(audioQueue.length > 0) {
            URL.revokeObjectURL(audioQueue.shift()!);
          }
          break;
        }
        
        if (chunk.pcmBytes) {
          const rawPcmBytes = chunk.pcmBytes;
          
          const hasWavHeader = rawPcmBytes.length >= 44 && 
                               rawPcmBytes[0] === 0x52 && 
                               rawPcmBytes[1] === 0x49 && 
                               rawPcmBytes[2] === 0x46 && 
                               rawPcmBytes[3] === 0x46;
          
          const actualPcmBytes = hasWavHeader ? rawPcmBytes.slice(44) : rawPcmBytes;

          const newCombined = new Uint8Array(combinedPcmBytes.length + actualPcmBytes.length);
          newCombined.set(combinedPcmBytes, 0);
          newCombined.set(actualPcmBytes, combinedPcmBytes.length);
          combinedPcmBytes = newCombined;
        }

        const blob = new Blob([chunk.audioBytes], { type: chunk.mimeType });
        const url = URL.createObjectURL(blob);
        
        audioQueue.push(url);

        if (!isPlaying) {
          playNextAll();
        }
      }
      
      isFinishedGenerating = true;
      
      if (combinedPcmBytes.length > 0 && !fallbackTriggered) {
        const len = combinedPcmBytes.length;
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        view.setUint32(0, 0x52494646, false); // RIFF
        view.setUint32(4, 36 + len, true); // file length
        view.setUint32(8, 0x57415645, false); // WAVE
        view.setUint32(12, 0x666d7420, false); // fmt 
        view.setUint32(16, 16, true); // format chunk length
        view.setUint16(20, 1, true); // sample format (raw)
        view.setUint16(22, 1, true); // channel count
        view.setUint32(24, 24000, true); // sample rate
        view.setUint32(28, 24000 * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        view.setUint32(36, 0x64617461, false); // data
        view.setUint32(40, len, true); // data chunk length
        
        const finalWav = new Uint8Array(44 + len);
        finalWav.set(new Uint8Array(wavHeader), 0);
        finalWav.set(combinedPcmBytes, 44);
        
        const finalBlob = new Blob([finalWav], { type: 'audio/wav' });
        const finalUrl = URL.createObjectURL(finalBlob);
        
        globalAudioTimestamps[textHash] = Date.now();
        globalAudioUrls[textHash] = finalUrl;
        pruneGlobalAudioCache();
        setAudioUrls(prev => ({ ...prev, [textHash]: finalUrl }));
        
        const cacheKey = `${textHash}_${selectedVoice}`;
        saveAudioToCache(cacheKey, finalBlob);
      }

      if (!isPlaying && audioQueue.length === 0) {
        setIsGeneratingAudio(null);
      }
    } catch (error) {
      const isHardQuota = error === "HARD_QUOTA_LIMIT" || (error instanceof Error && error.message === "HARD_QUOTA_LIMIT");
      if (isHardQuota) {
        console.warn('Recitation quota limit reached. Falling back to browser TTS.');
        setQuotaError("تم الوصول إلى الحد الأقصى لحصة الاستخدام. سيتم استخدام القراءة التلقائية للمتصفح.");
        setTimeout(() => setQuotaError(null), 5000);
      } else {
        console.error('Recitation error:', error);
      }
      fallbackTriggered = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsGeneratingAudio(null);
      fallbackToBrowserTTS(fullText, 'all');
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 1, y: 0 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-[100dvh] sm:w-[98vw] sm:h-[98vh] max-w-none bg-[#fcfaf7] dark:bg-[#0c0a09] flex flex-col overflow-hidden sm:rounded-2xl shadow-2xl border border-amber-100/50 dark:border-amber-900/30 relative"
          aria-label="واجهة مداد الرحمن"
          role="dialog"
        >
        {/* Floating Zen Mode Restore Button */}
        {isZenMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsZenMode(false)}
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-md border border-amber-200/50 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 shadow-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all hover:scale-105 flex items-center gap-2 text-xs font-bold font-kufi"
            title="إظهار الهيكل (إلغاء الوضع البسيط)"
          >
            <Maximize2 size={15} className="text-amber-600 animate-pulse" />
            <span>إظهار الهيكل</span>
          </motion.button>
        )}

        {/* Header */}
        {!isZenMode && (
          <div className="min-h-14 flex items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md border-b border-amber-200/50 dark:border-amber-800/50 sticky top-0 z-40 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${showHistory ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100' : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}
                title="السجل"
              >
                <History size={18} />
              </button>
              <div className="flex flex-col shrink-0">
                <h2 className="text-xs sm:text-base font-bold text-amber-900 dark:text-amber-100 font-kufi leading-tight whitespace-nowrap">مداد الرحمن</h2>
                <span className="hidden min-[420px]:block text-[9px] text-amber-600/70 dark:text-amber-400/70 font-bold tracking-tight whitespace-nowrap">بحر الكلمات لا ينفد</span>
              </div>
            </div>
            
            <div className="flex items-center gap-0.5 sm:gap-2 overflow-x-auto hide-scrollbar min-w-0">
              {/* Sleep Timer Button with Live Gradual Countdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowSleepTimerMenu(!showSleepTimerMenu)}
                  className={`p-1.5 sm:p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold ${
                    isTimerActive
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md ring-2 ring-amber-400/30'
                      : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}
                  title="مؤقت النوم التلقائي"
                >
                  <Moon size={17} className={isTimerActive ? "animate-pulse text-amber-200" : ""} />
                  {isTimerActive && (
                    <span className="font-mono tracking-wider font-bold text-xs">{formattedTime}</span>
                  )}
                </button>

                {showSleepTimerMenu && (
                  <div className="fixed sm:absolute top-14 sm:top-full left-2 sm:left-0 mt-1 sm:mt-2 w-52 bg-white dark:bg-[#292524] border border-amber-200 dark:border-amber-800 shadow-2xl rounded-2xl overflow-hidden py-1.5 z-50 text-right" dir="rtl">
                    <div className="px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Moon size={14} className="text-amber-600" /> مؤقت النوم</span>
                      {isTimerActive && <span className="text-amber-600 font-mono text-xs">{formattedTime}</span>}
                    </div>
                    <div className="text-[11px] text-amber-800/60 dark:text-amber-200/60 px-3 pt-1 pb-1">إيقاف التلاوة وتوفير الطاقة بعد:</div>
                    <button 
                      onClick={() => { startTimer(15); setShowSleepTimerMenu(false); }}
                      className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 transition-colors flex justify-between items-center"
                    >
                      <span>15 دقيقة</span>
                      <span className="text-[10px] text-amber-500 font-normal">تلقائي</span>
                    </button>
                    <button 
                      onClick={() => { startTimer(30); setShowSleepTimerMenu(false); }}
                      className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 transition-colors flex justify-between items-center"
                    >
                      <span>30 دقيقة</span>
                      <span className="text-[10px] text-amber-500 font-normal">تلقائي</span>
                    </button>
                    <button 
                      onClick={() => { startTimer(60); setShowSleepTimerMenu(false); }}
                      className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 transition-colors flex justify-between items-center"
                    >
                      <span>60 دقيقة</span>
                      <span className="text-[10px] text-amber-500 font-normal">تلقائي</span>
                    </button>
                    {isTimerActive && (
                      <button 
                        onClick={() => { cancelTimer(); setShowSleepTimerMenu(false); }}
                        className="w-full text-right px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-t border-amber-100 dark:border-amber-800/60 transition-colors"
                      >
                        إلغاء المؤقت
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsLiveMode(!isLiveMode)}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 ${isLiveMode ? 'bg-sky-600 text-white shadow-md' : 'bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40'}`}
                title="تفعيل/إيقاف المحادثة الصوتية والنصية المباشرة لمداد الرحمن"
              >
                <Radio size={16} className={isLiveMode ? 'animate-pulse' : ''} />
                <span className="hidden sm:inline">{isLiveMode ? 'الوضع النصي' : 'بث صوتي حي'}</span>
              </button>
              <button 
                onClick={() => setIsZenMode(true)}
                className="p-1.5 sm:p-2 rounded-xl transition-all hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0"
                title="الوضع البسيط (تركيز كامل وإخفاء الهيكل)"
              >
                <Minimize2 size={17} />
              </button>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${showSettings ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100' : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}
                title="إعدادات"
              >
                <Settings size={17} />
              </button>
              <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-0.5 shrink-0"></div>
              <button 
                onClick={handleReadAllRecitation}
                className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${isGeneratingAudio === 'all' ? 'text-amber-900 animate-pulse' : 'text-amber-700'}`}
                title="قراءة الكل"
              >
                <Volume2 size={17} />
              </button>
              <button 
                onClick={copyChatAsMarkdown}
                className="p-1.5 sm:p-2 text-amber-700 hover:text-amber-900 shrink-0"
                title="نسخ الكل"
              >
                <Copy size={17} />
              </button>
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 sm:p-2 text-red-500 hover:text-red-600 shrink-0"
                title="مسح"
              >
                <Trash2 size={17} />
              </button>
              <button 
                onClick={onClose}
                className="mr-0.5 px-2 py-1 rounded-lg bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border border-amber-200/50 font-bold text-xs shrink-0 whitespace-nowrap"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
        
      {/* Clear Confirmation Overlay */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-red-100 dark:border-red-900/30 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">مسح المحادثة؟</h3>
              <p className="text-amber-800/70 dark:text-amber-200/70 mb-8">هل أنت متأكد من رغبتك في مسح جميع الرسائل في هذه المحادثة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => {
                    setMessages([{
                      role: 'assistant',
                      content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
                    }]);
                    safeLocalStorageRemove('midad_alrahman_history');
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  نعم، امسح
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showClearAllConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowClearAllConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-red-100 dark:border-red-900/30 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">مسح السجل بالكامل؟</h3>
              <p className="text-amber-800/70 dark:text-amber-200/70 mb-8">هل أنت متأكد من رغبتك في مسح جميع المحادثات المسجلة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearAllConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={clearAllHistory}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  نعم، امسح السجل
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showFactoryResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowFactoryResetConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-amber-100 dark:border-amber-950/40 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">إعادة ضبط المصنع؟</h3>
              <p className="text-amber-800/70 dark:text-amber-200/70 mb-8">سيقوم هذا الخيار بمسح جميع المحادثات والبيانات المسجلة، وإعادة جميع الإعدادات للوضع الافتراضي الأولي تماماً.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowFactoryResetConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => {
                    try {
                      localStorage.clear();
                    } catch (e) {
                      console.error('Failed to clear localStorage:', e);
                    }
                    window.location.reload();
                  }}
                  className="flex-1 py-3 rounded-2xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
                >
                  نعم، أعد الضبط
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowHelp(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-md rounded-3xl p-8 shadow-2xl border border-amber-100 dark:border-amber-900/50 text-right"
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                  <HelpCircle size={24} />
                </div>
                <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">دليل مداد الرحمن</h3>
              </div>
              
              <div className="space-y-6 text-amber-800 dark:text-amber-200 leading-relaxed">
                <div className="flex gap-4">
                  <div className="mt-1 text-amber-600"><Sparkles size={20} /></div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">تقديم أفكار</h4>
                    <p className="text-sm opacity-80">اطلب من مداد اقتراح أفكار إبداعية للتأمل في القرآن أو مشاركة معانيه.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="mt-1 text-amber-600"><Search size={20} /></div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">بحث قرآني ذكي</h4>
                    <p className="text-sm opacity-80">ابحث عن موضوعات محددة وسيقوم مداد بجمع الآيات ذات الصلة وشرحها.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="mt-1 text-amber-600"><ImageIcon size={20} /></div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">توليد رؤى بصرية</h4>
                    <p className="text-sm opacity-80">حول الآيات إلى صور فنية تعبر عن معانيها الروحية والجمالية.</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setShowHelp(false)}
                className="w-full mt-8 py-4 rounded-2xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
              >
                فهمت ذلك
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        {quotaError && (
          <div className="absolute top-4 left-4 right-4 bg-amber-500 text-white p-4 rounded-lg shadow-lg z-50 text-center">
            {quotaError}
          </div>
        )}
        {microphoneError && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 text-center">
            {microphoneError}
          </div>
        )}
        {/* History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 right-0 w-full sm:w-80 bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-3xl border-l border-amber-100 dark:border-amber-900 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-amber-100 dark:border-amber-900 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                <h3 className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <History size={18} /> سجل المداد
                </h3>
                <div className="flex gap-1">
                  <button onClick={exportChats} className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700" title="تصدير السجل"><Download size={16} /></button>
                  <label className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 cursor-pointer" title="استيراد السجل">
                    <Upload size={16} />
                    <input type="file" className="hidden" onChange={importChats} accept=".json" />
                  </label>
                  <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-amber-100 rounded-lg"><X size={18} /></button>
                </div>
              </div>
              <div className="p-3 border-b border-amber-100 dark:border-amber-900">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="بحث في السجل..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 pr-8 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                    dir="rtl"
                  />
                  <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <button 
                  onClick={startNewChat}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center gap-2 font-bold transition-all"
                >
                  <RefreshCw size={18} /> محادثة جديدة
                </button>
                {filteredHistory.length === 0 ? (
                  <div className="py-10 text-center text-amber-400 dark:text-amber-600/70 italic text-sm">
                    {searchQuery ? 'لم يتم العثور على نتائج' : 'لا يوجد سجل محادثات بعد'}
                  </div>
                ) : (
                  Object.entries(groupedChats).map(([groupName, chats]) => {
                    if (chats.length === 0) return null;
                    return (
                      <div key={groupName} className="mb-4">
                        <h4 className="text-xs font-bold text-amber-600/70 dark:text-amber-500/70 mb-2 px-2 flex items-center gap-1">
                          {groupName === 'المثبتة' && <Pin size={12} />}
                          {groupName === 'اليوم' && <Calendar size={12} />}
                          {groupName}
                        </h4>
                        <div className="space-y-1">
                          {chats.map(chat => (
                            <div 
                              key={chat.id}
                              onClick={() => loadChat(chat)}
                              className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${chat.id === currentChatId ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700' : 'hover:bg-amber-50 border-transparent dark:hover:bg-amber-900/20'}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  {editingChatId === chat.id ? (
                                    <input
                                      type="text"
                                      value={editTitleValue}
                                      onChange={(e) => setEditTitleValue(e.target.value)}
                                      onBlur={(e) => saveEditTitle(chat.id, e as any)}
                                      onKeyDown={(e) => e.key === 'Enter' && saveEditTitle(chat.id, e)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full bg-white dark:bg-black border border-amber-300 rounded px-1 text-sm font-bold text-amber-900 dark:text-amber-100 outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100 truncate pl-6">{chat.title}</p>
                                  )}
                                  <p className="text-[10px] text-amber-500 mt-1">{new Date(chat.timestamp).toLocaleString('ar-SA')}</p>
                                </div>
                                <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-black/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
                                  <button 
                                    onClick={(e) => togglePinChat(chat.id, e)}
                                    className={`p-1.5 rounded-md transition-all ${chat.pinned ? 'text-amber-600 bg-amber-100' : 'text-amber-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                    title={chat.pinned ? "إلغاء التثبيت" : "تثبيت"}
                                  >
                                    <Pin size={12} className={chat.pinned ? "fill-current" : ""} />
                                  </button>
                                  <button 
                                    onClick={(e) => startEditTitle(chat, e)}
                                    className="p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all"
                                    title="تعديل العنوان"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={(e) => deleteChat(chat.id, e)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-all"
                                    title="حذف"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
                <button 
                  onClick={() => setShowClearAllConfirm(true)}
                  className="w-full p-2 text-[10px] text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1 transition-colors mt-4"
                >
                  <Trash2 size={12} /> مسح السجل بالكامل
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Sidebar */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="absolute inset-y-0 left-0 w-full sm:w-96 bg-white dark:bg-[#1c1917] border-r border-amber-100 dark:border-amber-900 z-40 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-amber-100 dark:border-amber-900 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                <h3 className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <Settings size={18} /> إعدادات المداد
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-amber-100 rounded-lg"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-6">
                <section>
                  <label className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 block">مزود الذكاء الاصطناعي</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map(key => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedProvider(key);
                          setModelSearchQuery('');
                          const providerModels = getDynamicModelsList(key);
                          const defaultModel = AI_PROVIDERS[key]?.defaultModel && providerModels.includes(AI_PROVIDERS[key].defaultModel)
                            ? AI_PROVIDERS[key].defaultModel
                            : (providerModels[0] || 'gemini-3.8-flash');
                          const newModelStr = `${key}|${defaultModel}`;
                          setSelectedModel(newModelStr);
                          safeLocalStorageSet('midad_provider', key);
                          safeLocalStorageSet('midad_model', defaultModel);
                          const pKeyName = AI_PROVIDERS[key]?.keyName;
                          const pKey = pKeyName ? (safeLocalStorageGet(pKeyName) || '') : '';
                          fetchAndUpdateModels(key, pKey).catch(console.warn);
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedProvider === key ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-amber-50/30 border-amber-100 text-amber-700 hover:border-amber-300'}`}
                      >
                        <div className="flex items-center gap-3">
                          {key === 'gemini' && <Brain size={18} className="text-blue-500" />}
                          {key === 'groq' && <Zap size={18} className="text-orange-500" />}
                          {key === 'mistral' && <Sparkles size={18} className="text-orange-400" />}
                          {key === 'openrouter' && <Cpu size={18} className="text-purple-500" />}
                          {key === 'kilo' && <Cpu size={18} className="text-indigo-500" />}
                          {key === 'deepseek' && <Brain size={18} className="text-cyan-500" />}
                          {key === 'routeway' && <ShieldCheck size={18} className="text-green-500" />}
                          {key === 'pollinations' && <ImageIcon size={18} className="text-pink-500" />}
                          {key === 'stability' && <ImageIcon size={18} className="text-rose-500" />}
                          {key === 'huggingface' && <Sparkles size={18} className="text-yellow-500" />}
                          <span className="font-bold text-sm">{AI_PROVIDERS[key].name}</span>
                        </div>
                        {selectedProvider === key && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-amber-600 uppercase tracking-wider block">النموذج المختار</label>
                    <button
                      onClick={handleRefreshModels}
                      disabled={isUpdatingModels}
                      className="text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 flex items-center gap-1 hover:underline disabled:opacity-55"
                      title="تحديث النماذج تلقائياً من خوادم المزود"
                    >
                      {isUpdatingModels ? (
                        <>
                          <Loader2 size={10} className="animate-spin" />
                          جاري التحديث...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={10} />
                          تحديث تلقائي من المصدر
                        </>
                      )}
                    </button>
                  </div>
                  {modelsUpdatedMessage && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-2 py-1 px-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-100 dark:border-amber-900/60 animate-pulse text-center font-medium">
                      {modelsUpdatedMessage}
                    </p>
                  )}
                  {(() => {
                    void modelsVersion;
                    const allModels = Array.from(new Set(getDynamicModelsList(selectedProvider) as string[]));
                    const totalFreeCount = allModels.filter(m => classifyModelPricing(selectedProvider, m) === 'free').length;
                    const totalPaidCount = allModels.length - totalFreeCount;
                    const q = modelSearchQuery.trim().toLowerCase();
                    const visibleModels = q ? allModels.filter(m => m.toLowerCase().includes(q)) : allModels;
                    const freeModels = visibleModels.filter(m => classifyModelPricing(selectedProvider, m) === 'free');
                    const paidModels = visibleModels.filter(m => classifyModelPricing(selectedProvider, m) === 'paid');

                    return (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder={`ابحث في ${allModels.length} نموذج (deepseek, qwen, gpt, free)...`}
                            className="w-full p-2 pr-8 rounded-xl bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                            dir="rtl"
                          />
                          <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-amber-700/80 dark:text-amber-300/80 px-1">
                          <span>الكل: <strong>{allModels.length}</strong> ({AI_PROVIDERS[selectedProvider]?.name})</span>
                          <span className="flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">مجاني: {totalFreeCount}</span>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">مدفوع: {totalPaidCount}</span>
                          </span>
                        </div>
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                        {freeModels.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 px-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>النماذج المجانية ({freeModels.length})</span>
                            </div>
                            <div className="space-y-1.5">
                              {freeModels.map((modelName: string) => (
                                <button
                                  key={modelName}
                                  onClick={() => {
                                    const newVal = `${selectedProvider}|${modelName}`;
                                    setSelectedModel(newVal);
                                    safeLocalStorageSet('midad_model', modelName);
                                  }}
                                  className={`w-full flex items-center justify-between p-2.5 px-3 rounded-xl border text-xs transition-all ${
                                    selectedModel === `${selectedProvider}|${modelName}` 
                                      ? 'bg-amber-600 border-amber-700 text-white font-bold shadow-sm' 
                                      : 'bg-white dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:border-amber-300'
                                  }`}
                                >
                                  <span className="truncate">{modelName}</span>
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium border border-emerald-200/50">مجاني</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {paidModels.length > 0 && (
                          <div className="pt-2 border-t border-amber-200/30 dark:border-amber-800/20">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 px-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span>النماذج الاحترافية والمدفوعة ({paidModels.length})</span>
                            </div>
                            <div className="space-y-1.5">
                              {paidModels.map((modelName: string) => (
                                <button
                                  key={modelName}
                                  onClick={() => {
                                    const newVal = `${selectedProvider}|${modelName}`;
                                    setSelectedModel(newVal);
                                    safeLocalStorageSet('midad_model', modelName);
                                  }}
                                  className={`w-full flex items-center justify-between p-2.5 px-3 rounded-xl border text-xs transition-all ${
                                    selectedModel === `${selectedProvider}|${modelName}` 
                                      ? 'bg-amber-600 border-amber-700 text-white font-bold shadow-sm' 
                                      : 'bg-white dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:border-amber-300'
                                  }`}
                                >
                                  <span className="truncate">{modelName}</span>
                                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-200/50">مدفوع / خاص</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                    );
                  })()}
                </section>
                
                <section>
                  <AIAdvancedSettings
                    config={aiConfig}
                    onChange={setAiConfig}
                    extraTool={{
                      label: 'صورة معبرة تلقائية (Pollinations)',
                      description: 'توليد صورة تأملية ترافق الإجابة تلقائياً',
                      checked: enableSpiritualImage,
                      onChange: setEnableSpiritualImage
                    }}
                    customPlaceholder="أضف تعليمات خاصة لمداد الرحمن (مثلاً: ركز على آيات الصبر، أو أسلوب علمي موثق...)"
                  />
                </section>

                <section>
                  <label className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Trash2 size={14} /> إدارة البيانات والمصنع
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowClearAllConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 transition-all font-bold text-sm"
                    >
                      <Trash2 size={16} /> مسح كل السجل
                    </button>
                    <button
                      onClick={() => setShowFactoryResetConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-all font-bold text-sm"
                    >
                      <RefreshCw size={16} className="text-amber-600 dark:text-amber-400" /> إعادة ضبط المصنع
                    </button>
                  </div>
                </section>

                <section>
                  <label className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck size={14} /> تنبيه هام وتدقيق
                  </label>
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 text-[10px] text-red-800 dark:text-red-200 leading-relaxed text-justify">
                    <p className="font-bold mb-1">﴿فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ﴾</p>
                    إن استجابات «مداد الرحمن» هي نتاج تقنيات الذكاء الاصطناعي، ورغم حرصنا على استقاء الكلمات من القرآن والسنة، إلا أن الخطأ وارد. كلام الله يحتاج للتدقيق التام من المصادر الموثوقة والمصاحف المعتمدة. لا تعتمد على هذه المخرجات في الأحكام الشرعية أو الفتاوى دون الرجوع لأهل العلم.
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div 
          className="flex-1 flex flex-col overflow-hidden relative" 
          aria-live="polite"
        >
          {/* Ambient spiritual glow effect in Zen Mode */}
          {isZenMode && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <motion.div 
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.03, 0.08, 0.03],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 blur-3xl"
              />
              <motion.div 
                animate={{
                  scale: [1.15, 1, 1.15],
                  opacity: [0.02, 0.06, 0.02],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-emerald-300 to-amber-400 blur-3xl"
              />
            </div>
          )}

          {isLiveMode ? (
            <LiveVoicePanel
              snapshot={{
                personaMode: 'midad',
                currentContext,
              }}
              onAction={onAction}
              title="مداد الرحمن — البث الصوتي والنصي المباشر"
            />
          ) : (
            <>
              <MessageList 
                messages={messages}
                handleAIRecitation={handleAIRecitation}
                stopRecitation={stopRecitation}
                isGeneratingAudio={isGeneratingAudio}
                sendMessage={sendMessage}
                copyToClipboard={copyToClipboard}
                shareMessage={shareMessage}
                copyFeedback={copyFeedback}
                audioUrls={audioUrls}
                downloadAudioFile={downloadAudioFile}
                selectedVoice={selectedVoice}
                onRegenerate={handleRegenerate}
                onEdit={handleEdit}
                isLoading={isLoading}
                selectedModel={selectedModel}
                providerName={AI_PROVIDERS[selectedProvider]?.name || 'Google Gemini'}
                isZenMode={isZenMode}
                suggestions={suggestions}
                suggestionsLoading={suggestionsLoading}
                autoOpenThoughts={aiConfig.autoOpenThoughts}
              />

              {/* Input Area */}
              <div className={`transition-all duration-500 ${isZenMode ? 'p-3 bg-transparent border-t-0 shadow-none z-10 w-full shrink-0' : 'p-3 sm:p-4 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-xl border-t border-amber-100/50 dark:border-amber-900/50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-10 w-full shrink-0'}`}>
                <div className={`transition-all duration-500 w-full max-w-4xl mx-auto flex flex-col gap-2 ${isZenMode ? 'bg-white/95 dark:bg-[#171513]/95 shadow-[0_15px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-1.5 rounded-3xl border border-amber-200/50 dark:border-amber-900/40 backdrop-blur-xl max-w-3xl' : ''}`}>
                  {/* Quick Actions before input */}
                  {!isZenMode && !isLoading && (
                    <div className="flex justify-center px-2 mb-1">
                      <div className="flex gap-2 p-1.5 bg-amber-50/50 dark:bg-amber-900/20 backdrop-blur-sm rounded-2xl border border-amber-100 dark:border-amber-900/50 overflow-x-auto scrollbar-hide max-w-full">
                        {messages.length > 1 && messages[messages.length-1].role === 'assistant' && (
                          <>
                            <button 
                              onClick={() => sendMessage('أكثر يا مداد الرحمن')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold whitespace-nowrap shadow-sm hover:shadow-md transition-all border border-amber-400/50"
                            >
                              <Sparkles size={14} className="animate-pulse" /> أكثر
                            </button>
                            {currentContext && (
                              <button 
                                onClick={() => {
                                  if (currentContext.surah && !currentContext.ayah) {
                                    sendMessage(`لخص لي سورة ${currentContext.surah} واستخرج لي أهم مقاصدها.`);
                                  } else if (currentContext.surah && currentContext.ayah) {
                                    sendMessage(`اشرح لي الآية ${currentContext.ayah} من سورة ${currentContext.surah} واستخرج لي الدروس المستفادة.`);
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1c1917] text-amber-700 dark:text-amber-400 text-xs font-bold whitespace-nowrap border-r border-amber-200 dark:border-amber-800 transition-colors shadow-sm"
                              >
                                <BookOpen size={14} /> تدبر
                              </button>
                            )}
                          </>
                        )}
                        <button 
                          onClick={() => sendMessage("اقترح علي فكرة جديدة للتأمل في القرآن")} 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white dark:hover:bg-black/20 text-amber-900 dark:text-amber-100 text-xs font-bold whitespace-nowrap transition-colors"
                        >
                          <Sparkles size={14} className="text-amber-600" /> فكرة
                        </button>
                        <button 
                          onClick={() => chatInputRef.current?.set("ابحث في القرآن عن آيات تتحدث عن ")} 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white dark:hover:bg-black/20 text-amber-900 dark:text-amber-100 text-xs font-bold whitespace-nowrap border-r border-amber-200 dark:border-amber-800 transition-colors"
                        >
                          <Search size={14} className="text-emerald-600" /> بحث
                        </button>
                        {/* Smart Quick Toggles */}
                        <div className="flex items-center border-r border-amber-200 dark:border-amber-800 pr-2 mr-1 gap-1">
                          <button 
                            onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${enableDeepThinking ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-black/20 text-amber-600/60 dark:text-amber-400/60'}`}
                            title={enableDeepThinking ? "إلغاء التفكير العميق" : "تفعيل التفكير العميق"}
                          >
                            <Lightbulb size={14} className={enableDeepThinking ? "fill-white" : ""} />
                          </button>
                          <button
                            onClick={() => setEnableWebSearch(!enableWebSearch)}
                            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${enableWebSearch ? 'bg-emerald-600 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-black/20 text-emerald-600/60'}`}
                            title={enableWebSearch ? "إلغاء بحث الويب" : "تفعيل بحث الويب للتحقق"}
                          >
                            <Globe size={14} />
                          </button>
                          <button
                            onClick={() => setEnableSpiritualImage(!enableSpiritualImage)}
                            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${enableSpiritualImage ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-black/20 text-blue-600/60'}`}
                            title={enableSpiritualImage ? "إلغاء الصورة المعبرة التلقائية" : "تفعيل توليد صور معبرة تلقائياً"}
                          >
                            <ImageIcon size={14} />
                          </button>
                        </div>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('open_spiritual_vision', { detail: { text: 'تأمل في آية قرآنية' } }))} 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white dark:hover:bg-black/20 text-amber-900 dark:text-amber-100 text-xs font-bold whitespace-nowrap border-r border-amber-200 dark:border-amber-800 transition-colors"
                        >
                          <ImageIcon size={14} className="text-blue-600" /> صورة
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <ChatInput 
                    onSendMessage={sendMessage}
                    isLoading={isLoading}
                    isListening={isListening}
                    isProcessingAudio={isProcessingAudio}
                    toggleListening={toggleListening}
                    onStop={stopGeneration}
                    ref={chatInputRef}
                  />
                  
                  {!isZenMode && (
                    <div className="flex flex-col gap-2 mt-2">
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  </motion.div>
  </>
);
};



