import type { AppMeta } from '../model.ts';
import { FORMAT_VERSION } from '../model.ts';
export function assertLease(meta:AppMeta,owner:string,token:number,time=Date.now()):void {
  if(meta.minReaderVersion>FORMAT_VERSION || meta.dataFormatVersion>FORMAT_VERSION || !meta.lease || meta.lease.owner!==owner || meta.lease.token!==token || meta.lease.expires<=time)throw new Error('作業権が別の画面へ移りました。古い処理の保存を止め、原本は保持しました。');
}
export function nextLease(meta:AppMeta,owner:string,time:number,ttl:number):AppMeta | undefined {
  if(meta.minReaderVersion>FORMAT_VERSION || meta.dataFormatVersion>FORMAT_VERSION)return;
  if(meta.lease && meta.lease.owner!==owner && meta.lease.expires>time)return;
  const token=meta.lease?.owner===owner && meta.lease.expires>time?meta.lease.token:meta.generation+1;
  return {...meta,generation:token,lease:{owner,token,expires:time+ttl}};
}
