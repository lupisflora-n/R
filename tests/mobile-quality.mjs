import { existsSync } from 'node:fs';
import { loadPlaywright } from './playwright.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = loadPlaywright();
const live=Boolean(process.env.DOCSCAN_E2E_URL);
const base = process.env.DOCSCAN_E2E_URL || 'https://docscan.test';
const results = [], errors = [];
await mkdir('evidence/redesign/mobile-quality', { recursive:true });
const browser = await chromium.launch({headless:true,executablePath:process.env.DOCSCAN_CHROMIUM || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  for (const [width,height] of [[320,568],[360,800],[390,844],[412,915],[844,390]]) {
    const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
    if(!live){
      await context.addInitScript(()=>{delete Navigator.prototype.serviceWorker;});
      await context.route(base+'/**',async route=>{
        const path=new URL(route.request().url()).pathname,file=resolve('dist','.'+(path==='/'?'/index.html':path));
        const type={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'}[extname(file)] || 'application/octet-stream';
        try{await route.fulfill({status:200,contentType:type,body:await readFile(file)});}catch{await route.fulfill({status:404,body:'Not found'});}
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror',e=>errors.push(e.message));
    const record = {width,height,status:'PASS',checks:[]};
    async function check(name,fn){await fn();record.checks.push(name);}
    try {
      await page.goto(base);
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.getAttribute('aria-label')==='写真を選ぶ' && !b.disabled));
      await check('home fits viewport',async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)));
      await check('date has accessible label',async()=>assert.equal(await page.getByLabel('文書の日付',{exact:true}).count(),1));
      await page.screenshot({path:`evidence/redesign/mobile-quality/home-${width}.png`});
      const chooser=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'写真を選ぶ',exact:true}).click();
      await (await chooser).setFiles('tests/fixtures/portrait.png');
      const dialog=page.getByRole('dialog',{name:'写真を編集'});
      await dialog.waitFor();await dialog.locator('.handle').first().waitFor();
      await check('editor remains within viewport',async()=>{
        const b=await dialog.boundingBox();assert.ok(b.x>=-1 && b.y>=-1 && b.x+b.width<=width+1 && b.y+b.height<=height+1);
        assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
        assert.ok(await dialog.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'editor must not require scrolling');
        assert.ok(await dialog.locator('.dialogbody').evaluate(e=>e.scrollHeight<=e.clientHeight+1));
      });
      await check('current editor action is reachable by touch',async()=>{
        const b=dialog.getByRole('button',{name:'次へ',exact:true});
        await b.scrollIntoViewIfNeeded();await b.click({trial:true});
        const r=await b.boundingBox();assert.ok(r.height>=44 && r.width>=44);
      });
      await page.screenshot({path:`evidence/redesign/mobile-quality/editor-${width}.png`});
      await dialog.getByRole('button',{name:'次へ',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.fixed-editor')?.dataset.editorMode==='tone' && document.querySelector('.fixed-editor')?.dataset.previewReady==='true' && !document.querySelector('.editor-save').disabled);
      await check('tone editor and balance fit viewport without scrolling',async()=>{
        assert.ok(await dialog.evaluate(e=>e.scrollHeight<=e.clientHeight+1 && e.scrollWidth<=e.clientWidth+1));
        assert.ok(await dialog.locator('.dialogbody').evaluate(e=>e.scrollHeight<=e.clientHeight+1));
        assert.equal(await dialog.locator('#editor-balance').isVisible(),true);
        const b=await dialog.getByRole('button',{name:'編集を保存',exact:true}).boundingBox();
        assert.ok(b.x>=-1 && b.y>=-1 && b.x+b.width<=width+1 && b.y+b.height<=height+1 && b.height>=44);
      });
      await page.screenshot({path:`evidence/redesign/mobile-quality/tone-${width}.png`});
      await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
      await page.reload();
      await check('cancelled editing preserves draft',async()=>{await page.getByText('下書き',{exact:true}).waitFor();});
    } catch(error) {record.status='FAIL';record.message=error.message;process.exitCode=1;}
    results.push(record);await context.close();
  }
} finally {
  await browser.close();
  if(errors.length)process.exitCode=1;
  await writeFile('evidence/redesign/mobile-quality/results.json',JSON.stringify({date:new Date().toISOString(),scope:'Chromium touch emulation; not physical Android or iPhone',results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));
}
