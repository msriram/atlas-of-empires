import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as clipping from 'polyclip-ts';
import {geoArea} from 'd3-geo';
import {territoryAtYear} from '../app/territory-model.ts';
import {transferTerritories,geometryArea,geometryOf} from '../app/territory-transfers.ts';
import {boundaryGeoJSON} from '../app/territory-geometry.ts';
const square=(n,w,s,e,t)=>({n,p:2,r:[[[w,s],[e,s],[e,t],[w,t]]]});
const area=regions=>regions.reduce((sum,b)=>sum+geometryArea(geometryOf(b)),0);
const sources=new Map();
function source(year){if(!sources.has(year))sources.set(year,JSON.parse(readFileSync(new URL(`../public/historical/${year}.json`,import.meta.url))));return sources.get(year)}
function regions(year){const first=year<-500?-700:-500,last=year<-500?-500:-400;return territoryAtYear(year,first,last,source(first),source(last))}
function contains(b,[x,y]){return geometryOf(b).some(poly=>poly.every((ring,index)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a[1]>y)!==(c[1]>y)&&x<(c[0]-a[0])*(y-a[1])/(c[1]-a[1])+a[0])inside=!inside}return index?!inside:inside}))}

test('conquest conserves occupied land at every annual step with no double ownership',()=>{
 const before=[square('A',0,0,10,10),square('B',10,0,20,10)],after=[square('B',0,0,20,10)];
 let previousA=100;
 for(let year=0;year<=100;year++){
  const out=transferTerritories('conquest',before,after,year/100);
  assert.ok(Math.abs(area(out)-200)<1e-5);
  const a=out.find(b=>b.n==='A'),b=out.find(b=>b.n==='B');
  const size=a?geometryArea(geometryOf(a)):0;assert.ok(size<=previousA+1e-5);previousA=size;
  if(a&&b)assert.ok(geometryArea(clipping.intersection(geometryOf(a),geometryOf(b)))<1e-8);
 }
});

test('holes and disconnected islands remain intact through ownership transfer',()=>{
 const before=[{n:'Old',p:2,r:[],polygons:[[[[0,0],[10,0],[10,10],[0,10]],[[3,3],[3,7],[7,7],[7,3]]],[[[20,0],[22,0],[22,2],[20,2]]]]}],after=before.map(b=>({...b,n:'New'}));
 for(const t of [0,.25,.5,.75,1]){const out=transferTerritories('islands',before,after,t);assert.ok(Math.abs(area(out)-88)<1e-5);assert.ok(!out.some(b=>contains(b,[5,5])))}
});

test('530–460 BCE annual regression: inhabited transfer locations never turn blank',()=>{
 let previous;
 for(let year=-530;year<=-460;year++){
  const out=regions(year),total=area(out);
  assert.ok(total>11000,`${year}: world territory disappeared`);
  if(previous)assert.ok(total/previous>.995,`${year}: abrupt loss of mapped land`);previous=total;
  for(const point of [[44.4,32.5],[52.5,30],[31.1,29.5],[12.5,41.9]])assert.ok(out.some(b=>contains(b,point)),`${year}: ownership gap at ${point}`);
  assert.ok(out.some(b=>b.n==='Achaemenid Empire'));
 }
});

test('Egypt is retained until the dated Persian conquest; Roman naming does not invent a conquest',()=>{
 assert.equal(regions(-530).find(b=>contains(b,[31.1,29.5]))?.n,'Egypt');
 assert.equal(regions(-525).find(b=>contains(b,[31.1,29.5]))?.n,'Achaemenid Empire');
 for(const year of [-500,-499,-460])assert.equal(regions(year).find(b=>contains(b,[12.5,41.9]))?.n,'Roman Republic');
});

test('Alexander death leaves territory for successors, instead of deleting it',()=>{
 const at=territoryAtYear(-323,-323,-300,source(-323),source(-300));
 const next=territoryAtYear(-322,-323,-300,source(-323),source(-300));
 assert.ok(at.some(b=>b.n==='Empire of Alexander'));
 assert.ok(next.some(b=>contains(b,[44.4,32.5])));
 assert.ok(area(next)/area(at)>.99);
});

test('Mongol expansion changes annually and both projections receive the same polygons and holes',()=>{
 const first=territoryAtYear(1226,1200,1279,source(1200),source(1279));
 const next=territoryAtYear(1227,1200,1279,source(1200),source(1279));
 assert.ok(area(next.filter(b=>b.n==='Mongol Empire'))>area(first.filter(b=>b.n==='Mongol Empire')));
 for(const b of next){const geometry=boundaryGeoJSON(b);assert.equal(geometry.coordinates.length,geometryOf(b).length);assert.ok(geoArea(geometry)<Math.PI*2,`${b.n}: inverted globe winding`);assert.ok(!('reveal' in b))}
});
