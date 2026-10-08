import { loadPlaywright } from './playwright.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

const base = 'https://docpdf.test';
const android = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Line/14.9.1';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/14.9.1';
const results = [], errors = [], external = [], writes = [];
let browser;
await mkdir('evidence/line', { recursive: true });
async function check(name, action) {
  try { await action(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); throw error; }
}
async function setup(agent) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: agent });
  const requests = [];
  await context.addInitScript(() => {
    delete Navigator.prototype.serviceWorker;
    window.__databaseOpens = 0;
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) { window.__databaseOpens++; return open.apply(this, args); };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('clipboard denied')) } });
  });
  context.on('request', request => {
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (!request.url().startsWith(base + '/') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url());
    if (request.method() !== 'GET') writes.push(request.method());
  });
  await context.route(base + '/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const file = resolve('dist', '.' + (pathname === '/' ? '/index.html' : pathname));
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream';
    try { await route.fulfill({ status: 200, contentType: type, body: await readFile(file) }); }
    catch { await route.fulfill({ status: 404, body: 'Not found' }); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, requests };
}

try {
  browser = await loadPlaywright().chromium.launch({ executablePath: process.env.DOCSCAN_CHROMIUM || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [name, agent] of [['Android LINE', android], ['iPhone LINE', iphone]]) {
    const { context, page, requests } = await setup(agent);
    try {
      await check(name + ' root is fenced before document imports/database, even with bypass query', async () => {
        await page.goto(base + '/?openExternalBrowser=1&customer=TEST#document');
        await page.getByRole('link', { name: 'ブラウザーでdocPDFを開く', exact: true }).waitFor();
        assert.equal(await page.locator('input[type=file]').count(), 0);
        assert.equal(await page.evaluate(() => window.__databaseOpens), 0);
        assert.equal(requests.some(path => /vendor|storage|app\.js/.test(path)), false);
        assert.equal(await page.locator('#launch-url').inputValue(), base + '/');
        assert.equal(await page.getByRole('link', { name: 'ブラウザーでdocPDFを開く', exact: true }).getAttribute('href'), base + '/?openExternalBrowser=1');
      });
      await check(name + ' manual copy fallback and guide leave camera/database unopened', async () => {
        await page.getByRole('button', { name: 'URLをコピー', exact: true }).click();
        await page.getByRole('status').getByText('URL欄を長押ししてコピーしてください。', { exact: true }).waitFor();
        await page.goto(base + '/line.html?redirect=https://evil.example');
        await page.getByRole('link', { name: 'ブラウザーでdocPDFを開く', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => window.__databaseOpens), 0);
        await page.getByRole('link', { name: '使い方・保存と安全の説明', exact: true }).click();
        await page.getByRole('heading', { name: '保存先は端末のブラウザー内', exact: true }).waitFor();
        assert.equal(await page.locator('input[type=file]').count(), 0);
        assert.equal(await page.evaluate(() => window.__databaseOpens), 0);
      });
      await check(name + ' launch fits 320/390/412px with touch-sized controls', async () => {
        await page.goto(base + '/line.html');
        await page.locator('#launch-url').waitFor();
        for (const width of [320, 390, 412]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const box = await page.getByRole('link', { name: 'ブラウザーでdocPDFを開く', exact: true }).boundingBox();
          assert.ok(box.height >= 44);
          await page.screenshot({ path: `evidence/line/${name.split(' ')[0].toLowerCase()}-${width}.png`, fullPage: true });
        }
      });
    } finally { await context.close(); }
  }
  const { context, page } = await setup('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36');
  try {
    await check('external browser landing opens the document app without login', async () => {
      await page.goto(base + '/line.html');
      await page.getByRole('link', { name: 'docPDFを開く', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === '写真から選ぶ' && !button.disabled));
      assert.ok(await page.evaluate(() => window.__databaseOpens) > 0);
      assert.match(await page.locator('body').innerText(), /docPDF/);
      await page.screenshot({ path: 'evidence/line/external-home.png', fullPage: true });
    });
  } finally { await context.close(); }
  await check('no external requests, HTTP writes, or page errors', () => {
    assert.deepEqual(external, []); assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  });
} catch (error) {
  if (!browser) {
    results.push({ name: 'browser startup', status: 'BLOCKED', reason: /Operation not permitted|EPERM/.test(error.message) ? 'Operating-system sandbox denied Chromium startup/IPC; no browser checks ran.' : error.message });
    console.error('BLOCKED: browser did not start.');
  } else {
    if (!results.some(result => result.status === 'FAIL')) results.push({ name: 'browser harness', status: 'FAIL', reason: error.message });
    console.error(error.stack);
  }
  process.exitCode = 1;
} finally {
  results.push({ name: 'real LINE external-browser handoff, camera, mail, and iPhone WebKit', status: 'NEEDS_HUMAN_TEST', reason: 'User-agent simulation does not test LINE/OS behavior or Safari.' });
  await writeFile('evidence/line/browser-results.json', JSON.stringify({ date: new Date().toISOString(), status: !browser ? 'BLOCKED' : results.some(r => r.status === 'FAIL') ? 'FAIL' : 'COMPLETED', results, errors, external, writes }, null, 2));
  await browser?.close();
}
