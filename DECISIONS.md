# DECISIONS｜決定・提案・未確認
版2.0 / 2026-10-02

| ID | 内容 | 状態 | 理由/扱い |
|---|---|---|---|
| ADR01 | iPhoneとAndroidを初版対象 | USER_FIXED | 最新の明示条件 |
| ADR02 | 基本無料、本人は確認/判断 | USER_FIXED | 最新の明示条件。開発利用枠は別 |
| ADR03 | PWA＋無料静的配信 | DESIGN_DEFAULT | 無料/iPhone/更新の両立。実機合格を要する |
| ADR04 | 1枚ずつ原本保存、必要時PDF | DESIGN_DEFAULT | 中断保護と選択自由。v1継承 |
| ADR05 | 手動四隅を必須、自動は任意 | DESIGN_DEFAULT | ユーザーの安定性優先に沿う |
| ADR06 | IndexedDBにBlobと情報を同居 | DESIGN_DEFAULT | 初版の二重管理を避ける |
| ADR07 | PDF外部保存＋日付復元パック | DESIGN_DEFAULT | ブラウザー保存消失への備え |
| ADR08 | Cloudflare Pages、動的機能なし | DESIGN_DEFAULT | 課金対象を増やさない |
| ADR09 | iOS17以降を暫定対象 | TEST_PENDING | 実際の配布対象/実機結果で確定。対象縮小は確認 |
| ADR10 | 10ページ認証、20ページ拡張 | TEST_PENDING | 画質を守るメモリ試験が先 |
| ADR11 | メールはFileの直接共有 | TEST_PENDING | iPhoneとAndroid実機必須。救済動線のみでは合格不可 |
| ADR12 | 認証/公開/費用は監督承認 | USER_POLICY | 制作の自律性と外部行為を分ける |
| ADR13 | 監査・PoCで止まらない | DESIGN_DEFAULT | 内部ゲートはCodexが検査して継続 |
| ADR14 | モデルは利用可能なものから | ENV_PENDING | 提供差、既存枠、過剰切替を避ける |
| ADR15 | 正式origin/リポジトリ | UNSET | 読取りで特定してから必要な承認を得る |

## 撤回するv1方針
Androidのみ、Kotlin/Compose/Room、ML Kit前提、Play配布前提、切り抜き前原本の復元不可、完全復元はすべて初版範囲外、最初は監査で終了。新構成と矛盾する旧指示は有効ルートから外すが、既存原本を破壊しない。

## 2026年10月3日の実装判断

| ID | 内容 | 状態と根拠 |
|---|---|---|
| ADR16 | 引き継ぎ資料を既存のローカルRへ統合 | SESSION_SCOPE。ユーザーがこのRで開発開始を依頼。既存README/AGENTSはdocs/initial-projectに保管。リモートと公開先は未設定 |
| ADR17 | 初回の無料依存取得 | USER_APPROVED。ユーザーの「承認」を受領。ただし権限付き実行要求が2回返らず本人が中断。取得成功とは記録しない |
| ADR18 | 新規取得を保留し、既存の無料資源を同梱 | IMPLEMENTED。pdf-lib 1.17.1、JSZip 3.10.1、PDF.js 5.6.205 legacy。ライセンスとSHA-256をvendorに保持。依存の脆弱性情報をオンラインで監査したとは説明しない |
| ADR19 | 暫定UI/保存/透視補正はブラウザー標準 | IMPLEMENTED。React/Vite/Dexie/OpenCVは未取得。TypeScriptの構文をNodeで除去して静的ビルド、標準IndexedDB、単一Workerの射影・双線形補間。iPhone/無料/原本保持/必要時PDFは維持。技術案の変更であり中核仕様の縮小ではない。21件の純粋処理検査、実機は未検証 |
| ADR20 | ブラウザー検査を未実施として記録 | BLOCKED。標準サンドボックスでlisten EPERM、ChromiumのIPC setsockopt EPERM。追加権限要求で再び無期限に待たない。型検査も未導入であり、構文検査を型検査とは扱わない |
| ADR21 | 処理・復元の暫定メモリ上限 | TEST_PENDING。1入力50MiB/24MP、1PDF10枚、ZIP1部50MiB/10枚、全体100MiB。書出しと読込みを整合させ、原本を黙って落とさない。100MiB超の段階的復元は今後実装。実機の性能に基づいた認証値ではない |
| ADR22 | 公開・認証・GitHub書込み・課金 | NOT_PERFORMED。今回の承認は無料依存取得まで。GitHubのorigin、Cloudflareプロジェクト、プレビューURLは設定していない |

