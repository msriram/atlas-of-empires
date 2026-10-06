import type {Boundary,Point} from './territory-model';

type Grid={x0:number;y0:number;step:number;width:number;height:number;a:Float32Array;b:Float32Array;maxA:number;maxB:number};
const cache=new Map<string,Grid>();
function rasterize(rings:Point[][],x0:number,y0:number,step:number,width:number,height:number):Uint8Array{
 const mask=new Uint8Array(width*height);
 for(const ring of rings){if(ring.length<3)continue;
  const ys=ring.map(p=>p[1]);const from=Math.max(0,Math.floor((Math.min(...ys)-y0)/step)-1),to=Math.min(height-1,Math.ceil((Math.max(...ys)-y0)/step)+1);
  for(let y=from;y<=to;y++){const lat=y0+y*step,hits:number[]=[];
   for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[1]<=lat&&b[1]>lat)||(b[1]<=lat&&a[1]>lat))hits.push(a[0]+(lat-a[1])*(b[0]-a[0])/(b[1]-a[1]))}
   hits.sort((a,b)=>a-b);
   for(let j=0;j+1<hits.length;j+=2){const left=Math.max(0,Math.ceil((hits[j]-x0)/step)),right=Math.min(width-1,Math.floor((hits[j+1]-x0)/step));for(let x=left;x<=right;x++)mask[y*width+x]=1}
  }
 }
 return mask;
}
function distanceTo(mask:Uint8Array,width:number,height:number,site:number):Float32Array{
 const d=new Float32Array(width*height),inf=1e6,diag=Math.SQRT2;
 for(let i=0;i<d.length;i++)d[i]=mask[i]===site?0:inf;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;let v=d[i];if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-width]+1);if(x>0)v=Math.min(v,d[i-width-1]+diag);if(x<width-1)v=Math.min(v,d[i-width+1]+diag)}d[i]=v}
 for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;let v=d[i];if(x<width-1)v=Math.min(v,d[i+1]+1);if(y<height-1){v=Math.min(v,d[i+width]+1);if(x>0)v=Math.min(v,d[i+width-1]+diag);if(x<width-1)v=Math.min(v,d[i+width+1]+diag)}d[i]=v}
 return d;
}
function signedDistance(mask:Uint8Array,width:number,height:number){const inside=distanceTo(mask,width,height,0),outside=distanceTo(mask,width,height,1),sdf=new Float32Array(mask.length);let maximum=0;for(let i=0;i<mask.length;i++){sdf[i]=mask[i]?inside[i]:-outside[i];if(sdf[i]>maximum)maximum=sdf[i]}return {sdf,maximum}}
function buildGrid(a:Boundary|undefined,b:Boundary|undefined):Grid|null{
 const rings=[...(a?.r??[]),...(b?.r??[])].filter(r=>r.length>=3);if(!rings.length)return null;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const ring of rings)for(const [x,y] of ring){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
 const extent=Math.max(maxX-minX,maxY-minY,.1),step=Math.max(.01,Math.min(1,extent/120)),pad=Math.max(step*4,extent*.04),x0=minX-pad,y0=minY-pad,width=Math.ceil((maxX-minX+pad*2)/step)+1,height=Math.ceil((maxY-minY+pad*2)/step)+1;
 const A=signedDistance(rasterize(a?.r??[],x0,y0,step,width,height),width,height),B=signedDistance(rasterize(b?.r??[],x0,y0,step,width,height),width,height);
 return {x0,y0,step,width,height,a:A.sdf,b:B.sdf,maxA:A.maximum,maxB:B.maximum};
}
function getGrid(key:string,a:Boundary|undefined,b:Boundary|undefined){let grid=cache.get(key);if(!grid){grid=buildGrid(a,b)??undefined;if(!grid)return null;if(cache.size>450)cache.clear();cache.set(key,grid)}return grid}
function contours(grid:Grid,values:Float32Array):Point[][]{
 const {width,height,x0,y0,step}=grid,vertices=new Map<string,{point:Point;neighbors:string[]}>();
 const add=(key:string,point:Point)=>{if(!vertices.has(key))vertices.set(key,{point,neighbors:[]})};
 const connect=(a:string,b:string)=>{vertices.get(a)!.neighbors.push(b);vertices.get(b)!.neighbors.push(a)};
 for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++){
  const i=y*width+x,v=[values[i],values[i+1],values[i+width+1],values[i+width]],edges:{key:string;point:Point}[]=[];
  const corners:Point[]=[[x0+x*step,y0+y*step],[x0+(x+1)*step,y0+y*step],[x0+(x+1)*step,y0+(y+1)*step],[x0+x*step,y0+(y+1)*step]];
  for(let edge=0;edge<4;edge++){const next=(edge+1)%4;if((v[edge]>0)===(v[next]>0))continue;const t=v[edge]/(v[edge]-v[next]),a=corners[edge],b=corners[next],key=edge===0?`h:${x}:${y}`:edge===1?`v:${x+1}:${y}`:edge===2?`h:${x}:${y+1}`:`v:${x}:${y}`;edges.push({key,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]})}
  if(edges.length===2){for(const e of edges)add(e.key,e.point);connect(edges[0].key,edges[1].key)}
  else if(edges.length===4){for(const e of edges)add(e.key,e.point);const pairs=(v.reduce((sum,n)=>sum+n,0)>0)?[[0,1],[2,3]]:[[0,3],[1,2]];for(const [a,b] of pairs)connect(edges[a].key,edges[b].key)}
 }
 const used=new Set<string>(),rings:Point[][]=[];
 for(const [start,node] of vertices){if(used.has(start)||node.neighbors.length<2)continue;const ring:Point[]=[];let previous='',current=start;for(let guard=0;guard<vertices.size+1;guard++){if(used.has(current)&&current!==start)break;used.add(current);const v=vertices.get(current)!;ring.push(v.point);const next=v.neighbors.find(n=>n!==previous);if(!next||next===start){if(next===start&&ring.length>=3)rings.push(ring);break}previous=current;current=next}}
 return rings.filter(r=>r.length>=3);
}
/** Interpolate signed distance to source geometry. Stable source polygons retain their
 * position while boundaries expand/contract. Result is longitude/latitude rings. */
export function fieldShape(key:string,a:Boundary|undefined,b:Boundary|undefined,t:number):Point[][]{
 if(t<=0)return a?.r??[];if(t>=1)return b?.r??[];
 const grid=getGrid(`${key}:${a?1:0}${b?1:0}`,a,b);if(!grid)return [];
 const values=new Float32Array(grid.a.length);
 if(a&&b){for(let i=0;i<values.length;i++)values[i]=grid.a[i]*(1-t)+grid.b[i]*t}
 else if(a){const offset=(grid.maxA+1)*t;for(let i=0;i<values.length;i++)values[i]=grid.a[i]-offset}
 else if(b){const offset=(grid.maxB+1)*(1-t);for(let i=0;i<values.length;i++)values[i]=grid.b[i]-offset}
 return contours(grid,values);
}
