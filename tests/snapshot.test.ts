import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCurrentPdfInput, withCurrentPdfInputs } from '../src/exports/snapshot.ts';
import type { Page } from '../src/model.ts';
const page:Page={id:'one',dayId:'day',orderIndex:0,capturedAt:'2026-10-08T10:00:00Z',title:'架空',originalAssetId:'original',activeRevisionId:'version',state:'READY'};
test('PDF refuses stale, deleted or absent inputs while permitting an unchanged snapshot',()=>{
  assert.equal(isCurrentPdfInput(page,page,'day'),true);
  for(const changed of [undefined,{...page,deletedAt:'2026-10-08T10:01:00Z'},{...page,activeRevisionId:'new-version'},{...page,state:'DRAFT' as const},{...page,dayId:'other'}])assert.equal(isCurrentPdfInput(changed,page,'day'),false);
});
test('job and PDF commits wait for every current input; stale reads or write failure abort',()=>{
  const second={...page,id:'two'};
  function exercise(rows:(Page|undefined)[], fail=false){
    const callbacks:(()=>void)[]=[];let aborted=false,committed=false,index=0;
    const tx={abort(){aborted=true;},objectStore(){return {get(){const req={result:rows[index++],onsuccess:undefined as undefined|(()=>void)};callbacks.push(()=>req.onsuccess?.());return req;}};}};
    withCurrentPdfInputs(tx as unknown as IDBTransaction,'day',[page,second],()=>{if(fail)throw new Error('quota');committed=true;});
    assert.equal(committed,false);
    while(callbacks.length && !aborted)callbacks.shift()!();
    return {aborted,committed};
  }
  assert.deepEqual(exercise([page,second]),{aborted:false,committed:true});
  assert.deepEqual(exercise([page,{...second,deletedAt:'2026-10-08T10:01:00Z'}]),{aborted:true,committed:false});
  assert.deepEqual(exercise([undefined,second]),{aborted:true,committed:false});
  assert.deepEqual(exercise([page,second],true),{aborted:true,committed:false});
});