## 変更記録テンプレート
日時 / 問題 / 根拠（公式または実測）/ 候補 / 推奨 / 採否 / 影響ファイル / 利用者への影響 / データ互換性 / 復旧方法 / 監督承認要否 / 証拠。

## 2026-10-06 ローカル検証判断
ADR23: Windows cloneでvendor整合性を保つためvendor/**をGit改行変換対象外にする。既存バイト列とSHA-256を維持。追加依存取得せず、Windows同梱Playwright/Chromiumでローカル画面検査。公開承認不要のPC内プレビューを使用。外部公開・GitHub書込みは実行しない。

## 2026-10-06 実機準備
ADR24 decided: 本人はAndroidのみ利用可能。Androidから検査しiPhone未検証を保持。ADR25 provisional: 小規模な失敗仮説UX01〜03と初見3人で使いやすさを確認（Dラボの数値基準ではなくプロジェクト案）。ADR26 open: docs/PREVIEW_RELEASE.mdの静的buildを検証専用Cloudflare Pagesへ公開する承認・認証。DB形式と両OS初版要求は変更なし。

ADR26 decided（2026-10-06）: 本人が公開判断カードに「おｋ」と回答。build 87b14b90678791ddの静的アプリ29ファイルをCloudflare Pages Freeの検証専用新規プロジェクトへ公開することを承認。一般提供・課金・文書アップロードは対象外。Cloudflareログイン画面を開き、本人のログイン待ち。

ADR27 decided（2026-10-07）: 承認済み検証範囲内でCloudflare固有のリダイレクトとService Worker応答の不具合を修正し同URLへ再配信。保存形式は不変。URL https://docscan-v2-test.pages.dev/ 、build 93e093055e8d0ad7。一般提供の承認ではない。

## 2026-10-08 LINE版docPDFの分岐
ユーザーは本線に影響を与えない別案として企画・設計・製作を依頼。公式アカウントdocPDFとRプロジェクトプロバイダー、LINEログインチャネルdocPDFを本人が作成。業務報告書に顧客住所/名前、個人スマホ利用という条件から、LINEを起動の入口に限定し、通常ウェブURL+openExternalBrowser=1で外部ブラウザーの端末内処理へ進める案を説明し、本人「OK」「お願いします」で製作を開始。
LIFF/LINEログイン/プロフィール取得/トークへ書類送信/サーバー変換は導入しない。LINE内UA判定は撮影前の案内用でありOS保証ではない。実機でLINEからの起動を確認する。本線GitHub/既存公開は変更しない。新規専用originは配信条件。ローカル製作を新規サイト公開や一般提供、勤務先の業務承認と同一視しない。公開判断はdocs/DOCPDF_LINE_RELEASE.md。

## 2026-10-08 docPDF検証公開と独立GitHub保存の承認
ユーザー「おっけー」でdocs/DOCPDF_LINE_RELEASE.mdの具体的範囲を承認。新規Cloudflare静的検証サイト（候補docpdf-line-test）、静的34ファイルのbuild 9bc8137a41c23e08、GitHub lupisflora-n/Rの新規codex/docpdf-lineへの保存。本線や既存サイトを変更しない。一般提供、費用追加、実書類の送信、LINEメッセージ配信は含めない。公開時に本人操作が必要でも、同じ公開許可を取り直さない。

## 2026-10-08 docPDF UX・削除契約

編集3工程・参照配色・ごみ箱/復元/未参照写真の完全削除をLINE独立版へ実装。合成37 PASS、構文19・静的4・ZIP一致PASS。ブラウザーはIPC拒否でBLOCKED（0 PASS）。詳細と次作業はdocs/DOCPDF_UX_RELEASE.md。完成PDF参照の写真は完全削除禁止。原本の書換/メール送信成功の自動判定なし。
