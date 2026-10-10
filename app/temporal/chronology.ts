import {periodAt,periodNamed} from '../data/historical-names';

export type CampaignStage = {
  id: string; action: 'gain' | 'loss'; start: number; end: number;
  bounds?: number[]; region?: number[][]; source: string; geometry?: string;
};
export type EmpireTimeline = {
  id: string; names: string[]; origin: number[]; fallback: 'hold' | 'estimated';
  source: string; stages: CampaignStage[];
};
export type Chronology = {defaultFallback: 'hold' | 'estimated'; families: string[][]; profiles: EmpireTimeline[]};

export function canonicalName(name: string, year: number) {
  if (name === 'Rome' && [-500, -323, -200].includes(year)) return 'Roman Republic';
  // Administrative divisions are not four new empires growing out of nothing.
  if (/^Rome \(/.test(name)) return 'Roman Empire';
  return name;
}
export function displayName(name: string, year: number) {
  const period=periodAt(name,year);
  if(period)return period.name;
  if (name === 'Roman Republic' || name === 'Roman Empire') return year < -27 ? 'Roman Republic' : 'Roman Empire';
  return name;
}
export function colorKey(name: string) {
  const period=periodNamed(name);
  if(period)return period.sourceName;
  if (name === 'Roman Republic' || name === 'Roman Empire') return 'Roman Empire';
  if (name === 'Eastern Roman Empire' || name === 'Byzantine Empire') return 'Eastern Roman Empire';
  return name;
}
export function inStage(stage: CampaignStage, lon: number, lat: number) {
  if (stage.bounds) {const [w,s,e,n] = stage.bounds; if (lon < w || lon > e || lat < s || lat > n) return false;}
  if (!stage.region) return true;
  let inside = false;
  const ring = stage.region;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > lat) !== (b[1] > lat) && lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
