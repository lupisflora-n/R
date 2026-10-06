import type { Corners } from '../model.ts';
import { validateCorners } from '../core.ts';

// Inverse projective transform: output unit square -> original normalized quad.
export function homography(points: Corners): number[] {
  validateCorners(points);
  const input = [[0,0],[1,0],[1,1],[0,1]];
  const a: number[][] = [];
  for (let i=0;i<4;i++) {
    const [u,v] = input[i], {x,y} = points[i];
    a.push([u,v,1,0,0,0,-u*x,-v*x,x], [0,0,0,u,v,1,-u*y,-v*y,y]);
  }
  for (let col=0;col<8;col++) {
    let best=col;
    for (let row=col+1;row<8;row++) if(Math.abs(a[row][col])>Math.abs(a[best][col])) best=row;
    if(Math.abs(a[best][col])<1e-10) throw new Error('四隅から補正できません。位置を直してください。');
    [a[col],a[best]]=[a[best],a[col]];
    const factor=a[col][col];
    for(let j=col;j<=8;j++) a[col][j]/=factor;
    for(let row=0;row<8;row++) {
      if(row===col)continue;
      const factor=a[row][col];
      for(let j=col;j<=8;j++)a[row][j]-=factor*a[col][j];
    }
  }
  return a.map(row=>row[8]);
}
export function project(h: number[], u: number, v: number): {x:number;y:number} {
  const d=h[6]*u+h[7]*v+1;
  return {x:(h[0]*u+h[1]*v+h[2])/d,y:(h[3]*u+h[4]*v+h[5])/d};
}
export function filteredChannel(value: number, mode: string, brightness: number, contrast: number): number {
  // Standard mode keeps a continuous tone curve; binary is explicitly separate.
  const shifted=(value-128)*contrast+128+brightness;
  if(mode==='binary')return shifted>170?255:0;
  return Math.min(255,Math.max(0,mode==='readable'?shifted+4*(shifted/255):shifted));
}
