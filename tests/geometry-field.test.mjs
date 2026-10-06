import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldShape} from '../app/geometry-field.ts';

const square=(west,south,east,north)=>({n:'Example',p:2,r:[[[west,south],[east,south],[east,north],[west,north]]]});
const area=rings=>rings.reduce((sum,ring)=>sum+Math.abs(ring.reduce((v,p,i)=>{const next=ring[(i+1)%ring.length];return v+p[0]*next[1]-next[0]*p[1]},0)/2),0);

test('boundary grows between dated coordinate frames',()=>{
 const a=square(10,40,12,42),b=square(9,39,14,43);
 const values=[0,.25,.5,.75,1].map(t=>area(fieldShape('growth-test',a,b,t)));
 for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1],`area at step ${i} should increase`);
 assert.equal(values[0],4);assert.equal(values.at(-1),20);
});

test('a disappearing region contracts through its own outline',()=>{
 const a=square(10,40,14,44);
 const values=[0,.25,.5,.75,1].map(t=>area(fieldShape('exit-test',a,undefined,t)));
 for(let i=1;i<values.length;i++)assert.ok(values[i]<values[i-1],`area at step ${i} should decrease`);
 assert.equal(values.at(-1),0);
});
