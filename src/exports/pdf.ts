import { PDFDocument } from '../../vendor/pdf-lib.js';
import { get, write, makeAsset, currentToken } from '../storage/db.ts';
import { id, now, MAX_PDF_PAGES } from '../model.ts';
import type { Job, Page, PdfExport, Revision } from '../model.ts';
import { pdfName, sha256 } from '../core.ts';
import { assemblePdf } from './assemble.ts';
import { withCurrentPdfInputs } from './snapshot.ts';

export async function createPdf(dayId:string, orderedPages:Page[], name:string, onProgress:(n:number)=>void, signal?:AbortSignal):Promise<PdfExport> {
  if(!orderedPages.length || orderedPages.length>MAX_PDF_PAGES)throw new Error('PDFは1〜10枚を選んでください。多い場合は分けて作成できます。');
  if(new Set(orderedPages.map(p=>p.id)).size!==orderedPages.length || orderedPages.some(p=>p.dayId!==dayId || p.deletedAt || p.state!=='READY' || !p.activeRevisionId))throw new Error('同じ日付の保存済み編集版を重複せず選んでください。');
  const revisionIds=orderedPages.map(p=>p.activeRevisionId!);
  const fence=currentToken(),job:Job={id:id(),kind:'pdf',state:'RUNNING',inputSnapshot:revisionIds,fencingToken:fence,progress:0,createdAt:now()};
  await write(['pages','jobs'],tx=>withCurrentPdfInputs(tx,dayId,orderedPages,()=>tx.objectStore('jobs').add(job)),fence);
  try {
    const bytes=await assemblePdf(revisionIds,async revisionId=>{
      const revision=await get('revisions',revisionId) as Revision;
      if(!revision || revision.pageId!==orderedPages[revisionIds.indexOf(revisionId)].id)throw new Error('選択版が一致しません。PDFを作り直してください。');
      const asset=await get('assets',revision.renderedAssetId);
      if(!asset || !['image/jpeg','image/png'].includes(asset.mime) || await sha256(asset.blob)!==asset.sha256)throw new Error('画像の整合性を確認できません。原本は保持しました。');
      return {bytes:new Uint8Array(await asset.blob.arrayBuffer()),mime:asset.mime};
    },async progress=>{onProgress(progress);
      await write(['jobs'],tx=>tx.objectStore('jobs').put({...job,progress}),fence);
    },signal);
    await write(['jobs'],tx=>tx.objectStore('jobs').put({...job,state:'VERIFYING',progress:95}),fence);
    if(signal?.aborted)throw new DOMException('取消しました','AbortError');
    const verified=await PDFDocument.load(bytes,{ignoreEncryption:false});
    if(verified.getPageCount()!==revisionIds.length || verified.getPages().some((p:{getWidth:()=>number;getHeight:()=>number})=>p.getWidth()<=0 || p.getHeight()<=0))throw new Error('PDFの検査に失敗しました。共有は行いません。');
    const blob=new Blob([bytes],{type:'application/pdf'}),asset=await makeAsset(blob,'pdf');
    const record:PdfExport={id:job.id,dayId,displayName:pdfName(name),orderedRevisionIds:revisionIds,orderedPageIds:orderedPages.map(p=>p.id),fingerprint:await sha256(new TextEncoder().encode(revisionIds.join('|'))),assetId:asset.id,status:'READY',createdAt:now()};
    if(signal?.aborted)throw new DOMException('取消しました','AbortError');
    await write(['pages','assets','pdfs','jobs'],tx=>{
      withCurrentPdfInputs(tx,dayId,orderedPages,()=>{
        if(signal?.aborted){tx.abort();return;}
        tx.objectStore('assets').add(asset);tx.objectStore('pdfs').add(record);tx.objectStore('jobs').put({...job,state:'READY',progress:100});
      });
    },fence);
    onProgress(100);return record;
  } catch(error) {
    try {await write(['jobs'],tx=>tx.objectStore('jobs').put({...job,state:error instanceof DOMException && error.name==='AbortError'?'CANCELED':'FAILED',errorCode:error instanceof DOMException?error.name:'PDF_FAILED'}),fence);}catch{ /* A newer owner must reject this old job. */ }
    throw error;
  }
}
export async function preparedFile(record:PdfExport):Promise<File> {
  const asset=await get('assets',record.assetId);
  if(record.status!=='READY' || !asset || asset.kind!=='pdf')throw new Error('完成PDFがありません。');
  return new File([asset.blob],pdfName(record.displayName),{type:'application/pdf'});
}
export async function logShare(exportId:string,result:'requested'|'handed-off'|'canceled'|'failed',action:'share'|'download'='share'):Promise<void> {
  await write(['shares'],tx=>tx.objectStore('shares').add({id:id(),exportId,action,result,requestedAt:now()}));
}
export function handOff(file:File):Promise<void> {
  if(!navigator.share || !navigator.canShare?.({files:[file]}))return Promise.reject(new Error('この環境ではPDFの直接共有に対応していません。「ファイルに保存」からメールへ添付してください。'));
  // This call must be reached synchronously from a separate user click.
  return navigator.share({files:[file],title:file.name});
}
export function download(blob:Blob,name:string):void {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
