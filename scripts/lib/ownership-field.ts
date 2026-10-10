import type {Boundary, Point} from '../../app/territory-model';
import {geometryOf, geometryArea} from '../../app/territory-transfers';
import type {AtlasPlan} from '../../app/temporal/atlas';
import type {Chronology} from '../../app/temporal/chronology';
import {applyChronology} from './campaign-chronology';

export type Campaign = {to: string; from?: string; start: number; end: number; origin: number[]};
/** Scan conversion respects holes and resolves source overlaps with small regions
 * on top. The exact same converted endpoint is reused by adjacent intervals. */
export function rasterize(regions: Boundary[], names: Map<string, number>, width: number, height: number) {
  const output = new Uint16Array(width * height);
  for (const b of [...regions].sort((a, b) => geometryArea(geometryOf(b)) - geometryArea(geometryOf(a)) || b.n.localeCompare(a.n))) {
    const id = names.get(b.n)!;
    for (const polygon of geometryOf(b)) {
      const rings = polygon.map(ring => {
        const points: Point[] = [];
        for (const [lon, lat] of ring) {
          let x = (lon + 180) / 360 * width;
          if (points.length) {const prev = points.at(-1)![0]; while (x - prev > width / 2) x -= width; while (x - prev < -width / 2) x += width;}
          points.push([x, (90 - lat) / 180 * height]);
        }
        return points;
      });
      const points = rings.flat();
      if (!points.length) continue;
      const minY = Math.max(0, Math.ceil(Math.min(...points.map(p => p[1])) - .5));
      const maxY = Math.min(height - 1, Math.floor(Math.max(...points.map(p => p[1])) - .5));
      for (let y = minY; y <= maxY; y++) {
        const crossings: number[] = [], row = y + .5;
        for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i], c = ring[j];
          if ((a[1] > row) !== (c[1] > row)) crossings.push(a[0] + (row - a[1]) * (c[0] - a[0]) / (c[1] - a[1]));
        }
        crossings.sort((a, b) => a - b);
        for (let k = 0; k + 1 < crossings.length; k += 2) for (let x = Math.ceil(crossings[k] - .5); x <= Math.floor(crossings[k + 1] - .5); x++) output[y * width + ((x % width) + width) % width] = id;
      }
    }
  }
  return output;
}

class MinHeap {
  nodes: number[] = []; costs: number[] = [];
  push(node: number, cost: number) {
    let i = this.nodes.length; this.nodes.push(node); this.costs.push(cost);
    while (i) {const p = (i - 1) >> 1; if (this.costs[p] <= cost) break; this.nodes[i] = this.nodes[p]; this.costs[i] = this.costs[p]; i = p;}
    this.nodes[i] = node; this.costs[i] = cost;
  }
  pop(): [number, number] {
    const out: [number, number] = [this.nodes[0], this.costs[0]], node = this.nodes.pop()!, cost = this.costs.pop()!;
    if (this.nodes.length) {let i = 0; while (i * 2 + 1 < this.nodes.length) {let c = i * 2 + 1; if (c + 1 < this.nodes.length && this.costs[c + 1] < this.costs[c]) c++; if (this.costs[c] >= cost) break; this.nodes[i] = this.nodes[c]; this.costs[i] = this.costs[c]; i = c;} this.nodes[i] = node; this.costs[i] = cost;}
    return out;
  }
}

/** Fast marching across connected target territory. No independent polygon
 * scaling: land stays with its old owner until the arriving front reaches it.
 * Costs use geographic distance and smooth illustrative resistance, not terrain
 * measurements. Disconnected components get a distance-delayed coastal seed. */
