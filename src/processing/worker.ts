import { homography, project, filteredChannel } from './geometry.ts';
import { outputSize, validateRecipe } from '../core.ts';
import { MAX_INPUT_PIXELS } from '../model.ts';

self.onmessage=event=>{
  try {
    const {buffer,width:sw,height:sh,recipe}=event.data;
    validateRecipe(recipe);
    const size=outputSize(recipe.points,sw,sh),w=size.width,h=size.height;
    if(w*h>MAX_INPUT_PIXELS)throw new Error('補正後の画像が処理上限を超えます。原本は保持しています。');
    const dw=recipe.rotation===90 || recipe.rotation===270?h:w,dh=recipe.rotation===90 || recipe.rotation===270?w:h;
    const src=new Uint8ClampedArray(buffer),out=new Uint8ClampedArray(dw*dh*4),matrix=homography(recipe.points);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=project(matrix,x/(w-1),y/(h-1));
      const sx=Math.min(sw-1,Math.max(0,p.x*(sw-1))),sy=Math.min(sh-1,Math.max(0,p.y*(sh-1)));
      const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),dx=sx-x0,dy=sy-y0;
      const c=[0,0,0];
      for(let k=0;k<3;k++)c[k]=src[(y0*sw+x0)*4+k]*(1-dx)*(1-dy)+src[(y0*sw+x1)*4+k]*dx*(1-dy)+src[(y1*sw+x0)*4+k]*(1-dx)*dy+src[(y1*sw+x1)*4+k]*dx*dy;
      let ox=x,oy=y;
      if(recipe.rotation===90){ox=h-1-y;oy=x;}
      if(recipe.rotation===180){ox=w-1-x;oy=h-1-y;}
      if(recipe.rotation===270){ox=y;oy=w-1-x;}
      const offset=(oy*dw+ox)*4,gray=0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
      for(let k=0;k<3;k++)out[offset+k]=filteredChannel(recipe.filter==='color'?c[k]:gray,recipe.filter,recipe.brightness,recipe.contrast);
      out[offset+3]=255;
    }
    self.postMessage({buffer:out.buffer,width:dw,height:dh}, { transfer: [out.buffer] });
  }catch(error){self.postMessage({error:error instanceof Error?error.message:'画像処理が停止しました。'});}
};
