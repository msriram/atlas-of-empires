/** One shared geographic ownership field, independent of the display projection.
 * Coordinates are cell centers on an equirectangular grid. Time is continuous;
 * annual outlines are samples of the field, not unrelated replacement polygons. */
export type AtlasPlan = {
  start: number; end: number; width: number; height: number;
  owners: Uint16Array; timing: Uint16Array;
};
export type AtlasInterval = {
  start: number; end: number; file: string; bytes: number;
  // First/last normalized time with visible ownership, for the sidebar.
  presence: [number, number, number][];
};
export type AtlasManifest = {
  version: string; inputVersion?: string; resolution: number; names: string[]; intervals: AtlasInterval[];
};
export const MAGIC = 0x41544c32;
export function decodePlan(buffer: ArrayBuffer, interval: AtlasInterval): AtlasPlan {
  const header = new Uint32Array(buffer, 0, 4);
  const [magic, width, height] = header;
  if (magic !== MAGIC || buffer.byteLength !== 16 + width * height * 8) throw new Error('Invalid boundary atlas');
  return {start: interval.start, end: interval.end, width, height,
    owners: new Uint16Array(buffer, 16, width * height * 2),
    timing: new Uint16Array(buffer, 16 + width * height * 4, width * height * 2)};
}
export function phaseAt(plan: Pick<AtlasPlan, 'start' | 'end'>, year: number) {
  return Math.max(0, Math.min(1, (year - plan.start) / (plan.end - plan.start)));
}
export function incomingWeight(arrival: number, width: number, phase: number) {
  if (phase <= 0) return 0;
  if (phase >= 1) return 1;
  return Math.max(0, Math.min(1, .5 + (phase - arrival / 65535) / Math.max(1 / 65535, width / 65535)));
}
/** Same four geographic samples and ownership voting as the GPU shader. */
export function ownerAt(plan: AtlasPlan, lon: number, lat: number, year: number): number {
  if (lat < -90 || lat > 90) return 0;
  const x = (((lon + 180) / 360 * plan.width) % plan.width + plan.width) % plan.width - .5;
  const y = (90 - lat) / 180 * plan.height - .5;
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const scores = new Map<number, number>();
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const i = (Math.max(0, Math.min(plan.height - 1, iy + dy)) * plan.width + (ix + dx + plan.width) % plan.width) * 2;
    const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
    const blend = incomingWeight(plan.timing[i], plan.timing[i + 1], phaseAt(plan, year));
    for (const [id, w] of [[plan.owners[i], weight * (1 - blend)], [plan.owners[i + 1], weight * blend]]) scores.set(id, (scores.get(id) ?? 0) + w);
  }
  return [...scores].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}
