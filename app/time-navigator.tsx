'use client';
import {useRef, useState} from 'react';
import {Minus, Plus} from 'lucide-react';
import {historicalEvents} from './data/events';

const MIN = -10000, MAX = 2026, TOTAL = MAX - MIN;
const MIN_SPAN = 10;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const label = (y: number) => y < 0 ? `${Math.abs(y).toLocaleString()} BCE` : y === 0 ? '1 BCE' : `${y.toLocaleString()} CE`;
const boundsAround = (year: number, span: number): [number, number] => {
  const start = Math.round(clamp(year - span / 2, MIN, MAX - span));
  return [start, start + span];
};
type Drag = {kind: 'window' | 'year' | 'start' | 'end'; startX: number; range: [number, number]; year: number; moved: boolean};

/** One control: its location selects the era; its interior scrubs that era. */
export default function TimeNavigator({year, onChange}: {year: number; onChange: (year: number) => void}) {
  const [storedRange, setStoredRange] = useState<[number, number]>([-550, -450]);
  const overview = useRef<HTMLDivElement>(null), detailRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null), pending = useRef<number | null>(null), frame = useRef(0);
  const span = storedRange[1] - storedRange[0];
  // Search, events, and playback always bring the window to the selected year.
  const [start, end] = year < storedRange[0] || year > storedRange[1] ? boundsAround(year, span) : storedRange;
  const position = (start - MIN) / TOTAL * 100;
  const width = span / TOTAL * 100;
  const yearFraction = clamp((year - start) / span, 0, 1);
  const events = historicalEvents.filter(event => event.year >= start && event.year <= end).slice(0, 24);

  const publish = (next: number, immediately = false) => {
    pending.current = Math.round(clamp(next, MIN, MAX));
    if (immediately) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      onChange(pending.current);
      pending.current = null;
    } else if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (pending.current !== null) onChange(pending.current);
        pending.current = null;
      });
    }
  };
  const zoom = (factor: number) => {
    const nextSpan = clamp(Math.round(span * factor), MIN_SPAN, TOTAL);
    setStoredRange(boundsAround(year, nextSpan));
  };
  const overviewYear = (x: number) => {
    const rect = overview.current!.getBoundingClientRect();
    return Math.round(MIN + clamp((x - rect.left) / rect.width, 0, 1) * TOTAL);
  };
  const yearInsideWindow = (x: number, range: [number, number] = [start, end]) => {
    const rect = detailRef.current!.getBoundingClientRect();
    return Math.round(range[0] + clamp((x - rect.left) / rect.width, 0, 1) * (range[1] - range[0]));
  };
  const startDrag = (event: React.PointerEvent<HTMLElement>, kind: Drag['kind']) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    drag.current = {kind, startX: event.clientX, range: [start, end], year, moved: false};
    event.currentTarget.setPointerCapture(event.pointerId);
    if (kind === 'year') publish(yearInsideWindow(event.clientX), true);
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    if (Math.abs(event.clientX - current.startX) > 2) current.moved = true;
    if (!current.moved) return;
    if (current.kind === 'year') {
      publish(yearInsideWindow(event.clientX, current.range));
      return;
    }
    const rect = overview.current!.getBoundingClientRect();
    const delta = Math.round((event.clientX - current.startX) / rect.width * TOTAL);
    if (current.kind === 'start' || current.kind === 'end') {
      const nextStart = current.kind === 'start' ? clamp(current.range[0] + delta, MIN, current.range[1] - MIN_SPAN) : current.range[0];
      const nextEnd = current.kind === 'end' ? clamp(current.range[1] + delta, current.range[0] + MIN_SPAN, MAX) : current.range[1];
      setStoredRange([nextStart, nextEnd]);
      const nextYear = clamp(current.year, nextStart, nextEnd);
      if (nextYear !== year) publish(nextYear, true);
      return;
    }
    const nextStart = Math.round(clamp(current.range[0] + delta, MIN, MAX - span));
    setStoredRange([nextStart, nextStart + span]);
    publish(clamp(current.year + nextStart - current.range[0], nextStart, nextStart + span));
  };
  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (pending.current !== null) publish(pending.current, true);
  };
  const jump = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const selected = overviewYear(event.clientX);
    setStoredRange(boundsAround(selected, span));
    publish(selected, true);
  };
  const step = Math.max(1, Math.round(span / 10));

  return <div className="time-navigator" aria-label="Historical timeline">
    <div className="time-navigator-heading">
      <span>FOCUS · {label(start)} – {label(end)}</span>
      <span>Drag center to move · drag edges to resize</span>
      <div className="time-zoom">
        <button onClick={() => zoom(2)} aria-label="Zoom timeline out" disabled={span >= TOTAL}><Minus size={15}/></button>
        <button onClick={() => zoom(.5)} aria-label="Zoom timeline in" disabled={span <= MIN_SPAN}><Plus size={15}/></button>
      </div>
    </div>
    <div ref={overview} className="time-overview" onClick={jump}>
      <div className="time-focus-selection" style={{left: `${position}%`, width: `${width}%`}} role="slider" tabIndex={0} aria-label="Move focused time window" aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={Math.round((start + end) / 2)} aria-valuetext={`${label(start)} to ${label(end)}`} onPointerDown={event => startDrag(event, 'window')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={event => {if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); const delta = event.key === 'ArrowLeft' ? -step : step; const nextStart = Math.round(clamp(start + delta, MIN, MAX - span)); setStoredRange([nextStart, nextStart + span]); publish(clamp(year + nextStart - start, nextStart, nextStart + span), true);}}}>
        <button type="button" className="time-focus-handle time-focus-handle-start" aria-label="Resize focus window from start" title="Drag to change the start year" onPointerDown={event => startDrag(event, 'start')} onPointerMove={event => {event.stopPropagation(); moveDrag(event);}} onPointerUp={event => {event.stopPropagation(); endDrag(event);}} onPointerCancel={event => {event.stopPropagation(); endDrag(event);}} onKeyDown={event => {const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; if (delta) {event.preventDefault(); event.stopPropagation(); const nextStart = clamp(start + delta, MIN, end - MIN_SPAN); setStoredRange([nextStart, end]); if (year < nextStart) publish(nextStart, true);}}}/>
        <span className="time-focus-grip"/>
        <button type="button" className="time-focus-handle time-focus-handle-end" aria-label="Resize focus window from end" title="Drag to change the end year" onPointerDown={event => startDrag(event, 'end')} onPointerMove={event => {event.stopPropagation(); moveDrag(event);}} onPointerUp={event => {event.stopPropagation(); endDrag(event);}} onPointerCancel={event => {event.stopPropagation(); endDrag(event);}} onKeyDown={event => {const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; if (delta) {event.preventDefault(); event.stopPropagation(); const nextEnd = clamp(end + delta, start + MIN_SPAN, MAX); setStoredRange([start, nextEnd]); if (year > nextEnd) publish(nextEnd, true);}}}/>
      </div>
    </div>
    <div className="time-ticks"><span>10,000 BCE</span><span style={{left: `${5000 / TOTAL * 100}%`}}>5,000 BCE</span><span style={{left: `${10000 / TOTAL * 100}%`}}>1 CE</span><span>Present</span></div>
    <div className="time-detail-caption"><span>{label(start)}</span><span>ZOOMED FOCUS · drag to scrub by year</span><span>{label(end)}</span></div>
    <div ref={detailRef} className="time-window-detail" role="slider" tabIndex={0} aria-label="Selected historical year" aria-valuemin={start} aria-valuemax={end} aria-valuenow={year} aria-valuetext={label(year)} onPointerDown={event => startDrag(event, 'year')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={event => {const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'PageDown' ? -10 : event.key === 'PageUp' ? 10 : 0; if (delta) {event.preventDefault(); publish(clamp(year + delta, start, end), true);}}}>
      {Array.from({length: 11}, (_, index) => <span key={index} className="time-window-tick" style={{left: `${index * 10}%`}}/>)}
      {events.map(event => <button key={event.id} className="time-window-event" style={{left: `${(event.year - start) / span * 100}%`}} title={`${label(event.year)} · ${event.title}`} aria-label={`${label(event.year)}: ${event.title}`} onPointerDown={event => event.stopPropagation()} onClick={click => {click.stopPropagation(); publish(event.year, true);}}/>)}
      <span className="time-window-cursor" style={{left: `${yearFraction * 100}%`}}/>
    </div>
  </div>;
}
