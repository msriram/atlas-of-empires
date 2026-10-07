import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AtlasLoader, cancelledLoad} from '../app/temporal/atlas-loader.ts';

const interval = n => ({start: n, end: n + 1, file: String(n), bytes: 1, presence: []});
const plan = n => ({start: n, end: n + 1, width: 2, height: 1, owners: new Uint16Array(4), timing: new Uint16Array(4)});
function harness() {
  const jobs = [], calls = [], cancelled = [];
  let active = 0, peak = 0;
  const loader = new AtlasLoader(i => {
    calls.push(i.file); active++; peak = Math.max(peak, active);
    let resolve, reject, finished = false;
    const promise = new Promise((a, b) => {resolve = a; reject = b;});
    const end = () => {if (!finished) {finished = true; active--;}};
    jobs.push({file: i.file, complete: () => {end(); resolve(plan(i.start));}});
    return {promise, cancel: () => {end(); cancelled.push(i.file); reject(cancelledLoad());}};
  });
  return {loader, jobs, calls, cancelled, active: () => active, peak: () => peak};
}

test('500 rapid cross-interval seeks cancel obsolete work; only the latest result is retained', async () => {
  const h = harness(), requests = [];
  for (let n = 0; n < 500; n++) requests.push(h.loader.get(interval(n)).catch(error => error.name));
  h.jobs.at(-1).complete();
  const results = await Promise.all(requests);
  assert.equal(h.peak(), 1);
  assert.equal(h.cancelled.length, 499);
  assert.ok(results.slice(0, -1).every(value => value === 'AbortError'));
  assert.equal(results.at(-1).start, 499);
  assert.equal(h.loader.snapshot().cached, 1);
  assert.equal(h.loader.snapshot().active, 0);
});

test('back-and-forth reuses both completed intervals without fetching, decoding or prefetch thrash', async () => {
  const h = harness();
  for (const n of [1, 2]) {const request = h.loader.get(interval(n)); h.jobs.at(-1).complete(); await request;}
  for (let n = 0; n < 1000; n++) assert.equal((await h.loader.get(interval(n % 2 + 1))).start, n % 2 + 1);
  assert.deepEqual(h.calls, ['1', '2']);
  assert.equal(h.loader.snapshot().cached, 2);
  assert.equal(h.loader.snapshot().bytes, 32);
});

test('foreground seeks cancel speculative playback loads; prefetch never interrupts a foreground decode', async () => {
  const h = harness();
  const initial = h.loader.get(interval(1)); h.jobs.at(-1).complete(); await initial;
  h.loader.prefetch(interval(2));
  const seek = h.loader.get(interval(10));
  h.loader.prefetch(interval(11));
  assert.deepEqual(h.calls, ['1', '2', '10']);
  assert.deepEqual(h.cancelled, ['2']);
  h.jobs.at(-1).complete(); await seek;
  assert.equal(h.peak(), 1);
  assert.equal(h.loader.snapshot().cached, 2);
});

test('handoff to an in-progress prefetch shares the job; late cancelled completions cannot overwrite newer data', async () => {
  const h = harness();
  const old = h.loader.get(interval(1)).catch(e => e.name);
  const next = h.loader.get(interval(2));
  h.jobs[0].complete(); h.jobs[1].complete();
  assert.equal(await old, 'AbortError'); assert.equal((await next).start, 2);
  h.loader.prefetch(interval(3));
  const handoff = h.loader.get(interval(3));
  assert.equal(h.calls.length, 3);
  h.jobs[2].complete(); assert.equal((await handoff).start, 3);
  assert.equal(h.loader.snapshot().cached, 2);
});

test('unmount cancels an active job and releases cache; subsequent requests cannot spawn work', async () => {
  const h = harness();
  const request = h.loader.get(interval(1)).catch(e => e.name);
  h.loader.dispose();
  assert.equal(await request, 'AbortError');
  await assert.rejects(h.loader.get(interval(2)), {name: 'AbortError'});
  assert.equal(h.active(), 0); assert.equal(h.calls.length, 1);
  assert.equal(h.loader.snapshot().bytes, 0);
});
