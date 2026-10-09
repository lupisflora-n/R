import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { appUrl, externalAppUrl } from '../src/line/handoff.ts';
import { verifyPublication } from '../scripts/verify-line-publication.mjs';

test('GitHub project LINE links retain /R/ while discarding identity and redirect inputs', () => {
  const input = 'https://lupisflora-n.github.io/R/line.html?customer=TEST&redirect=elsewhere#private';
  assert.equal(appUrl(input, '/R/'), 'https://lupisflora-n.github.io/R/');
  assert.equal(externalAppUrl(input, '/R/'), 'https://lupisflora-n.github.io/R/?openExternalBrowser=1');
  for (const invalid of ['//foreign.test/', '/R/?customer=TEST', '/R/../']) assert.throws(() => appUrl(input, invalid));
});

test('handoff derives the deployed project path from its actual module location', () => {
  const source = stripTypeScriptTypes(readFileSync(new URL('../src/line/handoff.ts', import.meta.url), 'utf8'))
    .replaceAll('import.meta.url', JSON.stringify('https://lupisflora-n.github.io/R/src/line/handoff.js'))
    .replace(/^export /gm, '');
  const result = vm.runInNewContext(source + '\nappUrl("https://lupisflora-n.github.io/R/?customer=TEST#private")', { URL });
  assert.equal(result, 'https://lupisflora-n.github.io/R/');
});

test('project-scoped offline navigation handles help and leaves sibling apps alone', async () => {
  const listeners = {};
  const self = { location: 'https://lupisflora-n.github.io/R/sw.js', addEventListener: (type, fn) => listeners[type] = fn };
  const source = readFileSync(new URL('../src/update/sw-template.js', import.meta.url), 'utf8')
    .replace('__BUILD__', 'synthetic-pages').replace('__ASSETS__', JSON.stringify(['./index.html', './line.html', './help.html']));
  const cache = { match: async path => new Response(path) };
  vm.runInNewContext(source, { self, caches: { open: async () => cache }, Response, URL, Set });
  for (const [path, expected] of [['/R/', './index.html'], ['/R/help.html', './help.html'], ['/R/line.html', './line.html']]) {
    let response;
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://lupisflora-n.github.io' + path }, respondWith: value => response = value });
    assert.equal(await (await response).text(), expected);
  }
  for (const path of ['/', '/Other/help.html', '/R-other/', '/R/missing.html']) {
    let intercepted = false;
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://lupisflora-n.github.io' + path }, respondWith: () => intercepted = true });
    assert.equal(intercepted, false, path);
  }
});

test('publication checks the GitHub project URL rather than the previous Cloudflare origin', async () => {
  const expected = { build: 'synthetic-pages', files: 35 };
  await verifyPublication(expected, {
    appBase: 'https://lupisflora-n.github.io/R/', attempts: 1,
    fetchBuild: async url => {
      assert.equal(new URL(url).origin, 'https://lupisflora-n.github.io');
      assert.equal(new URL(url).pathname, '/R/build.json');
      return { ok: true, json: async () => expected };
    }
  });
});
