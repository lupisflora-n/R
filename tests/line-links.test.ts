import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('LINE configuration helper rejects the main site and non-origin/credential URLs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'docpdf-links-'));
  const script = fileURLToPath(new URL('../scripts/prepare-line-links.mjs', import.meta.url));
  try {
    for (const invalid of ['https://docscan-v2-test.pages.dev/', 'http://docpdf.example/', 'https://docpdf.example/path', 'https://docpdf.example/?customer=TEST', 'https://user:fake@docpdf.example/']) {
      assert.notEqual(spawnSync(process.execPath, [script, invalid], { cwd: directory, encoding: 'utf8' }).status, 0);
    }
    const valid = spawnSync(process.execPath, [script, 'https://docpdf.example/'], { cwd: directory, encoding: 'utf8' });
    assert.equal(valid.status, 0);
    const links = JSON.parse(readFileSync(join(directory, 'release/line-links.json'), 'utf8'));
    assert.equal(links.app, 'https://docpdf.example/?openExternalBrowser=1');
    assert.equal(links.help, 'https://docpdf.example/help?openExternalBrowser=1');
    assert.equal(links.configuredInLine, false);
    const github = spawnSync(process.execPath, [script, 'https://lupisflora-n.github.io/R/'], { cwd: directory, encoding: 'utf8' });
    assert.equal(github.status, 0);
    const githubLinks = JSON.parse(readFileSync(join(directory, 'release/line-links.json'), 'utf8'));
    assert.equal(githubLinks.app, 'https://lupisflora-n.github.io/R/?openExternalBrowser=1');
    assert.equal(githubLinks.help, 'https://lupisflora-n.github.io/R/help.html?openExternalBrowser=1');
  } finally { rmSync(directory, { recursive: true }); }
});
