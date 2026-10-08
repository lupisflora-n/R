import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AppMeta, Page, Revision, PdfExport, Job } from '../src/model.ts';
import { defaultRecipe } from '../src/model.ts';
import { applyPageAction, planPageAction } from '../src/storage/deletion.ts';
import type { DeletionGraph } from '../src/storage/deletion.ts';
import { assertLease } from '../src/storage/lease.ts';

const timestamp = '2026-10-08T10:00:00.000Z';
function fixture(): DeletionGraph {
  const page: Page = { id: 'page', dayId: 'day', orderIndex: 0, capturedAt: timestamp, title: '架空文書', originalAssetId: 'original', activeRevisionId: 'revision', state: 'READY' };
  const revision: Revision = { id: 'revision', pageId: page.id, originalHash: 'a'.repeat(64), recipe: defaultRecipe(), filterVersion: 1, renderedAssetId: 'rendered', createdAt: timestamp };
  return { pages: [page], revisions: [revision], pdfs: [], jobs: [] };
}
function pdf(): PdfExport { return { id: 'pdf', dayId: 'day', displayName: '架空.pdf', orderedRevisionIds: ['revision'], orderedPageIds: ['page'], fingerprint: 'fixed', assetId: 'pdf-asset', status: 'READY', createdAt: timestamp }; }
test('trash is confirmed and reversible without modifying image recipes or original references', () => {
  const graph = fixture(), before = structuredClone(graph);
  assert.throws(() => planPageAction(graph, 'page', 'trash', false, timestamp), /確認/);
  const plan = planPageAction(graph, 'page', 'trash', true, timestamp);
  assert.equal(plan.page?.deletedAt, timestamp);
  assert.deepEqual(plan.deleteAssetIds, []);
  assert.deepEqual(graph, before);
  graph.pages[0] = plan.page!;
  assert.equal(planPageAction(graph, 'page', 'trash', true, timestamp).changed, false);
  const restored = planPageAction(graph, 'page', 'restore', false, timestamp).page!;
  assert.equal(restored.deletedAt, undefined);
  assert.deepEqual({ ...restored, deletedAt: undefined }, { ...before.pages[0], deletedAt: undefined });
});
test('physical erase deletes every page revision and unshared asset only after trash; repeated erase is harmless', () => {
  const graph = fixture();
  assert.throws(() => planPageAction(graph, 'page', 'erase', true, timestamp), /先に/);
  graph.pages[0].deletedAt = timestamp;
  graph.revisions.push({ ...graph.revisions[0], id: 'old-revision', renderedAssetId: 'old-rendered' });
  const plan = planPageAction(graph, 'page', 'erase', true, timestamp);
  assert.equal(plan.deletePageId, 'page');
  assert.deepEqual(plan.deleteRevisionIds, ['revision', 'old-revision']);
  assert.deepEqual(plan.deleteAssetIds, ['original', 'rendered', 'old-rendered']);
  assert.equal(planPageAction({ ...graph, pages: [] }, 'page', 'erase', true, timestamp).changed, false);
  assert.throws(() => planPageAction({ ...graph, pages: [] }, 'page', 'restore', false, timestamp), /戻せません/);
});
test('completed PDF bytes and history are preserved, including older PDF records without page IDs', () => {
  const graph = fixture(); graph.pdfs.push(pdf()); graph.pages[0].deletedAt = timestamp;
  const before = structuredClone(graph.pdfs);
  assert.throws(() => planPageAction(graph, 'page', 'erase', true, timestamp), /完成PDF/);
  assert.equal(planPageAction(graph, 'page', 'trash', true, timestamp).changed, false);
  delete graph.pdfs[0].orderedPageIds;
  assert.throws(() => planPageAction(graph, 'page', 'erase', true, timestamp), /完成PDF/);
  assert.deepEqual(graph.pdfs, [{ ...before[0], orderedPageIds: undefined }].map(p => { delete p.orderedPageIds; return p; }));
  graph.pdfs[0].orderedRevisionIds = ['missing-legacy-revision'];
  assert.throws(() => planPageAction(graph, 'page', 'erase', true, timestamp), /参照を確認できません/);
});
test('shared originals and rendered assets survive physical erase; invalid cross-page revision stops erase', () => {
  const graph = fixture(); graph.pages[0].deletedAt = timestamp;
  graph.pages.push({ ...graph.pages[0], id: 'other', activeRevisionId: 'other-revision', deletedAt: undefined });
  graph.revisions.push({ ...graph.revisions[0], id: 'other-revision', pageId: 'other' });
  assert.deepEqual(planPageAction(graph, 'page', 'erase', true, timestamp).deleteAssetIds, []);
  graph.pages[1].activeRevisionId = 'revision';
  assert.throws(() => planPageAction(graph, 'page', 'erase', true, timestamp), /ほかの写真/);
});
test('running or verifying PDF input blocks deletion; failed/canceled jobs do not retain unwanted photos', () => {
  const graph = fixture();
  const job: Job = { id: 'job', kind: 'pdf', state: 'RUNNING', inputSnapshot: ['revision'], fencingToken: 3, progress: 0, createdAt: timestamp };
  graph.jobs.push(job);
  for (const state of ['RUNNING', 'VERIFYING'] as const) { job.state = state; assert.throws(() => planPageAction(graph, 'page', 'trash', true, timestamp), /作成中/); }
  job.state = 'CANCELED'; graph.pages[0].deletedAt = timestamp;
  assert.equal(planPageAction(graph, 'page', 'erase', true, timestamp).changed, true);
});

