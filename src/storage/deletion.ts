import type { Job, Page, PdfExport, Revision } from '../model.ts';
import { now } from '../model.ts';
import { currentToken, write } from './db.ts';

export type PageAction = 'trash' | 'restore' | 'erase';
export type DeletionGraph = { pages: Page[]; revisions: Revision[]; pdfs: PdfExport[]; jobs: Job[] };
export type PageActionPlan = { page?: Page; deletePageId?: string; deleteRevisionIds: string[]; deleteAssetIds: string[]; changed: boolean };
const emptyPlan = (): PageActionPlan => ({ deleteRevisionIds: [], deleteAssetIds: [], changed: false });

/** Metadata only: no image decoding, hashing, or Blob reads inside a transaction. */
export function planPageAction(graph: DeletionGraph, pageId: string, action: PageAction, confirmed: boolean, timestamp: string): PageActionPlan {
  if (!['trash', 'restore', 'erase'].includes(action)) throw new Error('写真の操作が不正です。');
  if (action !== 'restore' && confirmed !== true) throw new Error('対象の写真を確認してから削除してください。');
  const page = graph.pages.find(p => p.id === pageId);
  if (!page) {
    if (action === 'restore') throw new Error('写真は完全に削除されているため戻せません。');
    return emptyPlan();
  }
  if (action === 'restore') return page.deletedAt ? { ...emptyPlan(), page: { ...page, deletedAt: undefined }, changed: true } : emptyPlan();
  const revisions = graph.revisions.filter(r => r.pageId === pageId);
  const revisionIds = new Set(revisions.map(r => r.id));
  if (graph.jobs.some(j => ['RUNNING', 'VERIFYING'].includes(j.state) && j.inputSnapshot.some(ref => revisionIds.has(ref)))) {
    throw new Error('この写真でPDFを作成中です。処理を終えるか取り消してから削除してください。');
  }
  if (action === 'trash') return page.deletedAt ? emptyPlan() : { ...emptyPlan(), page: { ...page, deletedAt: timestamp }, changed: true };
  if (!page.deletedAt) throw new Error('先に写真をごみ箱へ移してください。');
  if (graph.pdfs.some(pdf => pdf.orderedPageIds?.includes(pageId) || pdf.orderedRevisionIds.some(ref => revisionIds.has(ref)))) {
    throw new Error('完成PDFに使った写真は、復元用ZIPの整合性を守るため完全削除できません。ごみ箱では非表示にでき、完成PDFはそのまま使えます。');
  }
  const allRevisionIds = new Set(graph.revisions.map(r => r.id));
  if (graph.pdfs.some(pdf => !pdf.orderedPageIds && pdf.orderedRevisionIds.some(ref => !allRevisionIds.has(ref)))) {
    throw new Error('古い完成PDFの写真参照を確認できません。データを残して完全削除を停止しました。');
  }
  // Historical IDs in PDF records remain provenance; current Page references must stay valid.
  if (graph.pages.some(p => p.id !== pageId && p.activeRevisionId && revisionIds.has(p.activeRevisionId))) {
    throw new Error('ほかの写真がこの編集版を参照しています。データを残して削除を停止しました。');
  }
  const otherPages = graph.pages.filter(p => p.id !== pageId);
  const otherRevisions = graph.revisions.filter(r => r.pageId !== pageId);
  const referencedAssets = new Set([
    ...otherPages.map(p => p.originalAssetId),
    ...otherRevisions.map(r => r.renderedAssetId),
    ...graph.pdfs.map(pdf => pdf.assetId),
  ]);
  const candidates = new Set([page.originalAssetId, ...revisions.map(r => r.renderedAssetId)]);
  return { deletePageId: pageId, deleteRevisionIds: [...revisionIds], deleteAssetIds: [...candidates].filter(assetId => !referencedAssets.has(assetId)), changed: true };
}

/** Used only inside db.write: read and mutation share the same fenced atomic transaction. */
export function applyPageAction(tx: IDBTransaction, pageId: string, action: PageAction, confirmed: boolean, timestamp: string, onPlan: (plan: PageActionPlan) => void, onFailure: (error: unknown) => void): void {
  const names = ['pages', 'revisions', 'pdfs', 'jobs'] as const;
  const graph = {} as DeletionGraph;
  let remaining = names.length;
  for (const name of names) {
    const req = tx.objectStore(name).getAll();
    req.onsuccess = () => {
      try {
        (graph as Record<string, unknown>)[name] = req.result;
        if (--remaining) return;
        const plan = planPageAction(graph, pageId, action, confirmed, timestamp);
        if (plan.page) tx.objectStore('pages').put(plan.page);
        if (plan.deletePageId) tx.objectStore('pages').delete(plan.deletePageId);
        for (const revisionId of plan.deleteRevisionIds) tx.objectStore('revisions').delete(revisionId);
        for (const assetId of plan.deleteAssetIds) tx.objectStore('assets').delete(assetId);
        onPlan(plan);
      } catch (error) { onFailure(error); tx.abort(); }
    };
  }
}

export async function changePage(pageId: string, action: PageAction, confirmed = false, expectedToken = currentToken()): Promise<boolean> {
  let plan: PageActionPlan | undefined;
  let failure: unknown;
  try {
    await write(['pages', 'revisions', 'pdfs', 'jobs', 'assets'], tx => {
      applyPageAction(tx, pageId, action, confirmed, now(), result => { plan = result; }, error => { failure = error; });
    }, expectedToken);
  } catch (error) { throw failure || error; }
  // Resolve only after the entire transaction commits, never after an individual request.
  return plan?.changed === true;
}

export const movePageToTrash = (pageId: string, confirmed: boolean, expectedToken = currentToken()) => changePage(pageId, 'trash', confirmed, expectedToken);
export const restorePage = (pageId: string, expectedToken = currentToken()) => changePage(pageId, 'restore', false, expectedToken);
export const permanentlyDeletePage = (pageId: string, confirmed: boolean, expectedToken = currentToken()) => changePage(pageId, 'erase', confirmed, expectedToken);
