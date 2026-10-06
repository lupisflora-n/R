import { readFileSync } from 'node:fs';
export function loadZip() {
  const module={exports:{}};
  new Function('module','exports',readFileSync(new URL('../vendor/jszip.js',import.meta.url),'utf8'))(module,module.exports);
  globalThis.JSZip=module.exports;
  return module.exports;
}
