import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, Brain, Loader2, Image as ImageIcon, Maximize2, Edit2, 
  RefreshCw, Check, Copy, Share2, StopCircle, Volume2, Download, Sparkles, Zap, Cpu,
  ChevronDown, ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIMessage } from '../../services/aiService';
import { saveImageToCache, getImageFromCache } from '../../lib/imageCache';
import { AdvancedReadAloud } from '../AdvancedReadAloud';

const getSafeHttpUrl = (rawUrl?: string): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl.trim(), window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }
  return null;
};

const getSafeMediaUrl = (rawUrl?: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  return getSafeHttpUrl(trimmed) || '';
};

export const MessageItem = React.memo(({ 
  m, 
  index,
  handleAIRecitation, 
  stopRecitation,
  isGeneratingAudio,
  sendMessage, 
  copyToClipboard, 
  shareMessage,
  copyFeedback,
  audioUrl,
  downloadAudioFile,
  selectedVoice,
  onRegenerate,
  onEdit,
  selectedModel,
  providerName,
  autoOpenThoughts = false
}: { 
  m: AIMessage, 
  index: number,
  handleAIRecitation: (text: string, id: number) => void, 
  stopRecitation: () => void,
  isGeneratingAudio: string | null,
  sendMessage: (text: string) => void,
  copyToClipboard: (text: string, id: string) => void,
  shareMessage: (text: string) => void,
  copyFeedback: string | null,
  audioUrl?: string,
  downloadAudioFile: (url: string, prefix: string) => void,
  selectedVoice: string,
  onRegenerate: (index: number) => void,
  onEdit: (index: number) => void,
  selectedModel: string,
  providerName: string,
  autoOpenThoughts?: boolean
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string>('');
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(autoOpenThoughts);

  useEffect(() => {
    setIsThoughtExpanded(autoOpenThoughts);
  }, [autoOpenThoughts]);

  useEffect(() => {
    if (!m.imageUrl) {
      setLocalImageUrl('');
      setImgLoaded(false);
      setImgError(false);
      return;
    }

    let isMounted = true;
    let objectUrl = '';

    const handleLoadImage = async () => {
      try {
        setImgError(false);
        setImgLoaded(false);

        const cachedBlob = await getImageFromCache(m.imageUrl);
        if (cachedBlob && isMounted) {
          objectUrl = URL.createObjectURL(cachedBlob);
          setLocalImageUrl(objectUrl);
          setImgLoaded(true);
          return;
        }

        const res = await fetch(m.imageUrl, { referrerPolicy: 'no-referrer' });
        if (!res.ok) throw new Error('Failed to load image');
        const blob = await res.blob();

        await saveImageToCache(m.imageUrl!, blob);

        if (isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setLocalImageUrl(objectUrl);
          setImgLoaded(true);
        }
      } catch (err) {
        console.error("Local caching of image failed:", err);
        if (isMounted) {
          setLocalImageUrl(m.imageUrl!);
        }
      }
    };

    handleLoadImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [m.imageUrl]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
    >
      <div className={`p-5 rounded-3xl shadow-sm relative group transition-all duration-300 hover:shadow-md ${m.role === 'user' ? 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/60 dark:to-amber-900/30 text-amber-950 dark:text-amber-100 rounded-tr-none max-w-[85%] border border-amber-200/50 dark:border-amber-800/30' : 'bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-sm text-amber-900 dark:text-amber-50 border border-amber-100 dark:border-amber-900/50 rounded-tl-none max-w-[95%]'}`}>
        {m.role === 'assistant' && (m.groundingMetadata || m.thought) && (
          <div className="absolute -top-2 -left-2 flex gap-1 z-10">
            {m.groundingMetadata && (
              <motion.div 
                initial={{ scale: 0, rotate: -20 }} 
                animate={{ scale: 1, rotate: 0 }}
                className="bg-emerald-600 text-white p-1.5 rounded-xl border-2 border-white dark:border-[#1c1917] shadow-lg flex items-center gap-1" 
                title="تم التحقق عبر بحث غوغل"
              >
                <Globe size={10} />
                <span className="text-[8px] font-bold">بحث</span>
              </motion.div>
            )}
            {m.thought && (
              <button 
                onClick={() => setIsThoughtExpanded(prev => !prev)}
                className="bg-amber-600 hover:bg-amber-700 text-white p-1.5 rounded-xl border-2 border-white dark:border-[#1c1917] shadow-lg flex items-center gap-1 transition-all cursor-pointer" 
                title={isThoughtExpanded ? "إخفاء قائمة التفكير" : "إظهار قائمة التفكير"}
              >
                <Brain size={10} />
                <span className="text-[8px] font-bold">تأمل {isThoughtExpanded ? '▲' : '▼'}</span>
              </button>
            )}
          </div>
        )}
        
        {m.role === 'assistant' && m.thought && (
          <div className="mb-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 rounded-2xl overflow-hidden text-[13px] text-amber-900 dark:text-amber-200 font-sans shadow-sm" dir="rtl">
            <button
              onClick={() => setIsThoughtExpanded(prev => !prev)}
              className="w-full flex items-center justify-between p-2.5 px-3.5 bg-amber-100/50 dark:bg-amber-900/30 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors font-bold text-amber-800 dark:text-amber-300 text-xs cursor-pointer select-none"
              title={isThoughtExpanded ? "إخفاء مسار التفكير والتأمل" : "عرض مسار التفكير والتأمل"}
            >
              <div className="flex items-center gap-2">
                <Brain size={15} className="text-amber-600 dark:text-amber-400 animate-pulse" />
                <span>مسار تفكير الذكاء الاصطناعي</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium bg-amber-200/50 dark:bg-amber-800/40 px-2 py-0.5 rounded-lg">
                <span>{isThoughtExpanded ? 'إخفاء التفكير' : 'عرض التفكير'}</span>
                {isThoughtExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            
            {isThoughtExpanded && (
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
        )}

        <div className="prose dark:prose-invert prose-amber max-w-none leading-relaxed text-right font-sans message-bubble" dir="rtl">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</ReactMarkdown>
        </div>

        {m.role === 'assistant' && (() => {
          const displayModel = m.model || selectedModel;
          return (
            <div className="flex items-center gap-2 mt-2 text-[9px] text-amber-600/60 dark:text-amber-400/60 font-mono" dir="ltr">
              <Cpu size={8} /> {displayModel.split('|')[1] || displayModel}
              <Brain size={8} /> {providerName}
            </div>
          );
        })()}

        {m.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-amber-100/50 dark:border-amber-900/40 shadow-sm group/img relative bg-amber-50/50 dark:bg-black/20 min-h-[200px] flex flex-col items-center justify-center">
            {!imgLoaded && !imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-50/80 to-amber-100/50 dark:from-zinc-900 dark:to-zinc-800 animate-pulse">
                <Loader2 className="w-8 h-8 text-amber-600 dark:text-amber-400 animate-spin" />
                <span className="text-xs text-amber-800/60 dark:text-amber-200/60 font-sans">تجلّي الصورة الروحية...</span>
              </div>
            )}
            {imgError ? (
              <div className="p-4 text-center flex flex-col items-center gap-2 text-amber-800/60 dark:text-amber-200/60">
                <ImageIcon size={32} className="opacity-50" />
                <span className="text-xs font-sans">تعذر تحميل الصورة المعبرة</span>
              </div>
            ) : (
              <img 
                src={localImageUrl || m.imageUrl} 
                alt="صورة روحية معبرة" 
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`w-full max-h-[400px] object-cover transition-all duration-700 ${imgLoaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                referrerPolicy="no-referrer"
              />
            )}
            {imgLoaded && getSafeMediaUrl(localImageUrl || m.imageUrl) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                <span className="text-white text-xs font-sans font-medium">صورة مستوحاة من فيض المعنى</span>
                <a 
                  href={getSafeMediaUrl(localImageUrl || m.imageUrl)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-1 rounded-lg bg-white/20 hover:bg-white/40 text-white transition-colors"
                  title="فتح الصورة بحجم كامل"
                >
                  <Maximize2 size={14} />
                </a>
              </div>
            )}
            <div className="absolute bottom-1 right-1 text-[8px] text-white/50 bg-black/30 px-1 rounded-sm" dir="ltr">
              Generated by {m.imageModel || providerName} ({(m.model || selectedModel).split('|')[1] || (m.model || selectedModel)})
            </div>
          </div>
        )}
        
        <div className={`flex flex-wrap items-center gap-1 mt-4 pt-3 border-t border-amber-100/50 dark:border-amber-900/30 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className="flex flex-wrap items-center bg-amber-50/80 dark:bg-black/20 rounded-2xl px-2 py-1.5 border border-amber-100/50 dark:border-white/5 backdrop-blur-md gap-1 shadow-sm">
            {m.role === 'user' && (
              <button 
                onClick={() => onEdit(index)} 
                className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                title="تعديل الرسالة"
              >
                <Edit2 size={16} />
              </button>
            )}
            
            {m.role === 'assistant' && (
              <button 
                onClick={() => onRegenerate(index)} 
                className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                title="إعادة توليد"
              >
                <RefreshCw size={16} />
              </button>
            )}

            <button 
              onClick={() => copyToClipboard(m.content, index.toString())} 
              className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105 flex items-center gap-1.5" 
              title="نسخ النص"
            >
              {copyFeedback === index.toString() ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
            
            <button 
              onClick={() => shareMessage(m.content)} 
              className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105 flex items-center gap-1.5" 
              title="مشاركة"
            >
              <Share2 size={16} />
            </button>

            {m.role === 'assistant' && (
              <>
                <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1"></div>
                
                <button 
                  onClick={() => isGeneratingAudio === index.toString() ? stopRecitation() : handleAIRecitation(m.content, index)} 
                  className={`p-2 rounded-xl transition-all hover:scale-105 flex items-center gap-1.5 overflow-hidden ${isGeneratingAudio === index.toString() ? 'bg-amber-600 text-white animate-pulse shadow-md shadow-amber-600/20' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`}
                  title="تلاوة احترافية (مداد)"
                >
                  {isGeneratingAudio === index.toString() ? <StopCircle size={16} /> : <Volume2 size={16} />}
                </button>

                {audioUrl && (
                  <button 
                    onClick={() => downloadAudioFile(audioUrl, `midad_recitation_${index}`)}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105 flex items-center gap-1.5"
                    title="تنزيل التلاوة"
                  >
                    <Download size={16} />
                  </button>
                )}

                <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1"></div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => sendMessage(`واصل المدد في هذه النقطة بالتحديد: ${m.content.substring(0, 500)}...`)}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                    title="واصل المدد"
                  >
                    <Sparkles size={16} />
                  </button>
                  <button 
                    onClick={() => sendMessage(`لخص لي هذه الرسالة بأسلوب بسيط وميسر: ${m.content.substring(0, 500)}...`)}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                    title="تبسيط المعنى"
                  >
                    <Zap size={16} />
                  </button>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open_spiritual_vision', { detail: { text: m.content } }))}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105" 
                    title="رؤية بصرية"
                  >
                    <ImageIcon size={16} />
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 transition-all hover:scale-105 ml-1">
              <AdvancedReadAloud 
                text={m.content} 
                voiceName={selectedVoice}
                className="gap-1.5"
                buttonClassName="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {m.role === 'assistant' && m.groundingMetadata && (() => {
        const chunks = m.groundingMetadata.groundingChunks || [];
        const sources = chunks.map((c: any) => {
          const safeUri = getSafeHttpUrl(c.web?.uri || c.uri || '');
          if (!safeUri) return null;
          return {
            title: String(c.web?.title || c.title || 'مصدر ويب'),
            uri: safeUri
          };
        }).filter(Boolean) as Array<{ title: string; uri: string }>;

        const queries = Array.isArray(m.groundingMetadata.webSearchQueries) ? m.groundingMetadata.webSearchQueries : [];
        if (sources.length === 0 && queries.length === 0) return null;

        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 w-full max-w-[95%] bg-amber-50/40 dark:bg-amber-900/5 backdrop-blur-md rounded-2xl border border-amber-200/30 dark:border-amber-800/20 overflow-hidden shadow-sm p-4" 
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-200/30 dark:border-amber-800/20">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-bold text-sm">
                <Globe size={16} className="text-emerald-600" />
                <span>المصادر والمراجع الموثقة</span>
              </div>
            </div>

            {queries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[10px] text-amber-700/60 dark:text-amber-400/60 font-medium">عمليات البحث:</span>
                {queries.map((q: string, idx: number) => (
                  <span key={idx} className="bg-amber-100/50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full text-[10px] text-amber-800 dark:text-amber-300 border border-amber-200/30 dark:border-amber-800/20">
                    {q}
                  </span>
                ))}
              </div>
            )}

            {sources.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sources.map((src: any, idx: number) => {
                  const cleanTitle = src.title.length > 75 ? src.title.substring(0, 72) + '...' : src.title;
                  let domain = '';
                  try {
                    domain = new URL(src.uri).hostname.replace('www.', '');
                  } catch (e) {}

                  return (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all border border-amber-100/40 dark:border-amber-900/20 hover:border-emerald-300 dark:hover:border-emerald-800 group/link shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center justify-center text-[11px] w-6 h-6 bg-emerald-600 text-white rounded-lg shrink-0 font-bold shadow-md shadow-emerald-900/10">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[12px] leading-tight text-amber-950 dark:text-amber-50 group-hover/link:text-emerald-700 dark:group-hover/link:text-emerald-400 transition-colors text-right">
                          {cleanTitle}
                        </div>
                        {domain && (
                          <div className="text-[9px] text-amber-800/50 dark:text-amber-400/50 font-mono mt-1 text-right">
                            {domain}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-2 text-amber-800/40 dark:text-amber-400/40 text-xs italic">
                جاري استحضار المصادر...
              </div>
            )}
          </motion.div>
        );
      })()}
    </motion.div>
  );
});
