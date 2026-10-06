import { getDocument, GlobalWorkerOptions } from '../../vendor/pdfjs.js';
GlobalWorkerOptions.workerSrc=new URL('../../vendor/pdf.worker.mjs',import.meta.url).href;
export async function openPdf(blob:Blob):Promise<{count:number;render:(canvas:HTMLCanvasElement,index:number)=>Promise<void>;close:()=>Promise<void>}> {
  const doc=await getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;
  return {count:doc.numPages,render:async(canvas,index)=>{
    const page=await doc.getPage(index),base=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(2,900/base.width)});
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;page.cleanup();
  },close:()=>doc.destroy()};
}
