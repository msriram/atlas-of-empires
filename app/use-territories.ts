'use client';
import {useEffect,useRef,useState} from 'react';
import type {Boundary} from './territory-model';
type Request={year:number;snapshot:number;nextSnapshot?:number};
export function useTerritories(request:Request){
 const {year,snapshot,nextSnapshot}=request;
 const [result,setResult]=useState<{year:number|null;boundaries:Boundary[];error?:string}>({year:null,boundaries:[]});
 const worker=useRef<Worker|null>(null),busy=useRef(false),latest=useRef(request);
 function dispatch(){if(!worker.current||busy.current)return;busy.current=true;worker.current.postMessage(latest.current)}
 useEffect(()=>{
  // A generated same-origin asset works in both vinext development and hosting.
  const instance=new Worker('/territory-worker.js',{type:'module'});worker.current=instance;
  instance.onmessage=event=>{busy.current=false;const data=event.data as {year:number;boundaries?:Boundary[];error?:string};
   if(data.year===latest.current.year){if(data.error)setResult(old=>({...old,error:data.error}));else setResult({year:data.year,boundaries:data.boundaries!})}else dispatch();
  };
  instance.onerror=()=>{busy.current=false;setResult(old=>({...old,error:'Unable to calculate the map. Reload to retry.'}))};
  dispatch();return()=>{instance.terminate();worker.current=null;busy.current=false};
 },[]);
 useEffect(()=>{latest.current={year,snapshot,nextSnapshot};dispatch()},[year,snapshot,nextSnapshot]);
 return {...result,loading:result.year!==year&&!result.error};
}
