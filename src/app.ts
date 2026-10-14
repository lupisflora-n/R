import { localDate, safeError, sizeText, validateCorners, pdfName } from './core.ts';
import { defaultRecipe, id, now } from './model.ts';
import type { Day, IngestIntent, Page, PdfExport, Recipe, Revision } from './model.ts';
import * as db from './storage/db.ts';
import { movePageToTrash, restorePage, permanentlyDeletePage, planPageAction } from './storage/deletion.ts';
import { decode, processImage, validateImage } from './processing/image.ts';
import { createPdf, download, handOff, logShare, preparedFile } from './exports/pdf.ts';
import { openPdf } from './exports/viewer.ts';
import { exportDay, inspectBackup, restoreBackup } from './backup/backup.ts';
import { initializeUpdates } from './update/client.ts';
import { dragCorner, fitEditorImage } from './editor/interaction.ts';
import { editorRecipe, finishRecipe, whiteBlackBalance } from './editor/finish.ts';

function el<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K] {
  const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;
}
function button(text:string,action:()=>void,className=''):HTMLButtonElement {
  const b=el('button',text,className);b.type='button';b.addEventListener('click',action);return b;
}
function captureIcon(kind:'camera'|'photo'):HTMLElement {
  const icon=el('span','',`capture-icon capture-icon-${kind}`);icon.setAttribute('aria-hidden','true');return icon;
}
function field(label:string,input:HTMLElement):HTMLElement {
  const wrap=el('div','','field');const l=el('label',label);if(input.id)l.htmlFor=input.id;wrap.append(l,input);return wrap;
}
const app=document.querySelector('#app')!;
const header=el('header','','app-header'),brand=el('div','','brand');
brand.append(el('strong','docPDF'));
const offlinePill=el('span','準備中','pill');header.append(brand,offlinePill);
const main=el('main','','wrap app-main');
const updateNotice=el('div','','notice hidden');main.append(updateNotice);
const documentsScreen=el('section','','screen documents-screen');documentsScreen.id='documents-screen';
const pdfsScreen=el('section','','screen hidden');pdfsScreen.id='pdfs-screen';
const dataScreen=el('section','','screen hidden');dataScreen.id='data-screen';
const assembleScreen=el('section','','screen hidden');assembleScreen.id='assemble-screen';

const dateInput=el('input');dateInput.type='date';dateInput.id='document-date';dateInput.value=localDate();
const dateLabel=el('label','文書の日付');dateLabel.htmlFor=dateInput.id;
const recent=el('select');recent.id='recent-days';recent.setAttribute('aria-label','保存済みの日付');
const todayButton=button('今日',()=>{if(busy || editing || pendingCapture)return;dateInput.value=localDate();void changeDate();},'quiet');
const dateControls=el('div','','date-controls');dateControls.append(dateLabel,dateInput,todayButton,field('保存済みの日付',recent));
const parkedDateControls=el('div','','hidden');parkedDateControls.append(dateControls);
const dateButton=button('',()=>{
  if(busy || editing || pendingCapture)return;
  const modal=dialog('日付',()=>parkedDateControls.append(dateControls));
  modal.body.append(dateControls);modal.footer.append(button('完了',()=>{parkedDateControls.append(dateControls);modal.close();},'primary'));
},'date-button');dateButton.setAttribute('aria-label','日付を選ぶ');
const allButton=button('全選択',()=>{selected=currentPages.filter(p=>p.state==='READY').map(p=>p.id);renderSelection();renderPages();},'quiet');
const datebar=el('div','','datebar');datebar.append(dateButton,allButton);
const pageCount=el('span','00','document-count'),daySummary=el('span','','rowmeta');
const libraryTitle=el('div','','library-title'),libraryHeading=el('div');libraryHeading.append(el('h1','書類'),daySummary);libraryTitle.append(pageCount,libraryHeading);
const pagesArea=el('div','','page-grid');documentsScreen.append(datebar,libraryTitle,pagesArea);

