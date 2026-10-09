import { mkdir, writeFile } from 'node:fs/promises';
const supplied = process.argv[2];
if (!supplied) throw new Error('Provide the actual, verified HTTPS app URL after deployment.');
const origin = new URL(supplied);
const githubProject = origin.origin === 'https://lupisflora-n.github.io' && origin.pathname === '/R/';
if (origin.protocol !== 'https:' || origin.username || origin.password || (origin.pathname !== '/' && !githubProject) || origin.search || origin.hash || origin.hostname === 'docscan-v2-test.pages.dev') {
  throw new Error('Use the separate HTTPS origin or approved GitHub project URL without query/credentials; never the main preview site.');
}
const app = new URL(origin); app.searchParams.set('openExternalBrowser', '1');
const help = new URL(githubProject ? 'help.html' : 'help', origin); help.searchParams.set('openExternalBrowser', '1');
const links = { origin: origin.origin, appBase: origin.href, app: app.href, help: help.href,
  menuImage: 'design/line/rich-menu.png',
  labels: { left: 'docPDFを開く', right: '使い方と安全' },
  configuredInLine: false, deploymentVerified: false,
  verificationRequired: 'Confirm deployment and its build before configuring these links in LINE; this command only prepares links.' };
await mkdir('release', { recursive: true });
await writeFile('release/line-links.json', JSON.stringify(links, null, 2));
console.log(JSON.stringify(links, null, 2));
