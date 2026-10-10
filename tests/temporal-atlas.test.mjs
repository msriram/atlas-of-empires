import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decodePlan, incomingWeight, ownerAt} from '../app/temporal/atlas.ts';
import {buildField, rasterize} from '../scripts/lib/ownership-field.ts';
import {advanceYear} from '../app/temporal/use-playback.ts';

const manifest = JSON.parse(readFileSync('public/atlas/manifest.json'));
function loadInterval(interval) {
  const bytes = gunzipSync(readFileSync(`public/atlas/${interval.file}`));
  return decodePlan(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), interval);
}
const at = year => loadInterval(manifest.intervals.findLast(i => i.start <= year));

test('all neighboring atlas intervals share byte-identical endpoint ownership', () => {
  let last;
  for (const interval of manifest.intervals) {
    const p = loadInterval(interval);
    if (last) for (let i = 0; i < p.width * p.height; i++) assert.equal(p.owners[i * 2], last.owners[i * 2 + 1], `source seam at ${interval.start}, cell ${i}`);
    last = p;
  }
});

test('530–460 BCE has no annual ownership gaps at Persia, Babylon and Egypt', () => {
  const ancient = at(-530), classical = at(-499);
  for (let year = -530; year <= -460; year++) {
    const p = year < -500 ? ancient : classical;
    for (const point of [[44.4, 32.5], [52.5, 30], [31.1, 29.5]]) assert.notEqual(ownerAt(p, ...point, year), 0, `${year}: blank at ${point}`);
  }
  assert.equal(manifest.names[ownerAt(ancient, 31.1, 29.5, -526)], 'Egypt');
  assert.equal(manifest.names[ownerAt(ancient, 31.1, 29.5, -525)], 'Achaemenid Empire');
});

test('a connected conquest has one advancing front, conserves ownership and has sub-year motion', () => {
  const w = 80, h = 30, a = new Uint16Array(w * h).fill(1), b = new Uint16Array(w * h).fill(2);
  for (let y = 0; y < h; y++) for (let x = 0; x < 5; x++) a[y * w + x] = 2;
  const p = buildField(a, b, w, h, 0, 100, ['', 'Old', 'New'], []);
  let previous = 0;
  for (let year = 1; year < 100; year++) {
    const acquired = new Set();
    for (let i = 0; i < w * h; i++) {
      const weight = incomingWeight(p.timing[i * 2], p.timing[i * 2 + 1], year / 100);
      const owner = p.owners[i * 2 + (weight >= .5 ? 1 : 0)];
      assert.ok(owner === 1 || owner === 2);
      if (owner === 2) acquired.add(i);
    }
    assert.ok(acquired.size >= previous); previous = acquired.size;
    const connected = new Set([0]), queue = [0];
    for (let k = 0; k < queue.length; k++) {const i = queue[k], x = i % w, y = Math.floor(i / w);for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {const j = (y + dy) * w + (x + dx + w) % w;if (y + dy >= 0 && y + dy < h && acquired.has(j) && !connected.has(j)) {connected.add(j);queue.push(j);}}}
    assert.equal(connected.size, acquired.size, `detached patch at ${year}`);
  }
  const i = 15 * w + 35, arrival = p.timing[i * 2] / 65535, spread = p.timing[i * 2 + 1] / 65535;
  const first = incomingWeight(p.timing[i * 2], p.timing[i * 2 + 1], arrival - spread / 4);
  const second = incomingWeight(p.timing[i * 2], p.timing[i * 2 + 1], arrival + spread / 4);
  assert.ok(first > 0 && first < second && second < 1);
});

test('Mongol campaigns grow in their dated windows, nearly pause, then transfer to successors', () => {
  const p = at(1207), q = at(1261), id = manifest.names.indexOf('Mongol Empire');
  const sizes = new Uint32Array(55);
  for (let i = 0; i < p.width * p.height; i++) {
    const a = p.owners[i * 2], b = p.owners[i * 2 + 1];
    if (a !== id && b !== id) continue;
    for (let y = 1206; y <= 1260; y++) {const owner = p.owners[i * 2 + (incomingWeight(p.timing[i * 2], p.timing[i * 2 + 1], (y - p.start) / (p.end - p.start)) >= .5 ? 1 : 0)];if (owner === id) sizes[y - 1206]++;}
  }
  assert.ok(sizes[1214-1206] > sizes[1211-1206], 'northern China campaign must move');
  assert.ok(sizes[1241-1206] > sizes[1236-1206], 'western campaign must move');
  assert.ok(Math.abs(sizes[1229-1206] - sizes[1228-1206]) <= 2, 'estimated residual cells may move, but the dated campaign pauses');
  assert.ok(Math.abs(sizes[1259-1206] - sizes[1258-1206]) <= 2, 'the dated campaign must not keep growing just because the year advances');
  let first = 0, second = 0;
  for (let i = 0; i < q.width * q.height; i++) if (q.owners[i * 2] === id) {first++;if (q.owners[i * 2 + 1] === id || q.timing[i * 2] / 65535 > 1 / 19) second++;}
  assert.ok(second < first && second > first * .3, 'succession should transfer territory, not erase it');
});

