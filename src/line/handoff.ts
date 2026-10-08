export function isLineBrowser(userAgent: string): boolean {
  return /\bLine\//i.test(userAgent);
}

export function browserLabel(userAgent: string): string {
  if (/android/i.test(userAgent)) return 'Chromeなどのブラウザー';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'Safariなどのブラウザー';
  return 'いつものブラウザー';
}

export function appUrl(currentUrl: string): string {
  const current = new URL(currentUrl);
  if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password) {
    throw new Error('通常のウェブURLから開いてください。');
  }
  // Root-hosted, separate docPDF origin. Do not carry identity, document names,
  // return URLs, or any other supplied query or fragment into the launch URL.
  return new URL('/', current.origin).href;
}

export function externalAppUrl(currentUrl: string): string {
  const target = new URL(appUrl(currentUrl));
  target.searchParams.set('openExternalBrowser', '1');
  return target.href;
}

function node(tag: string, text: string, className = ''): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function renderHandoff(root: Element, currentUrl: string, userAgent: string): void {
  const insideLine = isLineBrowser(userAgent);
  const target = appUrl(currentUrl);
  const header = node('header', '');
  const brand = node('div', '', 'brand');
  const icon = document.createElement('img');
  icon.src = '/icon.svg'; icon.alt = '';
  brand.append(icon, node('strong', 'docPDF'));
  header.append(brand, node('span', '検証版', 'pill'));
  const main = node('main', '', 'wrap launch');
  main.append(node('div', '紙からPDFへ', 'eyebrow'),
    node('h1', insideLine ? '撮影は、ブラウザーで。' : '書類を整えて、PDFに。'),
    node('p', insideLine
      ? `LINEから来た方はこちら。${browserLabel(userAgent)}で開いてから、紙を撮影します。`
      : '紙を撮影し、四隅と読みやすさを確認。必要な枚数をひとつのPDFにできます。', 'subtitle'));
  const card = node('section', '', 'card launch-card');
  const steps = node('ol', '', 'launch-steps');
  for (const [heading, detail] of [
    ['撮影する', '受け取った写真を、端末内に下書き保存。'],
    ['読みやすく整える', '四隅を合わせ、原本と白黒・カラーを比較。'],
    ['PDFを確認して渡す', '端末に保存、または自分で選んだ共有先へ。']
  ]) {
    const item = node('li', '');
    item.append(node('strong', heading), node('p', detail, 'muted'));
    steps.append(item);
  }
  const launch = document.createElement('a');
  launch.className = 'launch-button';
  launch.textContent = insideLine ? 'ブラウザーでdocPDFを開く' : 'docPDFを開く';
  launch.href = insideLine ? externalAppUrl(currentUrl) : target;
  launch.rel = 'noreferrer';
  card.append(steps, launch);
  if (insideLine) {
    card.append(node('p', '切り替わらない場合は、URLをコピーしてChrome／Safariのアドレス欄へ貼り付けてください。この画面では書類を取り込みません。', 'muted small'));
  }
  const urlLabel = node('label', '開くURL', 'url-label');
  urlLabel.setAttribute('for', 'launch-url');
  const urlField = document.createElement('input');
  urlField.id = 'launch-url'; urlField.type = 'text'; urlField.value = target;
  urlField.readOnly = true; urlField.className = 'launch-url';
  const copy = document.createElement('button');
  copy.type = 'button'; copy.textContent = 'URLをコピー';
  const status = node('p', '', 'muted small');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  copy.onclick = () => {
    if (!navigator.clipboard?.writeText) {
      urlField.focus(); urlField.select();
      status.textContent = 'URLを選択しました。長押ししてコピーしてください。'; return;
    }
    void navigator.clipboard.writeText(target).then(() => {
      status.textContent = 'URLをコピーしました。ブラウザーのアドレス欄へ貼り付けてください。';
    }).catch(() => {
      urlField.focus(); urlField.select();
      status.textContent = 'URL欄を長押ししてコピーしてください。';
    });
  };
  card.append(urlLabel, urlField, copy, status);
  main.append(card, node('p', '試験中は架空の書類を使ってください。実務での利用は勤務先の確認後に。写真やPDFを、この公式アカウントのトークへ送らないでください。', 'notice warning'));
  const privacy = node('section', '', 'card');
  privacy.append(node('h2', '書類の扱いについて'),
    node('p', '画像の加工とPDF作成は端末内で行います。アプリから書類を処理サーバーやLINEトークへ自動送信する機能はありません。保存・共有を選ぶと、その保存先や共有先で扱われます。', 'muted'),
    node('p', '端末の紛失・写真の自動バックアップ・宛先の間違いには注意が必要です。ブラウザー内保存は永久保存やバックアップを保証しません。', 'muted'));
  const help = document.createElement('a'); help.href = '/help.html';
  help.textContent = '使い方・保存と安全の説明'; help.className = 'text-link';
  privacy.append(help); main.append(privacy);
  main.append(node('footer', 'docPDF · LINE入口の検証版'));
  root.replaceChildren(header, main);
}
