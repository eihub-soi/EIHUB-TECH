import { useState, useEffect } from "react";

let globalTime = new Date();
const listeners = new Set<(date: Date) => void>();
let intervalId: any = null;

function updateTime() {
  globalTime = new Date();
  listeners.forEach((listener) => listener(globalTime));
}

/**
 * Custom hook to get the current time, updating once per second.
 * Uses a single global interval to prevent multiple intervals, memory leaks, and CPU overhead.
 */
export function useCurrentTime(): Date {
  const [time, setTime] = useState(globalTime);

  useEffect(() => {
    listeners.add(setTime);
    if (!intervalId) {
      intervalId = setInterval(updateTime, 1000);
    }

    return () => {
      listeners.delete(setTime);
      if (listeners.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, []);

  return time;
}
