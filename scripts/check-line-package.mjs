import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

const results = [];
async function check(name, fn) {
  await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name);
}
const entry = await readFile('dist/src/entry.js', 'utf8');
await check('bootstrap has compiled dynamic imports and no TypeScript paths', () => {
  assert.ok(entry.includes("import('./app.js')"));
  assert.ok(entry.includes("import('../vendor/jszip.js')"));
  assert.ok(!entry.includes('.ts'));
});
await check('HTML entry defers all document libraries until browser guard', async () => {
  const index = await readFile('dist/index.html', 'utf8');
  assert.ok(index.includes('./src/entry.js'));
  assert.ok(!index.includes('vendor/jszip.js') && !index.includes('./src/app.js'));
  const line = await readFile('dist/line.html', 'utf8');
  assert.ok(line.includes("connect-src 'none'"));
  assert.ok(!line.includes('type="file"'));
});
await check('same-origin resources only; no document HTTP writes, analytics, LINE SDK, or login endpoints', async () => {
  const scan = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) await scan(path);
      else if (/\.(?:js|html)$/.test(path)) {
        const source = await readFile(path, 'utf8');
        assert.ok(!/https?:\/\//.test(source), path + ': remote resource reference');
        assert.ok(!/sendBeacon|XMLHttpRequest|WebSocket|method\s*:\s*['"](?:POST|PUT|PATCH)|liff\.init|sendMessages|shareTargetPicker/.test(source), path + ': outbound document mechanism');
      }
    }
  };
  await scan('dist/src');
  for (const file of ['index.html', 'line.html', 'help.html']) {
    const html = await readFile('dist/' + file, 'utf8');
    assert.ok(!/https?:\/\//.test(html), file);
  }
});
await check('response headers limit resources and deny embedding/geolocation/microphone', async () => {
  const headers = await readFile('dist/_headers', 'utf8');
  for (const rule of ["connect-src 'self'", "frame-ancestors 'none'", 'Referrer-Policy: no-referrer', 'X-Content-Type-Options: nosniff', 'microphone=()', 'geolocation=()']) assert.ok(headers.includes(rule), rule);
});
await mkdir('evidence/line', { recursive: true });
await writeFile('evidence/line/static-checks.json', JSON.stringify({ date: new Date().toISOString(), results, limitation: 'Source/package review only. Does not establish actual network behavior, deployment header enforcement, or device safety.' }, null, 2));
