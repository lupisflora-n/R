# docPDF｜差分レビュー

2026-10-08。主担当の自己レビューと別エージェント1名の読取りレビュー。人による業務承認・実機検査ではない。

## 範囲

復元基点 `77bd891` からの差分と新規entry/handoff/landing/help、URLの組立て、Service Worker、ビルドとテスト。書類の処理コア・DB schemaは変更していない。

## 指摘と処置

1. Cloudflare Pagesが `.html` を拡張子なしURLへ転送するため、追加したhelp/lineページがオフラインでキャッシュに当たらない。
   - 修正: 同一originの `/`・`/index`・`/index.html`・`/line`・`/line.html`・`/help`・`/help.html` の明示対応表に変更。別origin・未知経路・非GETを捕捉しない。
   - 検査: Node VMで各HTMLの本文対応、canonical経路、別origin・POST・未知経路を確認。これは実ホストや実Service Workerのブラウザー検査ではない。
2. LINEブラウザー試験ハーネスが、ブラウザー起動後の検査外エラーで終了コード1と `COMPLETED` を同時に記録し得る。
   - 修正: catchで未記録の失敗を `browser harness / FAIL` として追加。構文・該当分岐の自己レビューを実施。実ブラウザーの注入失敗試験は未実施。
3. root配信・別origin前提を公開条件として明記する。
   - 処置: 設計・設定手順に本線サイトへ上書きしない条件を記載。貼付URL生成スクリプトでも本線のホストを拒否。これは本人の誤操作すべてを防ぐ保証ではない。

別担当はLINE分岐で文書importゼロ、非LINEでJSZip→アプリ順序、JSZipをES moduleとして評価した合成ZIP往復をNode VMで確認。P0/P1はレビュー範囲で見つからなかった。ブラウザー・実LINE・実機合格を主張しない。

## 残る条件

UA判定は補助でありOS保証ではない。実LINEから外部ブラウザーへ移る挙動、追加UIの描画・操作、通常ブラウザーの新entry経由の文書E2E、実通信と配信ヘッダー、iPhone、旧→新原本保持は未検証。一般提供／実務利用はNO-GO。
