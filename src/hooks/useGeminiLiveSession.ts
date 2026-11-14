import { useState, useRef, useEffect, useCallback } from 'react';
import { safeLocalStorageGet } from '../lib/utils';
import { AI_PROVIDERS } from '../services/aiService';
import {
  LiveAppSnapshot,
  LiveTranscriptMessage,
  LiveVoiceSettings,
  addLearnedMemoryNote,
  buildLiveSystemContext,
  loadLiveTranscriptHistory,
  loadLiveVoiceSettings,
  saveLiveTranscriptHistory,
} from '../services/liveMemoryService';

export type LiveConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function floatTo16BitPCMBase64(input: Float32Array, sourceRate: number, targetRate = 16000): string {
  let samples = input;
  if (sourceRate && sourceRate !== targetRate && sourceRate > targetRate) {
    const ratio = sourceRate / targetRate;
    const outLength = Math.floor(input.length / ratio);
    const resampled = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const idx = i * ratio;
      const idxFloor = Math.floor(idx);
      const frac = idx - idxFloor;
      const s0 = input[idxFloor] ?? 0;
      const s1 = input[Math.min(idxFloor + 1, input.length - 1)] ?? s0;
      resampled[i] = s0 + (s1 - s0) * frac;
    }
    samples = resampled;
  }

  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64PCM24kToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function splitSpeechTextIntoChunks(text: string, maxLength = 480): string[] {
  const cleanText = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_~`#>]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (!cleanText) return [];

  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = cleanText.split(/(?<=[.!؟?\n؛:])\s+/);

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if ((currentChunk ? `${currentChunk} ${sentence}` : sentence).length <= maxLength) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }

    if (sentence.length <= maxLength) {
      currentChunk = sentence;
      continue;
    }

    // Split overly long sentence on commas first, then words
    const subParts = sentence.split(/(?<=[،,])\s+|\s+/);
    let temp = '';
    for (const part of subParts) {
      if (!part) continue;
      if ((temp ? `${temp} ${part}` : part).length <= maxLength) {
        temp = temp ? `${temp} ${part}` : part;
      } else {
        if (temp) chunks.push(temp);
        temp = part;
      }
    }
    if (temp) currentChunk = temp;
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

function base64SpeechToWavBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const hasWavHeader =
    len >= 44 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46;   // F
  if (hasWavHeader) return bytes;

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + len, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 24000 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, len, true);
  const combined = new Uint8Array(44 + len);
  combined.set(new Uint8Array(wavHeader), 0);
  combined.set(bytes, 44);
  return combined;
}

export function useGeminiLiveSession(
  snapshot: LiveAppSnapshot,
  onAction?: (action: string, data?: any) => void
) {
  const [status, setStatus] = useState<LiveConnectionStatus>('disconnected');
  const [activeModel, setActiveModel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [interimUserText, setInterimUserText] = useState('');
  const [messages, setMessages] = useState<LiveTranscriptMessage[]>(() => loadLiveTranscriptHistory());
  const [settings, setSettings] = useState<LiveVoiceSettings>(() => loadLiveVoiceSettings());

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseSessionIdRef = useRef<string>('');
  const transportModeRef = useRef<'none' | 'ws' | 'sse'>('none');
  const connectionSeqRef = useRef<number>(0);

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const resumptionHandleRef = useRef<string>('');
  const resumptionModelRef = useRef<string>('');
  const isMicActiveRef = useRef<boolean>(false);
  const statusRef = useRef<LiveConnectionStatus>('disconnected');
  const settingsRef = useRef<LiveVoiceSettings>(settings);
  const snapshotRef = useRef<LiveAppSnapshot>(snapshot);
  const onActionRef = useRef(onAction);

  // Track current streaming bubble IDs & robotics text-to-speech fallback
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const currentUserVoiceMsgIdRef = useRef<string | null>(null);
  const pendingTextQueueRef = useRef<string[]>([]);
  const ttsPlaybackSeqRef = useRef<number>(0);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const isTextOnlyModelRef = useRef<boolean>(false);
  const turnHasNativeAudioRef = useRef<boolean>(false);
  const turnSpokenBufferRef = useRef<string>('');

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  // Listen for settings changes from SettingsPanel or other tabs
  useEffect(() => {
    const onSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as LiveVoiceSettings | undefined;
      setSettings(detail || loadLiveVoiceSettings());
    };
    window.addEventListener('live_settings_updated', onSettingsUpdated);
    return () => window.removeEventListener('live_settings_updated', onSettingsUpdated);
  }, []);

  // Persist messages whenever updated
  useEffect(() => {
    saveLiveTranscriptHistory(messages);
  }, [messages]);

  const sendBridgePayload = useCallback((payload: Record<string, any>) => {
    if (transportModeRef.current === 'ws') {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        return true;
      }
      return false;
    }
    if (transportModeRef.current === 'sse' && sseSessionIdRef.current) {
      const sid = sseSessionIdRef.current;
      void fetch(`/api/live/input/${encodeURIComponent(sid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
      return true;
    }
    return false;
  }, []);

  const ensureOutputAudioContext = useCallback(async () => {
    if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      outputAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const clearAudioQueue = useCallback(() => {
    ttsPlaybackSeqRef.current += 1;
    if (ttsAbortRef.current) {
      try {
        ttsAbortRef.current.abort();
      } catch {
        // ignore
      }
      ttsAbortRef.current = null;
    }
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current = [];
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = '';
      } catch {
        // ignore
      }
      ttsAudioRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsModelSpeaking(false);
  }, []);

  const speakCompletedTextWithTTS = useCallback(async (textToSpeak: string, connSeq: number) => {
    const chunks = splitSpeechTextIntoChunks(textToSpeak, 480);
    if (chunks.length === 0 || connectionSeqRef.current !== connSeq || !settingsRef.current.enableAudioOutput) {
      return;
    }

    const myTtsSeq = ++ttsPlaybackSeqRef.current;
    if (ttsAbortRef.current) {
      try {
        ttsAbortRef.current.abort();
      } catch {
        // ignore
      }
    }
    const abortCtrl = new AbortController();
    ttsAbortRef.current = abortCtrl;

    const isCancelled = () =>
      abortCtrl.signal.aborted ||
      ttsPlaybackSeqRef.current !== myTtsSeq ||
      connectionSeqRef.current !== connSeq ||
      !settingsRef.current.enableAudioOutput;

    const fetchChunkWav = async (chunkText: string): Promise<Uint8Array | null> => {
      const geminiKey = safeLocalStorageGet(AI_PROVIDERS.gemini.keyName) || '';
      const voiceName = settingsRef.current.voiceName || 'Zephyr';

      for (let attempt = 0; attempt < 2; attempt++) {
        if (isCancelled()) return null;
        try {
          const res = await fetch('/api/gemini/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortCtrl.signal,
            body: JSON.stringify({
              apiKey: geminiKey,
              model: 'gemini-3.8-flash-lite-tts',
              text: chunkText,
              voiceName,
            }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data?.audioData) {
            return base64SpeechToWavBytes(data.audioData);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' || isCancelled()) return null;
        }
      }
      return null;
    };

    const playWavBytes = async (wavBytes: Uint8Array): Promise<void> => {
      if (isCancelled()) return;

      // Prefer unlocked Web AudioContext for reliable continuous mobile playback without autoplay drops
      try {
        const ctx = await ensureOutputAudioContext();
        const ab = Uint8Array.from(wavBytes).buffer;
        const decoded = await ctx.decodeAudioData(ab);
        if (isCancelled()) return;

        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);

          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(safetyTimer);
            abortCtrl.signal.removeEventListener('abort', onAbort);
            activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
            resolve();
          };
          const onAbort = () => {
            try {
              source.onended = null;
              source.stop();
              source.disconnect();
            } catch {
              // ignore
            }
            finish();
          };

          const safetyMs = Math.max(4000, Math.ceil(decoded.duration * 1000) + 2500);
          const safetyTimer = window.setTimeout(finish, safetyMs);

          abortCtrl.signal.addEventListener('abort', onAbort, { once: true });
          source.onended = finish;

          activeSourcesRef.current.push(source);
          setIsModelSpeaking(true);
          const now = ctx.currentTime;
          const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
          nextStartTimeRef.current = startAt + decoded.duration;
          source.start(startAt);
        });
        return;
      } catch {
        // Fallback to ObjectURL Audio element
      }

      if (isCancelled()) return;
      const blob = new Blob([wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength) as ArrayBuffer], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(blobUrl);
        ttsAudioRef.current = audio;
        setIsModelSpeaking(true);
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          abortCtrl.signal.removeEventListener('abort', onAbort);
          audio.onended = null;
          audio.onerror = null;
          if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        const onAbort = () => {
          try {
            audio.pause();
            audio.src = '';
          } catch {
            // ignore
          }
          finish();
        };
        abortCtrl.signal.addEventListener('abort', onAbort, { once: true });
        audio.onended = finish;
        audio.onerror = finish;
        void audio.play().catch(finish);
      });
    };

    try {
      setIsModelSpeaking(true);
      let nextChunkPromise: Promise<Uint8Array | null> | null = fetchChunkWav(chunks[0]);

      for (let i = 0; i < chunks.length; i++) {
        if (isCancelled() || !nextChunkPromise) break;
        const wavBytes = await nextChunkPromise;
        if (isCancelled()) break;

        // Prefetch the next chunk while current chunk is playing so transitions are seamless
        nextChunkPromise = i + 1 < chunks.length ? fetchChunkWav(chunks[i + 1]) : null;

        if (wavBytes && wavBytes.length > 44) {
          await playWavBytes(wavBytes);
        }
      }
    } finally {
      if (ttsAbortRef.current === abortCtrl) {
        ttsAbortRef.current = null;
      }
      if (ttsPlaybackSeqRef.current === myTtsSeq && activeSourcesRef.current.length === 0) {
        setIsModelSpeaking(false);
      }
    }
  }, [ensureOutputAudioContext]);

  const schedulePCMPlayback = useCallback((base64Data: string) => {
    if (!base64Data) return;
    if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      outputAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const pcmFloat = base64PCM24kToFloat32(base64Data);
    if (pcmFloat.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, pcmFloat.length, 24000);
    audioBuffer.copyToChannel(pcmFloat, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }
    const startAt = nextStartTimeRef.current;
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    setIsModelSpeaking(true);
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setIsModelSpeaking(false);
      }
    };
    source.start(startAt);
  }, []);

  const stopMicrophone = useCallback(() => {
    isMicActiveRef.current = false;
    setIsMicActive(false);
    setInterimUserText('');
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      void inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
  }, []);

  const startMicrophone = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('المتصفح لا يدعم التقاط الميكروفون.');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isMicActiveRef.current) return;
        const channel = event.inputBuffer.getChannelData(0);
        const base64Pcm = floatTo16BitPCMBase64(channel, inputCtx.sampleRate, 16000);
        sendBridgePayload({ type: 'audio', data: base64Pcm, mimeType: 'audio/pcm;rate=16000' });
      };

      // Route through muted gain node to prevent feedback loop while keeping onaudioprocess active
      const muteGain = inputCtx.createGain();
      muteGain.gain.value = 0;
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(inputCtx.destination);

      isMicActiveRef.current = true;
      setIsMicActive(true);
      return true;
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر الوصول إلى الميكروفون. يرجى منح الإذن.');
      stopMicrophone();
      return false;
    }
  }, [sendBridgePayload, stopMicrophone]);

  const executeLiveToolCall = useCallback(
    (call: { id?: string; name: string; args?: Record<string, any> }) => {
      const dispatch = (action: string, data?: any) => {
        if (onActionRef.current) {
          onActionRef.current(action, data);
        } else {
          window.dispatchEvent(new CustomEvent('live_app_action', { detail: { action, data } }));
        }
      };

      const args = call.args || {};
      let humanLabel = '';
      let resultPayload: Record<string, any> = { ok: true };

      switch (call.name) {
        case 'open_surah': {
          const query = String(args.surahQuery || '');
          dispatch('BROWSE_SURAH', query);
          humanLabel = `فتح سورة ${query}`;
          resultPayload = { ok: true, opened: query };
          break;
        }
        case 'play_recitation': {
          const s = Number(args.surahNumber || 1);
          const a = Number(args.ayahNumber || 1);
          dispatch('PLAY', `${s}:${a}`);
          humanLabel = `تشغيل التلاوة (سورة ${s}، آية ${a})`;
          resultPayload = { ok: true, playing: `${s}:${a}` };
          break;
        }
        case 'stop_recitation': {
          dispatch('STOP', 'now');
          humanLabel = 'إيقاف التلاوة الصوتية';
          resultPayload = { ok: true, stopped: true };
          break;
        }
        case 'search_quran': {
          const q = String(args.query || '');
          dispatch('SEARCH', q);
          humanLabel = `البحث في القرآن عن: ${q}`;
          resultPayload = { ok: true, searched: q };
          break;
        }
        case 'open_app_view': {
          const v = String(args.view || 'search');
          dispatch('VIEW', v);
          humanLabel = `الانتقال إلى قسم: ${v}`;
          resultPayload = { ok: true, view: v };
          break;
        }
        case 'generate_image': {
          const prompt = String(args.prompt || '');
          dispatch('GENERATE_IMAGE', prompt);
          humanLabel = `توليد صورة إبداعية بالوصف المطلوب`;
          resultPayload = { ok: true, triggeredImageGeneration: true };
          break;
        }
        case 'change_reader_settings': {
          if (args.reciterId) dispatch('SET_RECITER', String(args.reciterId));
          if (args.qiraat) dispatch('SET_QIRAAT', String(args.qiraat));
          if (args.fontSize) dispatch('SET_FONT_SIZE', Number(args.fontSize));
          if (args.toggleTajweed) dispatch('TOGGLE_TAJWEED', 'toggle');
          humanLabel = 'تحديث إعدادات القراءة والتلاوة';
          resultPayload = { ok: true, updatedSettings: args };
          break;
        }
        case 'save_user_preference': {
          const note = String(args.note || '').trim();
          const category = args.category ? String(args.category) : 'general';
          if (note) {
            const updated = addLearnedMemoryNote(note, category);
            setSettings(updated);
            humanLabel = `حفظ في الذاكرة الدائمة: ${note}`;
            resultPayload = { ok: true, savedNote: note };
          }
          break;
        }
        default: {
          resultPayload = { ok: false, error: `Unknown tool ${call.name}` };
        }
      }

      if (humanLabel) {
        setMessages((prev) => [
          ...prev,
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'system-action',
            text: `⚡ تم التنفيذ التلقائي: ${humanLabel}`,
            timestamp: Date.now(),
            source: 'action',
          },
        ]);
      }

      return {
        id: call.id,
        name: call.name,
        response: resultPayload,
      };
    },
    []
  );

  const cleanupTransport = useCallback(() => {
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      try {
        if (oldWs.readyState === WebSocket.OPEN) {
          oldWs.send(JSON.stringify({ type: 'stop' }));
        }
        oldWs.close();
      } catch {
        // ignore
      }
    }
    if (sseRef.current) {
      const oldSse = sseRef.current;
      const oldSid = sseSessionIdRef.current;
      sseRef.current = null;
      sseSessionIdRef.current = '';
      try {
        oldSse.close();
      } catch {
        // ignore
      }
      if (oldSid) {
        void fetch(`/api/live/input/${encodeURIComponent(oldSid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'stop' }),
        }).catch(() => {});
      }
    }
    transportModeRef.current = 'none';
  }, []);

  const disconnect = useCallback(() => {
    connectionSeqRef.current += 1;
    resumptionHandleRef.current = '';
    resumptionModelRef.current = '';
    stopMicrophone();
    clearAudioQueue();
    currentAssistantMsgIdRef.current = null;
    currentUserVoiceMsgIdRef.current = null;
    turnSpokenBufferRef.current = '';
    turnHasNativeAudioRef.current = false;
    cleanupTransport();
    setStatus('disconnected');
  }, [cleanupTransport, clearAudioQueue, stopMicrophone]);

  const connect = useCallback(
    async (withMic = true) => {
      cleanupTransport();
      stopMicrophone();
      clearAudioQueue();
      currentAssistantMsgIdRef.current = null;
      currentUserVoiceMsgIdRef.current = null;
      turnSpokenBufferRef.current = '';
      turnHasNativeAudioRef.current = false;

      const connSeq = ++connectionSeqRef.current;
      setErrorMsg(null);
      setStatus('connecting');

      const currentSettings = loadLiveVoiceSettings();
      setSettings(currentSettings);
      const selectedModel = currentSettings.model;
      setActiveModel(selectedModel);

      // Unlock AudioContext immediately on user gesture
      try {
        if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          outputAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
          nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
        } else if (outputAudioCtxRef.current.state === 'suspended') {
          await outputAudioCtxRef.current.resume();
        }
      } catch {
        // ignore audio init error until playback
      }

      const buildStartPayload = () => {
        const geminiKey = safeLocalStorageGet(AI_PROVIDERS.gemini.keyName) || '';
        const { systemInstruction, seedTurns } = buildLiveSystemContext(currentSettings, snapshotRef.current);
        const validHandle =
          resumptionModelRef.current === selectedModel && resumptionHandleRef.current
            ? resumptionHandleRef.current
            : undefined;
        if (!validHandle) {
          resumptionHandleRef.current = '';
          resumptionModelRef.current = '';
        }
        return {
          type: 'start',
          config: {
            apiKey: geminiKey,
            model: selectedModel,
            voiceName: currentSettings.voiceName,
            enableAudioOutput: currentSettings.enableAudioOutput,
            enableWebSearch: currentSettings.enableWebSearch,
            thinkingLevel: currentSettings.thinkingLevel,
            enableTools: currentSettings.enableAppControl,
            systemInstruction,
            seedTurns,
            resumptionHandle: validHandle,
          },
        };
      };

      const handleServerMessage = (msg: any) => {
        if (connectionSeqRef.current !== connSeq) return;

        switch (msg.type) {
          case 'connected': {
            setStatus('connected');
            setActiveModel(msg.model || selectedModel);
            isTextOnlyModelRef.current = Boolean(msg.textOnlyModel);
            setErrorMsg(null);
            if (pendingTextQueueRef.current.length > 0) {
              const queued = [...pendingTextQueueRef.current];
              pendingTextQueueRef.current = [];
              for (const qText of queued) {
                sendBridgePayload({ type: 'text', text: qText });
              }
            }
            break;
          }
          case 'resumption_update': {
            if (msg.handle) {
              resumptionHandleRef.current = msg.handle;
              resumptionModelRef.current = msg.model || selectedModel;
            } else {
              resumptionHandleRef.current = '';
              resumptionModelRef.current = '';
            }
            break;
          }
          case 'audio': {
            if (msg.data && settingsRef.current.enableAudioOutput) {
              turnHasNativeAudioRef.current = true;
              schedulePCMPlayback(msg.data);
            }
            break;
          }
          case 'interim_input_transcript': {
            if (typeof msg.text === 'string') {
              setInterimUserText(msg.text);
            }
            break;
          }
          case 'input_transcript': {
            const txt = String(msg.text || '');
            if (!txt) break;
            setInterimUserText('');
            const existingId = currentUserVoiceMsgIdRef.current;
            if (existingId) {
              setMessages((prev) =>
                prev.map((m) => (m.id === existingId ? { ...m, text: m.text + txt } : m))
              );
            } else {
              const newId = `uvoice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              currentUserVoiceMsgIdRef.current = newId;
              setMessages((prev) => [
                ...prev,
                { id: newId, role: 'user', text: txt, timestamp: Date.now(), source: 'mic' },
              ]);
            }
            currentAssistantMsgIdRef.current = null;
            turnSpokenBufferRef.current = '';
            turnHasNativeAudioRef.current = false;
            break;
          }
          case 'output_transcript':
          case 'text': {
            const chunkText = String(msg.text || '');
            if (!chunkText) break;
            currentUserVoiceMsgIdRef.current = null;
            const isThought = Boolean(msg.thought);
            if (!isThought) {
              turnSpokenBufferRef.current += chunkText;
            }

            if (!currentAssistantMsgIdRef.current) {
              const newId = `asst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              currentAssistantMsgIdRef.current = newId;
              setMessages((prev) => [
                ...prev,
                {
                  id: newId,
                  role: 'assistant',
                  text: isThought ? '' : chunkText,
                  thought: isThought ? chunkText : undefined,
                  timestamp: Date.now(),
                  source: 'live',
                },
              ]);
            } else {
              const targetId = currentAssistantMsgIdRef.current;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== targetId) return m;
                  if (isThought) {
                    return { ...m, thought: (m.thought || '') + chunkText };
                  }
                  return { ...m, text: m.text + chunkText };
                })
              );
            }
            break;
          }
          case 'interrupted': {
            clearAudioQueue();
            currentAssistantMsgIdRef.current = null;
            turnSpokenBufferRef.current = '';
            turnHasNativeAudioRef.current = false;
            break;
          }
          case 'turn_complete': {
            const completedText = turnSpokenBufferRef.current;
            const hadAudio = turnHasNativeAudioRef.current;
            currentAssistantMsgIdRef.current = null;
            currentUserVoiceMsgIdRef.current = null;
            turnSpokenBufferRef.current = '';
            turnHasNativeAudioRef.current = false;
            if (!hadAudio && isTextOnlyModelRef.current && completedText && settingsRef.current.enableAudioOutput) {
              void speakCompletedTextWithTTS(completedText, connSeq);
            }
            break;
          }
          case 'interaction_status': {
            if (msg.isIdle) {
              currentAssistantMsgIdRef.current = null;
            }
            break;
          }
          case 'tool_call': {
            if (Array.isArray(msg.calls)) {
              const responses = msg.calls.map((c: any) => executeLiveToolCall(c));
              sendBridgePayload({ type: 'tool_response', responses });
            }
            break;
          }
          case 'error': {
            resumptionHandleRef.current = '';
            resumptionModelRef.current = '';
            setErrorMsg(msg.error || `حدث خطأ مع النموذج ${selectedModel}`);
            setStatus('error');
            stopMicrophone();
            cleanupTransport();
            break;
          }
          case 'closed': {
            stopMicrophone();
            setIsModelSpeaking(false);
            cleanupTransport();
            if (msg.code !== 1000) {
              resumptionHandleRef.current = '';
              resumptionModelRef.current = '';
            }
            setStatus((prev) => (prev === 'error' ? 'error' : 'disconnected'));
            if (msg.reason && msg.code !== 1000 && msg.reason !== 'Stopped by user') {
              setErrorMsg(`انتهت الجلسة (${msg.code}): ${msg.reason}`);
            }
            break;
          }
        }
      };

      const startHttpSseFallback = () => {
        if (connectionSeqRef.current !== connSeq) return;
        cleanupTransport();

        const sid = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        sseSessionIdRef.current = sid;
        transportModeRef.current = 'sse';

        const es = new EventSource(`/api/live/events/${encodeURIComponent(sid)}`);
        sseRef.current = es;
        let started = false;

        es.onmessage = async (event) => {
          if (connectionSeqRef.current !== connSeq || sseRef.current !== es) return;
          let msg: any;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }
          if (msg.type === 'bridge_ready' && !started) {
            started = true;
            sendBridgePayload(buildStartPayload());
            if (withMic) {
              await startMicrophone();
            }
            return;
          }
          handleServerMessage(msg);
        };

        es.onerror = () => {
          if (connectionSeqRef.current !== connSeq || sseRef.current !== es) return;
          if (!started) {
            setErrorMsg('تعذر فتح اتصال البث المباشر مع الخادم. تأكد من استقرار الشبكة أو حاول مجدداً.');
            setStatus('error');
            stopMicrophone();
            cleanupTransport();
          }
        };
      };

      // 1) Attempt low-latency WebSocket first; transparently fall back to HTTPS SSE+POST if proxy blocks WS upgrade
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        startHttpSseFallback();
        return;
      }

      wsRef.current = ws;
      transportModeRef.current = 'ws';
      let didWsOpen = false;
      let switchedToSse = false;

      const wsOpenTimeout = window.setTimeout(() => {
        if (connectionSeqRef.current !== connSeq || didWsOpen || switchedToSse) return;
        switchedToSse = true;
        console.warn('[LiveClient] WebSocket handshake timed out, switching to HTTPS SSE+POST bridge...');
        startHttpSseFallback();
      }, 3500);

      ws.onopen = async () => {
        window.clearTimeout(wsOpenTimeout);
        if (connectionSeqRef.current !== connSeq || wsRef.current !== ws || switchedToSse) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          return;
        }
        didWsOpen = true;
        sendBridgePayload(buildStartPayload());
        if (withMic) {
          await startMicrophone();
        }
      };

      ws.onmessage = (event) => {
        if (connectionSeqRef.current !== connSeq || wsRef.current !== ws) return;
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        handleServerMessage(msg);
      };

      ws.onerror = () => {
        window.clearTimeout(wsOpenTimeout);
        if (connectionSeqRef.current !== connSeq || wsRef.current !== ws) return;
        if (!didWsOpen && !switchedToSse) {
          switchedToSse = true;
          console.warn('[LiveClient] WebSocket upgrade blocked or unavailable, switching seamlessly to HTTPS SSE+POST bridge...');
          startHttpSseFallback();
          return;
        }
        setErrorMsg('انقطع اتصال البث المباشر مع الخادم.');
        setStatus('error');
        stopMicrophone();
      };

      ws.onclose = () => {
        window.clearTimeout(wsOpenTimeout);
        if (connectionSeqRef.current !== connSeq || wsRef.current !== ws) return;
        if (!didWsOpen && !switchedToSse) {
          switchedToSse = true;
          startHttpSseFallback();
          return;
        }
        stopMicrophone();
        setIsModelSpeaking(false);
        setStatus((prev) => (prev === 'error' ? 'error' : 'disconnected'));
      };
    },
    [
      cleanupTransport,
      clearAudioQueue,
      executeLiveToolCall,
      schedulePCMPlayback,
      sendBridgePayload,
      speakCompletedTextWithTTS,
      startMicrophone,
      stopMicrophone,
    ]
  );

  const toggleMic = useCallback(async () => {
    if (statusRef.current !== 'connected') {
      await connect(true);
      return;
    }
    if (isMicActiveRef.current) {
      stopMicrophone();
    } else {
      await startMicrophone();
    }
  }, [connect, startMicrophone, stopMicrophone]);

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      // Unlock AudioContext on user tap & clear previous speech when submitting typed message
      void ensureOutputAudioContext().catch(() => {});
      clearAudioQueue();
      currentAssistantMsgIdRef.current = null;
      currentUserVoiceMsgIdRef.current = null;
      turnSpokenBufferRef.current = '';
      turnHasNativeAudioRef.current = false;

      setMessages((prev) => [
        ...prev,
        {
          id: `utext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          text: clean,
          timestamp: Date.now(),
          source: 'text',
        },
      ]);

      if (statusRef.current === 'connected' && sendBridgePayload({ type: 'text', text: clean })) {
        return;
      }

      pendingTextQueueRef.current.push(clean);
      if (statusRef.current !== 'connecting') {
        await connect(false);
      }
    },
    [clearAudioQueue, connect, ensureOutputAudioContext, sendBridgePayload]
  );

  // Dynamically inject app activity/context updates whenever user reads/searches in app during active Live session
  useEffect(() => {
    if (status !== 'connected') return;
    if (!snapshot.currentContext?.surah && !snapshot.lastSearchedText) return;
    const summary = [
      snapshot.currentContext?.surah
        ? `المستخدم يتصفح الآن سورة ${snapshot.currentContext.surah} آية ${snapshot.currentContext.ayah || 1}`
        : '',
      snapshot.lastSearchedText ? `آخر بحث: ${snapshot.lastSearchedText}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    if (summary) {
      sendBridgePayload({ type: 'context_update', text: summary });
    }
  }, [status, snapshot.currentContext?.surah, snapshot.currentContext?.ayah, snapshot.lastSearchedText, sendBridgePayload]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
        void outputAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, [disconnect]);

  return {
    status,
    activeModel,
    errorMsg,
    isMicActive,
    isModelSpeaking,
    interimUserText,
    messages,
    setMessages,
    settings,
    setSettings,
    connect,
    disconnect,
    toggleMic,
    sendText,
    clearAudioQueue,
  };
}
