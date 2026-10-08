import { mkdir, writeFile } from 'node:fs/promises';
const supplied = process.argv[2];
if (!supplied) throw new Error('Provide the actual, verified HTTPS origin after separate-site deployment.');
const origin = new URL(supplied);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.hostname === 'docscan-v2-test.pages.dev') {
  throw new Error('Use a new, separate HTTPS origin without a path/query/credentials; never the main preview site.');
}
const app = new URL('/', origin); app.searchParams.set('openExternalBrowser', '1');
const help = new URL('/help', origin); help.searchParams.set('openExternalBrowser', '1');
const links = { origin: origin.origin, app: app.href, help: help.href,
  menuImage: 'design/line/rich-menu.png',
  labels: { left: 'docPDFを開く', right: '使い方と安全' },
  configuredInLine: false, verifiedOriginByOperator: 'Required before running this command; this command does not inspect deployment.' };
await mkdir('release', { recursive: true });
await writeFile('release/line-links.json', JSON.stringify(links, null, 2));
console.log(JSON.stringify(links, null, 2));
