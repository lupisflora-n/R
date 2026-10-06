import { PDFDocument } from '../../vendor/pdf-lib.js';
export async function assemblePdf(inputs:string[],load:(id:string)=>Promise<{bytes:Uint8Array;mime:string}>,progress:(n:number)=>Promise<void>,signal?:AbortSignal):Promise<Uint8Array> {
  if(inputs.length<1 || inputs.length>10 || new Set(inputs).size!==inputs.length)throw new Error('PDFは重複しない1〜10枚の編集版を選んでください。');
  const pdf=await PDFDocument.create();pdf.setProducer('日付スキャン');pdf.setCreator('日付スキャン');
  for(let i=0;i<inputs.length;i++) {
    if(signal?.aborted)throw new DOMException('取消しました','AbortError');
    const asset=await load(inputs[i]);
    if(!['image/jpeg','image/png'].includes(asset.mime))throw new Error('PDFには確定したJPEG・PNG画像を使います。');
    const embedded=asset.mime==='image/jpeg'?await pdf.embedJpg(asset.bytes):await pdf.embedPng(asset.bytes);
    const landscape=embedded.width>embedded.height,pageSize=landscape?[841.89,595.28]:[595.28,841.89];
    const page=pdf.addPage(pageSize),scale=Math.min(pageSize[0]/embedded.width,pageSize[1]/embedded.height);
    const width=embedded.width*scale,height=embedded.height*scale;
    page.drawImage(embedded,{x:(pageSize[0]-width)/2,y:(pageSize[1]-height)/2,width,height});
    await progress(Math.round((i+1)/inputs.length*90));
  }
  if(signal?.aborted)throw new DOMException('取消しました','AbortError');
  const bytes=await pdf.save();
  if(signal?.aborted)throw new DOMException('取消しました','AbortError');
  const verified=await PDFDocument.load(bytes,{ignoreEncryption:false});
  if(verified.getPageCount()!==inputs.length || verified.getPages().some((p:{getWidth:()=>number;getHeight:()=>number})=>p.getWidth()<=0 || p.getHeight()<=0))throw new Error('PDFの検査に失敗しました。');
  return bytes;
}
