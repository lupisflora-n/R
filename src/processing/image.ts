import { MAX_INPUT_BYTES, MAX_INPUT_PIXELS } from '../model.ts';
import type { Recipe } from '../model.ts';
import { validateRecipe } from '../core.ts';

export async function validateImage(file: Blob): Promise<void> {
  if(!file.size || file.size>MAX_INPUT_BYTES)throw new Error('写真は50 MB以下を選んでください。無断で縮小せず、原本を保持します。');
  const b=new Uint8Array(await file.slice(0,128*1024).arrayBuffer());
  let w=0,h=0;
  if(b[0]===137 && b[1]===80 && b[2]===78 && b[3]===71) {
    const dv=new DataView(b.buffer); w=dv.getUint32(16); h=dv.getUint32(20);
  } else if(b[0]===255 && b[1]===216) {
    let i=2;
    while(i+9<b.length) {
      if(b[i]!==255)break;
      const marker=b[i+1]; if(marker===0xda || marker===0xd9)break;
      const len=(b[i+2]<<8)|b[i+3]; if(len<2)break;
      if([0xc0,0xc1,0xc2].includes(marker)) { h=(b[i+5]<<8)|b[i+6]; w=(b[i+7]<<8)|b[i+8]; break; }
      i+=2+len;
    }
  } else if(!file.type.includes('heic') && !file.type.includes('heif') && String.fromCharCode(...b.slice(4,8))!=='ftyp') throw new Error('JPEG・PNG、または端末が対応するHEICを選んでください。');
  if(w*h>MAX_INPUT_PIXELS)throw new Error('この写真は24MPを超えています。原本は保存済みです。処理上限内の写真を別途選択してください。勝手な縮小は行いません。');
}
export async function decode(file: Blob, maxSide?: number): Promise<{pixels: ImageData;width:number;height:number}> {
  let bitmap: ImageBitmap | undefined;
  let img: HTMLImageElement | undefined;
  let url: string | undefined;
  try {
    try { bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}); } catch {
      url=URL.createObjectURL(file); img=new Image(); img.src=url; await img.decode();
    }
    const width=bitmap?.width || img!.naturalWidth, height=bitmap?.height || img!.naturalHeight;
    if(width*height>MAX_INPUT_PIXELS)throw new Error('24MPを超える画像です。原本を保持し、処理を停止しました。');
    const scale=maxSide?Math.min(1,maxSide/Math.max(width,height)):1;
    const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(width*scale)); canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap || img!,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);canvas.width=canvas.height=0;
    return {pixels,width,height};
  } finally { bitmap?.close();if(url)URL.revokeObjectURL(url); }
}
export async function processImage(file: Blob, recipe: Recipe, signal?: AbortSignal, preview=false): Promise<{blob:Blob;width:number;height:number}> {
  validateRecipe(recipe);await validateImage(file);
  const {pixels}=await decode(file,preview?1000:undefined);
  if(signal?.aborted)throw new DOMException('取消しました','AbortError');
  const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{worker.terminate();clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();reject(new DOMException('取消しました','AbortError'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('画像処理が60秒を超えたため停止しました。原本は保持しています。'));},60_000);
    signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=async event=>{
      if(event.data.error){cleanup();reject(new Error(event.data.error));return;}
      try {
        const {width,height,buffer}=event.data;
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(buffer),width,height),0,0);
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('画像を保存形式へ変換できません。')),recipe.filter==='color'?'image/jpeg':'image/png',0.92));
        canvas.width=canvas.height=0;cleanup();resolve({blob,width,height});
      }catch(e){cleanup();reject(e);}
    };
    worker.onerror=()=>{cleanup();reject(new Error('画像処理に失敗しました。原本は保持しています。'));};
    worker.postMessage({buffer:pixels.data.buffer,width:pixels.width,height:pixels.height,recipe},[pixels.data.buffer]);
  });
}
