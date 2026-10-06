import { createRequire } from 'node:module';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve,extname } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const live=Boolean(process.env.DOCSCAN_E2E_URL),base=process.env.DOCSCAN_E2E_URL || 'https://docscan.test';
const results=[],errors=[],external=[];
let browser,context,page;
async function check(name,action){const start=Date.now();try{await action();results.push({name,status:'PASS',ms:Date.now()-start});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',message:error.message});throw error;}}
await mkdir('evidence',{recursive:true});
try{
  let playwright;try{playwright=require('playwright');}catch{playwright=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
  const {chromium}=playwright;
  browser=await chromium.launch({executablePath:process.env.DOCSCAN_CHROMIUM || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  if(!live)await context.addInitScript(()=>{delete Navigator.prototype.serviceWorker;});
  if(!live)await context.route(base+'/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const file=resolve('dist','.'+(path==='/'?'/index.html':path));
    const type={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'}[extname(file)] || 'application/octet-stream';
    try{await route.fulfill({status:200,contentType:type,body:await readFile(file)});}catch{await route.fulfill({status:404,body:'Not found'});}
  });
  page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  context.on('request',req=>{if(!req.url().startsWith(base) && !req.url().startsWith('blob:') && !req.url().startsWith('data:'))external.push(req.url());});
  await check('mobile home loads with capture controls',async()=>{
    await page.goto(base);await page.getByRole('button',{name:'写真から選ぶ',exact:true}).waitFor();
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='写真から選ぶ').disabled);
    assert.match(await page.locator('body').innerText(),/その日の紙を、ひとつに/);await page.screenshot({path:'evidence/mobile-home.png',fullPage:true});
  });
  const sample=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=1280;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#172e2b';x.font='bold 44px sans-serif';x.fillText('SYNTHETIC DOCUMENT',72,110);x.font='22px sans-serif';x.fillText('TEST ONLY / 2026-10-03',72,158);x.font='16px sans-serif';for(let i=0;i<32;i++){x.fillText(`Line ${i+1}  123.45  0.05  8pt/10pt  sample`,72,240+i*25);x.fillRect(72,248+i*25,740,.5);}x.strokeStyle='#bb5544';x.lineWidth=3;x.strokeRect(650,80,140,90);x.font='26px sans-serif';x.fillStyle='#bb5544';x.fillText('FAKE',675,136);return Array.from(Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));}));
  await check('capture -> committed draft -> manual crop -> filter -> revision',async()=>{
    const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'写真から選ぶ',exact:true}).click();await(await chooser).setFiles({name:'synthetic.png',mimeType:'image/png',buffer:sample});
    await page.getByRole('dialog',{name:'四隅と見やすさを確認'}).waitFor();await page.getByRole('button',{name:'加工後を確認',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.editor-controls .notice')?.textContent?.startsWith('確認用の縮小画像です'));
    await page.screenshot({path:'evidence/editor.png',fullPage:true});
    await page.getByRole('button',{name:'編集を保存',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>!document.querySelector('.page-row input').disabled);
    const state=await page.evaluate(async()=>{const db=await import('/src/storage/db.js');const pages=await db.list('pages');const original=await db.get('assets',pages[0].originalAssetId);return{pages:pages.length,state:pages[0].state,originalSize:original.byteCount,hash:original.sha256};});
    assert.equal(state.pages,1);assert.equal(state.state,'READY');assert.equal(state.originalSize,sample.length);assert.match(state.hash,/^[0-9a-f]{64}$/);
  });
  await check('selected PDF -> saved bytes -> actual PDF.js rendering -> share cancellation',async()=>{
    await page.locator('.page-row input[type=checkbox]').check();await page.getByRole('button',{name:'1枚でPDFを作成',exact:true}).click();
    await page.getByRole('dialog',{name:'完成PDFを確認'}).waitFor();
    // A canvas has a nonzero default width even before PDF.js finishes rendering.
    await page.getByRole('dialog',{name:'完成PDFを確認'}).getByText('1 / 1',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>{const c=document.querySelector('[role=dialog] .pdfcanvas');const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>0 && pixels[i]<180 && pixels[i+1]<180 && pixels[i+2]<180)dark++;return dark>100;}),true,'PDF preview must contain visible document ink');
    await page.screenshot({path:'evidence/pdf-preview.png',fullPage:true});
    await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('Cancel','AbortError'))});});
    await page.getByRole('button',{name:'共有して送る',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('共有を取消しました'));
    await page.getByRole('button',{name:'閉じる',exact:true}).click();
    const pdfs=await page.evaluate(async()=>{const db=await import('/src/storage/db.js');return(await db.list('pdfs')).length;});assert.equal(pdfs,1);
  });
  await check('backup -> hash validation -> additive restore -> repeated import idempotency',async()=>{
    await page.getByRole('button',{name:'この日付の復元用ZIPを作る',exact:true}).click();await page.locator('.backups a').waitFor();
    const downloaded=page.waitForEvent('download');await page.locator('.backups a').click();const file=await downloaded;const path=await file.path();
    await page.locator('#restore-input').setInputFiles(path);await page.getByRole('dialog',{name:'復元内容を確認'}).waitFor();await page.getByRole('button',{name:'確認して追加する',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('復元しました'));
    const sizes=await page.evaluate(async()=>{const db=await import('/src/storage/db.js');return{pages:(await db.list('pages')).length,pdfs:(await db.list('pdfs')).length};});assert.deepEqual(sizes,{pages:2,pdfs:2});
    await page.locator('#restore-input').setInputFiles(path);await page.getByRole('button',{name:'確認して追加する',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    const count=await page.evaluate(async()=>{const db=await import('/src/storage/db.js');return(await db.list('pages')).length;});assert.equal(count,2);
  });
  await check('second tab is fenced from writing while first tab retains data',async()=>{
    const other=await context.newPage();await other.goto(base);await other.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('別の画面で作業中'));
    assert.equal(await other.getByRole('button',{name:'写真から選ぶ',exact:true}).isDisabled(),true);await other.close();
  });
  await check('saved documents survive browser reload',async()=>{
    await page.reload();await page.waitForFunction(()=>document.querySelector('.page-row')!==null);assert.match(await page.locator('body').innerText(),/編集済み/);
  });
  if(live)await check('real Service Worker offline resources and saved document reload',async()=>{
    await page.waitForFunction(()=>document.querySelector('header .pill').textContent==='オフライン資源準備済み');await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('.page-row')!==null);await context.setOffline(false);
  });
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  results.push({name:'no external document requests or browser errors',status:'PASS'});
  results.push({name:'WebKit engine',status:'NOT_RUN',reason:'This runner tests Chromium only. WebKit and actual iPhone require separate checks.'});
  if(!live)results.push({name:'Service Worker offline / upgrade network lifecycle',status:'BLOCKED',reason:'Browser harness fulfills local assets through Playwright routing without network; Service Worker is disabled in this harness. For a real server, set DOCSCAN_E2E_URL.'});
}catch(error){
  if(!browser){
    const reason=/Operation not permitted|EPERM/.test(error.message)?'Operating-system sandbox denied Chromium startup/IPC. No browser test ran.':error.code==='MODULE_NOT_FOUND'?'Playwright is unavailable in this execution environment. No browser test ran.':'Chromium could not start. No browser test ran.';
    results.push({name:'browser startup',status:'BLOCKED',reason});console.error('BLOCKED: '+reason);
  }else{if(!results.some(r=>r.status==='FAIL'))results.push({name:'browser verification',status:'FAIL',message:error.message});console.error(error.stack);}
  if(page)await page.screenshot({path:'evidence/failure.png',fullPage:true}).catch(()=>{});process.exitCode=1;
}
finally{await writeFile('evidence/browser-results.json',JSON.stringify({date:new Date().toISOString(),status:results.some(r=>r.status==='FAIL')?'FAIL':!browser?'BLOCKED':'COMPLETED',browser:live?'Playwright Chromium against a real server':'Playwright Chromium with in-memory local asset routing',passedBrowserTests:results.filter(r=>r.status==='PASS').length,results,errors,external},null,2));await context?.close();await browser?.close();}
