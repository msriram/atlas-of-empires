'use client';
import {useEffect,useMemo,useState} from 'react';
import {Moon,Sun,Bookmark,ChevronLeft,ChevronRight,Play,Pause,Globe2,Info,Share2,Search} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {civilizations,Civilization} from './data/civilizations';

const LAND = [
'M120 135 L150 107 203 83 242 95 271 123 260 154 231 158 222 181 198 191 191 217 168 215 163 196 139 184 119 165 Z',
'M228 214 L250 221 266 247 265 273 288 296 290 330 271 353 261 397 243 407 232 376 225 345 210 312 205 278 213 248 Z',
'M300 133 L323 112 361 105 383 115 403 106 433 115 451 106 485 115 515 102 550 108 589 94 626 101 665 95 703 106 733 126 758 133 783 159 773 185 750 191 732 178 711 182 686 173 667 186 642 181 619 197 591 191 569 204 540 189 521 201 503 190 484 204 459 188 446 168 421 173 404 160 381 171 361 161 339 173 318 159 Z',
'M366 193 L395 188 422 196 447 221 460 250 448 287 438 311 413 344 397 337 389 313 373 293 362 261 354 234 Z',
'M479 207 L508 206 534 222 552 231 555 255 540 268 520 251 507 248 496 229 Z',
'M560 219 L582 225 597 249 607 279 586 304 571 282 561 251 Z',
'M697 252 L731 245 766 254 785 277 776 307 750 315 719 308 690 285 Z',
'M761 334 L778 340 781 357 765 369 752 357 Z',
'M185 101 L192 73 215 55 238 66 229 91 207 102 Z',
'M491 332 L502 324 509 344 499 365 489 352 Z'
];
const formatYear=(y:number)=>y<0?`${Math.abs(y).toLocaleString()} BCE`:y===0?'1 BCE':`${y.toLocaleString()} CE`;
const pos=(lat:number,lon:number)=>({x:(lon+180)*900/360,y:(90-lat)*450/180});
const steps=[10,100,1000];
export default function Explorer(){
 const [year,setYear]=useState(-500); const [step,setStep]=useState(100); const [dark,setDark]=useState(true); const [selected,setSelected]=useState<string|null>(null); const [playing,setPlaying]=useState(false); const [query,setQuery]=useState(''); const [saved,setSaved]=useState<{name:string;year:number}[]>([]); const [showSaved,setShowSaved]=useState(false); const [notice,setNotice]=useState('');
 useEffect(()=>{const p=new URLSearchParams(location.search); const y=Number(p.get('year')); if(p.has('year')&&Number.isFinite(y))setYear(Math.max(-10000,Math.min(2026,y))); const theme=localStorage.getItem('atlas-theme'); if(theme)setDark(theme==='dark'); try{setSaved(JSON.parse(localStorage.getItem('atlas-views')||'[]'))}catch{}},[]);
 useEffect(()=>{localStorage.setItem('atlas-theme',dark?'dark':'light')},[dark]);
 useEffect(()=>{if(!playing)return;const t=setInterval(()=>setYear(v=>v>=2026?(setPlaying(false),2026):Math.min(2026,v+step)),700);return()=>clearInterval(t)},[playing,step]);
 const active=useMemo(()=>civilizations.filter(c=>c.start<=year&&c.end>=year),[year]);
 const listed=active.filter(c=>`${c.name} ${c.region}`.toLowerCase().includes(query.toLowerCase()));
 const focused=active.find(c=>c.id===selected)||null;
 const save=()=>{const name=`${formatYear(year)} view`;const next=[{name,year},...saved.filter(x=>x.year!==year)].slice(0,12);setSaved(next);localStorage.setItem('atlas-views',JSON.stringify(next));setShowSaved(true);setNotice('Saved on this device');setTimeout(()=>setNotice(''),2800)};
 const share=async()=>{const u=new URL(location.href);u.searchParams.set('year',String(year));try{await navigator.clipboard.writeText(u.toString());setNotice('Link copied')}catch{setNotice(u.toString())}setTimeout(()=>setNotice(''),3000)};
 return <main className={`atlas ${dark?'night':'day'}`}>
  <div className="map-backdrop" />
  <svg className="world-map" viewBox="0 0 900 450" role="img" aria-label={`World map showing civilizations active in ${formatYear(year)}`} preserveAspectRatio="xMidYMid meet">
   <defs><pattern id="grid" width="75" height="75" patternUnits="userSpaceOnUse"><path d="M75 0H0V75" fill="none" stroke="currentColor" strokeWidth=".7" opacity=".18"/></pattern><filter id="blur"><feGaussianBlur stdDeviation="16"/></filter></defs>
   <rect width="900" height="450" fill="url(#grid)" />
   <g className="land">{LAND.map((d,i)=><path key={i} d={d}/>)}</g>
   <g className="map-lines"><path d="M0 225H900 M450 0V450"/><path d="M0 112.5H900 M0 337.5H900"/></g>
   {active.map(c=>{const {x,y}=pos(c.lat,c.lon);return <g key={c.id} className={`civilization ${selected===c.id?'chosen':''}`} onClick={()=>setSelected(c.id)} role="button" tabIndex={0} aria-label={`${c.name}, ${c.region}`} onKeyDown={e=>{if(e.key==='Enter')setSelected(c.id)}}><circle cx={x} cy={y} r={c.radius} fill={c.color} opacity=".16" filter="url(#blur)"/><circle cx={x} cy={y} r={Math.max(10,c.radius*.63)} fill={c.color} opacity=".23" stroke={c.color} strokeWidth=".6"/><circle cx={x} cy={y} r="4" fill={c.color} stroke="var(--ocean)" strokeWidth="2"/><text x={x+9} y={y-8} className="map-label">{c.name}</text></g>})}
  </svg>
  <header className="topbar"><div className="brand"><span className="brand-icon"><Globe2 size={22}/></span><div><strong>ATLAS OF EMPIRES</strong><small>Explore civilizations through time</small></div></div><div className="top-actions"><button className="icon-button" aria-label={dark?'Switch to day mode':'Switch to night mode'} onClick={()=>setDark(!dark)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><button className="icon-button" aria-label="Share this year" onClick={share}><Share2 size={18}/></button><button className="save-button" onClick={save}><Bookmark size={16}/> Save view</button></div></header>
  <div className="era-chip">{year<-3000?'EARLY CIVILIZATIONS':year<500?'ANCIENT WORLD':year<1500?'MEDIEVAL WORLD':year<1900?'EARLY MODERN WORLD':'MODERN WORLD'} <span>·</span> {formatYear(year)}</div>
  <section className="side-panel" aria-label="Civilizations"><div className="panel-top"><div><span className="eyebrow">AT THIS MOMENT</span><h1>{formatYear(year)}</h1><p>{active.length} {active.length===1?'civilization':'civilizations'} in this curated map</p></div><button className="panel-info" title="Markers indicate approximate centers and areas of influence, not historical borders"><Info size={18}/></button></div><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a civilization" aria-label="Find a civilization"/></label><div className="civilization-list">{listed.length?listed.map(c=><button key={c.id} className={`civilization-card ${selected===c.id?'active':''}`} onClick={()=>setSelected(c.id)}><span className="card-dot" style={{background:c.color}}/><span><strong>{c.name}</strong><small>{c.region} · {formatYear(c.start)} – {formatYear(c.end)}</small></span><ChevronRight size={16}/></button>):<p className="empty">No civilizations match this year and search. Move the timeline to explore.</p>}</div><div className="panel-foot"><span className="tiny-orbit">◉</span> Approximate locations and dates</div></section>
  {focused&&<section className="detail-card"><button className="detail-close" onClick={()=>setSelected(null)} aria-label="Close details">×</button><span className="eyebrow">{focused.region}</span><h2>{focused.name}</h2><p>{focused.note}</p><small>{formatYear(focused.start)} — {formatYear(focused.end)}</small></section>}
  {showSaved&&<section className="saved-panel"><button className="detail-close" onClick={()=>setShowSaved(false)} aria-label="Close saved views">×</button><span className="eyebrow">SAVED VIEWS</span><h2>Your timeline</h2>{saved.map((s,i)=><button key={i} onClick={()=>{setYear(s.year);setShowSaved(false)}}>{s.name}<ChevronRight size={15}/></button>)}<p>Views are saved on this device. Google account sync requires a Google OAuth client.</p></section>}
  <div className="map-scale">W<span>○</span>E</div>
  <footer className="timeline"><div className="timeline-top"><div className="timeline-heading"><span className="eyebrow">TRAVEL THROUGH TIME</span><strong>{formatYear(year)}</strong></div><div className="timeline-controls"><button className="play" onClick={()=>setPlaying(!playing)} aria-label={playing?'Pause timeline':'Play timeline'}>{playing?<Pause size={17}/>:<Play size={17} fill="currentColor"/>}</button><button className="small-control" onClick={()=>setYear(Math.max(-10000,year-step))} aria-label={`Back ${step} years`}><ChevronLeft size={19}/></button><button className="small-control" onClick={()=>setYear(Math.min(2026,year+step))} aria-label={`Forward ${step} years`}><ChevronRight size={19}/></button><div className="step-picker"><span>STEP</span>{steps.map(s=><button key={s} className={s===step?'selected':''} onClick={()=>setStep(s)}>{s<1000?s:`1k`}y</button>)}</div><button className="views-button" onClick={()=>setShowSaved(!showSaved)}><Bookmark size={15}/> Views</button></div></div><div className="slider-wrap"><Slider min={-10000} max={2026} step={step} value={[year]} onValueChange={v=>setYear(v[0])} aria-label="Historical year"/><div className="tick-labels"><span>10,000 BCE</span><span>7,500 BCE</span><span>5,000 BCE</span><span>2,500 BCE</span><span>1 CE</span><span>Present</span></div></div></footer>
  {notice&&<div className="toast" role="status">{notice}</div>}
 </main>
}
