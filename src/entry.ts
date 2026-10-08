import { isLineBrowser, renderHandoff } from './line/handoff.ts';

// Decide before importing the document app, its libraries, or its database.
// Query parameters never override this guard.
if (isLineBrowser(navigator.userAgent)) {
  renderHandoff(document.querySelector('#app')!, location.href, navigator.userAgent);
} else {
  try {
    await import('../vendor/jszip.js');
    await import('./app.ts');
  } catch {
    const message = document.createElement('p');
    message.className = 'notice warning';
    message.textContent = 'アプリを開けませんでした。通信を確認して、同じURLをChromeまたはSafariで開き直してください。保存済みの文書は削除していません。';
    document.querySelector('#app')!.replaceChildren(message);
  }
}
