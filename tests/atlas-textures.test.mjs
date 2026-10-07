import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AtlasTextures} from '../app/temporal/atlas-textures.ts';

function harness() {
  const stats = {created: 0, allocated: 0, uploaded: 0, deleted: 0};
  const gl = {
    createTexture: () => ({id: stats.created++}), deleteTexture: () => stats.deleted++,
    activeTexture() {}, bindTexture() {}, texParameteri() {},
    texImage2D: () => stats.allocated++, texSubImage2D: () => stats.uploaded++,
  };
  return {stats, cache: new AtlasTextures(gl)};
}
const plan = () => ({width: 4, height: 2, start: 0, end: 100, owners: new Uint16Array(16), timing: new Uint16Array(16)});

test('1000 direction reversals reuse GPU textures without further allocations or uploads', () => {
  const {cache, stats} = harness(), a = plan(), b = plan();
  for (let i = 0; i < 1000; i++) cache.bind(i % 2 ? a : b);
  assert.equal(stats.created, 4); assert.equal(stats.allocated, 4); assert.equal(stats.uploaded, 4);
  assert.equal(cache.uploads, 2);
  cache.dispose(); assert.equal(stats.deleted, 4);
});

test('seeking through many unique intervals reuses the same two GPU slots', () => {
  const {cache, stats} = harness();
  for (let i = 0; i < 500; i++) cache.bind(plan());
  assert.equal(stats.created, 4); assert.equal(stats.allocated, 4);
  assert.equal(stats.uploaded, 1000);
  cache.dispose(); assert.equal(stats.deleted, 4);
});

test('large atlas uploads are limited to a quarter of the original GPU storage', () => {
  const dimensions = [], uploads = [];
  const gl = {
    createTexture: () => ({}), deleteTexture() {}, activeTexture() {}, bindTexture() {}, texParameteri() {},
    texImage2D: (...args) => dimensions.push([args[3], args[4]]),
    texSubImage2D: (...args) => uploads.push([args[4], args[5], args.at(-1).byteLength]),
  };
  const cache = new AtlasTextures(gl);
  cache.bind({width: 2880, height: 1440, start: 0, end: 100,
    owners: new Uint16Array(2880 * 1440 * 2), timing: new Uint16Array(2880 * 1440 * 2)});
  assert.deepEqual(dimensions, [[1440, 720], [1440, 720]]);
  assert.deepEqual(uploads, [[1440, 720, 1440 * 720 * 4], [1440, 720, 1440 * 720 * 4]]);
  cache.dispose();
});