export function buildField(before: Uint16Array, after: Uint16Array, width: number, height: number, start: number, end: number, names: string[], rules: Campaign[], chronology?: Chronology): AtlasPlan {
  const count = width * height, owners = new Uint16Array(count * 2), timing = new Uint16Array(count * 2);
  // Empty coverage is not a single empire. Keep each disappearing owner's
  // retreat independent instead of marching one worldwide "unknown" front.
  const targets = new Map<string, {target: number; cells: number[]}>(), distances = new Float32Array(count).fill(Infinity);
  const families = names.map((_, id) => chronology?.families.findIndex(f => f.includes(names[id])) ?? -1);
  const sameOwner = (a: number, b: number) => a === b || families[a] >= 0 && families[a] === families[b];
  const latScale = Float32Array.from({length: height}, (_, y) => Math.max(.08, Math.cos((90 - (y + .5) * 180 / height) * Math.PI / 180)));
  const resistance = Float32Array.from({length: count}, (_, i) => {
    const lon = i % width * 360 / width, lat = Math.floor(i / width) * 180 / height;
    return 1 + .18 * Math.sin(lon * .41 + Math.sin(lat * .23)) + .12 * Math.cos(lat * .63 + lon * .17);
  });
  for (let i = 0; i < count; i++) {
    owners[i * 2] = before[i]; owners[i * 2 + 1] = after[i];
    if (before[i] !== after[i] && !sameOwner(before[i], after[i])) {
      const key = after[i] === 0 ? `empty:${before[i]}` : `owner:${after[i]}`;
      const group = targets.get(key) ?? {target: after[i], cells: []};
      group.cells.push(i); targets.set(key, group);
    }
  }
  const neighbors = (i: number, visit: (j: number, cost: number) => void) => {
    const x = i % width, y = Math.floor(i / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || y + dy < 0 || y + dy >= height) continue;
      const j = (y + dy) * width + (x + dx + width) % width;
      visit(j, Math.hypot(dx * latScale[y], dy) * (resistance[i] + resistance[j]) * .5);
    }
  };
  for (const {target, cells} of targets.values()) {
    const rule = rules.find(r => r.to === names[target] && !r.from && r.start >= start && r.end <= end);
    const heap = new MinHeap();
    // A disappearance into unknown coverage retreats from its edge, never from
    // a simultaneous scale-to-zero of the entire source polygon.
    for (const i of cells) neighbors(i, (j, cost) => {
      if (sameOwner(after[j], target) && sameOwner(before[j], target) && cost < distances[i]) {distances[i] = cost; heap.push(i, cost);}
    });
    let origin: Point;
    const profile = chronology?.profiles.find(p => p.names.includes(names[target]));
    if (profile) origin = profile.origin as Point;
    else if (rule) origin = rule.origin as Point;
    else {
      // Pick a covered point, avoiding a bbox center
      // in the sea between islands. A dated campaign origin can override this.
      const mid = cells[Math.floor(cells.length / 2)];
      origin = [(mid % width + .5) * 360 / width - 180, 90 - (Math.floor(mid / width) + .5) * 180 / height];
    }
    const originDistance = (i: number) => {
      let dx = (i % width + .5) - (origin[0] + 180) / 360 * width;
      dx = Math.min(Math.abs(dx), width - Math.abs(dx));
      const dy = Math.floor(i / width) + .5 - (90 - origin[1]) / 180 * height;
      return Math.hypot(dx * latScale[Math.floor(i / width)], dy);
    };
    const march = () => {
      while (heap.nodes.length) {
        const [i, d] = heap.pop(); if (d > distances[i] + .0001) continue;
        neighbors(i, (j, cost) => {if (after[j] !== target || sameOwner(before[j], target)) return; const next = d + cost; if (next < distances[j]) {distances[j] = next; heap.push(j, next);}});
      }
    };
    march();
    // Ocean-separated islands cannot be reached through another owner's land.
    // Seed each remaining component from its nearest point to the origin.
    const remaining = cells.filter(i => !Number.isFinite(distances[i])).sort((a, b) => originDistance(a) - originDistance(b));
    for (const i of remaining) if (!Number.isFinite(distances[i])) {const d = originDistance(i) + 1; distances[i] = d; heap.push(i, d); march();}
    // Rank the advancing front by area, not the single farthest vertex. A tiny
    // remote island must not stretch the clock and freeze the mainland for a
    // decade. Ordering is still geodesic, so connected fronts stay connected.
    const ordered = [...cells].sort((a, b) => distances[a] - distances[b]);
    let area = 0;
    for (const i of ordered) area += latScale[Math.floor(i / width)];
    let covered = 0;
    const phase = new Map<number, number>();
    for (let k = 0; k < ordered.length;) {
      let end = k + 1, weight = latScale[Math.floor(ordered[k] / width)];
      while (end < ordered.length && Math.abs(distances[ordered[end]] - distances[ordered[k]]) < .00001) {weight += latScale[Math.floor(ordered[end] / width)]; end++;}
      for (let j = k; j < end; j++) phase.set(ordered[j], (covered + weight * .5) / area);
      covered += weight; k = end;
    }
    // Dated sub-conquests share the geographic distance ordering, but have
    // their own calendar window (e.g. Egypt vs Babylon).
    const matching = rules.filter(r => r.to === names[target] && r.from && r.start >= start && r.end <= end);
    const ranges = new Map<string, [number, number]>();
    for (const i of cells) {const from = names[before[i]]; if (matching.some(r => r.from === from)) {const r = ranges.get(from) ?? [Infinity, -Infinity]; r[0] = Math.min(r[0], distances[i]); r[1] = Math.max(r[1], distances[i]); ranges.set(from, r);}}
    for (const i of cells) {
      const conquest = matching.find(r => r.from === names[before[i]]) ?? rule;
      const [lo, hi] = conquest?.from ? ranges.get(conquest.from)! : [0, 1];
      const a = conquest ? (conquest.start - start) / (end - start) : 0;
      const b = conquest ? (conquest.end - start) / (end - start) : 1;
      const span = Math.max(2, hi - lo + 2);
      let gradient = 0;
      neighbors(i, j => {if (phase.has(j)) gradient = Math.max(gradient, Math.abs(phase.get(j)! - phase.get(i)!));});
      const fraction = conquest?.from ? (distances[i] - lo + 1) / span : phase.get(i)!;
      const arrival = a + (b - a) * fraction;
      // Narrow the smoothing band at endpoints; moving the arrival instead
      // would reorder fronts and could create detached early patches.
      const spread = Math.min(2 * (arrival - a), 2 * (b - arrival), (b - a) * (conquest?.from ? 2 / span : Math.max(1 / 65535, gradient * 2)));
      timing[i * 2] = Math.round(arrival * 65535);
      timing[i * 2 + 1] = Math.max(1, Math.round(spread * 65535));
    }
  }
  const plan = {start, end, width, height, owners, timing};
  if (chronology) applyChronology(plan, distances, names, chronology);
  return plan;
}
