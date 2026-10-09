import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragCorner, fitEditorImage } from '../src/editor/interaction.ts';

test('corner follows the entire finger drag at displayed scale and keeps the initial grab offset',()=>{
  const point={x:.2,y:.3},start={x:121,y:219},frame={width:300,height:500};
  assert.deepEqual(dragCorner(point,start,start,frame),point);
  for(let fraction=.1;fraction<=1;fraction+=.1){
    const result=dragCorner(point,start,{x:start.x+90*fraction,y:start.y+150*fraction},frame);
    assert.ok(Math.abs((result.x-point.x)*frame.width-90*fraction)<1e-9);
    assert.ok(Math.abs((result.y-point.y)*frame.height-150*fraction)<1e-9);
  }
  assert.deepEqual(dragCorner(point,start,{x:211,y:369},frame),{x:.5,y:.6});
});
test('corner movement clamps to the original image, is independent of page scroll, and handles different screen scales',()=>{
  assert.deepEqual(dragCorner({x:.5,y:.5},{x:50,y:80},{x:-1000,y:1000},{width:200,height:300}),{x:0,y:1});
  const a=dragCorner({x:.25,y:.25},{x:20,y:30},{x:70,y:130},{width:200,height:400});
  const b=dragCorner({x:.25,y:.25},{x:420,y:1030},{x:470,y:1130},{width:200,height:400});
  assert.deepEqual(a,b);
  assert.deepEqual(a,dragCorner({x:.25,y:.25},{x:40,y:60},{x:140,y:260},{width:400,height:800}));
  assert.throws(()=>dragCorner({x:0,y:0},{x:0,y:0},{x:1,y:1},{width:0,height:10}));
});
test('portrait, landscape and rotated images fit their fixed photo area with room for edge touch targets',()=>{
  for(const image of [{width:900,height:1280},{width:1280,height:900},{width:400,height:1800}])for(const space of [{width:296,height:204},{width:366,height:420},{width:500,height:210}]){
    const fitted=fitEditorImage(image,space);
    assert.ok(fitted.width<=space.width-56+1e-9);
    assert.ok(fitted.height<=space.height-56+1e-9);
    assert.ok(Math.abs(fitted.width/fitted.height-image.width/image.height)<1e-9);
  }
});
