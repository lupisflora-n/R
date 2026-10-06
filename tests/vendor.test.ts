import{test}from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
test('vendored library and license bytes match recorded SHA-256 integrity',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../vendor/INTEGRITY.json',import.meta.url),'utf8'));
  for(const [name,entry]of Object.entries(manifest.files) as [string,{byteCount:number;sha256:string}][]){const bytes=await readFile(new URL('../vendor/'+name,import.meta.url));assert.equal(bytes.length,entry.byteCount);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
});
