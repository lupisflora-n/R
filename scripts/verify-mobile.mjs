import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Run from the repository root on Windows and Linux; no shell or downloads.
const root = fileURLToPath(new URL('../', import.meta.url));
const steps = [
  ['syntax', ['scripts/check.mjs']],
  ['core tests', ['--experimental-strip-types', '--test', '--test-isolation=none',
    ...readdirSync(join(root, 'tests')).filter(name => name.endsWith('.test.ts')).sort().map(name => join(root, 'tests', name))]],
  ['build', ['scripts/build.mjs']],
  ['mobile browser and screenshots', ['tests/browser.mjs']],
];
for (const [name, args] of steps) {
  console.log(`\nRunning ${name}`);
  const run = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', timeout: 180_000 });
  if (run.error || run.status !== 0) {
    console.error(`${name} did not complete successfully. ${run.error?.message || ''}`);
    if (name === 'mobile browser and screenshots') {
      console.error('Read evidence/browser-results.json. A blocked run produces no verified screenshots.');
    }
    process.exit(run.status || 1);
  }
}
console.log('Mobile verification finished. Screenshots: evidence/mobile-home.png, evidence/editor.png, evidence/pdf-preview.png.');
console.log('Actual iPhone/Android camera and email checks remain separate.');