/** Synthetic request queue exercises the actual transaction body without a browser/real customer DB. */
async function syntheticWrite(graph: DeletionGraph, action: 'trash' | 'erase', options: { stale?: boolean; abortAfterMutation?: boolean; failOnAssetDelete?: boolean } = {}) {
  const meta: AppMeta = { key: 'app', generation: 3, dataFormatVersion: 1, minReaderVersion: 1, lease: { owner: 'test', token: 3, expires: 1000 } };
  const original = { ...structuredClone(graph), assets: [{ id: 'original', blob: new Blob(['original unchanged']) }, { id: 'rendered', blob: new Blob(['rendered unchanged']) }, { id: 'pdf-asset', blob: new Blob(['%PDF- fixed completed bytes']) }] };
  const draft = structuredClone(original);
  const callbacks: (() => void)[] = []; let aborted = false; let failure: unknown; let changed = false;
  const tx = {
    abort() { aborted = true; },
    objectStore(name: keyof typeof draft) {
      return {
        getAll() { const req = { result: structuredClone(draft[name]), onsuccess: undefined as (() => void) | undefined }; callbacks.push(() => req.onsuccess?.()); return req; },
        put(record: { id: string }) { const rows = draft[name] as { id: string }[]; const at = rows.findIndex(r => r.id === record.id); if (at < 0) rows.push(record); else rows[at] = record; },
        delete(id: string) { if (name === 'assets' && options.failOnAssetDelete) throw new DOMException('synthetic quota', 'QuotaExceededError'); const rows = draft[name] as { id: string }[]; const at = rows.findIndex(r => r.id === id); if (at >= 0) rows.splice(at, 1); },
      };
    },
  };
  try {
    assertLease(meta, 'test', options.stale ? 2 : 3, 500);
    applyPageAction(tx as unknown as IDBTransaction, 'page', action, true, timestamp, plan => { changed = plan.changed; }, error => { failure = error; });
    while (callbacks.length && !aborted) callbacks.shift()!();
    if (options.abortAfterMutation) tx.abort();
  } catch (error) { failure = error; tx.abort(); }
  return { committed: !aborted, changed: !aborted && changed, failure, state: aborted ? original : draft, original };
}
test('fenced transaction refuses stale generation and does not expose any partial mutation after abort/quota', async () => {
  const graph = fixture(); graph.pages[0].deletedAt = timestamp;
  for (const options of [{ stale: true }, { abortAfterMutation: true }, { failOnAssetDelete: true }]) {
    const result = await syntheticWrite(graph, 'erase', options);
    assert.equal(result.committed, false); assert.equal(result.changed, false); assert.deepEqual(result.state, result.original);
    assert.equal(await result.state.assets[0].blob.text(), 'original unchanged');
  }
  const committed = await syntheticWrite(graph, 'erase');
  assert.equal(committed.changed, true); assert.equal(committed.state.pages.length, 0); assert.equal(committed.state.revisions.length, 0);
  assert.equal(await committed.state.assets[0].blob.text(), '%PDF- fixed completed bytes');
});
test('transaction re-reads current PDF references and keeps completed PDF bytes unchanged when trashing', async () => {
  const graph = fixture(); graph.pdfs.push(pdf());
  const result = await syntheticWrite(graph, 'trash');
  assert.equal(result.committed, true); assert.equal(result.state.pages[0].deletedAt, timestamp);
  assert.deepEqual(result.state.pdfs, result.original.pdfs);
  assert.equal(await result.state.assets[2].blob.text(), '%PDF- fixed completed bytes');
  const erase = await syntheticWrite(result.state, 'erase');
  assert.equal(erase.committed, false); assert.match(String(erase.failure), /完成PDF/);
});
