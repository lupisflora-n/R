import { get, list, write, makeAsset } from '../storage/db.ts';
import type { Asset, Day, Page, PdfExport, Recipe, Revision } from '../model.ts';
import { id, now } from '../model.ts';
import { sha256, validateRecipe, validDate } from '../core.ts';
import { checkZip, MAX_PACK_BYTES } from './zip-guard.ts';
import { PDFDocument } from '../../vendor/pdf-lib.js';

type PackedAsset={ref:string;path:string;mime:string;byteCount:number;sha256:string;kind:Asset['kind'];width?:number;height?:number};
type PackedPage={stableExportId:string;orderIndex:number;title:string;capturedAt:string;deletedAt?:string;originalAssetRef:string;renderedAssetRef?:string;revisionId?:string;currentRevisionRecipe?:Recipe;originalHash:string;state:Page['state']};
type PackedPdf={stableExportId:string;displayName:string;assetRef:string;orderedPageRefs:string[];orderedRevisionIds:string[];createdAt:string};
type Manifest={format:'daily-docscan-backup';version:1;backupSetId:string;partId:string;partIndex:number;partCount:number;createdAt:string;documentDates:string[];pages:PackedPage[];pdfs:PackedPdf[];assets:PackedAsset[]};
type Part={manifest:Manifest;assets:Map<string,Asset>;digest:string};
const uuid=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const timestamp=(v:unknown):v is string=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));
function zipLibrary(): any {
  const Zip=(globalThis as unknown as {JSZip:any}).JSZip;
  if(!Zip)throw new Error('ZIP資源を読み込めません。');return Zip;
}
export async function exportDay(day:Day,onProgress:(value:string)=>void):Promise<{name:string;blob:Blob}[]> {
  const pages=(await list('pages')).filter(p=>p.dayId===day.id).sort((a,b)=>a.orderIndex-b.orderIndex);
  const pdfs=(await list('pdfs')).filter(p=>p.dayId===day.id);
  if(!pages.length)throw new Error('保存した写真がありません。');
  const setId=id(),groups:{pages:PackedPage[];pdfs:PackedPdf[];assets:Map<string,Asset>;bytes:number}[]=[];
  const fresh=()=>{const group={pages:[] as PackedPage[],pdfs:[] as PackedPdf[],assets:new Map<string,Asset>(),bytes:0};groups.push(group);return group;};
  let group=fresh();
  for(const page of pages) {
    const original=await get('assets',page.originalAssetId);if(!original)throw new Error('原本がありません。書き出しを停止しました。');
    const revision=page.activeRevisionId?await get('revisions',page.activeRevisionId):undefined;
    const rendered=revision?await get('assets',revision.renderedAssetId):undefined;
    if(revision && !rendered)throw new Error('編集画像がありません。');
    const assetList=[original,...(rendered?[rendered]:[])],sum=assetList.reduce((s,a)=>s+a.byteCount,0);
    if(sum>MAX_PACK_BYTES-200_000)throw new Error('1枚の原本と編集版が50 MBを超え、原本を含む復元パックを作れません。原本を落とさず処理を停止しました。');
    if(group.pages.length>=10 || group.bytes+sum>MAX_PACK_BYTES-200_000)group=fresh();
    for(const asset of assetList)if(!group.assets.has(asset.id)){group.assets.set(asset.id,asset);group.bytes+=asset.byteCount;}
    group.pages.push({stableExportId:page.id,orderIndex:page.orderIndex,title:page.title,capturedAt:page.capturedAt,deletedAt:page.deletedAt,originalAssetRef:original.id,originalHash:original.sha256,renderedAssetRef:rendered?.id,revisionId:revision?.id,currentRevisionRecipe:revision?.recipe,state:page.state});
  }
  for(const pdf of pdfs) {
    const asset=await get('assets',pdf.assetId);if(!asset)throw new Error('完成PDFがありません。');
    if(asset.byteCount>MAX_PACK_BYTES-200_000)throw new Error('完成PDFが50 MBを超えています。原本を落とさず停止しました。');
    if(group.bytes+asset.byteCount>MAX_PACK_BYTES-200_000)group=fresh();
    group.assets.set(asset.id,asset);group.bytes+=asset.byteCount;
    const pageRefs=pdf.orderedPageIds?[...pdf.orderedPageIds]:[];
    if(!pdf.orderedPageIds)for(const revisionId of pdf.orderedRevisionIds){const revision=await get('revisions',revisionId);if(!revision)throw new Error('PDF参照が欠けています。');pageRefs.push(revision.pageId);}
    group.pdfs.push({stableExportId:pdf.id,displayName:pdf.displayName,assetRef:asset.id,orderedPageRefs:pageRefs,orderedRevisionIds:pdf.orderedRevisionIds,createdAt:pdf.createdAt});
  }
  if(groups.reduce((sum,g)=>sum+g.bytes+200_000,0)>100*1024*1024)throw new Error('この日付の復元用データは合計100 MBの安全上限を超えます。復元できないZIPは作らず停止しました。PDFの外部保存は利用できます。大容量の段階的復元は次の実装で対応します。');
  const files=[];
  for(let i=0;i<groups.length;i++) {
    onProgress(`復元用ZIP ${i+1}/${groups.length} を作成中`);
    const g=groups[i],zip=new (zipLibrary())(),assets:PackedAsset[]=[];
    for(const asset of g.assets.values()) {
      if(await sha256(asset.blob)!==asset.sha256)throw new Error('画像のハッシュが一致しません。');
      const path=`assets/${asset.id}.bin`;
      zip.file(path,await asset.blob.arrayBuffer(),{createFolders:false});
      assets.push({ref:asset.id,path,mime:asset.mime,byteCount:asset.byteCount,sha256:asset.sha256,kind:asset.kind,width:asset.width,height:asset.height});
    }
    const manifest:Manifest={format:'daily-docscan-backup',version:1,backupSetId:setId,partId:id(),partIndex:i+1,partCount:groups.length,createdAt:now(),documentDates:[day.documentDate],pages:g.pages,pdfs:g.pdfs,assets};
    zip.file('manifest.json',JSON.stringify(manifest),{createFolders:false});
    const bytes=await zip.generateAsync({type:'uint8array',compression:'STORE'});checkZip(bytes);
    const blob=new Blob([bytes],{type:'application/zip'});
    files.push({name:`${day.documentDate}_復元用_${String(i+1).padStart(2,'0')}.zip`,blob});
    await write(['backups'],tx=>tx.objectStore('backups').add({id:id(),dayId:day.id,packageId:manifest.partId,result:'requested',createdAt:now()}));
  }
  return files;
}
async function boundedRead(entry:any,expected:number):Promise<Uint8Array> {
  return new Promise((resolve,reject)=>{
    const chunks:Uint8Array[]=[];let total=0,done=false;
    const stream=entry.internalStream('uint8array');
    stream.on('data',(chunk:Uint8Array)=>{
      if(done)return;
      total+=chunk.length;
      if(total>expected){done=true;stream.pause();reject(new Error('ZIPの実展開量が宣言サイズを超えます。'));return;}
      chunks.push(chunk);
    });
    stream.on('error',(e:Error)=>{if(!done){done=true;reject(e);}});
    stream.on('end',()=>{if(done)return;done=true;if(total!==expected){reject(new Error('ZIPのサイズが一致しません。'));return;}const result=new Uint8Array(total);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}resolve(result);});
    stream.resume();
  });
}
function matchesMime(bytes:Uint8Array,mime:string):boolean {
  if(mime==='image/jpeg')return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if(mime==='image/png')return bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
  if(mime==='application/pdf')return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  if(mime==='image/heic' || mime==='image/heif')return new TextDecoder().decode(bytes.slice(4,8))==='ftyp';
  return false;
}
export async function inspectBackup(files:File[]):Promise<{date:string;pageCount:number;pdfCount:number;parts:Part[]}> {
  if(!files.length || files.length>100)throw new Error('復元用ZIPを全ての部まとめて選択してください。');
  const maxTotal=100*1024*1024;
  if(files.reduce((sum,file)=>sum+file.size,0)>maxTotal)throw new Error('まとめて復元するZIPは合計100 MB以下です。大きい日付の分割復元は次の実装で対応します。既存データは変更していません。');
  let totalExpansion=0;
  const parts:Part[]=[];
  for(const file of files) {
    if(file.size>MAX_PACK_BYTES)throw new Error('ZIPのサイズが50 MBを超えています。');
    const bytes=new Uint8Array(await file.arrayBuffer());const budget=checkZip(bytes);totalExpansion+=budget.expandedBytes;
    if(totalExpansion>maxTotal)throw new Error('復元全体の展開量が100 MBを超えるため停止しました。既存データは変更していません。');
    const zip=await zipLibrary().loadAsync(bytes,{checkCRC32:false,createFolders:false});
    const entry=zip.file('manifest.json');
    const rawBytes=await boundedRead(entry,Math.min(1_000_000,entry._data.uncompressedSize));
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(rawBytes);
    const m:Manifest=JSON.parse(raw);
    if(m.format!=='daily-docscan-backup' || m.version!==1 || !uuid(m.backupSetId) || !uuid(m.partId) || !timestamp(m.createdAt) || !Number.isInteger(m.partIndex) || !Number.isInteger(m.partCount) || m.partCount<1 || m.partCount>100 || m.partIndex<1 || m.partIndex>m.partCount || !Array.isArray(m.documentDates) || m.documentDates.length!==1 || !validDate(m.documentDates[0]) || !Array.isArray(m.pages) || m.pages.length>10 || !Array.isArray(m.pdfs) || m.pdfs.length>100 || !Array.isArray(m.assets) || m.assets.length>199)throw new Error('復元形式・版・日付・件数が不正です。');
    const assets=new Map<string,Asset>(),expected=new Set(['manifest.json']);
    for(const packed of m.assets) {
      if(!uuid(packed.ref) || packed.path!==`assets/${packed.ref}.bin` || assets.has(packed.ref) || !Number.isInteger(packed.byteCount) || packed.byteCount<1 || packed.byteCount>MAX_PACK_BYTES || !/^[0-9a-f]{64}$/.test(packed.sha256) || !['original','rendered','pdf'].includes(packed.kind))throw new Error('復元用の画像定義が不正です。');
      if((packed.kind==='pdf')!==(packed.mime==='application/pdf') || (packed.kind==='rendered' && !['image/jpeg','image/png'].includes(packed.mime)))throw new Error('復元用の画像役割・MIMEが不正です。');
      const entry=zip.file(packed.path);if(!entry)throw new Error('復元用の画像が不足しています。');
      const data=await boundedRead(entry,packed.byteCount);
      if(!matchesMime(data,packed.mime) || await sha256(data)!==packed.sha256)throw new Error('画像の形式・ハッシュが一致しません。');
      const blob=new Blob([data],{type:packed.mime});assets.set(packed.ref,{...packed,id:packed.ref,blob,createdAt:now()});expected.add(packed.path);
    }
    if(Object.keys(zip.files).some(p=>!expected.has(p)))throw new Error('ZIPに定義外のファイルがあります。');
    for(const page of m.pages) {
      if(page.deletedAt!==undefined && !timestamp(page.deletedAt))throw new Error('ごみ箱の日時が不正です。');
      if(!uuid(page.stableExportId) || !timestamp(page.capturedAt) || !Number.isInteger(page.orderIndex) || page.orderIndex<0 || typeof page.title!=='string' || page.title.length>100 || !['DRAFT','READY','DRAFT_UNSUPPORTED'].includes(page.state))throw new Error('ページ定義が不正です。');
      const original=assets.get(page.originalAssetRef);if(!original || original.kind!=='original' || original.sha256!==page.originalHash)throw new Error('ページ原本が一致しません。');
      if(page.renderedAssetRef){if(assets.get(page.renderedAssetRef)?.kind!=='rendered' || !uuid(page.revisionId))throw new Error('編集版がありません。');validateRecipe(page.currentRevisionRecipe);}
      else if(page.state==='READY' || page.currentRevisionRecipe || page.revisionId)throw new Error('確定編集版が不足しています。');
    }
    for(const pdf of m.pdfs) {
      if(!uuid(pdf.stableExportId) || !timestamp(pdf.createdAt) || typeof pdf.displayName!=='string' || pdf.displayName.length>104 || !Array.isArray(pdf.orderedPageRefs) || !pdf.orderedPageRefs.length || pdf.orderedPageRefs.length>10 || pdf.orderedPageRefs.some(p=>!uuid(p)) || new Set(pdf.orderedPageRefs).size!==pdf.orderedPageRefs.length || !Array.isArray(pdf.orderedRevisionIds) || pdf.orderedRevisionIds.length!==pdf.orderedPageRefs.length || pdf.orderedRevisionIds.some(p=>!uuid(p)))throw new Error('PDF定義が不正です。');
      const asset=assets.get(pdf.assetRef);if(!asset || asset.kind!=='pdf')throw new Error('復元PDFがありません。');
      const loaded=await PDFDocument.load(await asset.blob.arrayBuffer());if(loaded.getPageCount()!==pdf.orderedPageRefs.length)throw new Error('復元PDFの枚数が一致しません。');
    }
    parts.push({manifest:m,assets,digest:await sha256(bytes)});
  }
  const first=parts[0].manifest,set=first.backupSetId;
  if(parts.length!==first.partCount || new Set(parts.map(p=>p.manifest.partIndex)).size!==parts.length || new Set(parts.map(p=>p.manifest.partId)).size!==parts.length || parts.some(p=>p.manifest.backupSetId!==set || p.manifest.partCount!==first.partCount || p.manifest.documentDates[0]!==first.documentDates[0]))throw new Error('不足する部、重複する部、または別のバックアップが混ざっています。全ての部を選択してください。');
  const pageRefs=new Set<string>();
  const allAssets=new Map<string,Asset>(),pdfRefs=new Set<string>();
  for(const part of parts) {
    for(const asset of part.assets.values()) {
      const prior=allAssets.get(asset.id);
      if(prior && (prior.sha256!==asset.sha256 || prior.kind!==asset.kind || prior.mime!==asset.mime || prior.byteCount!==asset.byteCount))throw new Error('複数の部で同じ画像IDに異なる内容があります。');
      allAssets.set(asset.id,asset);
    }
    for(const pdf of part.manifest.pdfs){if(pdfRefs.has(pdf.stableExportId))throw new Error('復元PDFが重複しています。');pdfRefs.add(pdf.stableExportId);}
  }
  for(const part of parts)for(const page of part.manifest.pages){if(pageRefs.has(page.stableExportId))throw new Error('復元ページが重複しています。');pageRefs.add(page.stableExportId);}
  for(const part of parts)for(const pdf of part.manifest.pdfs)if(pdf.orderedPageRefs.some(p=>!pageRefs.has(p)))throw new Error('PDFに必要なページ部が不足しています。');
  return {date:first.documentDates[0],pageCount:pageRefs.size,pdfCount:parts.reduce((s,p)=>s+p.manifest.pdfs.length,0),parts};
}
export async function restoreBackup(parts:Part[]):Promise<Day> {
  const setId=parts[0].manifest.backupSetId,digest=await sha256(new TextEncoder().encode(parts.map(p=>p.digest).sort().join('|')));
  const previous=await get('imports',setId);
  if(previous){if(previous.digest!==digest)throw new Error('同じバックアップIDに別の内容があります。');const day=await get('days',previous.dayId);if(!day)throw new Error('以前の復元先がありません。');return day;}
  const day:Day={id:id(),documentDate:parts[0].manifest.documentDates[0],zoneId:Intl.DateTimeFormat().resolvedOptions().timeZone,createdAt:now(),updatedAt:now()};
  const assets:Asset[]=[],pages:Page[]=[],revisions:Revision[]=[],pdfs:PdfExport[]=[];
  const assetMap=new Map<string,string>(),pageMap=new Map<string,string>();
  for(const part of parts)for(const asset of part.assets.values()){
    if(assetMap.has(asset.id))continue;
    const newId=id();assetMap.set(asset.id,newId);assets.push({...asset,id:newId});
  }
  for(const part of parts)for(const p of part.manifest.pages) {
    const pageId=id(),revisionId=p.renderedAssetRef?id():undefined;pageMap.set(p.stableExportId,pageId);
    const page:Page={id:pageId,dayId:day.id,orderIndex:p.orderIndex,title:p.title,capturedAt:p.capturedAt,deletedAt:p.deletedAt,originalAssetId:assetMap.get(p.originalAssetRef)!,activeRevisionId:revisionId,state:p.state};pages.push(page);
    if(revisionId)revisions.push({id:revisionId,pageId,originalHash:p.originalHash,recipe:p.currentRevisionRecipe!,filterVersion:1,renderedAssetId:assetMap.get(p.renderedAssetRef!)!,createdAt:now()});
  }
  for(const part of parts)for(const p of part.manifest.pdfs) {
    // Keep historical snapshot IDs as provenance, never invent editable old images.
    const refs=p.orderedRevisionIds || [];
    pdfs.push({id:id(),dayId:day.id,displayName:p.displayName,assetId:assetMap.get(p.assetRef)!,orderedRevisionIds:refs,orderedPageIds:p.orderedPageRefs.map(ref=>pageMap.get(ref)!),fingerprint:await sha256(new TextEncoder().encode(refs.join('|'))),status:'READY',createdAt:p.createdAt});
  }
  await write(['days','assets','pages','revisions','pdfs','imports','backups'],tx=>{
    tx.objectStore('days').add(day);for(const a of assets)tx.objectStore('assets').add(a);for(const p of pages)tx.objectStore('pages').add(p);for(const r of revisions)tx.objectStore('revisions').add(r);for(const p of pdfs)tx.objectStore('pdfs').add(p);
    tx.objectStore('imports').add({id:setId,digest,dayId:day.id});tx.objectStore('backups').add({id:id(),dayId:day.id,packageId:setId,result:'verified-import',createdAt:now()});
  });
  return day;
}
