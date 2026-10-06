# Android実機試験用の公開判断カード

2026-10-06 / 未公開 / 公開承認・アカウント確認待ち

## 公開するもの

- build `87b14b90678791dd`。`release/docscan-preview-87b14b90678791dd.zip`。
- 29ファイル、展開4,122,897 bytes、ZIP995,611 bytes。SHA-256と全ファイル一覧は`evidence/preview-package.json`。
- `dist`の静的アプリ資源のみ。試験で作成した文書、PDF、スクリーンショット、開発資料、Git履歴、認証情報は含めない。
- ローカル用iframeではなく、公開先のルートURLをAndroid Chromeで直接開く。

## 推奨する公開先と範囲

Cloudflare Pages Freeの**検証専用新規プロジェクト**。候補名`docscan-v2-test`（空き未確認、既存プロジェクトへ上書きしない）。固定pages.dev URLへDirect Uploadする。アプリ内文書は端末内に保存され、公開するのはアプリコードのみ。URLを知る第三者もアクセス可能な公開配信であり、非公開テストサイトとは呼ばない。

初回は本人のAndroidで架空試験紙だけを使う。検証期間は7日を提案し、延長・削除はその時点で判断。自動削除の予約はしていない。今回は一般ユーザーへの案内・mainマージ・本番提供を含めない。Functions/DB/有料サービス/独自ドメインは追加しない。Cloudflareアカウントが未確認のため、ログインは本人がブラウザーで行い、パスワードやトークンをチャットへ貼らない。

2026-10-06に確認した公式資料: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)、[Limits](https://developers.cloudflare.com/pages/platform/limits/)。ZIPで静的資源を配布でき、単一アセット25MiB上限。今回の全資源はその範囲内。実際のアカウントでFreeと追加料金なしを確認してから進める。無料条件の永久保証はしない。

## 公開前後のチェック（Codex担当）

1. 本人の公開承認をDECISIONSへ記録し、ログイン・アカウント・新規プロジェクト名を確認。
2. 配布ZIPのSHA-256を台帳と照合し、静的資源だけをDirect Upload。コード上の機能追加はしない。
3. 公開URLのbuild.json、HTTPS、CSP等のレスポンスヘッダー、資源エラー、保存とPDF経路を確認。ローカルサーバーが`_headers`を適用していない点は、本番ホスト上で別途確認する。
4. 実機に渡すURLとbuildをDEVICE_CHECKへ記録。最初はdocs/DEVICE_TEST_GUIDEの「写真1枚からメール添付」だけを案内。
5. 公開後のモック検査を実機合格にしない。実機結果が揃うまで一般提供NO-GO。
6. 問題時は新規試験を中止し、保存済み文書を外部保存する手順を案内。サイトを戻しても端末DBやService Workerが即座に戻るとは説明しない。

## 判断が必要な1点

上記の候補buildをCloudflare Pages Freeの検証専用公開URLへ置き、本人のAndroidで試験を始めてよいか。公開承認後に認証が必要なら、本人のログイン操作だけを依頼する。

## 2026-10-07 実施結果
本人承認・ログインを受けて新規docscan-v2-testを作成。初回公開の再読込み不具合を修正して同範囲で再配信。現在のURLは https://docscan-v2-test.pages.dev/ 、build 93e093055e8d0ad7、公開後E2E8件PASS。現在の配布台帳はevidence/preview-package.json。上記87b14b90678791ddのZIPは旧版。検証用URLであり一般提供は未承認。
