import { id, now, FORMAT_VERSION } from '../model.ts';
import type { AppMeta, Asset, BackupEvent, Day, IngestIntent, Job, Page, PdfExport, Revision, ShareEvent } from '../model.ts';
import { sha256, validDate } from '../core.ts';
import { assertLease, nextLease } from './lease.ts';

export const DB_NAME = 'daily-docscan-v2';
export const stores = ['days','assets','pages','revisions','pdfs','jobs','intents','shares','backups','imports','meta'] as const;
export type Store = typeof stores[number];
export type Records = { days: Day; assets: Asset; pages: Page; revisions: Revision; pdfs: PdfExport; jobs: Job; intents: IngestIntent; shares: ShareEvent; backups: BackupEvent; imports: { id: string; digest: string; dayId: string }; meta: AppMeta };
export const sessionId = id();
let database: IDBDatabase;
let token = 0;
let closed = false;
const LEASE_MS = 20_000;
export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
export async function open(): Promise<void> {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const name of stores) db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
  };
  database = await request(req);
  database.onversionchange = () => {
    closed = true; database.close();
    window.dispatchEvent(new CustomEvent('storage-blocked', { detail: '別の画面が保存形式を更新しています。この画面の書込みを停止しました。画面を閉じて開き直してください。' }));
  };
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('meta', 'readwrite');
    const req = tx.objectStore('meta').get('app');
    req.onsuccess = () => { if (!req.result) tx.objectStore('meta').add({key:'app',dataFormatVersion:FORMAT_VERSION,minReaderVersion:FORMAT_VERSION,generation:0}); };
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  const meta = await get('meta', 'app');
  if (!meta || meta.minReaderVersion > FORMAT_VERSION || meta.dataFormatVersion > FORMAT_VERSION) throw new Error('このデータは新しいアプリ版が必要です。初期化せず保存しました。互換版で開いてください。');
}
export function get<S extends Store>(store: S, key: IDBValidKey): Promise<Records[S] | undefined> {
  if (closed) return Promise.reject(new Error('保存処理は停止しています。'));
  return request(database.transaction(store).objectStore(store).get(key));
}
export function list<S extends Store>(store: S): Promise<Records[S][]> {
  return request(database.transaction(store).objectStore(store).getAll());
}
export async function acquire(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let acquired = false;
    const tx = database.transaction('meta','readwrite'), table = tx.objectStore('meta');
    const req = table.get('app');
    req.onsuccess = () => {
      const meta: AppMeta = req.result;
      const claimed=nextLease(meta,sessionId,Date.now(),LEASE_MS);if(!claimed)return;
      token=claimed.lease!.token;table.put(claimed);
      acquired = true;
    };
    tx.oncomplete = () => resolve(acquired); tx.onabort = () => reject(tx.error);
  });
}
export async function heartbeat(): Promise<boolean> {
  try { await write([], () => {}); return true; } catch { return false; }
}
export async function release(): Promise<void> {
  await write([], tx => { const req = tx.objectStore('meta').get('app'); req.onsuccess = () => tx.objectStore('meta').put({...req.result,lease:undefined}); });
}
export function currentToken(): number { return token; }
export function write(names: Store[], body: (tx: IDBTransaction) => void, expectedToken = token): Promise<void> {
  return new Promise((resolve, reject) => {
    if (closed || !expectedToken) { reject(new Error('別の画面が作業中です。書込みを停止しています。')); return; }
    const tx = database.transaction([...new Set([...names, 'meta'])], 'readwrite');
    let failure: unknown;
    const req = tx.objectStore('meta').get('app');
    req.onsuccess = () => {
      try {
        const meta: AppMeta = req.result;
        assertLease(meta,sessionId,expectedToken);
        tx.objectStore('meta').put({...meta,lease:{...meta.lease,expires:Date.now()+LEASE_MS}});
        body(tx);
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(failure || tx.error || new Error('保存が中断されました。'));
  });
}
export async function dayFor(documentDate: string): Promise<Day> {
  if (!validDate(documentDate)) throw new Error('日付を正しく入力してください。');
  const existing = (await list('days')).find(day => day.documentDate === documentDate);
  if (existing) return existing;
  const day: Day = {id:id(),documentDate,zoneId:Intl.DateTimeFormat().resolvedOptions().timeZone,createdAt:now(),updatedAt:now()};
  await write(['days'], tx => tx.objectStore('days').add(day)); return day;
}
export async function beginIntent(dayId: string): Promise<IngestIntent> {
  const intent: IngestIntent = {id:id(),dayId,startedAt:now(),status:'WAITING'};
  await write(['intents'], tx => tx.objectStore('intents').add(intent)); return intent;
}
export async function makeAsset(blob: Blob, kind: Asset['kind'], width?: number, height?: number): Promise<Asset> {
  let mime=blob.type;
  if(kind==='original') {
    const b=new Uint8Array(await blob.slice(0,16).arrayBuffer());
    if(b[0]===255 && b[1]===216 && b[2]===255)mime='image/jpeg';
    if(b[0]===137 && b[1]===80 && b[2]===78 && b[3]===71)mime='image/png';
    if(String.fromCharCode(...b.slice(4,8))==='ftyp' && ['heic','heix','hevc','hevx','mif1','msf1'].includes(String.fromCharCode(...b.slice(8,12))))mime='image/heic';
  }
  return {id:id(),kind,blob,mime,byteCount:blob.size,sha256:await sha256(blob),width,height,createdAt:now()};
}
export async function saveOriginal(file: File, intent: IngestIntent): Promise<Page> {
  const asset = await makeAsset(file, 'original');
  const dayPages = (await list('pages')).filter(p=>p.dayId === intent.dayId);
  const page: Page = { id:id(),dayId:intent.dayId,orderIndex:Math.max(-1,...dayPages.map(p=>p.orderIndex))+1,capturedAt:now(),title:`文書 ${dayPages.length+1}`,originalAssetId:asset.id,state:'DRAFT' };
  await write(['assets','pages','intents'], tx => {
    const current = tx.objectStore('intents').get(intent.id);
    current.onsuccess = () => {
      if (current.result?.status !== 'WAITING') { tx.abort(); return; }
      tx.objectStore('assets').add(asset); tx.objectStore('pages').add(page); tx.objectStore('intents').put({...intent,status:'RECEIVED'});
    };
  });
  return page;
}
export async function saveRevision(page: Page, revision: Revision, asset: Asset, expectedToken: number, title?:string, signal?:AbortSignal): Promise<void> {
  await write(['assets','revisions','pages'], tx => {
    if(signal?.aborted)throw new DOMException('取消しました','AbortError');
    const req = tx.objectStore('pages').get(page.id);
    req.onsuccess = () => {
      if(signal?.aborted){tx.abort();return;}
      if (req.result?.activeRevisionId !== page.activeRevisionId) { tx.abort(); return; }
      tx.objectStore('assets').add(asset); tx.objectStore('revisions').add(revision);
      tx.objectStore('pages').put({...req.result,title:title?.trim().slice(0,100) || req.result.title,activeRevisionId:revision.id,state:'READY'});
    };
  }, expectedToken);
}
export async function recover(): Promise<void> {
  const jobs = (await list('jobs')).filter(j=>j.state === 'RUNNING' || j.state === 'VERIFYING');
  if (jobs.length) await write(['jobs'], tx => { for(const job of jobs) tx.objectStore('jobs').put({...job,state:'INTERRUPTED'}); });
  const pages = await list('pages');
  for (const page of pages) {
    if (!(await get('assets',page.originalAssetId))) throw new Error('原本への参照が欠けています。削除せず保存を停止しました。');
    if (page.activeRevisionId) {
      const revision = await get('revisions',page.activeRevisionId);
      if (!revision || !(await get('assets',revision.renderedAssetId))) throw new Error('編集版への参照が欠けています。原本を残して保存を停止しました。');
    }
  }
}
