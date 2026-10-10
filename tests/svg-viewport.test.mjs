import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleSvgView} from '../app/temporal/svg-viewport.ts';

test('territory view covers the map above and below its nominal viewBox in a tall frame', () => {
  const view = [280, -45, 720, 360];
  const [x, y, width, height] = visibleSvgView(view, 1734, 1355);
  assert.equal(x, view[0]);
  assert.equal(width, view[2]);
  assert.ok(y < view[1]);
  assert.ok(y + height > view[1] + view[3]);
  assert.ok(Math.abs((y + height / 2) - (view[1] + view[3] / 2)) < 1e-9);
});

test('territory view matches a map with no SVG letterboxing', () => {
  assert.deepEqual(visibleSvgView([280, -45, 720, 360], 1440, 720), [280, -45, 720, 360]);
});

test('territory view covers the sides of a wide frame, including a zoomed globe', () => {
  const [x, y, width, height] = visibleSvgView([0, 0, 900, 450], 1800, 600);
  assert.ok(x < 0);
  assert.ok(x + width > 900);
  assert.equal(y, 0);
  assert.equal(height, 450);
});
