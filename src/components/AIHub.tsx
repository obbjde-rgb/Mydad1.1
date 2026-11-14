import React, { useState, useEffect, useRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Trash2, History, Sparkles, X, ChevronLeft, MessageSquare, Book, Lightbulb, ShieldAlert, RotateCcw, Copy, Volume2, Trash, StopCircle, RefreshCw, Share2, AudioLines, Image as ImageIcon, Palette, MonitorPlay, Cpu, ArrowDown, Heart, Users, Zap, Leaf, Mic, Brain, BookOpen, Download, Square as SquareIcon, Loader2, Terminal, Settings2, MoreVertical, ChevronDown, ChevronUp, Search, Moon, Radio } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { callAIWithFailover, AIProviderKey, AI_PROVIDERS, AIMessage, generateRecitationStream, callAIStream, getDynamicModelsList, fetchAndUpdateModels, fetchAllProvidersModels, detectAndCleanRepetitionLoop, classifyModelPricing, AIAdvancedConfig, loadAIAdvancedConfig, saveAIAdvancedConfig, getResponseDepthDirective } from '../services/aiService';
import { ReadAloud } from './ReadAloud';
import { ImageGenerator } from './ImageGenerator';
import { AIAdvancedSettings } from './chat/AIAdvancedSettings';
import { LiveVoicePanel } from './live/LiveVoicePanel';
import { safeLocalStorageSet, safeLocalStorageGet, safeLocalStorageRemove, getSurahDisplayName } from '../lib/utils';
import { useSleepTimer } from '../hooks/useSleepTimer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'chat' | 'event';
  eventIconName?: 'book' | 'history' | 'sparkles';
  model?: string;
  thought?: string;
  groundingMetadata?: any;
}

interface AIHubProps {
  isOpen: boolean;
  onClose: () => void;
  currentContext?: {
    surah?: string;
    ayah?: number;
    text?: string;
    tafsir?: string;
    tafsirRequest?: string;
    timestamp?: number;
  };
  provider: AIProviderKey;
  isFullScreen?: boolean;
  onAction?: (action: string, data?: any) => void;
  selectedVoice: string;
  viewMode?: string;
  lastSearchedText?: string;
  selectedReciter?: string;
  selectedQiraat?: string;
  selectedTafsir?: string;
  selectedTranslation?: string;
  initialInput?: string;
}

// Global cache for AIHub audio URLs to persist across unmounts
const globalAudioUrls: Record<string, string> = {};

export interface ChatInputRef {
  append: (text: string) => void;
  clear: () => void;
  get: () => string;
  set: (text: string) => void;
}

const SUGGESTIONS = [
  { icon: <Book size={16} />, text: "اشرح لي معنى سورة الفاتحة بشكل مبسط وميسر", category: "قرآن وتفسير" },
  { icon: <History size={16} />, text: "ما هي أسباب نزول سورة الكهف وما العبرة منها؟", category: "أسباب النزول" },
  { icon: <Sparkles size={16} />, text: "كيف أربط آيات الصبر في القرآن بالسنة النبوية؟", category: "الربط بالسنة" },
  { icon: <Lightbulb size={16} />, text: "ابتكر لي خطة ذكية ومبتكرة لحفظ القرآن ومراجعته", category: "حلول ذكية" },
  { icon: <ShieldAlert size={16} />, text: "كيف أتعامل مع ضغوط الحياة المعاصرة من منظور إسلامي؟", category: "حياة المسلم" },
  { icon: <Heart size={16} />, text: "كيف أصل للخشوع التام في الصلاة وتصفية الذهن؟", category: "تطوير روحي" },
  { icon: <Users size={16} />, text: "ما هي أسس بناء أسرة مسلمة سعيدة ومستقرة؟", category: "علاقات اجتماعية" },
  { icon: <Zap size={16} />, text: "اقترح لي روتيناً يومياً يجمع بين الإنتاجية والعبادة", category: "إنتاجية وحياة" },
  { icon: <MessageSquare size={16} />, text: "كيف أرد على الشبهات المعاصرة حول الإسلام بحكمة؟", category: "فكر ودعوة" },
  { icon: <Leaf size={16} />, text: "استخرج لي إعجازاً علمياً أو لغوياً من القرآن الكريم", category: "إعجاز وتأمل" },
  { icon: <Book size={16} />, text: "ما هي آداب تلاوة القرآن الكريم؟", category: "أخلاق وسلوك" },
  { icon: <Users size={16} />, text: "كيف أربي أطفالي على حب الصلاة؟", category: "تربية" },
  { icon: <Heart size={16} />, text: "أريد نصائح للتخلص من التوتر والقلق بذكر الله", category: "صحة ونفس" },
  { icon: <History size={16} />, text: "ما هي قصة أصحاب الفيل؟", category: "تاريخ" },
  { icon: <Sparkles size={16} />, text: "كيف كان النبي صلى الله عليه وسلم يقضي يومه؟", category: "سيرة نبوية" },
  { icon: <Zap size={16} />, text: "ما هي أهمية الصدقة في دفع البلاء؟", category: "تطوير روحي" },
  { icon: <Lightbulb size={16} />, text: "كيف أتعامل مع الفشل وأبدأ من جديد بالتوكل على الله؟", category: "تحفيز" },
  { icon: <MessageSquare size={16} />, text: "ما هي شروط قبول الدعاء؟", category: "تطوير روحي" },
  { icon: <History size={16} />, text: "حدثني عن فضل صلاة الفجر في جماعة", category: "تطوير روحي" },
  { icon: <Leaf size={16} />, text: "كيف أحافظ على نظافة البيئة من منظور إسلامي؟", category: "بيئة" },
  { icon: <Book size={16} />, text: "اربط هذه الآية بالسنة النبوية الشريفة", category: "قرآن وسنة" },
  { icon: <Lightbulb size={16} />, text: "ما هي الدروس التربوية المستفادة من هذه الآية؟", category: "تربية" },
  { icon: <Zap size={16} />, text: "كيف أطبق هذه الآية في حياتي اليومية؟", category: "تطبيق عملي" },
  { icon: <Sparkles size={16} />, text: "ما هي اللطائف البلاغية في هذا الموضع؟", category: "بلاغة" },
  { icon: <History size={16} />, text: "هل هناك أحاديث قدسية تتعلق بهذا المعنى؟", category: "حديث" },
  { icon: <ShieldAlert size={16} />, text: "خطة عمل مقترحة للعمل بمقتضى هذه الآية", category: "تطبيق عملي" },
  { icon: <Brain size={16} />, text: "حلل لي هذه الآية من منظور علم النفس الحديث", category: "تحليل ذكي" },
  { icon: <Users size={16} />, text: "كيف يمكن توظيف هذه الآية في حل النزاعات الأسرية؟", category: "علاقات" },
  { icon: <Cpu size={16} />, text: "ما هي الإعجازات العلمية المكتشفة في هذه السورة؟", category: "إعجاز" },
  { icon: <History size={16} />, text: "أريد ملخصاً لأهم الدروس المستفادة من سيرة الصحابة في هذه الآية", category: "تاريخ" },
  { icon: <Heart size={16} />, text: "كيف تعزز هذه الآية الصحة النفسية والمرونة؟", category: "صحة ونفس" },
  { icon: <Zap size={16} />, text: "استخرج لي 5 فوائد عملية من هذه السورة", category: "تطبيق عملي" },
];

