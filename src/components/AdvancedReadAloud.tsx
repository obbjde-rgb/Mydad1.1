import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { generateRecitationStream } from '../services/aiService';
import { safeLocalStorageGet } from '../lib/utils';

interface AdvancedReadAloudProps {
  text: string;
  className?: string;
  buttonClassName?: string;
  voiceName?: string;
}

const base64ToWavUrl = (base64: string): string => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

export const AdvancedReadAloud: React.FC<AdvancedReadAloudProps> = ({ 
  text, 
  className = '', 
  buttonClassName = '', 
  voiceName
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const stopRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);

  const cleanupPlayback = useCallback(() => {
    stopRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    while (audioQueueRef.current.length > 0) {
      const url = audioQueueRef.current.shift();
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    const handleGlobalStop = () => {
      cleanupPlayback();
      setIsSpeaking(false);
      setIsLoading(false);
    };
    window.addEventListener('stop_all_audio', handleGlobalStop);
    return () => {
      window.removeEventListener('stop_all_audio', handleGlobalStop);
      cleanupPlayback();
    };
  }, [cleanupPlayback]);

  const handleReadAloud = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isSpeaking) {
      cleanupPlayback();
      setIsSpeaking(false);
      return;
    }

    stopRef.current = false;
    setIsLoading(true);
    const activeVoice = voiceName || safeLocalStorageGet('ai_recitation_voice') || 'Kore';

    try {
      const stream = generateRecitationStream(text, activeVoice);
      const audioQueue = audioQueueRef.current;
      let isPlaying = false;
      let isFinishedGenerating = false;

      const playNext = () => {
        if (stopRef.current) {
          while (audioQueue.length > 0) {
            const u = audioQueue.shift();
            if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
          }
          isPlaying = false;
          setIsSpeaking(false);
          return;
        }
        
        if (audioQueue.length > 0) {
          isPlaying = true;
          const url = audioQueue.shift()!;
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          
          let nextCalled = false;
          const callNext = () => {
            if (!nextCalled) {
              nextCalled = true;
              if (currentAudioRef.current === audio) {
                currentAudioRef.current = null;
              }
              if (url.startsWith('blob:')) URL.revokeObjectURL(url);
              playNext();
            }
          };

          audio.onended = callNext;
          audio.onerror = callNext;

          audio.play().catch(err => {
            if (err.name !== 'AbortError') console.error("Audio play error", err);
            callNext();
          });
        } else {
          isPlaying = false;
          if (isFinishedGenerating) {
            setIsSpeaking(false);
          }
        }
      };

      setIsSpeaking(true);
      
      for await (const chunk of stream) {
        if (stopRef.current) {
          while (audioQueue.length > 0) {
            const u = audioQueue.shift();
            if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
          }
          break;
        }
        
        const audioUrl = base64ToWavUrl(chunk.data);
        audioQueue.push(audioUrl);
        
        if (!isPlaying) {
          playNext();
        }
      }
      
      isFinishedGenerating = true;
      if (!isPlaying) {
        setIsSpeaking(false);
      }
      
    } catch (error) {
      const isHardQuota = error === "HARD_QUOTA_LIMIT" || (error instanceof Error && error.message === "HARD_QUOTA_LIMIT");
      if (!isHardQuota) {
        console.error("Advanced TTS failed:", error);
      } else {
        console.warn("Advanced TTS quota limit reached. Falling back to browser TTS.");
      }
      
      if ('speechSynthesis' in window && !stopRef.current) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.9;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <button
        onClick={handleReadAloud}
        className={buttonClassName || `p-3 rounded-2xl transition-all shadow-md hover:scale-110 ${isSpeaking ? 'bg-amber-500 text-white animate-pulse' : 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'}`}
        aria-label={isSpeaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
        title={isSpeaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </span>
  );
};
