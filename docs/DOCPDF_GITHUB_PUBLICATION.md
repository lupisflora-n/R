# docPDF｜GitHubから既存LINEサイトを更新

2026-10-09。本人「githubで公開してそれとLINEを繋げて」で自動更新を依頼。

## できあがる運用

Codexが `lupisflora-n/R` の `codex/docpdf-line` へアプリの変更を保存 → GitHub Actionsで検査 → 既存Cloudflare Pages `docpdf-line-test` へ静的アプリだけを配信 → 固定URLのbuild一致を検査。

公開先は https://docpdf-line-test.pages.dev/ を継続する。LINEメニューのアプリリンクは https://docpdf-line-test.pages.dev/?openExternalBrowser=1 、使い方は https://docpdf-line-test.pages.dev/help?openExternalBrowser=1 。ユーザーはこの入口からPDF生成とメールへの引渡しまで到達したと報告済み。今回の配信方式変更ではメニューの貼替えやLINEのAPIキーは不要。

コードは非公開リポジトリのまま。GitHub Pagesへの移転、公開リポジトリ化、LINEログイン、LIFF、トークへPDF送信、顧客情報のGitHub/Cloudflareへのアップロードを含めない。ブラウザー内の保存領域は同じoriginを維持するが、個別端末の保存保持は実機で確認する。

## 初回の接続だけ本人に必要

現在の接続にはCloudflare管理権限/認証、LINE画面操作、GitHub Secrets/Variables管理がない。CloudflareとLINEに該当する接続プラグインも検索結果0件。現在のGitHubコネクターはコードを保存できるが、認証情報やActionsの課金設定は操作できない。認証情報をチャットに送らない。

1. CloudflareのAPIトークン画面 https://dash.cloudflare.com/profile/api-tokens を開く。Cloudflare公式手順のカスタムトークンを作り、**Account / Cloudflare Pages / Edit** を既存docpdf-line-testが属するアカウントだけへ付与する。Global API Keyは使わない。Pages Editはアカウント内Pagesにも効くため対象アカウントを確認する。
2. GitHubの https://github.com/lupisflora-n/R/settings/secrets/actions でRepository secretsに `CLOUDFLARE_API_TOKEN` を直接保存し、同アカウントのAccount IDを `CLOUDFLARE_ACCOUNT_ID` として保存する。顧客情報・パスワード・トークンをコードへ記載しない。
3. GitHubのActionsが利用可能で、既存プランの無料実行枠と追加従量課金をしない設定を確認する。有料プランへの変更や支払登録は行わない。既存無料枠で実行できない場合は有効にせず別案を検討する。
4. https://github.com/lupisflora-n/R/settings/variables/actions でRepository variable `DOCPDF_AUTO_PUBLISH` を `true` にする。この変数は初期接続/無料枠確認が済んだことを示す運用スイッチで、公開許可の取り直しではない。
5. Codexが専用ブランチに変更を保存して最初の配信を起動し、Actionsの結果と固定URLのbuildを照合する。以後アプリ/検査/配信スクリプトの変更は自動更新。資料だけの変更は配信しない。停止は同変数を削除またはfalseにする。

## 実装上の境界

- `.github/workflows/docpdf-line-pages.yml` はpush先を `codex/docpdf-line` に限定し、jobも同じrefを検査。mainとcodex/docscan-v2へ反映しない。手動dispatchやPR起動は設けない。
- 初回は運用変数が未設定ならjobをスキップし、実行枠を消費するrunnerを起動しない。資格情報の存在を確かめてから処理し、値を表示しない。
- 公式Actionsは確認したコミットSHAに固定、Node 24.19.0、Wrangler 4.149.0に固定。GitHub権限はcontents:read、checkoutの認証保持なし、並行配信を直列化、1実行10分で打切り。
- 構文/合成検査、build、LINE資源の静的検査、公開資源allowlist/全ハッシュ検査を通った `dist` だけを送る。文書、試験PDF、資料、release ZIP、資格情報を配信しない。
- Cloudflare既存Direct UploadプロジェクトはGit integrationへ切替え不可。公式のGitHub Actions + Wrangler方式なら同じDirect Uploadプロジェクトを更新できる。`--branch=main` はそのサイト内のProduction環境を選ぶ指定で、GitHub mainを変更する操作ではない。
- 配信要求成功だけで完了にせず、固定URLのbuild/filesを最大12回照合。不一致/通信失敗は失敗と記録する。ロールバックは自動実行しない。
- この検査はブラウザー/LINE/実機の操作合格を意味しない。PWAの更新は保存・処理終了後の案内で適用し、端末DBを消さない。

## 根拠と現状

- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

自動配信は認証・無料枠確認・運用スイッチ未設定のため未実行。固定編集版の候補buildは `6dc49a208f65eb40`。公開中の最終本人報告は `c9bba312e31d048d` / files34。新しい公開build、ヘッダー、実機操作を未検証のまま成功としない。
