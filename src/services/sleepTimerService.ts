export interface SleepTimerState {
  isActive: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  formattedTime: string;
  progress: number; // 0 to 100 percentage remaining
}

type Listener = (state: SleepTimerState) => void;

class SleepTimerService {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private totalSeconds = 0;
  private remainingSeconds = 0;
  private isActive = false;
  private listeners: Set<Listener> = new Set();
  private originalVolumes: Map<HTMLAudioElement, number> = new Map();

  constructor() {
    // Listen to visibility changes or unload to keep state clean if needed
  }

  public getState(): SleepTimerState {
    return {
      isActive: this.isActive,
      totalSeconds: this.totalSeconds,
      remainingSeconds: this.remainingSeconds,
      formattedTime: this.formatTime(this.remainingSeconds),
      progress: this.totalSeconds > 0 ? (this.remainingSeconds / this.totalSeconds) * 100 : 0
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  public startTimer(minutes: number) {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.totalSeconds = Math.max(1, Math.round(minutes * 60));
    this.remainingSeconds = this.totalSeconds;
    this.isActive = true;
    this.restoreAudioVolumes();
    this.notify();

    this.timerId = setInterval(() => {
      if (this.remainingSeconds <= 1) {
        this.expireTimer();
      } else {
        this.remainingSeconds -= 1;
        // Natural gradual volume fade during the last 15 seconds
        if (this.remainingSeconds <= 15) {
          const fadeRatio = Math.max(0, this.remainingSeconds / 15);
          this.applyAudioFade(fadeRatio);
        }
        this.notify();
      }
    }, 1000);
  }

  public addMinutes(minutes: number) {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    if (!this.isActive) {
      this.startTimer(minutes);
      return;
    }
    const addSec = Math.round(minutes * 60);
    this.totalSeconds += addSec;
    this.remainingSeconds += addSec;
    this.restoreAudioVolumes();
    this.notify();
  }

  public cancelTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isActive = false;
    this.remainingSeconds = 0;
    this.totalSeconds = 0;
    this.restoreAudioVolumes();
    this.notify();
  }

  private expireTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isActive = false;
    this.remainingSeconds = 0;

    // Pause all audio elements on page
    try {
      const audios = document.querySelectorAll('audio');
      audios.forEach(audio => {
        try {
          audio.pause();
        } catch {}
      });
    } catch {}

    // Dispatch global event for React components to update playback states
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sleep_timer_triggered', {
        detail: { timestamp: Date.now() }
      }));
    }

    this.restoreAudioVolumes();
    this.notify();
  }

  private applyAudioFade(ratio: number) {
    try {
      const audios = document.querySelectorAll('audio');
      audios.forEach(audio => {
        if (!this.originalVolumes.has(audio)) {
          this.originalVolumes.set(audio, audio.volume ?? 1);
        }
        const orig = this.originalVolumes.get(audio) ?? 1;
        audio.volume = Math.max(0, Math.min(1, orig * ratio));
      });
    } catch {}
  }

  private restoreAudioVolumes() {
    try {
      this.originalVolumes.forEach((orig, audio) => {
        try {
          audio.volume = orig;
        } catch {}
      });
      this.originalVolumes.clear();
    } catch {}
  }

  private formatTime(totalSec: number): string {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const mStr = mins < 10 ? `0${mins}` : `${mins}`;
    const sStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mStr}:${sStr}`;
  }
}

export const sleepTimerService = new SleepTimerService();
