import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkZip,MAX_EXPANDED_BYTES} from '../src/backup/zip-guard.ts';
import {loadZip} from './helpers.mjs';
const JSZip=loadZip();
test('zip preflight accepts own archive and rejects traversal, huge declared expansion and missing manifest',async()=>{
  const zip=new JSZip();zip.file('manifest.json','{}');
  const valid=await zip.generateAsync({type:'uint8array'});checkZip(valid);
  const unsafe=new JSZip();unsafe.file('../manifest.json','{}');const bad=await unsafe.generateAsync({type:'uint8array'});assert.throws(()=>checkZip(new Uint8Array(bad)));
  const bomb=valid.slice(),view=new DataView(bomb.buffer);let offset=0;
  while(view.getUint32(offset,true)!==0x02014b50)offset++;
  view.setUint32(offset+24,MAX_EXPANDED_BYTES+1,true);assert.throws(()=>checkZip(bomb));
  assert.throws(()=>checkZip(new Uint8Array(22)));
});
test('duplicate ZIP entry paths are rejected before a ZIP library can overwrite them',async()=>{
  const a='assets/00000000-0000-0000-0000-000000000001.bin',b='assets/00000000-0000-0000-0000-000000000002.bin';
  const zip=new JSZip();zip.file('manifest.json','{}');zip.file(a,'a',{createFolders:false});zip.file(b,'b',{createFolders:false});
  const bytes=await zip.generateAsync({type:'uint8array'}),source=new TextEncoder().encode(b),target=new TextEncoder().encode(a);
  for(let i=0;i<=bytes.length-source.length;i++)if(source.every((byte,j)=>bytes[i+j]===byte)){bytes.set(target,i);i+=source.length-1;}
  assert.throws(()=>checkZip(bytes),/重複/);
});
