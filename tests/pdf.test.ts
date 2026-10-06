import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {assemblePdf} from '../src/exports/assemble.ts';
import {PDFDocument} from '../vendor/pdf-lib.js';
const portrait=new Uint8Array(await readFile(new URL('./fixtures/portrait.png',import.meta.url)));
const landscape=new Uint8Array(await readFile(new URL('./fixtures/landscape.png',import.meta.url)));
test('1/5/10-page PDF preserves selected order and A4 portrait/landscape structure',async()=>{
  for(const count of [1,5,10]) {
    const ids=Array.from({length:count},(_,i)=>String(i));const loaded:string[]=[],progress:number[]=[];
    const bytes=await assemblePdf(ids,async id=>{loaded.push(id);return{bytes:Number(id)%2?landscape:portrait,mime:'image/png'};},async n=>{progress.push(n);});
    const parsed=await PDFDocument.load(bytes);assert.equal(parsed.getPageCount(),count);assert.deepEqual(loaded,ids);assert.equal(progress.at(-1),90);
    parsed.getPages().forEach((p:any,i:number)=>{assert.equal(p.getWidth()>p.getHeight(),i%2===1);});
    assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
    await writeFile(new URL(`../evidence/synthetic-${count}-pages.pdf`,import.meta.url),bytes);
  }
});
test('PDF rejects empty/duplicate selection, unsupported MIME and cancellation without changing source',async()=>{
  const load=async()=>({bytes:portrait,mime:'image/png'}),noop=async()=>{};
  await assert.rejects(()=>assemblePdf([],load,noop));await assert.rejects(()=>assemblePdf(['x','x'],load,noop));
  await assert.rejects(()=>assemblePdf(['x'],async()=>({bytes:portrait,mime:'image/svg+xml'}),noop));
  const controller=new AbortController();controller.abort();await assert.rejects(()=>assemblePdf(['x'],load,noop,controller.signal),{name:'AbortError'});
  const before=portrait.slice();const stop=new AbortController();await assert.rejects(()=>assemblePdf(['a','b'],load,async()=>stop.abort(),stop.signal),{name:'AbortError'});assert.deepEqual(portrait,before);
});
