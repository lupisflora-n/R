import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertLease,nextLease} from '../src/storage/lease.ts';
import type{AppMeta}from'../src/model.ts';
test('only live lease owner can write; old generation and incompatible readers are fenced',()=>{
  const meta:AppMeta={key:'app',dataFormatVersion:1,minReaderVersion:1,generation:3,lease:{owner:'first',token:3,expires:1000}};
  assertLease(meta,'first',3,999);assert.throws(()=>assertLease(meta,'first',3,1000));assert.throws(()=>assertLease(meta,'other',3,900));assert.throws(()=>assertLease(meta,'first',2,900));
  assert.throws(()=>assertLease({...meta,minReaderVersion:2},'first',3,900));assert.equal(nextLease(meta,'other',900,100),undefined);
});
test('camera suspension expiry/release creates a fresh generation; heartbeat retains live generation',()=>{
  const meta:AppMeta={key:'app',dataFormatVersion:1,minReaderVersion:1,generation:3,lease:{owner:'first',token:3,expires:1000}};
  const renewed=nextLease(meta,'first',900,1000)!;assert.equal(renewed.generation,3);
  const reacquired=nextLease(meta,'first',1001,1000)!;assert.equal(reacquired.generation,4);assert.throws(()=>assertLease(reacquired,'first',3,1100));
  const released=nextLease({...meta,lease:undefined},'first',900,1000)!;assert.equal(released.generation,4);
});
