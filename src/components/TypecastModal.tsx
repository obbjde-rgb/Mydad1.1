import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Play, Check } from 'lucide-react';

interface TypecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
}

export const TypecastModal: React.FC<TypecastModalProps> = ({ isOpen, onClose, text }) => {
  const [showText, setShowText] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyText = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="typecast-modal" 
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4" 
          dir="rtl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-[#1c1917] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-amber-900/30 bg-white dark:bg-gray-900 z-10">
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={() => setShowText(!showText)}
                  className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  {showText ? 'إخفاء النص' : 'إظهار النص'}
                </button>
              </div>
              
              <a
                href="https://typecast.ai/text-to-speech/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-800 dark:text-gray-100 font-bold hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors sm:text-lg text-base"
              >
                <span>مساحة عمل Typecast.ai</span>
                <ExternalLink size={18} className="text-emerald-600 dark:text-emerald-400" />
              </a>
            </div>

            {/* Text Display */}
            <AnimatePresence>
              {showText && (
                <motion.div
                  key="typecast-text"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-10"
                >
                  <div className="p-3 sm:p-4 flex items-center gap-3">
                    <button 
                      onClick={handleCopyText}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                      {copied ? <Check size={16} /> : <Play size={16} className="fill-current" />}
                      <span>{copied ? 'تم النسخ!' : 'نسخ وتشغيل'}</span>
                    </button>
                    <div className="flex-1 p-2.5 bg-gray-50 dark:bg-[#292524] rounded-xl text-sm text-gray-700 dark:text-gray-300 max-h-24 overflow-y-auto border border-gray-200 dark:border-amber-900/50 font-vazir leading-relaxed">
                      {text}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Iframe */}
            <div className="flex-1 w-full bg-gray-50 dark:bg-gray-950 relative">
              <iframe
                src="https://typecast.ai/text-to-speech/"
                className="absolute inset-0 w-full h-full border-0"
                title="Typecast Workspace"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
