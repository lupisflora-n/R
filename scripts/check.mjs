import { readdir, readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
let count = 0;
async function check(dir) {
  for (const item of await readdir(dir, {withFileTypes:true})) {
    const path = dir + '/' + item.name;
    if (item.isDirectory()) { await check(path); continue; }
    if (!path.endsWith('.ts')) continue;
    const source = await readFile(path,'utf8');
    const js = stripTypeScriptTypes(source);
    const result = spawnSync(process.execPath,['--input-type=module','--check'],{input:js,encoding:'utf8'});
    if (result.status) throw new Error(path + '\n' + result.stderr);
    if (/\beval\(|innerHTML\s*=|deleteDatabase|https?:\/\//.test(source) && !path.endsWith('core.test.ts')) throw new Error('Review unsafe source pattern: '+path);
    count++;
  }
}
await check('src');
console.log(`Syntax and safety patterns checked: ${count} TypeScript modules. Full TypeScript type checking is unavailable; this is syntax checking only.`);
