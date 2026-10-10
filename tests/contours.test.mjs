import test from 'node:test';
import assert from 'node:assert/strict';
import {traceOwnershipContours} from '../app/temporal/contours.ts';

test('a solid region becomes one rounded outline, not pixel-height strips', () => {
  const paths = traceOwnershipContours(new Uint16Array([
    0, 0, 0, 0,
    0, 1, 1, 0,
    0, 1, 1, 0,
    0, 0, 0, 0,
  ]), 4, 4);
  const outline = paths.get(1);
  assert.equal((outline.match(/M/g) ?? []).length, 1);
  assert.ok((outline.match(/Q/g) ?? []).length >= 4);
  assert.ok(outline.endsWith('Z'));
});

test('an interior hole remains a separate even-odd contour', () => {
  const paths = traceOwnershipContours(new Uint16Array([
    1, 1, 1,
    1, 0, 1,
    1, 1, 1,
  ]), 3, 3);
  assert.equal((paths.get(1).match(/M/g) ?? []).length, 2);
});

test('diagonally touching regions do not merge into one shape', () => {
  const paths = traceOwnershipContours(new Uint16Array([
    1, 0,
    0, 1,
  ]), 2, 2);
  assert.equal((paths.get(1).match(/M/g) ?? []).length, 2);
});

test('neighboring owners each retain their own boundary', () => {
  const paths = traceOwnershipContours(new Uint16Array([1, 2]), 2, 1);
  assert.equal(paths.size, 2);
  assert.ok(paths.get(1).includes('1,0'));
  assert.ok(paths.get(2).includes('1,0'));
});

test('a stepped frontier is smoothed to subcell coordinates', () => {
  const cells = new Uint16Array(64);
  for (let y = 1; y < 7; y++) for (let x = 1; x <= y; x++) cells[y * 8 + x] = 1;
  const outline = traceOwnershipContours(cells, 8, 8).get(1);
  assert.match(outline, /\d+\.\d{2}/);
  assert.ok((outline.match(/Q/g) ?? []).length > 4);
});
