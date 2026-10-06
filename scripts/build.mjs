import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const out = new URL('dist/', root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
async function compile(path) {
  for (const f of await readdir(new URL(path, root), { withFileTypes: true })) {
    const rel = path + '/' + f.name;
    if (f.isDirectory()) { await compile(rel); continue; }
    if (!f.name.endsWith('.ts')) continue;
    const target = new URL(rel.replace(/\.ts$/, '.js'), out);
    await mkdir(new URL('./', target), { recursive: true });
    const source = await readFile(new URL(rel, root), 'utf8');
    const js = stripTypeScriptTypes(source).replace(/(from\s*['"][^'"]+)\.ts(['"])/g, '$1.js$2').replace(/(new URL\(['"][^'"]+)\.ts(['"])/g, '$1.js$2');
    await writeFile(target, js);
  }
}
await compile('src');
await cp(new URL('vendor', root), new URL('vendor', out), { recursive: true });
await cp(new URL('public', root), out, { recursive: true });
await cp(new URL('index.html', root), new URL('index.html', out));
const entries = [];
async function walk(path) {
  for (const f of await readdir(new URL(path, out), { withFileTypes: true })) {
    const rel = path + f.name;
    if (f.isDirectory()) await walk(rel + '/');
    else entries.push(rel);
  }
}
await walk('');
const build = createHash('sha256');
for (const p of entries.sort()) { build.update(p); build.update(await readFile(new URL(p, out))); }
const hash = build.digest('hex').slice(0, 16);
const sw = await readFile(new URL('src/update/sw-template.js', root), 'utf8');
await writeFile(new URL('sw.js', out), sw.replace('__BUILD__', hash).replace('__ASSETS__', JSON.stringify(entries.map(p => './' + p))));
await writeFile(new URL('build.json', out), JSON.stringify({ build: hash, files: entries.length }));
console.log(`Built ${entries.length} local assets, build ${hash}. No network used.`);
