import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Download, Image as ImageIcon, Settings2, RefreshCw, Wand2, ChevronDown, Trash2, ExternalLink, X, Minimize, Maximize, Copy } from 'lucide-react';
import { AI_PROVIDERS, AIProviderKey, generateImage, generateSmartPrompt, generateShortArabicSummary, ImageGenerationConfig, fetchAllProvidersModels, getDynamicImageModelsList } from '../services/aiService';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../lib/utils';

const IMAGE_PROVIDERS: AIProviderKey[] = ['pollinations', 'gemini', 'routeway', 'openrouter', 'stability'];

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<AIProviderKey>('pollinations');
  const [model, setModel] = useState('flux');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');
  const [isSmartMode, setIsSmartMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ url: string; prompt: string; provider: string; model: string; timestamp: number; arabicSummary?: string }[]>(() => {
    try {
      const saved = safeLocalStorageGet('image_gen_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; prompt: string; arabicSummary?: string } | null>(null);
  const [isExpandedPreview, setIsExpandedPreview] = useState(false);

  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsUpdatedMessage, setModelsUpdatedMessage] = useState<string | null>(null);
  const [, setModelsRefreshCounter] = useState(0);

  useEffect(() => {
    // Automatically fetch models on mount
    fetchAllProvidersModels(true).catch(console.error);

    const handleModelsUpdated = () => setModelsRefreshCounter(c => c + 1);
    window.addEventListener('models_updated', handleModelsUpdated);
    return () => window.removeEventListener('models_updated', handleModelsUpdated);
  }, []);

  const handleRefreshModels = async () => {
    setIsUpdatingModels(true);
    setModelsUpdatedMessage(null);
    try {
      const results = await fetchAllProvidersModels();
      const totalUpdated = Object.values(results).reduce((acc, models) => acc + models.length, 0);
      setModelsUpdatedMessage(`تم تحديث ${totalUpdated} نموذج بنجاح.`);
      
      const providerModels = results[provider] || getDynamicImageModelsList(provider);
      if (provider !== 'gemini' && providerModels.length > 0 && !providerModels.includes(model)) {
        const defaultModel = AI_PROVIDERS[provider].defaultModel;
        setModel(providerModels.includes(defaultModel) ? defaultModel : providerModels[0]);
      }
      setTimeout(() => setModelsUpdatedMessage(null), 3000);
    } catch (err: any) {
      setModelsUpdatedMessage(`فشل التحديث.`);
      setTimeout(() => setModelsUpdatedMessage(null), 3000);
    } finally {
      setIsUpdatingModels(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const downloadImage = async (url: string, prompt: string) => {
    try {
      let blobUrl;
      if (url.startsWith('data:')) {
        const parts = url.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        blobUrl = URL.createObjectURL(blob);
      } else {
        const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Proxy fetch failed');
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
      }
      
      const link = document.createElement('a');
      const safeName = prompt.substring(0, 30).replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '_').trim() || 'midad-art';
      link.download = `${safeName}.png`;
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Download failed:', err);
      setError('تعذر تحميل الصورة مباشرة، يمكنك فتح الرابط المباشر.');
    }
  };


  useEffect(() => {
    try {
      safeLocalStorageSet('image_gen_history', JSON.stringify(history.slice(0, 10)));
    } catch (e) {
      console.error("Failed to save history:", e);
      if ((e as any)?.name === 'QuotaExceededError') {
        safeLocalStorageRemove('image_gen_history');
        setHistory([]);
      }
    }
  }, [history]);

  const handleGenerateRef = useRef<(overridePrompt?: string) => Promise<void>>(async () => {});

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const activePrompt = typeof overridePrompt === 'string' ? overridePrompt : prompt;
    if (!activePrompt.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      let finalPrompt = activePrompt;
      let shortArabicSummary = prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '');
      
      try {
        shortArabicSummary = await generateShortArabicSummary(prompt, provider, model);
      } catch (summaryErr) {
        console.warn("Failed to generate short Arabic summary, using fallback:", summaryErr);
      }
      
      if (isSmartMode) {
        try {
          finalPrompt = await generateSmartPrompt(prompt, provider, model);
        } catch (smartErr) {
          console.warn("Failed to generate smart prompt, using original prompt:", smartErr);
        }
      }

      const getResolution = (ratio: string) => {
        switch (ratio) {
          case '1:1': return { width: 1024, height: 1024 };
          case '3:4': return { width: 768, height: 1024 };
          case '4:3': return { width: 1024, height: 768 };
          case '9:16': return { width: 768, height: 1344 };
          case '16:9': return { width: 1344, height: 768 };
          default: return { width: 1024, height: 1024 };
        }
      };

      const { width, height } = getResolution(aspectRatio);

      const config: ImageGenerationConfig = {
        model,
        aspectRatio,
        width,
        height,
      };

      const url = await generateImage(finalPrompt, provider, config);
      
      const timestamp = Date.now();
      const newEntry = {
        url,
        prompt: finalPrompt,
        provider: AI_PROVIDERS[provider].name,
        model,
        timestamp,
        arabicSummary: shortArabicSummary
      };

      setHistory(prev => [newEntry, ...prev]);
      setPreviewImage({ url, prompt: finalPrompt, arabicSummary: shortArabicSummary });
    } catch (err: any) {
      console.error(err);
      if (err && err.message && typeof err.message === 'string') {
        if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
          setError('تم تجاوز الحد المسموح للاستخدام اليومي. يرجى تجربة مزود آخر أو الانتظار لفترة.');
        } else {
          setError(err.message || 'حدث خطأ أثناء توليد الصورة.');
        }
      } else {
        setError('حدث خطأ غير متوقع أثناء توليد الصورة.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt, isLoading, provider, model, isSmartMode, aspectRatio]);

  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  }, [handleGenerate]);

  useEffect(() => {
    const handleTrigger = (e: any) => {
      const triggeredPrompt = e?.detail?.prompt;
      if (typeof triggeredPrompt === 'string' && triggeredPrompt.trim()) {
        setPrompt(triggeredPrompt);
        void handleGenerateRef.current(triggeredPrompt);
      }
    };
    window.addEventListener('trigger_image_gen', handleTrigger);
    return () => window.removeEventListener('trigger_image_gen', handleTrigger);
  }, []);

  const deleteFromHistory = (index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`flex flex-col h-full p-2 sm:p-4 md:p-6 mx-auto w-full transition-all duration-500 ${isExpanded ? 'expanded-view p-8 md:p-16' : 'max-w-7xl'}`} dir="rtl">
      {/* Header with Smart Buttons */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-2xl shadow-inner">
            <ImageIcon size={28} className="text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-amber-950 dark:text-amber-50 tracking-tight">المولد الفني الذكي</h2>
            <p className="text-sm text-amber-800/60 dark:text-amber-400/60 font-medium">حول كلماتك إلى لوحات فنية روحانية</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open_ai_chat'))}
            className="p-3 bg-white dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl hover:scale-110 transition-all border border-amber-200 dark:border-amber-800 shadow-sm group"
            title="المساعد الذكي"
          >
            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="bg-white dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm hover:scale-110 transition-all"
            title={isExpanded ? "تصغير" : "ملء الشاشة"}
          >
            {isExpanded ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 lg:min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar pb-10">
        {/* Left Column: Input & Settings */}
        <div className="lg:col-span-5 flex flex-col gap-6 lg:overflow-y-auto custom-scrollbar pb-6">
          {/* Main Input Area */}
          <div className="bg-white dark:bg-[#1c1917] p-6 rounded-[2.5rem] border-2 border-amber-300 dark:border-amber-700/50 shadow-2xl flex flex-col gap-4 relative">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                <Wand2 size={18} className="text-amber-600" />
                ماذا تريد أن ترسم؟
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/40 uppercase tracking-widest">تحسين ذكي</span>
                <button 
                  onClick={() => setIsSmartMode(!isSmartMode)}
                  className={`w-10 h-5 rounded-full transition-all relative ${isSmartMode ? 'bg-amber-500' : 'bg-amber-200 dark:bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isSmartMode ? 'right-6' : 'right-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="w-full relative z-10 flex flex-col gap-4">
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="عبر عن خيالك الفني هنا... (مثال: نخلة وسط الصحراء عند الغروب)"
                className="w-full min-h-[150px] p-6 bg-white dark:bg-[#292524] rounded-3xl border-2 border-amber-400/50 dark:border-amber-600/30 text-lg text-amber-950 dark:text-amber-50 outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y placeholder:text-amber-900/50 dark:placeholder:text-amber-100/40 font-medium shadow-inner block"
                dir="rtl"
              />

              <button 
                id="generate-image-btn"
                onClick={() => void handleGenerate()}
                disabled={isLoading || !prompt.trim()}
                className={`w-full py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 ${isLoading || !prompt.trim() ? 'bg-amber-100 dark:bg-white/5 text-amber-300 dark:text-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:shadow-amber-500/40 hover:-translate-y-0.5 shadow-amber-500/20'}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>جاري التوليد...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={24} />
                    <span>توليد اللوحة</span>
                  </>
                )}
              </button>
              {error && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 text-xs font-medium">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-amber-200/50 dark:border-white/10 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Settings2 size={18} className="text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">إعدادات التوليد</h3>
            </div>

            <div className="space-y-6">
              {/* Provider & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-800/60 dark:text-amber-400/60 uppercase tracking-widest px-1">المزود</label>
                  <div className="relative">
                    <select 
                      value={provider}
                      onChange={(e) => {
                        const newProvider = e.target.value as AIProviderKey;
                        setProvider(newProvider);
                        const providerModels = getDynamicImageModelsList(newProvider);
                        const defaultModel = providerModels[0] || (AI_PROVIDERS[newProvider] as any).defaultModel;
                        setModel(defaultModel);
                      }}
                      className="w-full appearance-none p-3 rounded-xl bg-amber-50/50 dark:bg-black/20 border border-amber-100 dark:border-white/5 text-xs outline-none focus:ring-2 focus:ring-amber-500/30 transition-all dark:text-amber-100 cursor-pointer"
                    >
                      {IMAGE_PROVIDERS.map(p => (
                        <option key={p} value={p}>{AI_PROVIDERS[p]?.name || p}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-amber-800/60 dark:text-amber-400/60 uppercase tracking-widest">النموذج</label>
                    <button
                      onClick={handleRefreshModels}
                      disabled={isUpdatingModels}
                      className="text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 flex items-center gap-1 disabled:opacity-50"
                      title="تحديث النماذج"
                    >
                      {isUpdatingModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    </button>
                  </div>
                  {modelsUpdatedMessage && (
                    <div className="text-[10px] text-emerald-500 animate-pulse px-1">{modelsUpdatedMessage}</div>
                  )}
                  <div className="relative">
                    <select 
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full appearance-none p-3 rounded-xl bg-amber-50/50 dark:bg-black/20 border border-amber-100 dark:border-white/5 text-xs outline-none focus:ring-2 focus:ring-amber-500/30 transition-all dark:text-amber-100 cursor-pointer"
                    >
                      {getDynamicImageModelsList(provider).map((m: string) => (
                        <option key={m} value={m}>{m.split('/').pop()?.replace(':free', '') || m}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600" />
                  </div>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-amber-800/60 dark:text-amber-400/60 uppercase tracking-widest px-1">نسبة العرض (Aspect Ratio)</label>
                <div className="flex gap-2">
                  {(['1:1', '3:4', '4:3', '9:16', '16:9'] as const).map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all border ${aspectRatio === ratio ? 'bg-amber-500 text-white border-transparent shadow-md' : 'bg-amber-50/50 dark:bg-black/20 text-amber-800 dark:text-amber-200 border-amber-100 dark:border-white/5 hover:bg-amber-100'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preview & History */}
        <div className="lg:col-span-7 flex flex-col gap-6 lg:min-h-0 min-h-[500px]">
          {/* Main Preview Area */}
          <div className="flex-1 bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-2xl rounded-[2.5rem] border border-amber-200/50 dark:border-white/10 shadow-xl overflow-hidden relative flex flex-col">
            <AnimatePresence mode="wait">
              {previewImage ? (
                <motion.div 
                  key={previewImage.url}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative flex-1 group"
                >
                  <img 
                    src={previewImage.url} 
                    alt={previewImage.prompt}
                    className="w-full h-full object-contain bg-black/5"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Floating Controls */}
                  <div className="absolute bottom-6 right-6 left-6 flex justify-between items-end opacity-100 transition-opacity duration-300">
                    <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-[70%]">
                      <p className="text-white text-sm font-bold line-clamp-2 mb-1" dir="rtl">{previewImage.arabicSummary || previewImage.prompt}</p>
                      <p className="text-white/40 text-[10px] font-mono truncate" dir="ltr">{previewImage.prompt}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => downloadImage(previewImage.url, previewImage.prompt)}
                        className="p-3 bg-amber-500 text-white rounded-xl shadow-lg hover:scale-110 transition-all"
                        title="تحميل الصورة"
                      >
                        <Download size={20} />
                      </button>
                      <button 
                        onClick={() => copyToClipboard(previewImage.prompt)}
                        className="p-3 bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 hover:scale-110 transition-all"
                        title="نسخ الأمر"
                      >
                        <Copy size={20} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="w-32 h-32 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-600 animate-pulse">
                    <ImageIcon size={64} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-amber-900 dark:text-amber-100">بانتظار إبداعك</h3>
                    <p className="text-amber-800/60 dark:text-amber-400/60 max-w-xs mx-auto mt-2">اكتب وصفاً في المربع الجانبي واضغط على "توليد اللوحة" لتبدأ الرحلة الفنية</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* History Strip */}
          <div className="h-32 flex gap-4 overflow-x-auto custom-scrollbar pb-2">
            {history.map((item, idx) => (
              <div
                key={item.timestamp}
                className={`flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border-2 transition-all relative group cursor-pointer ${previewImage?.url === item.url ? 'border-amber-500 shadow-lg scale-95' : 'border-transparent hover:border-amber-300'}`}
                onClick={() => setPreviewImage({ url: item.url, prompt: item.prompt, arabicSummary: item.arabicSummary })}
              >
                <img src={item.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); downloadImage(item.url, item.prompt); }}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors"
                  >
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteFromHistory(idx); }}
                    className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-amber-200 dark:border-white/5 rounded-2xl text-amber-800/20 dark:text-white/5 text-xs font-bold">
                سجل التوليد فارغ
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Preview Modal */}
      <AnimatePresence>
        {isExpandedPreview && previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12"
          >
            <button 
              onClick={() => setIsExpandedPreview(false)}
              className="absolute top-8 right-8 p-4 text-white/60 hover:text-white transition-colors bg-white/5 rounded-full"
            >
              <X size={32} />
            </button>
            
            <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-8">
              <img 
                src={previewImage.url} 
                alt={previewImage.prompt}
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl shadow-amber-500/10"
                referrerPolicy="no-referrer"
              />
              
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 w-full max-w-3xl text-center space-y-4">
                <h3 className="text-2xl font-black text-white" dir="rtl">{previewImage.arabicSummary || "لوحة فنية ذكية"}</h3>
                <p className="text-white/60 text-lg leading-relaxed" dir="ltr">{previewImage.prompt}</p>
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <button 
                    onClick={() => downloadImage(previewImage.url, previewImage.prompt)}
                    className="flex items-center gap-3 px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-lg hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20"
                  >
                    <Download size={24} />
                    تحميل اللوحة (PNG)
                  </button>
                  <a
                    href={previewImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
                  >
                    <ExternalLink size={24} />
                    رابط مباشر
                  </a>
                  <button 
                    onClick={() => copyToClipboard(previewImage.prompt)}
                    className="flex items-center gap-3 px-8 py-4 bg-white/10 text-white rounded-2xl font-black text-lg hover:bg-white/20 transition-all border border-white/10"
                  >
                    <Copy size={24} />
                    نسخ الأمر
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