const dock=el('div','','app-dock'),captureActions=el('div','','capture');
const camera=el('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.className='hidden';camera.id='camera-input';
const gallery=el('input');gallery.type='file';gallery.accept='image/jpeg,image/png,image/heic,image/heif';gallery.className='hidden';gallery.id='gallery-input';
const cameraButton=button('撮影',()=>choose(camera),'capture-camera primary'),galleryButton=button('写真を選ぶ',()=>choose(gallery),'capture-gallery');
cameraButton.setAttribute('aria-label','撮影');galleryButton.setAttribute('aria-label','写真を選ぶ');
captureActions.append(cameraButton,galleryButton);
const retryCaptureButton=button('保存を再試行',()=>{if(pendingCapture)void ingest(pendingCapture.file,pendingCapture.target);},'hidden');
const discardCaptureButton=button('写真を破棄',()=>{if(busy || !pendingCapture)return;if(confirm('この写真はまだ保存されていません。破棄しますか？')){pendingCapture=undefined;void prepareIntent();controls();tell('未保存の写真を破棄しました。');}},'hidden danger');
const pendingActions=el('div','','pending-actions');pendingActions.append(retryCaptureButton,discardCaptureButton);
const selectionBar=el('div','','selection-bar hidden'),selectionCount=el('span','','selection-count');selectionCount.setAttribute('aria-live','polite');
const clearButton=button('解除',()=>{selected=[];renderSelection();renderPages();},'quiet');
const preparePdfButton=button('PDF作成',()=>setScreen('assemble'),'primary');
selectionBar.append(selectionCount,clearButton,preparePdfButton);
const selectionWarning=el('p','','selection-warning hidden');selectionWarning.setAttribute('role','status');documentsScreen.append(selectionWarning);
const nav=el('nav','','app-nav');nav.setAttribute('aria-label','画面切替');
type Screen='documents'|'pdfs'|'data'|'assemble';
let screen:Screen='documents';
const navButtons=new Map<Screen,HTMLButtonElement>();
for(const [key,label] of [['documents','書類'],['pdfs','PDF'],['data','データ']] as const){
  const b=button(label,()=>{if(!busy && !editing && !pendingCapture)setScreen(key);});b.setAttribute('aria-controls',key+'-screen');navButtons.set(key,b);nav.append(b);
}
dock.append(selectionBar,pendingActions,captureActions,nav,camera,gallery);
function setScreen(value:Screen):void{
  screen=value;
  for(const [key,node] of [['documents',documentsScreen],['pdfs',pdfsScreen],['data',dataScreen],['assemble',assembleScreen]] as const)node.classList.toggle('hidden',value!==key);
  captureActions.classList.toggle('hidden',value!=='documents');selectionBar.classList.toggle('hidden',value!=='documents' || !selected.length);
  nav.classList.toggle('hidden',value==='assemble');
  navButtons.forEach((b,key)=>{b.classList.toggle('selected',key===value);if(key===value)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.body.dataset.screen=value;window.scrollTo(0,0);
}

const pdfsHead=el('div','','screen-title');pdfsHead.append(el('h1','PDF'));
const pdfDateButton=button('日付',()=>dateButton.click(),'quiet');pdfsHead.append(pdfDateButton);
const pdfsArea=el('div','','pdf-history');pdfsScreen.append(pdfsHead,pdfsArea);
const assembleHead=el('div','','screen-title'),assembleBack=button('戻る',()=>setScreen('documents'),'back-button');assembleBack.setAttribute('aria-label','書類に戻る');assembleHead.append(assembleBack,el('h1','PDF作成'));
const selectedTotal=el('h2','','assembly-count'),limitNote=el('p','最大10枚','rowmeta');
const orderList=el('div','','orderlist'),nameInput=el('input');nameInput.id='pdf-name';nameInput.value=localDate()+'_文書';nameInput.maxLength=100;nameInput.className='wideinput';
const generateButton=button('作成',()=>void generate(),'primary'),cancelJob=button('キャンセル',()=>jobAbort?.abort(),'hidden');
const generateActions=el('div','','assembly-actions');generateActions.append(generateButton,cancelJob);
assembleScreen.append(assembleHead,selectedTotal,limitNote,orderList,field('ファイル名',nameInput),generateActions);

const dataTitle=el('h1','データ管理'),backupCard=el('section','','backup-card');
const backupDay=el('p','','backup-day');
const backupButton=button('書き出す',()=>void backup(),'primary'),restoreInput=el('input');restoreInput.type='file';restoreInput.accept='.zip,application/zip';restoreInput.multiple=true;restoreInput.id='restore-input';restoreInput.className='hidden';
const restoreButton=button('復元',()=>restoreInput.click()),backupFiles=el('div','','backups');
backupCard.append(el('h2','バックアップ'),backupDay,backupButton,restoreButton,restoreInput,backupFiles);
const storageDetail=el('p','','muted small'),persistButton=button('保存の保護をリクエスト',()=>void persist(),'primary');
const persistenceButton=button('保存設定',()=>{if(busy || editing)return;const modal=dialog('保存設定',()=>{});modal.body.append(storageDetail,el('p','ブラウザーにデータの保持をリクエストできます。バックアップは別に保存してください。','muted'),persistButton);},'');
const trashButton=button('ごみ箱',()=>void viewTrash());
const dataActions=el('div','','data-actions');dataActions.append(trashButton,persistenceButton);
const helpLink=el('a','ヘルプ','help-link');helpLink.href='./help.html';helpLink.target='_blank';helpLink.rel='noopener noreferrer';
const safetyDetails=el('details','','safety-details');
safetyDetails.append(el('summary','利用前の確認'),el('p','試験には架空の書類を使用してください。業務での利用は勤務先の取扱規則を確認してください。写真やPDFをdocPDFのLINEトークへ送らないでください。','muted'));
dataScreen.append(dataTitle,backupCard,el('p','バックアップは暗号化されません。','muted small'),dataActions,helpLink,safetyDetails,el('p','データはこの端末のブラウザーに保存されます。','storage-location small muted'));
const status=el('div','','status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
main.append(documentsScreen,pdfsScreen,dataScreen,assembleScreen,parkedDateControls,status);app.append(header,main,dock);

let currentDay:Day,currentPages:Page[]=[],selected:string[]=[],intent:IngestIntent|undefined,captureTarget:IngestIntent|undefined;
let writable=false,busy=false,editing=false,jobAbort:AbortController|undefined;
let pendingCapture:{file:File;target:IngestIntent}|undefined;
let thumbnailUrls:string[]=[],backupUrls:string[]=[];
function tell(message:string,error=false):void {status.textContent=message;status.classList.toggle('error',error);}
function fail(error:unknown):void {tell(safeError(error),true);}
function controls():void {
  for(const b of [cameraButton,galleryButton,backupButton,generateButton,restoreButton,trashButton,persistButton])b.disabled=busy || editing || !writable || !currentDay;
  if(!intent || pendingCapture){cameraButton.disabled=true;galleryButton.disabled=true;}
  for(const b of [allButton,clearButton,preparePdfButton,assembleBack,dateButton,pdfDateButton,persistenceButton,...navButtons.values()])b.disabled=busy || editing || Boolean(pendingCapture) || !currentDay;
  preparePdfButton.disabled=preparePdfButton.disabled || !writable || !selected.length || selected.length>10;
  generateButton.disabled=generateButton.disabled || !selected.length || selected.length>10;nameInput.disabled=busy || editing;for(const b of orderList.querySelectorAll<HTMLButtonElement>('button'))b.disabled=busy || editing || b.dataset.uiDisabled==='true';
  dateInput.disabled=busy || editing || Boolean(pendingCapture);recent.disabled=busy || editing || Boolean(pendingCapture);todayButton.disabled=busy || editing || Boolean(pendingCapture);
  retryCaptureButton.disabled=busy || editing;retryCaptureButton.classList.toggle('hidden',!pendingCapture);
  discardCaptureButton.disabled=busy || editing;discardCaptureButton.classList.toggle('hidden',!pendingCapture);
  for(const check of pagesArea.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))check.disabled=busy || editing || !writable || check.dataset.ready!=='true';
  for(const editButton of pagesArea.querySelectorAll<HTMLButtonElement>('button'))editButton.disabled=busy || editing || !writable;
  for(const action of document.querySelectorAll<HTMLButtonElement>('.trash-actions button,.pdf-rename-fields button'))action.disabled=busy || !writable || action.dataset.uiDisabled==='true';
  for(const node of document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('.editor-controls button,.editor-controls input,.editor-controls select,.editor-top-actions button,#page-title'))node.disabled=busy || node.dataset.uiDisabled==='true';
  for(const cancel of document.querySelectorAll<HTMLButtonElement>('.editor-cancel-processing')){cancel.classList.toggle('hidden',!busy);cancel.disabled=!busy;}
}
async function run(action:()=>Promise<void>):Promise<void> {
  if(busy){tell('処理中です。完了をお待ちください。');return;}
  busy=true;controls();try{await action();}catch(error){fail(error);}finally{busy=false;controls();}
}
function dialog(title:string,onClose:()=>void):{overlay:HTMLElement;body:HTMLElement;footer:HTMLElement;close:()=>void} {
  const prior=document.activeElement as HTMLElement,overlay=el('div','','overlay'),panel=el('div','','dialog');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);
  const top=el('div','','dialoghead'),closeButton=button('閉じる',()=>{if(!busy){close();onClose();}}),body=el('div','','dialogbody'),footer=el('div','','dialogfooter');
  top.append(el('h2',title),closeButton);panel.append(top,body,footer);overlay.append(panel);document.body.append(overlay);document.body.classList.add('dialog-open');closeButton.focus();
  const keydown=(event:KeyboardEvent)=>{
    if(event.key==='Escape' && !busy){close();onClose();}
    if(event.key==='Tab'){const nodes=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')).filter(node=>node.getClientRects().length>0);const first=nodes[0],last=nodes[nodes.length-1];if(!nodes.includes(document.activeElement as HTMLElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}else if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
  };
  overlay.addEventListener('keydown',keydown);
  function close(){overlay.remove();if(!document.querySelector('.overlay'))document.body.classList.remove('dialog-open');if(prior?.isConnected)prior.focus();}
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
  const dayPages=(await db.list('pages')).filter(p=>p.dayId===currentDay.id);
  currentPages=dayPages.filter(p=>!p.deletedAt).sort((a,b)=>a.orderIndex-b.orderIndex);
  trashButton.textContent='ごみ箱';trashButton.setAttribute('aria-label',`ごみ箱（${dayPages.filter(p=>p.deletedAt).length}枚）`);
  const dateText=new Date(currentDay.documentDate+'T12:00:00').toLocaleDateString('ja-JP',{month:'long',day:'numeric'});
  dateButton.textContent=dateText;daySummary.textContent=dateText;backupDay.textContent=dateText+'の写真・PDF';pdfDateButton.textContent=dateText;
  selected=selected.filter(id=>currentPages.some(p=>p.id===id && p.state==='READY'));
  const blank=el('option','日付を選ぶ');blank.value='';recent.replaceChildren(blank);
  for(const day of (await db.list('days')).sort((a,b)=>b.documentDate.localeCompare(a.documentDate))){const option=el('option',`${day.documentDate}${day.id===currentDay.id?' · 表示中':''}`);option.value=day.id;recent.append(option);}
  renderPages();renderSelection();await renderPdfs();await prepareIntent();
  const estimate=await navigator.storage?.estimate?.();const persistent=await navigator.storage?.persisted?.();
  storageDetail.textContent=`端末内の使用量: ${estimate?.usage!==undefined?sizeText(estimate.usage):'取得不可'} / 容量の目安: ${estimate?.quota!==undefined?sizeText(estimate.quota):'取得不可'}。データの保持: ${persistent?'許可済み':'未許可または確認できません'}。`;
}
function choose(input:HTMLInputElement):void {
  if(!intent || busy || !writable || pendingCapture)return;
  captureTarget=intent;intent=undefined;busy=true;controls();input.value='';input.click();
}
for(const input of [camera,gallery]) {
  input.addEventListener('cancel',()=>{busy=false;captureTarget=undefined;void prepareIntent();tell('キャンセルしました。');controls();});
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
      tell('保存中…');
      if(!file.size || file.size>50*1024*1024)throw new Error('写真は50 MB以下を選んでください。既存データは変更していません。');
      const page=await db.saveOriginal(file,target);pendingCapture=undefined;tell('下書きを保存しました。');
      await refresh();
      try{await validateImage(file);}catch(error){await db.write(['pages'],tx=>tx.objectStore('pages').put({...page,state:'DRAFT_UNSUPPORTED'}));await refresh();throw error;}
      busy=false;await edit(page);busy=true;
    });
    if(pendingCapture)tell('写真をまだ保存できていません。この画面を閉じず、空き容量や他の画面の作業を確認して「保存を再試行」を押してください。',true);
}
function renderPages():void {
  for(const url of thumbnailUrls)URL.revokeObjectURL(url);thumbnailUrls=[];pagesArea.replaceChildren();pageCount.textContent=String(currentPages.length).padStart(2,'0');
  if(!currentPages.length){pagesArea.append(el('p','書類がありません','empty'));return;}
  for(const page of currentPages) {
    const row=el('div','','page-row'),check=el('input');row.dataset.state=page.state;row.classList.toggle('is-selected',selected.includes(page.id));check.type='checkbox';check.dataset.ready=String(page.state==='READY');check.checked=selected.includes(page.id);check.disabled=page.state!=='READY' || busy || !writable;check.setAttribute('aria-label',`${page.title}をPDFに選択`);check.addEventListener('change',()=>{selected=check.checked?[...selected,page.id]:selected.filter(id=>id!==page.id);row.classList.toggle('is-selected',check.checked);renderSelection();});
    const img=el('img','','thumbnail');img.alt=page.title;
    void(async()=>{const revision=page.activeRevisionId?await db.get('revisions',page.activeRevisionId):undefined;const asset=await db.get('assets',revision?.renderedAssetId || page.originalAssetId);if(asset && img.isConnected){const url=URL.createObjectURL(asset.blob);thumbnailUrls.push(url);img.src=url;img.onerror=()=>{img.removeAttribute('src');img.alt='表示できない原本';};}})();
    const info=el('div');info.append(el('strong',page.title),el('div',page.state==='READY'?'編集済み':page.state==='DRAFT_UNSUPPORTED'?'この端末では編集できません':'下書き',page.state==='READY'?'rowmeta':'rowmeta draft'));
    info.className='page-info';
    const editButton=button('編集',()=>void edit(page));editButton.disabled=busy || !writable;editButton.setAttribute('aria-label',`${page.title}を編集`);
    const deleteButton=button('削除',()=>void trashPhoto(page),'quiet danger');deleteButton.setAttribute('aria-label',`${page.title}を削除`);
    deleteButton.classList.add('icon-trash');deleteButton.textContent='';
    const selector=el('label','','page-select');selector.append(check,el('span','','selection-mark'));
    const actions=el('div','','page-actions');actions.append(editButton,deleteButton);row.append(selector,img,info,actions);pagesArea.append(row);
  }
}
async function trashPhoto(page:Page):Promise<void>{
  if(busy || editing || !writable)return;
  if(!confirm(`「${page.title}」をごみ箱に移動しますか？\n元に戻せます。`))return;
  await run(async()=>{await movePageToTrash(page.id,true);clearPreparedBackups();await refresh();tell('ごみ箱に移動しました。');});
}
function clearPreparedBackups(){for(const url of backupUrls)URL.revokeObjectURL(url);backupUrls=[];backupFiles.replaceChildren();}
async function viewTrash():Promise<void>{
  if(busy || editing || !writable)return;
  editing=true;controls();let removed=false;
  const modal=dialog('ごみ箱',()=>{removed=true;editing=false;controls();});
  const intro=el('p','ごみ箱の写真は一覧と新しいPDFの選択対象から外れます。容量は減りません。完成PDFはそのままです。','notice');
  const rows=el('div'),message=el('p','','notice hidden');message.tabIndex=-1;message.setAttribute('role','status');message.setAttribute('aria-live','polite');modal.body.append(intro,rows,message);
  modal.body.append(el('p','完全削除は原本と編集版を戻せなくします。完成PDFで使った写真は復元に必要なため完全削除できません。写真アプリや外部へ保存したコピーは別に残ります。','muted small'));
  async function redraw(){
    const graph={pages:await db.list('pages'),revisions:await db.list('revisions'),pdfs:await db.list('pdfs'),jobs:await db.list('jobs')};
    const pages=graph.pages.filter(p=>p.dayId===currentDay.id && p.deletedAt).sort((a,b)=>b.deletedAt!.localeCompare(a.deletedAt!));
    if(removed)return;rows.replaceChildren();
    if(!pages.length)rows.append(el('p','この日付のごみ箱は空です。','empty'));
    for(const page of pages){
      const row=el('div','','trash-row'),info=el('div');info.append(el('strong',page.title));
      const actions=el('div','','trash-actions'),eraseButton=button('完全削除',()=>void act(page,true),'danger');
      try{planPageAction(graph,page.id,'erase',true,now());}
      catch(error){eraseButton.dataset.uiDisabled='true';eraseButton.disabled=true;info.append(el('p',safeError(error),'rowmeta'));}
      actions.append(button('元に戻す',()=>void act(page,false)),eraseButton);row.append(info,actions);rows.append(row);
    }
    controls();
  }
  async function act(page:Page,erase:boolean){
    if(busy || !writable || removed)return;
    if(erase && !confirm(`「${page.title}」1枚の原本と編集版を完全削除しますか？\n元に戻せません。必要な写真は外部バックアップの保存を確認してください。外部のコピーは残ります。`))return;
    await run(async()=>{
      try{if(erase)await permanentlyDeletePage(page.id,true);else await restorePage(page.id);clearPreparedBackups();await refresh();await redraw();message.textContent=erase?'原本と編集版を完全削除しました。':'写真を元に戻しました。';message.className='notice';message.focus();}
      catch(error){message.textContent=safeError(error);message.className='notice warning';throw error;}
    });
  }
  try{await redraw();}catch(error){message.textContent=safeError(error);message.classList.remove('hidden');fail(error);}
}
function renderSelection():void {
  orderList.replaceChildren();
  selectionCount.textContent=selected.length+'枚選択';selectedTotal.textContent=selected.length+'枚';
  selectionBar.classList.toggle('hidden',screen!=='documents' || !selected.length);
  selectionWarning.textContent=selected.length>10?'一度に選べるのは10枚までです。':'';selectionWarning.classList.toggle('hidden',selected.length<=10);
  selected.forEach((pageId,i)=>{
    const page=currentPages.find(p=>p.id===pageId)!;const row=el('div','','orderrow');
    const number=el('span',String(i+1).padStart(2,'0'),'order-number'),title=el('strong',page.title);
    const info=el('div','','order-info');info.append(number,title);
    const up=button('↑',()=>{[selected[i-1],selected[i]]=[selected[i],selected[i-1]];renderSelection();});up.dataset.uiDisabled=String(i===0);up.disabled=i===0 || busy;up.setAttribute('aria-label',page.title+'を前へ');
    const down=button('↓',()=>{[selected[i],selected[i+1]]=[selected[i+1],selected[i]];renderSelection();});down.dataset.uiDisabled=String(i===selected.length-1);down.disabled=i===selected.length-1 || busy;down.setAttribute('aria-label',page.title+'を後へ');
    const actions=el('div','','order-actions');actions.append(up,down);row.append(info,actions);orderList.append(row);
  });
  controls();
}

async function renderPdfs():Promise<void> {
  pdfsArea.replaceChildren();
  const records=(await db.list('pdfs')).filter(p=>p.dayId===currentDay.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(!records.length)pdfsArea.append(el('p','PDFがありません','empty'));
  for(const record of records){const row=el('div','','pdf-row');const info=el('div');info.append(el('strong',record.displayName),el('div',`${record.orderedPageIds?.length || record.orderedRevisionIds.length}ページ`,'rowmeta'));row.append(info,button('開く',()=>void viewPdf(record)));pdfsArea.append(row);}
}
async function edit(page:Page):Promise<void> {
  if(busy || editing || !writable)return;
  editing=true;controls();document.body.classList.add('editor-open');
  let abort:AbortController|undefined,removed=false,resizeObserver:ResizeObserver|undefined;
  let detachViewport=()=>{};
  const cleanup=()=>{removed=true;abort?.abort();resizeObserver?.disconnect();detachViewport();document.body.classList.remove('editor-open');editing=false;controls();};
  const modal=dialog('写真を編集',cleanup);modal.overlay.classList.add('editor-overlay','fixed-editor');
  const closeEditor=()=>{cleanup();modal.close();};
  try {
    const original=await db.get('assets',page.originalAssetId);if(!original)throw new Error('原本がありません。');
    const previous=page.activeRevisionId?await db.get('revisions',page.activeRevisionId):undefined;
    let recipe:Recipe=editorRecipe(previous?.recipe),active=0,mode='crop',cropConfirmed=false,previewRecipe:string|undefined,processed:ImageData|undefined,showOriginal=false;
    let balanceValue=whiteBlackBalance(recipe);
    const history:Recipe[]=[],cornerNames=['左上','右上','右下','左下'];
    const decoded=await decode(original.blob,1000);if(removed)return;
    const toolbar=el('div','','editor-toolbar'),tabs=new Map<string,HTMLButtonElement>();
    for(const [key,label] of [['crop','トリミング'],['tone','調整'],['name','名前を変更']]){
      const b=button(label,()=>{if(busy || (key!=='crop' && !cropConfirmed))return;mode=key;showOriginal=false;syncMode();setMessage(key==='crop'?'四隅をドラッグして調整':'');});b.setAttribute('aria-pressed','false');toolbar.append(b);tabs.set(key,b);
    }
    const workspace=el('div','','editor-image-area'),stage=el('div','','editor-stage'),canvas=el('canvas'),handles=el('div','','handles');
    stage.append(canvas,handles);workspace.append(stage);
    const viewLabel=modal.overlay.querySelector('h2')!,compare=button('元の写真',()=>{if(busy || !processed || previewRecipe!==JSON.stringify(recipe))return;showOriginal=!showOriginal;renderView();},'editor-compare');viewLabel.classList.add('editor-view-title');
    const nameButton=button('名前を変更',()=>{if(busy || !cropConfirmed)return;mode='name';syncMode();title.focus();},'editor-name');
    const topActions=el('div','','editor-top-actions hidden');topActions.append(compare,nameButton);
    const tools=el('div','','editor-tool-panels'),cropPane=el('div','','fixed-crop-tools'),tonePane=el('div','','fixed-tone-tools hidden'),namePane=el('div','','fixed-name-tools hidden');
    tools.append(cropPane,tonePane,namePane);
    const message=el('p','四隅をドラッグして調整','editor-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    modal.body.classList.add('editor-controls');toolbar.classList.add('hidden');modal.body.replaceChildren(message,topActions,workspace,tools,toolbar);
    const pointButtons=el('div','','cornerbuttons'),handleButtons:HTMLButtonElement[]=[],cornerButtons:HTMLButtonElement[]=[];
    type Drag={index:number;pointerId:number;point:{x:number;y:number};start:{x:number;y:number};frame:{width:number;height:number}};
    let drag:Drag|undefined;
    function checkpoint(){history.push(structuredClone(recipe));if(history.length>50)history.shift();}
    function setMessage(value:string,error=false){message.textContent=value;message.classList.toggle('warning',error);message.title=value;}
    function hasPreview(){return Boolean(processed && previewRecipe===JSON.stringify(recipe));}
    function invalidatePreview(){previewRecipe=undefined;showOriginal=false;if(mode==='crop')cropConfirmed=false;setMessage(mode==='crop'?'四隅をドラッグして調整':'');renderView();syncActions();}
    function fitStage(){
      if(removed)return;
      const pixels=mode==='crop' || showOriginal || !processed?decoded.pixels:processed;
      const fitted=fitEditorImage(pixels,{width:workspace.clientWidth,height:workspace.clientHeight});
      stage.style.width=`${fitted.width}px`;stage.style.height=`${fitted.height}px`;
    }
    function renderView(){
      const pixels=mode==='crop' || showOriginal || !processed?decoded.pixels:processed;
      canvas.width=pixels.width;canvas.height=pixels.height;const context=canvas.getContext('2d')!;context.putImageData(pixels,0,0);
      if(mode==='crop'){
        context.beginPath();context.rect(0,0,canvas.width,canvas.height);
        recipe.points.forEach((point,i)=>{if(i)context.lineTo(point.x*canvas.width,point.y*canvas.height);else context.moveTo(point.x*canvas.width,point.y*canvas.height);});context.closePath();
        context.fillStyle='rgba(9,22,18,.4)';context.fill('evenodd');context.strokeStyle='#fff';context.lineWidth=canvas.width/180;context.stroke();context.strokeStyle='#a5f2c8';context.lineWidth=canvas.width/450;context.stroke();
      }
      handles.classList.toggle('hidden',mode!=='crop');
      handleButtons.forEach((b,i)=>{b.style.left=`${recipe.points[i].x*100}%`;b.style.top=`${recipe.points[i].y*100}%`;b.classList.toggle('active',active===i);b.setAttribute('aria-pressed',String(active===i));cornerButtons[i].classList.toggle('selected',active===i);cornerButtons[i].setAttribute('aria-pressed',String(active===i));});
      viewLabel.textContent=mode==='crop'?'トリミング':mode==='name'?'名前を変更':'調整';
      modal.overlay.dataset.previewReady=String(hasPreview());
      canvas.setAttribute('aria-label',mode==='crop'?'四隅を調整する写真':showOriginal?'元の写真':'調整後の写真');compare.classList.toggle('hidden',mode==='crop' || !hasPreview());compare.textContent=showOriginal?'編集後':'元の写真';compare.setAttribute('aria-label',showOriginal?'編集後の写真を表示':'元の写真を表示');compare.setAttribute('aria-pressed',String(showOriginal));fitStage();
    }
    function movePointer(event:PointerEvent){
      if(!drag || drag.pointerId!==event.pointerId || busy)return;
      recipe.points[drag.index]=dragCorner(drag.point,drag.start,{x:event.clientX,y:event.clientY},drag.frame);invalidatePreview();
    }
    for(let i=0;i<4;i++){
      const b=button('',()=>{active=i;renderView();},'handle');const badge=el('span',String(i+1),'corner-badge');badge.setAttribute('aria-hidden','true');b.append(badge);b.setAttribute('aria-label',`${i+1} ${cornerNames[i]}の四隅`);b.dataset.corner=String(i);handles.append(b);handleButtons.push(b);
      b.addEventListener('pointerdown',event=>{if(busy || drag)return;event.preventDefault();checkpoint();active=i;const rect=canvas.getBoundingClientRect();drag={index:i,pointerId:event.pointerId,point:{...recipe.points[i]},start:{x:event.clientX,y:event.clientY},frame:{width:rect.width,height:rect.height}};b.setPointerCapture(event.pointerId);renderView();});
      b.addEventListener('pointermove',movePointer);
      b.addEventListener('pointerup',event=>{if(!drag || drag.pointerId!==event.pointerId)return;movePointer(event);drag=undefined;if(b.hasPointerCapture(event.pointerId))b.releasePointerCapture(event.pointerId);});
      for(const name of ['pointercancel','lostpointercapture'])b.addEventListener(name,()=>{drag=undefined;});
      b.addEventListener('keydown',event=>{const delta:{[key:string]:[number,number]}={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(delta[event.key] && !busy){event.preventDefault();active=i;nudge(...delta[event.key]);}});
      const selector=button(cornerNames[i],()=>{active=i;renderView();});pointButtons.append(selector);cornerButtons.push(selector);
    }
    cropPane.append(pointButtons);
    function nudge(dx:number,dy:number){if(busy)return;checkpoint();const rect=canvas.getBoundingClientRect();recipe.points[active]=dragCorner(recipe.points[active],{x:0,y:0},{x:dx*2,y:dy*2},rect);invalidatePreview();}
    const adjustments=el('div','','fixed-corner-adjustments');
    for(const [label,dx,dy,direction] of [['←',-1,0,'左'],['↑',0,-1,'上'],['↓',0,1,'下'],['→',1,0,'右']] as const){const b=button(label,()=>nudge(dx,dy));b.setAttribute('aria-label',`選択中の四隅を${direction}へ少し動かす`);adjustments.append(b);}
    adjustments.append(button('戻す',()=>{if(busy || !history.length)return;recipe=history.pop()!;if(recipe.filter!=='color')balanceValue=whiteBlackBalance(recipe);invalidatePreview();syncParams();},'quiet'),button('全体',()=>{if(busy)return;checkpoint();recipe.points=defaultRecipe().points;invalidatePreview();},'quiet'));cropPane.append(adjustments);
    const filter=el('select');filter.id='editor-filter';
    for(const [value,label] of [['readable','白黒'],['color','カラー']]){const option=el('option',label);option.value=value;filter.append(option);}
    const rotation=button('回転',()=>{if(busy)return;checkpoint();recipe.rotation=((recipe.rotation+90)%360) as Recipe['rotation'];invalidatePreview();void documentify();});
    rotation.setAttribute('aria-label','右に90度回転');
    filter.classList.add('hidden');
    const toneChoice=el('div','','finish-choice'),filterButtons=new Map<string,HTMLButtonElement>();
    for(const [value,label] of [['readable','白黒'],['color','カラー']]){const b=button(label,()=>{if(busy)return;filter.value=value;filter.dispatchEvent(new Event('change'));});b.setAttribute('aria-pressed','false');filterButtons.set(value,b);toneChoice.append(b);}
    tonePane.append(toneChoice,filter);
    const balance=el('input');balance.id='editor-balance';balance.type='range';balance.min='-100';balance.max='100';balance.step='1';
    const balanceControls=el('div','','finish-balance'),balanceField=field('バランス',balance),balanceLabel=balanceField.querySelector('label')!;
    balanceControls.append(balanceField);
    const balanceRow=el('div','','balance-row');balanceRow.append(balanceControls,rotation);tonePane.append(balanceRow);
    balance.addEventListener('input',()=>{if(busy)return;checkpoint();balanceValue=Number(balance.value);recipe=finishRecipe(recipe,'readable',balanceValue);balanceLabel.textContent='バランス';balance.setAttribute('aria-valuetext',String(balanceValue));invalidatePreview();});
    balance.addEventListener('change',()=>{if(!busy)void documentify();});
    const title=el('input');title.value=page.title;title.id='page-title';title.maxLength=100;namePane.append(field('名前',title));
    function syncParams(){filter.value=recipe.filter;balance.value=String(balanceValue);balanceLabel.textContent='バランス';balance.setAttribute('aria-valuetext',String(balanceValue));balanceControls.classList.toggle('hidden',recipe.filter==='color');filterButtons.forEach((b,value)=>{b.classList.toggle('selected',recipe.filter===value);b.setAttribute('aria-pressed',String(recipe.filter===value));});}
    filter.addEventListener('change',()=>{if(busy)return;checkpoint();recipe=finishRecipe(recipe,filter.value as 'readable'|'color',balanceValue);invalidatePreview();syncParams();void documentify();});
    async function documentify(){
      await run(async()=>{
        try{
          validateCorners(recipe.points);setMessage('調整中…');const snapshot=structuredClone(recipe);abort=new AbortController();
          const result=await processImage(original.blob,snapshot,abort.signal,true),preview=await decode(result.blob);
          if(removed || abort.signal.aborted)throw new DOMException('取消しました','AbortError');
          processed=preview.pixels;previewRecipe=JSON.stringify(snapshot);showOriginal=false;if(mode==='crop'){cropConfirmed=true;mode='tone';}syncMode();
          setMessage('');
        }catch(error){if(!removed)setMessage(safeError(error),true);throw error;}
      });
    }
    const confirmCorners=button('次へ',()=>void documentify(),'corner-confirm');
    const back=button('トリミング',()=>{if(busy)return;mode=mode==='name'?'tone':'crop';showOriginal=false;setMessage(mode==='crop'?'四隅をドラッグして調整':'');syncMode();});
    const documentButton=button('適用',()=>void documentify(),'primary');
    const save=button('保存',()=>{
      if(!cropConfirmed || mode==='crop' || !hasPreview()){setMessage('トリミングと調整を確認してください。');return;}
      void run(async()=>{
        try{
          validateCorners(recipe.points);setMessage('保存中…');const fence=db.currentToken(),snapshot=structuredClone(recipe),titleSnapshot=title.value.trim();abort=new AbortController();
          const result=await processImage(original.blob,snapshot,abort.signal),asset=await db.makeAsset(result.blob,'rendered',result.width,result.height);
          if(abort.signal.aborted || removed)throw new DOMException('取消しました','AbortError');
          const revision:Revision={id:id(),pageId:page.id,originalHash:original.sha256,recipe:snapshot,filterVersion:1,renderedAssetId:asset.id,createdAt:now()};
          await db.saveRevision(page,revision,asset,fence,titleSnapshot,abort.signal);closeEditor();tell('保存しました。');await refresh();
        }catch(error){if(!removed)setMessage(safeError(error),true);throw error;}
      });
    },'editor-save');save.setAttribute('aria-label','編集を保存');
    const footer=el('div','','fixed-editor-actions editor-controls'),cancelProcessing=button('キャンセル',()=>abort?.abort(),'editor-cancel-processing hidden');footer.append(confirmCorners,back,documentButton,save,cancelProcessing);modal.footer.append(footer);
    function syncActions(){save.dataset.uiDisabled=String(!cropConfirmed || mode==='crop' || !hasPreview());tabs.forEach((b,key)=>b.dataset.uiDisabled=String(key!=='crop' && !cropConfirmed));documentButton.classList.toggle('hidden',mode==='crop' || hasPreview());controls();}
    function syncMode(){
      modal.overlay.dataset.editorMode=mode;topActions.classList.toggle('hidden',mode==='crop');back.textContent=mode==='name'?'戻る':'トリミング';
      tabs.forEach((b,key)=>{b.classList.toggle('selected',key===mode);b.setAttribute('aria-pressed',String(key===mode));});
      for(const [key,pane] of [['crop',cropPane],['tone',tonePane],['name',namePane]] as const)pane.classList.toggle('hidden',mode!==key);
      confirmCorners.classList.toggle('hidden',mode!=='crop');back.classList.toggle('hidden',mode==='crop');save.classList.toggle('hidden',mode==='crop');renderView();syncParams();syncActions();
    }
    const viewport=window.visualViewport;
    const resize=()=>{if(viewport){modal.overlay.style.height=`${viewport.height}px`;modal.overlay.style.top=`${viewport.offsetTop}px`;}fitStage();};
    viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);detachViewport=()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);};
    resizeObserver=new ResizeObserver(()=>fitStage());resizeObserver.observe(workspace);syncMode();resize();
  }catch(error){fail(error);modal.body.append(el('p',safeError(error),'notice warning'));}
}
async function generate():Promise<void> {
  await run(async()=>{
    jobAbort=new AbortController();cancelJob.classList.remove('hidden');
    try {tell('PDFを作成しています…');const pages=selected.map(id=>currentPages.find(p=>p.id===id)!);const record=await createPdf(currentDay.id,pages,nameInput.value,n=>tell(`PDFを作成・検査しています… ${n}%`),jobAbort.signal);tell('PDFを作成しました。');await renderPdfs();setScreen('pdfs');busy=false;await viewPdf(record);busy=true;}
    finally{jobAbort=undefined;cancelJob.classList.add('hidden');}
  });
}
async function viewPdf(record:PdfExport):Promise<void> {
  if(busy || editing)return;
  editing=true;controls();let viewer:Awaited<ReturnType<typeof openPdf>>|undefined;let closed=false;
  const modal=dialog('PDF',()=>{closed=true;void viewer?.close();editing=false;controls();});modal.overlay.classList.add('pdf-overlay');
  try {
    const file=await preparedFile(record);if(closed)return;
    const rename=el('input');rename.id='export-name';rename.value=record.displayName;rename.maxLength=104;
    const fileTitle=el('strong',record.displayName,'pdf-filename'),fileSummary=el('p',`${record.orderedPageIds?.length || record.orderedRevisionIds.length}ページ · ${sizeText(file.size)}`,'rowmeta');
    const fileInfo=el('div','','pdf-file-info');fileInfo.append(fileTitle,fileSummary);
    const renameFields=el('div','','pdf-rename-fields hidden');
    const renameButton=button('名前を変更',()=>{if(busy)return;renameFields.classList.toggle('hidden');if(!renameFields.classList.contains('hidden'))rename.focus();},'quiet');
    const pdfTop=el('div','','pdf-top');pdfTop.append(fileInfo,renameButton);
    let shareFile=file;
    rename.addEventListener('input',()=>{shareFile=new File([file],pdfName(rename.value),{type:'application/pdf'});});
    const saveName=button('保存',()=>void run(async()=>{record={...record,displayName:pdfName(rename.value)};await db.write(['pdfs'],tx=>tx.objectStore('pdfs').put(record));fileTitle.textContent=record.displayName;renameFields.classList.add('hidden');await renderPdfs();tell('名前を変更しました。');}),'primary');saveName.setAttribute('aria-label','PDFの名前を保存');
    renameFields.append(field('ファイル名',rename),saveName);
    modal.body.append(pdfTop,renameFields);
    if(file.size>10*1024*1024)modal.body.append(el('p','10 MBを超えています。メールの上限に合わせて枚数を分けてください。','notice warning'));
    const canvas=el('canvas','','pdfcanvas'),viewerStage=el('div','','pdf-viewer'),pager=el('div','','pdf-pager'),countLabel=el('span');canvas.setAttribute('aria-label','PDFのプレビュー');viewerStage.append(canvas);modal.body.append(viewerStage,pager);
    viewer=await openPdf(file);if(closed){void viewer.close();return;}let index=1,rendering=false;
    const paint=async()=>{if(rendering || !viewer)return;rendering=true;prev.disabled=true;next.disabled=true;try{await viewer.render(canvas,index);countLabel.textContent=`${index} / ${viewer.count}`;}finally{rendering=false;prev.disabled=index<=1;next.disabled=index>=viewer.count;}};
    const prev=button('←',()=>{index--;void paint().catch(fail);}),next=button('→',()=>{index++;void paint().catch(fail);});prev.setAttribute('aria-label','前のページ');next.setAttribute('aria-label','次のページ');pager.append(prev,countLabel,next);await paint();
    const shareStatus=el('p','','share-status');shareStatus.setAttribute('role','status');shareStatus.setAttribute('aria-live','polite');
    const shareButton=button('共有',()=>{
      const promise=handOff(shareFile);shareStatus.textContent='共有先を選んでください。';
      void logShare(record.id,'requested').catch(()=>{});
      promise.then(()=>{shareStatus.textContent='共有先に渡しました。';tell('共有先に渡しました。');void logShare(record.id,'handed-off').catch(()=>{});}).catch(error=>{if(error?.name==='AbortError'){shareStatus.textContent='共有をキャンセルしました。';tell('共有をキャンセルしました。');void logShare(record.id,'canceled').catch(()=>{});}else{shareStatus.textContent=`${safeError(error)} PDFを保存して、メールに添付してください。`;fail(error);void logShare(record.id,'failed').catch(()=>{});}});
    },'primary');
    const shareActions=el('div','','pdf-share-actions');shareActions.append(shareButton,button('保存',()=>{download(shareFile,shareFile.name);tell('保存先を確認してください。');void logShare(record.id,'requested','download').catch(()=>{});}));modal.footer.append(shareStatus,shareActions);
  }catch(error){fail(error);modal.body.append(el('p',safeError(error),'notice warning'));}
}

async function backup():Promise<void> {
  await run(async()=>{
    const files=await exportDay(currentDay,message=>tell(message));backupFiles.replaceChildren();for(const url of backupUrls)URL.revokeObjectURL(url);backupUrls=[];
    for(const file of files){const a=el('a',`${file.name} を保存（${sizeText(file.blob.size)}）`);a.href=URL.createObjectURL(file.blob);a.download=file.name;backupUrls.push(a.href);backupFiles.append(a);}
    tell(`${files.length}部のバックアップを作成しました。すべてのファイルを保存してください。`);
  });
}
restoreInput.addEventListener('change',()=>void run(async()=>{
  const files=Array.from(restoreInput.files || []);restoreInput.value='';tell('バックアップを確認中…');const inspected=await inspectBackup(files);
  const trashCount=inspected.parts.reduce((sum,part)=>sum+part.manifest.pages.filter(p=>p.deletedAt).length,0);
  busy=false;const modal=dialog('復元内容を確認',()=>{});modal.body.append(el('p',`${inspected.date} · 写真 ${inspected.pageCount}枚（ごみ箱 ${trashCount}枚を含む） · PDF ${inspected.pdfCount}件`),el('p','既存の文書は上書きせず、別の保存グループとして追加します。同じバックアップの再取込は重複を作りません。','notice'));
  modal.footer.append(button('復元',()=>void run(async()=>{currentDay=await restoreBackup(inspected.parts);dateInput.value=currentDay.documentDate;selected=[];modal.close();await refresh();tell('復元しました。');}),'primary'));
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
    if(writable){currentDay=await db.dayFor(dateInput.value);await refresh();tell('');}
    else{const days=await db.list('days');currentDay=days.find(d=>d.documentDate===dateInput.value) || days[0];if(currentDay)await refresh();tell('別の画面で作業中です。この画面の書込みは停止しています。元の画面を閉じ、20秒後に再度開いてください。',true);}
    setInterval(()=>{if(writable)void db.heartbeat().then(ok=>{if(!ok){writable=false;controls();tell('書込みを停止しました。別画面の作業や保存状態を確認してください。',true);}});},5000);
    await initializeUpdates(()=>busy || editing || Boolean(pendingCapture),offlinePill,updateNotice,value=>{busy=value;controls();});
  }catch(error){writable=false;controls();fail(error);}
}
setScreen('documents');
void boot();
