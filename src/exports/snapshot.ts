import type { Page } from '../model.ts';

export function isCurrentPdfInput(current:Page|undefined, expected:Page, dayId:string):boolean {
  return Boolean(current && !current.deletedAt && current.dayId===dayId && current.state==='READY' && current.activeRevisionId && current.activeRevisionId===expected.activeRevisionId);
}

/** Re-read inputs in the same transaction as the job or completed PDF write. */
export function withCurrentPdfInputs(tx:IDBTransaction, dayId:string, expected:Page[], commit:()=>void):void {
  let remaining=expected.length;
  if(!remaining){tx.abort();return;}
  for(const page of expected){
    const request=tx.objectStore('pages').get(page.id);
    request.onsuccess=()=>{
      if(!isCurrentPdfInput(request.result,page,dayId)){tx.abort();return;}
      if(--remaining===0){try{commit();}catch{tx.abort();}}
    };
  }
}
