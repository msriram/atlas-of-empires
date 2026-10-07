import {readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import type {Boundary} from '../app/territory-model';
import {MAGIC, incomingWeight, type AtlasManifest, type AtlasInterval} from '../app/temporal/atlas';
import {rasterize, buildField, type Campaign} from './lib/ownership-field';
import transfers from '../app/data/territory-transfers.json';
import keyframes from '../app/data/territory-keyframes.json';
import {fieldShape} from '../app/geometry-field';
import {atlasInputVersion} from './atlas-inputs.mjs';
import timelineData from '../app/data/empire-timelines.json';
import {canonicalName, type Chronology} from '../app/temporal/chronology';

// A quarter-degree cell is finer than the displayed map at its default zoom.
// Keeping CPU, worker and GPU grids at one resolution avoids retaining four
// times more atlas data than playback can draw.
const width = 1440, height = 720, dir = 'public/atlas';
const sourceYears = readdirSync('public/historical').filter(f => /^-?\d+\.json$/.test(f)).map(f => Number(f.slice(0, -5))).sort((a, b) => a - b);
const sources = new Map<number, Boundary[]>(sourceYears.map(y => [y, JSON.parse(readFileSync(`public/historical/${y}.json`, 'utf8')).map((b: Boundary) => ({...b, n: canonicalName(b.n, y)}))]));
const tracks = keyframes.tracks as {name: string; frames: ({year: number} & Pick<Boundary, 'r'>)[]}[];
const chronology = timelineData as Chronology;
for (const track of tracks) chronology.profiles.push({id: `custom:${track.name}`, names: [track.name], origin: track.frames[0]?.r[0]?.[0] ?? [0,0], fallback: 'estimated', source: 'Authored coordinate keyframes', stages: []});
const hidden = new Set<string>(keyframes.hidden);
const names = ['', ...new Set([...sources.values()].flatMap(s => s.map(b => b.n)).concat(tracks.map(t => t.name)).filter(n => !hidden.has(n)))].sort((a, b) => a.localeCompare(b));
const ids = new Map(names.map((n, i) => [n, i]));
const rules: Campaign[] = [...transfers.rules, {to: 'Empire of Alexander', start: -336, end: -323, origin: [22.5, 40.5]}];
const cache = new Map<number, Uint16Array>();
function sourceGrid(y: number) {
  let grid = cache.get(y);
  if (!grid) {grid = rasterize(sources.get(y)!.filter(b => !hidden.has(b.n)), ids, width, height); cache.set(y, grid);}
  return grid;
}
const years = [...new Set([...sourceYears, 1206, 1260, ...tracks.flatMap(t => t.frames.map(f => f.year))])].sort((a, b) => a - b);
const khanates = new Set(['Great Khanate', 'Khanate of the Golden Horde', 'Chagatai Khanate', 'Ilkhanate'].map(n => ids.get(n)));
const mongol = ids.get('Mongol Empire')!;
function gridAt(year: number) {
  let grid: Uint16Array;
  if (sources.has(year)) grid = sourceGrid(year).slice();
  else if (year === 1206) grid = sourceGrid(1200).slice();
  else if (year === 1260) {
    grid = sourceGrid(1279).slice();
    for (let i = 0; i < grid.length; i++) if (khanates.has(grid[i])) {
      const lat = 90 - (Math.floor(i / width) + .5) * 180 / height;
      grid[i] = grid[i] === ids.get('Great Khanate') && lat < 31 ? sourceGrid(1200)[i] : mongol;
    }
  } else {
    const a = sourceYears.filter(y => y <= year).at(-1)!, b = sourceYears.find(y => y > year);
    if (b === undefined) grid = sourceGrid(a).slice();
    else {
      const field = buildField(sourceGrid(a), sourceGrid(b), width, height, a, b, names, rules, chronology);
      grid = Uint16Array.from({length: width * height}, (_, i) => field.owners[i * 2 + (incomingWeight(field.timing[i * 2], field.timing[i * 2 + 1], (year - a) / (b - a)) >= .5 ? 1 : 0)]);
    }
  }
  for (const track of tracks) {
    const frames = [...track.frames].sort((a, b) => a.year - b.year);
    if (!frames.length || year < frames[0].year || year > frames.at(-1)!.year) continue;
    const a = frames.filter(f => f.year <= year).at(-1)!, b = frames.find(f => f.year > year);
    const region: Boundary = {n: track.name, p: 2, r: a.r};
    if (b) region.r = fieldShape(`build:${track.name}:${a.year}:${b.year}`, region, {...region, r: b.r}, (year - a.year) / (b.year - a.year));
    const overlay = rasterize([region], ids, width, height), id = ids.get(track.name)!;
    for (let i = 0; i < grid.length; i++) {if (grid[i] === id) grid[i] = 0; if (overlay[i]) grid[i] = id;}
  }
  return grid;
}
mkdirSync(dir, {recursive: true});
const intervals: AtlasInterval[] = [];
let before = gridAt(years[0]);
for (let k = 0; k < years.length; k++) {
  const start = years[k], end = years[k + 1] ?? 2026, after = k + 1 < years.length ? gridAt(end) : before;
  const began = performance.now();
  const plan = buildField(before, after, width, height, start, end, names, rules, chronology);
  const buffer = Buffer.alloc(16 + width * height * 8);
  buffer.set(new Uint8Array(new Uint32Array([MAGIC, width, height, 1]).buffer));
  buffer.set(new Uint8Array(plan.owners.buffer), 16);
  buffer.set(new Uint8Array(plan.timing.buffer), 16 + width * height * 4);
  const compressed = gzipSync(buffer, {level: 9});
  const hash = createHash('sha256').update(compressed).digest('hex').slice(0, 12);
  const file = `${start}.${hash}.atlas`;
  writeFileSync(`${dir}/${file}`, compressed);
  const presence = new Map<number, [number, number]>();
  for (let i = 0; i < width * height; i++) {
    const a = plan.owners[i * 2], b = plan.owners[i * 2 + 1], t = plan.timing[i * 2] / 65535;
    if (a) {const p = presence.get(a) ?? [0, 0]; p[0] = 0; p[1] = Math.max(p[1], a === b ? 1 : t); presence.set(a, p);}
    if (b) {const p = presence.get(b) ?? [1, 1]; p[0] = Math.min(p[0], a === b ? 0 : t); p[1] = 1; presence.set(b, p);}
  }
  intervals.push({start, end, file, bytes: compressed.length, presence: [...presence].map(([id, [a, b]]) => [id, a, b])});
  console.log(`${start} → ${end}: ${(compressed.length / 1024).toFixed(0)} KB, ${(performance.now() - began).toFixed(0)} ms`);
  before = after;
  // Only adjacent source grids are needed for ordinary build steps.
  for (const y of cache.keys()) if (y < start && !(start <= 1260 && (y === 1200 || y === 1279))) cache.delete(y);
}
const version = createHash('sha256').update(JSON.stringify(intervals)).digest('hex').slice(0, 12);
const manifest: AtlasManifest = {version, inputVersion: atlasInputVersion(), resolution: 360 / width, names, intervals};
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest));
const currentFiles = new Set(intervals.map(i => i.file));
for (const file of readdirSync(dir)) if (/^-?\d+\.[a-f0-9]{12}\.atlas$/.test(file) && !currentFiles.has(file)) unlinkSync(`${dir}/${file}`);
console.log(`Atlas ${version}: ${intervals.length} intervals, ${(intervals.reduce((s, i) => s + i.bytes, 0) / 1048576).toFixed(1)} MB total. Browser loads two intervals, not the full atlas.`);
