import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {initializeUpdates} from '../src/update/client.ts';
test('service worker installs complete resources without forced activation and refuses multi-tab update',async()=>{
  const listeners:any={},cached=new Set<string>();let skipped=0,claimed=0,clients=2;
  const self:any={location:'https://local.test/sw.js',addEventListener:(type:string,fn:any)=>listeners[type]=fn,clients:{claim:async()=>{claimed++;},matchAll:async()=>Array(clients).fill({})},skipWaiting:async()=>{skipped++;}};
  const cache={addAll:async(reqs:Request[])=>{for(const r of reqs)cached.add(new URL(r.url).pathname);},match:async(path:any)=>cached.has(typeof path==='string'?new URL(path,self.location).pathname:new URL(path.url).pathname)?new Response('resource'):undefined};
  const localRequest=function(path:string,options:any){return new Request(new URL(path,self.location),options);};
  const source=readFileSync(new URL('../src/update/sw-template.js',import.meta.url),'utf8').replace('__BUILD__','test').replace('__ASSETS__',JSON.stringify(['./index.html','./src/app.js']));
  vm.runInNewContext(source,{self,caches:{open:async()=>cache},Request:localRequest,URL,Set,Error,fetch:async()=>new Response('network')});
  let job:Promise<any>;listeners.install({waitUntil:(p:Promise<any>)=>job=p});await job!;assert.equal(cached.size,2);assert.equal(skipped,0);
  let reply:any;listeners.message({data:{type:'APPLY'},ports:[{postMessage:(v:any)=>reply=v}],waitUntil:(p:Promise<any>)=>job=p});await job!;assert.equal(reply.applied,false);assert.equal(skipped,0);
  clients=1;listeners.message({data:{type:'APPLY'},ports:[{postMessage:(v:any)=>reply=v}],waitUntil:(p:Promise<any>)=>job=p});await job!;assert.equal(reply.applied,true);assert.equal(skipped,1);
});
test('update client blocks new work synchronously before delayed activation acknowledgment',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldDocument=(globalThis as any).document,oldLocation=(globalThis as any).location;
  class Element {children:any[]=[];textContent='';disabled=false;onclick:any;classList={remove:()=>{}};append(...nodes:any[]){this.children.push(...nodes);}replaceChildren(){this.children=[];}}
  const nav=new EventTarget() as any,registration=new EventTarget() as any;let pending:MessagePort|undefined,applying=false,reloads=0;
  registration.active={postMessage:(_:any,ports:MessagePort[])=>ports[0].postMessage({ready:true})};
  registration.waiting={state:'installed',postMessage:(_:any,ports:MessagePort[])=>{pending=ports[0];}};
  nav.register=async()=>registration;
  (globalThis as any).document={createElement:()=>new Element(),addEventListener:()=>{}};
  (globalThis as any).location={reload:()=>{reloads++;}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:nav}});
  try{
    const pill=new Element(),notice=new Element();await initializeUpdates(()=>applying,pill as any,notice as any,value=>applying=value);
    const action=notice.children[1].onclick();assert.equal(applying,true);assert.ok(pending);assert.equal(reloads,0);
    nav.dispatchEvent(new Event('controllerchange'));assert.equal(reloads,0);pending!.postMessage({applied:true});await action;assert.equal(reloads,1);
  }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete(globalThis as any).navigator;(globalThis as any).document=oldDocument;(globalThis as any).location=oldLocation;pending?.close();}
});
