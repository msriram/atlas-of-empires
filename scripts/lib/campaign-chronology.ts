import type {AtlasPlan} from '../../app/temporal/atlas';
import {inStage, type Chronology, type EmpireTimeline, type CampaignStage} from '../../app/temporal/chronology';

/** Calendar windows belong to named campaigns, not to the world's snapshot
 * interval. No annual change is inferred when a profile holds its data. */
export function applyChronology(plan: AtlasPlan, distance: Float32Array, names: string[], chronology: Chronology) {
  const profiles = new Map<number, EmpireTimeline>();
  names.forEach((name, id) => {const profile = chronology.profiles.find(p => p.names.includes(name)); if (profile) profiles.set(id, profile);});
  const groups = new Map<CampaignStage, number[]>();
  const family = (id: number) => chronology.families.findIndex(f => f.includes(names[id]));
  const sameFamily = (a: number, b: number) => family(a) >= 0 && family(a) === family(b);
  function stageFor(profile: EmpireTimeline | undefined, action: 'gain' | 'loss', lon: number, lat: number) {
    return profile?.stages.findLast(s => s.action === action && s.end > plan.start && s.start < plan.end && inStage(s, lon, lat));
  }
  for (let i = 0; i < plan.width * plan.height; i++) {
    const a = plan.owners[i * 2], b = plan.owners[i * 2 + 1];
    if (a === b) continue;
    if (sameFamily(a,b)) {
      // Naming/administration changes do not move a territorial edge.
      plan.timing[i * 2] = 0; plan.timing[i * 2 + 1] = 1; continue;
    }
    const lon = (i % plan.width + .5) * 360 / plan.width - 180;
    const lat = 90 - (Math.floor(i / plan.width) + .5) * 180 / plan.height;
    const target = profiles.get(b), previous = profiles.get(a);
    const stage = stageFor(target, 'gain', lon, lat) ?? stageFor(previous, 'loss', lon, lat);
    if (stage) {const list = groups.get(stage) ?? []; list.push(i); groups.set(stage, list);}
    else if ((target?.fallback ?? previous?.fallback ?? chronology.defaultFallback) === 'hold') {
      // A new source outline is evidence at its own date. Do not manufacture
      // a century of growth leading up to it. Explicit estimated tracks opt in.
      plan.timing[i * 2] = 65535; plan.timing[i * 2 + 1] = 0;
    }
  }
  for (const [stage, cells] of groups) {
    let lo = Infinity, hi = -Infinity;
    for (const i of cells) {lo = Math.min(lo, distance[i]); hi = Math.max(hi, distance[i]);}
    const start = Math.max(plan.start, stage.start), end = Math.min(plan.end, stage.end);
    const a = (start - plan.start) / (plan.end - plan.start), b = (end - plan.start) / (plan.end - plan.start);
    const span = Math.max(2, hi - lo + 2);
    for (const i of cells) {
      // Only the selected source geography moves, following its geodesic front.
      // An ocean-separated component may seed locally; connected land grows
      // from retained territory. No radial scale factor is applied to a polygon.
      const progress = Math.max(0, Math.min(1, (distance[i] - lo + 1) / span));
      const arrival = a + (b - a) * progress;
      const spread = Math.min(2 * (arrival - a), 2 * (b - arrival), (b - a) * 2 / span);
      plan.timing[i * 2] = Math.round(arrival * 65535);
      plan.timing[i * 2 + 1] = Math.max(1, Math.round(spread * 65535));
    }
  }
}
