export async function initializeUpdates(isBusy:()=>boolean,pill:HTMLElement,notice:HTMLElement,setApplying:(value:boolean)=>void):Promise<void> {
  if(!('serviceWorker' in navigator)){pill.textContent='オフライン非対応';return;}
  try {
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    const ask=(worker:ServiceWorker,type:string):Promise<any>=>new Promise((resolve,reject)=>{
      const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('更新状態を取得できません。')),8000);
      channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data);channel.port1.close();};worker.postMessage({type},[channel.port2]);
    });
    const ready=async()=>{
      if(!registration.active){pill.textContent='オフライン準備中';return;}
      const state=await ask(registration.active,'READY');pill.textContent=state.ready?'オフライン資源準備済み':'オフライン未準備';
    };
    const show=()=>{
      if(!registration.waiting)return;
      notice.replaceChildren();notice.classList.remove('hidden');const text=document.createElement('p');text.textContent='新しい版があります。編集やPDF作成を終え、他の画面を閉じてから適用できます。';
      const button=document.createElement('button');button.textContent='保存済みの状態で更新';
      button.onclick=async()=>{
        if(isBusy()){text.textContent='作業中は更新できません。保存や処理を終えてからお試しください。';return;}
        button.disabled=true;setApplying(true);
        let approved=false,changed=false,reloaded=false;
        const worker=registration.waiting;
        const reload=()=>{changed=true;if(approved && !reloaded){reloaded=true;location.reload();}};
        navigator.serviceWorker.addEventListener('controllerchange',reload);
        try{if(!worker)throw new Error('更新待機版がありません。');const result=await ask(worker,'APPLY');if(result.applied){approved=true;if(changed || worker.state==='activated')reload();}else{navigator.serviceWorker.removeEventListener('controllerchange',reload);setApplying(false);text.textContent=result.reason;button.disabled=false;}}
        catch{navigator.serviceWorker.removeEventListener('controllerchange',reload);setApplying(false);text.textContent='更新できませんでした。現在の版と保存データは保持しています。';button.disabled=false;}
      };notice.append(text,button);
    };
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){show();void ready().catch(()=>{});}});});
    navigator.serviceWorker.addEventListener('controllerchange',()=>void ready().catch(()=>{}));
    show();await ready();
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void registration.update().catch(()=>{});});
  }catch{pill.textContent='オフライン未準備';}
}
