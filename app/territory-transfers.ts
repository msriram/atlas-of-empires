import * as polygonClipping from 'polyclip-ts';
export type MultiPolygon = Point[][][];

import type {Boundary, Point} from './territory-model';

// Historical source rings occasionally contain nearly coincident segments that
// make the clipping library fail to close an output ring. Retry on a rounded
// copy, then isolate individual clips. Keep the subject as a last resort so a
// malformed source can never blank the map or crash the timeline.
const rounded=(g:MultiPolygon):MultiPolygon=>g.map(poly=>poly.map(ring=>ring.map(([x,y]):Point=>[Math.round(x*1e5)/1e5,Math.round(y*1e5)/1e5])));
function safeIntersection(a:MultiPolygon,b:MultiPolygon):MultiPolygon{
 try{return polygonClipping.intersection(a,b)}catch{
  try{return polygonClipping.intersection(rounded(a),rounded(b))}catch{return []}
 }
}
function safeDifference(a:MultiPolygon,...clips:MultiPolygon[]):MultiPolygon{
 if(!clips.length)return a;
 try{return polygonClipping.difference(a,...clips)}catch{
  let remaining=a;
  for(const clip of clips){
   try{remaining=polygonClipping.difference(remaining,clip)}catch{
    try{remaining=polygonClipping.difference(rounded(remaining),rounded(clip))}catch{/* Keep this source piece visible. */}
   }
  }
  return remaining;
 }
}
function safeUnion(parts:MultiPolygon):MultiPolygon{
 try{return polygonClipping.union(parts)}catch{
  try{return polygonClipping.union(rounded(parts))}catch{return parts}
 }
}
export type TerritoryPiece = {from?: Boundary; to?: Boundary; geometry: MultiPolygon; origin: Point};
type Region = {boundary: Boundary; geometry: MultiPolygon; bounds: number[]};
type Plan = {before: Boundary[]; after: Boundary[]; pieces: TerritoryPiece[]};
const plans = new Map<string, Plan>();
export const geometryOf = (b: Boundary): MultiPolygon => b.polygons ?? b.r.filter(r => r.length >= 3).map(r => [r]);
export function geometryArea(g: MultiPolygon): number {
 return g.reduce((total, polygon) => total + polygon.reduce((sum, ring, index) => {
  const area = Math.abs(ring.reduce((v, p, i) => {const q = ring[(i + 1) % ring.length];return v + p[0] * q[1] - q[0] * p[1]}, 0) / 2);
  return sum + (index ? -area : area);
 }, 0), 0);
}
function bounds(g: MultiPolygon) {
 const box = [Infinity, Infinity, -Infinity, -Infinity];
 for (const poly of g) for (const ring of poly) for (const [x,y] of ring) {box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y)}
 return box;
}
const intersects = (a:number[], b:number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function center(g:MultiPolygon):Point {const b=bounds(g);return [(b[0]+b[2])/2,(b[1]+b[3])/2]}
export function boundaryWithGeometry(b: Boundary, geometry: MultiPolygon): Boundary {
 return {...b, polygons:geometry, r:geometry.map(p => p[0])};
}
/** Resolve overlaps once, retaining the source's smaller-region draw priority.
 * Holes remain holes; they are never promoted to independent filled polygons. */
function normalize(source: Boundary[]): Region[] {
 const grouped = new Map<string, Boundary[]>();
 for (const b of source) grouped.set(b.n, [...(grouped.get(b.n) ?? []), b]);
 const regions:Region[]=[];
 for (const entries of grouped.values()) {
  const parts=entries.flatMap(geometryOf);if(!parts.length)continue;
  const geometry=source.length>350?parts:safeUnion(parts);
  if(geometry.length)regions.push({boundary:entries[0],geometry,bounds:bounds(geometry)});
 }
 if(source.length>350)return regions;
 regions.sort((a,b)=>geometryArea(a.geometry)-geometryArea(b.geometry)||a.boundary.n.localeCompare(b.boundary.n));
 const accepted:Region[]=[];
 for(const region of regions){const clips=accepted.filter(b=>intersects(b.bounds,region.bounds)).map(b=>b.geometry);
  if(clips.length)region.geometry=safeDifference(region.geometry,...clips);
  if(region.geometry.length)accepted.push(region);
 }
 return accepted;
}
export function prepareTransfers(key:string,before:Boundary[],after:Boundary[]):TerritoryPiece[]{
 const cached=plans.get(key);if(cached?.before===before&&cached.after===after)return cached.pieces;
 const a=normalize(before),b=normalize(after),pieces:TerritoryPiece[]=[];
 for(const from of a){const candidates=b.filter(to=>intersects(from.bounds,to.bounds));
  for(const to of candidates){const geometry=safeIntersection(from.geometry,to.geometry);if(!geometry.length)continue;
   const core=a.find(r=>r.boundary.n===to.boundary.n);
   pieces.push({from:from.boundary,to:to.boundary,geometry,origin:center(core?.geometry??to.geometry)});
  }
  const remaining=candidates.length?safeDifference(from.geometry,...candidates.map(r=>r.geometry)):from.geometry;
  if(remaining.length)pieces.push({from:from.boundary,geometry:remaining,origin:center(from.geometry)});
 }
 for(const to of b){const candidates=a.filter(from=>intersects(from.bounds,to.bounds));
  const remaining=candidates.length?safeDifference(to.geometry,...candidates.map(r=>r.geometry)):to.geometry;
  if(remaining.length)pieces.push({to:to.boundary,geometry:remaining,origin:center(a.find(r=>r.boundary.n===to.boundary.n)?.geometry??to.geometry)});
 }
 if(plans.size>=4)plans.delete(plans.keys().next().value!);
 plans.set(key,{before,after,pieces});return pieces;
}
/** A geographic front cuts the disputed land; its complement stays with the old
 * owner. This guarantees conservation, unlike independently shrinking polygons. */
export function frontMask(piece:TerritoryPiece,t:number,origin=piece.origin):MultiPolygon {
 const target=center(piece.geometry);let dx=target[0]-origin[0],dy=target[1]-origin[1];
 const length=Math.hypot(dx,dy);if(length<.0001){dx=1;dy=0}else{dx/=length;dy/=length}
 let lo=Infinity,hi=-Infinity;
 for(const poly of piece.geometry)for(const ring of poly)for(const [x,y] of ring){const d=x*dx+y*dy;lo=Math.min(lo,d);hi=Math.max(hi,d)}
 const cut=lo+(hi-lo)*t,span=2000;
 const point=(d:number,s:number):Point=>[dx*d-dy*s,dy*d+dx*s];
 return [[[point(-span,-span),point(cut,-span),point(cut,span),point(-span,span)]]];
}
export type TransferOptions={progress?:(piece:TerritoryPiece,t:number)=>number;mask?:(piece:TerritoryPiece,t:number)=>MultiPolygon|undefined;name?:(name:string)=>string};
export function transferTerritories(key:string,before:Boundary[],after:Boundary[],t:number,options:TransferOptions={}):Boundary[]{
 const collected=new Map<string,{boundary:Boundary;parts:MultiPolygon[]}>();
 function add(b:Boundary|undefined,g:MultiPolygon){if(!b||!g.length)return;const n=options.name?.(b.n)??b.n;let entry=collected.get(n);if(!entry){entry={boundary:{...b,n,estimated:t>0&&t<1},parts:[]};collected.set(n,entry)}entry.parts.push(g)}
 if(t<=0&&!options.progress)return normalize(before).map(r=>boundaryWithGeometry(r.boundary,r.geometry));
 if(t>=1&&!options.progress)return normalize(after).map(r=>boundaryWithGeometry(r.boundary,r.geometry));
 for(const piece of prepareTransfers(key,before,after)){
  if(piece.from?.n===piece.to?.n){add(piece.from,piece.geometry);continue}
  const progress=Math.max(0,Math.min(1,options.progress?.(piece,t)??t));
  if(progress<=0){add(piece.from,piece.geometry);continue}if(progress>=1){add(piece.to,piece.geometry);continue}
  const mask=options.mask?.(piece,progress)??frontMask(piece,progress);
  add(piece.to,safeIntersection(piece.geometry,mask));
  add(piece.from,safeDifference(piece.geometry,mask));
 }
 return [...collected.values()].map(({boundary,parts})=>boundaryWithGeometry(boundary,parts.flat()));
}
/** Apply authored geometry as an ownership override, cutting it out of neighbors. */
export function applyTerritoryOverride(regions:Boundary[],override:Boundary):Boundary[]{
 const g=geometryOf(override),box=bounds(g);
 return [...regions.filter(b=>b.n!==override.n).map(b=>intersects(bounds(geometryOf(b)),box)?boundaryWithGeometry(b,safeDifference(geometryOf(b),g)):b).filter(b=>b.r.length),override];
}
