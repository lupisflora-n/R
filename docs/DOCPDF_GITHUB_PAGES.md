# docPDF｜GitHub Pagesで公開してLINEから開く

2026-10-09。本人はCloudflare配信ではなくGitHub Pagesを希望し、確認へ「コードも公開してよい」と明示回答。Rのソース公開と専用LINE版のPages配信を承認。本線コード/mainへマージ、課金、顧客書類の外部送信を含めない。

## 公開経路

codex/docpdf-line → docpdf-github-pages.yml → 検査済み静的dist → GitHub Pages → docPDFの既存LINEメニュー。

公開予定（未配信）: https://lupisflora-n.github.io/R/ 。候補build5e8b035ee28cea55/files35。公開確認後にLINEへ設定するリンク:

- アプリ: https://lupisflora-n.github.io/R/?openExternalBrowser=1
- 使い方: https://lupisflora-n.github.io/R/help.html?openExternalBrowser=1

LIFF/LINEログイン/APIトークンは不要。LINEは入口、撮影/加工/PDFは外部ブラウザー。宛先/添付確認と最終メール送信は利用者が行う。

## 本人に必要な初回設定

接続はGitHubのコードを書けるが、リポジトリ公開/非公開の変更とPages管理ツールがない。LINE/ブラウザー管理画面操作接続もない。公開承認は済んでおり、下記は管理権限を持つ本人の画面操作。

1. https://github.com/lupisflora-n/R/settings の最下部Danger Zone → Change repository visibility → Change visibility → Make public。表示対象lupisflora-n/Rを確認して公開。ブランチだけでなくRのコード/履歴全体が閲覧可能になる。
2. https://github.com/lupisflora-n/R/settings/pages のBuild and deployment → SourceをGitHub Actionsにする。mainへテンプレート追加やDeploy from a branchは不要。
3. github-pages environmentがブランチを制限する場合、Settings → Environments → github-pages → Deployment branches and tagsへcodex/docpdf-lineを許可。実配信のエラーに応じて確認し、設定を推測で変えない。
4. Codexが状態を再読取りし、専用ブランチpushで配信を起動する。公開設定変更だけではpushが起きない。skipped runを公開成功としない。
5. Actions成功/固定URLのbuild一致、架空書類の撮影/編集/PDF/共有を確認後、LINE Managerの既存リッチメニューの2リンクを上記へ変更して保存。画像は既存素材を使用できる。メッセージ配信不要。

Cloudflareトークン/GitHub Secrets登録は不要。旧Cloudflare配信用workflowを削除、旧サイトは変更/削除しない。

## 保存済み書類

旧 https://docpdf-line-test.pages.dev/ とgithub.ioは別origin。写真/PDF/履歴は自動移行されない。旧サイトで必要日付の復元用バックアップZIPを保存→新サイトの復元→内容と保持確認。PDFだけなら旧サイトから保存。旧サイトのDB/キャッシュを消さない。実書類の移行/送信はCodexが代行しない。

## 技術と検査の境界

- HTML資源/manifestを相対URL、LINE起動先を配信module URLから計算して/R/を保持。個人情報/redirect/query/fragmentを持ち越さない。Service Workerは自身のscope内の既知HTMLだけを扱い、同github.ioの別プロジェクトを捕捉しない。DB形式と画質は不変。
- publicになるまでjobはスキップ。専用branch pushのみ、無料の公開リポジトリ標準Ubuntu runner、job各10分、直列配信。Actionsは取得SHA固定。buildはcontents:read、deployだけpages:write/id-token:writeを追加。checkout認証保持なし。課金/契約変更なし。
- 構文/合成/build/静的/公開allowlist・hash/R内資源確認後にdistだけを配信。原本/試験PDF/資料/秘密をartifactへ入れない。配信後に固定URLのbuild/files一致を確認、不一致は失敗。
- GitHub PagesはCloudflareの_headersを適用しない。HTML CSP/no-referrerは付けたが、frame-ancestors/Permissions-Policy/nosniff等のHTTP保護を同じように強制できるとは説明しない。実配信ヘッダー/ブラウザー挙動は別途確認。
- 新URLの実ブラウザー/Android/iPhone/LINE/保存移行は未検証。旧版でPDF/メールに到達した本人報告を新版の合格に置き換えない。

根拠: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages 、 https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility 。この判断は旧Cloudflare方式docs/DOCPDF_GITHUB_PUBLICATION.mdより新しい。旧資料は履歴として保持。
