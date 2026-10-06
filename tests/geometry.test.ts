import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homography,project,filteredChannel} from '../src/processing/geometry.ts';
import {fullCorners} from '../src/model.ts';
test('inverse projective transform maps every output corner to requested trapezoid',()=>{
  const points= [{x:0.2,y:0.1},{x:0.85,y:0.23},{x:0.96,y:0.94},{x:0.04,y:0.86}] as ReturnType<typeof fullCorners>;
  const h=homography(points);
  [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{const p=project(h,u,v);assert.ok(Math.abs(p.x-points[i].x)<1e-8);assert.ok(Math.abs(p.y-points[i].y)<1e-8);});
  const identity=project(homography(fullCorners()),0.4,0.65);assert.ok(Math.abs(identity.x-0.4)<1e-8);
});
test('standard filter retains fine tone differences; binary requires explicit mode',()=>{
  assert.ok(filteredChannel(190,'readable',0,1)<filteredChannel(200,'readable',0,1));
  assert.ok(filteredChannel(245,'readable',0,1)<255);
  assert.equal(filteredChannel(190,'binary',0,1),255);
});
