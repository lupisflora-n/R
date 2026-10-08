import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { appUrl, externalAppUrl, isLineBrowser, renderHandoff } from '../src/line/handoff.ts';

test('LINE entry recognizes Android/iPhone user agents and ordinary browsers', () => {
  for (const agent of [
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Line/14.9.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 LINE/14.9.1'
  ]) assert.equal(isLineBrowser(agent), true);
  assert.equal(isLineBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36'), false);
  assert.equal(isLineBrowser('Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1'), false);
  // Detection is advisory UI fencing, not authentication or an OS guarantee.
  assert.equal(isLineBrowser('Outline/1.0'), false);
});

test('actual entry bootstrap in LINE does not import document modules or open a database', async () => {
  class Element {
    tagName: string; textContent = ''; className = ''; children: Element[] = [];
    attributes: Record<string, string> = {}; onclick: any; selected = false;
    constructor(tag: string) { this.tagName = tag.toUpperCase(); }
    append(...items: Element[]) { this.children.push(...items); }
    replaceChildren(...items: Element[]) { this.children = items; }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
    focus() {} select() { this.selected = true; }
  }
  const root = new Element('div');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const navDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const document = { createElement: (tag: string) => new Element(tag), querySelector: () => root };
  const navigator = { userAgent: 'Android Line/14.9.1', clipboard: { writeText: async () => { throw new Error('Denied'); } } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  let imports = 0, databaseOpens = 0;
  try {
    const source = stripTypeScriptTypes(readFileSync(new URL('../src/entry.ts', import.meta.url), 'utf8'))
      .replace(/^import[^\n]+\n/, '');
    const script = new vm.Script('(async () => {\n' + source + '\n})()', {
      importModuleDynamically: async () => { imports++; throw new Error('Document import forbidden in LINE'); }
    });
    await script.runInNewContext({ document, navigator, location: { href: 'https://docpdf.test/?openExternalBrowser=1&customer=TEST#private' },
      isLineBrowser, renderHandoff, indexedDB: { open: () => databaseOpens++ } });
    const flatten = (element: Element): Element[] => [element, ...element.children.flatMap(flatten)];
    const nodes = flatten(root);
    assert.equal(imports, 0); assert.equal(databaseOpens, 0);
    assert.equal(nodes.some(item => (item as any).type === 'file'), false);
    assert.equal((nodes.find(item => (item as any).id === 'launch-url') as any).value, 'https://docpdf.test/');
    assert.equal((nodes.find(item => item.textContent === 'ブラウザーでdocPDFを開く') as any).href, 'https://docpdf.test/?openExternalBrowser=1');
    nodes.find(item => item.textContent === 'URLをコピー')!.onclick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(nodes.some(item => item.textContent === 'URL欄を長押ししてコピーしてください。'), true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else delete (globalThis as any).document;
    if (navDescriptor) Object.defineProperty(globalThis, 'navigator', navDescriptor); else delete (globalThis as any).navigator;
  }
});

test('launch URLs retain only the same origin and the LINE external-browser flag', () => {
  const input = 'https://docpdf.example/line.html?customer=TEST&redirect=https%3A%2F%2Fevil.example&liff.state=x#private';
  assert.equal(appUrl(input), 'https://docpdf.example/');
  assert.equal(externalAppUrl(input), 'https://docpdf.example/?openExternalBrowser=1');
  assert.throws(() => appUrl('javascript:alert(1)'));
  assert.throws(() => appUrl('https://user:secret@docpdf.example/'));
});

test('offline navigation returns the requested help or LINE HTML instead of the document app', async () => {
  const listeners: Record<string, any> = {};
  const self = { location: 'https://docpdf.test/sw.js', addEventListener: (type: string, fn: any) => listeners[type] = fn };
  const source = readFileSync(new URL('../src/update/sw-template.js', import.meta.url), 'utf8')
    .replace('__BUILD__', 'test').replace('__ASSETS__', JSON.stringify(['./index.html', './line.html', './help.html']));
  const cache = { match: async (path: string) => new Response(path, { headers: { 'Content-Type': 'text/html' } }) };
  vm.runInNewContext(source, { self, caches: { open: async () => cache }, Response, URL, Set });
  for (const [url, expected] of [
    ['https://docpdf.test/?openExternalBrowser=1', './index.html'],
    ['https://docpdf.test/index', './index.html'],
    ['https://docpdf.test/line', './line.html'],
    ['https://docpdf.test/line.html?ignored=1', './line.html'],
    ['https://docpdf.test/help', './help.html'],
    ['https://docpdf.test/help.html', './help.html']
  ]) {
    let result: Promise<Response> | undefined;
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url }, respondWith: (value: Promise<Response>) => result = value });
    assert.equal(await (await result!).text(), expected);
  }
  for (const [url, method] of [['https://docpdf.test/missing.html', 'GET'], ['https://docpdf.test/', 'POST'], ['https://other.test/help', 'GET']]) {
    let intercepted = false;
    listeners.fetch({ request: { method, mode: 'navigate', url }, respondWith: () => intercepted = true });
    assert.equal(intercepted, false);
  }
});
