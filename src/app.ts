import { localDate, safeError, sizeText, validateCorners, pdfName } from './core.ts';
import { defaultRecipe, id, now } from './model.ts';
import type { Day, IngestIntent, Page, PdfExport, Recipe, Revision } from './model.ts';
import * as db from './storage/db.ts';
import { decode, processImage, validateImage } from './processing/image.ts';
import { createPdf, download, handOff, logShare, preparedFile } from './exports/pdf.ts';
import { openPdf } from './exports/viewer.ts';
import { exportDay, inspectBackup, restoreBackup } from './backup/backup.ts';
import { initializeUpdates } from './update/client.ts';

function el<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K] {
  const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;
}
function button(text:string,action:()=>void,className=''):HTMLButtonElement {
  const b=el('button',text,className);b.type='button';b.addEventListener('click',action);return b;
}
function field(label:string,input:HTMLElement):HTMLElement {
  const wrap=el('div','','field');const l=el('label',label);if(input.id)l.htmlFor=input.id;wrap.append(l,input);return wrap;
}
const app=document.querySelector('#app')!;
const header=el('header'),brand=el('div','','brand'),icon=el('img');icon.src='./icon.svg';icon.alt='';brand.append(icon,el('strong','日付スキャン'));
const offlinePill=el('span','準備中','pill');header.append(brand,offlinePill);
const main=el('main','','wrap');main.append(el('div','DAILY DOCUMENTS','eyebrow'),el('h1','その日の紙を、ひとつに。'),el('p','写真を整えて、日付ごとに保存。必要な分だけPDFにして送れます。','subtitle'));
const datebar=el('div','','datebar'),dateInput=el('input');dateInput.type='date';dateInput.id='document-date';dateInput.value=localDate();
const recent=el('select');recent.id='recent-days';recent.setAttribute('aria-label','保存済みの日付');
const todayButton=button('今日',()=>{if(busy || editing || pendingCapture)return;dateInput.value=localDate();void changeDate();},'quiet');
const dateLabel=el('label','文書の日付');dateLabel.htmlFor=dateInput.id;
datebar.append(dateLabel,dateInput,todayButton,recent);main.append(datebar);
const storageNotice=el('div','写真はこの端末・ブラウザー内に保存されます。消失に備え、大切な日付は復元用バックアップも外部へ保存してください。','notice');main.append(storageNotice);
const updateNotice=el('div','','notice hidden');main.append(updateNotice);
const captureCard=el('section','','card'),captureHead=el('div','','sectionhead');captureHead.append(el('h2','1. 写真を追加'));
const camera=el('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.className='hidden';camera.id='camera-input';
const gallery=el('input');gallery.type='file';gallery.accept='image/jpeg,image/png,image/heic,image/heif';gallery.className='hidden';gallery.id='gallery-input';
const cameraButton=button('＋ 紙を撮影',()=>choose(camera),'primary'),galleryButton=button('写真から選ぶ',()=>choose(gallery));
const captureActions=el('div','','capture');captureActions.append(cameraButton,galleryButton);captureCard.append(captureHead,captureActions,camera,gallery,el('p','受け取った写真を先に保存します。編集を途中で閉じても、下書きから再開できます。','muted small'));main.append(captureCard);
const retryCaptureButton=button('未保存の写真を再試行',()=>{if(pendingCapture)void ingest(pendingCapture.file,pendingCapture.target);},'hidden');captureCard.append(retryCaptureButton);
const discardCaptureButton=button('未保存の写真を破棄',()=>{if(busy || !pendingCapture)return;if(confirm('この写真はアプリへ保存できていません。端末側に写真が残っていることを確認してください。画面内の未保存写真を破棄しますか？')){pendingCapture=undefined;void prepareIntent();controls();tell('未保存の写真を破棄しました。保存済みの文書は変更していません。');}},'hidden danger');captureCard.append(discardCaptureButton);
const pagesCard=el('section','','card'),pagesHead=el('div','','sectionhead'),pageCount=el('span','0枚','pill');pagesHead.append(el('h2','2. 整えて、選ぶ'),pageCount);
const pagesArea=el('div'),selectionActions=el('div','','actions');selectionActions.append(button('編集済みを全選択',()=>{selected=currentPages.filter(p=>p.state==='READY').map(p=>p.id);renderSelection();renderPages();}),button('選択を解除',()=>{selected=[];renderSelection();renderPages();},'quiet'));
pagesCard.append(pagesHead,pagesArea,selectionActions);main.append(pagesCard);
const pdfCard=el('section','','card'),pdfHead=el('div','','sectionhead');pdfHead.append(el('h2','3. PDFにして送る'));
const orderList=el('div','','orderlist'),nameInput=el('input');nameInput.id='pdf-name';nameInput.value=`${localDate()}_文書`;nameInput.maxLength=100;nameInput.className='wideinput';
const generateButton=button('PDFを作成',()=>void generate(),'primary'),cancelJob=button('処理を取消',()=>jobAbort?.abort(),'hidden');
const pdfsArea=el('div');pdfCard.append(pdfHead,el('p','選んだ順番で作成します。完成したPDFを確認してから、別のボタンで共有します。','muted'),orderList,field('PDFの名前',nameInput),generateButton,cancelJob,pdfsArea);main.append(pdfCard);
const backupCard=el('section','','card'),backupHead=el('div','','sectionhead');backupHead.append(el('h2','端末の外にも残す'));
const backupButton=button('この日付の復元用ZIPを作る',()=>void backup()),restoreInput=el('input');restoreInput.type='file';restoreInput.accept='.zip,application/zip';restoreInput.multiple=true;restoreInput.id='restore-input';restoreInput.className='hidden';
const restoreButton=button('復元用ZIPを読み込む',()=>restoreInput.click()),backupFiles=el('div','','backups');
backupCard.append(backupHead,el('p','PDFは読む・送るためのファイル。復元用ZIPには原本・現在の編集・日付・完成PDFが入ります。ZIPは暗号化されず、原本の撮影位置なども含む場合があります。','muted'),backupButton,restoreButton,restoreInput,backupFiles);
const storageDetail=el('p','','muted small'),persistButton=button('端末に保存の保持を依頼',()=>void persist());backupCard.append(storageDetail,persistButton);main.append(backupCard);
main.append(el('footer','日付スキャン v2 · 開発検証版\n文書の外部アップロード・自動メール送信は行いません。'));
const status=el('div','','status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');main.append(status);app.append(header,main);

let currentDay:Day,currentPages:Page[]=[],selected:string[]=[],intent:IngestIntent|undefined,captureTarget:IngestIntent|undefined;
let writable=false,busy=false,editing=false,jobAbort:AbortController|undefined;
let pendingCapture:{file:File;target:IngestIntent}|undefined;
let thumbnailUrls:string[]=[],backupUrls:string[]=[];
function tell(message:string,error=false):void {status.textContent=message;status.classList.toggle('error',error);}
function fail(error:unknown):void {tell(safeError(error),true);}
function controls():void {
  for(const b of [cameraButton,galleryButton,backupButton,generateButton,restoreButton])b.disabled=busy || editing || !writable || !currentDay;
  if(!intent || pendingCapture){cameraButton.disabled=true;galleryButton.disabled=true;}
  generateButton.disabled=generateButton.disabled || !selected.length || selected.length>10;
  dateInput.disabled=busy || editing || Boolean(pendingCapture);recent.disabled=busy || editing || Boolean(pendingCapture);todayButton.disabled=busy || editing || Boolean(pendingCapture);
  retryCaptureButton.disabled=busy || editing;retryCaptureButton.classList.toggle('hidden',!pendingCapture);
  discardCaptureButton.disabled=busy || editing;discardCaptureButton.classList.toggle('hidden',!pendingCapture);
  for(const check of pagesArea.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))check.disabled=busy || editing || !writable || check.dataset.ready!=='true';
  for(const editButton of pagesArea.querySelectorAll<HTMLButtonElement>('button'))editButton.disabled=busy || editing || !writable;
  for(const node of document.querySelectorAll<HTMLInputElement|HTMLButtonElement>('.editor-controls button,.editor-controls input,#page-title'))node.disabled=busy;
}
async function run(action:()=>Promise<void>):Promise<void> {
  if(busy){tell('処理中です。完了をお待ちください。');return;}
  busy=true;controls();try{await action();}catch(error){fail(error);}finally{busy=false;controls();}
}
function dialog(title:string,onClose:()=>void):{overlay:HTMLElement;body:HTMLElement;footer:HTMLElement;close:()=>void} {
  const prior=document.activeElement as HTMLElement,overlay=el('div','','overlay'),panel=el('div','','dialog');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);
  const top=el('div','','dialoghead'),closeButton=button('閉じる',()=>{if(!busy){close();onClose();}}),body=el('div','','dialogbody'),footer=el('div','','dialogfooter');
  top.append(el('h2',title),closeButton);panel.append(top,body,footer);overlay.append(panel);document.body.append(overlay);closeButton.focus();
  const keydown=(event:KeyboardEvent)=>{
    if(event.key==='Escape' && !busy){close();onClose();}
    if(event.key==='Tab'){const nodes=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
  };
  overlay.addEventListener('keydown',keydown);
  function close(){overlay.remove();prior?.focus();}
  return {overlay,body,footer,close};
}
async function prepareIntent():Promise<void> {
  intent=undefined;controls();if(writable && currentDay)intent=await db.beginIntent(currentDay.id);controls();
}
async function changeDate():Promise<void> {
  await run(async()=>{currentDay=await db.dayFor(dateInput.value);selected=[];nameInput.value=`${currentDay.documentDate}_文書`;await refresh();});
}
dateInput.addEventListener('change',()=>void changeDate());
recent.addEventListener('change',()=>void run(async()=>{const day=await db.get('days',recent.value);if(!day)return;currentDay=day;dateInput.value=day.documentDate;selected=[];nameInput.value=`${day.documentDate}_文書`;await refresh();}));
async function refresh():Promise<void> {
  currentPages=(await db.list('pages')).filter(p=>p.dayId===currentDay.id).sort((a,b)=>a.orderIndex-b.orderIndex);
  selected=selected.filter(id=>currentPages.some(p=>p.id===id && p.state==='READY'));
  recent.replaceChildren(el('option','保存済みの日付'));
  for(const day of (await db.list('days')).sort((a,b)=>b.documentDate.localeCompare(a.documentDate))){const option=el('option',`${day.documentDate}${day.id===currentDay.id?' · 表示中':''}`);option.value=day.id;recent.append(option);}
  renderPages();renderSelection();await renderPdfs();await prepareIntent();
  const estimate=await navigator.storage?.estimate?.();const persistent=await navigator.storage?.persisted?.();
  storageDetail.textContent=`端末内の使用量: ${estimate?.usage!==undefined?sizeText(estimate.usage):'取得不可'} / 容量の目安: ${estimate?.quota!==undefined?sizeText(estimate.quota):'取得不可'}。保存保持: ${persistent?'許可あり（消失保証ではありません）':'未許可または確認不可'}。`;
}
function choose(input:HTMLInputElement):void {
  if(!intent || busy || !writable || pendingCapture)return;
  captureTarget=intent;intent=undefined;busy=true;controls();input.value='';input.click();
}
for(const input of [camera,gallery]) {
  input.addEventListener('cancel',()=>{busy=false;captureTarget=undefined;void prepareIntent();tell('撮影・選択を取消しました。保存済みの写真は残っています。');controls();});
  input.addEventListener('change',()=>{
    const file=input.files?.[0],target=captureTarget;captureTarget=undefined;busy=false;
    if(!file || !target){void prepareIntent();return;}
    void ingest(file,target);
  });
}
async function ingest(file:File,target:IngestIntent):Promise<void> {
    pendingCapture={file,target};
    await run(async()=>{
      writable=await db.acquire();if(!writable)throw new Error('別の画面が作業中のため、この写真を保存できません。写真を端末側に残し、元の画面を閉じて再選択してください。');
      tell('写真を下書きとして保存しています…');
      if(!file.size || file.size>50*1024*1024)throw new Error('写真は50 MB以下を選んでください。既存データは変更していません。');
      const page=await db.saveOriginal(file,target);pendingCapture=undefined;tell('写真を下書き保存しました。四隅と白黒を確認してください。');
      await refresh();
      try{await validateImage(file);}catch(error){await db.write(['pages'],tx=>tx.objectStore('pages').put({...page,state:'DRAFT_UNSUPPORTED'}));await refresh();throw error;}
      busy=false;await edit(page);busy=true;
    });
    if(pendingCapture)tell('写真をまだ保存できていません。この画面を閉じず、空き容量や他の画面の作業を確認して「未保存の写真を再試行」を押してください。',true);
}
function renderPages():void {
  for(const url of thumbnailUrls)URL.revokeObjectURL(url);thumbnailUrls=[];pagesArea.replaceChildren();pageCount.textContent=`${currentPages.length}枚`;
  if(!currentPages.length){const empty=el('div','','empty');empty.append(el('div','▤','glyph'),el('p','まだ写真がありません。'),el('p','紙を撮影して、今日の文書を追加しましょう。','small'));pagesArea.append(empty);return;}
  for(const page of currentPages) {
    const row=el('div','','page-row'),check=el('input');check.type='checkbox';check.dataset.ready=String(page.state==='READY');check.checked=selected.includes(page.id);check.disabled=page.state!=='READY' || busy || !writable;check.setAttribute('aria-label',`${page.title}をPDFに選択`);check.addEventListener('change',()=>{selected=check.checked?[...selected,page.id]:selected.filter(id=>id!==page.id);renderSelection();});
    const img=el('img','','thumbnail');img.alt=page.title;
    void(async()=>{const revision=page.activeRevisionId?await db.get('revisions',page.activeRevisionId):undefined;const asset=await db.get('assets',revision?.renderedAssetId || page.originalAssetId);if(asset && img.isConnected){const url=URL.createObjectURL(asset.blob);thumbnailUrls.push(url);img.src=url;img.onerror=()=>{img.removeAttribute('src');img.alt='表示できない原本';};}})();
    const info=el('div');info.append(el('strong',page.title),el('div',page.state==='READY'?'編集済み · PDFに選択できます':page.state==='DRAFT_UNSUPPORTED'?'原本保存済み · この端末では編集できません':'下書き · 編集を再開できます',page.state==='READY'?'rowmeta':'rowmeta draft'));
    const editButton=button('編集',()=>void edit(page));editButton.disabled=busy || !writable;row.append(check,img,info,editButton);pagesArea.append(row);
  }
}
function renderSelection():void {
  orderList.replaceChildren();
  if(!selected.length)orderList.append(el('p','編集済みの写真にチェックを付けてください。','muted small'));
  selected.forEach((pageId,i)=>{
    const page=currentPages.find(p=>p.id===pageId)!;const row=el('div','','orderrow');row.append(el('span',`${i+1}. ${page.title}`));
    const up=button('↑',()=>{[selected[i-1],selected[i]]=[selected[i],selected[i-1]];renderSelection();});up.disabled=i===0 || busy;up.setAttribute('aria-label',`${page.title}を前へ`);
    const down=button('↓',()=>{[selected[i],selected[i+1]]=[selected[i+1],selected[i]];renderSelection();});down.disabled=i===selected.length-1 || busy;down.setAttribute('aria-label',`${page.title}を後へ`);row.append(up,down);orderList.append(row);
  });
  generateButton.textContent=selected.length?`${selected.length}枚でPDFを作成`:'PDFを作成';controls();
}
async function renderPdfs():Promise<void> {
  pdfsArea.replaceChildren();
  const records=(await db.list('pdfs')).filter(p=>p.dayId===currentDay.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(records.length)pdfsArea.append(el('hr','','divider'),el('h3','保存済みPDF'));
  for(const record of records){const row=el('div','','pdf-row');const info=el('div');info.append(el('strong',record.displayName),el('div',`${record.orderedPageIds?.length || record.orderedRevisionIds.length}ページ · 完成版`,'rowmeta'));row.append(info,button('確認・共有',()=>void viewPdf(record)));pdfsArea.append(row);}
}
async function edit(page:Page):Promise<void> {
  if(busy || editing || !writable)return;
  editing=true;controls();
  let abort:AbortController|undefined;let removed=false;let previewUrl:string|undefined;
  const modal=dialog('四隅と見やすさを確認',()=>{removed=true;abort?.abort();if(previewUrl)URL.revokeObjectURL(previewUrl);editing=false;controls();});
  try {
    const original=await db.get('assets',page.originalAssetId);if(!original)throw new Error('原本がありません。');
    const previous=page.activeRevisionId?await db.get('revisions',page.activeRevisionId):undefined;
    let recipe:Recipe=structuredClone(previous?.recipe || defaultRecipe()),active=0;const history:Recipe[]=[];
    const decoded=await decode(original.blob,1000);if(removed)return;
    const title=el('input');title.value=page.title;title.id='page-title';title.maxLength=100;
    modal.body.append(field('文書の名前',title),el('p','写真全体の四隅を調整します。番号を選んで矢印でも微調整できます。回転は補正後の画像に適用されます。','muted small'));
    const stage=el('div','','editor-stage'),canvas=el('canvas');canvas.width=decoded.pixels.width;canvas.height=decoded.pixels.height;canvas.getContext('2d')!.putImageData(decoded.pixels,0,0);
    const handles=el('div','','handles');stage.append(canvas,handles);modal.body.append(stage);
    const pointButtons=el('div','','cornerbuttons'),handleButtons:HTMLButtonElement[]=[];
    const checkpoint=()=>{history.push(structuredClone(recipe));if(history.length>50)history.shift();};
    function paint(){canvas.getContext('2d')!.putImageData(decoded.pixels,0,0);handles.classList.remove('hidden');handleButtons.forEach((b,i)=>{b.style.left=`${recipe.points[i].x*100}%`;b.style.top=`${recipe.points[i].y*100}%`;b.classList.toggle('active',active===i);});}
    for(let i=0;i<4;i++) {
      const b=button(String(i+1),()=>{active=i;paint();},'handle');b.setAttribute('aria-label',`${['左上','右上','右下','左下'][i]}の四隅`);handles.append(b);handleButtons.push(b);
      const move=(event:PointerEvent)=>{const rect=canvas.getBoundingClientRect();recipe.points[i]={x:Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))};paint();};
      b.addEventListener('pointerdown',event=>{if(busy)return;event.preventDefault();checkpoint();active=i;b.setPointerCapture(event.pointerId);paint();});
      b.addEventListener('pointermove',event=>{if(b.hasPointerCapture(event.pointerId) && !busy)move(event);});
      b.addEventListener('pointerup',event=>{if(b.hasPointerCapture(event.pointerId))b.releasePointerCapture(event.pointerId);});
      pointButtons.append(button(`${i+1} ${['左上','右上','右下','左下'][i]}`,()=>{active=i;paint();}));
    }
    const controlsArea=el('div','','editor-controls');controlsArea.append(pointButtons);
    const nudge=el('div','','nudge');for(const [label,dx,dy] of [['←',-1,0],['↑',0,-1],['↓',0,1],['→',1,0]] as const)nudge.append(button(label,()=>{if(busy)return;checkpoint();recipe.points[active]={x:Math.min(1,Math.max(0,recipe.points[active].x+dx*0.002)),y:Math.min(1,Math.max(0,recipe.points[active].y+dy*0.002))};paint();}));controlsArea.append(nudge);
    const editActions=el('div','','actions');editActions.append(button('原本の全画角へ',()=>{checkpoint();recipe.points=defaultRecipe().points;paint();}),button('90°回転',()=>{checkpoint();recipe.rotation=((recipe.rotation+90)%360) as Recipe['rotation'];rotationText.textContent=`補正後の回転: ${recipe.rotation}°`;}),button('ひとつ戻す',()=>{if(history.length){recipe=history.pop()!;paint();syncParams();}}));controlsArea.append(editActions);
    const rotationText=el('p',`補正後の回転: ${recipe.rotation}°`,'muted small');controlsArea.append(rotationText);
    const filters=el('div','','filterbuttons');
    const filterButtons=new Map<string,HTMLButtonElement>();
    for(const [value,label] of [['readable','読みやすい白黒'],['gray','グレー'],['color','カラー'],['binary','強い白黒']] as const){const b=button(label,()=>{if(busy)return;checkpoint();recipe.filter=value;syncParams();});filters.append(b);filterButtons.set(value,b);}controlsArea.append(filters);
    const brightness=el('input');brightness.id='brightness';brightness.type='range';brightness.min='-40';brightness.max='40';brightness.step='1';
    const contrast=el('input');contrast.id='contrast';contrast.type='range';contrast.min='0.7';contrast.max='1.5';contrast.step='0.05';
    brightness.addEventListener('change',()=>{checkpoint();recipe.brightness=Number(brightness.value);});contrast.addEventListener('change',()=>{checkpoint();recipe.contrast=Number(contrast.value);});controlsArea.append(field('明るさ',brightness),field('コントラスト',contrast));
    function syncParams(){brightness.value=String(recipe.brightness);contrast.value=String(recipe.contrast);rotationText.textContent=`補正後の回転: ${recipe.rotation}°`;for(const [key,b]of filterButtons)b.classList.toggle('selected',key===recipe.filter);}
    const editorMessage=el('p','','notice'),comparison=el('canvas','','pdfcanvas hidden');
    const previewButton=button('加工後を確認',()=>void run(async()=>{validateCorners(recipe.points);editorMessage.textContent='確認用の画像を処理しています…';abort=new AbortController();const result=await processImage(original.blob,recipe,abort.signal,true);const preview=await decode(result.blob);comparison.width=preview.pixels.width;comparison.height=preview.pixels.height;comparison.getContext('2d')!.putImageData(preview.pixels,0,0);comparison.classList.remove('hidden');editorMessage.textContent='確認用の縮小画像です。保存時は原本から処理します。細字・小数点・印影が残っているか、原本と比べてください。';}));
    controlsArea.append(previewButton,comparison,editorMessage);modal.body.append(controlsArea);
    const saveButton=button('編集を保存',()=>void run(async()=>{
      validateCorners(recipe.points);editorMessage.textContent='原本から編集版を作成・保存しています…';const fence=db.currentToken(),snapshot=structuredClone(recipe),titleSnapshot=title.value.trim();abort=new AbortController();
      const result=await processImage(original.blob,snapshot,abort.signal),asset=await db.makeAsset(result.blob,'rendered',result.width,result.height);
      if(abort.signal.aborted)throw new DOMException('取消しました','AbortError');
      const revision:Revision={id:id(),pageId:page.id,originalHash:original.sha256,recipe:snapshot,filterVersion:1,renderedAssetId:asset.id,createdAt:now()};
      await db.saveRevision(page,revision,asset,fence,titleSnapshot,abort.signal);
      removed=true;modal.close();editing=false;tell(`編集を保存しました（${result.width} × ${result.height}画素）。原本は保持しています。`);await refresh();
    }),'primary');
    modal.footer.append(saveButton,button('処理を取消',()=>abort?.abort()));syncParams();paint();
  }catch(error){fail(error);modal.body.append(el('p',safeError(error),'notice warning'));}
}
async function generate():Promise<void> {
  await run(async()=>{
    jobAbort=new AbortController();cancelJob.classList.remove('hidden');
    try {tell('PDFを作成しています…');const pages=selected.map(id=>currentPages.find(p=>p.id===id)!);const record=await createPdf(currentDay.id,pages,nameInput.value,n=>tell(`PDFを作成・検査しています… ${n}%`),jobAbort.signal);tell('PDFを保存しました。プレビューで内容を確認してください。');await renderPdfs();busy=false;await viewPdf(record);busy=true;}
    finally{jobAbort=undefined;cancelJob.classList.add('hidden');}
  });
}
async function viewPdf(record:PdfExport):Promise<void> {
  if(busy || editing)return;
  editing=true;controls();let viewer:Awaited<ReturnType<typeof openPdf>>|undefined;let closed=false;
  const modal=dialog('完成PDFを確認',()=>{closed=true;void viewer?.close();editing=false;controls();});
  try {
    const file=await preparedFile(record);if(closed)return;
    const rename=el('input');rename.id='export-name';rename.value=record.displayName;rename.maxLength=104;
    modal.body.append(field('PDFの名前',rename),el('p',`${record.orderedPageIds?.length || record.orderedRevisionIds.length}ページ · ${sizeText(file.size)}`,'muted'));
    if(file.size>10*1024*1024)modal.body.append(el('p','10 MBを超えています。メール側の上限に応じて、枚数を分けて作成してください。','notice warning'));
    const canvas=el('canvas','','pdfcanvas'),pager=el('div','','actions'),countLabel=el('span');modal.body.append(canvas,pager);
    viewer=await openPdf(file);if(closed){void viewer.close();return;}let index=1,rendering=false;
    const paint=async()=>{if(rendering || !viewer)return;rendering=true;prev.disabled=true;next.disabled=true;try{await viewer.render(canvas,index);countLabel.textContent=`${index} / ${viewer.count}`;}finally{rendering=false;prev.disabled=index<=1;next.disabled=index>=viewer.count;}};
    const prev=button('前のページ',()=>{index--;void paint().catch(fail);}),next=button('次のページ',()=>{index++;void paint().catch(fail);});pager.append(prev,countLabel,next);await paint();
    let shareFile=file;
    rename.addEventListener('input',()=>{shareFile=new File([file],pdfName(rename.value),{type:'application/pdf'});});
    const shareButton=button('共有して送る',()=>{
      const promise=handOff(shareFile);
      void logShare(record.id,'requested').catch(()=>{});
      promise.then(()=>{tell('共有先へ引き渡しました。メールの宛先と添付を確認し、送信はメールアプリで行ってください。');void logShare(record.id,'handed-off').catch(()=>{});}).catch(error=>{if(error?.name==='AbortError'){tell('共有を取消しました。完成PDFは保存されています。');void logShare(record.id,'canceled').catch(()=>{});}else{fail(error);void logShare(record.id,'failed').catch(()=>{});}});
    },'primary');
    modal.footer.append(shareButton,button('ファイルに保存',()=>{download(shareFile,shareFile.name);tell('ファイル保存を要求しました。端末の保存先を確認してください。');void logShare(record.id,'requested','download').catch(()=>{});}),button('名前を保存',()=>void run(async()=>{record={...record,displayName:pdfName(rename.value)};await db.write(['pdfs'],tx=>tx.objectStore('pdfs').put(record));await renderPdfs();tell('アプリ内のPDF名を保存しました。既に外へ保存したコピーの名前は変わりません。');})));
    modal.body.append(el('p','共有先にメールアプリが出ない場合は「ファイルに保存」して、メール側から添付してください。共有はメールの送信完了を意味しません。','muted small'));
  }catch(error){fail(error);modal.body.append(el('p',safeError(error),'notice warning'));}
}
async function backup():Promise<void> {
  await run(async()=>{
    const files=await exportDay(currentDay,message=>tell(message));backupFiles.replaceChildren();for(const url of backupUrls)URL.revokeObjectURL(url);backupUrls=[];
    for(const file of files){const a=el('a',`${file.name} を保存（${sizeText(file.blob.size)}）`);a.href=URL.createObjectURL(file.blob);a.download=file.name;backupUrls.push(a.href);backupFiles.append(a);}
    tell(`${files.length}部の復元用ZIPを準備しました。全て保存し、再読込みして確認してください。端末外に保存されたことは自動確認できません。`);
  });
}
restoreInput.addEventListener('change',()=>void run(async()=>{
  const files=Array.from(restoreInput.files || []);restoreInput.value='';tell('復元用ZIPの形式・サイズ・ハッシュを確認しています…');const inspected=await inspectBackup(files);
  busy=false;const modal=dialog('復元内容を確認',()=>{});modal.body.append(el('p',`${inspected.date} · 写真 ${inspected.pageCount}枚 · PDF ${inspected.pdfCount}件`),el('p','既存の文書は上書きせず、別の保存グループとして追加します。同じバックアップの再取込は重複を作りません。','notice'));
  modal.footer.append(button('確認して追加する',()=>void run(async()=>{currentDay=await restoreBackup(inspected.parts);dateInput.value=currentDay.documentDate;selected=[];modal.close();await refresh();tell('ハッシュを検証して復元しました。既存の文書は上書きしていません。');}),'primary'));
  busy=true;
}));
async function persist():Promise<void> {try{const result=await navigator.storage?.persist?.();tell(result?'保存保持の許可を得ました。永久保存やバックアップの保証ではありません。':'保存保持の許可は得られませんでした。復元用ZIPの外部保存をご利用ください。');await refresh();}catch(error){fail(error);}}
window.addEventListener('storage-blocked',event=>{writable=false;controls();tell((event as CustomEvent).detail,true);});
window.addEventListener('beforeunload',event=>{if(editing || busy || pendingCapture){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{void db.release().catch(()=>{});});
async function regainLease():Promise<void> {
  try {writable=await db.acquire();controls();if(!writable)tell('別の画面が作業中です。書込みは停止しています。',true);}
  catch(error){writable=false;controls();fail(error);}
}
window.addEventListener('pageshow',event=>{if(event.persisted)void regainLease();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && currentDay)void regainLease();});
async function boot():Promise<void> {
  controls();try{
    await db.open();writable=await db.acquire();if(writable)await db.recover();
    if(writable){currentDay=await db.dayFor(dateInput.value);await refresh();tell('写真を追加して始められます。');}
    else{const days=await db.list('days');currentDay=days.find(d=>d.documentDate===dateInput.value) || days[0];if(currentDay)await refresh();tell('別の画面で作業中です。この画面の書込みは停止しています。元の画面を閉じ、20秒後に再度開いてください。',true);}
    setInterval(()=>{if(writable)void db.heartbeat().then(ok=>{if(!ok){writable=false;controls();tell('書込みを停止しました。別画面の作業や保存状態を確認してください。',true);}});},5000);
    await initializeUpdates(()=>busy || editing || Boolean(pendingCapture),offlinePill,updateNotice,value=>{busy=value;controls();});
  }catch(error){writable=false;controls();fail(error);}
}
void boot();
