import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Sparkles, Image as ImageIcon, Loader2, Settings2, RefreshCw, ExternalLink } from 'lucide-react';
import { callAIWithFailover, AI_PROVIDERS, AIProviderKey, generateImage, fetchAllProvidersModels, getDynamicImageModelsList } from '../services/aiService';
import { parseAIJson } from '../lib/utils';

const IMAGE_PROVIDERS: AIProviderKey[] = ['pollinations', 'gemini', 'routeway', 'openrouter', 'stability'];

interface SpiritualVisionProps {
  text: string | null;
  onClose: () => void;
}

interface SceneData {
  url: string;
  caption: string;
}

export const SpiritualVision: React.FC<SpiritualVisionProps> = ({ text, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'done' | 'error'>('idle');
  const [scene, setScene] = useState<SceneData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedProvider, setSelectedProvider] = useState<AIProviderKey>('pollinations');
  const [selectedModel, setSelectedModel] = useState('flux');
  
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsUpdatedMessage, setModelsUpdatedMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [, setModelsRefreshCounter] = useState(0);

  useEffect(() => {
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
      
      const providerModels = results[selectedProvider] || [];
      if (selectedProvider !== 'gemini' && providerModels.length > 0 && !providerModels.includes(selectedModel)) {
        const defaultModel = AI_PROVIDERS[selectedProvider].defaultModel;
        setSelectedModel(providerModels.includes(defaultModel) ? defaultModel : providerModels[0]);
      }
      setTimeout(() => setModelsUpdatedMessage(null), 3000);
    } catch (err: any) {
      setModelsUpdatedMessage(`فشل التحديث.`);
      setTimeout(() => setModelsUpdatedMessage(null), 3000);
    } finally {
      setIsUpdatingModels(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!text) {
      setStatus('idle');
      setScene(null);
      return;
    }

    const processVision = async () => {
      setStatus('analyzing');
      try {
        const cleanContent = text.substring(0, 1000).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

        const systemPrompt = `أنت خبير في هندسة الأوامر (Prompt Engineering). استنبط مشهداً واحداً يعبر عن النص التالي.
الشروط:
1. وصف إنجليزي دقيق للرسم (prompt) لا يتجاوز 50 كلمة.
2. بدون ذوات أرواح (no humans, no faces) وبدون أي نصوص أو كلمات أو حروف (no text, no words, no letters).
3. وصف عربي موجز (caption).
4. الرد بصيغة JSON فقط: {"prompt": "...", "caption": "..."}`;

        const response = await callAIWithFailover('gemini', [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `النص: "${cleanContent}"` }
        ], 'gemini-3.7-flash', { responseMimeType: 'application/json' });

        if (!isMounted) return;

        const rawContent = response?.content || "";
        const fallbackData = {
          prompt: "A beautiful, serene, spiritual Islamic landscape, divine light, minimalist",
          caption: "مشهد إيماني يبعث على الطمأنينة"
        };
        const parsedData = parseAIJson<{prompt: string; caption: string}>(rawContent, fallbackData);

        if (!parsedData || !parsedData.prompt || !parsedData.caption) {
          parsedData.prompt = fallbackData.prompt;
          parsedData.caption = fallbackData.caption;
        }

        setStatus('generating');

        const rawPrompt = `${parsedData.prompt}, masterpiece, spiritual, divine cinematic lighting, highly detailed, no text, no words, no letters, no humans, no faces, safe islamic representation`;
        const cleanPrompt = rawPrompt.substring(0, 500);
        
        const imageUrl = await generateImage(cleanPrompt, selectedProvider, {
          model: selectedModel,
          width: 1024,
          height: 1024,
          aspectRatio: '1:1'
        });

        if (!isMounted) return;

        setScene({ url: imageUrl, caption: parsedData.caption });
        setStatus('done');

      } catch (error: any) {
        if (!isMounted) return;
        console.error("SpiritualVision Error:", error);
        setErrorMsg(error.message || "حدث خطأ غير متوقع.");
        setStatus('error');
      }
    };

    processVision();

    return () => {
      isMounted = false;
    };
  }, [text, selectedProvider, selectedModel, refreshTrigger]);

  const handleOpenExternal = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!scene) return;

    const openLink = (href: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (scene.url.startsWith('data:')) {
      try {
        const response = await fetch(scene.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        openLink(url);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (err) {
        console.error("Failed to open data URL", err);
      }
    } else {
      openLink(scene.url);
    }
  };
  const handleDownload = async () => {
    if (!scene) return;
    const safeCaption = scene.caption.substring(0, 50).replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '').trim().replace(/\s+/g, '-');
    const filename = `${safeCaption || 'midad-vision'}.png`;
    
    try {
      const response = await fetch(scene.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
      const a = document.createElement('a');
      a.href = scene.url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (!text) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-4xl bg-[#1c1917] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-50">المولد الفني الذكي</h2>
                <p className="text-xs text-amber-200/60 font-medium">تجسيد المعاني برؤية إبداعية</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className={`p-2.5 rounded-xl transition-all ${showModelSelector ? 'bg-amber-500 text-white' : 'bg-white/5 text-amber-200/60 hover:bg-white/10 hover:text-amber-100'}`}
                title="إعدادات المزود والنموذج"
              >
                <Settings2 size={20} />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Model Selector Dropdown */}
            <AnimatePresence>
              {showModelSelector && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-white/5 bg-black/20 shrink-0"
                >
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest px-1">المزود</label>
                        <select 
                          value={selectedProvider}
                          onChange={(e) => {
                            const newProvider = e.target.value as AIProviderKey;
                            setSelectedProvider(newProvider);
                            const providerModels = getDynamicImageModelsList(newProvider);
                            const defaultModel = providerModels[0] || (AI_PROVIDERS[newProvider] as any).defaultModel;
                            setSelectedModel(defaultModel);
                          }}
                          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 transition-all text-amber-50"
                          dir="ltr"
                        >
                          {IMAGE_PROVIDERS.map(p => (
                            <option key={p} value={p} className="bg-[#1c1917]">{AI_PROVIDERS[p].name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">النموذج</label>
                          <button
                            onClick={handleRefreshModels}
                            disabled={isUpdatingModels}
                            className="text-[10px] text-amber-400 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isUpdatingModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          </button>
                        </div>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 transition-all text-amber-50"
                          dir="ltr"
                        >
                          {getDynamicImageModelsList(selectedProvider).map((m: string) => (
                            <option key={m} value={m} className="bg-[#1c1917]">{m.split('/').pop()?.replace(':free', '') || m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {modelsUpdatedMessage && (
                      <div className="text-[10px] text-emerald-400 animate-pulse px-1">{modelsUpdatedMessage}</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6 shrink-0">
            
            {/* Source Text Section */}
            <div className="w-full md:w-1/3 flex flex-col space-y-4">
              <div className="bg-white/5 rounded-2xl p-4 sm:p-6 border border-white/5 flex-1 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                  <Sparkles size={16} /> النص المستلهم
                </h3>
                <p className="text-amber-50/80 leading-relaxed text-sm sm:text-base font-medium relative z-10" dir="rtl">
                  {text}
                </p>
              </div>
            </div>

            {/* Visual Section */}
            <div className="w-full md:w-2/3 flex flex-col">
              <div className="relative aspect-square w-full max-w-lg mx-auto bg-black/40 rounded-3xl border border-white/10 overflow-hidden shadow-inner flex items-center justify-center group">
                
                {status === 'analyzing' && (
                  <div className="flex flex-col items-center justify-center text-amber-200/60 space-y-4">
                    <Loader2 size={40} className="animate-spin text-amber-500" />
                    <p className="font-bold tracking-wider animate-pulse" dir="rtl">جاري استنباط المشهد...</p>
                  </div>
                )}

                {status === 'generating' && (
                  <div className="flex flex-col items-center justify-center text-amber-200/60 space-y-4">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-amber-500/30 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-amber-500 rounded-full border-t-transparent animate-spin"></div>
                      <ImageIcon size={32} className="absolute inset-0 m-auto text-amber-500/50" />
                    </div>
                    <p className="font-bold tracking-wider animate-pulse text-amber-500" dir="rtl">جاري رسم المشهد الفريد...</p>
                    <p className="text-xs opacity-70" dir="rtl">قد يستغرق هذا بضع ثوانٍ</p>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex flex-col items-center justify-center text-red-400 space-y-4 p-8 text-center bg-red-500/5 w-full h-full">
                    <X size={48} className="text-red-500" />
                    <h3 className="text-xl font-bold" dir="rtl">تعذر توليد المشاهد</h3>
                    <p className="text-sm text-red-300/80 max-w-xs" dir="rtl">{errorMsg}</p>
                    <button
                      onClick={() => {
                        setErrorMsg('');
                        setScene(null);
                        setStatus('idle');
                        setRefreshTrigger(prev => prev + 1);
                      }}
                      className="mt-4 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                      dir="rtl"
                    >
                      <RefreshCw size={18} />
                      إعادة المحاولة
                    </button>
                  </div>
                )}

                {status === 'done' && scene && (
                  <>
                    <img 
                      src={scene.url} 
                      alt={scene.caption} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                      <p className="text-white text-sm md:text-base font-medium leading-relaxed drop-shadow-md" dir="rtl">
                        {scene.caption}
                      </p>
                    </div>
                    <div className="absolute top-4 left-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={handleDownload}
                        className="p-3 bg-black/50 hover:bg-amber-500 backdrop-blur-md rounded-xl text-white transition-all shadow-lg"
                        title="تحميل الصورة"
                      >
                        <Download size={20} />
                      </button>
                      <button
                        onClick={() => {
                          setStatus('idle');
                          setScene(null);
                          setRefreshTrigger(prev => prev + 1);
                        }}
                        className="p-3 bg-black/50 hover:bg-amber-500 backdrop-blur-md rounded-xl text-white transition-all shadow-lg"
                        title="إعادة توليد المشهد"
                      >
                        <RefreshCw size={20} />
                      </button>
                      <button
                        onClick={handleOpenExternal}
                        className="p-3 bg-black/50 hover:bg-amber-500 backdrop-blur-md rounded-xl text-white transition-all shadow-lg"
                        title="فتح في علامة تبويب جديدة"
                      >
                        <ExternalLink size={20} />
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {status === 'done' && scene && (
                <div className="mt-6 text-center">
                   <p className="text-amber-100/80 text-sm md:text-base font-medium leading-relaxed max-w-lg mx-auto" dir="rtl">
                    {scene.caption}
                  </p>
                </div>
              )}

            </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
