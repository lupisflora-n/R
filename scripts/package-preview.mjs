import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadZip } from '../tests/helpers.mjs';
const JSZip=loadZip(),zip=new JSZip(),files=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function walk(dir=''){
  for(const entry of await readdir('dist/'+dir,{withFileTypes:true})){
    const path=dir+entry.name;
    if(entry.isDirectory()){await walk(path+'/');continue;}
    if(!/^(src\/.*\.js|vendor\/[^/]+\.(?:js|mjs|txt|json)|(?:index|line|help)\.html|style\.css|icon\.svg|manifest\.webmanifest|_headers|sw\.js|build\.json)$/i.test(path))throw new Error('Unexpected public file: '+path);
    const bytes=await readFile('dist/'+path);
    if(bytes.length>25*1024*1024)throw new Error('Asset exceeds 25MiB: '+path);
    zip.file(path,bytes);files.push({path,bytes:bytes.length,sha256:sha(bytes)});
  }
}
await walk();
const build=JSON.parse(await readFile('dist/build.json','utf8')).build;
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
const check=await JSZip.loadAsync(bytes);
for(const file of files)if(sha(await check.file(file.path).async('nodebuffer'))!==file.sha256)throw new Error('Archive mismatch: '+file.path);
await mkdir('release',{recursive:true});
await mkdir('evidence',{recursive:true});
const output=`release/docpdf-line-preview-${build}.zip`;
await writeFile(output,bytes);
const manifest={build,output,archiveBytes:bytes.length,archiveSha256:sha(bytes),fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),published:false,files};
await writeFile('evidence/preview-package.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({...manifest,files:undefined},null,2));
