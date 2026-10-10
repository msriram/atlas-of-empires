'use client';
import {useEffect, useState, type RefObject} from 'react';
import {decodePlan, type AtlasManifest, type AtlasInterval, type AtlasPlan} from './atlas';
import {AtlasLoader, cancelledLoad, type LoadJob} from './atlas-loader';
import type {PlaybackClock} from './use-playback';
import {assetPath} from '../asset-path';

function startWorker(interval: AtlasInterval): LoadJob {
  const worker = new Worker(assetPath('/atlas-loader.worker.js?v=1'), {type: 'module'});
  let rejectJob: (error: Error) => void;
  const promise = new Promise<AtlasPlan>((resolve, reject) => {
    rejectJob = reject;
    worker.onmessage = ({data}: MessageEvent<{buffer?: ArrayBuffer; error?: string}>) => {
      if (data.error) {worker.terminate(); reject(new Error(data.error));}
      else if (data.buffer) {
        try {resolve(decodePlan(data.buffer, interval));} catch (error) {reject(error);}
        // The worker closes after persisting compressed data. Until then,
        // the next load or unmount can still terminate it.
      }
    };
    worker.onerror = event => {event.preventDefault(); worker.terminate(); reject(new Error(event.message || 'Boundary worker failed'));};
    worker.postMessage(interval);
  });
  return {promise, cancel: () => {worker.terminate(); rejectJob(cancelledLoad());}};
}

type AtlasData = {manifest: AtlasManifest; interval: AtlasInterval; plan: AtlasPlan};
export function useAtlas(year: number, clock: RefObject<PlaybackClock>) {
  const [manifest, setManifest] = useState<AtlasManifest | null>(null);
  const [data, setData] = useState<AtlasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loader, setLoader] = useState<AtlasLoader | null>(null);
  const [revision, setRevision] = useState(0);
  const [stats, setStats] = useState({active: 0, cached: 0, started: 0, cancelled: 0, bytes: 0});
  useEffect(() => {
    let worker: LoadJob | undefined, alive = true;
    const instance = new AtlasLoader(interval => {
      worker?.cancel();
      worker = startWorker(interval);
      return worker;
    }, () => {if (alive) queueMicrotask(() => {if (alive) setStats(instance.snapshot());});});
    queueMicrotask(() => {if (alive) setLoader(instance);});
    return () => {alive = false; instance.dispose(); worker?.cancel();};
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(assetPath('/atlas/manifest.json'), {cache: 'no-cache', signal: controller.signal}).then(r => {
      if (!r.ok) throw new Error('Unable to load historical data'); return r.json() as Promise<AtlasManifest>;
    }).then(setManifest).catch(e => {if (!controller.signal.aborted) setError(String(e));});
    return () => controller.abort();
  }, [revision]);
  const index = manifest ? Math.max(0, manifest.intervals.findLastIndex(i => i.start <= year)) : -1;
  const interval = manifest?.intervals[index];
  // The dependency is the interval, not every integer year or React render.
  useEffect(() => {
    if (!manifest || !interval || !loader) return;
    let active = true;
    loader.cancelObsolete(interval.file);
    const timer = setTimeout(() => {
      const pending = loader.get(interval);
      void pending.then(plan => {
        if (!active) return;
        setData({manifest, interval, plan}); setError(null);
        clock.current.floor = interval.start; clock.current.ceiling = interval.end;
      }).catch(e => {
        if (!active || e?.name === 'AbortError') return;
        if (!revision) setRevision(1); else setError(e instanceof Error ? e.message : 'Unable to load boundaries');
      });
    }, clock.current.running ? 0 : 80);
    return () => {active = false; clearTimeout(timer);};
  }, [manifest, interval, loader, clock, revision]);
  useEffect(() => {
    // Manual back-and-forth keeps the previous interval in cache. Speculation
    // is only useful during forward playback, never during slider scrubbing.
    if (clock.current.running && data?.interval === interval && manifest && loader) {
      const next = manifest.intervals[index + 1];
      if (next) loader.prefetch(next);
    }
  }, [year, data, interval, manifest, index, loader, clock]);
  return {data, error, stats};
}
