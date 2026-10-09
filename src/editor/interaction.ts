import type { Point } from '../model.ts';

const clamp=(value:number)=>Math.min(1,Math.max(0,value));
/** Keep the grab offset; one screen-pixel of finger motion is one screen-pixel of corner motion. */
export function dragCorner(point:Point,start:Point,current:Point,frame:{width:number;height:number}):Point {
  if(frame.width<=0 || frame.height<=0)throw new Error('写真の表示サイズが不正です。');
  return {x:clamp(point.x+(current.x-start.x)/frame.width),y:clamp(point.y+(current.y-start.y)/frame.height)};
}
export function fitEditorImage(image:{width:number;height:number},space:{width:number;height:number},padding=28):{width:number;height:number} {
  const width=Math.max(1,space.width-padding*2),height=Math.max(1,space.height-padding*2);
  const scale=Math.min(width/image.width,height/image.height);
  return {width:image.width*scale,height:image.height*scale};
}
