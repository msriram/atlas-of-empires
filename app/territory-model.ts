import type {MultiPolygon} from './territory-transfers';
import {alexanderFronts} from './data/events';
import {mongolReach,successorSouth} from './data/territory-rules';
import customKeyframes from './data/territory-keyframes.json';
import transferData from './data/territory-transfers.json';
import {fieldShape} from './geometry-field';
import {applyTerritoryOverride,frontMask,transferTerritories,type TerritoryPiece} from './territory-transfers';

export type Point=[number,number];
export type Boundary={n:string;p:number;r:Point[][];polygons?:MultiPolygon;campaign?:boolean;estimated?:boolean};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const canonicalCache=new WeakMap<Boundary[],Boundary[]>();
// Three source maps label the Roman Republic as “Rome”. Normalize that
// historical label so alternating snapshots do not invent a conquest.
function canonical(source:Boundary[],date:number):Boundary[]{
 if(![-500,-323,-200].includes(date))return source;
 let result=canonicalCache.get(source);if(!result){result=source.map(b=>b.n==='Rome'?{...b,n:'Roman Republic'}:b);canonicalCache.set(source,result)}return result;
}
function control(controls:readonly {year:number;[key:string]:number}[],year:number,key:string):number {
 const after=controls.find(c=>c.year>=year);if(!after)return controls.at(-1)![key];const i=controls.indexOf(after);if(!i)return after[key];
 const before=controls[i-1],t=clamp((year-before.year)/(after.year-before.year),0,1);return before[key]+(after[key]-before[key])*t;
}
function eastMask(lon:number):MultiPolygon{return [[[[-180,-90],[lon,-90],[lon,90],[-180,90]]]]}
function campaignMask(year:number,name:string):MultiPolygon|undefined{
 if(name==='Empire of Alexander'&&year>=-336&&year<=-323){const controls=alexanderFronts.map(([year,longitude])=>({year,longitude}));return eastMask(control(controls,year,'longitude'))}
 if(mongolReach.targetNames.includes(name)&&year>=1206&&year<1279){
  const radius=control([{year:1206,radius:0},...mongolReach.controls.slice(1)],year,'radius');
  const south=year<=1260?control(mongolReach.controls,year,'chinaSouth'):control(successorSouth,year,'latitude');
  const [cx,cy]=mongolReach.center;
  // One longitude/latitude mask is clipped before either projection renders it.
  const ring:Point[]=Array.from({length:180},(_,i)=>{const angle=i/180*Math.PI*2;return [cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)]});
  if(name!=='Great Khanate')return [[ring]];
  const clipped:Point[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ia=a[1]>=south,ib=b[1]>=south;if(ia)clipped.push(a);if(ia!==ib){const t=(south-a[1])/(b[1]-a[1]);clipped.push([a[0]+t*(b[0]-a[0]),south])}}
  return clipped.length>=3?[[clipped]]:[];
 }
}
/** Transfer geographic ownership, then project the identical polygons in either view.
 * Sparse snapshots constrain geometry, not the dates of an empire's birth/death. */
export function territoryAtYear(year:number,snapshot:number,nextSnapshot:number|undefined,before:Boundary[],after:Boundary[]):Boundary[]{
 const a=canonical(before,snapshot),b=canonical(after,nextSnapshot??snapshot);
 const t=nextSnapshot===undefined?0:clamp((year-snapshot)/(nextSnapshot-snapshot),0,1);
 const ruleFor=(piece:TerritoryPiece)=>[...transferData.rules].reverse().find(rule=>rule.to===piece.to?.n&&(!rule.from||rule.from===piece.from?.n)&&rule.start>=snapshot&&rule.end<=(nextSnapshot??snapshot));
 let out=transferTerritories(`${snapshot}:${nextSnapshot}`,a,nextSnapshot===undefined?a:b,t,{
  progress:(piece,ratio)=>{
   const name=piece.to?.n;
   if(name==='Empire of Alexander'&&snapshot===-400)return year<-336?0:year>=-323?1:.5;
   if(name&&mongolReach.targetNames.includes(name)&&snapshot===1200)return year<1206?0:year>=1279?1:.5;
   const rule=ruleFor(piece);return rule?clamp((year-rule.start)/(rule.end-rule.start),0,1):ratio;
  },
  mask:(piece,ratio)=>{const special=piece.to&&campaignMask(year,piece.to.n);if(special)return special;const rule=ruleFor(piece);return rule?frontMask(piece,ratio,rule.origin as Point):undefined},
  name:name=>snapshot===1200?(mongolReach.targetNames.includes(name)&&year<=1260?'Mongol Empire':name==='Mongol Empire'&&year>=1261?'Great Khanate':name):name,
 });
 const tracks=customKeyframes.tracks as {name:string;frames:{year:number;r:Point[][];p?:number}[]}[];
 for(const track of tracks){const frames=[...track.frames].sort((a,b)=>a.year-b.year);if(!frames.length||year<frames[0].year||year>frames.at(-1)!.year)continue;
  const earlier=[...frames].reverse().find(frame=>frame.year<=year)!,later=frames.find(frame=>frame.year>year),a:Boundary={n:track.name,p:earlier.p??2,r:earlier.r};
  const override=later?{...a,r:fieldShape(`custom:${track.name}:${earlier.year}:${later.year}`,a,{n:track.name,p:later.p??2,r:later.r},(year-earlier.year)/(later.year-earlier.year)),estimated:true}:a;
  out=applyTerritoryOverride(out,override);
 }
 return out.filter(b=>!(customKeyframes.hidden as string[]).includes(b.n));
}
