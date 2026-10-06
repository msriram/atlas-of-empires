import {territoryAtYear,type Boundary} from './territory-model';
const sources=new Map<number,Boundary[]>();
async function source(year:number){if(!sources.has(year)){const response=await fetch(`/historical/${year}.json`);if(!response.ok)throw new Error(`Historical map ${year} could not be loaded`);sources.set(year,await response.json())}return sources.get(year)!}
self.onmessage=async(event:MessageEvent<{year:number;snapshot:number;nextSnapshot?:number}>)=>{
 const {year,snapshot,nextSnapshot}=event.data;
 try{const [before,after]=await Promise.all([source(snapshot),nextSnapshot===undefined?Promise.resolve([]):source(nextSnapshot)]);
  self.postMessage({year,boundaries:territoryAtYear(year,snapshot,nextSnapshot,before,after)});
 }catch(error){self.postMessage({year,error:error instanceof Error?error.message:'Unable to calculate boundaries'})}
};
