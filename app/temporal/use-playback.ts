'use client';
import {useCallback, useEffect, useRef, useState} from 'react';

export type PlaybackClock = {year: number; floor: number; ceiling: number; running: boolean};
export const speeds = [.25, .5, 1, 2, 4, 8, 16, 32];
export function advanceYear(year: number, milliseconds: number, step: number, speed: number, ceiling: number) {
  // No hidden-tab catch-up burst; unavailable intervals pause the clock in place.
  return Math.max(year, Math.min(2026, ceiling, year + Math.min(100, milliseconds) / 1000 * step * speed));
}
export function usePlayback(initialYear: number) {
  const [year, publishYear] = useState(initialYear);
  const [playing, setPlayingState] = useState(false);
  const [step, setStep] = useState(1);
  const [speed, setSpeed] = useState(1);
  const clock = useRef<PlaybackClock>({year: initialYear, floor: initialYear, ceiling: initialYear, running: false});
  const setPlaying = useCallback((next: boolean) => {
    clock.current.running = next;
    if (!next) publishYear(Math.floor(clock.current.year + 1e-7));
    setPlayingState(next);
  }, []);
  const seek = useCallback((target: number) => {
    const next = Math.round(Math.max(-10000, Math.min(2026, target)));
    if (next < clock.current.floor || next > clock.current.ceiling) {clock.current.floor = next; clock.current.ceiling = next;}
    clock.current.year = next; clock.current.running = false;
    publishYear(next); setPlayingState(false);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = 0, publishedAt = 0;
    const tick = (now: number) => {
      if (document.hidden) {last = 0; frame = requestAnimationFrame(tick); return;}
      if (last) clock.current.year = advanceYear(clock.current.year, now - last, step, speed, clock.current.ceiling);
      last = now;
      // The canvas reads the fractional clock directly. React only needs to
      // refresh labels and interval selection five times per second.
      if (now - publishedAt >= 200 || clock.current.year === clock.current.ceiling) {
        publishYear(Math.floor(clock.current.year + 1e-7)); publishedAt = now;
      }
      if (clock.current.year >= 2026) {clock.current.running = false; setPlayingState(false); return;}
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, step]);
  return {year, setYear: seek, playing, setPlaying, step, setStep, speed, setSpeed, clock};
}
