import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageItem } from './MessageItem';
import { AIMessage } from '../../services/aiService';
import { Compass, Sparkles, ArrowDown } from 'lucide-react';

export const MessageList = ({ 
  messages,
  handleAIRecitation,
  stopRecitation,
  isGeneratingAudio,
  sendMessage,
  copyToClipboard,
  shareMessage,
  copyFeedback,
  audioUrls,
  downloadAudioFile,
  selectedVoice,
  onRegenerate,
  onEdit,
  isLoading,
  selectedModel,
  providerName,
  isZenMode,
  suggestions = [],
  suggestionsLoading = false,
  autoOpenThoughts = false
}: {
  messages: AIMessage[],
  handleAIRecitation: (text: string, id: number) => void,
  stopRecitation: () => void,
  isGeneratingAudio: string | null,
  sendMessage: (text: string) => void,
  copyToClipboard: (text: string, id: string) => void,
  shareMessage: (text: string) => void,
  copyFeedback: string | null,
  audioUrls: Record<string, string>,
  downloadAudioFile: (url: string, prefix: string) => void,
  selectedVoice: string,
  onRegenerate: (index: number) => void,
  onEdit: (index: number) => void,
  isLoading: boolean,
  selectedModel: string,
  providerName: string,
  isZenMode: boolean,
  suggestions?: string[],
  suggestionsLoading?: boolean,
  autoOpenThoughts?: boolean
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottom.current = atBottom;
    setShowScrollButton(!atBottom && scrollHeight > clientHeight);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: isLoading ? 'auto' : 'smooth'
      });
    }
  }, [messages, isLoading, suggestions]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar [overflow-anchor:auto]"
      >
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => (
              <MessageItem 
                key={idx}
                m={m}
                index={idx}
                handleAIRecitation={handleAIRecitation}
                stopRecitation={stopRecitation}
                isGeneratingAudio={isGeneratingAudio}
                sendMessage={sendMessage}
                copyToClipboard={copyToClipboard}
                shareMessage={shareMessage}
                copyFeedback={copyFeedback}
                audioUrl={audioUrls[idx]}
                downloadAudioFile={downloadAudioFile}
                selectedVoice={selectedVoice}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                selectedModel={selectedModel}
                providerName={providerName}
                autoOpenThoughts={autoOpenThoughts}
              />
            ))}
          </AnimatePresence>
          
          {/* Dynamic AI-Powered suggestions */}
          {!isLoading && suggestions && suggestions.length > 0 && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-start gap-2.5 max-w-xl self-start pt-1"
              dir="rtl"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 mr-4">
                {suggestionsLoading ? (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full"
                    />
                    <span>جاري استلهام مسارات التدبر...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="text-amber-500 animate-pulse" />
                    <span>مسارات مقترحة لمواصلة التدبر (بفيض مِداد الرحمن):</span>
                  </>
                )}
              </div>
              
              <div className="flex flex-col gap-2 w-full pr-2">
                {suggestions.map((suggestion, sIdx) => (
                  <motion.button
                    key={sIdx}
                    onClick={() => sendMessage(suggestion)}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: sIdx * 0.1, duration: 0.3 }}
                    className="w-full text-right px-4 py-2.5 rounded-2xl bg-amber-50/40 hover:bg-amber-100/60 dark:bg-amber-950/10 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-100 text-xs font-medium border border-amber-200/40 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-800 transition-all duration-300 shadow-sm hover:shadow flex items-center justify-between group"
                  >
                    <span className="leading-relaxed">{suggestion}</span>
                    <Compass size={14} className="text-amber-500/50 group-hover:text-amber-600 group-hover:rotate-45 transition-all duration-300 shrink-0 ml-2" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start"
            >
              <div className="bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md p-5 rounded-3xl rounded-tl-none border border-amber-100 dark:border-amber-900/50 shadow-sm">
                <div className="flex gap-2">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-2 h-2 bg-amber-400 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-2 h-2 bg-amber-500 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-2 h-2 bg-amber-600 rounded-full" 
                  />
                </div>
                <p className="mt-3 text-xs text-amber-800/60 dark:text-amber-200/60 font-sans" dir="rtl">جاري استحضار المدد...</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      {showScrollButton && (
        <motion.button
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold transition-all border border-amber-400/30"
        >
          <span>الأسفل</span>
          <ArrowDown size={14} className="animate-bounce" />
        </motion.button>
      )}
    </div>
  );
};
