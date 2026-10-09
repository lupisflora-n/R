import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPublication } from '../scripts/verify-line-publication.mjs';

const expected = { build: 'synthetic-build', files: 35 };
const reply = value => ({ ok: true, json: async () => value });

test('publication waits for the fixed LINE origin to receive the matching build', async () => {
  let calls = 0, waits = 0;
  const actual = await verifyPublication(expected, {
    fetchBuild: async (url, options) => {
      assert.equal(new URL(url).origin, 'https://docpdf-line-test.pages.dev');
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      return reply(++calls === 1 ? { ...expected, build: 'previous-build' } : expected);
    },
    sleep: async () => { waits++; }, attempts: 3
  });
  assert.deepEqual(actual, expected);
  assert.equal(calls, 2);
  assert.equal(waits, 1);
});

test('publication never treats a stale or incomplete deployment as verified', async () => {
  for (const actual of [{ ...expected, build: 'stale' }, { ...expected, files: 34 }]) {
    let calls = 0;
    await assert.rejects(verifyPublication(expected, {
      fetchBuild: async () => { calls++; return reply(actual); },
      sleep: async () => {}, attempts: 2
    }), /fixed-URL verification failed/);
    assert.equal(calls, 2);
  }
});

test('publication reports HTTP failure instead of declaring the deployment complete', async () => {
  await assert.rejects(verifyPublication(expected, {
    fetchBuild: async () => ({ ok: false, status: 503 }),
    sleep: async () => {}, attempts: 1
  }), /HTTP 503/);
});
