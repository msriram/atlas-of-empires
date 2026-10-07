'use client';
import {useEffect, useState, type RefObject} from 'react';
import {MAGIC, decodePlan, type AtlasManifest, type AtlasInterval, type AtlasPlan} from './atlas';
import type {PlaybackClock} from './use-playback';

let manifestPromise: Promise<AtlasManifest> | undefined;
const plans = new Map<string, Promise<AtlasPlan>>();
const CACHE = 'atlas-geography-v2';
function manifest() {
  if (!manifestPromise) manifestPromise = fetch('/atlas/manifest.json', {cache: 'no-cache'}).then(r => {
    if (!r.ok) throw new Error('Unable to load historical data'); return r.json() as Promise<AtlasManifest>;
  }).catch(error => {manifestPromise = undefined; throw error;});
  return manifestPromise;
}
async function load(interval: AtlasInterval) {
  const cached = plans.get(interval.file);
  if (cached) {plans.delete(interval.file); plans.set(interval.file, cached); return cached;}
  const promise = (async () => {
    const url = `/atlas/${interval.file}`;
    // Content-addressed chunks are safe across deployments. Persist compressed
    // data only; the decompressed memory cache holds at most two intervals.
    let disk: Cache | undefined;
    try {disk = await caches.open(CACHE);} catch {/* Private browsing still works. */}
    let response = await disk?.match(url);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) throw new Error('Unable to load this historical interval');
      if (disk) {
        const copy = response.clone();
        void disk.put(url, copy).then(async () => {const keys = await disk!.keys(); for (const key of keys.slice(0, -6)) await disk!.delete(key);}).catch(() => {});
      }
    }
    const bytes = await response.arrayBuffer();
    // Some hosts apply Content-Encoding themselves; accept either representation.
    const buffer = new DataView(bytes).getUint32(0, true) === MAGIC ? bytes : await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return decodePlan(buffer, interval);
  })();
  plans.set(interval.file, promise);
  while (plans.size > 2) plans.delete(plans.keys().next().value!);
  promise.catch(() => plans.delete(interval.file));
  return promise;
}
export function useAtlas(year: number, clock: RefObject<PlaybackClock>) {
  const [data, setData] = useState<{manifest: AtlasManifest; interval: AtlasInterval; plan: AtlasPlan} | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const resolve = async (retry: boolean): Promise<void> => {
      try {
      const m = await manifest();
      const index = Math.max(0, m.intervals.findLastIndex(i => i.start <= year));
      const interval = m.intervals[index];
      const plan = await load(interval);
      if (!active) return;
      setError(null);
      setData(previous => previous?.plan === plan ? previous : {manifest: m, interval, plan});
      clock.current.floor = interval.start; clock.current.ceiling = interval.end;
      const next = m.intervals[index + 1];
      if (next) void load(next).catch(() => {});
      } catch (e) {
        // A tab may outlive a deployment. Refresh the manifest once if an old
        // content-addressed chunk is no longer on the host.
        if (active && retry) {manifestPromise = undefined; await resolve(false);}
        else if (active) setError(e instanceof Error ? e.message : 'Unable to load boundaries');
      }
    };
    // Coalesce rapid manual scrubbing across centuries. Playback handoffs
    // are immediate; dragging must not fetch the whole timeline.
    const timer = setTimeout(() => void resolve(true), clock.current.running || year >= clock.current.floor && year < clock.current.ceiling ? 0 : 60);
    return () => {active = false; clearTimeout(timer);};
  }, [year, clock]);
  return {data, error};
}
