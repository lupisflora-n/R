import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {homography,project,filteredChannel} from '../src/processing/geometry.ts';
import {outputSize,validateRecipe} from '../src/core.ts';
import {defaultRecipe,MAX_INPUT_PIXELS} from '../src/model.ts';
const code=stripTypeScriptTypes(readFileSync(new URL('../src/processing/worker.ts',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
function invoke(width:number,height:number,buffer:ArrayBuffer,recipe:ReturnType<typeof defaultRecipe>) {
  let output:any;const self:any={postMessage:(v:any)=>{output=v;}};
  const context=vm.createContext({self,Uint8ClampedArray,Math,Error,homography,project,filteredChannel,outputSize,validateRecipe,MAX_INPUT_PIXELS});
  vm.runInContext(code,context);self.onmessage({data:{width,height,buffer,recipe}});return output;
}
test('actual worker retains every source pixel for full color crop and maps 90-degree rotation',()=>{
  const src=new Uint8ClampedArray(3*2*4);for(let i=0;i<6;i++)src.set([i*30,255-i*20,i*10,255],i*4);
  const original=src.slice(),recipe={...defaultRecipe(),filter:'color' as const};
  const a=invoke(3,2,src.buffer,recipe);assert.equal(a.width,3);assert.equal(a.height,2);assert.deepEqual(new Uint8ClampedArray(a.buffer),src);assert.deepEqual(src,original);
  const b=invoke(3,2,src.buffer,{...recipe,rotation:90});assert.equal(b.width,2);assert.equal(b.height,3);
  const pixels=new Uint8ClampedArray(b.buffer);assert.deepEqual(Array.from(pixels.slice(0,4)),Array.from(src.slice(12,16)));
});
test('actual worker rejects invalid corners instead of emitting a cropped image',()=>{
  const recipe=defaultRecipe();recipe.points[1]={x:0,y:1};recipe.points[3]={x:1,y:0};const result=invoke(3,2,new ArrayBuffer(24),recipe);assert.ok(result.error);assert.equal(result.buffer,undefined);
});
