'use client';
import {useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Minus,Plus,LocateFixed} from 'lucide-react';
import {geoContains,geoOrthographic,geoPath} from 'd3-geo';
import {historicalEvents} from './data/events';
import type {Point} from './territory-model';
import {useAtlas} from './temporal/use-atlas';
import {ownerAt,phaseAt} from './temporal/atlas';
import {displayName,colorKey} from './temporal/chronology';
import {periodNamed} from './data/historical-names';
import empireTimelines from './data/empire-timelines.json';
import type {PlaybackClock} from './temporal/use-playback';
import TerritoryCanvas from './temporal/territory-canvas';
import customKeyframes from './data/territory-keyframes.json';
import {assetPath} from './asset-path';

type Feature={geometry:{type:string;coordinates:unknown}};
type ViewMode='flat'|'globe';
const sourceYears=[-10000,-8000,-5000,-4000,-3000,-2000,-1500,-1000,-700,-500,-400,-323,-300,-200,-100,-1,100,200,300,400,500,600,700,800,900,1000,1100,1200,1279,1300,1400,1492,1500,1530,1600,1650,1700,1715,1783,1800,1815,1878,1880,1900,1914,1920,1930,1938,1945,1960,1994,2000,2010];
const fmt=(y:number)=>y<0?`${Math.abs(y).toLocaleString()} BCE`:`${y} CE`;
const project=([lon,lat]:Point):Point=>[(lon+180)*2.5,(90-lat)*2.5];
function ringPath(ring:Point[]){return ring.map((v,i)=>{const [x,y]=project(v);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`}).join('')+'Z'}
function flatGeometryPaths(geometry:Feature['geometry']):string[]{const c=geometry.coordinates as Point[][]|Point[][][];const polys=geometry.type==='Polygon'?[c as Point[][]]:geometry.type==='MultiPolygon'?c as Point[][][]:[];return polys.flatMap(poly=>poly.map(ringPath))}

export function color(name:string){let n=0;for(const ch of colorKey(name))n=(n*31+ch.charCodeAt(0))|0;return `hsl(${Math.abs(n)%360} 46% 62%)`}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
export default function GeoMap({year,query,selectedName,onSelectName,onNamesChange,mode,focus,history,onYearChange,clock,dark}:{clock:RefObject<PlaybackClock>;dark:boolean;year:number;query:string;selectedName:string|null;onSelectName:(name:string|null)=>void;onNamesChange:(names:string[])=>void;mode:ViewMode;focus:{lon:number;lat:number;id:string}|null;history:number[];onYearChange:(year:number)=>void}){
 const svg=useRef<SVGSVGElement>(null);const drag=useRef<{x:number;y:number;ox:number;oy:number;lon:number;lat:number}|null>(null);const moved=useRef(false);
 const [land,setLand]=useState<string[]>([]);const [landFeatures,setLandFeatures]=useState<Feature[]>([]);
 const [zoom,setZoom]=useState(1);const [center,setCenter]=useState<Point>([450,225]);const [rotation,setRotation]=useState<Point>([-10,-15]);
 useEffect(()=>{if(!focus)return;queueMicrotask(()=>{setCenter(project([focus.lon,focus.lat]));setRotation([-focus.lon,-focus.lat]);setZoom(1.8)})},[focus]);
 const snapshot=sourceYears.filter(v=>v<=year).at(-1)??-10000;
 useEffect(()=>{let alive=true;fetch(assetPath('/ne_110m_land.geojson')).then(r=>r.json()).then(raw=>{const d=raw as {features:Feature[]};if(alive){setLandFeatures(d.features);setLand(d.features.flatMap(f=>flatGeometryPaths(f.geometry)))}}).catch(()=>{});return()=>{alive=false}},[]);
 const {data,error,stats}=useAtlas(year,clock);
 const names=useMemo(()=>{if(!data)return [];const t=phaseAt(data.plan,year);return [...new Set(data.interval.presence.filter(([,a,b])=>t>=a&&t<=b).map(([id])=>displayName(data.manifest.names[id],year)))].sort((a,b)=>a.localeCompare(b))},[data,year]);
 useEffect(()=>{if(data)onNamesChange(names)},[data,names,onNamesChange]);
 const activeEvents=historicalEvents.filter(e=>e.year===year); const customNames=new Set((customKeyframes.tracks as {name:string}[]).map(t=>t.name));
 const selected=selectedName&&names.includes(selectedName)?{n:selectedName,estimated:year!==snapshot}:null;
 const selectedTimeline=empireTimelines.profiles.find(p=>p.names.includes(selectedName||''));
 const selectedPeriod=periodNamed(selectedName||'');
 const view=useMemo(()=>{const w=900/zoom,h=450/zoom;return [center[0]-w/2,center[1]-h/2,w,h] as const},[center,zoom]);
 const repeats=useMemo(()=>{const base=Math.round((center[0]-450)/900);return [base-1,base,base+1]},[center]);
 const projection=useMemo(()=>geoOrthographic().translate([450,225]).scale(205*zoom).rotate(rotation).clipAngle(90),[zoom,rotation]);
 const globePath=useMemo(()=>geoPath(projection),[projection]);
 const globeLandPaths=useMemo(()=>landFeatures.map(f=>globePath(f.geometry as never)||''),[landFeatures,globePath]);
 function zoomAt(factor:number,sx=.5,sy=.5){const next=clamp(zoom*factor,1,mode==='globe'?5:12);if(mode==='flat'){const wx=view[0]+view[2]*sx,wy=view[1]+view[3]*sy;const nw=900/next,nh=450/next;setCenter([wx+(0.5-sx)*nw,clamp(wy+(0.5-sy)*nh,100,350)])}setZoom(next)}
 function onWheel(e:React.WheelEvent<SVGSVGElement>){e.preventDefault();const rect=svg.current?.getBoundingClientRect();if(!rect)return;zoomAt(e.deltaY<0?1.25:.8,clamp((e.clientX-rect.left)/rect.width,0,1),clamp((e.clientY-rect.top)/rect.height,0,1))}
 function pointerDown(e:React.PointerEvent<SVGSVGElement>){if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,ox:center[0],oy:center[1],lon:rotation[0],lat:rotation[1]};moved.current=false;svg.current?.setPointerCapture(e.pointerId)}
 function pointerMove(e:React.PointerEvent<SVGSVGElement>){if(!drag.current)return;const rect=svg.current?.getBoundingClientRect();if(!rect)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>3)moved.current=true;if(mode==='globe'){setRotation([drag.current.lon+dx*.32/Math.sqrt(zoom),drag.current.lat-dy*.32/Math.sqrt(zoom)])}else{const w=900/zoom,h=450/zoom;setCenter([drag.current.ox-dx*w/rect.width,clamp(drag.current.oy-dy*h/rect.height,100,350)])}}
 function pointerUp(e:React.PointerEvent<SVGSVGElement>){
  const wasDragging=!!drag.current;drag.current=null;if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);
  if(!wasDragging||moved.current||e.type==='pointercancel'||!data||!svg.current)return;
  const matrix=svg.current.getScreenCTM();if(!matrix)return;
  const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  if(mode==='globe'&&Math.hypot(point.x-450,point.y-225)>205*zoom)return;
  const coordinate=mode==='globe'?projection.invert?.([point.x,point.y]):[point.x/2.5-180,90-point.y/2.5];
  if(coordinate){
   const longitude=((coordinate[0]+180)%360+360)%360-180;
   const onLand=landFeatures.some(f=>geoContains(f.geometry as never,[longitude,coordinate[1]]));
   const id=onLand?ownerAt(data.plan,longitude,coordinate[1],clock.current.year):0;
   onSelectName(displayName(data.manifest.names[id],clock.current.year)||null);
  }
 }
 const canvasView=mode==='globe'?[0,0,900,450]:view;
 const reset=()=>{setZoom(1);setCenter([450,225]);setRotation([-10,-15])};
 return <>
  {error&&<div className="map-loading" role="alert">{error}</div>}
  <div className={`map-frame ${mode==='globe'?'globe-map':''}`}>
  <svg data-atlas-active={stats.active} data-atlas-cached={stats.cached} data-atlas-loads={stats.started} data-atlas-cancelled={stats.cancelled} data-atlas-bytes={stats.bytes} ref={svg} className="world-map real-map" viewBox={mode==='globe'?'0 0 900 450':view.join(' ')} role="img" aria-label={`${mode==='globe'?'Rotating globe':'Wrapping world map'} with historical boundaries. Drag to ${mode==='globe'?'rotate':'pan'} and scroll to zoom.`} preserveAspectRatio="xMidYMid meet" onWheel={onWheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
   <defs><pattern id="grid" width="75" height="75" patternUnits="userSpaceOnUse"><path d="M75 0H0V75" fill="none" stroke="currentColor" strokeWidth=".7" opacity=".18"/></pattern></defs>
   {mode==='flat'?<>
    <rect x={view[0]} y={view[1]} width={view[2]} height={view[3]} fill="url(#grid)"/>
    {repeats.map(copy=><g key={copy} transform={`translate(${copy*900} 0)`} className="land real-land">{land.map((d,i)=><path key={i} d={d}/>)}</g>)}
   </>:<>
    <path d={globePath({type:'Sphere'} as never)||''} className="globe-ocean"/>
    <g className="land real-land">{globeLandPaths.map((d,i)=><path key={i} d={d}/>)}</g>
   </>}
  </svg>
  {data&&<TerritoryCanvas plan={data.plan} names={data.manifest.names} clock={clock} view={canvasView} rotation={rotation} zoom={zoom} mode={mode} selected={selectedName} query={query} dark={dark} flatLandPaths={land} globeLandPaths={globeLandPaths} repeats={repeats}/>}
  <svg className="map-event-overlay" viewBox={mode==='globe'?'0 0 900 450':view.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
   {mode==='flat'?repeats.map(copy=><g key={copy} transform={`translate(${copy*900} 0)`}>
    <g className="map-lines"><path d="M0 225H900 M450 0V450"/><path d="M0 112.5H900 M0 337.5H900"/></g>
    {activeEvents.map(e=>{const [x,y]=project([e.lon,e.lat]);return <g key={e.id} className="historical-event" transform={`translate(${x} ${y})`}><circle r="9" className="event-halo"/><circle r="4" className="event-core"/></g>})}
   </g>):<>
    {activeEvents.map(e=>{const point=globePath({type:'Point',coordinates:[e.lon,e.lat]} as never);const p=projection([e.lon,e.lat]);return point&&p?<g key={e.id} className="historical-event" transform={`translate(${p[0]} ${p[1]})`}><circle r="9" className="event-halo"/><circle r="4" className="event-core"/></g>:null})}
    <path d={globePath({type:'Sphere'} as never)||''} className="globe-rim"/>
   </>}

  </svg>
  </div>
  <div className="zoom-controls"><button aria-label="Zoom in" onClick={()=>zoomAt(1.5)}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>zoomAt(1/1.5)}><Minus size={18}/></button><button aria-label="Reset map view" onClick={reset}><LocateFixed size={18}/></button></div>
  <div className="boundary-source">Boundaries: {fmt(snapshot)} source map · dated campaigns and estimated local fronts <span>·</span> Scroll to zoom · Drag to {mode==='globe'?'rotate':'pan'}</div>
  {activeEvents[0]&&<aside className="event-detail"><span className="eyebrow">KEY EVENT · {fmt(year)}</span><h2>{activeEvents[0].title}</h2><p>{activeEvents[0].summary}</p><a href={activeEvents[0].source} target="_blank" rel="noreferrer">Historical source</a></aside>}
  {selected&&<aside className="boundary-detail"><button aria-label="Close boundary details" onClick={()=>onSelectName(null)}>×</button><span className="eyebrow">{selectedPeriod?'HISTORICAL PERIOD':selectedTimeline?'DATED CAMPAIGNS + ESTIMATES':'SOURCE MAP + ESTIMATES'} · {selectedPeriod?`${fmt(selectedPeriod.start)}–${fmt(selectedPeriod.end)}`:selectedTimeline?fmt(year):fmt(snapshot)}</span><h2>{selected.n}</h2><p>{selectedPeriod?selectedPeriod.note:customNames.has(selected.n)?'Estimated movement between this region’s authored coordinate keyframes. Identical frames keep the boundary still.':selectedTimeline?'Dated regional campaigns control recorded changes. Other movement between source outlines follows an approximate local front; it is not a surveyed annual border.':'Annual movement between dated source outlines is an approximate local front, not a surveyed annual border.'}</p>{selectedTimeline&&<div className="region-events"><span className="eyebrow">INDEPENDENT TERRITORIAL TIMELINE</span>{selectedTimeline.stages.map(stage=><button key={stage.id} onClick={()=>onYearChange(stage.start)}><small>{fmt(stage.start)}–{fmt(stage.end)}</small>{stage.id.replaceAll('-',' ')} · {stage.action}</button>)}</div>}{!selectedPeriod&&history.length>0&&<div className="region-history"><span className="eyebrow">{customNames.has(selected.n)?'CUSTOM KEYFRAMES':'IN THE SOURCE MAPS'}</span><p>{customNames.has(selected.n)?'Defined':'Mapped'} in {history.length} dated {customNames.has(selected.n)?'keyframes':'snapshots'}, from {fmt(history[0])} to {fmt(history[history.length-1])}. These are map coverage dates, not founding or ending dates.</p><div>{[...new Set([history[0],history[Math.floor(history.length/2)],history[history.length-1]])].map(y=><button key={y} onClick={()=>onYearChange(y)}>{fmt(y)}</button>)}</div></div>}{historicalEvents.filter(e=>e.empire===selected.n).length>0&&<div className="region-events"><span className="eyebrow">RELATED EVENTS</span>{historicalEvents.filter(e=>e.empire===selected.n).map(e=><button key={e.id} onClick={()=>onYearChange(e.year)}><small>{fmt(e.year)}</small>{e.title}</button>)}</div>}{!customNames.has(selected.n)&&<a href={selectedPeriod?.source||selectedTimeline?.source||'https://github.com/aourednik/historical-basemaps'} target="_blank" rel="noreferrer">{selectedPeriod?'Period chronology':'View data source'}</a>}</aside>}
 </>
}
