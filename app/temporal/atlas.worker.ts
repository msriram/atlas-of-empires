/// <reference lib="webworker" />
import {MAGIC, decodePlan, type AtlasInterval} from './atlas';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const CACHE = 'atlas-geography-v2';
// The owner terminates this worker when a seek supersedes it: fetch, inflate,
// pending buffers, and cache writes stop together, outside the UI thread.
scope.onmessage = async ({data: interval}: MessageEvent<AtlasInterval>) => {
  try {
    const url = `/atlas/${interval.file}`;
    let disk: Cache | undefined;
    try {disk = await caches.open(CACHE);} catch {/* Storage is optional. */}
    let response = await disk?.match(url);
    const cached = Boolean(response);
    let compressed: ArrayBuffer;
    if (response) compressed = await response.arrayBuffer();
    else {
      response = await fetch(url);
      if (!response.ok) throw new Error('Unable to load this historical interval');
      compressed = await response.arrayBuffer();
    }
    const buffer = new DataView(compressed).getUint32(0, true) === MAGIC ? compressed :
      await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    decodePlan(buffer, interval); // Validate before transferring or persisting.
    scope.postMessage({buffer}, [buffer]); // Transfer ownership; never copy 32 MB.
    if (disk && !cached && compressed.byteLength) {
      // Cache only compressed bytes; never serialize another decoded atlas.
      await disk.put(url, new Response(compressed));
      const keys = await disk.keys();
      for (const key of keys.slice(0, -6)) await disk.delete(key);
    }
  } catch (error) {scope.postMessage({error: error instanceof Error ? error.message : 'Unable to load boundaries'});}
  finally {scope.close();}
};