const ChatInput = React.memo(React.forwardRef<ChatInputRef, { 
  onSendMessage: (text: string) => void, 
  isLoading: boolean,
  onStop?: () => void
}>(({ onSendMessage, isLoading, onStop }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localInput, setLocalInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ar-SA';

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setLocalInput(prev => prev + (prev ? ' ' : '') + transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // ignore abort error
      }
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        setIsListening(false);
      }
    } else {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    append: (text: string) => {
      setLocalInput(prev => prev + (prev ? ' ' : '') + text);
    },
    clear: () => {
      setLocalInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
      }
    },
    get: () => localInput,
    set: (text: string) => {
      setLocalInput(text);
    }
  }));

  const handleSend = () => {
    if (localInput.trim() && !isLoading) {
      onSendMessage(localInput);
      setLocalInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
      }
    }
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-400/20 to-blue-600/20 dark:from-sky-600/20 dark:to-blue-900/20 rounded-3xl blur-sm opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
      <div className="relative bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-xl rounded-3xl shadow-sm border border-amber-200/50 dark:border-white/10 transition-all duration-300 focus-within:shadow-md focus-within:border-sky-400/50 flex flex-col">
        {/* Command Mode Indicator */}
        {localInput.startsWith('/') && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute -top-10 right-4 bg-sky-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg border border-sky-400"
          >
            <Terminal size={14} />
            وضع الأوامر الذكية نشط
          </motion.div>
        )}
        <textarea
          ref={textareaRef}
          value={localInput}
          onChange={(e) => {
            setLocalInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="كيف يمكنني مساعدتك؟ (اكتب / للأوامر)"
          className="w-full bg-transparent border-none px-5 py-4 min-h-[56px] max-h-[150px] text-sm md:text-base focus:ring-0 outline-none resize-none dark:text-[#f5f5f4] leading-relaxed placeholder:text-amber-900/40 dark:placeholder:text-amber-100/30 font-medium"
          rows={1}
          dir="rtl"
          lang="ar"
        />
        
        {/* Toolkit Area inside the input */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* Right side styling - can add attachments here later */}
          <div></div>
          
          <div className="flex items-center gap-1.5 bg-amber-50/50 dark:bg-black/20 p-1 rounded-2xl backdrop-blur-sm border border-amber-200/30 dark:border-white/5">
            <button
              onClick={() => {
                if (!localInput.startsWith('/')) {
                  setLocalInput('/' + localInput);
                  textareaRef.current?.focus();
                }
              }}
              className={`p-2 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 flex items-center justify-center ${localInput.startsWith('/') ? 'bg-sky-500 text-white' : 'bg-white dark:bg-[#292524] text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'}`}
              title="وضع الأوامر (/) "
            >
              <Terminal size={18} />
            </button>
            <button
              onClick={toggleListening}
              className={`p-2 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 flex items-center justify-center ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-white dark:bg-[#292524] text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'}`}
              title={isListening ? "إيقاف الاستماع" : "تحدث الآن"}
            >
              {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
            </button>
            <div className="w-px h-6 bg-amber-200/50 dark:bg-amber-800/50 mx-0.5"></div>
            {isLoading && onStop ? (
              <button
                type="button"
                onClick={onStop}
                className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center animate-pulse"
                title="إيقاف التوليد"
              >
                <SquareIcon size={18} className="fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!localInput.trim() || isLoading}
                className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl disabled:opacity-40 disabled:hover:bg-sky-500 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rtl:-scale-x-100 rtl:ml-0.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}));

export const AIHub: React.FC<AIHubProps> = ({ 
  isOpen, onClose, currentContext, provider, isFullScreen = false, 
  onAction, selectedVoice, viewMode, lastSearchedText,
  selectedReciter, selectedQiraat, selectedTafsir, selectedTranslation,
  initialInput = ''
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'live' | 'image'>('chat');
  const [isZenMode, setIsZenMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = safeLocalStorageGet('ai_chat_history');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse chat history:", e);
      return [];
    }
  });
  const chatInputRef = useRef<ChatInputRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  const [aiConfig, setAiConfig] = useState<AIAdvancedConfig>(() =>
    loadAIAdvancedConfig('aihub_ai_settings_v2')
  );

  useEffect(() => {
    saveAIAdvancedConfig('aihub_ai_settings_v2', aiConfig);
  }, [aiConfig]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const toggleThoughtExpanded = useCallback((id: string) => {
    setExpandedThoughts(prev => ({ ...prev, [id]: !(prev[id] ?? aiConfig.autoOpenThoughts) }));
  }, [aiConfig.autoOpenThoughts]);

  useEffect(() => {
    if (isOpen && initialInput) {
      setTimeout(() => {
        chatInputRef.current?.set(initialInput);
      }, 100);
    }
  }, [isOpen, initialInput]);
  const [showHistory, setShowHistory] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const isMountedRef = useRef(true);
  const tafsirTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localProvider, setLocalProvider] = useState<AIProviderKey>(() => {
    const saved = safeLocalStorageGet('ai_provider') as AIProviderKey;
    return AI_PROVIDERS[saved] ? saved : 'gemini';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const savedProvider = (safeLocalStorageGet('ai_provider') as AIProviderKey) || 'gemini';
    const safeProvider = AI_PROVIDERS[savedProvider] ? savedProvider : 'gemini';
    const savedModel = safeLocalStorageGet(`ai_model_${safeProvider}`);
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
  const [localApiKey, setLocalApiKey] = useState(() => {
    const savedProvider = safeLocalStorageGet('ai_provider') as AIProviderKey;
    const safeProvider = AI_PROVIDERS[savedProvider] ? savedProvider : (AI_PROVIDERS[provider] ? provider : 'gemini');
    return safeLocalStorageGet(AI_PROVIDERS[safeProvider].keyName) || '';
  });
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>(globalAudioUrls);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<string | null>(null);
  const [useAIRecitation, setUseAIRecitation] = useState<boolean>(() => {
    try {
      const saved = safeLocalStorageGet('use_ai_recitation');
      return saved !== null ? JSON.parse(saved) === true : true;
    } catch {
      return true;
    }
  });
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsUpdatedMessage, setModelsUpdatedMessage] = useState<string | null>(null);
  const [modelsRefreshCounter, setModelsRefreshCounter] = useState(0);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const { isActive: isTimerActive, formattedTime, startTimer, cancelTimer } = useSleepTimer();
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);

  useEffect(() => {
    const handleSleepStop = () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setSpeakingId(null);
      setIsGeneratingAudio(null);
    };
    window.addEventListener('sleep_timer_triggered', handleSleepStop);
    return () => window.removeEventListener('sleep_timer_triggered', handleSleepStop);
  }, []);

  useEffect(() => {
    fetchAllProvidersModels(true).catch(console.error);
    const handleModelsUpdated = () => setModelsRefreshCounter(c => c + 1);
    window.addEventListener('models_updated', handleModelsUpdated);
    return () => window.removeEventListener('models_updated', handleModelsUpdated);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isAtBottom = useRef(true);
  const currentRecitationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If we're within 100px of the bottom, we consider it "at the bottom"
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottom.current = atBottom;
    setShowScrollButton(!atBottom && scrollHeight > clientHeight);
    
    // Calculate scroll progress
    const winScroll = scrollTop;
    const height = scrollHeight - clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    setScrollProgress(scrolled);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior
          });
        }
      });
    }
  };

  useEffect(() => {
    safeLocalStorageSet('ai_recitation_voice', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    const handleRefresh = () => {
      try {
        const updated = safeLocalStorageGet('ai_chat_history');
        if (updated) {
          const parsed = JSON.parse(updated);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to refresh ai history:", e);
      }
    };
    window.addEventListener('refresh_ai_history', handleRefresh);
    
    const handleTrigger = (e: any) => {
      setActiveTab('image');
    };
    window.addEventListener('trigger_image_gen', handleTrigger);
    
    return () => {
      window.removeEventListener('refresh_ai_history', handleRefresh);
      window.removeEventListener('trigger_image_gen', handleTrigger);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Use a small delay to ensure the content is rendered before scrolling
      const timer = setTimeout(() => {
        scrollToBottom('smooth');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isAtBottom.current) {
      scrollToBottom(isLoading ? 'auto' : 'smooth');
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (currentContext?.tafsirRequest && currentContext.timestamp) {
      // Check if this is a new request (within last 2 seconds)
      const now = Date.now();
      if (now - currentContext.timestamp < 2000) {
        if (currentContext.tafsirRequest === 'ai.explanation') {
          // Trigger AI explanation
          const prompt = `اشرح لي الآية رقم ${currentContext.ayah} من ${getSurahDisplayName(currentContext.surah)} شرحاً ميسراً ومختصراً. الآية هي: ${currentContext.text}`;
          handleSend(prompt, false, undefined, true);
        } else if (currentContext.tafsir) {
          // Add the fetched tafsir as a message
          const tafsirName = currentContext.tafsirRequest === 'ar.jalalayn' ? 'الجلالين' : 
                            currentContext.tafsirRequest === 'ar.muyassar' ? 'الميسر' : 
                            currentContext.tafsirRequest === 'ar.ibnkathir' ? 'ابن كثير' : 
                            currentContext.tafsirRequest === 'ar.qurtubi' ? 'القرطبي' : 
                            currentContext.tafsirRequest === 'ar.tabari' ? 'الطبري' : 
                            currentContext.tafsirRequest === 'ar.saadi' ? 'السعدي' : 
                            currentContext.tafsirRequest === 'ar.baghawi' ? 'البغوي' : 'المختار';
          
          const eventMessage: Message = {
            id: `tafsir-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            role: 'assistant',
            content: `### تفسير الآية ${currentContext.ayah} من ${getSurahDisplayName(currentContext.surah)} (${tafsirName})\n\n**الآية:** ${currentContext.text}\n\n**التفسير:**\n${currentContext.tafsir}`,
            timestamp: Date.now(),
            type: 'event',
            eventIconName: 'book'
          };
          
          setMessages(prev => {
            const newHistory = [...prev, eventMessage];
            // Trigger AI to provide additional value immediately
            const prompt = `لقد قرأت للتو تفسير ${tafsirName} للآية ${currentContext.ayah} من ${getSurahDisplayName(currentContext.surah)}. هل يمكنك تزويدي بلمحة ذكية (Smart Insight) أو تطبيق عملي لهذه الآية بناءً على هذا التفسير؟`;
            
            if (tafsirTimerRef.current) clearTimeout(tafsirTimerRef.current);
            tafsirTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                handleSend(prompt, false, newHistory, true);
              }
            }, 500);
            
            return newHistory;
          });
        }
      }
    }
  }, [currentContext?.timestamp, currentContext?.tafsir]);

  useEffect(() => {
    const timer = setTimeout(() => {
      safeLocalStorageSet('ai_chat_history', JSON.stringify(messages.slice(-50)));
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [messages]);

  const handleAIRecitation = async (messageId: string, text: string) => {
    const stopOtherAudio = () => {
      currentRecitationIdRef.current = null;
      setIsGeneratingAudio(null);
      
      // Stop Speech Synthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      
      // Stop all other HTML5 Audio elements except the current one if it's the same
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (audio !== audioRef.current) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Dispatch event to stop recitation in App.tsx
      window.dispatchEvent(new CustomEvent('stop_all_audio'));
    };

    if (isGeneratingAudio) {
      stopOtherAudio();
    }

    if (speakingId === messageId && !audioUrls[messageId]) {
      // It's playing via speechSynthesis, so let's just stop it
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }

    // If already generated, just play/pause
    if (audioUrls[messageId]) {
      if (audioRef.current) {
        if (speakingId === messageId) {
          audioRef.current.pause();
          setSpeakingId(null);
        } else {
          stopOtherAudio();
          audioRef.current.src = audioUrls[messageId];
          audioRef.current.play().catch(console.error);
          setSpeakingId(messageId);
        }
      }
      return;
    }

    stopOtherAudio();
    setIsGeneratingAudio(messageId);
    currentRecitationIdRef.current = messageId;
    
    const audioQueue: string[] = [];
    let isPlaying = false;
    let isFinishedGenerating = false;
    let fallbackTriggered = false;

    const playNext = () => {
      if (fallbackTriggered || currentRecitationIdRef.current !== messageId || !isMountedRef.current) {
        while (audioQueue.length > 0) {
          URL.revokeObjectURL(audioQueue.shift()!);
        }
        return;
      }
      
      if (audioQueue.length > 0) {
        isPlaying = true;
        const url = audioQueue.shift()!;
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.onended = () => {
            URL.revokeObjectURL(url);
            playNext();
          };
          audioRef.current.onerror = (e) => {
            console.error("Audio playback error:", e);
            URL.revokeObjectURL(url);
            playNext();
          };
          audioRef.current.play().catch(e => {
            console.error("Audio play error", e);
            URL.revokeObjectURL(url);
            playNext();
          });
          setSpeakingId(messageId);
        }
      } else {
        isPlaying = false;
        if (isFinishedGenerating) {
          setIsGeneratingAudio(null);
          setSpeakingId(null);
          currentRecitationIdRef.current = null;
        }
      }
    };

    let combinedPcmBytes = new Uint8Array(0);

    try {
      for await (const chunk of generateRecitationStream(text, selectedVoice, localApiKey)) {
        if (fallbackTriggered || currentRecitationIdRef.current !== messageId) break;
        
        // Accumulate raw PCM data for the final downloadable file
        if (chunk.pcmData) {
          const rawPcmString = atob(chunk.pcmData.replace(/\s/g, ''));
          const rawPcmBytes = new Uint8Array(rawPcmString.length);
          for (let i = 0; i < rawPcmString.length; i++) {
            rawPcmBytes[i] = rawPcmString.charCodeAt(i);
          }
          const newCombined = new Uint8Array(combinedPcmBytes.length + rawPcmBytes.length);
          newCombined.set(combinedPcmBytes, 0);
          newCombined.set(rawPcmBytes, combinedPcmBytes.length);
          combinedPcmBytes = newCombined;
        }

        const base64Data = chunk.data.replace(/\s/g, '');
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        const blob = new Blob(byteArrays, { type: chunk.mimeType });
        const url = URL.createObjectURL(blob);
        
        audioQueue.push(url);
        
        if (!isPlaying) {
          playNext();
        }
      }
      
      isFinishedGenerating = true;
      
      // Create final combined WAV for downloading
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
        
        globalAudioUrls[messageId] = finalUrl;
        if (isMountedRef.current) {
          setAudioUrls(prev => ({ ...prev, [messageId]: finalUrl }));
        }
      }

      if (!isPlaying && audioQueue.length === 0) {
        setIsGeneratingAudio(null);
        setSpeakingId(null);
      }
    } catch (error) {
      console.error("فشل توليد التلاوة:", error);
      if (error instanceof Error && error.message === "HARD_QUOTA_LIMIT") {
        setQuotaError("تم الوصول إلى الحد الأقصى لحصة الاستخدام. سيتم استخدام القراءة التلقائية للمتصفح.");
        setTimeout(() => setQuotaError(null), 5000);
      }
      fallbackTriggered = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsGeneratingAudio(null);
      setSpeakingId(null);
      fallbackToBrowserTTS(text, messageId);
    }
  };

  const fallbackToBrowserTTS = (text: string, id: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      
      utterance.onstart = () => setSpeakingId(id);
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const downloadAudioFile = async (messageId: string) => {
    const url = audioUrls[messageId];
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = blob.type && typeof blob.type === 'string' && (blob.type.includes('wav') ? 'wav' : (blob.type.includes('mpeg') ? 'mp3' : 'wav'));
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `quran_ai_recitation_${messageId}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed", e);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quran_ai_recitation_${messageId}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const handleStopAll = () => {
      currentRecitationIdRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setSpeakingId(null);
      setIsGeneratingAudio(null);
    };
    window.addEventListener('stop_all_audio', handleStopAll);
    const handleOpenChat = () => setActiveTab('chat');
    window.addEventListener('open_ai_chat', handleOpenChat);
    return () => {
      isMountedRef.current = false;
      currentRecitationIdRef.current = null;
      if (tafsirTimerRef.current) {
        clearTimeout(tafsirTimerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      window.removeEventListener('stop_all_audio', handleStopAll);
      window.removeEventListener('open_ai_chat', handleOpenChat);
    };
  }, []);

  const handleSend = async (text?: string, isRegenerate: boolean = false, customHistory?: Message[], force: boolean = false) => {
    const messageText = text || chatInputRef.current?.get();
    if (!messageText?.trim() || (isLoading && !force)) return;

    const currentMessages = customHistory || messages;

    const isCommand = messageText.startsWith('/');

    if (!isRegenerate) {
      const userMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        role: 'user',
        content: messageText,
        timestamp: Date.now(),
      };

      setMessages([...currentMessages, userMessage]);
    } else if (customHistory) {
      setMessages(customHistory);
    }
    
    chatInputRef.current?.clear();
    setIsLoading(true);

    try {
      const commandText = isCommand ? `
أنت تمتلك قدرة كاملة على التحكم في التطبيق من خلال "الأوامر الذكية" (Smart Actions).
تنبيه: المستخدم يستخدم "وضع الأوامر". كن دقيقاً جداً في تنفيذ الطلب باستخدام [ACTION:...] المناسب فوراً.

Smart Actions (Chat-to-Action) - يجب أن تكون دقيقاً جداً في استخدامها:
يمكنك تفعيل وظائف في التطبيق بإضافة هذه الوسوم في نهاية ردك (ستكون مخفية عن المستخدم):
- لتصفح سورة: [ACTION:BROWSE_SURAH:surah_number_or_name]
- للبحث عن موضوع: [ACTION:SEARCH:query]
- لعرض شاشة معينة: [ACTION:VIEW:bookmarks|qibla|tasbih|calendar|duas|image_generator|settings|midad]
- لفتح "مداد الرحمن" (المصحف التفاعلي): [ACTION:VIEW:midad]
- لتشغيل تلاوة: [ACTION:PLAY:surah_number:ayah_number] أو [ACTION:PLAY:surah_number]
- لإيقاف التلاوة: [ACTION:STOP:now]
- لتغيير القارئ: [ACTION:SET_RECITER:reciter_id] (مثال: ar.alafasy, ar.husary)
- لتغيير الرواية: [ACTION:SET_QIRAAT:hafs|warsh|qaloon]
- لتبديل التجويد الملون: [ACTION:TOGGLE_TAJWEED:toggle]
- لتغيير حجم الخط: [ACTION:SET_FONT_SIZE:number]
- لتوليد صورة مباشرة: [ACTION:GENERATE_IMAGE:english_prompt]

إذا طلب المستخدم "مداد الرحمن" أو "المصحف" أو "الكتابة"، استخدم [ACTION:VIEW:midad].
إذا طلب المستخدم توليد أو إنشاء صورة (مثل: "صمم صورة" أو "أنشئ صورة لبعوضة فما فوقها")، فقم باستنباط وصف إنجليزي دقيق وتفصيلي جداً للصورة المطلوبة ثم أضف الوسم [ACTION:GENERATE_IMAGE:english_prompt] في نهاية ردك لتوليدها فوراً في المولد الذكي.
إذا طلب المستخدم أمراً واضحاً (مثل: "افتح سورة البقرة" أو "شغل المنشاوي")، قم بتنفيذ الأمر فوراً بإضافة الوسم المناسب وأخبر المستخدم أنك قمت بذلك.` : `
مهم جداً: لا تقم أبداً بالتحكم في التطبيق أو إضافة أي وسوم مثل [ACTION:...] لأن المستخدم لم يقم بتفعيل وضع الأوامر. فقط أجب نصياً ولا تقترح القيام بأي أفعال في التطبيق.`;

      const systemContent = `أنت "مِداد الذكي" (Midad AI)، المساعد القرآني المتطور والخبير في علوم الشريعة واللغة العربية.
مهمتك الأساسية هي تقديم إرشادات دقيقة، روحانية، وعلمية للمستخدم بناءً على القرآن الكريم والسنة النبوية.

القواعد الذهبية لإجاباتك:
1. الدقة العلمية: استند دائماً إلى المصادر الموثوقة (تفسير ابن كثير، السعدي، الطبري، إلخ).
2. السياق الذكي: أنت تدرك تماماً ما يفعله المستخدم الآن (السورة، الآية، التفسير، القارئ) من خلال السياق المزود لك. استخدمه لتقديم إجابات مخصصة.
3. الأسلوب الروحاني: اجعل كلماتك تلامس القلب، بأسلوب أدبي رفيع يليق بجلال القرآن.
4. التنظيم البصري: استخدم Markdown بشكل احترافي (عناوين، قوائم، فقرات قصيرة).
5. أسلوب التنظيم: نظّم الإجابة في محاور واضحة وفق عمق التفصيل المطلوب من المستخدم دون اختصار مخل.
6. التنوع وعدم التكرار: لا تكرر الاستشهاد بنفس الآيات والأحاديث مراراً لتثبت سعة علوم القرآن والسنة.
7. الثبات والتركيز: لا تخرج عن شخصيتك كمساعد قرآني تحت أي ظرف.
${getResponseDepthDirective(aiConfig.responseDepth)}
${aiConfig.customInstructions ? `تعليمة خاصة من المستخدم: ${aiConfig.customInstructions}` : ''}
${commandText}`;

      // Prepare history for AI
      const history: AIMessage[] = [
        {
          role: 'system',
          content: systemContent
        }
      ];

      // Add Quranic context if available
      if (currentContext?.surah) {
        let contextMsg = `سياق الآية الحالية التي يقرأها المستخدم: ${getSurahDisplayName(currentContext.surah)}، آية ${currentContext.ayah}. نص الآية: "${currentContext.text}".`;
        if (currentContext.tafsir) {
          contextMsg += ` التفسير الذي اطلع عليه المستخدم: ${currentContext.tafsir}`;
        }
        history.push({
          role: 'system',
          content: contextMsg
        });
      }

      // Add persistent memory context if it exists and is different from current
      const savedContext = safeLocalStorageGet('ai_context_memory');
      if (savedContext) {
        try {
          const mem = JSON.parse(savedContext);
          if (mem.surah && mem.surah !== currentContext?.surah) {
            history.push({
              role: 'system',
              content: `ذاكرة التصفح الأخيرة للمستخدم: ${getSurahDisplayName(mem.surah)}، آية ${mem.ayah}. نص الآية: "${mem.text}".`
            });
          }
        } catch (e) {
          console.error("Failed to parse context memory:", e);
        }
      }

      // Add viewMode and last search context
      if (viewMode || lastSearchedText || selectedReciter || selectedQiraat || selectedTafsir || selectedTranslation) {
        history.push({
          role: 'system',
          content: `حالة التطبيق الحالية:
- القسم الحالي: "${viewMode || 'غير محدد'}"
- آخر بحث: "${lastSearchedText || 'لا يوجد'}"
- القارئ المفضل: "${selectedReciter || 'غير محدد'}"
- الرواية المفضلة: "${selectedQiraat || 'غير محدد'}"
- التفسير المفضل: "${selectedTafsir || 'غير محدد'}"
- الترجمة المفضلة: "${selectedTranslation || 'غير محدد'}"`
        });
      }

      // Add recent events from timeline for deeper context
      const events = currentMessages.filter(m => m.type === 'event').slice(-5).map(e => e.content);
      if (events.length > 0) {
        history.push({
          role: 'system',
          content: `سجل النشاط الأخير للمستخدم: ${events.join(' -> ')}`
        });
      }

      // Add recent history using user's configured context window
      const nonEventMsgs = currentMessages.filter(m => m.type !== 'event');
      const recentHistory = (aiConfig.contextWindow === 0 ? nonEventMsgs : nonEventMsgs.slice(-aiConfig.contextWindow)).map(m => ({
        role: m.role,
        content: m.content
      }));
      history.push(...recentHistory);
      
      // Add current message
      history.push({ role: 'user', content: messageText });

      const [provider, model] = selectedModel.split('|');
      abortControllerRef.current = new AbortController();
      
      const assistantMessageId = `msg-${Date.now()}-asst-${Math.random().toString(36).substring(2, 9)}`;
      const assistantMessage: Message = { id: assistantMessageId, role: 'assistant', content: '', timestamp: Date.now(), model: model };
      
      if (isRegenerate && customHistory) {
        setMessages([...customHistory, assistantMessage]);
      } else {
        setMessages(prev => [...prev, assistantMessage]);
      }
      
      let fullContent = '';
      let fullThought = '';
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 100; // ms - batch updates for smoothness and stability
      let streamingSuccessful = false;

      try {
        await callAIStream(provider as AIProviderKey, history, model, {
          temperature: aiConfig.temperature,
          topP: aiConfig.topP,
          topK: aiConfig.topK,
          frequencyPenalty: aiConfig.frequencyPenalty,
          presencePenalty: aiConfig.presencePenalty,
          maxOutputTokens: aiConfig.maxTokens,
          enableWebSearch: aiConfig.enableWebSearch,
          enableDeepThinking: aiConfig.reasoningEffort !== 'off',
          reasoningEffort: aiConfig.reasoningEffort,
          responseDepth: aiConfig.responseDepth,
          signal: abortControllerRef.current?.signal
        }, (chunk, groundingMetadata, thought) => {
          if (chunk) {
            fullContent += chunk;
            const loopCheck = detectAndCleanRepetitionLoop(fullContent);
            if (loopCheck.isLoop) {
              fullContent = loopCheck.cleanText;
              setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: groundingMetadata || m.groundingMetadata } : m));
              stopGeneration();
              return;
            }
          }
          if (thought) {
            fullThought += thought;
          }
          
          const now = Date.now();
          if (now - lastUpdateTime > UPDATE_INTERVAL) {
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: groundingMetadata || m.groundingMetadata } : m));
            lastUpdateTime = now;
          }
        });

        // Loop check on finished text
        const finalLoopCheck = detectAndCleanRepetitionLoop(fullContent);
        if (finalLoopCheck.isLoop) {
          fullContent = finalLoopCheck.cleanText;
        }

        // Final update to ensure everything is captured
        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent, thought: fullThought || m.thought } : m));
        streamingSuccessful = true;
      } catch (streamError: any) {
        if (abortControllerRef.current?.signal.aborted || streamError?.name === 'AbortError' || streamError?.message?.includes('aborted')) {
          console.log('AIHub Stream generation aborted gracefully.');
          if (fullContent || fullThought) {
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent, thought: fullThought || m.thought } : m));
          }
          setIsLoading(false);
          return;
        }

        console.warn('AIHub Streaming failed, trying non-streaming failover:', streamError);
        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: '⚡ جاري الاتصال بقناة احتياطية...' } : m));
      }

      if (!streamingSuccessful && !abortControllerRef.current?.signal.aborted) {
        try {
          const response = await callAIWithFailover(provider as AIProviderKey, history, model, {
            temperature: aiConfig.temperature,
            topP: aiConfig.topP,
            topK: aiConfig.topK,
            frequencyPenalty: aiConfig.frequencyPenalty,
            presencePenalty: aiConfig.presencePenalty,
            maxOutputTokens: aiConfig.maxTokens,
            enableWebSearch: aiConfig.enableWebSearch,
            enableDeepThinking: aiConfig.reasoningEffort !== 'off',
            reasoningEffort: aiConfig.reasoningEffort,
            responseDepth: aiConfig.responseDepth
          });
          fullContent = response.content || "عذراً، لم أتمكن من معالجة طلبك.";
          const loopCheck = detectAndCleanRepetitionLoop(fullContent);
          if (loopCheck.isLoop) {
            fullContent = loopCheck.cleanText;
          }
          setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent, model: response.model, thought: response.thought } : m));
        } catch (failoverError) {
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
          throw failoverError;
        }
      }
      
      // Handle Smart Actions
      const actionRegex = /\[ACTION:([^:]+):([^\]]+)\]/g;
      let match;
      while ((match = actionRegex.exec(fullContent)) !== null) {
        if (onAction) {
          onAction(match[1], match[2]);
        }
      }
      
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent.replace(/\[ACTION:[^\]]+\]/g, '').trim() } : m));
    } catch (error: any) {
      if (error && error.message && typeof error.message === 'string' && (error.message.includes('404') || error.message.includes('Requested entity was not found') || error.message.includes('API key'))) {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-err1-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant',
          content: `⚠️ يرجى التأكد من إدخال مفتاح API صحيح والمحاولة مرة أخرى.`,
          timestamp: Date.now(),
        };
        setMessages(prev => {
          if (isRegenerate && customHistory) {
            return [...customHistory, errorMessage];
          }
          return [...prev, errorMessage];
        });
      } else {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-err2-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant',
          content: `⚠️ خطأ: ${error.message}`,
          timestamp: Date.now(),
        };
        setMessages(prev => {
          if (isRegenerate && customHistory) {
            return [...customHistory, errorMessage];
          }
          return [...prev, errorMessage];
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(console.error);
    }
  };

  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'رسالة من المساعد الذكي',
        text: text
      }).catch(console.error);
    }
  };

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setLocalProvider(newProvider);
    setModelSearchQuery('');
    safeLocalStorageSet('ai_provider', newProvider);
    const key = AI_PROVIDERS[newProvider].keyName ? (safeLocalStorageGet(AI_PROVIDERS[newProvider].keyName) || '') : '';
    setLocalApiKey(key);
    const availableModels = getDynamicModelsList(newProvider);
    let savedModel = safeLocalStorageGet(`ai_model_${newProvider}`) || '';
    if (savedModel.includes('|')) {
      savedModel = savedModel.split('|')[1];
    }
    const model = (savedModel && availableModels.includes(savedModel))
      ? savedModel
      : (AI_PROVIDERS[newProvider].defaultModel && availableModels.includes(AI_PROVIDERS[newProvider].defaultModel)
          ? AI_PROVIDERS[newProvider].defaultModel
          : (availableModels[0] || AI_PROVIDERS[newProvider].defaultModel));
    setSelectedModel(`${newProvider}|${model}`);
    // Ensure latest full model catalog is fetched for the selected provider
    fetchAndUpdateModels(newProvider, key).catch(console.warn);
  };

  const handleModelChange = (provider: string, model: string) => {
    setSelectedModel(`${provider}|${model}`);
    safeLocalStorageSet(`ai_model_${provider}`, model);
  };

  const handleApiKeyChange = (key: string) => {
    setLocalApiKey(key);
    safeLocalStorageSet(AI_PROVIDERS[localProvider].keyName, key);
  };

  const handleRefreshModels = async () => {
    setIsUpdatingModels(true);
    setModelsUpdatedMessage(null);
    try {
      const updatedModels = await fetchAndUpdateModels(localProvider, localApiKey);
      setIsUpdatingModels(false);
      setModelsRefreshCounter(c => c + 1);
      setModelsUpdatedMessage(`تم تحديث ${updatedModels.length} نموذج بنجاح من المصدر.`);
      // If the currently selected model is not in the new list, update it
      const [currentProvider, currentModel] = selectedModel.split('|');
      if (currentProvider === localProvider && !updatedModels.includes(currentModel)) {
        const defaultModel = AI_PROVIDERS[localProvider].defaultModel;
        const newModel = updatedModels.includes(defaultModel) ? defaultModel : updatedModels[0];
        handleModelChange(localProvider, newModel);
      }
      setTimeout(() => setModelsUpdatedMessage(null), 4000);
    } catch (err: any) {
      setIsUpdatingModels(false);
      setModelsUpdatedMessage(`فشل التحديث: ${err.message || 'خطأ غير معروف'}`);
      setTimeout(() => setModelsUpdatedMessage(null), 5000);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    safeLocalStorageRemove('ai_chat_history');
  };

  const regenerateMessage = async (index: number) => {
    if (isLoading) return;
    
    // Get all messages up to the user message that prompted this response
    const previousMessages = messages.slice(0, index);
    const userMessage = [...previousMessages].reverse().find(m => m.role === 'user');
    
    if (!userMessage) return;

    // Resend the user message with the custom history
    await handleSend(userMessage.content, true, previousMessages);
  };

  const suggestions = [
    { icon: <Book size={16} />, text: "اشرح لي هذه الآية", prompt: "اشرح لي هذه الآية الكريمة بأسلوب مبسط ووضح لي الدروس المستفادة منها." },
    { icon: <Lightbulb size={16} />, text: "ما هي أسباب النزول؟", prompt: "ما هي أسباب نزول هذه السورة أو هذه الآية؟" },
    { icon: <ShieldAlert size={16} />, text: "أحكام تجويد", prompt: "ما هي أهم أحكام التجويد الموجودة في هذه الآية؟" },
    { icon: <Sparkles size={16} />, text: "قصة السورة", prompt: "احكِ لي قصة هذه السورة وما هي العبرة الأساسية منها." },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={isFullScreen 
            ? "relative w-full h-full bg-white/95 dark:bg-[#0c0a09]/95 backdrop-blur-3xl flex flex-col border-amber-200/20 shadow-2xl"
            : "fixed inset-y-0 right-0 w-full md:w-[450px] bg-white/95 dark:bg-[#0c0a09]/95 backdrop-blur-3xl shadow-2xl z-[60] flex flex-col border-l border-amber-200/20"
          }
        >
          {/* Neural Network Background Effect */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
            <div className={`absolute inset-0 bg-[radial-gradient(${localProvider === 'gemini' ? '#3b82f6' : localProvider === 'groq' ? '#f59e0b' : '#b45309'}_1px,transparent_1px)] [background-size:20px_20px]`}></div>
            <motion.div 
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border ${localProvider === 'gemini' ? 'border-blue-500' : 'border-amber-500'} rounded-full opacity-20`}
            />
          </div>

          {/* Sidebar for History and Settings */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute inset-0 bg-white/95 dark:bg-[#0c0a09]/95 backdrop-blur-3xl z-20 flex flex-col border-r border-amber-200/20"
              >
                <div className="p-4 border-b border-amber-200/20 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                  <h3 className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    <History size={18} />
                    الإعدادات والسجل
                  </h3>
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full">
                    <ChevronLeft size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  {/* Provider Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">إعدادات المزود</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-amber-700 dark:text-amber-400 block mb-1">المزود المفضل</label>
                        <select 
                          value={localProvider}
                          onChange={(e) => handleProviderChange(e.target.value as AIProviderKey)}
                          className="w-full p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-black/40 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          {Object.entries(AI_PROVIDERS).map(([providerKey, provider]) => (
                            <option key={providerKey} value={providerKey as AIProviderKey}>{provider.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between mb-1">
                          <span>النموذج (Model)</span>
                          <button
                            onClick={handleRefreshModels}
                            disabled={isUpdatingModels}
                            className="text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 flex items-center gap-1 hover:underline disabled:opacity-55"
                            title="تحديث النماذج تلقائياً من الخوادم الرسمية"
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
                        </label>
                        {(() => {
                          // Strictly show models ONLY for the currently selected provider (no cross-provider mixing)
                          void modelsRefreshCounter;
                          const providerConfig = AI_PROVIDERS[localProvider];
                          const allProviderModels = Array.from(new Set(getDynamicModelsList(localProvider)));
                          const totalFreeCount = allProviderModels.filter((m: string) => classifyModelPricing(localProvider, m) === 'free').length;
                          const totalPaidCount = allProviderModels.length - totalFreeCount;
                          const q = modelSearchQuery.trim().toLowerCase();
                          const filteredModels = q ? allProviderModels.filter((m: string) => m.toLowerCase().includes(q)) : allProviderModels;
                          const freeModels = filteredModels.filter((m: string) => classifyModelPricing(localProvider, m) === 'free');
                          const paidModels = filteredModels.filter((m: string) => classifyModelPricing(localProvider, m) === 'paid');
                          const activeValue = selectedModel.startsWith(`${localProvider}|`)
                            ? selectedModel
                            : `${localProvider}|${providerConfig?.defaultModel || allProviderModels[0] || ''}`;

                          return (
                            <div className="space-y-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={modelSearchQuery}
                                  onChange={(e) => setModelSearchQuery(e.target.value)}
                                  placeholder={`ابحث في ${allProviderModels.length} نموذج (deepseek, qwen, gpt, free)...`}
                                  className="w-full p-2 pr-8 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-black/40 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                  dir="rtl"
                                />
                                <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500" />
                              </div>
                              <select
                                value={activeValue}
                                onChange={(e) => {
                                  const [prov, model] = e.target.value.split('|');
                                  handleModelChange(prov, model);
                                }}
                                className="w-full p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-black/40 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                {freeModels.length > 0 && (
                                  <optgroup label={`🟢 ${providerConfig?.name || localProvider} — النماذج المجانية (${freeModels.length})`}>
                                    {freeModels.map((m: string) => (
                                      <option key={`${localProvider}|${m}`} value={`${localProvider}|${m}`}>{m} [مجاني]</option>
                                    ))}
                                  </optgroup>
                                )}
                                {paidModels.length > 0 && (
                                  <optgroup label={`👑 ${providerConfig?.name || localProvider} — النماذج المدفوعة (${paidModels.length})`}>
                                    {paidModels.map((m: string) => (
                                      <option key={`${localProvider}|${m}`} value={`${localProvider}|${m}`}>{m} [Pro / مدفوع]</option>
                                    ))}
                                  </optgroup>
                                )}
                                {filteredModels.length === 0 && (
                                  <option value={activeValue}>لا توجد نتائج مطابقة للبحث</option>
                                )}
                              </select>
                              <div className="flex items-center justify-between text-[10px] text-amber-700/80 dark:text-amber-300/80 px-1">
                                <span>الكل: <strong>{allProviderModels.length}</strong> ({providerConfig?.name || localProvider})</span>
                                <span className="flex items-center gap-2">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">مجاني: {totalFreeCount}</span>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">مدفوع: {totalPaidCount}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        {modelsUpdatedMessage && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 animate-pulse">
                            {modelsUpdatedMessage}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-amber-700 dark:text-amber-400 block mb-1">مفتاح API</label>
                        <input 
                          type="password"
                          value={localApiKey}
                          onChange={(e) => handleApiKeyChange(e.target.value)}
                          placeholder="أدخل المفتاح هنا..."
                          className="w-full p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-black/40 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-amber-200/20" />

                  <AIAdvancedSettings
                    config={aiConfig}
                    onChange={setAiConfig}
                    extraTool={{
                      label: 'تفعيل التلاوة الذكية (AI)',
                      description: 'قراءة الردود والآيات بالصوت الذكي',
                      checked: useAIRecitation,
                      onChange: (checked) => {
                        setUseAIRecitation(checked);
                        safeLocalStorageSet('use_ai_recitation', JSON.stringify(checked));
                      }
                    }}
                    customPlaceholder="أضف تعليمات خاصة للمساعد الذكي (مثلاً: ركز على أسباب النزول، أو الفقه المقارن...)"
                  />

                  <div className="h-px bg-amber-200/20" />

                  {/* Persistent Memory */}
                  {safeLocalStorageGet('ai_context_memory') && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <Book size={16} />
                        آخر ما تصفحته (الذاكرة)
                      </h4>
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200/30 text-xs space-y-3 shadow-sm">
                        {(() => {
                          try {
                            const mem = JSON.parse(safeLocalStorageGet('ai_context_memory') || '{}');
                            return (
                              <>
                                <div className="flex justify-between text-amber-900 dark:text-amber-100 font-bold text-sm">
                                  <span>{getSurahDisplayName(mem.surah)}</span>
                                  {mem.ayah && <span>آية {mem.ayah}</span>}
                                </div>
                                {mem.text && <p className="text-amber-700 dark:text-amber-400 line-clamp-2 italic leading-relaxed">"{mem.text}"</p>}
                                {mem.tafsir && (
                                  <div className="pt-2 border-t border-amber-200/20">
                                    <span className="font-bold block mb-1 text-amber-800 dark:text-amber-300">آخر تفسير اطلعت عليه:</span>
                                    <p className="line-clamp-3 opacity-80 leading-relaxed">{mem.tafsir}</p>
                                  </div>
                                )}
                                <button 
                                  onClick={() => {
                                    let prompt = `حدثني عن ${getSurahDisplayName(mem.surah)}`;
                                    if (mem.ayah) prompt += ` آية ${mem.ayah}`;
                                    prompt += ` التي كنت أقرأها مؤخراً.`;
                                    handleSend(prompt);
                                    setShowHistory(false);
                                  }}
                                  className="w-full mt-2 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 font-bold"
                                >
                                  اسأل المساعد عن هذا السياق
                                </button>
                              </>
                            );
                          } catch (e) {
                            console.error("Failed to render context memory:", e);
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-amber-200/20" />

                  {/* History List */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">المحادثات السابقة</h4>
                      <button 
                        onClick={clearHistory}
                        className="text-red-500 hover:text-red-600 p-1"
                        title="مسح السجل"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-amber-600/50 text-sm">
                        لا يوجد سجل محادثات
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {messages.filter(m => m.role === 'user').map((m, i) => (
                          <button 
                            key={i}
                            onClick={() => {
                              chatInputRef.current?.set(typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
                              setShowHistory(false);
                            }}
                            className="w-full text-right p-3 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors text-sm text-amber-900 dark:text-amber-200 border border-transparent hover:border-amber-200/30 line-clamp-1"
                          >
                            {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="pt-4 border-t border-amber-200/20">
                      <button 
                        onClick={clearHistory}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors text-sm font-bold"
                      >
                        <Trash size={16} />
                        مسح سجل المحادثات
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          {!isZenMode && (
            <div className="p-2 border-b border-amber-200/20 flex items-center gap-2 bg-amber-50/50 dark:bg-amber-900/10 backdrop-blur-md relative z-10">
              <button 
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${activeTab === 'chat' ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200'}`}
                title="المحادثة النصية"
              >
                <MessageSquare size={18} />
                <span>المحادثة</span>
              </button>
              <button 
                onClick={() => setActiveTab('live')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${activeTab === 'live' ? 'bg-sky-600 text-white shadow-sm' : 'hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300'}`}
                title="المحادثة الصوتية والنصية المباشرة (Gemini Live)"
              >
                <Radio size={18} className={activeTab === 'live' ? 'animate-pulse' : ''} />
                <span>بث صوتي مباشر</span>
              </button>
              <button 
                onClick={() => setActiveTab('image')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${activeTab === 'image' ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200'}`}
                title="توليد الصور"
              >
                <Palette size={18} />
                <span>توليد الصور</span>
              </button>
            </div>
          )}

          {/* Header */}
          <div className="p-4 border-b border-amber-200/50 dark:border-amber-800/50 flex items-center justify-between bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md relative z-20 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg dark:text-amber-100 leading-none font-kufi">المساعد الذكي</h2>
                <p className="text-[10px] text-sky-600 dark:text-sky-400/80 uppercase tracking-wider font-bold mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></span>
                  </span>
                  {AI_PROVIDERS[localProvider]?.name || localProvider}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Sleep Timer Button with Live Gradual Countdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSleepTimerMenu(!showSleepTimerMenu)}
                  className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                    isTimerActive
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md ring-2 ring-amber-400/30'
                      : 'hover:bg-amber-100/60 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                  }`}
                  title="مؤقت النوم التلقائي"
                >
                  <Moon size={18} className={isTimerActive ? "animate-pulse text-amber-200" : ""} />
                  {isTimerActive ? (
                    <span className="font-mono tracking-wider font-bold text-xs">{formattedTime}</span>
                  ) : (
                    <span className="hidden sm:inline">مؤقت النوم</span>
                  )}
                </button>

                {showSleepTimerMenu && (
                  <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#292524] border border-amber-200 dark:border-amber-800 shadow-2xl rounded-2xl overflow-hidden py-1.5 z-50 text-right" dir="rtl">
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
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${showHistory ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-100 shadow-inner' : 'hover:bg-sky-50 dark:hover:bg-sky-900/30 text-sky-700 dark:text-sky-400'}`}
                title="السجل والإعدادات"
              >
                <Settings2 size={18} />
                <span className="hidden sm:inline">الإعدادات</span>
              </button>

              <div className="w-px h-5 bg-amber-200 dark:bg-amber-800 mx-0.5"></div>

              {/* Action Menu (Dropdown) to reduce clutter */}
              <div className="relative">
                <button
                  onClick={() => setShowActionMenu(prev => !prev)}
                  className="p-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-xl transition-colors text-sky-700 dark:text-sky-400"
                  aria-expanded={showActionMenu}
                  aria-label="المزيد من الخيارات"
                >
                  <MoreVertical size={18} />
                </button>
                {showActionMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-[#292524] border border-amber-200 dark:border-amber-800 shadow-xl rounded-2xl overflow-hidden py-1 z-50">
                    <button 
                      onClick={() => { 
                        setMessages([]); 
                        safeLocalStorageRemove('ai_chat_history'); 
                        setShowActionMenu(false);
                      }}
                      className="w-full text-right px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-emerald-600 flex items-center gap-2 font-medium"
                    >
                      <MessageSquare size={16} /> محادثة جديدة
                    </button>
                    {!isFullScreen && (
                      <button 
                        onClick={() => { 
                          setMessages([]);
                          safeLocalStorageRemove('ai_chat_history');
                          setShowActionMenu(false);
                        }}
                        className="w-full text-right px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-rose-600 flex items-center gap-2 font-medium"
                      >
                        <RotateCcw size={16} /> تفريغ المحادثة
                      </button>
                    )}
                    {isFullScreen && (
                      <button 
                        onClick={() => { 
                          setIsZenMode(!isZenMode);
                          setShowActionMenu(false);
                        }}
                        className="w-full text-right px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sky-600 flex items-center gap-2 font-medium"
                      >
                        <MonitorPlay size={16} /> {isZenMode ? "إلغاء وضع التركيز" : "وضع التركيز (Zen)"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isFullScreen && (
                <>
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors text-rose-500 bg-white/50 dark:bg-black/20"
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Chat Area */}
          {quotaError && (
            <div className="absolute top-4 left-4 right-4 bg-amber-500 text-white p-4 rounded-lg shadow-lg z-50 text-center">
              {quotaError}
            </div>
          )}
          {activeTab === 'chat' ? (
            <div className="flex-1 overflow-hidden flex flex-col relative">
              {/* Scroll Progress Bar */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-100/20 dark:bg-amber-900/10 z-20">
                <motion.div 
                  className="h-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"
                  style={{ width: `${scrollProgress}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                />
              </div>
              
              {/* Messages */}
              <div 
                ref={scrollRef} 
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative"
              >
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 md:space-y-10 p-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-sky-500/20">
                        <Sparkles size={32} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl md:text-2xl dark:text-amber-100 font-kufi">المساعد الذكي</h3>
                        <p className="text-xs md:text-sm text-sky-800/60 dark:text-sky-400/60 max-w-[280px] mx-auto mt-2 leading-relaxed">
                          أنا مستعد لمساعدتك في أبحاثك القرآنية والعلمية
                        </p>
                      </div>
                    </motion.div>

                    <div className="w-full max-w-3xl px-4 flex flex-wrap justify-center gap-2.5">
                      {useMemo(() => {
                        const dynamicSuggestions = [...SUGGESTIONS].sort(() => 0.5 - Math.random());
                        const contextSuggestions = [];
                        if (currentContext?.surah && !currentContext.ayah) {
                          contextSuggestions.push(
                            { category: 'تدبر', text: `لخص لي سورة ${currentContext.surah}`, icon: <BookOpen size={14} /> },
                            { category: 'تفسير', text: `مقاصد سورة ${currentContext.surah}`, icon: <Lightbulb size={14} /> }
                          );
                        } else if (currentContext?.surah && currentContext.ayah) {
                          contextSuggestions.push(
                            { category: 'تفسير', text: `اشرح لي الآية ${currentContext.ayah} من سورة ${currentContext.surah}`, icon: <BookOpen size={14} /> },
                            { category: 'تدبر', text: `الدروس المستفادة من هذه الآية`, icon: <Lightbulb size={14} /> }
                          );
                        }
                        return [...contextSuggestions, ...dynamicSuggestions].slice(0, 5);
                      }, [currentContext?.surah, currentContext?.ayah]).map((suggestion, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleSend(suggestion.text)}
                          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-sky-50/50 dark:bg-white/5 border border-sky-100 dark:border-white/10 hover:border-sky-400 dark:hover:border-sky-500/50 hover:bg-white dark:hover:bg-white/10 text-sky-900 dark:text-sky-100 transition-all text-sm group shadow-sm hover:shadow-md active:scale-95"
                        >
                          <span className="text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                            {suggestion.icon}
                          </span>
                          <span className="font-medium text-[13px]">{suggestion.text}</span>
                        </motion.button>
                      ))}
                    </div>

                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 max-w-md w-full"
                    >
                      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 mb-2 font-bold text-xs">
                        <Lightbulb size={14} />
                        <span>حكمة اليوم</span>
                      </div>
                      <p className="text-sm italic text-sky-900/80 dark:text-sky-200/80">"العلم صيد والكتابة قيده، قيد صيودك بالحبال الواثقة."</p>
                    </motion.div>
                  </div>
                )}

                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${m.role === 'user' ? 'items-start' : 'items-end'}`}
                  >
                    {m.type === 'event' ? (
                      <div className="w-full flex justify-center my-3">
                        <div className="flex items-center gap-2 px-5 py-2 bg-amber-50/80 dark:bg-black/30 backdrop-blur-md border border-amber-200/30 dark:border-white/5 rounded-full text-xs text-amber-800 dark:text-amber-400 font-medium shadow-sm">
                          {m.eventIconName === 'book' ? <Book size={12} className="text-emerald-500" /> : 
                           m.eventIconName === 'sparkles' ? <Sparkles size={12} className="text-amber-500" /> : 
                           <History size={12} />}
                          {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                        </div>
                      </div>
                    ) : (
                      <div className={`p-5 sm:p-6 rounded-[2rem] shadow-sm relative group transition-all duration-300 hover:shadow-md ${
                        m.role === 'user' 
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-800 text-white rounded-tr-sm max-w-[85%] border border-amber-400/30 dark:border-amber-500/20' 
                          : 'bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-xl text-amber-950 dark:text-amber-50 border border-amber-100 dark:border-white/5 rounded-tl-sm max-w-[95%] shadow-lg'
                      }`}>
                        {m.role === 'assistant' && m.thought && (() => {
                          const isThoughtOpen = expandedThoughts[m.id] ?? aiConfig.autoOpenThoughts;
                          return (
                          <div className="mb-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 rounded-2xl overflow-hidden text-[13px] text-amber-900 dark:text-amber-200 font-sans shadow-sm" dir="rtl">
                            <button
                              onClick={() => toggleThoughtExpanded(m.id)}
                              className="w-full flex items-center justify-between p-2.5 px-3.5 bg-amber-100/50 dark:bg-amber-900/30 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors font-bold text-amber-800 dark:text-amber-300 text-xs cursor-pointer select-none"
                              title={isThoughtOpen ? "إخفاء مسار التفكير والتأمل" : "عرض مسار التفكير والتأمل"}
                            >
                              <div className="flex items-center gap-2">
                                <Brain size={15} className="text-amber-600 dark:text-amber-400 animate-pulse" />
                                <span>مسار تفكير الذكاء الاصطناعي</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium bg-amber-200/50 dark:bg-amber-800/40 px-2 py-0.5 rounded-lg">
                                <span>{isThoughtOpen ? 'إخفاء التفكير' : 'عرض التفكير'}</span>
                                {isThoughtOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>
                            </button>
                            
                            {isThoughtOpen && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-3.5 border-t border-amber-200/40 dark:border-amber-800/30 italic text-amber-800/80 dark:text-amber-300/70 leading-relaxed font-sans bg-amber-50/20 dark:bg-black/10"
                              >
                                <ReactMarkdown>{m.thought}</ReactMarkdown>
                              </motion.div>
                            )}
                          </div>
                          );
                        })()}

                        <div className={`prose prose-sm max-w-none font-vazir leading-relaxed message-bubble ${m.role === 'user' ? 'text-white prose-invert' : 'dark:prose-invert'}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</ReactMarkdown>
                        </div>
                        
                        <div className={`flex flex-wrap items-center gap-1 mt-4 pt-3 border-t ${m.role === 'user' ? 'border-white/20' : 'border-amber-100/50 dark:border-white/10'} sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex flex-wrap items-center rounded-2xl px-2 py-1.5 border backdrop-blur-md gap-1 shadow-sm ${m.role === 'user' ? 'bg-black/20 border-white/10' : 'bg-amber-50/80 dark:bg-black/20 border-amber-100/50 dark:border-white/5'}`}>
                            <button onClick={() => copyToClipboard(m.content)} className={`p-2 rounded-xl transition-all hover:scale-105 ${m.role === 'user' ? 'hover:bg-white/20 text-white/90' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`} title="نسخ">
                              <Copy size={14} />
                            </button>
                            {navigator.share && (
                              <button 
                                onClick={() => shareMessage(m.content)} 
                                className={`p-2 rounded-xl transition-all hover:scale-105 ${m.role === 'user' ? 'hover:bg-white/20 text-white/90' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`} 
                                title="مشاركة"
                              >
                                <Share2 size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => window.dispatchEvent(new CustomEvent('open_spiritual_vision', { detail: { text: m.content } }))}
                              className={`p-2 rounded-xl transition-all hover:scale-105 ${m.role === 'user' ? 'hover:bg-white/20 text-white/90' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`} 
                              title="رؤية بصرية"
                            >
                              <ImageIcon size={14} />
                            </button>
                            <button 
                              onClick={() => window.dispatchEvent(new CustomEvent('open_typecast', { detail: { text: m.content } }))}
                              className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105" 
                              title="Typecast توليد صوت"
                            >
                              <AudioLines size={14} />
                            </button>
                            {m.role === 'assistant' && (
                              <>
                                <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1"></div>
                                <button 
                                  onClick={() => handleAIRecitation(m.id, m.content)} 
                                  className={`p-2 rounded-xl transition-all hover:scale-105 ${speakingId === m.id ? 'bg-amber-600 text-white animate-pulse shadow-md shadow-amber-600/20' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`}
                                  title={speakingId === m.id ? "إيقاف مؤقت" : "تلاوة ذكية"}
                                >
                                  {isGeneratingAudio === m.id ? <Loader2 size={14} className="animate-spin" /> : speakingId === m.id ? <SquareIcon size={14} /> : <Volume2 size={14} />}
                                </button>
                                <button 
                                  onClick={() => audioUrls[m.id] ? downloadAudioFile(m.id) : handleAIRecitation(m.id, m.content)}
                                  className={`p-2 rounded-xl transition-all hover:scale-105 ${audioUrls[m.id] ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`}
                                  title={audioUrls[m.id] ? "تنزيل التلاوة (WAV)" : "توليد وتنزيل التلاوة"}
                                >
                                  <Download size={14} />
                                </button>
                                <button onClick={() => regenerateMessage(messages.indexOf(m))} className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105" title="إعادة توليد">
                                  <RefreshCw size={14} />
                                </button>
                              </>
                            )}
                            <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1"></div>
                            <button onClick={() => deleteMessage(m.id)} className="p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-colors hover:scale-105" title="حذف">
                              <Trash size={14} />
                            </button>
                            <div className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 transition-all hover:scale-105 ml-1">
                              <ReadAloud 
                                text={m.content} 
                                className="gap-1.5" 
                                buttonClassName="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors" 
                              />
                            </div>
                          </div>
                          
                          {m.role === 'assistant' && m.model && (
                            <div className="mr-2 flex items-center gap-1.5 opacity-60 bg-amber-100/80 dark:bg-black/20 px-3 py-1.5 rounded-full border border-amber-200/50 dark:border-white/5 backdrop-blur-sm shadow-sm">
                              <Cpu size={12} className="text-amber-700 dark:text-amber-400" />
                              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 dark:text-amber-300">{m.model}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 text-[10px] opacity-40 flex justify-between items-center px-1">
                          <span>{new Date(m.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-end">
                    <div className="bg-white dark:bg-[#1c1917] border border-amber-200/20 p-4 rounded-2xl rounded-tl-none shadow-sm">
                      <div className="flex gap-1">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-amber-400 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-amber-500 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-amber-600 rounded-full" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />

                {/* Scroll to Bottom Button */}
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.button
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.8 }}
                      onClick={() => scrollToBottom('smooth')}
                      className="sticky bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 transition-all z-50 flex items-center gap-2 font-bold text-xs"
                    >
                      <ArrowDown size={16} />
                      <span>رسائل جديدة</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : activeTab === 'live' ? (
            <LiveVoicePanel
              snapshot={{
                personaMode: 'assistant',
                currentContext,
                viewMode,
                lastSearchedText,
                selectedReciter,
                selectedQiraat,
                selectedTafsir,
                selectedTranslation,
              }}
              onAction={onAction}
              title="المساعد الذكي — المحادثة الصوتية والنصية المباشرة"
            />
          ) : (
            <div className="flex-1 p-4 overflow-y-auto">
              <ImageGenerator />
            </div>
          )}

          {activeTab === 'chat' && (
            /* Input Area */
            <div className={`p-4 border-t border-amber-200/20 bg-amber-50/30 dark:bg-black/20 backdrop-blur-md relative z-10 ${isFullScreen ? 'max-w-4xl mx-auto w-full' : ''}`}>
              {/* Context Badge */}
              {currentContext?.surah && (
                <div className="mb-3 flex items-center gap-2 text-xs bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg text-amber-800 dark:text-amber-200 border border-amber-200/30">
                  <Book size={14} />
                  <span>سياق البحث: {getSurahDisplayName(currentContext.surah)}، آية {currentContext.ayah}</span>
                </div>
              )}

              {/* Suggestions */}
              <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar scroll-smooth">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.prompt)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-sm border border-amber-200/50 dark:border-amber-800/30 rounded-full text-sm hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:border-amber-400/50 transition-all dark:text-amber-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    {s.icon}
                    {s.text}
                  </button>
                ))}
              </div>

              <ChatInput 
                ref={chatInputRef}
                onSendMessage={handleSend}
                isLoading={isLoading}
                onStop={stopGeneration}
              />
            </div>
          )}

          <audio 
            ref={audioRef} 
            onEnded={() => setSpeakingId(null)} 
            onPause={() => setSpeakingId(null)}
            className="hidden" 
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
