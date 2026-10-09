import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.DOCSCAN_E2E_URL || 'http://127.0.0.1:4173';
const results = [], errors = [];
await mkdir('evidence/mobile-quality', { recursive:true });
const browser = await chromium.launch({headless:true});
try {
  for (const [width,height] of [[320,568],[360,800],[390,844],[412,915],[844,390]]) {
    const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror',e=>errors.push(e.message));
    const record = {width,height,status:'PASS',checks:[]};
    async function check(name,fn){await fn();record.checks.push(name);}
    try {
      await page.goto(base);
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.getAttribute('aria-label')==='写真から選ぶ' && !b.disabled));
      await check('home fits viewport',async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)));
      await check('date has accessible label',async()=>assert.equal(await page.getByLabel('文書の日付',{exact:true}).count(),1));
      await page.screenshot({path:`evidence/mobile-quality/home-${width}.png`});
      const chooser=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'写真から選ぶ',exact:true}).click();
      await (await chooser).setFiles('tests/fixtures/portrait.png');
      const dialog=page.getByRole('dialog',{name:'四隅と見やすさを確認'});
      await dialog.waitFor();
      await check('editor remains within viewport',async()=>{
        const b=await dialog.boundingBox();assert.ok(b.x>=-1 && b.y>=-1 && b.x+b.width<=width+1 && b.y+b.height<=height+1);
        assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
        assert.ok(await dialog.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'editor must not require scrolling');
        assert.ok(await dialog.locator('.dialogbody').evaluate(e=>e.scrollHeight<=e.clientHeight+1));
      });
      await check('current editor action is reachable by touch',async()=>{
        const b=dialog.getByRole('button',{name:'四隅を決定',exact:true});
        await b.scrollIntoViewIfNeeded();await b.click({trial:true});
        const r=await b.boundingBox();assert.ok(r.height>=44 && r.width>=44);
      });
      await page.screenshot({path:`evidence/mobile-quality/editor-${width}.png`});
      await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
      await page.reload();
      await check('cancelled editing preserves draft',async()=>{await page.getByText('下書き · 編集を再開できます',{exact:true}).waitFor();});
    } catch(error) {record.status='FAIL';record.message=error.message;process.exitCode=1;}
    results.push(record);await context.close();
  }
} finally {
  await browser.close();
  if(errors.length)process.exitCode=1;
  await writeFile('evidence/mobile-quality/results.json',JSON.stringify({date:new Date().toISOString(),scope:'Chromium touch emulation; not physical Android or iPhone',results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));
}
