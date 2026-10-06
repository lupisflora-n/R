import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadZip} from './helpers.mjs';
import {inspectBackup} from '../src/backup/backup.ts';
import {sha256} from '../src/core.ts';
import {id,now,defaultRecipe} from '../src/model.ts';
import {assemblePdf} from '../src/exports/assemble.ts';
const Zip=loadZip();
const fixture=new Uint8Array(await readFile(new URL('./fixtures/portrait.png',import.meta.url)));
async function pack(change:(m:any,assets:Map<string,Uint8Array>)=>void=()=>{},options:{pdf?:boolean;compress?:boolean}={}):Promise<File> {
  const original=id(),rendered=id(),page=id(),revision=id(),assets=new Map([[original,fixture],[rendered,fixture]]),hash=await sha256(fixture);
  const definitions=[original,rendered].map((ref,i)=>({ref,path:`assets/${ref}.bin`,mime:'image/png',byteCount:fixture.length,sha256:hash,kind:i?'rendered':'original',width:90,height:128}));
  const manifest:any={format:'daily-docscan-backup',version:1,backupSetId:id(),partId:id(),partIndex:1,partCount:1,createdAt:now(),documentDates:['2026-10-03'],pages:[{stableExportId:page,orderIndex:0,title:'架空文書',capturedAt:now(),originalAssetRef:original,renderedAssetRef:rendered,revisionId:revision,currentRevisionRecipe:defaultRecipe(),originalHash:hash,state:'READY'}],pdfs:[],assets:definitions};
  if(options.pdf){const ref=id(),bytes=await assemblePdf(['one'],async()=>({bytes:fixture,mime:'image/png'}),async()=>{});assets.set(ref,bytes);manifest.assets.push({ref,path:`assets/${ref}.bin`,mime:'application/pdf',byteCount:bytes.length,sha256:await sha256(bytes),kind:'pdf'});manifest.pdfs.push({stableExportId:id(),displayName:'確認.pdf',assetRef:ref,orderedPageRefs:[page],orderedRevisionIds:[revision],createdAt:now()});}
  change(manifest,assets);const zip=new Zip();for(const [ref,bytes]of assets)zip.file(`assets/${ref}.bin`,bytes,{createFolders:false});zip.file('manifest.json',JSON.stringify(manifest),{createFolders:false});return new File([await zip.generateAsync({type:'uint8array',compression:options.compress?'DEFLATE':'STORE'})],'test.zip',{type:'application/zip'});
}
test('backup inspection checks hashes, page recipe, and completed PDF bytes',async()=>{
  const inspected=await inspectBackup([await pack(()=>{},{pdf:true})]);assert.equal(inspected.date,'2026-10-03');assert.equal(inspected.pageCount,1);assert.equal(inspected.pdfCount,1);
});
test('backup rejects forged hash, MIME, unsupported version, invalid time and PDF snapshot IDs before writing',async()=>{
  for(const mutate of [
    (m:any)=>{m.assets[0].sha256='0'.repeat(64);},
    (m:any)=>{m.assets[0].mime='image/svg+xml';},
    (m:any)=>{m.version=99;},
    (m:any)=>{m.pages[0].capturedAt=42;},
    (m:any)=>{m.pdfs[0].createdAt=42;},
    (m:any)=>{m.pdfs[0].orderedRevisionIds=[42];},
  ])await assert.rejects(()=>pack(mutate,{pdf:true}).then(file=>inspectBackup([file])));
});
test('multipart backup rejects missing parts and conflicting asset identities across complete parts',async()=>{
  const set=id(),shared=id(),changedFixture=new Uint8Array(await readFile(new URL('./fixtures/landscape.png',import.meta.url))),changedHash=await sha256(changedFixture);
  const make=(index:number)=>pack((m,assets)=>{
    m.backupSetId=set;m.partCount=2;m.partIndex=index;
    const previous=m.assets[0].ref,bytes=index===1?fixture:changedFixture;
    assets.delete(previous);assets.set(shared,bytes);Object.assign(m.assets[0],{ref:shared,path:`assets/${shared}.bin`,sha256:index===1?m.assets[0].sha256:changedHash,byteCount:bytes.length});m.pages[0].originalAssetRef=shared;m.pages[0].originalHash=m.assets[0].sha256;
  });
  const a=await make(1),b=await make(2);await assert.rejects(()=>inspectBackup([a]),/不足/);await assert.rejects(()=>inspectBackup([a,b]),/異なる内容/);
});
test('actual decompression is bounded even with forged central-directory size',async()=>{
  const zip=new Zip();zip.file('manifest.json',' '.repeat(2_000_000));const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});const view=new DataView(bytes.buffer);
  view.setUint32(22,1,true);let central=0;while(view.getUint32(central,true)!==0x02014b50)central++;view.setUint32(central+24,1,true);
  await assert.rejects(()=>inspectBackup([new File([bytes],'bomb.zip')]),/宣言サイズ/);
});