test('projection-independent coordinates wrap at the dateline and preserve holes', () => {
  const names = new Map([['Ring', 1]]);
  const region = {n: 'Ring', p: 2, r: [], polygons: [[[[160,-30],[200,-30],[200,30],[160,30]],[[175,-10],[185,-10],[185,10],[175,10]]]]};
  const g = rasterize([region], names, 360, 180);
  const p = buildField(g, g, 360, 180, 0, 100, ['', 'Ring'], []);
  assert.equal(ownerAt(p, 170, 20, 50), 1);
  assert.equal(ownerAt(p, -190, 20, 50), 1);
  assert.equal(ownerAt(p, 170 - 360 * 5, 20, 50), 1);
  assert.equal(ownerAt(p, 170 + 360 * 5, 20, 50), 1);
  assert.equal(ownerAt(p, 180, 0, 50), 0);
  assert.equal(ownerAt(p, -180, 0, 50), 0);
});

test('32× with a one-year step advances continuously and waits for available data', () => {
  let year = -530;
  for (let i = 0; i < 60; i++) year = advanceYear(year, 1000 / 60, 1, 32, -400);
  assert.ok(Math.abs(year - (-498)) < 1e-6);
  assert.equal(advanceYear(-501, 100, 1, 32, -500), -500);
  assert.equal(advanceYear(-500, 100, 1, 32, -500), -500);
  assert.equal(advanceYear(2025, 100, 100, 32, 2026), 2026);
  assert.equal(advanceYear(10, 60000, 1, 1, 100), 10.1);
});

test('independent campaign calendars have quiet years; unchanged data never breathes', () => {
  const w = 100, h = 30, before = new Uint16Array(w*h).fill(1), after = before.slice();
  for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
    if (x<4) before[y*w+x]=2;
    if (x>95) before[y*w+x]=3;
    if (x<45) after[y*w+x]=2;
    if (x>55) after[y*w+x]=3;
  }
  const chronology={defaultFallback:'hold',families:[],profiles:[
    {id:'a',names:['Empire A'],origin:[-170,0],fallback:'hold',source:'test',stages:[{id:'a-gain',action:'gain',start:10,end:20,source:'test'}]},
    {id:'b',names:['Empire B'],origin:[170,0],fallback:'hold',source:'test',stages:[{id:'b-gain',action:'gain',start:70,end:90,source:'test'}]},
  ]};
  const p=buildField(before,after,w,h,0,100,['','Neighbor','Empire A','Empire B'],[],chronology);
  const counts = year => {const out=[0,0,0,0]; for(let i=0;i<w*h;i++) out[p.owners[i*2+(incomingWeight(p.timing[i*2],p.timing[i*2+1],year/100)>=.5?1:0)]]++;return out;};
  assert.deepEqual(counts(1), counts(9));
  assert.ok(counts(15)[2]>counts(9)[2]);
  assert.equal(counts(15)[3], counts(9)[3]);
  assert.deepEqual(counts(25), counts(65));
  assert.ok(counts(80)[3]>counts(65)[3]);
  assert.equal(counts(80)[2], counts(65)[2]);
  const held=buildField(before,before,w,h,0,100,['','Neighbor','Empire A','Empire B'],[],chronology);
  assert.deepEqual(held.owners.filter((_,i)=>i%2===0),held.owners.filter((_,i)=>i%2===1));
});

test('missing chronology keeps a source outline still instead of inventing world-wide growth', () => {
  const a=new Uint16Array(100).fill(1), b=new Uint16Array(100).fill(2);
  const p=buildField(a,b,10,10,0,100,['','Earlier source','Later source'],[],{defaultFallback:'hold',families:[],profiles:[]});
  for(let i=0;i<100;i++) for(const year of [1,25,50,75,99]) assert.equal(incomingWeight(p.timing[i*2],p.timing[i*2+1],year/100),0);
});

test('2 BCE to 1 BCE does not switch a whole source map in one year', () => {
  const p = at(-2);
  let changing = 0, endpoint = 0, lastYear = 0;
  for (let i = 0; i < p.width * p.height; i++) {
    const a = p.owners[i * 2], b = p.owners[i * 2 + 1];
    if (a === b) continue;
    changing++;
    const arrival = p.timing[i * 2] / 65535;
    if (arrival === 1) endpoint++;
    if (arrival > (-2 - p.start) / (p.end - p.start)) lastYear++;
  }
  assert.ok(changing > 40000, 'the source interval contains a substantial change');
  assert.equal(endpoint, 0, 'no unsourced world-wide endpoint cliff');
  assert.ok(lastYear < changing * .05, `too much territory switches from 2 BCE to 1 BCE: ${lastYear}/${changing}`);
});

test('retreat into unknown coverage is independent for each former owner', () => {
  const width = 40, height = 10, before = new Uint16Array(width * height), after = before.slice();
  for (let y = 2; y < 8; y++) for (let x = 2; x < 14; x++) before[y * width + x] = 1;
  for (let y = 2; y < 8; y++) for (let x = 25; x < 39; x++) before[y * width + x] = 2;
  const both = buildField(before, after, width, height, 0, 100, ['', 'First', 'Second'], []);
  const firstOnly = before.slice();
  for (let i = 0; i < firstOnly.length; i++) if (firstOnly[i] === 2) firstOnly[i] = 0;
  const alone = buildField(firstOnly, after, width, height, 0, 100, ['', 'First', 'Second'], []);
  for (let i = 0; i < before.length; i++) if (before[i] === 1) {
    assert.equal(both.timing[i * 2], alone.timing[i * 2], `first territory timing depends on second at cell ${i}`);
  }
});
