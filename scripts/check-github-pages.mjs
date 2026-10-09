import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const appBase = new URL('https://lupisflora-n.github.io/R/');
for (const page of ['index.html', 'line.html', 'help.html']) {
  const html = await readFile('dist/' + page, 'utf8');
  assert.ok(html.includes('http-equiv="Content-Security-Policy"'), page + ': no HTML CSP');
  assert.ok(html.includes('name="referrer" content="no-referrer"'), page + ': missing referrer restriction');
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const url = new URL(match[1], new URL(page, appBase));
    assert.equal(url.origin, appBase.origin, page + ': foreign resource');
    assert.ok(url.pathname.startsWith(appBase.pathname), page + ': resource escaped /R/');
    await access('dist/' + url.pathname.slice(appBase.pathname.length));
  }
}
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
for (const field of ['id', 'start_url', 'scope']) {
  assert.equal(new URL(manifest[field], appBase).href, appBase.href, 'manifest ' + field);
}
for (const icon of manifest.icons) {
  const url = new URL(icon.src, appBase);
  assert.ok(url.pathname.startsWith('/R/'));
  await access('dist/' + url.pathname.slice('/R/'.length));
}
console.log('PASS GitHub project Pages resources, CSP/referrer, manifest and scope remain inside /R/');
console.log('NOTE GitHub Pages does not apply Cloudflare _headers; frame-ancestors and Permissions-Policy are not enforced by that file.');
