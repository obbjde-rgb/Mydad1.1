import { useState, useEffect, useCallback } from 'react';
import { sleepTimerService, SleepTimerState } from '../services/sleepTimerService';

export const useSleepTimer = () => {
  const [timerState, setTimerState] = useState<SleepTimerState>(() => sleepTimerService.getState());

  useEffect(() => {
    const unsubscribe = sleepTimerService.subscribe((newState) => {
      setTimerState(newState);
    });
    return () => unsubscribe();
  }, []);

  const startTimer = useCallback((minutes: number) => {
    sleepTimerService.startTimer(minutes);
  }, []);

  const addMinutes = useCallback((minutes: number) => {
    sleepTimerService.addMinutes(minutes);
  }, []);

  const cancelTimer = useCallback(() => {
    sleepTimerService.cancelTimer();
  }, []);

  return {
    ...timerState,
    startTimer,
    addMinutes,
    cancelTimer
  };
};
