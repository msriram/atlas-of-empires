import type {AtlasInterval, AtlasPlan} from './atlas';

export type LoadJob = {promise: Promise<AtlasPlan>; cancel: () => void};
type Pending = {key: string; job: LoadJob; promise: Promise<AtlasPlan>};
export const cancelledLoad = () => new DOMException('Superseded atlas request', 'AbortError');

/** Exactly one decode can run. Pending work is never evicted while still alive.
 * The selected and previous completed intervals survive direction reversals. */
export class AtlasLoader {
  private cache = new Map<string, AtlasPlan>();
  private pending?: Pending;
  private selected = '';
  private disposed = false;
  private started = 0;
  private cancelled = 0;
  constructor(private start: (interval: AtlasInterval) => LoadJob, private changed: () => void = () => {}) {}

  private stop() {
    if (!this.pending) return;
    const pending = this.pending; this.pending = undefined;
    this.cancelled++;
    pending.job.cancel();
    this.changed();
  }
  private run(interval: AtlasInterval) {
    let job: LoadJob;
    try {job = this.start(interval);} catch (error) {return Promise.reject<AtlasPlan>(error);}
    const entry: Pending = {key: interval.file, job, promise: job.promise};
    this.started++;
    entry.promise = job.promise.then(plan => {
      if (this.disposed || this.pending !== entry) throw cancelledLoad();
      this.cache.set(interval.file, plan);
      while (this.cache.size > 2) {
        const victim = [...this.cache.keys()].find(key => key !== this.selected && key !== interval.file)!;
        this.cache.delete(victim);
      }
      return plan;
    }).finally(() => {if (this.pending === entry) {this.pending = undefined; this.changed();}});
    this.pending = entry;
    this.changed();
    return entry.promise;
  }
  get(interval: AtlasInterval) {
    if (this.disposed) return Promise.reject<AtlasPlan>(cancelledLoad());
    this.selected = interval.file;
    if (this.pending && this.pending.key !== interval.file) this.stop();
    const cached = this.cache.get(interval.file);
    if (cached) {this.cache.delete(interval.file); this.cache.set(interval.file, cached); return Promise.resolve(cached);}
    return this.pending?.promise ?? this.run(interval);
  }
  prefetch(interval: AtlasInterval) {
    if (this.disposed || this.pending || this.cache.has(interval.file)) return;
    void this.run(interval).catch(() => {});
  }
  /** Called as soon as a seek changes intervals, before its debounce expires. */
  cancelObsolete(file: string) {if (this.pending && this.pending.key !== file) this.stop();}
  snapshot() {
    return {active: this.pending ? 1 : 0, cached: this.cache.size, started: this.started, cancelled: this.cancelled,
      bytes: [...this.cache.values()].reduce((n, p) => n + p.owners.byteLength + p.timing.byteLength, 0)};
  }
  dispose() {this.disposed = true; this.stop(); this.cache.clear();}
}
