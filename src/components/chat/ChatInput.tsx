import React, { useState, useRef, useImperativeHandle } from 'react';
import { Send, RefreshCw, MicOff, Mic, Square } from 'lucide-react';

export interface ChatInputRef {
  append: (text: string) => void;
  clear: () => void;
  get: () => string;
  set: (text: string) => void;
}

export const ChatInput = React.memo(React.forwardRef<ChatInputRef, { 
  onSendMessage: (text: string) => void, 
  isLoading: boolean, 
  isListening: boolean, 
  isProcessingAudio: boolean,
  toggleListening: () => void,
  onStop?: () => void
}>(({ 
  onSendMessage, 
  isLoading, 
  isListening, 
  isProcessingAudio,
  toggleListening,
  onStop
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localInput, setLocalInput] = useState('');

  useImperativeHandle(ref, () => ({
    append: (text: string) => {
      setLocalInput(prev => prev + (prev ? ' ' : '') + text);
    },
    clear: () => {
      setLocalInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    get: () => localInput,
    set: (text: string) => {
      setLocalInput(text);
    }
  }));

  const handleSend = () => {
    if (localInput.trim() && !isLoading && !isProcessingAudio) {
      onSendMessage(localInput);
      setLocalInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="w-full flex gap-1.5 sm:gap-3 items-end bg-white/50 dark:bg-[#1c1917]/50 backdrop-blur-md p-1.5 sm:p-2 rounded-3xl border border-amber-200/50 dark:border-amber-800/50 shadow-sm focus-within:shadow-md focus-within:border-amber-300 dark:focus-within:border-amber-700 transition-all duration-300">
      <button 
        onClick={toggleListening}
        disabled={isProcessingAudio || isLoading}
        className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl transition-all duration-300 flex-shrink-0 ${isProcessingAudio ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-500 cursor-wait' : isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 hover:scale-105 disabled:opacity-50'}`}
        title={isProcessingAudio ? 'جاري معالجة الصوت...' : isListening ? 'إيقاف الاستماع' : 'تحدث بالصوت'}
      >
        {isProcessingAudio ? <RefreshCw size={20} className="animate-spin" /> : isListening ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
      
      <div className="flex-1 relative min-w-0">
        <textarea 
          ref={textareaRef}
          value={localInput} 
          onChange={(e) => {
            setLocalInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isProcessingAudio ? 'جاري تحويل الصوت...' : isListening ? 'جاري الاستماع...' : isLoading ? 'جاري استحضار المداد... يمكنك النقر على إيقاف في أي وقت.' : 'اكتب سؤالك أو تدبرك هنا في آيات الذكر الحكيم...'}
          className="w-full py-2.5 px-2 sm:py-3 sm:px-4 bg-transparent border-none outline-none text-amber-950 dark:text-amber-50 transition-all resize-none min-h-[40px] sm:min-h-[48px] max-h-[200px] placeholder:text-amber-900/40 dark:placeholder:text-amber-100/30 leading-relaxed block text-sm sm:text-base"
          dir="rtl"
          rows={1}
          disabled={isProcessingAudio}
        />
      </div>
      
      {isLoading ? (
        <button 
          onClick={onStop} 
          title="إيقاف التوليد فوراً"
          className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white transition-all duration-300 shadow-md shadow-red-900/20 active:scale-95 flex-shrink-0 animate-pulse"
        >
          <Square size={16} className="fill-current" />
        </button>
      ) : (
        <button 
          onClick={handleSend} 
          disabled={!localInput.trim()}
          title="إرسال"
          className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md shadow-amber-900/20 active:scale-95 flex-shrink-0"
        >
          <Send size={18} className="rtl:-scale-x-100" />
        </button>
      )}
    </div>
  );
}));
